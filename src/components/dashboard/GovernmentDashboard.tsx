import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, Inbox, CheckCircle2, XCircle, Clock, Wrench,
  CheckSquare, AlertTriangle, User, Calendar, MapPin,
  ChevronDown, ChevronUp, Filter, Building2, Brain,
  Hash, Activity, TrendingUp, BarChart3, ClipboardList,
  UserCheck, Play, Star, RefreshCw, Eye
} from 'lucide-react';
import { Issue } from '../../lib/utils';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface AuthorityAction {
  type:
    | 'accepted'
    | 'rejected'
    | 'officer_assigned'
    | 'repair_scheduled'
    | 'resolved';
  timestamp: Date;
  officerName?: string;
  note?: string;
  scheduledDate?: string;
}

export interface GovernmentEntry {
  issueId: string;
  complaintId: string;
  receivedAt: Date;
  authorityActions: AuthorityAction[];
  currentAuthorityStatus:
    | 'pending'
    | 'accepted'
    | 'rejected'
    | 'officer_assigned'
    | 'repair_scheduled'
    | 'resolved';
  assignedOfficer?: string;
  scheduledDate?: string;
  rejectionReason?: string;
}

interface GovernmentDashboardProps {
  issues: Issue[];
  govEntries: GovernmentEntry[];
  onAuthorityAction: (
    issueId: string,
    action: AuthorityAction,
    extra?: { officer?: string; scheduledDate?: string; note?: string }
  ) => void;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const OFFICERS = [
  'Officer Rajesh Kumar — Field Unit A',
  'Officer Priya Nair — Field Unit B',
  'Officer Arjun Singh — Rapid Response',
  'Officer Meena Iyer — Infrastructure Cell',
  'Officer Suresh Patel — Road Maintenance',
  'Officer Divya Rao — Water & Sanitation',
  'Officer Karthik Menon — Electrical Division',
  'Officer Anita Sharma — Public Works',
];

function getSeverityBadge(severity: string) {
  const s = parseInt(severity, 10) || 0;
  if (s >= 75)
    return { label: 'CRITICAL', cls: 'bg-red-500/20 text-red-400 border-red-500/30' };
  if (s >= 50)
    return { label: 'HIGH', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
  if (s >= 25)
    return { label: 'MEDIUM', cls: 'bg-sky-500/20 text-sky-400 border-sky-500/30' };
  return { label: 'LOW', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
}

function getPriorityScore(issue: Issue): number {
  const sev = parseInt(issue.severity, 10) || 0;
  const verBonus = Math.min(issue.verificationCount * 5, 30);
  return Math.min(100, sev + verBonus);
}

function getAIRecommendation(issue: Issue): string {
  const s = parseInt(issue.severity, 10) || 0;
  const type = issue.issueType.toLowerCase();
  if (s >= 75)
    return `Emergency dispatch required within 2 hours. ${issue.issueType} poses immediate public safety risk.`;
  if (type.includes('pothole') || type.includes('road'))
    return `Schedule repair during off-peak hours. Temporary signage needed. Est. crew time: 2–4 hrs.`;
  if (type.includes('leak') || type.includes('water'))
    return `Isolate water main and dispatch repair crew. Notify downstream residents.`;
  if (type.includes('light') || type.includes('signal'))
    return `Manual traffic rerouting if non-functional. Coordinate with electrical crew for same-day fix.`;
  if (type.includes('sanit') || type.includes('garbage'))
    return `Dispatch sanitation crew within 48 hours. Risk of health violation if unaddressed.`;
  return `Assess on-site within SLA window. Prioritize by foot-traffic impact and weather forecast.`;
}

function statusLabel(s: GovernmentEntry['currentAuthorityStatus']): string {
  const map: Record<string, string> = {
    pending: 'Pending Review',
    accepted: 'Accepted',
    rejected: 'Rejected',
    officer_assigned: 'Officer Assigned',
    repair_scheduled: 'Repair Scheduled',
    resolved: 'Resolved',
  };
  return map[s] ?? s;
}

function statusColor(s: GovernmentEntry['currentAuthorityStatus']): string {
  const map: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    accepted: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    officer_assigned: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    repair_scheduled: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    resolved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };
  return map[s] ?? '';
}

function auditLabel(action: AuthorityAction): string {
  const map: Record<string, string> = {
    accepted: 'Accepted by Authority',
    rejected: 'Rejected by Authority',
    officer_assigned: `Officer Assigned${action.officerName ? ` — ${action.officerName.split('—')[0].trim()}` : ''}`,
    repair_scheduled: `Repair Scheduled${action.scheduledDate ? ` for ${action.scheduledDate}` : ''}`,
    resolved: 'Marked Resolved',
  };
  return map[action.type] ?? action.type;
}

// ─────────────────────────────────────────────
// Complaint Queue Card
// ─────────────────────────────────────────────
function ComplaintCard({
  entry,
  issue,
  onAction,
}: {
  entry: GovernmentEntry;
  issue: Issue;
  onAction: (
    action: AuthorityAction,
    extra?: { officer?: string; scheduledDate?: string; note?: string }
  ) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [rejectionNote, setRejectionNote] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const severity = getSeverityBadge(issue.severity);
  const priority = getPriorityScore(issue);
  const recommendation = getAIRecommendation(issue);
  const status = entry.currentAuthorityStatus;

  const canAccept = status === 'pending';
  const canReject = status === 'pending';
  const canAssignOfficer = status === 'accepted';
  const canScheduleRepair = status === 'officer_assigned';
  const canResolve = status === 'repair_scheduled';

  const dispatch = (type: AuthorityAction['type'], extra?: { officer?: string; scheduledDate?: string; note?: string }) => {
    const action: AuthorityAction = {
      type,
      timestamp: new Date(),
      officerName: extra?.officer,
      note: extra?.note,
      scheduledDate: extra?.scheduledDate,
    };
    onAction(action, extra);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`card-inner rounded-xl border transition-all ${
        status === 'pending'
          ? 'border-amber-500/22 ring-1 ring-amber-500/10'
          : status === 'rejected'
          ? 'border-red-500/15'
          : status === 'resolved'
          ? 'border-emerald-500/18'
          : 'border-white/[0.06]'
      }`}
    >
      {/* Header Row */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Priority Ring */}
        <div className="relative flex-shrink-0">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border ${
              priority >= 75
                ? 'border-red-500 text-red-400'
                : priority >= 50
                ? 'border-amber-500 text-amber-400'
                : 'border-sky-500 text-sky-400'
            }`}
          >
            {priority}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-slate-500">{entry.complaintId}</span>
            <span
              className={`badge ${severity.cls}`}
            >
              {severity.label}
            </span>
            <span
              className={`badge ${statusColor(status)}`}
            >
              {statusLabel(status)}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-200 capitalize mt-0.5 truncate">
            {issue.issueType}
          </p>
          <p className="text-[10px] text-slate-500 truncate">{issue.department}</p>
        </div>

        <div className="flex-shrink-0 text-slate-600">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/[0.025] p-2.5 rounded-lg border border-white/[0.06]">
                  <span className="text-slate-500">Issue Type</span>
                  <p className="text-slate-200 font-semibold capitalize mt-0.5">
                    {issue.issueType}
                  </p>
                </div>
                <div className="bg-white/[0.025] p-2.5 rounded-lg border border-white/[0.06]">
                  <span className="text-slate-500">Severity Score</span>
                  <p className="text-slate-200 font-mono mt-0.5">{issue.severity} / 100</p>
                </div>
                <div className="bg-white/[0.025] p-2.5 rounded-lg border border-white/[0.06]">
                  <span className="text-slate-500">Priority</span>
                  <p className="text-slate-200 font-mono mt-0.5">{priority} / 100</p>
                </div>
                <div className="bg-white/[0.025] p-2.5 rounded-lg border border-white/[0.06]">
                  <span className="text-slate-500">Department</span>
                  <p className="text-slate-200 font-semibold mt-0.5 truncate">
                    {issue.department}
                  </p>
                </div>
                <div className="bg-white/[0.025] p-2.5 rounded-lg border border-white/[0.06] col-span-2">
                  <span className="text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Location (GPS)
                  </span>
                  <p className="text-slate-300 font-mono mt-0.5">
                    {issue.location.latitude.toFixed(5)}, {issue.location.longitude.toFixed(5)}
                  </p>
                </div>
              </div>

              {/* AI Recommendation */}
              <div className="rounded-xl p-3 border" style={{background:"rgba(49,46,129,0.10)", borderColor:"rgba(129,140,248,0.15)"}}>
                <p className="section-label text-indigo-400/60 flex items-center gap-1 mb-1">
                  <Brain className="w-3 h-3" /> AI Recommendation
                </p>
                <p className="text-xs text-indigo-200/80 leading-relaxed">{recommendation}</p>
              </div>

              {/* Assigned officer display */}
              {entry.assignedOfficer && (
                <div className="bg-white/[0.025] border border-white/[0.07] rounded-xl p-3 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-500">Assigned Officer</p>
                    <p className="text-xs text-slate-200 font-semibold">{entry.assignedOfficer}</p>
                  </div>
                </div>
              )}

              {/* Scheduled date display */}
              {entry.scheduledDate && (
                <div className="bg-white/[0.025] border border-white/[0.07] rounded-xl p-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-500">Repair Scheduled</p>
                    <p className="text-xs text-slate-200 font-semibold">{entry.scheduledDate}</p>
                  </div>
                </div>
              )}

              {/* Rejection reason */}
              {status === 'rejected' && entry.rejectionReason && (
                <div className="rounded-xl p-3 border" style={{background:"rgba(127,29,29,0.12)", borderColor:"rgba(248,113,113,0.18)"}}>
                  <p className="section-label text-red-400/70 mb-1">Rejection Reason</p>
                  <p className="text-xs text-red-200/80">{entry.rejectionReason}</p>
                </div>
              )}

              {/* ── ACTION BUTTONS ── */}
              {canAccept && !showRejectForm && (
                <div className="flex gap-2">
                  <button
                    onClick={() => dispatch('accepted')}
                    className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/25 text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> Accept Complaint
                  </button>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/15 text-red-400 border border-red-500/20 text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              )}

              {/* Rejection form */}
              {canReject && showRejectForm && (
                <div className="space-y-2">
                  <textarea
                    value={rejectionNote}
                    onChange={e => setRejectionNote(e.target.value)}
                    placeholder="Reason for rejection (required)..."
                    rows={2}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-red-500/40 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!rejectionNote.trim()) return;
                        dispatch('rejected', { note: rejectionNote });
                        setShowRejectForm(false);
                      }}
                      disabled={!rejectionNote.trim()}
                      className="flex-1 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-red-400 border border-red-500/25 text-xs font-semibold py-2.5 rounded-xl transition-colors"
                    >
                      Confirm Rejection
                    </button>
                    <button
                      onClick={() => setShowRejectForm(false)}
                      className="px-4 text-slate-400 hover:text-slate-200 text-xs py-2.5 rounded-xl border border-white/[0.08] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Assign Officer */}
              {canAssignOfficer && (
                <div className="space-y-2">
                  <p className="section-label">
                    Assign Officer
                  </p>
                  <select
                    value={selectedOfficer}
                    onChange={e => setSelectedOfficer(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/40"
                  >
                    <option value="">Select officer...</option>
                    {OFFICERS.map(o => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (!selectedOfficer) return;
                      dispatch('officer_assigned', { officer: selectedOfficer });
                      setSelectedOfficer('');
                    }}
                    disabled={!selectedOfficer}
                    className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-indigo-400 border border-indigo-500/25 text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <User className="w-3.5 h-3.5" /> Assign Officer
                  </button>
                </div>
              )}

              {/* Schedule Repair */}
              {canScheduleRepair && (
                <div className="space-y-2">
                  <p className="section-label">
                    Schedule Repair
                  </p>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500/40"
                  />
                  <button
                    onClick={() => {
                      if (!scheduledDate) return;
                      dispatch('repair_scheduled', { scheduledDate });
                      setScheduledDate('');
                    }}
                    disabled={!scheduledDate}
                    className="w-full bg-violet-600/20 hover:bg-violet-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-violet-400 border border-violet-500/25 text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Wrench className="w-3.5 h-3.5" /> Schedule Repair
                  </button>
                </div>
              )}

              {/* Mark Resolved */}
              {canResolve && (
                <button
                  onClick={() => dispatch('resolved')}
                  className="w-full btn-primary text-white text-xs font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Mark Resolved
                </button>
              )}

              {/* Audit Timeline */}
              {entry.authorityActions.length > 0 && (
                <div>
                  <p className="section-label mb-2">
                    Audit Log
                  </p>
                  <div className="space-y-1.5">
                    {entry.authorityActions.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-xs"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="text-slate-300 font-medium">{auditLabel(a)}</span>
                          <span className="text-slate-600 ml-2 font-mono text-[10px]">
                            {a.timestamp.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {a.note && (
                            <p className="text-slate-500 text-[10px] mt-0.5 italic">{a.note}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Full Audit Timeline Modal
// ─────────────────────────────────────────────
function AuditTimelineModal({
  entry,
  issue,
  onClose,
}: {
  entry: GovernmentEntry;
  issue: Issue;
  onClose: () => void;
}) {
  const FULL_STEPS: { label: string; done: boolean; ts?: Date; note?: string }[] = [
    {
      label: 'Citizen Submitted',
      done: true,
      ts: issue.createdAt,
    },
    {
      label: 'AI Classified',
      done: !!issue.timeline.find(t => t.id === 'classified'),
      ts: issue.timeline.find(t => t.id === 'classified')?.timestamp,
    },
    {
      label: 'Community Verified',
      done: issue.verificationCount >= 2,
    },
    {
      label: 'Complaint Generated',
      done: true,
      ts: entry.receivedAt,
      note: entry.complaintId,
    },
    {
      label: 'Submitted to Department',
      done: true,
      ts: entry.receivedAt,
    },
    {
      label: 'Accepted by Authority',
      done: entry.authorityActions.some(a => a.type === 'accepted'),
      ts: entry.authorityActions.find(a => a.type === 'accepted')?.timestamp,
    },
    {
      label: 'Officer Assigned',
      done: !!entry.assignedOfficer,
      ts: entry.authorityActions.find(a => a.type === 'officer_assigned')?.timestamp,
      note: entry.assignedOfficer,
    },
    {
      label: 'Repair Scheduled',
      done: !!entry.scheduledDate,
      ts: entry.authorityActions.find(a => a.type === 'repair_scheduled')?.timestamp,
      note: entry.scheduledDate ? `Scheduled for ${entry.scheduledDate}` : undefined,
    },
    {
      label: 'Repair Completed',
      done: entry.currentAuthorityStatus === 'resolved',
      ts: entry.authorityActions.find(a => a.type === 'resolved')?.timestamp,
    },
    {
      label: 'Resolved',
      done: entry.currentAuthorityStatus === 'resolved',
      ts: entry.authorityActions.find(a => a.type === 'resolved')?.timestamp,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="card rounded-3xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto scrollbar-thin"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-emerald-400" /> Complete Audit Timeline
            </h3>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{entry.complaintId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-1">
          {FULL_STEPS.map((step, i) => (
            <div key={i} className="flex gap-3 relative">
              {/* Connector */}
              {i < FULL_STEPS.length - 1 && (
                <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-white/[0.06]" />
              )}
              <div
                className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border mt-0.5 z-10 ${
                  step.done
                    ? 'bg-emerald-600 border-emerald-500'
                    : 'bg-slate-800 border-slate-700'
                }`}
              >
                {step.done ? (
                  <CheckCircle2 className="w-3 h-3 text-white" />
                ) : (
                  <Clock className="w-3 h-3 text-slate-600" />
                )}
              </div>
              <div className="flex-1 pb-4">
                <p
                  className={`text-xs font-semibold ${
                    step.done ? 'text-slate-200' : 'text-slate-600'
                  }`}
                >
                  {step.label}
                </p>
                {step.ts && (
                  <p className="text-[10px] text-slate-500 font-mono">
                    {step.ts.toLocaleDateString()} {step.ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                {step.note && (
                  <p className="text-[10px] text-emerald-400/80 font-mono">{step.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function GovernmentDashboard({
  issues,
  govEntries,
  onAuthorityAction,
}: GovernmentDashboardProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | GovernmentEntry['currentAuthorityStatus']>('all');
  const [auditTarget, setAuditTarget] = useState<string | null>(null);

  // ── Stats ──
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      total: govEntries.length,
      pending: govEntries.filter(e => e.currentAuthorityStatus === 'pending').length,
      submittedToday: govEntries.filter(e => new Date(e.receivedAt).toDateString() === today).length,
      accepted: govEntries.filter(e =>
        ['accepted', 'officer_assigned', 'repair_scheduled', 'resolved'].includes(e.currentAuthorityStatus)
      ).length,
      rejected: govEntries.filter(e => e.currentAuthorityStatus === 'rejected').length,
      inProgress: govEntries.filter(e => e.currentAuthorityStatus === 'officer_assigned').length,
      repairScheduled: govEntries.filter(e => e.currentAuthorityStatus === 'repair_scheduled').length,
      resolved: govEntries.filter(e => e.currentAuthorityStatus === 'resolved').length,
    };
  }, [govEntries]);

  // ── Filtered + enriched queue ──
  const filteredQueue = useMemo(() => {
    return govEntries
      .filter(e => filterStatus === 'all' || e.currentAuthorityStatus === filterStatus)
      .map(e => ({ entry: e, issue: issues.find(i => i.id === e.issueId)! }))
      .filter(x => !!x.issue)
      .sort((a, b) => getPriorityScore(b.issue) - getPriorityScore(a.issue));
  }, [govEntries, issues, filterStatus]);

  const auditEntry = auditTarget ? govEntries.find(e => e.issueId === auditTarget) : null;
  const auditIssue = auditTarget ? issues.find(i => i.id === auditTarget) : null;

  const STAT_CARDS = [
    { label: 'Pending', value: stats.pending, icon: Inbox, color: 'text-amber-400', status: 'pending' as const },
    { label: 'Today', value: stats.submittedToday, icon: Activity, color: 'text-sky-400', status: null },
    { label: 'Accepted', value: stats.accepted, icon: CheckSquare, color: 'text-indigo-400', status: 'accepted' as const },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-400', status: 'rejected' as const },
    { label: 'In Progress', value: stats.inProgress, icon: Play, color: 'text-purple-400', status: 'officer_assigned' as const },
    { label: 'Scheduled', value: stats.repairScheduled, icon: Wrench, color: 'text-orange-400', status: 'repair_scheduled' as const },
    { label: 'Resolved', value: stats.resolved, icon: CheckCircle2, color: 'text-emerald-400', status: 'resolved' as const },
  ];

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200 leading-tight">Government Operations</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Authority-side complaint management &amp; resolution workflow</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-[10px] text-sky-400 font-semibold tracking-wider uppercase">Live</span>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {STAT_CARDS.map(card => {
          const Icon = card.icon;
          const active = filterStatus === card.status;
          return (
            <button
              key={card.label}
              onClick={() =>
                card.status
                  ? setFilterStatus(active ? 'all' : card.status)
                  : undefined
              }
              className={`p-3.5 rounded-xl border text-left transition-all ${
                active
                  ? 'border-sky-500/40 bg-sky-950/20 ring-1 ring-sky-500/20'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.10] hover:bg-white/[0.04]'
              } ${card.status ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <Icon className={`w-3.5 h-3.5 mb-1.5 ${card.color}`} />
              <p className={`metric-value text-xl font-bold ${card.color} leading-none`}>{card.value}</p>
              <p className="text-[10px] text-slate-500 mt-1 leading-tight">{card.label}</p>
            </button>
          );
        })}
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3 h-3 text-slate-600" />
        <span className="section-label">Filter</span>
        {(['all', 'pending', 'accepted', 'officer_assigned', 'repair_scheduled', 'resolved', 'rejected'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
              filterStatus === s
                ? 'border-sky-500/40 text-sky-400 bg-sky-950/20'
                : 'border-white/[0.06] text-slate-500 hover:border-white/[0.10] hover:text-slate-400'
            }`}
          >
            {s === 'all' ? 'All' : statusLabel(s)}
          </button>
        ))}
      </div>

      {/* ── Authority Queue ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
            <h3 className="text-xs font-semibold text-slate-300">Authority Queue</h3>
            <span className="text-[10px] text-slate-600">({filteredQueue.length})</span>
          </div>
          {filteredQueue.length > 0 && (
            <span className="text-[10px] text-slate-600">Sorted by priority ↓</span>
          )}
        </div>

        <AnimatePresence mode="popLayout">
          {filteredQueue.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="empty-state py-14"
            >
              <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center mb-3">
                <Inbox className="w-5 h-5 text-slate-600" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                {govEntries.length === 0 ? 'No complaints yet' : 'No matching complaints'}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {govEntries.length === 0
                  ? 'Submit a report from the Citizen Hub to begin.'
                  : 'Try adjusting the filter above.'}
              </p>
            </motion.div>
          ) : (
            filteredQueue.map(({ entry, issue }) => (
              <div key={entry.issueId} className="relative">
                <ComplaintCard
                  entry={entry}
                  issue={issue}
                  onAction={(action, extra) =>
                    onAuthorityAction(entry.issueId, action, extra)
                  }
                />
                {/* Audit link */}
                <button
                  onClick={() => setAuditTarget(entry.issueId)}
                  className="absolute top-4 right-10 text-[10px] text-slate-600 hover:text-sky-400 transition-colors flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" /> Audit
                </button>
              </div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* ── Audit Modal ── */}
      <AnimatePresence>
        {auditEntry && auditIssue && (
          <AuditTimelineModal
            entry={auditEntry}
            issue={auditIssue}
            onClose={() => setAuditTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
