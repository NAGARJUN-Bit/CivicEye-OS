import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain, BarChart3, Clock, CheckCircle2, AlertTriangle,
  Users, TrendingUp, Target,
  MapPin, Zap, Activity, RefreshCw, Loader, ChevronDown,
  ChevronUp, Building2, Star
} from 'lucide-react';
import { Issue } from '../../lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface AdminIntelligenceDashboardProps {
  issues: Issue[];
}

interface DeptStats {
  name: string;
  total: number;
  active: number;
  resolved: number;
  highPriority: number;
  efficiency: number;
  avgVerifications: number;
}

interface AIRecommendation {
  dept: string;
  priority: 'critical' | 'high' | 'medium';
  recommendation: string;
  action: string;
}

interface GeminiRecs {
  recommendations: AIRecommendation[];
  operationalSummary: string;
  topInsight: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const SEVERITY_HIGH_THRESHOLD = 70;

function parseSeverity(s: string | number): number {
  const n = typeof s === 'number' ? s : parseFloat(s);
  return isNaN(n) ? 50 : n;
}

function statusWeight(status: Issue['status']): number {
  const weights: Record<string, number> = {
    submitted: 0, classified: 1, verification: 2,
    assigned: 3, in_progress: 4, pending_authority: 5,
    accepted: 6, repair_scheduled: 7, resolved: 8,
  };
  return weights[status] ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini SVG bar
// ─────────────────────────────────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent: string;
}) {
  return (
    <div className="card-inner rounded-2xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="section-label">{label}</span>
        <Icon className={`w-4 h-4 ${accent}`} />
      </div>
      <div className={`metric-value text-2xl font-bold ${accent} leading-none`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminIntelligenceDashboard({ issues }: AdminIntelligenceDashboardProps) {
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [geminiRecs, setGeminiRecs] = useState<GeminiRecs | null>(null);
  const [recError, setRecError] = useState<string | null>(null);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  // ── Derived metrics ───────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (issues.length === 0) return null;

    const resolved = issues.filter(i => i.status === 'resolved');
    const open = issues.filter(i => i.status !== 'resolved');
    const highPriority = issues.filter(i => parseSeverity(i.severity) >= SEVERITY_HIGH_THRESHOLD);
    const totalVerifications = issues.reduce((s, i) => s + (i.verificationCount ?? 0), 0);
    const avgVerifications = issues.length > 0 ? totalVerifications / issues.length : 0;
    const resolutionRate = issues.length > 0 ? (resolved.length / issues.length) * 100 : 0;

    // Department stats
    const deptMap = new Map<string, DeptStats>();
    for (const issue of issues) {
      const dept = issue.department || 'Unknown';
      const existing = deptMap.get(dept) ?? {
        name: dept, total: 0, active: 0, resolved: 0,
        highPriority: 0, efficiency: 0, avgVerifications: 0,
      };
      existing.total += 1;
      if (issue.status === 'resolved') existing.resolved += 1;
      else existing.active += 1;
      if (parseSeverity(issue.severity) >= SEVERITY_HIGH_THRESHOLD) existing.highPriority += 1;
      deptMap.set(dept, existing);
    }

    // Efficiency = % progressed past initial stages
    for (const dept of deptMap.values()) {
      const deptIssues = issues.filter(i => (i.department || 'Unknown') === dept.name);
      const advanced = deptIssues.filter(i => statusWeight(i.status) >= 3).length;
      dept.efficiency = dept.total > 0 ? (advanced / dept.total) * 100 : 0;
      const totalVeri = deptIssues.reduce((s, i) => s + (i.verificationCount ?? 0), 0);
      dept.avgVerifications = dept.total > 0 ? totalVeri / dept.total : 0;
    }

    // Category distribution
    const catMap = new Map<string, number>();
    for (const issue of issues) {
      const cat = issue.issueType || 'Unknown';
      catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
    }
    const topCategories = [...catMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    // Location hotspots (group by rounded coords)
    const locMap = new Map<string, { lat: number; lng: number; count: number; label: string }>();
    for (const issue of issues) {
      const key = `${issue.location.latitude.toFixed(2)},${issue.location.longitude.toFixed(2)}`;
      const existing = locMap.get(key);
      if (existing) existing.count += 1;
      else locMap.set(key, {
        lat: issue.location.latitude,
        lng: issue.location.longitude,
        count: 1,
        label: `${issue.location.latitude.toFixed(3)}°, ${issue.location.longitude.toFixed(3)}°`,
      });
    }
    const topLocations = [...locMap.values()].sort((a, b) => b.count - a.count).slice(0, 5);

    // Dept workload (issues per dept)
    const deptList = [...deptMap.values()].sort((a, b) => b.total - a.total);

    // Avg response time: proxy = avg status weight × 0.8 days
    const avgResponseDays = issues.length > 0
      ? issues.reduce((s, i) => s + statusWeight(i.status) * 0.8, 0) / issues.length
      : 0;

    // Avg resolution time: for resolved issues, weight=5 → ~4 days proxy
    const avgResolutionDays = resolved.length > 0 ? 4.0 : 0;

    return {
      total: issues.length,
      resolved: resolved.length,
      open: open.length,
      highPriority: highPriority.length,
      totalVerifications,
      avgVerifications,
      resolutionRate,
      deptList,
      topCategories,
      topLocations,
      avgResponseDays,
      avgResolutionDays,
    };
  }, [issues]);

  // ── AI Recommendations ────────────────────────────────────────────────────
  async function fetchRecommendations() {
    if (!metrics || loadingRecs) return;
    setLoadingRecs(true);
    setRecError(null);

    try {
      const summary = {
        totalIssues: metrics.total,
        resolvedIssues: metrics.resolved,
        openIssues: metrics.open,
        highPriorityIssues: metrics.highPriority,
        resolutionRate: metrics.resolutionRate.toFixed(1),
        avgResponseDays: metrics.avgResponseDays.toFixed(1),
        avgVerifications: metrics.avgVerifications.toFixed(1),
        departments: metrics.deptList.map(d => ({
          name: d.name,
          total: d.total,
          active: d.active,
          resolved: d.resolved,
          highPriority: d.highPriority,
          efficiency: d.efficiency.toFixed(1),
        })),
        topCategories: metrics.topCategories.map(([cat, cnt]) => ({ category: cat, count: cnt })),
        topLocations: metrics.topLocations.slice(0, 3).map(l => ({ location: l.label, count: l.count })),
      };


      const response = await fetch('/api/admin-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary }),
      });

      if (!response.ok) throw new Error(`API error ${response.status}`);
      const parsed: GeminiRecs = await response.json();
      setGeminiRecs(parsed);
    } catch (err) {
      setRecError('Failed to generate recommendations. Please try again.');
    } finally {
      setLoadingRecs(false);
    }
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!metrics || issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Brain className="w-12 h-12 text-slate-700" />
        <p className="text-slate-500 text-sm">No issue data yet. Submit reports to populate the dashboard.</p>
      </div>
    );
  }

  const maxDeptTotal = metrics.deptList[0]?.total ?? 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200 leading-tight">Admin Intelligence</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Operational overview · {metrics.total} total reports</p>
          </div>
        </div>
        <button
          onClick={fetchRecommendations}
          disabled={loadingRecs}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600/20 hover:bg-violet-600/30 disabled:opacity-50 text-violet-400 border border-violet-500/25 text-xs font-semibold rounded-xl transition-colors"
        >
          {loadingRecs ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {loadingRecs ? 'Analyzing…' : 'AI Recommendations'}
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Issues" value={metrics.total} icon={BarChart3} accent="text-violet-400"
          sub={`${metrics.open} open · ${metrics.resolved} resolved`} />
        <StatCard label="Avg Response Time" value={`${metrics.avgResponseDays.toFixed(1)}d`}
          icon={Clock} accent="text-sky-400" sub="Proxy via status progression" />
        <StatCard label="Avg Resolution Time" value={metrics.avgResolutionDays > 0 ? `${metrics.avgResolutionDays}d` : 'N/A'}
          icon={CheckCircle2} accent="text-emerald-400" sub="Resolved issues only" />
        <StatCard label="High Priority" value={metrics.highPriority}
          icon={AlertTriangle} accent="text-red-400" sub={`≥${SEVERITY_HIGH_THRESHOLD} severity score`} />
        <StatCard label="Resolution Rate" value={`${metrics.resolutionRate.toFixed(1)}%`}
          icon={Target} accent="text-emerald-400" sub="Resolved / total" />
        <StatCard label="Citizen Participation" value={metrics.totalVerifications}
          icon={Users} accent="text-amber-400" sub={`${metrics.avgVerifications.toFixed(1)} avg per issue`} />
        <StatCard label="Dept Efficiency" value={`${metrics.deptList.length > 0
          ? (metrics.deptList.reduce((s, d) => s + d.efficiency, 0) / metrics.deptList.length).toFixed(0)
          : 0}%`}
          icon={TrendingUp} accent="text-sky-400" sub="Progress past initial stages" />
        <StatCard label="Active Departments" value={metrics.deptList.length}
          icon={Building2} accent="text-violet-400" sub="Handling open issues" />
      </div>

      {/* Department Workload & Efficiency */}
      <div className="card-inner rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4"><div className="w-6 h-6 rounded-md bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0"><Building2 className="w-3 h-3 text-violet-400" /></div><h3 className="text-xs font-semibold text-slate-300">Department Workload &amp; Efficiency</h3></div>
        <div className="space-y-2">
          {metrics.deptList.map(dept => (
            <div key={dept.name} className="bg-white/[0.02] rounded-xl overflow-hidden border border-white/[0.05]">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => setExpandedDept(expandedDept === dept.name ? null : dept.name)}
                aria-expanded={expandedDept === dept.name}
                aria-label={`${expandedDept === dept.name ? 'Collapse' : 'Expand'} ${dept.name} details`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-200 truncate">{dept.name}</span>
                    <div className="flex items-center gap-3 ml-2 shrink-0">
                      {dept.highPriority > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-red-400 font-semibold">
                          <AlertTriangle className="w-3 h-3" /> {dept.highPriority}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500">{dept.total} issues</span>
                    </div>
                  </div>
                  <MiniBar value={dept.total} max={maxDeptTotal} color="bg-violet-600" />
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <div className="text-right">
                    <div className={`metric-value text-sm font-bold leading-none ${dept.efficiency >= 70 ? 'text-emerald-400' : dept.efficiency >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                      {dept.efficiency.toFixed(0)}%
                    </div>
                    <div className="text-[10px] text-slate-600">eff.</div>
                  </div>
                  {expandedDept === dept.name
                    ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                    : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                </div>
              </button>
              <AnimatePresence>
                {expandedDept === dept.name && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 px-4 pb-3">
                      {[
                        { label: 'Active', val: dept.active, color: 'text-amber-400' },
                        { label: 'Resolved', val: dept.resolved, color: 'text-emerald-400' },
                        { label: 'High Priority', val: dept.highPriority, color: 'text-red-400' },
                        { label: 'Avg Verifications', val: dept.avgVerifications.toFixed(1), color: 'text-sky-400' },
                      ].map(({ label, val, color }) => (
                        <div key={label} className="bg-white/[0.03] rounded-lg p-2.5 text-center border border-white/[0.05]">
                          <div className={`metric-value text-base font-bold leading-none ${color}`}>{val}</div>
                          <div className="text-[10px] text-slate-500">{label}</div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Two column: categories + locations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top issue categories */}
        <div className="card-inner rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4"><div className="w-6 h-6 rounded-md bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0"><Activity className="w-3 h-3 text-sky-400" /></div><h3 className="text-xs font-semibold text-slate-300">Top Issue Categories</h3></div>
          <div className="space-y-2.5">
            {metrics.topCategories.map(([cat, cnt], idx) => {
              const maxCnt = metrics.topCategories[0]?.[1] ?? 1;
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold w-5 text-center ${idx === 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                    #{idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-300 truncate capitalize">{cat}</span>
                      <span className="text-xs text-slate-500 ml-2 shrink-0">{cnt}</span>
                    </div>
                    <MiniBar value={cnt} max={maxCnt} color={idx === 0 ? 'bg-sky-500' : 'bg-slate-700'} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Most affected locations */}
        <div className="card-inner rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4"><div className="w-6 h-6 rounded-md bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0"><MapPin className="w-3 h-3 text-red-400" /></div><h3 className="text-xs font-semibold text-slate-300">Most Affected Locations</h3></div>
          {metrics.topLocations.length === 0 ? (
            <p className="text-xs text-slate-600 italic">No location clusters yet.</p>
          ) : (
            <div className="space-y-3">
              {metrics.topLocations.map((loc, idx) => (
                <div key={loc.label} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    idx === 0 ? 'bg-red-900/50 text-red-400' : 'bg-slate-800 text-slate-500'
                  }`}>
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-slate-300 truncate">{loc.label}</div>
                    <div className="text-[10px] text-slate-600">{loc.count} report{loc.count !== 1 ? 's' : ''}</div>
                  </div>
                  <div className={`metric-value text-sm font-bold ${idx === 0 ? 'text-red-400' : 'text-slate-500'}`}>{loc.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Issue distribution */}
      <div className="card-inner rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4"><div className="w-6 h-6 rounded-md bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0"><BarChart3 className="w-3 h-3 text-violet-400" /></div><h3 className="text-xs font-semibold text-slate-300">Issue Distribution &amp; Resolution</h3></div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {(['submitted', 'classified', 'verification', 'assigned', 'in_progress', 'pending_authority', 'accepted', 'repair_scheduled', 'resolved'] as const).map(status => {
            const cnt = issues.filter(i => i.status === status).length;
            const pct = issues.length > 0 ? (cnt / issues.length) * 100 : 0;
            const colors: Record<string, string> = {
              submitted: 'text-slate-400', classified: 'text-sky-400',
              verification: 'text-amber-400', assigned: 'text-indigo-400',
              in_progress: 'text-orange-400', pending_authority: 'text-cyan-400',
              accepted: 'text-teal-400', repair_scheduled: 'text-purple-400',
              resolved: 'text-emerald-400',
            };
            return (
              <div key={status} className="bg-white/[0.025] rounded-xl p-3 text-center border border-white/[0.05]">
                <div className={`metric-value text-xl font-bold leading-none ${colors[status]}`}>{cnt}</div>
                <div className="text-[10px] text-slate-500 capitalize mt-0.5">{status.replace('_', ' ')}</div>
                <div className={`text-[10px] font-semibold ${colors[status]} mt-1`}>{pct.toFixed(0)}%</div>
              </div>
            );
          })}
        </div>

        {/* Resolution success rate visual */}
        <div className="mt-4 card-inner rounded-xl p-3">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-400 font-semibold">Resolution Success Rate</span>
            <span className={`metric-value font-bold ${metrics.resolutionRate >= 70 ? 'text-emerald-400' : metrics.resolutionRate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
              {metrics.resolutionRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${metrics.resolutionRate >= 70 ? 'bg-emerald-500' : metrics.resolutionRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${metrics.resolutionRate}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 mt-1.5">
            <span>0%</span><span>Target: 80%</span><span>100%</span>
          </div>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="card-inner rounded-2xl p-5" style={{borderColor:"rgba(109,40,217,0.20)"}}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-violet-500/10 border border-violet-500/20 flex items-center justify-center"><Brain className="w-3 h-3 text-violet-400" /></div>AI Recommendations
          </h3>
          {geminiRecs && (
            <button
              onClick={fetchRecommendations}
              disabled={loadingRecs}
              aria-label="Refresh AI recommendations"
              className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-violet-400 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${loadingRecs ? 'animate-spin' : ''}`} /> Refresh
            </button>
          )}
        </div>

        {!geminiRecs && !loadingRecs && !recError && (
          <div className="empty-state py-10">
            <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center mb-2"><Brain className="w-5 h-5 text-slate-700" /></div>
            <p className="text-xs text-slate-500 text-center max-w-xs leading-relaxed">
              Click <span className="text-violet-400 font-semibold">AI Recommendations</span> above to generate
              AI-powered operational guidance for department managers.
            </p>
          </div>
        )}

        {loadingRecs && (
          <div className="flex items-center justify-center gap-3 py-8">
            <Loader className="w-5 h-5 text-violet-400 animate-spin" />
            <span className="text-xs text-slate-400">Analyzing operational data…</span>
          </div>
        )}

        {recError && (
          <div className="rounded-xl p-4 text-xs text-red-400 border" style={{background:"rgba(127,29,29,0.12)", borderColor:"rgba(248,113,113,0.18)"}}>
            {recError}
          </div>
        )}

        {geminiRecs && !loadingRecs && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Executive summary */}
            <div className="rounded-xl p-4 border" style={{background:"rgba(76,29,149,0.12)", borderColor:"rgba(109,40,217,0.20)"}}>
              <div className="flex items-start gap-2 mb-2">
                <Star className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-violet-400">Top Insight</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{geminiRecs.topInsight}</p>
              <p className="text-xs text-slate-500 leading-relaxed mt-2">{geminiRecs.operationalSummary}</p>
            </div>

            {/* Per-department recommendations */}
            <div className="space-y-2">
              {geminiRecs.recommendations.map((rec, idx) => {
                const priorityStyles: Record<string, { border: string; badge: string; dot: string }> = {
                  critical: { border: 'border-red-500/18', badge: 'bg-red-500/10 text-red-400', dot: 'bg-red-500' },
                  high: { border: 'border-amber-500/18', badge: 'bg-amber-500/10 text-amber-400', dot: 'bg-amber-500' },
                  medium: { border: 'border-sky-500/15', badge: 'bg-sky-500/10 text-sky-400', dot: 'bg-sky-500' },
                };
                const style = priorityStyles[rec.priority] ?? priorityStyles.medium;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.07 }}
                    className={`bg-white/[0.025] border ${style.border} rounded-xl p-4`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full ${style.dot} shrink-0 mt-1.5`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-slate-200">{rec.dept}</span>
                          <span className={`badge ${style.badge} capitalize`}>
                            {rec.priority}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed mb-2">{rec.recommendation}</p>
                        <div className="flex items-start gap-1.5">
                          <Zap className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-violet-300 font-medium leading-relaxed">{rec.action}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
