/* 追加游戏循环和渲染到 game.js */
const fs = require('fs');
const p = 'D:/wasteland-ronin/js/game.js';
let src = fs.readFileSync(p, 'utf8');

// 检查是否已有渲染函数
if (src.includes('function drawUnits')) { console.log('already has rendering'); process.exit(0); }

const CODE = `
/* ===== 渲染 ===== */
var canvas=document.getElementById('game');
var ctx=canvas.getContext('2d');
var mmC=document.getElementById('minimap'),mmX=mmC.getContext('2d');
var W=0,H=0,DPR=1;
function resize(){
 W=window.innerWidth;H=window.innerHeight;DPR=Math.min(window.devicePixelRatio||1,2);
 canvas.width=W*DPR;canvas.height=H*DPR;
 canvas.style.width=W+'px';canvas.style.height=H+'px';
}
resize();window.addEventListener('resize',resize);
function clampCam(){var hw=W/(2*zoom),hh=H/(2*zoom);cam.x=clamp(cam.x,hw,WORLD.w-hw);cam.y=clamp(cam.y,hh,WORLD.h-hh);}
function screenToWorld(mx,my){return{x:cam.x+(mx-W/2)/zoom,y:cam.y+(my-H/2)/zoom};}

/* ===== 输入 ===== */
var keys={},mouse={x:0,y:0,dragStart:null,dragging:false};
window.addEventListener('keydown',function(e){
 keys[e.code]=true;if(!started)return;
 if(e.code==='Tab'){e.preventDefault();selection=livingSquad().slice();}
 else if(e.code==='KeyF')tryEat();
 else if(e.code==='KeyR')tryRescue();
 else if(e.code==='KeyC')tryBandage();
 else if(e.code==='KeyV')tryCamp();
 else if(e.code==='KeyZ')trySleep();
});
window.addEventListener('keyup',function(e){keys[e.code]=false;});
window.addEventListener('blur',function(){keys={};});
canvas.addEventListener('mousedown',function(e){
 if(!started||gameOver)return;
 var wp=screenToWorld(e.clientX,e.clientY);
 if(e.button===0){mouse.dragStart={x:e.clientX,y:e.clientY};mouse.dragging=true;}
 else if(e.button===2)issueCommand(wp.x,wp.y);
});
window.addEventListener('mouseup',function(e){
 if(e.button!==0||!mouse.dragging)return;mouse.dragging=false;
 if(!mouse.dragStart||!started||gameOver){mouse.dragStart=null;return;}
 var dx=e.clientX-mouse.dragStart.x,dy=e.clientY-mouse.dragStart.y;
 var wp=screenToWorld(e.clientX,e.clientY);
 if(dx*dx+dy*dy>64){
  var w0=screenToWorld(mouse.dragStart.x,mouse.dragStart.y);
  var minX=Math.min(w0.x,wp.x),maxX=Math.max(w0.x,wp.x);
  var minY=Math.min(w0.y,wp.y),maxY=Math.max(w0.y,wp.y);
  var picked=[];
  for(var i=0;i<units.length;i++){var u=units[i];
   if(u.faction==='player'&&u.state!=='dead'&&u.x>=minX&&u.x<=maxX&&u.y>=minY&&u.y<=maxY)picked.push(u);}
  if(picked.length)selection=picked;
 }else{
  var best=null,bd=22;
  for(var j=0;j<units.length;j++){var u2=units[j];
   if(u2.faction!=='player'||u2.state==='dead')continue;
   var d=dist(u2,wp);if(d<bd){bd=d;best=u2;}}
  if(best){if(e.shiftKey){var idx=selection.indexOf(best);if(idx>=0)selection.splice(idx,1);else selection.push(best);}else selection=[best];}
 }
 mouse.dragStart=null;
});

function issueCommand(wx,wy){
 var acters=[];
 for(var i=0;i<selection.length;i++)if(canAct(selection[i]))acters.push(selection[i]);
 if(!acters.length)return;
 var enemy=null,bd=26;
 for(var i=0;i<units.length;i++){var u=units[i];
  if(u.faction==='player'||u.faction==='town'||u.state==='dead')continue;
  var d=Math.sqrt((u.x-wx)*(u.x-wx)+(u.y-wy)*(u.y-wy));if(d<bd){bd=d;enemy=u;}}
 if(enemy){for(var a=0;a<acters.length;a++){acters[a].attackTarget=enemy;acters[a].moveTarget=null;}return;}
 for(var k=0;k<acters.length;k++){
  acters[k].attackTarget=null;
  acters[k].moveTarget={x:wx,y:wy};}
}

/* ===== 交互 ===== */
function tryEat(){
 for(var i=0;i<selection.length;i++){var u=selection[i];
  if(u.faction!=='player'||isDown(u)||u.state==='dead')continue;
  if(res.food<=0){log('没有干粮了！','bad');return;}
  res.food--;u.hunger=Math.min(100,u.hunger+45);return;}
}
function tryRescue(){
 for(var i=0;i<selection.length;i++){var u=selection[i];
  if(u.faction!=='player'||u.state!=='idle')continue;
  for(var j=0;j<units.length;j++){var t=units[j];
   if(t.faction==='player'&&t.state==='down'&&dist(u,t)<46){
    u.rescueChannel=2.5;u.rescueTarget=t;return;}}}
}

/* ===== 更新循环 ===== */
var last=0,fpsFrames=0,fpsLastT=0;
var elFpsEl=document.getElementById('fpsMeter');
function frame(now){
 var dt=Math.min((now-last)/1000,.05);last=now;
 fpsFrames++;
 var elF=document.getElementById('fpsMeter');
 if(elF&&now-fpsLastT>=500){elF.textContent=(fpsFrames*1000/(now-fpsLastT)).toFixed(0)+' FPS';fpsFrames=0;fpsLastT=now;}
 update(dt);
 render();
 requestAnimationFrame(frame);
}
`;

src += CODE;
fs.writeFileSync(p, src, 'utf8');
console.log('rendering + input + loop appended. Total lines:', src.split('\n').length);
