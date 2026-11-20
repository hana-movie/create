
const MAP_SRC="assets/scene_map.webp",BOT_SRC="assets/poko_normal.webp",IDEA_SRC="assets/poko_idea.webp",PIC_SRC="assets/scene_picnic.webp";
const SIT_SRC="assets/poko_sit.webp";
const W=1536,H=1024;
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const msg=document.getElementById('msg'),backBtn=document.getElementById('back');
const MSPOTS=[
 {id:'home',name:'自宅',icon:'🏠',x:765,y:690,hx:760,hy:490,r:190,lines:['ただいま〜！おうちが一番！','ふかふかソファでひと休み…💤','お水をごくごく。ふぅ〜'],fx:['💤','🛋️','🥛']},
 {id:'park',name:'公園',icon:'🛝',x:1120,y:380,hx:1170,hy:290,r:270,lines:['すべり台、ひゃっほーい！','ぶらんこ、たかーい！','噴水でしぶきがキラキラ✨'],fx:['🛝','💦','⭐']},
 {id:'picnic',name:'ピクニック',icon:'🧺',x:370,y:300,hx:330,hy:260,r:270,lines:[],fx:['💡','✨']},
 {id:'super',name:'スーパー',icon:'🛒',x:300,y:880,hx:290,hy:760,r:270,lines:['りんごを買ったよ！','今日の特売はなにかな？','カートでガラガラ〜🛒'],fx:['🍎','🍞','🥛','🍊']},
 {id:'game',name:'ゲーセン',icon:'🎮',x:1250,y:870,hx:1270,hy:780,r:260,lines:['クレーンゲーム、ゲット！','うーん、おしい！もう一回！','ウサギのぬいぐるみゲット🐰'],fx:['🧸','🐰','🎮','🪙']}
];
const PSPOTS=[
 {name:'パラソル',icon:'⛱️',x:470,y:730,hx:470,hy:470,lines:['パラソルの下はすずしいね〜','日かげでひと休み…'],fx:['⛱️','🌞','😌']},
 {name:'バスケット',icon:'🧺',x:670,y:700,hx:670,hy:565,lines:['サンドイッチ、いただきます！','おいしいおやつがいっぱい！'],fx:['🥪','🍓','🧃','🍪']},
 {name:'ベンチ',icon:'🪑',x:1160,y:552,hx:1160,hy:520,sit:true,lines:['ベンチにすわったよ〜','ふぅ、のんびり…','いい天気だなぁ〜'],fx:['☁️','😊','🎵']},
 {name:'お花',icon:'🌷',x:260,y:720,hx:240,hy:520,lines:['お花がいっぱい！いいにおい🌼','チューリップがきれい！'],fx:['🌷','🌼','🌸','🦋']}
];
let fromSpot=null;let scene='map',idea=false,trans=null;
const imgs={map:new Image(),bot:new Image(),idea:new Image(),pic:new Image(),sit:new Image()};
let loaded=0,mask=null,last=0;
function onl(){if(++loaded<5)return;
 const o=document.createElement('canvas');o.width=W;o.height=H;const oc=o.getContext('2d');oc.drawImage(imgs.map,0,0,W,H);
 try{mask=oc.getImageData(0,0,W,H).data}catch(e){mask=null}
 requestAnimationFrame(loop)}
for(const k in imgs)imgs[k].onload=onl;
imgs.map.src=MAP_SRC;imgs.bot.src=BOT_SRC;imgs.idea.src=IDEA_SRC;imgs.pic.src=PIC_SRC;imgs.sit.src=SIT_SRC;

const me={x:MSPOTS[0].x,y:MSPOTS[0].y,tx:0,ty:0,face:1,t:0,spot:null,walking:false};
let bubble=null,ripples=[],floats=[],blocked=0;
const curBH=()=>scene==='map'?170:260;
function land(x,y){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H)return false;if(!mask)return true;return mask[(y*W+x)*4+3]>40}
function say(text,ms=2600){bubble={text,until:performance.now()+ms}}

function go(x,y){
 if(trans||idea)return;
 const spots=scene==='map'?MSPOTS:PSPOTS;
 let near=null,nd=1e9;
 for(const s of spots){const d=Math.hypot((s.hx??s.x)-x,(s.hy??s.y)-y),R=s.r||(scene==='map'?130:150);if(d<R&&d<nd){nd=d;near=s}}
 if(near){x=near.x;y=near.y}
 else{
  const ok=scene==='map'?land(x,y):(x>60&&x<1476&&y>520&&y<930);
  if(!ok){blocked=performance.now()+600;say(scene==='map'?'そっちは行けないよ〜':'ここはしき物の上かお花の上だけだよ',1500);return}
 }
 me.sitting=false;me.tx=x;me.ty=y;me.spot=near;me.walking=true;bubble=null;
 ripples.push({x,y,t:0});
 msg.textContent=near?near.icon+' '+near.name+'へ向かってるよ！':'てくてく歩いてるよ…';
}
cv.addEventListener('pointerdown',e=>{
 const r=cv.getBoundingClientRect();
 const mx=(e.clientX-r.left)*W/r.width,my=(e.clientY-r.top)*H/r.height;
 if(PARKSC.includes(scene)){parkDown(e,mx,my);return}
 if(scene==='picnic'&&!trans&&grabItem(e,mx,my))return;
 go(mx,my);
});

function burst(s,y){for(let k=0;k<5;k++)floats.push({x:me.x+(Math.random()-.5)*140,y,t:-k*.12,e:s.fx[Math.floor(Math.random()*s.fx.length)]})}
function arrive(){
 me.walking=false;const s=me.spot;
 if(!s){msg.textContent=scene==='map'?'どこで遊ぼうかな？ 次の場所をタップ！':'つぎはどこで遊ぶ？';return}
 if(scene==='map'&&(s.id==='picnic'||s.id==='game'||s.id==='park'||s.id==='home'||s.id==='super')){startIdea(s);return}
 me.sitting=!!s.sit;
 say(s.lines[Math.floor(Math.random()*s.lines.length)],3200);
 msg.textContent=s.icon+' '+s.name+'で遊んでるよ！';
 burst(s,me.y-curBH());chime();
}
function startIdea(s){fromSpot=s;
 idea=true;msg.textContent='💡 ひらめいた！';
 say('ここで遊ぼう！',2000);burst(s,me.y-curBH());chime();
 setTimeout(()=>{trans={t:0,to:({game:'game',park:'park',home:'room',super:'shop'})[s.id]||'picnic',sw:false}},1500);
}
backBtn.onclick=()=>{if(!trans){bubble=null;trans={t:0,to:(scene==='sink'||scene==='bed')?'room':(scene==='slide'||scene==='swing'||scene==='sand')?'park':'map',sw:false}}};
function applyScene(to){backBtn.textContent=(to==='slide'||to==='swing'||to==='sand')?'← 公園にもどる':(to==='sink')?'← おへやにもどる':'← 地図にもどる';if(PARKSC.includes(to)){parkEnter(to);return}if(to==='game'){scene='game';idea=false;me.walking=false;me.sitting=false;bubble=null;floats=[];ripples=[];backBtn.classList.remove('show');tray.classList.remove('show');fit();msg.textContent='ゲーセンで遊ぼう！';openClaw();return}if(scene==='game')closeClaw();
 scene=to;me.sitting=false;me.walking=false;me.spot=null;bubble=null;floats=[];ripples=[];me.t=0;
 if(to==='picnic'){idea=false;me.x=770;me.y=880;me.face=1;backBtn.classList.add('show');tray.classList.add('show');fit();
  msg.textContent='ピクニックで遊ぼう！もちものをシートにドラッグしてね';
  setTimeout(()=>say('わーい、ピクニックだ！',2500),400)}
 else{idea=false;{const fs=fromSpot||MSPOTS[2];me.x=fs.x;me.y=fs.y}backBtn.classList.remove('show');tray.classList.remove('show');fit();
  msg.textContent='地図にもどったよ。次はどこへ行く？'}
}

let ac=null;
function chime(){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();[660,880,1100].forEach((f,i)=>{const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=f;o.connect(g);g.connect(ac.destination);const t=ac.currentTime+i*.09;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.12,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+.25);o.start(t);o.stop(t+.3)})}catch(e){}}

function pill(text,x,y){
 ctx.font='900 26px "Zen Maru Gothic",sans-serif';const w=ctx.measureText(text).width+30;
 ctx.fillStyle='rgba(255,255,255,.92)';ctx.strokeStyle='#ff6b5e';ctx.lineWidth=3;
 ctx.beginPath();ctx.roundRect(x-w/2,y-18,w,36,18);ctx.fill();ctx.stroke();
 ctx.fillStyle='#2a4a63';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y+1);
}
function drawBubble(x,y,text){
 ctx.font='700 30px "Zen Maru Gothic",sans-serif';const w=Math.min(ctx.measureText(text).width+40,640),h=58;
 const bx=Math.max(w/2+8,Math.min(W-w/2-8,x)),by=Math.max(h+8,y);
 ctx.fillStyle='#fff';ctx.strokeStyle='#2a4a63';ctx.lineWidth=3;
 ctx.beginPath();ctx.roundRect(bx-w/2,by-h,w,h,20);ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.moveTo(x-10,by-1);ctx.lineTo(x,by+16);ctx.lineTo(x+10,by-1);ctx.fill();
 ctx.fillStyle='#2a4a63';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,bx,by-h/2+1,w-24);
}

function loop(now){
 const dt=Math.min(.05,(now-last)/1000||0);last=now;
 if(me.walking){
  const dx=me.tx-me.x,dy=me.ty-me.y,d=Math.hypot(dx,dy),step=(scene==='map'?300:380)*dt;
  if(Math.abs(dx)>4)me.face=dx>0?1:-1;
  me.t+=dt;
  if(d<=step){me.x=me.tx;me.y=me.ty;arrive()}else{me.x+=dx/d*step;me.y+=dy/d*step}
 }else me.t+=dt*(idea?2.2:.4);
 if(trans){trans.t+=dt/.45;if(trans.t>=1&&!trans.sw){trans.sw=true;applyScene(trans.to)}if(trans.t>=2)trans=null}

 ctx.clearRect(0,0,W,H);
 if(PARKSC.includes(scene)){parkFrame(dt,now);if(trans){const a2=trans.t<1?trans.t:2-trans.t;ctx.fillStyle=`rgba(255,255,255,${Math.max(0,Math.min(1,a2))})`;ctx.fillRect(0,0,W,H)}requestAnimationFrame(loop);return}
 if(scene==='map'){
  ctx.drawImage(imgs.map,0,0,W,H);
 }else{
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#bfe8ff');g.addColorStop(.5,'#e4f7c8');g.addColorStop(1,'#9ad966');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.drawImage(imgs.pic,0,0,W,H);
 }
 ripples=ripples.filter(r=>(r.t+=dt)<.8);
 ripples.forEach(r=>{const p=r.t/.8;ctx.strokeStyle=`rgba(255,107,94,${1-p})`;ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(r.x,r.y,14+p*36,(14+p*36)*.45,0,0,7);ctx.stroke()});

 if(scene==='picnic')drawItems(0);
 const sp=imgs[idea?'idea':(me.sitting&&scene==='picnic')?'sit':'bot'],bh=curBH()*(idea?1.15:me.sitting?.78:1),bw=bh*sp.width/sp.height;
 const ph=me.t*(me.walking?13:3);
 const sway=me.walking?Math.sin(ph)*0.13:Math.sin(ph)*0.02;
 const hop=me.sitting?0:me.walking?Math.abs(Math.sin(ph))*bh/12:idea?Math.abs(Math.sin(me.t*8))*bh/9:Math.sin(ph)*2;
 const sq=me.walking?1+Math.cos(ph*2)*.03:1;
 ctx.fillStyle='rgba(30,60,40,.25)';ctx.beginPath();ctx.ellipse(me.x,me.y,bw*.28-hop*.4,bh*.075,0,0,7);ctx.fill();
 ctx.save();ctx.translate(me.x+(blocked>now?Math.sin(now/30)*5:0),me.y-hop);ctx.rotate(sway);ctx.scale(me.face*sq,1/sq);
 ctx.drawImage(sp,-bw/2,-bh+6,bw,bh);ctx.restore();
 if(scene==='picnic'){drawItems(1);drawBasketHint()}
 floats=floats.filter(f=>(f.t+=dt)<1.4);
 floats.forEach(f=>{if(f.t<0)return;ctx.globalAlpha=1-f.t/1.4;ctx.font='48px sans-serif';ctx.textAlign='center';ctx.fillText(f.e,f.x,f.y-f.t*90);ctx.globalAlpha=1});
 if(bubble){if(now>bubble.until)bubble=null;else drawBubble(me.x,me.y-bh-22-hop,bubble.text)}
 if(trans){const a=trans.t<1?trans.t:2-trans.t;ctx.fillStyle=`rgba(255,255,255,${Math.max(0,Math.min(1,a))})`;ctx.fillRect(0,0,W,H)}
 requestAnimationFrame(loop);
}

/* ===== もちもの（ドラッグ&ドロップ） =====
   イラスト差し替え: 各アイテムの src に画像のURL（または data URI）を入れるだけ。
   src が null の間は emoji で表示。透過PNG/WebP推奨。size は地図上での高さ。 */
const ITEMS=[
 {id:'apple',name:'りんご',emoji:'🍎',src:'assets/item_apple.webp',size:100},
 {id:'bento',name:'お弁当',emoji:'🍱',src:'assets/item_bento.webp',size:110},
 {id:'juice',name:'ジュース',emoji:'🧃',src:'assets/item_juice.webp',size:125},
 {id:'chips',name:'ポテチ',emoji:'🍟',src:'assets/item_chips.webp',size:125},
 {id:'candy',name:'キャンディ',emoji:'🍭',src:'assets/item_candy.webp',size:135}
];
const tray=document.getElementById('tray'),itemsEl=document.getElementById('items'),wrap=document.getElementById('wrap');
ITEMS.forEach(it=>{if(it.src){it.img=new Image();it.img.src=it.src}});
const SHEET=[[330,645],[1190,645],[1455,895],[85,895]];
function inSheet(x,y){let c=false;for(let i=0,j=3;i<4;j=i++){const [xi,yi]=SHEET[i],[xj,yj]=SHEET[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c}return c}
let placed=[],drag=null;
function savePlaced(){try{localStorage.setItem('dkd_placed',JSON.stringify(placed.map(p=>({id:p.it.id,x:Math.round(p.x),y:Math.round(p.y)}))))}catch(e){}}
try{placed=JSON.parse(localStorage.getItem('dkd_placed')||'[]').map(o=>({it:ITEMS.find(i=>i.id===o.id),x:o.x,y:o.y})).filter(p=>p.it)}catch(e){placed=[]}
const ghost=document.createElement('div');ghost.id='ghost';ghost.style.display='none';document.body.appendChild(ghost);
const iconHTML=it=>it.src?`<img src='${it.src}' alt=''>`:it.emoji;
ITEMS.forEach(it=>{const d=document.createElement('div');d.className='it';d.innerHTML=`<div class='ic'>${iconHTML(it)}</div>${it.name}`;
 d.addEventListener('pointerdown',e=>{e.preventDefault();startDrag(it,e,null)});itemsEl.appendChild(d)});
function moveGhost(e){ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px'}
function startDrag(it,e,orig,mx,my){drag={it,orig,mx,my,sx:e.clientX,sy:e.clientY,moved:false};ghost.innerHTML=iconHTML(it);ghost.style.display='block';moveGhost(e)}
function grabItem(e,mx,my){
 for(let i=placed.length-1;i>=0;i--){const p=placed[i];
  if(Math.hypot(mx-p.x,my-p.y)<p.it.size*.55){placed.splice(i,1);startDrag(p.it,e,p,mx,my);return true}}
 return false}
addEventListener('pointermove',e=>{if(!drag)return;if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>6)drag.moved=true;moveGhost(e);const r=cv.getBoundingClientRect();drag.cx=(e.clientX-r.left)*W/r.width;drag.cy=(e.clientY-r.top)*H/r.height});
addEventListener('pointerup',e=>{
 if(!drag)return;const d=drag;drag=null;ghost.style.display='none';
 if(d.orig&&!d.moved){placed.push(d.orig);go(d.mx,d.my);return}
 const r=cv.getBoundingClientRect();
 const x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;
 const inside=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
 if(scene==='picnic'&&inside&&inSheet(x,y)){
  placed.push({it:d.it,x,y});savePlaced();floats.push({x,y:y-50,t:0,e:'✨'});chime();
  if(!me.walking)say(d.it.name+'をおいたよ！',1800);
 }else if(scene==='picnic'&&inside&&d.orig&&inBasket(x,y)){putAway(d.it)}else if(d.orig){placed.push(d.orig)}
});
addEventListener('pointercancel',()=>{if(drag){if(drag.orig)placed.push(drag.orig);drag=null;ghost.style.display='none'}});
const inBasket=(x,y)=>((x-670)/150)**2+((y-560)/125)**2<=1;
function putAway(it){savePlaced();floats.push({x:670,y:500,t:0,e:it.emoji});;chime();say(it.name+'\u3092\u304b\u3054\u306b\u5165\u308c\u305f\u3088\uff01',1800)}
function drawBasketHint(){
 if(!(drag&&drag.orig&&drag.moved))return;
 const hot=drag.cx!=null&&inBasket(drag.cx,drag.cy);
 ctx.save();ctx.lineWidth=hot?8:4;ctx.strokeStyle=hot?'#ffd23f':'rgba(255,255,255,.9)';ctx.setLineDash(hot?[]:[14,10]);
 ctx.beginPath();ctx.ellipse(670,560,160,135,0,0,7);ctx.stroke();ctx.restore();
 if(hot){ctx.fillStyle='rgba(255,210,63,.25)';ctx.beginPath();ctx.ellipse(670,560,160,135,0,0,7);ctx.fill()}
}
function drawItems(front){
 for(const p of placed){
  if(front?p.y<=me.y:p.y>me.y)continue;
  const s=p.it.size;
  ctx.fillStyle='rgba(60,30,30,.22)';ctx.beginPath();ctx.ellipse(p.x,p.y+s*.38,s*.4,s*.1,0,0,7);ctx.fill();
  if(p.it.img&&p.it.img.complete&&p.it.img.naturalWidth){const w=s*p.it.img.naturalWidth/p.it.img.naturalHeight;ctx.drawImage(p.it.img,p.x-w/2,p.y-s/2,w,s)}
  else{ctx.font=s*.9+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.it.emoji,p.x,p.y)}
 }
}
function fit(){
 const m=document.querySelector('main'),row=getComputedStyle(m).flexDirection==='row',on=scene==='picnic';
 const tw=on&&row?tray.offsetWidth+10:0,th=on&&!row?tray.offsetHeight+10:0;
 const w=Math.max(100,Math.min(m.clientWidth-20-tw,(m.clientHeight-th)*1.5));
 wrap.style.width=w+'px';wrap.style.height=w/1.5+'px';
}
addEventListener('resize',fit);fit();

/* ===== 公園（すべり台・ブランコ・すなば） =====
   座標はすべて「各イラストの画像ピクセル」で持っています。スコップのイラストができたら SHOVEL.src に入れてください。 */
const pmk=s=>{const i=new Image();i.src=s;return i};
const PARKSC=['park','slide','swing','sand','room','shop','sink','bed'];
const PIM={sink:pmk("assets/scene_sink.webp"),bed:pmk("assets/scene_bed.webp"),brushB:pmk("assets/scene_brushB.webp"),brushP:pmk("assets/scene_brushP.webp"),towel:pmk("assets/scene_towel.webp"),shop:pmk("assets/scene_shop.webp"),room:pmk("assets/scene_room.webp"),toybox:pmk("assets/scene_toybox.webp"),table:pmk("assets/scene_table.webp"),park:pmk("assets/scene_park.webp"),slide:pmk("assets/scene_slide.webp"),swing:pmk("assets/scene_swing.webp"),sand:pmk("assets/scene_sand.webp"),bucket:pmk("assets/scene_bucket.webp"),swL:pmk("assets/scene_swL.webp"),swR:pmk("assets/scene_swR.webp")};
imgs.cart=pmk("assets/poko_cart.webp");
imgs.ride=pmk("assets/poko_ride.webp");
const SHOVEL={x:960,y:735,h:150,img:pmk("assets/shovel.webp")};
const PK={x:0,y:0,face:1,t:0,path:[],speed:340,anim:'walk',mode:'idle',busy:false,fit:{sc:1,x0:0,y0:0}};
const BHS={park:140,slide:245,swing:235,sand:235,room:250,shop:300,sink:235,bed:0};
const pfit=img=>{if(scene==='shop')return{sc:1,x0:-SHOP.cam,y0:SHOP_Y};const w=img.naturalWidth||W,h=img.naturalHeight||H,sc=Math.min(W/w,H/h);return{sc,x0:(W-w*sc)/2,y0:H-h*sc}};
const pc=(ix,iy)=>({x:PK.fit.x0+ix*PK.fit.sc,y:PK.fit.y0+iy*PK.fit.sc});
const pinv=(x,y)=>[(x-PK.fit.x0)/PK.fit.sc,(y-PK.fit.y0)/PK.fit.sc];
const pImg=()=>PIM[scene];
const rnd=a=>a[Math.floor(Math.random()*a.length)];
function distSeg(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-(a[0]+dx*t),y-(a[1]+dy*t))}
const inPoly=(x,y,p)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const [xi,yi]=p[i],[xj,yj]=p[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c}return c};
function pfloat(ix,iy,es){const p=pc(ix,iy);es.forEach((e,k)=>floats.push({x:p.x+(k-es.length/2)*34,y:p.y,t:-k*.12,e}))}
function pkWalk(ix,iy,cb){PK.path=[{x:ix,y:iy,cb}]}
function pkStep(dt){
 if(!PK.path.length){PK.walking=false;return}
 const p=PK.path[0],dx=p.x-PK.x,dy=p.y-PK.y,d=Math.hypot(dx,dy),sp=(p.speed||PK.speed)*dt;
 PK.anim=p.anim||'walk';PK.walking=true;PK.t+=dt;
 if(Math.abs(dx)>3&&!p.noface)PK.face=dx>0?1:-1;
 if(d<=sp){PK.x=p.x;PK.y=p.y;PK.path.shift();if(p.cb)p.cb()}else{PK.x+=dx/d*sp;PK.y+=dy/d*sp}
}
function arcStart(x1,y1,dur,h,mode,done){PK.mode='arc';PK.arc={t:0,dur,x0:PK.x,y0:PK.y,x1,y1,h,mode,done};PK.path=[]}
function arcUpdate(dt){const a=PK.arc;a.t+=dt;const p=Math.min(1,a.t/a.dur);PK.x=a.x0+(a.x1-a.x0)*p;PK.y=a.y0+(a.y1-a.y0)*p-4*a.h*p*(1-p);if(p>=1){PK.x=a.x1;PK.y=a.y1;PK.mode=a.mode;if(a.done)a.done()}}
function pdrawPoko(ix,iy,h,o={}){
 const f=PK.fit,img=o.img||imgs.bot,hh=h*f.sc,ww=hh*img.naturalWidth/img.naturalHeight,p=pc(ix,iy);
 if(!o.noShadow){ctx.fillStyle='rgba(30,60,40,.25)';ctx.beginPath();ctx.ellipse(p.x,p.y,ww*.28,hh*.07,0,0,7);ctx.fill()}
 ctx.save();ctx.translate(p.x,p.y-(o.hop||0)*f.sc);ctx.rotate(o.rot||0);ctx.scale(o.face||1,1);ctx.drawImage(img,-ww/2,-hh+6,ww,hh);ctx.restore();
}
function pokoWalkDraw(){
 const h=BHS[scene],w=PK.walking,ph=PK.t*(PK.anim==='climb'?9:13);
 pdrawPoko(PK.x,PK.y,h,{img:PK.wave>0?WINIMG:imgs.bot,face:PK.face,hop:w?Math.abs(Math.sin(ph))*h/(PK.anim==='climb'?7:12):0,rot:w?Math.sin(ph)*(PK.anim==='climb'?.07:.13):0});
}

/* --- 公園（全体） --- */
const PARKSPOTS=[
 {to:'slide',icon:'🛝',hit:[1190,440],r:200,stand:[1090,600],line:'すべり台であそぼう！'},
 {to:'swing',icon:'🎠',hit:[720,360],r:200,stand:[720,530],line:'ブランコにのろう！'},
 {to:'sand',icon:'🏖️',hit:[470,590],r:170,stand:[540,700],line:'すなばであそぼう！'},
 {id:'fountain',icon:'⛲',hit:[770,640],r:130,stand:[770,770],lines:['ふんすい、キラキラ！','水しぶきがきもちいい〜'],fx:['💦','✨','🌈']}
];
function parkTapPark(ix,iy){
 if(PK.busy)return;
 let near=null,nd=1e9;
 for(const s of PARKSPOTS){const d=Math.hypot(ix-s.hit[0],iy-s.hit[1]);if(d<s.r&&d<nd){near=s;nd=d}}
 if(near){pkWalk(near.stand[0],near.stand[1],()=>{
   if(near.to){PK.busy=true;say(near.line,1300);chime();setTimeout(()=>{if(scene==='park')trans={t:0,to:near.to,sw:false}},800)}
   else{say(rnd(near.lines),2200);pfloat(PK.x,PK.y-BHS.park,near.fx);chime()}});
  msg.textContent=near.icon+' へ向かってるよ！';return}
 if(ix>200&&ix<1400&&iy>470&&iy<880){pkWalk(ix,iy);msg.textContent='てくてく歩いてるよ…'}
 else say('そっちは行けないよ〜',1500);
}

/* --- すべり台 --- */
const SL={P0:[840,525],P1:[330,905]};
function parkTapSlide(ix,iy){
 if(PK.mode!=='idle'||PK.busy)return;
 const inLad=ix>990&&ix<1270&&iy>570&&iy<905,inTower=ix>740&&ix<1150&&iy>90&&iy<580;
 if(inLad||inTower||distSeg(ix,iy,SL.P0,SL.P1)<95){slideRide();return}
 if(ix>170&&ix<1270&&iy>875&&iy<970)pkWalk(ix,iy);else say('そこは行けないよ〜',1500);
}
function slideRide(){
 PK.busy=true;say('のぼるよ〜！',1800);msg.textContent='🛝 はしごをのぼってるよ！';
 PK.path=[{x:1185,y:915},{x:1070,y:592,speed:120,anim:'climb',noface:true},{x:895,y:524,speed:170},{x:SL.P0[0],y:SL.P0[1],speed:140,cb:()=>{PK.mode='slide';PK.st=0;PK.path=[];say('わーい！',1500);chime()}}];
}
function slideUpdate(dt){
 if(PK.mode!=='slide')return;
 PK.st+=dt;const u=Math.min(1,Math.pow(PK.st/1.5,1.8));
 PK.x=SL.P0[0]+(SL.P1[0]-SL.P0[0])*u;PK.y=SL.P0[1]+(SL.P1[1]-SL.P0[1])*u;
 if(u>=1){PK.mode='idle';PK.busy=false;PK.face=-1;PK.path=[{x:280,y:925,speed:220}];say('たのしい〜！もういっかい！',2400);pfloat(PK.x,PK.y-200,['✨','🎉','✨']);msg.textContent='すべり台、たのしかった！ もういっかいタップしてね'}
}

/* --- ブランコ --- */
const SWLEN=332,SEATY=352;
const SW={L:{px:699,py:346,x0:628,y0:344,th:0,w:0,spr:'swL'},R:{px:893,py:346,x0:820,y0:344,th:0,w:0,spr:'swR'},rider:null,drag:null};
const SWK=.12,SWS=.2,swScale=th=>1+SWS*Math.sin(th);
const seatWorld=s=>[s.px,s.py+SEATY*Math.cos(s.th)*(1+SWK*Math.sin(s.th))];
function swingHit(ix,iy){
 for(const k of ['L','R']){const s=SW[k],[sx,sy]=seatWorld(s);
  if(Math.hypot(ix-sx,iy-sy)<125||(Math.abs(s.th)<.2&&Math.abs(ix-s.px)<95&&iy>340&&iy<760))return k}
 return null;
}
function swingGround(ix,iy){return ix>230&&ix<1330&&iy>790&&iy<915}
function swingBoard(k){
 SW.rider=k;const s=SW[k];say('ブランコにのったよ！',1800);msg.textContent='ブランコをタップ／ひっぱってゆらそう！';
 arcStart(0,0,.55,110,'ride');PK.arc.k=k;
}
function swingDismount(ix,iy){
 const k=SW.rider;SW.rider=null;const s=SW[k];
 PK.x=seatWorld(s)[0];PK.y=seatWorld(s)[1];
 arcStart(ix==null?s.px:ix,iy==null?850:iy,.5,90,'idle');say('おりたよ〜',1500);
}
function swingDown(e,ix,iy,mx,my){
 const k=swingHit(ix,iy);
 if(PK.mode==='arc')return;
 if(SW.rider){
  if(k===SW.rider){SW.drag={id:e.pointerId,sx:mx,sy:my,ix0:ix,iy0:iy,moved:false,lastTh:SW[k].th,lastT:performance.now()};return}
  if(k){const old=SW.rider;swingDismount(SW[k].px,850);setTimeout(()=>{if(scene==='swing'&&!SW.rider&&PK.mode==='idle')swingBoard(k)},620);return}
  if(swingGround(ix,iy))swingDismount(ix,iy);else say('ブランコから おりたいときは じめんをタップ',2200);
  return}
 if(k){swingBoard(k);return}
 if(swingGround(ix,iy))pkWalk(ix,iy);else say('そこは行けないよ〜',1500);
}
function swingMove(ix,iy,mx,my){
 const d=SW.drag;if(!d)return;
 if(!d.moved&&Math.hypot(mx-d.sx,my-d.sy)>8)d.moved=true;
 if(d.moved){const s=SW[SW.rider],now=performance.now();
  s.th=Math.max(-.9,Math.min(.9,(iy-d.iy0)/150*.9));
  const dt=Math.max(.008,(now-d.lastT)/1000);s.w=Math.max(-3.2,Math.min(3.2,(s.th-d.lastTh)/dt));d.lastTh=s.th;d.lastT=now}
}
function swingUp(){
 const d=SW.drag;if(!d)return;SW.drag=null;const s=SW[SW.rider];if(!s)return;
 if(!d.moved){const dir=Math.abs(s.w)>.2?(s.w>0?1:-1):1;if(Math.abs(s.w)<2.4)s.w+=dir*1.5;say(rnd(['ゆ〜ら ゆ〜ら','たかいたかーい！','きもちいい〜']),1400);chime()}
}
function swingUpdate(dt){
 for(const k of ['L','R']){const s=SW[k];
  if(SW.drag&&SW.rider===k&&SW.drag.moved)continue;
  s.w+=(-8.2*Math.sin(s.th)-.22*s.w)*dt;s.th+=s.w*dt;s.th=Math.max(-1.2,Math.min(1.2,s.th));
  if(Math.abs(s.th)<.002&&Math.abs(s.w)<.01){s.th=0;s.w=0}}
 if(PK.mode==='ride'){const [x,y]=seatWorld(SW[SW.rider]);PK.x=x;PK.y=y}
 if(PK.mode==='arc'&&PK.arc.k){const [x,y]=seatWorld(SW[PK.arc.k]);PK.arc.x1=x;PK.arc.y1=y}
}

/* --- すなば --- */
const SANDPOLY=[[520,620],[1050,620],[1185,765],[405,765]];
const BK={x:700,y:735,h:190,fill:0,state:'idle',t:0,tilt:0,ox:0,oy:0,blocks:[],parts:[],drag:null,side:1};
const SH={x:960,y:735,ang:0,sd:1,loaded:false};
function bkW(){const im=PIM.bucket;return BK.h*(im.naturalWidth||1)/(im.naturalHeight||1)}
function bkOpen(){const w=bkW(),h=BK.h,cxx=BK.x,cyy=BK.y-h/2;const lx=0,ly=-.38*h;return[cxx+lx*Math.cos(BK.tilt)-ly*Math.sin(BK.tilt),cyy+lx*Math.sin(BK.tilt)+ly*Math.cos(BK.tilt)]}
function sandGround(ix,iy){return ix>250&&ix<1320&&iy>830&&iy<920}
function sandDown(e,ix,iy){
 const w=bkW();
 if(BK.state==='idle'&&Math.abs(ix-BK.x)<w/2&&iy>BK.y-BK.h&&iy<BK.y+12){BK.drag={id:e.pointerId,sx:ix,sy:iy,ox:ix-BK.x,oy:iy-BK.y,moved:false};return}
 if(BK.state==='idle'&&Math.hypot(ix-SH.x,iy-SH.y+30)<95){if(BK.fill>.9)say('もう いっぱいだよ',1500);else bkFill();return}
 if(BK.state==='idle'){const bw=w*.8,bh=BK.h*.84;
  for(let i=BK.blocks.length-1;i>=0;i--){const b=BK.blocks[i];
   if(Math.abs(ix-b.x)<bw/2&&iy>b.y-bh&&iy<b.y+10){BK.blocks.splice(i,1);dust(b.x,b.y-bh*.4,16,170);say('さらさら〜',1500);return}}}
 if(PK.busy)return;
 if(sandGround(ix,iy))pkWalk(ix,iy);else say('バケツや スコップをタップしてみてね',1800);
}
function sandMove(ix,iy){
 const d=BK.drag;if(!d)return;
 if(!d.moved&&Math.hypot(ix-d.sx,iy-d.sy)>8)d.moved=true;
 if(d.moved){const nx=ix-d.ox,ny=iy-d.oy;if(inPoly(nx,ny-4,SANDPOLY)){BK.x=nx;BK.y=ny}}
}
function sandUp(){
 const d=BK.drag;if(!d)return;BK.drag=null;if(d.moved||BK.state!=='idle')return;
 if(BK.fill<.5)bkFill();else bkPour();
}
function bkFill(){
 BK.state='fill';BK.t=0;BK.lastK=-1;BK.fill=0;
 BK.side=BK.x<780?1:-1;if(!inPoly(BK.x+BK.side*135,BK.y,SANDPOLY))BK.side=-BK.side;
 say('スコップで すなをすくうよ',1800);
}
function bkPour(){
 BK.state='pour';BK.t=0;BK.landed=false;
 const cand=[1,-1,1.6,-1.6].map(m=>BK.x+(BK.x<760?1:-1)*m*210);
 let dx=0;
 for(const x of cand){if(inPoly(x,BK.y-4,SANDPOLY)&&!BK.blocks.some(b=>Math.abs(b.x-x)<120&&Math.abs(b.y-BK.y)<60)){dx=x-BK.x;break}}
 if(!dx)dx=(BK.x<760?1:-1)*210;
 BK.dx=dx;BK.dir=dx>0?1:-1;say('えいっ！',1200);
}
const ease=p=>p*p*(3-2*p);
function dust(x,y,n,vx0){for(let i=0;i<n;i++)BK.parts.push({x:x+(Math.random()-.5)*30,y,vx:(Math.random()-.5)*vx0*2,vy:-80-Math.random()*140,mode:'fall',ty:y+8+Math.random()*10})}
function bkUpdate(dt){
 const sd=BK.side||1;
 if(BK.state==='fill'){
  BK.t+=dt;
  const S=[BK.x+sd*135,BK.y+6],O=[BK.x+sd*22,BK.y-BK.h*.98],R=[SHOVEL.x,SHOVEL.y];
  SH.sd=sd;const k=Math.floor(BK.t/1.1);
  if(k<3){
   if(k!==BK.lastK){BK.lastK=k;BK.dip=false;BK.dumped=false}
   const u=BK.t-k*1.1,prev=k===0?R:O;
   if(u<.3){const p=ease(u/.3);SH.x=prev[0]+(S[0]-prev[0])*p;SH.y=prev[1]+(S[1]-prev[1])*p-30*Math.sin(Math.PI*p);SH.ang=.25*p;SH.loaded=false}
   else if(u<.45){SH.x=S[0];SH.y=S[1]+8*Math.sin(Math.PI*(u-.3)/.15);SH.ang=.25;
    if(u>.38&&!BK.dip){BK.dip=true;dust(S[0],S[1]+4,5,60);SH.loaded=true}}
   else if(u<.8){const p=ease((u-.45)/.35);SH.x=S[0]+(O[0]-S[0])*p;SH.y=S[1]+(O[1]-S[1])*p-70*Math.sin(Math.PI*p);SH.ang=.25-.8*p;SH.loaded=true}
   else{const p=Math.min(1,(u-.8)/.25);SH.x=O[0];SH.y=O[1];SH.ang=-.55-.3*p;
    if(!BK.dumped){BK.dumped=true;for(let i=0;i<5;i++)BK.parts.push({x:O[0]-sd*12+(Math.random()-.5)*24,y:O[1]+22,vx:-sd*20,vy:0,mode:'fall',ty:BK.y-BK.h*.74})}
    if(u>.85)SH.loaded=false}
   BK.fill=(k+Math.max(0,Math.min(1,(BK.t-k*1.1-.8)/.3)))/3;
  }else{
   const p=Math.min(1,(BK.t-3.3)/.4);SH.x=O[0]+(R[0]-O[0])*p;SH.y=O[1]+(R[1]-O[1])*p-40*Math.sin(Math.PI*p);SH.ang=-.85*(1-p);SH.loaded=false;BK.fill=1;
   if(p>=1){BK.state='idle';SH.x=R[0];SH.y=R[1];SH.ang=0;SH.sd=1;say('いっぱい はいったよ！',1800);chime()}}
 }else if(BK.state==='pour'){
  BK.t+=dt;const T=BK.t,dx=BK.dx,dir=BK.dir;
  if(T<.35){const p=ease(T/.35);BK.ox=dx*p;BK.oy=-80*Math.sin(Math.PI*p);BK.tilt=dir*Math.PI*p;if(T>.2)BK.fill=0}
  else if(T<.7){BK.ox=dx;BK.oy=0;BK.tilt=dir*Math.PI;BK.fill=0;
   if(!BK.landed){BK.landed=true;BK.blocks.push({x:BK.x+dx,y:BK.y,t0:T});if(BK.blocks.length>5)BK.blocks.shift();
    dust(BK.x+dx,BK.y,12,160);say('バサッ！',1500);chime()}}
  else if(T<1.2){const p=ease((T-.7)/.5);BK.ox=dx*(1-p);BK.oy=-90*Math.sin(Math.PI*p);BK.tilt=dir*Math.PI*(1-p)}
  else{BK.state='idle';BK.ox=0;BK.oy=0;BK.tilt=0;BK.fill=0;say('バケツのかたちの すなが できた！',2200)}
 }
 for(const p of BK.parts.slice()){
  if(p.mode==='fly'){p.t+=dt;if(p.t>=p.dur)BK.parts.splice(BK.parts.indexOf(p),1)}
  else{p.vy+=1500*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.y>=p.ty)BK.parts.splice(BK.parts.indexOf(p),1)}}
 for(const b of BK.blocks)b.age=(b.age||0)+dt;
}
function drawBlock(b){
 const f=PK.fit,w=bkW()*f.sc,h=BK.h*f.sc,p=pc(b.x,b.y),pop=.88+.12*Math.min(1,(b.age||0)/.18);
 const wb=w*.80*pop,wt=w*.58*pop,hh=h*.84*pop;
 ctx.fillStyle='rgba(90,60,30,.22)';ctx.beginPath();ctx.ellipse(p.x,p.y+2,wb*.55,h*.06,0,0,7);ctx.fill();
 ctx.save();ctx.translate(p.x,p.y);ctx.lineJoin='round';ctx.lineWidth=3*f.sc;ctx.strokeStyle='#c99a55';
 ctx.fillStyle='#efd29a';ctx.beginPath();ctx.moveTo(-wb/2,0);ctx.lineTo(-wt/2,-hh);ctx.lineTo(wt/2,-hh);ctx.lineTo(wb/2,0);ctx.quadraticCurveTo(0,hh*.05,-wb/2,0);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.fillStyle='rgba(255,255,255,.28)';ctx.beginPath();ctx.moveTo(-wb/2+wb*.08,-hh*.1);ctx.lineTo(-wt/2+wt*.1,-hh*.92);ctx.lineTo(-wt/2+wt*.3,-hh*.92);ctx.lineTo(-wb/2+wb*.26,-hh*.1);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#d6b070';ctx.lineWidth=2.5*f.sc;ctx.beginPath();ctx.moveTo(-wb/2+wb*.025,-hh*.15);ctx.lineTo(wb/2-wb*.025,-hh*.15);ctx.stroke();
 ctx.fillStyle='#f6e2b4';ctx.strokeStyle='#c99a55';ctx.lineWidth=3*f.sc;ctx.beginPath();ctx.ellipse(0,-hh,wt/2,hh*.075,0,0,7);ctx.fill();ctx.stroke();
 ctx.restore();
}
function shDraw(){
 const im=SHOVEL.img;if(!im||!im.naturalWidth)return;
 const f=PK.fit,hh=SHOVEL.h*f.sc,ww=hh*im.naturalWidth/im.naturalHeight,p=pc(SH.x,SH.y);
 if(BK.state!=='fill'){ctx.fillStyle='rgba(90,60,30,.22)';ctx.beginPath();ctx.ellipse(p.x+ww*.05,p.y+hh*.06,ww*.32,hh*.07,0,0,7);ctx.fill()}
 ctx.save();ctx.translate(p.x,p.y);ctx.scale(SH.sd,1);ctx.rotate(SH.ang);
 ctx.drawImage(im,-.31*ww,-.735*hh,ww,hh);
 if(SH.loaded){ctx.fillStyle='#f0d49a';ctx.strokeStyle='#c99a55';ctx.lineWidth=2.5*f.sc;ctx.beginPath();ctx.ellipse(-.02*ww,-.06*hh,.13*ww,.06*hh,-.5,0,7);ctx.fill();ctx.stroke()}
 ctx.restore();
}
function sandDraw(){
 const f=PK.fit;
 [...BK.blocks].sort((a,b)=>a.y-b.y).forEach(drawBlock);
 const im=PIM.bucket;
 if(im.naturalWidth){
  const w=bkW()*f.sc,h=BK.h*f.sc,c=pc(BK.x+BK.ox,BK.y-BK.h/2+BK.oy),base=pc(BK.x+BK.ox,BK.y);
  const gnd=BK.state==='pour'?1-Math.min(1,Math.abs(BK.oy)/80):1;
  ctx.fillStyle='rgba(90,60,30,'+(.22*gnd)+')';ctx.beginPath();ctx.ellipse(base.x,base.y+2,w*.42,h*.07,0,0,7);ctx.fill();
  ctx.save();ctx.translate(c.x,c.y+(BK.drag&&BK.drag.moved?-8*f.sc:0));ctx.rotate(BK.tilt);ctx.drawImage(im,-w/2,-h/2,w,h);
  if(BK.fill>0){const ox=(.506-.5)*w,oy=(.173-.5)*h,rx=.37*w,ry=.118*h,l=BK.fill;
   ctx.fillStyle='#f1d49b';ctx.strokeStyle='#c99a55';ctx.lineWidth=3*f.sc;ctx.beginPath();ctx.ellipse(ox,oy-ry*.3*l,rx*.93,ry*(.55+.5*l),0,0,7);ctx.fill();ctx.stroke()}
  ctx.restore()}
 shDraw();
 for(const p of BK.parts){let x,y;
  if(p.mode==='fly'){const t=Math.min(1,p.t/p.dur);x=p.x0+(p.x1-p.x0)*t;y=p.y0+(p.y1-p.y0)*t-4*p.h*t*(1-t)}else{x=p.x;y=p.y}
  const q=pc(x,y);ctx.fillStyle='#e8c47a';ctx.strokeStyle='#b88a45';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(q.x,q.y,5*f.sc,0,7);ctx.fill();ctx.stroke()}
}

/* --- シーン共通 --- */
function parkEnter(to){
 const prev=scene;scene=to;idea=false;me.walking=false;me.sitting=false;bubble=null;floats=[];ripples=[];
 backBtn.classList.add('show');tray.classList.remove('show');fit();
 Object.assign(PK,{path:[],mode:'idle',busy:false,face:1,t:0,anim:'walk',walking:false,speed:340});
 PK.fit=pfit(pImg());
 if(to==='park'){const s=PARKSPOTS.find(q=>q.to===prev),st=s?s.stand:[770,830];PK.x=st[0];PK.y=st[1];
  msg.textContent='公園だよ！あそびたいものをタップしてね';setTimeout(()=>say('どこであそぼうかな？',2200),300)}
 else if(to==='slide'){PK.x=700;PK.y=925;PK.speed=380;msg.textContent='はしごやすべり台をタップすると、のぼってすべるよ！';setTimeout(()=>say('すべり台だ！',2000),300)}
 else if(to==='swing'){PK.x=1080;PK.y=850;SW.rider=null;SW.drag=null;msg.textContent='ブランコをタップするとポコがのるよ！';setTimeout(()=>say('ブランコにのりたいな',2200),300)}
 else if(to==='sink'){SINK.foam=[];SINK.drops=[];SINK.water=0;SINK.drag=null;SINK.dirty=false;for(const o of [SINK.towel,SINK.brushB,SINK.brushP]){o.x=o.hx;o.y=o.hy;o.back=false}PK.x=1270;PK.y=960;msg.textContent='ポンプ・蛇口を タップ。あわや水てきも タップで ふけるよ';setTimeout(()=>say('てを あらおう〜！',2200),300)}
 else if(to==='bed'){BED.t=0;BED.said=false;BED.pending=false;NIGHT.a=0;WAKE.on=false;PK.x=640;PK.y=330;backBtn.classList.remove('show');msg.textContent='おやすみなさい…💤'}
 else if(to==='shop'){shopLoad();SHOP.cam=0;SHOP.drag=null;SHOP.pan=null;PK.x=300;PK.y=590;PK.speed=320;PK.face=1;msg.textContent='よこにスクロール＆タップでカートを おして すすもう。しょうひんは ドラッグで うごかせるよ';setTimeout(()=>say('いらっしゃいませ〜！',2200),300)}
 else if(to==='room'){roomLoad();ROOM.drag=null;{const rs=prev==='sink'?[270,610]:prev==='bed'?[1180,650]:[760,760];PK.x=rs[0];PK.y=rs[1]}PK.speed=360;msg.textContent='おへやだよ！おもちゃばこ・おかしカゴをタップ。ドラッグでしまえるよ';if(prev==='bed'){msg.textContent='おはよう！あたらしい あさだよ'}else setTimeout(()=>say(prev==='sink'?'さっぱり〜！':'ただいま〜！',2000),300)}
 else{PK.x=1050;PK.y=865;BK.state='idle';BK.tilt=0;BK.ox=0;BK.oy=0;BK.drag=null;BK.parts=[];Object.assign(SH,{x:SHOVEL.x,y:SHOVEL.y,ang:0,sd:1,loaded:false});msg.textContent='バケツをタップ：スコップですなを入れる／ひっくり返して出す。ドラッグで動かせるよ';setTimeout(()=>say('すなあそび！',2000),300)}
}
function parkDown(e,mx,my){
 if(trans)return;
 PK.fit=pfit(pImg());const [ix,iy]=pinv(mx,my);
 if(scene==='park')parkTapPark(ix,iy);
 else if(scene==='slide')parkTapSlide(ix,iy);
 else if(scene==='swing')swingDown(e,ix,iy,mx,my);
 else if(scene==='sand')sandDown(e,ix,iy);else if(scene==='shop')shopDown(e,ix,iy,mx,my);else if(scene==='sink')sinkDown(e,ix,iy);else if(scene==='bed'){}else roomDown(e,ix,iy);
}
function pkPointer(e){const r=cv.getBoundingClientRect(),mx=(e.clientX-r.left)*W/r.width,my=(e.clientY-r.top)*H/r.height,[ix,iy]=pinv(mx,my);return{mx,my,ix,iy}}
addEventListener('pointermove',e=>{if(!PARKSC.includes(scene))return;const p=pkPointer(e);if(scene==='swing')swingMove(p.ix,p.iy,p.mx,p.my);else if(scene==='sand')sandMove(p.ix,p.iy);else if(scene==='room')roomMove(p.ix,p.iy);else if(scene==='shop')shopMove(p.ix,p.iy,p.mx,p.my);else if(scene==='sink')sinkMove(p.ix,p.iy)});
addEventListener('pointerup',e=>{if(!PARKSC.includes(scene))return;if(scene==='swing')swingUp();else if(scene==='sand')sandUp();else if(scene==='room'){const p=pkPointer(e);roomUp(p.ix,p.iy)}else if(scene==='shop'){const p=pkPointer(e);shopUp(p.ix,p.iy)}else if(scene==='sink')sinkUp()});
addEventListener('pointercancel',()=>{SW.drag=null;BK.drag=null;SINK.drag=null;SHOP.pan=null;if(SHOP.drag){const d=SHOP.drag;SHOP.drag=null;Object.assign(d.o,d.from);SHOP.items.push(d.o)}if(ROOM.drag){const d=ROOM.drag;ROOM.drag=null;d.obj.x=d.px;d.obj.y=d.py;ROOM.items.push(d.obj)}});
function parkFrame(dt,now){
 if(BED.pending){BED.pending=false;applyScene('room')}
 wakeUpdate(dt);if(PK.wave>0)PK.wave-=dt;
 const img=pImg();PK.fit=pfit(img);const f=PK.fit;
 if(scene==='shop'){shopBackdrop()}else if(scene==='room'||scene==='sink'||scene==='bed'){ctx.fillStyle='#fdeed3';ctx.fillRect(0,0,W,H)}else{const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#bfe8ff');g.addColorStop(.55,'#e4f7c8');g.addColorStop(1,'#9ad966');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
 if(PK.mode==='arc')arcUpdate(dt);else if(PK.mode==='idle'){pkStep(dt);if(!PK.path.length)PK.t+=dt*.4}
 if(scene==='slide')slideUpdate(dt);else if(scene==='swing')swingUpdate(dt);else if(scene==='sand')bkUpdate(dt);else if(scene==='room')roomUpdate(dt);else if(scene==='shop')shopUpdate(dt);else if(scene==='sink')sinkUpdate(dt);else if(scene==='bed')bedUpdate(dt);
 if(img.naturalWidth)ctx.drawImage(img,f.x0,f.y0,img.naturalWidth*f.sc,img.naturalHeight*f.sc);
 if(scene==='swing'){
  for(const k of ['L','R']){const s=SW[k],sp=PIM[s.spr];if(!sp.naturalWidth)continue;
   const p=pc(s.px,s.py),sx=swScale(s.th),sy=Math.cos(s.th)*(1+SWK*Math.sin(s.th));
   ctx.save();ctx.translate(p.x,p.y);ctx.scale(sx,sy);
   ctx.drawImage(sp,(s.x0-s.px)*f.sc,(s.y0-s.py)*f.sc,sp.naturalWidth*f.sc,sp.naturalHeight*f.sc);ctx.restore();
   if(SW.rider===k&&PK.mode==='ride'){const im=imgs.ride;if(im.naturalWidth){const hh=BHS.swing*f.sc*sx,ww=hh*im.naturalWidth/im.naturalHeight,q=pc(...seatWorld(s));
    ctx.save();ctx.translate(q.x,q.y);ctx.rotate(-s.th*.18);ctx.drawImage(im,-ww/2,18*f.sc*sx-hh,ww,hh);ctx.restore()}}}
  if(PK.mode!=='ride')pokoWalkDraw();
 }else if(scene==='sand'){sandDraw();pokoWalkDraw()}
 else if(scene==='room')roomDraw()
 else if(scene==='shop')shopDraw()
 else if(scene==='sink')sinkDraw()
 else if(scene==='bed'){}
 else if(scene==='slide'&&PK.mode==='slide'){pdrawPoko(PK.x,PK.y,BHS.slide*.85,{img:imgs.sit,rot:-.64,noShadow:true})}
 else pokoWalkDraw();
 floats=floats.filter(fl=>(fl.t+=dt)<1.4);
 floats.forEach(fl=>{if(fl.t<0)return;ctx.globalAlpha=1-fl.t/1.4;ctx.font='48px sans-serif';ctx.textAlign='center';ctx.fillText(fl.e,fl.x,fl.y-fl.t*90);ctx.globalAlpha=1});
 nightDraw();
 if(bubble){if(now>bubble.until)bubble=null;else{const p=pc(PK.x,PK.y);drawBubble(p.x,p.y-BHS[scene]*f.sc-24,bubble.text)}}
}



/* ===== おへや（自宅）：おもちゃばこ＆くまテーブル ===== */
const ROOMSPOTS=[
 {hit:[1290,420],r:200,stand:[1180,640],to:'bed',lines:['ふかふかのベッド！','ねむくなってきた…💤']},
 {hit:[770,330],r:170,stand:[770,560],lines:['おいしそうな ごはん！','いただきます！🍽️']},
 {hit:[250,350],r:200,stand:[270,600],to:'sink',lines:['てを あらおう〜','きれいに なったよ！✨']}
];
const ROOM={items:[],drag:null,loaded:false,TB:{x:300,y:860,w:310,key:'toybox'},TBL:{x:1130,y:870,w:450,key:'table'},max:10};
const TB_OPEN=[.12,0,.9,.36];            // おもちゃばこの いれぐち（画像の割合）
const BASKET_FR=[0.6868,-0.0011,0.9780,0.3951];          // くまテーブルの おかしカゴ（画像の割合）
const roomSet=k=>k==='veh'?VEH:FOODS;
function roomBox(o){const im=PIM[o.key],w=o.w,h=w*(im.naturalHeight||1)/(im.naturalWidth||1);return{x0:o.x-w/2,y0:o.y-h,w,h}}
function frRect(o,fr){const b=roomBox(o);return[b.x0+fr[0]*b.w,b.y0+fr[1]*b.h,b.x0+fr[2]*b.w,b.y0+fr[3]*b.h]}
const toyRect=()=>{const b=roomBox(ROOM.TB);return[b.x0,b.y0,b.x0+b.w,b.y0+b.h]};
const basketRect=()=>frRect(ROOM.TBL,BASKET_FR);
const inR=(x,y,r)=>x>=r[0]&&x<=r[2]&&y>=r[1]&&y<=r[3];
const roomFloor=(x,y)=>x>120&&x<1430&&y>600&&y<930;
function roomItemH(o){return o.kind==='veh'?o.it.ph*.85:o.it.ph*.8}
function roomItemW(o){const im=o.it.img,h=roomItemH(o);return im&&im.naturalWidth?h*im.naturalWidth/im.naturalHeight:h}
function roomSave(){try{localStorage.setItem('dkd_room',JSON.stringify(ROOM.items.filter(o=>o.st==='rest').map(o=>({k:o.kind,id:o.it.id,x:Math.round(o.x),y:Math.round(o.y)}))))}catch(e){}}
function roomLoad(){
 if(ROOM.loaded)return;ROOM.loaded=true;
 try{ROOM.items=JSON.parse(localStorage.getItem('dkd_room')||'[]').map(s=>{const it=roomSet(s.k).find(i=>i.id===s.id);return it?{kind:s.k,it,x:s.x,y:s.y,st:'rest',rot:0}:null}).filter(Boolean)}catch(e){ROOM.items=[]}
}
function roomSpawn(kind){
 if(ROOM.items.length>=ROOM.max){say('もう いっぱいだよ！かたづけてね',2000);return}
 const it=rnd(roomSet(kind));
 let sx,sy,lx,ly;
 if(kind==='veh'){const r=toyRect();sx=(r[0]+r[2])/2;sy=r[1]+(r[3]-r[1])*.25;lx=ROOM.TB.x+(Math.random()-.5)*380;ly=ROOM.TB.y+30+Math.random()*50}
 else{const r=basketRect();sx=(r[0]+r[2])/2;sy=r[1]+(r[3]-r[1])*.3;const sr=frRect(ROOM.TBL,[.2,.34,.66,.5]);lx=sr[0]+Math.random()*(sr[2]-sr[0]);ly=sr[1]+Math.random()*(sr[3]-sr[1])}
 lx=Math.max(160,Math.min(1400,lx));ly=Math.min(925,ly);
 ROOM.items.push({kind,it,x:sx,y:sy,x0:sx,y0:sy,x1:lx,y1:ly,t:0,dur:.65,arc:150+Math.random()*60,spin:Math.random()<.5?1:-1,st:'fly',rot:0});
 say(kind==='veh'?rnd(['のりものが でてきた！','なにが でるかな？','わーい、おもちゃ！']):rnd(['おかしが でてきた！','おいしそう〜！','なにが でるかな？']),1800);chime();
}
function roomDown(e,ix,iy){
 if(trans)return;
 if(!ROOM.drag){
  for(let i=ROOM.items.length-1;i>=0;i--){const o=ROOM.items[i];if(o.st!=='rest')continue;
   const w=roomItemW(o),h=roomItemH(o);
   if(Math.abs(ix-o.x)<w/2&&iy>o.y-h&&iy<o.y+12){ROOM.items.splice(i,1);ROOM.drag={obj:o,id:e.pointerId,sx:ix,sy:iy,ox:ix-o.x,oy:iy-o.y,px:o.x,py:o.y,moved:false,cx:ix,cy:iy};return}}
 }
 if(inR(ix,iy,basketRect())){roomSpawn('food');return}
 if(inR(ix,iy,toyRect())){roomSpawn('veh');return}
 if(iy>912&&ix>480&&ix<1060&&!PK.busy){PK.busy=true;pkWalk(Math.max(560,Math.min(980,ix)),948,()=>{say('いってきま〜す！',1300);chime();setTimeout(()=>{if(scene==='room'&&!trans)trans={t:0,to:'map',sw:false};PK.busy=false},800)});return}
 let near=null,nd=1e9;
 for(const s of ROOMSPOTS){const d=Math.hypot(ix-s.hit[0],iy-s.hit[1]);if(d<s.r&&d<nd){near=s;nd=d}}
 if(near){pkWalk(near.stand[0],near.stand[1],()=>{say(rnd(near.lines),2000);chime();if(near.to)setTimeout(()=>{if(scene==='room'&&!trans)trans={t:0,to:near.to,sw:false}},900)});return}
 if(roomFloor(ix,iy))pkWalk(ix,iy);else say('そっちは行けないよ〜',1500);
}
function roomMove(ix,iy){
 const d=ROOM.drag;if(!d)return;
 if(!d.moved&&Math.hypot(ix-d.sx,iy-d.sy)>8)d.moved=true;
 d.cx=ix;d.cy=iy;d.obj.x=ix-d.ox;d.obj.y=iy-d.oy;
}
function roomUp(ix,iy){
 const d=ROOM.drag;if(!d)return;ROOM.drag=null;const o=d.obj;
 const mine=o.kind==='veh'?toyRect():basketRect(),other=o.kind==='veh'?basketRect():toyRect();
 if(!d.moved){o.x=d.px;o.y=d.py;ROOM.items.push(o);return}
 if(inR(ix,iy,mine)){pfloat(ix,iy-60,['✨']);chime();say(o.it.name+'を しまったよ',1600);roomSave();return}
 if(inR(ix,iy,other)){o.x=d.px;o.y=d.py;ROOM.items.push(o);say('ここには はいらないよ〜',1700);return}
 if(roomFloor(o.x,o.y)){o.y=Math.min(925,o.y)}else{o.x=d.px;o.y=d.py}
 o.st='rest';ROOM.items.push(o);roomSave();
}
function roomUpdate(dt){
 for(const o of ROOM.items){
  if(o.st==='fly'){o.t+=dt;const p=Math.min(1,o.t/o.dur);o.x=o.x0+(o.x1-o.x0)*p;o.y=o.y0+(o.y1-o.y0)*p-4*o.arc*p*(1-p);o.rot=p*6.2832*o.spin;if(p>=1){o.st='rest';o.x=o.x1;o.y=o.y1;o.rot=0;roomSave()}}}
}
function roomDrawItem(o,lift){
 const f=PK.fit,im=o.it.img,h=roomItemH(o)*f.sc,w=roomItemW(o)*f.sc,p=pc(o.x,o.y);
 ctx.fillStyle='rgba(60,40,20,'+(lift?.16:.22)+')';ctx.beginPath();ctx.ellipse(p.x,(o.st==='fly'?pc(o.x,o.x1!=null?o.y1:o.y).y:p.y)+(lift?10:0),w*.38,h*.09,0,0,7);ctx.fill();
 ctx.save();ctx.translate(p.x,p.y-(lift?18*f.sc:0)-(o.st==='fly'?h/2:0));ctx.rotate(o.rot||0);
 if(im&&im.naturalWidth)ctx.drawImage(im,-w/2,o.st==='fly'?-h/2:-h,w,h);else{ctx.font=h*.8+'px sans-serif';ctx.textAlign='center';ctx.fillText(o.it.emoji,0,0)}
 ctx.restore();
}
function roomDrawBox(o){
 const f=PK.fit,im=PIM[o.key];if(!im.naturalWidth)return;const b=roomBox(o),p=pc(b.x0,b.y0);
 
 ctx.drawImage(im,p.x,p.y,b.w*f.sc,b.h*f.sc);
}
function roomOnTable(o){const fl=o.st==='fly';return inR(fl?o.x1:o.x,fl?o.y1:o.y,frRect(ROOM.TBL,[.14,.26,.9,.6]))}
function roomDraw(){
 const f=PK.fit,list=[];
 list.push({y:ROOM.TB.y,fn:()=>roomDrawBox(ROOM.TB)});list.push({y:ROOM.TBL.y,fn:()=>roomDrawBox(ROOM.TBL)});
 ROOM.items.forEach(o=>list.push({y:roomOnTable(o)?ROOM.TBL.y+1:(o.st==='fly'?o.y1:o.y),fn:()=>roomDrawItem(o)}));
 list.push({y:PK.y,fn:pokoWalkDraw});
 list.sort((a,b)=>a.y-b.y).forEach(e=>e.fn());
 const d=ROOM.drag;
 if(d&&d.moved){
  const t=d.obj.kind==='veh'?toyRect():basketRect(),hot=inR(d.cx,d.cy,t),a=pc(t[0],t[1]),b=pc(t[2],t[3]);
  ctx.save();ctx.lineWidth=(hot?7:4)*f.sc;ctx.strokeStyle=hot?'#ffd23f':'rgba(255,255,255,.95)';ctx.setLineDash(hot?[]:[14,10]);ctx.beginPath();ctx.roundRect(a.x,a.y,b.x-a.x,b.y-a.y,24);ctx.stroke();
  if(hot){ctx.fillStyle='rgba(255,210,63,.22)';ctx.fill()}ctx.restore()}
 {const hp=pc(770,972);ctx.save();ctx.globalAlpha=.55+.25*Math.sin(performance.now()/300);ctx.font='900 30px "Zen Maru Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#e0508f';ctx.fillText('▼ そとへ',hp.x,hp.y);ctx.restore()}
 if(d)roomDrawItem(d.obj,true);
}

/* ===== スーパー（店内・よこスクロール） ===== */
const SHOP_Y=250,SHOP_W=2155,SH_U=[[71,436],[551,911],[1021,1381]],SH_ROW=[168,274,378],SH_TOP=74;
const REG={cx:1813,rect:[1726,169,1906,299],slots:[[-42,6],[0,0],[42,6],[-20,-16],[22,-18]],base:238};
const CART_FR=[0.53,0.66,0.99,0.84];
const SHOP={cam:0,items:[],drag:null,pan:null,loaded:false};
const shopBase=o=>Math.min(74,o.it.ph*.5);
function cartRect(){
 const im=imgs.cart,h=shopPH(),w=h*(im.naturalWidth||1)/(im.naturalHeight||1),y0=PK.y-h+CART_FR[1]*h,y1=PK.y-h+CART_FR[3]*h;
 return PK.face>=0?[PK.x-w/2+CART_FR[0]*w,y0,PK.x-w/2+CART_FR[2]*w,y1]:[PK.x+w/2-CART_FR[2]*w,y0,PK.x+w/2-CART_FR[0]*w,y1];
}
function shopPos(o){
 const b=shopBase(o);
 if(o.c==='shelf'){const [x0,x1]=SH_U[o.u];return[x0+(o.s+.5)*(x1-x0)/3,SH_ROW[o.r],b]}
 if(o.c==='reg'){const s=REG.slots[o.i];return[REG.cx+s[0],REG.base+s[1],b*.8]}
 const r=cartRect(),fx=[.14,.38,.62,.86][o.i%4],fy=[.55,.98][Math.floor(o.i/4)];return[r[0]+fx*(r[2]-r[0]),r[1]+fy*(r[3]-r[1]),b*.95];
}
function shopSave(){try{localStorage.setItem('dkd_shop',JSON.stringify(SHOP.items.map(o=>({id:o.it.id,c:o.c,u:o.u,r:o.r,s:o.s,i:o.i}))))}catch(e){}}
function shopLoad(){
 if(SHOP.loaded)return;SHOP.loaded=true;
 try{const a=JSON.parse(localStorage.getItem('dkd_shop')||'null');
  if(a){SHOP.items=a.map(s=>{const it=FOODS.find(f=>f.id===s.id);return it?{it,c:s.c,u:s.u,r:s.r,s:s.s,i:s.i}:null}).filter(Boolean);return}}catch(e){}
 const slots=[];for(let u=0;u<3;u++)for(let r=0;r<3;r++)for(let s=0;s<3;s++)slots.push([u,r,s]);
 slots.sort(()=>Math.random()-.5);
 SHOP.items=slots.slice(0,14).map(([u,r,s])=>({it:rnd(FOODS),c:'shelf',u,r,s}));
 shopSave();
}
function shopItemRect(o){const [x,y,h]=shopPos(o),im=o.it.img,w=im&&im.naturalWidth?h*im.naturalWidth/im.naturalHeight:h;return[x-w/2,y-h,x+w/2,y]}
function shopDown(e,ix,iy,mx,my){
 if(trans||SHOP.drag)return;
 const order=['cart','reg','shelf'];
 for(const c of order)for(let k=SHOP.items.length-1;k>=0;k--){const o=SHOP.items[k];if(o.c!==c)continue;
  const r=shopItemRect(o);
  if(ix>=r[0]-4&&ix<=r[2]+4&&iy>=r[1]-4&&iy<=r[3]+6){
   const [x,y]=shopPos(o);SHOP.items.splice(k,1);
   SHOP.drag={o,from:{c:o.c,u:o.u,r:o.r,s:o.s,i:o.i},ox:ix-x,oy:iy-y,x,y,moved:false,sx:mx,sy:my,mx,my,cx:ix,cy:iy};return}}
 SHOP.pan={sx:mx,cam0:SHOP.cam,moved:false};
}
function shopMove(ix,iy,mx,my){
 const d=SHOP.drag;
 if(d){if(!d.moved&&Math.hypot(mx-d.sx,my-d.sy)>8)d.moved=true;d.mx=mx;d.my=my;d.x=ix-d.ox;d.y=iy-d.oy;d.cx=ix;d.cy=iy;return}
 const p=SHOP.pan;
 if(p){if(!p.moved&&Math.abs(mx-p.sx)>10)p.moved=true;if(p.moved)SHOP.cam=Math.max(0,Math.min(SHOP_W-W,p.cam0-(mx-p.sx)))}
}
const inRect=(x,y,r,pad=0)=>x>=r[0]-pad&&x<=r[2]+pad&&y>=r[1]-pad&&y<=r[3]+pad;
function freeIdx(c,max){for(let i=0;i<max;i++)if(!SHOP.items.some(o=>o.c===c&&o.i===i))return i;return -1}
function shopPlace(o,ix,iy){
 if(inRect(ix,iy,cartRect(),26)){const i=freeIdx('cart',8);if(i<0)return'cartfull';o.c='cart';o.i=i;return'ok'}
 if(inRect(ix,iy,REG.rect,20)){const i=freeIdx('reg',5);if(i<0)return'regfull';o.c='reg';o.i=i;return'ok'}
 for(let u=0;u<3;u++){const [x0,x1]=SH_U[u];
  if(ix>=x0-24&&ix<=x1+24&&iy>=SH_TOP-12&&iy<=SH_ROW[2]+26){
   const rows=[0,1,2].sort((a,b)=>Math.abs(iy-SH_ROW[a])-Math.abs(iy-SH_ROW[b]));
   for(const r of rows){const ss=[0,1,2].sort((a,b)=>Math.abs(ix-(x0+(a+.5)*(x1-x0)/3))-Math.abs(ix-(x0+(b+.5)*(x1-x0)/3)));
    for(const s of ss)if(!SHOP.items.some(q=>q.c==='shelf'&&q.u===u&&q.r===r&&q.s===s)){o.c='shelf';o.u=u;o.r=r;o.s=s;return'ok'}}
   return'shelffull'}}
 return'none';
}
function shopUp(ix,iy){
 const d=SHOP.drag;
 if(d){SHOP.drag=null;const o=d.o;
  const back=()=>{Object.assign(o,d.from);SHOP.items.push(o)};
  if(!d.moved){back();return}
  const res=shopPlace(o,ix,iy);
  if(res==='ok'){SHOP.items.push(o);chime();say(o.c==='cart'?o.it.name+'を カートに いれたよ':o.c==='reg'?o.it.name+'を レジに おいたよ':o.it.name+'を たなに もどしたよ',1600);shopSave()}
  else{back();say(res==='none'?'たなや カゴに いれてね':'もう いっぱいだよ〜',1700)}
  return}
 const p=SHOP.pan;SHOP.pan=null;
 if(p&&!p.moved){PK.path=[{x:Math.max(150,Math.min(SHOP_W-150,ix)),y:Math.max(440,Math.min(735,iy))}];PK.mode='idle'}
}
function shopUpdate(dt){
 const d=SHOP.drag;
 if(d&&d.moved){const sp=d.mx<150?-1:d.mx>W-150?1:0;if(sp){SHOP.cam=Math.max(0,Math.min(SHOP_W-W,SHOP.cam+sp*560*dt));d.cx=d.mx+SHOP.cam;d.x=d.cx-d.ox}}
 if(PK.walking&&!SHOP.pan){const tg=Math.max(0,Math.min(SHOP_W-W,PK.x-W/2));SHOP.cam+=(tg-SHOP.cam)*Math.min(1,dt*4)}
 PK.y=Math.max(440,Math.min(735,PK.y));
}
function shopPH(){return BHS.shop*(.78+.22*Math.max(0,Math.min(1,(PK.y-440)/295)))}
function shopLCD(){
 const n=SHOP.items.filter(o=>o.c==='reg').length,now=performance.now();
 if(n!==SHOP.lastN){SHOP.lastN=n;SHOP.lcdAt=now}
 if(n<=0)return;
 const a=pc(1950,152),b=pc(2066,202),w=b.x-a.x,h=b.y-a.y,flash=Math.max(0,1-(now-(SHOP.lcdAt||0))/500);
 ctx.save();ctx.shadowColor='rgba(90,255,255,.95)';ctx.shadowBlur=18+16*flash;
 ctx.fillStyle=flash>0?'#f2ffff':'#baf7ff';ctx.beginPath();ctx.roundRect(a.x,a.y,w,h,6);ctx.fill();ctx.shadowBlur=0;
 ctx.fillStyle='#07616d';ctx.font='900 '+Math.round(h*.78)+'px "Courier New",monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(n*100),a.x+w/2,a.y+h/2+2,w-14);ctx.restore();
}
function shopBackdrop(){
 const fl=SHOP_Y+429;
 const g=ctx.createLinearGradient(0,0,0,fl);g.addColorStop(0,'#fff7e2');g.addColorStop(1,'#ffe8c2');ctx.fillStyle=g;ctx.fillRect(0,0,W,fl);
 ctx.fillStyle='#e6b77c';ctx.fillRect(0,fl,W,H-fl);
 ctx.strokeStyle='rgba(150,95,40,.18)';ctx.lineWidth=3;for(let y=SHOP_Y+511+40;y<H;y+=58){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
}
function shopDrawItem(it,x,y,h,lift){
 const f=PK.fit,im=it.img,hh=h*f.sc,ww=im&&im.naturalWidth?hh*im.naturalWidth/im.naturalHeight:hh,p=pc(x,y);
 if(lift){ctx.fillStyle='rgba(60,40,20,.2)';ctx.beginPath();ctx.ellipse(p.x,p.y+10,ww*.35,hh*.08,0,0,7);ctx.fill()}
 if(im&&im.naturalWidth)ctx.drawImage(im,p.x-ww/2,p.y-hh-(lift?16:0),ww,hh);else{ctx.font=hh*.8+'px sans-serif';ctx.textAlign='center';ctx.fillText(it.emoji,p.x,p.y-(lift?16:0))}
}
function shopDraw(){
 const f=PK.fit;shopLCD();
 for(const o of SHOP.items)if(o.c==='shelf'){const [x,y,h]=shopPos(o);shopDrawItem(o.it,x,y,h)}
 // レジのカゴ（ふちより下はかくす）
 ctx.save();const cp=pc(0,REG.base+4);ctx.beginPath();ctx.rect(0,0,W,cp.y);ctx.clip();
 for(const o of SHOP.items)if(o.c==='reg'){const [x,y,h]=shopPos(o);shopDrawItem(o.it,x,y,h)}
 ctx.restore();
 const w=PK.walking,ph=PK.t*10;
 pdrawPoko(PK.x,PK.y,shopPH(),{img:imgs.cart,face:PK.face,hop:w?Math.abs(Math.sin(ph))*5:0,rot:w?Math.sin(ph)*.025:0});
 for(const o of SHOP.items)if(o.c==='cart'){const [x,y,h]=shopPos(o);shopDrawItem(o.it,x,y,h)}
 const d=SHOP.drag;
 if(d&&d.moved){
  const rects=[['cart',cartRect(),26],['reg',REG.rect,20],...SH_U.map(u=>['shelf',[u[0],SH_TOP,u[1],SH_ROW[2]+10],10])];
  ctx.save();
  for(const [k,r,pad] of rects){const hot=inRect(d.cx,d.cy,r,pad),a=pc(r[0]-pad/2,r[1]-pad/2),b=pc(r[2]+pad/2,r[3]+pad/2);
   ctx.lineWidth=(hot?7:4);ctx.strokeStyle=hot?'#ffd23f':'rgba(255,255,255,.95)';ctx.setLineDash(hot?[]:[14,10]);ctx.beginPath();ctx.roundRect(a.x,a.y,b.x-a.x,b.y-a.y,18);ctx.stroke();
   if(hot){ctx.fillStyle='rgba(255,210,63,.22)';ctx.fill()}}
  ctx.restore();
  shopDrawItem(d.o.it,d.x,d.y,shopBase(d.o)*1.3,true)}
}

/* ===== 洗面台（ポンプ・蛇口・歯ブラシ・タオル） ===== */
const SINK={foam:[],drops:[],water:0,waterT:0,pump:0,streamT:0,dropT:0,drag:null,dirty:false,
 towel:{x:1074,y:351,hx:1074,hy:351},brushB:{x:818.5,y:402,hx:818.5,hy:402},brushP:{x:870.5,y:403,hx:870.5,hy:403}};
const SK_CUP=[780,340,905,470];
/* 歯ブラシ：イラストが用意できたら PIM.brushB / brushP（切り抜き画像）と sink の背景（歯ブラシなし版）を差し替えて BRUSH_ON=true */
const BRUSH_ON=false,TOWEL_ON=false;
const skList=()=>[...(TOWEL_ON?[['towel',SINK.towel,PIM.towel]]:[]),...(BRUSH_ON?[['brushP',SINK.brushP,PIM.brushP],['brushB',SINK.brushB,PIM.brushB]]:[])];
function sinkPump(){
 SINK.pump=.25;chime();say('ぷしゅっ！',900);
 if(SINK.foam.length>=10)SINK.foam.shift();
 SINK.foam.push({x:548,y:380,vx:30+Math.random()*30,vy:-30,r:8,tr:26+Math.random()*12,st:'fall',a:1,ty:512+Math.random()*10});
 SINK.dirty=true;
}
function sinkFaucet(){
 if(SINK.water){SINK.water=0;say('みずを とめたよ',1200)}
 else{SINK.water=1;SINK.waterT=0;SINK.dropT=0;chime();say('ジャ〜〜〜！',1500)}
}
function sinkDown(e,ix,iy){
 if(SINK.drag)return;
 for(const [k,o,im] of skList()){const w=im.naturalWidth||60,h=im.naturalHeight||90;
  if(Math.abs(ix-o.x)<w/2+4&&Math.abs(iy-o.y)<h/2+4){SINK.drag={k,o,ox:ix-o.x,oy:iy-o.y,moved:false,sx:ix,sy:iy};o.back=false;return}}
 {const hitF=q=>Math.hypot(q.x-ix,q.y-(iy+8))<48,nf=SINK.foam.length,nd=SINK.drops.length;
  SINK.foam=SINK.foam.filter(q=>!hitF(q));SINK.drops=SINK.drops.filter(q=>!hitF(q));
  if(nf+nd>SINK.foam.length+SINK.drops.length){pfloat(ix,iy,['✨']);chime();if(!SINK.foam.length&&!SINK.drops.length&&SINK.dirty){SINK.dirty=false;say('ぴかぴか！',1800)}return}}
 if(inR(ix,iy,[452,358,556,412])||inR(ix,iy,[440,412,552,550])){sinkPump();return}
 if(inR(ix,iy,[634,424,720,548])){sinkFaucet();return}
 if(Math.hypot(ix-PK.x,iy-(PK.y-100))<130)say(rnd(['だいじょうぶ、ぼくも あらうよ！','ぴかぴかに しようね','あわあわ たのしい！']),1800);
}
function sinkMove(ix,iy){
 const d=SINK.drag;if(!d)return;
 if(!d.moved&&Math.hypot(ix-d.sx,iy-d.sy)>8)d.moved=true;
 d.o.x=ix-d.ox;d.o.y=iy-d.oy;
 if(d.k==='towel'&&d.moved){
  const cx=d.o.x,cy=d.o.y;let n=0;
  const hit=q=>Math.abs(q.x-cx)<95&&q.y>cy-30&&q.y<cy+150;
  const f0=SINK.foam.length,d0=SINK.drops.length;
  SINK.foam=SINK.foam.filter(q=>!hit(q));SINK.drops=SINK.drops.filter(q=>!hit(q));
  n=(f0-SINK.foam.length)+(d0-SINK.drops.length);
  if(n>0){pfloat(cx,cy+60,['✨']);if(!SINK.foam.length&&!SINK.drops.length&&SINK.dirty){SINK.dirty=false;say('ぴかぴか！きれいに なった！',2200);chime()}}
 }
}
function sinkUp(){
 const d=SINK.drag;if(!d)return;SINK.drag=null;const o=d.o;
 if(d.k==='towel'){o.back=true;return}
 if(!d.moved||inR(o.x,o.y,SK_CUP)){o.back=true;if(d.moved)say('はみがき おわり！',1400)}
 else say(rnd(['はをみがくよ〜','しゃこしゃこ！']),1400);
}
function sinkUpdate(dt){
 const S=SINK;
 if(S.pump>0)S.pump-=dt;
 if(S.water){S.waterT+=dt;S.streamT+=dt;
  if(S.waterT>5){S.water=0}
  else if(S.waterT>.6){S.dropT+=dt;if(S.dropT>.35){S.dropT=0;if(S.drops.length<12){S.drops.push({x:545+Math.random()*290,y:522+Math.random()*10,r:6+Math.random()*5});S.dirty=true}}}}
 for(const f of S.foam){
  if(f.st==='fall'){f.vy+=900*dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.r+=(f.tr-f.r)*Math.min(1,dt*8);if(f.y>=f.ty){f.y=f.ty;f.st='rest';f.vx=0}}
  else f.r+=(f.tr-f.r)*Math.min(1,dt*6);
  if(S.water&&S.waterT>.5)f.a-=dt*.55}
 S.foam=S.foam.filter(f=>f.a>0);
 for(const o of [S.towel,S.brushB,S.brushP]){
  if(o.back&&!(S.drag&&S.drag.o===o)){o.x+=(o.hx-o.x)*Math.min(1,dt*12);o.y+=(o.hy-o.y)*Math.min(1,dt*12);if(Math.hypot(o.hx-o.x,o.hy-o.y)<.6){o.x=o.hx;o.y=o.hy;o.back=false}}}
}
function drawFoam(f){
 const q=pc(f.x,f.y),r=f.r*PK.fit.sc;
 ctx.save();ctx.globalAlpha=Math.max(0,f.a);ctx.fillStyle='#fff';ctx.strokeStyle='#c7dcf0';ctx.lineWidth=2.5;
 for(const [dx,dy,k] of [[-.55,-.1,.7],[.55,-.1,.7],[0,-.55,.85],[0,0,1]]){ctx.beginPath();ctx.arc(q.x+dx*r,q.y+dy*r-r*.4,r*k,0,7);ctx.fill();ctx.stroke()}
 ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(q.x,q.y-r*.4,r*.95,0,7);ctx.fill();
 ctx.restore();
}
function drawSkItem(o,im,clipHome){
 if(!im.naturalWidth)return;const f=PK.fit,p=pc(o.x,o.y),w=im.naturalWidth*f.sc,h=im.naturalHeight*f.sc;
 ctx.save();if(clipHome&&o.x===o.hx&&o.y===o.hy){ctx.beginPath();ctx.rect(0,0,W,pc(0,442).y);ctx.clip()}
 const lifted=SINK.drag&&SINK.drag.o===o&&SINK.drag.moved;
 ctx.translate(p.x,p.y-(lifted?6:0));ctx.rotate(lifted?.06:0);ctx.drawImage(im,-w/2,-h/2,w,h);ctx.restore();
}
function sinkDraw(){
 const f=PK.fit;
 for(const d of SINK.drops){const p=pc(d.x,d.y);ctx.fillStyle='rgba(120,200,255,.75)';ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,d.r*1.4,d.r*.9,0,0,7);ctx.fill();ctx.stroke()}
 SINK.foam.forEach(drawFoam);
 if(SINK.water){
  const a=pc(672,512),b=pc(672,566),t=SINK.streamT;
  ctx.save();ctx.lineCap='round';ctx.strokeStyle='rgba(110,195,255,.95)';ctx.lineWidth=14;ctx.setLineDash([16,9]);ctx.lineDashOffset=-t*220;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(a.x-3,a.y);ctx.lineTo(b.x-3,b.y);ctx.stroke();ctx.setLineDash([]);
  for(let i=0;i<2;i++){const k=((t*1.6+i*.5)%1);ctx.strokeStyle='rgba(255,255,255,'+(1-k)+')';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(b.x,b.y+6,14+34*k,4+9*k,0,0,7);ctx.stroke()}
  ctx.restore()}
 if(BRUSH_ON){drawSkItem(SINK.brushB,PIM.brushB,true);drawSkItem(SINK.brushP,PIM.brushP,true)}
 const w=PK.t*3;pdrawPoko(PK.x,PK.y,BHS.sink,{hop:Math.abs(Math.sin(w))*6,face:-1});
 if(TOWEL_ON)drawSkItem(SINK.towel,PIM.towel,false);
 if(SINK.pump>0){const p=pc(510,378),k=1-SINK.pump/.25;ctx.strokeStyle='rgba(255,255,255,'+(1-k)+')';ctx.lineWidth=6;ctx.beginPath();ctx.arc(p.x,p.y,24+36*k,0,7);ctx.stroke()}
}

/* ===== ベッド（おやすみ → くらくなる → おはよう） ===== */
const BED={t:0,said:false,pending:false},NIGHT={a:0},WAKE={on:false,t:0,said:false};
function bedUpdate(dt){
 BED.t+=dt;const t=BED.t;
 if(t>.4&&!BED.said){BED.said=true;say('バイバイ！また明日〜',2800)}
 NIGHT.a=t<2.8?0:t<4.6?.93*(t-2.8)/1.8:.93;
 if(t>7.2&&!BED.pending){BED.pending=true;WAKE.on=true;WAKE.t=0;WAKE.said=false}
}
function wakeUpdate(dt){
 if(!WAKE.on||scene!=='room')return;
 WAKE.t+=dt;NIGHT.a=Math.max(0,.93*(1-WAKE.t/1.8));
 if(!WAKE.said){WAKE.said=true;say('おはよう！',2800);PK.wave=2.8;chime()}
 if(WAKE.t>1.8){WAKE.on=false;NIGHT.a=0}
}
function nightDraw(){
 if(NIGHT.a<=0)return;
 ctx.fillStyle='rgba(8,12,42,'+NIGHT.a+')';ctx.fillRect(0,0,W,H);
 if(scene==='bed'&&NIGHT.a>.4){
  const k=Math.min(1,(NIGHT.a-.4)/.5),t=BED.t;ctx.save();ctx.globalAlpha=k;
  ctx.fillStyle='#fff6c8';ctx.shadowColor='#fff3a0';ctx.shadowBlur=40;ctx.beginPath();ctx.arc(1290,170,64,0,7);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle='#fff';for(const [x,y] of [[200,150],[420,90],[700,130],[980,70],[1120,230],[160,330],[1390,360]]){ctx.globalAlpha=k*(.6+.4*Math.sin(t*3+x));ctx.beginPath();ctx.arc(x,y,4,0,7);ctx.fill()}
  ctx.globalAlpha=k;ctx.font='72px sans-serif';ctx.textAlign='center';ctx.fillText('💤',880,260-((t*40)%60));ctx.restore()}
}
/* ===== ゲーセン：UFOキャッチャー（のりもの／たべもの） =====
   落とし口は筐体画像に含まれています。景品のイラストは VEH / FOODS の img で差し替えできます。 */
const CL_SRC={veh:"assets/claw_veh.webp",food:"assets/claw_food.webp",mach:"assets/claw_mach.webp",claw:"assets/claw_claw.webp"};
const cimg={};for(const k in CL_SRC){cimg[k]=new Image();cimg[k].src=CL_SRC[k]}
const mkImg=s=>{const i=new Image();i.src=s;return i};
const WINIMG=mkImg("assets/poko_wave.webp"),WHX=0.8699,WHY=0.4562;
const VEH=[
 {id:'bus',name:'バス',emoji:'🚌',img:mkImg("assets/vehicle_bus.webp"),ph:148},
 {id:'exc',name:'ショベルカー',emoji:'🏗️',img:mkImg("assets/vehicle_exc.webp"),ph:158},
 {id:'fire',name:'しょうぼうしゃ',emoji:'🚒',img:mkImg("assets/vehicle_fire.webp"),ph:138},
 {id:'amb',name:'きゅうきゅうしゃ',emoji:'🚑',img:mkImg("assets/vehicle_amb.webp"),ph:140}
];
const FOODS=ITEMS.filter(i=>i.id!=='bento').map(i=>({id:i.id,name:i.name,emoji:i.emoji,img:i.img,ph:i.size*1.3}));
const STICK=mkImg("assets/claw_stick.webp");
const MACH={veh:{set:VEH,label:'🚒 のりもの'},food:{set:FOODS,label:'🍎 たべもの'}};
const clawEl=document.getElementById('claw'),cc=document.getElementById('cc'),cx=cc.getContext('2d'),cscore=document.getElementById('cscore'),cbackEl=document.getElementById('cback');
const CW=1024,CH=1536,RAIL=318,SPR_OX=128,S=.9,SPW=259,SPH=275,TIPS=SPH*S,DMAX=470,XMIN=295,XMAX=735,HOMEX=512,DROPX=295,FX0=520,FX1=795,SPLIT=150;
let cl=null,clraf=0,score=0;const clKeys={l:0,r:0};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function fitClaw(){const h=Math.min(innerHeight-62,innerWidth*1.5),w=h/1.5;cc.style.width=w+'px';cc.style.height=h+'px'}
function spawnPrize(){
 const set=MACH[cl.type].set,it=set[Math.floor(Math.random()*set.length)];let x,tries=0;
 do{x=FX0+Math.random()*(FX1-FX0);tries++}while(tries<30&&cl.prizes.some(p=>Math.abs(p.x-x)<60));
 const y=1032+Math.random()*22;return{it,x,y,base:y,h:it.ph,vy:0}
}
function resetPlay(){cl.x=HOMEX;cl.dy=0;cl.st='idle';cl.t=0;cl.open=1;cl.held=null;cl.falling=[];cl.dir=0;cl.toast=null;cl.win=null}
function openClaw(){
 score=0;cscore.textContent='ゲット 0';
 cl={mode:'select',type:null,fade:0,x:HOMEX,dy:0,st:'idle',t:0,open:1,held:null,dir:0,prizes:[],falling:[],toast:null,pops:[],joy:null,last:performance.now(),clock:0};
 clawEl.classList.add('show');fitClaw();cancelAnimationFrame(clraf);clraf=requestAnimationFrame(clLoop);
}
function startMachine(type){cl.type=type;resetPlay();cl.prizes=[];for(let i=0;i<4;i++)cl.prizes.push(spawnPrize());cl.mode='tofade';cl.fade=0;chime()}
function closeClaw(){clawEl.classList.remove('show');cancelAnimationFrame(clraf);cl=null}
cbackEl.onclick=()=>{if(scene!=='game'||!cl)return;if(cl.mode==='select')applyScene('map');else{cl.mode='select';cl.fade=0;resetPlay()}};
addEventListener('resize',()=>{if(cl)fitClaw()});
function cpos(e){const r=cc.getBoundingClientRect();return{x:(e.clientX-r.left)*CW/r.width,y:(e.clientY-r.top)*CH/r.height}}
function press(){if(cl&&cl.mode==='play'&&cl.st==='idle'&&!cl.win){cl.st='down';cl.open=1}}
const joyDir=p=>{const v=clamp((p.x-341)/55,-1,1);return Math.abs(v)<.12?0:v};
cc.addEventListener('pointerdown',e=>{
 if(!cl)return;const p=cpos(e);
 if(cl.win){if(cl.win.t>.5)cl.win=null;return}
 if(cl.mode==='select'){startMachine(p.x<512?'veh':'food');return}
 if(cl.mode!=='play')return;
 if(p.x>225&&p.x<460&&p.y>1030&&p.y<1250){cl.joy=e.pointerId;try{cc.setPointerCapture(e.pointerId)}catch(_){}cl.dir=joyDir(p);return}
 if(Math.hypot(p.x-640,p.y-1150)<115)press();
});
cc.addEventListener('pointermove',e=>{if(cl&&cl.joy===e.pointerId)cl.dir=joyDir(cpos(e))});
const joyEnd=e=>{if(cl&&cl.joy===e.pointerId){cl.joy=null;cl.dir=0}};
cc.addEventListener('pointerup',joyEnd);cc.addEventListener('pointercancel',joyEnd);
addEventListener('keydown',e=>{if(!cl)return;if(e.key==='ArrowLeft')clKeys.l=1;else if(e.key==='ArrowRight')clKeys.r=1;else if(e.key===' '||e.key==='Enter'){e.preventDefault();press()}});
addEventListener('keyup',e=>{if(e.key==='ArrowLeft')clKeys.l=0;else if(e.key==='ArrowRight')clKeys.r=0});
function toast(t){cl.toast={t,until:cl.clock+1.6}}
function toward(v,to,step){return v<to?Math.min(to,v+step):Math.max(to,v-step)}
function clUpdate(dt){
 cl.clock+=dt;{const dd=cl.dir||(clKeys.r-clKeys.l);cl.tilt=(cl.tilt||0)+(dd-(cl.tilt||0))*Math.min(1,dt*16)}if(cl.win){cl.win.t+=dt;if(cl.win.t>3)cl.win=null}
 const lab=cl.mode==='select'?'← 地図にもどる':'← えらびなおす';if(cbackEl.textContent!==lab)cbackEl.textContent=lab;
 if(cl.mode==='tofade'){cl.fade+=dt/.5;if(cl.fade>=1){cl.fade=1;cl.mode='play'}}
 if(cl.mode==='select')return;
 switch(cl.st){
  case 'idle':{const d=cl.dir||(clKeys.r-clKeys.l);cl.x=clamp(cl.x+d*300*dt,XMIN,XMAX);break}
  case 'down':{cl.dy+=360*dt;const tip=RAIL+cl.dy+TIPS;
   const hit=cl.prizes.filter(p=>Math.abs(p.x-cl.x)<60&&tip>=p.y-p.h+28).sort((a,b)=>b.y-a.y)[0];
   if(hit||cl.dy>=DMAX){cl.dy=Math.min(cl.dy,DMAX);cl.target=hit||null;cl.st='close';cl.t=0}break}
  case 'close':cl.t+=dt;cl.open=Math.max(0,1-cl.t/.45);
   if(cl.t>=.45){cl.open=0;if(cl.target){cl.held=cl.target;cl.prizes.splice(cl.prizes.indexOf(cl.held),1);cl.slipAt=Math.random()<.15?.25+Math.random()*.5:null}cl.st='up'}break;
  case 'up':cl.dy-=380*dt;if(cl.dy<=0){cl.dy=0;cl.t=0;cl.sx=cl.x;cl.st=cl.held?'left':'reopen'}break;
  case 'left':cl.x=toward(cl.x,DROPX,380*dt);
   if(cl.held&&cl.slipAt!=null&&(cl.sx-cl.x)/Math.max(1,cl.sx-DROPX)>=cl.slipAt){cl.held.vy=0;cl.falling.push(cl.held);cl.held=null;toast('ポロッ！')}
   if(cl.x<=DROPX){cl.t=0;cl.st='release'}break;
  case 'release':cl.t+=dt;cl.open=Math.min(1,cl.t/.35);
   if(cl.t>=.35){if(cl.held){cl.held.vy=0;cl.held.inDrop=true;cl.falling.push(cl.held);cl.held=null}cl.st='back'}break;
  case 'reopen':cl.t+=dt;cl.open=Math.min(1,cl.t/.3);if(cl.t>=.3){cl.open=1;cl.st='idle'}break;
  case 'back':cl.open=1;cl.x=toward(cl.x,HOMEX,420*dt);if(cl.x===HOMEX)cl.st='idle';break;
 }
 if(cl.held){cl.held.x=cl.x;cl.held.y=RAIL+cl.dy+TIPS+cl.held.h*.3}
 for(const p of cl.falling.slice()){
  if(p.inDrop&&p.y>=1000){p.sh=(p.sh||0)+dt;p.vy=0;
   if(p.sh>=.3){cl.falling.splice(cl.falling.indexOf(p),1);score++;cscore.textContent='ゲット '+score;cl.win={it:p.it,t:0};chime();
    for(let k=0;k<5;k++)cl.pops.push({x:DROPX+(Math.random()-.5)*120,y:960,t:-k*.1,e:k%2?'✨':p.it.emoji});
    const ty=cl.type;setTimeout(()=>{if(cl&&cl.type===ty&&cl.prizes.length<4)cl.prizes.push(spawnPrize())},700)}
   continue}
  p.vy+=1800*dt;p.y+=p.vy*dt;
  if(!p.inDrop&&p.y>=p.base){p.y=p.base;cl.falling.splice(cl.falling.indexOf(p),1);cl.prizes.push(p)}
 }
 cl.pops=cl.pops.filter(f=>(f.t+=dt)<1.3);
}
function drawPrize(p){
 const im=p.it.img,w=im&&im.naturalWidth?p.h*im.naturalWidth/im.naturalHeight:p.h;
 cx.save();
 if(p.sh){const s=Math.max(0,1-p.sh/.3);cx.translate(p.x,p.y);cx.scale(s,s);cx.translate(-p.x,-p.y)}
 cx.fillStyle='rgba(90,40,80,.2)';cx.beginPath();cx.ellipse(p.x,p.base+4,w*.4,9,0,0,7);cx.fill();
 if(im&&im.naturalWidth)cx.drawImage(im,p.x-w/2,p.y-p.h,w,p.h);else{cx.font=p.h*.8+'px sans-serif';cx.textAlign='center';cx.fillText(p.it.emoji,p.x,p.y-p.h*.1)}
 cx.restore();
}
function drawClaw(x,dy,open){
 const rw=58*S,rh=dy+60*S;
 cx.fillStyle='#c4c9d2';cx.strokeStyle='#767c89';cx.lineWidth=3;cx.fillRect(x-rw/2,RAIL,rw,rh);cx.strokeRect(x-rw/2,RAIL,rw,rh);
 const im=cimg.claw,w=SPW,h=SPH,ang=(1-open)*.42;
 cx.save();cx.translate(x,RAIL+dy);cx.scale(S,S);cx.translate(-SPR_OX,0);
 cx.save();cx.beginPath();cx.rect(0,0,w,SPLIT);cx.rect(75,SPLIT,w-150,h-SPLIT);cx.clip();cx.drawImage(im,0,0);cx.restore();
 cx.save();cx.translate(62,SPLIT+2);cx.rotate(-ang);cx.translate(-62,-SPLIT-2);cx.beginPath();cx.rect(0,SPLIT,75,h-SPLIT);cx.clip();cx.drawImage(im,0,0);cx.restore();
 cx.save();cx.translate(w-62,SPLIT+2);cx.rotate(ang);cx.translate(-(w-62),-SPLIT-2);cx.beginPath();cx.rect(w-75,SPLIT,75,h-SPLIT);cx.clip();cx.drawImage(im,0,0);cx.restore();
 cx.restore();
}
function drawStick(){
 const px=341,py=1170,L=66,th=(cl.tilt||0)*.6,bx=px+L*Math.sin(th),by=py-L*Math.cos(th);
 cx.save();cx.lineCap='round';
 cx.strokeStyle='#2f3552';cx.lineWidth=36;cx.beginPath();cx.moveTo(px,py);cx.lineTo(bx,by);cx.stroke();
 cx.strokeStyle='#aab5d0';cx.lineWidth=26;cx.beginPath();cx.moveTo(px,py);cx.lineTo(bx,by);cx.stroke();
 cx.strokeStyle='rgba(255,255,255,.6)';cx.lineWidth=7;cx.beginPath();cx.moveTo(px-6,py);cx.lineTo(bx-6,by);cx.stroke();
 cx.restore();cx.drawImage(STICK,bx-63,by-63,126,126);
}
function chev(x,y,dir,on){cx.fillStyle=on?'#ffd23f':'rgba(255,255,255,.95)';cx.strokeStyle='#e0508f';cx.lineWidth=5;cx.beginPath();cx.moveTo(x+dir*16,y-24);cx.lineTo(x-dir*16,y);cx.lineTo(x+dir*16,y+24);cx.closePath();cx.fill();cx.stroke()}
function drawPlay(alpha){
 cx.save();cx.globalAlpha=alpha;
 const g=cx.createLinearGradient(0,340,0,1075);g.addColorStop(0,'#cfe8ff');g.addColorStop(1,'#eef7ff');cx.fillStyle=g;cx.fillRect(100,340,825,735);
 cx.drawImage(cimg.mach,0,0,CW,CH);
 cx.save();cx.beginPath();cx.rect(0,0,CW,1072);cx.clip();
 [...cl.prizes].sort((a,b)=>a.y-b.y).forEach(drawPrize);
 cx.restore();
 drawClaw(cl.x,cl.dy,cl.open);
 cx.save();cx.beginPath();cx.rect(0,0,CW,1072);cx.clip();
 if(cl.held)drawPrize(cl.held);cl.falling.forEach(drawPrize);cx.restore();
 if(cl.held){cx.strokeStyle='rgba(255,255,255,.9)';cx.lineWidth=6;cx.beginPath();cx.ellipse(DROPX,1010,110+5*Math.sin(cl.clock*8),26,0,0,7);cx.stroke()}
 drawStick();const d=cl.dir||(clKeys.r-clKeys.l);chev(228,1108,-1,d<-.12);chev(452,1108,1,d>.12);
 if(cl.st==='idle'&&cl.mode==='play'){cx.strokeStyle='rgba(255,255,255,.9)';cx.lineWidth=7;cx.beginPath();cx.arc(640,1150,102+4*Math.sin(cl.clock*6),0,7);cx.stroke()}
 cl.pops.forEach(f=>{if(f.t<0)return;cx.globalAlpha=alpha*(1-f.t/1.3);cx.font='64px sans-serif';cx.textAlign='center';cx.fillText(f.e,f.x,f.y-f.t*160)});
 cx.globalAlpha=alpha;
 if(cl.toast&&cl.clock<cl.toast.until){cx.font='900 70px "Zen Maru Gothic",sans-serif';cx.textAlign='center';cx.lineWidth=14;cx.strokeStyle='#fff';cx.strokeText(cl.toast.t,512,720);cx.fillStyle='#e0508f';cx.fillText(cl.toast.t,512,720)}
 if(cl.win){const w=cl.win,t=w.t,a=Math.max(0,Math.min(1,t/.25,(3-t)/.4));
  cx.save();cx.globalAlpha=alpha*a*.6;cx.fillStyle='#fff4fa';cx.fillRect(0,0,CW,CH);cx.globalAlpha=alpha*a;
  const pop=Math.min(1,t/.35),sc=.6+.4*(1-Math.pow(1-pop,3)),hop=Math.abs(Math.sin(t*7))*18;
  const sw=820*sc,sh=sw*WINIMG.naturalHeight/WINIMG.naturalWidth,bx=470-sw/2,by=1230-sh-hop;
  cx.drawImage(WINIMG,bx,by,sw,sh);
  const im=w.it.img;
  if(im&&im.naturalWidth){const ih=Math.min(340,w.it.ph*2.3)*sc,iw=ih*im.naturalWidth/im.naturalHeight;
   cx.save();cx.translate(bx+sw*WHX,by+sh*WHY);cx.rotate(-.12+Math.sin(t*6)*.05);cx.drawImage(im,-iw/2,-ih*.88,iw,ih);cx.restore()}
  cx.fillStyle='#fff';cx.strokeStyle='#e0508f';cx.lineWidth=8;cx.beginPath();cx.roundRect(212,170,600,210,60);cx.fill();cx.stroke();
  cx.beginPath();cx.moveTo(430,378);cx.lineTo(470,452);cx.lineTo(520,378);cx.closePath();cx.fillStyle='#fff';cx.fill();cx.stroke();
  cx.beginPath();cx.moveTo(436,372);cx.lineTo(520,372);cx.lineTo(470,380);cx.closePath();cx.fill();
  cx.fillStyle='#e0508f';cx.textAlign='center';cx.textBaseline='middle';cx.font='900 104px "Zen Maru Gothic",sans-serif';cx.fillText('とれたよ！',512,250);
  cx.font='700 44px "Zen Maru Gothic",sans-serif';cx.fillText(w.it.name+'ゲット！',512,333);cx.textBaseline='alphabetic';
  cx.font='56px sans-serif';for(let i=0;i<8;i++){cx.fillText(i%2?'✨':'🎉',110+i*115,((t*240+i*170)%1100)+60)}
  cx.restore()}
 cx.restore();
}
function pill(txt,x,y,w,fs){cx.fillStyle='rgba(255,255,255,.95)';cx.strokeStyle='#e0508f';cx.lineWidth=6;cx.beginPath();cx.roundRect(x-w/2,y-44,w,88,44);cx.fill();cx.stroke();cx.fillStyle='#e0508f';cx.font='900 '+fs+'px "Zen Maru Gothic",sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.fillText(txt,x,y+2);cx.textBaseline='alphabetic'}
function drawSelect(alpha){
 cx.save();cx.globalAlpha=alpha;
 cx.font='900 78px "Zen Maru Gothic",sans-serif';cx.textAlign='center';cx.lineWidth=16;cx.strokeStyle='#fff';cx.strokeText('どれであそぶ？',512,200);cx.fillStyle='#e0508f';cx.fillText('どれであそぶ？',512,200);
 const bob=Math.sin(cl.clock*3)*6;
 [['veh',8,bob],['food',516,-bob]].forEach(([k,x,b])=>{const y=300+b;cx.drawImage(cimg[k],x,y,500,750);pill(MACH[k].label,x+250,y+800,430,46)});
 cx.globalAlpha=alpha*(.7+.3*Math.sin(cl.clock*4));cx.fillStyle='#e0508f';cx.font='900 44px "Zen Maru Gothic",sans-serif';cx.fillText('タップしてあそぶ！',512,1300);
 cx.restore();
}
function clLoop(now){
 if(!cl)return;const dt=Math.min(.05,(now-cl.last)/1000||0);cl.last=now;
 clUpdate(dt);cx.clearRect(0,0,CW,CH);
 if(cl.mode==='select')drawSelect(1);
 else if(cl.mode==='tofade'){drawSelect(1-cl.fade);drawPlay(cl.fade)}
 else drawPlay(1);
 clraf=requestAnimationFrame(clLoop);
}
