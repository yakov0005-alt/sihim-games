// WebAudio sfx for "neon". Reuses the shared Sihim.audio() context (unlocked
// by the start-overlay click) but routes everything through our own master
// gain + gentle DynamicsCompressor instead of hitting destination directly,
// so a flurry of pickups/boosts never clips. Respects the HUD sound toggle
// and ?mute=1 (game.js mirrors mute into the same 'sihim:sound' flag that
// Sihim.soundOn() reads live, so a single check covers both).
let chain = null;

function getChain() {
  const S = typeof window !== 'undefined' ? window.Sihim : null;
  if (!S) return null;
  const ctx = S.audio();
  if (!ctx) return null;
  if (chain && chain.ctx === ctx) return chain;
  const master = ctx.createGain();
  master.gain.value = 0.5;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.setValueAtTime(-28, ctx.currentTime);
  comp.knee.setValueAtTime(8, ctx.currentTime);
  comp.ratio.setValueAtTime(12, ctx.currentTime);
  comp.attack.setValueAtTime(0.003, ctx.currentTime);
  comp.release.setValueAtTime(0.22, ctx.currentTime);
  master.connect(comp).connect(ctx.destination);
  chain = { ctx, master };
  return chain;
}

function tone(freq = 440, dur = 0.12, type = 'square', vol = 0.15, slide, delay = 0) {
  const c = getChain();
  if (!c) return;
  const { ctx, master } = c;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, slide), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + Math.min(0.02, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur = 0.2, vol = 0.2, { filterFreq, filterType = 'lowpass', delay = 0 } = {}) {
  const c = getChain();
  if (!c) return;
  const { ctx, master } = c;
  const t0 = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  let node = src;
  if (filterFreq) {
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = filterFreq;
    src.connect(f);
    node = f;
  }
  node.connect(g).connect(master);
  src.start(t0);
}

export function createAudio({ muted = false } = {}) {
  const ready = () => {
    if (muted) return false;
    const S = typeof window !== 'undefined' ? window.Sihim : null;
    return !!(S && S.soundOn());
  };

  let steerFlip = false;
  let tickClock = 0;

  function steer() {
    if (!ready()) return;
    steerFlip = !steerFlip;
    tone(steerFlip ? 540 : 480, 0.045, 'square', 0.05);
  }

  function climbStart() {
    if (!ready()) return;
    tone(260, 0.1, 'sine', 0.06, 460);
  }

  // Charging hum while riding the wall — self-throttled so play.js just
  // calls this every frame with the current charge/active state.
  function climbTick(dt, active, charge) {
    if (!active) { tickClock = 0; return; }
    tickClock -= dt;
    if (tickClock > 0 || !ready()) return;
    const t = Math.max(0, Math.min(1, charge / 100));
    tickClock = Math.max(0.05, 0.22 - t * 0.16);
    tone(360 + t * 420, 0.035, 'triangle', 0.035 + t * 0.03);
  }

  function boost(quality = 'ok') {
    if (!ready()) return;
    if (quality === 'perfect') {
      tone(220, 0.3, 'sawtooth', 0.2, 880);
      tone(440, 0.22, 'triangle', 0.1, 1320, 0.03);
    } else if (quality === 'good') {
      tone(200, 0.26, 'sawtooth', 0.18, 680);
    } else {
      tone(180, 0.2, 'sawtooth', 0.14, 420);
    }
  }

  function crash() {
    if (!ready()) return;
    noise(0.22, 0.24, { filterFreq: 1400 });
    tone(90, 0.3, 'sawtooth', 0.17, 38);
  }

  function gameOver() {
    if (!ready()) return;
    tone(260, 0.16, 'square', 0.12, 120, 0.05);
    tone(160, 0.3, 'sawtooth', 0.14, 60, 0.18);
  }

  function shieldBreak() {
    if (!ready()) return;
    tone(640, 0.18, 'triangle', 0.14, 220);
    tone(960, 0.12, 'sine', 0.06, 440, 0.03);
  }

  function pickup(type) {
    if (!ready()) return;
    const freq = type === 'battery' ? 820 : type === 'shield' ? 700 : 960;
    tone(freq, 0.12, 'square', 0.12, freq * 1.4);
  }

  function cleanPass(combo) {
    if (!ready()) return;
    tone(420 + Math.min(combo, 10) * 20, 0.07, 'square', 0.08);
  }

  function trackComplete() {
    if (!ready()) return;
    tone(520, 0.14, 'triangle', 0.16, 780);
    tone(780, 0.18, 'triangle', 0.14, 1040, 0.1);
  }

  function win() {
    if (!ready()) return;
    [520, 660, 780, 1040].forEach((f, i) => tone(f, 0.22, 'triangle', 0.15, f * 1.3, i * 0.09));
  }

  return {
    steer, climbStart, climbTick, boost, crash, gameOver,
    shieldBreak, pickup, cleanPass, trackComplete, win,
  };
}
