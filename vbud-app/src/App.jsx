import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
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
  MessageCircle,
  Send,
  Phone,
  Wrench,
  Mic
} from 'lucide-react';
import {
  analyzeFaceImage,
  generateStudyReport,
  getLeakFixInstructions,
  chatWithVbud
} from './GeminiService';

// Initial data – normal range for water pressure (45‑65 PSI)
const INITIAL_WATER = Array(20).fill().map(() => +(48 + Math.random() * 12).toFixed(1));
const INITIAL_GAS = Array(20).fill().map(() => +(0.18 + Math.random() * 0.1).toFixed(2));

function App() {
  // Core states
  const [activeState, setActiveState] = useState('Idle');
  const [previousState, setPreviousState] = useState('Idle');

  // API Key
  const [apiKey, setApiKey] = useState(() => {
    return import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('vbud_gemini_api_key') || '';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);

  // Maintenance phone
  const [maintenancePhone, setMaintenancePhone] = useState(
    localStorage.getItem('vbud_maintenance_phone') || ''
  );
  const [tempPhone, setTempPhone] = useState(maintenancePhone);

  // Pipeline telemetry
  const [waterData, setWaterData] = useState(INITIAL_WATER);
  const [gasData, setGasData] = useState(INITIAL_GAS);
  const [leakDetected, setLeakDetected] = useState(false);
  const [leakAction, setLeakAction] = useState(null); // 'call' | 'fix' | null
  const [leakFixInstructions, setLeakFixInstructions] = useState('');
  const [isFetchingFix, setIsFetchingFix] = useState(false);

  // Biometrics
  const [heartRate, setHeartRate] = useState(72);
  const [spo2, setSpo2] = useState(98);

  // Emergency
  const [emergencyCountdown, setEmergencyCountdown] = useState(60);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [emergencyDispatched, setEmergencyDispatched] = useState(false);
  const [showEmergencyReport, setShowEmergencyReport] = useState(false);
  const [emergencyLog, setEmergencyLog] = useState([]);

  // Chat
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);

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
  const [studyTranscript, setStudyTranscript] = useState('');
  const [isCapturingSpeech, setIsCapturingSpeech] = useState(false);

  // Chart hover
  const [waterHoverVal, setWaterHoverVal] = useState(null);
  const [gasHoverVal, setGasHoverVal] = useState(null);

  // Refs
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);
  const studyTimerIntervalRef = useRef(null);
  const lastNoiseSpikeRef = useRef(0);
  const emergencyIntervalRef = useRef(null);
  const studyRecognitionRef = useRef(null);
  const studyTranscriptRef = useRef('');

  // Theme (all gray)
  const getStateThemeStyles = () => ({ '--state-color': '#6b7280' });

  // --- Telemetry simulation ---
  useEffect(() => {
    const interval = setInterval(() => {
      setWaterData(prev => {
        const base = leakDetected ? 20 : 50;
        const drift = Math.random() * 4 - 2;
        return [...prev.slice(1), +(base + drift).toFixed(1)];
      });
      setGasData(prev => {
        const nextVal = +(0.18 + Math.random() * 0.1).toFixed(2);
        return [...prev.slice(1), nextVal];
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [leakDetected]);

  // Leak detection (automatic if pressure drops below 30)
  useEffect(() => {
    const latest = waterData[waterData.length - 1];
    if (latest < 30 && !leakDetected) {
      setLeakDetected(true);
      setLeakAction(null);
      setLeakFixInstructions('');
      setPreviousState(activeState);
      setActiveState('Alerts');
      setTimeline(prev => [
        ...prev,
        { time: getStudyTimeFormatted(), msg: 'LEAK DETECTED: Water pressure below 30 PSI.' }
      ]);
    }
  }, [waterData, leakDetected, activeState]);

  // --- Biometrics auto‑fluctuation ---
  useEffect(() => {
    if (emergencyActive || emergencyDispatched) return;
    const interval = setInterval(() => {
      setHeartRate(prev => {
        let base = 72;
        if (activeState === 'Studying') base = 78;
        if (activeState === 'Alerts') base = 96;
        if (activeState === 'Analyzing') base = 82;
        return Math.max(60, Math.min(140, base + Math.floor(Math.random() * 5) - 2));
      });
      setSpo2(prev => {
        const drift = Math.random() > 0.85 ? (Math.random() > 0.5 ? 1 : -1) : 0;
        return Math.max(94, Math.min(100, prev + drift));
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [activeState, emergencyActive, emergencyDispatched]);

  // HR samples during study
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

  // Emergency monitoring
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

  const deactivateEmergency = () => {
    if (emergencyIntervalRef.current) clearInterval(emergencyIntervalRef.current);
    setEmergencyActive(false);
    setEmergencyDispatched(false);
    setHeartRate(72);
    setSpo2(98);
    setShowEmergencyReport(true);
    setActiveState('Idle');
    setEmergencyLog(prev => [...prev, { time: new Date().toLocaleTimeString(), action: 'Deactivated by user' }]);
  };

  // --- Leak actions ---
  const simulateLeak = () => {
    // Manually drop water pressure to trigger leak alert
    setWaterData(prev => prev.map(() => +(15 + Math.random() * 5).toFixed(1)));
  };

  const resolveLeak = () => {
    setLeakDetected(false);
    setLeakAction(null);
    setLeakFixInstructions('');
    setActiveState(previousState !== 'Alerts' ? previousState : 'Idle');
    setWaterData(prev => prev.map(() => +(48 + Math.random() * 12).toFixed(1)));
  };

  const handleCallMaintenance = () => {
    setLeakAction('call');
    if (maintenancePhone) {
      alert(`Calling maintenance crew at ${maintenancePhone}...`);
    } else {
      alert('No maintenance phone set. Please configure it in Settings.');
    }
    // Simulate that call has been made – leak resolved
    resolveLeak();
  };

  const handleFixMyself = async () => {
    setLeakAction('fix');
    setIsFetchingFix(true);
    try {
      const instructions = await getLeakFixInstructions(apiKey);
      setLeakFixInstructions(instructions);
    } catch (e) {
      setLeakFixInstructions('Could not fetch instructions. Please try again.');
    } finally {
      setIsFetchingFix(false);
    }
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
        const mock = {
          fatigueScore: 68,
          mood: "Slightly Fatigued",
          customTips: ["Dim your monitor slightly.", "Stand up and stretch.", "Hydrate!"],
          isMock: true
        };
        setVisionResult(mock);
        if (isStudying) {
          const timeStr = getStudyTimeFormatted();
          setTimeline(prev => [...prev, { time: timeStr, msg: `Face Scan: ${mock.mood} (Fatigue: ${mock.fatigueScore}%)` }]);
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
    setStudyTranscript('');
    studyTranscriptRef.current = '';

    studyTimerIntervalRef.current = setInterval(() => {
      setStudyTime(prev => prev + 1);
    }, 1000);

    // Speech recognition for study summarisation
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      studyRecognitionRef.current = recognition;
      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            studyTranscriptRef.current += ' ' + event.results[i][0].transcript;
            setStudyTranscript(studyTranscriptRef.current.trim());
          }
        }
      };
      recognition.onerror = (e) => console.warn('Study speech error:', e.error);
      try {
        recognition.start();
        setIsCapturingSpeech(true);
      } catch (e) { }
    }

    // Audio waveform visual
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

    if (studyRecognitionRef.current) {
      try { studyRecognitionRef.current.stop(); } catch (e) { }
      studyRecognitionRef.current = null;
      setIsCapturingSpeech(false);
    }

    setPreviousState(activeState);
    setActiveState('Analyzing');
    setIsGeneratingReport(true);

    const compiledTimeline = [
      ...timeline,
      { time: getStudyTimeFormatted(), msg: `Session finished. Duration: ${getStudyTimeFormatted()}.` }
    ];
    setTimeline(compiledTimeline);

    const avgHR = hrSamples.length ? Math.round(hrSamples.reduce((a, b) => a + b, 0) / hrSamples.length) : 77;
    const transcriptText = studyTranscriptRef.current.trim();

    try {
      if (!apiKey) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const mock = `**Study Summary**
- Duration: ${getStudyTimeFormatted()}
- Avg HR: ${avgHR} BPM
- Topics covered: (mock) React state management, CSS animations.
- Tip: Take regular breaks.`;
        setStudyReport(mock);
      } else {
        const report = await generateStudyReport(apiKey, compiledTimeline, avgHR, transcriptText);
        setStudyReport(report);
      }
    } catch (error) {
      console.error(error);
      setStudyReport(`Error generating report: ${error.message}`);
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

  // Waveform (real & synthetic)
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

      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // RMS for noise spikes
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / bufferLength);
      const db = Math.round(rms * 100);
      if (db > 22) recordNoiseSpike(db);
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

      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const points = 80;
      const sliceWidth = canvas.width / points;

      for (let i = 0; i < points; i++) {
        const x = i * sliceWidth;
        const amplitude = 20 * Math.sin(i * 0.05 + phase * 0.5);
        const y = (canvas.height / 2) + Math.sin(i * 0.15 + phase) * amplitude * Math.sin(i * 0.03);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
    };
    draw();
  };

  // --- Chat ---
  const handleChatSubmit = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);

    try {
      const context = {
        waterPressure: waterData[waterData.length - 1],
        gasFlow: gasData[gasData.length - 1],
        leakDetected,
        heartRate,
        spo2,
        studyActive: isStudying,
        studyTime: getStudyTimeFormatted(),
      };
      const reply = await chatWithVbud(apiKey, userMsg, context);
      setChatMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, I encountered an error.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSaveSettings = () => {
    setApiKey(tempKey);
    localStorage.setItem('vbud_gemini_api_key', tempKey);
    setMaintenancePhone(tempPhone);
    localStorage.setItem('vbud_maintenance_phone', tempPhone);
    setShowSettings(false);
  };

  // --- SVG Line Chart ---
  const renderSVGLineChart = (data, minVal, maxVal, strokeColor, type) => {
    const W = 360, H = 100, pad = 10;
    const count = data.length;
    const yMin = Math.min(...data) - 0.2, yMax = Math.max(...data) + 0.2;

    const points = data.map((val, idx) => ({
      x: pad + (idx / (count - 1)) * (W - 2 * pad),
      y: H - pad - ((val - yMin) / (yMax - yMin)) * (H - 2 * pad),
      val
    }));

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) pathD += ` L ${points[i].x} ${points[i].y}`;
    const fillD = `${pathD} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`;

    const hoverHandler = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      let closest = points[0];
      let minDist = Math.abs(points[0].x - (mouseX * (W / rect.width)));
      for (let i = 1; i < points.length; i++) {
        const dist = Math.abs(points[i].x - (mouseX * (W / rect.width)));
        if (dist < minDist) { minDist = dist; closest = points[i]; }
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
          <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#333" strokeDasharray="3,3" />
          <path d={fillD} fill={`${strokeColor}10`} />
          <path d={pathD} stroke={strokeColor} strokeWidth="2" fill="none" strokeLinecap="round" />
          {activeHover && (
            <>
              <line x1={activeHover.x} y1="0" x2={activeHover.x} y2={H} stroke="#555" strokeDasharray="2,2" />
              <circle cx={activeHover.x} cy={activeHover.y} r="4" fill={strokeColor} />
            </>
          )}
        </svg>
        {activeHover && (
          <div className="chart-tooltip" style={{ left: `${(activeHover.x / W) * 100}%`, top: `${(activeHover.y / H) * 100 - 30}%` }}>
            {activeHover.val} {type === 'water' ? 'PSI' : 'm³/h'}
          </div>
        )}
      </div>
    );
  };

  // Simple markdown renderer
  const renderMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    const elements = [];
    let inList = false, listItems = [];

    const renderInline = (t) =>
      t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>');

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (line.startsWith('```')) continue;
      if (line.startsWith('# ')) { elements.push(<h2 key={i} style={{ color: '#9ca3af' }} dangerouslySetInnerHTML={{ __html: line.slice(2) }} />); continue; }
      if (line.startsWith('## ')) { elements.push(<h3 key={i} style={{ color: '#9ca3af' }} dangerouslySetInnerHTML={{ __html: line.slice(3) }} />); continue; }
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        inList = true;
        listItems.push(renderInline(line.trim().slice(2)));
        continue;
      }
      if (inList && !line.trim().startsWith('-') && !line.trim().startsWith('*')) {
        elements.push(<ul key={`ul-${i}`}>{listItems.map((item, idx) => <li key={idx} dangerouslySetInnerHTML={{ __html: item }} />)}</ul>);
        listItems = [];
        inList = false;
      }
      if (line.trim() === '') continue;
      elements.push(<p key={i} dangerouslySetInnerHTML={{ __html: renderInline(line) }} />);
    }
    if (inList) elements.push(<ul key="last">{listItems.map((item, idx) => <li key={idx} dangerouslySetInnerHTML={{ __html: item }} />)}</ul>);
    return <div>{elements}</div>;
  };

  // --- Render ---
  return (
    <div style={getStateThemeStyles()}>
      {/* Header */}
      <header className="dashboard-header">
        <div className="brand-section">
          <h1>Vbud <span className="brand-accent">Cockpit</span></h1>
        </div>
        <div className="header-actions">
          {apiKey ? (
            <span className="state-badge"><CheckCircle size={12} color="#9ca3af" /> Connected</span>
          ) : (
            <span className="state-badge">Demo Mode</span>
          )}
          <button className="glass-button" onClick={() => { setTempKey(apiKey); setTempPhone(maintenancePhone); setShowSettings(true); }}>
            <Settings size={16} /> Settings
          </button>
        </div>
      </header>

      {/* Orb – opens chat */}
      <div className="orb-container" onClick={() => setShowChat(!showChat)}>
        <div className="avatar-orb">
          <div className="orb-inner">
            <MessageCircle size={32} color="#9ca3af" />
          </div>
        </div>
        <div className="state-badge">
          <span className="state-indicator-dot"></span>
          Vbud State: {activeState}
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="chat-panel">
          <div className="chat-header">
            <span>Vbud Assistant</span>
            <button onClick={() => setShowChat(false)}><X size={16} /></button>
          </div>
          <div className="chat-messages">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role}`}>
                {msg.text}
              </div>
            ))}
            {isChatLoading && <div className="chat-bubble assistant">Typing...</div>}
            <div ref={chatEndRef} />
          </div>
          <form className="chat-input-row" onSubmit={handleChatSubmit}>
            <input
              type="text"
              placeholder="Ask about your data..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isChatLoading}
            />
            <button type="submit" disabled={isChatLoading}><Send size={16} /></button>
          </form>
        </div>
      )}

      {/* Leak Alert Banner */}
      {leakDetected && (
        <div className="alert-banner">
          <div className="alert-content">
            <AlertTriangle size={24} color="#f59e0b" />
            <div>
              <strong style={{ color: '#f59e0b' }}>LEAK DETECTED:</strong> Water pressure below 30 PSI.
              {leakAction === null && (
                <div className="alert-actions">
                  <button className="glass-button" onClick={handleCallMaintenance}>
                    <Phone size={14} /> Call Maintenance
                  </button>
                  <button className="glass-button" onClick={handleFixMyself}>
                    <Wrench size={14} /> Fix it Myself
                  </button>
                </div>
              )}
              {isFetchingFix && <p>Fetching fix instructions...</p>}
              {leakAction === 'fix' && leakFixInstructions && (
                <div className="leak-fix-panel">
                  <strong style={{ color: '#9ca3af' }}>Fix Guide:</strong>
                  <div dangerouslySetInnerHTML={{ __html: leakFixInstructions.replace(/\n/g, '<br/>') }} />
                  <button className="glass-button" onClick={resolveLeak} style={{ marginTop: '0.5rem' }}>Mark as Fixed</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Emergency Modals */}
      {emergencyActive && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ borderColor: '#ef4444' }}>
            <div className="emergency-icon"><AlertCircle size={40} color="#ef4444" /></div>
            <h2 style={{ color: '#ef4444' }}>Emergency Alert</h2>
            <p>Unsafe biometrics detected!</p>
            <div className="countdown-number">{emergencyCountdown}</div>
            <p>seconds until dispatch</p>
            <button className="glass-button" onClick={deactivateEmergency} style={{ borderColor: '#10b981', color: '#10b981' }}>Deactivate Alert</button>
          </div>
        </div>
      )}
      {emergencyDispatched && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ borderColor: '#ef4444' }}>
            <h2 style={{ color: '#ef4444' }}>Emergency Dispatched</h2>
            <p>Help is on the way.</p>
            <button className="glass-button" onClick={() => setEmergencyDispatched(false)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="cockpit-grid">
        {/* Card 1: Pipeline Monitor */}
        <div className="glass-card">
          <div className="card-header-row">
            <h2 className="card-title">Pipeline Monitor</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {!leakDetected && (
                <button className="glass-button" onClick={simulateLeak} style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
                  Simulate Leak
                </button>
              )}
              {leakDetected && (
                <button className="glass-button" onClick={resolveLeak}>Resolve</button>
              )}
            </div>
          </div>
          <div className="telemetry-grid">
            <div className="telemetry-stat-card">
              <span className="watch-label">Water Pressure</span>
              <div className="watch-value">{waterData[waterData.length - 1]} PSI</div>
            </div>
            <div className="telemetry-stat-card">
              <span className="watch-label">Gas Flow</span>
              <div className="watch-value">{gasData[gasData.length - 1]} m³/h</div>
            </div>
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#9ca3af' }}>
              <span>Water Pressure Timeline</span>
              <span>Latest: {waterData[waterData.length - 1]} PSI</span>
            </div>
            {renderSVGLineChart(waterData, 25, 70, '#6b7280', 'water')}
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#9ca3af' }}>
              <span>Gas Flow Timeline</span>
              <span>Latest: {gasData[gasData.length - 1]} m³/h</span>
            </div>
            {renderSVGLineChart(gasData, 0.1, 0.5, '#4b5563', 'gas')}
          </div>
        </div>

        {/* Card 2: Biometrics */}
        <div className="glass-card">
          <div className="card-header-row">
            <h2 className="card-title"><Heart size={18} /> Biometrics</h2>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <div className="watch-display">
              <Activity size={18} style={{ color: '#ef4444' }} />
              <span className="watch-label">Heart Rate</span>
              <span className="watch-value" style={{ color: '#ef4444' }}>{heartRate}</span>
              <span className="watch-unit">BPM</span>
            </div>
            <div className="watch-display">
              <Zap size={18} style={{ color: '#38bdf8' }} />
              <span className="watch-label">Blood Oxygen</span>
              <span className="watch-value" style={{ color: '#38bdf8' }}>{spo2}%</span>
              <span className="watch-unit">SpO₂</span>
            </div>
          </div>
          <div className="watch-grid" style={{ marginTop: '1.5rem' }}>
            <div className="watch-stat-box">
              <Heart size={16} style={{ color: '#ef4444' }} />
              <div>
                <div className="watch-label">Heart Rate</div>
                <div className="biometric-slider-container">
                  <div className="biometric-slider-row">
                    <span>40</span>
                    <span>{heartRate} BPM</span>
                    <span>160</span>
                  </div>
                  <input type="range" min="40" max="160" value={heartRate} onChange={(e) => setHeartRate(Number(e.target.value))} className="biometric-input-slider" style={{ accentColor: '#ef4444' }} />
                  <input type="number" min="40" max="160" value={heartRate} onChange={(e) => setHeartRate(Math.min(160, Math.max(40, Number(e.target.value) || 40)))} className="biometric-input-number" />
                </div>
              </div>
            </div>
            <div className="watch-stat-box">
              <Zap size={16} style={{ color: '#38bdf8' }} />
              <div>
                <div className="watch-label">SpO₂</div>
                <div className="biometric-slider-container">
                  <div className="biometric-slider-row">
                    <span>80</span>
                    <span>{spo2}%</span>
                    <span>100</span>
                  </div>
                  <input type="range" min="80" max="100" value={spo2} onChange={(e) => setSpo2(Number(e.target.value))} className="biometric-input-slider" style={{ accentColor: '#38bdf8' }} />
                  <input type="number" min="80" max="100" value={spo2} onChange={(e) => setSpo2(Math.min(100, Math.max(80, Number(e.target.value) || 80)))} className="biometric-input-number" />
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', textAlign: 'center' }}>
            {heartRate < 50 || heartRate > 120 || spo2 < 90 ? (
              <span style={{ color: '#ef4444' }}>Unsafe range — emergency monitoring active</span>
            ) : (
              <span style={{ color: '#10b981' }}>All biometrics within safe limits</span>
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
                  <span>{selectedImage.name}</span>
                  <button className="glass-button" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setImagePreviewUrl('')}>Change</button>
                </div>
              </div>
              {!visionResult && !isAnalyzingImage && (
                <button className="glass-button active" style={{ width: '100%', justifyContent: 'center' }} onClick={analyzeFace}>
                  <Sparkles size={16} /> Analyze Fatigue
                </button>
              )}
            </div>
          ) : (
            <label className="upload-zone">
              <Upload size={32} style={{ opacity: 0.5 }} />
              <div>
                <p style={{ fontSize: '0.9rem', fontWeight: 500, margin: '0 0 0.25rem' }}>Upload facial photo</p>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>PNG or JPG. Vbud will analyze fatigue.</p>
              </div>
              <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
            </label>
          )}
          {isAnalyzingImage && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <span className="state-indicator-dot"></span>
              <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '0.5rem' }}>Scanning fatigue index...</p>
            </div>
          )}
          {visionResult && (
            <div className="vision-results">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600 }}>Biometric Scan Analysis</span>
                {visionResult.isMock && <span style={{ fontSize: '0.65rem', color: '#f59e0b' }}>Mock Result</span>}
              </div>
              <div className="results-grid">
                <div className="result-metric-card">
                  <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>Fatigue Level</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{visionResult.fatigueScore}%</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${visionResult.fatigueScore}%`, backgroundColor: visionResult.fatigueScore > 70 ? '#ef4444' : visionResult.fatigueScore > 40 ? '#f59e0b' : '#10b981' }} />
                  </div>
                </div>
                <div className="result-metric-card">
                  <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>Inferred Mood</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>{visionResult.mood}</div>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                <strong>Recommendations:</strong>
                <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1rem' }}>
                  {visionResult.customTips.map((tip, i) => <li key={i} style={{ color: '#e4e4e7' }}>{tip}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Card 4: Study Mode */}
        <div className="glass-card">
          <div className="card-header-row">
            <h2 className="card-title"><Moon size={18} /> Study Mode</h2>
            {!isStudying ? (
              <button className="glass-button active" onClick={startStudying}><Play size={14} /> Start Study</button>
            ) : (
              <button className="glass-button" onClick={stopStudying} style={{ color: '#ef4444' }}><Square size={14} /> Stop Study</button>
            )}
          </div>
          {isStudying ? (
            <>
              <div className="study-live-transcript">
                <span className="watch-label">Live Transcript</span>
                <div className="transcript-box">
                  {isCapturingSpeech ? (studyTranscript || 'Listening...') : 'Speech recognition not supported'}
                </div>
              </div>
              <div className="study-visualizers">
                <div className="waveform-container">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                    <span>Microphone Feed</span>
                    <span style={{ color: '#6b7280' }}>REC {getStudyTimeFormatted()}</span>
                  </div>
                  <canvas ref={canvasRef} className="waveform-canvas"></canvas>
                </div>
                <div className="camera-preview-mock">
                  <div className="camera-face-outline"></div>
                  <div className="camera-scanner-line"></div>
                </div>
              </div>
              <div className="timeline-tracker">
                <span className="watch-label">Session Timeline</span>
                {timeline.map((evt, i) => (
                  <div key={i} className="timeline-event-row">
                    <span className="timeline-time">{evt.time}</span>
                    <span className="timeline-msg">{evt.msg}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1.5rem', background: '#111', borderRadius: '12px', border: '1px solid #2a2a2a' }}>
              <Moon size={32} style={{ opacity: 0.25, marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>Studying Mode Inactive</p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Start to record audio, speech, and generate a summary.</p>
            </div>
          )}
          {isGeneratingReport && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <span className="state-indicator-dot"></span>
              <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '0.5rem' }}>Compiling study report...</p>
            </div>
          )}
          {studyReport && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontWeight: 600 }}>
                <FileText size={16} style={{ color: '#6b7280' }} />
                <span>Study Session Report</span>
              </div>
              {renderMarkdown(studyReport)}
            </div>
          )}
        </div>

        {/* Emergency Report */}
        {showEmergencyReport && (
          <div className="glass-card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header-row">
              <h2 className="card-title"><AlertCircle size={18} /> Emergency Deactivated – Nearest Hospital</h2>
              <button className="glass-button" onClick={() => setShowEmergencyReport(false)}><X size={14} /> Dismiss</button>
            </div>
            <div className="hospital-card">
              <div className="hospital-map-placeholder">
                <svg viewBox="0 0 110 85" className="hospital-map-route">
                  <path d="M10,70 Q30,20 60,30 Q80,40 90,15" stroke="#10b981" strokeWidth="3" fill="none" />
                  <circle cx="10" cy="70" r="5" fill="#ef4444" />
                  <circle cx="90" cy="15" r="5" fill="#10b981" />
                </svg>
                <div style={{ position: 'absolute', top: '68px', left: '4px', fontSize: '0.7rem', color: '#ef4444' }}>You</div>
                <div style={{ position: 'absolute', top: '10px', left: '80px', fontSize: '0.7rem', color: '#10b981' }}>Hospital</div>
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>City General Hospital</div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>123 Health Ave, Downtown</div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', background: '#1e293b', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>3 min away</span>
                  <span style={{ fontSize: '0.7rem', background: '#1e293b', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>+1 (555) 123-4567</span>
                </div>
              </div>
            </div>
            <div className="incident-report-panel">
              <h3 style={{ fontSize: '0.9rem', marginTop: 0 }}>Incident Summary</h3>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                <p><strong>Time:</strong> {new Date().toLocaleString()}</p>
                <p><strong>Heart rate:</strong> {heartRate} BPM</p>
                <p><strong>Blood oxygen:</strong> {spo2}%</p>
                <p><strong>Action:</strong> Alert deactivated.</p>
                <p><strong>Recommendation:</strong> Seek medical help if symptoms persist.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Settings</h2>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="form-group">
              <label>Gemini API Key</label>
              <input
                type="password"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                placeholder="AIzaSy..."
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Maintenance Crew Phone</label>
              <input
                type="tel"
                value={tempPhone}
                onChange={(e) => setTempPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                className="form-input"
              />
            </div>
            <div className="modal-actions">
              <button className="glass-button" onClick={() => setShowSettings(false)}>Cancel</button>
              <button className="glass-button active" onClick={handleSaveSettings}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;