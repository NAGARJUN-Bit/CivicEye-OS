import { useCallback, useEffect, useRef, useState } from 'react';

// Languages CivicEye's voice input supports. "auto" is a soft pseudo-mode:
// the Web Speech API has no real on-device language auto-detection, so
// "auto" listens using the browser/device's own language as a best-effort
// guess. For reliable multilingual recognition, the explicit list below
// lets the user pin the exact language being spoken.
export const SUPPORTED_SPEECH_LANGUAGES = [
  { code: 'auto', label: 'Auto' },
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'ml-IN', label: 'Malayalam' },
] as const;

export type SpeechLanguageCode = typeof SUPPORTED_SPEECH_LANGUAGES[number]['code'];

/**
 * Which stage of the voice-input lifecycle we're currently in.
 *
 *  idle        → Mic is off, nothing pending.
 *  listening   → Mic is active; user may be speaking or paused between words.
 *  processing  → Recognizer ended; final result is being assembled.
 *  countdown   → Final text is ready; waiting COUNTDOWN_SECONDS before
 *                auto-send. Speech detected during this window cancels the
 *                countdown and returns to "listening".
 */
export type VoicePhase = 'idle' | 'listening' | 'processing' | 'countdown';

// ── Timing constants ────────────────────────────────────────────────────────

/**
 * Seconds shown in the countdown badge (3 → 2 → 1).
 * The total auto-send delay visible to the user.
 */
const COUNTDOWN_SECONDS = 3;

/**
 * Short buffer (ms) between the last final result and starting the countdown.
 * Lets the browser flush any in-flight partial result before we commit.
 */
const POST_RESULT_BUFFER_MS = 400;

// ── Helpers ─────────────────────────────────────────────────────────────────

function getSpeechRecognitionCtor(): SpeechRecognitionStatic | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// Resolves the "auto" pseudo-language to a concrete BCP-47 tag the
// recognizer can actually use, preferring the browser/OS locale when it
// matches one of our supported languages, and otherwise falling back to
// Indian English (the most common spoken language for this app's users).
function resolveAutoLanguage(): string {
  const navLang = typeof navigator !== 'undefined' ? navigator.language : '';
  const match = SUPPORTED_SPEECH_LANGUAGES.find(
    (l) =>
      l.code !== 'auto' &&
      navLang?.toLowerCase().startsWith(l.code.slice(0, 2).toLowerCase()),
  );
  return match?.code ?? 'en-IN';
}

// ── Types ────────────────────────────────────────────────────────────────────

interface UseSpeechRecognitionOptions {
  /** Called once the full, finalized transcript is ready to be sent. */
  onResult: (transcript: string) => void;
  /** Called when recognition fails in a way the user should know about. */
  onError?: (message: string) => void;
}

interface UseSpeechRecognitionReturn {
  /** Whether this browser exposes the SpeechRecognition API at all. */
  isSupported: boolean;
  /** True while the mic is actively capturing audio (phase === 'listening'). */
  isListening: boolean;
  /** Full phase of the voice lifecycle — use this for richer UI feedback. */
  voicePhase: VoicePhase;
  /** Live interim (unconfirmed) transcript shown while the recognizer is running. */
  interimTranscript: string;
  /**
   * Accumulated final-result text that has been confirmed but not yet sent.
   * Show this in the input box during "countdown" so the user can see what
   * will be sent and decide to cancel if the recognizer misheard something.
   */
  pendingTranscript: string;
  /** Seconds remaining in the auto-send countdown (0 when not counting down). */
  countdownSeconds: number;
  /** Currently selected recognition language (or "auto"). */
  language: SpeechLanguageCode;
  setLanguage: (lang: SpeechLanguageCode) => void;
  /** Starts voice capture. No-op if already active. */
  startListening: () => void;
  /**
   * Gracefully stops listening.
   * If text has been accumulated, leaves it as `pendingTranscript` (idle)
   * so the user can review/send manually via the Send button.
   * If nothing was said, resets to clean idle.
   */
  stopListening: () => void;
  /** Hard-cancels voice and discards every pending transcript. */
  cancelVoice: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Improved React wrapper around the browser's SpeechRecognition API.
 *
 * Key improvements over the previous version:
 *  • continuous=true — keeps the session alive across natural mid-sentence pauses.
 *  • Accumulates multiple final results into one transcript per session.
 *  • Waits COUNTDOWN_SECONDS after the last confirmed word before auto-sending.
 *  • If the user starts speaking during the countdown, the timer cancels and
 *    recognition continues seamlessly.
 *  • Exposes VoicePhase for richer "Listening / Processing / Sending in…" UI.
 */
export function useSpeechRecognition({
  onResult,
  onError,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const RecognitionCtor = getSpeechRecognitionCtor();
  const isSupported = RecognitionCtor !== null;

  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [pendingTranscript, setPendingTranscript] = useState('');
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [language, setLanguage] = useState<SpeechLanguageCode>('auto');

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Keep latest callbacks in refs so recognizer event handlers bound once
  // per instance always see the current values without re-creating handlers.
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onResultRef.current = onResult;
  onErrorRef.current = onError;

  // Text accumulated from all isFinal results in the current session.
  const accumulatedRef = useRef('');

  // Timer handles.
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Flag set to true when we intentionally stop/abort the recognizer so
  // the onend handler knows to skip its own state management.
  const intentionalStopRef = useRef(false);

  // ── Timer helpers ──────────────────────────────────────────────────────────

  const clearAllTimers = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  /**
   * Sends the accumulated transcript and resets everything to idle.
   * Also aborts the recognizer if it is still running.
   */
  const fireResult = useCallback(() => {
    clearAllTimers();
    intentionalStopRef.current = true;
    try {
      recognitionRef.current?.abort();
    } catch {
      // no-op
    }
    const text = accumulatedRef.current.trim();
    accumulatedRef.current = '';
    setVoicePhase('idle');
    setInterimTranscript('');
    setPendingTranscript('');
    setCountdownSeconds(0);
    if (text) {
      onResultRef.current(text);
    }
  }, [clearAllTimers]);

  /**
   * Begins the visual 3-2-1 countdown before auto-send.
   * Moves phase → 'countdown' and ticks every second.
   */
  const startCountdown = useCallback(() => {
    clearAllTimers();
    const pending = accumulatedRef.current.trim();
    if (!pending) {
      // Nothing to send — just go idle.
      setVoicePhase('idle');
      setInterimTranscript('');
      setPendingTranscript('');
      setCountdownSeconds(0);
      return;
    }
    setVoicePhase('countdown');
    setPendingTranscript(pending);
    setCountdownSeconds(COUNTDOWN_SECONDS);

    let remaining = COUNTDOWN_SECONDS;
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setCountdownSeconds(remaining);
      if (remaining <= 0) {
        fireResult();
      }
    }, 1000);
  }, [clearAllTimers, fireResult]);

  /**
   * Schedules the countdown to begin after POST_RESULT_BUFFER_MS.
   * Called every time a new final result arrives; resetting the timer
   * effectively means "start countdown from the last word spoken."
   */
  const scheduleCountdown = useCallback(() => {
    clearAllTimers();
    setVoicePhase('processing');
    silenceTimerRef.current = setTimeout(() => {
      startCountdown();
    }, POST_RESULT_BUFFER_MS);
  }, [clearAllTimers, startCountdown]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const cancelVoice = useCallback(() => {
    clearAllTimers();
    intentionalStopRef.current = true;
    try {
      recognitionRef.current?.abort();
    } catch {
      // no-op
    }
    accumulatedRef.current = '';
    setVoicePhase('idle');
    setInterimTranscript('');
    setPendingTranscript('');
    setCountdownSeconds(0);
  }, [clearAllTimers]);

  const stopListening = useCallback(() => {
    clearAllTimers();
    intentionalStopRef.current = true;
    try {
      recognitionRef.current?.abort();
    } catch {
      // no-op
    }
    const pending = accumulatedRef.current.trim();
    accumulatedRef.current = '';
    // Leave any accumulated text visible in the input for manual send.
    setPendingTranscript(pending);
    setVoicePhase('idle');
    setInterimTranscript('');
    setCountdownSeconds(0);
  }, [clearAllTimers]);

  const startListening = useCallback(() => {
    if (!RecognitionCtor) {
      onErrorRef.current?.('Voice input is not supported in this browser.');
      return;
    }
    // Only start from idle to avoid double-start races.
    if (voicePhase !== 'idle') return;

    clearAllTimers();
    accumulatedRef.current = '';
    intentionalStopRef.current = false;

    const recognition = new RecognitionCtor();
    recognitionRef.current = recognition;

    recognition.lang = language === 'auto' ? resolveAutoLanguage() : language;
    // continuous=true keeps the session alive across natural mid-sentence pauses
    // so slow speakers don't get cut off after the first clause.
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoicePhase('listening');
      setInterimTranscript('');
      setPendingTranscript('');
      setCountdownSeconds(0);
    };

    // onspeechstart fires whenever the browser detects a new burst of speech.
    // If the user starts talking again during our countdown, this cancels the
    // countdown and returns to the "listening" phase seamlessly.
    recognition.onspeechstart = () => {
      if (silenceTimerRef.current !== null || countdownIntervalRef.current !== null) {
        clearAllTimers();
        setVoicePhase('listening');
        setCountdownSeconds(0);
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let hasFinal = false;
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) {
          // Append with a space so multi-sentence speech reads naturally.
          accumulatedRef.current = accumulatedRef.current
            ? accumulatedRef.current.trimEnd() + ' ' + text.trim()
            : text.trim();
          hasFinal = true;
        } else {
          interimText += text;
        }
      }

      if (interimText) {
        setInterimTranscript(interimText);
        setVoicePhase('listening');
      }

      if (hasFinal) {
        // A confirmed word arrived — reset the silence countdown from now.
        setInterimTranscript('');
        scheduleCountdown();
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // no-speech: user hasn't spoken yet. If we already have accumulated text
      // (e.g. they paused very long), let the countdown handle it. Otherwise
      // silently go idle — it's not an error worth surfacing.
      if (event.error === 'no-speech') {
        if (!accumulatedRef.current.trim()) {
          clearAllTimers();
          setVoicePhase('idle');
          setInterimTranscript('');
          setPendingTranscript('');
        }
        return;
      }
      // aborted: we triggered this ourselves via abort().
      if (event.error === 'aborted') return;

      const friendlyMessages: Record<string, string> = {
        'not-allowed':
          'Microphone access was denied. Please allow microphone permissions and try again.',
        'permission-denied':
          'Microphone access was denied. Please allow microphone permissions and try again.',
        'audio-capture':
          'No microphone was found. Please check your device settings.',
        network:
          'A network error interrupted voice recognition. Please try again.',
        'language-not-supported':
          'That language is not supported for voice input on this browser.',
      };

      clearAllTimers();
      accumulatedRef.current = '';
      setVoicePhase('idle');
      setInterimTranscript('');
      setPendingTranscript('');
      setCountdownSeconds(0);
      onErrorRef.current?.(
        friendlyMessages[event.error] ??
          'Voice recognition failed. Please try again.',
      );
    };

    recognition.onend = () => {
      // With continuous=true, onend only fires when the recognizer fully stops.
      // If we triggered it intentionally (stop/abort), skip extra logic.
      if (intentionalStopRef.current) {
        intentionalStopRef.current = false;
        return;
      }
      // Unexpected stop (e.g. browser session timeout after a long silence).
      // If we have text and no timer is already running, kick off the countdown.
      const hasText = accumulatedRef.current.trim().length > 0;
      const timerRunning =
        silenceTimerRef.current !== null || countdownIntervalRef.current !== null;
      if (hasText && !timerRunning) {
        startCountdown();
      } else if (!hasText) {
        setVoicePhase('idle');
        setInterimTranscript('');
        setPendingTranscript('');
        setCountdownSeconds(0);
      }
      // If timerRunning && hasText: a countdown is already in flight — do nothing.
    };

    try {
      recognition.start();
    } catch {
      onErrorRef.current?.('Could not start voice recognition. Please try again.');
      setVoicePhase('idle');
    }
  }, [RecognitionCtor, language, voicePhase, clearAllTimers, scheduleCountdown, startCountdown]);

  // Stop listening cleanly if the component using this hook unmounts mid-capture.
  useEffect(() => {
    return () => {
      clearAllTimers();
      try {
        recognitionRef.current?.abort();
      } catch {
        // no-op
      }
    };
  }, [clearAllTimers]);

  return {
    isSupported,
    isListening: voicePhase === 'listening',
    voicePhase,
    interimTranscript,
    pendingTranscript,
    countdownSeconds,
    language,
    setLanguage,
    startListening,
    stopListening,
    cancelVoice,
  };
}
