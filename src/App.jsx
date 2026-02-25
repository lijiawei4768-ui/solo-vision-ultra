import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
// 必须导入这些，否则你代码里的 <Settings />, <Mic /> 等图标会让页面白屏
import { 
  Settings, Music, Mic, MicOff, ChevronRight, 
  RotateCcw, Info, Sliders, Menu, X, Check 
} from "lucide-react";
// 必须导入这个，否则你代码里的 <motion.div> 会让页面崩溃
import { motion, AnimatePresence } from "framer-motion";

/**
 * Solo-Vision Ultra
 * 保持你原有的逻辑和注释
 */

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const INTERVAL_LABELS = ["R","b2","2","b3","3","4","b5","5","b6","6","b7","7"];
const ENHARMONICS = { "C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb" };
const STD_TUNING = [40, 45, 50, 55, 59, 64];
const TUNINGS = {
  "Standard (EADGBe)": [40,45,50,55,59,64],
  "Drop D (DADGBe)": [38,45,50,55,59,64],
  "Open G (DGDGBd)": [38,43,50,55,59,62],
  "DADGAD": [38,45,50,55,57,62],
  "Half Step Down (Eb)": [39,44,49,54,58,63],
};

function getMidi(strIdx, fret, tuning = STD_TUNING) { return tuning[strIdx] + fret; }
function midiToNote(midi) { return NOTE_NAMES[midi % 12]; }
function midiToOctave(midi) { return Math.floor(midi / 12) - 1; }
function getInterval(rootMidi, targetMidi) { return ((targetMidi - rootMidi) % 12 + 12) % 12; }
function noteNameToChroma(name) {
  const base = NOTE_NAMES.indexOf(name);
  if (base >= 0) return base;
  const flatMap = {"Db":1,"Eb":3,"Gb":6,"Ab":8,"Bb":10};
  return flatMap[name] ?? -1;
}
function freqToMidi(freq) {
  if (freq <= 0) return -1;
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

// Find all fret positions for a given note name
function findNotePositions(noteName, tuning = STD_TUNING, minFret = 0, maxFret = 15) {
  const positions = [];
  for (let s = 0; s < 6; s++) {
    for (let f = minFret; f <= maxFret; f++) {
      if (midiToNote(getMidi(s, f, tuning)) === noteName) {
        positions.push({ string: s, fret: f });
      }
    }
  }
  return positions;
}

// Voice leading: find chord tone closest to previous MIDI note
function voiceLeadChordTone(prevMidi, rootName, chordIntervals) {
  const rootChroma = noteNameToChroma(rootName);
  const candidates = [];
  for (let oct = 2; oct <= 6; oct++) {
    for (const iv of chordIntervals) {
      const midi = (oct + 1) * 12 + ((rootChroma + iv) % 12);
      candidates.push(midi);
    }
  }
  return candidates.reduce((best, m) =>
    Math.abs(m - prevMidi) < Math.abs(best - prevMidi) ? m : best
  , candidates[0]);
}

// ─────────────────────────────────────────────────────────────
// CHORD & SCALE DATA
// ─────────────────────────────────────────────────────────────
const CHORD_INTERVALS = {
  "Maj7":  [0,4,7,11], "maj7": [0,4,7,11],
  "m7":    [0,3,7,10],
  "7":     [0,4,7,10],
  "m7b5":  [0,3,6,10],
  "dim7":  [0,3,6,9],
  "Maj6":  [0,4,7,9],  "6":   [0,4,7,9],
  "m6":    [0,3,7,9],
  "sus4":  [0,5,7],
  "7sus4": [0,5,7,10],
  "aug":   [0,4,8],
  "m":     [0,3,7],
  "":      [0,4,7],
};

const SCALES = {
  "Major / Ionian":          [0,2,4,5,7,9,11],
  "Natural Minor / Aeolian": [0,2,3,5,7,8,10],
  "Dorian":                  [0,2,3,5,7,9,10],
  "Phrygian":                [0,1,3,5,7,8,10],
  "Lydian":                  [0,2,4,6,7,9,11],
  "Mixolydian":              [0,2,4,5,7,9,10],
  "Locrian":                 [0,1,3,5,6,8,10],
  "Melodic Minor":           [0,2,3,5,7,9,11],
  "Harmonic Minor":          [0,2,3,5,7,8,11],
  "Harmonic Major":          [0,2,4,5,7,8,11],
  "Lydian Dominant":         [0,2,4,6,7,9,10],
  "Altered / Super Locrian": [0,1,3,4,6,8,10],
  "Whole Tone":              [0,2,4,6,8,10],
  "Diminished (HW)":         [0,1,3,4,6,7,9,10],
  "Diminished (WH)":         [0,2,3,5,6,8,9,11],
  "Pentatonic Major":        [0,2,4,7,9],
  "Pentatonic Minor":        [0,3,5,7,10],
  "Blues Major":             [0,2,3,4,7,9],
  "Blues Minor":             [0,3,5,6,7,10],
  "Bebop Major":             [0,2,4,5,7,8,9,11],
  "Bebop Dominant":          [0,2,4,5,7,9,10,11],
  "Bebop Minor":             [0,2,3,5,7,9,10,11],
  "Spanish Phrygian":        [0,1,4,5,7,8,10],
  "Hungarian Minor":         [0,2,3,6,7,8,11],
  "Romanian":                [0,2,3,6,7,9,10],
};

const JAZZ_STANDARDS = [
  { name:"Autumn Leaves", key:"Gm",
    changes:["Cm7","F7","BbMaj7","EbMaj7","Am7b5","D7","Gm","Gm",
             "Am7b5","D7","Gm","Gm","Cm7","F7","BbMaj7","EbMaj7",
             "Am7b5","D7","Gm","Gm"] },
  { name:"All The Things You Are", key:"Ab",
    changes:["Fm7","Bbm7","Eb7","AbMaj7","DbMaj7","Dm7","G7","CMaj7",
             "Cm7","Fm7","Bb7","EbMaj7","AbMaj7","Am7b5","D7","GMaj7",
             "Am7","D7","GMaj7","F#m7b5","B7","EMaj7","Bbm7","Eb7",
             "AbMaj7","DbMaj7","Dm7","G7","CMaj7","Cm7","Fm7","Bb7",
             "EbMaj7","Am7b5","D7","GMaj7","Fm7","Bb7","EbMaj7"] },
  { name:"There Will Never Be Another You", key:"Eb",
    changes:["EbMaj7","Bbm7","Eb7","AbMaj7","Ab6","Abm7","Db7",
             "EbMaj7","Fm7","Bb7","Gm7","C7","Fm7","Bb7","EbMaj7","Bb7"] },
  { name:"Solar", key:"Cm",
    changes:["Cm","Cm","Gm7","C7","FMaj7","FMaj7","Fm7","Bb7",
             "EbMaj7","EbMaj7","Am7b5","D7","Gm7","G7"] },
  { name:"Stella By Starlight", key:"Bb",
    changes:["Em7b5","A7","Cm7","F7","Fm7","Bb7","EbMaj7","EbMaj7",
             "Am7b5","D7","GMaj7","GMaj7","Bbm7","Eb7","AbMaj7","AbMaj7",
             "Am7b5","D7","GMaj7","Gm7","C7","FMaj7","FMaj7",
             "Fm7","Bb7","EbMaj7","EbMaj7","Dm7b5","G7","Cm","Cm",
             "Am7b5","D7","BbMaj7","BbMaj7"] },
  { name:"Misty", key:"Eb",
    changes:["EbMaj7","Bbm7","Eb7","AbMaj7","Abm7","Db7",
             "EbMaj7","Cm7","Fm7","Bb7","EbMaj7","Ab7",
             "Gm7","C7","Fm7","Bb7","EbMaj7","Gm7","C7",
             "Fm7","Bb7","Gm7","C7","Fm7","Bb7"] },
  { name:"Nardis", key:"Em",
    changes:["Em7","A7","FMaj7","BbMaj7","Em7","Am7","B7","Em7"] },
  { name:"Have You Met Miss Jones", key:"F",
    changes:["FMaj7","Dm7","Gm7","C7","FMaj7","Db7","Gm7","C7",
             "FMaj7","Dm7","Gm7","C7","FMaj7","Fm7","Bb7",
             "BbMaj7","BbMaj7","AbMaj7","AbMaj7","GbMaj7","GbMaj7","Em7","A7",
             "Gm7","C7","FMaj7","Dm7","Gm7","C7","FMaj7"] },
];

// ─────────────────────────────────────────────────────────────
// YIN PITCH DETECTION
// ─────────────────────────────────────────────────────────────
function yinDetect(buffer, sampleRate, threshold = 0.12) {
  const N = buffer.length;
  const half = Math.floor(N / 2);
  const d = new Float32Array(half);
  d[0] = 1;
  let runSum = 0;
  for (let tau = 1; tau < half; tau++) {
    let s = 0;
    for (let i = 0; i < half; i++) {
      const diff = buffer[i] - buffer[i + tau];
      s += diff * diff;
    }
    runSum += s;
    d[tau] = runSum > 0 ? (s * tau) / runSum : 0;
  }
  // Parabolic interpolation for sub-sample precision
  for (let tau = 2; tau < half - 1; tau++) {
    if (d[tau] < threshold && d[tau] <= d[tau - 1] && d[tau] <= d[tau + 1]) {
      const better = tau + (d[tau + 1] - d[tau - 1]) / (2 * (2 * d[tau] - d[tau - 1] - d[tau + 1]));
      return sampleRate / better;
    }
  }
  return -1;
}

function computeRMS(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

// ─────────────────────────────────────────────────────────────
// FRETBOARD SVG COMPONENT
// ─────────────────────────────────────────────────────────────
const FRET_COUNT = 15;
const STRING_COUNT = 6;
const FRET_MARKERS = [3, 5, 7, 9, 12];
const DOUBLE_MARKERS = [12];

function Fretboard({
  tuning = STD_TUNING,
  highlights = [],       // [{string, fret, role}] role: 'root'|'target'
  arcPair = null,        // {from:{string,fret}, to:{string,fret}}
  leftHanded = false,
  minFret = 0,
  maxFret = 15,
  width = 760,
  height = 180,
}) {
  const PAD_L = 36, PAD_R = 20, PAD_T = 18, PAD_B = 18;
  const drawW = width - PAD_L - PAD_R;
  const drawH = height - PAD_T - PAD_B;
  const fretW = drawW / (maxFret - minFret);
  const strSpacing = drawH / (STRING_COUNT - 1);

  // Display: string 5 (high e) at top, string 0 (low E) at bottom
  function sx(fret) {
    const f = leftHanded ? (maxFret - fret + minFret) : fret - minFret;
    return PAD_L + f * fretW;
  }
  function sy(strIdx) {
    // strIdx 0 = low E at bottom → displayRow 5
    const row = (STRING_COUNT - 1) - strIdx;
    return PAD_T + row * strSpacing;
  }

  const noteRadius = Math.min(strSpacing, fretW) * 0.38;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="select-none"
      style={{ fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}
    >
      <defs>
        {/* Root jewel gradient */}
        <radialGradient id="grad-root" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#FFB347"/>
          <stop offset="60%" stopColor="#FF7043"/>
          <stop offset="100%" stopColor="#D84315"/>
        </radialGradient>
        {/* Target jewel gradient */}
        <radialGradient id="grad-target" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#B3E5FC"/>
          <stop offset="60%" stopColor="#29B6F6"/>
          <stop offset="100%" stopColor="#0277BD"/>
        </radialGradient>
        {/* Root glow filter */}
        <filter id="glow-root" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow-target" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        {/* Arc gradient */}
        <linearGradient id="arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FF7043" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#29B6F6" stopOpacity="0.7"/>
        </linearGradient>
      </defs>

      {/* Fret background */}
      <rect x={PAD_L} y={PAD_T} width={drawW} height={drawH}
            fill="rgba(250,249,246,0)" />

      {/* Nut */}
      <rect x={sx(minFret === 0 ? 0 : minFret) - 2} y={PAD_T - 4}
            width={3} height={drawH + 8}
            fill="#9E9E9E" rx={1}/>

      {/* Fret lines */}
      {Array.from({ length: maxFret - minFret + 1 }, (_, i) => i + minFret).map(f => (
        <line key={f}
          x1={sx(f)} y1={PAD_T - 4}
          x2={sx(f)} y2={PAD_T + drawH + 4}
          stroke="#D0D0D0" strokeWidth={0.5}
        />
      ))}

      {/* Fret markers */}
      {FRET_MARKERS.filter(m => m >= minFret && m <= maxFret).map(m => (
        DOUBLE_MARKERS.includes(m) ? (
          <g key={m}>
            <circle cx={sx(m) - fretW/2} cy={PAD_T + drawH/2 - 8} r={3.5} fill="#D0D0D0" opacity={0.6}/>
            <circle cx={sx(m) - fretW/2} cy={PAD_T + drawH/2 + 8} r={3.5} fill="#D0D0D0" opacity={0.6}/>
          </g>
        ) : (
          <circle key={m} cx={sx(m) - fretW/2} cy={PAD_T + drawH/2} r={3.5} fill="#D0D0D0" opacity={0.6}/>
        )
      ))}

      {/* Fret numbers */}
      {[0,3,5,7,9,12,15].filter(f => f >= minFret && f <= maxFret).map(f => (
        <text key={f}
          x={sx(f) - fretW/2} y={height - 3}
          textAnchor="middle" fontSize={9}
          fill="#AAAAAA" fontWeight={300}>
          {f}
        </text>
      ))}

      {/* String lines */}
      {Array.from({ length: STRING_COUNT }, (_, s) => (
        <line key={s}
          x1={PAD_L - 2} y1={sy(s)}
          x2={width - PAD_R + 2} y2={sy(s)}
          stroke="#D0D0D0"
          strokeWidth={0.5 + s * 0.12}
          strokeLinecap="round"
        />
      ))}

      {/* String names */}
      {["E","A","D","G","B","e"].map((name, i) => (
        <text key={i}
          x={PAD_L - 10} y={sy(i) + 4}
          textAnchor="middle" fontSize={9}
          fill="#BBBBBB" fontWeight={300}>
          {name}
        </text>
      ))}

      {/* Arc between root and target */}
      {arcPair && (() => {
        const { from, to } = arcPair;
        const x1 = sx(from.fret) - fretW / 2;
        const y1 = sy(from.string);
        const x2 = sx(to.fret) - fretW / 2;
        const y2 = sy(to.string);
        // Control point lifted above both endpoints
        const cpx = (x1 + x2) / 2;
        const cpy = Math.min(y1, y2) - Math.abs(y2 - y1) * 0.5 - 20;
        return (
          <path
            d={`M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`}
            fill="none"
            stroke="url(#arc-grad)"
            strokeWidth={1.2}
            strokeDasharray="none"
            opacity={0.85}
            style={{
              filter: "drop-shadow(0 0 3px rgba(255,112,67,0.4))"
            }}
          />
        );
      })()}

      {/* Note jewels */}
      {highlights.map(({ string: s, fret: f, role, label }, idx) => {
        const cx = sx(f) - fretW / 2;
        const cy = sy(s);
        const isRoot = role === "root";
        return (
          <g key={idx}>
            {/* Outer glow ring */}
            <circle cx={cx} cy={cy} r={noteRadius + 4}
              fill={isRoot ? "rgba(255,112,67,0.15)" : "rgba(41,182,246,0.12)"}
            />
            <circle cx={cx} cy={cy} r={noteRadius}
              fill={isRoot ? "url(#grad-root)" : "url(#grad-target)"}
              filter={isRoot ? "url(#glow-root)" : "url(#glow-target)"}
              className={isRoot ? "animate-pulse" : ""}
              style={{
                animation: isRoot ? "breathe 2s ease-in-out infinite" : undefined,
              }}
            />
            {/* Specular highlight */}
            <circle cx={cx - noteRadius * 0.25} cy={cy - noteRadius * 0.25}
              r={noteRadius * 0.25}
              fill="rgba(255,255,255,0.55)"
            />
            {label && (
              <text x={cx} y={cy + 4}
                textAnchor="middle"
                fontSize={noteRadius > 9 ? 9 : 7.5}
                fontWeight={600}
                fill="white"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
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
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") await ctx.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      sourceRef.current = ctx.createMediaStreamSource(stream);
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 2048;
      sourceRef.current.connect(analyserRef.current);
      bufferRef.current = new Float32Array(analyserRef.current.fftSize);
      setListening(true);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current.mediaStream?.getTracks().forEach(t => t.stop());
    }
    setListening(false);
    setRms(0);
  }, []);

  // Pitch detection loop
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
        if (freq > 60 && freq < 1400) {
          onPitchDetected?.(freq, r);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { active = false; cancelAnimationFrame(rafRef.current); };
  }, [listening, onPitchDetected]);

  useEffect(() => {
    if (enabled) start();
    else stop();
    return stop;
  }, [enabled]);

  return { rms, listening, error, start, stop };
}

// ─────────────────────────────────────────────────────────────
// GLASS MODAL WRAPPER
// ─────────────────────────────────────────────────────────────
function GlassModal({ open, onClose, title, children, width = "max-w-md" }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ background: "rgba(0,0,0,0.25)" }}
    >
      <div
        className={`w-full ${width} mx-4 mb-4 sm:mb-0 rounded-3xl overflow-hidden`}
        style={{
          background: "rgba(255,255,255,0.4)",
          backdropFilter: "blur(30px)",
          WebkitBackdropFilter: "blur(30px)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "0 32px 64px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3"
          style={{ borderBottom: "1px solid rgba(200,200,200,0.25)" }}>
          <h3 className="font-semibold text-gray-700" style={{ fontSize: 17 }}>{title}</h3>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
            style={{ background: "rgba(0,0,0,0.06)" }}>
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function GlassToggle({ value, onChange, label }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-600">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className="relative w-12 h-6 rounded-full transition-all duration-200"
        style={{
          background: value ? "linear-gradient(135deg,#FF7043,#FF9800)" : "rgba(0,0,0,0.1)",
        }}
      >
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${value ? "left-6" : "left-0.5"}`}/>
      </button>
    </div>
  );
}

function GlassSlider({ min, max, value, onChange, label, unit = "" }) {
  return (
    <div className="py-2">
      <div className="flex justify-between mb-1.5">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-medium text-gray-700">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(+e.target.value)}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #FF7043 0%, #FF7043 ${((value-min)/(max-min))*100}%, rgba(0,0,0,0.1) ${((value-min)/(max-min))*100}%, rgba(0,0,0,0.1) 100%)`
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CALIBRATION MODAL
// ─────────────────────────────────────────────────────────────
function CalibrationModal({ open, onClose }) {
  const [active, setActive] = useState(false);
  const [rms, setRms] = useState(0);
  const [detectedNote, setDetectedNote] = useState("—");
  const [detectedFreq, setDetectedFreq] = useState(0);
  const onPitch = useCallback((freq) => {
    setDetectedFreq(Math.round(freq));
    setDetectedNote(midiToNote(freqToMidi(freq)));
  }, []);
  const { rms: liveRms, error } = useAudioEngine({ onPitchDetected: onPitch, enabled: active });

  useEffect(() => { setRms(liveRms); }, [liveRms]);

  const rmsDb = rms > 0 ? Math.max(-60, 20 * Math.log10(rms)) : -60;
  const rmsPercent = Math.max(0, Math.min(100, ((rmsDb + 60) / 60) * 100));

  return (
    <GlassModal open={open} onClose={() => { setActive(false); onClose(); }}
      title="校准 / Calibration">
      <div className="space-y-5">
        {/* Mic activation */}
        <div className="rounded-2xl p-4 text-center"
          style={{ background: "rgba(255,112,67,0.06)", border: "1px solid rgba(255,112,67,0.15)" }}>
          <button
            onClick={() => setActive(a => !a)}
            className="px-6 py-2.5 rounded-xl font-medium text-sm text-white transition-all"
            style={{
              background: active
                ? "linear-gradient(135deg,#EF5350,#E53935)"
                : "linear-gradient(135deg,#FF7043,#FF9800)"
            }}
          >
            {active ? "⏹ Stop Listening" : "🎤 Start Listening"}
          </button>
        </div>

        {/* RMS Meter */}
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-xs text-gray-500">Signal Level</span>
            <span className="text-xs font-mono text-gray-500">{rmsDb.toFixed(1)} dB</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{
                width: `${rmsPercent}%`,
                background: rmsPercent > 85
                  ? "linear-gradient(90deg,#FF7043,#EF5350)"
                  : rmsPercent > 50
                  ? "linear-gradient(90deg,#FF9800,#FF7043)"
                  : "linear-gradient(90deg,#66BB6A,#FF9800)",
              }}
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[10px] text-gray-400">Silence</span>
            <span className="text-[10px] text-gray-400">Optimal</span>
            <span className="text-[10px] text-gray-400">Clip</span>
          </div>
        </div>

        {/* Detected pitch */}
        <div className="flex gap-3">
          <div className="flex-1 rounded-2xl p-3 text-center"
            style={{ background: "rgba(41,182,246,0.08)", border: "1px solid rgba(41,182,246,0.15)" }}>
            <div className="text-3xl font-bold text-gray-700">{detectedNote}</div>
            <div className="text-xs text-gray-400 mt-0.5">Note</div>
          </div>
          <div className="flex-1 rounded-2xl p-3 text-center"
            style={{ background: "rgba(102,187,106,0.08)", border: "1px solid rgba(102,187,106,0.15)" }}>
            <div className="text-3xl font-bold text-gray-700">{detectedFreq || "—"}</div>
            <div className="text-xs text-gray-400 mt-0.5">Hz</div>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}
        {!error && active && rms < 0.01 && (
          <p className="text-xs text-center text-amber-600">
            Play a note on your guitar to test input…
          </p>
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
      <div className="space-y-1 divide-y divide-gray-100 divide-opacity-50">
        <GlassToggle value={settings.leftHanded} onChange={v => onSettings({...settings, leftHanded: v})}
          label="左手模式 / Left-Handed"/>
        <GlassToggle value={settings.showNoteNames} onChange={v => onSettings({...settings, showNoteNames: v})}
          label="显示音名 / Show Note Names"/>
        <GlassToggle value={settings.showAllPositions} onChange={v => onSettings({...settings, showAllPositions: v})}
          label="显示所有位置 / Show All Positions"/>
        <GlassSlider min={0} max={12} value={settings.minFret} onChange={v => onSettings({...settings, minFret: Math.min(v, settings.maxFret - 1)})}
          label="起始品 / Min Fret"/>
        <GlassSlider min={1} max={15} value={settings.maxFret} onChange={v => onSettings({...settings, maxFret: Math.max(v, settings.minFret + 1)})}
          label="结束品 / Max Fret"/>
        <div className="pt-3">
          <p className="text-xs text-gray-400 text-center">Solo-Vision Ultra v1.0</p>
          <p className="text-xs text-gray-400 text-center">Intervallic Functions Method</p>
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
      <div className="space-y-3">
        {Object.entries(TUNINGS).map(([name, midiArr]) => (
          <button
            key={name}
            onClick={() => { onTuning(midiArr); onClose(); }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left transition-all"
            style={{
              background: JSON.stringify(tuning) === JSON.stringify(midiArr)
                ? "rgba(255,112,67,0.12)" : "rgba(0,0,0,0.04)",
              border: JSON.stringify(tuning) === JSON.stringify(midiArr)
                ? "1px solid rgba(255,112,67,0.3)" : "1px solid transparent",
            }}
          >
            <span className="text-sm font-medium text-gray-700">{name}</span>
            <span className="text-xs text-gray-400 font-mono">
              {midiArr.map(m => midiToNote(m)).join("-")}
            </span>
          </button>
        ))}
      </div>
    </GlassModal>
  );
}

// ─────────────────────────────────────────────────────────────
// TRAINING MODULES
// ─────────────────────────────────────────────────────────────

// ----------- NOTE TRAINER -----------
function NoteTrainer({ settings, tuning, audioEnabled }) {
  const [targetNote, setTargetNote] = useState("C");
  const [status, setStatus] = useState("idle"); // idle | listening | correct | wrong
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [successPos, setSuccessPos] = useState(null);
  const prevMidiRef = useRef(null);

  const genQuestion = useCallback(() => {
    const note = NOTE_NAMES[Math.floor(Math.random() * 12)];
    setTargetNote(note);
    setStatus("listening");
    setSuccessPos(null);
  }, []);

  useEffect(() => { genQuestion(); }, []);

  const onPitchDetected = useCallback((freq) => {
    if (status !== "listening") return;
    const midi = freqToMidi(freq);
    if (midi === prevMidiRef.current) return;
    prevMidiRef.current = midi;
    const played = midiToNote(midi);
    if (played === targetNote) {
      setStatus("correct");
      setStreak(s => s + 1);
      setScore(s => ({ correct: s.correct + 1, total: s.total + 1 }));
      // Find position on fretboard
      const pos = findNotePositions(targetNote, tuning, settings.minFret, settings.maxFret);
      if (pos.length) setSuccessPos(pos[0]);
      setTimeout(genQuestion, 1200);
    } else {
      setScore(s => ({ ...s, total: s.total + 1 }));
      setStreak(0);
      // Flash wrong
      setStatus("wrong");
      setTimeout(() => setStatus("listening"), 400);
    }
  }, [status, targetNote, settings, tuning, genQuestion]);

  const { rms } = useAudioEngine({ onPitchDetected, enabled: audioEnabled });

  const positions = settings.showAllPositions
    ? findNotePositions(targetNote, tuning, settings.minFret, settings.maxFret)
    : successPos ? [{ ...successPos, role: "root", label: targetNote }] : [];

  const highlights = positions.map((p, i) => ({
    ...p, role: "root",
    label: settings.showNoteNames ? targetNote : undefined,
  }));

  return (
    <TrainerLayout
      title="Note Trainer"
      subtitle="Find the note on the fretboard"
      status={status}
      streak={streak}
      score={score}
      rms={rms}
      audioEnabled={audioEnabled}
    >
      <div className="text-center py-6">
        <div className="text-7xl font-black tracking-tighter"
          style={{
            background: "linear-gradient(135deg,#FF7043,#FF9800)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
          }}>
          {targetNote}
        </div>
        <div className="text-gray-400 text-sm mt-1">Find this note</div>
      </div>
      <FretboardContainer settings={settings} highlights={highlights} tuning={tuning}/>
    </TrainerLayout>
  );
}

// ----------- INTERVAL TRAINER -----------
function IntervalTrainer({ settings, tuning, audioEnabled }) {
  const [intervals, setIntervals] = useState([3, 5, 7]);
  const [fixedRoot, setFixedRoot] = useState(null);
  const [question, setQuestion] = useState(null); // {rootStr, rootFret, targetStr, targetFret, intervalIdx}
  const [status, setStatus] = useState("idle");
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [showIntervalPicker, setShowIntervalPicker] = useState(false);
  const prevMidiRef = useRef(null);

  const genQuestion = useCallback(() => {
    // Pick random root
    const rootStr = Math.floor(Math.random() * 6);
    const rootFret = settings.minFret + Math.floor(Math.random() * (settings.maxFret - settings.minFret));
    // Pick random interval from selected
    const iv = intervals[Math.floor(Math.random() * intervals.length)];
    const rootMidi = getMidi(rootStr, rootFret, tuning);
    const targetMidi = rootMidi + iv;
    // Find target on adjacent strings (prefer 1-2 strings up)
    const candidates = [];
    for (let s = 0; s < 6; s++) {
      for (let f = settings.minFret; f <= settings.maxFret; f++) {
        if (getMidi(s, f, tuning) === targetMidi && !(s === rootStr && f === rootFret)) {
          candidates.push({ string: s, fret: f });
        }
      }
    }
    if (!candidates.length) { genQuestion(); return; }
    // Prefer same string or adjacent
    const pref = candidates.filter(c => Math.abs(c.string - rootStr) <= 2);
    const pick = (pref.length ? pref : candidates)[Math.floor(Math.random() * (pref.length || candidates.length))];
    setQuestion({ rootStr, rootFret, targetStr: pick.string, targetFret: pick.fret, intervalIdx: iv });
    setStatus("listening");
  }, [intervals, settings, tuning]);

  useEffect(() => { genQuestion(); }, []);

  const onPitchDetected = useCallback((freq) => {
    if (status !== "listening" || !question) return;
    const midi = freqToMidi(freq);
    if (midi === prevMidiRef.current) return;
    prevMidiRef.current = midi;
    const targetMidi = getMidi(question.targetStr, question.targetFret, tuning);
    if (Math.abs(midi - targetMidi) <= 1) {
      setStatus("correct");
      setStreak(s => s + 1);
      setScore(s => ({ correct: s.correct + 1, total: s.total + 1 }));
      setTimeout(genQuestion, 1200);
    } else {
      const rootMidi = getMidi(question.rootStr, question.rootFret, tuning);
      if (Math.abs(midi - rootMidi) > 1) {
        setScore(s => ({ ...s, total: s.total + 1 }));
        setStreak(0);
        setStatus("wrong");
        setTimeout(() => setStatus("listening"), 400);
      }
    }
  }, [status, question, tuning, genQuestion]);

  const { rms } = useAudioEngine({ onPitchDetected, enabled: audioEnabled });

  const highlights = question ? [
    { string: question.rootStr, fret: question.rootFret, role: "root", label: "R" },
    ...(status === "correct" ? [{ string: question.targetStr, fret: question.targetFret, role: "target", label: INTERVAL_LABELS[question.intervalIdx] }] : []),
  ] : [];

  const arcPair = (status === "correct" && question) ? {
    from: { string: question.rootStr, fret: question.rootFret },
    to: { string: question.targetStr, fret: question.targetFret },
  } : null;

  const rootNote = question ? midiToNote(getMidi(question.rootStr, question.rootFret, tuning)) : "—";
  const intervalName = question ? INTERVAL_LABELS[question.intervalIdx] : "—";

  return (
    <TrainerLayout title="Interval Trainer" subtitle="Find the interval" status={status} streak={streak} score={score} rms={rms} audioEnabled={audioEnabled}>
      {/* Interval selector */}
      <div className="flex flex-wrap gap-2 justify-center mb-4">
        {INTERVAL_LABELS.slice(1).map((label, i) => {
          const iv = i + 1;
          const sel = intervals.includes(iv);
          return (
            <button key={iv}
              onClick={() => setIntervals(prev =>
                sel && prev.length > 1 ? prev.filter(x => x !== iv) : [...new Set([...prev, iv])].sort((a,b)=>a-b)
              )}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: sel ? "linear-gradient(135deg,#29B6F6,#0277BD)" : "rgba(0,0,0,0.06)",
                color: sel ? "white" : "#666",
                border: sel ? "1px solid rgba(41,182,246,0.4)" : "1px solid transparent",
              }}
            >{label}</button>
          );
        })}
      </div>

      {/* Question display */}
      <div className="text-center py-4">
        <div className="text-sm text-gray-400 mb-1">Find the interval</div>
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-5xl font-black"
            style={{ background:"linear-gradient(135deg,#29B6F6,#0277BD)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            {intervalName}
          </span>
          <span className="text-2xl text-gray-400 font-light">of</span>
          <span className="text-5xl font-black"
            style={{ background:"linear-gradient(135deg,#FF7043,#FF9800)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            {rootNote}
          </span>
        </div>
      </div>

      <FretboardContainer settings={settings} highlights={highlights} tuning={tuning} arcPair={arcPair}/>
    </TrainerLayout>
  );
}

// ----------- CHANGES TRAINER -----------
function ChangesTrainer({ settings, tuning, audioEnabled }) {
  const [selectedStd, setSelectedStd] = useState(0);
  const [chordIdx, setChordIdx] = useState(0);
  const [prevMidi, setPrevMidi] = useState(60);
  const [targetMidi, setTargetMidi] = useState(60);
  const [status, setStatus] = useState("idle");
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [showStdPicker, setShowStdPicker] = useState(false);
  const prevMidiRef = useRef(null);

  const std = JAZZ_STANDARDS[selectedStd];
  const currentChord = std.changes[chordIdx % std.changes.length];

  // Parse chord: "Am7" → root "A", type "m7"
  function parseChord(chordStr) {
    const m = chordStr.match(/^([A-G][b#]?)(.*)$/);
    if (!m) return { root: "C", type: "Maj7" };
    return { root: m[1], type: m[2] || "" };
  }

  const genTarget = useCallback((chord, prev) => {
    const { root, type } = parseChord(chord);
    const ivs = CHORD_INTERVALS[type] ?? CHORD_INTERVALS["Maj7"];
    const rootChroma = noteNameToChroma(root);
    if (rootChroma < 0) return prev;
    return voiceLeadChordTone(prev, root, ivs);
  }, []);

  useEffect(() => {
    const t = genTarget(currentChord, prevMidi);
    setTargetMidi(t);
    setStatus("listening");
  }, [chordIdx, selectedStd]);

  const onPitchDetected = useCallback((freq) => {
    if (status !== "listening") return;
    const midi = freqToMidi(freq);
    if (midi === prevMidiRef.current) return;
    prevMidiRef.current = midi;
    if (Math.abs(midi - targetMidi) <= 1) {
      setStatus("correct");
      setStreak(s => s + 1);
      setScore(s => ({ correct: s.correct + 1, total: s.total + 1 }));
      setPrevMidi(midi);
      setTimeout(() => {
        setChordIdx(i => i + 1);
      }, 900);
    } else {
      const { root } = parseChord(currentChord);
      const rootChroma = noteNameToChroma(root);
      const ivs = CHORD_INTERVALS[parseChord(currentChord).type] ?? CHORD_INTERVALS["Maj7"];
      const isChordTone = ivs.some(iv => ((midi - rootChroma) % 12 + 12) % 12 === iv);
      if (!isChordTone) {
        setScore(s => ({ ...s, total: s.total + 1 }));
        setStreak(0);
        setStatus("wrong");
        setTimeout(() => setStatus("listening"), 400);
      }
    }
  }, [status, targetMidi, currentChord]);

  const { rms } = useAudioEngine({ onPitchDetected, enabled: audioEnabled });

  const targetNote = midiToNote(targetMidi);
  const targetPos = findNotePositions(targetNote, tuning, settings.minFret, settings.maxFret);
  const highlights = status === "correct" && targetPos.length
    ? [{ ...targetPos[0], role: "target", label: targetNote }] : [];

  const nextChord = std.changes[(chordIdx + 1) % std.changes.length];

  return (
    <TrainerLayout title="Changes Trainer" subtitle="Voice leading through changes" status={status} streak={streak} score={score} rms={rms} audioEnabled={audioEnabled}>
      {/* Standard selector */}
      <button
        onClick={() => setShowStdPicker(true)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl mb-4 text-left"
        style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)" }}>
        <span className="font-semibold text-gray-700 text-sm">{std.name}</span>
        <span className="text-xs text-gray-400">Change ▾</span>
      </button>

      {/* Current chord */}
      <div className="text-center py-4">
        <div className="text-xs text-gray-400 mb-2 tracking-widest uppercase">Play chord tone of</div>
        <div className="text-6xl font-black mb-2"
          style={{ background:"linear-gradient(135deg,#FF7043,#FF9800)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          {currentChord}
        </div>
        <div className="text-sm text-gray-400">
          Voice lead to → <span className="text-gray-600 font-semibold">{nextChord}</span>
        </div>
        {status === "correct" && (
          <div className="mt-2 text-sm font-semibold"
            style={{ color: "#FF7043" }}>
            ✓ {targetNote} — Voice leading!
          </div>
        )}
      </div>

      <FretboardContainer settings={settings} highlights={highlights} tuning={tuning}/>

      {/* Chord progress dots */}
      <div className="flex justify-center gap-1 mt-3 flex-wrap">
        {std.changes.map((c, i) => (
          <div key={i}
            className="w-1.5 h-1.5 rounded-full transition-all"
            style={{
              background: i === chordIdx % std.changes.length
                ? "#FF7043"
                : i < chordIdx % std.changes.length
                ? "rgba(255,112,67,0.3)"
                : "rgba(0,0,0,0.1)"
            }}
          />
        ))}
      </div>

      {/* Standard picker modal */}
      <GlassModal open={showStdPicker} onClose={() => setShowStdPicker(false)}
        title="Jazz Standards" width="max-w-sm">
        <div className="space-y-2">
          {JAZZ_STANDARDS.map((s, i) => (
            <button key={i}
              onClick={() => { setSelectedStd(i); setChordIdx(0); setShowStdPicker(false); }}
              className="w-full text-left px-4 py-2.5 rounded-2xl transition-all text-sm"
              style={{
                background: selectedStd === i ? "rgba(255,112,67,0.1)" : "rgba(0,0,0,0.04)",
                border: selectedStd === i ? "1px solid rgba(255,112,67,0.25)" : "1px solid transparent",
                color: selectedStd === i ? "#E64A19" : "#555",
                fontWeight: selectedStd === i ? 600 : 400,
              }}>
              {s.name} <span className="text-xs text-gray-400 ml-1">({s.key})</span>
            </button>
          ))}
        </div>
      </GlassModal>
    </TrainerLayout>
  );
}

// ----------- SCALE TRAINER -----------
function ScaleTrainer({ settings, tuning, audioEnabled }) {
  const scaleNames = Object.keys(SCALES);
  const [selectedScale, setSelectedScale] = useState("Dorian");
  const [rootNote, setRootNote] = useState("A");
  const [seqMode, setSeqMode] = useState("ascending"); // ascending | descending | random
  const [scaleNoteIdx, setScaleNoteIdx] = useState(0);
  const [status, setStatus] = useState("idle");
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [showScalePicker, setShowScalePicker] = useState(false);
  const prevMidiRef = useRef(null);

  const scaleDegrees = useMemo(() => {
    const rootChroma = noteNameToChroma(rootNote);
    const ivs = SCALES[selectedScale] ?? SCALES["Dorian"];
    return ivs.map(iv => (rootChroma + iv) % 12);
  }, [rootNote, selectedScale]);

  const scaleIntervals = SCALES[selectedScale] ?? [];
  const currentTarget = scaleIntervals[scaleNoteIdx % scaleIntervals.length];
  const currentTargetNote = NOTE_NAMES[(noteNameToChroma(rootNote) + currentTarget) % 12];

  const onPitchDetected = useCallback((freq) => {
    if (status !== "listening") return;
    const midi = freqToMidi(freq);
    if (midi === prevMidiRef.current) return;
    prevMidiRef.current = midi;
    const played = midi % 12;
    const targetChroma = (noteNameToChroma(rootNote) + currentTarget) % 12;
    if (played === targetChroma) {
      setStatus("correct");
      setStreak(s => s + 1);
      setScore(s => ({ correct: s.correct + 1, total: s.total + 1 }));
      setTimeout(() => {
        let next;
        if (seqMode === "ascending") next = (scaleNoteIdx + 1) % scaleIntervals.length;
        else if (seqMode === "descending") next = (scaleNoteIdx - 1 + scaleIntervals.length) % scaleIntervals.length;
        else next = Math.floor(Math.random() * scaleIntervals.length);
        setScaleNoteIdx(next);
        setStatus("listening");
      }, 800);
    }
  }, [status, rootNote, currentTarget, scaleNoteIdx, scaleIntervals, seqMode]);

  const { rms } = useAudioEngine({ onPitchDetected, enabled: audioEnabled });

  useEffect(() => { setStatus("listening"); setScaleNoteIdx(0); }, [selectedScale, rootNote]);

  // Highlight: root + all scale notes dimly, current target brightly
  const highlights = [];
  for (let s = 0; s < 6; s++) {
    for (let f = settings.minFret; f <= settings.maxFret; f++) {
      const chroma = getMidi(s, f, tuning) % 12;
      const rootChroma = noteNameToChroma(rootNote);
      const targetChroma = (rootChroma + currentTarget) % 12;
      if (chroma === rootChroma) {
        highlights.push({ string: s, fret: f, role: "root", label: settings.showNoteNames ? rootNote : "R" });
      } else if (chroma === targetChroma) {
        highlights.push({ string: s, fret: f, role: "target", label: settings.showNoteNames ? currentTargetNote : INTERVAL_LABELS[currentTarget] });
      }
    }
  }

  return (
    <TrainerLayout title="Scale Trainer" subtitle="Navigate scale degrees" status={status} streak={streak} score={score} rms={rms} audioEnabled={audioEnabled}>
      {/* Controls */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {/* Root note */}
        <div className="flex gap-1 flex-wrap">
          {NOTE_NAMES.map(n => (
            <button key={n}
              onClick={() => setRootNote(n)}
              className="w-8 h-8 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: rootNote === n ? "linear-gradient(135deg,#FF7043,#FF9800)" : "rgba(0,0,0,0.06)",
                color: rootNote === n ? "white" : "#555",
              }}
            >{n}</button>
          ))}
        </div>
      </div>

      {/* Scale + sequence */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setShowScalePicker(true)}
          className="flex-1 px-3 py-2.5 rounded-2xl text-sm font-medium text-left"
          style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)" }}>
          <span className="text-gray-700">{selectedScale}</span>
          <span className="text-gray-400 ml-1 text-xs">▾</span>
        </button>
        {["ascending","descending","random"].map(m => (
          <button key={m}
            onClick={() => setSeqMode(m)}
            className="px-3 py-2 rounded-2xl text-xs font-medium transition-all capitalize"
            style={{
              background: seqMode === m ? "rgba(41,182,246,0.12)" : "rgba(0,0,0,0.04)",
              color: seqMode === m ? "#0277BD" : "#777",
              border: seqMode === m ? "1px solid rgba(41,182,246,0.3)" : "1px solid transparent",
            }}>
            {m === "ascending" ? "↑" : m === "descending" ? "↓" : "⟳"}
          </button>
        ))}
      </div>

      {/* Question */}
      <div className="text-center py-3">
        <div className="text-xs text-gray-400 mb-1 tracking-widest uppercase">Play</div>
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-5xl font-black"
            style={{ background:"linear-gradient(135deg,#29B6F6,#0277BD)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            {INTERVAL_LABELS[currentTarget]}
          </span>
          <span className="text-2xl text-gray-400 font-light">of</span>
          <span className="text-5xl font-black"
            style={{ background:"linear-gradient(135deg,#FF7043,#FF9800)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            {rootNote}
          </span>
        </div>
        <div className="text-sm text-gray-400 mt-1">{selectedScale}</div>
        {/* Scale degree dots */}
        <div className="flex justify-center gap-1.5 mt-3">
          {scaleIntervals.map((_, i) => (
            <div key={i}
              className="w-2 h-2 rounded-full transition-all"
              style={{
                background: i === scaleNoteIdx % scaleIntervals.length
                  ? "#29B6F6"
                  : "rgba(0,0,0,0.12)"
              }}
            />
          ))}
        </div>
      </div>

      <FretboardContainer settings={settings} highlights={highlights} tuning={tuning}/>

      {/* Scale picker */}
      <GlassModal open={showScalePicker} onClose={() => setShowScalePicker(false)}
        title="Select Scale" width="max-w-sm">
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {scaleNames.map(name => (
            <button key={name}
              onClick={() => { setSelectedScale(name); setShowScalePicker(false); }}
              className="w-full text-left px-4 py-2 rounded-xl transition-all text-sm"
              style={{
                background: selectedScale === name ? "rgba(41,182,246,0.1)" : "rgba(0,0,0,0.04)",
                color: selectedScale === name ? "#0277BD" : "#555",
                fontWeight: selectedScale === name ? 600 : 400,
              }}>
              {name}
              <span className="text-xs text-gray-400 ml-2">
                [{(SCALES[name]||[]).map(iv => INTERVAL_LABELS[iv]).join(" ")}]
              </span>
            </button>
          ))}
        </div>
      </GlassModal>
    </TrainerLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────
function FretboardContainer({ settings, highlights, tuning, arcPair }) {
  return (
    <div className="rounded-3xl overflow-hidden p-3"
      style={{
        background: "rgba(255,255,255,0.5)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.7)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
      }}>
      <Fretboard
        tuning={tuning}
        highlights={highlights}
        arcPair={arcPair}
        leftHanded={false}
        minFret={settings.minFret}
        maxFret={settings.maxFret}
        width={700}
        height={175}
      />
    </div>
  );
}

function StatusBadge({ status }) {
  const configs = {
    idle: { text: "Ready", bg: "rgba(0,0,0,0.06)", color: "#999" },
    listening: { text: "Listening…", bg: "rgba(41,182,246,0.12)", color: "#0277BD" },
    correct: { text: "✓ Correct!", bg: "rgba(102,187,106,0.15)", color: "#2E7D32" },
    wrong: { text: "✗ Try again", bg: "rgba(239,83,80,0.12)", color: "#C62828" },
  };
  const c = configs[status] || configs.idle;
  return (
    <span className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
      style={{ background: c.bg, color: c.color }}>
      {c.text}
    </span>
  );
}

function RmsIndicator({ rms, enabled }) {
  if (!enabled) return null;
  const pct = Math.min(100, rms * 600);
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
        <div className="h-full rounded-full transition-all duration-75"
          style={{
            width: `${pct}%`,
            background: pct > 80 ? "#EF5350" : pct > 40 ? "#FF9800" : "#66BB6A",
          }}/>
      </div>
      <span className="text-[10px] text-gray-400">🎤</span>
    </div>
  );
}

function TrainerLayout({ title, subtitle, status, streak, score, rms, audioEnabled, children }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-800 text-lg leading-tight">{title}</h2>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <RmsIndicator rms={rms} enabled={audioEnabled}/>
          <StatusBadge status={status}/>
          {streak > 1 && (
            <span className="px-2 py-1 rounded-full text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg,#FF7043,#FF9800)" }}>
              🔥 {streak}
            </span>
          )}
        </div>
      </div>
      {/* Score */}
      {score.total > 0 && (
        <div className="flex gap-3">
          <div className="px-3 py-1.5 rounded-2xl text-xs"
            style={{ background: "rgba(102,187,106,0.1)", color: "#2E7D32" }}>
            ✓ {score.correct}
          </div>
          <div className="px-3 py-1.5 rounded-2xl text-xs"
            style={{ background: "rgba(0,0,0,0.05)", color: "#777" }}>
            Total {score.total}
          </div>
          <div className="px-3 py-1.5 rounded-2xl text-xs font-semibold"
            style={{
              background: "rgba(41,182,246,0.1)",
              color: "#0277BD"
            }}>
            {Math.round((score.correct / score.total) * 100)}%
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
const TABS = [
  { id: "note", label: "Notes", icon: "♩", chinese: "音符" },
  { id: "interval", label: "Intervals", icon: "◎", chinese: "音程" },
  { id: "changes", label: "Changes", icon: "♫", chinese: "进行" },
  { id: "scale", label: "Scales", icon: "≋", chinese: "音阶" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("interval");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTuning, setShowTuning] = useState(false);
  const [showCalib, setShowCalib] = useState(false);
  const [tuning, setTuning] = useState(STD_TUNING);
  const [settings, setSettings] = useState({
    leftHanded: false,
    showNoteNames: false,
    showAllPositions: false,
    minFret: 0,
    maxFret: 12,
  });

  const toggleAudio = useCallback(async () => {
    if (!audioEnabled) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setAudioEnabled(true);
      } catch {
        setShowCalib(true);
      }
    } else {
      setAudioEnabled(false);
    }
  }, [audioEnabled]);

  const trainerProps = { settings, tuning, audioEnabled };

  return (
    <div className="min-h-screen" style={{ background: "#FAF9F6", fontFamily: "-apple-system,'SF Pro Display',sans-serif" }}>
      {/* Subtle background texture */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,112,67,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(41,182,246,0.04) 0%, transparent 50%)",
      }}/>

      <div className="relative z-10 max-w-2xl mx-auto px-4 pb-32">
        {/* Top Header */}
        <header className="pt-12 pb-6 flex items-start justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-black tracking-tight text-gray-800">Solo-Vision</h1>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                style={{ background: "linear-gradient(135deg,#FF7043,#FF9800)" }}>
                Ultra
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Intervallic Functions Training</p>
          </div>
          {/* Top right controls */}
          <div className="flex items-center gap-2 mt-1">
            {/* Mic toggle */}
            <button
              onClick={toggleAudio}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: audioEnabled
                  ? "linear-gradient(135deg,#66BB6A,#43A047)"
                  : "rgba(0,0,0,0.07)",
                color: audioEnabled ? "white" : "#777",
                boxShadow: audioEnabled ? "0 2px 8px rgba(102,187,106,0.35)" : "none",
              }}
            >
              {audioEnabled ? "🎤 ON" : "🎤 OFF"}
            </button>
            {/* Settings buttons */}
            {[
              { label: "♩", action: () => setShowTuning(true), title: "Tuning" },
              { label: "◈", action: () => setShowCalib(true), title: "Calibrate" },
              { label: "⚙", action: () => setShowSettings(true), title: "Settings" },
            ].map(b => (
              <button key={b.label}
                title={b.title}
                onClick={b.action}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
                style={{ background: "rgba(0,0,0,0.05)" }}>
                {b.label}
              </button>
            ))}
          </div>
        </header>

        {/* Fret range indicator */}
        <div className="mb-5 flex items-center gap-3">
          <span className="text-xs text-gray-400">Frets</span>
          <div className="flex-1 relative h-5 flex items-center">
            <div className="w-full h-0.5 rounded-full" style={{ background: "rgba(0,0,0,0.08)" }}/>
            <div
              className="absolute h-1 rounded-full transition-all"
              style={{
                left: `${(settings.minFret / 15) * 100}%`,
                width: `${((settings.maxFret - settings.minFret) / 15) * 100}%`,
                background: "linear-gradient(90deg,rgba(255,112,67,0.3),rgba(41,182,246,0.3))",
              }}
            />
            <div className="absolute flex justify-between w-full pointer-events-none">
              {[0,3,5,7,9,12,15].map(f => (
                <div key={f} className="flex flex-col items-center">
                  <div className="w-px h-2" style={{ background: "rgba(0,0,0,0.1)" }}/>
                </div>
              ))}
            </div>
          </div>
          <span className="text-xs text-gray-500 font-mono">{settings.minFret}–{settings.maxFret}</span>
        </div>

        {/* Main content */}
        <main className="rounded-3xl p-5"
          style={{
            background: "rgba(255,255,255,0.45)",
            backdropFilter: "blur(30px)",
            WebkitBackdropFilter: "blur(30px)",
            border: "1px solid rgba(255,255,255,0.7)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)",
          }}>
          {activeTab === "note" && <NoteTrainer {...trainerProps}/>}
          {activeTab === "interval" && <IntervalTrainer {...trainerProps}/>}
          {activeTab === "changes" && <ChangesTrainer {...trainerProps}/>}
          {activeTab === "scale" && <ScaleTrainer {...trainerProps}/>}
        </main>

        {/* Interval reference card */}
        <div className="mt-4 rounded-3xl p-4"
          style={{
            background: "rgba(255,255,255,0.3)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.5)",
          }}>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {INTERVAL_LABELS.map((label, i) => (
              <div key={i}
                className="px-2 py-1 rounded-lg text-center"
                style={{ minWidth: 36, background: "rgba(0,0,0,0.04)" }}>
                <div className="text-xs font-bold text-gray-600">{label}</div>
                <div className="text-[9px] text-gray-400">{i}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40">
        <div
          className="max-w-2xl mx-auto mx-4 mb-4 rounded-3xl"
          style={{
            background: "rgba(250,249,246,0.7)",
            backdropFilter: "blur(30px)",
            WebkitBackdropFilter: "blur(30px)",
            border: "1px solid rgba(255,255,255,0.8)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.9)",
            margin: "0 16px 16px",
          }}>
          <div className="flex">
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 flex flex-col items-center py-3 rounded-3xl transition-all"
                  style={{
                    background: active ? "rgba(255,112,67,0.1)" : "transparent",
                  }}
                >
                  <span className="text-lg leading-none mb-0.5" style={{ opacity: active ? 1 : 0.5 }}>
                    {tab.icon}
                  </span>
                  <span className="text-[10px] font-semibold"
                    style={{ color: active ? "#FF7043" : "#AAAAAA" }}>
                    {tab.label}
                  </span>
                  <span className="text-[9px]" style={{ color: active ? "#FF9800" : "#CCCCCC" }}>
                    {tab.chinese}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Modals */}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)}
        settings={settings} onSettings={setSettings}/>
      <TuningModal open={showTuning} onClose={() => setShowTuning(false)}
        tuning={tuning} onTuning={setTuning}/>
      <CalibrationModal open={showCalib} onClose={() => setShowCalib(false)}/>

      {/* Global styles */}
      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.85; }
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px; height: 18px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 1px 6px rgba(0,0,0,0.2);
          cursor: pointer;
        }
        input[type=range] { -webkit-appearance: none; cursor: pointer; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 2px; }

        
      `}</style>
    </div>
  );
}
