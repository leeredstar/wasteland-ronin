/* ============================================================
 * M1 单元测试套件（T049-T052）
 * 覆盖：命中率边界 · 部位权重归一 · 倒地流血死亡时序 · 敌对矩阵真值表
 * 运行：node test/unit/m1-unit-tests.js
 * ============================================================ */
const Body = require('../../src/entities/Body.js');
const SkillsMod = require('../../src/entities/Skills.js');
const Balance = require('../../src/data/balance.js');
const Combat = require('../../src/systems/Combat.js');
const Factions = require('../../src/data/factions.js');

/* Combat 独立运行时使用 FALLBACK；此处强制对齐共享表以测真实配置 */
/* （vm 冒烟已验证身份同源；本文件聚焦数值与规则本身） */

let failed = 0, passed = 0;
function t(name, cond) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); }
}

/* ---------- T049 命中率（闪避）公式边界 ---------- */
console.log('[T049] 命中率公式边界');
t('闪避差极大 → 收敛上限', Combat.dodgeChance(-9999, 9999) === Balance.COMBAT.DODGE_MAX);
t('闪避差极负 → 收敛下限', Combat.dodgeChance(9999, -9999) === Balance.COMBAT.DODGE_MIN);
t('零差 → 基础值', Math.abs(Combat.dodgeChance(10, 10) - Balance.COMBAT.DODGE_BASE) < 1e-12);
t('单调性：攻击越高越难被闪', Combat.dodgeChance(20, 10) < Combat.dodgeChance(10, 10));

/* ---------- T050 部位加权归一性 ---------- */
console.log('[T050] 部位加权表');
const sum = Balance.COMBAT.PART_WEIGHTS.reduce(function (a, w) { return a + w[1]; }, 0);
t('权重和 === 1', Math.abs(sum - 1) < 1e-9);
t('覆盖全部六部位',
  Balance.COMBAT.PART_WEIGHTS.length === 6 &&
  ['head','chest','armL','armR','legL','legR'].every(function(k){
    return Balance.COMBAT.PART_WEIGHTS.some(function(w){ return w[0] === k; });
  }));
/* 分布抽样：2 万次，各部位落在期望 ±15% */
(function(){
  const RNGCls = require('../../src/core/RNG.js');
  const cnt = {}; const N = 20000;
  for (let i = 1; i <= N; i++) {
    const rng = new RNGCls(i);
    const part = Combat.pickPart(rng);      // 只调用一次！
    cnt[part] = (cnt[part] || 0) + 1;
  }
  let ok = true;
  Balance.COMBAT.PART_WEIGHTS.forEach(function(w){
    const act = (cnt[w[0]] || 0) / N;
    if (Math.abs(act - w[1]) > w[1] * 0.15) ok = false;
  });
  t('部位分布抽样符合权重 ±15%', ok);
})();

/* ---------- T051 倒地→流血→死亡 时序 ---------- */
console.log('[T051] 倒地流血死亡时序（确定性模拟）');
const S = Balance.SURVIVAL;
const u = { body: Body.makeBody(60) };           // chest.max = 37
u.body.chest.hp = -1;                            // 刚被击倒
const deathAt = -u.body.chest.max * S.DEATH_AT_RATIO;   // ≈ -22.2
let simT = 0, died = false;
while (!died && simT < 300) {
  const r = (require('../../src/systems/Survival.js')).tickDowned(u, 0.05);
  simT += 0.05;
  if (r.died) { died = true; break; }
}
/* 解析期望：
 * 段1（hp > -max*30%）：净速率 = 凝结0.32 - 流血0.55 = -0.23/s，从 -1 降到 -11.1
 * 段2（hp ≤ -max*30%）：净速率 -0.55/s，从 -11.1 降到 -22.2 */
const clotAbs = u.body.chest.max * S.CLOT_ABOVE_RATIO;   // ≈11.1
const deathAbs = u.body.chest.max * S.DEATH_AT_RATIO;    // ≈22.2
const net1 = S.BLEED_RATE - S.CLOT_RATE;                 // 0.23
const seg1 = (clotAbs - 1) / net1;                       // ≈43.9s
const seg2 = (deathAbs - clotAbs) / S.BLEED_RATE;        // ≈20.2s
const expectTotal = seg1 + seg2;                          // ≈64.1s
t('流血致死发生', died);
t('时序符合解析解 (' + simT.toFixed(1) + 's ≈ ' + expectTotal.toFixed(1) + 's)',
  died && Math.abs(simT - expectTotal) < 1.5);
/* 配置不变量：死亡线比例必须大于苏醒胸线，否则会先“死”后“醒” */
t('配置不变量：死亡阈值晚于苏醒线', S.DEATH_AT_RATIO > S.WAKE_CHEST);

/* ---------- T052 敌对矩阵真值表快照 ---------- */
console.log('[T052] 敌对矩阵真值表');
const SNAPSHOT = JSON.stringify([
  ['bandit|beast', true], ['bandit|hungry', false], ['bandit|player', true],
  ['bandit|slave', true], ['bandit|town', true],
  ['beast|hungry', true], ['beast|player', true], ['beast|slave', true], ['beast|town', true],
  ['hungry|player', true], ['hungry|slave', true], ['hungry|town', true],
  ['player|slave', false], ['player|town', false],
  ['slave|town', false]
].sort());
const actual = [];
const fs2 = Factions.FACTIONS;
for (let i = 0; i < fs2.length; i++) {
  for (let j = i + 1; j < fs2.length; j++) {
    const k = Factions.pairKey(fs2[i], fs2[j]);
    actual.push([k, !Factions.FRIENDLY.has(k)]);
  }
}
actual.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
t('静态真值表与快照一致', JSON.stringify(actual) === SNAPSHOT);

/* ---------- 结果 ---------- */
console.log(failed === 0 ? 'M1 UNIT TESTS: ALL PASS' : 'M1 UNIT TESTS: FAIL (' + failed + ')');
process.exit(failed ? 1 : 0);
