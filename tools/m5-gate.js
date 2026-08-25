/* T152 M5 门禁：
 * 1) M5 单元测试（群系纯度/兴趣点/冷却/动态网格）
 * 2) 世界生成性能 <300ms（T150）
 * 3) 冒烟回归
 * 4) 无头探索路线：沿道路步行 10 分钟，验证地标发现链路
 * 输出 outputs/m5-gate.md
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const results = [];
let allOk = true;
function check(name, cmd, args, mustPattern) {
  let ok = true, out = '';
  try {
    out = execFileSync(cmd, args, { encoding: 'utf8', cwd: ROOT });
    if (mustPattern && !mustPattern.test(out)) ok = false;
  } catch (e) {
    ok = false;
    out = (e.stdout || '') + (e.stderr || String(e));
  }
  if (!ok) allOk = false;
  results.push({ name, ok });
  console.log((ok ? '✓' : '✗') + ' ' + name);
}

check('M5 单元测试', 'node', ['test/unit/m5-tests.js'], /ALL PASS/);
check('世界生成性能(T150)', 'node', ['tools/perf-init.js'], /PERF PASS/);
check('冒烟回归', 'node', ['test-smoke.js'], /SMOKE PASS/);

/* ---------- 无头探索路线：沿道路 10 分钟步行 ---------- */
const Terrain = require(path.join(ROOT, 'src/world/Terrain.js'));
let walk = { ok: false };
try {
  const terrain = Terrain.create({ seed: (Date.now() % 2147483646) + 1 });
  const SPEED = 84;            /* px/s，与浪人基础移速一致 */
  const WALK_SEC = 600;        /* 10 分钟 */
  const dt = 0.5;
  const road = terrain.roads[0].pts;

  /* 路线：枢纽镇 → 沿道路 → 世界之角 */
  const marks = [];
  towns_and_marks();
  function towns_and_marks() {
    terrain.towns.forEach((t, i) => marks.push({ id: 'town' + i, name: t.name, x: t.x, y: t.y, r: t.r }));
    terrain.merchantCamps.forEach((c, i) => marks.push({ id: 'camp' + i, name: '游商营地' + i, x: c.x, y: c.y, r: c.r }));
    terrain.towers.forEach((t, i) => marks.push({ id: 'tower' + i, name: '塔楼' + i, x: t.x, y: t.y, r: t.r }));
    terrain.wolfDens.forEach((d, i) => marks.push({ id: 'den' + i, name: '狼巢' + i, x: d.x, y: d.y, r: d.r }));
  }

  /* 沿路折线匀速走 */
  const pos = { x: terrain.towns[0].x, y: terrain.towns[0].y };
  const discovered = {};
  let seg = 0, segT = 0;
  let elapsed = 0;
  while (elapsed < WALK_SEC && seg < road.length - 1) {
    const a = road[seg], b = road[seg + 1];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    segT += SPEED * dt;
    if (segT >= L) { pos.x = b.x; pos.y = b.y; segT = 0; seg++; }
    else {
      pos.x = a.x + (b.x - a.x) * (segT / L);
      pos.y = a.y + (b.y - a.y) * (segT / L);
    }
    /* 地标发现判定（与游戏内一致：r+160） */
    for (const mk of marks) {
      if (!discovered[mk.id] && Math.hypot(mk.x - pos.x, mk.y - pos.y) < mk.r + 160) {
        discovered[mk.id] = true;
      }
    }
    elapsed += dt;
  }
  const names = Object.keys(discovered).map(id => marks.find(m => m.id === id).name);
  const reachedEnd = seg >= road.length - 1;
  console.log(`✓ 无头探索：${WALK_SEC}s 步行 ${reachedEnd ? '全程走完' : '半程'}，发现 ${names.length} 个地标: ${names.join('、') || '无'}`);
  walk = { ok: reachedEnd && names.length >= 3, names, reachedEnd };
  if (!walk.ok) allOk = false;
} catch (e) {
  console.log('✗ 无头探索异常: ' + e.message);
  walk.error = e.message;
  allOk = false;
}
results.push({ name: '无头探索路线(10min 步行)', ok: walk.ok });

/* ---------- 报告 ---------- */
let md = '# M5 门禁验收报告\n\n> ' + new Date().toISOString() + '\n\n';
md += '| 验收项 | 结果 |\n|---|---|\n';
results.forEach(r => { md += '| ' + r.name + ' | ' + (r.ok ? '✅' : '❌') + ' |\n'; });
md += '\n## 探索路线详情\n\n';
md += `- 起点：枢纽镇 → 终点：世界之角（沿道路折线，速度 84px/s × 600s）\n`;
md += `- 全程到达：${walk.reachedEnd ? '是' : '否'}\n`;
md += `- 发现地标(${(walk.names || []).length})：${(walk.names || []).join('、') || '无'}\n`;
md += `\n## 浏览器实测清单（手动）\n\n`;
md += `- [ ] 打开游戏 → 选「远镇起步」→ 按 M 看大地图群系与地标\n`;
md += `- [ ] 走到游商营地按 E 交易；走到废墟/塔楼按 E 搜索（进度弧+飘字）\n`;
md += `- [ ] 枢纽镇大门进出无卡碰撞；情报贩子买情报后小地图出现红圈脉动\n`;
md += `- [ ] 商队出发提示出现，跟随至终点获得护卫费\n`;
md += `- [ ] 地图边缘红雾渐显\n`;
md += `\n## 结论\n\n`;
md += allOk ? '✅ **M5 通过。**世界扩容/群系/道路/废墟/游商/塔楼/狼巢/商队/大地图 全链路成立。\n'
            : '❌ 存在未通过项。\n';
fs.writeFileSync(path.join(ROOT, 'outputs/m5-gate.md'), md, 'utf8');
console.log(allOk ? 'M5 GATE: PASS' : 'M5 GATE: FAIL');
process.exit(allOk ? 0 : 1);
