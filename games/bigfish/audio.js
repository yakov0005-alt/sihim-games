// WebAudio synth sfx for "bigfish". Builds its own master gain + a gentle
// DynamicsCompressor on top of the shared Sihim audio context (sihim.js's
// own Sihim.tone/noise connect straight to destination, so games that need
// the BATCH1 loudness target route their own sounds through this chain
// instead). Every call checks the sound toggle + ?mute=1 before touching
// the context, so play.js can call these unconditionally.
export function createAudio({ muted = false } = {}) {
  let chain = null;
  let ambientNodes = null;

  const ready = () => !muted && typeof window !== 'undefined' && window.Sihim && Sihim.soundOn();

  function master() {
    const actx = Sihim.audio();
    if (!actx) return null;
    if (!chain || chain.ctx !== actx) {
      const comp = actx.createDynamicsCompressor();
      comp.threshold.value = -27; comp.knee.value = 16; comp.ratio.value = 4;
      comp.attack.value = 0.004; comp.release.value = 0.25;
      const gain = actx.createGain(); gain.gain.value = 0.85;
      gain.connect(comp).connect(actx.destination);
      chain = { ctx: actx, gain };
    }
    return chain.gain;
  }

  function tone(f = 440, d = 0.12, type = 'sine', v = 0.14, slide, delay = 0) {
    if (!ready()) return;
    const actx = Sihim.audio(); const m = master();
    if (!actx || !m) return;
    const t0 = actx.currentTime + delay;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(20, f), t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + d);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, v), t0 + Math.min(0.015, d * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g).connect(m); o.start(t0); o.stop(t0 + d + 0.03);
  }

  function noise(d = 0.2, v = 0.15, filterType, filterFreq = 900, filterQ, delay = 0) {
    if (!ready()) return;
    const actx = Sihim.audio(); const m = master();
    if (!actx || !m) return;
    const t0 = actx.currentTime + delay;
    const b = actx.createBuffer(1, Math.max(1, Math.round(actx.sampleRate * d)), actx.sampleRate);
    const ch = b.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const s = actx.createBufferSource(), g = actx.createGain();
    g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
    s.buffer = b;
    let node = s;
    if (filterType) {
      const f = actx.createBiquadFilter();
      f.type = filterType; f.frequency.value = filterFreq;
      if (filterQ) f.Q.value = filterQ;
      node.connect(f); node = f;
    }
    node.connect(g).connect(m); s.start(t0);
  }

  function at(delayMs, fn) { if (delayMs <= 0) fn(); else setTimeout(() => ready() && fn(), delayMs); }

  // Successful counter-pull: brighter the quicker/cleaner the reaction. A
  // correctly-read feint earns an extra high shimmer — the "aha, caught you"
  // payoff for the mechanic that's hardest to read.
  function hit(quality = 1, isFeint = false) {
    const f = 380 + quality * 260;
    tone(f, 0.1, 'triangle', 0.15, f * 1.5);
    noise(0.07, 0.08, 'highpass', 1200);
    if (isFeint) at(45, () => tone(f * 1.9, 0.12, 'sine', 0.1, f * 2.3));
  }

  // 'wrong' (swiped into the pull) is a harsh full-penalty buzz; 'late'
  // (right direction, too slow) a softer stumble; 'timeout' a dull, quiet
  // glug for simply freezing.
  function miss(outcome = 'timeout') {
    if (outcome === 'wrong') {
      tone(170, 0.2, 'sawtooth', 0.15, 65);
      noise(0.16, 0.14, 'lowpass', 480);
    } else if (outcome === 'late') {
      tone(230, 0.15, 'sawtooth', 0.11, 95);
      noise(0.11, 0.09, 'lowpass', 700);
    } else {
      tone(150, 0.14, 'sine', 0.09, 95);
      at(70, () => tone(110, 0.16, 'sine', 0.07, 70));
    }
  }

  // Ascending triad on crossing a combo tier (5/10/15/20); pitch nudges up
  // with the tier so later milestones feel a touch brighter.
  function comboMilestone(combo = 0) {
    [0, 80, 160].forEach((d, i) => at(d, () => {
      const f = 560 + i * 150 + Math.min(combo, 20) * 5;
      tone(f, 0.12, 'triangle', 0.12, f * 1.4);
    }));
  }

  // A fisherman mid-run splashing into the lake (not the final win) — a
  // comedic plonk, pitch rising slightly with the fisherman's level.
  function splash(levelIndex = 0) {
    const f = 300 + levelIndex * 18;
    noise(0.24, 0.17, 'lowpass', 650 + levelIndex * 20);
    tone(f, 0.14, 'sine', 0.13, f * 0.55);
    at(70, () => tone(f * 1.4, 0.16, 'triangle', 0.12, f * 0.9));
  }

  function win() {
    [520, 660, 780, 1040].forEach((f, i) => at(i * 100, () => tone(f, 0.22, 'triangle', 0.15, f * 1.25)));
    at(380, () => noise(0.3, 0.14, 'lowpass', 900));
  }

  function lose() {
    tone(220, 0.3, 'sawtooth', 0.13, 75);
    noise(0.26, 0.15, 'lowpass', 420);
    at(90, () => tone(140, 0.3, 'sine', 0.1, 55));
  }

  function stopAmbient(fade = 0.5) {
    if (!ambientNodes) return;
    const actx = Sihim.audio();
    const { gain, nodes, watch } = ambientNodes;
    clearInterval(watch);
    if (actx) { gain.gain.cancelScheduledValues(actx.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + fade); }
    setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch (e) {} } }, (fade + 0.1) * 1000);
    ambientNodes = null;
  }

  // Optional lake atmosphere: filtered noise wash (ripple) with a slow
  // swelling LFO, plus a low pad whose pitch creeps up with the level — a
  // quiet sense of mounting tension across the six fishermen. Stays well
  // under the sfx; purely decorative, safe to skip if sound is off.
  function ambient(on, levelIndex = 0) {
    if (!on) { stopAmbient(); return; }
    if (!ready()) return;
    const actx = Sihim.audio(); const m = master();
    if (!actx || !m) return;
    const base = 70 + levelIndex * 7;
    if (ambientNodes) {
      ambientNodes.pad.frequency.linearRampToValueAtTime(base, actx.currentTime + 0.6);
      return;
    }
    const dur = 2;
    const buf = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filter = actx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 420; filter.Q.value = 0.6;
    const swell = actx.createOscillator(); swell.frequency.value = 0.1;
    const swellGain = actx.createGain(); swellGain.gain.value = 180;
    swell.connect(swellGain).connect(filter.frequency);
    const gain = actx.createGain(); gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.035, actx.currentTime + 2);
    src.connect(filter).connect(gain).connect(m);
    const pad = actx.createOscillator(); pad.type = 'sine'; pad.frequency.value = base;
    const padGain = actx.createGain(); padGain.gain.value = 0.018;
    pad.connect(padGain).connect(m);
    src.start(); swell.start(); pad.start();
    const watch = setInterval(() => { if (!ready()) stopAmbient(0.4); }, 1200);
    ambientNodes = { gain, nodes: [src, swell, pad], watch, pad };
  }

  function setEnabled(on) { if (!on) stopAmbient(0.3); }

  return { hit, miss, comboMilestone, splash, win, lose, ambient, setEnabled };
}
