/* T032 M0 门禁：汇总执行全部验收项，生成 outputs/m0-gate.md */
const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/wasteland-ronin';

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail || 'OK' });
  } catch (e) {
    results.push({ name, ok: false, detail: String(e.message || e).split('\n')[0] });
  }
}
function nodeCheck(rel) {
  execFileSync('node', ['--check', path.join(ROOT, rel)], { stdio: 'pipe' });
}

/* 1) 全部 JS 语法检查 */
const jsFiles = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (!/node_modules|outputs/.test(f)) walk(full);
    } else if (f.endsWith('.js')) jsFiles.push(path.relative(ROOT, full));
  }
}
walk(ROOT);
check('JS 语法检查（' + jsFiles.length + ' 个文件）', function () {
  for (const f of jsFiles) nodeCheck(f);
  return jsFiles.length + ' 个文件全部通过';
});

/* 2) 冒烟测试 ×3 */
let smokePass = 0, smokeTimes = [];
for (let i = 0; i < 3; i++) {
  const t0 = Date.now();
  const out = execFileSync('node', [path.join(ROOT, 'test-smoke.js')], { encoding: 'utf8' });
  smokeTimes.push(Date.now() - t0);
  if (/SMOKE PASS/.test(out)) smokePass++;
}
check('冒烟测试 ×3（含左键移动/睡眠/建造断言）', function () {
  if (smokePass !== 3) throw new Error('仅 ' + smokePass + '/3 通过');
  return '3/3 通过，耗时 ' + smokeTimes.join('/') + 'ms';
});

/* 3) DOM 门禁 */
check('逻辑层 DOM 纯净度', function () {
  const out = execFileSync('node', [path.join(ROOT, 'tools/dom-audit.js')], { encoding: 'utf8' });
  if (!/门禁: PASS/.test(out)) throw new Error('DOM 门禁失败');
  return 'systems/entities/world 零 document 引用';
});

/* 4) 装配链完整性：smoke 的 FILES 清单必须覆盖全部模块且顺序正确 */
check('装配链（core→entities/systems/world→legacy→main）', function () {
  const smokeSrc = fs.readFileSync(path.join(ROOT, 'test-smoke.js'), 'utf8');
  const order = ['core/RNG', 'core/EventBus', 'core/Engine', 'world/Time',
                 'input/Camera', 'input/Input', 'entities/Body',
                 'systems/Combat', 'systems/AI', 'systems/Survival',
                 'systems/Economy', 'systems/Build', 'world/Spawner',
                 'js/game.js', 'src/main.js'];
  let last = -1;
  for (const frag of order) {
    const i = smokeSrc.indexOf(frag);
    if (i < 0) throw new Error('装配清单缺少: ' + frag);
    if (i < last) throw new Error('装配顺序错误: ' + frag);
    last = i;
  }
  return order.length + ' 个模块顺序校验通过';
});

/* 5) 随机审计报告存在 */
check('随机性审计报告', function () {
  const f = path.join(ROOT, 'outputs/random-audit.md');
  if (!fs.existsSync(f)) throw new Error('缺少 outputs/random-audit.md');
  const c = fs.readFileSync(f, 'utf8');
  const m = c.match(/合计.*?\*\*(\d+)\*\*/);
  return '共 ' + (m ? m[1] : '?') + ' 处调用点已登记迁移方案';
});

/* 输出报告 */
let md = '# M0 门禁验收报告\n\n';
md += '> 时间：' + new Date().toISOString() + '\n\n';
md += '| # | 验收项 | 结果 | 详情 |\n|---|---|---|---|\n';
let allOk = true;
results.forEach((r, i) => {
  if (!r.ok) allOk = false;
  md += '| ' + (i + 1) + ' | ' + r.name + ' | ' + (r.ok ? '✅' : '❌') + ' | ' + r.detail + ' |\n';
});
md += '\n## 手动试玩核对清单（待玩家确认）\n\n';
md += '- [ ] 左键点空地，角色走过去\n- [ ] 右键点敌人，进入战斗\n- [ ] 被击倒后队友 R 救助成功\n- [ ] V 扎营 → Z 睡到第 2 天\n- [ ] B 建围墙挡住一次追击\n- [ ] 进城镇 E 买东西/招募\n- [ ] 夜晚篝火发光、白天正常\n';

md += '\n## 结论\n\n';
md += allOk
  ? '✅ **M0 全部自动化验收通过。** 手动清单确认后即可关闭里程碑。\n'
  : '❌ **存在未通过项，禁止关闭 M0。**\n';

fs.writeFileSync(path.join(ROOT, 'outputs/m0-gate.md'), md, 'utf8');
console.log(md.split('\n').filter(l => l.startsWith('| ') || l.includes('结论')).join('\n'));
console.log(allOk ? 'M0 GATE: PASS' : 'M0 GATE: FAIL');
if (!allOk) process.exit(1);
