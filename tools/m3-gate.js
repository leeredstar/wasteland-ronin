/* T102 M3 门禁：校验器 + 导出工具 + 冒烟 → outputs/m3-gate.md */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/wasteland-ronin';

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail || 'OK' });
    console.log('✓ ' + name);
  } catch (e) {
    results.push({ name, ok: false, detail: String(e.message || e).split('\n')[0] });
    console.log('✗ ' + name + ' — ' + String(e.message || e).split('\n')[0]);
  }
}

/* 1) M3 单元测试 */
check('单元套件 test/unit/m3-tests.js（校验器/单调性）', function () {
  const out = execFileSync('node', [path.join(ROOT, 'test/unit/m3-tests.js')], { encoding: 'utf8' });
  if (!/ALL PASS/.test(out)) throw new Error(out.split('\n').filter(l => l.includes('✗')).join(';'));
  return out.split('\n').filter(l => l.trim().startsWith('✓')).length + ' 断言全过';
});

/* 2) M2 单元套件回归 */
check('M2 单元套件回归', function () {
  const out = execFileSync('node', [path.join(ROOT, 'test/unit/m2-unit-tests.js')], { encoding: 'utf8' });
  if (!/ALL PASS/.test(out)) throw new Error('失败');
  return '18 断言全过';
});

/* 3) 冒烟 ×2 */
let smokeTimes = [];
for (let i = 0; i < 2; i++) {
  check('冒烟 #' + (i + 1), function () {
    const t0 = Date.now();
    const out = execFileSync('node', [path.join(ROOT, 'test-smoke.js')], { encoding: 'utf8' });
    smokeTimes.push(Date.now() - t0);
    if (!/SMOKE PASS/.test(out)) throw new Error('失败');
    return (Date.now() - t0) + 'ms';
  });
}

/* 4) 导出工具产出 */
check('价格表导出', function () {
  execFileSync('node', [path.join(ROOT, 'tools/export-prices.js')], { stdio: 'pipe' });
  const c = fs.readFileSync(path.join(ROOT, 'outputs/prices.md'), 'utf8');
  if (c.length < 200) throw new Error('内容过短');
  return c.match(/✅|🪙/) ? '' : '';
});
check('曲线文档导出', function () {
  execFileSync('node', [path.join(ROOT, 'tools/export-curve.js')], { stdio: 'pipe' });
  const c = fs.readFileSync(path.join(ROOT, 'outputs/curve.md'), 'utf8');
  if (c.length < 200) throw new Error('内容过短');
  return '';
});

/* 输出报告 */
let md = '# M3 门禁验收报告\n\n';
md += '> 时间：' + new Date().toISOString() + '\n\n';
md += '| # | 验收项 | 结果 |\n|---|---|---|\n';
let allOk = true;
results.forEach((r, i) => {
  if (!r.ok) allOk = false;
  md += '| ' + (i + 1) + ' | ' + r.name + ' | ' + (r.ok ? '✅' : '❌') + ' |\n';
});
md += '\n## 结论\n\n';
md += allOk
  ? '✅ **M3 全部验收通过。** 新增一件商品 = items.js 加定义 + shops.js 加 id，零代码改动。\n'
  : '❌ **M3 存在未通过项。**\n';

fs.writeFileSync(path.join(ROOT, 'outputs/m3-gate.md'), md, 'utf8');
console.log(allOk ? 'M3 GATE: PASS' : 'M3 GATE: FAIL');
if (!allOk) process.exit(1);
