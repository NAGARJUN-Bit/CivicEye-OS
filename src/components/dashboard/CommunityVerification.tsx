import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Users, ThumbsUp, ThumbsDown, TrendingUp, Zap } from 'lucide-react';

interface CommunityVerificationProps {
  issueId?: string;
  onVerificationComplete?: (trustScore: number) => void;
  onThresholdReached?: () => void;
}

export default function CommunityVerification({ issueId, onVerificationComplete, onThresholdReached }: CommunityVerificationProps) {
  const [nearbyCitizens] = useState(27);
  const [verified, setVerified] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [trustScore, setTrustScore] = useState(0);
  const [isSimulating, setIsSimulating] = useState(true);
  const [verificationStarted, setVerificationStarted] = useState(false);
  const [thresholdReached, setThresholdReached] = useState(false);

  // Reset all verification state whenever the issue being shown changes
  useEffect(() => {
    setVerified(0);
    setRejected(0);
    setTrustScore(0);
    setIsSimulating(true);
    setVerificationStarted(false);
    setThresholdReached(false);
  }, [issueId]);

  // Simulate verification process
  useEffect(() => {
    if (!isSimulating || !verificationStarted) return;

    // Stop if we've reached enough verifications
    if (verified + rejected >= nearbyCitizens) {
      setIsSimulating(false);
      return;
    }

    // Random delay between 0.8-1.5s for each verification
    const delay = Math.random() * 700 + 800;

    const timer = setTimeout(() => {
      // 85% chance of verification, 15% rejection
      if (Math.random() < 0.85) {
        setVerified(prev => prev + 1);
      } else {
        setRejected(prev => prev + 1);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [verified, rejected, isSimulating, verificationStarted, nearbyCitizens]);

  // Calculate trust score
  useEffect(() => {
    const totalVotes = verified + rejected;
    if (totalVotes > 0) {
      const score = Math.round((verified / totalVotes) * 100);
      setTrustScore(score);

      // Call callback
      if (onVerificationComplete) {
        onVerificationComplete(score);
      }

      // Check if threshold reached (80% trust score with at least 10 verifications)
      if (score >= 80 && totalVotes >= 10 && !thresholdReached) {
        setThresholdReached(true);
        if (onThresholdReached) {
          onThresholdReached();
        }
      }
    }
  }, [verified, rejected, thresholdReached, onVerificationComplete, onThresholdReached]);

  // Auto-start verification after component mounts
  useEffect(() => {
    const startDelay = setTimeout(() => {
      setVerificationStarted(true);
    }, 500);
    return () => clearTimeout(startDelay);
  }, []);

  const totalVotes = verified + rejected;
  const pendingCitizens = nearbyCitizens - totalVotes;
  const completionPercent = totalVotes > 0 ? Math.round((totalVotes / nearbyCitizens) * 100) : 0;

  return (
    <div className="card p-5 rounded-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 mb-4"><div className="w-6 h-6 rounded-md bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0"><Users className="w-3 h-3 text-sky-400" /></div><h2 className="text-xs font-semibold text-slate-300">Community Verification</h2></div>
        {thresholdReached && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-md text-xs font-semibold border border-emerald-500/20"
          >
            <Zap className="w-3 h-3" />
            VERIFIED
          </motion.div>
        )}
      </div>

      {/* Verification Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs text-slate-500">Community Response</p>
          <p className="text-xs font-mono text-slate-400">{completionPercent}%</p>
        </div>
        <div className="w-full bg-white/[0.05] rounded-full h-1.5 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-500 to-sky-400"
            initial={{ width: '0%' }}
            animate={{ width: `${completionPercent}%` }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2 font-mono">
          {totalVotes} / {nearbyCitizens} citizens responded
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Nearby Citizens */}
        <div className="card-inner rounded-xl p-4">
          <p className="section-label mb-2">Nearby</p>
          <motion.p
            className="metric-value text-3xl font-bold text-slate-200 leading-none"
            key={nearbyCitizens}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
          >
            {nearbyCitizens}
          </motion.p>
          <p className="text-[10px] text-slate-600 mt-1">Citizens in vicinity</p>
        </div>

        {/* Trust Score */}
        <div className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 p-4 rounded-xl border border-emerald-500/30 card">
          <p className="section-label text-emerald-600/70 mb-2">Trust Score</p>
          <motion.p
            className="metric-value text-3xl font-bold text-emerald-400 leading-none"
            key={trustScore}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 100 }}
          >
            {trustScore}%
          </motion.p>
          <motion.p
            className="text-[10px] text-emerald-500/70 mt-1"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {thresholdReached ? '✓ Threshold met' : 'Calculating...'}
          </motion.p>
        </div>

        {/* Verified Count */}
        <div className="card-inner rounded-xl p-4" style={{borderColor:"rgba(56,189,248,0.18)"}}>
          <p className="section-label text-sky-500/70 flex items-center gap-1 mb-2">
            <ThumbsUp className="w-3 h-3" /> Confirmed
          </p>
          <motion.p
            className="metric-value text-3xl font-bold text-sky-400 leading-none"
            key={verified}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {verified}
          </motion.p>
          <p className="text-[10px] text-sky-500/60 mt-1">Verified the issue</p>
        </div>

        {/* Rejected Count */}
        <div className="card-inner rounded-xl p-4" style={{borderColor:"rgba(251,191,36,0.18)"}}>
          <p className="section-label text-amber-500/70 flex items-center gap-1 mb-2">
            <ThumbsDown className="w-3 h-3" /> Rejected
          </p>
          <motion.p
            className="metric-value text-3xl font-bold text-amber-400 leading-none"
            key={rejected}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {rejected}
          </motion.p>
          <p className="text-[10px] text-amber-500/60 mt-1">Disputed the report</p>
        </div>
      </div>

      {/* Active Verification Feed */}
      <div className="card-inner rounded-xl p-4 max-h-48 overflow-y-auto">
        <p className="section-label mb-3">Live Feed</p>
        <div className="space-y-2">
          {/* Show last 5 verifications */}
          {Array.from({ length: Math.min(totalVotes, 5) }).map((_, i) => {
            // Roughly determine if it was a confirmation or rejection based on ratio
            const isConfirmed = i < Math.round((verified / totalVotes) * 5);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-2 text-xs p-2 rounded-lg ${
                  isConfirmed
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {isConfirmed ? (
                  <>
                    <ThumbsUp className="w-3 h-3 flex-shrink-0" />
                    <span>Citizen confirmed the issue</span>
                  </>
                ) : (
                  <>
                    <ThumbsDown className="w-3 h-3 flex-shrink-0" />
                    <span>Citizen disputed the issue</span>
                  </>
                )}
              </motion.div>
            );
          })}
          {pendingCitizens > 0 && (
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex items-center gap-2 text-xs p-2 rounded-lg bg-slate-800/50 text-slate-500 border border-slate-700/50"
            >
              <div className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
              <span>Waiting for {pendingCitizens} more responses...</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Status Message */}
      <div className="mt-4 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs text-slate-500">
        <p className="font-semibold mb-1 text-slate-300">Community Verification Status</p>
        <p>
          {totalVotes === 0
            ? '🔄 Reaching out to nearby citizens...'
            : thresholdReached
            ? '✅ Verification threshold reached! Issue marked as VERIFIED and assigned to department.'
            : trustScore >= 70
            ? `✓ Strong community consensus (${trustScore}%). Waiting for more verifications...`
            : trustScore >= 50
            ? `⚠ Mixed responses (${trustScore}%). Gathering more confirmations...`
            : '⚠ Low confirmation rate. Continuing verification process...'}
        </p>
      </div>

      {/* Control Buttons */}
      <div className="mt-4 pt-4 border-t border-white/[0.06] flex gap-2 justify-end">
        <button
          onClick={() => {
            setVerified(0);
            setRejected(0);
            setTrustScore(0);
            setIsSimulating(true);
            setThresholdReached(false);
            setVerificationStarted(false);
            setTimeout(() => setVerificationStarted(true), 300);
          }}
          className="text-xs text-slate-400 border border-slate-700 px-3 py-1 rounded-md hover:bg-slate-800 transition"
        >
          Reset
        </button>
        <button
          onClick={() => setIsSimulating(!isSimulating)}
          className="text-xs text-sky-400 border border-sky-500/20 px-3 py-1 rounded-md hover:bg-sky-600/10 transition"
        >
          {isSimulating ? 'Pause' : 'Resume'}
        </button>
      </div>
    </div>
  );
}
