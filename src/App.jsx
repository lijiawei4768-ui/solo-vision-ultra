import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const NOTE_NAMES     = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const FLAT_NAMES     = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
const INTERVAL_LABELS= ["R","b2","2","b3","3","4","b5","5","b6","6","b7","7"];
const FRET_MARKERS   = [3,5,7,9,12];
const DOUBLE_MARKERS = [12];

// ─────────────────────────────────────────────────────────────
// INSTRUMENTS — supports 4/5-string bass and 6/7-string guitar
// ─────────────────────────────────────────────────────────────
const INSTRUMENTS = {
  "6-String Guitar": {
    defaultTuning: [40,45,50,55,59,64],
    tunings: {
      "Standard (EADGBe)":   [40,45,50,55,59,64],
      "Drop D (DADGBe)":     [38,45,50,55,59,64],
      "Open G (DGDGBd)":     [38,43,50,55,59,62],
      "DADGAD":              [38,45,50,55,57,62],
      "Half Step Down (Eb)": [39,44,49,54,58,63],
    },
    stringNames: ["E","A","D","G","B","e"],
  },
  "7-String Guitar": {
    defaultTuning: [35,40,45,50,55,59,64],
    tunings: {
      "Standard (BEADGBe)":  [35,40,45,50,55,59,64],
      "Drop A (AEADGBe)":    [33,40,45,50,55,59,64],
    },
    stringNames: ["B","E","A","D","G","B","e"],
  },
  "4-String Bass": {
    defaultTuning: [28,33,38,43],
    tunings: {
      "Standard (EADG)":     [28,33,38,43],
      "Drop D (DADG)":       [26,33,38,43],
    },
    stringNames: ["E","A","D","G"],
  },
  "5-String Bass": {
    defaultTuning: [23,28,33,38,43],
    tunings: {
      "Standard (BEADG)":    [23,28,33,38,43],
    },
    stringNames: ["B","E","A","D","G"],
  },
};

// ─────────────────────────────────────────────────────────────
// CHORD & SCALE DATA
// ─────────────────────────────────────────────────────────────
const CHORD_INTERVALS = {
  "Maj7":[0,4,7,11],"maj7":[0,4,7,11],"M7":[0,4,7,11],
  "m7":[0,3,7,10],"7":[0,4,7,10],
  "m7b5":[0,3,6,10],"ø7":[0,3,6,10],
  "dim7":[0,3,6,9],
  "Maj6":[0,4,7,9],"6":[0,4,7,9],
  "m6":[0,3,7,9],
  "sus4":[0,5,7],"7sus4":[0,5,7,10],
  "aug":[0,4,8],
  "m9":[0,3,7,10,14],"9":[0,4,7,10,14],"Maj9":[0,4,7,11,14],
  "m":[0,3,7],
  "":[0,4,7],
};
const CHORD_TONE_LABELS = {0:"R",1:"b2",2:"2",3:"b3",4:"3",5:"4",6:"b5",7:"5",8:"b6",9:"6",10:"b7",11:"7"};

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
  "Bebop Dominant":          [0,2,4,5,7,9,10,11],
  "Spanish Phrygian":        [0,1,4,5,7,8,10],
  "Hungarian Minor":         [0,2,3,6,7,8,11],
  "Lydian Augmented":        [0,2,4,6,8,9,11],
  "Phrygian Dominant":       [0,1,4,5,7,8,10],
  "Double Harmonic":         [0,1,4,5,7,8,11],
};

// ─────────────────────────────────────────────────────────────
// DIFFICULTY LEVELS
// ─────────────────────────────────────────────────────────────
const DIFFICULTY_LEVELS = [
  { id:1, label:"Root",      short:"R",   maxTones:1, desc:"Root note only" },
  { id:2, label:"Root+5",    short:"R+5", maxTones:2, desc:"Root and fifth" },
  { id:3, label:"Triad",     short:"Tri", maxTones:3, desc:"Root, 3rd, 5th" },
  { id:4, label:"7th Chord", short:"7th", maxTones:4, desc:"Full 7th chord tones" },
  { id:5, label:"Voice Lead",short:"VL",  maxTones:99,desc:"Smooth voice leading" },
];

// ─────────────────────────────────────────────────────────────
// PROGRESSIONS — 52 total across 8 categories
// ─────────────────────────────────────────────────────────────
const PROGRESSIONS = [
  // ── BASICS ──
  { name:"Single – Maj7",          cat:"Basics",   key:"C",  changes:["CMaj7","CMaj7","CMaj7","CMaj7"] },
  { name:"Single – m7",            cat:"Basics",   key:"Dm", changes:["Dm7","Dm7","Dm7","Dm7"] },
  { name:"Single – Dom 7",         cat:"Basics",   key:"G",  changes:["G7","G7","G7","G7"] },
  { name:"Single – m7b5",          cat:"Basics",   key:"B",  changes:["Bm7b5","Bm7b5","Bm7b5","Bm7b5"] },
  { name:"Two-Chord: Dm7–G7",      cat:"Basics",   key:"Dm", changes:["Dm7","G7","Dm7","G7"] },
  // ── ii–V–I ──
  { name:"ii-V-I in C (Major)",    cat:"ii-V-I",   key:"C",  changes:["Dm7","G7","CMaj7","CMaj7"] },
  { name:"ii-V-I in F (Major)",    cat:"ii-V-I",   key:"F",  changes:["Gm7","C7","FMaj7","FMaj7"] },
  { name:"ii-V-I in Bb (Major)",   cat:"ii-V-I",   key:"Bb", changes:["Cm7","F7","BbMaj7","BbMaj7"] },
  { name:"ii-V-I in Eb (Major)",   cat:"ii-V-I",   key:"Eb", changes:["Fm7","Bb7","EbMaj7","EbMaj7"] },
  { name:"ii-V-I in Ab (Major)",   cat:"ii-V-I",   key:"Ab", changes:["Bbm7","Eb7","AbMaj7","AbMaj7"] },
  { name:"ii-V-i in Dm (Minor)",   cat:"ii-V-I",   key:"Dm", changes:["Em7b5","A7","Dm","Dm"] },
  { name:"ii-V-i in Cm (Minor)",   cat:"ii-V-I",   key:"Cm", changes:["Dm7b5","G7","Cm","Cm"] },
  { name:"ii-V-i in Gm (Minor)",   cat:"ii-V-I",   key:"Gm", changes:["Am7b5","D7","Gm","Gm"] },
  { name:"ii-V-I + Turnaround",    cat:"ii-V-I",   key:"C",  changes:["Dm7","G7","CMaj7","Am7","Dm7","G7","CMaj7","CMaj7"] },
  { name:"Tritone Sub ii-V-I",     cat:"ii-V-I",   key:"C",  changes:["Dm7","Db7","CMaj7","CMaj7"] },
  { name:"Descending ii-V-Is",     cat:"ii-V-I",   key:"C",  changes:["Dm7","G7","CMaj7","Cm7","F7","BbMaj7","Bbm7","Eb7","AbMaj7","AbMaj7"] },
  { name:"4-Key ii-V Chain",       cat:"ii-V-I",   key:"C",  changes:["Dm7","G7","Gm7","C7","Cm7","F7","Fm7","Bb7"] },
  // ── BLUES ──
  { name:"12-Bar Blues in G",      cat:"Blues",    key:"G",  changes:["G7","G7","G7","G7","C7","C7","G7","G7","D7","C7","G7","D7"] },
  { name:"12-Bar Blues in F",      cat:"Blues",    key:"F",  changes:["F7","F7","F7","F7","Bb7","Bb7","F7","F7","C7","Bb7","F7","C7"] },
  { name:"12-Bar Blues in Bb",     cat:"Blues",    key:"Bb", changes:["Bb7","Bb7","Bb7","Bb7","Eb7","Eb7","Bb7","Bb7","F7","Eb7","Bb7","F7"] },
  { name:"Minor Blues in Am",      cat:"Blues",    key:"Am", changes:["Am7","Am7","Am7","Am7","Dm7","Dm7","Am7","Am7","Em7","Dm7","Am7","Em7"] },
  { name:"Jazz Blues in F",        cat:"Blues",    key:"F",  changes:["FMaj7","Bb7","FMaj7","Cm7","F7","Bb7","Bdim7","FMaj7","Am7b5","D7","Gm7","C7"] },
  { name:"Bird Blues (F)",         cat:"Blues",    key:"F",  changes:["FMaj7","Em7b5","A7","Dm7","Db7","Gm7","C7","FMaj7","Am7b5","D7","Gm7","C7"] },
  // ── JAZZ STANDARDS ──
  { name:"Autumn Leaves",          cat:"Standards",key:"Gm",
    changes:["Cm7","F7","BbMaj7","EbMaj7","Am7b5","D7","Gm","Gm","Am7b5","D7","Gm","Gm","Cm7","F7","BbMaj7","EbMaj7","Am7b5","D7","Gm","Gm"] },
  { name:"All The Things You Are", cat:"Standards",key:"Ab",
    changes:["Fm7","Bbm7","Eb7","AbMaj7","DbMaj7","Dm7","G7","CMaj7","Cm7","Fm7","Bb7","EbMaj7","AbMaj7","Am7b5","D7","GMaj7","GMaj7","Gm7","C7","FMaj7","Fm7","Bb7","EbMaj7","Am7b5","D7","GMaj7"] },
  { name:"There Will Never…",      cat:"Standards",key:"Eb",
    changes:["EbMaj7","Bbm7","Eb7","AbMaj7","Ab6","Abm7","Db7","EbMaj7","Fm7","Bb7","Gm7","C7","Fm7","Bb7","EbMaj7","Bb7"] },
  { name:"Solar",                  cat:"Standards",key:"Cm",
    changes:["Cm","Cm","Gm7","C7","FMaj7","FMaj7","Fm7","Bb7","EbMaj7","EbMaj7","Am7b5","D7","Gm7","G7"] },
  { name:"Stella By Starlight",    cat:"Standards",key:"Bb",
    changes:["Em7b5","A7","Cm7","F7","Fm7","Bb7","EbMaj7","EbMaj7","Am7b5","D7","GMaj7","GMaj7","Bbm7","Eb7","AbMaj7","AbMaj7","Am7b5","D7","GMaj7","Gm7","C7","FMaj7","Fm7","Bb7","EbMaj7","Dm7b5","G7","Cm","Am7b5","D7","BbMaj7","BbMaj7"] },
  { name:"Misty",                  cat:"Standards",key:"Eb",
    changes:["EbMaj7","Bbm7","Eb7","AbMaj7","Abm7","Db7","EbMaj7","Cm7","Fm7","Bb7","EbMaj7","Gm7","C7","Fm7","Bb7","Gm7","C7","Fm7","Bb7"] },
  { name:"Nardis",                 cat:"Standards",key:"Em",
    changes:["Em7","A7","FMaj7","BbMaj7","Em7","Am7","B7","Em7"] },
  { name:"Have You Met Miss Jones",cat:"Standards",key:"F",
    changes:["FMaj7","Dm7","Gm7","C7","FMaj7","Db7","Gm7","C7","FMaj7","Dm7","Gm7","C7","FMaj7","Fm7","Bb7","BbMaj7","AbMaj7","GbMaj7","Em7","A7","Gm7","C7","FMaj7"] },
  { name:"Summertime",             cat:"Standards",key:"Am",
    changes:["Am","E7","Am","Am","Dm","Am","E7","E7","Am","F7","E7","E7","Am","E7","Am","Am"] },
  { name:"Softly (Morning Sunrise)",cat:"Standards",key:"Cm",
    changes:["Cm","Cm","Dm7b5","G7","Cm","Cm","Dm7b5","G7","Fm","Fm","Dm7b5","G7","Cm","Cm","Dm7b5","G7"] },
  { name:"Blue Bossa",             cat:"Standards",key:"Cm",
    changes:["Cm","Cm","Fm7","Fm7","Dm7b5","G7","Cm","Cm","EbMaj7","EbMaj7","Abm7","Db7","EbMaj7","EbMaj7","Dm7b5","G7"] },
  { name:"Girl From Ipanema",      cat:"Standards",key:"F",
    changes:["FMaj7","FMaj7","G7","G7","Gm7","C7","FMaj7","FMaj7","GbMaj7","GbMaj7","B7","B7","Bbm7","Eb7","GbMaj7","Gm7","C7","FMaj7"] },
  { name:"Satin Doll",             cat:"Standards",key:"C",
    changes:["Dm7","G7","Dm7","G7","Em7","A7","Em7","A7","Am7","D7","Abm7","Db7","CMaj7","CMaj7"] },
  { name:"Take The A Train",       cat:"Standards",key:"C",
    changes:["CMaj7","CMaj7","D7","D7","Dm7","G7","CMaj7","CMaj7"] },
  { name:"Round Midnight",         cat:"Standards",key:"Ebm",
    changes:["Ebm","Bdim7","Bbm7","Eb7","AbMaj7","Db7","Gm7b5","C7","Fm7","Bb7","Ebm","C7","Fm7","Bb7","Ebm","Ebm"] },
  // ── COLTRANE ──
  { name:"Giant Steps",            cat:"Coltrane", key:"B",
    changes:["BMaj7","D7","GMaj7","Bb7","EbMaj7","Am7","D7","GMaj7","Bb7","EbMaj7","F#m7","B7","BMaj7","Fm7","Bb7","EbMaj7","C#m7","F#7"] },
  { name:"Countdown",              cat:"Coltrane", key:"C",
    changes:["CMaj7","Em7","A7","DMaj7","F#m7","B7","EMaj7","Bbm7","Eb7","AbMaj7","Cm7","F7","BbMaj7","BbMaj7"] },
  // ── RHYTHM CHANGES ──
  { name:"Rhythm Changes (A)",     cat:"Rhythm",   key:"Bb",
    changes:["BbMaj7","Gm7","Cm7","F7","Dm7","G7","Cm7","F7","BbMaj7","Bb7","EbMaj7","Ebm7","Dm7","G7","Cm7","F7"] },
  { name:"Rhythm Changes (Full)",  cat:"Rhythm",   key:"Bb",
    changes:["BbMaj7","Gm7","Cm7","F7","Dm7","G7","Cm7","F7","BbMaj7","Bb7","EbMaj7","Ebm7","Dm7","G7","Cm7","F7","D7","D7","G7","G7","C7","C7","F7","F7","BbMaj7","Gm7","Cm7","F7","Dm7","G7","Cm7","F7","BbMaj7","Bb7","EbMaj7","Ebm7","Dm7","G7","Cm7","F7"] },
  // ── MODAL ──
  { name:"So What / Impressions",  cat:"Modal",    key:"D",  changes:["Dm7","Dm7","Dm7","Dm7","Dm7","Dm7","Dm7","Dm7","Ebm7","Ebm7","Ebm7","Ebm7","Dm7","Dm7","Dm7","Dm7"] },
  { name:"Maiden Voyage",          cat:"Modal",    key:"D",  changes:["Dm7sus4","Dm7sus4","Fm7sus4","Fm7sus4","Bbm7sus4","Bbm7sus4","Dbm7sus4","Dbm7sus4"] },
  { name:"Dorian Vamp",            cat:"Modal",    key:"Dm", changes:["Dm7","Em7b5","Dm7","Em7b5"] },
  { name:"Phrygian Vamp",          cat:"Modal",    key:"E",  changes:["Em7","FMaj7","Em7","FMaj7"] },
  { name:"Lydian Vamp",            cat:"Modal",    key:"F",  changes:["FMaj7","GbMaj7","FMaj7","GbMaj7"] },
  { name:"Mixolydian Vamp",        cat:"Modal",    key:"G",  changes:["G7","FMaj7","G7","FMaj7"] },
  // ── TURNAROUNDS ──
  { name:"Turnaround I-VI-ii-V",   cat:"Turns",    key:"C",  changes:["CMaj7","Am7","Dm7","G7"] },
  { name:"Turnaround Tritone Sub", cat:"Turns",    key:"C",  changes:["CMaj7","Eb7","Dm7","Db7"] },
  { name:"Ladybird",               cat:"Turns",    key:"C",  changes:["CMaj7","CMaj7","Ebm7","Ab7","CMaj7","Bm7","E7"] },
  { name:"Backdoor Cadence",       cat:"Turns",    key:"C",  changes:["CMaj7","Cm7","F7","CMaj7"] },
  // ── POP ──
  { name:"I-IV-V in G",            cat:"Pop",      key:"G",  changes:["G","C","D","G"] },
  { name:"I-V-vi-IV in C",         cat:"Pop",      key:"C",  changes:["CMaj7","GMaj7","Am7","FMaj7"] },
  { name:"50s Progression",        cat:"Pop",      key:"C",  changes:["CMaj7","Am7","FMaj7","G7"] },
];

// ─────────────────────────────────────────────────────────────
// MUSIC THEORY UTILITIES
// ─────────────────────────────────────────────────────────────
function getMidi(strIdx, fret, tuning) { return tuning[strIdx] + fret; }
function midiToNote(midi) { return NOTE_NAMES[midi % 12]; }
function freqToMidi(freq) { if (freq <= 0) return -1; return Math.round(69 + 12 * Math.log2(freq / 440)); }
function noteNameToChroma(name) {
  const base = NOTE_NAMES.indexOf(name);
  if (base >= 0) return base;
  return ({"Db":1,"Eb":3,"Gb":6,"Ab":8,"Bb":10,"Cb":11,"E#":5,"B#":0})[name] ?? -1;
}
function findNotePositions(noteName, tuning, minFret = 0, maxFret = 15) {
  const pos = [];
  for (let s = 0; s < tuning.length; s++)
    for (let f = minFret; f <= maxFret; f++)
      if (midiToNote(getMidi(s, f, tuning)) === noteName) pos.push({ string: s, fret: f });
  return pos;
}
function transposeChord(chord, semitones) {
  const m = chord.match(/^([A-G][b#]?)(.*)$/);
  if (!m) return chord;
  const [, root, quality] = m;
  const chroma = noteNameToChroma(root);
  if (chroma < 0) return chord;
  const newChroma = ((chroma + semitones) % 12 + 12) % 12;
  return FLAT_NAMES[newChroma] + quality;
}
function parseChord(s) {
  const m = s.match(/^([A-G][b#]?)(.*)$/);
  return m ? { root:m[1], type:m[2]||"" } : { root:"C", type:"Maj7" };
}
function getChordIvs(type) {
  return CHORD_INTERVALS[type] ?? CHORD_INTERVALS[""] ?? [0,4,7];
}
function computeVoiceLead(chordName, fromMidi, maxTones = 99) {
  const { root, type } = parseChord(chordName);
  const rootChroma = noteNameToChroma(root);
  if (rootChroma < 0) return { midi: fromMidi, iv: 0 };
  const allIvs = getChordIvs(type);
  // For level 2 (Root+5), always include root and fifth regardless of order
  let ivs = allIvs.slice(0, Math.max(1, maxTones));
  if (maxTones === 2) ivs = allIvs.filter(iv => iv === 0 || iv === 7).slice(0, 2);
  if (!ivs.length) ivs = [0];
  const cands = [];
  for (let oct = 2; oct <= 6; oct++)
    for (const iv of ivs) {
      const m = (oct+1)*12 + ((rootChroma + iv) % 12);
      if (m >= 23 && m <= 88) cands.push({ midi:m, iv });
    }
  if (!cands.length) return { midi: fromMidi, iv: 0 };
  return cands.reduce((b,c) => Math.abs(c.midi-fromMidi) < Math.abs(b.midi-fromMidi) ? c : b);
}
function haptic(type = "correct") {
  if (!navigator.vibrate) return;
  type === "correct" ? navigator.vibrate([30]) : navigator.vibrate([15,30,15]);
}
const isMacOS = /Mac|iPad|iPhone/.test(navigator.platform || navigator.userAgent) && !/Win/.test(navigator.platform);

// ─────────────────────────────────────────────────────────────
// YIN PITCH DETECTION — optimized (1024 FFT, frame skipping)
// ─────────────────────────────────────────────────────────────
const FFT_SIZE = 1024;

function yinDetect(buffer, sampleRate, threshold = 0.14) {
  const half = Math.floor(buffer.length / 2);
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
// FRETBOARD SVG — dynamic string count
// ─────────────────────────────────────────────────────────────
function Fretboard({ tuning, highlights=[], arcPair=null, leftHanded=false, minFret=0, maxFret=15, stringNames=null }) {
  const numStrings = tuning.length;
  const VW = 720, VH = numStrings <= 4 ? 145 : numStrings === 7 ? 195 : 175;
  const PAD_L=38, PAD_R=18, PAD_T=20, PAD_B=22;
  const drawW = VW - PAD_L - PAD_R;
  const drawH = VH - PAD_T - PAD_B;
  const span = Math.max(1, maxFret - minFret);
  const fretW = drawW / span;
  const strSpacing = drawH / Math.max(1, numStrings - 1);
  const sNames = stringNames ?? ["E","A","D","G","B","e"].slice(0, numStrings);

  function sx(fret) {
    const f = leftHanded ? (maxFret - fret + minFret) : (fret - minFret);
    return PAD_L + f * fretW;
  }
  function sy(strIdx) { return PAD_T + (numStrings - 1 - strIdx) * strSpacing; }

  const noteR = Math.min(strSpacing * 0.42, fretW * 0.42, 14);

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
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height="auto"
      style={{ fontFamily:"-apple-system,sans-serif", display:"block" }} className="select-none">
      <defs>
        <radialGradient id="grd-root" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#FFB347"/><stop offset="60%" stopColor="#FF7043"/><stop offset="100%" stopColor="#D84315"/>
        </radialGradient>
        <radialGradient id="grd-target" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#B3E5FC"/><stop offset="60%" stopColor="#29B6F6"/><stop offset="100%" stopColor="#0277BD"/>
        </radialGradient>
        <radialGradient id="grd-hint" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#FFE082"/><stop offset="60%" stopColor="#FFB300"/><stop offset="100%" stopColor="#FF6F00"/>
        </radialGradient>
        <filter id="gw-root" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="gw-target" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="arc-g" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FF7043" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="#29B6F6" stopOpacity="0.8"/>
        </linearGradient>
      </defs>

      {/* Nut */}
      {minFret === 0 && <rect x={leftHanded ? VW-PAD_R-2 : PAD_L-1} y={PAD_T-3} width={3} height={drawH+6} fill="#AAAAAA" rx={1}/>}

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
        ) : <circle key={m} cx={sx(m)-fretW/2} cy={PAD_T+drawH/2} r={3.5} fill="#D4D4D4" opacity={0.7}/>
      ))}

      {/* Fret numbers */}
      {[0,3,5,7,9,12,15].filter(f=>f>=minFret&&f<=maxFret).map(f=>(
        <text key={f} x={sx(f)-fretW/2} y={VH-4} textAnchor="middle" fontSize={9} fill="#BBBBBB" fontWeight={300}>{f}</text>
      ))}

      {/* Strings */}
      {Array.from({length:numStrings},(_,s)=>(
        <line key={s} x1={PAD_L-2} y1={sy(s)} x2={VW-PAD_R+2} y2={sy(s)}
          stroke="#D0D0D0" strokeWidth={0.4+s*0.12}/>
      ))}

      {/* String names */}
      {sNames.map((nm,i)=>(
        <text key={i} x={leftHanded ? VW-PAD_R+10 : PAD_L-11} y={sy(i)+4}
          textAnchor="middle" fontSize={9} fill="#C0C0C0" fontWeight={300}>{nm}</text>
      ))}

      {/* Animated arc */}
      <AnimatePresence>
        {arcPath && (
          <motion.path key={arcKey} d={arcPath} fill="none" stroke="url(#arc-g)"
            strokeWidth={1.5} strokeLinecap="round"
            initial={{pathLength:0,opacity:0}} animate={{pathLength:1,opacity:0.9}} exit={{opacity:0}}
            transition={{duration:0.45,ease:"easeOut"}}
            style={{filter:"drop-shadow(0 0 4px rgba(255,112,67,0.4))"}}/>
        )}
      </AnimatePresence>

      {/* Note jewels */}
      <AnimatePresence>
        {highlights.map(({ string:s, fret:f, role, label }, idx) => {
          const cx = sx(f) - fretW/2;
          const cy = sy(s);
          const isRoot = role === "root";
          const isHint = role === "wrong-hint";
          const jKey = `${role}-${s}-${f}`;
          const gradFill = isRoot ? "url(#grd-root)" : isHint ? "url(#grd-hint)" : "url(#grd-target)";
          const haloFill = isRoot ? "rgba(255,112,67,0.15)" : isHint ? "rgba(255,179,0,0.2)" : "rgba(41,182,246,0.12)";
          const filtId = isRoot ? "url(#gw-root)" : "url(#gw-target)";
          return (
            <motion.g key={jKey}
              initial={{scale:0,opacity:0}}
              animate={{scale:isHint?[1,1.3,1]:1, opacity:1}}
              exit={{scale:0,opacity:0}}
              transition={isHint ? {duration:0.5,times:[0,0.4,1]} : {type:"spring",stiffness:460,damping:22,delay:isRoot?0:0.08}}
              style={{originX:cx, originY:cy}}>
              <circle cx={cx} cy={cy} r={noteR+5} fill={haloFill}/>
              <circle cx={cx} cy={cy} r={noteR} fill={gradFill} filter={filtId}/>
              <circle cx={cx-noteR*0.27} cy={cy-noteR*0.27} r={noteR*0.26} fill="rgba(255,255,255,0.55)"/>
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
// AUDIO ENGINE — optimized: 1024 FFT, skip every other frame
// ─────────────────────────────────────────────────────────────
function useAudioEngine({ onPitchDetected, enabled = false }) {
  const cbRef = useRef(onPitchDetected);
  useEffect(() => { cbRef.current = onPitchDetected; });
  const ctxRef      = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef   = useRef(null);
  const rafRef      = useRef(null);
  const bufferRef   = useRef(null);
  const frameRef    = useRef(0);
  const [rms, setRms]           = useState(0);
  const [listening, setListening] = useState(false);
  const [error, setError]       = useState(null);

  const start = useCallback(async () => {
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext||window.webkitAudioContext)();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      sourceRef.current = ctx.createMediaStreamSource(stream);
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = FFT_SIZE;
      sourceRef.current.connect(analyserRef.current);
      bufferRef.current = new Float32Array(FFT_SIZE);
      setListening(true); setError(null);
    } catch(e) { setError(e.message || "Microphone access denied"); }
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
      if (!active || !analyserRef.current) return;
      frameRef.current++;
      // Skip every other frame → ~30fps pitch detection, lower CPU
      if (frameRef.current % 2 === 0) {
        analyserRef.current.getFloatTimeDomainData(bufferRef.current);
        const r = computeRMS(bufferRef.current);
        setRms(r);
        if (r > 0.01) {
          const freq = yinDetect(bufferRef.current, ctxRef.current.sampleRate, 0.14);
          if (freq > 50 && freq < 1500) cbRef.current?.(freq, r);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { active = false; cancelAnimationFrame(rafRef.current); };
  }, [listening]);

  useEffect(() => { if (enabled) start(); else stop(); return stop; }, [enabled]);
  return { rms, listening, error, start, stop };
}

// ─────────────────────────────────────────────────────────────
// GESTURE HOOKS
// ─────────────────────────────────────────────────────────────
function useLongPress(callback, ms = 700) {
  const timerRef = useRef(null);
  const fired = useRef(false);
  const start = useCallback((e) => {
    fired.current = false;
    timerRef.current = setTimeout(() => {
      fired.current = true;
      haptic("correct");
      callback();
    }, ms);
  }, [callback, ms]);
  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);
  return {
    onMouseDown: start, onMouseUp: cancel, onMouseLeave: cancel,
    onTouchStart: e => { e.stopPropagation(); start(e); },
    onTouchEnd: cancel, onTouchCancel: cancel,
  };
}

function useSwipe(onLeft, onRight) {
  const startX = useRef(null);
  return {
    onTouchStart: e => { startX.current = e.touches[0].clientX; },
    onTouchEnd: e => {
      if (startX.current === null) return;
      const dx = e.changedTouches[0].clientX - startX.current;
      if (dx < -50) onLeft?.();
      else if (dx > 50) onRight?.();
      startX.current = null;
    },
  };
}

// ─────────────────────────────────────────────────────────────
// GLASS UI PRIMITIVES
// ─────────────────────────────────────────────────────────────
function GlassModal({ open, onClose, title, children, width = "max-w-md" }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
          initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          style={{background:"rgba(0,0,0,0.28)"}}>
          <motion.div className={`w-full ${width} mx-4 mb-4 sm:mb-0 rounded-3xl overflow-hidden`}
            initial={{y:60,opacity:0}} animate={{y:0,opacity:1}} exit={{y:60,opacity:0}}
            transition={{type:"spring",stiffness:380,damping:32}}
            style={{background:"rgba(255,255,255,0.42)",backdropFilter:"blur(32px)",WebkitBackdropFilter:"blur(32px)",
              border:"1px solid rgba(255,255,255,0.65)",boxShadow:"0 32px 72px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.85)"}}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3"
              style={{borderBottom:"1px solid rgba(200,200,200,0.2)"}}>
              <h3 className="font-semibold text-gray-700" style={{fontSize:17}}>{title}</h3>
              <button onClick={onClose}
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500"
                style={{background:"rgba(0,0,0,0.07)"}}>
                <svg width={11} height={11} viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 max-h-[80vh] overflow-y-auto">{children}</div>
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
        style={{background:value?"linear-gradient(135deg,#FF7043,#FF9800)":"rgba(0,0,0,0.1)"}}>
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
        style={{background:`linear-gradient(to right,#FF7043 ${pct}%,rgba(0,0,0,0.1) ${pct}%)`}}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CALIBRATION MODAL — with macOS mic hint
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
      <div className="space-y-4">
        {/* macOS hint */}
        {isMacOS && (
          <div className="rounded-2xl p-3 text-xs" style={{background:"rgba(255,152,0,0.1)",border:"1px solid rgba(255,152,0,0.3)",color:"#E65100"}}>
            <strong>macOS 提示：</strong> 请在"系统偏好设置 → 声音 → 输入"中将麦克风模式设为 <strong>Standard</strong>（标准），
            而非"Voice Isolation"（语音隔离），否则音符检测可能不稳定。
          </div>
        )}
        <div className="rounded-2xl p-4 text-center" style={{background:"rgba(255,112,67,0.06)",border:"1px solid rgba(255,112,67,0.15)"}}>
          <button onClick={()=>setActive(a=>!a)}
            className="px-6 py-2.5 rounded-xl font-medium text-sm text-white transition-all"
            style={{background:active?"linear-gradient(135deg,#EF5350,#E53935)":"linear-gradient(135deg,#FF7043,#FF9800)"}}>
            {active?"⏹ Stop Listening":"🎤 Start Listening"}
          </button>
        </div>
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
        {error && (
          <div className="rounded-2xl p-3 text-xs" style={{background:"rgba(239,83,80,0.1)",border:"1px solid rgba(239,83,80,0.3)",color:"#C62828"}}>
            ⚠ {error}. Please allow microphone access in your browser settings.
          </div>
        )}
        {!error && active && liveRms < 0.01 && (
          <p className="text-xs text-center text-amber-600">Play a note on your instrument…</p>
        )}
      </div>
    </GlassModal>
  );
}

// ─────────────────────────────────────────────────────────────
// SETTINGS MODAL — with instrument selector
// ─────────────────────────────────────────────────────────────
function SettingsModal({ open, onClose, settings, onSettings }) {
  const instrNames = Object.keys(INSTRUMENTS);
  return (
    <GlassModal open={open} onClose={onClose} title="设置 / Settings">
      <div className="space-y-1 divide-y divide-gray-100 divide-opacity-40">
        {/* Instrument */}
        <div className="py-3">
          <span className="text-sm text-gray-600 block mb-2">乐器 / Instrument</span>
          <div className="grid grid-cols-2 gap-1.5">
            {instrNames.map(name=>{
              const active = settings.instrument === name;
              return (
                <button key={name} onClick={()=>onSettings({...settings, instrument:name, tuning: INSTRUMENTS[name].defaultTuning})}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-left transition-all"
                  style={{background:active?"rgba(255,112,67,0.12)":"rgba(0,0,0,0.05)",
                    border:active?"1px solid rgba(255,112,67,0.3)":"1px solid transparent",
                    color:active?"#E64A19":"#555"}}>
                  {name}
                </button>
              );
            })}
          </div>
        </div>
        <GlassToggle value={settings.leftHanded}  onChange={v=>onSettings({...settings,leftHanded:v})}  label="左手模式 / Left-Handed"/>
        <GlassToggle value={settings.showNoteNames} onChange={v=>onSettings({...settings,showNoteNames:v})} label="显示音名 / Show Note Names"/>
        <GlassToggle value={settings.showAllPositions} onChange={v=>onSettings({...settings,showAllPositions:v})} label="显示所有位置 / All Positions"/>
        <GlassSlider min={0} max={12} value={settings.minFret}
          onChange={v=>onSettings({...settings,minFret:Math.min(v,settings.maxFret-1)})} label="起始品 / Min Fret"/>
        <GlassSlider min={1} max={15} value={settings.maxFret}
          onChange={v=>onSettings({...settings,maxFret:Math.max(v,settings.minFret+1)})} label="结束品 / Max Fret"/>
        <div className="pt-3 text-center">
          <p className="text-xs text-gray-400">Solo-Vision Ultra v2.0</p>
          <p className="text-xs text-gray-400">Intervallic Functions Method</p>
        </div>
      </div>
    </GlassModal>
  );
}

// ─────────────────────────────────────────────────────────────
// TUNING MODAL — per instrument
// ─────────────────────────────────────────────────────────────
function TuningModal({ open, onClose, settings, onSettings }) {
  const instrData = INSTRUMENTS[settings.instrument] ?? INSTRUMENTS["6-String Guitar"];
  return (
    <GlassModal open={open} onClose={onClose} title="调弦 / Tuning">
      <div className="space-y-2.5">
        {Object.entries(instrData.tunings).map(([name,arr])=>{
          const active = JSON.stringify(settings.tuning)===JSON.stringify(arr);
          return (
            <button key={name} onClick={()=>{onSettings({...settings,tuning:arr});onClose();}}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left transition-all"
              style={{background:active?"rgba(255,112,67,0.12)":"rgba(0,0,0,0.04)",
                border:active?"1px solid rgba(255,112,67,0.3)":"1px solid transparent"}}>
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
// SESSION STATS MODAL
// ─────────────────────────────────────────────────────────────
function SessionStatsModal({ open, onClose, statsRef }) {
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    if (!open) return;
    const all = Object.entries(statsRef.current).map(([k, v]) => {
      const [iv, str, fret] = k.split("-");
      return { interval:+iv, string:+str, fret:+fret, ...v };
    });
    all.sort((a,b) => b.avgMs - a.avgMs);
    setEntries(all.slice(0, 8));
  }, [open]);

  return (
    <GlassModal open={open} onClose={onClose} title="Session Stats / 练习报告" width="max-w-sm">
      {!entries.length ? (
        <p className="text-sm text-center text-gray-400 py-4">Play at least a few questions to see stats.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 mb-3">Slowest responses — need more practice:</p>
          {entries.map((e, i) => {
            const bars = Math.min(100, (e.avgMs / 4000) * 100);
            const isWeak = e.avgMs > 2000;
            return (
              <div key={i} className="rounded-2xl p-3"
                style={{background:isWeak?"rgba(255,112,67,0.07)":"rgba(0,0,0,0.04)",
                  border:isWeak?"1px solid rgba(255,112,67,0.2)":"1px solid transparent"}}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs font-bold" style={{color:isWeak?"#E64A19":"#555"}}>
                    {INTERVAL_LABELS[e.interval]} — Str {e.string+1} Fret {e.fret}
                  </span>
                  <span className="text-xs text-gray-400">{(e.avgMs/1000).toFixed(1)}s · {e.count}×</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{background:"rgba(0,0,0,0.08)"}}>
                  <motion.div className="h-full rounded-full" initial={{width:0}} animate={{width:`${bars}%`}}
                    transition={{duration:0.6,delay:i*0.05}}
                    style={{background:isWeak?"linear-gradient(90deg,#FF9800,#FF7043)":"linear-gradient(90deg,#66BB6A,#A5D6A7)"}}/>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassModal>
  );
}

// ─────────────────────────────────────────────────────────────
// SHARED TRAINER PRIMITIVES
// ─────────────────────────────────────────────────────────────
function FretboardContainer({ settings, highlights, tuning, arcPair, swipeHandlers }) {
  const instrData = INSTRUMENTS[settings.instrument] ?? INSTRUMENTS["6-String Guitar"];
  return (
    <div className="rounded-3xl overflow-hidden p-3"
      style={{background:"rgba(255,255,255,0.55)",backdropFilter:"blur(20px)",
        border:"1px solid rgba(255,255,255,0.75)",
        boxShadow:"0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.95)"}}
      {...(swipeHandlers||{})}>
      <Fretboard tuning={tuning} highlights={highlights} arcPair={arcPair}
        leftHanded={settings.leftHanded} minFret={settings.minFret} maxFret={settings.maxFret}
        stringNames={instrData.stringNames}/>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    idle:      { text:"Ready",       bg:"rgba(0,0,0,0.06)",       color:"#999" },
    listening: { text:"Listening…",  bg:"rgba(41,182,246,0.12)",  color:"#0277BD" },
    correct:   { text:"✓ Correct!",  bg:"rgba(102,187,106,0.18)", color:"#2E7D32" },
    wrong:     { text:"✗ Try again", bg:"rgba(239,83,80,0.12)",   color:"#C62828" },
  };
  const c = cfg[status] || cfg.idle;
  return (
    <motion.span className="px-3 py-1 rounded-full text-xs font-semibold" key={status}
      initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} transition={{duration:0.15}}
      style={{background:c.bg,color:c.color}}>
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

function TrainerLayout({ title, subtitle, status, streak, score, rms, audioEnabled, children, onStats, longPressHandlers }) {
  return (
    <div className="flex flex-col gap-4" {...(longPressHandlers||{})}>
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
              className="px-2.5 py-1 rounded-full text-[10px] font-semibold text-gray-500"
              style={{background:"rgba(0,0,0,0.05)"}}>📊</button>
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
      {longPressHandlers && (
        <p className="text-center text-[9px] text-gray-300">长按任意位置重置练习 / Long press to reset</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NOTE TRAINER
// ─────────────────────────────────────────────────────────────
function NoteTrainer({ settings, audioEnabled }) {
  const tuning = settings.tuning;
  const [targetNote, setTargetNote] = useState("C");
  const [status,     setStatus]     = useState("listening");
  const [streak,     setStreak]     = useState(0);
  const [score,      setScore]      = useState({correct:0,total:0});
  const [successPos, setSuccessPos] = useState(null);
  const [showAll,    setShowAll]    = useState(false);   // swipe-to-peek
  const prevMidiRef    = useRef({midi:-1,frames:0});
  const wrongCoolRef   = useRef(false);

  const genQuestion = useCallback(() => {
    const note = NOTE_NAMES[Math.floor(Math.random()*12)];
    setTargetNote(note);
    setStatus("listening");
    setSuccessPos(null);
    setShowAll(false);
    prevMidiRef.current = {midi:-1,frames:0};
    wrongCoolRef.current = false;
  }, []);
  useEffect(() => { genQuestion(); }, []);

  const onPitchDetected = useCallback((freq) => {
    if (status !== "listening") return;
    const midi = freqToMidi(freq);
    const st = prevMidiRef.current;
    if (midi === st.midi) { st.frames++; } else { st.midi=midi; st.frames=1; }
    if (st.frames < 2) return;
    st.frames = 0;
    const played = midiToNote(midi);
    if (played === targetNote) {
      haptic("correct");
      setStatus("correct");
      setStreak(s=>s+1);
      setScore(s=>({correct:s.correct+1,total:s.total+1}));
      const pos = findNotePositions(targetNote, tuning, settings.minFret, settings.maxFret);
      if (pos.length) setSuccessPos(pos[0]);
      setTimeout(genQuestion, 1300);
    } else {
      if (!wrongCoolRef.current) {
        wrongCoolRef.current = true;
        haptic("wrong");
        setScore(s=>({...s,total:s.total+1}));
        setStreak(0);
        setStatus("wrong");
        setTimeout(()=>{ wrongCoolRef.current=false; setStatus("listening"); }, 700);
      }
    }
  }, [status, targetNote, settings, tuning, genQuestion]);

  const { rms } = useAudioEngine({ onPitchDetected, enabled: audioEnabled });

  // swipe left = show all positions; swipe right = hide
  const swipeHandlers = useSwipe(
    () => setShowAll(true),
    () => setShowAll(false)
  );

  const longPress = useLongPress(()=>{ setScore({correct:0,total:0}); setStreak(0); genQuestion(); });

  const positions = (settings.showAllPositions || showAll)
    ? findNotePositions(targetNote, tuning, settings.minFret, settings.maxFret)
    : (successPos ? [successPos] : []);
  const highlights = positions.map(p => ({...p, role:"root", label: settings.showNoteNames ? targetNote : "R"}));

  return (
    <TrainerLayout title="Note Trainer" subtitle="Find the note on the fretboard"
      status={status} streak={streak} score={score} rms={rms} audioEnabled={audioEnabled}
      longPressHandlers={longPress}>
      <div className="text-center py-6">
        <motion.div className="text-8xl font-black tracking-tighter"
          key={targetNote} initial={{scale:0.7,opacity:0}} animate={{scale:1,opacity:1}}
          transition={{type:"spring",stiffness:380,damping:22}}
          style={{background:"linear-gradient(135deg,#FF7043,#FF9800)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          {targetNote}
        </motion.div>
        <div className="text-gray-400 text-sm mt-1">Find this note</div>
        <div className="text-xs text-gray-300 mt-0.5">← Swipe to reveal all positions</div>
      </div>
      <FretboardContainer settings={settings} highlights={highlights} tuning={tuning} swipeHandlers={swipeHandlers}/>
    </TrainerLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// INTERVAL TRAINER
// ─────────────────────────────────────────────────────────────
function IntervalTrainer({ settings, audioEnabled }) {
  const tuning = settings.tuning;
  const [intervals,   setIntervals]  = useState([3,5,7]);
  const [question,    setQuestion]   = useState(null);
  const [status,      setStatus]     = useState("listening");
  const [streak,      setStreak]     = useState(0);
  const [score,       setScore]      = useState({correct:0,total:0});
  const [revealMode,  setRevealMode] = useState("learning");
  const [rootFirst,   setRootFirst]  = useState(false);
  const [stage,       setStage]      = useState("root");
  const [zenMode,     setZenMode]    = useState(false);
  const [hitPos,      setHitPos]     = useState(null);
  const [wrongHint,   setWrongHint]  = useState(false);
  const [showStats,   setShowStats]  = useState(false);
  const prevMidiRef     = useRef({midi:-1,frames:0});
  const wrongCoolRef    = useRef(false);
  const questionStartRef= useRef(null);
  const lastTargetKeyRef= useRef(null);
  const posStatsRef     = useRef({});

  const genQuestion = useCallback(() => {
    const rootStr  = Math.floor(Math.random()*tuning.length);
    const rootFret = settings.minFret + Math.floor(Math.random()*Math.max(1, settings.maxFret-settings.minFret));
    const iv = intervals[Math.floor(Math.random()*intervals.length)];
    const rootMidi   = getMidi(rootStr, rootFret, tuning);
    const targetMidi = rootMidi + iv;
    const candidates = [];
    for (let s=0; s<tuning.length; s++)
      for (let f=settings.minFret; f<=settings.maxFret; f++)
        if (getMidi(s,f,tuning)===targetMidi && !(s===rootStr&&f===rootFret))
          candidates.push({string:s,fret:f});
    if (!candidates.length) { setTimeout(genQuestion,0); return; }
    let pool = candidates.filter(c=>Math.abs(c.string-rootStr)<=2);
    if (!pool.length) pool = candidates;
    if (lastTargetKeyRef.current) {
      const filtered = pool.filter(c=>`${iv}-${c.string}-${c.fret}`!==lastTargetKeyRef.current);
      if (filtered.length) pool = filtered;
    }
    const pick = pool[Math.floor(Math.random()*pool.length)];
    lastTargetKeyRef.current = `${iv}-${pick.string}-${pick.fret}`;
    setQuestion({rootStr, rootFret, targetStr:pick.string, targetFret:pick.fret, intervalIdx:iv});
    setHitPos(null); setWrongHint(false);
    setStage(rootFirst ? "root" : "interval");
    prevMidiRef.current = {midi:-1,frames:0};
    wrongCoolRef.current = false;
    questionStartRef.current = Date.now();
    setStatus("listening");
  }, [intervals, settings, tuning, rootFirst]);
  useEffect(() => { genQuestion(); }, []);

  const onPitchDetected = useCallback((freq) => {
    if (status !== "listening" || !question) return;
    const midi = freqToMidi(freq);
    const st = prevMidiRef.current;
    if (midi === st.midi) { st.frames++; } else { st.midi=midi; st.frames=1; }
    if (st.frames < 2) return;
    st.frames = 0;

    if (rootFirst && stage === "root") {
      const rootMidi = getMidi(question.rootStr, question.rootFret, tuning);
      if (Math.abs(midi - rootMidi) <= 1) {
        haptic("correct"); setStage("interval");
        prevMidiRef.current = {midi:-1,frames:0};
      }
      return;
    }
    const targetMidi = getMidi(question.targetStr, question.targetFret, tuning);
    if (Math.abs(midi - targetMidi) <= 1) {
      let best = null; let bestScore = Infinity;
      for (let s=0; s<tuning.length; s++)
        for (let f=settings.minFret; f<=settings.maxFret; f++)
          if (Math.abs(getMidi(s,f,tuning)-midi)<=1) {
            const ds=Math.abs(s-question.rootStr), df=Math.abs(f-question.rootFret);
            if (ds>3||df>6) continue;
            const sc=ds*2+df;
            if (sc<bestScore) { bestScore=sc; best={string:s,fret:f}; }
          }
      if (revealMode === "learning" && best) {
        const onTarget = best.string===question.targetStr && best.fret===question.targetFret;
        if (!onTarget) {
          setWrongHint(true);
          setTimeout(()=>setWrongHint(false),900);
          return;
        }
      }
      if (best) setHitPos(best);
      const rt = questionStartRef.current ? Date.now()-questionStartRef.current : 0;
      const key = `${question.intervalIdx}-${(best||question).string}-${(best||question).fret}`;
      const prev = posStatsRef.current[key] || {count:0,totalMs:0,avgMs:0,weak:false};
      const next = {count:prev.count+1, totalMs:prev.totalMs+rt, avgMs:0, weak:false};
      next.avgMs = next.totalMs / next.count;
      next.weak  = next.avgMs > 2000;
      posStatsRef.current[key] = next;
      haptic("correct");
      setStatus("correct");
      setStreak(s=>s+1);
      setScore(s=>({correct:s.correct+1,total:s.total+1}));
      setTimeout(genQuestion, revealMode==="blind" ? 2200 : 1600);
    } else {
      const rootMidi = getMidi(question.rootStr, question.rootFret, tuning);
      if (Math.abs(midi-rootMidi) > 1 && !wrongCoolRef.current) {
        wrongCoolRef.current = true;
        haptic("wrong");
        setScore(s=>({...s,total:s.total+1}));
        setStreak(0);
        setStatus("wrong");
        setTimeout(()=>{ wrongCoolRef.current=false; setStatus("listening"); }, 700);
      }
    }
  }, [status, question, tuning, settings, revealMode, rootFirst, stage, genQuestion]);

  const { rms } = useAudioEngine({ onPitchDetected, enabled: audioEnabled });

  const longPress = useLongPress(()=>{ setScore({correct:0,total:0}); setStreak(0); genQuestion(); });
  const swipeHandlers = useSwipe(
    () => setZenMode(false),
    () => { if (revealMode==="blind") setZenMode(true); }
  );

  const rootNote     = question ? midiToNote(getMidi(question.rootStr, question.rootFret, tuning)) : "—";
  const intervalName = question ? INTERVAL_LABELS[question.intervalIdx] : "—";
  const shouldReveal = revealMode === "learning" || status === "correct";
  const targetDisplayPos = (() => {
    if (!question) return null;
    if (hitPos && shouldReveal) return hitPos;
    if (revealMode === "learning") return {string:question.targetStr,fret:question.targetFret};
    return null;
  })();
  const highlights = question ? [
    {string:question.rootStr, fret:question.rootFret, role:"root", label:"R"},
    ...(targetDisplayPos && shouldReveal ? [{
      string:targetDisplayPos.string, fret:targetDisplayPos.fret,
      role:wrongHint?"wrong-hint":"target",
      label:settings.showNoteNames
        ? midiToNote(getMidi(targetDisplayPos.string,targetDisplayPos.fret,tuning))
        : INTERVAL_LABELS[question.intervalIdx],
    }] : []),
  ] : [];
  const arcPair = shouldReveal && targetDisplayPos && question ? {
    from:{string:question.rootStr,fret:question.rootFret},
    to:{string:targetDisplayPos.string,fret:targetDisplayPos.fret},
  } : null;
  const fretboardHidden = zenMode && revealMode === "blind" && status !== "correct";

  return (
    <>
      <TrainerLayout title="Interval Trainer" subtitle="Find the interval"
        status={status} streak={streak} score={score} rms={rms} audioEnabled={audioEnabled}
        onStats={()=>setShowStats(true)} longPressHandlers={longPress}>

        {/* Interval chips with all/clear */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Intervals</span>
            <button onClick={()=>setIntervals([1,2,3,4,5,6,7,8,9,10,11])}
              className="ml-auto px-2 py-0.5 rounded-full text-[10px] text-gray-400 transition-all"
              style={{background:"rgba(0,0,0,0.05)"}}>All</button>
            <button onClick={()=>setIntervals([intervals[0]??3])}
              className="px-2 py-0.5 rounded-full text-[10px] text-gray-400 transition-all"
              style={{background:"rgba(0,0,0,0.05)"}}>Clear</button>
          </div>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {INTERVAL_LABELS.slice(1).map((label,i) => {
              const iv=i+1, sel=intervals.includes(iv);
              return (
                <button key={iv}
                  onClick={()=>setIntervals(prev=>sel&&prev.length>1?prev.filter(x=>x!==iv):[...new Set([...prev,iv])].sort((a,b)=>a-b))}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{background:sel?"linear-gradient(135deg,#29B6F6,#0277BD)":"rgba(0,0,0,0.06)",
                    color:sel?"white":"#666",border:sel?"1px solid rgba(41,182,246,0.4)":"1px solid transparent"}}>
                  {label}
                </button>
              );
            })}
          </div>

          {/* Mode row */}
          <div className="flex justify-center items-center gap-2 flex-wrap">
            {[{id:"learning",label:"📖 学习"},{id:"blind",label:"🙈 盲练"}].map(m=>(
              <button key={m.id} onClick={()=>setRevealMode(m.id)}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
                style={{background:revealMode===m.id?"rgba(255,112,67,0.15)":"rgba(0,0,0,0.05)",
                  color:revealMode===m.id?"#E64A19":"#777",
                  border:revealMode===m.id?"1px solid rgba(255,112,67,0.4)":"1px solid transparent"}}>
                {m.label}
              </button>
            ))}
            <button onClick={()=>setRootFirst(r=>!r)}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
              style={{background:rootFirst?"rgba(102,187,106,0.15)":"rgba(0,0,0,0.05)",
                color:rootFirst?"#2E7D32":"#777",
                border:rootFirst?"1px solid rgba(102,187,106,0.4)":"1px solid transparent"}}>
              🎯 根音优先
            </button>
            {revealMode==="blind" && (
              <button onClick={()=>setZenMode(z=>!z)}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
                style={{background:zenMode?"rgba(103,58,183,0.12)":"rgba(0,0,0,0.05)",
                  color:zenMode?"#5E35B1":"#777",
                  border:zenMode?"1px solid rgba(103,58,183,0.3)":"1px solid transparent"}}>
                🧘 Zen
              </button>
            )}
          </div>
        </div>

        {/* Question display */}
        <motion.div className="text-center py-4"
          key={question?.intervalIdx+"-"+question?.rootStr+"-"+question?.rootFret}
          initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.25}}>
          {rootFirst && stage === "root" ? (
            <div>
              <div className="text-xs text-gray-400 mb-2 tracking-widest uppercase">First: find root</div>
              <div className="text-7xl font-black"
                style={{background:"linear-gradient(135deg,#FF7043,#FF9800)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                {rootNote}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-xs text-gray-400 mb-2 tracking-widest uppercase">Find interval from root</div>
              <div className="flex items-baseline justify-center gap-3">
                <span className="text-5xl font-black"
                  style={{background:"linear-gradient(135deg,#FF7043,#FF9800)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                  {rootNote}
                </span>
                <span className="text-2xl text-gray-300">→</span>
                <span className="text-5xl font-black"
                  style={{background:"linear-gradient(135deg,#29B6F6,#0277BD)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                  {intervalName}
                </span>
              </div>
            </div>
          )}
        </motion.div>

        <AnimatePresence>
          {!fretboardHidden && (
            <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:10}} transition={{duration:0.3}}>
              <FretboardContainer settings={settings} highlights={highlights} tuning={tuning}
                arcPair={arcPair} swipeHandlers={swipeHandlers}/>
            </motion.div>
          )}
        </AnimatePresence>

        {fretboardHidden && (
          <button onClick={()=>setZenMode(false)}
            className="w-full py-3 rounded-2xl text-xs text-gray-400 transition-all"
            style={{background:"rgba(0,0,0,0.04)",border:"1px dashed rgba(0,0,0,0.1)"}}>
            ← Swipe or tap to show fretboard
          </button>
        )}
      </TrainerLayout>
      <SessionStatsModal open={showStats} onClose={()=>setShowStats(false)} statsRef={posStatsRef}/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// CHANGES TRAINER — 52 progressions, difficulty levels,
//   Forward/Reverse/Random order, Key Randomization
// ─────────────────────────────────────────────────────────────
const PROG_CATS = [...new Set(PROGRESSIONS.map(p=>p.cat))];

function ChangesTrainer({ settings, audioEnabled }) {
  const tuning = settings.tuning;
  const [progIdx,      setProgIdx]      = useState(5);  // default: ii-V-I in C
  const [difficulty,   setDifficulty]   = useState(4);  // default: 7th chord
  const [orderMode,    setOrderMode]    = useState("forward");
  const [randomizeKey, setRandomizeKey] = useState(false);
  const [transposeOff, setTransposeOff] = useState(0);
  const [chordIdx,     setChordIdx]     = useState(0);
  const [status,       setStatus]       = useState("listening");
  const [streak,       setStreak]       = useState(0);
  const [score,        setScore]        = useState({correct:0,total:0});
  const [currentTarget,setCurrentTarget]= useState({midi:60,iv:0});
  const [nextPreview,  setNextPreview]  = useState({midi:60,iv:0});
  const [showProgPicker,setShowProgPicker]=useState(false);
  const [filterCat,    setFilterCat]    = useState("All");
  const lastPlayedRef   = useRef(60);
  const prevMidiRef     = useRef({midi:-1,frames:0});
  const wrongCoolRef    = useRef(false);
  const loopCountRef    = useRef(0);

  const prog = PROGRESSIONS[progIdx];
  const maxTones = DIFFICULTY_LEVELS.find(d=>d.id===difficulty)?.maxTones ?? 4;

  // Transposed chord list
  const changes = prog.changes.map(c => transposeChord(c, transposeOff));

  // Derived current/next chord
  const getChordAtIdx = useCallback((idx) => {
    return changes[((idx % changes.length) + changes.length) % changes.length];
  }, [changes]);

  const fromName = getChordAtIdx(chordIdx);
  const toName   = getChordAtIdx(chordIdx + (orderMode === "reverse" ? -1 : 1));

  // Recompute target when chordIdx, prog, difficulty, or transposeOff changes
  useEffect(() => {
    const cur = chordIdx === 0 && loopCountRef.current === 0
      ? computeVoiceLead(fromName, 60, maxTones)
      : computeVoiceLead(fromName, lastPlayedRef.current, maxTones);
    const nxt = computeVoiceLead(toName, cur.midi, maxTones);
    setCurrentTarget(cur);
    setNextPreview(nxt);
    prevMidiRef.current = {midi:-1,frames:0};
    wrongCoolRef.current = false;
    setStatus("listening");
  }, [chordIdx, progIdx, difficulty, transposeOff]);

  // Reset when prog/difficulty changes
  useEffect(() => {
    lastPlayedRef.current = 60;
    loopCountRef.current = 0;
    setChordIdx(0);
    setScore({correct:0,total:0});
    setStreak(0);
    setTransposeOff(0);
  }, [progIdx, difficulty, orderMode]);

  const advanceChord = useCallback(() => {
    setChordIdx(prev => {
      let next;
      if (orderMode === "forward") {
        next = prev + 1;
        if (next >= changes.length) {
          next = 0;
          loopCountRef.current++;
          if (randomizeKey) setTransposeOff(Math.floor(Math.random()*12));
        }
      } else if (orderMode === "reverse") {
        next = prev - 1;
        if (next < 0) {
          next = changes.length - 1;
          loopCountRef.current++;
          if (randomizeKey) setTransposeOff(Math.floor(Math.random()*12));
        }
      } else {
        // random
        next = Math.floor(Math.random() * changes.length);
      }
      return next;
    });
  }, [orderMode, changes.length, randomizeKey]);

  const onPitchDetected = useCallback((freq) => {
    if (status !== "listening") return;
    const midi = freqToMidi(freq);
    const st = prevMidiRef.current;
    if (midi === st.midi) { st.frames++; } else { st.midi=midi; st.frames=1; }
    if (st.frames < 2) return;
    st.frames = 0;
    const { root, type } = parseChord(fromName);
    const rootChroma = noteNameToChroma(root);
    const ivs = getChordIvs(type).slice(0, Math.max(1, maxTones));
    const playedChroma = ((midi%12)+12)%12;
    const isChordTone = ivs.some(iv => (rootChroma+iv)%12 === playedChroma);
    const isTarget    = Math.abs(midi - currentTarget.midi) <= 1;
    if (isTarget || (maxTones >= 99 && isChordTone)) {
      lastPlayedRef.current = midi;
      haptic("correct");
      setStatus("correct");
      setStreak(s=>s+1);
      setScore(s=>({correct:s.correct+1,total:s.total+1}));
      setTimeout(() => advanceChord(), 1500);
    } else if (!isChordTone) {
      if (!wrongCoolRef.current) {
        wrongCoolRef.current = true;
        haptic("wrong");
        setScore(s=>({...s,total:s.total+1}));
        setStreak(0);
        setStatus("wrong");
        setTimeout(()=>{ wrongCoolRef.current=false; setStatus("listening"); }, 700);
      }
    }
  }, [status, currentTarget.midi, fromName, maxTones, advanceChord]);

  const { rms } = useAudioEngine({ onPitchDetected, enabled: audioEnabled });
  const longPress = useLongPress(()=>{ setScore({correct:0,total:0}); setStreak(0); setChordIdx(0); loopCountRef.current=0; lastPlayedRef.current=60; setTransposeOff(0); });

  const currentNote  = midiToNote(currentTarget.midi);
  const nextNote     = midiToNote(nextPreview.midi);
  const curLabel     = CHORD_TONE_LABELS[currentTarget.iv] ?? "?";
  const nxtLabel     = CHORD_TONE_LABELS[nextPreview.iv]   ?? "?";
  const semitoneMove = Math.abs(currentTarget.midi - nextPreview.midi);

  const highlights = [];
  const fromRootChroma = noteNameToChroma(parseChord(fromName).root);
  for (let s=0; s<tuning.length; s++) {
    for (let f=settings.minFret; f<=settings.maxFret; f++) {
      const m = getMidi(s,f,tuning);
      if (Math.abs(m - currentTarget.midi) <= 1) {
        highlights.push({string:s,fret:f,role:"target",label:settings.showNoteNames?currentNote:curLabel});
      } else if (m%12 === fromRootChroma) {
        highlights.push({string:s,fret:f,role:"root",label:"R"});
      }
    }
  }

  const filteredProgs = filterCat === "All" ? PROGRESSIONS : PROGRESSIONS.filter(p=>p.cat===filterCat);
  const transposedKey = transposeOff ? transposeChord(prog.key+" ", transposeOff).trim() : prog.key;

  return (
    <TrainerLayout title="Changes Trainer" subtitle="Chord tone voice leading"
      status={status} streak={streak} score={score} rms={rms} audioEnabled={audioEnabled}
      longPressHandlers={longPress}>

      {/* Progression selector */}
      <button onClick={()=>setShowProgPicker(true)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-left"
        style={{background:"rgba(0,0,0,0.04)",border:"1px solid rgba(0,0,0,0.06)"}}>
        <div>
          <span className="font-semibold text-gray-700 text-sm">{prog.name}</span>
          <span className="text-xs text-gray-400 ml-2">({prog.cat})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-bold">{transposedKey}</span>
          {transposeOff !== 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white" style={{background:"#FF7043"}}>+{transposeOff}st</span>}
          <span className="text-xs text-gray-400">▾</span>
        </div>
      </button>

      {/* Difficulty + Order + Key randomize */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-gray-400 uppercase tracking-widest w-12">Level</span>
          {DIFFICULTY_LEVELS.map(d=>(
            <button key={d.id} onClick={()=>setDifficulty(d.id)}
              className="px-2.5 py-1 rounded-full text-[11px] font-bold transition-all"
              title={d.desc}
              style={{background:difficulty===d.id?"rgba(255,112,67,0.15)":"rgba(0,0,0,0.05)",
                color:difficulty===d.id?"#E64A19":"#888",
                border:difficulty===d.id?"1px solid rgba(255,112,67,0.35)":"1px solid transparent"}}>
              {d.short}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-gray-400 uppercase tracking-widest w-12">Order</span>
          {[{id:"forward",icon:"→",label:"正向"},{id:"reverse",icon:"←",label:"反向"},{id:"random",icon:"⟳",label:"随机"}].map(m=>(
            <button key={m.id} onClick={()=>setOrderMode(m.id)}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
              style={{background:orderMode===m.id?"rgba(41,182,246,0.12)":"rgba(0,0,0,0.05)",
                color:orderMode===m.id?"#0277BD":"#777",
                border:orderMode===m.id?"1px solid rgba(41,182,246,0.3)":"1px solid transparent"}}>
              {m.icon} {m.label}
            </button>
          ))}
          <button onClick={()=>setRandomizeKey(k=>!k)}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ml-auto"
            title="Randomize key on each repeat"
            style={{background:randomizeKey?"rgba(102,187,106,0.12)":"rgba(0,0,0,0.05)",
              color:randomizeKey?"#2E7D32":"#777",
              border:randomizeKey?"1px solid rgba(102,187,106,0.3)":"1px solid transparent"}}>
            🔀 换调
          </button>
        </div>
      </div>

      {/* Current → Next chord card */}
      <motion.div className="py-2" key={chordIdx}
        initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.2}}>
        <div className="flex items-stretch gap-2">
          <div className="flex-1 rounded-2xl p-3 text-center"
            style={{background:"rgba(255,112,67,0.08)",border:"1px solid rgba(255,112,67,0.2)"}}>
            <div className="text-[9px] text-gray-400 uppercase tracking-widest mb-1">Now</div>
            <div className="text-3xl font-black leading-none"
              style={{background:"linear-gradient(135deg,#FF7043,#FF9800)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              {fromName}
            </div>
            <div className="mt-1.5">
              <div className="text-lg font-bold text-gray-700">{currentNote}</div>
              <div className="text-[11px] font-semibold" style={{color:"#FF7043"}}>{curLabel}</div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-0.5 px-1">
            <div className="text-gray-300 text-lg">→</div>
            <AnimatePresence>
              {status === "correct" && (
                <motion.div className="text-[10px] text-center leading-tight"
                  initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} exit={{opacity:0}}>
                  <div className="text-green-500 font-bold">{currentNote}</div>
                  <div className="text-gray-400 text-[9px]">{semitoneMove}st</div>
                  <div className="font-bold" style={{color:"#29B6F6"}}>{nextNote}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 rounded-2xl p-3 text-center"
            style={{background:"rgba(41,182,246,0.06)",border:"1px solid rgba(41,182,246,0.15)",opacity:0.72}}>
            <div className="text-[9px] text-gray-400 uppercase tracking-widest mb-1">Next</div>
            <div className="text-2xl font-black leading-none"
              style={{background:"linear-gradient(135deg,#29B6F6,#0277BD)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              {toName}
            </div>
            <div className="mt-1.5 text-[10px] text-gray-400">
              {nextNote} <span style={{color:"#29B6F6"}}>{nxtLabel}</span>
            </div>
          </div>
        </div>
      </motion.div>

      <FretboardContainer settings={settings} highlights={highlights} tuning={tuning}/>

      {/* Chord scroll */}
      <div className="flex gap-0.5 overflow-x-auto pb-1">
        {changes.map((ch,i) => {
          const cur = chordIdx % changes.length;
          return (
            <div key={i} className="flex-shrink-0 text-center"
              style={{opacity: i===cur?1 : i<cur?0.4:0.18}}>
              <div className="text-[8px] font-semibold whitespace-nowrap px-0.5"
                style={{color: i===cur?"#FF7043":i<cur?"#bbb":"#ddd"}}>{ch}</div>
              <div className="h-0.5 rounded mx-0.5"
                style={{background: i===cur?"#FF7043":i<cur?"rgba(255,112,67,0.25)":"rgba(0,0,0,0.08)"}}/>
            </div>
          );
        })}
      </div>

      {/* Progression picker modal */}
      <GlassModal open={showProgPicker} onClose={()=>setShowProgPicker(false)} title={`Progressions (${PROGRESSIONS.length})`} width="max-w-sm">
        {/* Category filter */}
        <div className="flex flex-wrap gap-1 mb-3">
          {["All",...PROG_CATS].map(cat=>(
            <button key={cat} onClick={()=>setFilterCat(cat)}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
              style={{background:filterCat===cat?"rgba(255,112,67,0.15)":"rgba(0,0,0,0.05)",
                color:filterCat===cat?"#E64A19":"#777",
                border:filterCat===cat?"1px solid rgba(255,112,67,0.3)":"1px solid transparent"}}>
              {cat}
            </button>
          ))}
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {filteredProgs.map((p,i)=>{
            const realIdx = PROGRESSIONS.indexOf(p);
            const active = realIdx === progIdx;
            return (
              <button key={realIdx} onClick={()=>{setProgIdx(realIdx);setShowProgPicker(false);}}
                className="w-full text-left px-4 py-2.5 rounded-xl transition-all text-sm"
                style={{background:active?"rgba(255,112,67,0.1)":"rgba(0,0,0,0.04)",
                  border:active?"1px solid rgba(255,112,67,0.25)":"1px solid transparent",
                  color:active?"#E64A19":"#555",fontWeight:active?600:400}}>
                {p.name}
                <span className="text-xs text-gray-400 ml-1">({p.key} · {p.changes.length} chords)</span>
              </button>
            );
          })}
        </div>
      </GlassModal>
    </TrainerLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// SCALE TRAINER — Root Movement (static/chromatic/random),
//   Melodic Sequence start degree, wrong feedback
// ─────────────────────────────────────────────────────────────
function ScaleTrainer({ settings, audioEnabled }) {
  const tuning = settings.tuning;
  const scaleNames = Object.keys(SCALES);
  const [selectedScale, setSelectedScale] = useState("Dorian");
  const [rootNote,      setRootNote]      = useState("A");
  const [seqMode,       setSeqMode]       = useState("ascending");
  const [rootMovement,  setRootMovement]  = useState("static");
  const [startDegree,   setStartDegree]   = useState(0);
  const [scaleNoteIdx,  setScaleNoteIdx]  = useState(0);
  const [status,        setStatus]        = useState("listening");
  const [streak,        setStreak]        = useState(0);
  const [score,         setScore]         = useState({correct:0,total:0});
  const [showScalePicker,setShowScalePicker]=useState(false);
  const prevMidiRef  = useRef({midi:-1,frames:0});
  const wrongCoolRef = useRef(false);
  const completedRef = useRef(0);  // how many full scale cycles done

  const scaleIntervals = SCALES[selectedScale] ?? [];
  const currentTarget  = scaleIntervals[scaleNoteIdx % scaleIntervals.length] ?? 0;
  const currentTargetNote = NOTE_NAMES[(noteNameToChroma(rootNote)+currentTarget)%12];

  const advanceRoot = useCallback((currentRoot) => {
    if (rootMovement === "static") return currentRoot;
    if (rootMovement === "chromatic") {
      const chroma = noteNameToChroma(currentRoot);
      const newChroma = (chroma + 1) % 12;
      return FLAT_NAMES[newChroma];
    }
    return NOTE_NAMES[Math.floor(Math.random()*12)];
  }, [rootMovement]);

  const onPitchDetected = useCallback((freq) => {
    if (status !== "listening") return;
    const midi = freqToMidi(freq);
    const st = prevMidiRef.current;
    if (midi === st.midi) { st.frames++; } else { st.midi=midi; st.frames=1; }
    if (st.frames < 2) return;
    st.frames = 0;
    const played = ((midi%12)+12)%12;
    const targetChroma = (noteNameToChroma(rootNote)+currentTarget)%12;
    if (played === targetChroma) {
      haptic("correct");
      setStatus("correct");
      setStreak(s=>s+1);
      setScore(s=>({correct:s.correct+1,total:s.total+1}));
      setTimeout(()=>{
        let next;
        const len = scaleIntervals.length;
        if (seqMode==="ascending")  next = (scaleNoteIdx+1) % len;
        else if (seqMode==="descending") next = (scaleNoteIdx-1+len) % len;
        else next = Math.floor(Math.random()*len);
        // Check if we completed a cycle back to startDegree
        const wrapped = seqMode==="ascending" && scaleNoteIdx===len-1;
        const wrapped2= seqMode==="descending" && scaleNoteIdx===0;
        if (wrapped || wrapped2) {
          completedRef.current++;
          if (rootMovement !== "static") {
            setRootNote(prev => advanceRoot(prev));
          }
          next = startDegree;
        }
        prevMidiRef.current = {midi:-1,frames:0};
        wrongCoolRef.current = false;
        setScaleNoteIdx(next);
        setStatus("listening");
      }, 800);
    } else {
      if (!wrongCoolRef.current) {
        wrongCoolRef.current = true;
        haptic("wrong");
        setScore(s=>({...s,total:s.total+1}));
        setStreak(0);
        setStatus("wrong");
        setTimeout(()=>{ wrongCoolRef.current=false; setStatus("listening"); }, 700);
      }
    }
  }, [status, rootNote, currentTarget, scaleNoteIdx, scaleIntervals, seqMode, rootMovement, startDegree, advanceRoot]);

  const { rms } = useAudioEngine({ onPitchDetected, enabled: audioEnabled });

  useEffect(()=>{
    setStatus("listening");
    setScaleNoteIdx(startDegree);
    prevMidiRef.current={midi:-1,frames:0};
    wrongCoolRef.current=false;
    completedRef.current=0;
  }, [selectedScale, rootNote, startDegree]);

  const longPress = useLongPress(()=>{ setScore({correct:0,total:0}); setStreak(0); setScaleNoteIdx(startDegree); completedRef.current=0; });

  const highlights = [];
  for (let s=0; s<tuning.length; s++) {
    for (let f=settings.minFret; f<=settings.maxFret; f++) {
      const chroma = getMidi(s,f,tuning)%12;
      const rootChroma   = noteNameToChroma(rootNote);
      const targetChroma = (rootChroma+currentTarget)%12;
      if (chroma === rootChroma)   highlights.push({string:s,fret:f,role:"root",  label:settings.showNoteNames?rootNote:"R"});
      else if (chroma === targetChroma) highlights.push({string:s,fret:f,role:"target",label:settings.showNoteNames?currentTargetNote:INTERVAL_LABELS[currentTarget]});
    }
  }

  return (
    <TrainerLayout title="Scale Trainer" subtitle="Navigate scale degrees"
      status={status} streak={streak} score={score} rms={rms} audioEnabled={audioEnabled}
      longPressHandlers={longPress}>

      {/* Root note selector */}
      <div className="flex flex-wrap gap-1 justify-center">
        {NOTE_NAMES.map(n=>(
          <button key={n} onClick={()=>setRootNote(n)}
            className="w-8 h-8 rounded-lg text-xs font-semibold transition-all"
            style={{background:rootNote===n?"linear-gradient(135deg,#FF7043,#FF9800)":"rgba(0,0,0,0.06)",
              color:rootNote===n?"white":"#555"}}>
            {n}
          </button>
        ))}
      </div>

      {/* Scale picker + sequence mode */}
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
            style={{background:seqMode===m.id?"rgba(41,182,246,0.12)":"rgba(0,0,0,0.04)",
              color:seqMode===m.id?"#0277BD":"#999",
              border:seqMode===m.id?"1px solid rgba(41,182,246,0.3)":"1px solid transparent"}}>
            {m.icon}
          </button>
        ))}
      </div>

      {/* Root Movement + Start Degree */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">Root</span>
          {[{id:"static",label:"静态"},{id:"chromatic",label:"半音↑"},{id:"random",label:"随机"}].map(m=>(
            <button key={m.id} onClick={()=>setRootMovement(m.id)}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
              style={{background:rootMovement===m.id?"rgba(102,187,106,0.15)":"rgba(0,0,0,0.05)",
                color:rootMovement===m.id?"#2E7D32":"#777",
                border:rootMovement===m.id?"1px solid rgba(102,187,106,0.35)":"1px solid transparent"}}>
              {m.label}
            </button>
          ))}
        </div>
        {scaleIntervals.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Start</span>
            {scaleIntervals.map((iv,i)=>(
              <button key={i} onClick={()=>setStartDegree(i)}
                className="px-2.5 py-1 rounded-full text-[11px] font-bold transition-all"
                style={{background:startDegree===i?"rgba(103,58,183,0.15)":"rgba(0,0,0,0.05)",
                  color:startDegree===i?"#5E35B1":"#888",
                  border:startDegree===i?"1px solid rgba(103,58,183,0.35)":"1px solid transparent"}}>
                {INTERVAL_LABELS[iv]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Question display */}
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
        {rootMovement !== "static" && completedRef.current > 0 && (
          <div className="text-xs text-green-500 mt-0.5">Cycle {completedRef.current} complete</div>
        )}
        <div className="flex justify-center gap-1.5 mt-3">
          {scaleIntervals.map((_,i)=>(
            <div key={i} className="w-2 h-2 rounded-full transition-all"
              style={{background:i===scaleNoteIdx%scaleIntervals.length?"#29B6F6":i===startDegree?"rgba(255,112,67,0.4)":"rgba(0,0,0,0.12)"}}/>
          ))}
        </div>
      </motion.div>

      <FretboardContainer settings={settings} highlights={highlights} tuning={tuning}/>

      <GlassModal open={showScalePicker} onClose={()=>setShowScalePicker(false)} title="Select Scale" width="max-w-sm">
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {scaleNames.map(name=>(
            <button key={name} onClick={()=>{setSelectedScale(name);setShowScalePicker(false);}}
              className="w-full text-left px-4 py-2 rounded-xl transition-all text-sm"
              style={{background:selectedScale===name?"rgba(41,182,246,0.1)":"rgba(0,0,0,0.04)",
                color:selectedScale===name?"#0277BD":"#555",fontWeight:selectedScale===name?600:400}}>
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
  { id:"note",     label:"Notes",    icon:"♩", chinese:"音符" },
  { id:"interval", label:"Intervals",icon:"◎", chinese:"音程" },
  { id:"changes",  label:"Changes",  icon:"♫", chinese:"进行" },
  { id:"scale",    label:"Scales",   icon:"≋", chinese:"音阶" },
];

export default function App() {
  const [activeTab,    setActiveTab]    = useState("interval");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTuning,   setShowTuning]   = useState(false);
  const [showCalib,    setShowCalib]    = useState(false);
  const [settings, setSettings] = useState({
    instrument:     "6-String Guitar",
    tuning:         INSTRUMENTS["6-String Guitar"].defaultTuning,
    leftHanded:     false,
    showNoteNames:  false,
    showAllPositions:false,
    minFret:        0,
    maxFret:        12,
  });

  const toggleAudio = useCallback(async () => {
    if (!audioEnabled) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setAudioEnabled(true);
      } catch { setShowCalib(true); }
    } else { setAudioEnabled(false); }
  }, [audioEnabled]);

  const trainerProps = { settings, audioEnabled };

  return (
    <div className="min-h-screen" style={{background:"#FAF9F6",fontFamily:"-apple-system,'SF Pro Display',sans-serif"}}>
      {/* Ambient gradient */}
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
            {[{i:"♩",a:()=>setShowTuning(true),t:"Tuning"},
              {i:"◈",a:()=>setShowCalib(true),t:"Calibrate"},
              {i:"⚙",a:()=>setShowSettings(true),t:"Settings"}].map(b=>(
              <motion.button key={b.i} title={b.t} onClick={b.a} whileTap={{scale:0.88}}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm text-gray-500"
                style={{background:"rgba(0,0,0,0.05)"}}>
                {b.i}
              </motion.button>
            ))}
          </div>
        </header>

        {/* Fret range bar — click to open settings */}
        <button className="mb-4 w-full flex items-center gap-3" onClick={()=>setShowSettings(true)}
          title="Click to adjust fret range">
          <span className="text-xs text-gray-400 w-8">Frets</span>
          <div className="flex-1 relative h-4 flex items-center">
            <div className="w-full h-0.5 rounded-full" style={{background:"rgba(0,0,0,0.08)"}}/>
            <div className="absolute h-1 rounded-full transition-all" style={{
              left:`${(settings.minFret/15)*100}%`,
              width:`${((settings.maxFret-settings.minFret)/15)*100}%`,
              background:"linear-gradient(90deg,rgba(255,112,67,0.5),rgba(41,182,246,0.5))",
            }}/>
          </div>
          <span className="text-xs text-gray-500 font-mono w-10 text-right">{settings.minFret}–{settings.maxFret}</span>
          <span className="text-xs text-gray-300">✎</span>
        </button>

        {/* Instrument badge */}
        <div className="mb-3 flex items-center gap-2">
          <button onClick={()=>setShowSettings(true)}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium"
            style={{background:"rgba(0,0,0,0.05)",color:"#888"}}>
            🎸 {settings.instrument}
          </button>
        </div>

        {/* Main card */}
        <main className="rounded-3xl p-5" style={{
          background:"rgba(255,255,255,0.45)",backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",
          border:"1px solid rgba(255,255,255,0.72)",
          boxShadow:"0 16px 52px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.92)",
        }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeTab}
              initial={{opacity:0,x:12}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-12}}
              transition={{duration:0.18}}>
              {activeTab==="note"     && <NoteTrainer     {...trainerProps}/>}
              {activeTab==="interval" && <IntervalTrainer {...trainerProps}/>}
              {activeTab==="changes"  && <ChangesTrainer  {...trainerProps}/>}
              {activeTab==="scale"    && <ScaleTrainer    {...trainerProps}/>}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Interval reference bar */}
        <div className="mt-4 rounded-3xl p-3" style={{
          background:"rgba(255,255,255,0.3)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.5)"
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
          background:"rgba(250,249,246,0.72)",backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",
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
      <TuningModal   open={showTuning}   onClose={()=>setShowTuning(false)}   settings={settings} onSettings={setSettings}/>
      <CalibrationModal open={showCalib} onClose={()=>setShowCalib(false)}/>

      <style>{`
        @keyframes breathe { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.14);opacity:0.82} }
        input[type=range]{-webkit-appearance:none;cursor:pointer;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:white;box-shadow:0 1px 6px rgba(0,0,0,0.2);}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.14);border-radius:2px;}
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
