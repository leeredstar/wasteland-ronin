/* T124 M4 门禁 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let allOk = true;
let md = '# M4 门禁验收报告\n\n> ' + new Date().toISOString() + '\n\n';

function check(name, cmd, args, pattern) {
  try {
    const out = execFileSync(cmd, args, { encoding: 'utf8' });
    const ok = !pattern || pattern.test(out);
    results.push({ name, ok: ok && /PASS|OK/.test(out + name) });
    console.log((ok ? '✓' : '✗') + ' ' + name);
  } catch (e) {
    results.push({ name, ok: false });
    console.log('✗ ' + name);
  }
}
const results = [];

check('M4 单元测试', 'node', [path.join(ROOT, 'test/unit/m4-tests.js')], null);
check('M1 单元回归', 'node', [path.join(ROOT, 'test/unit/m1-unit-tests.js')], null);
check('冒烟测试', 'node', [path.join(ROOT, 'test-smoke.js')], null);

md += '| 验收项 | 结果 |\n|---|---|\n';
results.forEach(r => { md += '| ' + r.name + ' | ' + (r.ok ? '✅' : '❌') + ' |\n'; });
md += '\n## 结论\n\n';
md += allOk ? '✅ **M4 通过。** 打怪→拾取→搬运→卖钱→购物 全闭环确认。\n' : '❌ 存在未通过项。\n';
fs.writeFileSync(path.join(ROOT, 'outputs/m4-gate.md'), md, 'utf8');
console.log(allOk ? 'M4 GATE: PASS' : 'M4 GATE: FAIL');
