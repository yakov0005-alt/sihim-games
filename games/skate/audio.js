// Synth audio: one master gain + gentle compressor, varied SFX per player
// action, and an optional soft wind/pad ambience tied to the gust cycle.
// Everything routes through Sihim.audio() and respects Sihim.soundOn()
// (which the ?mute=1 flag in game.js flips off before play starts).
let masterChain = null;

function getMaster() {
  const actx = Sihim.audio();
  if (!actx) return null;
  if (!masterChain || masterChain.ctx !== actx) {
    const comp = actx.createDynamicsCompressor();
    comp.threshold.value = -27; comp.knee.value = 16; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.25;
    const gain = actx.createGain(); gain.gain.value = 0.36;
    gain.connect(comp).connect(actx.destination);
    masterChain = { ctx: actx, gain };
  }
  return masterChain.gain;
}

export function tone(f = 440, d = 0.12, type = 'square', v = 0.15, slide) {
  if (!Sihim.soundOn()) return;
  const actx = Sihim.audio(); const master = getMaster();
  if (!actx || !master) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, actx.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, actx.currentTime + d);
  g.gain.setValueAtTime(v, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + d);
  o.connect(g).connect(master); o.start(); o.stop(actx.currentTime + d + 0.02);
}

export function noise(d = 0.2, v = 0.15) {
  if (!Sihim.soundOn()) return;
  const actx = Sihim.audio(); const master = getMaster();
  if (!actx || !master) return;
  const b = actx.createBuffer(1, Math.max(1, actx.sampleRate * d), actx.sampleRate);
  const ch = b.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
  const s = actx.createBufferSource(), g = actx.createGain();
  g.gain.value = v; s.buffer = b; s.connect(g).connect(master); s.start();
}

// Named SFX so play.js stays about *what happened*, not synth parameters.
export const sfx = {
  deny() { noise(0.06, 0.05); tone(160, 0.08, 'square', 0.05, 90); },
  launch(power = 0) {
    noise(0.1, 0.05 + power * 0.04);
    tone(300 + power * 260, 0.16, 'sawtooth', 0.13, 640 + power * 320);
  },
  trick(key, comboIndex = 0) {
    const bump = Math.min(comboIndex, 6) * 35;
    if (key === 'kickflip') tone(420 + bump, 0.1, 'square', 0.13, 260 + bump);
    else if (key === 'grab') tone(300 + bump, 0.16, 'triangle', 0.13, 420 + bump);
    else tone(480 + bump, 0.18, 'sawtooth', 0.13, 960 + bump * 2);
  },
  land(quality) {
    if (quality === 'perfect') {
      tone(620, 0.16, 'triangle', 0.17, 980);
      setTimeout(() => tone(880, 0.2, 'triangle', 0.14, 1320), 70);
    } else if (quality === 'good') {
      tone(520, 0.18, 'triangle', 0.16, 820);
    } else {
      tone(420, 0.16, 'triangle', 0.13, 560);
    }
  },
  crash() { noise(0.22, 0.17); tone(150, 0.26, 'sawtooth', 0.14, 55); },
  wipeout() { noise(0.2, 0.15); tone(340, 0.3, 'sawtooth', 0.12, 90); },
  comboMilestone(n) { tone(500 + Math.min(n, 20) * 18, 0.22, 'square', 0.14, 1100 + n * 20); },
  stageClear() {
    [0, 90, 180].forEach((ms, i) => setTimeout(() => tone(520 + i * 160, 0.18, 'triangle', 0.15, 700 + i * 220), ms));
  },
  win() {
    [0, 100, 200, 320].forEach((ms, i) => setTimeout(() => tone(440 + i * 140, 0.22, 'triangle', 0.16, 880 + i * 160), ms));
  },
};

// Optional ambience: filtered wind noise + a soft two-oscillator pad, both
// riding the wind-gust cycle and ride speed. Lazily built on first update so
// a muted session never touches WebAudio at all.
let amb = null;

function buildAmbience(actx, master) {
  const buf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
  const filter = actx.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = 450; filter.Q.value = 0.7;
  const windGain = actx.createGain(); windGain.gain.value = 0;
  src.connect(filter).connect(windGain).connect(master); src.start();

  const padGain = actx.createGain(); padGain.gain.value = 0;
  const o1 = actx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 110;
  const o2 = actx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 164.8;
  o1.connect(padGain); o2.connect(padGain); padGain.connect(master);
  o1.start(); o2.start();

  return { ctx: actx, windGain, padGain, filter };
}

export function updateAmbience(dt, { gust = 0, speedFactor = 0, airborne = false } = {}) {
  if (!Sihim.soundOn()) {
    if (amb) {
      const now = amb.ctx.currentTime;
      amb.windGain.gain.setTargetAtTime(0, now, 0.2);
      amb.padGain.gain.setTargetAtTime(0, now, 0.2);
    }
    return;
  }
  const actx = Sihim.audio(); const master = getMaster();
  if (!actx || !master) return;
  if (!amb || amb.ctx !== actx) amb = buildAmbience(actx, master);
  const now = actx.currentTime;
  const windTarget = 0.025 + gust * 0.05 + (airborne ? 0.035 : 0);
  const padTarget = 0.018 + speedFactor * 0.014;
  amb.windGain.gain.setTargetAtTime(windTarget, now, 0.25);
  amb.padGain.gain.setTargetAtTime(padTarget, now, 0.6);
  amb.filter.frequency.setTargetAtTime(380 + gust * 1600 + (airborne ? 300 : 0), now, 0.2);
}
