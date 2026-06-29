import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain, Hash, Building2, BarChart2, Clock, User, Lightbulb,
  Activity, FileText, Download, Send, Loader, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { Issue } from '../../lib/utils';

interface AIActionCenterProps {
  issue: Issue;
  complaintId: string | null;
  sentToAuthority: boolean;
  onSendToAuthority: () => void;
  repairScheduled: boolean;
}

function getPriorityLabel(severity: string): { label: string; color: string; bg: string; border: string } {
  const s = parseInt(severity, 10) || 0;
  if (s >= 75) return { label: 'CRITICAL', color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30'    };
  if (s >= 50) return { label: 'HIGH',     color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30'  };
  if (s >= 25) return { label: 'MEDIUM',   color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/30'    };
  return              { label: 'LOW',      color: 'text-emerald-400', bg: 'bg-emerald-500/10',border: 'border-emerald-500/30' };
}

function getSLAFromDepartment(dept: string, severity: string): string {
  const s = parseInt(severity, 10) || 0;
  if (s >= 75) return '24 hours (Emergency SLA)';
  if (dept.toLowerCase().includes('water'))      return '48 hours';
  if (dept.toLowerCase().includes('electrical')) return '72 hours';
  if (dept.toLowerCase().includes('traffic'))    return '4 hours';
  if (dept.toLowerCase().includes('sanitation')) return '48 hours';
  if (dept.toLowerCase().includes('public'))     return '5 business days';
  return '3-5 business days';
}

function getRecommendedOfficer(dept: string): string {
  if (dept.toLowerCase().includes('water'))      return 'Water Maintenance Division — Field Unit B';
  if (dept.toLowerCase().includes('electrical')) return 'Electrical Services — Rapid Response Cell';
  if (dept.toLowerCase().includes('traffic'))    return 'Traffic Control — Signal Ops Team';
  if (dept.toLowerCase().includes('sanitation')) return 'Sanitation Corps — Collection Squad 7';
  if (dept.toLowerCase().includes('public'))     return 'Public Works — Road Infrastructure Unit';
  if (dept.toLowerCase().includes('parks'))      return 'Parks & Forestry — Grounds Maintenance';
  return 'General Municipal Services — Duty Officer';
}

function getAIRecommendation(issue: Issue): string {
  const s = parseInt(issue.severity, 10) || 0;
  const type = issue.issueType.toLowerCase();
  if (s >= 75)
    return `Immediate action required. ${issue.issueType} poses a significant public safety hazard. Recommend emergency dispatch within 2 hours. Block area if necessary.`;
  if (type.includes('pothole') || type.includes('road'))
    return `Schedule repair during off-peak traffic hours. Temporary signage recommended until fixed. Estimated crew time: 2–4 hours.`;
  if (type.includes('leak') || type.includes('water'))
    return `Isolate water main in affected zone and dispatch repair crew. Notify downstream residents of potential supply disruption.`;
  if (type.includes('light') || type.includes('signal'))
    return `Reroute traffic manually if signal is non-functional. Coordinate with electrical crew for same-day repair.`;
  return `Assess on-site within SLA window. Prioritize based on foot-traffic impact and weather forecast. Document findings before repair.`;
}

function getCurrentStatusLabel(issue: Issue, sentToAuthority: boolean, repairScheduled: boolean): string {
  if (issue.status === 'resolved')       return 'Resolved';
  if (repairScheduled)                   return 'Repair Scheduled';
  if (issue.status === 'accepted')       return 'Accepted by Department';
  if (issue.status === 'pending_authority' && sentToAuthority) return 'Pending Authority Acceptance';
  if (sentToAuthority)                   return 'Submitted to Authority';
  if (issue.status === 'in_progress')    return 'Processing';
  if (issue.status === 'verification')   return 'Community Verification';
  if (issue.status === 'assigned')       return 'Evidence Package Ready';
  return 'AI Analysis Complete';
}

function openPrintWindow(complaintText: string, issue: Issue, complaintId: string | null): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Official Civic Complaint — ${complaintId ?? issue.id}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; color: #1a1a1a; background: #fff; padding: 40px 60px; line-height: 1.6; }
  .header { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; }
  .header p { font-size: 12px; color: #444; margin-top: 4px; }
  .ref { display: flex; justify-content: space-between; font-size: 11px; color: #444; margin-bottom: 24px; }
  .section { margin-bottom: 20px; }
  .section h2 { font-size: 13px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; letter-spacing: 1px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 12px; }
  .field { margin-bottom: 4px; }
  .label { font-weight: bold; color: #555; font-size: 11px; text-transform: uppercase; }
  .value { color: #111; }
  .body-text { font-size: 12px; line-height: 1.7; color: #222; white-space: pre-wrap; }
  .footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 16px; font-size: 10px; color: #777; }
  @media print { body { padding: 20px 40px; } }
</style>
</head>
<body>
<div class="header">
  <h1>Official Municipal Civic Complaint</h1>
  <p>Submitted via CivicEye AI Resolution System</p>
</div>
<div class="ref">
  <span><strong>Complaint ID:</strong> ${complaintId ?? 'PENDING'}</span>
  <span><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
  <span><strong>Report Ref:</strong> ${issue.id}</span>
</div>
<div class="section">
  <h2>Issue Details</h2>
  <div class="grid">
    <div class="field"><span class="label">Category</span><br><span class="value">${issue.issueType}</span></div>
    <div class="field"><span class="label">Department</span><br><span class="value">${issue.department}</span></div>
    <div class="field"><span class="label">Severity Score</span><br><span class="value">${issue.severity}/100</span></div>
    <div class="field"><span class="label">Est. Resolution</span><br><span class="value">${issue.estimatedResolution}</span></div>
    <div class="field"><span class="label">GPS Coordinates</span><br><span class="value">${issue.location.latitude.toFixed(5)}, ${issue.location.longitude.toFixed(5)}</span></div>
    <div class="field"><span class="label">Submitted At</span><br><span class="value">${new Date(issue.createdAt).toLocaleString()}</span></div>
  </div>
</div>
<div class="section">
  <h2>Official Complaint Narrative</h2>
  <p class="body-text">${complaintText || issue.grievanceDocument || 'No complaint text generated.'}</p>
</div>
${issue.accidentRisk ? `<div class="section"><h2>Accident Risk Assessment</h2><p class="body-text">${issue.accidentRisk}</p></div>` : ''}
<div class="footer">
  This document was auto-generated by CivicEye AI Resolution System. Complaint ID: ${complaintId ?? issue.id}. 
  AI-classified evidence has been cryptographically signed and is tamper-evident. 
  For official use only — submitted to ${issue.department}.
</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=800,height=900');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }
}

export default function AIActionCenter({
  issue,
  complaintId,
  sentToAuthority,
  onSendToAuthority,
  repairScheduled,
}: AIActionCenterProps) {
  const [officialComplaint, setOfficialComplaint] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showComplaint, setShowComplaint] = useState(false);
  const [sendSent, setSendSent] = useState(false);

  const priority = getPriorityLabel(issue.severity);
  const sla = getSLAFromDepartment(issue.department, issue.severity);
  const officer = getRecommendedOfficer(issue.department);
  const aiRec = getAIRecommendation(issue);
  const statusLabel = getCurrentStatusLabel(issue, sentToAuthority, repairScheduled);

  // Reset local state whenever the displayed issue changes
  useEffect(() => {
    setOfficialComplaint(null);
    setIsGenerating(false);
    setGenerateError(null);
    setShowComplaint(false);
    setSendSent(false);
  }, [issue.id]);

  const handleGenerateComplaint = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch('/api/generate-complaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueType: issue.issueType,
          department: issue.department,
          severity: issue.severity,
          estimatedResolution: issue.estimatedResolution,
          location: issue.location,
          accidentRisk: issue.accidentRisk,
          grievanceDocument: issue.grievanceDocument,
          complaintId: complaintId ?? issue.id,
        }),
      });
      if (!res.ok) throw new Error('Failed to generate');
      const data = await res.json();
      setOfficialComplaint(data.complaint);
      setShowComplaint(true);
    } catch {
      setGenerateError('Could not generate complaint. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    openPrintWindow(officialComplaint ?? issue.grievanceDocument ?? '', issue, complaintId);
  };

  const handleSendToAuthority = () => {
    if (sendSent) return;
    setSendSent(true);
    onSendToAuthority();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="card rounded-3xl overflow-hidden" style={{borderColor:"rgba(129,140,248,0.16)"}}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b" style={{background:"rgba(79,70,229,0.06)", borderColor:"rgba(129,140,248,0.12)"}}>
        <div className="w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0"><Brain className="w-3 h-3 text-indigo-400" /></div>
        <h2 className="text-xs font-semibold text-slate-300">AI Action Center</h2>
        <div className="ml-auto">
          <span className={`badge ${priority.color} ${priority.bg} ${priority.border}`}>
            {priority.label} PRIORITY
          </span>
        </div>
      </div>

      <div className="p-5 space-y-3">
        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card-inner rounded-xl p-3">
            <p className="section-label flex items-center gap-1 mb-1.5">
              <Hash className="w-3 h-3" /> Complaint ID
            </p>
            <p className="text-xs font-semibold text-slate-200 font-mono">
              {complaintId ?? <span className="text-slate-600 italic">Generating…</span>}
            </p>
          </div>

          <div className="card-inner rounded-xl p-3">
            <p className="section-label flex items-center gap-1 mb-1.5">
              <Building2 className="w-3 h-3" /> Department
            </p>
            <p className="text-xs font-semibold text-slate-200 leading-snug">{issue.department}</p>
          </div>

          <div className="card-inner rounded-xl p-3">
            <p className="section-label flex items-center gap-1 mb-1.5">
              <BarChart2 className="w-3 h-3" /> Priority
            </p>
            <p className={`text-xs font-semibold ${priority.color}`}>{priority.label} — {issue.severity}/100</p>
          </div>

          <div className="card-inner rounded-xl p-3">
            <p className="section-label flex items-center gap-1 mb-1.5">
              <Clock className="w-3 h-3" /> Estimated SLA
            </p>
            <p className="text-xs font-semibold text-emerald-400 leading-snug">{sla}</p>
          </div>
        </div>

        {/* Officer Recommendation */}
        <div className="card-inner rounded-xl p-3">
          <p className="section-label flex items-center gap-1 mb-1.5">
            <User className="w-3 h-3" /> Recommended Officer / Division
          </p>
          <p className="text-xs font-semibold text-slate-300">{officer}</p>
        </div>

        {/* AI Recommendation */}
        <div className="rounded-xl p-3 border" style={{background:"rgba(49,46,129,0.12)", borderColor:"rgba(129,140,248,0.15)"}}>
          <p className="section-label text-indigo-400/60 flex items-center gap-1 mb-1.5">
            <Lightbulb className="w-3 h-3" /> AI Recommendation
          </p>
          <p className="text-xs text-indigo-200/80 leading-relaxed">{aiRec}</p>
        </div>

        {/* Current Status */}
        <div className="flex items-center gap-2 card-inner px-3 py-2.5 rounded-xl">
          <Activity className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <p className="section-label">Status</p>
          <p className="ml-auto text-xs font-semibold text-emerald-400">{statusLabel}</p>
        </div>

        {/* Official Complaint Text */}
        <AnimatePresence>
          {showComplaint && officialComplaint && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="card-inner rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="section-label flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Official Complaint
                  </p>
                  <button
                    onClick={() => setShowComplaint(v => !v)}
                    aria-label={showComplaint ? 'Collapse complaint text' : 'Expand complaint text'}
                    aria-expanded={showComplaint}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showComplaint ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
                  {officialComplaint}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {generateError && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-950/30 px-3 py-2 rounded-lg border border-red-500/20">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {generateError}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          {/* Generate Official Complaint */}
          <button
            onClick={handleGenerateComplaint}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-indigo-500/25 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <><Loader className="w-3.5 h-3.5 animate-spin" /> Generating...</>
            ) : officialComplaint ? (
              <><FileText className="w-3.5 h-3.5" /> Regenerate Official Complaint</>
            ) : (
              <><FileText className="w-3.5 h-3.5" /> Generate Official Complaint</>
            )}
          </button>

          {/* Download PDF */}
          <button
            onClick={handleDownloadPDF}
            disabled={!officialComplaint && !issue.grievanceDocument}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-slate-400 font-semibold text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>

          {/* Send to Authority */}
          <button
            onClick={handleSendToAuthority}
            disabled={sendSent}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs transition-all ${
              sendSent
                ? 'bg-emerald-900/40 border border-emerald-500/30 text-emerald-400 cursor-not-allowed'
                : 'btn-primary text-white'
            }`}
          >
            {sendSent ? (
              <><CheckCircle2 className="w-3.5 h-3.5" /> Submitted to Authority</>
            ) : (
              <><Send className="w-3.5 h-3.5" /> Send to Authority (Demo)</>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
