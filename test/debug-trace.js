/* T029 追踪器 v3：逐行镜像 test-smoke.js 的真实时序，失败时输出窗口内逐帧状态
 * 用法: node test/debug-trace.js [尝试次数]
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILES = [
  'src/core/RNG.js', 'src/core/EventBus.js', 'src/core/Engine.js',
  'src/world/Time.js', 'src/input/Camera.js', 'src/input/Input.js',
  'src/entities/Body.js', 'src/systems/Combat.js', 'src/systems/AI.js',
  'src/systems/Survival.js', 'src/systems/Economy.js', 'src/systems/Build.js',
  'src/world/Spawner.js', 'js/game.js', 'src/main.js'
];

function makeHarness() {
  let nowMs = 0, rafCb = null;
  const elL = [], winL = [];
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
      id, style: {}, children: [], textContent: '', disabled: false, width: 0, height: 0,
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener(type, fn) { elL.push({ id, type, fn }); },
      setAttribute(k, v) { el['a_' + k] = v; },
      getAttribute(k) { return el['a_' + k] != null ? el['a_' + k] : null; },
      appendChild(c) { el.children.push(c); },
      insertBefore(c) { el.children.unshift(c); },
      removeChild(c) { el.children = el.children.filter(x => x !== c); },
      closest() { return null; },
      getContext() { if (!el._ctx) el._ctx = makeCtx(); return el._ctx; }
    };
    Object.defineProperty(el, 'innerHTML', { get() { return el._h || ''; }, set(v) { el._h = v; el.children = []; } });
    Object.defineProperty(el, 'firstChild', { get() { return el.children[0] || null; } });
    Object.defineProperty(el, 'lastChild', { get() { return el.children[el.children.length - 1] || null; } });
    return el;
  }
  const els = {};
  const windowStub = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    addEventListener(t, f) { winL.push({ type: t, fn: f }); } };
  const sandbox = {
    document: { getElementById(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; },
                createElement(tag) { return makeEl('anon_' + tag); } },
    window: windowStub,
    self: windowStub,
    performance: { now: () => nowMs },
    requestAnimationFrame(cb) { rafCb = cb; },
    setTimeout, clearTimeout, console
  };
  sandbox.WR = sandbox.window.WR = {};
  vm.createContext(sandbox);
  return {
    load() { for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f }); },
    clickStart() { for (const l of elL) if (l.id === 'startOverlay' && l.type === 'click') l.fn({}); },
    key(c) { for (const l of winL) if (l.type === 'keydown') l.fn({ code: c, preventDefault() {} }); },
    down(b, x, y) { for (const l of elL) if (l.id === 'game' && l.type === 'mousedown') l.fn({ button: b, clientX: x, clientY: y }); },
    up(b, x, y, shift) { for (const l of winL) if (l.type === 'mouseup') l.fn({ button: b, clientX: x, clientY: y, shiftKey: !!shift }); },
    tick(n) { for (let i = 0; i < n; i++) { nowMs += 16.7; const cb = rafCb; rafCb = null; if (!cb) throw new Error('rAF broken'); cb(nowMs); } },
    R() { return sandbox.WR.__ronin || sandbox.window.__ronin; }
  };
}

function sweep(R, hh) {
  hh.lastAttacker = null;
  for (const o of R.unitsList()) {
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

const ATTEMPTS = parseInt(process.argv[2] || '60', 10);
for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  const H = makeHarness();
  H.load();
  H.clickStart();

  let walkBaseX = null, walkBaseY = null;
  let pendingUpX = 0, pendingUpY = 0;
  let sawMove = false;
  const R = H.R();
  const trace = [];

  for (let frames = 1; frames <= 4600; frames++) {
    if (frames >= 1000 && frames % 240 === 0) {
      const us = R.unitsList();
      const hh = us.find(u => u.faction === 'player' && u.state !== 'dead');
      const foe = us.find(u => (u.faction === 'bandit' || u.faction === 'hungry' || u.faction === 'beast') && u.state !== 'dead');
      if (hh && foe) { foe.x = hh.x + 90 + Math.random() * 40; foe.y = hh.y + Math.random() * 40 - 20; }
    }
    /* --- 清场（148/205） --- */
    if (frames === 148 || frames === 205) {
      const hh = R.unitsList().find(u => u.faction === 'player');
      if (hh) sweep(R, hh);
    }
    if (frames === 60) H.key('Tab');
    /* --- 移动测试（150 down / 158 up） --- */
    if (frames === 150) {
      const hh = R.unitsList().find(u => u.faction === 'player');
      walkBaseX = hh ? hh.x : null; walkBaseY = hh ? hh.y : null;
      const cm = R.getCam();
      pendingUpX = ((walkBaseX || 0) - cm.x) * cm.z + 640 - 150;
      pendingUpY = ((walkBaseY || 0) - cm.y) * cm.z + 400 - 10;
      H.down(0, pendingUpX, pendingUpY);
      trace.push('f150 DOWN screen=' + pendingUpX.toFixed(0) + ',' + pendingUpY.toFixed(0) +
        ' | gates=' + JSON.stringify(R.gates()));
    }
    if (frames === 158) H.up(0, pendingUpX, pendingUpY);
    if (frames >= 160 && frames <= 250 && !sawMove && frames % 2 === 0) {
      const h = R.unitsList().find(u => u.faction === 'player');
      if (h) {
        if (h.moveTarget) sawMove = true;
        else if (walkBaseX !== null &&
                 Math.abs(h.x - walkBaseX) + Math.abs(h.y - walkBaseY) > 40) sawMove = true;
        else trace.push('f' + frames + ': idle pos=' + h.x.toFixed(0) + ',' + h.y.toFixed(0) +
                        ' sel=' + R.selectionList().length +
                        ' hunger=' + h.hunger.toFixed(0) +
                        ' channels=r' + h.rescueChannel + '/b' + h.bandageChannel +
                        ' sleepingFlag?n/a');
      }
    }
    if (frames === 220) H.key('KeyV');
    if (frames >= 260 && frames <= 560 && frames % 15 === 10 && R.state().day < 2) {
      if (R.world().camps.length === 0 && R.resources().kits > 0) H.key('KeyV');
      H.key('KeyZ');
    }
    if (frames === 600) H.key('KeyB');
    if (frames === 620 || frames === 650 || frames === 680) {
      const cm = R.getCam();
      H.down(0, 820, 380); H.up(0, 820, 380);
    }
    if (frames === 695) H.key('Escape');
    if (frames === 720) H.key('KeyX');
    if (frames === 745) H.key('KeyF');
    if (frames === 765) H.key('KeyC');
    if (frames === 785) H.key('KeyT');
    if (frames === 805) H.key('KeyE');
    if (frames === 825) H.key('Escape');
    if (frames === 845) H.key('KeyR');
    if (frames === 865) H.key('KeyG');

    H.tick(1);

    if (frames === 4600) {
      const st = R.state();
      if (st.day < 2) {
        console.log('=== FLAKE: sleep did not advance (attempt ' + attempt + ') ===');
        console.log('camps=' + JSON.stringify(R.world().camps.map(c => [c.x.toFixed(0), c.y.toFixed(0)])));
        process.exit(2);
      }
      if (!sawMove) {
        console.log('=== FLAKE: left-click move not observed (attempt ' + attempt + ') ===');
        console.log(trace.join('\n'));
        process.exit(2);
      }
    }
  }
}
console.log('all attempts OK (' + ATTEMPTS + ')');
