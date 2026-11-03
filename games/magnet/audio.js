// Self-contained WebAudio synth for "magnet": every sound funnels through one
// master gain + a gentle DynamicsCompressor before the shared AudioContext's
// destination (reused via Sihim.audio()), so the mix stays controlled no
// matter how many drones pop at once. Respects Sihim.soundOn() and ?mute=1
// (game.js forces localStorage sound off in that case).
let ctx = null, master = null;

function chain() {
  const a = window.Sihim && Sihim.audio();
  if (!a) return null;
  if (ctx !== a) {
    ctx = a;
    master = ctx.createGain();
    master.gain.value = 0.6;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24; comp.knee.value = 24; comp.ratio.value = 3.2;
    comp.attack.value = 0.003; comp.release.value = 0.22;
    master.connect(comp).connect(ctx.destination);
  }
  return ctx;
}

function tone(a, { freq = 440, dur = 0.12, type = 'sine', vol = 0.15, slideTo, delay = 0 } = {}) {
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, freq), t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + Math.min(0.015, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + dur + 0.03);
}

function clank(a, { dur = 0.16, vol = 0.14, freq = 700, delay = 0 } = {}) {
  const t0 = a.currentTime + delay;
  const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

// Each drone type answers a pop with its own timbre so a heavy drone thuds
// low while a scout pings bright, instead of every destroy sounding alike.
const TYPE_TONE = {
  scout: { base: 520, clank: 1100 },
  fast: { base: 640, clank: 1300 },
  heavy: { base: 300, clank: 480 },
  shield: { base: 420, clank: 1500 },
};

function startAmbienceNodes(a) {
  const g = a.createGain();
  const o1 = a.createOscillator(); o1.type = 'sine'; o1.frequency.value = 96;
  const o2 = a.createOscillator(); o2.type = 'sine'; o2.frequency.value = 144;
  const lfo = a.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.09;
  const lfoGain = a.createGain(); lfoGain.gain.value = 0.012;
  lfo.connect(lfoGain).connect(g.gain);
  o1.connect(g); o2.connect(g); g.connect(master);
  const t0 = a.currentTime;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.03, t0 + 1.4);
  o1.start(t0); o2.start(t0); lfo.start(t0);
  return { g, o1, o2, lfo };
}

function stopAmbienceNodes(a, nodes) {
  const t0 = a.currentTime;
  nodes.g.gain.cancelScheduledValues(t0);
  nodes.g.gain.setValueAtTime(Math.max(0.0001, nodes.g.gain.value), t0);
  nodes.g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
  nodes.o1.stop(t0 + 0.6); nodes.o2.stop(t0 + 0.6); nodes.lfo.stop(t0 + 0.6);
}

export function createAudio({ muted = false } = {}) {
  let enabled = !muted;
  let ambienceNodes = null, ambienceWanted = false;
  const ready = () => enabled && typeof window !== 'undefined' && window.Sihim && Sihim.soundOn() && chain();

  function grab() {
    const a = ready(); if (!a) return;
    tone(a, { freq: 260, dur: 0.08, type: 'square', vol: 0.09, slideTo: 420 });
  }

  function release(charge = 0) {
    const a = ready(); if (!a) return;
    const f = 300 + charge * 260;
    tone(a, { freq: f, dur: 0.1, type: 'sawtooth', vol: 0.1, slideTo: f * 1.6 });
  }

  // A quick rising chime the instant the cable hits full charge — tells the
  // player "throw now for max speed" without them watching the charge bar.
  function chargeFull() {
    const a = ready(); if (!a) return;
    tone(a, { freq: 900, dur: 0.07, type: 'triangle', vol: 0.08, slideTo: 1200 });
  }

  function pop(combo = 0, type) {
    const a = ready(); if (!a) return;
    const tt = TYPE_TONE[type] || TYPE_TONE.scout;
    const f = tt.base + Math.min(combo, 20) * 14;
    tone(a, { freq: f, dur: 0.09, type: 'square', vol: 0.12, slideTo: f * 1.8 });
    clank(a, { dur: 0.12, vol: 0.1, freq: tt.clank, delay: 0.01 });
  }

  function shieldBreak() {
    const a = ready(); if (!a) return;
    clank(a, { dur: 0.15, vol: 0.12, freq: 1200 });
  }

  function breach() {
    const a = ready(); if (!a) return;
    tone(a, { freq: 190, dur: 0.22, type: 'sawtooth', vol: 0.13, slideTo: 70 });
  }

  function bossHit(popped = false) {
    const a = ready(); if (!a) return;
    clank(a, { dur: popped ? 0.3 : 0.14, vol: popped ? 0.18 : 0.11, freq: popped ? 300 : 650 });
  }

  function win() {
    const a = ready(); if (!a) return;
    [420, 560, 700, 880].forEach((f, i) => tone(a, { freq: f, dur: 0.16, type: 'triangle', vol: 0.11, delay: i * 0.09, slideTo: f * 1.25 }));
  }

  function start() {
    const a = ready(); if (!a) return;
    tone(a, { freq: 300, dur: 0.1, type: 'sine', vol: 0.08, slideTo: 520 });
  }

  function gameOver() {
    const a = ready(); if (!a) return;
    [460, 360, 260, 180].forEach((f, i) => tone(a, { freq: f, dur: 0.18, type: 'triangle', vol: 0.1, delay: i * 0.1, slideTo: f * 0.8 }));
  }

  // Subtle two-oscillator pad, barely audible, just to keep the arena from
  // feeling silent between waves; always optional and gated the same as sfx.
  function startAmbience() {
    ambienceWanted = true;
    const a = ready();
    if (a && !ambienceNodes) ambienceNodes = startAmbienceNodes(a);
  }

  function stopAmbience() {
    ambienceWanted = false;
    const a = chain();
    if (a && ambienceNodes) { stopAmbienceNodes(a, ambienceNodes); ambienceNodes = null; }
  }

  function reset() {}

  function setEnabled(on) {
    enabled = on;
    const a = chain();
    if (!a) return;
    if (!on && ambienceNodes) { stopAmbienceNodes(a, ambienceNodes); ambienceNodes = null; }
    else if (on && ambienceWanted && !ambienceNodes) ambienceNodes = startAmbienceNodes(a);
  }

  return {
    grab, release, chargeFull, pop, shieldBreak, breach, bossHit, win, start, gameOver,
    startAmbience, stopAmbience, reset, setEnabled,
  };
}
