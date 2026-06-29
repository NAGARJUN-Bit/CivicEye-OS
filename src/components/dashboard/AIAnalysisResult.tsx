import React from 'react';
import { motion } from 'motion/react';
import { X, Camera, AlertTriangle, Clock, CheckCircle2, MapPin, Wrench, FileUp, Shield, Video, Image as ImageIcon, Film } from 'lucide-react';
import { Issue } from '../../lib/utils';

interface AIAnalysisResultProps {
  issue: Issue;
  onClose: () => void;
}

// Formats a raw seconds count into the same compact mm:ss style used
// elsewhere in the upload flow.
function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function AIAnalysisResult({ issue, onClose }: AIAnalysisResultProps) {
  const isVideo = issue.mediaType === 'video';

  // Normalise severity — server returns it as a numeric string ("75"), a plain number, or empty
  const severityNum = Math.min(100, Math.max(0, parseInt(String(issue.severity)) || 0));

  const severityColor =
    severityNum >= 75 ? 'text-red-400' :
    severityNum >= 50 ? 'text-amber-400' :
    'text-emerald-400';

  const severityBarColor =
    severityNum >= 75 ? 'from-red-500 to-red-400' :
    severityNum >= 50 ? 'from-amber-500 to-amber-400' :
    'from-emerald-500 to-emerald-400';

  const severityLabel =
    severityNum >= 75 ? 'HIGH' :
    severityNum >= 50 ? 'MEDIUM' :
    'LOW';

  // Confidence comes in as a number (0-100); derive a label
  const confidenceLabel =
    issue.confidence >= 75 ? 'HIGH' :
    issue.confidence >= 50 ? 'MEDIUM' :
    'LOW';

  const confidenceStyle =
    issue.confidence >= 75 ? 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' :
    issue.confidence >= 50 ? 'text-amber-400 bg-amber-500/20 border-amber-500/30' :
    'text-red-400 bg-red-500/20 border-red-500/30';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="card rounded-3xl overflow-hidden" style={{borderColor:"rgba(52,211,153,0.18)"}}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-emerald-500/5 border-b border-emerald-500/12">
        <h2 className="text-xs font-semibold text-emerald-400 flex items-center gap-2">
          {isVideo ? <Film className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          {isVideo ? 'AI VIDEO ANALYSIS COMPLETE' : 'AI ANALYSIS COMPLETE'}
        </h2>
        <button
          onClick={onClose}
          className="text-slate-600 hover:text-slate-300 p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          aria-label="Dismiss analysis result"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-3">

        {/* ── Media + classification ──────────────────────── */}
        <div className="flex gap-4 items-start">
          {issue.image && (
            <div className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-white/[0.10] shadow-md">
              {isVideo ? (
                <video
                  src={issue.image}
                  className="w-full h-full object-cover"
                  muted
                  controls
                />
              ) : (
                <img
                  src={issue.image}
                  alt="Reported issue"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-1 bg-white/[0.06] border border-white/[0.10] rounded-lg text-xs font-semibold text-slate-200 tracking-wide capitalize">
                {issue.issueType}
              </span>
              <span className={`badge ${confidenceStyle}`}>
                {confidenceLabel} CONFIDENCE
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">ID: {issue.id}</p>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              {issue.createdAt instanceof Date
                ? issue.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : new Date(issue.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </div>

        {/* ── Severity bar ─────────────────────────────────── */}
        <div className="card-inner rounded-xl p-4">
          <div className="flex items-center justify-between mb-2.5">
            <p className="section-label flex items-center gap-1.5 mb-2.5">
              <Shield className="w-3 h-3" /> Severity Score
            </p>
            <p className={`metric-value text-xl font-bold leading-none ${severityColor}`}>
              {severityNum}
              <span className="text-xs text-slate-500 font-normal">/100</span>
              <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-bold ${severityColor} bg-current/10`}>
                {severityLabel}
              </span>
            </p>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r ${severityBarColor} rounded-full`}
              initial={{ width: '0%' }}
              animate={{ width: `${severityNum}%` }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
            />
          </div>
        </div>

        {/* ── Department + Resolution ───────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card-inner rounded-xl p-3">
            <p className="section-label flex items-center gap-1 mb-1.5">
              <Wrench className="w-3 h-3" /> Department
            </p>
            <p className="text-xs font-semibold text-slate-200 leading-snug">{issue.department}</p>
          </div>
          <div className="card-inner rounded-xl p-3">
            <p className="section-label flex items-center gap-1 mb-1.5">
              <Clock className="w-3 h-3" /> Est. Resolution
            </p>
            <p className="text-xs font-semibold text-emerald-400 leading-snug">{issue.estimatedResolution}</p>
          </div>
        </div>

        {/* ── Video metadata (video reports only) ───────────── */}
        {isVideo && (
          <div className="grid grid-cols-3 gap-3">
            <div className="card-inner rounded-xl p-3">
              <p className="section-label flex items-center gap-1 mb-1.5">
                <ImageIcon className="w-3 h-3" /> Media Type
              </p>
              <p className="text-xs font-semibold text-slate-200 leading-snug">Video</p>
            </div>
            <div className="card-inner rounded-xl p-3">
              <p className="section-label flex items-center gap-1 mb-1.5">
                <Clock className="w-3 h-3" /> Duration
              </p>
              <p className="text-xs font-semibold text-slate-200 leading-snug">
                {typeof issue.videoDurationSeconds === 'number' ? formatDuration(issue.videoDurationSeconds) : '—'}
              </p>
            </div>
            <div className="card-inner rounded-xl p-3">
              <p className="section-label flex items-center gap-1 mb-1.5">
                <Film className="w-3 h-3" /> Frames Analysed
              </p>
              <p className="text-xs font-semibold text-slate-200 leading-snug">
                {typeof issue.framesAnalyzed === 'number' ? issue.framesAnalyzed : '—'}
              </p>
            </div>
          </div>
        )}

        {/* ── Location ─────────────────────────────────────── */}
        <div className="card-inner rounded-xl p-3 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
          <p className="text-[11px] font-mono text-slate-400">
            {issue.location.latitude.toFixed(5)}, {issue.location.longitude.toFixed(5)}
          </p>
        </div>

        {/* ── Accident Risk ─────────────────────────────────── */}
        {issue.accidentRisk && (
          <div className="rounded-xl p-4 border" style={{background:"rgba(120,53,15,0.15)", borderColor:"rgba(251,191,36,0.20)"}}>
            <p className="section-label text-amber-500/70 flex items-center gap-1 mb-1.5">
              <AlertTriangle className="w-3 h-3" /> Accident Risk Assessment
            </p>
            <p className="text-xs text-amber-200/80 leading-relaxed">{issue.accidentRisk}</p>
          </div>
        )}

        {/* ── Grievance Document ────────────────────────────── */}
        {issue.grievanceDocument && (
          <div className="card-inner rounded-xl p-4">
            <p className="section-label flex items-center gap-1 mb-1.5">
              <FileUp className="w-3 h-3" /> Grievance Document
            </p>
            <p className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
              {issue.grievanceDocument}
            </p>
          </div>
        )}

        {/* ── Footer status ─────────────────────────────────── */}
        <div className="pt-1 flex items-center gap-2 text-emerald-400/80">
          <CheckCircle2 className="w-4 h-4" />
          <p className="text-xs font-medium text-emerald-400/70">
            Report submitted to {issue.department}
          </p>
        </div>

      </div>
    </motion.div>
  );
}
