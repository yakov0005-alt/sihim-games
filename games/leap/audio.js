// Self-contained synth for leap: every cue funnels through one master gain +
// a gentle DynamicsCompressor sitting on the shared Sihim AudioContext (reused
// via Sihim.audio(), so we never spawn a second context), keeping the mix
// controlled no matter how many layers fire at once. Reads Sihim.soundOn()
// per call, which already folds in the sound toggle and ?mute=1 (game.js
// flips localStorage sound off for that query flag before boot).
let ctx = null, master = null;

function chain() {
  const a = typeof Sihim !== 'undefined' && Sihim.audio();
  if (!a) return null;
  if (ctx !== a) {
    ctx = a;
    master = ctx.createGain();
    master.gain.value = 0.38;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -30; comp.knee.value = 20; comp.ratio.value = 3.4;
    comp.attack.value = 0.004; comp.release.value = 0.25;
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

function splash(a, { dur = 0.22, vol = 0.16, freq = 900, delay = 0 } = {}) {
  const t0 = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.max(1, a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

let ambNodes = null;

function startAmbience(a, levelIndex = 0) {
  stopAmbience();
  const base = 88 + levelIndex * 9;
  const o1 = a.createOscillator(); o1.type = 'sine'; o1.frequency.value = base;
  const o2 = a.createOscillator(); o2.type = 'sine'; o2.frequency.value = base * 1.5;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 480;
  const lfo = a.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.12;
  const lfoGain = a.createGain(); lfoGain.gain.value = 60;
  const g = a.createGain(); g.gain.value = 0;
  lfo.connect(lfoGain).connect(f.frequency);
  o1.connect(f); o2.connect(f); f.connect(g).connect(master);
  g.gain.linearRampToValueAtTime(0.04, a.currentTime + 1.1);
  o1.start(); o2.start(); lfo.start();
  ambNodes = { o1, o2, lfo, g };
}

function stopAmbience() {
  if (!ambNodes) return;
  const { o1, o2, lfo, g } = ambNodes;
  const a = g.context, t0 = a.currentTime;
  g.gain.cancelScheduledValues(t0);
  g.gain.setValueAtTime(g.gain.value, t0);
  g.gain.linearRampToValueAtTime(0, t0 + 0.35);
  setTimeout(() => { try { o1.stop(); o2.stop(); lfo.stop(); } catch (e) {} }, 450);
  ambNodes = null;
}

const TRICK_TONE = {
  flip: { freq: 680, slideTo: 980, type: 'triangle' },
  twist: { freq: 560, slideTo: 880, type: 'sine' },
  doubleFlip: { freq: 760, slideTo: 1200, type: 'triangle' },
};

export function createAudio() {
  const ready = () => typeof Sihim !== 'undefined' && Sihim.soundOn() && chain();

  function jump() {
    const a = ready(); if (!a) return;
    tone(a, { freq: 420, dur: 0.1, type: 'sine', vol: 0.11, slideTo: 640 });
    splash(a, { dur: 0.12, vol: 0.08, freq: 1400 });
  }

  function land(success) {
    const a = ready(); if (!a) return;
    if (success) {
      tone(a, { freq: 660, dur: 0.1, type: 'triangle', vol: 0.13, slideTo: 880 });
      splash(a, { dur: 0.1, vol: 0.07, freq: 1100, delay: 0.015 });
    } else {
      tone(a, { freq: 220, dur: 0.18, type: 'sawtooth', vol: 0.14, slideTo: 90 });
    }
  }

  function hit() {
    const a = ready(); if (!a) return;
    splash(a, { dur: 0.2, vol: 0.17, freq: 420 });
    tone(a, { freq: 150, dur: 0.16, type: 'sawtooth', vol: 0.1, slideTo: 60 });
  }

  function trick(kind = 'flip') {
    const a = ready(); if (!a) return;
    const t = TRICK_TONE[kind] || TRICK_TONE.flip;
    tone(a, { ...t, dur: 0.07, vol: 0.09 });
    if (kind === 'doubleFlip') tone(a, { ...t, freq: t.freq * 1.4, slideTo: t.slideTo * 1.4, dur: 0.09, vol: 0.07, delay: 0.05 });
  }

  function coin() {
    const a = ready(); if (!a) return;
    tone(a, { freq: 1040, dur: 0.08, type: 'sine', vol: 0.12, slideTo: 1500 });
    tone(a, { freq: 1500, dur: 0.1, type: 'sine', vol: 0.07, delay: 0.06, slideTo: 1900 });
  }

  function timing(tier) {
    const a = ready(); if (!a) return;
    if (tier === 'perfect') [880, 1100, 1320].forEach((f, i) => tone(a, { freq: f, dur: 0.08, type: 'triangle', vol: 0.09, delay: i * 0.045 }));
    else if (tier === 'good') tone(a, { freq: 760, dur: 0.1, type: 'triangle', vol: 0.09, slideTo: 980 });
  }

  function levelUp() {
    const a = ready(); if (!a) return;
    tone(a, { freq: 500, dur: 0.12, type: 'sine', vol: 0.13, slideTo: 760 });
    tone(a, { freq: 760, dur: 0.18, type: 'sine', vol: 0.13, slideTo: 1140, delay: 0.1 });
  }

  function gameOver() {
    const a = ready(); if (!a) return;
    [460, 360, 260].forEach((f, i) => tone(a, { freq: f, dur: 0.16, type: 'triangle', vol: 0.1, delay: i * 0.09, slideTo: f * 0.75 }));
  }

  function win() {
    const a = ready(); if (!a) return;
    [660, 880, 1100, 1320].forEach((f, i) => tone(a, { freq: f, dur: 0.22, type: 'triangle', vol: 0.15, delay: i * 0.09 }));
  }

  function ambient(on, levelIndex = 0) {
    const a = ready();
    if (on && a) startAmbience(a, levelIndex);
    else stopAmbience();
  }

  function reset() { stopAmbience(); }

  return { jump, land, hit, trick, coin, timing, levelUp, gameOver, win, ambient, reset };
}
