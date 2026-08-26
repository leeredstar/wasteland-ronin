/* ============================================================
 * M6 单元测试（T153-T156）：状态机标注 / 迁移追踪 / 昼夜视野 /
 * 追击放弃（远离地盘语义）。行为基线 = legacy v0.4 逐字等价。
 * 运行：node test/unit/m6-tests.js
 * ============================================================ */
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const AI = require(path.join(ROOT, 'src/systems/AI.js'));
const BALANCE = require(path.join(ROOT, 'src/data/balance.js'));

let passed = 0, failed = 0;
function t(name, cond) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); }
}

/* ---------- 测试环境 ---------- */
function mkUnit(opts) {
  const o = Object.assign({
    name: '测试单位',
    x: 0, y: 0, faction: 'bandit', state: 'idle',
    fearT: 0, wanderT: 99, aggro: 240,
    body: { chest: { hp: 60, max: 60 }, head: { hp: 24, max: 24 } },
    attackTarget: null, moveTarget: null, lastAttacker: null,
    homePoint: { x: 0, y: 0 }, rescueChannel: 0, bandageChannel: 0,
    _aiState: null
  }, opts);
  return o;
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

let traceBuf = [];
AI.attach({
  rand: () => 0.5,
  WORLD: { w: 8000, h: 8000 },
  validEnemyFor: (a, b) => {
    if (!b || b.state === 'dead' || b.state === 'down') return false;  /* 镜像宿主规则 */
    const enemyOf = {
      player: ['bandit', 'hungry', 'beast'],
      town: ['bandit', 'hungry', 'beast'],
      bandit: ['player', 'town'],
      hungry: ['player', 'town'],
      beast: ['player', 'town', 'bandit']
    };
    return a.faction !== b.faction && (enemyOf[a.faction] || []).includes(b.faction);
  },
  dist,
  chestRatio: u => u.body.chest.hp / u.body.chest.max,
  findNearestHostile: u => u._scanResult || null,
  livingSquad: () => [],
  text: () => {},
  brightness: () => 1,
  balance: BALANCE.AI,
  trace: ev => traceBuf.push(ev)
});

console.log('[T153] STATES 枚举与出口标注');
{
  t('五态齐全（IDLE/WANDER/CHASE/FLEE/LEASH + FOLLOW）',
    ['IDLE', 'WANDER', 'CHASE', 'FLEE', 'LEASH', 'FOLLOW'].every(k => AI.STATES[k]));

  const hero = mkUnit({ faction: 'player' });
  AI.think(hero);
  t('玩家空闲 → _aiState=IDLE', hero._aiState === AI.STATES.IDLE);

  const guard = mkUnit({ faction: 'town', x: 500, y: 0 });
  AI.think(guard);
  t('卫兵距家>340 → LEASH 且 moveTarget=家',
    guard._aiState === AI.STATES.LEASH && guard.moveTarget.x === 0);

  const coward = mkUnit({ faction: 'hungry' });
  coward.body.chest.hp = 10;
  AI.think(coward);
  t('饥饿强盗胸<28% → FLEE', coward._aiState === AI.STATES.FLEE &&
    coward.attackTarget === null);

  const slave = mkUnit({ faction: 'slave' });
  AI.think(slave);
  t('奴隶 → FOLLOW', slave._aiState === AI.STATES.FOLLOW);
}

console.log('[索敌] CHASE 锁定');
{
  const raider = mkUnit();
  const prey = mkUnit({ faction: 'town', x: 200, y: 0 });
  raider._scanResult = prey;
  AI.think(raider);
  t('扫描命中 → CHASE 锁定 + 清移动点', raider._aiState === AI.STATES.CHASE &&
    raider.attackTarget === prey && raider.moveTarget === null);

  prey.state = 'dead';
  raider._scanResult = null;
  AI.think(raider);
  t('目标死亡后脱战（validEnemyFor 排除）', raider.attackTarget === null);
}

console.log('[T156] 远离地盘放弃追击');
{
  const orig = BALANCE.AI.CHASE_GIVE_UP;
  BALANCE.AI.CHASE_GIVE_UP = 500;
  const chaser = mkUnit({ x: 600, y: 0 });           // 离巢600 > 500
  const prey2 = mkUnit({ faction: 'town', x: 650, y: 0 });
  chaser._scanResult = prey2;
  AI.think(chaser);
  t('离巢超阈值 → LEASH 放弃', chaser._aiState === AI.STATES.LEASH &&
    chaser.attackTarget === null && chaser.moveTarget.x === 0);

  BALANCE.AI.CHASE_GIVE_UP = orig;
  const loyal = mkUnit({ x: 250, y: 0, _scanResult: null });
  loyal.attackTarget = mkUnit({ faction: 'town', x: 300, y: 0 });
  AI.think(loyal);
  t('未离巢 → 保持 CHASE', loyal._aiState === AI.STATES.CHASE &&
    loyal.attackTarget !== null);
}

console.log('[T155] 昼夜视野系数');
{
  t('白天系数=1', Math.abs(AI.visionMul(1) - 1) < 1e-9);
  t('深夜系数=NIGHT_VISION_MIN(0.6)', Math.abs(AI.visionMul(0) - 0.6) < 1e-9);
  t('黄昏(0.5)=0.8 线性插值', Math.abs(AI.visionMul(0.5) - 0.8) < 1e-9);
  t('非法输入兜底=1', AI.visionMul(undefined) === 1);
}

console.log('[T154] DEBUG 迁移追踪');
{
  traceBuf.length = 0;
  BALANCE.AI.DEBUG = true;
  const w1 = mkUnit({ wanderT: -1 });   /* 游荡触发：IDLE→WANDER */
  AI.think(w1);
  BALANCE.AI.DEBUG = false;
  t('trace 记录 WANDER 迁移', traceBuf.some(e2 => e2.to === AI.STATES.WANDER));
  t('trace 条目含 name/from/to',
    traceBuf.every(e2 => e2.name && e2.from !== undefined && e2.to !== undefined));
}

console.log(`\nM6 单元测试: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log('ALL PASS');
