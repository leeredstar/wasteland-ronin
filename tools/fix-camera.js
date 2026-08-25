/* 添加缺失的相机函数 */
const fs = require('fs');
const p = 'D:/wasteland-ronin/js/game.js';
let s = fs.readFileSync(p, 'utf8');
if (s.includes('function clampCam')) { console.log('already has clampCam'); process.exit(0); }
const anchor = 'function init(){';
const insert = [
'function clampCam(){var hw=W/(2*zoom),hh=H/(2*zoom);if(hw*2<WORLD.w)cam.x=clamp(cam.x,hw,WORLD.w-hw);if(hh*2<WORLD.h)cam.y=clamp(cam.y,hh,WORLD.h-hh);}',
'function updateCamera(dt){var spd=540*dt/zoom,dx=0,dy=0;',
' if(keys.KeyW||keys.ArrowUp)dy-=spd;if(keys.KeyS||keys.ArrowDown)dy+=spd;',
' if(keys.KeyA||keys.ArrowLeft)dx-=spd;if(keys.KeyD||keys.ArrowRight)dx+=spd;',
' if(dx||dy){cam.x+=dx;cam.y+=dy;camFollow=false;}',
' else if(camFollow){var sq=livingSquad();if(sq.length){',
'  var cx=0,cy=0;for(var i=0;i<sq.length;i++){cx+=sq[i].x;cy+=sq[i].y;}',
'  cam.x=lerp(cam.x,cx/sq.length,Math.min(1,dt*3));cam.y=lerp(cam.y,cy/sq.length,Math.min(1,dt*3));}}',
' clampCam();}',
''
].join('\n');
s = s.replace(anchor, insert + '\n' + anchor);
fs.writeFileSync(p, s, 'utf8');
console.log('added clampCam + updateCamera');
