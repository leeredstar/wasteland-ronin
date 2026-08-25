/* 添加所有缺失的游戏核心函数 */
const fs = require('fs');
const p = 'D:/wasteland-ronin/js/game.js';
let src = fs.readFileSync(p, 'utf8');

const CODE = `
/* ===== 战斗 ===== */
function gainXp(u,key,amt){
 if(u.state==='dead'||u.state==='down')return;
 if(key==='str'&&u.hunger<=0)return;
 u.xp[key]+=amt;var need=u.skills[key]*12;
 if(u.xp[key]>=need){u.xp[key]-=need;u.skills[key]++;
  if(u.faction==='player'){addText(u.x,u.y-34,SKILL_LABEL[key]+'提升! Lv'+u.skills[key],'#ffd97a');
   logC(u.name+' 的'+SKILL_LABEL[key]+'提升到 '+u.skills[key],'gold');sfx('lvl');}}}

function spawnBlood(u){for(var i=0;i<7;i++)particles.push({x:u.x,y:u.y,vx:rand(-70,70),vy:rand(-70,70),life:rand(.3,.6),maxLife:.6,color:'#a3231a',size:rand(1.5,3)});}
function sparkFx(x,y){for(var i=0;i<4;i++)particles.push({x:x,y:y,vx:rand(-110,110),vy:rand(-110,110),life:rand(.1,.22),maxLife:.22,color:'#fff2c0',size:1});}
function addCoinFx(x,y){for(var i=0;i<6;i++)particles.push({x:x,y:y,vx:rand(-40,40),vy:rand(-80,-30),life:.5,maxLife:.5,color:'#ffd97a',size:2});}
function addRing(x,y){rings.push({x:x,y:y,t:0});}
function addDecal(x,y,r){decals.push({x:x,y:y,r:r,a:1});}

function tryHit(a,d){
 a.swingT=.22;sfx('swing');
 var dodgeC=clamp(.04+(d.skills.dodge-a.skills.melee)*.012,.03,.42);
 if(Math.random()<dodgeC){addText(d.x,d.y-24,'闪避','#9fd8ff');gainXp(d,'dodge',3);gainXp(a,'melee',1);return;}
 var au=armsUsable(a);
 var dmg=Math.max(1,Math.round(a.weapon.dmg*(.75+a.skills.str*.028)*rand(.85,1.15)*(.6+.2*au))-(d.armor?d.armor.def:0));
 var pr=Math.random();
 var part=pr<.38?'chest':pr<.53?'head':pr<.68?'armR':pr<.83?'armL':pr<.915?'legL':'legR';
 d.body[part].hp-=dmg;d.lastAttacker=a;d.combatT=4;a.combatT=4;
 for(var b=0;b<7;b++)particles.push({x:d.x,y:d.y,vx:rand(-70,70),vy:rand(-70,70),life:rand(.3,.6),maxLife:.6,color:'#a3231a',size:rand(1.5,3)});
 sparkFx(d.x,d.y);addText(d.x,d.y-24,'-'+dmg+' '+PART_NAMES[part],'#ff9a80');
 gainXp(a,'melee',4);gainXp(a,'str',2);gainXp(d,'tgh',3);sfx('hit');
 if(a.faction==='player'||d.faction==='player')shakeT=Math.min(shakeT+1,5);
 if(d.body.chest.hp<=0||d.body.head.hp<=0)knockDown(a,d,part);
}

function knockDown(attacker,d,part){
 if(d.state==='down'||d.state==='dead')return;
 d.state='down';d.attackTarget=null;d.moveTarget=null;
 d.rescueChannel=0;d.rescueTarget=null;d.bandageChannel=0;d.captureChannel=0;d.fallT=0;d.poolT=0;
 addDecal(d.x,d.y,rand(10,16));dropLoot(d);
 for(var i=0;i<units.length;i++){if(units[i].attackTarget===d)units[i].attackTarget=null;}
 var how=part==='head'?'打晕':'击倒';
 if(d.faction==='player'){if(attacker)log(d.name+' 被 '+attacker.name+how+'了！快去救助','bad');else log(d.name+' 倒下了','bad');}
 else if(attacker&&attacker.faction==='player'){log(how+'了 '+d.name+'（'+(d.tierName||'')+'）','gold');sfx('coin');}
 sfx('death');
}

function die(u){
 if(u.state==='dead')return;u.state='dead';u.deadT=0;
 addDecal(u.x,u.y,rand(14,22));dropLoot(u);
 selection=selection.filter(function(x){return x!==u;});
 if(u.faction==='player')log(u.name+' 死在了荒原上……','bad');
}

function dropLoot(u){
 if(u.looted)return;u.looted=true;
 loot.push({x:u.x+rand(-8,8),y:u.y+rand(-8,8),cats:randi(u.lootMin,u.lootMax),
  food:(!u.isBeast&&Math.random()<.3)?randi(1,2):0,life:90});
}

/* ===== AI ===== */
function aiThink(u){
 if(u.state==='down'||u.state==='dead')return;
 if(u.rescueChannel>0||u.bandageChannel>0||u.captureChannel>0)return;
 if(u.faction==='slave'){
  var sla=u.lastAttacker;
  if(sla&&sla.state!=='dead'&&sla.state!=='down'&&dist(u,sla)<280){
   var sang=Math.atan2(u.y-sla.y,(u.x-sla.x)||.001);
   u.moveTarget={x:clamp(u.x+Math.cos(sang)*300,40,WORLD.w-40),y:clamp(u.y+Math.sin(sang)*300,40,WORLD.h-40)};
   u.attackTarget=null;return;}
  var master=null,md=1e9;var sq0=livingSquad();
  for(var mi=0;mi<sq0.length;mi++){var dm=dist(u,sq0[mi]);if(dm<md){md=dm;master=sq0[mi];}}
  if(master&&md>170)u.moveTarget={x:master.x+rand(-50,50),y:master.y+rand(-50,50)};
  return;}
 var t=u.attackTarget;if(t&&!validEnemyFor(u,t)){t=null;u.attackTarget=null;}
 var coward=(u.faction==='hungry'||u.faction==='beast');
 if(coward&&u.fearT<=0&&chestRatio(u)<.28){
  var src=t||u.homePoint||u;
  var ang=Math.atan2(u.y-src.y,(u.x-src.x)||.001);
  u.moveTarget={x:clamp(u.x+Math.cos(ang)*340,40,WORLD.w-40),y:clamp(u.y+Math.sin(ang)*340,40,WORLD.h-40)};
  u.attackTarget=null;u.fearT=4;return;}
 if(!t)t=findNearestHostile(u,u.aggro);
 if(t){u.attackTarget=t;u.moveTarget=null;return;}
 if(u.faction==='town'&&u.homePoint&&dist(u,u.homePoint)>340){u.moveTarget={x:u.homePoint.x,y:u.homePoint.y};return;}
 if(u.faction!=='player'){u.wanderT-=rand(.3,.5);
  if(u.wanderT<=0){u.wanderT=rand(3,8);var h=u.homePoint||u;
   u.moveTarget={x:clamp(h.x+rand(-260,260),40,WORLD.w-40),y:clamp(h.y+rand(-260,260),40,WORLD.h-40)};}}
}

/* ===== 移动 ===== */
function moveSpeedOf(u){return u.speed*(.5+.25*legsUsable(u));}
function moveToward(u,tx,ty,dt){
 var dx=tx-u.x,dy=ty-u.y;var d=Math.sqrt(dx*dx+dy*dy);if(d<.01)return;
 var step=Math.min(d,u.speed*(.5+.25*legsUsable(u))*dt);
 u.x+=dx/d*step;u.y+=dy/d*step;u.face=Math.atan2(dy,dx);u.walkT+=step/24;u.moving=true;}
function collideObstacles(u){
 for(var i=0;i<obstacles.length;i++){var o=obstacles[i];
  var dx=u.x-o.x,dy=u.y-o.y;var d=Math.sqrt(dx*dx+dy*dy);var minD=o.r+u.r-2;
  if(d<minD&&d>.01){u.x=o.x+dx/d*minD;u.y=o.y+dy/d*minD;}}
 for(var j=0;j<structures.length;j++){
  var so=structures[j];var rr=so.kind===1?13:(so.kind===3?10:7);
  var dx2=u.x-so.x,dy2=u.y-so.y;var d2=Math.sqrt(dx2*dx2+dy2*dy2);
  var minD2=rr+u.r-2;if(d2<minD2&&d2>.01){u.x=so.x+dx2/d2*minD2;u.y=so.y+dy2/d2*minD2;}}}

/* ===== 单位更新 ===== */
function wakeUp(u){u.state='idle';u.wakeGrace=1.5;u.attackTarget=null;u.moveTarget=null;
 if(u.faction==='player')log(u.name+' 苏醒了','good');addText(u.x,u.y-28,'苏醒','#cfe8a0');}

function updateUnit(u,dt){
 if(u.state==='dead'){u.deadT+=dt;return;}
 u.moving=false;u.swingT=Math.max(0,u.swingT-dt);u.flashT=Math.max(0,u.flashT-dt);
 u.wakeGrace=Math.max(0,u.wakeGrace-dt);u.fearT=Math.max(0,u.fearT-dt);u.combatT=Math.max(0,u.combatT-dt);
 if(u.faction==='player'){
  u.hunger=Math.max(0,u.hunger-dt*(100/420));
  if(u.hunger<=0){u.body.chest.hp-=dt*2;if(u.body.chest.hp<=0){knockDown(null,u,'chest');return;}}}
 if(u.rescueChannel>0){
  var rt=u.rescueTarget;
  if(!rt||rt.state!=='down'||dist(u,rt)>55){u.rescueChannel=0;u.rescueTarget=null;}
  else{u.rescueChannel-=dt;
   if(u.rescueChannel<=0){rt.body.chest.hp=Math.max(rt.body.chest.hp,rt.body.chest.max*.33);
    rt.body.head.hp=Math.max(rt.body.head.hp,rt.body.head.max*.6);
    u.rescueChannel=0;u.rescueTarget=null;log(u.name+' 救起了 '+rt.name,'good');addText(rt.x,rt.y-30,'获救','#9fe07a');}
   return;}}
 if(u.state==='down'){
  var ch=u.body.chest,hd=u.body.head;
  if(ch.hp>0){hd.hp+=dt*.9;ch.hp+=dt*.6;}else{ch.hp+=(ch.hp>-ch.max*.3?.32:-.55)*dt;hd.hp+=dt*.3;}
  if(ch.hp<=-ch.max*.6){die(u);return;}
  if(ch.hp>=ch.max*.3&&hd.hp>=hd.max*.5)wakeUp(u);
  return;}
 if(u.bandageChannel>0){
  u.bandageChannel-=dt;
  if(u.bandageChannel<=0){for(var bp=0;bp<PART_KEYS.length;bp++){var bpp=u.body[PART_KEYS[bp]];
   pp.hp=Math.min(pp.max,Math.max(pp.hp,pp.max*.7));}log(u.name+' 处理好了伤口','good');}
  return;}
 if(autoDefend&&u.faction==='player'&&!u.attackTarget&&!u.moveTarget&&u.lastAttacker){
  var la=u.lastAttacker;if(validEnemyFor(u,la)&&dist(u,la)<340)u.attackTarget=la;}
 if(u.combatT<=0){for(var rq=0;rq<PART_KEYS.length;rq++){var rpq=u.body[PART_KEYS[rq]];
  if(rpq.hp>0)rpq.hp=Math.min(rpq.max,rpq.hp+dt*.55);}}
 u.thinkT-=dt;if(u.thinkT<=0){u.thinkT=rand(.3,.5);aiThink(u);}
 var tgt=u.attackTarget;
 if(tgt&&!validEnemyFor(u,tgt)){u.attackTarget=null;tgt=null;}
 if(tgt){var dd=dist(u,tgt);var range=u.weapon.reach+u.r*u.scale+tgt.r*tgt.scale;
  if(dd<=range){u.face=Math.atan2(tgt.y-u.y,tgt.x-u.x);u.cool-=dt*(.55+.225*armsUsable(u));
   if(u.cool<=0){u.cool=1.4/u.weapon.speed;tryHit(u,tgt);}}
  else{moveToward(u,tgt.x,tgt.y,dt);}}
 else if(u.moveTarget){moveToward(u,u.moveTarget.x,u.moveTarget.y,dt);if(dist(u,u.moveTarget)<8)u.moveTarget=null;}
 collideObstacles(u);
}

/* ===== 拾取 ===== */
function pickups(dt){
 for(var i=loot.length-1;i>=0;i--){var l=loot[i];l.life-=dt;
  for(var j=0;j<units.length;j++){var u=units[j];
   if(u.faction!=='player'||isDown(u)||u.state==='dead')continue;
   if(dist(u,l)<24){res.cats+=l.cats;if(l.food)res.food+=l.food;
    log('拾取：'+l.cats+' 猫','gold');addCoinFx(l.x,l.y);sfx('coin');loot.splice(i,1);break;}}}}

/* ===== 刷怪 ===== */
function farFromTowns(x,y,m){for(var i=0;i<towns.length;i++){var t=towns[i];
 if(Math.sqrt((x-t.x)*(x-t.x)+(y-t.y)*(y-t.y))<t.r+m)return false;}return true;}

var TIERS=[
 {name:'饥饿强盗',hp:46,melee:6,dodge:6,str:7,tgh:7,aggro:200,speed:78,weapons:['fists','stick'],loot:[8,25],faction:'hungry'},
 {name:'强盗',hp:78,melee:13,dodge:11,str:13,tgh:12,aggro:240,speed:84,weapons:['stick','iron'],loot:[20,60],faction:'bandit'},
 {name:'荒原剑客',hp:118,melee:19,dodge:16,str:17,tgh:16,aggro:280,speed:90,weapons:['iron','katana'],loot:[80,160],faction:'bandit'}
];

function findSpawnPos(minDist){
 var hub=towns[0];var c=squadCentroid();
 for(var tr=0;tr<16;tr++){var ang=rand(0,TAU);var dc=rand(750,2100);
  var x=clamp(hub.x+Math.cos(ang)*dc,60,WORLD.w-60);var y=clamp(hub.y+Math.sin(ang)*dc,60,WORLD.h-60);
  if(!farFromTowns(x,y,120))continue;
  if(Math.sqrt((x-c.x)*(x-c.x)+(y-c.y)*(y-c.y))<minDist)continue;
  return{x:x,y:y};}return null;}

function spawnGroup(){
 var pos=findSpawnPos(560);if(!pos)return;
 var hub=towns[0];var dh=Math.sqrt((pos.x-hub.x)*(pos.x-hub.x)+(pos.y-hub.y)*(pos.y-hub.y));
 var ti=(dh>1800&&Math.random()<.45)?2:(dh>950?1:0);
 var tier=TIERS[ti];var n=randi(2,4);
 for(var i=0;i<n;i++)units.push(makeUnit({faction:tier.faction,x:pos.x+rand(-40,40),y:pos.y+rand(-40,40),
  maxHp:tier.hp,speed:tier.speed,aggro:tier.aggro,
  weapon:{key:'w',name:'武器',dmg:10,reach:30,speed:.9,power:1},
  tierName:tier.name,lootMin:tier.loot[0],lootMax:tier.loot[1],
  bodyColor:FC[tier.faction],homePoint:{x:pos.x,y:pos.y},
  skills:{str:tier.str,tgh:tier.tgh,dodge:tier.dodge,melee:tier.melee}});
 }
}
function spawnBeastPack(){
 var pos=findSpawnPos(620);if(!pos)return;
 var n=randi(2,3);
 for(var i=0;i<n;i++)units.push(makeUnit({faction:'beast',isBeast:true,name:pick(BEAST_NAMES),
  x:pos.x+rand(-36,36),y:pos.y+rand(-36,36),maxHp:44,speed:118,aggro:290,
  weapon:{key:'bite',name:'獠牙',dmg:8,reach:24,speed:1.25,power:0},tierName:'荒原狼',
  lootMin:5,lootMax:16,bodyColor:'#8a8a92',
  homePoint:{x:pos.x,y:pos.y},skills:{str:10,tgh:8,dodge:12,melee:10}}));}
function spawnGuards(){
 for(var t=0;t<towns.length;t++){var town=towns[t];
  for(var i=0;i<3;i++)units.push(makeUnit({faction:'town',name:randName(),
   x:town.x+rand(-90,90),y:town.y+rand(-90,90),maxHp:130,speed:86,aggro:260,
   tierName:'城镇卫兵',bodyColor:'#3f7d52',homePoint:{x:town.x,y:town.y},
   skills:{str:16,tgh:15,dodge:14,melee:18}}));}}

function genDecor(){decor=[];for(var i=0;i<500;i++){
 var x=rand(40,WORLD.w-40),y=rand(40,WORLD.h-40);if(!farFromTowns(x,y,70))continue;
 decor.push({type:Math.random()<.5?'rock':'grass',x:x,y:y,s:rand(.7,1.5),rot:rand(0,TAU)});}}
function genTownBuildings(){for(var t=0;t<towns.length;t++){var town=towns[t];town.buildings=[];
 for(var i=0;i<6;i++){var ang=i/6*TAU+.35;var rr=town.r*rand(.45,.72);
  town.buildings.push({x:town.x+Math.cos(ang)*rr,y:town.y+Math.sin(ang)*rr,w:rand(48,72),h:rand(38,54)});}}}
function buildObstacles(){obstacles=[];
 for(var t=0;t<towns.length;t++){var bs=towns[t].buildings||[];
  for(var i=0;i<bs.length;i++)obstacles.push({x:bs[i].x,y:bs[i].y,r:Math.max(bs[i].w,bs[i].h)*.45});
  obstacles.push({x:towns[t].x,y:towns[t].y,r:16});}}
function initMotes(){motes=[];for(var i=0;i<34;i++)motes.push({x:cam.x+rand(-800,800),y:cam.y+rand(-500,500),vx:rand(-6,16),vy:rand(-3,3),size:rand(.8,2),a:rand(.08,.22)});}

/* ===== 输入处理 ===== */
function screenToWorld(mx,my){return{x:cam.x+(mx-W/2)/zoom,y:cam.y+(my-H/2)/zoom};}
function clampCam(){var hw=W/(2*zoom),hh=H/(2*zoom);
 if(hw*2<WORLD.w)cam.x=clamp(cam.x,hw,WORLD.w-hw);if(hh*2<WORLD.h)cam.y=clamp(cam.y,hh,WORLD.h-hh);}

function issueCommand(wx,wy){
 if(!started||gameOver)return;
 var acters=[];for(var i=0;i<selection.length;i++)if(canAct(selection[i]))acters.push(selection[i]);
 if(!acters.length){selection=livingSquad();for(var a2=0;a2<selection.length;a2++)if(canAct(selection[a2]))acters.push(selection[a2]);}
 if(!acters.length)return;
 var enemy=null,bd=26;
 for(var i2=0;i2<units.length;i2++){var u=units[i2];
  if(u.faction==='player'||u.faction==='town')continue;if(u.state==='dead')continue;
  var d2=Math.sqrt((u.x-wx)*(u.x-wx)+(u.y-wy)*(u.y-wy));if(d2<bd){bd=d2;enemy=u;}}
 if(enemy){for(var a=0;a<acters.length;a++){acters[a].attackTarget=enemy;acters[a].moveTarget=null;}
  addRing(enemy.x,enemy.y);}
 else{for(var k=0;k<acters.length;k++){var off=[[0,0],[38,8],[-38,8],[0,-40],[40,-46]][k%6];
  acters[k].attackTarget=null;acters[k].moveTarget={x:clamp(wx+off[0],20,WORLD.w-20),y:clamp(wy+off[1],20,WORLD.h-20)};}
  addRing(wx,wy);}
}

/* ===== 交互 ===== */
function tryEat(){
 for(var i=0;i<selection.length;i++){var u=selection[i];
  if(u.faction!=='player'||u.state==='dead'||u.state==='down')continue;
  if(res.food<=0){log('没有干粮了！','bad');return;}
  res.food--;u.hunger=Math.min(100,u.hunger+45);return;}
 log('先选择一个队员','sys');}
function tryRescue(){
 for(var i=0;i<selection.length;i++){var u=selection[i];
  if(u.faction!=='player'||u.state!=='idle')continue;
  for(var j=0;j<units.length;j++){var t=units[j];
   if(t.faction==='player'&&t.state==='down'&&dist(u,t)<46){
    u.rescueChannel=2.5;u.rescueTarget=t;log(u.name+' 正在救助……','sys');return;}}}
 log('附近没有倒地的队友','sys');}
function tryBandage(){
 if(res.bandage<=0){log('没有绷带了！','bad');return;}
 for(var i=0;i<selection.length;i++){var u=selection[i];
  if(u.faction!=='player'||u.state!=='idle')continue;
  res.bandage--;u.bandageChannel=2;log(u.name+' 开始包扎……','sys');return;}
 log('先选择队员','sys');}
function tryCamp(){
 if(res.kits<=0){log('没有营地套装！','bad');return;}
 var c=squadCentroid();res.kits--;camps.push({x:c.x,y:c.y});
 log('营地搭建完成！','good');sfx('heal');}
function trySleep(){
 for(var i=0;i<camps.length;i++){var sq=livingSquad();
  for(var j=0;j<sq.length;j++){if(dist(sq[j],camps[i])<180){sleeping=true;sleepT=0;
   elSleepOv.classList.remove('hidden');return;}}}
 log('需要在营地篝火旁才能睡觉','sys');}
function finishSleep(){
 sleeping=false;elSleepOv.classList.add('hidden');day++;tod=.30;
 var sq=livingSquad();for(var si=0;si<sq.length;si++){var su=sq[si];if(su.state==='down')continue;
  for(var pk in su.body){su.body[pk].hp=Math.min(su.body[pk].max,su.body[pk].hp+su.body[pk].max*.45);}
  su.hunger=Math.max(5,su.hunger-18);}
 log('睡了个好觉。第 '+day+' 天开始了。','good');}

/* ===== 商店 ===== */
function openShop(town){shopOpen=true;shopTown=town;renderShop();}
function closeShop(){shopOpen=false;}
function renderShop(){
 var repIdx=towns.indexOf(shopTown);var rp=repIdx>=0?res.rep[repIdx]:0;
 elShopInfo.textContent='资金:'+res.cats+' | 声望 '+rp;
 var html='';
 var stock=[['food','干粮 ×1',25],['bandage','绷带 ×2',45],['campkit','营地套装',80],['mats','建材 ×5',100],
  ['iron','铁刀',180],['leather','皮甲',130],['chain','锁子甲',430],['hire','招募同伴',250]];
 for(var i=0;i<stock.length;i++){
  var can=res.cats>=stock[i][2];
  html+='<div class="shop-item"><span>'+stock[i][1]+'</span><button onclick="void(0)" data-cost="'+stock[i][2]+'" data-id="'+stock[i][0]+'"'+(can?'':' disabled')+'>'+stock[i][2]+'猫</button></div>';}
 elShopItems.innerHTML=html;
}

/* ===== 相机 ===== */
function updateCamera(dt){
 var spd=540*dt/zoom,dx=0,dy=0;
 if(keys.KeyW||keys.ArrowUp)dy-=spd;if(keys.KeyS||keys.ArrowDown)dy+=spd;
 if(keys.KeyA||keys.ArrowLeft)dx-=spd;if(keys.KeyD||keys.ArrowRight)dx+=spd;
 if(dx||dy){cam.x+=dx;cam.y+=dy;camFollow=false;}
 else if(camFollow){var sq=livingSquad();if(sq.length){
  var cx=0,cy=0;for(var i=0;i<sq.length;i++){cx+=sq[i].x;cy+=sq[i].y;}
  cam.x=lerp(cam.x,cx/sq.length,Math.min(1,dt*3));cam.y=lerp(cam.y,cy/sq.length,Math.min(1,dt*3));}}
 var hw=W/(2*zoom),hh=H/(2*zoom);
 cam.x=clamp(cam.x,hw,WORLD.w-hw);cam.y=clamp(cam.y,hh,WORLD.h-hh);
}
`;

src = src.replace('console.log(\'game.js systems loaded\');\n})();\n',
  CODE + '\nconsole.log(\'game.js systems loaded\');\n})();\n');
fs.writeFileSync(p, src, 'utf8');
console.log('added ' + edits + ' edits + game functions');
