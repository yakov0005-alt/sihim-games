// Falafel audio: synth tones + ambience, routed through one master gain + compressor.
let masterGain = null;
let chainCtx = null;
let ambience = null;

function master() {
  const actx = Sihim.audio();
  if (!actx) return null;
  if (!masterGain || chainCtx !== actx) {
    const comp = actx.createDynamicsCompressor();
    comp.threshold.value = -26; comp.knee.value = 14; comp.ratio.value = 6;
    comp.attack.value = 0.004; comp.release.value = 0.2;
    masterGain = actx.createGain();
    masterGain.gain.value = 0.32;
    masterGain.connect(comp).connect(actx.destination);
    chainCtx = actx;
    ambience = null;
  }
  return masterGain;
}

export function tone(f = 440, d = 0.12, type = 'square', v = 0.15, slide) {
  if (!Sihim.soundOn()) return;
  const actx = Sihim.audio();
  const out = master();
  if (!actx || !out) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, actx.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, actx.currentTime + d);
  g.gain.setValueAtTime(v, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + d);
  o.connect(g).connect(out);
  o.start(); o.stop(actx.currentTime + d + 0.02);
}

export function noise(d = 0.2, v = 0.15, filterType, filterFreq) {
  if (!Sihim.soundOn()) return;
  const actx = Sihim.audio();
  const out = master();
  if (!actx || !out) return;
  const buf = actx.createBuffer(1, actx.sampleRate * d, actx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
  const s = actx.createBufferSource(), g = actx.createGain();
  g.gain.value = v; s.buffer = buf;
  let node = s;
  if (filterType) {
    const f = actx.createBiquadFilter();
    f.type = filterType; f.frequency.value = filterFreq || 1200;
    node.connect(f); node = f;
  }
  node.connect(g).connect(out); s.start();
}

// Short sizzle for frying station activation / ongoing cook.
export function sizzle(d = 0.35, v = 0.1) { noise(d, v, 'highpass', 1800); }

// Soft wet dab for tahini actions.
export function dab(d = 0.22, v = 0.1) { noise(d, v, 'lowpass', 700); }

// Three-note ascending arpeggio for coin/tip rewards, speed scales with streak.
export function chime(baseFreq = 560, streak = 0) {
  if (!Sihim.soundOn()) return;
  const notes = [1, 1.25, 1.5];
  const gap = Math.max(0.045, 0.075 - streak * 0.004);
  notes.forEach((m, i) => setTimeout(() => tone(baseFreq * m, 0.14, 'triangle', 0.14), i * gap * 1000));
}

// Rising stinger when a combo streak grows, pitch climbs with the streak count.
export function comboStinger(streak) {
  if (!Sihim.soundOn()) return;
  const f = 500 + Math.min(streak, 10) * 55;
  tone(f, 0.1, 'square', 0.1, f * 1.5);
}

// Descending buzz for a missed / failed customer.
export function sadBuzz() { tone(260, 0.22, 'sawtooth', 0.12, 130); }

// Soft two-tone bell for a new day banner.
export function dayBell() {
  tone(700, 0.18, 'sine', 0.1);
  setTimeout(() => tone(920, 0.22, 'sine', 0.11), 110);
}

// Gentle ever-present market pad: two slow-detuned sines through a wandering filter.
export function startAmbience() {
  const actx = Sihim.audio();
  const out = master();
  if (!actx || !out || ambience) return;
  const g = actx.createGain(); g.gain.value = 0;
  const filt = actx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 900;
  const lfo = actx.createOscillator(); lfo.frequency.value = 0.08;
  const lfoGain = actx.createGain(); lfoGain.gain.value = 260;
  lfo.connect(lfoGain).connect(filt.frequency);
  const oscA = actx.createOscillator(); oscA.type = 'sine'; oscA.frequency.value = 110;
  const oscB = actx.createOscillator(); oscB.type = 'sine'; oscB.frequency.value = 110 * 1.5 + 0.6;
  oscA.connect(filt); oscB.connect(filt); filt.connect(g).connect(out);
  oscA.start(); oscB.start(); lfo.start();
  ambience = { g, oscA, oscB, lfo, filt, enabled: false };
}

export function stopAmbience() {
  if (!ambience) return;
  const actx = Sihim.audio();
  try {
    ambience.g.gain.linearRampToValueAtTime(0, (actx ? actx.currentTime : 0) + 0.3);
    setTimeout(() => { try { ambience.oscA.stop(); ambience.oscB.stop(); ambience.lfo.stop(); } catch (e) {} }, 400);
  } catch (e) {}
  ambience = null;
}

// Call every frame while playing: syncs ambience volume with the live sound toggle / ?mute state.
export function syncAmbience(on) {
  if (!ambience) { if (on) startAmbience(); return; }
  const actx = Sihim.audio();
  if (!actx) return;
  const want = on && Sihim.soundOn() ? 0.03 : 0;
  if (Math.abs(ambience.g.gain.value - want) > 0.001) {
    ambience.g.gain.linearRampToValueAtTime(want, actx.currentTime + 0.4);
  }
}
