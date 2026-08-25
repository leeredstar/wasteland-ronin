/* 追加渲染、输入和游戏循环到 game.js */
const fs = require('fs');
const p = 'D:/wasteland-ronin/js/game.js';

const CODE = `
/* ===== 渲染 ===== */
var canvas=document.getElementById('game');
var ctx=canvas.getContext('2d');
var W=0,H=0,DPR=1;
function resize(){
 W=window.innerWidth;H=window.innerHeight;DPR=Math.min(window.devicePixelRatio||1,2);
 canvas.width=W*DPR;canvas.height=H*DPR;
 canvas.style.width=W+'px';canvas.style.height=H+'px';
}
resize();window.addEventListener('resize',resize);

/* 输入 */
var keys={},mouse={x:0,y:0};
canvas.addEventListener('mousedown',function(e){
 if(!started||gameOver)return;
 var wp={x:cam.x+(e.clientX-W/2)/zoom,y:cam.y+(e.clientY-H/2)/zoom};
 if(e.button===0){
  var best=null,bd=22;
  for(var i=0;i<livingSquad().length;i++){
   var dd=dist(livingSquad()[i],wp);if(dd<bd){bd=dd;best=livingSquad()[i];}}
  if(best)selection=[best];
 }else if(e.button===2){
  var enemy=null,bd=26;
  for(var i=0;i<units.length;i++){var u=units[i];
   if(u.faction==='player'||u.state==='dead')continue;
   var d=dist(u,wp);if(d<bd){bd=d;enemy=u;}}
  if(enemy){for(var i=0;i<selection.length;i++)if(canAct(selection[i])){selection[i].attackTarget=enemy;}}
 }
});
window.addEventListener('mouseup',function(e){mouse.dragStart=null;mouse.dragging=false;});

/* ===== 主循环 ===== */
var last=0,fpsFrames=0,fpsLastT=0;
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

fs.appendFileSync(p, '\n' + CODE + '\n', 'utf8');
console.log('rendering/input/loop appended');
