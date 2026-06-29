import React, { useState, useRef, useEffect, DragEvent } from 'react';
import { motion } from 'motion/react';
import { Shield, Activity, AlertTriangle, Users, Upload, Check, Eye, Award, Trophy, BarChart3, Map, TrendingUp, FileUp, X, Loader, Camera, Video, Image as ImageIcon, Brain, Mic, MicOff } from 'lucide-react';
import IssueTimeline from './components/dashboard/IssueTimeline';
import CommunityVerification from './components/dashboard/CommunityVerification';
import InteractiveMap from './components/dashboard/InteractiveMap';
import AIAnalysisResult from './components/dashboard/AIAnalysisResult';
import AIActionCenter from './components/dashboard/AIActionCenter';
import GovernmentDashboard, { GovernmentEntry, AuthorityAction } from './components/dashboard/GovernmentDashboard';
import AIAnalyticsCenter from './components/dashboard/AIAnalyticsCenter';
import AdminIntelligenceDashboard from './components/dashboard/AdminIntelligenceDashboard';
import { Issue, TimelineEvent } from './lib/utils';
import { useSpeechRecognition, SUPPORTED_SPEECH_LANGUAGES, SpeechLanguageCode } from './hooks/useSpeechRecognition';

// Helper function to calculate distance between two geo-coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Formats raw byte counts into a human-readable size for the upload preview
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Formats a raw seconds count (from a <video> element's duration) into
// the same compact mm:ss style used in the preview card and analysis result.
function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

// Promise-based geolocation fetcher
function getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentIssue, setCurrentIssue] = useState<Issue | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<'image' | 'video' | null>(null);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [userStats, setUserStats] = useState({ reports: 0, verifications: 0, resolvedConfirmed: 0 });
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'gps' | 'approximate'>('idle');

  const [duplicateWarning, setDuplicateWarning] = useState<Issue | null>(null);

  // Resolution workflow state
  const [sentToAuthority, setSentToAuthority] = useState(false);
  const [complaintId, setComplaintId] = useState<string | null>(null);
  const [repairScheduled, setRepairScheduled] = useState(false);

  // Government Operations state
  const [activeView, setActiveView] = useState<'citizen' | 'government' | 'analytics' | 'admin'>('citizen');
  const [govEntries, setGovEntries] = useState<GovernmentEntry[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const clearSelectedFile = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setMediaKind(null);
    setVideoDurationSeconds(null);
    setAnalysisError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Revoke any active object URL when the component unmounts, to avoid
  // leaking blob URLs after the page/view is torn down.
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { id: '1', role: 'assistant', text: 'Hello! I am your Civic Copilot. Ask me anything about local infrastructure, pending reports, or neighborhood trends.' }
  ]);
  const [isChatTyping, setIsChatTyping] = useState(false);

  // --- DERIVED STATE & METRICS ---
  const userPoints = (userStats.reports * 10) + (userStats.verifications * 5) + (userStats.resolvedConfirmed * 15);
  let heroRank = "Citizen";
  if (userPoints >= 150) heroRank = "City Champion";
  else if (userPoints >= 100) heroRank = "Neighborhood Hero";
  else if (userPoints >= 50) heroRank = "Community Guardian";
  else if (userPoints >= 20) heroRank = "Contributor";

  const totalReports = issues.length;
  const totalVerifications = issues.reduce((sum, issue) => sum + issue.verificationCount, 0);
  const resolvedIssues = issues.filter(i => i.status === 'resolved').length;
  const participants = Math.floor(totalVerifications * 1.2) + totalReports;

  // --- LIVE DASHBOARD METRICS (computed from issues state) ---
  const openIssues = issues.filter(i => i.status !== 'resolved');
  const avgOpenSeverity = openIssues.length === 0
    ? 0
    : openIssues.reduce((s, i) => s + parseInt(i.severity || '50', 10), 0) / openIssues.length;

  // City Health: 100 when no issues; drops proportionally with avg open-issue severity
  const cityHealth = issues.length === 0
    ? 100
    : Math.max(0, Math.min(100, Math.round(100 - avgOpenSeverity * 0.5)));

  // Infrastructure Risk: average severity of open (unresolved) issues
  const infraRisk = Math.round(avgOpenSeverity);

  // Dept Efficiency: % of issues that have progressed past initial classification
  const deptEfficiency = issues.length === 0
    ? 100
    : Math.round(
        issues.filter(i => ['assigned', 'in_progress', 'pending_authority', 'accepted', 'repair_scheduled', 'resolved'].includes(i.status)).length
        / issues.length * 100
      );

  // AI Time Savings: each AI-classified report saves ~2 hrs of manual triage
  const aiTimeSavingsHrs = issues.length * 2;

  // [SIMULATED DATA START] - Hardcoded department performance metrics
  const departmentsData = [
    { name: "Water Management", total: 142, active: 12, resolved: 130, avgTime: "2.4 days", satisfaction: "94%", score: 92 },
    { name: "Public Works", total: 310, active: 45, resolved: 265, avgTime: "4.1 days", satisfaction: "88%", score: 87 },
    { name: "Electrical Services", total: 85, active: 16, resolved: 69, avgTime: "3.2 days", satisfaction: "82%", score: 81 },
    { name: "Sanitation", total: 420, active: 60, resolved: 360, avgTime: "1.8 days", satisfaction: "79%", score: 74 },
  ];
  // [SIMULATED DATA END]

  const hotspots: { name: string, count: number, impact: number, lat: number, lng: number, riskScore: number, impactRadius: number, escalationRisk: string, recommendedAction: string }[] = [];
  const visited = new Set<string>();

  issues.forEach(report => {
    if (visited.has(report.id)) return;
    const cluster = [report];
    visited.add(report.id);
    issues.forEach(other => {
      if (!visited.has(other.id) && calculateDistance(report.location.latitude, report.location.longitude, other.location.latitude, other.location.longitude) <= 500) {
        cluster.push(other);
        visited.add(other.id);
      }
    });
    if (cluster.length > 1) {
       hotspots.push({
         name: `${cluster[0].department} Cluster (${cluster[0].issueType.toUpperCase()})`,
         count: cluster.length,
         impact: cluster.length * 340,
         lat: cluster[0].location.latitude,
         lng: cluster[0].location.longitude,
         riskScore: Math.min(100, cluster.length * 15 + 40),
         impactRadius: 500,
         escalationRisk: cluster.length > 3 ? "Critical" : cluster.length > 1 ? "High" : "Medium",
         recommendedAction: `Multiple ${cluster[0].issueType} reports detected within 400m. Probability of infrastructure degradation increasing. Recommend preventive maintenance inspection.`
       });
    }
  });

  const highestRiskArea = hotspots.length > 0 ? [...hotspots].sort((a,b)=>b.impact - a.impact)[0].name : "N/A";
  const fastestGrowing = hotspots.length > 0 ? [...hotspots].sort((a,b)=>b.count - a.count)[0].name : "N/A";

  const catCounts = issues.reduce((acc, r) => {
    acc[r.issueType] = (acc[r.issueType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const mostCommonCategory = Object.entries(catCounts).sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0]?.[0] || "N/A";

  // --- CORE HANDLERS ---
  const handleVerifyIssue = (id: string) => {
    setIssues(prev => prev.map(issue => {
      if (issue.id === id) {
        return { ...issue, verificationCount: issue.verificationCount + 1 };
      }
      return issue;
    }));
    setUserStats(prev => ({ ...prev, verifications: prev.verifications + 1 }));
  };

  const handleMarkFixed = (id: string) => {
    // This function's logic might need to be updated based on new timeline/status requirements
    setIssues(prev => prev.map(issue => {
      if (issue.id === id) {
        return { ...issue, status: 'resolved' };
      }
      return issue;
    }));
    setUserStats(prev => ({ ...prev, resolvedConfirmed: prev.resolvedConfirmed + 1 }));
  };

  // Register complaint in the government queue when "Send to Authority" is triggered
  const handleSentToAuthority = (issueId: string, cid: string) => {
    setSentToAuthority(true);
    setGovEntries(prev => {
      // Don't create a duplicate entry
      if (prev.find(e => e.issueId === issueId)) return prev;
      const newEntry: GovernmentEntry = {
        issueId,
        complaintId: cid,
        receivedAt: new Date(),
        authorityActions: [],
        currentAuthorityStatus: 'pending',
      };
      return [newEntry, ...prev];
    });
  };

  // Handle all authority-side actions
  const handleAuthorityAction = (
    issueId: string,
    action: AuthorityAction,
    extra?: { officer?: string; scheduledDate?: string; note?: string }
  ) => {
    setGovEntries(prev =>
      prev.map(entry => {
        if (entry.issueId !== issueId) return entry;

        const updated: GovernmentEntry = {
          ...entry,
          authorityActions: [...entry.authorityActions, action],
        };

        if (action.type === 'accepted') {
          updated.currentAuthorityStatus = 'accepted';
        } else if (action.type === 'rejected') {
          updated.currentAuthorityStatus = 'rejected';
          updated.rejectionReason = extra?.note;
        } else if (action.type === 'officer_assigned') {
          updated.currentAuthorityStatus = 'officer_assigned';
          updated.assignedOfficer = extra?.officer;
        } else if (action.type === 'repair_scheduled') {
          updated.currentAuthorityStatus = 'repair_scheduled';
          updated.scheduledDate = extra?.scheduledDate;
        } else if (action.type === 'resolved') {
          updated.currentAuthorityStatus = 'resolved';
        }

        return updated;
      })
    );

    // Mirror authority status into citizen-facing issue state
    const statusMap: Partial<Record<AuthorityAction['type'], Issue['status']>> = {
      accepted: 'accepted',
      rejected: 'classified',
      officer_assigned: 'assigned',
      repair_scheduled: 'repair_scheduled',
      resolved: 'resolved',
    };
    const newStatus = statusMap[action.type];
    if (newStatus) {
      setIssues(prev =>
        prev.map(i => {
          if (i.id !== issueId) return i;
          const updatedTimeline: TimelineEvent[] = [
            ...i.timeline,
            {
              id: `auth_${action.type}_${Date.now()}`,
              title: auditActionTitle(action),
              description: auditActionDesc(action, extra),
              timestamp: action.timestamp,
              isCompleted: true,
            },
          ];
          return { ...i, status: newStatus, timeline: updatedTimeline };
        })
      );
      if (newStatus === 'resolved') {
        setUserStats(prev => ({ ...prev, resolvedConfirmed: prev.resolvedConfirmed + 1 }));
      }
    }
  };

  function auditActionTitle(action: AuthorityAction): string {
    const map: Record<string, string> = {
      accepted: 'Accepted by Authority',
      rejected: 'Rejected by Authority',
      officer_assigned: 'Officer Assigned',
      repair_scheduled: 'Repair Scheduled',
      resolved: 'Resolved',
    };
    return map[action.type] ?? action.type;
  }

  function auditActionDesc(action: AuthorityAction, extra?: { officer?: string; scheduledDate?: string; note?: string }): string {
    if (action.type === 'accepted') return 'Department authority has accepted and logged the complaint.';
    if (action.type === 'rejected') return `Complaint rejected. Reason: ${extra?.note ?? 'N/A'}`;
    if (action.type === 'officer_assigned') return `Field officer assigned: ${extra?.officer ?? 'N/A'}`;
    if (action.type === 'repair_scheduled') return `Repair crew scheduled for ${extra?.scheduledDate ?? 'N/A'}`;
    if (action.type === 'resolved') return 'Infrastructure repaired and verified. Issue closed.';
    return '';
  }

  const handleFileSelect = (file: File) => {
    const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type) || file.type.startsWith('image/');
    const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type) || file.type.startsWith('video/');

    // Revoke any previously created object URL before assigning a new preview,
    // since the old blob URL becomes unreachable once previewUrl is overwritten.
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    if (isImage) {
      setSelectedFile(file);
      setMediaKind('image');
      setVideoDurationSeconds(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      // Reset states for a new submission
      setCurrentIssue(null);
      setDuplicateWarning(null);
      setAnalysisError(null);
      setLocationStatus('idle');
    } else if (isVideo) {
      setSelectedFile(file);
      setMediaKind('video');
      setVideoDurationSeconds(null);
      // Videos are previewed via a blob URL (object URL) rather than a data
      // URL — cheaper for larger files and works directly with <video>.
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      // Reset states for a new submission
      setCurrentIssue(null);
      setDuplicateWarning(null);
      setAnalysisError(null);
      setLocationStatus('idle');
    } else {
      setAnalysisError("Invalid file type. Please upload an image (JPG, PNG, WEBP) or a video (MP4, MOV, WEBM).");
      setSelectedFile(null);
      setPreviewUrl(null);
      setMediaKind(null);
    }
  };

  const handleFileDropSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const executeLiveVisionAnalysis = async () => {
    if (!selectedFile || !previewUrl) return;
    setIsAnalyzing(true);
    setDuplicateWarning(null);
    setAnalysisError(null);
    setCurrentIssue(null);
    setLocationStatus('requesting');
    const submissionTime = new Date();

    try {
      let location = await getCurrentLocation();
      const gpsSucceeded = location !== null;
      if (!location) {
        location = { lat: 40.7 + Math.random() * 0.1, lng: -74.0 + Math.random() * 0.05 };
      }
      setLocationStatus(gpsSucceeded ? 'gps' : 'approximate');
      const now = new Date();

      const initialTimeline: TimelineEvent[] = [
        mediaKind === 'video'
          ? { id: 'submitted', title: 'Video Uploaded', description: 'Citizen submitted civic infrastructure video report', timestamp: submissionTime, isCompleted: true }
          : { id: 'submitted', title: 'Image Uploaded', description: 'Citizen submitted civic infrastructure report', timestamp: submissionTime, isCompleted: true },
      ];

      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('mediaType', mediaKind || 'image');
      formData.append('lat', String(location.lat));
      formData.append('lng', String(location.lng));

      const res = await fetch('/api/analyze-issue', { method: 'POST', body: formData });

      if (!res.ok) {
        let errData;
        try { errData = await res.json(); } catch { }
        throw new Error(JSON.stringify({ reason: errData?.reason || "analysis_error" }));
      }

      const data = await res.json();

      if (data.category === 'none' || data.isCivicIssue === false) {
        setAnalysisError(`The AI did not identify a civic issue in the ${mediaKind === 'video' ? 'video' : 'image'}. Please try another ${mediaKind === 'video' ? 'clip' : 'image'} or a different angle.`);
        return;
      }

      if (mediaKind === 'video') {
        initialTimeline.push({ id: 'frames_extracted', title: 'Frames Extracted', description: `${data.framesAnalyzed || 'Several'} representative frames sampled from the clip`, timestamp: new Date(), isCompleted: true });
        initialTimeline.push({ id: 'classified', title: 'AI Video Analysis Complete', description: 'Sampled frames analyzed and merged into one report by AI vision system', timestamp: new Date(), isCompleted: true });
      } else {
        initialTimeline.push({ id: 'classified', title: 'AI Classification Complete', description: 'Analyzed and categorized by AI vision system', timestamp: new Date(), isCompleted: true });
      }
      initialTimeline.push({ id: 'gps_captured', title: 'GPS Location Captured', description: 'Hyperlocal coordinates recorded', timestamp: new Date(), isCompleted: true });

      const newIssue: Issue = {
        id: data.id,
        issueType: data.category,
        image: previewUrl,
        location: { latitude: location.lat, longitude: location.lng },
        confidence: parseInt(data.confidence?.match(/\d+/)?.[0] || '0'),
        severity: data.severityScore,
        department: data.department,
        estimatedResolution: data.estimatedResolutionWindow || '2-3 business days',
        trustScore: 0,
        verificationCount: 1,
        status: 'classified',
        timeline: initialTimeline,
        createdAt: submissionTime,
        grievanceDocument: data.grievanceDocument,
        accidentRisk: data.accidentRisk,
        mediaType: data.mediaType === 'video' ? 'video' : 'image',
        videoDurationSeconds: data.videoDurationSeconds,
        framesAnalyzed: data.framesAnalyzed,
      };

      const existingDuplicate = issues.find(issue => {
        const distance = calculateDistance(newIssue.location.latitude, newIssue.location.longitude, issue.location.latitude, issue.location.longitude);
        return distance < 500 && issue.issueType.toLowerCase().trim() === newIssue.issueType.toLowerCase().trim();
      });

      if (existingDuplicate) {
        setDuplicateWarning(existingDuplicate);
      } else {
        setCurrentIssue(newIssue);
        setIssues(prev => [newIssue, ...prev]);
        setUserStats(prev => ({ ...prev, reports: prev.reports + 1 }));
        // Reset resolution workflow state for the new issue
        setSentToAuthority(false);
        setComplaintId(null);
        setRepairScheduled(false);
      }
    } catch (e: any) {
      console.error("Analysis execution error", e);
      let reason = 'analysis_error';
      try {
        const parsed = JSON.parse(e.message);
        reason = parsed.reason || 'analysis_error';
      } catch { /* Not a JSON string */ }

      const errorMessages: Record<string, string> = {
        rate_limited: "The AI service is currently busy. Please try your request again in a moment.",
        service_unavailable: "The AI analysis service is temporarily unavailable. Please try again later.",
        invalid_image: "The uploaded image is invalid or in an unsupported format. Please try a different image.",
        network_error: "A network error occurred. Please check your connection and try again.",
        analysis_error: "An unexpected error occurred during the AI analysis. Please try again."
      };

      setAnalysisError(errorMessages[reason] || errorMessages.analysis_error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sendCopilotMessage = async (rawMessage: string) => {
    const userQuery = rawMessage.trim();
    if (!userQuery || isChatTyping) return;

    setChatInput('');
    setChatHistory(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userQuery }]);
    setIsChatTyping(true);

    try {
      const payload = { 
        message: userQuery,
        contextData: issues.slice(0, 5).map(i => ({id: i.id, issueType: i.issueType, status: i.status, department: i.department})) 
      };

      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Copilot API Offline");

      const data = await res.json();
      setChatHistory(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: data.reply }]);
    } catch (err: any) {
      console.error("DEBUG: Chatbot fetch failed...", err);
      setChatHistory(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        text: `GEMINI ANALYSIS FAILED` 
      }]);
    } finally {
      setIsChatTyping(false);
    }
  };

  const handleSendCopilotMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendCopilotMessage(chatInput);
  };

  // --- VOICE INPUT (Civic Copilot) ---
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const voiceErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

  const {
    isSupported: isVoiceSupported,
    isListening,
    voicePhase,
    interimTranscript,
    pendingTranscript,
    countdownSeconds,
    language: voiceLanguage,
    setLanguage: setVoiceLanguage,
    startListening,
    stopListening,
    cancelVoice,
  } = useSpeechRecognition({
    onResult: (transcript) => {
      // The hook already waited for the user to finish speaking (3-second
      // countdown). Fill the input and send automatically.
      setChatInput(transcript);
      sendCopilotMessage(transcript);
    },
    onError: (message) => {
      if (voiceErrorTimeoutRef.current) clearTimeout(voiceErrorTimeoutRef.current);
      setVoiceError(message);
      voiceErrorTimeoutRef.current = setTimeout(() => setVoiceError(null), 5000);
    },
  });

  useEffect(() => {
    return () => {
      if (voiceErrorTimeoutRef.current) clearTimeout(voiceErrorTimeoutRef.current);
    };
  }, []);

  // Close the voice-language dropdown when clicking anywhere outside it.
  useEffect(() => {
    if (!showLanguageMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (languageMenuRef.current && !languageMenuRef.current.contains(event.target as Node)) {
        setShowLanguageMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLanguageMenu]);

  const handleMicClick = () => {
    if (!isVoiceSupported) {
      setVoiceError('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    if (voicePhase === 'idle') {
      // Start fresh.
      setVoiceError(null);
      startListening();
    } else if (voicePhase === 'listening') {
      // User tapped stop mid-speech — cancel without sending.
      stopListening();
      // If stopListening left pendingTranscript, transfer it to the chat input
      // so the user can review and send manually.
      if (pendingTranscript) setChatInput(pendingTranscript);
    } else if (voicePhase === 'countdown' || voicePhase === 'processing') {
      // User tapped during countdown — cancel auto-send and let them edit/send manually.
      const captured = pendingTranscript;
      cancelVoice();
      if (captured) setChatInput(captured);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <header className="max-w-7xl mx-auto flex justify-between items-center mb-10 py-1">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-sm flex-shrink-0">
            <Activity className="w-4.5 h-4.5 text-emerald-400" style={{width:'18px',height:'18px'}} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-slate-100 tracking-tight leading-none">CivicEye OS</h1>
            <p className="text-[10px] text-slate-500 font-medium tracking-widest mt-0.5 uppercase">Community Resolution Platform</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex bg-slate-900/90 border border-white/[0.07] rounded-xl p-1 gap-0.5 shadow-sm" role="tablist" aria-label="Application views">
          <button
            onClick={() => setActiveView('citizen')}
            role="tab"
            aria-selected={activeView === 'citizen'}
            className={`nav-tab ${activeView === 'citizen' ? 'nav-tab-active bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/30 shadow-sm' : ''}`}
          >
            <Users className="w-3.5 h-3.5" /> Citizen
          </button>
          <button
            onClick={() => setActiveView('government')}
            role="tab"
            aria-selected={activeView === 'government'}
            className={`nav-tab ${activeView === 'government' ? 'nav-tab-active bg-sky-600/20 text-sky-400 ring-1 ring-sky-500/30 shadow-sm' : ''}`}
          >
            <Shield className="w-3.5 h-3.5" /> Gov Ops
            {govEntries.filter(e => e.currentAuthorityStatus === 'pending').length > 0 && (
              <span className="bg-amber-500/90 text-slate-950 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none" aria-label={`${govEntries.filter(e => e.currentAuthorityStatus === 'pending').length} pending`}>
                {govEntries.filter(e => e.currentAuthorityStatus === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveView('analytics')}
            role="tab"
            aria-selected={activeView === 'analytics'}
            className={`nav-tab ${activeView === 'analytics' ? 'nav-tab-active bg-indigo-600/20 text-indigo-400 ring-1 ring-indigo-500/30 shadow-sm' : ''}`}
          >
            <Brain className="w-3.5 h-3.5" /> Analytics
          </button>
          <button
            onClick={() => setActiveView('admin')}
            role="tab"
            aria-selected={activeView === 'admin'}
            className={`nav-tab ${activeView === 'admin' ? 'nav-tab-active bg-violet-600/20 text-violet-400 ring-1 ring-violet-500/30 shadow-sm' : ''}`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Admin Intel
          </button>
        </nav>
      </header>

      {/* ── Executive KPI Strip ── */}
      <section className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-10">
        {/* Hero card */}
        <div className="col-span-1 lg:col-span-2 card-hero p-5 rounded-3xl flex flex-col justify-between min-h-[110px]">
          <div className="flex justify-between items-start">
            <div>
              <p className="section-label mb-3">City Health Score</p>
              <p className="metric-value text-[3.25rem] font-black text-slate-50 leading-none">
                {cityHealth}
                <span className="text-base font-medium text-slate-400 ml-1.5">/ 100</span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Activity className="w-4.5 h-4.5 text-emerald-400" style={{width:'18px',height:'18px'}} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-emerald-400 font-medium">
            <TrendingUp className="w-3.5 h-3.5" /> +2.4% vs last period
          </div>
        </div>

        {/* Metric cards */}
        <div className="col-span-1 card p-4 rounded-3xl border-l-2 border-l-amber-500/60 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="section-label mb-2.5">Infra Risk</p>
            <p className="metric-value text-[1.875rem] font-black text-amber-400 leading-none">
              {infraRisk}<span className="text-xs font-medium text-slate-500 ml-0.5">%</span>
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
        </div>

        <div className="col-span-1 card p-4 rounded-3xl border-l-2 border-l-sky-500/60 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="section-label mb-2.5">Participation</p>
            <p className="metric-value text-[1.875rem] font-black text-slate-100 leading-none">{participants}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Users className="w-4 h-4 text-sky-400" />
          </div>
        </div>

        <div className="col-span-1 card p-4 rounded-3xl border-l-2 border-l-indigo-500/60 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="section-label mb-2.5">Dept Efficiency</p>
            <p className="metric-value text-[1.875rem] font-black text-slate-100 leading-none">
              {deptEfficiency}<span className="text-xs font-medium text-slate-500 ml-0.5">%</span>
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
          </div>
        </div>

        <div className="col-span-1 card p-4 rounded-3xl border-l-2 border-l-emerald-500/60 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="section-label mb-2.5">AI Time Saved</p>
            <p className="metric-value text-[1.875rem] font-black text-emerald-400 leading-none">
              {aiTimeSavingsHrs}<span className="text-xs font-medium text-slate-500 ml-0.5">hrs</span>
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
      </section>

      {/* ── GOVERNMENT OPERATIONS VIEW ── */}
      {activeView === 'government' && (
        <div className="max-w-7xl mx-auto">
          <div className="card p-6 rounded-3xl">
            <GovernmentDashboard
              issues={issues}
              govEntries={govEntries}
              onAuthorityAction={handleAuthorityAction}
            />
          </div>
        </div>
      )}

      {/* ── AI ANALYTICS CENTER VIEW ── */}
      {activeView === 'analytics' && (
        <div className="max-w-7xl mx-auto">
          <AIAnalyticsCenter issues={issues} />
        </div>
      )}

      {/* ── ADMIN INTELLIGENCE DASHBOARD VIEW ── */}
      {activeView === 'admin' && (
        <div className="max-w-7xl mx-auto">
          <div className="card p-6 rounded-3xl">
            <AdminIntelligenceDashboard issues={issues} />
          </div>
        </div>
      )}

      {/* ── CITIZEN VIEW ── */}
      {activeView === 'citizen' && (
      <>
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN */}
        <div className="lg:col-span-5 space-y-5">
           <div className="card p-5 rounded-3xl">
             <div className="flex items-center gap-2 mb-4">
               <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                 <Upload className="w-3 h-3 text-emerald-400" />
               </div>
               <h2 className="text-xs font-semibold text-slate-300 tracking-wide">Citizen Reporting Hub</h2>
             </div>

             <input
               ref={fileInputRef}
               type="file"
               accept="image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
               onChange={handleFileDropSelection}
               className="hidden"
             />

             <div
               onDragEnter={handleDragEnter}
               onDragLeave={handleDragLeave}
               onDragOver={handleDragOver}
               onDrop={handleDrop}
               className={`rounded-xl transition-all ${
                 previewUrl
                   ? 'border border-white/[0.07] overflow-hidden'
                   : `border-2 border-dashed ${isDragging ? 'drop-zone-active border-emerald-500/40' : 'border-white/[0.07] hover:border-white/[0.12]'}`
               }`}
             >
               {!previewUrl ? (
                 <div
                   role="button"
                   tabIndex={0}
                   onClick={() => fileInputRef.current?.click()}
                   onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                   className="cursor-pointer p-10 flex flex-col items-center justify-center text-center gap-2"
                 >
                   <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-1 transition-all ${isDragging ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-white/[0.03] border border-white/[0.07]'}`}>
                     <Camera className={`w-5 h-5 transition-colors ${isDragging ? 'text-emerald-400' : 'text-slate-500'}`} />
                   </div>
                   <p className="text-sm font-semibold text-slate-300">
                     {isDragging ? 'Drop to upload' : 'Click to upload or drag & drop'}
                   </p>
                   <p className="text-xs text-slate-500">PNG, JPG, WEBP, MP4, MOV, WEBM</p>
                 </div>
               ) : mediaKind === 'video' ? (
                 <div className="relative">
                   <video
                     src={previewUrl}
                     controls
                     className="w-full h-48 object-cover bg-slate-950"
                     onLoadedMetadata={(e) => setVideoDurationSeconds(e.currentTarget.duration)}
                   />
                   <button
                     onClick={clearSelectedFile}
                     className="absolute top-2 right-2 bg-slate-950/80 hover:bg-red-500/80 text-slate-300 hover:text-white p-1.5 rounded-full border border-slate-700 transition-colors"
                     aria-label="Remove selected video"
                   >
                     <X className="w-3.5 h-3.5" />
                   </button>
                   <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 px-3 py-2 flex items-center gap-2">
                     <Video className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                     <p className="text-xs text-slate-300 font-mono truncate flex-1">{selectedFile?.name}</p>
                     {videoDurationSeconds !== null && (
                       <span className="text-[10px] text-slate-500 flex-shrink-0">{formatDuration(videoDurationSeconds)}</span>
                     )}
                     {selectedFile && (
                       <span className="text-[10px] text-slate-500 flex-shrink-0">{formatFileSize(selectedFile.size)}</span>
                     )}
                   </div>
                 </div>
               ) : (
                 <div className="relative">
                   <img src={previewUrl} alt="Selected report preview" className="w-full h-48 object-cover" />
                   <button
                     onClick={clearSelectedFile}
                     className="absolute top-2 right-2 bg-slate-950/80 hover:bg-red-500/80 text-slate-300 hover:text-white p-1.5 rounded-full border border-slate-700 transition-colors"
                     aria-label="Remove selected image"
                   >
                     <X className="w-3.5 h-3.5" />
                   </button>
                   <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 px-3 py-2 flex items-center gap-2">
                     <FileUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                     <p className="text-xs text-slate-300 font-mono truncate flex-1">{selectedFile?.name}</p>
                     {selectedFile && (
                       <span className="text-[10px] text-slate-500 flex-shrink-0">{formatFileSize(selectedFile.size)}</span>
                     )}
                   </div>
                 </div>
               )}
             </div>

             <button onClick={executeLiveVisionAnalysis} disabled={!selectedFile || isAnalyzing} className="mt-4 w-full btn-primary disabled:bg-slate-800 disabled:border-transparent disabled:shadow-none disabled:opacity-40 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2">
               {isAnalyzing ? (<><Loader className="w-4 h-4 animate-spin" /> Analyzing…</>) : "Submit Report"}
             </button>
             {locationStatus === 'requesting' && <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5"><Map className="w-3 h-3" /> Requesting GPS location…</p>}
             {locationStatus === 'gps' && <p className="text-[11px] text-emerald-500 mt-2 flex items-center gap-1.5"><Map className="w-3 h-3" /> GPS location captured.</p>}
             {locationStatus === 'approximate' && <p className="text-[11px] text-amber-500 mt-2 flex items-center gap-1.5"><Map className="w-3 h-3" /> Approximate location used.</p>}
           </div>

           {/* --- NEW WORKFLOW: ANALYSIS AND TIMELINE --- */}
           {analysisError && (
             <div className="card p-5 rounded-3xl border-l-2 border-l-red-500/60" style={{borderColor:'rgba(248,113,113,0.15)'}}>
               <div className="flex items-start gap-3 mb-3">
                 <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                   <AlertTriangle className="w-4 h-4 text-red-400" />
                 </div>
                 <div>
                   <h2 className="text-sm font-semibold text-red-400 leading-tight">Analysis Failed</h2>
                   <p className="text-xs text-red-300/70 mt-1 leading-relaxed">{analysisError}</p>
                 </div>
               </div>
               <button onClick={executeLiveVisionAnalysis} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2.5 rounded-lg font-semibold text-xs transition-colors border border-red-500/20">Retry Analysis</button>
             </div>
           )}

            {duplicateWarning && (
             <div className="card p-5 rounded-3xl border-l-2 border-l-amber-500/60" style={{borderColor:'rgba(251,191,36,0.15)'}}>
               <div className="flex items-start gap-3 mb-3">
                 <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                   <AlertTriangle className="w-4 h-4 text-amber-400" />
                 </div>
                 <div>
                   <h2 className="text-sm font-semibold text-amber-400 leading-tight">Hotspot Detected Nearby</h2>
                   <p className="text-xs text-amber-300/70 mt-1 leading-relaxed">
                     A similar {duplicateWarning.issueType} issue was already reported in this area. Verify the existing report to boost its priority instead of creating a duplicate.
                   </p>
                 </div>
               </div>
               <button onClick={() => { handleVerifyIssue(duplicateWarning.id); setDuplicateWarning(null); }} className="w-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-400 py-2.5 rounded-lg font-semibold text-xs transition-colors flex justify-center items-center gap-2">
                 <Check className="w-4 h-4"/> Verify Existing Report
               </button>
             </div>
           )}

           {currentIssue && (
             <>
                <AIAnalysisResult issue={currentIssue} onClose={() => setCurrentIssue(null)} />
                <AIActionCenter
                  issue={currentIssue}
                  complaintId={complaintId}
                  sentToAuthority={sentToAuthority}
                  onSendToAuthority={() => {
                    if (complaintId) {
                      handleSentToAuthority(currentIssue.id, complaintId);
                    } else {
                      setSentToAuthority(true);
                    }
                  }}
                  repairScheduled={repairScheduled}
                />
                <IssueTimeline
                  issueId={currentIssue.id}
                  status={currentIssue.status}
                  mediaType={currentIssue.mediaType}
                  sentToAuthority={sentToAuthority}
                  onComplaintIdGenerated={(cid) => {
                    setComplaintId(cid);
                    // Pre-register in gov queue as soon as complaint ID is generated
                    setGovEntries(prev => {
                      if (prev.find(e => e.issueId === currentIssue.id)) return prev;
                      return [{
                        issueId: currentIssue.id,
                        complaintId: cid,
                        receivedAt: new Date(),
                        authorityActions: [],
                        currentAuthorityStatus: 'pending',
                      } as GovernmentEntry, ...prev];
                    });
                  }}
                  onRepairScheduled={() => setRepairScheduled(true)}
                  onStatusChange={(newStatus) => {
                    setIssues(prev =>
                      prev.map(i => i.id === currentIssue.id ? { ...i, status: newStatus as Issue['status'] } : i)
                    );
                    if (newStatus === 'resolved') {
                      setUserStats(prev => ({ ...prev, resolvedConfirmed: prev.resolvedConfirmed + 1 }));
                    }
                  }}
                />
                <CommunityVerification
                  issueId={currentIssue.id}
                  onVerificationComplete={(score) => {
                    setIssues(prev =>
                      prev.map(i => i.id === currentIssue.id ? { ...i, trustScore: score } : i)
                    );
                  }}
                />
             </>
           )}

           {/* AI COMMUNITY INSIGHTS - Show only if 3+ reports */}
           {issues.length >= 3 && (
            <div className="card p-5 rounded-3xl" style={{borderColor:'rgba(129,140,248,0.12)'}}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-3 h-3 text-indigo-400" />
                </div>
                <h2 className="text-xs font-semibold text-slate-300 tracking-wide">AI Community Insights</h2>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center card-inner p-3">
                  <span className="text-xs text-slate-500">Most Common Issue</span>
                  <span className="text-xs font-semibold text-slate-200 capitalize">{mostCommonCategory}</span>
                </div>
                <div className="flex justify-between items-center card-inner p-3">
                  <span className="text-xs text-slate-500">Highest Risk Area</span>
                  <span className="text-xs font-semibold text-slate-200 truncate ml-4 max-w-[150px] text-right">{highestRiskArea}</span>
                </div>
                <div className="flex justify-between items-center card-inner p-3">
                  <span className="text-xs text-slate-500">Growing Hotspot</span>
                  <span className="text-xs font-semibold text-slate-200 truncate ml-4 max-w-[150px] text-right">{fastestGrowing}</span>
                </div>
              </div>
            </div>
           )}

          {/* ACTIVE HOTSPOTS ENGINE - Show only if 3+ reports */}
          {issues.length >= 3 && (
            <div className="card p-5 rounded-3xl" style={{borderColor:'rgba(251,191,36,0.12)'}}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Map className="w-3 h-3 text-amber-400" />
                </div>
                <h2 className="text-xs font-semibold text-slate-300 tracking-wide">AI Hotspot Engine</h2>
              </div>
              {hotspots.length > 0 ? (
                <div className="space-y-2">
                  {hotspots.slice(0, 2).map((h, i) => (
                    <div key={i} className="card-inner p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-slate-200 text-xs truncate flex-1">{h.name}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0">{h.escalationRisk}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-950/60 px-2 py-1.5 rounded-md text-xs"><span className="text-slate-500">Risk: </span><span className="text-amber-400 font-bold font-mono">{h.riskScore}</span><span className="text-slate-600">/100</span></div>
                        <div className="bg-slate-950/60 px-2 py-1.5 rounded-md text-xs"><span className="text-slate-500">Reports: </span><span className="text-slate-200 font-mono font-bold">{h.count}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Map className="w-6 h-6 text-slate-700 mb-2" />
                  <p className="text-xs text-slate-500 font-medium">No hotspots detected</p>
                  <p className="text-[11px] text-slate-600 mt-1">Clusters appear when 2+ reports land within 500 m</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-7 flex flex-col gap-5">

          {/* Community Hero Profile */}
          <div className="card p-5 rounded-3xl relative overflow-hidden group" style={{borderColor:'rgba(251,191,36,0.15)', background:'linear-gradient(145deg, rgba(251,191,36,0.04) 0%, rgba(12,22,40,0.95) 60%)'}}>
            <div className="absolute right-[-16px] top-[-16px] opacity-[0.07] group-hover:opacity-[0.12] transition-opacity duration-500"><Trophy className="w-28 h-28 text-amber-400" /></div>
            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className="section-label mb-2">Community Hero Profile</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Award className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-400 leading-tight">{heroRank}</p>
                    <p className="text-xs text-slate-500 font-mono">{userPoints} pts</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-5 sm:gap-6">
                <div className="text-center">
                  <p className="metric-value text-xl font-bold text-slate-200 leading-none">{userStats.reports}</p>
                  <p className="section-label mt-1.5">Reports</p>
                </div>
                <div className="text-center">
                  <p className="metric-value text-xl font-bold text-slate-200 leading-none">{userStats.verifications}</p>
                  <p className="section-label mt-1.5">Verifies</p>
                </div>
                <div className="text-center">
                  <p className="metric-value text-xl font-bold text-emerald-400 leading-none">{userStats.resolvedConfirmed}</p>
                  <p className="section-label mt-1.5 text-emerald-600/70">Fixes</p>
                </div>
              </div>
            </div>
          </div>

          {/* Department Performance */}
          <div className="card p-5 rounded-3xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-3 h-3 text-indigo-400" />
              </div>
              <h2 className="text-xs font-semibold text-slate-300 tracking-wide">Department Performance</h2>
              <span className="ml-auto text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-md font-semibold border border-red-500/15">Simulated</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {departmentsData.sort((a,b) => b.score - a.score).map((dept, idx) => (
                <div key={dept.name} className="card-inner p-4 rounded-xl">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800/80 flex items-center justify-center text-[9px] text-slate-500 font-bold font-mono flex-shrink-0">{idx + 1}</span>
                      <h3 className="font-semibold text-slate-200 text-xs leading-tight">{dept.name}</h3>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex-shrink-0 ml-2 ${dept.score >= 90 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : dept.score >= 80 ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                      {dept.score}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                    <div><span className="text-slate-600">Active</span> <span className="text-amber-400 font-mono font-semibold ml-1">{dept.active}</span></div>
                    <div><span className="text-slate-600">Resolved</span> <span className="text-emerald-400 font-mono font-semibold ml-1">{dept.resolved}</span></div>
                    <div><span className="text-slate-600">Avg Time</span> <span className="text-slate-300 font-mono ml-1">{dept.avgTime}</span></div>
                    <div><span className="text-slate-600">Sat.</span> <span className="text-slate-300 font-mono ml-1">{dept.satisfaction}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* COMMUNITY FEED */}
          <div className="card p-5 rounded-3xl flex flex-col max-h-[780px]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Activity className="w-3 h-3 text-emerald-400" />
              </div>
              <h2 className="text-xs font-semibold text-slate-300 tracking-wide">Live Community Feed</h2>
              {issues.length > 0 && (
                <span className="ml-auto text-[10px] bg-emerald-500/10 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">{issues.length} active</span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
              {issues.map(issue => {
                const isHighConfidence = issue.verificationCount >= 6;
                const isCommunityVerified = issue.verificationCount >= 3;

                return (
                  <div key={issue.id} className="card-inner p-3.5 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isHighConfidence ? 'bg-emerald-500' : isCommunityVerified ? 'bg-sky-400' : 'bg-slate-700'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-[10px] font-bold text-slate-300 uppercase tracking-wide border border-white/[0.06]">{issue.issueType}</span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-800/50 text-[10px] font-medium text-slate-400 flex items-center gap-1 border border-white/[0.04]">
                              {issue.mediaType === 'video' ? <Video className="w-2.5 h-2.5" /> : <ImageIcon className="w-2.5 h-2.5" />}
                              {issue.mediaType === 'video' ? 'Video' : 'Image'}
                            </span>
                            <span className="text-[10px] text-slate-600 font-mono">{issue.id}</span>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-1.5">
                            <button onClick={() => handleVerifyIssue(issue.id)} className="text-[11px] text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded-md hover:bg-sky-600/10 transition-colors font-medium">Verify</button>
                            <button onClick={() => handleMarkFixed(issue.id)} className="text-[11px] text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md hover:bg-emerald-600/10 transition-colors font-medium">Fixed</button>
                          </div>
                        </div>
                        <p className="text-xs font-semibold text-slate-300 mb-2 truncate">{issue.department}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                          <div className="text-slate-600">Stage <span className="text-slate-400 font-medium ml-1">{issue.status}</span></div>
                          <div className="text-slate-600">Verif. <span className="text-sky-400 font-mono font-semibold ml-1">{issue.verificationCount}</span></div>
                          <div className="text-slate-600 col-span-2 font-mono truncate">
                            {issue.location.latitude.toFixed(4)}, {issue.location.longitude.toFixed(4)}
                            <span className="ml-3 text-slate-700">{new Date(issue.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {issues.length === 0 && (
                <div className="empty-state mt-4">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center mb-3">
                    <Eye className="w-4 h-4 text-slate-600" />
                  </div>
                  <p className="text-xs font-semibold text-slate-500">No reports yet</p>
                  <p className="text-[11px] text-slate-600 mt-1">Upload a photo or video to submit the first civic report</p>
                </div>
              )}
            </div>
          </div>

          {/* CIVIC COPILOT */}
          <div className="card p-5 rounded-3xl flex flex-col h-[360px]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-3 h-3 text-emerald-400" />
              </div>
              <h2 className="text-xs font-semibold text-slate-300 tracking-wide">Civic Copilot</h2>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-500 font-medium">Online</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 mb-3 scrollbar-thin">
              {chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[88%] px-3.5 py-2.5 rounded-xl text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald-600/15 text-emerald-200 border border-emerald-500/15 ml-auto'
                      : 'bg-white/[0.03] text-slate-300 border border-white/[0.06]'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>
                </div>
              ))}
              {isChatTyping && (
                <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{animationDelay:'0ms'}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{animationDelay:'150ms'}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{animationDelay:'300ms'}} />
                </div>
              )}
            </div>

            {/* Voice status bar — shown whenever the mic is active */}
            {voicePhase !== 'idle' && (
              <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/[0.06]">
                {voicePhase === 'listening' && (
                  <>
                    <span className="voice-bars flex-shrink-0">
                      <span className="voice-bar" style={{ animationDelay: '0ms' }} />
                      <span className="voice-bar" style={{ animationDelay: '150ms' }} />
                      <span className="voice-bar" style={{ animationDelay: '300ms' }} />
                      <span className="voice-bar" style={{ animationDelay: '450ms' }} />
                    </span>
                    <span className="text-[10px] text-emerald-400 font-medium">Listening…</span>
                    <span className="text-[10px] text-slate-500 ml-auto">speak naturally, pauses are ok</span>
                  </>
                )}
                {voicePhase === 'processing' && (
                  <>
                    <span className="voice-processing-dot flex-shrink-0" />
                    <span className="text-[10px] text-amber-400 font-medium">Processing speech…</span>
                  </>
                )}
                {voicePhase === 'countdown' && (
                  <>
                    <span className="voice-countdown-ring flex-shrink-0">
                      <span className="voice-countdown-number">{countdownSeconds}</span>
                    </span>
                    <span className="text-[10px] text-slate-300 font-medium">
                      Sending in {countdownSeconds}s…
                    </span>
                    <span className="text-[10px] text-slate-500 ml-auto">speak to cancel</span>
                  </>
                )}
              </div>
            )}

            {/* Voice error banner */}
            {voiceError && (
              <div className="mb-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-300 leading-snug flex items-center gap-2">
                <span className="flex-1">{voiceError}</span>
                <button
                  type="button"
                  onClick={() => { setVoiceError(null); startListening(); }}
                  className="text-red-400 hover:text-red-200 underline underline-offset-2 flex-shrink-0"
                >
                  retry
                </button>
              </div>
            )}

            <form onSubmit={handleSendCopilotMessage} className="flex gap-2 relative">
              <div className="flex-1 relative">
                {/* Mic animation inside input — only shown while actively listening */}
                {isListening && (
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <span className="voice-bars">
                      <span className="voice-bar" style={{ animationDelay: '0ms' }} />
                      <span className="voice-bar" style={{ animationDelay: '150ms' }} />
                      <span className="voice-bar" style={{ animationDelay: '300ms' }} />
                      <span className="voice-bar" style={{ animationDelay: '450ms' }} />
                    </span>
                  </span>
                )}
                <input
                  type="text"
                  value={
                    voicePhase === 'countdown'
                      ? pendingTranscript
                      : isListening && interimTranscript
                      ? interimTranscript
                      : chatInput
                  }
                  onChange={(e) => {
                    // Allow typing only when not in an active voice phase.
                    if (voicePhase === 'idle') setChatInput(e.target.value);
                  }}
                  placeholder={
                    voicePhase === 'listening'
                      ? 'Listening… speak naturally'
                      : voicePhase === 'processing'
                      ? 'Processing speech…'
                      : voicePhase === 'countdown'
                      ? 'Sending soon… speak to cancel'
                      : 'Ask about issues or trends…'
                  }
                  className={`w-full bg-slate-950/80 border rounded-xl py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none transition-colors ${
                    voicePhase === 'listening'
                      ? 'border-emerald-500/50 pl-9 pr-4 focus:border-emerald-500/60'
                      : voicePhase === 'countdown'
                      ? 'border-amber-500/40 px-4 focus:border-amber-500/50'
                      : voicePhase === 'processing'
                      ? 'border-slate-500/40 px-4'
                      : 'border-white/[0.08] px-4 focus:border-emerald-500/40'
                  }`}
                  disabled={voicePhase === 'listening' || voicePhase === 'processing'}
                  readOnly={voicePhase === 'countdown'}
                />
              </div>

              {/* Language selector for voice input */}
              <div className="relative" ref={languageMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowLanguageMenu((v) => !v)}
                  title="Voice input language"
                  className="h-full px-2.5 rounded-xl border border-white/[0.08] bg-slate-950/80 text-[10px] font-medium text-slate-400 hover:text-slate-200 hover:border-white/[0.16] transition-colors"
                >
                  {SUPPORTED_SPEECH_LANGUAGES.find((l) => l.code === voiceLanguage)?.label ?? 'Auto'}
                </button>
                {showLanguageMenu && (
                  <div className="absolute bottom-full mb-2 right-0 w-32 rounded-xl border border-white/[0.08] bg-slate-900 shadow-lg shadow-black/40 overflow-hidden z-20">
                    {SUPPORTED_SPEECH_LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => {
                          setVoiceLanguage(l.code as SpeechLanguageCode);
                          setShowLanguageMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-[11px] transition-colors ${
                          l.code === voiceLanguage
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'text-slate-300 hover:bg-white/[0.05]'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Microphone button */}
              <button
                type="button"
                onClick={handleMicClick}
                disabled={isChatTyping}
                title={
                  !isVoiceSupported
                    ? 'Voice input not supported in this browser'
                    : voicePhase === 'listening'
                    ? 'Stop listening'
                    : voicePhase === 'countdown' || voicePhase === 'processing'
                    ? 'Cancel and keep text'
                    : 'Speak your question'
                }
                aria-pressed={voicePhase !== 'idle'}
                className={`disabled:opacity-40 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center border ${
                  voicePhase === 'listening'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : voicePhase === 'countdown' || voicePhase === 'processing'
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : 'bg-slate-950/80 border-white/[0.08] text-slate-400 hover:text-emerald-300 hover:border-emerald-500/30'
                }`}
              >
                {voicePhase === 'listening' ? (
                  <span className="relative flex items-center justify-center w-3.5 h-3.5">
                    {/* Smooth dual-ring pulse — calmer than the old double-ping */}
                    <span className="absolute inset-0 rounded-full bg-emerald-500/25 voice-mic-ring" />
                    <span className="absolute inset-[-4px] rounded-full bg-emerald-500/10 voice-mic-ring" style={{ animationDelay: '0.4s' }} />
                    <Mic className="w-3.5 h-3.5 relative" />
                  </span>
                ) : voicePhase === 'countdown' ? (
                  <span className="relative flex items-center justify-center w-3.5 h-3.5">
                    <span className="absolute inset-[-3px] rounded-full bg-amber-500/20 voice-mic-ring-slow" />
                    <Mic className="w-3.5 h-3.5 relative" />
                  </span>
                ) : isVoiceSupported ? (
                  <Mic className="w-3.5 h-3.5" />
                ) : (
                  <MicOff className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                type="submit"
                disabled={isChatTyping}
                className="btn-primary disabled:opacity-40 px-4 py-2.5 rounded-xl text-xs font-semibold"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* ACTIVE ISSUES MAP - Full Width */}
      <section className="max-w-7xl mx-auto mt-6">
        <InteractiveMap 
          issues={issues.map(issue => ({
            id: issue.id,
            lat: issue.location.latitude,
            lng: issue.location.longitude,
            category: issue.issueType,
            department: issue.department,
            status: issue.status,
            confirmations: issue.verificationCount,
            severity: issue.severity,
            timestamp: issue.createdAt.toISOString(),
            mediaType: issue.mediaType,
          }))}
          onMarkerClick={(issue) => {
            const clicked = issues.find(i => i.id === issue.id);
            if (clicked) setCurrentIssue(clicked);
          }}
        />
      </section>
      </> 
      )} {/* end activeView === 'citizen' */}
    </div>
  );
}