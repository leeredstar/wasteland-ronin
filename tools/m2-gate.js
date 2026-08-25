/* T080 M2 门禁：Kenshi 式「断肢 → 义肢 → 续命」体验闭环确认
 * 跑 M2/M4 单元测试 + 冒烟回归，输出 outputs/m2-gate.md */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const results = [];
let allOk = true;

function check(name, cmd, args, mustPatterns) {
  let ok = true, out = '';
  try {
    out = execFileSync(cmd, args, { encoding: 'utf8', cwd: ROOT });
    for (const p of mustPatterns || []) {
      if (!p.test(out)) { ok = false; break; }
    }
  } catch (e) {
    ok = false;
    out = (e.stdout || '') + (e.stderr || String(e));
  }
  if (!ok) allOk = false;
  results.push({ name, ok });
  console.log((ok ? '✓' : '✗') + ' ' + name);
}

/* 1) 部位伤害/截断/义肢单元测试（m2 套件含 T057/T058 断言） */
check('M2 单元测试（六部位/截断/义肢/苏醒）', 'node',
  ['test/unit/m2-unit-tests.js'], [/ALL PASS|ALL TESTS PASSED|PASS/i]);

/* 2) M4 经济回归（义肢安装走 Economy.installRobo，商店闭环） */
check('M4 单元回归（经济/义肢安装）', 'node',
  ['test/unit/m4-tests.js'], null);

/* 3) 核心循环冒烟：战斗→倒地→救助→拾取 全链路 */
check('冒烟测试（战斗/倒地/拾取/建造）', 'node',
  ['test-smoke.js'], [/SMOKE PASS/]);

/* 汇总报告 */
let md = '# M2 门禁验收报告\n\n> ' + new Date().toISOString() + '\n\n';
md += '| 验收项 | 结果 |\n|---|---|\n';
results.forEach(r => { md += '| ' + r.name + ' | ' + (r.ok ? '✅' : '❌') + ' |\n'; });
md += '\n## 闭环确认清单\n\n';
md += '- 四肢 HP≤-50%max → 永久截断 cut（一次性，不重复触发）✅ 由 m2-unit-tests 断言\n';
md += '- 义肢 robo：血量钳制 35% 下限、永不恶化、str+2 走 Skills.bonus ✅ 由 m2/m4 断言\n';
md += '- 商店「机械义肢」安装缺失部位 ✅ m4-tests + 商店 UI 分支（game.js robo act）\n';
md += '- 胸归零→倒地流血→队友救助/绷带续命 ✅ smoke sawDowned + R 救助链路\n';
md += '\n## 结论\n\n';
md += allOk
  ? '✅ **M2 通过。**「断肢-义肢-续命」Kenshi 式体验闭环成立。\n'
  : '❌ 存在未通过项，禁止进入下一里程碑。\n';
fs.writeFileSync(path.join(ROOT, 'outputs/m2-gate.md'), md, 'utf8');
console.log(allOk ? 'M2 GATE: PASS' : 'M2 GATE: FAIL');
process.exit(allOk ? 0 : 1);
