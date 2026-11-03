(()=>{'use strict';
const c=document.querySelector('#game'), g=c.getContext('2d');
const label=document.querySelector('#mission');
const gasBtn=document.querySelector('#gasBtn'), brakeBtn=document.querySelector('#brakeBtn');
let w,h,dpr;
function resize(){
  w=innerWidth; h=innerHeight; dpr=Math.min(devicePixelRatio||1,2);
  c.width=w*dpr; c.height=h*dpr; g.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener('resize',resize); resize();

// ---------- world data ----------
const STATIONS=[
  {name:'לוד',        x:900,  bands:[10,25,50,95]},
  {name:'רמלה',       x:1950, bands:[9,22,45,88]},
  {name:'בית שמש',    x:3150, bands:[8,19,40,80]},
  {name:'הרי יהודה',  x:4500, bands:[7,16,34,72]},
  {name:'ירושלים',    x:6000, bands:[6,14,28,64]},
];
const PLAT_HW=100;      // platform half-width (visual + overshoot zone)
const MAX_SPEED=120, ACCEL=65, BRAKE_D=110, FRICTION=28;
const TRACK_Y_RATIO=.66;          // rail line y as fraction of height
const TRAIN_SCREEN_X=()=>w*.32;

let t=0,last=0,shake=0;
let trainX=0,speed=0,wheelAngle=0,camX=0;
let idx=0,score=0,arrived=false,endTimer=0;
let toast=null;           // {text,life,total,color}
let smoke=[],dust=[],confetti=[],sparks=[];
let chuffDist=0, brakeSoundT=0, wasMoving=false;
const keys={}, touch={throttle:false,brake:false};

addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  keys[e.key.toLowerCase()]=true;
});
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
function clearInput(){ for(const k in keys) keys[k]=false; touch.throttle=false; touch.brake=false; }
addEventListener('blur',clearInput);

function bindBtn(btn,flag){
  btn.addEventListener('pointerdown',e=>{ e.preventDefault(); btn.setPointerCapture(e.pointerId); touch[flag]=true; });
  const off=()=>touch[flag]=false;
  btn.addEventListener('pointerup',off); btn.addEventListener('pointercancel',off); btn.addEventListener('pointerleave',off);
}
bindBtn(gasBtn,'throttle'); bindBtn(brakeBtn,'brake');

const kit=Sihim.init({
  id:'train',
  title:'הרכבת לירושלים',
  sub:'נהגו בעדינות ועצרו מדויק בתחנה',
  howto:[
    'מאיצים עם ⬆ / W או כפתור ההאצה הירוק.',
    'בולמים עם ⬇ / S / רווח או כפתור הבלם האדום.',
    'יישרו את החץ שמתחת לקטר עם הדגל הלבן בתחנה.',
    'במד הדיוק: החץ הוא הקטר, והעיגול הוא מקום העצירה הצפוי.',
    'ככל שהעצירה מדויקת יותר — כך הניקוד גבוה יותר!',
  ],
  onPause:clearInput,
  onResume:clearInput,
  onStart(){
    clearInput(); wasMoving=false;
    t=0; trainX=0; speed=0; wheelAngle=0; idx=0; score=0; arrived=false; endTimer=0;
    toast=null; smoke=[]; dust=[]; confetti=[]; sparks=[]; chuffDist=0; brakeSoundT=0; shake=0;
    camX=-TRAIN_SCREEN_X(); kit.score(0);
    label.textContent='הרכבת יוצאת לדרך • האיצו!';
    Sihim.tone(520,.18,'triangle',.18,780);
  },
});

function hash(i){ const x=Math.sin(i*12.9898+7.233)*43758.5453; return x-Math.floor(x); }
function clamp(v,a,b){ return v<a?a:v>b?b:v; }

// ---------- particles ----------
function spawnSmoke(x,y){ smoke.push({x,y,vx:-40+Math.random()*10,vy:-50-Math.random()*20,r:5+Math.random()*4,life:1,total:1}); }
function spawnDust(x,y){ dust.push({x,y,vx:(Math.random()-.5)*60,vy:-20-Math.random()*20,r:3+Math.random()*3,life:.5,total:.5}); }
function spawnSparks(x,y,color,n){ for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, v=40+Math.random()*90; sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-40,life:.7,total:.7,color}); } }
function spawnConfetti(x,y){
  const colors=['#ffd34d','#ff6b2c','#22d3c5','#8CF28C','#ff8fd0'];
  for(let i=0;i<28;i++){
    const a=-Math.PI/2+(Math.random()-.5)*1.6, v=90+Math.random()*140;
    confetti.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1.2,total:1.2,color:colors[i%colors.length],spin:(Math.random()-.5)*10});
  }
}
function stepParticles(dt){
  for(const p of smoke){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.r+=dt*14; p.life-=dt*.7; }
  for(const p of dust){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt*1.4; }
  for(const p of sparks){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=260*dt; p.life-=dt*1.3; }
  for(const p of confetti){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=180*dt; p.life-=dt*.8; }
  smoke=smoke.filter(p=>p.life>0); dust=dust.filter(p=>p.life>0);
  sparks=sparks.filter(p=>p.life>0); confetti=confetti.filter(p=>p.life>0);
}

// ---------- grading ----------
function rankFor(avg){
  if(avg>=85) return 'נהג מצטיין ⭐⭐⭐';
  if(avg>=60) return 'נהג טוב ⭐⭐';
  return 'נהג מתחיל ⭐';
}
function grade(st, forcedMiss){
  const diff = forcedMiss ? Infinity : Math.abs(trainX-st.x);
  let pts,text,color,big=false;
  if(diff>PLAT_HW+20){ pts=0; text=`${st.name}: פספוס! 😕`; color='#ff6b6b'; }
  else if(diff<=st.bands[0]){ pts=100; text=`${st.name}: עצירה מושלמת! 🌟 +100`; color='#ffd34d'; big=true; }
  else if(diff<=st.bands[1]){ pts=80; text=`${st.name}: מדויק מאוד! +80`; color='#8CF28C'; }
  else if(diff<=st.bands[2]){ pts=55; text=`${st.name}: עצירה טובה +55`; color='#8ec8ff'; }
  else if(diff<=st.bands[3]){ pts=30; text=`${st.name}: לא רע +30`; color='#f0c36b'; }
  else { pts=10; text=`${st.name}: כמעט... +10`; color='#e39a6b'; }
  score+=pts; kit.score(score);
  toast={text,life:2.4,total:2.4,color};
  if(pts>=55){ shake=5; spawnConfetti(TRAIN_SCREEN_X(),h*TRACK_Y_RATIO-45); }
  const sx=st.x-camX, sy=h*TRACK_Y_RATIO-18;
  if(big){ spawnConfetti(sx,sy); Sihim.tone(660,.14,'triangle',.2,990); Sihim.tone(990,.18,'triangle',.18,1320); }
  else if(pts>=55){ spawnSparks(sx,sy,color,16); Sihim.tone(560,.14,'triangle',.16,760); }
  else if(pts>0){ Sihim.tone(400,.14,'sine',.12,340); }
  else { Sihim.tone(160,.3,'sawtooth',.15,90); spawnSparks(sx,sy,color,10); }
  idx++;
  if(idx>=STATIONS.length){ arrived=true; endTimer=2.6; label.textContent='הגעתם לירושלים! 🎉'; }
}

// ---------- update ----------
function update(dt){
  t+=dt;
  const throttle = !arrived && (keys['arrowup']||keys['w']||touch.throttle);
  const brake = keys['arrowdown']||keys['s']||keys[' ']||touch.brake;

  if(!wasMoving && throttle && speed<1) Sihim.tone(300,.22,'sawtooth',.1,520);
  wasMoving = speed>1;

  if(brake){ speed=Math.max(0,speed-BRAKE_D*dt); }
  else if(throttle){ speed=Math.min(MAX_SPEED,speed+ACCEL*dt); }
  else { speed=Math.max(0,speed-FRICTION*dt); }

  trainX += speed*dt;
  camX = trainX - TRAIN_SCREEN_X();
  wheelAngle += speed*dt*.06;

  const nx=TRAIN_SCREEN_X(), ny=h*TRACK_Y_RATIO;
  if(throttle && speed>4){
    chuffDist-=speed*dt; if(chuffDist<=0){ chuffDist=22; spawnSmoke(nx+30,ny-46); Sihim.noise(.05,.05); }
    if(Math.random()<dt*8) spawnSmoke(nx+30,ny-46);
  }

  if(brake && speed>30){
    shake=Math.max(shake,Math.min(9,speed*.035));
    if(Math.random()<dt*20) spawnDust(nx-26,ny+18);
    brakeSoundT-=dt; if(brakeSoundT<=0){ brakeSoundT=.22; Sihim.noise(.09,.07); }
  }
  shake*=.88;

  stepParticles(dt);
  if(toast){ toast.life-=dt; if(toast.life<=0) toast=null; }

  if(arrived){
    endTimer-=dt;
    if(endTimer<=0){
      const avg=score/STATIONS.length;
      kit.gameOver(score,{text:`הגעתם לירושלים בשלום! ${rankFor(avg)}`});
    }
    return;
  }

  const st=STATIONS[idx];
  if(st){
    const diff=trainX-st.x;
    if(speed===0 && diff>=-PLAT_HW-20 && diff<=PLAT_HW+20){ grade(st,false); }
    else if(diff>PLAT_HW+20){ grade(st,true); }
    if(arrived) return;
    const distM=Math.max(0,Math.round((st.x-trainX)/8));
    const kmh=Math.round(speed/8*3.6);
    label.textContent = distM>0
      ? `${st.name} בעוד ${distM} מ' • מהירות ${kmh} קמ"ש`
      : `כאן ${st.name}! בלמו על הסימן • מהירות ${kmh} קמ"ש`;
  }

}

// ---------- scenery helpers ----------
function lerp(a,b,p){ return a+(b-a)*p; }
function lerpColor(c1,c2,p){ return `rgb(${Math.round(lerp(c1[0],c2[0],p))},${Math.round(lerp(c1[1],c2[1],p))},${Math.round(lerp(c1[2],c2[2],p))})`; }

function drawSky(prog){
  const topC=lerpColor([42,66,122],[150,90,120],prog);
  const botC=lerpColor([150,195,230],[255,205,150],prog);
  const grad=g.createLinearGradient(0,0,0,h*.7);
  grad.addColorStop(0,topC); grad.addColorStop(1,botC);
  g.fillStyle=grad; g.fillRect(0,0,w,h);
  g.fillStyle=lerpColor([255,241,214],[255,200,140],prog);
  g.beginPath(); g.arc(w*.78,h*.22,32,0,Math.PI*2); g.fill();
}

function drawHillLayer(baseY,amp,freq,phase,parallax,color){
  g.beginPath(); g.moveTo(0,h);
  for(let x=0;x<=w+24;x+=24){
    const wx=camX*parallax+x;
    const y=baseY-amp*(.5+.5*Math.sin(wx*freq+phase));
    g.lineTo(x,y);
  }
  g.lineTo(w,h); g.closePath();
  g.fillStyle=color; g.fill();
}

function drawOliveTree(x,y,s){
  g.fillStyle='#5b3b24'; g.fillRect(x-s*.08,y-s*.05,s*.16,s*.5);
  g.strokeStyle='#5b3b24'; g.lineWidth=Math.max(1,s*.08);
  g.beginPath(); g.moveTo(x,y+s*.22); g.lineTo(x-s*.3,y-s*.18); g.moveTo(x,y+s*.22); g.lineTo(x+s*.28,y-s*.2); g.stroke();
  g.fillStyle='#71865a';
  g.beginPath();
  g.arc(x-s*.3,y-s*.2,s*.36,0,Math.PI*2);
  g.arc(x+s*.28,y-s*.15,s*.38,0,Math.PI*2);
  g.arc(x,y-s*.48,s*.4,0,Math.PI*2);
  g.fill();
  g.fillStyle='#a5b781'; g.beginPath(); g.ellipse(x-s*.16,y-s*.48,s*.25,s*.12,-.3,0,Math.PI*2); g.fill();
}

function drawTrees(parallax,baseY,amp,freq,phase){
  const spacing=70;
  const start=Math.floor((camX*parallax-80)/spacing)*spacing;
  const end=camX*parallax+w+80;
  for(let wx=start; wx<end; wx+=spacing){
    const hv=hash(Math.round(wx/spacing));
    if(hv<0.35) continue;
    const sx=wx-camX*parallax+(hv-.5)*30;
    const crestY=baseY-amp*(.5+.5*Math.sin(wx*freq+phase));
    drawOliveTree(sx,crestY,10+hv*10);
  }
}

function drawTrack(){
  const topY=h*TRACK_Y_RATIO;
  g.fillStyle='#8b7a63'; g.fillRect(0,topY-6,w,34);
  g.fillStyle='#4a3524';
  const spacing=38, start=Math.floor(camX/spacing)*spacing;
  for(let wx=start; wx<camX+w+spacing; wx+=spacing){
    const sx=wx-camX; g.fillRect(sx-3,topY-4,10,22);
  }
  g.fillStyle='#cfd3da'; g.fillRect(0,topY,w,3); g.fillRect(0,topY+14,w,3);
}

function drawStation(st){
  const sx=st.x-camX;
  if(sx<-260 || sx>w+260) return;
  const topY=h*TRACK_Y_RATIO;
  g.fillStyle='#d8c9a8'; g.fillRect(sx-PLAT_HW-10,topY-16,(PLAT_HW+10)*2,16);
  for(let i=-PLAT_HW-10;i<PLAT_HW+10;i+=16){
    g.fillStyle=(((i+PLAT_HW+10)/16)|0)%2 ? '#b8491f' : '#f2e4c4';
    g.fillRect(sx+i,topY-16,14,5);
  }
  g.strokeStyle='#fff'; g.lineWidth=3;
  g.beginPath(); g.moveTo(sx,topY-16); g.lineTo(sx,topY-70); g.stroke();
  g.beginPath(); g.moveTo(sx,topY-70); g.lineTo(sx+16,topY-64); g.lineTo(sx,topY-58); g.closePath();
  g.fillStyle='#ff4d4d'; g.fill();
  g.fillStyle='#3b2a1d'; g.fillRect(sx+PLAT_HW+18,topY-70,4,54);
  g.fillStyle='#fef6e0'; g.fillRect(sx+PLAT_HW+2,topY-82,70,24);
  g.strokeStyle='#3b2a1d'; g.lineWidth=1; g.strokeRect(sx+PLAT_HW+2,topY-82,70,24);
  g.fillStyle='#2b1d12'; g.font='700 13px Rubik, sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.direction='rtl';
  g.fillText(st.name,sx+PLAT_HW+37,topY-70);
  // Jerusalem-stone station, shaded porch and Hebrew fascia.
  const bx=sx-PLAT_HW-88;
  g.fillStyle='#daca9e'; g.fillRect(bx,topY-104,100,88);
  g.fillStyle='#a99570';
  for(let row=0;row<5;row++) for(let col=0;col<5;col++) g.strokeRect(bx+col*20+(row%2)*8,topY-102+row*16,20,16);
  g.fillStyle='#315363'; g.fillRect(bx+12,topY-58,22,42); g.fillRect(bx+64,topY-58,22,25);
  g.fillStyle='#936849'; g.fillRect(bx-8,topY-110,116,9);
  g.fillStyle='#263f50'; g.fillRect(bx+5,topY-92,90,25);
  g.fillStyle='#fff2cf'; g.font='700 13px Rubik, sans-serif';
  g.fillText('תחנת '+st.name,bx+50,topY-79,86);
  g.fillStyle='#ad7747'; g.fillRect(sx+35,topY-35,42,5);
  g.fillRect(sx+40,topY-30,4,14); g.fillRect(sx+68,topY-30,4,14);

}

function drawWheel(wx,wy,r){
  g.save(); g.translate(wx,wy); g.rotate(wheelAngle);
  g.fillStyle='#232323'; g.beginPath(); g.arc(0,0,r,0,Math.PI*2); g.fill();
  g.strokeStyle='#9a9a9a'; g.lineWidth=2;
  g.beginPath(); g.moveTo(-r,0); g.lineTo(r,0); g.moveTo(0,-r); g.lineTo(0,r); g.stroke();
  g.restore();
}

function drawDriver(x,y){
  const bob=Math.sin(t*9)*1.2*(speed>5?1:.3);
  g.fillStyle='#3b4f73'; g.fillRect(x-7,y+5+bob,14,8);
  g.fillStyle='#e8b48a'; g.beginPath(); g.arc(x,y+bob,6,0,Math.PI*2); g.fill();
  g.fillStyle='#2b3a55'; g.beginPath(); g.arc(x,y-2+bob,6.4,Math.PI,0); g.fill();
  g.fillRect(x-6.4,y-2+bob,12.8,3);
}

function drawCar(cx,cy,color){
  g.fillStyle=color; g.fillRect(cx-34,cy-34,68,34);
  g.fillStyle='#dff3ff'; g.fillRect(cx-26,cy-28,18,14); g.fillRect(cx+4,cy-28,18,14);
  drawWheel(cx-20,cy+2,12); drawWheel(cx+20,cy+2,12);
}

function drawLocomotive(nx,ny){
  g.fillStyle='#2f6fb0';
  g.beginPath(); g.moveTo(nx-38,ny-30); g.lineTo(nx+55,ny-30);
  g.quadraticCurveTo(nx+68,ny-30,nx+68,ny-16); g.lineTo(nx+68,ny-6); g.lineTo(nx-38,ny-6);
  g.closePath(); g.fill();
  g.fillStyle='#4f8fd0'; g.fillRect(nx-38,ny-30,106,6);
  g.fillStyle='#232323'; g.fillRect(nx+34,ny-52,12,24); g.fillRect(nx+30,ny-56,20,6);
  g.fillStyle='#e0472c'; g.fillRect(nx-62,ny-46,30,40);
  g.fillStyle='#fef3df'; g.fillRect(nx-56,ny-40,18,16);
  drawDriver(nx-47,ny-32);
  g.fillStyle='#232323'; g.fillRect(nx+64,ny-8,8,16);
  drawWheel(nx-44,ny+2,16); drawWheel(nx-6,ny+2,19); drawWheel(nx+30,ny+2,16);
  g.strokeStyle='#8a8a8a'; g.lineWidth=3;
  const rodY=ny+2+Math.sin(wheelAngle)*6;
  g.beginPath(); g.moveTo(nx-44,rodY); g.lineTo(nx+30,rodY); g.stroke();
}

function drawTrain(){
  const ny=h*TRACK_Y_RATIO, nx=TRAIN_SCREEN_X();
  drawCar(nx-220,ny,'#e3a23e');
  drawCar(nx-140,ny,'#5aa0d8');
  drawLocomotive(nx,ny);
}

function drawParticles(){
  g.save();
  for(const p of smoke){ g.globalAlpha=clamp(p.life,0,1)*.55; g.fillStyle='#e9e9e9'; g.beginPath(); g.arc(p.x,p.y,p.r,0,Math.PI*2); g.fill(); }
  for(const p of dust){ g.globalAlpha=clamp(p.life/.5,0,1)*.6; g.fillStyle='#c9b89a'; g.beginPath(); g.arc(p.x,p.y,p.r,0,Math.PI*2); g.fill(); }
  for(const p of sparks){ g.globalAlpha=clamp(p.life/.7,0,1); g.fillStyle=p.color; g.fillRect(p.x-2,p.y-2,4,4); }
  for(const p of confetti){ g.globalAlpha=clamp(p.life/1.2,0,1); g.fillStyle=p.color; g.save(); g.translate(p.x,p.y); g.rotate(p.spin*t); g.fillRect(-4,-4,8,8); g.restore(); }
  g.restore(); g.globalAlpha=1;
}

function drawGauge(){
  if(arrived) return;
  const st=STATIONS[idx]; if(!st) return;
  const remaining=st.x-trainX, barW=Math.min(320,w-48), barX=(w-barW)/2, barY=122;
  const span=remaining>220?Math.max(440,remaining*2.3):300;
  const toPx=v=>barX+clamp(.5+v/span,0,1)*barW;
  g.fillStyle='rgba(18,30,42,.92)'; g.beginPath(); g.roundRect(barX-12,88,barW+24,79,12); g.fill();
  g.direction='rtl'; g.textAlign='center'; g.textBaseline='middle'; g.font='700 13px Rubik,sans-serif';
  g.fillStyle='#fff5d8'; g.fillText(`תחנה ${idx+1} מתוך 5 · ${st.name}`,w/2,103);
  g.fillStyle='#526374'; g.fillRect(barX,barY,barW,12);
  for(const [band,color] of [[2,'#d7ad52'],[1,'#55c993'],[0,'#ffe7a1']]){
    g.fillStyle=color; g.fillRect(toPx(-st.bands[band]),barY,toPx(st.bands[band])-toPx(-st.bands[band]),12);
  }
  g.fillStyle='#fff'; g.fillRect(w/2-1,barY-4,2,20);
  const px=toPx(-remaining);
  g.beginPath(); g.moveTo(px,barY-2); g.lineTo(px-6,barY-11); g.lineTo(px+6,barY-11); g.fill();
  const predicted=toPx(-remaining+speed*speed/(2*BRAKE_D));
  g.strokeStyle='#8ee5ff'; g.lineWidth=2; g.beginPath(); g.arc(predicted,barY+6,5,0,Math.PI*2); g.stroke();
  g.fillStyle='#fff5d8'; g.font='12px Rubik,sans-serif';
  const prompt=remaining>120?'התקרבו לתחנה':remaining<0?'עברתם את הסימן':'בלמו בעדינות';
  g.fillText(`${prompt} · מרחק לסימן: ${Math.round(Math.abs(remaining)/8)} מ׳`,w/2,151);
}

function drawToast(){
  if(!toast) return;
  const p=1-clamp(toast.life/toast.total,0,1);
  const alpha=toast.life>0.4?1:toast.life/0.4;
  const scale=p<0.25 ? .7+(p/0.25)*.3 : 1;
  g.save(); g.globalAlpha=clamp(alpha,0,1);
  g.translate(w/2,h*.26); g.scale(scale,scale);
  g.font=`900 ${w<500?18:22}px Rubik, sans-serif`; g.textAlign='center'; g.textBaseline='middle'; g.direction='rtl';
  g.lineWidth=6; g.strokeStyle='rgba(10,8,20,.75)'; g.strokeText(toast.text,0,0,w-32);
  g.fillStyle=toast.color; g.fillText(toast.text,0,0,w-32);
  g.restore(); g.globalAlpha=1;
}

function draw(){
  g.clearRect(0,0,w,h);
  const prog=clamp(trainX/STATIONS[STATIONS.length-1].x,0,1);
  drawSky(prog);
  g.save();
  g.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
  drawHillLayer(h*.50,65,.006,0,.18,lerpColor([110,130,150],[205,170,120],prog));
  drawHillLayer(h*.57,54,.007,2,.4,lerpColor([85,118,88],[175,145,95],prog));
  drawHillLayer(h*.64,38,.009,4,.62,lerpColor([58,98,58],[150,120,70],prog));
  drawTrees(.62,h*.64,38,.009,4);
  drawTrees(.4,h*.57,54,.007,2);
  // Near olive grove and limestone rocks create a fourth depth plane.
  for(let i=Math.floor(camX*.85/140)-1;i<(camX*.85+w)/140+1;i++){
    const x=i*140-camX*.85, v=hash(i+90);
    if(v>.45) drawOliveTree(x,h*.82,30+v*18);
    g.fillStyle='#a4a17b'; g.beginPath(); g.ellipse(x+45,h*.88,9+v*10,4+v*4,0,0,Math.PI*2); g.fill();
  }
  drawTrack();
  for(const st of STATIONS) drawStation(st);
  drawTrain();
  g.fillStyle='#fff4c3'; g.beginPath(); g.moveTo(TRAIN_SCREEN_X(),h*TRACK_Y_RATIO+28); g.lineTo(TRAIN_SCREEN_X()-7,h*TRACK_Y_RATIO+40); g.lineTo(TRAIN_SCREEN_X()+7,h*TRACK_Y_RATIO+40); g.fill();
  g.restore();
  drawParticles();
  drawGauge();
  drawToast();
}

function frame(ms){
  const dt=Math.min(.033,(ms-last)/1000||0); last=ms;
  if(kit.running && !kit.paused) update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
