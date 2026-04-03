import React, { useEffect, useRef, useState } from "react";

const W = 900, H = 620;
const PAD = 72;
const SR = 22;
const WAVE_SPEED = 340;
const MAX_ROUNDS = 5;

const SENSORS = [
  { id: "S1", x: PAD,     y: PAD,     color: "#00FFC8", glow: "#00ffc888", freq: 330 },
  { id: "S2", x: W - PAD, y: PAD,     color: "#FF4D8D", glow: "#ff4d8d88", freq: 440 },
  { id: "S3", x: PAD,     y: H - PAD, color: "#FFD600", glow: "#ffd60088", freq: 550 },
  { id: "S4", x: W - PAD, y: H - PAD, color: "#A78BFA", glow: "#a78bfa88", freq: 660 },
];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function randSource() {
  return {
    x: PAD + 100 + Math.random() * (W - 2 * PAD - 200),
    y: PAD + 80  + Math.random() * (H - 2 * PAD - 160),
  };
}

function computeArrivals(src) {
  const raw = SENSORS.map(s => ({ ...s, d: dist(src, s), t: dist(src, s) / WAVE_SPEED }));
  const tMin = Math.min(...raw.map(r => r.t));
  return raw.map(r => ({ ...r, dt: r.t - tMin })).sort((a, b) => a.dt - b.dt);
}

function solveExact(arrivals) {
  const byId = {};
  arrivals.forEach(a => { byId[a.id] = a; });
  const s1 = { ...SENSORS.find(s => s.id === "S1"), d: byId["S1"].d };
  const s2 = { ...SENSORS.find(s => s.id === "S2"), d: byId["S2"].d };
  const s3 = { ...SENSORS.find(s => s.id === "S3"), d: byId["S3"].d };
  const d1 = s1.d, d2 = s2.d, d3 = s3.d;
  const A = -2 * (s2.x - s1.x);
  const B = s2.x * s2.x - s1.x * s1.x;
  const C = d2 * d2 - d1 * d1;
  const x = (C - B) / A;
  const D = -2 * (s1.y - s3.y);
  const E = s1.y * s1.y - s3.y * s3.y;
  const F = d1 * d1 - d3 * d3;
  const y = (F - E) / D;
  return { x, y };
}

function scoreGuess(err) {
  if (err < 28)  return { pts: 100, stars: 3, label: "PERFECT!",  emoji: "🏆", accent: "#00FFC8" };
  if (err < 70)  return { pts: 75,  stars: 2, label: "GREAT!",    emoji: "🎯", accent: "#FFD600" };
  if (err < 130) return { pts: 45,  stars: 1, label: "CLOSE",     emoji: "👍", accent: "#A78BFA" };
  return               { pts: 15,  stars: 0, label: "TOO FAR",   emoji: "💥", accent: "#FF4D8D" };
}

let _audioCtx = null;
const getAudioCtx = () => {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
};

function playTone(delay, freq, pan, type = "triangle") {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const pan_ = ctx.createStereoPanner();
  osc.type = type; osc.frequency.value = freq;
  pan_.pan.value = Math.max(-1, Math.min(1, pan));
  osc.connect(gain); gain.connect(pan_); pan_.connect(ctx.destination);
  const now = ctx.currentTime, t0 = now + delay;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.75, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
  osc.start(now); osc.stop(t0 + 0.42);
}

function playCountdownBeep(n) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = n <= 3 ? "square" : "sine";
  osc.frequency.value = n <= 3 ? 1040 : 740;
  osc.connect(gain); gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.start(now); osc.stop(now + 0.2);
}

function playResultSound(win) {
  const freqs = win ? [523, 659, 784, 1047] : [330, 294, 262];
  freqs.forEach((f, i) => playTone(i * 0.13, f, 0, win ? "sine" : "sawtooth"));
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function drawGrid(ctx) {
  ctx.save();
  ctx.strokeStyle = "rgba(0,255,200,0.06)"; ctx.lineWidth = 1;
  for (let x = PAD; x <= W - PAD; x += 80) { ctx.beginPath(); ctx.moveTo(x, PAD); ctx.lineTo(x, H - PAD); ctx.stroke(); }
  for (let y = PAD; y <= H - PAD; y += 80) { ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke(); }
  ctx.strokeStyle = "rgba(0,255,200,0.14)"; ctx.lineWidth = 1.5;
  rr(ctx, PAD, PAD, W - 2*PAD, H - 2*PAD, 8); ctx.stroke();
  ctx.fillStyle = "rgba(0,255,200,0.35)"; ctx.font = "10px monospace"; ctx.textAlign = "center";
  for (let x = PAD; x <= W - PAD; x += 80) ctx.fillText(x + "px", x, H - PAD + 16);
  ctx.textAlign = "right";
  for (let y = PAD; y <= H - PAD; y += 80) ctx.fillText(y + "px", PAD - 8, y + 4);
  ctx.restore();
}

function drawSensors(ctx, arrivals, activeSet, pulseMap, flashId, phase, showCoords) {
  SENSORS.forEach(s => {
    const info = arrivals.find(a => a.id === s.id);
    const isActive = activeSet.has(s.id);
    const isFlash = flashId === s.id;
    const pulse = pulseMap[s.id] || 0;
    ctx.save();
    if (isActive || isFlash) {
      for (let i = 0; i < 3; i++) {
        const rr_ = SR + 16 + i * 14 + pulse * 10;
        const alpha = (0.35 - i * 0.1) * (isFlash ? 1 : 0.6);
        ctx.beginPath(); ctx.arc(s.x, s.y, rr_, 0, Math.PI * 2);
        ctx.strokeStyle = s.color + Math.floor(alpha * 255).toString(16).padStart(2,'0');
        ctx.lineWidth = isFlash ? 2.5 - i * 0.6 : 1.5 - i * 0.4; ctx.stroke();
      }
    }
    const grad = ctx.createRadialGradient(s.x - 5, s.y - 5, 2, s.x, s.y, SR + 4);
    grad.addColorStop(0, isActive ? "#ffffff" : "rgba(180,220,255,0.5)");
    grad.addColorStop(0.35, isActive ? s.color : "rgba(60,100,160,0.55)");
    grad.addColorStop(1, isActive ? s.glow.slice(0,7) + "44" : "rgba(10,20,50,0.7)");
    ctx.beginPath(); ctx.arc(s.x, s.y, SR, 0, Math.PI * 2);
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = isFlash ? "#fff" : isActive ? s.color : "rgba(0,255,200,0.25)";
    ctx.lineWidth = isFlash ? 3 : 2; ctx.stroke();
    ctx.fillStyle = isActive ? "#000" : "#fff";
    ctx.font = `bold 13px monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(s.id, s.x, s.y);
    if (phase !== "idle" && info) {
      const badge = info.dt === 0 ? "t₀" : `+${(info.dt * 1000).toFixed(0)}ms`;
      const bx = s.x > W/2 ? s.x - SR - 6 : s.x + SR + 6;
      const by = s.y > H/2 ? s.y - 36 : s.y + 26;
      const anchor = s.x > W/2 ? "right" : "left";
      ctx.fillStyle = "rgba(5,10,30,0.85)";
      const tw = badge.length * 8 + 12;
      rr(ctx, anchor === "right" ? bx - tw : bx, by - 13, tw, 18, 4); ctx.fill();
      ctx.fillStyle = info.dt === 0 ? s.color : "rgba(200,240,255,0.9)";
      ctx.font = "bold 11px monospace"; ctx.textAlign = anchor; ctx.textBaseline = "middle";
      ctx.fillText(badge, anchor === "right" ? bx - 4 : bx + 4, by - 4);
      if (showCoords) {
        const coordTxt = `(${s.x},${s.y})`;
        const cw = coordTxt.length * 7 + 10;
        ctx.fillStyle = "rgba(5,10,30,0.8)";
        rr(ctx, anchor === "right" ? bx - cw : bx, by + 6, cw, 16, 4); ctx.fill();
        ctx.fillStyle = s.color + "cc"; ctx.font = "9px monospace"; ctx.textAlign = anchor;
        ctx.fillText(coordTxt, anchor === "right" ? bx - 4 : bx + 4, by + 15);
      }
    }
    ctx.restore();
  });
}

function drawWaves(ctx, src, rings) {
  if (!src || rings.length === 0) return;
  rings.forEach(({ r, alpha }) => {
    if (r <= 0) return;
    ctx.beginPath(); ctx.arc(src.x, src.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0,230,255,${alpha})`; ctx.lineWidth = 2.5; ctx.stroke();
  });
}

function drawRays(ctx, src, arrivals, waveR) {
  if (!src) return;
  arrivals.forEach(a => {
    const s = SENSORS.find(s => s.id === a.id);
    const d = dist(src, s);
    const frac = Math.min(waveR / d, 1);
    const ex = src.x + (s.x - src.x) * frac;
    const ey = src.y + (s.y - src.y) * frac;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(ex, ey);
    ctx.strokeStyle = s.color + "55"; ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  });
}

function drawHyperbolas(ctx, arrivals) {
  if (arrivals.length < 2) return;
  const pairs = [[0,1],[0,2],[0,3],[1,2]];
  const hColors = ["rgba(0,255,200,0.5)","rgba(255,77,141,0.5)","rgba(255,214,0,0.5)","rgba(167,139,250,0.5)"];
  pairs.forEach(([ai, bi], pi) => {
    if (!arrivals[ai] || !arrivals[bi]) return;
    const sa = SENSORS.find(s => s.id === arrivals[ai].id);
    const sb = SENSORS.find(s => s.id === arrivals[bi].id);
    const dDist = (arrivals[ai].dt - arrivals[bi].dt) * WAVE_SPEED;
    const pts = [];
    for (let angle = 0; angle < Math.PI * 2; angle += 0.018) {
      for (let r = 15; r < Math.max(W, H) * 1.3; r += 5) {
        const px = W / 2 + r * Math.cos(angle);
        const py = H / 2 + r * Math.sin(angle);
        if (px < 0 || px > W || py < 0 || py > H) break;
        if (Math.abs(dist({x:px,y:py}, sa) - dist({x:px,y:py}, sb) - dDist) < 5.5) { pts.push({x:px,y:py}); break; }
      }
    }
    if (pts.length < 4) return;
    ctx.save(); ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = hColors[pi]; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  });
}

function drawGuessPoint(ctx, g) {
  if (!g) return;
  ctx.save();
  ctx.beginPath(); ctx.arc(g.x, g.y, 22, 0, Math.PI*2);
  ctx.strokeStyle = "rgba(255,214,0,0.35)"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(g.x, g.y, 13, 0, Math.PI*2);
  ctx.fillStyle = "#FFD600"; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  [[-9,0,9,0],[0,-9,0,9]].forEach(([x1,y1,x2,y2]) => {
    ctx.beginPath(); ctx.moveTo(g.x+x1, g.y+y1); ctx.lineTo(g.x+x2, g.y+y2);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2.5; ctx.stroke();
  });
  ctx.fillStyle = "#fffbe0"; ctx.font = "bold 11px monospace";
  ctx.textAlign = g.x > W/2 ? "right" : "left"; ctx.textBaseline = "bottom";
  ctx.fillText("YOUR GUESS", g.x + (g.x > W/2 ? -20 : 20), g.y - 18);
  ctx.restore();
}

function drawCoordLabels(ctx, guess, src) {
  if (!guess || !src) return;
  ctx.save();
  const gLabel = `GUESS: (${Math.round(guess.x)}, ${Math.round(guess.y)})`;
  const gW = gLabel.length * 7.5 + 16;
  const gx = guess.x > W/2 ? guess.x - gW - 5 : guess.x + 22;
  const gy = guess.y + 20;
  ctx.fillStyle = "rgba(5,10,30,0.92)"; rr(ctx, gx, gy, gW, 20, 5); ctx.fill();
  ctx.strokeStyle = "#FFD60055"; ctx.lineWidth = 1; rr(ctx, gx, gy, gW, 20, 5); ctx.stroke();
  ctx.fillStyle = "#FFD600"; ctx.font = "bold 10px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(gLabel, gx + 8, gy + 10);
  const sLabel = `TRUE: (${Math.round(src.x)}, ${Math.round(src.y)})`;
  const sW = sLabel.length * 7.5 + 16;
  const sx2 = src.x > W/2 ? src.x - sW - 5 : src.x + 22;
  const sy2 = src.y + 20;
  ctx.fillStyle = "rgba(5,10,30,0.92)"; rr(ctx, sx2, sy2, sW, 20, 5); ctx.fill();
  ctx.strokeStyle = "#ff444455"; ctx.lineWidth = 1; rr(ctx, sx2, sy2, sW, 20, 5); ctx.stroke();
  ctx.fillStyle = "#ff8888"; ctx.font = "bold 10px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(sLabel, sx2 + 8, sy2 + 10);
  ctx.restore();
}

function drawSourceReveal(ctx, src, est, showEst) {
  if (!src) return;
  ctx.save();
  ctx.beginPath(); ctx.arc(src.x, src.y, 26, 0, Math.PI*2);
  ctx.strokeStyle = "rgba(255,80,80,0.3)"; ctx.lineWidth = 1; ctx.stroke();
  const g = ctx.createRadialGradient(src.x-3, src.y-3, 2, src.x, src.y, 13);
  g.addColorStop(0, "#fff"); g.addColorStop(0.4, "#ff6060"); g.addColorStop(1, "#cc2020");
  ctx.beginPath(); ctx.arc(src.x, src.y, 12, 0, Math.PI*2);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = "#ff4444"; ctx.lineWidth = 2.5; ctx.stroke();
  [[-7,-7,7,7],[-7,7,7,-7]].forEach(([x1,y1,x2,y2]) => {
    ctx.beginPath(); ctx.moveTo(src.x+x1, src.y+y1); ctx.lineTo(src.x+x2, src.y+y2);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  });
  ctx.fillStyle = "#ffaaaa"; ctx.font = "bold 11px monospace";
  ctx.textAlign = src.x > W/2 ? "right" : "left"; ctx.textBaseline = "bottom";
  ctx.fillText("TRUE SOURCE", src.x + (src.x > W/2 ? -20 : 20), src.y - 18);
  if (showEst && est) {
    ctx.beginPath(); ctx.arc(est.x, est.y, 10, 0, Math.PI*2);
    ctx.strokeStyle = "rgba(167,139,250,0.9)"; ctx.lineWidth = 2.5;
    ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#c4b5fd"; ctx.font = "bold 10px monospace";
    ctx.textAlign = est.x > W/2 ? "right" : "left"; ctx.textBaseline = "top";
    ctx.fillText("EXACT CALC", est.x + (est.x > W/2 ? -18 : 18), est.y + 14);
    ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(est.x, est.y);
    ctx.strokeStyle = "rgba(167,139,250,0.35)"; ctx.lineWidth = 1.5;
    ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawErrorLine(ctx, g, src) {
  if (!g || !src) return;
  const err = dist(g, src);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(src.x, src.y);
  ctx.strokeStyle = "rgba(255,214,0,0.5)"; ctx.lineWidth = 2;
  ctx.setLineDash([6,4]); ctx.stroke(); ctx.setLineDash([]);
  const mx = (g.x+src.x)/2, my = (g.y+src.y)/2;
  ctx.fillStyle = "rgba(5,10,25,0.88)"; rr(ctx, mx-32, my-12, 64, 20, 5); ctx.fill();
  ctx.fillStyle = "#FFD600"; ctx.font = "bold 11px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(`Δ = ${err.toFixed(0)} px`, mx, my - 1);
  ctx.restore();
}

function ResultOverlay({ result, onNext, onClose, isLastRound, totalScore }) {
  const win = result.stars >= 2;
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 60); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.72)", backdropFilter:"blur(6px)", zIndex:10, opacity:show?1:0, transition:"opacity 0.35s ease" }}>
      <div style={{ background:win?"linear-gradient(145deg,#001a12,#002a1e)":"linear-gradient(145deg,#1a0008,#2a0010)", border:`2px solid ${result.accent}55`, borderRadius:20, padding:"32px 40px", textAlign:"center", minWidth:320, boxShadow:`0 0 60px ${result.accent}33, 0 20px 60px rgba(0,0,0,0.6)`, transform:show?"scale(1) translateY(0)":"scale(0.85) translateY(20px)", transition:"transform 0.35s cubic-bezier(.34,1.56,.64,1)" }}>
        <div style={{ fontSize:64, lineHeight:1, marginBottom:8 }}>{result.emoji}</div>
        <div style={{ fontSize:32, fontWeight:"bold", color:result.accent, fontFamily:"monospace", letterSpacing:2, marginBottom:4 }}>{result.label}</div>
        <div style={{ display:"flex", justifyContent:"center", gap:6, margin:"10px 0" }}>
          {[0,1,2].map(i => <span key={i} style={{ fontSize:28, filter:i<result.stars?"none":"grayscale(1) opacity(0.25)", transition:`filter 0.3s ease ${i*0.1}s` }}>⭐</span>)}
        </div>
        <div style={{ fontSize:38, fontWeight:"bold", color:result.accent, fontFamily:"monospace" }}>+{result.pts} pts</div>
        {result.err && <div style={{ fontSize:13, color:"rgba(200,230,255,0.55)", marginTop:6 }}>Error distance: {result.err} px</div>}
        {result.guessCoords && result.trueCoords && (
          <div style={{ marginTop:12, padding:"10px 14px", background:"rgba(0,0,0,0.3)", borderRadius:10, fontSize:12, fontFamily:"monospace", textAlign:"left" }}>
            <div style={{ color:"#FFD600", marginBottom:4 }}>🎯 GUESS: ({Math.round(result.guessCoords.x)}, {Math.round(result.guessCoords.y)})</div>
            <div style={{ color:"#ff8888" }}>✕ TRUE:  ({Math.round(result.trueCoords.x)}, {Math.round(result.trueCoords.y)})</div>
            <div style={{ color:"#A78BFA", marginTop:4 }}>📐 CALC: ({Math.round(result.calcCoords.x)}, {Math.round(result.calcCoords.y)})</div>
          </div>
        )}
        {isLastRound && (
          <div style={{ marginTop:14, padding:"10px 16px", background:"rgba(255,255,255,0.06)", borderRadius:10, fontSize:14, color:"rgba(200,230,255,0.8)" }}>
            🏁 Game over · Total: <strong style={{ color:result.accent }}>{totalScore} pts</strong>
          </div>
        )}
        <div style={{ display:"flex", gap:10, marginTop:20, justifyContent:"center" }}>
          <button onClick={onClose} style={{ ...gBtn, padding:"9px 18px" }}>Close</button>
          <button onClick={onNext} style={{ ...pBtn, background:result.accent, color:"#000", padding:"9px 22px", fontWeight:"bold" }}>
            {isLastRound ? "🔄 New Game" : "▶ Next Round"}
          </button>
        </div>
      </div>
    </div>
  );
}

// زر التبديل في الشريط الجانبي
function SideBtn({ active, color = "#A78BFA", children, onClick }) {
  return (
    <button onClick={onClick} style={{
      width:"100%", textAlign:"left",
      background: active ? color + "18" : "transparent",
      color: active ? color : "rgba(180,225,255,0.6)",
      border: `1px solid ${active ? color + "66" : "rgba(0,255,200,0.1)"}`,
      borderRadius:8, padding:"8px 12px", fontFamily:"monospace",
      fontSize:11, cursor:"pointer", letterSpacing:0.5,
      display:"flex", alignItems:"center", gap:8, transition:"all 0.2s",
    }}>
      <span style={{ fontSize:10 }}>{active ? "◉" : "○"}</span>
      {children}
    </button>
  );
}

export default function App() {
  const canvasRef = useRef(null);
  const rafRef    = useRef(0);
  const timersRef = useRef([]);

  const [phase, setPhase]          = useState("idle");
  const [source, setSource]        = useState(null);
  const [arrivals, setArrivals]    = useState([]);
  const [estimated, setEstimated]  = useState(null);
  const [guess, setGuess]          = useState(null);
  const [showHyp, setShowHyp]      = useState(false);
  const [showEst, setShowEst]      = useState(false);
  const [showCoords, setShowCoords]= useState(false);
  const [showMath, setShowMath]    = useState(false);

  const [rings, setRings]          = useState([]);
  const [waveR, setWaveR]          = useState(0);
  const [activeSet, setActiveSet]  = useState(new Set());
  const [pulseMap, setPulseMap]    = useState({});
  const [flashId, setFlashId]      = useState(null);

  const [score, setScore]          = useState(0);
  const [round, setRound]          = useState(0);
  const [history, setHistory]      = useState([]);
  const [resultInfo, setResultInfo]= useState(null);
  const [showResult, setShowResult]= useState(false);
  const [timeLeft, setTimeLeft]    = useState(60);
  const [timerOn, setTimerOn]      = useState(false);

  const [ambientTick, setAmbientTick] = useState(0);
  const ambRaf = useRef(0);
  useEffect(() => {
    const loop = () => { setAmbientTick(t => t + 1); ambRaf.current = requestAnimationFrame(loop); };
    ambRaf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(ambRaf.current);
  }, []);

  useEffect(() => {
    if (activeSet.size === 0) return;
    const id = setInterval(() => {
      setPulseMap(() => {
        const next = {};
        activeSet.forEach(id => { next[id] = (Math.sin(Date.now() / 300 + SENSORS.findIndex(s => s.id === id)) + 1) / 2; });
        return next;
      });
    }, 40);
    return () => clearInterval(id);
  }, [activeSet]);

  useEffect(() => {
    if (!timerOn) return;
    if (timeLeft <= 0) { handleTimeout(); return; }
    const id = setTimeout(() => {
      setTimeLeft(t => { const n = t - 1; if (n <= 10 && n > 0) playCountdownBeep(n); return n; });
    }, 1000);
    timersRef.current.push(id);
    return () => clearTimeout(id);
  }, [timerOn, timeLeft]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createRadialGradient(W/2, H/2, 60, W/2, H/2, Math.max(W,H)*0.75);
    bg.addColorStop(0, "#080e24"); bg.addColorStop(0.55, "#04091a"); bg.addColorStop(1, "#020610");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const t = ambientTick * 0.015;
    for (let i = 0; i < 55; i++) {
      const sx = (i * 127 + Math.sin(t * 0.3 + i) * 4 + W*10) % W;
      const sy = (i * 83  + Math.cos(t * 0.4 + i) * 3 + H*10) % H;
      const bri = 0.08 + Math.sin(t * 1.5 + i * 0.7) * 0.04;
      ctx.beginPath(); ctx.arc(sx, sy, 0.8 + (i%3)*0.3, 0, Math.PI*2);
      ctx.fillStyle = `rgba(180,220,255,${bri})`; ctx.fill();
    }
    const scanY = ((ambientTick * 1.2) % (H + 20)) - 10;
    ctx.beginPath(); ctx.moveTo(0, scanY); ctx.lineTo(W, scanY);
    ctx.strokeStyle = "rgba(0,255,200,0.04)"; ctx.lineWidth = 1.5; ctx.stroke();
    drawGrid(ctx);
    if (showHyp && arrivals.length >= 3 && (phase === "revealed" || phase === "guessing")) drawHyperbolas(ctx, arrivals);
    if (source && phase === "listening") { drawRays(ctx, source, arrivals, waveR); drawWaves(ctx, source, rings); }
    drawSensors(ctx, arrivals, activeSet, pulseMap, flashId, phase, showCoords);
    if (phase === "revealed") {
      drawSourceReveal(ctx, source, estimated, showEst);
      drawGuessPoint(ctx, guess);
      drawErrorLine(ctx, guess, source);
      drawCoordLabels(ctx, guess, source);
    }
    ctx.fillStyle = "rgba(0,255,200,0.14)"; ctx.font = "10px monospace"; ctx.textAlign = "right";
    ctx.fillText("TRACK 3 · Nano-Phononics · d = vg · Δt", W - 8, H - 6);
  }, [source, arrivals, rings, waveR, activeSet, pulseMap, flashId, phase,
      guess, estimated, showHyp, showEst, showCoords, ambientTick]);

  function clearAll() {
    cancelAnimationFrame(rafRef.current);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setTimerOn(false);
  }

  function startRound() {
    clearAll();
    const src = randSource();
    const arr = computeArrivals(src);
    const est = solveExact(arr);
    setSource(src); setArrivals(arr); setEstimated(est);
    setGuess(null); setShowHyp(false); setShowEst(false);
    setRings([]); setWaveR(0); setActiveSet(new Set()); setPulseMap({});
    setFlashId(null); setResultInfo(null); setShowResult(false);
    setTimeLeft(60); setRound(r => r + 1); setPhase("listening");

    arr.forEach((a, i) => {
      const pan = (a.x / W) * 2 - 1;
      playTone(a.dt, a.freq, pan);
      const tid = setTimeout(() => {
        setActiveSet(prev => new Set([...prev, a.id]));
        if (i === 0) {
          setFlashId(a.id);
          const fid = setTimeout(() => setFlashId(null), 700);
          timersRef.current.push(fid);
        }
      }, a.dt * 1000);
      timersRef.current.push(tid);
    });

    const maxDist = Math.max(...SENSORS.map(s => dist(src, s)));
    const totalMs = (maxDist / WAVE_SPEED + 1.0) * 1000;
    const maxR = Math.max(W, H) * 0.9;
    const t0 = performance.now();
    const RING_COUNT = 6, RING_GAP = 60;

    function animate(now) {
      const elapsed = now - t0;
      const progress = Math.min(elapsed / totalMs, 1);
      const leadR = progress * maxR;
      const newRings = [];
      for (let i = 0; i < RING_COUNT; i++) {
        const r = leadR - i * RING_GAP;
        if (r > 0) { const fade = 1-(i/RING_COUNT); const edge = Math.min(r/40,1); newRings.push({r, alpha:fade*edge*0.55}); }
      }
      setRings(newRings); setWaveR(leadR);
      if (progress < 1) { rafRef.current = requestAnimationFrame(animate); }
      else { setRings([]); setPhase("guessing"); setTimerOn(true); }
    }
    rafRef.current = requestAnimationFrame(animate);
  }

  function handleTimeout() {
    setTimerOn(false); setPhase("revealed"); setShowEst(true); setShowHyp(true);
    const res = { pts:0, stars:0, label:"TIME OUT", emoji:"⏰", accent:"#888888", err:null };
    setResultInfo(res);
    setHistory(h => [...h, { round:round+1, pts:0, stars:0, label:"Time Out", accent:"#888" }]);
    setShowResult(true);
  }

  function handleCanvasClick(e) {
    if (phase !== "guessing") return;
    const rect = canvasRef.current.getBoundingClientRect();
    const gx = (e.clientX - rect.left) * (W / rect.width);
    const gy = (e.clientY - rect.top)  * (H / rect.height);
    const g = { x:gx, y:gy };
    const err = dist(g, source);
    const res = { ...scoreGuess(err), err:err.toFixed(0), guessCoords:g, trueCoords:source, calcCoords:estimated };
    setGuess(g); setTimerOn(false); setPhase("revealed"); setShowEst(true); setShowHyp(true);
    setResultInfo(res); setScore(s => s + res.pts);
    setHistory(h => [...h, { round, pts:res.pts, stars:res.stars, label:res.label, accent:res.accent, err:res.err }]);
    setTimeout(() => { playResultSound(res.stars >= 2); setShowResult(true); }, 300);
  }

  function handleNext() {
    setShowResult(false);
    if (round >= MAX_ROUNDS) {
      clearAll(); setRound(0); setScore(0); setHistory([]);
      setSource(null); setArrivals([]); setPhase("idle");
    } else { startRound(); }
  }

  const progress = Math.min((score / (MAX_ROUNDS * 100)) * 100, 100);
  const isLastRound = round >= MAX_ROUNDS;

  return (
    <div style={{ minHeight:"100vh", background:"#020610", color:"#c8e8ff", fontFamily:"monospace", padding:16, boxSizing:"border-box", overflowY:"auto" }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14, padding:"12px 16px", background:"rgba(0,255,200,0.04)", border:"1px solid rgba(0,255,200,0.1)", borderRadius:12, flexWrap:"wrap", gap:8 }}>
        <div>
          <div style={{ fontSize:10, letterSpacing:2, color:"#00FFC8", marginBottom:4 }}>▸ TRACK 3 · NANO-PHONONICS · ACOUSTIC TRIANGULATION</div>
          <div style={{ fontSize:22, fontWeight:"bold", color:"#eaf8ff", letterSpacing:1 }}>🔊 Wave Detective Lab</div>
          <div style={{ fontSize:11, color:"rgba(0,255,200,0.5)", marginTop:2 }}>d = v<sub>g</sub> · Δt · TDOA Localization</div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          {[{l:"ROUND",v:`${round}/${MAX_ROUNDS}`},{l:"SCORE",v:score}].map(({l,v}) => (
            <div key={l} style={{ textAlign:"center", background:"rgba(0,10,30,0.8)", border:"1px solid rgba(0,255,200,0.15)", borderRadius:10, padding:"8px 16px" }}>
              <div style={{ fontSize:9, color:"rgba(0,255,200,0.5)", letterSpacing:1.5 }}>{l}</div>
              <div style={{ fontSize:22, color:"#00FFC8", fontWeight:"bold" }}>{v}</div>
            </div>
          ))}
          {(phase === "guessing" || phase === "listening") && (
            <div style={{ textAlign:"center", background:timeLeft<=10?"rgba(255,0,50,0.15)":"rgba(0,10,30,0.8)", border:`1px solid ${timeLeft<=10?"#ff4466":"rgba(0,255,200,0.15)"}`, borderRadius:10, padding:"8px 16px", transition:"all 0.3s" }}>
              <div style={{ fontSize:9, color:"rgba(200,200,200,0.5)", letterSpacing:1.5 }}>TIME</div>
              <div style={{ fontSize:22, color:timeLeft<=10?"#ff6688":"#eaf8ff", fontWeight:"bold" }}>{timeLeft}s</div>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 290px", gap:14, alignItems:"start" }}>

        {/* Left: Canvas */}
        <div>
          <div style={{ position:"relative", borderRadius:16, overflow:"hidden", boxShadow:"0 0 0 1px rgba(0,255,200,0.12), 0 12px 60px rgba(0,0,0,0.7)" }}>
            <canvas ref={canvasRef} width={W} height={H} onClick={handleCanvasClick}
              style={{ display:"block", width:"100%", cursor:phase==="guessing"?"crosshair":"default" }} />
            {phase === "idle" && (
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(2,6,16,0.78)", backdropFilter:"blur(4px)" }}>
                <div style={{ textAlign:"center", maxWidth:400 }}>
                  <div style={{ fontSize:52, marginBottom:10 }}>🔊</div>
                  <div style={{ fontSize:20, color:"#00FFC8", fontWeight:"bold", marginBottom:6, letterSpacing:1 }}>ACOUSTIC TRIANGULATION</div>
                  <div style={{ fontSize:13, color:"rgba(180,230,255,0.7)", lineHeight:1.7, marginBottom:24 }}>
                    A hidden pulse radiates through the plate.<br />4 sensors detect the wave at different times.<br />
                    Use <span style={{ color:"#00FFC8" }}>d = v<sub>g</sub> · Δt</span> to find the source.
                  </div>
                  <button onClick={startRound} style={{ ...pBtn, fontSize:15, padding:"12px 32px", background:"#00FFC8", color:"#000" }}>▶ START EXPERIMENT</button>
                </div>
              </div>
            )}
            {phase === "guessing" && (
              <div style={{ position:"absolute", top:12, left:"50%", transform:"translateX(-50%)", background:"rgba(2,8,22,0.9)", border:"1px solid rgba(0,255,200,0.35)", borderRadius:8, padding:"8px 20px", whiteSpace:"nowrap" }}>
                <span style={{ fontSize:13, color:"#00FFC8" }}>🎯 Click the plate to place your guess</span>
              </div>
            )}
            {showResult && resultInfo && (
              <ResultOverlay result={resultInfo} onNext={handleNext} onClose={() => setShowResult(false)} isLastRound={isLastRound} totalScore={score} />
            )}
          </div>

          {/* Timer bar */}
          <div style={{ marginTop:8, height:4, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden" }}>
            <div style={{ height:"100%", borderRadius:2, width:timerOn?`${(timeLeft/60)*100}%`:phase==="revealed"?"100%":"0%", background:timeLeft<=10?"#FF4D8D":"#00FFC8", transition:"width 1s linear, background 0.4s ease" }} />
          </div>

          {/* Action Buttons - فقط Next Round و Reset */}
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            {phase !== "idle" && (
              <button onClick={startRound} style={{ ...pBtn, background:"#00FFC8", color:"#000" }}>
                {phase === "revealed" ? "▶ Next Round" : "↺ Restart"}
              </button>
            )}
            {phase !== "idle" && (
              <button onClick={() => { clearAll(); setRound(0); setScore(0); setHistory([]); setSource(null); setArrivals([]); setPhase("idle"); }} style={gBtn}>
                ✕ Reset
              </button>
            )}
          </div>
        </div>

        {/* ══ Right Sidebar ══ */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

          {/* ✅ DISPLAY CONTROLS - دائماً مرئي في الجانب */}
          <div style={{ background:"rgba(0,8,25,0.9)", border:"1px solid rgba(0,255,200,0.1)", borderRadius:12, padding:14 }}>
            <div style={{ fontSize:10, color:"rgba(0,255,200,0.5)", letterSpacing:2, marginBottom:10 }}>DISPLAY CONTROLS</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <SideBtn active={showCoords} color="#FFD600" onClick={() => setShowCoords(v => !v)}>
                Coords
              </SideBtn>
              {(phase === "guessing" || phase === "revealed") && (
                <SideBtn active={showHyp} color="#A78BFA" onClick={() => setShowHyp(v => !v)}>
                  TDOA Curves
                </SideBtn>
              )}
              {phase === "revealed" && (
                <SideBtn active={showEst} color="#A78BFA" onClick={() => setShowEst(v => !v)}>
                  Calc Point
                </SideBtn>
              )}
              {/* ✅ Physics دائماً مرئي هنا بغض النظر عن الـ phase */}
              <SideBtn active={showMath} color="#00FFC8" onClick={() => setShowMath(v => !v)}>
                Physics ƒ(x)
              </SideBtn>
            </div>
          </div>

          {/* Physics Panel */}
          {showMath && (
            <div style={{ background:"rgba(0,15,40,0.9)", border:"1px solid rgba(0,255,200,0.12)", borderRadius:12, padding:14, fontSize:12, lineHeight:1.9 }}>
              <div style={{ color:"#00FFC8", fontWeight:"bold", marginBottom:8, fontSize:13, letterSpacing:1 }}>⚗ PHYSICS & MATH</div>
              <div style={{ color:"rgba(180,230,255,0.85)" }}>
                <b style={{ color:"#00FFC8" }}>Wave speed:</b> v<sub>g</sub> = {WAVE_SPEED} px/s<br />
                <b style={{ color:"#00FFC8" }}>Distance:</b> d = √[(x−xₛ)² + (y−yₛ)²]<br />
                <b style={{ color:"#00FFC8" }}>Arrival time:</b> tᵢ = dᵢ / v<sub>g</sub><br />
                <b style={{ color:"#00FFC8" }}>TDOA:</b> Δtᵢⱼ = (dᵢ − dⱼ) / v<sub>g</sub><br />
                <b style={{ color:"#00FFC8" }}>Hyperbola:</b> |d(P,Sᵢ) − d(P,Sⱼ)| = const
              </div>
              {arrivals.length > 0 && estimated && (
                <div style={{ marginTop:10, borderTop:"1px solid rgba(0,255,200,0.08)", paddingTop:10 }}>
                  {arrivals.map(a => (
                    <div key={a.id} style={{ color:"rgba(180,230,255,0.65)", fontSize:11 }}>
                      {a.id}: d={a.d.toFixed(0)}px · Δt={a.dt===0?"0 (first)":`+${(a.dt*1000).toFixed(0)}ms`}
                    </div>
                  ))}
                  <div style={{ marginTop:8, color:"#A78BFA", fontSize:11, fontWeight:"bold" }}>
                    📐 Exact Calc: ({Math.round(estimated.x)}, {Math.round(estimated.y)})
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sensor Log */}
          <div style={{ background:"rgba(0,8,25,0.9)", border:"1px solid rgba(0,255,200,0.1)", borderRadius:12, padding:14 }}>
            <div style={{ fontSize:10, color:"rgba(0,255,200,0.5)", letterSpacing:2, marginBottom:12 }}>SENSOR ARRIVAL LOG</div>
            {arrivals.length === 0
              ? <div style={{ fontSize:12, color:"rgba(150,190,240,0.35)", fontStyle:"italic" }}>Awaiting experiment...</div>
              : arrivals.map((a, i) => {
                const s = SENSORS.find(s => s.id === a.id);
                const isAct = activeSet.has(a.id);
                return (
                  <div key={a.id} style={{ marginBottom:8, padding:"8px 10px", borderRadius:8, background:i===0?`${s.color}12`:"rgba(10,20,50,0.5)", border:`1px solid ${i===0?s.color+"44":"rgba(0,255,200,0.07)"}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ width:11, height:11, borderRadius:"50%", background:isAct?s.color:"rgba(80,120,180,0.3)", boxShadow:isAct?`0 0 8px ${s.color}`:"none", flexShrink:0 }} />
                        <span style={{ fontSize:13, color:"#eaf8ff", fontWeight:i===0?"bold":"normal" }}>{a.id}</span>
                        {i===0 && <span style={{ fontSize:9, color:s.color, letterSpacing:1 }}>FIRST</span>}
                      </div>
                      <span style={{ fontSize:13, fontWeight:"bold", color:i===0?s.color:"rgba(180,230,255,0.8)" }}>
                        {a.dt===0?"t₀":`+${(a.dt*1000).toFixed(0)} ms`}
                      </span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:5 }}>
                      <span style={{ fontSize:10, color:s.color+"99" }}>({s.x}px, {s.y}px)</span>
                      <span style={{ fontSize:10, color:"rgba(150,200,255,0.45)" }}>d={a.d.toFixed(0)}px</span>
                    </div>
                    <div style={{ marginTop:6, height:3, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ height:"100%", borderRadius:2, width:isAct?`${100-(a.dt/(arrivals[arrivals.length-1].dt||1))*80}%`:"0%", background:s.color, transition:"width 0.5s ease" }} />
                    </div>
                  </div>
                );
              })
            }
          </div>

          {/* Coords Panel */}
          {phase === "revealed" && guess && source && (
            <div style={{ background:"rgba(0,8,25,0.9)", border:"1px solid rgba(255,214,0,0.2)", borderRadius:12, padding:14 }}>
              <div style={{ fontSize:10, color:"rgba(255,214,0,0.5)", letterSpacing:2, marginBottom:10 }}>📍 COORDINATES</div>
              <div style={{ fontSize:12, lineHeight:2.2 }}>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ color:"rgba(180,225,255,0.5)" }}>🎯 Your Guess</span>
                  <span style={{ color:"#FFD600", fontWeight:"bold" }}>({Math.round(guess.x)}, {Math.round(guess.y)})</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ color:"rgba(180,225,255,0.5)" }}>✕ True Source</span>
                  <span style={{ color:"#ff8888", fontWeight:"bold" }}>({Math.round(source.x)}, {Math.round(source.y)})</span>
                </div>
                {estimated && (
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ color:"rgba(180,225,255,0.5)" }}>📐 Exact Calc</span>
                    <span style={{ color:"#A78BFA", fontWeight:"bold" }}>({Math.round(estimated.x)}, {Math.round(estimated.y)})</span>
                  </div>
                )}
                <div style={{ marginTop:6, paddingTop:6, borderTop:"1px solid rgba(255,214,0,0.1)", display:"flex", justifyContent:"space-between" }}>
                  <span style={{ color:"rgba(180,225,255,0.5)" }}>Δ Error</span>
                  <span style={{ color:"#FFD600" }}>{dist(guess, source).toFixed(1)} px</span>
                </div>
              </div>
            </div>
          )}

          {/* TDOA Hint */}
          {phase === "guessing" && arrivals.length > 0 && (() => {
            const first = arrivals[0], last = arrivals[arrivals.length-1];
            const fs = SENSORS.find(s => s.id === first.id);
            const ls = SENSORS.find(s => s.id === last.id);
            return (
              <div style={{ background:"rgba(0,8,25,0.9)", border:"1px solid rgba(0,255,200,0.1)", borderRadius:12, padding:14, fontSize:12, lineHeight:1.75, color:"rgba(180,225,255,0.75)" }}>
                <div style={{ fontSize:10, color:"rgba(0,255,200,0.5)", letterSpacing:2, marginBottom:8 }}>TDOA HINT</div>
                <span style={{ color:fs.color }}>■ {first.id}</span> heard first → nearest to source<br />
                <span style={{ color:ls.color }}>■ {last.id}</span> heard last (+{(last.dt*1000).toFixed(0)} ms) → farthest
              </div>
            );
          })()}

          {/* History */}
          {history.length > 0 && (
            <div style={{ background:"rgba(0,8,25,0.9)", border:"1px solid rgba(0,255,200,0.1)", borderRadius:12, padding:14 }}>
              <div style={{ fontSize:10, color:"rgba(0,255,200,0.5)", letterSpacing:2, marginBottom:10 }}>ROUND HISTORY</div>
              {history.map((h, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:11, padding:"5px 0", borderBottom:"1px solid rgba(0,255,200,0.05)", color:"rgba(180,225,255,0.65)" }}>
                  <span style={{ color:"rgba(0,255,200,0.4)" }}>R{h.round}</span>
                  <span>{[0,1,2].map(j => <span key={j} style={{ opacity:j<h.stars?1:0.15 }}>⭐</span>)}</span>
                  <span style={{ color:h.accent }}>{h.label}</span>
                  {h.err && <span style={{ color:"rgba(150,200,255,0.4)" }}>{h.err}px</span>}
                  <span style={{ color:"#00FFC8" }}>+{h.pts}</span>
                </div>
              ))}
              <div style={{ marginTop:10, height:5, background:"rgba(255,255,255,0.06)", borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${progress}%`, background:"linear-gradient(90deg,#00FFC8,#A78BFA)", borderRadius:3, transition:"width 0.6s ease" }} />
              </div>
              <div style={{ fontSize:10, color:"rgba(0,255,200,0.4)", marginTop:4, textAlign:"right" }}>{score} / {MAX_ROUNDS*100} pts</div>
            </div>
          )}

          {/* How to play */}
          {phase === "idle" && round === 0 && (
            <div style={{ background:"rgba(0,8,25,0.9)", border:"1px solid rgba(0,255,200,0.1)", borderRadius:12, padding:14, fontSize:12, lineHeight:1.85, color:"rgba(180,225,255,0.7)" }}>
              <div style={{ fontSize:10, color:"rgba(0,255,200,0.5)", letterSpacing:2, marginBottom:8 }}>HOW TO PLAY</div>
              <span style={{ color:"#00FFC8" }}>①</span> Start — pulse fires from hidden source<br />
              <span style={{ color:"#FFD600" }}>②</span> Listen: closer sensor = sooner<br />
              <span style={{ color:"#FF4D8D" }}>③</span> Watch which sensor glows first<br />
              <span style={{ color:"#A78BFA" }}>④</span> Click plate before 60s to guess<br />
              <span style={{ color:"#00FFC8" }}>⑤</span> Use TDOA curves to see the math
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const pBtn = {
  background:"#00FFC8", color:"#000", border:"none",
  borderRadius:8, padding:"9px 16px", fontFamily:"monospace",
  fontSize:12, fontWeight:"bold", cursor:"pointer", letterSpacing:0.5, whiteSpace:"nowrap",
};
const gBtn = {
  background:"transparent", color:"rgba(0,255,200,0.7)",
  border:"1px solid rgba(0,255,200,0.2)", borderRadius:8,
  padding:"9px 12px", fontFamily:"monospace",
  fontSize:11, cursor:"pointer", letterSpacing:0.5, whiteSpace:"nowrap",
};