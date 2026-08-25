/* ============================================================
 * M3 单元测试（T097 校验器 / T098 强度距离单调性）
 * 运行：node test/unit/m3-tests.js
 * ============================================================ */
const Validate = require('../../src/data/validate.js');
const Spawner = require('../../src/world/Spawner.js');
const Items = require('../../src/data/items.js');
const Enemies = require('../../src/data/enemies.js');

let failed = 0, passed = 0;
function t(name, cond) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); }
}

/* ---------- T097 物品表校验器 ---------- */
console.log('[T097] 物品表校验');
const itemErrs = Validate.validateItems(Items.all);
t('现有全部物品通过校验', itemErrs.length === 0);
if (itemErrs.length) console.log('  错误: ' + itemErrs.join(';'));

t('缺少 name 被拒绝', Validate.validateItem({ id: 'x', type: 'material', price: 1 }).length > 0);
t('负价格被拒绝', Validate.validateItem({ id: 'x', name: 'x', type: 'material', price: -5 }).length > 0);
t('未知 type 被拒绝', Validate.validateItem({ id: 'x', name: 'x', type: 'magic', price: 1 }).length > 0);
t('武器缺 dmg 被拒绝',
  Validate.validateItem({ id: 'w', name: 'w', type: 'weapon', price: 1, reach: 10, speed: 1 }).length > 0);

/* ---------- T098 强度随距离单调不减 ---------- */
console.log('[T098] tier-距离单调性');
function tierAt(dh, roll) {
  Spawner.attach({ rng: function () { return roll; } });
  return Spawner.tierForDistance(dh);
}
let monoOK = true;
[0.05, 0.2, 0.4, 0.6, 0.9].forEach(function (roll) {
  const t500 = tierAt(500, roll), t1500 = tierAt(1500, roll), t2500 = tierAt(2500, roll);
  if (!(t500 <= t1500 && t1500 <= t2500)) monoOK = false;
});
t('任意随机数下：距离越远 tier 不减', monoOK);

/* ---------- 敌人原型校验 ---------- */
console.log('[数据] 敌人原型校验');
const enemyErrs = Validate.validateEnemies(Enemies.ENEMIES);
t('敌人原型全部合法', enemyErrs.length === 0);
if (enemyErrs.length) console.log('  错误: ' + enemyErrs.join(';'));
t('卫兵原型合法', Validate.validateEnemy(Enemies.GUARD).length === 0);

/* ---------- 结果 ---------- */
console.log(failed === 0 ? 'M3 TESTS: ALL PASS (' + passed + ')' :
  'M3 TESTS: FAIL (' + failed + ' failures)');
process.exit(failed === 0 ? 0 : 1);
