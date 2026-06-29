import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, Search, Users, BarChart2, Package, Hash, Building2,
  Send, Hourglass, CheckSquare, Wrench, CheckCircle2, Clock,
  AlertCircle, Lock
} from 'lucide-react';

interface IssueTimelineProps {
  issueId?: string;
  status?: string;
  mediaType?: 'image' | 'video';
  onStatusChange?: (newStatus: string) => void;
  sentToAuthority?: boolean;
  onComplaintIdGenerated?: (id: string) => void;
  onRepairScheduled?: () => void;
}

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  phase: 1 | 2 | 3;
  order: number;
}

const STEPS: Step[] = [
  { id: 'ai_analysis',           title: 'AI Analysis Complete',         description: 'Vision AI has classified and verified the civic issue',                  icon: Zap,         phase: 1, order: 0  },
  { id: 'duplicate_check',       title: 'Duplicate Check',              description: 'Cross-referenced against existing reports in 500m radius',               icon: Search,      phase: 1, order: 1  },
  { id: 'community_verification',title: 'Community Verification',       description: 'Alert dispatched to nearby citizens for corroboration',                   icon: Users,       phase: 1, order: 2  },
  { id: 'priority_calculated',   title: 'Priority Calculated',          description: 'Severity score and urgency level determined by AI engine',                icon: BarChart2,   phase: 1, order: 3  },
  { id: 'evidence_package',      title: 'Evidence Package Generated',   description: 'Media, GPS data, and metadata bundled into tamper-proof package',         icon: Package,     phase: 1, order: 4  },
  { id: 'complaint_id',          title: 'Complaint ID Generated',       description: 'Unique complaint reference number assigned for official tracking',         icon: Hash,        phase: 1, order: 5  },
  { id: 'dept_queue',            title: 'Department Queue Created',     description: 'Issue entered into the responsible department\'s work queue',             icon: Building2,   phase: 1, order: 6  },
  { id: 'submitted_authority',   title: 'Submitted to Authority (Demo)',description: 'Official complaint package transmitted to municipal authority system',      icon: Send,        phase: 2, order: 7  },
  { id: 'waiting_acceptance',    title: 'Waiting for Authority Acceptance', description: 'Pending acknowledgement from department duty officer',                 icon: Hourglass,   phase: 2, order: 8  },
  { id: 'accepted_dept',         title: 'Accepted by Department',       description: 'Department has accepted and logged the complaint in their system',         icon: CheckSquare, phase: 2, order: 9  },
  { id: 'repair_scheduled',      title: 'Repair Scheduled',             description: 'Work order created and field crew assigned to the location',               icon: Wrench,      phase: 2, order: 10 },
  { id: 'resolved',              title: 'Resolved',                     description: 'Infrastructure repaired, verified by field officer and citizen report',    icon: CheckCircle2,phase: 3, order: 11 },
];

// Delays in ms for each step after the previous one completes
const PHASE1_DELAYS = [0, 1500, 2000, 1500, 1800, 1200, 1600];
const PHASE2_DELAYS = [0, 3000, 2500, 2000];

const STATUS_MAP: Record<string, string> = {
  ai_analysis:            'classified',
  duplicate_check:        'classified',
  community_verification: 'verification',
  priority_calculated:    'verification',
  evidence_package:       'assigned',
  complaint_id:           'assigned',
  dept_queue:             'in_progress',
  submitted_authority:    'pending_authority',
  waiting_acceptance:     'pending_authority',
  accepted_dept:          'accepted',
  repair_scheduled:       'repair_scheduled',
  resolved:               'resolved',
};

function generateComplaintId(issueId: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = issueId.slice(-5).toUpperCase();
  return `CMP-${date}-${suffix}`;
}

export default function IssueTimeline({
  issueId,
  mediaType,
  onStatusChange,
  sentToAuthority = false,
  onComplaintIdGenerated,
  onRepairScheduled,
}: IssueTimelineProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [stepTimestamps, setStepTimestamps] = useState<Record<string, string>>({});
  const [phase1Done, setPhase1Done] = useState(false);
  const [phase2Started, setPhase2Started] = useState(false);
  const [phase2StepIndex, setPhase2StepIndex] = useState(0);
  const [isResolved, setIsResolved] = useState(false);
  const [repairScheduled, setRepairScheduled] = useState(false);

  const phase1StepsCount = STEPS.filter(s => s.phase === 1).length; // 7
  const phase2StepsCount = STEPS.filter(s => s.phase === 2).length; // 4

  const complaintIdRef = useRef<string | null>(null);

  // Reset when issueId changes
  useEffect(() => {
    setCurrentStepIndex(0);
    setCompletedSteps(new Set());
    setStepTimestamps({});
    setPhase1Done(false);
    setPhase2Started(false);
    setPhase2StepIndex(0);
    setIsResolved(false);
    setRepairScheduled(false);
    complaintIdRef.current = null;
  }, [issueId]);

  const markStep = (stepIndex: number) => {
    const step = STEPS[stepIndex];
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setCompletedSteps(prev => new Set([...prev, step.id]));
    setStepTimestamps(prev => ({ ...prev, [step.id]: now }));
    setCurrentStepIndex(stepIndex + 1);
    if (onStatusChange) {
      onStatusChange(STATUS_MAP[step.id] ?? 'classified');
    }
    // Generate complaint ID at step 5
    if (step.id === 'complaint_id' && issueId && !complaintIdRef.current) {
      const cid = generateComplaintId(issueId);
      complaintIdRef.current = cid;
      onComplaintIdGenerated?.(cid);
    }
    // Notify repair scheduled
    if (step.id === 'repair_scheduled') {
      setRepairScheduled(true);
      onRepairScheduled?.();
    }
  };

  // Phase 1 auto-progression
  useEffect(() => {
    if (phase1Done) return;
    if (currentStepIndex >= phase1StepsCount) {
      setPhase1Done(true);
      return;
    }
    const delay = PHASE1_DELAYS[currentStepIndex] ?? 1500;
    const t = setTimeout(() => {
      markStep(currentStepIndex);
    }, delay);
    return () => clearTimeout(t);
  }, [currentStepIndex, phase1Done]);

  // Phase 2 kick-off
  useEffect(() => {
    if (!phase1Done || !sentToAuthority || phase2Started) return;
    setPhase2Started(true);
    // Immediately mark step 7 (submitted_authority)
    setTimeout(() => markStep(phase1StepsCount), 400);
  }, [phase1Done, sentToAuthority, phase2Started]);

  // Phase 2 auto-progression (steps 8-10)
  useEffect(() => {
    if (!phase2Started) return;
    const phase2Step = currentStepIndex - phase1StepsCount; // 0 = submitted, 1 = waiting, 2 = accepted, 3 = repair_scheduled
    if (phase2Step <= 0 || phase2Step >= phase2StepsCount) return;
    const delay = PHASE2_DELAYS[phase2Step] ?? 2000;
    const t = setTimeout(() => {
      markStep(currentStepIndex);
    }, delay);
    return () => clearTimeout(t);
  }, [currentStepIndex, phase2Started]);

  const handleMarkResolved = () => {
    const resolvedStep = STEPS.findIndex(s => s.id === 'resolved');
    markStep(resolvedStep);
    setIsResolved(true);
  };

  const getStepState = (index: number): 'completed' | 'active' | 'pending' | 'locked' => {
    const step = STEPS[index];
    if (completedSteps.has(step.id)) return 'completed';
    if (index === currentStepIndex) {
      if (step.phase === 2 && !sentToAuthority) return 'locked';
      if (step.phase === 3) return 'locked';
      return 'active';
    }
    if (index < currentStepIndex) return 'completed';
    if (step.phase === 2 && !sentToAuthority) return 'locked';
    if (step.phase === 3 && !repairScheduled) return 'locked';
    return 'pending';
  };

  const progress = isResolved
    ? 100
    : Math.round((currentStepIndex / (STEPS.length - 1)) * 100);

  return (
    <div className="card p-5 rounded-3xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-0.5"><div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0"><Clock className="w-3 h-3 text-emerald-400" /></div><h2 className="text-xs font-semibold text-slate-300">Resolution Timeline</h2></div>
          {issueId && (
            <p className="text-xs text-slate-500 font-mono">Report ID: {issueId}</p>
          )}
        </div>
        <div className="text-right">
          <p className="section-label mb-1">Progress</p>
          <p className="metric-value text-2xl font-bold text-emerald-400 leading-none">{progress}%</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-5 bg-white/[0.05] rounded-full h-1 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      </div>

      {/* Timeline Steps */}
      <div className="space-y-2.5">
        {STEPS.map((step, index) => {
          const state = getStepState(index);
          const Icon = step.icon;
          const timestamp = stepTimestamps[step.id];
          const isCompleted = state === 'completed';
          const isActive = state === 'active';
          const isLocked = state === 'locked';

          return (
            <motion.div
              key={step.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="relative"
            >
              {/* Phase dividers */}
              {index === phase1StepsCount && (
                <div className="flex items-center gap-2 mb-2 mt-1">
                  <div className="h-px flex-1 bg-slate-700/60" />
                  <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest px-2">
                    Authority Phase
                  </span>
                  <div className="h-px flex-1 bg-slate-700/60" />
                </div>
              )}
              {index === phase1StepsCount + phase2StepsCount && (
                <div className="flex items-center gap-2 mb-2 mt-1">
                  <div className="h-px flex-1 bg-slate-700/60" />
                  <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest px-2">
                    Closure
                  </span>
                  <div className="h-px flex-1 bg-slate-700/60" />
                </div>
              )}

              <div
                className={`flex gap-3 p-3 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : isCompleted
                    ? 'bg-emerald-500/[0.03] border-emerald-500/15'
                    : isLocked
                    ? 'bg-transparent border-white/[0.04] opacity-35'
                    : 'bg-white/[0.02] border-white/[0.06]'
                }`}
              >
                {/* Icon */}
                <div className="flex-shrink-0 pt-0.5">
                  <motion.div
                    className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                      isActive
                        ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/50'
                        : isCompleted
                        ? 'bg-emerald-600/80 border-emerald-500/60 text-white'
                        : isLocked
                        ? 'bg-slate-800 border-slate-700 text-slate-600'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                    animate={isActive ? { scale: [1, 1.08, 1] } : {}}
                    transition={isActive ? { duration: 0.8, repeat: Infinity } : {}}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : isLocked ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </motion.div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-semibold transition-colors leading-snug ${
                          isActive
                            ? 'text-emerald-300'
                            : isCompleted
                            ? 'text-emerald-400'
                            : isLocked
                            ? 'text-slate-600'
                            : 'text-slate-300'
                        }`}
                      >
                        {step.title}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                        {step.description}
                      </p>
                    </div>
                    {timestamp && (
                      <motion.span
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-[10px] font-mono text-emerald-500/80 flex-shrink-0"
                      >
                        {timestamp}
                      </motion.span>
                    )}
                  </div>

                  {isActive && (
                    <motion.div
                      className="mt-1.5 h-0.5 bg-gradient-to-r from-emerald-500 to-transparent rounded-full"
                      animate={{ scaleX: [0, 1] }}
                      transition={{ duration: 0.8, ease: 'easeInOut' }}
                    />
                  )}
                </div>
              </div>

              {/* Connector Line */}
              {index < STEPS.length - 1 && (
                <div className="absolute left-[13px] top-full w-0.5 h-1.5 bg-gradient-to-b from-slate-700 to-transparent" />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Awaiting Submission Banner */}
      <AnimatePresence>
        {phase1Done && !sentToAuthority && !isResolved && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-4 p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-center gap-3"
          >
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-400">Awaiting Authority Submission</p>
              <p className="text-[10px] text-amber-400/70 mt-0.5">Click "Send to Authority (Demo)" in the AI Action Center to continue</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mark Resolved Button */}
      <AnimatePresence>
        {repairScheduled && !isResolved && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4"
          >
            <button
              onClick={handleMarkResolved}
              className="w-full py-3 rounded-xl btn-primary text-white text-sm font-semibold flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark Resolved
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resolution Badge */}
      <AnimatePresence>
        {isResolved && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/50 to-emerald-900/50 border border-emerald-500/50 text-center"
          >
            <p className="text-sm font-semibold text-emerald-400 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Issue Resolved
            </p>
            <p className="text-xs text-emerald-200/60 mt-1.5">
              This infrastructure issue has been successfully resolved and closed.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
