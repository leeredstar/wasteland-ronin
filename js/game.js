/* ============================================================
 * 荒原浪人 Wasteland Ronin v0.2 「血肉篇」
 * Kenshi 风格开放沙盒：无任务 · 小队混战 · 部位伤害 · 技能越用越强
 * ============================================================ */
(function () {
'use strict';

/* ---------------- 工具函数 ---------------- */
var TAU = Math.PI * 2;
function rand(a, b) { return a + Math.random() * (b - a); }
function randi(a, b) { return Math.floor(rand(a, b + 1)); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ---------------- 基础配置 ---------------- */
/* M5/T125: 世界扩容 8000×8000；城镇坐标由 src/world/Terrain.js 数据驱动 */
var TERRAIN_MOD = (typeof WR !== 'undefined' && WR.Terrain) ? WR.Terrain : null;
var WORLD = TERRAIN_MOD
  ? { w: TERRAIN_MOD.WORLD_SIZE.w, h: TERRAIN_MOD.WORLD_SIZE.h }
  : { w: 8000, h: 8000 };
var DAY_LEN = 150;

var WEAPONS = {
  fists:  { key: 'fists',  name: '拳头',   dmg: 6,  reach: 26, speed: 1.05, power: 0 },
  stick:  { key: 'stick',  name: '木棍',   dmg: 9,  reach: 32, speed: 0.95, power: 1 },
  iron:   { key: 'iron',   name: '铁刀',   dmg: 14, reach: 34, speed: 0.85, power: 2 },
  spear:  { key: 'spear',  name: '长枪',   dmg: 12, reach: 50, speed: 0.80, power: 2 },
  mace:   { key: 'mace',   name: '战锤',   dmg: 18, reach: 30, speed: 0.62, power: 2 },
  katana: { key: 'katana', name: '野太刀', dmg: 22, reach: 40, speed: 0.72, power: 3 },
  bite:   { key: 'bite',   name: '獠牙',   dmg: 8,  reach: 24, speed: 1.25, power: 0 }
};

var ARMORS = {
  leather: { key: 'leather', name: '破旧皮甲', def: 2 },
  chain:   { key: 'chain',   name: '锁子甲',   def: 4 }
};

var SKILL_LABEL = { str: '力量', tgh: '韧性', dodge: '闪避', melee: '近战' };
var PART_NAMES = { head: '头', chest: '胸', armL: '左臂', armR: '右臂', legL: '左腿', legR: '右腿' };
var PART_KEYS = ['head', 'chest', 'armL', 'armR', 'legL', 'legR'];

var FACTION_COLOR = {
  player: '#4e6ea8',
  bandit: '#9a4436',
  hungry: '#8a7a52',
  town:   '#3f7d52',
  beast:  '#8a8a92'
};

var SYL = ['卡', '鲁', '汉', '比', '尤', '桑', '雷', '诺', '基', '乌', '多', '沙', '格', '米'];
var SUF = ['什', '尔', '斯', '克', '德', '特', '恩', '夫'];
function randName() {
  var n = pick(SYL) + pick(SYL);
  if (Math.random() < 0.6) n += pick(SUF);
  return n;
}
var BEAST_NAMES = ['灰牙', '夜嚎', '快爪', '荒脊', '白斑', '断耳'];

/* ---------------- 城镇（T125：随世界扩容重定位，数据源 Terrain.js） ---------------- */
var towns = TERRAIN_MOD
  ? TERRAIN_MOD.TOWNS.map(function (t) { return { name: t.name, x: t.x, y: t.y, r: t.r }; })
  : [
    { name: '枢纽镇', x: 2200, y: 4200, r: 300 },
    { name: '世界之角', x: 6200, y: 3000, r: 300 }
  ];

/* ---------------- 全局状态 ---------------- */
var canvas = document.getElementById('game');
var ctx = canvas.getContext('2d');
var mmCanvas = document.getElementById('minimap');
var mmCtx = mmCanvas.getContext('2d');
var bodyCanvas = document.getElementById('bodyCanvas');
var bctx = bodyCanvas.getContext('2d');

var W = 0, H = 0, DPR = 1;
var cam = { x: towns[0].x + 200, y: towns[0].y };
var camFollow = true;
var shakeT = 0;
var zoom = 1.15;

var units = [];
var loot = [];
var particles = [];
var texts = [];
var decals = [];
var rings = [];
var decor = [];
var motes = [];
var obstacles = [];

var selection = [];
var R3D_active = false; // 3D 渲染模式开关（由 js/ronin3d.js 消费）
var res = { cats: 120, food: 2, bandage: 2, kits: 1, mats: 2, rep: [0, 0] };
var autoDefend = true;

var started = false;
var gameOver = false;
var helpOpen = false;
var shopOpen = false;
var shopTown = null;
var muted = false;

var tod = 0.3;
var day = 1;
var gameTime = 0;
var spawnTimer = 8;
var beastTimer = 14;
var unitSeq = 0;
var viewRect = { x: 0, y: 0, w: 100, h: 100 };
var vignetteGrad = null;

var keys = {};
var mouse = { x: 0, y: 0, dragStart: null, dragging: false };
var townHintCool = {};

/* v0.3 荒原家园：营地 / 建造 / 俘虏 */
var camps = [];
var structures = [];
var buildMode = 0; /* 0关闭 1围墙 2篝火 */
var sleeping = false, sleepT = 0;
var tutorial = 0;
var lastShakeX = 0, lastShakeY = 0;
var flameAcc = 0;
var townAngryUntil = 0;

/* M5 世界扩展状态（T126-T131） */
var terrain = null;               /* Terrain.js 实例：群系/装饰/道路/废墟 */
var terrainChunks = new Map();    /* T129 底色分块缓存 key -> canvas */
var terrainPaintCount = 0;        /* 本帧已绘制的块数（预算控制） */
var ruinHintCool = 0;             /* 废墟提示节流 */

/* T132-T139: 游商/塔楼/情报/拾荒通道/商队/危险边缘 */
var scavChan = null;              /* 拾蓄进度 {u,ruin,t,dur} */
var intelPing = null;             /* 情报标记 {x,y,until} */
var banditAnchors = [];           /* 匪帮出没锚点（spawnGroup 时记录） */
var caravan = null;               /* 当前商队 {members:[],attacked,fromName,toName} */
var caravanTimer = 28;            /* 首队 28s 后出发（冒烟可见） */
var caravansSpawned = 0;
var caravanSide = 0;
var dangerLogCool = 0;

/* T140-T145: 狼巢 / 地标 / 大地图 / 出生点 */
var dens = [];                    /* 运行时狼巢状态 {x,y,threatened,coolUntil} */
var beastTimerDensOnly = 0;
var discovered = {};              /* 地标首访标记 id -> true (T142) */
var landmarkCheckCool = 0;
var mapOpen = false;              /* T144 M 键大地图 */
var bigMapCanvas = null, bigMapSize = 0;
var spawnKindUsed = 'near';       /* T145 */

/* ---------------- DOM 引用 ---------------- */
var $ = function (id) { return document.getElementById(id); };
var elCats = $('resCats'), elFood = $('resFood'), elBandage = $('resBandage');
var elDay = $('resDay'), elClock = $('resClock');
var elPanel = $('selPanel'), elName = $('selName'), elTier = $('selTier');
var elHp = $('selHp'), elHead = $('selHead'), elHunger = $('selHunger');
var elSkStr = $('skStr'), elSkTgh = $('skTgh'), elSkDodge = $('skDodge'), elSkMelee = $('skMelee');
var elEqWeapon = $('eqWeapon'), elEqArmor = $('eqArmor');
var elStatus = $('selStatus');
var elLog = $('log');
var elHintEl = $('hint');
var elSleepOv = $('sleepOverlay');
var elKits = $('resKits'), elMats = $('resMats');
var elFps = $('fpsMeter');
var elShop = $('shopPanel'), elShopTitle = $('shopTitle'), elShopInfo = $('shopInfo'), elShopItems = $('shopItems');
var elHelp = $('helpOverlay'), elStart = $('startOverlay'), elOver = $('overOverlay'), elOverDays = $('overDays');
var elSquadBar = $('squadBar');
var elTooltip = $('tooltip');

/* ---------------- 音效（WebAudio 合成） ---------------- */
var audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function tone(freq, dur, type, vol, slide) {
  if (muted || !audioCtx) return;
  try {
    var o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), audioCtx.currentTime + dur);
    g.gain.value = vol || 0.07;
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) {}
}
function sfx(kind) {
  switch (kind) {
    case 'hit':   tone(120, 0.09, 'square', 0.08, -60); break;
    case 'swing': tone(320, 0.05, 'sawtooth', 0.02, -160); break;
    case 'coin':  tone(880, 0.07, 'sine', 0.06); setTimeout(function () { tone(1320, 0.09, 'sine', 0.05); }, 60); break;
    case 'lvl':   tone(520, 0.09, 'triangle', 0.07); setTimeout(function () { tone(660, 0.09, 'triangle', 0.07); }, 80); setTimeout(function () { tone(880, 0.13, 'triangle', 0.07); }, 160); break;
    case 'death': tone(200, 0.35, 'sawtooth', 0.08, -150); break;
    case 'eat':   tone(240, 0.12, 'triangle', 0.06, 60); break;
    case 'heal':  tone(440, 0.16, 'sine', 0.06, 120); break;
    case 'ui':    tone(600, 0.05, 'sine', 0.04); break;
    case 'howl':  tone(420, 0.5, 'sawtooth', 0.04, -140); break;
  }
}

/* ---------------- 日志与特效 ---------------- */
function log(msg, cls) {
  var li = document.createElement('li');
  if (cls) li.className = cls;
  li.textContent = msg;
  elLog.insertBefore(li, elLog.firstChild);
  while (elLog.children.length > 9) elLog.removeChild(elLog.lastChild);
}
function addText(x, y, str, color) {
  texts.push({ x: x, y: y, str: str, color: color || '#fff', t: 0, life: 1.3 });
  if (texts.length > 70) texts.shift();
}
function addRing(x, y) { rings.push({ x: x, y: y, t: 0 }); }
function addDecal(x, y, r) {
  decals.push({ x: x, y: y, r: r, a: 1 });
  if (decals.length > FXC.DECAL_CAP) decals.shift();
}
function spawnBlood(u) {
  for (var i = 0; i < FXC.BLOOD_N; i++) {
    particles.push({
      x: u.x, y: u.y,
      vx: rand(-70, 70), vy: rand(-70, 70),
      life: rand(0.3, 0.6), maxLife: 0.6,
      color: '#a3231a', size: rand(1.5, 3)
    });
  }
  if (particles.length > FXC.PARTICLE_HARD_CAP) particles.splice(0, particles.length - FXC.PARTICLE_HARD_CAP);
}
function sparkFx(x, y) {
  for (var i = 0; i < FXC.SPARK_N; i++) {
    particles.push({
      x: x, y: y,
      vx: rand(-110, 110), vy: rand(-110, 110),
      life: rand(0.1, 0.22), maxLife: 0.22,
      color: '#fff2c0', size: rand(1, 2)
    });
  }
}
function addCoinFx(x, y) {
  for (var i = 0; i < FXC.COIN_N; i++) {
    particles.push({
      x: x, y: y,
      vx: rand(-40, 40), vy: rand(-80, -30),
      life: rand(0.4, 0.7), maxLife: 0.7,
      color: '#ffd97a', size: rand(1.5, 2.5)
    });
  }
}

/* ---------------- 身体部位 ---------------- */
function makeBody(c) {
  return {
    head: { hp: Math.round(c * 0.40), max: Math.round(c * 0.40) },
    chest: { hp: Math.round(c * 0.62), max: Math.round(c * 0.62) },
    armL: { hp: Math.round(c * 0.34), max: Math.round(c * 0.34) },
    armR: { hp: Math.round(c * 0.34), max: Math.round(c * 0.34) },
    legL: { hp: Math.round(c * 0.38), max: Math.round(c * 0.38) },
    legR: { hp: Math.round(c * 0.38), max: Math.round(c * 0.38) }
  };
}
function partRatio(p) { return p.hp / p.max; }
function chestRatio(u) { return clamp(u.body.chest.hp / u.body.chest.max, -1, 1); }
function armsUsable(u) { return (u.body.armL.hp > 0 ? 1 : 0) + (u.body.armR.hp > 0 ? 1 : 0); }
function legsUsable(u) { return (u.body.legL.hp > 0 ? 1 : 0) + (u.body.legR.hp > 0 ? 1 : 0); }
function moveSpeedOf(u) { return u.speed * (0.5 + 0.25 * legsUsable(u)); }

/* ---------------- 单位工厂 ---------------- */
function makeUnit(opts) {
  var c = (opts && opts.maxHp) || 60;
  var u = {
    id: ++unitSeq,
    name: (opts && opts.name) || randName(),
    faction: 'bandit',
    x: 0, y: 0, r: 11,
    scale: 1,
    speed: 82,
    face: rand(0, TAU),
    body: makeBody(c),
    hunger: 100,
    state: 'idle',
    moving: false,
    walkT: 0,
    fallT: 0,
    poolT: 0,
    stepAcc: 0,
    moveTarget: null,
    attackTarget: null,
    cool: rand(0, 0.4),
    swingT: 0,
    flashT: 0,
    combatT: 0,
    wakeGrace: 0,
    fearT: 0,
    wanderT: rand(0, 4),
    thinkT: rand(0, 0.4),
    rescueChannel: 0, rescueTarget: null,
    bandageChannel: 0,
    captureChannel: 0, captureTarget: null,
    limbState: {},
    looted: false, deadT: 0,
    hungWarned: false,
    lastAttacker: null,
    skills: { str: 8, tgh: 8, dodge: 8, melee: 8 },
    xp: { str: 0, tgh: 0, dodge: 0, melee: 0 },
    weapon: WEAPONS.stick,
    armor: null,
    aggro: 230,
    homePoint: null,
    tierName: '',
    lootMin: 8, lootMax: 25,
    isBeast: false,
    bodyColor: FACTION_COLOR.bandit,
    headColor: '#d9b48a',
    hairColor: '#2a201a'
  };
  if (opts) for (var k in opts) u[k] = opts[k];
  return u;
}

function isDown(u) { return u.state === 'down'; }

/* 敌对关系：玩家 vs 所有敌人；卫兵 vs 匪徒和狼；狼敌视一切 */
/* 敌对矩阵已数据化：src/data/factions.js（T037）。
 * 动态规则：袭击卫兵后 townAngryUntil 之前，卫兵与玩家翻脸。 */
var Factions = WR.Factions;
function hostile(a, b) {
  if (a.faction === b.faction) return false;
  var k = Factions.pairKey(a.faction, b.faction);
  if (Factions.FRIENDLY.has(k)) return false;
  if (k === 'player|town') return gameTime < townAngryUntil;
  return true;
}

function validEnemyFor(a, b) {
  if (!b || b === a) return false;
  if (b.state === 'dead' || isDown(b) || b.wakeGrace > 0) return false;
  return hostile(a, b);
}

function findNearestHostile(u, range) {
  var best = null, bd = range;
  for (var i = 0; i < units.length; i++) {
    var o = units[i];
    if (!validEnemyFor(u, o)) continue;
    var d = dist(u, o);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

/* ---------------- 经验 / 技能 ---------------- */
function gainXp(u, key, amt) {
  if (u.state === 'dead' || isDown(u)) return;
  if (key === 'str' && u.hunger <= 0) return;
  u.xp[key] += amt;
  var need = u.skills[key] * 12;
  if (u.xp[key] >= need) {
    u.xp[key] -= need;
    u.skills[key]++;
    if (u.faction === 'player') {
      addText(u.x, u.y - 34, SKILL_LABEL[key] + '提升! Lv' + u.skills[key], '#ffd97a');
      log(u.name + ' 的' + SKILL_LABEL[key] + '提升到 ' + u.skills[key], 'gold');
      sfx('lvl');
    }
  }
}

/* ---------------- 战斗 ---------------- */
function pickPart() {
  var r = Math.random();
  if (r < 0.38) return 'chest';
  if (r < 0.53) return 'head';
  if (r < 0.68) return 'armR';
  if (r < 0.83) return 'armL';
  if (r < 0.915) return 'legL';
  return 'legR';
}

/* ---- 战斗系统已迁移至 src/systems/Combat.js（T020）----
 * 本文件仅保留注入端口与薄包装；公式/常量见 Combat.BALANCE */
var CombatSys = WR.Combat;
var BAL = CombatSys.BALANCE;
CombatSys.attach({
  rng: function () { return WR.App.rng; },
  out: {
    log: log,
    text: addText,
    decal: addDecal,
    blood: spawnBlood,
    spark: sparkFx,
    sfx: sfx,
    shake: function (amt, max) { shakeT = Math.min(shakeT + amt, max); },
    gainXp: gainXp,
    dropLoot: dropLoot,
    clearTargetsOf: function (u) {
      for (var i = 0; i < units.length; i++) {
        if (units[i].attackTarget === u) units[i].attackTarget = null;
      }
    },
    removeFromSelection: function (u) {
      selection = selection.filter(function (x) { return x !== u; });
    },
    dustBurst: function (x, y) {
      for (var dp = 0; dp < BAL.KNOCKDOWN_DUST; dp++) {
        particles.push({
          x: x + rand(-8, 8), y: y + rand(-4, 6),
          vx: rand(-30, 30), vy: rand(-30, 10),
          life: rand(0.3, 0.55), maxLife: 0.55,
          color: '#cbb88f', size: rand(1.5, 3)
        });
      }
    },
    hurtTownRep: function (d) {
      townAngryUntil = gameTime + 90;
      for (var thi = 0; thi < towns.length; thi++) {
        if (dist(d, towns[thi]) < towns[thi].r + 250) {
          res.rep[thi] = Math.max(0, res.rep[thi] - 4);
          break;
        }
      }
    },
    gainTownRep: function (attacker, x, y, amount) {
      for (var tri = 0; tri < towns.length; tri++) {
        if (dist({ x: x, y: y }, towns[tri]) < towns[tri].r + 180) {
          res.rep[tri] = Math.min(40, res.rep[tri] + amount);
          break;
        }
      }
    }
  }
});

/* ---- 表现/生命周期常量（T044-T047，源自 data/balance.js）---- */
var LIFE = (WR.BALANCE && WR.BALANCE.WORLD_LIFE) || { DEAD_TTL: 45, LOOT_TTL: 90, LOOT_FADE_AT: 10 };
var FXC = (WR.BALANCE && WR.BALANCE.FX) || { PARTICLE_SOFT_CAP: 280, PARTICLE_HARD_CAP: 300, DECAL_CAP: 350, BLOOD_N: 7, SPARK_N: 4, COIN_N: 6, DUST_STEP_GAP: 30 };
var HUD_MS = (WR.BALANCE && WR.BALANCE.HUD_INTERVAL_MS) || 180;
var SURVB = WR.BALANCE && WR.BALANCE.SURVIVAL ? WR.BALANCE.SURVIVAL : { WAKE_GRACE: 1.5, CAMP_SLEEP_RADIUS: 180 };

function tryHit(a, d) { return CombatSys.tryHit(a, d); }

/* ---- AI 决策已迁移至 src/systems/AI.js（T021）---- */
var AISys = WR.AI;
AISys.attach({
  rand: function () { return WR.App.rng.next(); },
  WORLD: WORLD,
  validEnemyFor: validEnemyFor,
  dist: dist,
  chestRatio: function (u2) { return u2.body.chest.hp / u2.body.chest.max; },
  findNearestHostile: findNearestHostile,
  livingSquad: livingSquad,
  text: addText
});
/* ---- 生存系统已迁移至 src/systems/Survival.js（T022）---- */
var SurvivalSys = WR.Survival;
SurvivalSys.attach({
  log: log,
  text: addText,
  sfx: sfx,
  knockDown: function (attacker, u, part) { knockDown(attacker, u, part); },
  getSelection: function () { return selection; },
  getUnits: function () { return units; },
  canAct: canAct,
  dist: dist,
  camps: function () { return camps; }
});
function knockDown(attacker, d, part) { CombatSys.knockDown(attacker, d, part); }
function die(u) { CombatSys.die(u); }

function dropLoot(u) {
  if (u.looted) return;
  u.looted = true;
  loot.push({
    x: u.x + rand(-8, 8), y: u.y + rand(-8, 8),
    cats: randi(u.lootMin, u.lootMax),
    food: (!u.isBeast && Math.random() < 0.3) ? randi(1, 2) : 0,
    life: LIFE.LOOT_TTL
  });
}

/* ---------------- AI ---------------- */
function aiThink(u) { AISys.think(u); }

/* ---------------- 移动 ---------------- */
function moveToward(u, tx, ty, dt) {
  var dx = tx - u.x, dy = ty - u.y;
  var d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.01) return;
  var step = Math.min(d, moveSpeedOf(u) * dt);
  u.x += dx / d * step;
  u.y += dy / d * step;
  u.face = Math.atan2(dy, dx);
  u.walkT += step / 24;
  u.moving = true;
  /* 跑动扬起脚下尘土 */
  u.stepAcc = (u.stepAcc || 0) + step;
  if (u.stepAcc > FXC.DUST_STEP_GAP && particles.length < FXC.PARTICLE_SOFT_CAP) {
    u.stepAcc = 0;
    particles.push({
      x: u.x + rand(-3, 3), y: u.y + rand(0, 5),
      vx: rand(-8, 8), vy: rand(-14, -4),
      life: 0.45, maxLife: 0.45,
      color: '#cbb88f', size: rand(1.5, 2.5)
    });
  }
}

function collideObstacles(u) {
  for (var i = 0; i < obstacles.length; i++) {
    var o = obstacles[i];
    var dx = u.x - o.x, dy = u.y - o.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    var minD = o.r + u.r - 2;
    if (d < minD && d > 0.01) {
      u.x = o.x + dx / d * minD;
      u.y = o.y + dy / d * minD;
    }
  }
  /* 玩家建造的建筑也是实体 */
  for (var s = 0; s < structures.length; s++) {
    var so = structures[s];
    var rrx = so.kind === 1 ? 13 : 7;
    var dx2 = u.x - so.x, dy2 = u.y - so.y;
    var d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    var minD2 = rrx + u.r - 2;
    if (d2 < minD2 && d2 > 0.01) {
      u.x = so.x + dx2 / d2 * minD2;
      u.y = so.y + dy2 / d2 * minD2;
    }
  }
}

/* ---------------- 单位更新 ---------------- */
function wakeUp(u) {
  u.state = 'idle';
  u.wakeGrace = SURVB.WAKE_GRACE || 1.5;
  u.attackTarget = null;
  u.moveTarget = null;
  if (u.faction === 'player') log(u.name + ' 苏醒了', 'good');
  addText(u.x, u.y - 28, '苏醒', '#cfe8a0');
}

function updateUnit(u, dt) {
  if (u.state === 'dead') { u.deadT += dt; return; }

  u.moving = false;
  u.swingT = Math.max(0, u.swingT - dt);
  u.flashT = Math.max(0, u.flashT - dt);
  u.wakeGrace = Math.max(0, u.wakeGrace - dt);
  u.fearT = Math.max(0, u.fearT - dt);
  u.combatT = Math.max(0, u.combatT - dt);

  // 玩家饥饿（已迁 systems/Survival.js）
  if (SurvivalSys.hungerTick(u, dt)) return;

  // 救助通道
  if (u.rescueChannel > 0) {
    var rt = u.rescueTarget;
    if (!rt || rt.state !== 'down' || dist(u, rt) > 55) {
      u.rescueChannel = 0; u.rescueTarget = null;
    } else {
      u.rescueChannel -= dt;
      if (u.rescueChannel <= 0) {
        rt.body.chest.hp = Math.max(rt.body.chest.hp, rt.body.chest.max * 0.33);
        rt.body.head.hp = Math.max(rt.body.head.hp, rt.body.head.max * 0.6);
        u.rescueChannel = 0; u.rescueTarget = null;
        log(u.name + ' 救起了 ' + rt.name, 'good');
        addText(rt.x, rt.y - 30, '获救', '#9fe07a');
        sfx('heal');
      }
      return;
    }
  }

  // 俘虏通道
  if (u.captureChannel > 0) {
    var cpt = u.captureTarget;
    if (!cpt || cpt.state !== 'down' || dist(u, cpt) > 55 || cpt.faction === 'slave') {
      u.captureChannel = 0; u.captureTarget = null;
    } else {
      u.captureChannel -= dt;
      if (u.captureChannel <= 0) {
        makeSlave(cpt);
        u.captureChannel = 0; u.captureTarget = null;
      }
      return;
    }
  }

  // 倒地状态（流血/凝结/苏醒数值已迁 systems/Survival.js）
  if (isDown(u)) {
    u.fallT = (u.fallT || 0) + dt;
    u.poolT = (u.poolT || 0) + dt;
    if (u.body.chest.hp <= 0 && u.poolT > 1.1) {
      u.poolT = 0;
      addDecal(u.x + rand(-5, 5), u.y + rand(-3, 4), rand(5, 9));
    }
    var dd = SurvivalSys.tickDowned(u, dt);
    if (dd.died) { die(u); return; }
    if (dd.woke) wakeUp(u);
    return;
  }

  // 包扎通道（已迁 systems/Survival.js）
  if (SurvivalSys.tickBandage(u, dt)) return;

  // 自动反击（决策已迁 systems/AI.js）
  AISys.maybeRetaliate(u, autoDefend);

  // 脱战回复（已迁 systems/Survival.js，营地光环 ×3）
  if (u.combatT <= 0) SurvivalSys.naturalRegen(u, camps, dist, dt);

  // 思考
  u.thinkT -= dt;
  if (u.thinkT <= 0) { u.thinkT = rand(0.3, 0.5); aiThink(u); }

  // 执行
  var tgt = u.attackTarget;
  if (tgt && !validEnemyFor(u, tgt)) { u.attackTarget = null; tgt = null; }

  if (tgt) {
    /* 攻击管线已收敛至 systems/Combat.js（T034） */
    CombatSys.stepAttack(u, tgt, dt, { tryHit: tryHit, moveToward: moveToward, dist: dist });
  } else if (u.moveTarget) {
    moveToward(u, u.moveTarget.x, u.moveTarget.y, dt);
    if (dist(u, u.moveTarget) < 8) u.moveTarget = null;
  }

  collideObstacles(u);
}

function separation(dt) {
  for (var i = 0; i < units.length; i++) {
    var a = units[i];
    if (a.state === 'dead' || isDown(a)) continue;
    for (var j = i + 1; j < units.length; j++) {
      var b = units[j];
      if (b.state === 'dead' || isDown(b)) continue;
      var dx = b.x - a.x, dy = b.y - a.y;
      var d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < 400) {
        var d = Math.sqrt(d2);
        var p = (20 - d) / d * 30 * dt;
        a.x -= dx * p; a.y -= dy * p;
        b.x += dx * p; b.y += dy * p;
      }
    }
  }
}

/* ---------------- 敌人生成 ---------------- */
function farFromTowns(x, y, margin) {
  for (var i = 0; i < towns.length; i++) {
    var t = towns[i];
    if (Math.sqrt((x - t.x) * (x - t.x) + (y - t.y) * (y - t.y)) < t.r + margin) return false;
  }
  return true;
}

function livingSquad() {
  var out = [];
  for (var i = 0; i < units.length; i++) {
    if (units[i].faction === 'player' && units[i].state !== 'dead') out.push(units[i]);
  }
  return out;
}

function squadCentroid() {
  var sq = livingSquad();
  if (!sq.length) return { x: towns[0].x, y: towns[0].y };
  var cx = 0, cy = 0;
  for (var i = 0; i < sq.length; i++) { cx += sq[i].x; cy += sq[i].y; }
  return { x: cx / sq.length, y: cy / sq.length };
}

/* ---- 刷怪已迁移至 src/world/Spawner.js（T025）---- */
var SpawnerSys = WR.Spawner;
SpawnerSys.attach({
  rng: function () { return WR.App ? WR.App.rng.next() : Math.random(); },
  makeUnit: makeUnit,
  weapons: WEAPONS,
  armors: ARMORS,
  zones: (WR.Enemies && WR.Enemies.ZONES) || null   /* T141: 难度梯度数据化 */
});
function spawnerCtx(minPlayerDist) {
  var hub = towns[0];
  var c = squadCentroid();
  return {
    hubX: hub.x, hubY: hub.y,
    playerX: c.x, playerY: c.y,
    minPlayerDist: minPlayerDist,
    worldW: WORLD.w, worldH: WORLD.h,
    ringMin: 900, ringMax: 3600,   /* T141: 大世界出生环带 */
    farFromTowns: farFromTowns,
    units: units
  };
}
/* T140: 狼巢定向刷狼——以狼巢为圆心的小环带 */
function spawnerCtxAt(cx0, cy0, minPlayerDist, ringMin, ringMax) {
  var c = squadCentroid();
  return {
    hubX: cx0, hubY: cy0,
    playerX: c.x, playerY: c.y,
    minPlayerDist: minPlayerDist,
    worldW: WORLD.w, worldH: WORLD.h,
    ringMin: ringMin, ringMax: ringMax,
    farFromTowns: farFromTowns,
    units: units
  };
}
function spawnGroup() {
  var before = units.length;
  SpawnerSys.spawnGroup(spawnerCtx(560));
  recordBanditAnchors(before);
  return units.length - before;
}
function spawnBeastPack() {
  var before = units.length;
  var n = SpawnerSys.spawnBeastPack(spawnerCtx(620));
  if (n > 0 && started) sfx('howl');
  return n;
}

function spawnGuards() {
  for (var t = 0; t < towns.length; t++) {
    var town = towns[t];
    for (var i = 0; i < 3; i++) {
      units.push(makeUnit({
        faction: 'town',
        name: randName(),
        x: town.x + rand(-90, 90), y: town.y + rand(-90, 90),
        maxHp: 130, speed: 86, aggro: 260,
        weapon: WEAPONS.iron,
        armor: ARMORS.leather,
        tierName: '城镇卫兵',
        lootMin: 30, lootMax: 70,
        bodyColor: FACTION_COLOR.town,
        hairColor: '#4a342a',
        homePoint: { x: town.x, y: town.y },
        skills: { str: 16, tgh: 15, dodge: 14, melee: 18 }
      }));
    }
  }
}

/* ---------------- 拾取（小队 + 奴隶搬运） ---------------- */
/* T132: 荒原游商 NPC */
function spawnMerchants() {
  if (!terrain) return;
  for (var i = 0; i < terrain.merchantCamps.length; i++) {
    var c = terrain.merchantCamps[i];
    var m = makeUnit({
      faction: 'town', name: randName(),
      x: c.x + rand(-20, 20), y: c.y + rand(-10, 24),
      maxHp: 90, speed: 58, aggro: 0,
      weapon: WEAPONS.fists, tierName: '荒原游商',
      lootMin: 60, lootMax: 120,
      bodyColor: '#caa04f', hairColor: '#2c2018',
      homePoint: { x: c.x, y: c.y },
      skills: { str: 8, tgh: 8, dodge: 8, melee: 8 }
    });
    m.isMerchant = true;
    units.push(m);
  }
}

/* T133: 废墟塔楼守匪（高风险的来源） */
function spawnTowerGarrisons() {
  if (!terrain) return;
  for (var i = 0; i < terrain.towers.length; i++) {
    var tw = terrain.towers[i];
    var n = 2 + (i % 2);
    for (var b = 0; b < n; b++) {
      units.push(makeUnit({
        faction: 'bandit', name: randName(),
        x: tw.x + rand(-70, 70), y: tw.y + rand(-50, 70),
        maxHp: 105, speed: 82, aggro: 330,
        weapon: b ? WEAPONS.mace : WEAPONS.iron,
        armor: ARMORS.leather,
        tierName: '塔楼守匪',
        lootMin: 30, lootMax: 80,
        bodyColor: FACTION_COLOR.bandit, hairColor: '#20242c',
        homePoint: { x: tw.x, y: tw.y },
        skills: { str: 13, tgh: 12, dodge: 11, melee: 14 }
      }));
    }
  }
}

function slaveList() {
  var out = [];
  for (var i = 0; i < units.length; i++) {
    if (units[i].faction === 'slave' && units[i].state !== 'dead') out.push(units[i]);
  }
  return out;
}

function pickups(dt) {
  var sq = livingSquad().concat(slaveList());
  for (var i = loot.length - 1; i >= 0; i--) {
    var l = loot[i];
    l.life -= dt;
    for (var j = 0; j < sq.length; j++) {
      var u = sq[j];
      if (isDown(u)) continue;
      if (dist(u, l) < 24) {
        res.cats += l.cats;
        if (l.food) res.food += l.food;
        var bySlave = u.faction === 'slave';
        addText(l.x, l.y - 16, '+' + l.cats + ' 猫', bySlave ? '#9fb8d8' : '#ffd97a');
        if (bySlave) addText(l.x, l.y - 32, '奴隶搬运', '#8fa8c8');
        if (l.food) addText(l.x, l.y - 32, '+' + l.food + ' 干粮', '#e8b45a');
        log((bySlave ? '奴隶搬运战利品：' : '拾取战利品：') + l.cats + ' 猫' + (l.food ? ' 和 ' + l.food + ' 干粮' : ''), bySlave ? 'sys' : 'gold');
        addCoinFx(l.x, l.y);
        sfx('coin');
        loot.splice(i, 1);
        break;
      }
    }
  }
}

/* ---------------- 玩家指令 ---------------- */
function canAct(u) {
  return u.faction === 'player' && u.state !== 'dead' && !isDown(u) &&
         u.rescueChannel <= 0 && u.bandageChannel <= 0;
}

function pickHostileAt(wx, wy, rad) {
  var best = null, bd = rad;
  for (var i = 0; i < units.length; i++) {
    var u = units[i];
    if (u.faction === 'player' || u.faction === 'town' || u.faction === 'slave') continue;
    if (u.state === 'dead') continue;
    var d = Math.sqrt((u.x - wx) * (u.x - wx) + (u.y - wy) * (u.y - wy));
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

/* 编队偏移已入 data/balance.js（T039） */
var FORMATION = WR.BALANCE.FORMATION;

var autoSelLogged = false;

function issueCommand(wx, wy) {
  if (!started || gameOver) return;
  var acters = selection.filter(canAct);
  if (!acters.length) {
    /* 保底：没选人时自动让全队行动 */
    selection = livingSquad();
    acters = selection.filter(canAct);
    if (!acters.length) return;
    if (!autoSelLogged) {
      autoSelLogged = true;
      log('已自动选中全队——左键或右键点地面即可移动', 'sys');
    }
  }
  var enemy = pickHostileAt(wx, wy, 26);
  if (enemy) {
    for (var i = 0; i < acters.length; i++) {
      acters[i].attackTarget = enemy;
      acters[i].moveTarget = null;
    }
    addRing(enemy.x, enemy.y);
    addText(enemy.x, enemy.y - 36, '攻击!', '#ff9a80');
    tutStep(3);
  } else {
    for (var k = 0; k < acters.length; k++) {
      var off = FORMATION[k % FORMATION.length];
      acters[k].attackTarget = null;
      acters[k].moveTarget = {
        x: clamp(wx + off[0], 20, WORLD.w - 20),
        y: clamp(wy + off[1], 20, WORLD.h - 20)
      };
    }
    addRing(wx, wy);
    tutStep(2);
  }
}

function stopSquad() {
  var acters = selection.filter(canAct);
  for (var i = 0; i < acters.length; i++) {
    acters[i].moveTarget = null;
    acters[i].attackTarget = null;
  }
}

function selectDigit(n) {
  var sq = livingSquad();
  if (n >= 1 && n <= sq.length) {
    selection = [sq[n - 1]];
    tutStep(1);
    sfx('ui');
  }
}

/* ---------------- 交互：进食 / 救助 / 包扎 / 商店 ---------------- */
function tryEat() { SurvivalSys.tryEat(function () { return selection; }, res, log); }

function tryRescue() { SurvivalSys.tryRescue(); }

function tryBandage() { SurvivalSys.tryBandage(res, selection, log); }

function nearestTownOfSelection(range) {
  for (var i = 0; i < selection.length; i++) {
    var u = selection[i];
    if (u.faction !== 'player' || u.state === 'dead') continue;
    for (var t = 0; t < towns.length; t++) {
      if (dist(u, towns[t]) < range) return towns[t];
    }
  }
  return null;
}

function openShop(town) {
  shopOpen = true;
  shopTown = town;
  tutStep(4);
  elShopTitle.textContent = town.name + ' · ' + (town.merchant ? '行商货摊' : '补给站');
  renderShop();
  elShop.classList.remove('hidden');
  sfx('ui');
}
function closeShop() {
  shopOpen = false;
  elShop.classList.add('hidden');
}

function firstActor() {
  for (var i = 0; i < selection.length; i++) {
    if (canAct(selection[i])) return selection[i];
  }
  return null;
}

/* 定价引擎已迁移至 src/systems/Economy.js（T023）*/
var EconomySys = WR.Economy;
function townDiscount() {
  var idx = towns.indexOf(shopTown);
  return EconomySys.discountFor(idx >= 0 ? res.rep[idx] : 0);
}
function priced(base) {
  var idx = towns.indexOf(shopTown);
  return EconomySys.price(idx >= 0 ? res.rep[idx] : 0, base);
}

/* T136: 商店货单数据驱动（src/data/shops.js 为唯一事实源，世界之角=军火商差异化） */
var SHOP_QTY = { bandage: 2, mats: 5 };
function shopItemRow(id) {
  if (id === 'hire') {
    var sq0 = livingSquad();
    return { act: 'hire', title: '🧑‍🤝‍🧑 招募同伴',
      desc: '小队人数 ' + sq0.length + '/5 · 剑客/苦力/猎手随机',
      cost: priced(250), disabled: res.cats < priced(250) || sq0.length >= 5 };
  }
  var d = WR.Items.get(id);
  if (!d) return null;
  var qty = SHOP_QTY[id] || 1;
  var cost = priced(d.price * qty);
  var selU = firstActor();
  var title = d.icon + ' ' + d.name + (qty > 1 ? ' ×' + qty : '');
  var desc;
  switch (d.type) {
    case 'weapon':
      desc = selU ? '给 ' + selU.name + '（当前：' + selU.weapon.name + '）· 伤害 ' + d.dmg
                  : '伤害 ' + d.dmg + ' · 触及 ' + d.reach;
      break;
    case 'armor':
      desc = selU ? '给 ' + selU.name + '（减伤 ' + d.def + '）' : '固定减伤 ' + d.def;
      break;
    case 'consumable':
      desc = d.use === 'food' ? '恢复 45 点饱食度' : '包扎伤口（按 C 使用）';
      break;
    case 'kit': desc = '就地扎营（V）：篝火+帐篷，可睡觉恢复'; break;
    case 'material': desc = '建造围墙/篝火（B 进入建造模式）'; break;
    case 'prosthetic': desc = selU ? '装到首个缺失的手臂/腿：永不残废，力量+2' : '先选择队员'; break;
    default: desc = '';
  }
  var dis = res.cats < cost;
  if (d.type === 'weapon' && selU && selU.weapon.key === id) dis = true;
  if (d.type === 'armor' && selU && selU.armor && selU.armor.key === id) dis = true;
  if (d.type === 'prosthetic' && !selU) dis = true;
  return { act: id === 'roboLimb' ? 'robo' : id, title: title, desc: desc, cost: cost, disabled: dis };
}

function renderShop() {
  var repIdx = towns.indexOf(shopTown);
  var rp = repIdx >= 0 ? res.rep[repIdx] : 0;
  elShopInfo.textContent = '队伍：🪙 ' + res.cats + ' 猫 ／ 🍖 ' + res.food + ' ／ 🩹 ' + res.bandage +
    ' ／ 🏕️ ' + res.kits + ' ／ 🧱 ' + res.mats +
    (repIdx >= 0 ? ' ｜ 本镇声望 ' + rp + '（' + Math.round((townDiscount() - 1) * 100) + '% 价格）'
                 : ' ｜ ' + (shopTown && shopTown.desc ? shopTown.desc : '行商定价'));
  var stockIds = (WR.Shops && shopTown && WR.Shops[shopTown.name] && WR.Shops[shopTown.name].stock)
    ? WR.Shops[shopTown.name].stock
    : ['food', 'bandage', 'campkit', 'mats', 'iron', 'leather', 'hire']; /* 兜底通用货单 */
  var items = [];
  for (var q = 0; q < stockIds.length; q++) {
    var row = shopItemRow(stockIds[q]);
    if (row) items.push(row);
  }
  elShopItems.innerHTML = '';
  for (var k = 0; k < items.length; k++) {
    var it = items[k];
    var rowEl = document.createElement('div');
    rowEl.className = 'shop-item';
    var left = document.createElement('div');
    left.innerHTML = '<div>' + it.title + '</div><div class="desc">' + it.desc + '</div>';
    var btn = document.createElement('button');
    btn.textContent = it.cost + ' 猫';
    btn.disabled = it.disabled;
    btn.setAttribute('data-act', it.act);
    rowEl.appendChild(left);
    rowEl.appendChild(btn);
    elShopItems.appendChild(rowEl);
  }
}

var HIRE_TYPES = [
  { title: '流浪剑客', skills: { str: 11, tgh: 10, dodge: 11, melee: 12 }, weapon: 'iron' },
  { title: '苦力',     skills: { str: 13, tgh: 13, dodge: 8,  melee: 9 },  weapon: 'stick' },
  { title: '猎手',     skills: { str: 10, tgh: 9,  dodge: 13, melee: 11 }, weapon: 'spear' }
];

elShopItems.addEventListener('click', function (e) {
  var act = e.target.getAttribute && e.target.getAttribute('data-act');
  if (!act) return;
  var selU = firstActor();

  if (act === 'food' && res.cats >= priced(25)) {
    res.cats -= priced(25); res.food++;
    log('购买了 1 份干粮', 'sys'); sfx('coin');
  } else if (act === 'bandage' && res.cats >= priced(45)) {
    res.cats -= priced(45); res.bandage += 2;
    log('购买了 2 卷绷带', 'sys'); sfx('coin');
  } else if (act === 'campkit' && res.cats >= priced(80)) {
    res.cats -= priced(80); res.kits++;
    log('购买了 1 套营地装备（按 V 扎营）', 'sys'); sfx('coin');
  } else if (act === 'mats' && res.cats >= priced(100)) {
    res.cats -= priced(100); res.mats += 5;
    log('购买了 5 份建材（按 B 进入建造模式）', 'sys'); sfx('coin');
  } else if (act === 'robo' && selU && res.cats >= priced(300)) {
    var slots = ['armL', 'armR', 'legL', 'legR'];
    var installed = '';
    for (var si = 0; si < slots.length; si++) {
      var sp = slots[si];
      if (selU.limbState[sp] !== 'robo' && (selU.limbState[sp] === 'cut' || selU.body[sp].hp <= 0)) {
        selU.limbState[sp] = 'robo';
        selU.body[sp].hp = Math.round(selU.body[sp].max * 0.75);
        installed = PART_NAMES[sp];
        break;
      }
    }
    if (installed) {
      res.cats -= priced(300);
      selU.skills.str += 2;
      log(selU.name + ' 装上了机械' + installed + '！永不残废，力量 +2', 'gold');
      addText(selU.x, selU.y - 30, '🦾 机械义肢', '#cfd6e0');
      sfx('lvl');
    } else {
      log(selU.name + ' 的四肢完好，暂时不需要义肢', 'sys');
    }
  } else if (act === 'stick' && selU && res.cats >= priced(15)) {
    res.cats -= priced(15); selU.weapon = WEAPONS.stick;
    equipMsg(selU, '木棍');
  } else if (act === 'iron' && selU && res.cats >= priced(180)) {
    res.cats -= priced(180); selU.weapon = WEAPONS.iron;
    equipMsg(selU, '铁刀');
  } else if (act === 'spear' && selU && res.cats >= priced(230)) {
    res.cats -= priced(230); selU.weapon = WEAPONS.spear;
    equipMsg(selU, '长枪');
  } else if (act === 'mace' && selU && res.cats >= priced(270)) {
    res.cats -= priced(270); selU.weapon = WEAPONS.mace;
    equipMsg(selU, '战锤');
  } else if (act === 'katana' && selU && res.cats >= priced(650)) {
    res.cats -= priced(650); selU.weapon = WEAPONS.katana;
    equipMsg(selU, '野太刀!');
    sfx('lvl');
  } else if (act === 'leather' && selU && res.cats >= priced(130)) {
    res.cats -= priced(130); selU.armor = ARMORS.leather;
    equipArmorMsg(selU, ARMORS.leather.name);
  } else if (act === 'chain' && selU && res.cats >= priced(430)) {
    res.cats -= priced(430); selU.armor = ARMORS.chain;
    equipArmorMsg(selU, ARMORS.chain.name);
  } else if (act === 'hire' && res.cats >= priced(250) && livingSquad().length < 5) {
    res.cats -= priced(250);
    var ht = pick(HIRE_TYPES);
    var nu = makeUnit({
      faction: 'player',
      x: shopTown.x + rand(-60, 60), y: shopTown.y + rand(-60, 60),
      maxHp: 66, speed: 84,
      weapon: WEAPONS[ht.weapon],
      tierName: ht.title,
      skills: { str: ht.skills.str, tgh: ht.skills.tgh, dodge: ht.skills.dodge, melee: ht.skills.melee },
      bodyColor: pick(['#4e6ea8', '#5a7ab8', '#46628f', '#3f5a95']),
      hairColor: pick(['#2a201a', '#4a342a', '#151515', '#6b4a2f'])
    });
    var sq = livingSquad();
    if (sq.length) nu.moveTarget = { x: sq[0].x, y: sq[0].y };
    units.push(nu);
    log(nu.name + '（' + ht.title + '）加入了你的小队', 'good');
    sfx('lvl');
  }
  renderShop();
});

function equipMsg(u, what) {
  log(u.name + ' 装备了' + what, 'good');
  addText(u.x, u.y - 30, '装备' + what, '#cfe8f8');
  sfx('coin');
}
function equipArmorMsg(u, what) {
  log(u.name + ' 穿上了' + what, 'good');
  addText(u.x, u.y - 30, what, '#cfe8f8');
  sfx('coin');
}

/* T137: 情报贩子（枢纽镇固定摊位） */
function brokerPos() {
  var t0 = towns[0];
  return { x: t0.x - 150, y: t0.y + 55 };
}
function tryTalkBroker() {
  if (!started) return false;
  var bp = brokerPos();
  for (var i = 0; i < selection.length; i++) {
    var u = selection[i];
    if (u.faction !== 'player' || u.state === 'dead' || isDown(u)) continue;
    if (dist(u, bp) > 70) continue;
    if (res.cats < 40) { log('情报贩子：「40 猫，不还价。」——你的钱不够', 'sys'); return true; }
    /* 找最近的匪帮出没记录（600s 内） */
    var best = null;
    for (var a = 0; a < banditAnchors.length; a++) {
      if (gameTime - banditAnchors[a].t > 600) continue;
      if (!best || banditAnchors[a].t > best.t) best = banditAnchors[a];
    }
    if (!best) { log('情报贩子：「最近风声紧，匪帮都缩起来了。这单不做。」', 'sys'); return true; }
    res.cats -= 40;
    intelPing = { x: best.x, y: best.y, until: gameTime + 90 };
    var c = squadCentroid();
    var dx = best.x - c.x, dy = best.y - c.y;
    var dd = Math.sqrt(dx * dx + dy * dy) || 1;
    var dirs = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];
    var ang = Math.atan2(dy, dx);
    var dir = dirs[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
    log('情报贩子：「' + dir + '方约 ' + Math.round(dd / 100) * 100 + ' 步外，匪帮在那一带扎营。地图上有标记，快去快回。」', 'gold');
    addText(u.x, u.y - 36, '-40 猫 · 获得情报', '#ffd97a');
    sfx('coin');
    return true;
  }
  return false;
}

/* T132: 荒原游商营地交易 */
function tryMerchantShop() {
  for (var i = 0; i < selection.length; i++) {
    var u = selection[i];
    if (u.faction !== 'player' || u.state === 'dead' || isDown(u)) continue;
    for (var j = 0; j < units.length; j++) {
      var m = units[j];
      if (!m.isMerchant || m.state === 'dead') continue;
      if (dist(u, m) < 95) { openShop({ name: '荒原游商', x: m.x, y: m.y, merchant: true }); return true; }
    }
  }
  return false;
}

function interact() {
  if (shopOpen) { closeShop(); return; }
  if (tryTalkBroker()) return;
  if (tryMerchantShop()) return;
  /* M5/T131+T138: 废墟搜索（1.6s 进度通道） */
  if (tryScavenge()) return;
  var town = nearestTownOfSelection(175);
  if (town) { openShop(town); return; }
  log('附近没有可以交互的对象（城镇商店 / 废墟 / 游商 / 情报贩子）', 'sys');
}

/* T131: 开始搜索最近的可交互废墟（T138 改为 1.6s 引导通道） */
function tryScavenge() {
  if (!terrain) return false;
  for (var i = 0; i < selection.length; i++) {
    var u = selection[i];
    if (u.faction !== 'player' || u.state === 'dead' || isDown(u)) continue;
    if (scavChan && scavChan.u === u) return true; /* 已在进行中 */
    var ru = terrain.nearestRuin(u.x, u.y, 95);
    if (!ru) continue;
    if (gameTime < ru.coolUntil) {
      log(ru.type === 'tower' ? '塔楼刚被人搜过，还没刷新（冷却中）' : '这处废墟刚被搜刮过，还没刷新（冷却中）', 'sys');
      addText(u.x, u.y - 34, '冷却中…', '#b8a888');
      return true;
    }
    if (ru.type === 'tower') log('搜索塔楼废墟…（守匪的注视下翻找值钱的玩意）', 'sys');
    scavChan = { u: u, ruin: ru, t: 0, dur: 1.6 };
    addText(u.x, u.y - 38, '搜索中…', '#e8d8a8');
    tutStep(1);
    return true;
  }
  return false;
}

function finishScavenge(ch) {
  var found = terrain.scavenge(ch.ruin, gameTime, function () { return WR.App.rng.next(); });
  if (!found) return;
  applyLoot(found, ch.ruin.x, ch.ruin.y, ch.u ? ch.u.name : '');
}

function applyLoot(found, x, y, who) {
  var parts = [];
  if (found.cats) { res.cats += found.cats; parts.push(found.cats + ' 猫'); }
  ['food', 'bandage', 'mats', 'kits'].forEach(function (k) {
    if (found[k]) { res[k] += found[k]; parts.push(k + ' ×' + found[k]); }
  });
  var prefix = who ? who + ' ' : '';
  log(prefix + '搜出了: ' + (parts.join('、') || '灰尘'), 'good');
  addText(x, y - 40, '+' + parts.join(' '), '#ffd97a');
  addRing(x, y);
  sfx('coin');
}

/* ---------------- v0.3 营地 / 睡眠 / 俘虏 / 建造 ---------------- */
var DEFAULT_HINT = '左键选择 · 右键移动/攻击 · Tab 全队 · E 商店 · F 进食 · R 救助 · C 绷带 · V 扎营 · Z 睡觉 · X 俘虏 · B 建造 · H 帮助';

function tutStep(n) {
  if (tutorial < n) tutorial = n;
}

function nearestCampToSelection(range) {
  for (var i = 0; i < selection.length; i++) {
    var u = selection[i];
    if (u.faction !== 'player' || u.state === 'dead') continue;
    for (var c = 0; c < camps.length; c++) {
      if (dist(u, camps[c]) < range) return camps[c];
    }
  }
  return null;
}

function tryCamp() {
  if (res.kits <= 0) { log('没有营地套装！城镇有售（🏕️ 80 猫）', 'bad'); return; }
  var c = squadCentroid();
  /* 城镇内部（60% 半径内）不允许扎营 */
  for (var tc = 0; tc < towns.length; tc++) {
    if (dist(c, towns[tc]) < towns[tc].r * 0.6) { log('离城镇太近，守卫不允许你扎营', 'sys'); return; }
  }
  res.kits--;
  camps.push({ x: c.x, y: c.y });
  log('营地搭建完成——篝火与帐篷已立起（Z 可睡觉，附近伤势恢复更快）', 'good');
  addText(c.x, c.y - 30, '营地', '#ffd97a');
  sfx('heal');
}

function trySleep() {
  if (sleeping) return; /* 已经在睡了，不要重置计时 */
  var camp = nearestCampToSelection(180);
  if (!camp) { log('需要在营地篝火旁才能睡觉（V 扎营）', 'sys'); return; }
  sleeping = true;
  sleepT = 0;
  elSleepOv.classList.remove('hidden');
}

function finishSleep() {
  sleeping = false;
  elSleepOv.classList.add('hidden');
  day++;
  tod = 0.30;
  SurvivalSys.applySleepRecovery(livingSquad());
  log('睡了个好觉。第 ' + day + ' 天开始了，伤势恢复了不少。', 'good');
  sfx('lvl');
}

function makeSlave(t) {
  t.faction = 'slave';
  t.state = 'idle';
  t.wakeGrace = 2;
  t.body.chest.hp = Math.max(t.body.chest.hp, t.body.chest.max * 0.45);
  t.body.head.hp = Math.max(t.body.head.hp, t.body.head.max * 0.6);
  t.tierName = '奴隶';
  t.speed *= 0.85;
  t.attackTarget = null;
  t.moveTarget = null;
  t.homePoint = null;
  t.lastAttacker = null;
  for (var i = 0; i < units.length; i++) {
    if (units[i].attackTarget === t) units[i].attackTarget = null;
  }
  log(t.name + ' 放下武器投降了——他会帮你搬运战利品（再按 X 可释放）', 'gold');
  addText(t.x, t.y - 30, '成为奴隶', '#9fb8d8');
  sfx('lvl');
}

function tryCaptureOrFree() {
  /* 先看能否俘虏 */
  for (var i = 0; i < selection.length; i++) {
    var u = selection[i];
    if (!canAct(u)) continue;
    for (var j = 0; j < units.length; j++) {
      var t = units[j];
      if ((t.faction === 'bandit' || t.faction === 'hungry') && isDown(t) && dist(u, t) < 46) {
        if (slaveList().length >= 3) { log('奴隶太多了（最多 3 名），先释放一些吧', 'bad'); return; }
        u.captureChannel = 2;
        u.captureTarget = t;
        u.moveTarget = null;
        u.attackTarget = null;
        log(u.name + ' 正在捆缚 ' + t.name + '……', 'sys');
        return;
      }
    }
  }
  /* 再看能否释放 */
  for (var k = 0; k < selection.length; k++) {
    var su = selection[k];
    if (!canAct(su)) continue;
    for (var m = 0; m < units.length; m++) {
      var sl = units[m];
      if (sl.faction === 'slave' && dist(su, sl) < 46) {
        sl.tierName = '自由人';
        sl.homePoint = { x: clamp(sl.x + rand(-800, 800), 60, WORLD.w - 60), y: clamp(sl.y + rand(-800, 800), 60, WORLD.h - 60) };
        sl.moveTarget = { x: sl.homePoint.x, y: sl.homePoint.y };
        sl.lastAttacker = null;
        log('你解开了 ' + sl.name + ' 的镣铐。他朝远方走去，没有回头。', 'sys');
        addText(sl.x, sl.y - 30, '自由了', '#cfe8a0');
        return;
      }
    }
  }
  log('附近没有可俘虏的倒地敌人或奴隶（把敌人打倒后走近按 X）', 'sys');
}

function cycleBuildMode() {
  buildMode = (buildMode + 1) % 3;
  if (buildMode === 1) log('建造模式：围墙 —— 左键放置（1 建材），右键/Esc 退出，B 切换', 'sys');
  else if (buildMode === 2) log('建造模式：篝火 —— 左键放置（1 建材），右键/Esc 退出，B 切换', 'sys');
  else log('退出建造模式', 'sys');
  sfx('ui');
}

/* ---- 建造规则已迁移至 src/systems/Build.js（T024）---- */
var BuildSys = WR.Build;
function townZones() {
  /* 与旧规则一致：仅禁止城镇中心 60px 内（r-240 的历史语义） */
  return towns.map(function (t) { return { x: t.x, y: t.y, r: t.r - 240 }; });
}
function structValid(x, y, kind) {
  return !BuildSys.validate(structures, camps, townZones(), x, y);
}
function placeStructure(wx, wy) {
  var x = BuildSys.snap(wx);
  var y = BuildSys.snap(wy);
  if (res.mats < 1) { log('没有建材了！城镇有售（🧱×5 = 100 猫）', 'bad'); return; }
  var reason = BuildSys.validate(structures, camps, townZones(), x, y);
  if (reason) { log(reason, 'bad'); return; }
  res.mats--;
  structures.push({ x: x, y: y, kind: buildMode });
  sfx('ui');
}

function emitFlames(dt) {
  flameAcc += dt;
  var src = [];
  for (var c = 0; c < camps.length; c++) src.push(camps[c]);
  for (var s = 0; s < structures.length; s++) {
    if (structures[s].kind === 2) src.push(structures[s]);
  }
  var any = false;
  for (var i = 0; i < src.length; i++) {
    if (!inView(src[i].x, src[i].y, 80)) continue;
    any = true;
    if (flameAcc > 0.09) {
      particles.push({
        x: src[i].x + rand(-4, 4), y: src[i].y - 3,
        vx: rand(-8, 8), vy: rand(-55, -28),
        life: rand(0.35, 0.6), maxLife: 0.6,
        color: pick(['#ff9a3c', '#ffce54', '#ff6b35']),
        size: rand(2, 3.5)
      });
    }
  }
  if (any && flameAcc > 0.09) flameAcc = 0;
  if (particles.length > FXC.PARTICLE_HARD_CAP) particles.splice(0, particles.length - FXC.PARTICLE_HARD_CAP);
}

function drawFireBase(x, y, big) {
  var r = big ? 11 : 8;
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.beginPath(); ctx.ellipse(x, y + 3, r + 3, (r + 3) * 0.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#7d7568';
  for (var i = 0; i < 6; i++) {
    var a = i / 6 * TAU;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.55, 2.6, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#5d4525';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 5, y + 1); ctx.lineTo(x + 5, y - 2);
  ctx.moveTo(x + 5, y + 1); ctx.lineTo(x - 5, y - 2);
  ctx.stroke();
}

function drawStructures() {
  /* 营地：帐篷 + 篝火 + 铺盖 */
  for (var c = 0; c < camps.length; c++) {
    var cp = camps[c];
    if (!inView(cp.x, cp.y, 120)) continue;
    /* 帐篷 */
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(cp.x - 26, cp.y + 12, 24, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#a8926a';
    ctx.strokeStyle = '#241d15'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cp.x - 52, cp.y + 12);
    ctx.lineTo(cp.x - 26, cp.y - 20);
    ctx.lineTo(cp.x, cp.y + 12);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8a744e';
    for (var st = -44; st <= -8; st += 9) {
      ctx.beginPath();
      ctx.moveTo(cp.x + st, cp.y + 12);
      ctx.lineTo(cp.x - 26 + (st + 26) * 0.06, cp.y - 20 + (st + 26) * 0.02);
      ctx.lineTo(cp.x + st + 4.5, cp.y + 12);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#3a2f1c';
    ctx.beginPath();
    ctx.moveTo(cp.x - 34, cp.y + 12);
    ctx.lineTo(cp.x - 26, cp.y - 2);
    ctx.lineTo(cp.x - 18, cp.y + 12);
    ctx.closePath(); ctx.fill();
    /* 铺盖 */
    ctx.fillStyle = '#b0574a';
    ctx.fillRect(cp.x + 14, cp.y + 6, 16, 7);
    ctx.strokeStyle = '#241d15'; ctx.lineWidth = 1;
    ctx.strokeRect(cp.x + 14, cp.y + 6, 16, 7);
    /* 篝火 */
    drawFireBase(cp.x + 34, cp.y - 6, true);
    ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.5)';
    ctx.strokeText('营地 [Z睡眠]', cp.x - 26, cp.y - 27);
    ctx.fillStyle = '#ffe9ad';
    ctx.fillText('营地 [Z睡眠]', cp.x - 26, cp.y - 27);
  }
  /* 玩家建筑 */
  for (var w = 0; w < structures.length; w++) {
    var so = structures[w];
    if (!inView(so.x, so.y, 50)) continue;
    if (so.kind === 1) {
      /* 围墙段：三根尖桩 */
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath(); ctx.ellipse(so.x, so.y + 8, 15, 5, 0, 0, TAU); ctx.fill();
      for (var l = -1; l <= 1; l++) {
        var lx = so.x + l * 9;
        ctx.fillStyle = l === 0 ? '#8a6a44' : '#79593a';
        ctx.strokeStyle = '#241d15'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(lx - 3, so.y + 8);
        ctx.lineTo(lx - 3, so.y - 12);
        ctx.lineTo(lx, so.y - 17);
        ctx.lineTo(lx + 3, so.y - 12);
        ctx.lineTo(lx + 3, so.y + 8);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.strokeStyle = '#5d4525'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(so.x - 12, so.y - 6); ctx.lineTo(so.x + 12, so.y - 6); ctx.stroke();
    } else {
      drawFireBase(so.x, so.y, false);
    }
  }
}

function drawLights() {
  var b = brightness();
  var dark = 1 - b;
  if (dark < 0.08) return;
  var src = [];
  for (var c = 0; c < camps.length; c++) src.push({ x: camps[c].x + 34, y: camps[c].y - 6, r: 190 });
  for (var s = 0; s < structures.length; s++) {
    if (structures[s].kind === 2) src.push({ x: structures[s].x, y: structures[s].y, r: 140 });
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (var i = 0; i < src.length; i++) {
    var sxp = (src[i].x - cam.x) * zoom + W / 2 + lastShakeX;
    var syp = (src[i].y - cam.y) * zoom + H / 2 + lastShakeY;
    var rr = src[i].r * zoom * (0.85 + 0.15 * Math.sin(gameTime * 7 + i));
    var g = ctx.createRadialGradient(sxp, syp, 4, sxp, syp, rr);
    g.addColorStop(0, 'rgba(255,160,60,' + (0.32 * dark).toFixed(3) + ')');
    g.addColorStop(0.55, 'rgba(255,120,40,' + (0.13 * dark).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,100,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sxp, syp, rr, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawGhostPreview() {
  if (buildMode === 0 || !started || gameOver || shopOpen || helpOpen) return;
  var wp = screenToWorld(mouse.x, mouse.y);
  var x = Math.round(wp.x / 10) * 10;
  var y = Math.round(wp.y / 10) * 10;
  var ok = structValid(x, y);
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = ok ? 'rgba(159,224,122,.9)' : 'rgba(224,96,76,.9)';
  ctx.fillStyle = ok ? 'rgba(159,224,122,.15)' : 'rgba(224,96,76,.15)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,.6)';
  var label = (buildMode === 1 ? '围墙' : '篝火') + ' 🧱' + res.mats;
  ctx.strokeText(label, x, y - 20);
  ctx.fillStyle = ok ? '#c8f0a0' : '#f0a094';
  ctx.fillText(label, x, y - 20);
  ctx.restore();
}

/* ---------------- 输入 ---------------- */
function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  vignetteGrad = null;
}

function screenToWorld(mx, my) {
  return {
    x: cam.x + (mx - W / 2) / zoom,
    y: cam.y + (my - H / 2) / zoom
  };
}

canvas.addEventListener('mousedown', function (e) {
  if (!started || gameOver || helpOpen || shopOpen || sleeping) return;
  if (buildMode > 0) {
    var wpb = screenToWorld(e.clientX, e.clientY);
    if (e.button === 0) {
      placeStructure(wpb.x, wpb.y);
    } else if (e.button === 2) {
      buildMode = 0;
      log('退出建造模式', 'sys');
    }
    return;
  }
  if (e.button === 0) {
    mouse.dragStart = { x: e.clientX, y: e.clientY };
    mouse.dragging = true;
  } else if (e.button === 2) {
    var wp = screenToWorld(e.clientX, e.clientY);
    issueCommand(wp.x, wp.y);
  }
});

window.addEventListener('mousemove', function (e) {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

window.addEventListener('mouseup', function (e) {
  if (e.button !== 0 || !mouse.dragging) return;
  mouse.dragging = false;
  if (!mouse.dragStart || !started || gameOver) { mouse.dragStart = null; return; }
  var dx = e.clientX - mouse.dragStart.x;
  var dy = e.clientY - mouse.dragStart.y;
  var wp = screenToWorld(e.clientX, e.clientY);
  if (dx * dx + dy * dy > 64) {
    /* 框选数学已抽为纯函数 input/RectSelect.js（T038） */
    var w0 = screenToWorld(mouse.dragStart.x, mouse.dragStart.y);
    var picked = WR.RectSelect.collect(livingSquad(), w0.x, w0.y, wp.x, wp.y);
    if (picked.length) selection = picked;
  } else {
    var sq2 = livingSquad();
    var best = null, bd = 22;
    for (var j = 0; j < sq2.length; j++) {
      var d = dist(sq2[j], wp);
      if (d < bd) { bd = d; best = sq2[j]; }
    }
    if (best) {
      if (e.shiftKey) {
        var idx = selection.indexOf(best);
        if (idx >= 0) selection.splice(idx, 1);
        else selection.push(best);
      } else {
        selection = [best];
      }
      sfx('ui');
    } else if (!e.shiftKey) {
      /* 左键点空地 = 走过去（更符合直觉），并保留当前选择 */
      issueCommand(wp.x, wp.y);
    }
  }
  if (selection.length) tutStep(1);
  mouse.dragStart = null;
});

canvas.addEventListener('wheel', function (e) {
  e.preventDefault();
  var f = e.deltaY < 0 ? 1.12 : 0.89;
  var nz = clamp(zoom * f, 0.6, 1.8);
  var wx = cam.x + (mouse.x - W / 2) / zoom;
  var wy = cam.y + (mouse.y - H / 2) / zoom;
  zoom = nz;
  cam.x = wx - (mouse.x - W / 2) / zoom;
  cam.y = wy - (mouse.y - H / 2) / zoom;
  clampCam();
}, { passive: false });

window.addEventListener('contextmenu', function (e) { e.preventDefault(); });

window.addEventListener('keydown', function (e) {
  keys[e.code] = true;
  if (!started) return;
  switch (e.code) {
    case 'Digit1': selectDigit(1); break;
    case 'Digit2': selectDigit(2); break;
    case 'Digit3': selectDigit(3); break;
    case 'Digit4': selectDigit(4); break;
    case 'Digit5': selectDigit(5); break;
    case 'Tab':
      e.preventDefault();
      selection = livingSquad().slice();
      tutStep(1);
      sfx('ui');
      break;
    case 'Space': stopSquad(); e.preventDefault(); break;
    case 'KeyE': interact(); break;
    case 'KeyF': tryEat(); break;
    case 'KeyR': tryRescue(); break;
    case 'KeyC': tryBandage(); break;
    case 'KeyV': tryCamp(); break;
    case 'KeyZ': trySleep(); break;
    case 'KeyX': tryCaptureOrFree(); break;
    case 'KeyB': cycleBuildMode(); break;
    case 'KeyT':
      /* T040 经总线广播（main.js 桥接执行） */
      uiBus().emit('combat/toggleAutoDefend');
      break;
    case 'KeyG':
      /* T040 相机事件化：经总线广播，宿主订阅执行 */
      uiBus().emit('cam/toggleFollow');
      break;
    case 'KeyH':
      helpOpen = !helpOpen;
      elHelp.classList.toggle('hidden', !helpOpen);
      break;
    case 'KeyM':
      /* T144: 大地图（原静音功能移至 KeyU） */
      toggleBigMap();
      break;
    case 'KeyU':
      muted = !muted;
      log(muted ? '已静音' : '声音开启', 'sys');
      break;
    case 'KeyP':
      toggle3D();
      break;
    case 'Escape':
      if (mapOpen) mapOpen = false;
      else if (buildMode > 0) { buildMode = 0; log('退出建造模式', 'sys'); }
      else if (shopOpen) closeShop();
      else if (helpOpen) { helpOpen = false; elHelp.classList.add('hidden'); }
      break;
  }
});
window.addEventListener('keyup', function (e) { keys[e.code] = false; });
window.addEventListener('blur', function () { keys = {}; });
window.addEventListener('resize', resize);

/* UI 按钮统一走 EventBus（T017）：UI 层发事件，逻辑层订阅处理 */
function uiBus() {
  return (window.WR && WR.App && WR.App.bus) || null;
}
$('helpClose').addEventListener('click', function () {
  var b = uiBus();
  if (b) { b.emit('ui/helpClose'); return; }
  helpOpen = false;
  elHelp.classList.add('hidden');
});
$('shopClose').addEventListener('click', function () {
  var b = uiBus();
  if (b) { b.emit('ui/shopClose'); return; }
  closeShop();
});
$('restartBtn').addEventListener('click', function () { location.reload(); });

/* T145: 出生点三选一（近镇/远镇/流浪者起点） */
function heroUnit() {
  for (var i = 0; i < units.length; i++) {
    if (units[i].faction === 'player') return units[i];
  }
  return null;
}
function relocateHero(kind) {
  var h = heroUnit();
  if (!h || !terrain || !terrain.roads.length) return;
  spawnKindUsed = kind;
  var road = terrain.roads[0].pts;
  var spot = { x: h.x, y: h.y };
  if (kind === 'near') {
    spot = { x: towns[0].x + 430, y: towns[0].y - 120 };
  } else if (kind === 'far') {
    spot = { x: towns[1].x - 430, y: towns[1].y + 140 };
  } else if (kind === 'wander') {
    var mid = road[Math.floor(road.length / 2)];
    spot = { x: mid.x + 220, y: mid.y + 160 };
    /* 保证不在城镇圈内 */
    if (!terrain.farFromTowns(spot.x, spot.y, 380)) spot = { x: mid.x + 420, y: mid.y + 300 };
  }
  h.x = spot.x; h.y = spot.y;
  h.homePoint = { x: spot.x, y: spot.y };
  selection = [h];
  cam.x = h.x; cam.y = h.y;
  clampCam();
}

function startGame(kind) {
  if (started) return;
  initAudio();
  started = true;
  elStart.classList.add('hidden');
  if (kind && kind !== 'near') relocateHero(kind);
  log('欢迎来到荒原。这里没有任务——只有生存。', 'sys');
  log('提示：左键选择，右键移动/攻击。跟着下方提示操作即可上手。', 'sys');
}
elStart.addEventListener('click', function () { startGame('near'); });
/* 出生点按钮（阻止冒泡到"点击任意处开始"） */
(function bindSpawnChoices() {
  function bind() {
    var box = document.getElementById('spawnChoices');
    if (!box || !box.querySelectorAll) return;
    var btns = box.querySelectorAll('[data-spawn]');
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          startGame(b.getAttribute('data-spawn'));
        });
      })(btns[i]);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else bind();
})();

/* 运行时报错可见化：任何脚本错误都会显示在屏幕顶部 */
window.onerror = function (msg, src, line) {
  try {
    var bar = document.getElementById('errBanner');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'errBanner';
      bar.style.cssText = 'position:absolute;top:0;left:0;right:0;z-index:99;background:#7a1f16;color:#ffe9ad;font-size:12px;padding:6px 12px;';
      document.body.appendChild(bar);
    }
    bar.textContent = '脚本错误: ' + msg + ' @' + line;
  } catch (e2) {}
  return false;
};

elSquadBar.addEventListener('click', function (e) {
  var chip = e.target.closest ? e.target.closest('.chip') : null;
  if (!chip) return;
  var id = parseInt(chip.getAttribute('data-id'), 10);
  var u = null;
  for (var i = 0; i < units.length; i++) {
    if (units[i].id === id) { u = units[i]; break; }
  }
  if (!u) return;
  if (e.shiftKey) {
    var idx = selection.indexOf(u);
    if (idx >= 0) selection.splice(idx, 1);
    else selection.push(u);
  } else {
    selection = [u];
  }
});

/* ---------------- 相机 ---------------- */
function clampCam() {
  var hw = W / (2 * zoom), hh = H / (2 * zoom);
  if (hw * 2 < WORLD.w) cam.x = clamp(cam.x, hw, WORLD.w - hw);
  if (hh * 2 < WORLD.h) cam.y = clamp(cam.y, hh, WORLD.h - hh);
}

function updateCamera(dt) {
  var spd = 540 * dt / zoom;
  var dx = 0, dy = 0;
  if (keys.KeyW || keys.ArrowUp) dy -= spd;
  if (keys.KeyS || keys.ArrowDown) dy += spd;
  if (keys.KeyA || keys.ArrowLeft) dx -= spd;
  if (keys.KeyD || keys.ArrowRight) dx += spd;
  if (dx || dy) {
    cam.x += dx; cam.y += dy;
    camFollow = false;
  } else if (camFollow) {
    var c = squadCentroid();
    if (livingSquad().length) {
      var k = Math.min(1, dt * 3);
      cam.x = lerp(cam.x, c.x, k);
      cam.y = lerp(cam.y, c.y, k);
    }
  }
  clampCam();
}

/* ---------------- 主更新 ---------------- */
function pausedWorld() {
  return !started || helpOpen || shopOpen || gameOver || sleeping || mapOpen;
}

function brightness() { return 0.5 - 0.5 * Math.cos(tod * TAU); }

function updateMotes(dt) {
  var m = 120;
  for (var i = 0; i < motes.length; i++) {
    var mo = motes[i];
    mo.x += mo.vx * dt;
    mo.y += mo.vy * dt;
    if (mo.x < viewRect.x - m) mo.x = viewRect.x + viewRect.w + m;
    if (mo.x > viewRect.x + viewRect.w + m) mo.x = viewRect.x - m;
    if (mo.y < viewRect.y - m) mo.y = viewRect.y + viewRect.h + m;
    if (mo.y > viewRect.y + viewRect.h + m) mo.y = viewRect.y - m;
  }
}

function update(dt) {
  gameTime += dt;
  var nt = tod + dt / DAY_LEN;
  if (nt >= 1) { day++; log('第 ' + day + ' 天开始了', 'sys'); }
  tod = nt % 1;
  shakeT = Math.max(0, shakeT - dt * 10);

  updateScavChan(dt);
  updateCaravan(dt);
  updateDangerEdge(dt);

  // 匪徒生成
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnTimer = rand(10, 16);
    var hostiles = 0;
    for (var i = 0; i < units.length; i++) {
      var f = units[i].faction;
      if ((f === 'bandit' || f === 'hungry') && units[i].state !== 'dead') hostiles++;
    }
    if (hostiles < 14) spawnGroup();
  }

  // 狼群生成（T140: 优先狼巢定向刷新）
  beastTimer -= dt;
  if (beastTimer <= 0) {
    beastTimer = rand(20, 32);
    var beasts = 0;
    for (var b = 0; b < units.length; b++) {
      if (units[b].faction === 'beast' && units[b].state !== 'dead') beasts++;
    }
    if (beasts < 7) spawnBeastPackAtDen() || spawnBeastPack();
  }
  updateLandmarks(dt);
  updateDenRewards(dt);

  for (var u = 0; u < units.length; u++) updateUnit(units[u], dt);
  separation(dt);
  pickups(dt);

  units = units.filter(function (x) { return !(x.state === 'dead' && x.deadT > LIFE.DEAD_TTL); });
  loot = loot.filter(function (l) { return l.life > 0; });

  for (var p = particles.length - 1; p >= 0; p--) {
    var pa = particles[p];
    pa.life -= dt;
    pa.x += pa.vx * dt;
    pa.y += pa.vy * dt;
    pa.vx *= 0.92; pa.vy *= 0.92;
    if (pa.life <= 0) particles.splice(p, 1);
  }
  for (var t2 = texts.length - 1; t2 >= 0; t2--) {
    texts[t2].t += dt;
    if (texts[t2].t > texts[t2].life) texts.splice(t2, 1);
  }
  for (var r = rings.length - 1; r >= 0; r--) {
    rings[r].t += dt;
    if (rings[r].t > 0.5) rings.splice(r, 1);
  }

  updateMotes(dt);
  emitFlames(dt);

  var tn = nearestTownOfSelection(175);
  if (tn) {
    if (!townHintCool[tn.name] || gameTime - townHintCool[tn.name] > 12) {
      townHintCool[tn.name] = gameTime;
      log('进入 ' + tn.name + ' —— 按 E 打开商店 / 招募', 'sys');
    }
  } else if (terrain && gameTime > ruinHintCool) {
    /* M5/T131: 靠近废墟提示 */
    var cen = squadCentroid();
    if (cen && terrain.nearestRuin(cen.x, cen.y, 130)) {
      ruinHintCool = gameTime + 10;
      log('发现废墟——靠近后按 E 搜索物资', 'sys');
    }
  }

  updateCamera(dt);
  refreshHUD();
  refreshSquadBar();
  checkGameOver();
}

/* ---------------- T138: 拾荒进度通道 ---------------- */
function updateScavChan(dt) {
  if (!scavChan) return;
  var u = scavChan.u, ru = scavChan.ruin;
  var broken = !u || u.state === 'dead' || isDown(u) ||
               !terrain || dist(u, ru) > 120 ||
               (u.moveTarget && dist(u.moveTarget, { x: u.x, y: u.y }) > 4);
  if (broken) {
    if (u && u.state !== 'dead') addText(u.x, u.y - 36, '搜索被打断', '#e0a0a0');
    scavChan = null;
    return;
  }
  scavChan.t += dt;
  if (scavChan.t >= scavChan.dur) {
    finishScavenge(scavChan);
    scavChan = null;
  }
}

/* ---------------- T139: 商队事件 ---------------- */
function spawnCaravan() {
  if (!terrain || !terrain.roads.length) return;
  var a = caravanSide % 2, b = 1 - a;
  caravanSide++;
  var pts = terrain.roads[0].pts.slice();
  if (a === 1) pts.reverse();
  var fromTown = towns[a], toTown = towns[b];
  var members = [];
  var mk = function (opts) {
    var u = makeUnit(opts);
    u.routePts = pts;
    u.routeIdx = 0;
    u.isCaravan = true;
    members.push(u);
    units.push(u);
    return u;
  };
  mk({
    faction: 'town', name: randName(),
    x: pts[0].x + rand(-30, 30), y: pts[0].y + rand(-30, 30),
    maxHp: 110, speed: 78, aggro: 0,
    weapon: WEAPONS.stick, tierName: '商队头领',
    lootMin: 140, lootMax: 260,
    bodyColor: '#c8a05a', hairColor: '#3a2c1e',
    homePoint: { x: pts[0].x, y: pts[0].y },
    skills: { str: 10, tgh: 10, dodge: 10, melee: 10 }
  });
  for (var g = 0; g < 2; g++) {
    mk({
      faction: 'town', name: randName(),
      x: pts[0].x + rand(-46, 46), y: pts[0].y + rand(-46, 46),
      maxHp: 115, speed: 80, aggro: 240,
      weapon: g ? WEAPONS.spear : WEAPONS.iron,
      armor: ARMORS.leather, tierName: '商队护卫',
      lootMin: 40, lootMax: 90,
      bodyColor: FACTION_COLOR.town, hairColor: '#4a342a',
      homePoint: { x: pts[0].x, y: pts[0].y },
      skills: { str: 14, tgh: 13, dodge: 12, melee: 15 }
    });
  }
  caravan = { members: members, attacked: false, fromName: fromTown.name, toName: toTown.name };
  caravansSpawned++;
  log('一支商队从 ' + fromTown.name + ' 出发前往 ' + toTown.name + '——护卫有赏，劫掠发财。', 'sys');
}

function updateCaravan(dt) {
  /* 未激活：计时生成 */
  if (!caravan) {
    caravanTimer -= dt;
    if (caravanTimer <= 0) { spawnCaravan(); caravanTimer = rand(110, 170); }
    return;
  }
  var alive = [];
  var leader = null;
  for (var i = 0; i < caravan.members.length; i++) {
    var m = caravan.members[i];
    if (m.state !== 'dead') alive.push(m);
    /* 玩家下手 → 劫掠判定（战斗系统会把 lastAttacker 挂在受害者身上） */
    if (m.lastAttacker && m.lastAttacker.faction === 'player' && m.faction === 'town') {
      caravan.attacked = true;
    }
    if (m.tierName === '商队头领' && m.state !== 'dead') leader = m;
  }
  if (!alive.length || !leader) {
    caravan = null;           /* 全灭：尸体与掉落留给玩家 */
    return;
  }
  /* 沿道路折线行进 */
  for (var j = 0; j < alive.length; j++) {
    var c = alive[j];
    if (isDown(c)) continue;
    if (c.attackTarget) continue;   /* 正在战斗：交给战斗系统 */
    var pt = c.routePts[Math.min(c.routeIdx, c.routePts.length - 1)];
    if (dist(c, pt) < 34) {
      c.routeIdx++;
      if (c.routeIdx >= c.routePts.length) { arriveCaravan(); return; }
      pt = c.routePts[c.routeIdx];
    }
    moveToward(c, pt.x, pt.y, dt);
  }
}

function arriveCaravan() {
  var cen = squadCentroid();
  var leader = null;
  for (var i = 0; i < caravan.members.length; i++) {
    var m = caravan.members[i];
    if (m.tierName === '商队头领') leader = m;
  }
  if (!caravan.attacked && cen && leader && dist(cen, leader) < 420) {
    res.cats += 60;
    res.rep[0] += 3;
    log('商队安全抵达 ' + caravan.toName + '！头领付给你 60 猫护卫费，枢纽镇声望 +3', 'gold');
    addText(leader.x, leader.y - 40, '+60 猫 护卫费', '#ffd97a');
    sfx('coin');
  } else if (caravan.attacked) {
    log('遭劫后的商队跌跌撞撞抵达了 ' + caravan.toName + '。', 'sys');
  }
  /* 人马退场（含尸体一并清理，避免残骸堆积在路上） */
  for (var k = 0; k < caravan.members.length; k++) {
    var idx = units.indexOf(caravan.members[k]);
    if (idx >= 0) units.splice(idx, 1);
  }
  caravan = null;
}

/* ---------------- T134: 危险纵深区（地图边缘）红雾警示 ---------------- */
function updateDangerEdge(dt) {
  if (!started) return;
  var cen = squadCentroid();
  if (!cen) return;
  var minD = Math.min(cen.x, cen.y, WORLD.w - cen.x, WORLD.h - cen.y);
  dangerEdgeF = clamp(1 - minD / 700, 0, 1);
  if (dangerEdgeF > 0.55 && gameTime > dangerLogCool) {
    dangerLogCool = gameTime + 25;
    log('警告：正在深入危险纵深区——匪患与荒兽出没，随时可能遇袭', 'bad');
  }
}
var dangerEdgeF = 0;

/* T134: 边缘红雾（屏幕空间径向渐变） */
function drawDangerEdge() {
  if (dangerEdgeF <= 0.02 || R3D_active) return;
  var pulse = 0.75 + 0.25 * Math.sin(gameTime * 2.4);
  var a = dangerEdgeF * 0.42 * pulse;
  var cxp = W / 2, cyp = H / 2;
  var innerR = Math.min(W, H) * 0.32;
  var outerR = Math.sqrt(W * W + H * H) * 0.62;
  var g = ctx.createRadialGradient(cxp, cyp, innerR, cxp, cyp, outerR);
  g.addColorStop(0, 'rgba(150,20,10,0)');
  g.addColorStop(1, 'rgba(150,20,10,' + a.toFixed(3) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/* ---------------- 匪帮锚点记录（供情报贩子 T137 使用） ---------------- */
function recordBanditAnchors(beforeLen) {
  for (var i = beforeLen; i < units.length; i++) {
    var f = units[i].faction;
    if (f === 'bandit' || f === 'hungry') {
      banditAnchors.push({ x: units[i].x, y: units[i].y, t: gameTime });
      if (banditAnchors.length > 30) banditAnchors.shift();
    }
  }
}

/* ---------------- T140: 狼巢定向刷新 + 清剿悬赏 ---------------- */
function initDens() {
  dens = [];
  if (!terrain) return;
  for (var i = 0; i < terrain.wolfDens.length; i++) {
    var d = terrain.wolfDens[i];
    dens.push({ x: d.x, y: d.y, r: d.r, threatened: false, coolUntil: 0 });
  }
}
function beastsNear(x, y, rad) {
  for (var i = 0; i < units.length; i++) {
    var u = units[i];
    if (u.faction !== 'beast' || u.state === 'dead') continue;
    if (dist(u, { x: x, y: y }) < rad) return true;
  }
  return false;
}
function spawnBeastPackAtDen() {
  /* 挑一个没野兽且过了冷却的巢；以巢为中心定向生成 */
  var cand = null;
  for (var i = 0; i < dens.length; i++) {
    var dn = dens[i];
    if (gameTime < dn.coolUntil) continue;
    if (beastsNear(dn.x, dn.y, 340)) continue;
    cand = dn; break;
  }
  if (!cand) return 0;
  var before = units.length;
  var n = SpawnerSys.spawnBeastPack(spawnerCtxAt(cand.x, cand.y, 120, 60, 240));
  if (n > 0 && started) sfx('howl');
  cand.threatened = true;
  recordBanditAnchors(before);
  return n;
}
var denRewardCool = 0;
function updateDenRewards(dt) {
  /* 节流 2s：清剿判定——曾有兽、现在没了 → 悬赏兑现 */
  denRewardCool -= dt;
  if (denRewardCool > 0) return;
  denRewardCool = 2;
  for (var i = 0; i < dens.length; i++) {
    var dn = dens[i];
    if (!dn.threatened) continue;
    if (beastsNear(dn.x, dn.y, 340)) continue;
    dn.threatened = false;
    dn.coolUntil = gameTime + rand(70, 120);
    res.cats += 45;
    res.rep[0] += 2;
    log('附近城镇的悬赏兑现了：狼巢已清剿（+45 猫，枢纽镇声望 +2）', 'gold');
    addText(dn.x, dn.y - 30, '赏金 +45', '#ffd97a');
    sfx('coin');
  }
}

/* ---------------- T142: 地标首访系统 ---------------- */
function landmarkList() {
  if (!terrain) return [];
  var out = [];
  for (var i = 0; i < towns.length; i++) out.push({ id: 'town' + i, name: towns[i].name, x: towns[i].x, y: towns[i].y, r: towns[i].r });
  for (var m = 0; m < terrain.merchantCamps.length; m++) out.push({ id: 'camp' + m, name: '荒原游商营地', x: terrain.merchantCamps[m].x, y: terrain.merchantCamps[m].y, r: terrain.merchantCamps[m].r });
  for (var t = 0; t < terrain.towers.length; t++) out.push({ id: 'tower' + t, name: '废墟塔楼', x: terrain.towers[t].x, y: terrain.towers[t].y, r: terrain.towers[t].r });
  for (var d = 0; d < terrain.wolfDens.length; d++) out.push({ id: 'den' + d, name: '狼巢', x: terrain.wolfDens[d].x, y: terrain.wolfDens[d].y, r: terrain.wolfDens[d].r });
  return out;
}
function updateLandmarks(dt) {
  landmarkCheckCool -= dt;
  if (landmarkCheckCool > 0) return;
  landmarkCheckCool = 0.5;
  var cen = squadCentroid();
  if (!cen) return;
  var marks = landmarkList();
  for (var i = 0; i < marks.length; i++) {
    var mk = marks[i];
    if (discovered[mk.id]) continue;
    if (dist(cen, mk) < mk.r + 160) {
      discovered[mk.id] = true;
      log('你发现了「' + mk.name + '」', 'gold');
      addText(cen.x, cen.y - 46, '发现 ' + mk.name, '#ffd97a');
      addRing(mk.x, mk.y);
      sfx('lvl');
    }
  }
}

/* ---------------- T144: M 键大地图 ---------------- */
function toggleBigMap() {
  mapOpen = !mapOpen;
  sfx('ui');
}
function bigMapBiomeLayer(sizePx) {
  /* 群系底图缓存（按尺寸缓存一份） */
  if (bigMapCanvas && bigMapSize === sizePx) return bigMapCanvas;
  var c = document.createElement('canvas');
  c.width = sizePx; c.height = sizePx;
  var g = c.getContext('2d');
  if (terrain) {
    var N = 96, cs = sizePx / N;
    for (var iy = 0; iy < N; iy++) {
      for (var ix = 0; ix < N; ix++) {
        var b = terrain.biomeAt((ix + 0.5) / N * WORLD.w, (iy + 0.5) / N * WORLD.h);
        g.fillStyle = terrain.palettes[b].base;
        g.fillRect(ix * cs, iy * cs, cs + 1, cs + 1);
      }
    }
    /* 道路 */
    g.strokeStyle = 'rgba(90,70,40,.8)';
    g.lineWidth = Math.max(2, sizePx / 220);
    for (var r = 0; r < terrain.roads.length; r++) {
      var pts = terrain.roads[r].pts;
      g.beginPath();
      g.moveTo(pts[0].x / WORLD.w * sizePx, pts[0].y / WORLD.h * sizePx);
      for (var p = 1; p < pts.length; p++) g.lineTo(pts[p].x / WORLD.w * sizePx, pts[p].y / WORLD.h * sizePx);
      g.stroke();
    }
  } else {
    g.fillStyle = '#1b150c';
    g.fillRect(0, 0, sizePx, sizePx);
  }
  bigMapCanvas = c;
  bigMapSize = sizePx;
  return c;
}
function drawBigMap() {
  if (!mapOpen) return;
  ctx.fillStyle = 'rgba(6,4,2,.78)';
  ctx.fillRect(0, 0, W, H);
  var size = Math.min(W, H) - 90;
  var ox = (W - size) / 2, oy = (H - size) / 2;
  ctx.drawImage(bigMapBiomeLayer(Math.floor(size)), ox, oy);
  var k = size / WORLD.w;
  var mark = function (x, y, col, r2) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(ox + x * k, oy + y * k, r2 || 4, 0, TAU); ctx.fill();
  };
  /* 已发现地标才显示（未发现的不画）——Kenshi 式探索感 */
  var marks = landmarkList();
  for (var i = 0; i < marks.length; i++) {
    var mk = marks[i];
    if (!discovered[mk.id]) continue;
    var col = mk.id.indexOf('town') === 0 ? '#ffd97a'
      : mk.id.indexOf('camp') === 0 ? '#ffffff'
      : mk.id.indexOf('tower') === 0 ? '#a03428' : '#b06ad0';
    mark(mk.x, mk.y, col, 5);
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8dcc4';
    ctx.fillText(mk.name, ox + mk.x * k, oy + mk.y * k - 9);
  }
  /* 小废墟点（发现过的区域不细分，统一灰点） */
  if (terrain) {
    ctx.fillStyle = 'rgba(150,110,80,.75)';
    for (var ri = 0; ri < terrain.ruins.length; ri++) {
      if (terrain.ruins[ri].type === 'tower') continue;
      ctx.fillRect(ox + terrain.ruins[ri].x * k - 1.5, oy + terrain.ruins[ri].y * k - 1.5, 3, 3);
    }
  }
  /* 玩家位置 */
  var cen = squadCentroid();
  if (cen) {
    mark(cen.x, cen.y, '#7fe06a', 5);
    ctx.strokeStyle = 'rgba(127,224,106,.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ox + cen.x * k, oy + cen.y * k, 9, 0, TAU); ctx.stroke();
  }
  /* 情报标记 */
  if (intelPing && gameTime < intelPing.until) {
    ctx.strokeStyle = 'rgba(255,70,50,.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ox + intelPing.x * k, oy + intelPing.y * k, 10 + Math.sin(gameTime * 6) * 3, 0, TAU);
    ctx.stroke();
  }
  /* 标题与图例 */
  ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5e6bd';
  ctx.fillText('尘 陆 大 地 图', W / 2, oy - 26);
  ctx.font = '12px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#a4977c';
  ctx.fillText('金=城镇 · 白=游商 · 红=塔楼 · 紫=狼巢 · 绿点=小队 · 红圈=匪情　（M / Esc 关闭）', W / 2, H - 28);
}

function checkGameOver() {
  if (gameOver || !started) return;
  var sq = units.filter(function (u) { return u.faction === 'player'; });
  if (sq.length > 0) {
    var allDead = true;
    for (var i = 0; i < sq.length; i++) {
      if (sq[i].state !== 'dead') { allDead = false; break; }
    }
    if (allDead) {
      gameOver = true;
      elOverDays.textContent = day;
      elOver.classList.remove('hidden');
    }
  }
}

/* ---------------- HUD ---------------- */
function refreshHUD() {
  elCats.textContent = res.cats;
  elFood.textContent = res.food;
  elBandage.textContent = res.bandage;
  elKits.textContent = res.kits;
  elMats.textContent = res.mats;
  elDay.textContent = day;
  var b = brightness();
  elClock.textContent = b > 0.68 ? '☀ 白天' : (b > 0.32 ? '🌤 黄昏' : '🌙 夜晚');

  var u = null;
  for (var i = 0; i < selection.length; i++) {
    if (selection[i].faction === 'player') { u = selection[i]; break; }
  }
  if (!u) u = selection[0] || null;
  if (!u) { elPanel.classList.add('hidden'); return; }
  elPanel.classList.remove('hidden');

  elName.textContent = u.name;
  elTier.textContent = u.tierName || '';
  var cr = clamp(chestRatio(u), 0, 1);
  var hr = clamp(partRatio(u.body.head), 0, 1);
  elHp.style.width = (cr * 100) + '%';
  elHead.style.width = (hr * 100) + '%';
  elHunger.style.width = clamp(u.hunger, 0, 100) + '%';
  elSkStr.textContent = u.skills.str;
  elSkTgh.textContent = u.skills.tgh;
  elSkDodge.textContent = u.skills.dodge;
  elSkMelee.textContent = u.skills.melee;
  elEqWeapon.textContent = u.weapon.name;
  elEqArmor.textContent = u.armor ? u.armor.name : '无';

  var st = '';
  if (u.state === 'dead') st = '💀 阵亡';
  else if (isDown(u)) {
    st = u.body.chest.hp <= 0 ? '🩸 倒地流血中——派队友靠近按 R 救助！' : '😵 昏迷中——等待苏醒或按 R 救助';
  }
  else if (u.rescueChannel > 0) st = '⛑ 救助中…';
  else if (u.bandageChannel > 0) st = '🩹 包扎中…';
  else if (u.attackTarget) st = '⚔ 战斗中';
  else if (u.moveTarget) st = '➡ 移动中';

  var inj = [];
  for (var p = 0; p < PART_KEYS.length; p++) {
    var key = PART_KEYS[p];
    var pr = partRatio(u.body[key]);
    if (pr <= 0) inj.push(PART_NAMES[key] + '残废');
    else if (pr < 0.4) inj.push(PART_NAMES[key] + '重伤');
    else if (pr < 0.7) inj.push(PART_NAMES[key] + '轻伤');
  }
  if (inj.length) st += (st ? '　' : '') + '⚠ ' + inj.join('、');
  if (u.hunger <= 0) st += (st ? '　' : '') + '⚠ 饥饿!';
  elStatus.textContent = st;

  /* 动态提示条：新手引导 → 建造模式 → 默认 */
  if (elHintEl) {
    if (buildMode === 1) elHintEl.textContent = '🧱 建造围墙：左键放置（1建材）· 右键/Esc 退出 · B 切换';
    else if (buildMode === 2) elHintEl.textContent = '🔥 放置篝火：左键放置（1建材）· 右键/Esc 退出 · B 切换';
    else if (tutorial === 0) elHintEl.textContent = '👉 第一步：用【左键】点击你的角色（蓝色）选中他';
    else if (tutorial === 1) elHintEl.textContent = '👍 选中了！【左键或右键】点击地面，角色就会走过去';
    else if (tutorial === 2) elHintEl.textContent = '⚔ 第三步：靠近敌人后，【右键】点击敌人即可攻击';
    else if (tutorial === 3) elHintEl.textContent = '🏕 第四步：走进城镇虚线圈内按【E】打开商店/招募';
    else elHintEl.textContent = DEFAULT_HINT;
  }

  drawBodyDiagram(u);
}

function partColor(pr) {
  if (pr >= 0.7) return '#6fbf5a';
  if (pr >= 0.4) return '#e0c050';
  if (pr > 0) return '#e0604c';
  return '#3a3530';
}

function drawBodyDiagram(u) {
  var g = bctx;
  g.clearRect(0, 0, 96, 112);
  g.strokeStyle = '#57482e';
  g.lineWidth = 1.5;
  var parts = [
    { key: 'head',  draw: function (col) { g.fillStyle = col; g.beginPath(); g.arc(48, 16, 11, 0, TAU); g.fill(); g.stroke(); } },
    { key: 'chest', draw: function (col) { g.fillStyle = col; g.beginPath(); g.rect(36, 30, 24, 28); g.fill(); g.stroke(); } },
    { key: 'armL',  draw: function (col) { g.fillStyle = col; g.beginPath(); g.rect(20, 30, 12, 30); g.fill(); g.stroke(); } },
    { key: 'armR',  draw: function (col) { g.fillStyle = col; g.beginPath(); g.rect(64, 30, 12, 30); g.fill(); g.stroke(); } },
    { key: 'legL',  draw: function (col) { g.fillStyle = col; g.beginPath(); g.rect(37, 62, 10, 36); g.fill(); g.stroke(); } },
    { key: 'legR',  draw: function (col) { g.fillStyle = col; g.beginPath(); g.rect(49, 62, 10, 36); g.fill(); g.stroke(); } }
  ];
  for (var i = 0; i < parts.length; i++) {
    var pr = partRatio(u.body[parts[i].key]);
    parts[i].draw(partColor(pr));
  }
  g.fillStyle = 'rgba(232,220,192,.75)';
  g.font = '10px "Microsoft YaHei", sans-serif';
  g.textAlign = 'center';
  g.fillText('身体状态', 48, 108);
}

var lastChipTime = 0;
function refreshSquadBar() {
  var now = performance.now();
  if (now - lastChipTime < HUD_MS) return;
  lastChipTime = now;
  var sq = livingSquad();
  var html = '';
  for (var i = 0; i < sq.length; i++) {
    var u = sq[i];
    var cls = 'chip';
    if (selection.indexOf(u) >= 0) cls += ' sel';
    if (isDown(u)) cls += ' down';
    var cr = clamp(chestRatio(u), 0, 1);
    var icon = '';
    if (isDown(u)) icon = u.body.chest.hp <= 0 ? '🩸' : '😵';
    else if (u.attackTarget) icon = '⚔';
    else if (u.bandageChannel > 0 || u.rescueChannel > 0) icon = '⛑';
    html += '<div class="' + cls + '" data-id="' + u.id + '">' +
            '<div class="chip-name"><span>' + u.name + '</span><span>' + icon + '</span></div>' +
            '<div class="chip-hp"><i style="width:' + (cr * 100).toFixed(0) + '%"></i></div>' +
            '</div>';
  }
  elSquadBar.innerHTML = html;
}

/* ---------------- 渲染 ---------------- */
var sandPattern = null;
function makeSandPattern() {
  var c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  var g = c.getContext('2d');
  g.fillStyle = '#c8ab74';
  g.fillRect(0, 0, 256, 256);
  var shades = ['#bd9f69', '#d2b57f', '#b3945f', '#c2a46e'];
  for (var i = 0; i < 46; i++) {
    g.fillStyle = shades[i % shades.length];
    g.globalAlpha = 0.5;
    g.beginPath();
    g.ellipse(rand(0, 256), rand(0, 256), rand(12, 44), rand(8, 26), rand(0, Math.PI), 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
  for (var j = 0; j < 160; j++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(90,70,40,.25)' : 'rgba(255,240,200,.25)';
    g.fillRect(rand(0, 256), rand(0, 256), 2, 2);
  }
  return ctx.createPattern(c, 'repeat');
}

function genDecor() {
  /* M5/T126: 装饰层由 Terrain.js 确定性生成（按群系分布，避开城镇/道路） */
  if (terrain) { decor = terrain.decor.slice(); return; }
  decor = [];
  for (var i = 0; i < 320; i++) {
    var x = rand(40, WORLD.w - 40), y = rand(40, WORLD.h - 40);
    if (!farFromTowns(x, y, 70)) continue;
    var roll = Math.random();
    decor.push({
      type: roll < 0.42 ? 'rock' : (roll < 0.72 ? 'tree' : (roll < 0.88 ? 'bones' : 'grass')),
      x: x, y: y,
      s: rand(0.7, 1.5),
      rot: rand(0, TAU)
    });
  }
}

function genTownBuildings() {
  for (var t = 0; t < towns.length; t++) {
    var town = towns[t];
    town.buildings = [];
    for (var i = 0; i < 6; i++) {
      var ang = i / 6 * TAU + 0.35;
      var rr = town.r * rand(0.45, 0.72);
      town.buildings.push({
        x: town.x + Math.cos(ang) * rr,
        y: town.y + Math.sin(ang) * rr,
        w: rand(48, 72), h: rand(38, 54)
      });
    }
  }
}

function buildObstacles() {
  obstacles = [];
  for (var t = 0; t < towns.length; t++) {
    var bs = towns[t].buildings || [];
    for (var i = 0; i < bs.length; i++) {
      obstacles.push({ x: bs[i].x, y: bs[i].y, r: Math.max(bs[i].w, bs[i].h) * 0.45 });
    }
    obstacles.push({ x: towns[t].x, y: towns[t].y, r: 16 });
  }
  /* M5/T126: 碰撞层——大石（decor.solid）也阻挡移动 */
  for (var d = 0; d < decor.length; d++) {
    if (decor[d].solid) obstacles.push({ x: decor[d].x, y: decor[d].y, r: 13 * decor[d].s });
  }
  /* T135: 枢纽镇围墙碰撞（大门缺口可通行） */
  if (towns.length > 1) {
    var t0 = towns[0];
    var ga = Math.atan2(towns[1].y - t0.y, towns[1].x - t0.x);
    var gapA = 0.46;   /* 比视觉缺口(0.34)略宽，避免门口卡碰撞 */
    var wrr = t0.r + 14;
    for (var wa = 0; wa < TAU - 0.01; wa += 0.17) {
      var diff = Math.abs(Math.atan2(Math.sin(wa - ga), Math.cos(wa - ga)));
      if (diff < gapA) continue;
      obstacles.push({
        x: t0.x + Math.cos(wa) * wrr,
        y: t0.y + Math.sin(wa) * wrr,
        r: 15
      });
    }
  }
}

function initMotes() {
  motes = [];
  for (var i = 0; i < 34; i++) {
    motes.push({
      x: cam.x + rand(-800, 800),
      y: cam.y + rand(-500, 500),
      vx: rand(-6, 16), vy: rand(-3, 3),
      size: rand(0.8, 2), a: rand(0.08, 0.22)
    });
  }
}

function inView(x, y, m) {
  return x > viewRect.x - m && x < viewRect.x + viewRect.w + m &&
         y > viewRect.y - m && y < viewRect.y + viewRect.h + m;
}

/* ============ M5/T126-T129: 三层地形渲染 ============
 * 底色层：512px 分块缓存画布，群系底色 + 噪声斑块 + 碎斑
 * 装饰层/碰撞层：genDecor/buildObstacles（见上）
 * 每帧最多同步绘制 2 块，未就绪块先以群系基色填充 */
var TCHUNK = 512;

function terrainChunkRng(cx, cy) {
  /* 块级确定性随机（mulberry32），保证同种子下地表稳定 */
  var t = (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^
    ((terrain ? terrain.seed : 1) | 0)) >>> 0;
  return function () {
    t += 0x6D2B79F5;
    var r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function paintTerrainChunk(cx, cy) {
  var c = document.createElement('canvas');
  c.width = TCHUNK; c.height = TCHUNK;
  var g = c.getContext('2d');
  var x0 = cx * TCHUNK, y0 = cy * TCHUNK;
  var CELL = 64, N = TCHUNK / CELL;
  var rng = terrainChunkRng(cx, cy);

  /* 1) 群系基色网格采样 */
  for (var iy = 0; iy < N; iy++) {
    for (var ix = 0; ix < N; ix++) {
      var wx = x0 + ix * CELL + CELL / 2, wy = y0 + iy * CELL + CELL / 2;
      var b = terrain.biomeAt(wx, wy);
      var pal = terrain.palettes[b];
      var pi = terrain.patchIndex(wx, wy, pal.patches.length);
      g.fillStyle = pal.patches[pi] || pal.base;
      g.fillRect(ix * CELL, iy * CELL, CELL, CELL);
    }
  }
  /* 2) 噪声斑块：跨格椭圆，打破网格感 */
  for (var p = 0; p < 26; p++) {
    var bx = x0 + rng() * TCHUNK, by = y0 + rng() * TCHUNK;
    var pb = terrain.biomeAt(bx, by);
    var ppal = terrain.palettes[pb];
    g.globalAlpha = 0.28 + rng() * 0.18;
    g.fillStyle = ppal.patches[Math.floor(rng() * ppal.patches.length)];
    g.beginPath();
    g.ellipse((bx - x0), (by - y0), 34 + rng() * 84, 20 + rng() * 52, rng() * Math.PI, 0, TAU);
    g.fill();
  }
  /* 3) 碎斑颗粒 */
  g.globalAlpha = 1;
  for (var s = 0; s < 120; s++) {
    var sb = terrain.palettes[terrain.biomeAt(x0 + rng() * TCHUNK, y0 + rng() * TCHUNK)];
    g.fillStyle = sb.speck[rng() < 0.5 ? 0 : 1];
    g.fillRect(rng() * TCHUNK, rng() * TCHUNK, 2, 2);
  }
  return c;
}

function getTerrainChunk(cx, cy) {
  var key = cx + ',' + cy;
  var c = terrainChunks.get(key);
  if (c) return c;
  if (terrainPaintCount >= 2) return null; /* 预算耗尽，本帧先用兜底色 */
  terrainPaintCount++;
  c = paintTerrainChunk(cx, cy);
  terrainChunks.set(key, c);
  if (terrainChunks.size > 48) {
    var first = terrainChunks.keys().next().value;
    terrainChunks.delete(first);
  }
  return c;
}

function drawTerrain() {
  terrainPaintCount = 0;
  if (!terrain) { /* 无 Terrain 模块时退回旧平铺图案 */ 
    ctx.fillStyle = sandPattern || '#c8ab74';
    ctx.fillRect(viewRect.x, viewRect.y, viewRect.w, viewRect.h);
  } else {
    var x0 = Math.floor(viewRect.x / TCHUNK), x1 = Math.floor((viewRect.x + viewRect.w) / TCHUNK);
    var y0 = Math.floor(viewRect.y / TCHUNK), y1 = Math.floor((viewRect.y + viewRect.h) / TCHUNK);
    for (var cy = y0; cy <= y1; cy++) {
      for (var cx = x0; cx <= x1; cx++) {
        var wx = cx * TCHUNK, wy = cy * TCHUNK;
        if (wx > WORLD.w || wy > WORLD.h || wx + TCHUNK < 0 || wy + TCHUNK < 0) continue;
        var c = getTerrainChunk(cx, cy);
        if (c) ctx.drawImage(c, wx, wy);
        else {
          /* 兜底：该块群系基色 */
          var bmid = terrain.biomeAt(wx + TCHUNK / 2, wy + TCHUNK / 2);
          ctx.fillStyle = terrain.palettes[bmid].base;
          ctx.fillRect(Math.max(wx, 0), Math.max(wy, 0),
            Math.min(TCHUNK, WORLD.w - wx), Math.min(TCHUNK, WORLD.h - wy));
        }
      }
    }
  }
  /* 世界边界之外更暗（evenodd 只画世界矩形以外的区域） */
  var m = 400;
  ctx.save();
  ctx.beginPath();
  ctx.rect(viewRect.x, viewRect.y, viewRect.w, viewRect.h);
  ctx.rect(0, 0, WORLD.w, WORLD.h);
  ctx.clip('evenodd');
  ctx.fillStyle = 'rgba(8,6,3,.85)';
  ctx.fillRect(viewRect.x - m, viewRect.y - m, viewRect.w + m * 2, viewRect.h + m * 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(60,45,25,.8)';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, WORLD.w, WORLD.h);
}

/* T130: 道路网络（纯视觉引导；未来商队寻路可复用 pts） */
function drawRoads() {
  if (!terrain || !terrain.roads.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (var r = 0; r < terrain.roads.length; r++) {
    var pts = terrain.roads[r].pts;
    /* 视口剔除：任一点在视野内即绘制 */
    var vis = false;
    for (var i = 0; i < pts.length; i++) {
      if (inView(pts[i].x, pts[i].y, 300)) { vis = true; break; }
    }
    if (!vis) continue;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
    ctx.strokeStyle = 'rgba(70,55,30,.30)';
    ctx.lineWidth = 46;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(152,127,82,.40)';
    ctx.lineWidth = 32;
    ctx.stroke();
    ctx.setLineDash([26, 22]);
    ctx.strokeStyle = 'rgba(210,185,130,.25)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/* T131/T133: 废墟点位渲染（残墙+板条箱；塔楼=断塔；冷却中变暗淡） */
function drawRuins() {
  if (!terrain) return;
  for (var i = 0; i < terrain.ruins.length; i++) {
    var ru = terrain.ruins[i];
    if (!inView(ru.x, ru.y, 200)) continue;
    var cooling = gameTime < ru.coolUntil;
    var rng = terrainChunkRng(ru.x | 0, ru.y | 0);
    ctx.save();
    ctx.translate(ru.x, ru.y);
    ctx.globalAlpha = cooling ? 0.45 : 0.95;
    if (ru.type === 'tower') {
      /* T133: 断塔——两段残墙 + 塔基 */
      ctx.fillStyle = '#6e675e';
      ctx.fillRect(-34, -18, 68, 30);            /* 塔基 */
      ctx.fillStyle = '#7d766c';
      ctx.fillRect(-26, -78, 22, 62);            /* 左残墙 */
      ctx.fillStyle = '#8d857a';
      ctx.fillRect(4, -58, 20, 42);              /* 右残墙 */
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.fillRect(-26, -24, 22, 8);
      ctx.fillRect(4, -22, 20, 8);
      ctx.strokeStyle = '#4f483e';
      ctx.lineWidth = 2;
      ctx.strokeRect(-34, -18, 68, 30);
      /* 门洞 */
      ctx.fillStyle = '#2c261c';
      ctx.fillRect(-9, -14, 18, 26);
    } else {
      for (var w = 0; w < 5; w++) {
        var a = rng() * TAU, rr = 24 + rng() * 46;
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = '#8d857a';
        ctx.fillRect(rr, -6 - rng() * 8, 14 + rng() * 12, 12 + rng() * 10);
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.fillRect(rr, 4, 14 + rng() * 12, 4);
        ctx.restore();
      }
      ctx.fillStyle = '#7a5f38';
      ctx.fillRect(-10, -8, 22, 18);
      ctx.strokeStyle = '#5b4426';
      ctx.lineWidth = 2;
      ctx.strokeRect(-10, -8, 22, 18);
      ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(12, 10); ctx.stroke();
    }
    /* 可搜索时的微光标记 */
    if (!cooling) {
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(gameTime * 3);
      ctx.fillStyle = '#ffd97a';
      ctx.beginPath(); ctx.arc(0, ru.type === 'tower' ? -92 : -26, 3.2, 0, TAU); ctx.fill();
    }
    ctx.restore();

    /* T138: 搜索进度弧 */
    if (scavChan && scavChan.ruin === ru) {
      var fr = clamp(scavChan.t / scavChan.dur, 0, 1);
      ctx.strokeStyle = 'rgba(0,0,0,.45)';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(ru.x, ru.y - (ru.type === 'tower' ? 100 : 40), 16, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#ffd97a';
      ctx.beginPath();
      ctx.arc(ru.x, ru.y - (ru.type === 'tower' ? 100 : 40), 16, -Math.PI / 2, -Math.PI / 2 + fr * TAU);
      ctx.stroke();
    }
  }
}

/* T132: 荒原游商营地渲染 */
function drawMerchantCamps() {
  if (!terrain) return;
  for (var i = 0; i < terrain.merchantCamps.length; i++) {
    var c = terrain.merchantCamps[i];
    if (!inView(c.x, c.y, 180)) continue;
    ctx.save();
    ctx.translate(c.x, c.y);
    /* 帐篷 */
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(0, 14, 46, 12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#96713d';
    ctx.beginPath();
    ctx.moveTo(-42, 12); ctx.lineTo(0, -44); ctx.lineTo(42, 12); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#74572c';
    ctx.beginPath();
    ctx.moveTo(-10, 12); ctx.lineTo(0, -12); ctx.lineTo(10, 12); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b98a4a';
    ctx.fillRect(-38, 4, 76, 8);
    /* 货箱 */
    ctx.fillStyle = '#7a5f38';
    ctx.fillRect(52, -2, 20, 16);
    ctx.strokeStyle = '#5b4426';
    ctx.strokeRect(52, -2, 20, 16);
    ctx.restore();
    /* 名牌与提示 */
    ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.strokeText('游商营地', c.x, c.y - 58);
    ctx.fillStyle = '#ffd97a';
    ctx.fillText('游商营地', c.x, c.y - 58);
    if (started && nearestDistToSelection(c) < 130) {
      ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
      ctx.strokeText('[E] 交易', c.x, c.y - 40);
      ctx.fillStyle = '#ffe9ad';
      ctx.fillText('[E] 交易', c.x, c.y - 40);
    }
  }
}
function nearestDistToSelection(pt) {
  var best = Infinity;
  for (var i = 0; i < selection.length; i++) {
    if (selection[i].state === 'dead') continue;
    best = Math.min(best, dist(selection[i], pt));
  }
  return best;
}

function drawDecor() {
  for (var i = 0; i < decor.length; i++) {
    var d = decor[i];
    if (!inView(d.x, d.y, 60)) continue;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.scale(d.s, d.s);
    if (d.type === 'rock') {
      ctx.fillStyle = '#8f7f63';
      ctx.strokeStyle = '#6e6149';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-12, 4);
      ctx.lineTo(-6, -9);
      ctx.lineTo(5, -11);
      ctx.lineTo(13, -2);
      ctx.lineTo(8, 7);
      ctx.lineTo(-5, 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (d.type === 'tree') {
      ctx.strokeStyle = '#4a3a28';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(0, -14);
      ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(-11, -18);
      ctx.moveTo(0, -10); ctx.lineTo(10, -21);
      ctx.moveTo(0, -2); ctx.lineTo(12, -8);
      ctx.stroke();
    } else if (d.type === 'grass') {
      ctx.strokeStyle = 'rgba(150,130,80,.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, 2); ctx.quadraticCurveTo(-7, -6, -3, -9);
      ctx.moveTo(0, 3); ctx.quadraticCurveTo(1, -7, 5, -10);
      ctx.moveTo(5, 3); ctx.quadraticCurveTo(8, -4, 11, -6);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(235,225,205,.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-5, 0, 6, 0.4, 2.6);
      ctx.moveTo(6, 3);
      ctx.lineTo(14, -3);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawTowns() {
  for (var t = 0; t < towns.length; t++) {
    var town = towns[t];
    if (!inView(town.x, town.y, town.r + 120)) continue;
    ctx.fillStyle = 'rgba(214,188,142,.4)';
    ctx.beginPath();
    ctx.ellipse(town.x, town.y, town.r * 0.92, town.r * 0.86, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#7a6540';
    ctx.lineWidth = 5;
    ctx.setLineDash([16, 10]);
    ctx.beginPath();
    ctx.arc(town.x, town.y, town.r, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    for (var i = 0; i < town.buildings.length; i++) {
      var b = town.buildings[i];
      ctx.fillStyle = '#6b5638';
      ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      ctx.fillStyle = '#8a7040';
      ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, 7);
      ctx.fillStyle = '#3a2f1c';
      ctx.fillRect(b.x - 6, b.y + b.h / 2 - 14, 12, 14);
    }
    ctx.fillStyle = '#8f8272';
    ctx.beginPath();
    ctx.arc(town.x, town.y, 13, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3a3126';
    ctx.beginPath();
    ctx.arc(town.x, town.y, 7, 0, TAU);
    ctx.fill();
    var sx = town.x + 60, sy = town.y - 70;
    ctx.fillStyle = '#5d4a28';
    ctx.fillRect(sx - 26, sy - 4, 52, 22);
    for (var s = 0; s < 5; s++) {
      ctx.fillStyle = s % 2 ? '#ddd0b0' : '#b8503c';
      ctx.fillRect(sx - 30 + s * 12, sy - 14, 12, 8);
    }
    ctx.font = 'bold 17px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.strokeText(town.name, town.x, town.y - town.r - 16);
    ctx.fillStyle = '#f5e6bd';
    ctx.fillText(town.name, town.x, town.y - town.r - 16);
    if (nearestTownOfSelection(175) === town && started) {
      var pulse = 0.6 + 0.4 * Math.sin(gameTime * 5);
      ctx.globalAlpha = pulse;
      ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
      ctx.strokeText('[E] 商店 · 招募', sx, sy - 24);
      ctx.fillStyle = '#ffe9ad';
      ctx.fillText('[E] 商店 · 招募', sx, sy - 24);
      ctx.globalAlpha = 1;
    }
    /* T135/T137: 枢纽镇专属——围墙大门 + 情报贩子 */
    if (t === 0) {
      drawHubWall(town);
      var bp = brokerPos();
      ctx.save();
      ctx.translate(bp.x, bp.y);
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath(); ctx.ellipse(0, 8, 10, 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#54466b';
      ctx.beginPath(); ctx.arc(0, -2, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3d3352';
      ctx.beginPath(); ctx.arc(0, -6, 6, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#e8c56a';
      ctx.beginPath(); ctx.arc(2.5, -5, 1.3, 0, TAU); ctx.fill();
      ctx.restore();
      if (started && nearestDistToSelection(bp) < 110) {
        ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,.6)';
        ctx.strokeText('[E] 情报（40猫）', bp.x, bp.y - 22);
        ctx.fillStyle = '#d8c6ff';
        ctx.fillText('[E] 情报（40猫）', bp.x, bp.y - 22);
      }
    }
  }
}

/* T135: 枢纽镇围墙（朝世界之角方向留大门缺口） */
function drawHubWall(town) {
  if (!towns[1]) return;
  var ga = Math.atan2(towns[1].y - town.y, towns[1].x - town.x);
  var gap = 0.34;
  var rr = town.r + 14;
  ctx.strokeStyle = '#77694f';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(town.x, town.y, rr, ga + gap, ga - gap + TAU);
  ctx.stroke();
  ctx.strokeStyle = '#9c8c68';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(town.x, town.y, rr + 4, ga + gap, ga - gap + TAU);
  ctx.stroke();
  for (var s = -1; s <= 1; s += 2) {
    var pa = ga + s * gap;
    var px = town.x + Math.cos(pa) * rr, py = town.y + Math.sin(pa) * rr;
    ctx.fillStyle = '#5a4c34';
    ctx.fillRect(px - 9, py - 9, 18, 18);
    ctx.strokeStyle = '#3f3421';
    ctx.lineWidth = 2;
    ctx.strokeRect(px - 9, py - 9, 18, 18);
  }
}

function drawDecals() {
  for (var i = 0; i < decals.length; i++) {
    var d = decals[i];
    if (!inView(d.x, d.y, 40)) continue;
    ctx.fillStyle = 'rgba(122,22,16,.3)';
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, d.r, d.r * 0.55, 0, 0, TAU);
    ctx.fill();
  }
}

function drawMotes() {
  for (var i = 0; i < motes.length; i++) {
    var mo = motes[i];
    if (!inView(mo.x, mo.y, 10)) continue;
    ctx.fillStyle = 'rgba(215,195,155,' + mo.a + ')';
    ctx.beginPath();
    ctx.arc(mo.x, mo.y, mo.size, 0, TAU);
    ctx.fill();
  }
}

function drawLootBags() {
  for (var i = 0; i < loot.length; i++) {
    var l = loot[i];
    if (!inView(l.x, l.y, 30)) continue;
    var bob = Math.sin(gameTime * 4 + l.x) * 1.5;
    ctx.globalAlpha = l.life < LIFE.LOOT_FADE_AT ? l.life / LIFE.LOOT_FADE_AT : 1;
    ctx.fillStyle = '#8a6a3c';
    ctx.beginPath();
    ctx.arc(l.x, l.y + bob, 8, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#5d4525';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(l.x - 3, l.y - 6 + bob);
    ctx.lineTo(l.x + 3, l.y - 6 + bob);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/* ---- 人物绘制 v3：方向化小人（正面/侧面/背面 · 行走 · 攻击 · 倒地） ---- */
function shadeCol(hex, amt) {
  var n = parseInt(hex.slice(1), 16);
  var r = clamp((n >> 16) + amt, 0, 255);
  var g = clamp(((n >> 8) & 255) + amt, 0, 255);
  var b = clamp((n & 255) + amt, 0, 255);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

/* 把朝向角量化为 视图(正/背/侧) + 是否镜像 */
function facingView(u) {
  var a = ((u.face % TAU) + TAU) % TAU;
  var oct = Math.round(a / (Math.PI / 4)) % 8; /* 0右 1右下 2下 3左下 4左 5左上 6上 7右上 */
  if (oct === 2) return { view: 'front', flip: false };
  if (oct === 6) return { view: 'back', flip: false };
  if (oct === 0 || oct === 7 || oct === 1) return { view: 'side', flip: false };
  return { view: 'side', flip: true };
}

/* 带描边的圆形关节肢体线 */
function limbLine(x1, y1, x2, y2, w, col) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#241d15';
  ctx.lineWidth = w + 1.6;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

/* 带膝盖弯曲的腿（二次曲线） */
function legCurve(hx, hy, fx, fy, bend, w, col) {
  var mx = (hx + fx) / 2 + bend, my = (hy + fy) / 2 + 1;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#241d15';
  ctx.lineWidth = w + 1.6;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(mx, my, fx, fy); ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(mx, my, fx, fy); ctx.stroke();
}

/* 手中武器（局部坐标，0 弧度 = 朝向前方） */
function drawHeldWeapon(wx, wy, ang, u, flash) {
  var w = u.weapon;
  if (w.key === 'fists' || w.key === 'bite') return;
  var blade = flash ? '#ffffff' : (w.key === 'katana' ? '#e8edf4' : '#c9ced6');
  ctx.save();
  ctx.translate(wx, wy);
  ctx.rotate(ang);
  var L = w.reach * 0.55;
  if (w.key === 'stick') {
    limbLine(0, 0, L, 0, 3, '#8a6a3c');
  } else if (w.key === 'iron') {
    limbLine(-2.5, 0, 2, 0, 3, '#4a3a28');
    limbLine(2, 0, 2 + L * 0.8, 0, 2.4, blade);
  } else if (w.key === 'katana') {
    limbLine(-2.5, 0, 2, 0, 3, '#4a3a28');
    ctx.strokeStyle = blade; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.quadraticCurveTo(2 + L * 0.5, -2.5, 2 + L, -0.5); ctx.stroke();
  } else if (w.key === 'spear') {
    limbLine(-4, 0, L, 0, 2, '#7a5c38');
    ctx.fillStyle = blade;
    ctx.beginPath(); ctx.moveTo(L, -2.6); ctx.lineTo(L + 6, 0); ctx.lineTo(L, 2.6); ctx.closePath(); ctx.fill();
  } else if (w.key === 'mace') {
    limbLine(0, 0, L * 0.75, 0, 2.6, '#5a4630');
    ctx.fillStyle = '#6f6f78';
    ctx.beginPath(); ctx.arc(L * 0.75 + 2.5, 0, 4, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3f3f47'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();
}

function drawHumanDir(u, bake) {
  var s = u.scale || 1;
  var flash = u.flashT > 0.08;
  var skin = flash ? '#ffffff' : u.headColor;
  var cloth = flash ? '#f0f0f0' : u.bodyColor;
  var clothD = flash ? '#dddddd' : shadeCol(u.bodyColor, -30);
  var pants = flash ? '#dddddd' : shadeCol(u.bodyColor, -48);
  var hairC = flash ? '#e8e8e8' : u.hairColor;
  var fv = facingView(u);

  var ph = u.walkT * 10;
  var sw = u.moving ? Math.sin(ph) : 0;
  var bob = u.moving ? Math.abs(Math.cos(ph)) * 1.4 : Math.sin(gameTime * 2.2 + u.id) * 0.5;

  var inCombat = !!u.attackTarget;
  var swingP = u.swingT > 0 ? 1 - u.swingT / 0.22 : -1;

  ctx.save();
  if (bake) {
    ctx.scale(fv.flip ? -1 : 1, 1);
  } else {
    ctx.translate(u.x, u.y);
    ctx.scale(s * (fv.flip ? -1 : 1), s);
  }

  if (fv.view === 'side') drawSide();
  else drawFrontBack(fv.view === 'front');

  ctx.restore();

  /* 挥砍弧（世界空间，跟随朝向）；烘焙缓存时跳过 */
  if (!bake && u.swingT > 0) {
    var a0 = u.face - 0.95 + swingP * 1.9;
    ctx.save();
    ctx.translate(u.x, u.y - 14 * s);
    ctx.strokeStyle = 'rgba(255,246,220,' + (u.swingT / 0.22 * 0.5).toFixed(3) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, u.weapon.reach * 0.5 + 8, a0 - 0.5, a0 + 0.15);
    ctx.stroke();
    ctx.restore();
  }

  function armorFill() {
    ctx.fillStyle = u.armor.key === 'chain' ? 'rgba(158,166,177,.95)' : 'rgba(140,108,70,.95)';
    ctx.strokeStyle = '#241d15';
    ctx.lineWidth = 1;
  }

  function drawHeadSide(bob) {
    var hy = -26.5 + bob;
    ctx.fillStyle = hairC;
    ctx.strokeStyle = '#241d15'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0.4, hy, 5.1, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(2.5, hy + 0.7, 4, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(36,29,21,.4)'; ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#1c150e';
    ctx.beginPath(); ctx.arc(4.7, hy - 0.3, 0.75, 0, TAU); ctx.fill();
    if (u.tierName === '强盗头目') {
      ctx.fillStyle = '#b0342c';
      ctx.fillRect(-4.2, hy - 3.4, 9.4, 1.8);
    }
  }

  function drawSide() {
    var MET = '#a7adb6';
    var legFarC = u.limbState.legL === 'robo' ? MET : clothD;
    var armFarC = u.limbState.armL === 'robo' ? MET : clothD;
    /* 远侧腿（反相） */
    var fs = -sw;
    legCurve(-1, -12, -1 + fs * 4.5, -Math.max(0, -fs) * 2.2, 2.2, 3.2, legFarC);
    /* 远侧手臂 */
    limbLine(-0.5, -20 + bob, -0.5 - sw * 3.2, -11.5 + bob, 2.5, armFarC);
    /* 躯干 */
    ctx.fillStyle = cloth;
    ctx.strokeStyle = '#241d15'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-3.4, -21.5 + bob);
    ctx.quadraticCurveTo(3.8, -20.5 + bob, 3.2, -12.6 + bob);
    ctx.lineTo(-2.8, -12.2 + bob);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    /* 腰带 */
    ctx.fillStyle = '#3a2c1c';
    ctx.fillRect(-3, -14.6 + bob, 6.4, 1.8);
    if (u.armor) {
      armorFill();
      ctx.fillRect(-3.4, -20.4 + bob, 6.8, 5.6);
      ctx.strokeRect(-3.4, -20.4 + bob, 6.8, 5.6);
    }
    /* 近侧腿 */
    legCurve(1, -12, 1 + sw * 4.5, -Math.max(0, sw) * 2.2, 2.4, 3.4, u.limbState.legR === 'robo' ? '#a7adb6' : pants);
    /* 头 */
    drawHeadSide(bob);
    /* 近侧手臂 + 武器 */
    var hx, hy, wa;
    if (swingP >= 0) {
      wa = -1.35 + swingP * 2.35;
      hx = 2 + Math.cos(wa) * 7;
      hy = -15.5 + bob + Math.sin(wa) * 5;
    } else if (inCombat) {
      wa = 0.12; hx = 7.5; hy = -15.5 + bob;
    } else {
      wa = 0; hx = 1 + sw * 3.2; hy = -11.5 + bob;
    }
    limbLine(0.5, -20 + bob, hx, hy, 2.7, u.limbState.armR === 'robo' ? '#a7adb6' : cloth);
    drawHeldWeapon(hx + 1.5, hy, wa, u, flash);
  }

  function drawFrontBack(front) {
    var MET = '#a7adb6';
    /* 双腿 */
    legCurve(-2.1, -12, -2.1 + sw * 2.2, -Math.max(0, sw) * 2.4, front ? -1.3 : 1.3, 3.2, u.limbState.legL === 'robo' ? MET : pants);
    legCurve(2.1, -12, 2.1 - sw * 2.2, -Math.max(0, -sw) * 2.4, front ? 1.3 : -1.3, 3.2, u.limbState.legR === 'robo' ? MET : pants);
    /* 远侧手臂 */
    limbLine(-4.2, -20.5 + bob, -5.6 + sw * 1.6, -11.5 + bob, 2.5, u.limbState.armL === 'robo' ? MET : clothD);
    /* 躯干 */
    ctx.fillStyle = cloth;
    ctx.strokeStyle = '#241d15'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-4.6, -21.5 + bob);
    ctx.quadraticCurveTo(0, -23.2 + bob, 4.6, -21.5 + bob);
    ctx.lineTo(3.2, -12 + bob);
    ctx.lineTo(-3.2, -12 + bob);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2c1c';
    ctx.fillRect(-3.2, -14.8 + bob, 6.4, 1.8);
    if (u.armor) {
      armorFill();
      ctx.fillRect(-4.2, -21 + bob, 8.4, 6.4);
      ctx.strokeRect(-4.2, -21 + bob, 8.4, 6.4);
    }
    if (!front) {
      /* 背包——荒原旅人的味道 */
      ctx.fillStyle = shadeCol('#6b5638', -12);
      ctx.strokeStyle = '#241d15'; ctx.lineWidth = 1;
      ctx.fillRect(-2.6, -19.6 + bob, 5.2, 6.6);
      ctx.strokeRect(-2.6, -19.6 + bob, 5.2, 6.6);
    }
    /* 头 */
    var hyy = -27 + bob;
    ctx.fillStyle = skin;
    ctx.strokeStyle = '#241d15'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, hyy, 5, 0, TAU); ctx.fill(); ctx.stroke();
    if (front) {
      ctx.fillStyle = hairC;
      ctx.beginPath(); ctx.arc(0, hyy - 1.2, 5, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
      ctx.fillRect(-5, hyy - 2.4, 2, 3.6);
      ctx.fillRect(3, hyy - 2.4, 2, 3.6);
      ctx.fillStyle = '#1c150e';
      ctx.beginPath(); ctx.arc(-1.8, hyy + 0.3, 0.72, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(1.8, hyy + 0.3, 0.72, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = hairC;
      ctx.beginPath(); ctx.arc(0, hyy, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.09)';
      ctx.beginPath(); ctx.arc(-1.4, hyy - 1.6, 2.6, 0, TAU); ctx.fill();
    }
    if (u.tierName === '强盗头目') {
      ctx.fillStyle = '#b0342c';
      ctx.fillRect(-5, hyy - 3.8, 10, 1.8);
    }
    /* 近侧手臂 + 武器 */
    var hx, hy, wa;
    if (swingP >= 0) {
      wa = (front ? 0.6 : -0.6) + (front ? -1 : 1) * swingP * 1.7;
      hx = 5.4; hy = -15 + bob;
    } else if (inCombat) {
      wa = front ? -0.45 : 0.45; hx = 5.6; hy = -14.5 + bob;
    } else {
      wa = front ? 0.3 : -0.3; hx = 5.4 - sw * 1.6; hy = -11.5 + bob;
    }
    limbLine(4.2, -20.5 + bob, hx, hy, 2.7, u.limbState.armR === 'robo' ? '#a7adb6' : cloth);
    drawHeldWeapon(hx + (front ? 1.2 : -1.2), hy, wa, u, flash);
  }
}

/* 倒地 / 尸体姿势：躺平、流血抽搐 */
function drawLyingHuman(u, bake) {
  var s = u.scale || 1;
  var flash = u.flashT > 0.08;
  var ft = clamp((u.fallT || 0) * 3, 0, 1);
  var skin = flash ? '#ffffff' : u.headColor;
  var cloth = flash ? '#f0f0f0' : u.bodyColor;
  var pants = flash ? '#dddddd' : shadeCol(u.bodyColor, -48);
  var struggling = !bake && u.state !== 'dead' && u.body.chest.hp <= 0;

  ctx.save();
  if (!bake) {
    ctx.globalAlpha *= ft;
    ctx.translate(u.x, u.y);
    ctx.scale(s, s);
  }
  ctx.rotate(u.face);

  var tw = struggling ? Math.sin(gameTime * 3 + u.id) * 1.4 : 0;

  limbLine(-4, -3, -13, -6 + tw, 3.2, pants);
  limbLine(-4, 3, -12, 7, 3.2, pants);

  ctx.fillStyle = cloth;
  ctx.strokeStyle = '#241d15'; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 5.5, 0, 0, TAU);
  ctx.fill(); ctx.stroke();
  if (u.armor) {
    ctx.fillStyle = u.armor.key === 'chain' ? 'rgba(158,166,177,.9)' : 'rgba(140,108,70,.9)';
    ctx.beginPath(); ctx.ellipse(1, 0, 5.5, 4, 0, 0, TAU); ctx.fill();
  }

  limbLine(2, -4, 9, -8 - tw, 2.6, cloth);
  limbLine(1, 4, 7, 9, 2.6, cloth);

  ctx.fillStyle = skin;
  ctx.strokeStyle = '#241d15'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(11, 0, 4.6, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = flash ? '#dddddd' : u.hairColor;
  ctx.beginPath(); ctx.arc(9.4, -1.6, 4.3, Math.PI * 0.35, Math.PI * 1.5); ctx.closePath(); ctx.fill();

  ctx.restore();
}

function drawSlashArc(u, radius) {
  if (u.swingT <= 0) return;
  var p = 1 - u.swingT / 0.22;
  var a0 = -0.95 + p * 1.9;
  ctx.strokeStyle = 'rgba(255,246,220,' + (u.swingT / 0.22 * 0.5).toFixed(3) + ')';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, radius, a0 - 0.55, a0 + 0.12);
  ctx.stroke();
}

function drawHumanBody(u) {
  drawHumanDir(u);
}

function drawBeastBody(u) {
  var flash = u.flashT > 0.08;
  var ph = u.walkT * 12;
  var st = u.moving ? Math.sin(ph) * 4 : 0;

  // 四足
  ctx.fillStyle = '#3a3a40';
  ctx.beginPath(); ctx.arc(st, -5, 2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(-st, 5, 2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(8 + st, -4.5, 2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(8 - st, 4.5, 2, 0, TAU); ctx.fill();

  // 尾巴
  ctx.strokeStyle = flash ? '#fff' : u.bodyColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-13, 0);
  ctx.quadraticCurveTo(-19, Math.sin(gameTime * 6 + u.id) * 4, -23, Math.sin(gameTime * 6 + u.id) * 6);
  ctx.stroke();

  // 躯干
  ctx.fillStyle = flash ? '#ffffff' : u.bodyColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 7, 0, 0, TAU);
  ctx.fill();
  // 背毛
  ctx.strokeStyle = 'rgba(40,40,46,.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-8, -3); ctx.lineTo(8, -3);
  ctx.stroke();

  // 头 + 耳朵 + 吻部
  ctx.fillStyle = flash ? '#fff' : u.headColor;
  ctx.beginPath();
  ctx.moveTo(10, -5); ctx.lineTo(13, -10); ctx.lineTo(16, -4);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(10, 5); ctx.lineTo(13, 10); ctx.lineTo(16, 4);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(14, 0, 5.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a2a30';
  ctx.beginPath(); ctx.arc(18.5, 0, 2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e05050';
  ctx.beginPath(); ctx.arc(15.5, -2, 1, 0, TAU); ctx.fill();

  drawSlashArc(u, 18);
}

/* ---- 精灵帧缓存：同一外观+姿态只绘制一次，之后直接贴图（性能优化） ---- */
var spriteCache = new Map();

function unitSpriteKey(u) {
  var fv = facingView(u);
  var ph = ((u.walkT * 10) % TAU + TAU) % TAU;
  var step = Math.floor(ph / (TAU / 8));
  var swing = u.swingT > 0 ? Math.min(2, Math.floor((1 - u.swingT / 0.22) * 3)) : -1;
  var pose = u.state === 'dead' ? 'dead' : (isDown(u) ? 'down' : (u.moving ? 'w' + step : 'idle'));
  return (u.isBeast ? 'B' : 'H') + '|' + pose + '|' + fv.view + '|' + (fv.flip ? 1 : 0) + '|' +
    swing + '|' + (u.armor ? u.armor.key : '-') + '|' + u.bodyColor + '|' + u.headColor + '|' +
    u.hairColor + '|' + ((u.tierName === '强盗头目') ? 1 : 0) + '|' + ((u.flashT > 0.08) ? 1 : 0) +
    '|' + (u.isBeast ? Math.round((u.scale || 1) * 100) : 1);
}

function getUnitSprite(u) {
  var key = unitSpriteKey(u);
  var cv = spriteCache.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = 104;
  cv.height = 76;
  var saved = ctx;
  ctx = cv.getContext('2d');
  try {
    ctx.save();
    ctx.translate(52, 64);
    if (!u.isBeast) {
      if (u.state === 'dead' || isDown(u)) drawLyingHuman(u, true);
      else drawHumanDir(u, true);
    } else {
      if (isDown(u)) ctx.rotate(Math.PI / 2);
      ctx.scale(u.scale || 1, u.scale || 1);
      drawBeastBody(u);
    }
    ctx.restore();
  } finally {
    ctx = saved;
  }
  spriteCache.set(key, cv);
  if (spriteCache.size > 900) {
    spriteCache.delete(spriteCache.keys().next().value);
  }
  return cv;
}

function blitUnitSprite(u) {
  var cv = getUnitSprite(u);
  var sc = u.scale || 1;
  ctx.drawImage(cv, u.x - 52 * sc, u.y - 64 * sc, 104 * sc, 76 * sc);
}

function drawUnits() {
  var list = [];
  for (var i = 0; i < units.length; i++) {
    if (inView(units[i].x, units[i].y, 60)) list.push(units[i]);
  }
  list.sort(function (a, b) { return a.y - b.y; });

  for (var k = 0; k < list.length; k++) {
    var u = list[k];

    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath();
    ctx.ellipse(u.x, u.y + 9 * u.scale, 11 * u.scale, 5 * u.scale, 0, 0, TAU);
    ctx.fill();

    if (selection.indexOf(u) >= 0) {
      ctx.strokeStyle = '#9fe07a';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -gameTime * 20;
      ctx.beginPath();
      ctx.arc(u.x, u.y + 4, 17 * u.scale, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }

    if (u.state === 'dead') {
      ctx.globalAlpha = Math.max(0, 1 - u.deadT / 45) * 0.95;
      if (u.isBeast) {
        ctx.save();
        ctx.translate(u.x, u.y);
        ctx.rotate(u.face);
        ctx.fillStyle = '#6b6257';
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 6, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#8a8175';
        ctx.beginPath();
        ctx.arc(12, 0, 5, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else {
        blitUnitSprite(u);
      }
      ctx.globalAlpha = 1;
      continue;
    }

    var down = isDown(u);

    if (u.isBeast && down) {
      /* 倒地的狼（数量少，直接画） */
      ctx.save();
      ctx.translate(u.x, u.y);
      ctx.rotate(Math.PI / 2);
      ctx.scale(u.scale, u.scale);
      drawBeastBody(u);
      ctx.restore();
    } else {
      blitUnitSprite(u);
    }

    // 血条（胸腔）
    var cr = clamp(chestRatio(u), 0, 1);
    if ((cr < 1 && cr > 0) || selection.indexOf(u) >= 0) {
      var bx = u.x - 16, by = u.y - 27 * u.scale;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(bx, by, 32, 5);
      ctx.fillStyle = cr > 0.5 ? '#7fd06a' : (cr > 0.25 ? '#e0c050' : '#e0604c');
      ctx.fillRect(bx + 1, by + 1, 30 * cr, 3);
    }
    if (u.faction === 'player' && zoom > 0.8) {
      ctx.font = '11px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.strokeText(u.name, u.x, u.y - 42 * u.scale);
      ctx.fillStyle = '#d8e8c8';
      ctx.fillText(u.name, u.x, u.y - 42 * u.scale);
    }
    if (down) {
      var bob = Math.sin(gameTime * 6) * 2;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      if (u.body.chest.hp <= 0) {
        ctx.fillStyle = '#ff7a6a';
        ctx.fillText('✚', u.x, u.y - 40 * u.scale + bob);
      } else {
        ctx.fillStyle = '#cfc4e8';
        ctx.fillText('Zz', u.x, u.y - 40 * u.scale + bob);
      }
    }
  }
}

function drawParticlesAndTexts() {
  /* T148: 视口裁剪全覆盖——粒子/光环/飘字三层 */
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    if (!inView(p.x, p.y, 20)) continue;
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  for (var r = 0; r < rings.length; r++) {
    var rg = rings[r];
    if (!inView(rg.x, rg.y, 40)) continue;
    var pr = rg.t / 0.5;
    ctx.globalAlpha = 1 - pr;
    ctx.strokeStyle = '#ffe9ad';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rg.x, rg.y, 6 + pr * 22, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  for (var t = 0; t < texts.length; t++) {
    var tx = texts[t];
    if (!inView(tx.x, tx.y, 60)) continue;
    var tp = tx.t / tx.life;
    ctx.globalAlpha = 1 - tp * tp;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.strokeText(tx.str, tx.x, tx.y - tp * 26);
    ctx.fillStyle = tx.color;
    ctx.fillText(tx.str, tx.x, tx.y - tp * 26);
  }
  ctx.globalAlpha = 1;
}

function drawNightAndDusk() {
  var b = brightness();
  var alpha = (1 - b) * 0.5;
  if (alpha > 0.02) {
    ctx.fillStyle = 'rgba(12,14,34,' + alpha.toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  if (b > 0.3 && b < 0.72) {
    var t = (b - 0.3) / 0.42;
    var k = Math.sin(clamp(t, 0, 1) * Math.PI) * 0.13;
    ctx.fillStyle = 'rgba(255,130,50,' + k.toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

function drawVignette() {
  if (!vignetteGrad) {
    vignetteGrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vignetteGrad.addColorStop(1, 'rgba(0,0,0,.4)');
  }
  ctx.fillStyle = vignetteGrad;
  ctx.fillRect(0, 0, W, H);
}

function drawBoxSelect() {
  if (!mouse.dragging || !mouse.dragStart) return;
  var dx = mouse.x - mouse.dragStart.x;
  var dy = mouse.y - mouse.dragStart.y;
  if (dx * dx + dy * dy < 64) return;
  var x = Math.min(mouse.x, mouse.dragStart.x);
  var y = Math.min(mouse.y, mouse.dragStart.y);
  var w = Math.abs(dx), h = Math.abs(dy);
  ctx.fillStyle = 'rgba(159,224,122,.08)';
  ctx.strokeStyle = 'rgba(159,224,122,.7)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}

function drawMinimap() {
  var S = 156;
  var k = S / WORLD.w;
  mmCtx.clearRect(0, 0, S, S);
  /* M5: 底色按群系粗采样（16×16 网格） */
  if (terrain) {
    var GN = 16, gc = S / GN;
    for (var gy = 0; gy < GN; gy++) {
      for (var gx = 0; gx < GN; gx++) {
        var b = terrain.biomeAt((gx + 0.5) / GN * WORLD.w, (gy + 0.5) / GN * WORLD.h);
        mmCtx.fillStyle = terrain.palettes[b].base;
        mmCtx.fillRect(gx * gc, gy * gc, gc + 1, gc + 1);
      }
    }
  } else {
    mmCtx.fillStyle = '#1b150c';
    mmCtx.fillRect(0, 0, S, S);
  }
  /* 道路 */
  if (terrain) {
    mmCtx.strokeStyle = 'rgba(210,185,130,.5)';
    mmCtx.lineWidth = 1.5;
    for (var rd = 0; rd < terrain.roads.length; rd++) {
      var pts = terrain.roads[rd].pts;
      mmCtx.beginPath();
      mmCtx.moveTo(pts[0].x * k, pts[0].y * k);
      for (var pi = 1; pi < pts.length; pi++) mmCtx.lineTo(pts[pi].x * k, pts[pi].y * k);
      mmCtx.stroke();
    }
    /* 废墟 */
    mmCtx.fillStyle = '#b06a4a';
    for (var ri = 0; ri < terrain.ruins.length; ri++) {
      if (terrain.ruins[ri].type === 'tower') continue;
      mmCtx.fillRect(terrain.ruins[ri].x * k - 1.5, terrain.ruins[ri].y * k - 1.5, 3, 3);
    }
    /* 塔楼（更大更醒目） */
    mmCtx.fillStyle = '#a03428';
    for (var tw = 0; tw < terrain.towers.length; tw++) {
      mmCtx.fillRect(terrain.towers[tw].x * k - 2.5, terrain.towers[tw].y * k - 2.5, 5, 5);
    }
    /* 游商营地 */
    mmCtx.fillStyle = '#ffffff';
    for (var mc = 0; mc < terrain.merchantCamps.length; mc++) {
      mmCtx.fillRect(terrain.merchantCamps[mc].x * k - 1.5, terrain.merchantCamps[mc].y * k - 1.5, 3, 3);
    }
    /* 狼巢 */
    mmCtx.fillStyle = '#b06ad0';
    for (var wd = 0; wd < terrain.wolfDens.length; wd++) {
      mmCtx.fillRect(terrain.wolfDens[wd].x * k - 1.5, terrain.wolfDens[wd].y * k - 1.5, 3, 3);
    }
  }
  /* T137 情报标记（90s 内脉动红圈） */
  if (intelPing && gameTime < intelPing.until) {
    var pk = 2 + Math.sin(gameTime * 6) * 1.2;
    mmCtx.strokeStyle = 'rgba(255,70,50,.9)';
    mmCtx.lineWidth = 1.5;
    mmCtx.beginPath();
    mmCtx.arc(intelPing.x * k, intelPing.y * k, 3.5 + pk, 0, TAU);
    mmCtx.stroke();
  }
  mmCtx.fillStyle = '#ffd97a';
  for (var t = 0; t < towns.length; t++) {
    mmCtx.fillRect(towns[t].x * k - 3, towns[t].y * k - 3, 6, 6);
  }
  mmCtx.fillStyle = '#e8b45a';
  for (var l = 0; l < loot.length; l++) {
    mmCtx.fillRect(loot[l].x * k - 1, loot[l].y * k - 1, 2, 2);
  }
  for (var i = 0; i < units.length; i++) {
    var u = units[i];
    if (u.state === 'dead') continue;
    mmCtx.fillStyle = u.faction === 'player' ? '#7fe06a' :
      (u.faction === 'town' ? '#4aa8d8' :
      (u.faction === 'beast' ? '#c8c8d0' :
      (u.faction === 'hungry' ? '#e0a050' : '#e0604c')));
    mmCtx.fillRect(u.x * k - 1.5, u.y * k - 1.5, 3, 3);
  }
  var vw = W / zoom, vh = H / zoom;
  mmCtx.strokeStyle = 'rgba(255,255,255,.5)';
  mmCtx.lineWidth = 1;
  mmCtx.strokeRect((cam.x - vw / 2) * k, (cam.y - vh / 2) * k, vw * k, vh * k);
}

var lastTipTime = 0;
function refreshTooltip() {
  if (!started || gameOver || helpOpen || shopOpen) {
    elTooltip.style.display = 'none';
    return;
  }
  var now = performance.now();
  var wp = screenToWorld(mouse.x, mouse.y);
  var h = null, bd = 26;
  for (var i = 0; i < units.length; i++) {
    var u = units[i];
    if (u.faction === 'player') continue;
    if (u.state === 'dead') continue;
    var d = dist(u, wp);
    if (d < bd) { bd = d; h = u; }
  }
  if (!h) { elTooltip.style.display = 'none'; return; }
  if (now - lastTipTime > 80) {
    lastTipTime = now;
    var cr = clamp(chestRatio(h), 0, 1);
    var st = h.state === 'dead' ? '💀 阵亡' :
             (isDown(h) ? (h.body.chest.hp <= 0 ? '🩸 倒地流血' : '😵 昏迷') :
             (h.attackTarget ? '⚔ 战斗中' : '·'));
    elTooltip.innerHTML =
      '<div><b>' + h.name + '</b>' + (h.tierName ? ' · ' + h.tierName : '') + '</div>' +
      '<div class="dim">' + (h.isBeast ? '野兽' : h.weapon.name + (h.armor ? ' · ' + h.armor.name : '')) + '</div>' +
      '<div class="tt-hp"><i style="width:' + (cr * 100).toFixed(0) + '%"></i></div>' +
      '<div class="dim">' + st + '</div>';
  }
  elTooltip.style.display = 'block';
  elTooltip.style.left = Math.min(mouse.x + 16, W - 220) + 'px';
  elTooltip.style.top = Math.min(mouse.y + 18, H - 100) + 'px';
}

function render() {
  if (R3D_active) {
    /* 3D 模式：2D 画布保持透明（露出底层 WebGL），把渲染交给 ronin3d */
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (WR.R3D) WR.R3D.render();
    return;
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#141009';
  ctx.fillRect(0, 0, W, H);

  var sx = 0, sy = 0;
  if (shakeT > 0.05) {
    sx = rand(-1, 1) * shakeT;
    sy = rand(-1, 1) * shakeT;
  }
  lastShakeX = sx;
  lastShakeY = sy;

  ctx.save();
  ctx.translate(W / 2 + sx, H / 2 + sy);
  ctx.scale(zoom, zoom);
  ctx.translate(-cam.x, -cam.y);

  viewRect.x = cam.x - W / (2 * zoom);
  viewRect.y = cam.y - H / (2 * zoom);
  viewRect.w = W / zoom;
  viewRect.h = H / zoom;

  drawTerrain();
  drawRoads();
  drawDecor();
  drawTowns();
  drawRuins();
  drawMerchantCamps();
  drawStructures();
  drawDecals();
  drawMotes();
  drawLootBags();
  drawUnits();
  drawParticlesAndTexts();

  ctx.restore();

  drawNightAndDusk();
  drawDangerEdge();
  drawLights();
  drawVignette();
  drawBoxSelect();
  drawGhostPreview();
  drawMinimap();
  drawBigMap();
  refreshTooltip();
}

/* ---------------- 主循环 ---------------- */
var last = performance.now();
var fpsFrames = 0;
var fpsLastT = performance.now();
function frame(now) {
  var dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  /* FPS 统计（每 0.5 秒刷新一次显示） */
  fpsFrames++;
  if (elFps && now - fpsLastT >= 500) {
    elFps.textContent = (fpsFrames * 1000 / (now - fpsLastT)).toFixed(0) + ' FPS';
    fpsFrames = 0;
    fpsLastT = now;
  }
  if (sleeping) {
    sleepT += dt;
    if (sleepT >= 2.2) finishSleep();
  } else if (!pausedWorld()) {
    update(dt);
  }
  render();
  requestAnimationFrame(frame);
}

/* ---------------- 初始化 ---------------- */
function init() {
  resize();
  sandPattern = makeSandPattern();
  /* M5: 世界地形（群系/装饰/道路/废墟）——种子与 App.rng 同源 */
  if (TERRAIN_MOD) terrain = TERRAIN_MOD.create({ seed: (WR.App && WR.App.seed) || 20260825 });
  terrainChunks.clear();
  genTownBuildings();
  buildObstacles();
  genDecor();
  initMotes();
  spawnGuards();
  spawnMerchants();       /* T132 游商 */
  spawnTowerGarrisons();  /* T133 塔楼守匪 */
  initDens();             /* T140 狼巢 */

  for (var i = 0; i < 6; i++) spawnGroup();
  for (var b = 0; b < 3; b++) spawnBeastPack();

  var hero = makeUnit({
    faction: 'player',
    name: '阿诺',
    x: towns[0].x + 430, y: towns[0].y - 120,
    maxHp: 62, speed: 84,
    weapon: WEAPONS.stick,
    bodyColor: '#4e6ea8',
    skills: { str: 8, tgh: 8, dodge: 8, melee: 8 }
  });
  hero.tierName = '浪人';
  units.push(hero);
  selection = [hero];

  cam.x = hero.x;
  cam.y = hero.y;
  clampCam();

  /* 初始化时解除所有单位与建筑的重叠，避免开局被碰撞推挤 */
  for (var ci0 = 0; ci0 < units.length; ci0++) collideObstacles(units[ci0]);

  requestAnimationFrame(frame);
}

/* M0 重构（T019）：不再自动启动。由 src/main.js 装配根调用 boot()。
 * 暴露最小接口供 main/UI 总线使用。 */

/* ---------------- 3D 渲染模式：世界坐标命令接口（供 js/ronin3d.js 调用） ----------------
 * 这些函数直接复用已有的世界坐标逻辑（issueCommand / livingSquad / RectSelect），
 * 不重写任何游戏规则——ronin3d 只负责把屏幕射线换算成 (wx, wy) 再喂进来。 */
function zoomBy(f) {
  var nz = clamp(zoom * f, 0.6, 1.8);
  zoom = nz;
  clampCam();
}
function toggle3D() {
  if (!WR.R3D) { log('3D 模式不可用（Three.js 未加载）', 'bad'); return; }
  R3D_active = !R3D_active;
  if (WR.R3D.onToggle) WR.R3D.onToggle(R3D_active);
  log(R3D_active ? '切换到 3D 视角（按 P 切回 2D）' : '切换回 2D 视角', 'sys');
}
/* type: 'left' 单选/点地走 | 'right' 移动/攻击 | 'leftdrag' 框选（opts.w0={x,y}） */
function worldInput(type, wx, wy, opts) {
  opts = opts || {};
  if (!started || gameOver || helpOpen || shopOpen || sleeping) return;
  if (buildMode > 0) {
    if (type === 'left') placeStructure(wx, wy);
    else if (type === 'right') { buildMode = 0; log('退出建造模式', 'sys'); }
    return;
  }
  if (type === 'right') { issueCommand(wx, wy); return; }
  if (type === 'left') {
    var sq = livingSquad();
    var best = null, bd = 22;
    for (var j = 0; j < sq.length; j++) {
      var d = dist(sq[j], { x: wx, y: wy });
      if (d < bd) { bd = d; best = sq[j]; }
    }
    if (best) {
      if (opts.shift) {
        var idx = selection.indexOf(best);
        if (idx >= 0) selection.splice(idx, 1); else selection.push(best);
      } else selection = [best];
      sfx('ui'); tutStep(1);
    } else if (!opts.shift) {
      issueCommand(wx, wy);
    }
    return;
  }
  if (type === 'leftdrag') {
    var w0 = opts.w0;
    if (!w0) return;
    var picked = WR.RectSelect.collect(livingSquad(), w0.x, w0.y, wx, wy);
    if (picked.length) selection = picked;
    return;
  }
}

/* 调试 / 自动化测试钩子（不影响正常游戏） */
window.__ronin = {
  unitsList: function () { return units; },
  resources: function () { return res; },
  state: function () { return { started: started, day: day, time: gameTime }; },
  world: function () { return { camps: camps, structures: structures }; },
  townsList: function () { return towns; },
  lootList: function () { return loot; },
  selectionList: function () { return selection; },
  isR3D: function () { return R3D_active; },
  getCam: function () { return { x: cam.x, y: cam.y, z: zoom }; },
  /* M5 地形钩子（测试/调试用） */
  terrainInfo: function () { return terrain ? terrain.stats() : null; },
  ruinsList: function () { return terrain ? terrain.ruins : []; },
  scavengeNearest: function () { return tryScavenge(); },
  caravanStats: function () { return { spawned: caravansSpawned, active: !!caravan }; },
  intelPingInfo: function () { return intelPing && gameTime < intelPing.until ? intelPing : null; },
  discoveredInfo: function () {
    var marks = landmarkList(), n = 0;
    for (var i = 0; i < marks.length; i++) if (discovered[marks[i].id]) n++;
    return { count: n, total: marks.length };
  },
  spawnKindInfo: function () { return spawnKindUsed; },
  gates: function () {
    return { started: started, gameOver: gameOver, helpOpen: helpOpen,
             shopOpen: shopOpen, sleeping: sleeping, buildMode: buildMode, mapOpen: mapOpen };
  }
};

window.WR = window.WR || {};
window.WR.LegacyGame = {
  version: 'legacy-0.4',
  boot: function () { init(); },
  closeShop: closeShop,
  toggleHelp: function () {
    helpOpen = !helpOpen;
    elHelp.classList.toggle('hidden', !helpOpen);
  },
  toggleCamFollow: function () {
    camFollow = !camFollow;
    log(camFollow ? '镜头跟随：开' : '镜头跟随：关（WASD 移动镜头，G 重新跟随）', 'sys');
  },
  toggleAutoDefend: function () {
    autoDefend = !autoDefend;
    log(autoDefend ? '小队自动反击：开（被攻击时自动还手）' : '小队自动反击：关（完全手动指挥）', 'sys');
  },
  /* 3D 渲染模式接口（ronin3d.js 消费） */
  toggle3D: toggle3D,
  is3D: function () { return R3D_active; },
  worldInput: worldInput,
  zoomBy: zoomBy
};

})();
