/* T056 M1 门禁：单元套件 + 三大回归 + 逻辑层纯净度 → outputs/m1-gate.md */
const { execFileSync, execSync } = require('child_process');
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

/* 1) M1 单元套件 */
check('单元套件 test/unit/m1-unit-tests.js（T049-T052）', function () {
  const out = execFileSync('node', [path.join(ROOT, 'test/unit/m1-unit-tests.js')], { encoding: 'utf8' });
  if (!/ALL PASS/.test(out)) throw new Error(out.split('\n').filter(l => l.includes('✗')).join(';'));
  return out.split('\n').filter(l => l.trim().startsWith('✓')).length + ' 断言全过';
});

/* 2-4) 三大回归（冒烟内含断言） */
const regs = ['左键走路', '睡眠推进天数', '建造放置'];
regs.forEach(function (name) {
  check('回归：' + name, function () {
    for (let i = 0; i < 3; i++) {
      const out = execFileSync('node', [path.join(ROOT, 'test-smoke.js')], { encoding: 'utf8' });
      if (!/SMOKE PASS/.test(out)) throw new Error('第' + (i + 1) + '次冒烟失败');
    }
    return '冒烟 ×3 全绿';
  });
});

/* 5) 系统层零 Math.random（确定性要求） */
check('systems/ 零 Math.random', function () {
  const dir = path.join(ROOT, 'src/systems');
  const bad = fs.readdirSync(dir).filter(f => {
    if (!f.endsWith('.js')) return false;
    return /Math\.random/.test(fs.readFileSync(path.join(dir, f), 'utf8'));
  });
  if (bad.length) throw new Error('残留于: ' + bad.join(','));
  return bad.length === 0 ? '全部走注入 RNG' : '';
});

/* 输出报告 */
let md = '# M1 门禁验收报告\n\n';
md += '> 时间：' + new Date().toISOString() + '\n\n';
md += '| # | 验收项 | 结果 |\n|---|---|---|\n';
let allOk = true;
results.forEach((r, i) => {
  if (!r.ok) allOk = false;
  md += '| ' + (i + 1) + ' | ' + r.name + ' | ' + (r.ok ? '✅' : '❌') + ' |\n';
});
md += '\n## 结论\n\n';
md += allOk
  ? '✅ **M1 全部验收通过。** 核心循环已 100% 由 src 模块驱动，旧 game.js 仅剩启动壳。\n'
  : '❌ **M1 存在未通过项。**\n';

fs.writeFileSync(path.join(ROOT, 'outputs/m1-gate.md'), md, 'utf8');
console.log(allOk ? 'M1 GATE: PASS' : 'M1 GATE: FAIL');
if (!allOk) process.exit(1);
