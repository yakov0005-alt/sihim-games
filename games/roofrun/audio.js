// WebAudio synth sfx for roofrun. Builds its own master gain + gentle
// DynamicsCompressor on top of the shared Sihim audio context (sihim.js's
// own Sihim.tone/noise connect straight to destination, so games that want
// the BATCH1 loudness target route their own sounds through this chain
// instead). Every sound checks the sound toggle + ?mute=1 before touching
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
      comp.threshold.value = -26; comp.knee.value = 20; comp.ratio.value = 3.4;
      comp.attack.value = 0.005; comp.release.value = 0.22;
      const gain = actx.createGain(); gain.gain.value = 0.34;
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

  function noise(d = 0.2, v = 0.15) {
    if (!ready()) return;
    const actx = Sihim.audio(); const m = master();
    if (!actx || !m) return;
    const b = actx.createBuffer(1, Math.max(1, Math.round(actx.sampleRate * d)), actx.sampleRate);
    const ch = b.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const s = actx.createBufferSource(), g = actx.createGain();
    g.gain.value = v; s.buffer = b; s.connect(g).connect(m); s.start();
  }

  function at(delayMs, fn) { if (delayMs <= 0) fn(); else setTimeout(() => ready() && fn(), delayMs); }

  function jump() { tone(520, 0.09, 'square', 0.12, 780); }

  function slide() { tone(230, 0.12, 'sine', 0.1, 150); noise(0.08, 0.05); }

  // Obstacle dodged without a hit; timbre brightens with how clean the dodge was.
  function clear(points = 0, timing = 'good') {
    if (timing === 'perfect') {
      tone(720, 0.1, 'triangle', 0.13, 1040);
      at(40, () => tone(1080, 0.08, 'triangle', 0.08, 1300));
    } else if (timing === 'ok') {
      tone(420, 0.09, 'sine', 0.08, 460);
    } else {
      const f = 600 + Math.min(points, 160);
      tone(f, 0.09, 'triangle', 0.12, f * 1.4);
    }
  }

  // Envelope pickup: brighter "coin" ping that climbs in pitch with the combo.
  function collect(points = 0, combo = 0) {
    const f = 760 + Math.min(combo, 10) * 26;
    tone(f, 0.1, 'sine', 0.12, f * 1.6);
    at(55, () => tone(f * 1.5, 0.08, 'triangle', 0.07, f * 1.8));
  }

  function comboMilestone() {
    [0, 70, 140].forEach((d, i) => at(d, () => {
      const f = 620 + i * 160;
      tone(f, 0.1, 'triangle', 0.1, f * 1.5);
    }));
  }

  function miss() { noise(0.16, 0.16); tone(140, 0.22, 'sawtooth', 0.12, 70); }

  function levelUp() {
    [0, 90, 180].forEach((d, i) => at(d, () => {
      const f = 460 + i * 120;
      tone(f, 0.12, 'sine', 0.12, f * 1.4);
    }));
  }

  function win() {
    [0, 110, 220, 340].forEach((d, i) => at(d, () => {
      const f = 520 + i * 110;
      tone(f, 0.3, 'triangle', 0.15, f * 1.6);
    }));
  }

  function stopAmbient(fade = 0.5) {
    if (!ambientNodes) return;
    const actx = Sihim.audio();
    const { gain, oscs, watch } = ambientNodes;
    clearInterval(watch);
    if (actx) gain.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + fade);
    setTimeout(() => { for (const { o, lfo } of oscs) { try { o.stop(); lfo.stop(); } catch (e) {} } }, (fade + 0.1) * 1000);
    ambientNodes = null;
  }

  // Soft two-note detuned pad, mostly for the title/run atmosphere — quiet
  // enough to stay well under the sfx in the loudness budget; optional.
  function ambient(on) {
    if (!on) { stopAmbient(); return; }
    if (!ready() || ambientNodes) return;
    const actx = Sihim.audio(); const m = master();
    if (!actx || !m) return;
    const filter = actx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900;
    const gain = actx.createGain(); gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.045, actx.currentTime + 2.2);
    filter.connect(gain).connect(m);
    const oscs = [58, 87.3].map((f, i) => {
      const o = actx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const lfo = actx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.07 + i * 0.03;
      const lfoGain = actx.createGain(); lfoGain.gain.value = 16;
      lfo.connect(lfoGain).connect(o.detune);
      o.connect(filter); o.start(); lfo.start();
      return { o, lfo };
    });
    const watch = setInterval(() => { if (!ready()) stopAmbient(0.4); }, 1200);
    ambientNodes = { gain, oscs, watch };
  }

  return { jump, slide, clear, collect, comboMilestone, miss, levelUp, win, ambient };
}
