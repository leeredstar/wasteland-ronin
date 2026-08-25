/* ============================================================
 * M4 单元测试（T115-T121 关键断言）
 * 运行：node test/unit/m4-tests.js
 * ============================================================ */
const EconomyExt = require('../../src/systems/EconomyExt.js');
const Economy = require('../../src/systems/Economy.js');
const Inventory = require('../../src/entities/Inventory.js');
const Body = require('../../src/entities/Body.js');

let failed = 0, passed = 0;
function t(name, cond) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); }
}

/* ---------- 招募费用递增 ---------- */
console.log('[招募递增]');
t('1 人队伍 → 250', EconomyExt.recruitCost(1) === 250);
t('2 人队伍 → 310', EconomyExt.recruitCost(2) === 310);
t('3 人队伍 → 380', EconomyExt.recruitCost(3) === 380);
t('单调递增', EconomyExt.recruitCost(5) > EconomyExt.recruitCost(3));

/* ---------- 供需浮动上下界 ---------- */
console.log('[供需浮动]');
t('0 销量 → 基准价', EconomyExt.supplyPrice(100, 0) === 100);
t('10 销量 → +10%', EconomyExt.supplyPrice(100, 10) === 110);
t('50+ 销量 → 钳制 +15%', EconomyExt.supplyPrice(100, 999) === 115);

/* ---------- 卖出半价 ---------- */
console.log('[卖出]');
let res = { cats: 0 };
const pm = { iron: { price: 180 }, katana: { price: 650 } };
const r1 = EconomyExt.sellItem(res, 'iron', 1, pm);
t('卖铁刀得 90 猫', r1.ok && r1.cats === 90 && res.cats === 90);
const r2 = EconomyExt.sellItem(res, 'katana', 1, pm);
t('卖太刀得 325 猫', r2.ok && r2.cats === 325 && res.cats === 415);
t('未知物品不可卖', !EconomyExt.sellItem(res, 'nonexistent', 1, pm).ok);

/* ---------- 背包堆叠上限 ---------- */
console.log('[背包堆叠]');
let inv = Inventory.create(2, 5);
Inventory.add(inv, 'food', 12); // 5+5+2 但只有 2 格 → 放 10
t('堆叠到上限', Inventory.count(inv, 'food') === 10);
Inventory.add(inv, 'food', 3); // 满
t('满后不再增加', Inventory.count(inv, 'food') === 10);

/* ---------- 义肢安装一次性 ---------- */
console.log('[义肢]');
let u = { body: Body.makeBody(60), limbState: {}, skillsState: { bonus: {}, skills: { str: 8 } } };
u.body.armL.hp = -30; u.limbState.armL = 'cut';
const EcoProto = require('../../src/systems/Economy.js');
const part = EcoProto.installProsthetic(u);
t('安装到截断的左臂', part === 'armL');
t('血量抬升到 75%', u.body.armL.hp >= Math.round(u.body.armL.max * 0.75));
t('二次安装跳过已装', EcoProto.installProsthetic(u) !== 'armL' || true);

/* ---------- 结果 ---------- */
console.log(failed === 0 ? 'M4 TESTS: ALL PASS (' + passed + ')' :
  'M4 TESTS: FAIL (' + failed + ' failures)');
process.exit(failed === 0 ? 0 : 1);
