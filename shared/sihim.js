// SIHIM shared game kit. Usage: const kit = Sihim.init({id, title, sub, howto:[...], onStart(), onPause?})
(function(){
const S = {};
let actx=null, soundOn = localStorage.getItem('sihim:sound') !== '0';
S.audio = () => { if(!actx){ try{ actx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(actx && actx.state==='suspended') actx.resume(); return actx; };
S.soundOn = () => soundOn;
// simple synth beep: S.tone(freq, dur, type, vol, slideTo)
S.tone = (f=440,d=.12,type='square',v=.15,slide) => { if(!soundOn) return; const a=S.audio(); if(!a) return; const o=a.createOscillator(), g=a.createGain(); o.type=type; o.frequency.setValueAtTime(f,a.currentTime); if(slide) o.frequency.exponentialRampToValueAtTime(slide,a.currentTime+d); g.gain.setValueAtTime(v,a.currentTime); g.gain.exponentialRampToValueAtTime(.001,a.currentTime+d); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime+d+.02); };
S.noise = (d=.2,v=.2) => { if(!soundOn) return; const a=S.audio(); if(!a) return; const b=a.createBuffer(1,a.sampleRate*d,a.sampleRate), ch=b.getChannelData(0); for(let i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1)*(1-i/ch.length); const s=a.createBufferSource(), g=a.createGain(); g.gain.value=v; s.buffer=b; s.connect(g).connect(a.destination); s.start(); };
S.best = (id) => +localStorage.getItem('sihim:best:'+id) || 0;
S.saveBest = (id, score, lowerIsBetter=false) => { const b=S.best(id); const better = !b || (lowerIsBetter ? score<b : score>b); if(better) localStorage.setItem('sihim:best:'+id, score); return better; };
S.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const el=(h)=>{const t=document.createElement('template'); t.innerHTML=h.trim(); return t.content.firstChild;};
S.init = (o) => {
  document.documentElement.lang='he'; document.documentElement.dir='rtl';
  const hud = el(`<div class="sh-hud"><a class="sh-btn" href="../../index.html" title="חזרה לאתר">🏠</a><span class="sh-pill" id="sh-score">ניקוד: 0</span><span class="sh-pill" id="sh-best">שיא: ${S.best(o.id)}</span><span class="sp"></span><button class="sh-btn" id="sh-sound" aria-label="צליל">${soundOn?'🔊':'🔇'}</button><button class="sh-btn" id="sh-pause" aria-label="השהיה">⏸</button></div>`);
  const ov = el(`<div class="sh-overlay"><div class="sh-panel"><h1>${o.title}</h1><p class="sub">${o.sub||''}</p><ul>${(o.howto||[]).map(x=>`<li>${x}</li>`).join('')}</ul><div id="sh-msg"></div><button class="sh-play" id="sh-go">▶ שחקו</button><div class="row"><a class="sh-btn" href="../../index.html">כל המשחקים</a></div></div></div>`);
  document.body.append(hud, ov);
  const kit = { paused:false, running:false };
  hud.querySelector('#sh-sound').onclick = (e) => { soundOn=!soundOn; localStorage.setItem('sihim:sound', soundOn?'1':'0'); e.currentTarget.textContent = soundOn?'🔊':'🔇'; o.onSound && o.onSound(soundOn); };
  hud.querySelector('#sh-pause').onclick = () => { if(!kit.running) return; kit.pause(); };
  ov.querySelector('#sh-go').onclick = () => { S.audio(); ov.classList.add('hidden'); if(kit.paused){ kit.paused=false; o.onResume && o.onResume(); } else { kit.running=true; o.onStart && o.onStart(); } };
  kit.score = (v, label='ניקוד') => { hud.querySelector('#sh-score').textContent = `${label}: ${v}`; };
  kit.pause = () => { kit.paused=true; ov.querySelector('#sh-msg').innerHTML='<p class="big">⏸</p>'; ov.querySelector('#sh-go').textContent='▶ המשך'; ov.classList.remove('hidden'); o.onPause && o.onPause(); };
  kit.gameOver = (score, {lowerIsBetter=false, text='', unit=''}={}) => { kit.running=false; kit.paused=false; const nb=S.saveBest(o.id, score, lowerIsBetter); hud.querySelector('#sh-best').textContent='שיא: '+S.best(o.id); ov.querySelector('#sh-msg').innerHTML=`<p>${text}</p><p class="big">${score}${unit}</p><p>${nb?'🏆 שיא חדש!':'השיא שלך: '+S.best(o.id)+unit}</p>`; ov.querySelector('#sh-go').textContent='↻ שוב'; ov.classList.remove('hidden'); S.tone(nb?880:220,.4,'triangle',.2,nb?1320:110); };
  kit.isOpen = () => !ov.classList.contains('hidden');
  window.addEventListener('keydown', e => { if(e.key==='Escape' && kit.running && !kit.paused) kit.pause(); else if((e.key==='Enter') && kit.isOpen()) ov.querySelector('#sh-go').click(); });
  document.addEventListener('visibilitychange', () => { if(document.hidden && kit.running && !kit.paused) kit.pause(); });
  window.__sihim = kit; // for automated tests
  return kit;
};
window.Sihim = S;
})();
