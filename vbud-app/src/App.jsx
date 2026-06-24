import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Droplet,
  AlertTriangle,
  Play,
  Square,
  Upload,
  Sparkles,
  Settings,
  X,
  Heart,
  Eye,
  Moon,
  Zap,
  CheckCircle,
  FileText,
  AlertCircle,
  Mic,
  MicOff
} from 'lucide-react';
import { analyzeFaceImage, generateStudyReport, chatWithVbud } from './GeminiService';

// Standard initial data points
const INITIAL_WATER = [4.2, 4.5, 4.3, 4.6, 4.4, 4.5, 4.8, 4.2, 4.1, 4.4, 4.6, 4.5, 4.3, 4.4, 4.5, 4.7, 4.3, 4.4, 4.6, 4.5];
const INITIAL_GAS = [0.21, 0.23, 0.22, 0.24, 0.21, 0.22, 0.25, 0.22, 0.20, 0.23, 0.24, 0.23, 0.21, 0.22, 0.23, 0.25, 0.22, 0.23, 0.24, 0.23];

function App() {
  // --- Core states ---
  const [activeState, setActiveState] = useState('Idle');
  const [previousState, setPreviousState] = useState('Idle');

  // API Key
  const [apiKey, setApiKey] = useState(() => {
    return import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('vbud_gemini_api_key') || '';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);

  // Telemetry
  const [waterData, setWaterData] = useState(INITIAL_WATER);
  const [gasData, setGasData] = useState(INITIAL_GAS);
  const [isAnomaly, setIsAnomaly] = useState(false);

  // Biometrics
  const [heartRate, setHeartRate] = useState(72);
  const [spo2, setSpo2] = useState(98);

  // Emergency
  const [emergencyCountdown, setEmergencyCountdown] = useState(60);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [emergencyDispatched, setEmergencyDispatched] = useState(false);
  const [showEmergencyReport, setShowEmergencyReport] = useState(false);
  const [emergencyLog, setEmergencyLog] = useState([]);

  // --- VOICE INTERACTION ---
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [fullTranscript, setFullTranscript] = useState('');
  const [geminiResponse, setGeminiResponse] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognitionStatus, setRecognitionStatus] = useState('idle');
  const recognitionRef = useRef(null);
  const fullTranscriptRef = useRef('');
  const isListeningRef = useRef(false); // ref so closures always see current value
  const synthRef = useRef(window.speechSynthesis);

  // Face Analysis
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [visionResult, setVisionResult] = useState(null);

  // Study mode
  const [isStudying, setIsStudying] = useState(false);
  const [studyTime, setStudyTime] = useState(0);
  const [timeline, setTimeline] = useState([]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [studyReport, setStudyReport] = useState('');
  const [hrSamples, setHrSamples] = useState([]);

  // Chart hover
  const [waterHoverVal, setWaterHoverVal] = useState(null);
  const [gasHoverVal, setGasHoverVal] = useState(null);

  // Refs for Web Audio
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);
  const studyTimerIntervalRef = useRef(null);
  const lastNoiseSpikeRef = useRef(0);
  const emergencyIntervalRef = useRef(null);

  // --- Theme helper ---
  const getStateThemeStyles = () => {
    switch (activeState) {
      case 'Studying': return { '--state-color': 'var(--study-color)', '--state-glow': 'var(--study-glow)' };
      case 'Analyzing': return { '--state-color': 'var(--analyze-color)', '--state-glow': 'var(--analyze-glow)' };
      case 'Alerts': return { '--state-color': 'var(--alert-color)', '--state-glow': 'var(--alert-glow)' };
      default: return { '--state-color': 'var(--idle-color)', '--state-glow': 'var(--idle-glow)' };
    }
  };

  // --- Telemetry simulation ---
  useEffect(() => {
    const interval = setInterval(() => {
      setWaterData(prev => {
        const nextVal = isAnomaly ? +(30 + Math.random() * 10).toFixed(1) : +(4.0 + Math.random() * 1.5).toFixed(1);
        return [...prev.slice(1), nextVal];
      });
      setGasData(prev => {
        const nextVal = isAnomaly ? +(4.0 + Math.random() * 1.5).toFixed(2) : +(0.18 + Math.random() * 0.1).toFixed(2);
        return [...prev.slice(1), nextVal];
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [isAnomaly]);

  // --- Biometrics auto-fluctuation ---
  useEffect(() => {
    if (emergencyActive || emergencyDispatched || isListening) return;
    const interval = setInterval(() => {
      setHeartRate(prev => {
        let base = 72;
        if (activeState === 'Studying') base = 78;
        if (activeState === 'Alerts') base = 96;
        if (activeState === 'Analyzing') base = 82;
        const drift = Math.floor(Math.random() * 5) - 2;
        return Math.max(60, Math.min(140, base + drift));
      });
      setSpo2(prev => {
        const drift = Math.random() > 0.85 ? (Math.random() > 0.5 ? 1 : -1) : 0;
        return Math.max(94, Math.min(100, prev + drift));
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [activeState, emergencyActive, emergencyDispatched, isListening]);

  // --- Sample HR during study ---
  useEffect(() => {
    if (isStudying) {
      const sampleInterval = setInterval(() => {
        setHrSamples(prev => [...prev, heartRate]);
      }, 5000);
      return () => clearInterval(sampleInterval);
    } else {
      setHrSamples([]);
    }
  }, [isStudying, heartRate]);

  // --- Emergency monitoring ---
  useEffect(() => {
    if (emergencyActive || emergencyDispatched) return;
    const hrUnsafe = heartRate < 50 || heartRate > 120;
    const spo2Unsafe = spo2 < 90;
    if (hrUnsafe || spo2Unsafe) {
      setEmergencyActive(true);
      setEmergencyCountdown(60);
      setActiveState('Alerts');
      setPreviousState(activeState);
      setEmergencyLog(prev => [
        ...prev,
        { time: new Date().toLocaleTimeString(), heartRate, spo2, reason: hrUnsafe ? (heartRate < 50 ? 'Bradycardia' : 'Tachycardia') : 'Hypoxemia' }
      ]);
      if (emergencyIntervalRef.current) clearInterval(emergencyIntervalRef.current);
      emergencyIntervalRef.current = setInterval(() => {
        setEmergencyCountdown(prev => {
          if (prev <= 1) {
            clearInterval(emergencyIntervalRef.current);
            emergencyIntervalRef.current = null;
            setEmergencyDispatched(true);
            setEmergencyActive(false);
            setActiveState('Idle');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [heartRate, spo2, emergencyActive, emergencyDispatched, activeState]);

  useEffect(() => {
    return () => { if (emergencyIntervalRef.current) clearInterval(emergencyIntervalRef.current); };
  }, []);

  // --- Emergency deactivation ---
  const deactivateEmergency = () => {
    if (emergencyIntervalRef.current) {
      clearInterval(emergencyIntervalRef.current);
      emergencyIntervalRef.current = null;
    }
    setEmergencyActive(false);
    setEmergencyDispatched(false);
    setHeartRate(72);
    setSpo2(98);
    setShowEmergencyReport(true);
    setActiveState('Idle');
    setEmergencyLog(prev => [...prev, { time: new Date().toLocaleTimeString(), action: 'Deactivated by user' }]);
  };

  // ============================================================
  //  VOICE INTERACTION – WITH DEBUG STATUS
  // ============================================================
  const toggleListening = () => {
    if (isListening) {
      stopListeningAndProcess();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Your browser does not support speech recognition. Please use Chrome or Edge.');
      setRecognitionStatus('error');
      return;
    }
    if (!apiKey) {
      alert('Please set your Gemini API key in Settings first.');
      return;
    }

    // Reset all transcript state
    fullTranscriptRef.current = '';
    setFullTranscript('');
    setTranscript('');
    setGeminiResponse('');
    setIsProcessing(false);
    isListeningRef.current = true;
    setIsListening(true);
    setRecognitionStatus('listening');

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setRecognitionStatus('listening');
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const part = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += part;
        } else {
          interim += part;
        }
      }
      if (final) {
        fullTranscriptRef.current = (fullTranscriptRef.current + ' ' + final).trim();
        setFullTranscript(fullTranscriptRef.current);
      }
      const display = (fullTranscriptRef.current + ' ' + interim).trim();
      setTranscript(display || 'Listening...');
    };

    recognition.onerror = (event) => {
      // 'aborted' fires whenever we call recognition.stop() ourselves — not a real error
      // 'no-speech' is benign; we keep listening
      if (event.error === 'aborted' || event.error === 'no-speech') {
        return;
      }
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone permissions in your browser.');
        isListeningRef.current = false;
        setIsListening(false);
        setRecognitionStatus('error');
        recognitionRef.current = null;
        return;
      }
      // For any other transient error, just mark status — onend will try to restart
      console.warn('Speech recognition error:', event.error);
    };

    recognition.onend = () => {
      // If we are still supposed to be listening, restart automatically
      if (isListeningRef.current) {
        try {
          recognition.start();
          setRecognitionStatus('listening');
        } catch (e) {
          // recognition was already replaced (user stopped) — ignore
        }
      }
    };

    try {
      recognition.start();
      setRecognitionStatus('listening');
    } catch (e) {
      isListeningRef.current = false;
      setIsListening(false);
      setRecognitionStatus('error');
      alert('Failed to start speech recognition: ' + e.message);
    }
  };

  const stopListeningAndProcess = () => {
    // Mark as not listening BEFORE stopping so onend/onerror closures see the update
    isListeningRef.current = false;
    setIsListening(false);
    setRecognitionStatus('idle');

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { }
      recognitionRef.current = null;
    }

    const finalMessage = fullTranscriptRef.current.trim();
    if (finalMessage) {
      sendToGemini(finalMessage);
    } else {
      setTranscript('No speech detected. Click the orb to try again.');
      setGeminiResponse('');
      setRecognitionStatus('idle');
    }
  };

  const sendToGemini = async (userMessage) => {
    setIsProcessing(true);
    setRecognitionStatus('processing');
    try {
      const response = await chatWithVbud(apiKey, userMessage);
      setGeminiResponse(response);
      speakResponse(response);
      setRecognitionStatus('idle');
    } catch (error) {
      console.error('Gemini error:', error);
      const errorMsg = 'Sorry, I encountered an error. Please try again.';
      setGeminiResponse(errorMsg);
      speakResponse(errorMsg);
      setRecognitionStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const speakResponse = (text) => {
    if (!window.speechSynthesis) {
      console.warn('Text-to-speech not supported');
      return;
    }
    synthRef.current.cancel();
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    const voices = synthRef.current.getVoices();
    utterance.voice = voices.find(voice => voice.lang.includes('en')) || null;
    utterance.onend = () => { setIsSpeaking(false); };
    utterance.onerror = () => { setIsSpeaking(false); };
    synthRef.current.speak(utterance);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (synthRef.current) synthRef.current.cancel();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { }
        recognitionRef.current = null;
      }
    };
  }, []);

  // --- Anomaly trigger / resolve ---
  const triggerAnomaly = () => {
    setIsAnomaly(true);
    setPreviousState(activeState);
    setActiveState('Alerts');
    if (isStudying) {
      const timeStr = getStudyTimeFormatted();
      setTimeline(prev => [...prev, { time: timeStr, msg: "CRITICAL ALERT: Gas/Water flow rates spiked abnormally!" }]);
    }
  };

  const resolveAnomaly = () => {
    setIsAnomaly(false);
    setActiveState(isStudying ? 'Studying' : 'Idle');
  };

  // --- Face Analysis ---
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setVisionResult(null);
  };

  const analyzeFace = async () => {
    if (!selectedImage) return;
    setPreviousState(activeState);
    setActiveState('Analyzing');
    setIsAnalyzingImage(true);
    try {
      if (!apiKey) {
        await new Promise(resolve => setTimeout(resolve, 2500));
        const mockResult = {
          fatigueScore: 68,
          mood: "Slightly Fatigued",
          customTips: [
            "Your facial fatigue indices suggest mild eye strain. Dim your monitor slightly.",
            "Stand up and do a quick 20‑second body stretch.",
            "Hydrate! A glass of water can immediately lift cognitive performance."
          ],
          isMock: true
        };
        setVisionResult(mockResult);
        if (isStudying) {
          const timeStr = getStudyTimeFormatted();
          setTimeline(prev => [...prev, { time: timeStr, msg: `Face Scan: ${mockResult.mood} (Fatigue: ${mockResult.fatigueScore}%)` }]);
        }
      } else {
        const result = await analyzeFaceImage(apiKey, selectedImage);
        setVisionResult(result);
        if (isStudying) {
          const timeStr = getStudyTimeFormatted();
          setTimeline(prev => [...prev, { time: timeStr, msg: `Face Scan: ${result.mood} (Fatigue: ${result.fatigueScore}%)` }]);
        }
      }
    } catch (error) {
      console.error(error);
      alert("Error analyzing image: " + error.message);
    } finally {
      setIsAnalyzingImage(false);
      setActiveState(isStudying ? 'Studying' : 'Idle');
    }
  };

  // --- Study Mode ---
  const startStudying = async () => {
    setIsStudying(true);
    setPreviousState(activeState);
    setActiveState('Studying');
    setStudyTime(0);
    setStudyReport('');
    setTimeline([{ time: "00:00", msg: "Study session initialized." }]);
    setHrSamples([]);

    studyTimerIntervalRef.current = setInterval(() => {
      setStudyTime(prev => prev + 1);
    }, 1000);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      drawRealWaveform();
    } catch (err) {
      console.warn("Microphone access denied, using synthetic:", err);
      drawSyntheticWaveform();
    }
  };

  const stopStudying = async () => {
    setIsStudying(false);
    clearInterval(studyTimerIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    cancelAnimationFrame(animationRef.current);

    setPreviousState(activeState);
    setActiveState('Analyzing');
    setIsGeneratingReport(true);

    const compiledTimeline = [
      ...timeline,
      { time: getStudyTimeFormatted(), msg: `Session finished. Duration: ${getStudyTimeFormatted()}.` }
    ];
    setTimeline(compiledTimeline);

    const avgHR = hrSamples.length ? Math.round(hrSamples.reduce((a, b) => a + b, 0) / hrSamples.length) : 77;

    try {
      if (!apiKey) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const mockReport = `
# Study Session Summary

- **Session duration:** ${getStudyTimeFormatted()}
- **Average heart rate:** ${avgHR} BPM (within normal range)

## Topics Covered
- Deep work on Vbud dashboard
- Reviewed biometrics integration
- Debugged emergency alerts

## Quick Tips
- Keep your workspace quiet to maintain focus.
- Take a 5-min break every 25 minutes.
        `;
        setStudyReport(mockReport);
      } else {
        const report = await generateStudyReport(apiKey, compiledTimeline, avgHR);
        setStudyReport(report);
      }
    } catch (error) {
      console.error(error);
      setStudyReport(`## Error generating report\n\n${error.message}`);
    } finally {
      setIsGeneratingReport(false);
      setActiveState('Idle');
    }
  };

  const getStudyTimeFormatted = () => {
    const mins = Math.floor(studyTime / 60).toString().padStart(2, '0');
    const secs = (studyTime % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const recordNoiseSpike = (db) => {
    const now = Date.now();
    if (now - lastNoiseSpikeRef.current > 6000) {
      lastNoiseSpikeRef.current = now;
      const stamp = getStudyTimeFormatted();
      setTimeline(prev => [...prev, { time: stamp, msg: `Noise spike detected: ${db} dB` }]);
    }
  };

  // --- Waveform drawing functions ---
  const drawRealWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    if (!analyser || !ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const draw = () => {
      if (!analyserRef.current) return;
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = 'rgba(9, 9, 11, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#a855f7';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(168, 85, 247, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / bufferLength);
      const db = Math.round(rms * 100);
      if (db > 22) {
        recordNoiseSpike(db);
      }
    };
    draw();
  };

  const drawSyntheticWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    let phase = 0;
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      phase += 0.1;

      ctx.fillStyle = 'rgba(9, 9, 11, 0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#a855f7';
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(168, 85, 247, 0.5)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      const points = 80;
      const sliceWidth = canvas.width / points;

      for (let i = 0; i < points; i++) {
        const x = i * sliceWidth;
        const amplitude = 25 * Math.sin(i * 0.05 + phase * 0.5);
        const y = (canvas.height / 2) + Math.sin(i * 0.15 + phase) * amplitude * Math.sin(i * 0.03);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      ctx.shadowBlur = 0;
    };
    draw();
  };

  // --- SVG Line Chart ---
  const renderSVGLineChart = (data, minVal, maxVal, strokeColor, glowColor, type) => {
    const W = 360;
    const H = 100;
    const pad = 10;

    const count = data.length;
    const yMin = Math.min(...data) - 0.2;
    const yMax = Math.max(...data) + 0.2;

    const points = data.map((val, idx) => {
      const x = pad + (idx / (count - 1)) * (W - 2 * pad);
      const y = H - pad - ((val - yMin) / (yMax - yMin)) * (H - 2 * pad);
      return { x, y, val };
    });

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }
    const fillD = `${pathD} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`;

    const hoverHandler = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      let closest = points[0];
      let minDist = Math.abs(points[0].x - (mouseX * (W / rect.width)));
      for (let i = 1; i < points.length; i++) {
        const dist = Math.abs(points[i].x - (mouseX * (W / rect.width)));
        if (dist < minDist) {
          minDist = dist;
          closest = points[i];
        }
      }
      if (type === 'water') setWaterHoverVal(closest);
      else setGasHoverVal(closest);
    };

    const mouseLeave = () => {
      if (type === 'water') setWaterHoverVal(null);
      else setGasHoverVal(null);
    };

    const activeHover = type === 'water' ? waterHoverVal : gasHoverVal;

    return (
      <div className="chart-container" onMouseMove={hoverHandler} onMouseLeave={mouseLeave}>
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
          <defs>
            <linearGradient id={`grad-${type}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={glowColor} stopOpacity="0.45" />
              <stop offset="100%" stopColor={glowColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
          <line x1="0" y1={pad} x2={W} y2={pad} stroke="rgba(255,255,255,0.03)" strokeDasharray="3,3" />
          <line x1="0" y1={H - pad} x2={W} y2={H - pad} stroke="rgba(255,255,255,0.03)" strokeDasharray="3,3" />

          <path d={fillD} fill={`url(#grad-${type})`} />
          <path d={pathD} stroke={strokeColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />

          {activeHover && (
            <>
              <line x1={activeHover.x} y1="0" x2={activeHover.x} y2={H} stroke="rgba(255,255,255,0.25)" strokeDasharray="2,2" />
              <circle cx={activeHover.x} cy={activeHover.y} r="5" fill={strokeColor} stroke="#ffffff" strokeWidth="1.5" />
            </>
          )}
        </svg>

        {activeHover && (
          <div
            className="chart-tooltip"
            style={{
              display: 'block',
              left: `${(activeHover.x / W) * 100}%`,
              top: `${(activeHover.y / H) * 100 - 30}%`,
              transform: 'translateX(-50%)'
            }}
          >
            {activeHover.val} {type === 'water' ? 'L/m' : 'm³/h'}
          </div>
        )}
      </div>
    );
  };

  // --- Markdown Renderer ---
  const renderMarkdown = (text) => {
    if (!text) return null;

    const lines = text.split('\n');
    const elements = [];
    let inList = false;
    let listItems = [];
    let inCode = false;
    let codeLines = [];
    let inTable = false;
    let tableRows = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="md-list">
            {listItems.map((item, i) => (
              <li key={i} className="md-list-item" dangerouslySetInnerHTML={{ __html: item }} />
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    const flushCode = () => {
      if (codeLines.length > 0) {
        elements.push(
          <pre key={`code-${elements.length}`} className="md-code-block">
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        codeLines = [];
      }
    };

    const flushTable = () => {
      if (tableRows.length > 0) {
        const header = tableRows[0].split('|').map(cell => cell.trim()).filter(cell => cell);
        const rows = tableRows.slice(1).map(row => row.split('|').map(cell => cell.trim()).filter(cell => cell));
        elements.push(
          <table key={`table-${elements.length}`} className="md-table">
            <thead><tr>{header.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
          </table>
        );
        tableRows = [];
      }
    };

    const renderMarkdownInline = (text) => {
      if (!text) return '';
      return text
        .replace(/\*\*(.*?)\*\*/g, '<strong class="md-bold">$1</strong>')
        .replace(/__(.*?)__/g, '<strong class="md-bold">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code class="md-inline-code">$1</code>');
    };

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      if (line.trim().startsWith('```')) {
        if (!inCode) {
          flushList();
          inCode = true;
          continue;
        } else {
          flushCode();
          inCode = false;
          continue;
        }
      }
      if (inCode) {
        codeLines.push(line);
        continue;
      }

      if (line.includes('|') && line.trim().startsWith('|') && line.trim().endsWith('|')) {
        if (!inTable) { flushList(); inTable = true; }
        tableRows.push(line);
        if (i === lines.length - 1 || !lines[i + 1].includes('|')) {
          flushTable();
          inTable = false;
        }
        continue;
      }
      if (inTable) { flushTable(); inTable = false; }

      if (line.trim().startsWith('> ')) {
        flushList();
        elements.push(
          <blockquote key={`blockquote-${i}`} className="md-blockquote">
            {renderMarkdownInline(line.trim().slice(2))}
          </blockquote>
        );
        continue;
      }

      if (line.startsWith('# ')) {
        flushList();
        elements.push(<h2 key={`h2-${i}`} className="md-header-1" dangerouslySetInnerHTML={{ __html: line.slice(2) }} />);
        continue;
      }
      if (line.startsWith('## ')) {
        flushList();
        elements.push(<h3 key={`h3-${i}`} className="md-header-2" dangerouslySetInnerHTML={{ __html: line.slice(3) }} />);
        continue;
      }
      if (line.startsWith('### ')) {
        flushList();
        elements.push(<h4 key={`h4-${i}`} className="md-header-3" dangerouslySetInnerHTML={{ __html: line.slice(4) }} />);
        continue;
      }

      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        inList = true;
        listItems.push(renderMarkdownInline(line.trim().slice(2)));
        continue;
      } else if (line.trim().match(/^\d+\. /)) {
        inList = true;
        listItems.push(renderMarkdownInline(line.trim().replace(/^\d+\. /, '')));
        continue;
      } else {
        if (inList) { flushList(); inList = false; }
      }

      if (line.trim() === '') continue;

      elements.push(<p key={`p-${i}`} className="md-paragraph" dangerouslySetInnerHTML={{ __html: renderMarkdownInline(line) }} />);
    }

    if (inList) flushList();
    if (inCode) flushCode();
    if (inTable) flushTable();

    return <div className="report-markdown">{elements}</div>;
  };

  // --- Settings handler ---
  const handleSaveSettings = () => {
    setApiKey(tempKey);
    localStorage.setItem('vbud_gemini_api_key', tempKey);
    setShowSettings(false);
  };

  // --- JSX ---
  return (
    <div style={getStateThemeStyles()}>
      {/* Overlay for listening mode */}
      {isListening && (
        <div className="emergency-modal-backdrop" style={{ background: 'rgba(0,0,0,0.85)', zIndex: 2000, justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: '500px', width: '90%' }}>
            <div className="avatar-orb" style={{ width: 150, height: 150, margin: '0 auto', animation: 'orbPulseIdle 1s infinite' }}>
              <div className="orb-inner" style={{ width: 130, height: 130 }}>
                <Mic size={48} color="#fbbf24" />
              </div>
            </div>
            <div className="speech-bubble" style={{ position: 'static', marginTop: '1.5rem', background: 'rgba(0,0,0,0.9)', maxWidth: '100%' }}>
              <p style={{ fontSize: '1rem', margin: 0 }}>
                {transcript || 'Listening... speak now'}
              </p>
              <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                Status: {recognitionStatus}
              </p>
            </div>
            <div style={{ marginTop: '1.5rem' }}>
              <button className="glass-button" onClick={toggleListening} style={{ borderColor: '#ef4444', color: '#ef4444' }}>
                <MicOff size={16} /> Stop & Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay for Gemini response */}
      {!isListening && geminiResponse && (
        <div className="emergency-modal-backdrop" style={{ background: 'rgba(0,0,0,0.85)', zIndex: 2000, justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: '500px', width: '90%' }}>
            <div className="avatar-orb" style={{ width: 150, height: 150, margin: '0 auto' }}>
              <div className="orb-inner" style={{ width: 130, height: 130 }}>
                <span className="orb-avatar-symbol" style={{ fontSize: '2.5rem', color: '#34d399' }}>✦</span>
              </div>
            </div>
            <div className="speech-bubble" style={{ position: 'static', marginTop: '1.5rem', background: 'rgba(0,0,0,0.9)', maxWidth: '100%' }}>
              <p style={{ fontSize: '1rem', margin: 0 }}>{geminiResponse}</p>
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="glass-button" onClick={() => setGeminiResponse('')} style={{ borderColor: '#94a3b8', color: '#94a3b8' }}>
                Close
              </button>
              {!isSpeaking && (
                <button className="glass-button" onClick={() => speakResponse(geminiResponse)} style={{ borderColor: '#10b981', color: '#34d399' }}>
                  Replay
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="dashboard-header">
        <div className="brand-section"><h1>Vbud <span className="brand-accent">Cockpit</span></h1></div>
        <div className="header-actions">
          {apiKey ? (
            <span className="state-badge" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34d399' }}>
              <CheckCircle size={12} /> Gemini Connected
            </span>
          ) : (
            <span className="state-badge" style={{ borderColor: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' }}>
              Demo (Mock mode)
            </span>
          )}
          <button className="glass-button" onClick={() => { setTempKey(apiKey); setShowSettings(true); }}>
            <Settings size={16} /> Key settings
          </button>
        </div>
      </header>

      {/* Orb with click listener */}
      <div className="orb-container">
        <div
          className={`avatar-orb state-${activeState.toLowerCase()}`}
          title={`Vbud state: ${activeState}`}
          onClick={toggleListening}
          style={{ cursor: 'pointer' }}
        >
          <div className="orb-inner">
            <span className="orb-avatar-symbol" style={{ fontSize: '2.5rem' }}>✦</span>
          </div>
        </div>
        <div className="state-badge">
          <span className="state-indicator-dot"></span>
          Vbud state: {activeState}
        </div>
      </div>

      {/* Main grid */}
      <div className="cockpit-grid">
        {/* Anomaly banner */}
        {isAnomaly && (
          <div className="anomaly-warning">
            <div className="anomaly-content">
              <AlertTriangle className="warning-icon-animate" size={24} />
              <div><strong>CRITICAL TELEMETRY SPIKE DETECTED:</strong> Unusual flow rates on water and gas feeds.</div>
            </div>
            <button className="glass-button" onClick={resolveAnomaly} style={{ borderColor: '#ef4444', color: '#ef4444' }}>
              Resolve anomaly
            </button>
          </div>
        )}

        {/* Emergency modals */}
        {emergencyActive && (
          <div className="emergency-modal-backdrop">
            <div className="emergency-modal-content">
              <div className="emergency-dispatching-pulse"><AlertCircle size={40} color="#ef4444" /></div>
              <h2 style={{ color: '#ef4444' }}>Emergency Alert</h2>
              <p style={{ color: '#fca5a5', fontSize: '0.9rem' }}>
                Unsafe biometrics detected! {heartRate < 50 ? 'Heart rate too low' : heartRate > 120 ? 'Heart rate too high' : ''}
                {spo2 < 90 ? ' and Oxygen saturation below 90%' : ''}
              </p>
              <div className="emergency-countdown-number">{emergencyCountdown}</div>
              <p style={{ color: '#fca5a5', fontSize: '0.8rem' }}>seconds until dispatch</p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                <button className="glass-button" onClick={deactivateEmergency} style={{ borderColor: '#10b981', color: '#34d399' }}>
                  Deactivate Alert
                </button>
              </div>
            </div>
          </div>
        )}

        {emergencyDispatched && (
          <div className="emergency-modal-backdrop" style={{ background: 'rgba(0, 0, 0, 0.9)' }}>
            <div className="emergency-modal-content">
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>SOS</div>
              <h2 style={{ color: '#ef4444' }}>Emergency Dispatched</h2>
              <p style={{ color: '#fca5a5' }}>Vbud has contacted emergency services on your behalf.</p>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Stay calm. Help is on the way.</p>
              <button className="glass-button" onClick={() => setEmergencyDispatched(false)} style={{ marginTop: '1.5rem' }}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Card 1: Telemetry */}
        <div className="glass-card">
          <div className="card-header-row">
            <h2 className="card-title"><Droplet size={18} /> Telemetry Stream</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {!isAnomaly ? (
                <button className="glass-button" onClick={triggerAnomaly} style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }}>
                  Simulate spike
                </button>
              ) : (
                <button className="glass-button" onClick={resolveAnomaly}>Reset streams</button>
              )}
            </div>
          </div>
          <div className="telemetry-grid">
            <div className="telemetry-stat-card">
              <span className="watch-label" style={{ color: '#0ea5e9' }}>Water Flow Rate</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginTop: '0.25rem' }}>
                <span className="watch-value" style={{ fontSize: '1.75rem', color: '#0ea5e9' }}>
                  {waterData[waterData.length - 1]}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>L/min</span>
              </div>
            </div>
            <div className="telemetry-stat-card">
              <span className="watch-label" style={{ color: '#f59e0b' }}>Gas flow volume</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginTop: '0.25rem' }}>
                <span className="watch-value" style={{ fontSize: '1.75rem', color: '#f59e0b' }}>
                  {gasData[gasData.length - 1]}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>m³/hour</span>
              </div>
            </div>
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Water usage timeline</span>
              <span>Latest: {waterData[waterData.length - 1]} L/min</span>
            </div>
            {renderSVGLineChart(waterData, 2.5, 45, '#0ea5e9', 'rgba(14,165,233,0.3)', 'water')}
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Gas telemetry timeline</span>
              <span>Latest: {gasData[gasData.length - 1]} m³/h</span>
            </div>
            {renderSVGLineChart(gasData, 0.1, 5, '#f59e0b', 'rgba(245,158,11,0.3)', 'gas')}
          </div>
        </div>

        {/* Card 2: Biometrics */}
        <div className="glass-card">
          <div className="card-header-row">
            <h2 className="card-title"><Heart size={18} /> Biometrics Wristwatch</h2>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div className="watch-display">
              <div className="watch-glow-ring"></div>
              <Activity size={18} className="heart-rate-color" style={{ animation: 'dotFlash 1s infinite' }} />
              <span className="watch-label" style={{ marginTop: '0.25rem' }}>Heart Rate</span>
              <span className="watch-value heart-rate-color">{heartRate}</span>
              <span className="watch-label" style={{ fontSize: '0.55rem' }}>BPM</span>
            </div>
            <div className="watch-display">
              <div className="watch-glow-ring"></div>
              <Zap size={18} className="spo2-color" />
              <span className="watch-label" style={{ marginTop: '0.25rem' }}>Blood Oxygen</span>
              <span className="watch-value spo2-color">{spo2}%</span>
              <span className="watch-label" style={{ fontSize: '0.55rem' }}>SpO₂</span>
            </div>
          </div>

          <div className="watch-grid" style={{ marginTop: '1.5rem' }}>
            <div className="watch-stat-box">
              <Heart size={16} className="heart-rate-color" />
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Heart Rate</div>
                <div className="biometric-slider-container">
                  <div className="biometric-slider-row">
                    <span>40</span>
                    <span>{heartRate} BPM</span>
                    <span>160</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="160"
                    value={heartRate}
                    onChange={(e) => setHeartRate(Number(e.target.value))}
                    className="biometric-input-slider hr-accent"
                  />
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.25rem' }}>
                    <input
                      type="number"
                      min="40"
                      max="160"
                      value={heartRate}
                      onChange={(e) => setHeartRate(Math.min(160, Math.max(40, Number(e.target.value) || 40)))}
                      className="biometric-input-number"
                      style={{ width: '60px' }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="watch-stat-box">
              <Zap size={16} className="spo2-color" />
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>SpO₂</div>
                <div className="biometric-slider-container">
                  <div className="biometric-slider-row">
                    <span>80</span>
                    <span>{spo2}%</span>
                    <span>100</span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="100"
                    value={spo2}
                    onChange={(e) => setSpo2(Number(e.target.value))}
                    className="biometric-input-slider spo2-accent"
                  />
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.25rem' }}>
                    <input
                      type="number"
                      min="80"
                      max="100"
                      value={spo2}
                      onChange={(e) => setSpo2(Math.min(100, Math.max(80, Number(e.target.value) || 80)))}
                      className="biometric-input-number"
                      style={{ width: '60px' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            {heartRate < 50 || heartRate > 120 || spo2 < 90 ? (
              <span style={{ color: '#ef4444' }}>Unsafe range — emergency monitoring active</span>
            ) : (
              <span style={{ color: '#34d399' }}>All biometrics within safe limits</span>
            )}
          </div>
        </div>

        {/* Card 3: Face Analysis */}
        <div className="glass-card">
          <div className="card-header-row">
            <h2 className="card-title"><Eye size={18} /> Face Fatigue Tracker</h2>
          </div>
          {imagePreviewUrl ? (
            <div>
              <div className="image-preview-container">
                <img src={imagePreviewUrl} className="image-preview" alt="Face preview" />
                <div className="image-preview-overlay">
                  <span style={{ fontSize: '0.8rem', textShadow: '0 1px 4px black' }}>{selectedImage.name}</span>
                  <button className="glass-button" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setImagePreviewUrl('')}>
                    Change image
                  </button>
                </div>
              </div>
              {!visionResult && !isAnalyzingImage && (
                <button className="glass-button active" style={{ width: '100%', justifyContent: 'center' }} onClick={analyzeFace}>
                  <Sparkles size={16} /> Analyze biometric fatigue
                </button>
              )}
            </div>
          ) : (
            <label className="upload-zone">
              <Upload size={32} style={{ opacity: 0.5 }} />
              <div>
                <p style={{ fontSize: '0.9rem', fontWeight: 500, margin: '0 0 0.25rem 0' }}>Upload facial photo</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PNG or JPG. Vbud will run node scan analysis.</p>
              </div>
              <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
            </label>
          )}
          {isAnalyzingImage && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <span className="state-indicator-dot" style={{ animationDuration: '0.6s' }}></span>
              <p style={{ fontSize: '0.85rem', color: '#10b981', marginTop: '0.5rem' }}>Vbud scanning fatigue index...</p>
            </div>
          )}
          {visionResult && (
            <div className="vision-results">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Biometric Scan Analysis</span>
                {visionResult.isMock && (
                  <span style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: 'auto' }}>Mock Result</span>
                )}
              </div>
              <div className="results-grid">
                <div className="result-metric-card">
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Fatigue level</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.15rem 0' }}>{visionResult.fatigueScore}%</div>
                  <div className="bar-track">
                    <div
                      className={`bar-fill ${visionResult.fatigueScore > 70 ? 'high-fatigue' : visionResult.fatigueScore > 40 ? 'mid-fatigue' : 'low-fatigue'}`}
                      style={{ width: `${visionResult.fatigueScore}%` }}
                    />
                  </div>
                </div>
                <div className="result-metric-card">
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Inferred Mood</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.3rem', color: '#10b981' }}>{visionResult.mood}</div>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <strong>Vbud Health Recommendations:</strong>
                <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1rem' }}>
                  {visionResult.customTips.map((tip, i) => (
                    <li key={i} style={{ marginBottom: '0.25rem', color: '#e4e4e7' }}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Card 4: Studying Mode */}
        <div className="glass-card">
          <div className="card-header-row">
            <h2 className="card-title"><Moon size={18} /> Studying state controller</h2>
            {!isStudying ? (
              <button className="glass-button active" onClick={startStudying}><Play size={14} /> Start Study Mode</button>
            ) : (
              <button className="glass-button" onClick={stopStudying} style={{ borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)' }}>
                <Square size={14} /> Stop Study Mode
              </button>
            )}
          </div>
          <div className="study-mode-container">
            {isStudying ? (
              <>
                <div className="study-visualizers">
                  <div className="waveform-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      <span>Mic noise feed (Web Audio)</span>
                      <span style={{ color: '#a855f7' }}>Live Waveform</span>
                    </div>
                    <canvas ref={canvasRef} className="waveform-canvas"></canvas>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      <span>Focus scan view (mock)</span>
                      <span style={{ color: '#a855f7' }}>REC {getStudyTimeFormatted()}</span>
                    </div>
                    <div className="camera-preview-mock active">
                      <div className="camera-face-outline pulse"></div>
                      <div className="camera-scanner-line"></div>
                      <div style={{ position: 'absolute', bottom: '0.5rem', left: '0.5rem', fontSize: '0.65rem', color: '#a855f7', fontWeight: 600 }}>
                        FACIAL TRACKING: ACTIVE
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <span className="watch-label">Session timeline log</span>
                  <div className="timeline-tracker" style={{ marginTop: '0.25rem' }}>
                    {timeline.map((evt, i) => (
                      <div className="timeline-event-row" key={i}>
                        <span className="timeline-time">{evt.time}</span>
                        <span className="timeline-msg">{evt.msg}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem 1.5rem', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <Moon size={32} style={{ opacity: 0.25, marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>Studying Mode is currently Inactive</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '300px', margin: '0.25rem auto 0 auto' }}>
                  Toggle Studying Mode to activate audio decibel checks, camera scanning mock, and event recording.
                </p>
              </div>
            )}
            {isGeneratingReport && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <span className="state-indicator-dot" style={{ animationDuration: '0.6s' }}></span>
                <p style={{ fontSize: '0.85rem', color: '#a855f7', marginTop: '0.5rem' }}>Vbud compiling focus timeline metrics...</p>
              </div>
            )}
            {studyReport && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>
                  <FileText size={16} style={{ color: '#a855f7' }} />
                  <span>Study session evaluation report</span>
                </div>
                {renderMarkdown(studyReport)}
              </div>
            )}
          </div>
        </div>

        {/* Emergency Report */}
        {showEmergencyReport && (
          <div className="glass-card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header-row">
              <h2 className="card-title"><AlertCircle size={18} /> Emergency Deactivated – Nearest Hospital & Incident Report</h2>
              <button className="glass-button" onClick={() => setShowEmergencyReport(false)}><X size={14} /> Dismiss</button>
            </div>
            <div className="hospital-card">
              <div className="hospital-map-placeholder">
                <svg className="hospital-map-route" viewBox="0 0 110 85">
                  <path d="M10,70 Q30,20 60,30 Q80,40 90,15" stroke="#10b981" strokeWidth="3" fill="none" />
                  <circle cx="10" cy="70" r="5" fill="#ef4444" />
                  <circle cx="90" cy="15" r="5" fill="#10b981" />
                </svg>
                <div className="hospital-map-marker" style={{ top: '68px', left: '4px', fontSize: '1rem' }}>You</div>
                <div className="hospital-map-marker" style={{ top: '10px', left: '80px', fontSize: '1rem' }}>Hospital</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>City General Hospital</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>123 Health Ave, Downtown</div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', background: 'rgba(16,185,129,0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    3 min away
                  </span>
                  <span style={{ fontSize: '0.7rem', background: 'rgba(16,185,129,0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    +1 (555) 123-4567
                  </span>
                </div>
              </div>
            </div>
            <div className="incident-report-panel">
              <h3 style={{ fontSize: '0.9rem', marginTop: 0, marginBottom: '0.75rem' }}>Incident Summary</h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <p><strong>Time of event:</strong> {new Date().toLocaleString()}</p>
                <p><strong>Heart rate:</strong> {heartRate} BPM ({heartRate < 50 ? 'Bradycardia' : heartRate > 120 ? 'Tachycardia' : 'Normal'})</p>
                <p><strong>Blood oxygen:</strong> {spo2}% ({spo2 < 90 ? 'Hypoxemia' : 'Normal'})</p>
                <p><strong>Action taken:</strong> Emergency alert was deactivated by user at {new Date().toLocaleTimeString()}. Nearest hospital and incident report displayed.</p>
                <p><strong>Vbud recommendation:</strong> Please consult a medical professional if symptoms persist.</p>
                <div style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '6px' }}>
                  <strong>Health tips:</strong>
                  <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1rem' }}>
                    <li>Stay hydrated and rest if feeling unwell.</li>
                    <li>Monitor your heart rate and oxygen levels regularly.</li>
                    <li>Seek immediate medical attention if you experience chest pain or shortness of breath.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={16} /> API Key configuration
              </h2>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1.25rem 0', lineHeight: 1.4 }}>
              Enter your Google Gemini API Key. This will be stored locally in your browser's <code>localStorage</code> to run face vision scan, chat, and session reports.
            </p>
            <div className="form-group">
              <label className="form-label">Gemini API Key</label>
              <input
                type="password"
                className="form-input"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                placeholder="AIzaSy..."
              />
            </div>
            <div className="modal-actions">
              <button className="glass-button" onClick={() => setShowSettings(false)}>Cancel</button>
              <button className="glass-button active" onClick={handleSaveSettings}>Save settings</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;