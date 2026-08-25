/* ============================================================
 * M5 单元测试（T151）：群系函数纯度 + Terrain 行为 + World 动态网格
 * 运行：node test/unit/m5-tests.js
 * ============================================================ */
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const Terrain = require(path.join(ROOT, 'src/world/Terrain.js'));
const WorldMod = require(path.join(ROOT, 'src/world/World.js'));

let passed = 0, failed = 0;
function t(name, cond) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); }
}

console.log('[T151] 群系函数纯度（同种子同输出）');
{
  const a = Terrain.create({ seed: 777 });
  const b = Terrain.create({ seed: 777 });
  let same = true;
  for (let i = 0; i < 400; i++) {
    const x = (i * 97) % 8000, y = (i * 191) % 8000;
    if (a.biomeAt(x, y) !== b.biomeAt(x, y)) { same = false; break; }
    if (a.patchIndex(x, y, 3) !== b.patchIndex(x, y, 3)) { same = false; break; }
  }
  t('同种子两次生成：biomeAt/patchIndex 完全一致', same);

  /* 装饰与兴趣点也必须逐点一致 */
  const sameDecor = a.decor.length === b.decor.length &&
    a.decor.every((d, i) => d.x === b.decor[i].x && d.y === b.decor[i].y);
  t('同种子：装饰点位完全一致', sameDecor);

  /* 不同种子：至少在采样网格上出现不同群系 */
  const c = Terrain.create({ seed: 778 });
  let diff = false;
  for (let i = 0; i < 400; i++) {
    const x = (i * 97) % 8000, y = (i * 191) % 8000;
    if (a.biomeAt(x, y) !== c.biomeAt(x, y)) { diff = true; break; }
  }
  t('不同种子：群系分布出现差异', diff);
}

console.log('[世界] 兴趣点布置完整性');
{
  const w = Terrain.create({ seed: 42 });
  const st = w.stats();
  t('三群系均有分布', Object.values(st.biomes).every(v => v > 0));
  t('废墟 ≥12', st.ruins >= 12);
  t('塔楼 =2', st.towers === 2);
  t('游商营地 =2', st.merchants === 2);
  t('狼巢 ≥3', st.wolfDens >= 3);
  t('道路 =1（两镇连线）', st.roads === 1);

  /* 塔楼已并入 ruins 统一搜索接口 */
  const towerInRuins = w.towers.every(tw =>
    w.ruins.some(r => r.id === tw.id && r.type === 'tower' && r.tier === 3));
  t('塔楼并入 ruins（tier3）', towerInRuins);
}

console.log('[废墟] 搜索冷却行为');
{
  const w = Terrain.create({ seed: 9 });
  const ru = w.ruins[0];
  let gt = 100;
  let fakeRng = () => 0.5;
  const l1 = w.scavenge(ru, gt, fakeRng);
  t('首次搜索有战利品', !!l1);
  t('冷却时间被置位', ru.coolUntil > gt);
  const l2 = w.scavenge(ru, gt + 10, fakeRng);
  t('冷却中搜索返回 null', l2 === null);
  const l3 = w.scavenge(ru, ru.coolUntil + 1, fakeRng);
  t('冷却结束后可再搜', !!l3);
}

console.log('[T147] World 空间哈希动态 cellSize');
{
  const W1 = new WorldMod({ worldSize: { w: 8000, h: 8000 } });
  t('8000 世界 → cell=100', W1.cellSize === 100);
  const W2 = new WorldMod({ worldSize: { w: 16000, h: 16000 } });
  t('16000 世界 → cell 封顶 200', W2.cellSize === 200);
  const W3 = new WorldMod({});
  t('缺省仍可用（兼容旧调用）', W3.cellSize >= 60 && W3.cellSize <= 200);

  /* 查询正确性冒烟 */
  const world = new WorldMod({ worldSize: { w: 8000, h: 8000 } });
  const e1 = { x: 5000, y: 5000 };
  const e2 = { x: 5150, y: 5050 };
  world.add(e1); world.add(e2);
  const hit = world.queryCircle(5000, 5000, 60);
  t('queryCircle 命中近邻', hit.includes(e1) && !hit.includes(e2));
  e2.x = 5030;   /* 距圆心 √(30²+50²)≈58.3 < 60，且跨到另一 cell(50,50) */
  world.syncPosition(e2);
  const hit2 = world.queryCircle(5000, 5000, 60);
  t('syncPosition 后跨格查询命中', hit2.includes(e2));
}

console.log(`\nM5 单元测试: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log('ALL PASS');
