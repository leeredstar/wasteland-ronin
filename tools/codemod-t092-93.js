/* T092/T093 codemod：商店货单配置驱动 + 掉落表字段 */
const fs = require('fs');
const GAME = 'D:/wasteland-ronin/js/game.js';
const SPAWNER = 'D:/wasteland-ronin/src/world/Spawner.js';
let edits = 0;

function repFile(file, from, to, label) {
  let s = fs.readFileSync(file, 'utf8');
  const parts = s.split(from);
  if (parts.length !== 2) { console.error('替换失败(' + label + ')：次数=' + (parts.length - 1)); process.exit(1); }
  fs.writeFileSync(file, parts[0] + to + parts[1]);
  edits++;
}

/* ---- T092：renderShop 货单改由 src/data/shops.js 驱动 ---- */
repFile(GAME,
`  function wDis(key) { return !selU || selU.weapon.key === key; }
  function aDis(key) { return !selU || (selU.armor && selU.armor.key === key); }
  var items = [
    { act: 'food', title: '🍖 干粮 ×1', desc: '恢复 45 点饱食度', cost: priced(25), disabled: res.cats < priced(25) },
    { act: 'bandage', title: '🩹 绷带 ×2', desc: '包扎伤口（按 C 使用）', cost: priced(45), disabled: res.cats < priced(45) },
    { act: 'campkit', title: '🏕️ 营地套装', desc: '就地扎营（V）：篝火+帐篷，可睡觉恢复', cost: priced(80), disabled: res.cats < priced(80) },
    { act: 'mats', title: '🧱 建筑材料 ×5', desc: '建造围墙/篝火（B 进入建造模式）', cost: priced(100), disabled: res.cats < priced(100) },
    { act: 'robo', title: '🦾 机械义肢', desc: selU ? '装到首个缺失的手臂/腿：永不残废，力量+2' : '先选择队员', cost: priced(300), disabled: res.cats < priced(300) || !selU },
    { act: 'iron', title: '🗡️ 铁刀', desc: selU ? '给 ' + selU.name + '（当前：' + selU.weapon.name + '）' : '先选择队员', cost: priced(180), disabled: res.cats < priced(180) || wDis('iron') },
    { act: 'spear', title: '🔱 长枪', desc: selU ? '给 ' + selU.name + '（一寸长一寸强）' : '先选择队员', cost: priced(230), disabled: res.cats < priced(230) || wDis('spear') },
    { act: 'mace', title: '🔨 战锤', desc: selU ? '给 ' + selU.name + '（沉重但致命）' : '先选择队员', cost: priced(270), disabled: res.cats < priced(270) || wDis('mace') },
    { act: 'katana', title: '⚔️ 野太刀', desc: selU ? '给 ' + selU.name + '（当前：' + selU.weapon.name + '）' : '先选择队员', cost: priced(650), disabled: res.cats < priced(650) || wDis('katana') },
    { act: 'leather', title: '🧥 破旧皮甲', desc: selU ? '给 ' + selU.name + '（减伤 2）' : '先选择队员', cost: priced(130), disabled: res.cats < priced(130) || aDis('leather') },
    { act: 'chain', title: '🛡️ 锁子甲', desc: selU ? '给 ' + selU.name + '（减伤 4）' : '先选择队员', cost: priced(430), disabled: res.cats < priced(430) || aDis('chain') },
    { act: 'hire', title: '🧑‍🤝‍🧑 招募同伴', desc: '小队人数 ' + sq.length + '/5 · 剑客/苦力/猎手随机', cost: priced(250), disabled: res.cats < priced(250) || sq.length >= 5 }
  ];`,
`  /* T092：货单由 data/shops.js 配置驱动；商品定义来自 data/items.js */
  var shopCfg = (WR.Shops && WR.Shops[shopTown.name]) || { stock: [] };
  function buildRow(id) {
    switch (id) {
      case 'food':    return { act: 'food',    title: '🍖 干粮 ×1',   desc: '恢复 45 点饱食度', cost: priced(25), disabled: res.cats < priced(25) };
      case 'bandage': return { act: 'bandage', title: '🩹 绷带 ×2',   desc: '包扎伤口（按 C 使用）', cost: priced(45), disabled: res.cats < priced(45) };
      case 'campkit': return { act: 'campkit', title: '🏕️ 营地套装', desc: '就地扎营（V）：篝火+帐篷，可睡觉恢复', cost: priced(80), disabled: res.cats < priced(80) };
      case 'mats':    return { act: 'mats',    title: '🧱 建材 ×5',   desc: '建造围墙/篝火（B 建造模式）', cost: priced(100), disabled: res.cats < priced(100) };
      case 'roboLimb':return { act: 'robo',    title: '🦾 机械义肢',  desc: selU ? '装到首个缺失的手臂/腿：永不残废，力量+2' : '先选择队员', cost: priced(300), disabled: res.cats < priced(300) || !selU };
      case 'hire':    return { act: 'hire',    title: '🧑‍🤝‍🧑 招募同伴', desc: '小队人数 ' + sq.length + '/5 · 剑客/苦力/猎手随机', cost: priced(250), disabled: res.cats < priced(250) || sq.length >= 5 };
    }
    var def = WR.Items.get(id);
    if (!def) return null;
    if (def.type === 'weapon') {
      var equipped = selU ? selU.weapon.key === id : false;
      return { act: id, title: def.icon + ' ' + def.name,
               desc: selU ? '给 ' + selU.name + '（当前：' + selU.weapon.name + '）' : '先选择队员',
               cost: priced(def.price),
               disabled: res.cats < priced(def.price) || !selU || equipped };
    }
    if (def.type === 'armor') {
      var hasIt = selU && selU.armor && selU.armor.key === id;
      return { act: id, title: def.icon + ' ' + def.name,
               desc: selU ? '给 ' + selU.name + '（减伤 ' + def.def + '）' : '先选择队员',
               cost: priced(def.price),
               disabled: res.cats < priced(def.price) || !selU || hasIt };
    }
    return null;
  }
  var items = (shopCfg.stock || []).map(buildRow).filter(Boolean);`, 'renderShop-stock');

/* ---- T093：掉落表字段 ---- */
repFile(SPAWNER,
`        lootMin: tier.loot[0], lootMax: tier.loot[1],`,
`        lootMin: tier.loot[0], lootMax: tier.loot[1],
        lootFoodC: tier.lootFoodChance != null ? tier.lootFoodChance : 0.3,`, 'spawner-tier-food');

repFile(SPAWNER,
`        lootMin: boss.lootMin != null ? boss.lootMin : 150,
        lootMax: boss.lootMax != null ? boss.lootMax : 320,`,
`        lootMin: boss.lootMin != null ? boss.lootMin : 150,
        lootMax: boss.lootMax != null ? boss.lootMax : 320,
        lootFoodC: boss.lootFoodChance != null ? boss.lootFoodChance : 0.4,`, 'spawner-boss-food');

repFile(SPAWNER,
`        lootMin: w.lootMin != null ? w.lootMin : 5,
        lootMax: w.lootMax != null ? w.lootMax : 16,`,
`        lootMin: w.lootMin != null ? w.lootMin : 5,
        lootMax: w.lootMax != null ? w.lootMax : 16,
        lootFoodC: w.lootFoodChance != null ? w.lootFoodChance : 0,`, 'spawner-wolf-food');

repFile(GAME,
`    cats: randi(u.lootMin, u.lootMax),
    food: (!u.isBeast && Math.random() < 0.3) ? randi(1, 2) : 0,`,
`    cats: randi(u.lootMin, u.lootMax),
    food: (!u.isBeast && Math.random() < (u.lootFoodC != null ? u.lootFoodC : 0.3)) ? randi(1, 2) : 0,`, 'droploot-food');

console.log('T092/T093 codemod 完成，共 ' + edits + ' 处编辑');
