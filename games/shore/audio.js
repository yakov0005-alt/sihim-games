// WebAudio synth sfx for "shore". Builds its own master gain + a gentle
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
      comp.threshold.value = -26; comp.knee.value = 18; comp.ratio.value = 4;
      comp.attack.value = 0.004; comp.release.value = 0.22;
      const gain = actx.createGain(); gain.gain.value = 0.92;
      gain.connect(comp).connect(actx.destination);
      chain = { ctx: actx, gain };
    }
    return chain.gain;
  }

  function tone(f = 440, d = 0.12, type = 'square', v = 0.15, slide) {
    if (!ready()) return;
    const actx = Sihim.audio(); const m = master();
    if (!actx || !m) return;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, actx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, actx.currentTime + d);
    g.gain.setValueAtTime(v, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + d);
    o.connect(g).connect(m); o.start(); o.stop(actx.currentTime + d + 0.02);
  }

  function noise(d = 0.2, v = 0.15, filterType, filterFreq, filterQ) {
    if (!ready()) return;
    const actx = Sihim.audio(); const m = master();
    if (!actx || !m) return;
    const b = actx.createBuffer(1, Math.max(1, Math.round(actx.sampleRate * d)), actx.sampleRate);
    const ch = b.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const s = actx.createBufferSource(), g = actx.createGain();
    g.gain.value = v; s.buffer = b;
    let node = s;
    if (filterType) {
      const f = actx.createBiquadFilter();
      f.type = filterType; f.frequency.value = filterFreq || 1000;
      if (filterQ) f.Q.value = filterQ;
      node.connect(f); node = f;
    }
    node.connect(g).connect(m); s.start();
  }

  function at(delayMs, fn) { if (delayMs <= 0) fn(); else setTimeout(() => ready() && fn(), delayMs); }

  // Peck: bright ping for a shell, a woodier double-knock for a crab; pitch
  // climbs a little with the running combo so a hot streak sounds brighter.
  function peck(combo = 0, type = 'shell') {
    const bump = Math.min(combo, 12) * 26;
    if (type === 'crab') {
      tone(300 + bump, 0.09, 'square', 0.1, 180 + bump);
      at(30, () => tone(440 + bump, 0.06, 'triangle', 0.055, 520 + bump));
    } else {
      const f = 560 + bump;
      tone(f, 0.08, 'sine', 0.1, f * 1.6);
    }
  }

  // The wave catches the bird: a watery whoosh + thud, harsher on the last life.
  function wave(livesLeft = 2) {
    noise(0.26, 0.12, 'lowpass', 900, 0.8);
    tone(220, 0.3, 'sawtooth', livesLeft <= 0 ? 0.13 : 0.09, 60);
  }

  // First note lands a beat after the peck's own tone so the two attacks
  // don't stack into one hot transient.
  function comboMilestone(n = 0) {
    [50, 130, 210].forEach((d, i) => at(d, () => {
      const f = 620 + i * 140 + Math.min(n, 10) * 6;
      tone(f, 0.11, 'triangle', 0.09, f * 1.5);
    }));
  }

  function levelUp() {
    [0, 90, 180].forEach((d, i) => at(d, () => tone(460 + i * 140, 0.14, 'sine', 0.1, 700 + i * 160)));
  }

  function win() {
    [0, 110, 220, 340].forEach((d, i) => at(d, () => tone(500 + i * 120, 0.3, 'triangle', 0.12, 880 + i * 160)));
  }

  function stopAmbient(fade = 0.5) {
    if (!ambientNodes) return;
    const actx = Sihim.audio();
    const { gain, nodes, watch } = ambientNodes;
    clearInterval(watch);
    if (actx) gain.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + fade);
    setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch (e) {} } }, (fade + 0.1) * 1000);
    ambientNodes = null;
  }

  // Soft surf wash: filtered looping noise with a slow swelling LFO, plus a
  // quiet low pad — optional atmosphere that stays well under the sfx.
  function ambient(on) {
    if (!on) { stopAmbient(); return; }
    if (!ready() || ambientNodes) return;
    const actx = Sihim.audio(); const m = master();
    if (!actx || !m) return;
    const dur = 2;
    const buf = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filter = actx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 500; filter.Q.value = 0.6;
    const swell = actx.createOscillator(); swell.frequency.value = 0.12;
    const swellGain = actx.createGain(); swellGain.gain.value = 260;
    swell.connect(swellGain).connect(filter.frequency);
    const gain = actx.createGain(); gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.05, actx.currentTime + 2.4);
    src.connect(filter).connect(gain).connect(m);
    const pad = actx.createOscillator(); pad.type = 'sine'; pad.frequency.value = 98;
    const padGain = actx.createGain(); padGain.gain.value = 0.02;
    pad.connect(padGain).connect(m);
    src.start(); swell.start(); pad.start();
    const watch = setInterval(() => { if (!ready()) stopAmbient(0.4); }, 1200);
    ambientNodes = { gain, nodes: [src, swell, pad], watch };
  }

  return { peck, wave, comboMilestone, levelUp, win, ambient };
}
