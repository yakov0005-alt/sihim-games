// Self-contained WebAudio synth for "gate": every sound funnels through one
// master gain + a gentle DynamicsCompressor before the shared AudioContext's
// destination (reused via Sihim.audio() so we don't spawn a second context),
// so the mix stays controlled regardless of how many layers fire at once.
// Respects the shared sound toggle (Sihim.soundOn()) and ?mute=1 (game.js
// forces localStorage sound off in that case, which soundOn() reads).
let ctx = null, master = null;

function chain() {
  const a = window.Sihim && Sihim.audio();
  if (!a) return null;
  if (ctx !== a) {
    ctx = a;
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24; comp.knee.value = 24; comp.ratio.value = 3.2;
    comp.attack.value = 0.003; comp.release.value = 0.22;
    master.connect(comp).connect(ctx.destination);
  }
  return ctx;
}

function tone(a, { freq = 440, dur = 0.12, type = 'sine', vol = 0.15, slideTo, delay = 0, pan = 0 } = {}) {
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, freq), t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + Math.min(0.015, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let out = o;
  if (pan && a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = pan; o.connect(p); out = p; }
  out.connect(g).connect(master);
  o.start(t0); o.stop(t0 + dur + 0.03);
}

function thud(a, { dur = 0.18, vol = 0.14, freq = 500, delay = 0 } = {}) {
  const t0 = a.currentTime + delay;
  const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.7;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

let feverOsc = null, feverLFO = null, feverGain = null;

function startFeverHum(a) {
  stopFeverHum();
  const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 112;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 850; f.Q.value = 5;
  const g = a.createGain(); g.gain.value = 0;
  const lfo = a.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5.5;
  const lfoGain = a.createGain(); lfoGain.gain.value = 0.018;
  lfo.connect(lfoGain).connect(g.gain);
  o.connect(f).connect(g).connect(master);
  g.gain.setValueAtTime(0, a.currentTime);
  g.gain.linearRampToValueAtTime(0.03, a.currentTime + 0.35);
  o.start(); lfo.start();
  feverOsc = o; feverLFO = lfo; feverGain = g;
}

function stopFeverHum() {
  if (!feverGain) return;
  const a = feverGain.context, t0 = a.currentTime;
  feverGain.gain.cancelScheduledValues(t0);
  feverGain.gain.setValueAtTime(feverGain.gain.value, t0);
  feverGain.gain.linearRampToValueAtTime(0, t0 + 0.3);
  const osc = feverOsc, lfo = feverLFO;
  setTimeout(() => { try { osc.stop(); lfo.stop(); } catch (e) {} }, 400);
  feverOsc = feverLFO = feverGain = null;
}

export function createAudio({ muted = false } = {}) {
  let enabled = !muted;
  const ready = () => enabled && typeof window !== 'undefined' && window.Sihim && Sihim.soundOn() && chain();

  function hit(points = 0, combo = 0) {
    const a = ready(); if (!a) return;
    const f = 420 + Math.min(combo, 20) * 13 + Math.min(points, 160) * 0.55;
    tone(a, { freq: f, dur: 0.09, type: 'square', vol: 0.12, slideTo: f * 1.7 });
    tone(a, { freq: f * 2, dur: 0.06, type: 'sine', vol: 0.05, delay: 0.01, slideTo: f * 2.4 });
    if (combo > 0 && combo % 4 === 0) tone(a, { freq: f * 2.3, dur: 0.1, type: 'triangle', vol: 0.06, delay: 0.03, slideTo: f * 3 });
  }

  function wrong() {
    const a = ready(); if (!a) return;
    tone(a, { freq: 170, dur: 0.15, type: 'sawtooth', vol: 0.13, slideTo: 75 });
    thud(a, { dur: 0.1, vol: 0.07, freq: 550 });
  }

  function empty() {
    const a = ready(); if (!a) return;
    tone(a, { freq: 300, dur: 0.05, type: 'sine', vol: 0.05 });
  }

  function escaped() {
    const a = ready(); if (!a) return;
    tone(a, { freq: 300, dur: 0.22, type: 'triangle', vol: 0.12, slideTo: 85 });
    thud(a, { dur: 0.16, vol: 0.09, freq: 350 });
  }

  function fever(on) {
    const a = ready();
    if (on) {
      if (!a) return;
      [0, 0.07, 0.14].forEach((d, i) => { const f = 520 + i * 180; tone(a, { freq: f, dur: 0.16, type: 'triangle', vol: 0.12, slideTo: f * 1.5, delay: d }); });
      startFeverHum(a);
    } else {
      stopFeverHum();
      if (!a) return;
      tone(a, { freq: 420, dur: 0.3, type: 'triangle', vol: 0.11, slideTo: 150 });
    }
  }

  function start() {
    const a = ready(); if (!a) return;
    tone(a, { freq: 300, dur: 0.1, type: 'sine', vol: 0.08, slideTo: 520 });
    tone(a, { freq: 520, dur: 0.12, type: 'sine', vol: 0.09, slideTo: 760, delay: 0.09 });
  }

  function gameOver() {
    stopFeverHum();
    const a = ready(); if (!a) return;
    [520, 420, 320, 220].forEach((f, i) => tone(a, { freq: f, dur: 0.18, type: 'triangle', vol: 0.1, delay: i * 0.1, slideTo: f * 0.8 }));
  }

  function reset() { stopFeverHum(); }
  function setEnabled(on) { enabled = on; if (!on) stopFeverHum(); }

  return { hit, wrong, empty, escaped, fever, start, gameOver, reset, setEnabled };
}
