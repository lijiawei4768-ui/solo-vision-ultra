import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────────────────────────
// MUSIC THEORY ENGINE
// ─────────────────────────────────────────────────────────────
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const INTERVAL_LABELS = ["R","b2","2","b3","3","4","b5","5","b6","6","b7","7"];
const STD_TUNING = [40, 45, 50, 55, 59, 64];
const TUNINGS = {
  "Standard (EADGBe)": [40,45,50,55,59,64],
  "Drop D (DADGBe)":   [38,45,50,55,59,64],
  "Open G (DGDGBd)":   [38,43,50,55,59,62],
  "DADGAD":            [38,45,50,55,57,62],
  "Half Step Down (Eb)":[39,44,49,54,58,63],
};

function getMidi(strIdx, fret, tuning = STD_TUNING) { return tuning[strIdx] + fret; }
function midiToNote(midi) { return NOTE_NAMES[midi % 12]; }
function freqToMidi(freq) { if (freq <= 0) return -1; return Math.round(69 + 12 * Math.log2(freq / 440)); }
function noteNameToChroma(name) {
  const base = NOTE_NAMES.indexOf(name);
  if (base >= 0) return base;
  return ({"Db":1,"Eb":3,"Gb":6,"Ab":8,"Bb":10})[name] ?? -1;
}
function findNotePositions(noteName, tuning = STD_TUNING, minFret = 0, maxFret = 15) {
  const pos = [];
  for (let s = 0; s < 6; s++)
    for (let f = minFret; f <= maxFret; f++)
      if (midiToNote(getMidi(s, f, tuning)) === noteName) pos.push({ string: s, fret: f });
  return pos;
}
function voiceLeadChordTone(prevMidi, rootName, chordIntervals) {
  const rootChroma = noteNameToChroma(rootName);
  const candidates = [];
  for (let oct = 2; oct <= 6; oct++)
    for (const iv of chordIntervals)
      candidates.push((oct + 1) * 12 + ((rootChroma + iv) % 12));
  return candidates.reduce((best, m) =>
    Math.abs(m - prevMidi) < Math.abs(best - prevMidi) ? m : best, candidates[0]);
}
function haptic(type = "correct") {
  if (!navigator.vibrate) return;
  type === "correct" ? navigator.vibrate([30]) : navigator.vibrate([15, 30, 15]);
}

// ─────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────
const CHORD_INTERVALS = {
  "Maj7":[0,4,7,11],"maj7":[0,4,7,11],"m7":[0,3,7,10],"7":[0,4,7,10],
  "m7b5":[0,3,6,10],"dim7":[0,3,6,9],"Maj6":[0,4,7,9],"6":[0,4,7,9],
  "m6":[0,3,7,9],"sus4":[0,5,7],"7sus4":[0,5,7,10],"aug":[0,4,8],"m":[0,3,7],"m9":[0,3,7,10,14],"":[0,4,7],
};
const SCALES = {
  "Major / Ionian":[0,2,4,5,7,9,11],
  "Natural Minor / Aeolian":[0,2,3,5,7,8,10],
  "Dorian":[0,2,3,5,7,9,10],
  "Phrygian":[0,1,3,5,7,8,10],
  "Lydian":[0,2,4,6,7,9,11],
  "Mixolydian":[0,2,4,5,7,9,10],
  "Locrian":[0,1,3,5,6,8,10],
  "Melodic Minor":[0,2,3,5,7,9,11],
  "Harmonic Minor":[0,2,3,5,7,8,11],
  "Harmonic Major":[0,2,4,5,7,8,11],
  "Lydian Dominant":[0,2,4,6,7,9,10],
  "Altered / Super Locrian":[0,1,3,4,6,8,10],
  "Whole Tone":[0,2,4,6,8,10],
  "Diminished (HW)":[0,1,3,4,6,7,9,10],
  "Diminished (WH)":[0,2,3,5,6,8,9,11],
  "Pentatonic Major":[0,2,4,7,9],
  "Pentatonic Minor":[0,3,5,7,10],
  "Blues Major":[0,2,3,4,7,9],
  "Blues Minor":[0,3,5,6,7,10],
  "Bebop Dominant":[0,2,4,5,7,9,10,11],
  "Spanish Phrygian":[0,1,4,5,7,8,10],
  "Hungarian Minor":[0,2,3,6,7,8,11],
};
const JAZZ_STANDARDS = [
  { name:"Autumn Leaves", key:"Gm",
    changes:["Cm7","F7","BbMaj7","EbMaj7","Am7b5","D7","Gm","Gm","Am7b5","D7","Gm","Gm","Cm7","F7","BbMaj7","EbMaj7","Am7b5","D7","Gm","Gm"] },
  { name:"All The Things You Are", key:"Ab",
    changes:["Fm7","Bbm7","Eb7","AbMaj7","DbMaj7","Dm7","G7","CMaj7","Cm7","Fm7","Bb7","EbMaj7","AbMaj7","Am7b5","D7","GMaj7","Am7","D7","GMaj7","F#m7b5","B7","EMaj7","Bbm7","Eb7","AbMaj7","DbMaj7","Dm7","G7","CMaj7","Cm7","Fm7","Bb7","EbMaj7","Am7b5","D7","GMaj7","Fm7","Bb7","EbMaj7"] },
  { name:"There Will Never Be Another You", key:"Eb",
    changes:["EbMaj7","Bbm7","Eb7","AbMaj7","Ab6","Abm7","Db7","EbMaj7","Fm7","Bb7","Gm7","C7","Fm7","Bb7","EbMaj7","Bb7"] },
  { name:"Solar", key:"Cm",
    changes:["Cm","Cm","Gm7","C7","FMaj7","FMaj7","Fm7","Bb7","EbMaj7","EbMaj7","Am7b5","D7","Gm7","G7"] },
  { name:"Stella By Starlight", key:"Bb",
    changes:["Em7b5","A7","Cm7","F7","Fm7","Bb7","EbMaj7","EbMaj7","Am7b5","D7","GMaj7","GMaj7","Bbm7","Eb7","AbMaj7","AbMaj7","Am7b5","D7","GMaj7","Gm7","C7","FMaj7","FMaj7","Fm7","Bb7","EbMaj7","EbMaj7","Dm7b5","G7","Cm","Cm","Am7b5","D7","BbMaj7","BbMaj7"] },
  { name:"Misty", key:"Eb",
    changes:["EbMaj7","Bbm7","Eb7","AbMaj7","Abm7","Db7","EbMaj7","Cm7","Fm7","Bb7","EbMaj7","Ab7","Gm7","C7","Fm7","Bb7","EbMaj7","Gm7","C7","Fm7","Bb7","Gm7","C7","Fm7","Bb7"] },
  { name:"Nardis", key:"Em",
    changes:["Em7","A7","FMaj7","BbMaj7","Em7","Am7","B7","Em7"] },
  { name:"Have You Met Miss Jones", key:"F",
    changes:["FMaj7","Dm7","Gm7","C7","FMaj7","Db7","Gm7","C7","FMaj7","Dm7","Gm7","C7","FMaj7","Fm7","Bb7","BbMaj7","BbMaj7","AbMaj7","AbMaj7","GbMaj7","GbMaj7","Em7","A7","Gm7","C7","FMaj7","Dm7","Gm7","C7","FMaj7"] },
  { name:"Summertime", key:"Am",
    changes:["Am","E7","Am","Am","Dm","Am","E7","E7","Am","F7","E7","E7","Am","E7","Am","Am","Dm","Am","Am","E7","Am","Am"] },
  { name:"Softly As In A Morning Sunrise", key:"Cm",
    changes:["Cm","Cm","Dm7b5","G7","Cm","Cm","Dm7b5","G7","Fm","Fm","Dm7b5","G7","Cm","Cm","Dm7b5","G7"] },
];

// ─────────────────────────────────────────────────────────────
// YIN PITCH DETECTION
// ─────────────────────────────────────────────────────────────
function yinDetect(buffer, sampleRate, threshold = 0.12) {
  const half = Math.floor(buffer.length / 2);
  const d = new Float32Array(half);
  d[0] = 1;
  let runSum = 0;
  for (let tau = 1; tau < half; tau++) {
    let s = 0;
    for (let i = 0; i < half; i++) { const diff = buffer[i] - buffer[i + tau]; s += diff * diff; }
    runSum += s;
    d[tau] = runSum > 0 ? (s * tau) / runSum : 0;
  }
  for (let tau = 2; tau < half - 1; tau++) {
    if (d[tau] < threshold && d[tau] <= d[tau-1] && d[tau] <= d[tau+1]) {
      const better = tau + (d[tau+1] - d[tau-1]) / (2 * (2*d[tau] - d[tau-1] - d[tau+1]));
      return sampleRate / better;
    }
  }
  return -1;
}
function computeRMS(buffer) {
  let s = 0; for (const v of buffer) s += v * v; return Math.sqrt(s / buffer.length);
}

// ─────────────────────────────────────────────────────────────
// FRETBOARD SVG — upgraded with framer-motion animations
// ─────────────────────────────────────────────────────────────
const FRET_MARKERS = [3,5,7,9,12];
const DOUBLE_MARKERS = [12];

function Fretboard({ tuning=STD_TUNING, highlights=[], arcPair=null, leftHanded=false, minFret=0, maxFret=15 }) {
  // Responsive: we use a fixed coordinate space and let the SVG scale via viewBox
  const VW = 720, VH = 175;
  const PAD_L=38, PAD_R=18, PAD_T=20, PAD_B=22;
  const drawW = VW - PAD_L - PAD_R;
  const drawH = VH - PAD_T - PAD_B;
  const span = Math.max(1, maxFret - minFret);
  const fretW = drawW / span;
  const strSpacing = drawH / 5;

  function sx(fret) {
    const f = leftHanded ? (maxFret - fret + minFret) : (fret - minFret);
    return PAD_L + f * fretW;
  }
  function sy(strIdx) { return PAD_T + (5 - strIdx) * strSpacing; }

  const noteR = Math.min(strSpacing, fretW) * 0.37;

  // Build arc path string for motion
  const arcPath = arcPair ? (() => {
    const x1 = sx(arcPair.from.fret) - fretW/2;
    const y1 = sy(arcPair.from.string);
    const x2 = sx(arcPair.to.fret) - fretW/2;
    const y2 = sy(arcPair.to.string);
    const cpx = (x1+x2)/2;
    const cpy = Math.min(y1,y2) - Math.abs(y2-y1)*0.5 - 18;
    return `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`;
  })() : null;
  const arcKey = arcPair ? `${arcPair.from.string}-${arcPair.from.fret}-${arcPair.to.string}-${arcPair.to.fret}` : "none";

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width="100%" height="auto"
      style={{ fontFamily: "-apple-system,sans-serif", display:"block" }}
      className="select-none"
    >
      <defs>
        <radialGradient id="grd-root" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#FFB347"/>
          <stop offset="60%" stopColor="#FF7043"/>
          <stop offset="100%" stopColor="#D84315"/>
        </radialGradient>
        <radialGradient id="grd-target" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#B3E5FC"/>
          <stop offset="60%" stopColor="#29B6F6"/>
          <stop offset="100%" stopColor="#0277BD"/>
        </radialGradient>
        <filter id="gw-root" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="gw-target" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="arc-g" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FF7043" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="#29B6F6" stopOpacity="0.8"/>
        </linearGradient>
      </defs>

      {/* Nut */}
      {minFret === 0 && <rect x={PAD_L-1} y={PAD_T-3} width={3} height={drawH+6} fill="#AAAAAA" rx={1}/>}

      {/* Fret lines */}
      {Array.from({length:span+1},(_,i)=>i+minFret).map(f=>(
        <line key={f} x1={sx(f)} y1={PAD_T-3} x2={sx(f)} y2={PAD_T+drawH+3} stroke="#D0D0D0" strokeWidth={0.5}/>
      ))}

      {/* Fret markers */}
      {FRET_MARKERS.filter(m=>m>=minFret&&m<=maxFret).map(m=>(
        DOUBLE_MARKERS.includes(m) ? (
          <g key={m}>
            <circle cx={sx(m)-fretW/2} cy={PAD_T+drawH/2-9} r={3.5} fill="#D4D4D4" opacity={0.7}/>
            <circle cx={sx(m)-fretW/2} cy={PAD_T+drawH/2+9} r={3.5} fill="#D4D4D4" opacity={0.7}/>
          </g>
        ):(
          <circle key={m} cx={sx(m)-fretW/2} cy={PAD_T+drawH/2} r={3.5} fill="#D4D4D4" opacity={0.7}/>
        )
      ))}

      {/* Fret numbers */}
      {[0,3,5,7,9,12,15].filter(f=>f>=minFret&&f<=maxFret).map(f=>(
        <text key={f} x={sx(f)-fretW/2} y={VH-4} textAnchor="middle" fontSize={9} fill="#BBBBBB" fontWeight={300}>{f}</text>
      ))}

      {/* Strings */}
      {[0,1,2,3,4,5].map(s=>(
        <line key={s} x1={PAD_L-2} y1={sy(s)} x2={VW-PAD_R+2} y2={sy(s)} stroke="#D0D0D0" strokeWidth={0.4+s*0.12}/>
      ))}

      {/* String names */}
      {["E","A","D","G","B","e"].map((nm,i)=>(
        <text key={i} x={PAD_L-11} y={sy(i)+4} textAnchor="middle" fontSize={9} fill="#C0C0C0" fontWeight={300}>{nm}</text>
      ))}

      {/* Animated arc */}
      <AnimatePresence>
        {arcPath && (
          <motion.path
            key={arcKey}
            d={arcPath}
            fill="none"
            stroke="url(#arc-g)"
            strokeWidth={1.5}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.9 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            style={{ filter: "drop-shadow(0 0 4px rgba(255,112,67,0.4))" }}
          />
        )}
      </AnimatePresence>

      {/* Note jewels */}
      <AnimatePresence>
        {highlights.map(({ string:s, fret:f, role, label }, idx) => {
          const cx = sx(f) - fretW/2;
          const cy = sy(s);
          const isRoot = role === "root";
          const jKey = `${role}-${s}-${f}`;
          return (
            <motion.g
              key={jKey}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type:"spring", stiffness:460, damping:22, delay: isRoot ? 0 : 0.08 }}
              style={{ originX: cx, originY: cy }}
            >
              {/* Glow halo */}
              <circle cx={cx} cy={cy} r={noteR+5}
                fill={isRoot ? "rgba(255,112,67,0.15)" : "rgba(41,182,246,0.12)"}/>
              {/* Main jewel */}
              <circle cx={cx} cy={cy} r={noteR}
                fill={isRoot ? "url(#grd-root)" : "url(#grd-target)"}
                filter={isRoot ? "url(#gw-root)" : "url(#gw-target)"}/>
              {/* Specular */}
              <circle cx={cx-noteR*0.27} cy={cy-noteR*0.27} r={noteR*0.26} fill="rgba(255,255,255,0.55)"/>
              {/* Label */}
              {label && (
                <text x={cx} y={cy+4} textAnchor="middle"
                  fontSize={noteR>10?9.5:8} fontWeight={700} fill="white"
                  style={{textShadow:"0 1px 3px rgba(0,0,0,0.35)"}}>
                  {label}
                </text>
              )}
            </motion.g>
          );
        })}
      </AnimatePresence>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// AUDIO ENGINE HOOK
// ─────────────────────────────────────────────────────────────
function useAudioEngine({ onPitchDetected, enabled = false }) {
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const rafRef = useRef(null);
  const bufferRef = useRef(null);
  const [rms, setRms] = useState(0);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);

  const start = useCallback(async () => {
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext||window.webkitAudioContext)();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      sourceRef.current = ctx.createMediaStreamSource(stream);
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 2048;
      sourceRef.current.connect(analyserRef.current);
      bufferRef.current = new Float32Array(analyserRef.current.fftSize);
      setListening(true); setError(null);
    } catch(e) { setError(e.message); }
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current.mediaStream?.getTracks().forEach(t => t.stop());
    }
    setListening(false); setRms(0);
  }, []);

  useEffect(() => {
    if (!listening || !analyserRef.current) return;
    let active = true;
    const loop = () => {
      if (!active) return;
      analyserRef.current.getFloatTimeDomainData(bufferRef.current);
      const r = computeRMS(bufferRef.current);
      setRms(r);
      if (r > 0.015) {
        const freq = yinDetect(bufferRef.current, ctxRef.current.sampleRate);
        if (freq > 60 && freq < 1400) onPitchDetected?.(freq, r);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { active = false; cancelAnimationFrame(rafRef.current); };
  }, [listening, onPitchDetected]);

  useEffect(() => { if (enabled) start(); else stop(); return stop; }, [enabled]);
  return { rms, listening, error, start, stop };
}

// ─────────────────────────────────────────────────────────────
// GLASS UI PRIMITIVES
// ─────────────────────────────────────────────────────────────
function GlassModal({ open, onClose, title, children, width = "max-w-md" }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
          initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
          style={{ background:"rgba(0,0,0,0.28)" }}
        >
          <motion.div
            className={`w-full ${width} mx-4 mb-4 sm:mb-0 rounded-3xl overflow-hidden`}
            initial={{ y:60, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:60, opacity:0 }}
            transition={{ type:"spring", stiffness:380, damping:32 }}
            style={{
              background:"rgba(255,255,255,0.42)", backdropFilter:"blur(32px)",
              WebkitBackdropFilter:"blur(32px)", border:"1px solid rgba(255,255,255,0.65)",
              boxShadow:"0 32px 72px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.85)",
            }}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-3"
              style={{ borderBottom:"1px solid rgba(200,200,200,0.2)" }}>
              <h3 className="font-semibold text-gray-700" style={{fontSize:17}}>{title}</h3>
              <button onClick={onClose}
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700"
                style={{background:"rgba(0,0,0,0.07)"}}>
                <svg width={11} height={11} viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function GlassToggle({ value, onChange, label }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-gray-600">{label}</span>
      <button onClick={() => onChange(!value)}
        className="relative w-12 h-6 rounded-full transition-all duration-200"
        style={{ background: value ? "linear-gradient(135deg,#FF7043,#FF9800)" : "rgba(0,0,0,0.1)" }}>
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${value?"left-6":"left-0.5"}`}/>
      </button>
    </div>
  );
}
function GlassSlider({ min, max, value, onChange, label, unit="" }) {
  const pct = ((value-min)/(max-min))*100;
  return (
    <div className="py-2">
      <div className="flex justify-between mb-1.5">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-medium text-gray-700">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e=>onChange(+e.target.value)}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{ background:`linear-gradient(to right,#FF7043 ${pct}%,rgba(0,0,0,0.1) ${pct}%)` }}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CALIBRATION MODAL
// ─────────────────────────────────────────────────────────────
function CalibrationModal({ open, onClose }) {
  const [active, setActive] = useState(false);
  const [detectedNote, setDetectedNote] = useState("—");
  const [detectedFreq, setDetectedFreq] = useState(0);
  const [liveRms, setLiveRms] = useState(0);

  const onPitch = useCallback((freq) => {
    setDetectedFreq(Math.round(freq));
    setDetectedNote(midiToNote(freqToMidi(freq)));
  }, []);
  const { rms, error } = useAudioEngine({ onPitchDetected: onPitch, enabled: active });
  useEffect(()=>setLiveRms(rms),[rms]);

  const rmsDb = liveRms > 0 ? Math.max(-60, 20*Math.log10(liveRms)) : -60;
  const rmsP  = Math.max(0,Math.min(100,((rmsDb+60)/60)*100));

  return (
    <GlassModal open={open} onClose={()=>{setActive(false);onClose();}} title="校准 / Calibration">
      <div className="space-y-5">
        <div className="rounded-2xl p-4 text-center"
          style={{background:"rgba(255,112,67,0.06)",border:"1px solid rgba(255,112,67,0.15)"}}>
          <button onClick={()=>setActive(a=>!a)}
            className="px-6 py-2.5 rounded-xl font-medium text-sm text-white transition-all"
            style={{background:active?"linear-gradient(135deg,#EF5350,#E53935)":"linear-gradient(135deg,#FF7043,#FF9800)"}}>
            {active?"⏹ Stop Listening":"🎤 Start Listening"}
          </button>
        </div>
        {/* RMS bar */}
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-xs text-gray-500">Signal Level</span>
            <span className="text-xs font-mono text-gray-500">{rmsDb.toFixed(1)} dB</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{background:"rgba(0,0,0,0.08)"}}>
            <div className="h-full rounded-full transition-all duration-75" style={{
              width:`${rmsP}%`,
              background:rmsP>85?"linear-gradient(90deg,#FF7043,#EF5350)":rmsP>50?"linear-gradient(90deg,#FF9800,#FF7043)":"linear-gradient(90deg,#66BB6A,#FF9800)"
            }}/>
          </div>
          <div className="flex justify-between mt-0.5">
            {["Silence","Optimal","Clip"].map(t=><span key={t} className="text-[10px] text-gray-400">{t}</span>)}
          </div>
        </div>
        {/* Detected pitch */}
        <div className="flex gap-3">
          <div className="flex-1 rounded-2xl p-3 text-center" style={{background:"rgba(41,182,246,0.08)",border:"1px solid rgba(41,182,246,0.15)"}}>
            <div className="text-3xl font-bold text-gray-700">{detectedNote}</div>
            <div className="text-xs text-gray-400 mt-0.5">Note</div>
          </div>
          <div className="flex-1 rounded-2xl p-3 text-center" style={{background:"rgba(102,187,106,0.08)",border:"1px solid rgba(102,187,106,0.15)"}}>
            <div className="text-3xl font-bold text-gray-700">{detectedFreq||"—"}</div>
            <div className="text-xs text-gray-400 mt-0.5">Hz</div>
          </div>
        </div>
        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
        {!error && active && liveRms < 0.01 && (
          <p className="text-xs text-center text-amber-600">Play a note on your guitar…</p>
        )}
      </div>
    </GlassModal>
  );
}

// ─────────────────────────────────────────────────────────────
// SETTINGS MODAL
// ─────────────────────────────────────────────────────────────
function SettingsModal({ open, onClose, settings, onSettings }) {
  return (
    <GlassModal open={open} onClose={onClose} title="设置 / Settings">
      <div className="space-y-1 divide-y divide-gray-100 divide-opacity-40">
        <GlassToggle value={settings.leftHanded} onChange={v=>onSettings({...settings,leftHanded:v})} label="左手模式 / Left-Handed"/>
        <GlassToggle value={settings.showNoteNames} onChange={v=>onSettings({...settings,showNoteNames:v})} label="显示音名 / Show Note Names"/>
        <GlassToggle value={settings.showAllPositions} onChange={v=>onSettings({...settings,showAllPositions:v})} label="显示所有位置 / Show All Positions"/>
        <GlassSlider min={0} max={12} value={settings.minFret}
          onChange={v=>onSettings({...settings,minFret:Math.min(v,settings.maxFret-1)})} label="起始品 / Min Fret"/>
        <GlassSlider min={1} max={15} value={settings.maxFret}
          onChange={v=>onSettings({...settings,maxFret:Math.max(v,settings.minFret+1)})} label="结束品 / Max Fret"/>
        <div className="pt-3 text-center">
          <p className="text-xs text-gray-400">Solo-Vision Ultra v1.1</p>
          <p className="text-xs text-gray-400">Intervallic Functions Method</p>
        </div>
      </div>
    </GlassModal>
  );
}

// ─────────────────────────────────────────────────────────────
// TUNING MODAL
// ─────────────────────────────────────────────────────────────
function TuningModal({ open, onClose, tuning, onTuning }) {
  return (
    <GlassModal open={open} onClose={onClose} title="调弦 / Tuning">
      <div className="space-y-2.5">
        {Object.entries(TUNINGS).map(([name,arr])=>{
          const active = JSON.stringify(tuning)===JSON.stringify(arr);
          return (
            <button key={name} onClick={()=>{onTuning(arr);onClose();}}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left transition-all"
              style={{
                background:active?"rgba(255,112,67,0.12)":"rgba(0,0,0,0.04)",
                border:active?"1px solid rgba(255,112,67,0.3)":"1px solid transparent",
              }}>
              <span className="text-sm font-medium text-gray-700">{name}</span>
              <span className="text-xs text-gray-400 font-mono">{arr.map(m=>midiToNote(m)).join("-")}</span>
            </button>
          );
        })}
      </div>
    </GlassModal>
  );
}

// ─────────────────────────────────────────────────────────────
// SESSION STATS MODAL — surfaces posStatsRef weak spots
// ─────────────────────────────────────────────────────────────
function SessionStatsModal({ open, onClose, statsRef }) {
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    if (!open) return;
    const all = Object.entries(statsRef.current).map(([k, v]) => {
      const [iv, str, fret] = k.split("-");
      return { interval: +iv, string: +str, fret: +fret, ...v };
    });
    all.sort((a,b) => b.avgMs - a.avgMs);
    setEntries(all.slice(0, 8));
  }, [open]);

  if (!entries.length && open) return (
    <GlassModal open={open} onClose={onClose} title="Session Stats / 练习报告">
      <p className="text-sm text-center text-gray-400 py-4">Play at least a few questions to see stats.</p>
    </GlassModal>
  );

  return (
    <GlassModal open={open} onClose={onClose} title="Session Stats / 练习报告" width="max-w-sm">
      <div className="space-y-2">
        <p className="text-xs text-gray-400 mb-3">Slowest responses — these need more practice:</p>
        {entries.map((e, i) => {
          const bars = Math.min(100, (e.avgMs / 4000) * 100);
          const isWeak = e.avgMs > 2000;
          return (
            <div key={i} className="rounded-2xl p-3"
              style={{ background: isWeak ? "rgba(255,112,67,0.07)" : "rgba(0,0,0,0.04)", border: isWeak ? "1px solid rgba(255,112,67,0.2)" : "1px solid transparent" }}>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs font-bold" style={{ color: isWeak ? "#E64A19" : "#555" }}>
                  {INTERVAL_LABELS[e.interval]} — Str {e.string+1} Fret {e.fret}
                </span>
                <span className="text-xs text-gray-400">{(e.avgMs/1000).toFixed(1)}s avg · {e.count}×</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{background:"rgba(0,0,0,0.08)"}}>
                <motion.div className="h-full rounded-full" initial={{width:0}} animate={{width:`${bars}%`}}
                  transition={{duration:0.6,delay:i*0.05}}
                  style={{ background: isWeak ? "linear-gradient(90deg,#FF9800,#FF7043)" : "linear-gradient(90deg,#66BB6A,#A5D6A7)" }}/>
              </div>
            </div>
          );
        })}
      </div>
    </GlassModal>
  );
}

// ─────────────────────────────────────────────────────────────
// SHARED TRAINER PRIMITIVES
// ─────────────────────────────────────────────────────────────
function FretboardContainer({ settings, highlights, tuning, arcPair }) {
  return (
    <div className="rounded-3xl overflow-hidden p-3" style={{
      background:"rgba(255,255,255,0.55)", backdropFilter:"blur(20px)",
      border:"1px solid rgba(255,255,255,0.75)",
      boxShadow:"0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.95)",
    }}>
      <Fretboard tuning={tuning} highlights={highlights} arcPair={arcPair}
        leftHanded={settings.leftHanded}   // ← Bug fix: was hardcoded false
        minFret={settings.minFret} maxFret={settings.maxFret}/>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    idle:      { text:"Ready",       bg:"rgba(0,0,0,0.06)",        color:"#999" },
    listening: { text:"Listening…",  bg:"rgba(41,182,246,0.12)",   color:"#0277BD" },
    correct:   { text:"✓ Correct!",  bg:"rgba(102,187,106,0.18)",  color:"#2E7D32" },
    wrong:     { text:"✗ Try again", bg:"rgba(239,83,80,0.12)",    color:"#C62828" },
  };
  const c = cfg[status] || cfg.idle;
  return (
    <motion.span className="px-3 py-1 rounded-full text-xs font-semibold"
      key={status}
      initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} transition={{duration:0.15}}
      style={{ background:c.bg, color:c.color }}>
      {c.text}
    </motion.span>
  );
}

function RmsIndicator({ rms, enabled }) {
  if (!enabled) return null;
  const pct = Math.min(100, rms * 600);
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{background:"rgba(0,0,0,0.08)"}}>
        <div className="h-full rounded-full transition-all duration-75" style={{
          width:`${pct}%`,
          background:pct>80?"#EF5350":pct>40?"#FF9800":"#66BB6A"
        }}/>
      </div>
      <span className="text-[10px] text-gray-400">🎤</span>
    </div>
  );
}

function TrainerLayout({ title, subtitle, status, streak, score, rms, audioEnabled, children, onStats }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-800 text-lg leading-tight">{title}</h2>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <RmsIndicator rms={rms} enabled={audioEnabled}/>
          <StatusBadge status={status}/>
          {streak > 1 && (
            <motion.span className="px-2 py-1 rounded-full text-xs font-bold text-white"
              initial={{scale:0.7}} animate={{scale:1}} transition={{type:"spring",stiffness:400}}
              style={{background:"linear-gradient(135deg,#FF7043,#FF9800)"}}>
              🔥 {streak}
            </motion.span>
          )}
          {onStats && score.total >= 5 && (
            <button onClick={onStats}
              className="px-2.5 py-1 rounded-full text-[10px] font-semibold text-gray-500 transition-all"
              style={{background:"rgba(0,0,0,0.05)"}}>
              📊
            </button>
          )}
        </div>
      </div>
      {score.total > 0 && (
        <div className="flex gap-2">
          <div className="px-3 py-1.5 rounded-xl text-xs" style={{background:"rgba(102,187,106,0.1)",color:"#2E7D32"}}>✓ {score.correct}</div>
          <div className="px-3 py-1.5 rounded-xl text-xs" style={{background:"rgba(0,0,0,0.05)",color:"#777"}}>Total {score.total}</div>
          <div className="px-3 py-1.5 rounded-xl text-xs font-semibold" style={{background:"rgba(41,182,246,0.1)",color:"#0277BD"}}>
            {Math.round((score.correct/score.total)*100)}%
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NOTE TRAINER
// ─────────────────────────────────────────────────────────────
function NoteTrainer({ settings, tuning, audioEnabled }) {
  const [targetNote, setTargetNote] = useState("C");
  const [status, setStatus] = useState("listening");
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState({ correct:0, total:0 });
  const [successPos, setSuccessPos] = useState(null);
  const prevMidiRef = useRef(-1);

  const genQuestion = useCallback(() => {
    const note = NOTE_NAMES[Math.floor(Math.random()*12)];
    setTargetNote(note);
    setStatus("listening");
    setSuccessPos(null);
    prevMidiRef.current = -1; // ← Bug fix: reset on new question
  }, []);

  useEffect(() => { genQuestion(); }, []);

  const onPitchDetected = useCallback((freq) => {
    if (status !== "listening") return;
    const midi = freqToMidi(freq);
    if (midi === prevMidiRef.current) return;
    prevMidiRef.current = midi;
    const played = midiToNote(midi);
    if (played === targetNote) {
      haptic("correct");
      setStatus("correct");
      setStreak(s=>s+1);
      setScore(s=>({ correct:s.correct+1, total:s.total+1 }));
      const pos = findNotePositions(targetNote, tuning, settings.minFret, settings.maxFret);
      if (pos.length) setSuccessPos(pos[0]);
      setTimeout(genQuestion, 1300);
    } else {
      haptic("wrong");
      setScore(s=>({ ...s, total:s.total+1 }));
      setStreak(0);
      setStatus("wrong");
      setTimeout(()=>setStatus("listening"), 450);
    }
  }, [status, targetNote, settings, tuning, genQuestion]);

  const { rms } = useAudioEngine({ onPitchDetected, enabled: audioEnabled });

  const positions = settings.showAllPositions
    ? findNotePositions(targetNote, tuning, settings.minFret, settings.maxFret)
    : (successPos ? [successPos] : []);
  const highlights = positions.map(p => ({ ...p, role:"root", label: settings.showNoteNames ? targetNote : "R" }));

  return (
    <TrainerLayout title="Note Trainer" subtitle="Find the note on the fretboard"
      status={status} streak={streak} score={score} rms={rms} audioEnabled={audioEnabled}>
      <div className="text-center py-6">
        <motion.div className="text-8xl font-black tracking-tighter"
          key={targetNote} initial={{scale:0.7,opacity:0}} animate={{scale:1,opacity:1}}
          transition={{type:"spring",stiffness:380,damping:22}}
          style={{background:"linear-gradient(135deg,#FF7043,#FF9800)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          {targetNote}
        </motion.div>
        <div className="text-gray-400 text-sm mt-1">Find this note</div>
      </div>
      <FretboardContainer settings={settings} highlights={highlights} tuning={tuning}/>
    </TrainerLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// INTERVAL TRAINER — with Zen Focus mode + Session Stats
// ─────────────────────────────────────────────────────────────
function IntervalTrainer({ settings, tuning, audioEnabled }) {
  const [intervals, setIntervals] = useState([3,5,7]);
  const [question, setQuestion] = useState(null);
  const [status, setStatus] = useState("listening");
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState({ correct:0, total:0 });
  const [revealMode, setRevealMode] = useState("learning"); // learning | blind
  const [zenMode, setZenMode] = useState(false);          // zen: fretboard hidden
  const [hitPos, setHitPos] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const prevMidiRef = useRef({ midi:-1, frames:0 });
  const questionStartRef = useRef(null);
  const lastTargetKeyRef = useRef(null);
  const posStatsRef = useRef({});

  const genQuestion = useCallback(() => {
    const rootStr  = Math.floor(Math.random()*6);
    const rootFret = settings.minFret + Math.floor(Math.random()*(Math.max(1, settings.maxFret-settings.minFret)));
    const iv = intervals[Math.floor(Math.random()*intervals.length)];
    const rootMidi   = getMidi(rootStr, rootFret, tuning);
    const targetMidi = rootMidi + iv;

    const candidates = [];
    for (let s=0; s<6; s++)
      for (let f=settings.minFret; f<=settings.maxFret; f++)
        if (getMidi(s,f,tuning)===targetMidi && !(s===rootStr&&f===rootFret))
          candidates.push({string:s, fret:f});

    if (!candidates.length) { setTimeout(genQuestion,0); return; }

    let pool = candidates.filter(c=>Math.abs(c.string-rootStr)<=2);
    if (!pool.length) pool = candidates;
    if (lastTargetKeyRef.current) {
      const filtered = pool.filter(c=>`${iv}-${c.string}-${c.fret}`!==lastTargetKeyRef.current);
      if (filtered.length) pool = filtered;
    }
    const pick = pool[Math.floor(Math.random()*pool.length)];
    lastTargetKeyRef.current = `${iv}-${pick.string}-${pick.fret}`;

    setQuestion({ rootStr, rootFret, targetStr:pick.string, targetFret:pick.fret, intervalIdx:iv });
    setHitPos(null);
    prevMidiRef.current = { midi:-1, frames:0 };
    questionStartRef.current = Date.now();
    setStatus("listening");
  }, [intervals, settings, tuning]);

  useEffect(() => { genQuestion(); }, []);

  const onPitchDetected = useCallback((freq) => {
    if (status !== "listening" || !question) return;
    const midi = freqToMidi(freq);
    const st = prevMidiRef.current;
    if (midi === st.midi) { st.frames++; } else { st.midi = midi; st.frames = 1; }
    if (st.frames < 3) return;
    st.frames = 0;

    const targetMidi = getMidi(question.targetStr, question.targetFret, tuning);
    if (Math.abs(midi - targetMidi) <= 1) {
      // Find physical hit position
      const rootMidi = getMidi(question.rootStr, question.rootFret, tuning);
      let best = null; let bestScore = Infinity;
      for (let s=0; s<6; s++) {
        for (let f=settings.minFret; f<=settings.maxFret; f++) {
          if (Math.abs(getMidi(s,f,tuning)-midi)<=1) {
            const ds=Math.abs(s-question.rootStr), df=Math.abs(f-question.rootFret);
            if (ds>2||df>5) continue;
            const sc=ds*2+df;
            if (sc<bestScore) { bestScore=sc; best={string:s,fret:f}; }
          }
        }
      }
      if (best) setHitPos(best);

      // Record reaction time for weak-spot tracking
      const rt = questionStartRef.current ? Date.now()-questionStartRef.current : 0;
      const key = `${question.intervalIdx}-${(best||question).string}-${(best||question).fret}`;
      const prev = posStatsRef.current[key] || {count:0,totalMs:0,avgMs:0,weak:false};
      const next = { count:prev.count+1, totalMs:prev.totalMs+rt, avgMs:0, weak:false };
      next.avgMs = next.totalMs / next.count;
      next.weak  = next.avgMs > 2000;
      posStatsRef.current[key] = next;

      haptic("correct");
      setStatus("correct");
      setStreak(s=>s+1);
      setScore(s=>({ correct:s.correct+1, total:s.total+1 }));
      setTimeout(genQuestion, revealMode==="blind" ? 2000 : 1500);
    } else {
      const rootMidi = getMidi(question.rootStr, question.rootFret, tuning);
      if (Math.abs(midi-rootMidi) > 1) {
        haptic("wrong");
        setScore(s=>({...s,total:s.total+1}));
        setStreak(0);
        setStatus("wrong");
        setTimeout(()=>setStatus("listening"), 450);
      }
    }
  }, [status, question, tuning, settings, revealMode, genQuestion]);

  const { rms } = useAudioEngine({ onPitchDetected, enabled: audioEnabled });

  const rootNote = question ? midiToNote(getMidi(question.rootStr, question.rootFret, tuning)) : "—";
  const intervalName = question ? INTERVAL_LABELS[question.intervalIdx] : "—";
  const shouldReveal = revealMode === "learning" || status === "correct";

  const targetDisplayPos = (() => {
    if (!question) return null;
    if (hitPos && shouldReveal) return hitPos;
    if (revealMode === "learning") return { string:question.targetStr, fret:question.targetFret };
    return null;
  })();

  const highlights = question ? [
    { string:question.rootStr, fret:question.rootFret, role:"root", label:"R" },
    ...(targetDisplayPos && shouldReveal ? [{
      string:targetDisplayPos.string, fret:targetDisplayPos.fret, role:"target",
      label: settings.showNoteNames
        ? midiToNote(getMidi(targetDisplayPos.string, targetDisplayPos.fret, tuning))
        : INTERVAL_LABELS[question.intervalIdx],
    }] : []),
  ] : [];

  const arcPair = shouldReveal && targetDisplayPos && question ? {
    from:{ string:question.rootStr, fret:question.rootFret },
    to:{ string:targetDisplayPos.string, fret:targetDisplayPos.fret },
  } : null;

  // ZEN FOCUS: big central UI when fretboard is hidden
  const fretboardHidden = zenMode && revealMode === "blind" && status !== "correct";

  return (
    <>
      <TrainerLayout title="Interval Trainer" subtitle="Find the interval"
        status={status} streak={streak} score={score} rms={rms} audioEnabled={audioEnabled}
        onStats={() => setShowStats(true)}>

        {/* Interval chips */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {INTERVAL_LABELS.slice(1).map((label, i) => {
              const iv=i+1, sel=intervals.includes(iv);
              return (
                <button key={iv}
                  onClick={()=>setIntervals(prev=>sel&&prev.length>1?prev.filter(x=>x!==iv):[...new Set([...prev,iv])].sort((a,b)=>a-b))}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background:sel?"linear-gradient(135deg,#29B6F6,#0277BD)":"rgba(0,0,0,0.06)",
                    color:sel?"white":"#666",border:sel?"1px solid rgba(41,182,246,0.4)":"1px solid transparent",
                  }}>{label}</button>
              );
            })}
          </div>

          {/* Mode row */}
          <div className="flex justify-center items-center gap-2 flex-wrap">
            {[{id:"learning",label:"📖 学习"},{id:"blind",label:"🙈 盲练"}].map(m=>(
              <button key={m.id} onClick={()=>setRevealMode(m.id)}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
                style={{
                  background:revealMode===m.id?"rgba(255,112,67,0.15)":"rgba(0,0,0,0.05)",
                  color:revealMode===m.id?"#E64A19":"#777",
                  border:revealMode===m.id?"1px solid rgba(255,112,67,0.4)":"1px solid transparent",
                }}>{m.label}</button>
            ))}
            {revealMode === "blind" && (
              <button onClick={()=>setZenMode(z=>!z)}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
                style={{
                  background:zenMode?"rgba(103,58,183,0.12)":"rgba(0,0,0,0.05)",
                  color:zenMode?"#5E35B1":"#777",
                  border:zenMode?"1px solid rgba(103,58,183,0.3)":"1px solid transparent",
                }}>🧘 Zen</button>
            )}
          </div>
        </div>

        {/* Main question display */}
        <motion.div className="text-center py-4" key={question?.intervalIdx+"-"+question?.rootStr+"-"+question?.rootFret}
          initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.25}}>
          <div className="text-xs text-gray-400 mb-1 tracking-widest uppercase">Find the interval</div>
          <div className="flex items-baseline justify-center gap-2">
            <span className="font-black" style={{
              fontSize:fretboardHidden?96:52,
              background:"linear-gradient(135deg,#29B6F6,#0277BD)",
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
              lineHeight:1.05
            }}>{intervalName}</span>
            <span className="text-gray-400 font-light" style={{fontSize:fretboardHidden?40:24}}>of</span>
            <span className="font-black" style={{
              fontSize:fretboardHidden?96:52,
              background:"linear-gradient(135deg,#FF7043,#FF9800)",
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
              lineHeight:1.05
            }}>{rootNote}</span>
          </div>

          {/* Zen hint */}
          {fretboardHidden && (
            <motion.p className="text-xs text-gray-400 mt-4" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.3}}>
              Tap to reveal fretboard
            </motion.p>
          )}
        </motion.div>

        {/* Fretboard — hidden in Zen Focus blind mode until correct */}
        <AnimatePresence>
          {!fretboardHidden && (
            <motion.div
              initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}}
              transition={{duration:0.3}}>
              <FretboardContainer settings={settings} highlights={highlights} tuning={tuning} arcPair={arcPair}/>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tap to reveal in zen mode */}
        {fretboardHidden && (
          <button onClick={()=>setZenMode(false)}
            className="w-full py-3 rounded-2xl text-xs text-gray-400 transition-all"
            style={{background:"rgba(0,0,0,0.04)",border:"1px dashed rgba(0,0,0,0.1)"}}>
            Show Fretboard
          </button>
        )}
      </TrainerLayout>

      <SessionStatsModal open={showStats} onClose={()=>setShowStats(false)} statsRef={posStatsRef}/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// CHANGES TRAINER
// ─────────────────────────────────────────────────────────────
function ChangesTrainer({ settings, tuning, audioEnabled }) {
  const [selectedStd, setSelectedStd] = useState(0);
  const [chordIdx, setChordIdx] = useState(0);
  const [prevMidiState, setPrevMidi] = useState(60);
  const [targetMidi, setTargetMidi] = useState(60);
  const [status, setStatus] = useState("listening");
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState({ correct:0, total:0 });
  const [showStdPicker, setShowStdPicker] = useState(false);
  const prevMidiRef = useRef(-1); // ← debounce

  const std = JAZZ_STANDARDS[selectedStd];
  const currentChord = std.changes[chordIdx % std.changes.length];
  const nextChord = std.changes[(chordIdx+1) % std.changes.length];

  function parseChord(s) {
    const m = s.match(/^([A-G][b#]?)(.*)$/);
    return m ? { root:m[1], type:m[2]||"" } : { root:"C", type:"Maj7" };
  }
  const genTarget = useCallback((chord, prev) => {
    const { root, type } = parseChord(chord);
    const ivs = CHORD_INTERVALS[type] ?? CHORD_INTERVALS["Maj7"];
    const rootChroma = noteNameToChroma(root);
    if (rootChroma < 0) return prev;
    return voiceLeadChordTone(prev, root, ivs);
  }, []);

  useEffect(() => {
    const t = genTarget(currentChord, prevMidiState);
    setTargetMidi(t);
    setStatus("listening");
    prevMidiRef.current = -1; // ← Bug fix: reset on chord change
  }, [chordIdx, selectedStd]);

  const onPitchDetected = useCallback((freq) => {
    if (status !== "listening") return;
    const midi = freqToMidi(freq);
    if (midi === prevMidiRef.current) return;
    prevMidiRef.current = midi;
    if (Math.abs(midi - targetMidi) <= 1) {
      haptic("correct");
      setStatus("correct");
      setStreak(s=>s+1);
      setScore(s=>({ correct:s.correct+1, total:s.total+1 }));
      setPrevMidi(midi);
      setTimeout(()=>setChordIdx(i=>i+1), 1000);
    } else {
      const { type } = parseChord(currentChord);
      const ivs = CHORD_INTERVALS[type] ?? CHORD_INTERVALS["Maj7"];
      const { root } = parseChord(currentChord);
      const rootChroma = noteNameToChroma(root);
      const isChordTone = ivs.some(iv => ((midi-rootChroma)%12+12)%12===iv);
      if (!isChordTone) {
        haptic("wrong");
        setScore(s=>({...s,total:s.total+1}));
        setStreak(0);
        setStatus("wrong");
        setTimeout(()=>setStatus("listening"),450);
      }
    }
  }, [status, targetMidi, currentChord]);

  const { rms } = useAudioEngine({ onPitchDetected, enabled: audioEnabled });

  const targetNote = midiToNote(targetMidi);
  const targetPos = findNotePositions(targetNote, tuning, settings.minFret, settings.maxFret);
  const highlights = status==="correct" && targetPos.length
    ? [{...targetPos[0], role:"target", label:targetNote}] : [];

  return (
    <TrainerLayout title="Changes Trainer" subtitle="Voice leading through changes"
      status={status} streak={streak} score={score} rms={rms} audioEnabled={audioEnabled}>
      <button onClick={()=>setShowStdPicker(true)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl mb-2 text-left"
        style={{background:"rgba(0,0,0,0.04)",border:"1px solid rgba(0,0,0,0.06)"}}>
        <span className="font-semibold text-gray-700 text-sm">{std.name}</span>
        <span className="text-xs text-gray-400">Change ▾</span>
      </button>

      <motion.div className="text-center py-4"
        key={chordIdx} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.22}}>
        <div className="text-xs text-gray-400 mb-2 tracking-widest uppercase">Play chord tone of</div>
        <div className="text-6xl font-black mb-2"
          style={{background:"linear-gradient(135deg,#FF7043,#FF9800)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          {currentChord}
        </div>
        <div className="text-sm text-gray-400">
          Voice lead to → <span className="text-gray-600 font-semibold">{nextChord}</span>
        </div>
        {status==="correct" && (
          <motion.div className="mt-2 text-sm font-semibold" style={{color:"#FF7043"}}
            initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}}>
            ✓ {targetNote} — Perfect voice leading!
          </motion.div>
        )}
      </motion.div>

      <FretboardContainer settings={settings} highlights={highlights} tuning={tuning}/>

      {/* Progress dots */}
      <div className="flex justify-center gap-1 mt-2 flex-wrap">
        {std.changes.map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full transition-all"
            style={{ background: i===chordIdx%std.changes.length?"#FF7043":i<chordIdx%std.changes.length?"rgba(255,112,67,0.3)":"rgba(0,0,0,0.1)" }}/>
        ))}
      </div>

      <GlassModal open={showStdPicker} onClose={()=>setShowStdPicker(false)} title="Jazz Standards" width="max-w-sm">
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {JAZZ_STANDARDS.map((s,i)=>(
            <button key={i} onClick={()=>{setSelectedStd(i);setChordIdx(0);setShowStdPicker(false);}}
              className="w-full text-left px-4 py-2.5 rounded-xl transition-all text-sm"
              style={{
                background:selectedStd===i?"rgba(255,112,67,0.1)":"rgba(0,0,0,0.04)",
                border:selectedStd===i?"1px solid rgba(255,112,67,0.25)":"1px solid transparent",
                color:selectedStd===i?"#E64A19":"#555",fontWeight:selectedStd===i?600:400,
              }}>
              {s.name} <span className="text-xs text-gray-400 ml-1">({s.key})</span>
            </button>
          ))}
        </div>
      </GlassModal>
    </TrainerLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// SCALE TRAINER
// ─────────────────────────────────────────────────────────────
function ScaleTrainer({ settings, tuning, audioEnabled }) {
  const scaleNames = Object.keys(SCALES);
  const [selectedScale, setSelectedScale] = useState("Dorian");
  const [rootNote, setRootNote] = useState("A");
  const [seqMode, setSeqMode] = useState("ascending");
  const [scaleNoteIdx, setScaleNoteIdx] = useState(0);
  const [status, setStatus] = useState("listening");
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState({ correct:0, total:0 });
  const [showScalePicker, setShowScalePicker] = useState(false);
  const prevMidiRef = useRef(-1);

  const scaleIntervals = SCALES[selectedScale] ?? [];
  const currentTarget = scaleIntervals[scaleNoteIdx % scaleIntervals.length] ?? 0;
  const currentTargetNote = NOTE_NAMES[(noteNameToChroma(rootNote)+currentTarget)%12];

  const onPitchDetected = useCallback((freq) => {
    if (status !== "listening") return;
    const midi = freqToMidi(freq);
    if (midi === prevMidiRef.current) return;
    prevMidiRef.current = midi;
    const played = midi%12;
    const targetChroma = (noteNameToChroma(rootNote)+currentTarget)%12;
    if (played === targetChroma) {
      haptic("correct");
      setStatus("correct");
      setStreak(s=>s+1);
      setScore(s=>({ correct:s.correct+1, total:s.total+1 }));
      setTimeout(()=>{
        let next;
        if (seqMode==="ascending") next=(scaleNoteIdx+1)%scaleIntervals.length;
        else if (seqMode==="descending") next=(scaleNoteIdx-1+scaleIntervals.length)%scaleIntervals.length;
        else next=Math.floor(Math.random()*scaleIntervals.length);
        prevMidiRef.current = -1;
        setScaleNoteIdx(next);
        setStatus("listening");
      }, 800);
    }
  }, [status, rootNote, currentTarget, scaleNoteIdx, scaleIntervals, seqMode]);

  const { rms } = useAudioEngine({ onPitchDetected, enabled: audioEnabled });

  useEffect(()=>{ setStatus("listening"); setScaleNoteIdx(0); prevMidiRef.current=-1; }, [selectedScale, rootNote]);

  const highlights = [];
  for (let s=0; s<6; s++) {
    for (let f=settings.minFret; f<=settings.maxFret; f++) {
      const chroma = getMidi(s,f,tuning)%12;
      const rootChroma = noteNameToChroma(rootNote);
      const targetChroma = (rootChroma+currentTarget)%12;
      if (chroma === rootChroma) highlights.push({string:s,fret:f,role:"root",label:settings.showNoteNames?rootNote:"R"});
      else if (chroma === targetChroma) highlights.push({string:s,fret:f,role:"target",label:settings.showNoteNames?currentTargetNote:INTERVAL_LABELS[currentTarget]});
    }
  }

  return (
    <TrainerLayout title="Scale Trainer" subtitle="Navigate scale degrees"
      status={status} streak={streak} score={score} rms={rms} audioEnabled={audioEnabled}>
      {/* Root note selector */}
      <div className="flex flex-wrap gap-1 justify-center">
        {NOTE_NAMES.map(n=>(
          <button key={n} onClick={()=>setRootNote(n)}
            className="w-8 h-8 rounded-lg text-xs font-semibold transition-all"
            style={{ background:rootNote===n?"linear-gradient(135deg,#FF7043,#FF9800)":"rgba(0,0,0,0.06)", color:rootNote===n?"white":"#555" }}>
            {n}
          </button>
        ))}
      </div>

      {/* Scale + sequence */}
      <div className="flex gap-2">
        <button onClick={()=>setShowScalePicker(true)}
          className="flex-1 px-3 py-2.5 rounded-2xl text-sm font-medium text-left"
          style={{background:"rgba(0,0,0,0.04)",border:"1px solid rgba(0,0,0,0.06)"}}>
          <span className="text-gray-700">{selectedScale}</span>
          <span className="text-gray-400 ml-1 text-xs">▾</span>
        </button>
        {[{id:"ascending",icon:"↑"},{id:"descending",icon:"↓"},{id:"random",icon:"⟳"}].map(m=>(
          <button key={m.id} onClick={()=>setSeqMode(m.id)}
            className="px-3 py-2 rounded-2xl text-sm font-bold transition-all"
            style={{
              background:seqMode===m.id?"rgba(41,182,246,0.12)":"rgba(0,0,0,0.04)",
              color:seqMode===m.id?"#0277BD":"#999",
              border:seqMode===m.id?"1px solid rgba(41,182,246,0.3)":"1px solid transparent",
            }}>{m.icon}</button>
        ))}
      </div>

      {/* Question */}
      <motion.div className="text-center py-3"
        key={`${scaleNoteIdx}-${rootNote}-${selectedScale}`}
        initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:0.2}}>
        <div className="text-xs text-gray-400 mb-1 tracking-widest uppercase">Play</div>
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-5xl font-black"
            style={{background:"linear-gradient(135deg,#29B6F6,#0277BD)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            {INTERVAL_LABELS[currentTarget]}
          </span>
          <span className="text-2xl text-gray-400 font-light">of</span>
          <span className="text-5xl font-black"
            style={{background:"linear-gradient(135deg,#FF7043,#FF9800)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            {rootNote}
          </span>
        </div>
        <div className="text-sm text-gray-400 mt-1">{selectedScale}</div>
        <div className="flex justify-center gap-1.5 mt-3">
          {scaleIntervals.map((_,i)=>(
            <div key={i} className="w-2 h-2 rounded-full transition-all"
              style={{background:i===scaleNoteIdx%scaleIntervals.length?"#29B6F6":"rgba(0,0,0,0.12)"}}/>
          ))}
        </div>
      </motion.div>

      <FretboardContainer settings={settings} highlights={highlights} tuning={tuning}/>

      <GlassModal open={showScalePicker} onClose={()=>setShowScalePicker(false)} title="Select Scale" width="max-w-sm">
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {scaleNames.map(name=>(
            <button key={name} onClick={()=>{setSelectedScale(name);setShowScalePicker(false);}}
              className="w-full text-left px-4 py-2 rounded-xl transition-all text-sm"
              style={{
                background:selectedScale===name?"rgba(41,182,246,0.1)":"rgba(0,0,0,0.04)",
                color:selectedScale===name?"#0277BD":"#555",fontWeight:selectedScale===name?600:400,
              }}>
              {name}
              <span className="text-xs text-gray-400 ml-2">
                [{(SCALES[name]||[]).map(iv=>INTERVAL_LABELS[iv]).join(" ")}]
              </span>
            </button>
          ))}
        </div>
      </GlassModal>
    </TrainerLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
const TABS = [
  { id:"note",     label:"Notes",     icon:"♩", chinese:"音符" },
  { id:"interval", label:"Intervals", icon:"◎", chinese:"音程" },
  { id:"changes",  label:"Changes",   icon:"♫", chinese:"进行" },
  { id:"scale",    label:"Scales",    icon:"≋", chinese:"音阶" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("interval");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTuning, setShowTuning] = useState(false);
  const [showCalib, setShowCalib] = useState(false);
  const [tuning, setTuning] = useState(STD_TUNING);
  const [settings, setSettings] = useState({
    leftHanded: false, showNoteNames: false, showAllPositions: false,
    minFret: 0, maxFret: 12,
  });

  const toggleAudio = useCallback(async () => {
    if (!audioEnabled) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setAudioEnabled(true);
      } catch { setShowCalib(true); }
    } else { setAudioEnabled(false); }
  }, [audioEnabled]);

  const trainerProps = { settings, tuning, audioEnabled };

  return (
    <div className="min-h-screen" style={{ background:"#FAF9F6", fontFamily:"-apple-system,'SF Pro Display',sans-serif" }}>
      {/* Ambient gradients */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage:"radial-gradient(circle at 15% 15%,rgba(255,112,67,0.05) 0%,transparent 55%),radial-gradient(circle at 85% 85%,rgba(41,182,246,0.05) 0%,transparent 55%)"
      }}/>

      <div className="relative z-10 max-w-2xl mx-auto px-4 pb-32">
        {/* Header */}
        <header className="pt-10 pb-5 flex items-start justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-black tracking-tight text-gray-800">Solo-Vision</h1>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                style={{background:"linear-gradient(135deg,#FF7043,#FF9800)"}}>Ultra</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Intervallic Functions Training</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <motion.button onClick={toggleAudio} whileTap={{scale:0.93}}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background:audioEnabled?"linear-gradient(135deg,#66BB6A,#43A047)":"rgba(0,0,0,0.07)",
                color:audioEnabled?"white":"#777",
                boxShadow:audioEnabled?"0 2px 10px rgba(102,187,106,0.4)":"none",
              }}>
              {audioEnabled?"🎤 ON":"🎤 OFF"}
            </motion.button>
            {[{i:"♩",a:()=>setShowTuning(true),t:"Tuning"},{i:"◈",a:()=>setShowCalib(true),t:"Calibrate"},{i:"⚙",a:()=>setShowSettings(true),t:"Settings"}]
              .map(b=>(
                <motion.button key={b.i} title={b.t} onClick={b.a} whileTap={{scale:0.88}}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm text-gray-500"
                  style={{background:"rgba(0,0,0,0.05)"}}>
                  {b.i}
                </motion.button>
              ))}
          </div>
        </header>

        {/* Fret range bar */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs text-gray-400 w-8">Frets</span>
          <div className="flex-1 relative h-4 flex items-center">
            <div className="w-full h-0.5 rounded-full" style={{background:"rgba(0,0,0,0.08)"}}/>
            <div className="absolute h-1 rounded-full transition-all" style={{
              left:`${(settings.minFret/15)*100}%`,
              width:`${((settings.maxFret-settings.minFret)/15)*100}%`,
              background:"linear-gradient(90deg,rgba(255,112,67,0.4),rgba(41,182,246,0.4))",
            }}/>
          </div>
          <span className="text-xs text-gray-500 font-mono w-10 text-right">{settings.minFret}–{settings.maxFret}</span>
        </div>

        {/* Main card */}
        <main className="rounded-3xl p-5" style={{
          background:"rgba(255,255,255,0.45)", backdropFilter:"blur(30px)", WebkitBackdropFilter:"blur(30px)",
          border:"1px solid rgba(255,255,255,0.72)",
          boxShadow:"0 16px 52px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.92)",
        }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeTab}
              initial={{opacity:0,x:12}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-12}}
              transition={{duration:0.18}}>
              {activeTab==="note"     && <NoteTrainer {...trainerProps}/>}
              {activeTab==="interval" && <IntervalTrainer {...trainerProps}/>}
              {activeTab==="changes"  && <ChangesTrainer {...trainerProps}/>}
              {activeTab==="scale"    && <ScaleTrainer {...trainerProps}/>}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Interval reference */}
        <div className="mt-4 rounded-3xl p-3" style={{
          background:"rgba(255,255,255,0.3)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.5)"
        }}>
          <div className="flex flex-wrap gap-1 justify-center">
            {INTERVAL_LABELS.map((label,i)=>(
              <div key={i} className="px-2 py-1 rounded-lg text-center" style={{minWidth:32,background:"rgba(0,0,0,0.04)"}}>
                <div className="text-[11px] font-bold text-gray-600">{label}</div>
                <div className="text-[9px] text-gray-400">{i}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-4 px-4">
        <div className="w-full max-w-2xl rounded-3xl" style={{
          background:"rgba(250,249,246,0.72)", backdropFilter:"blur(30px)", WebkitBackdropFilter:"blur(30px)",
          border:"1px solid rgba(255,255,255,0.82)",
          boxShadow:"0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.9)",
        }}>
          <div className="flex">
            {TABS.map(tab=>{
              const active = activeTab===tab.id;
              return (
                <motion.button key={tab.id} onClick={()=>setActiveTab(tab.id)}
                  className="flex-1 flex flex-col items-center py-3 rounded-3xl relative"
                  whileTap={{scale:0.92}}
                  style={{background:active?"rgba(255,112,67,0.1)":"transparent"}}>
                  {active && (
                    <motion.div className="absolute inset-0 rounded-3xl" layoutId="activeTab"
                      style={{background:"rgba(255,112,67,0.1)"}} transition={{type:"spring",stiffness:400,damping:30}}/>
                  )}
                  <span className="text-lg leading-none mb-0.5 relative z-10" style={{opacity:active?1:0.45}}>{tab.icon}</span>
                  <span className="text-[10px] font-semibold relative z-10" style={{color:active?"#FF7043":"#AAAAAA"}}>{tab.label}</span>
                  <span className="text-[9px] relative z-10" style={{color:active?"#FF9800":"#CCCCCC"}}>{tab.chinese}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Modals */}
      <SettingsModal open={showSettings} onClose={()=>setShowSettings(false)} settings={settings} onSettings={setSettings}/>
      <TuningModal open={showTuning} onClose={()=>setShowTuning(false)} tuning={tuning} onTuning={setTuning}/>
      <CalibrationModal open={showCalib} onClose={()=>setShowCalib(false)}/>

      {/* Global styles */}
      <style>{`
        @keyframes breathe { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.14);opacity:0.82} }
        input[type=range]{-webkit-appearance:none;cursor:pointer;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:white;box-shadow:0 1px 6px rgba(0,0,0,0.2);cursor:pointer;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.14);border-radius:2px;}
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
