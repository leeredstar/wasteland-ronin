/* M2 codemod：苏醒阈值参数化 / 睡眠常量化 / 互斥守卫 / 游戏侧别名 */
const fs = require('fs');
let edits = 0;
function rep(file, from, to, label) {
  let s = fs.readFileSync(file, 'utf8');
  const parts = s.split(from);
  if (parts.length !== 2) { console.error('替换失败(' + label + ')：次数=' + (parts.length - 1)); process.exit(1); }
  fs.writeFileSync(file, parts[0] + to + parts[1]);
  edits++;
}

const SURV = 'D:/wasteland-ronin/src/systems/Survival.js';
const GAME = 'D:/wasteland-ronin/js/game.js';
const MAIN = 'D:/wasteland-ronin/src/main.js';

/* 1) tickDowned 苏醒判定走配置 */
rep(SURV,
'    var woke = !died && BodyMod.canWake(u.body);',
'    var woke = !died &&\n      ch.hp >= ch.max * SURV.WAKE_CHEST &&\n      hd.hp >= hd.max * SURV.WAKE_HEAD;', 'wake-thresholds');

/* 2) 包扎与救助互斥：救助通道占用时包扎视为忙 */
rep(SURV,
'  function tickBandage(u, dt) {\n    if (u.bandageChannel <= 0) return false;',
'  function tickBandage(u, dt) {\n    if (u.rescueChannel > 0) return true; /* 救助中不可同时包扎 */\n    if (u.bandageChannel <= 0) return false;', 'bandage-mutex');

/* 3) 进食上限走配置 */
rep(SURV, "      if (u.hunger >= 98) { logFn(u.name + ' 现在很饱', 'sys'); return; }",
            "      if (u.hunger >= SURV.EAT_MAX) { logFn(u.name + ' 现在很饱', 'sys'); return; }", 'eat-max');

/* 4) 睡眠恢复走配置 */
rep(SURV,
'        pp.hp = Math.min(pp.max, Math.max(pp.hp, pp.hp + pp.max * 0.45));',
'        pp.hp = Math.min(pp.max, Math.max(pp.hp, pp.hp + pp.max * SURV.SLEEP_HEAL_RATIO));', 'sleep-heal');
rep(SURV, '      u.hunger = Math.max(5, u.hunger - 18);',
            '      u.hunger = Math.max(5, u.hunger - SURV.SLEEP_HUNGER_COST);', 'sleep-hunger');

/* 5) 游戏侧别名 + wakeUp/trySleep 走配置 */
rep(GAME,
"var HUD_MS = (WR.BALANCE && WR.BALANCE.HUD_INTERVAL_MS) || 180;",
"var HUD_MS = (WR.BALANCE && WR.BALANCE.HUD_INTERVAL_MS) || 180;\nvar SURVB = WR.BALANCE && WR.BALANCE.SURVIVAL ? WR.BALANCE.SURVIVAL : { WAKE_GRACE: 1.5, CAMP_SLEEP_RADIUS: 180 };", 'survb');

rep(GAME, '    u.wakeGrace = 1.5;', '    u.wakeGrace = SURVB.WAKE_GRACE || 1.5;', 'wakegrace');

rep(GAME, 'function trySleep() {\n  var camp = nearestCampToSelection(180);',
            'function trySleep() {\n  var camp = nearestCampToSelection(SURVB.CAMP_SLEEP_RADIUS || 180);', 'sleep-range');

/* 6) main.js 桥接反击事件 */
rep(MAIN,
"      App.bus.on('cam/toggleFollow', function () {\n        if (WR.LegacyGame.toggleCamFollow) WR.LegacyGame.toggleCamFollow();\n      });",
"      App.bus.on('cam/toggleFollow', function () {\n        if (WR.LegacyGame.toggleCamFollow) WR.LegacyGame.toggleCamFollow();\n      });\n      App.bus.on('combat/toggleAutoDefend', function () {\n        if (WR.LegacyGame.toggleAutoDefend) WR.LegacyGame.toggleAutoDefend();\n      });", 'bus-autodefend');

console.log('M2 codemod 完成，共 ' + edits + ' 处编辑');
