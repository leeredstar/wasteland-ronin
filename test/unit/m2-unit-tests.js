/* ============================================================
 * M2 单元测试套件（T060/T065/T070/T071/T076 及相关行为固化）
 * 运行：node test/unit/m2-unit-tests.js
 * ============================================================ */
const Body = require('../../src/entities/Body.js');
const Balance = require('../../src/data/balance.js');
const Survival = require('../../src/systems/Survival.js');
const AI = require('../../src/systems/AI.js');
const Factions = require('../../src/data/factions.js');

let failed = 0, passed = 0;
function t(name, cond) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); }
}
const S = Balance.SURVIVAL;

/* 环境注入（静默桩） */
Survival.attach({
  log() {}, text() {}, sfx() {},
  knockDown() {},
  getSelection() { return []; },
  getUnits() { return []; },
  canAct() { return true; },
  dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); },
  camps() { return []; }
});

/* ---------- T060 流血只作用于胸腔 ---------- */
console.log('[T060] 流血只作用于胸腔');
let u = { body: Body.makeBody(60), limbState: {} };
u.body.chest.hp = -1;
u.body.armL.hp = 10; u.body.armR.hp = 10; u.body.legL.hp = 12; u.body.legR.hp = 12; u.body.head.hp = 24;
for (let i = 0; i < 60; i++) Survival.tickDowned(u, 0.1);
t('四肢血量不受流血影响',
  u.body.armL.hp === 10 && u.body.armR.hp === 10 && u.body.legL.hp === 12 && u.body.legR.hp === 12);
t('胸腔持续下降', u.body.chest.hp < -1);
t('头部在胸>0时缓慢回升', u.body.head.hp > 24);

/* ---------- T065 饥饿归零扣胸血速率 + 倒地触发 ---------- */
console.log('[T065] 饥饿归零伤害');
let starve = { body: Body.makeBody(60), faction: 'player', hunger: 0,
               hungWarned: false, state: 'idle', attackTarget: null, moveTarget: null };
let knockCalls = 0;
Survival.attach({
  log() {}, text() {}, sfx() {},
  knockDown(a, uu, part) { knockCalls++; if (uu) uu._starveKO = true; },
  getSelection() { return []; }, getUnits() { return []; },
  canAct() { return true; }, dist() { return 999; }, camps() { return []; }
});
/* 重挂带 knockDown 计数的完整环境 */
Survival.attach({
  log() {}, text() {}, sfx() {},
  knockDown(a, uu, part) { knockCalls++; if (uu) uu._starveKO = true; },
  getSelection() { return []; }, getUnits() { return []; },
  canAct() { return true; }, dist() { return 999; }, camps() { return []; }
});
const before = starve.body.chest.hp;
starve.hunger = 0;
let knocked = false;
for (let i = 0; i < 50 && !knocked; i++) {
  if (Survival.hungerTick(starve, 0.1)) { knocked = true; }
  if (starve._starveKO) knocked = true;
}
/* 50 次 × 0.1s = 5 秒 × 2DPS = 应扣约 10 点 */
t('饥饿归零按 2/s 扣胸腔', Math.abs((before - starve.body.chest.hp) - 10) < 1.2);

/* ---------- T070 通道互斥 ---------- */
console.log('[T070] 通道互斥');
let busy = { body: Body.makeBody(60), rescueChannel: 1.0, bandageChannel: 0,
             state: 'idle', attackTarget: null, moveTarget: null };
const busyBefore = busy.bandageChannel;
const occupied = Survival.tickBandage(busy, 0.1);
t('救助中 tickBandage 报告占用', occupied === true);
t('包扎通道未被推进', busy.bandageChannel === 0);
t('包扎未开始', busyBefore === busy.bandageChannel);

/* ---------- T071 倒地者不被索敌 ---------- */
console.log('[T071] 倒地者不被索敌');
AI.attach({
  rand() { return 0.5; },
  WORLD: { w: 4000, h: 4000 },
  validEnemyFor(a, b) {
    if (a.faction === b.faction) return false;
    if (b.state === 'dead' || b.state === 'down' || b.wakeGrace > 0) return false;
    return true;
  },
  dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); },
  chestRatio(u) { return u.body.chest.hp / u.body.chest.max; },
  findNearestHostile(u, range) {
    let best = null, bd = range;
    for (const o of UNITS) {
      const d = Math.hypot(u.x - o.x, u.y - o.y);
      if (d < bd && o !== u && o.state !== 'dead' && o.state !== 'down') { bd = d; best = o; }
    }
    return best;
  },
  livingSquad() { return UNITS.filter(function (o) { return o.faction === 'player'; }); },
  text() {}
});
const UNITS = [];
let hunter = { faction: 'bandit', x: 0, y: 0, aggro: 300, state: 'idle', attackTarget: null,
               moveTarget: null, wanderT: 9, fearT: 0, body: null, skills: {},
               rescueChannel: 0, bandageChannel: 0, homePoint: null, hp: 1 };
let downFoe = { faction: 'player', x: 30, y: 0, state: 'down', body: { chest: { hp: -5, max: 37 } } };
UNITS.push(hunter, downFoe);
hunter.wanderT = 9;
AI.think(hunter);
t('倒地单位不会被选为攻击目标', hunter.attackTarget === null);

/* ---------- 截断一次性 / 义肢下限（T057/T058 固化） ---------- */
console.log('[T057/T058] 截断与义肢');
let b2 = Body.makeBody(60), ls2 = {};
Body.applyDamage(b2, ls2, 'armL', 200);
t('重创触发截断', ls2.armL === 'cut');
let sevAgain = Body.applyDamage(b2, ls2, 'armL', 100);
t('重复伤害不再触发二次截断事件', sevAgain.severed === false);
b2.armR.hp = 20; ls2.armR = 'robo';
Body.applyDamage(b2, ls2, 'armR', 500);
t('义肢血量钳制在下限', Math.abs(b2.armR.hp - b2.armR.max * Balance.COMBAT.ROBO_FLOOR_RATIO) < 1e-9);

/* ---------- T076 状态文案映射 ---------- */
console.log('[T076] 状态文案');
t('完好:', Body.stateText('ok') === '完好' ? true : false);
t('轻伤:', Body.stateText('hurt') === '轻伤' ? true : false);
t('残废:', Body.stateText('gone') === '残废' ? true : false);

/* ---------- 配置存在性（M2 参数化收编确认） ---------- */
console.log('[CONFIG] M2 参数收编');
t('WAKE_GRACE', S.WAKE_GRACE != null);
t('SLEEP_HEAL_RATIO / HUNGER_COST', S.SLEEP_HEAL_RATIO != null && S.SLEEP_HUNGER_COST != null);
t('CAMP_SLEEP_RADIUS', S.CAMP_SLEEP_RADIUS != null);
t('LIMBS 系数表', Balance.LIMBS && Balance.LIMBS.ARM_CD_PER != null);

/* ---------- 结果 ---------- */
console.log(failed === 0 ? 'M2 UNIT TESTS: ALL PASS (' + passed + ')' :
  'M2 UNIT TESTS: FAIL (' + failed + ' failures)');
process.exit(failed === 0 ? 0 : 1);
