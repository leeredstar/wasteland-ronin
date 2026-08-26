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
  nearestLoot: u => u._loot || null,     /* T164 */
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

console.log('[T160] A* 寻路模块');
{
  const PF = require(path.join(ROOT, 'src/world/Pathfinding.js'));
  /* 1) 空网格直线可达（默认开启平滑，直线路径折叠为少量点） */
  const open = PF.create({ worldW: 800, worldH: 800, cell: 40 });
  const p1 = open.findPath(40, 40, 760, 760);
  t('空网格：找到路径', !!p1 && p1.length >= 2);
  t('终点为精确坐标', !!p1 && p1[p1.length - 1].x === 760 && p1[p1.length - 1].y === 760);

  /* 1b) 关闭平滑时保留完整格点序列 */
  const rawPf = PF.create({ worldW: 800, worldH: 800, cell: 40, smooth: false });
  const raw = rawPf.findPath(40, 40, 760, 760);
  t('关闭平滑：保留格点序列（>6 点）', !!raw && raw.length > 6);

  /* 2) 垂直墙（col=10）留缺口 → 必须绕到缺口；用未平滑路径做几何断言 */
  const wallCol = 10;
  const walled = PF.create({
    worldW: 800, worldH: 800, cell: 40,
    smooth: false,
    isBlocked: (cx, cy) => cx === wallCol && !(cy >= 9 && cy <= 11)
  });
  const p2 = walled.findPath(200, 400, 600, 400);
  t('有墙+缺口：仍可达', !!p2);
  if (p2) {
    const throughGap = p2.some(pt =>
      Math.abs(pt.x - (wallCol * 40 + 20)) < 45 && pt.y >= 340 && pt.y <= 470);
    t('路径穿过缺口区域', throughGap);
  }

  /* 3) 完全围死 → null */
  const sealed = PF.create({
    worldW: 800, worldH: 800, cell: 40,
    smooth: false,
    isBlocked: (cx) => cx === 10
  });
  t('完全阻隔返回 null', sealed.findPath(200, 400, 600, 400) === null);
}

console.log('[T161/T162] 节流规划器 + 路径平滑');
{
  const PF = require(path.join(ROOT, 'src/world/Pathfinding.js'));
  /* 平滑：空网格对角路径应被大幅裁剪（默认开启平滑） */
  const open = PF.create({ worldW: 800, worldH: 800, cell: 40 });
  const sm2 = open.findPath(40, 40, 760, 760);
  t('平滑后点数 ≤4', !!sm2 && sm2.length <= 4);
  const smEnd = sm2[sm2.length - 1];
  t('平滑保留精确终点', smEnd.x === 760 && smEnd.y === 760);

  /* 节流：同 key 同目的地冷却期内走缓存 */
  let calls = 0;
  const pfStub = { findPath: () => { calls++; return [{ x: 0, y: 0 }]; } };
  let fakeT = 0;
  const planner = PF.createPlanner({ pf: pfStub, cooldown: 0.5, now: () => fakeT });
  planner.request('hero', 0, 0, 500, 500);
  planner.request('hero', 2, 2, 505, 503);      // 冷却内近似同目的地
  t('冷却期内复用缓存', calls === 1);
  fakeT = 1.0;
  planner.request('hero', 0, 0, 500, 500);      // 冷却结束重算
  t('冷却结束重新计算', calls === 2);
}

console.log('[T164] 奴隶搬运三态细化');
{
  const carrier = mkUnit({ faction: 'slave' });
  carrier._loot = { x: 120, y: 80 };
  AI.think(carrier);
  t('附近有掉落物 → CARRY 且走向掉落点', carrier._aiState === 'carry' &&
    carrier.moveTarget && Math.abs(carrier.moveTarget.x - 120) < 0.01);

  const follower = mkUnit({ faction: 'slave' });   // 无掉落 → FOLLOW
  AI.think(follower);
  t('无掉落 → 保持 FOLLOW', follower._aiState === 'follow');

  const scared = mkUnit({ faction: 'slave' });
  scared.lastAttacker = mkUnit({ faction: 'bandit', x: 60, y: 0 });
  scared._loot = { x: 0, y: 0 };
  AI.think(scared);
  t('遇袭时 FLEE 优先于搬运', scared._aiState === 'flee');
}

console.log('[T173] FSM 全状态进入/退出覆盖');
{
  /* WANDER：进入后设置漫游目标；获得目标即切 CHASE 退出 */
  const w = mkUnit({ wanderT: -1 });
  AI.think(w);
  t('进入 WANDER：设置了 moveTarget', w._aiState === 'wander' && !!w.moveTarget);
  w._scanResult = mkUnit({ faction: 'town', x: 100, y: 0 });
  AI.think(w);
  t('WANDER 退出 → CHASE', w._aiState === 'chase' && w.attackTarget !== null);

  /* FLEE 退出：恐惧期结束且血量回升 */
  const c = mkUnit({ faction: 'hungry', fearT: 0 });
  c.body.chest.hp = 10;
  AI.think(c);
  t('进入 FLEE（fearT 置位）', c._aiState === 'flee' && c.fearT > 0);
  c.body.chest.hp = c.body.chest.max;
  c.fearT = 0;
  AI.think(c);
  t('血量恢复后 FLEE 不再触发', c._aiState !== 'flee');

  /* LEASH 退出：回到岗位半径内 */
  const g = mkUnit({ faction: 'town', x: 500, y: 0, homePoint: { x: 500, y: 0 } });
  AI.think(g);
  t('卫兵在岗不进 LEASH', g._aiState !== 'leash');

  /* STAY 进入/取消 */
  const st1 = mkUnit({ faction: 'slave', stayAt: { x: 50, y: 50 } });
  AI.think(st1);
  t('驻守奴隶 → STAY', st1._aiState === 'stay');
  st1.stayAt = null;
  st1._loot = null;
  AI.think(st1);
  t('取消驻守 → 回到 FOLLOW', st1._aiState === 'follow');

  /* CARRY 退出：掉落物消失 */
  const cr = mkUnit({ faction: 'slave', _loot: { x: 30, y: 30 } });
  AI.think(cr);
  t('进入 CARRY', cr._aiState === 'carry');
  cr._loot = null;
  AI.think(cr);
  t('掉落消失 → CARRY 退出回 FOLLOW', cr._aiState === 'follow');
}

console.log('[T174] A* 迷宫绕墙');
{
  const PF = require(path.join(ROOT, 'src/world/Pathfinding.js'));
  /* S 形迷宫：两道横墙错位留通道，路径必须上下穿行 */
  const maze = PF.create({
    worldW: 800, worldH: 800, cell: 40, smooth: false,
    isBlocked: (cx, cy) =>
      (cy === 5 && cx <= 13) ||     /* 上横墙：右侧留口 */
      (cy === 14 && cx >= 6)        /* 下横墙：左侧留口 */
  });
  const pm = maze.findPath(40, 100, 760, 700);
  t('迷宫存在通路', !!pm);
  if (pm) {
    const crossesTopGap = pm.some(p => Math.abs(p.y - (5 * 40 + 20)) < 30 && p.x > 500);
    const crossesBottomGap = pm.some(p => Math.abs(p.y - (14 * 40 + 20)) < 30 && p.x < 320);
    t('路径穿过上墙右口', crossesTopGap);
    t('路径穿过下墙左口', crossesBottomGap);
    t('绕行路径点数 > 直线所需(>12)', pm.length > 12);
  }
}

console.log('[T175] 诱饵优先选择');
{
  const u = mkUnit({ faction: 'beast' });
  u._scanResult = null;
  const nearBait = { x: 100, y: 0 };
  const farBait = { x: 500, y: 0 };
  t('范围内返回最近诱饵', AI.pickBait(u, [farBait, nearBait], 620, dist) === nearBait);
  t('范围外返回 null', AI.pickBait(u, [{ x: 2000, y: 0 }], 620, dist) === null);
  t('空列表返回 null', AI.pickBait(u, [], 620, dist) === null);
}

console.log('[T176] 协防参数契约');
{
  const A = BALANCE.AI;
  t('SUPPORT_RADIUS=300', A.SUPPORT_RADIUS === 300);
  t('SUPPORT_TICK=0.5（响应时间上限）', A.SUPPORT_TICK === 0.5);
  t('GUARD_CALL_RADIUS=620', A.GUARD_CALL_RADIUS === 620);
  t('REP_ASSIST_RADIUS=420', A.REP_ASSIST_RADIUS === 420);
  t('REP_ASSIST_MIN=20', A.REP_ASSIST_MIN === 20);
}

console.log(`\nM6 单元测试: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log('ALL PASS');
