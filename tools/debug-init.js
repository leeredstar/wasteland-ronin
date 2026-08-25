/* 调试：捕获 init 错误 */
const fs = require('fs');
const p = 'D:/wasteland-ronin/js/game.js';
let s = fs.readFileSync(p, 'utf8');
s = s.replace('init();\n', 'try{init();}catch(e){console.error("INIT ERROR:",e.message,e.stack);}\n');
fs.writeFileSync(p, s, 'utf8');
console.log('added try-catch to init');
