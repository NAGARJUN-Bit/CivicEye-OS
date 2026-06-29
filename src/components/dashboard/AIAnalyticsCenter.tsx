import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp, Minus, BarChart3, Activity, AlertTriangle,
  Brain, Wrench, Map, Leaf, Loader, ShieldAlert,
  ChevronUp, ChevronDown, Zap, Target, Calendar, Layers,
  CheckCircle2, Clock
} from 'lucide-react';
import { Issue } from '../../lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface AIAnalyticsCenterProps {
  issues: Issue[];
}

interface GeminiAnalytics {
  weeklyTrend: { summary: string; growth: string; outlook: string };
  monthlyTrend: { summary: string; growth: string; outlook: string };
  infrastructureHealth: { summary: string; riskLevel: string; recommendation: string };
  departmentForecast: { summary: string; forecasts: { dept: string; forecast: string; risk: string }[] };
  highRiskZones: { summary: string; zones: { name: string; riskLevel: string; action: string }[] };
  seasonalPredictions: { summary: string; predictions: { season: string; forecast: string; categories: string[] }[] };
  maintenanceRecommendations: { dept: string; recommendation: string; priority: string; timeframe: string }[];
  emergingCategories: { summary: string; categories: { name: string; trend: string; growth: string }[] };
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Chart Primitives
// ─────────────────────────────────────────────────────────────────────────────

interface BarChartProps {
  values: number[];
  labels: string[];
  color: string;
  highlightIndex?: number;
}

// NOTE: labels are rendered as regular HTML text rather than SVG <text>.
// The bars below intentionally use preserveAspectRatio="none"-style
// non-uniform scaling (via plain width/height) so they always fill the
// card width — but SVG text scaled that way stretches/squishes unevenly
// depending on the container's aspect ratio, which made labels blurry or
// unreadable on wide cards. Keeping labels in the DOM means they always
// render at a crisp, consistent font size regardless of card width.
const MiniBarChart: React.FC<BarChartProps> = ({ values, labels, color, highlightIndex }) => {
  const max = Math.max(...values, 1);

  return (
    <div className="w-full">
      <div className="flex items-end gap-1 sm:gap-1.5 h-16 sm:h-20">
        {values.map((v, i) => {
          const pct = Math.max(v > 0 ? 6 : 2, (v / max) * 100);
          const isHl = i === highlightIndex;
          return (
            <div key={i} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1">
              {v > 0 && (
                <span
                  className="text-[9px] sm:text-[10px] font-mono font-semibold leading-none tabular-nums"
                  style={{ color, opacity: isHl ? 1 : 0.75 }}
                >
                  {v}
                </span>
              )}
              <div
                className="w-full rounded-sm transition-all duration-500 ease-out"
                style={{ height: `${pct}%`, minHeight: 2, background: color, opacity: isHl ? 1 : 0.45 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 sm:gap-1.5 mt-1.5">
        {labels.map((lb, i) => (
          <span
            key={i}
            className={`flex-1 min-w-0 text-center text-[9px] sm:text-[10px] font-medium truncate ${
              i === highlightIndex ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            {lb}
          </span>
        ))}
      </div>
    </div>
  );
};

interface LineChartProps {
  values: number[];
  labels?: string[];
  color: string;
}

const MiniLineChart: React.FC<LineChartProps> = ({ values, labels, color }) => {
  const max = Math.max(...values, 1);
  const H = 56;
  const W = 100;
  const topPad = 10;
  const bottomPad = 6;
  const gradientId = `lg-${color.replace('#', '')}`;

  const points = values
    .map((v, i) => {
      const x = values.length === 1 ? 50 : (i / (values.length - 1)) * (W - 4) + 2;
      const y = H - bottomPad - (v / max) * (H - topPad - bottomPad);
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `2,${H - bottomPad} ${points} ${W - 2},${H - bottomPad}`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14 sm:h-16" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#${gradientId})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => {
          const x = values.length === 1 ? 50 : (i / (values.length - 1)) * (W - 4) + 2;
          const y = H - bottomPad - (v / max) * (H - topPad - bottomPad);
          return <circle key={i} cx={x} cy={y} r={1.6} fill={color} />;
        })}
      </svg>
      {labels && labels.length > 0 && (
        <div className="flex mt-1.5">
          {labels.map((lb, i) => (
            <span
              key={i}
              className="flex-1 min-w-0 text-center text-[9px] sm:text-[10px] font-medium text-slate-500 truncate"
            >
              {lb}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

interface RadialGaugeProps {
  score: number;
  color: string;
  label: string;
}

const RadialGauge: React.FC<RadialGaugeProps> = ({ score, color, label }) => {
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 100" className="w-24 h-24">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text x="50" y="52" textAnchor="middle" fontSize="20" fill="white" fontWeight="bold" fontFamily="monospace">
          {score}
        </text>
        <text x="50" y="64" textAnchor="middle" fontSize="7" fill="#94a3b8">
          /100
        </text>
      </svg>
      <span className="text-xs text-slate-400 mt-1 font-medium">{label}</span>
    </div>
  );
};

interface HBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}

const HBar: React.FC<HBarProps> = ({ label, value, max, color, suffix = '' }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-400 truncate max-w-[60%]">{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{value}{suffix}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

interface TrendBadgeProps {
  value: string;
}

const TrendBadge: React.FC<TrendBadgeProps> = ({ value }) => {
  const isUp = value.startsWith('+') || value.toLowerCase().includes('increase') || value.toLowerCase().includes('rising');
  const isDown = value.startsWith('-') || value.toLowerCase().includes('decrease') || value.toLowerCase().includes('falling');

  if (isUp) return (
    <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
      <ChevronUp className="w-3 h-3" />{value}
    </span>
  );
  if (isDown) return (
    <span className="flex items-center gap-1 text-red-400 text-xs font-bold">
      <ChevronDown className="w-3 h-3" />{value}
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-slate-400 text-xs font-bold">
      <Minus className="w-3 h-3" />Stable
    </span>
  );
};

interface RiskBadgeProps {
  level: string;
}

const RiskBadge: React.FC<RiskBadgeProps> = ({ level }) => {
  const l = level?.toLowerCase() || '';
  if (l.includes('critical')) return <span className="badge bg-red-500/10 text-red-400 border-red-500/25">CRIT</span>;
  if (l.includes('high')) return <span className="badge bg-amber-500/10 text-amber-400 border-amber-500/25">HIGH</span>;
  if (l.includes('medium') || l.includes('moderate')) return <span className="badge bg-sky-500/10 text-sky-400 border-sky-500/25">MED</span>;
  return <span className="badge bg-emerald-500/10 text-emerald-400 border-emerald-500/25">LOW</span>;
};

interface AISummaryBoxProps {
  text: string;
  color?: string;
}

const AISummaryBox: React.FC<AISummaryBoxProps> = ({ text, color = 'indigo' }) => {
  const borderClass = color === 'indigo' ? 'border-indigo-500/20' : color === 'emerald' ? 'border-emerald-500/20' : 'border-amber-500/20';
  const bgClass = color === 'indigo' ? 'bg-indigo-950/30' : color === 'emerald' ? 'bg-emerald-950/30' : 'bg-amber-950/30';
  const textClass = color === 'indigo' ? 'text-indigo-300' : color === 'emerald' ? 'text-emerald-300' : 'text-amber-300';

  return (
    <div className={`mt-3 p-3 rounded-xl border ${borderClass} ${bgClass}`}>
      <div className={`flex items-start gap-2 text-xs ${textClass}`}>
        <Brain className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-70" />
        <p className="leading-relaxed">{text}</p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SEASONS = ['Winter', 'Spring', 'Summer', 'Autumn'];
const SEASON_MONTHS: number[][] = [[12, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]];

function getCurrentSeason(): string {
  const m = new Date().getMonth() + 1;
  const idx = SEASON_MONTHS.findIndex(months => months.includes(m));
  return SEASONS[idx >= 0 ? idx : 0];
}

const AIAnalyticsCenter: React.FC<AIAnalyticsCenterProps> = ({ issues }) => {
  const [geminiData, setGeminiData] = useState<GeminiAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // ── Computed analytics from issues ──────────────────────────────────────────

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Weekday distribution
    const weekdayCounts = Array(7).fill(0) as number[];
    issues.forEach(issue => {
      const dow = new Date(issue.createdAt).getDay();
      weekdayCounts[dow]++;
    });

    // Monthly distribution (last 6 months)
    const monthlyCounts: number[] = [];
    const monthLabels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const targetMonth = (currentMonth - i + 12) % 12;
      const targetYear = currentYear - (currentMonth - i < 0 ? 1 : 0);
      const count = issues.filter(issue => {
        const d = new Date(issue.createdAt);
        return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
      }).length;
      monthlyCounts.push(count);
      monthLabels.push(MONTH_ABBR[targetMonth]);
    }

    // Category counts
    const categoryCounts: Record<string, number> = {};
    issues.forEach(issue => {
      const cat = issue.issueType || 'Unknown';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    // Department counts
    const deptCounts: Record<string, number> = {};
    issues.forEach(issue => {
      const dept = issue.department || 'Unknown';
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });

    // Department resolution rates
    const deptResolution: Record<string, { total: number; resolved: number; avgSeverity: number }> = {};
    issues.forEach(issue => {
      const dept = issue.department || 'Unknown';
      if (!deptResolution[dept]) deptResolution[dept] = { total: 0, resolved: 0, avgSeverity: 0 };
      deptResolution[dept].total++;
      if (issue.status === 'resolved') deptResolution[dept].resolved++;
      deptResolution[dept].avgSeverity += parseInt(issue.severity || '0', 10);
    });
    Object.keys(deptResolution).forEach(dept => {
      const d = deptResolution[dept];
      if (d.total > 0) d.avgSeverity = Math.round(d.avgSeverity / d.total);
    });

    // Severity stats
    const severities = issues.map(i => parseInt(i.severity || '0', 10));
    const avgSeverity = severities.length > 0 ? Math.round(severities.reduce((a, b) => a + b, 0) / severities.length) : 0;
    const maxSeverity = severities.length > 0 ? Math.max(...severities) : 0;

    // Open issues
    const openIssues = issues.filter(i => i.status !== 'resolved');
    const avgOpenSev = openIssues.length > 0
      ? openIssues.reduce((sum, i) => sum + parseInt(i.severity || '0', 10), 0) / openIssues.length
      : 0;

    // Health score (100 = perfect, drops with open issues and their severity)
    const healthScore = issues.length === 0 ? 100 : Math.max(0, Math.min(100,
      Math.round(100 - (avgOpenSev * 0.5) - (openIssues.length / Math.max(issues.length, 1)) * 20)
    ));

    // Resolved count
    const resolvedCount = issues.filter(i => i.status === 'resolved').length;
    const resolutionRate = issues.length > 0 ? Math.round((resolvedCount / issues.length) * 100) : 0;

    // Geographic clustering for risk zones
    const hotspots: { name: string; count: number; lat: number; lng: number; avgSeverity: number }[] = [];
    const visited = new Set<string>();

    function calcDist(lat1: number, lon1: number, lat2: number, lon2: number): number {
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    issues.forEach(issue => {
      if (visited.has(issue.id)) return;
      const cluster = [issue];
      visited.add(issue.id);
      issues.forEach(other => {
        if (!visited.has(other.id) && calcDist(
          issue.location.latitude, issue.location.longitude,
          other.location.latitude, other.location.longitude
        ) <= 600) {
          cluster.push(other);
          visited.add(other.id);
        }
      });
      if (cluster.length >= 2) {
        const avgS = Math.round(cluster.reduce((s, i) => s + parseInt(i.severity || '0', 10), 0) / cluster.length);
        hotspots.push({
          name: `${issue.department} Zone (${issue.issueType})`,
          count: cluster.length,
          lat: issue.location.latitude,
          lng: issue.location.longitude,
          avgSeverity: avgS,
        });
      }
    });

    hotspots.sort((a, b) => (b.count * 10 + b.avgSeverity) - (a.count * 10 + a.avgSeverity));

    // Weekly trend: compare this week vs previous
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    const thisWeekCount = issues.filter(i => new Date(i.createdAt) >= startOfWeek).length;
    const lastWeekCount = issues.filter(i => {
      const d = new Date(i.createdAt);
      return d >= startOfLastWeek && d < startOfWeek;
    }).length;

    const weeklyGrowth = lastWeekCount === 0
      ? (thisWeekCount > 0 ? '+100%' : 'Stable')
      : `${thisWeekCount > lastWeekCount ? '+' : ''}${Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100)}%`;

    // Monthly growth
    const thisMonthCount = monthlyCounts[5] || 0;
    const lastMonthCount = monthlyCounts[4] || 0;
    const monthlyGrowth = lastMonthCount === 0
      ? (thisMonthCount > 0 ? '+100%' : 'Stable')
      : `${thisMonthCount > lastMonthCount ? '+' : ''}${Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100)}%`;

    const topCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);

    const topDepts = Object.entries(deptCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    return {
      weekdayCounts, monthlyCounts, monthLabels, categoryCounts, deptCounts,
      deptResolution, avgSeverity, maxSeverity, healthScore, resolvedCount,
      resolutionRate, hotspots, weeklyGrowth, monthlyGrowth, topCategories,
      topDepts, openCount: openIssues.length, currentSeason: getCurrentSeason(),
      thisWeekCount, lastWeekCount, thisMonthCount, lastMonthCount,
    };
  }, [issues]);

  // ── Gemini API call ──────────────────────────────────────────────────────────

  const generateAnalytics = useCallback(async () => {
    if (issues.length === 0) return;
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        totalIssues: issues.length,
        resolvedCount: stats.resolvedCount,
        openCount: stats.openCount,
        avgSeverity: stats.avgSeverity,
        healthScore: stats.healthScore,
        weekdayCounts: stats.weekdayCounts,
        monthlyCounts: stats.monthlyCounts,
        monthLabels: stats.monthLabels,
        topCategories: stats.topCategories,
        topDepts: stats.topDepts,
        deptResolution: stats.deptResolution,
        hotspots: stats.hotspots.slice(0, 5).map(h => ({
          name: h.name, count: h.count, avgSeverity: h.avgSeverity,
          lat: h.lat.toFixed(4), lng: h.lng.toFixed(4),
        })),
        weeklyGrowth: stats.weeklyGrowth,
        monthlyGrowth: stats.monthlyGrowth,
        currentSeason: stats.currentSeason,
        currentMonth: MONTH_ABBR[new Date().getMonth()],
      };

      const res = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats: payload }),
      });

      if (!res.ok) throw new Error('Analytics API error');
      const data: GeminiAnalytics = await res.json();
      setGeminiData(data);
      setLastRefreshed(new Date());
    } catch (err: unknown) {
      console.error('Analytics error:', err);
      setError('AI analysis failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [issues, stats]);

  // ── Derived display values ─────────────────────────────────────────────────

  const healthColor = stats.healthScore >= 75 ? '#10b981' : stats.healthScore >= 50 ? '#f59e0b' : '#ef4444';
  const maxDeptCount = Math.max(...stats.topDepts.map(([, v]) => v), 1);
  const maxCatCount = Math.max(...stats.topCategories.map(([, v]) => v), 1);

  const peakDay = stats.weekdayCounts.indexOf(Math.max(...stats.weekdayCounts));
  const todayDow = new Date().getDay();

  // ── Render ─────────────────────────────────────────────────────────────────

  if (issues.length === 0) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="card rounded-3xl p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/8 border border-indigo-500/15 flex items-center justify-center mb-4">
            <BarChart3 className="w-7 h-7 text-indigo-400/60" />
          </div>
          <h3 className="text-base font-semibold text-slate-300 mb-2">No Data to Analyse</h3>
          <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
            Submit at least one civic issue report from the Citizen tab to unlock the AI Analytics Center.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ── Header + CTA ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200 leading-tight">AI Analytics Center</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Powered by Gemini · {issues.length} issue{issues.length !== 1 ? 's' : ''} analysed
              {lastRefreshed && ` · Updated ${lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
        </div>
        <button
          onClick={generateAnalytics}
          disabled={isLoading}
          className="flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 disabled:opacity-50 text-indigo-400 border border-indigo-500/25 px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors"
        >
          {isLoading
            ? <><Loader className="w-4 h-4 animate-spin" /> Generating Insights…</>
            : <><Zap className="w-4 h-4" /> {geminiData ? 'Refresh AI Insights' : 'Generate AI Insights'}</>
          }
        </button>
      </div>

      {isLoading && (
        <div className="loading-bar" aria-hidden="true">
          <div className="loading-bar-fill" />
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-500/30 rounded-2xl p-4 text-sm text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* ── Executive KPI strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Issues', value: issues.length, color: 'text-slate-100', icon: <Layers className="w-3.5 h-3.5 text-indigo-400" />, border: 'border-l-indigo-500/50' },
          { label: 'Resolved', value: stats.resolvedCount, color: 'text-emerald-400', icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />, border: 'border-l-emerald-500/50' },
          { label: 'Active', value: stats.openCount, color: 'text-amber-400', icon: <Clock className="w-3.5 h-3.5 text-amber-400" />, border: 'border-l-amber-500/50' },
          { label: 'Avg Severity', value: `${stats.avgSeverity}%`, color: stats.avgSeverity > 60 ? 'text-red-400' : 'text-sky-400', icon: <Activity className="w-3.5 h-3.5 text-sky-400" />, border: `border-l-${stats.avgSeverity > 60 ? 'red' : 'sky'}-500/50` },
        ].map(kpi => (
          <div key={kpi.label} className={`card rounded-2xl p-4 flex items-center gap-3 border-l-2 ${kpi.border}`}>
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
              {kpi.icon}
            </div>
            <div>
              <p className="section-label mb-1">{kpi.label}</p>
              <p className={`metric-value text-xl font-bold ${kpi.color} leading-none`}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Analytics Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── Card 1: Weekly Issue Trends ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="card rounded-3xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <h3 className="text-xs font-semibold text-slate-300">Weekly Issue Trends</h3>
            </div>
            <TrendBadge value={stats.weeklyGrowth} />
          </div>

          <MiniBarChart
            values={stats.weekdayCounts}
            labels={DAY_LABELS}
            color="#10b981"
            highlightIndex={todayDow}
          />

          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
            <div className="card-inner rounded-xl p-2.5 text-center">
              <p className="text-slate-500 text-[10px]">This Week</p>
              <p className="text-emerald-400 font-bold font-mono text-base metric-value">{stats.thisWeekCount}</p>
            </div>
            <div className="card-inner rounded-xl p-2.5 text-center">
              <p className="text-slate-500 text-[10px]">Last Week</p>
              <p className="text-slate-300 font-bold font-mono text-base metric-value">{stats.lastWeekCount}</p>
            </div>
            <div className="card-inner rounded-xl p-2.5 text-center">
              <p className="text-slate-500 text-[10px]">Peak Day</p>
              <p className="text-sky-400 font-bold text-base metric-value">{DAY_LABELS[peakDay]}</p>
            </div>
          </div>

          <AnimatePresence>
            {geminiData?.weeklyTrend && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AISummaryBox text={geminiData.weeklyTrend.summary} color="emerald" />
                {geminiData.weeklyTrend.outlook && (
                  <p className="text-xs text-slate-500 mt-2 italic">{geminiData.weeklyTrend.outlook}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Card 2: Monthly Trends ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="card rounded-3xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
              <h3 className="text-xs font-semibold text-slate-300">Monthly Trends</h3>
            </div>
            <TrendBadge value={stats.monthlyGrowth} />
          </div>

          <MiniLineChart
            values={stats.monthlyCounts}
            labels={stats.monthLabels}
            color="#38bdf8"
          />

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="card-inner rounded-xl p-2.5 text-xs">
              <p className="text-slate-500 text-[10px]">This Month</p>
              <p className="text-sky-400 font-bold font-mono text-base metric-value">{stats.thisMonthCount}</p>
            </div>
            <div className="card-inner rounded-xl p-2.5 text-xs">
              <p className="text-slate-500 text-[10px]">Last Month</p>
              <p className="text-slate-300 font-bold font-mono text-base metric-value">{stats.lastMonthCount}</p>
            </div>
          </div>

          <AnimatePresence>
            {geminiData?.monthlyTrend && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AISummaryBox text={geminiData.monthlyTrend.summary} color="indigo" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Card 3: Infrastructure Health ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="card rounded-3xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <h3 className="text-xs font-semibold text-slate-300">Infrastructure Health</h3>
            </div>
            <RiskBadge level={stats.healthScore >= 75 ? 'low' : stats.healthScore >= 50 ? 'medium' : stats.healthScore >= 25 ? 'high' : 'critical'} />
          </div>

          <div className="flex items-center gap-6">
            <RadialGauge score={stats.healthScore} color={healthColor} label="Health Score" />
            <div className="flex-1 space-y-3">
              <HBar label="Resolution Rate" value={stats.resolutionRate} max={100} color="#10b981" suffix="%" />
              <HBar label="Avg Severity" value={stats.avgSeverity} max={100} color="#f59e0b" suffix="%" />
              <HBar label="Open Issues" value={stats.openCount} max={Math.max(issues.length, 1)} color="#ef4444" />
            </div>
          </div>

          <AnimatePresence>
            {geminiData?.infrastructureHealth && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AISummaryBox text={geminiData.infrastructureHealth.summary} color={stats.healthScore >= 50 ? 'emerald' : 'indigo'} />
                {geminiData.infrastructureHealth.recommendation && (
                  <p className="text-xs text-amber-400/70 mt-2 italic">
                    💡 {geminiData.infrastructureHealth.recommendation}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Card 4: Department Performance Forecast ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="card rounded-3xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
            <h3 className="text-xs font-semibold text-slate-300">Department Performance Forecast</h3>
          </div>

          <div className="space-y-2.5">
            {stats.topDepts.length > 0 ? stats.topDepts.map(([dept, count]) => {
              const deptData = stats.deptResolution[dept];
              const resRate = deptData?.total > 0 ? Math.round((deptData.resolved / deptData.total) * 100) : 0;
              return (
                <div key={dept} className="card-inner rounded-xl p-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-slate-300 font-semibold truncate max-w-[55%]">{dept}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">{count} issues</span>
                      <span className={`text-[10px] font-bold ${resRate >= 70 ? 'text-emerald-400' : resRate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                        {resRate}% resolved
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-purple-500 transition-all duration-700"
                      style={{ width: `${(count / maxDeptCount) * 100}%` }} />
                  </div>
                </div>
              );
            }) : (
              <div className="empty-state"><p className="text-xs text-slate-500 font-medium">No department data yet</p></div>
            )}
          </div>

          <AnimatePresence>
            {geminiData?.departmentForecast && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AISummaryBox text={geminiData.departmentForecast.summary} color="indigo" />
                {geminiData.departmentForecast.forecasts?.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {geminiData.departmentForecast.forecasts.slice(0, 3).map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <RiskBadge level={f.risk} />
                        <span className="text-slate-400"><span className="text-slate-300 font-medium">{f.dept}:</span> {f.forecast}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Card 5: High Risk Zones ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="card rounded-3xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Map className="w-3.5 h-3.5 text-red-400" />
            <h3 className="text-xs font-semibold text-slate-300">High Risk Zones</h3>
          </div>

          {stats.hotspots.length > 0 ? (
            <div className="space-y-2">
              {stats.hotspots.slice(0, 4).map((zone, i) => {
                const riskScore = Math.min(100, zone.count * 15 + zone.avgSeverity);
                const riskLevel = riskScore >= 75 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low';
                return (
                  <div key={i} className="card-inner rounded-xl p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate">{zone.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {zone.lat.toFixed(4)}°, {zone.lng.toFixed(4)}°
                        </p>
                      </div>
                      <RiskBadge level={riskLevel} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
                      <div><span className="text-slate-500">Reports:</span> <span className="text-slate-300 font-mono">{zone.count}</span></div>
                      <div><span className="text-slate-500">Avg Sev:</span> <span className="text-amber-400 font-mono">{zone.avgSeverity}%</span></div>
                      <div><span className="text-slate-500">Risk:</span> <span className="text-red-400 font-mono">{riskScore}/100</span></div>
                    </div>
                    <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-red-500 transition-all duration-700"
                        style={{ width: `${riskScore}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <p className="text-xs font-medium text-slate-500">No risk zones detected</p>
              <p className="text-[11px] text-slate-600 mt-1">Submit 2+ nearby reports to activate zone detection.</p>
            </div>
          )}

          <AnimatePresence>
            {geminiData?.highRiskZones && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AISummaryBox text={geminiData.highRiskZones.summary} color="indigo" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Card 6: Seasonal Predictions ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="card rounded-3xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Leaf className="w-3.5 h-3.5 text-green-400" />
              <h3 className="text-xs font-semibold text-slate-300">Seasonal Predictions</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
              {stats.currentSeason}
            </span>
          </div>

          {/* Season visual */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {SEASONS.map(season => {
              const isActive = season === stats.currentSeason;
              const seasonColors: Record<string, string> = {
                Winter: '#7dd3fc', Spring: '#86efac', Summer: '#fde047', Autumn: '#fb923c',
              };
              const col = seasonColors[season] || '#94a3b8';
              return (
                <div key={season}
                  className={`rounded-xl p-2.5 text-center border transition-all ${isActive ? 'bg-slate-800 border-slate-600' : 'bg-slate-950 border-slate-800 opacity-40'}`}
                >
                  <p className="text-[10px] font-bold" style={{ color: col }}>{season.slice(0, 3).toUpperCase()}</p>
                  {isActive && <div className="w-1 h-1 rounded-full mx-auto mt-1" style={{ background: col }} />}
                </div>
              );
            })}
          </div>

          {/* Category breakdown for seasonal context */}
          {stats.topCategories.length > 0 && (
            <div className="space-y-1.5">
              {stats.topCategories.slice(0, 4).map(([cat, count]) => (
                <HBar key={cat} label={cat} value={count} max={maxCatCount} color="#4ade80" />
              ))}
            </div>
          )}

          <AnimatePresence>
            {geminiData?.seasonalPredictions && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AISummaryBox text={geminiData.seasonalPredictions.summary} color="emerald" />
                {geminiData.seasonalPredictions.predictions?.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {geminiData.seasonalPredictions.predictions.map((p, i) => (
                      <div key={i} className="text-xs bg-slate-950 rounded-lg p-2 border border-slate-800">
                        <span className="font-bold text-green-400">{p.season}:</span>
                        <span className="text-slate-400 ml-1">{p.forecast}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Card 7: Preventive Maintenance Recommendations ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="card rounded-3xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="w-3.5 h-3.5 text-yellow-400" />
            <h3 className="text-xs font-semibold text-slate-300">Preventive Maintenance</h3>
          </div>

          {/* Local heuristic recommendations before Gemini */}
          <div className="space-y-2">
            {stats.topDepts.length === 0 && !geminiData && (
              <p className="text-xs text-slate-500 text-center py-3 leading-relaxed">
                Generate AI Insights to get department-specific maintenance recommendations.
              </p>
            )}
            {stats.topDepts.slice(0, 3).map(([dept, count]) => {
              const deptData = stats.deptResolution[dept];
              const resRate = deptData?.total > 0 ? Math.round((deptData.resolved / deptData.total) * 100) : 0;
              const priority = resRate < 40 || count >= 3 ? 'HIGH' : resRate < 70 ? 'MEDIUM' : 'LOW';
              const priorityColor = priority === 'HIGH' ? 'text-red-400 border-red-500/30 bg-red-500/10'
                : priority === 'MEDIUM' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
              return (
                <div key={dept} className="card-inner rounded-xl p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-slate-300 truncate">{dept}</span>
                    <span className={`badge ${priorityColor}`}>{priority}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {count} report{count !== 1 ? 's' : ''} · {resRate}% resolution rate ·
                    Avg severity {deptData?.avgSeverity ?? 0}%
                  </p>
                </div>
              );
            })}
          </div>

          <AnimatePresence>
            {geminiData?.maintenanceRecommendations && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
                {geminiData.maintenanceRecommendations.map((rec, i) => (
                  <div key={i} className="card-inner rounded-xl p-3">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-bold text-yellow-400">{rec.dept}</span>
                      <div className="flex items-center gap-1.5">
                        <RiskBadge level={rec.priority} />
                        {rec.timeframe && <span className="text-[9px] text-slate-500">{rec.timeframe}</span>}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{rec.recommendation}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Card 8: Emerging Issue Categories ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="card rounded-3xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-3.5 h-3.5 text-rose-400" />
            <h3 className="text-xs font-semibold text-slate-300">Emerging Issue Categories</h3>
          </div>

          {stats.topCategories.length > 0 ? (
            <>
              <MiniBarChart
                values={stats.topCategories.map(([, v]) => v)}
                labels={stats.topCategories.map(([k]) => k.length > 6 ? k.slice(0, 5) + '…' : k)}
                color="#f43f5e"
              />
              <div className="mt-3 space-y-2">
                {stats.topCategories.map(([cat, count], i) => {
                  const pct = Math.round((count / issues.length) * 100);
                  const isTop = i === 0;
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500 font-mono w-4 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className={`text-xs font-medium truncate ${isTop ? 'text-rose-400' : 'text-slate-300'}`}>{cat}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{pct}%</span>
                        </div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-rose-500 transition-all duration-700"
                            style={{ width: `${pct}%`, opacity: 0.5 + pct / 200 }} />
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="empty-state"><p className="text-xs text-slate-500 font-medium">No category data yet</p></div>
          )}

          <AnimatePresence>
            {geminiData?.emergingCategories && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AISummaryBox text={geminiData.emergingCategories.summary} color="indigo" />
                {geminiData.emergingCategories.categories?.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {geminiData.emergingCategories.categories.map((cat, i) => (
                      <div key={i} className="bg-slate-950 rounded-lg p-2 border border-slate-800 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 font-medium truncate">{cat.name}</span>
                          <TrendBadge value={cat.growth} />
                        </div>
                        <p className="text-slate-500 mt-0.5">{cat.trend}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </div>{/* end grid */}

      {/* ── AI Insights Note ── */}
      {!geminiData && !isLoading && (
        <div className="text-center py-4">
          <p className="text-xs text-slate-600">
            Click <span className="text-indigo-400 font-semibold">Generate AI Insights</span> above to unlock Gemini-powered analytics summaries, forecasts, and maintenance recommendations.
          </p>
        </div>
      )}

    </div>
  );
};

export default AIAnalyticsCenter;
