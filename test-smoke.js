/* 荒原浪人 无头冒烟测试：在 Node 中模拟浏览器环境运行游戏主循环 */
const fs = require('fs');
const vm = require('vm');
const dir = 'D:/wasteland-ronin/';
/* M0 重构后按浏览器加载顺序装配：core → legacy(game.js) → main */
const FILES = [
  'src/core/RNG.js',
  'src/core/EventBus.js',
  'src/core/Engine.js',
  'src/world/Time.js',
  'src/input/Camera.js',
  'src/input/Input.js',
  'src/input/RectSelect.js',
  'src/data/balance.js',
  'src/data/factions.js',
  'src/data/items.js',
  'src/data/enemies.js',
  'src/data/skills.js',
  'src/data/shops.js',
  'src/entities/Body.js',
  'src/entities/Skills.js',
  'src/systems/Combat.js',
  'src/systems/AI.js',
  'src/systems/Survival.js',
  'src/systems/Economy.js',
  'src/systems/Build.js',
  'src/world/Spawner.js',
  'src/world/Terrain.js',
  'src/world/Pathfinding.js',
  'js/game.js',
  'src/main.js'
];
const codes = FILES.map(f => ({ name: f, code: fs.readFileSync(dir + f, 'utf8') }));

let nowMs = 0;
let rafCb = null;
const elListeners = [];
const winListeners = [];

function makeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createPattern' || k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k in t) return t[k];
      return function () {};
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

function makeEl(id) {
  const el = {
    id,
    style: {},
    children: [],
    textContent: '',
    disabled: false,
    width: 0,
    height: 0,
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, fn) { elListeners.push({ id, type, fn }); },
    setAttribute(k, v) { el['attr_' + k] = v; },
    getAttribute(k) { return el['attr_' + k] !== undefined ? el['attr_' + k] : null; },
    appendChild(c) { el.children.push(c); },
    insertBefore(c) { el.children.unshift(c); },
    removeChild(c) { el.children = el.children.filter(x => x !== c); },
    closest() { return null; },
    getContext() { if (!el._ctx) el._ctx = makeCtx(); return el._ctx; }
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html || ''; },
    set(v) { el._html = v; el.children = []; }
  });
  Object.defineProperty(el, 'firstChild', { get() { return el.children[0] || null; } });
  Object.defineProperty(el, 'lastChild', { get() { return el.children[el.children.length - 1] || null; } });
  return el;
}

const els = {};
const documentStub = {
  getElementById(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; },
  createElement(tag) { return makeEl('anon_' + tag + '_' + Math.random()); }
};
const windowStub = {
  innerWidth: 1280,
  innerHeight: 800,
  devicePixelRatio: 1,
  addEventListener(type, fn) { winListeners.push({ type, fn }); }
};

const sandbox = {
  document: documentStub,
  window: windowStub,
  performance: { now: () => nowMs },
  requestAnimationFrame(cb) { rafCb = cb; },
  setTimeout, clearTimeout, console
};
vm.createContext(sandbox);
sandbox.self = sandbox.window; // 模块使用 self 判别运行环境
sandbox.WR = sandbox.window.WR = {}; // 裸标识符 WR 与 window.WR 同一对象

function fireKey(code) {
  const R = windowStub.__ronin;
  for (const l of winListeners) {
    if (l.type === 'keydown') {
      try {
        l.fn({ code, preventDefault() {} });
      } catch (e) {
        console.log('KEY ERROR [' + code + ']:', e.message);
      }
    }
  }
  if (R && code !== 'Tab') {
    const w = R.world();
    console.log('key[' + code + '] kits=' + R.resources().kits + ' day=' + R.state().day +
      ' started=' + R.state().started + ' camps=' + w.camps.length + ' sel=' + R.selectionList().length);
  }
}
function click(id) {
  for (const l of elListeners) {
    if (l.id === id && l.type === 'click') l.fn({});
  }
}
function canvasDown(button, cx, cy) {
  for (const l of elListeners) {
    if (l.id === 'game' && l.type === 'mousedown') l.fn({ button, clientX: cx, clientY: cy });
  }
}
function canvasUp(button, cx, cy) {
  for (const l of winListeners) {
    if (l.type === 'mouseup') l.fn({ button, clientX: cx, clientY: cy, shiftKey: false });
  }
}

try {
  for (const f of codes) {
    vm.runInContext(f.code, sandbox, { filename: f.name });
  }
  console.log('LOADED OK (' + codes.length + ' files)');
  /* T027 断言：main.js 装配根必须已完成引导 */
  const APP = sandbox.WR && sandbox.WR.App;
  if (!APP || APP.booted !== true) throw new Error('main.js boot chain failed (App.booted!==true)');
  if (!APP.rng || !APP.bus || !APP.time || !APP.camera || !APP.input || !APP.engine) {
    throw new Error('main.js core services incomplete');
  }
  console.log('BOOT OK: seed=' + APP.seed + ' services=[rng,bus,time,camera,input,engine]');

  click('startOverlay');

  const R = windowStub.__ronin;
  if (!R) throw new Error('debug hook missing');

  let sawDead = false, sawDowned = false, sawLoot = false;
  let matsBefore = null;
  let sawMove = false;
  let sawCombatFlag = false;
  let walkBaseX = null, walkBaseY = null;
  let pendingUpX = 0, pendingUpY = 0;
  const TOTAL = 4600;

  for (let frames = 1; frames <= TOTAL; frames++) {
    // 前 1000 帧不传送敌人，保证新手交互流程先完整跑完
    if (frames >= 1000 && frames % 240 === 0) {
      const units = R.unitsList();
      const hero = units.find(u => u.faction === 'player' && u.state !== 'dead');
      const foe = units.find(u => (u.faction === 'bandit' || u.faction === 'hungry' || u.faction === 'beast') && u.state !== 'dead');
      if (hero && foe) {
        foe.x = hero.x + 90 + Math.random() * 40;
        foe.y = hero.y + Math.random() * 40 - 20;
      }
    }
    // v0.3.1：左键点空地 = 走路（核心新交互）
    // 前置清场：非友方单位推远 + 清除其战斗意图；移动窗口中途再扫一次
    if (frames === 148 || frames === 205) {
      const us = R.unitsList();
      const hh = us.find(u => u.faction === 'player');
      if (hh) {
        hh.lastAttacker = null;
        for (const o of us) {
          if (o === hh || o.faction === 'player' || o.faction === 'town') continue;
          const dx = o.x - hh.x, dy = o.y - hh.y;
          const d = Math.hypot(dx, dy);
          if (d < 500) {
            const k = 700 / Math.max(d, 1);
            o.x = hh.x + dx * k; o.y = hh.y + dy * k;
            o.attackTarget = null; o.lastAttacker = null;
          }
        }
      }
    }
    if (frames === 60) fireKey('Tab');
    if (frames === 150) {
      const h0 = R.unitsList().find(u => u.faction === 'player');
      walkBaseX = h0 ? h0.x : null; walkBaseY = h0 ? h0.y : null;
      const cm = R.getCam();
      // 基于英雄当前屏幕位置，点他左侧约 150px 的空地
      pendingUpX = (walkBaseX - cm.x) * cm.z + 640 - 150;
      pendingUpY = (walkBaseY - cm.y) * cm.z + 400 - 10;
      canvasDown(0, pendingUpX, pendingUpY);
    }
    if (frames === 158) canvasUp(0, pendingUpX, pendingUpY);
    // 在接下来 1.5 秒内：移动目标 / 实际位移 / 进入战斗 反应均视为有效响应
    if (frames >= 160 && frames <= 250 && !sawMove) {
      const h = R.unitsList().find(u => u.faction === 'player');
      if (h) {
        if (h.moveTarget) sawMove = true;
        else if (h.attackTarget) sawMove = true; // 与逼近之敌交战亦为有效响应
        else if (walkBaseX !== null && (Math.abs(h.x - walkBaseX) + Math.abs(h.y - walkBaseY)) > 40) sawMove = true;
      }
    }
    if (frames === 220) fireKey('KeyV');          // 扎营
    // 睡觉：V+Z 反复尝试直到成功（英雄可能还在走动/漂移）
    if (frames >= 260 && frames <= 560 && frames % 15 === 10 && R.state().day < 2) {
      if (matsBefore === null) matsBefore = R.resources().mats;
      if (R.world().camps.length === 0 && R.resources().kits > 0) fireKey('KeyV');
      fireKey('KeyZ');
    }
    // 建造：睡醒后进入建造模式，多次尝试放置直到建材减少
    if (frames === 600) fireKey('KeyB');
    if (frames === 620 || frames === 650 || frames === 680) canvasDown(0, 820, 380);
    if (frames === 695) fireKey('Escape');
    if (frames === 720) fireKey('KeyX');
    if (frames === 745) fireKey('KeyF');
    if (frames === 765) fireKey('KeyC');
    if (frames === 785) fireKey('KeyT');
    if (frames === 805) fireKey('KeyE');
    if (frames === 825) fireKey('Escape');
    if (frames === 845) fireKey('KeyR');
    if (frames === 865) fireKey('KeyG');

    nowMs += 16.7;
    const cb = rafCb;
    rafCb = null;
    if (!cb) throw new Error('rAF chain broken at frame ' + frames);
    cb(nowMs);

    if (frames % 120 === 0) {
      const units = R.unitsList();
      if (units.some(u => u.state === 'dead')) sawDead = true;
      if (units.some(u => u.state === 'down')) sawDowned = true;
      if (R.resources().cats > 120) sawLoot = true;
      // 战斗证据：任何单位被打过（含逃跑未死的遭遇战）
      if (!sawCombatFlag) {
        for (const u of units) {
          if (u.lastAttacker && (u.faction === 'player' || u.lastAttacker.faction === 'player')) { sawCombatFlag = true; break; }
        }
      }
    }
  }

  const st = R.state();
  console.log('--- smoke result ---');
  console.log('started:', st.started, '| day:', st.day, '| gameTime:', st.time.toFixed(1) + 's');
  /* 战斗遥测（诊断 KI-001 家族偶发）：死亡/倒地/接敌计数 */
  const __u = R.unitsList();
  const deaths = __u.filter(u => u.state === 'dead').length;
  const downs = __u.filter(u => u.state === 'down').length;
  const engaged = __u.filter(u => u.lastAttacker).length;
  const playerEngaged = __u.filter(u => u.lastAttacker &&
    (u.faction === 'player' || u.lastAttacker.faction === 'player')).length;
  console.log('telemetry: deaths=' + deaths, 'downs=' + downs,
    'everAttacked=' + engaged, 'playerInvolved=' + playerEngaged);
  console.log('sawDead:', sawDead, '| sawDowned:', sawDowned, '| lootGained:', sawLoot);
  console.log('resources:', JSON.stringify(R.resources()));
  if (!st.started) throw new Error('game did not start');
  if (!sawMove) throw new Error('left-click on ground did not create a move target');
  if (!sawDead && !sawCombatFlag) throw new Error('no combat observed - combat path not exercised');
  if (st.day < 2) {
    const w = R.world();
    const h = R.unitsList().find(u => u.faction === 'player');
    throw new Error('sleep did not advance the day | camps=' + w.camps.length +
      ' kits=' + R.resources().kits +
      ' hero=' + (h ? h.x.toFixed(0) + ',' + h.y.toFixed(0) + ' state=' + h.state +
        ' campDist=' + (w.camps[0] && h ? Math.hypot(h.x - w.camps[0].x, h.y - w.camps[0].y).toFixed(0) : 'n/a') : 'none') +
      ' time=' + st.time.toFixed(0));
  }
  if (matsBefore !== null && R.resources().mats >= matsBefore) throw new Error('wall was not placed (mats unchanged)');
  /* ---- M5 地形扩展断言（T125-T131）---- */
  const tinfo = R.terrainInfo();
  if (!tinfo) throw new Error('terrain hooks missing (Terrain.js not loaded?)');
  const biomes = Object.entries(tinfo.biomes).filter(([k, v]) => v > 0);
  if (biomes.length < 2) throw new Error('biome variety too low: ' + JSON.stringify(tinfo.biomes));
  if (tinfo.ruins < 6) throw new Error('too few ruins: ' + tinfo.ruins);
  if (tinfo.roads < 1) throw new Error('no roads generated');
  if (typeof R.scavengeNearest() !== 'boolean') throw new Error('scavengeNearest did not return bool');
  console.log('terrain:', JSON.stringify(tinfo));
  /* ---- T132-T139 断言：塔楼/游商/商队/情报钩子 ---- */
  if (!(tinfo.towers >= 2)) throw new Error('expected >=2 towers, got ' + tinfo.towers);
  if (!(tinfo.merchants >= 2)) throw new Error('expected >=2 merchant camps, got ' + tinfo.merchants);
  if (!R.caravanStats) throw new Error('caravanStats hook missing');
  if (!(R.caravanStats().spawned >= 1)) throw new Error('caravan never spawned');
  if (typeof R.intelPingInfo() !== 'object' && R.intelPingInfo() !== null) throw new Error('intelPingInfo bad');
  console.log('caravan:', JSON.stringify(R.caravanStats()));
  /* ---- T140-T145 断言：狼巢 / 地标发现 / 大地图钩子 ---- */
  if (!(tinfo.wolfDens >= 3)) throw new Error('expected >=3 wolf dens, got ' + tinfo.wolfDens);
  const disc = R.discoveredInfo();
  if (!(disc.count >= 1)) throw new Error('no landmarks discovered (landmark system broken)');
  console.log('discovered:', JSON.stringify(disc), '| spawnKind:', R.spawnKindInfo());
  /* ---- T157-T160 断言：协防钩子 / 诱饵 / A* 寻路 ---- */
  if (typeof R.supportStats().assists !== 'number') throw new Error('supportStats bad');
  if (typeof R.baitsInfo().thrown !== 'number') throw new Error('baitsInfo bad');
  const towns2 = R.townsList();
  const fp = R.findPathDemo(towns2[0].x, towns2[0].y, towns2[1].x, towns2[1].y);
  if (!fp || !(fp.points >= 2)) throw new Error('A* path between towns failed: ' + JSON.stringify(fp));
  console.log('a*: hub->corner', JSON.stringify(fp));
  console.log('SMOKE PASS');
} catch (err) {
  console.error('SMOKE FAIL:', (err && err.stack) || err);
  process.exit(1);
}
