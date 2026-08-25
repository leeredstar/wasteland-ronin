/* ============================================================
 * 荒原浪人 js/ronin3d.js — Three.js 3D 渲染层（T050）
 * 职责：把现有 2D 游戏的世界状态（单位 / 结构 / 营地 / 掉落 / 城镇）
 *       用 WebGL 渲染成斜俯视 3D 场景。只做「可视化 + 射线拾取输入」，
 *       完全不碰游戏规则——所有命令都通过 WR.LegacyGame.worldInput() 回流。
 *
 * 接入方式：
 *   - index.html 在 game.js / main.js 之后加载 vendor/three.min.js 与本文件。
 *   - 游戏内按 P（或点 HUD 的 3D 按钮）触发 WR.LegacyGame.toggle3D()，
 *     后者翻转 R3D_active 并调用本文件的 onToggle()。
 *   - 每帧 game.js 的 render() 在 3D 模式下改调本文件的 render()。
 * ============================================================ */
(function (root) {
  var WR = root.WR = root.WR || {};
  var THREE = root.THREE;
  if (!THREE) {
    console.warn('[ronin3d] THREE 未加载，3D 模式不可用（游戏仍可用 2D）。');
    return;
  }

  var R3D = {};
  var canvas3d, renderer, scene, camera, sun, hemi, ground;
  var inited = false, active = false;
  var unitMeshes = new Map();   // id -> THREE.Group
  var ringMeshes = new Map();   // id -> THREE.Mesh (选中环)
  var structMeshes = new Map(); // key `${x},${y}` -> Mesh
  var campMeshes = new Map();   // key -> Group
  var lootMeshes = new Map();   // id/index -> Mesh
  var shadowMeshes = new Map(); // id -> Mesh (脚下接触阴影)
  var hpBarMeshes = new Map();  // id -> Group (头顶血条)
  var bloodMeshes = new Map();  // id -> Mesh (流血血池)
  var fireLights = [];          // 篝火/营火点光源（用于闪烁）
  var matCache = new Map();     // color -> MeshLambertMaterial
  var PART_KEYS = ['head', 'chest', 'armL', 'armR', 'legL', 'legR'];
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  var raycaster = new THREE.Raycaster();
  var groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  var ndc = new THREE.Vector2();
  var hitPoint = new THREE.Vector3();

  // 拖拽状态（3D 输入用）
  var dragClient = null, dragWorld = null;

  // ----- 共享几何体（避免每单位重复创建）-----
  var GEO = {};
  function buildGeo() {
    // 人形部件（低多边形）
    GEO.humanTorso = new THREE.BoxGeometry(7, 16, 4.5);
    GEO.humanHead = new THREE.BoxGeometry(6, 6, 6);
    GEO.humanHair = new THREE.BoxGeometry(6.4, 2.4, 6.4);
    GEO.humanArm = new THREE.CylinderGeometry(1.7, 1.4, 14, 6);
    GEO.humanLeg = new THREE.CylinderGeometry(2.2, 1.8, 16, 6);
    // 武器
    GEO.wStick = new THREE.CylinderGeometry(0.8, 0.8, 26, 5);
    GEO.wBlade = new THREE.BoxGeometry(2.2, 22, 0.6);
    GEO.wSpear = new THREE.CylinderGeometry(0.7, 0.7, 46, 5);
    GEO.wSpearTip = new THREE.ConeGeometry(1.6, 6, 5);
    GEO.wMaceH = new THREE.CylinderGeometry(0.9, 0.9, 22, 5);
    GEO.wMaceBall = new THREE.SphereGeometry(3.2, 8, 6);
    // 野兽
    GEO.beastBody = new THREE.BoxGeometry(9, 9, 22);
    GEO.beastHead = new THREE.BoxGeometry(7, 7, 10);
    GEO.beastSnout = new THREE.BoxGeometry(4, 4, 6);
    GEO.beastLeg = new THREE.CylinderGeometry(1.6, 1.2, 12, 6);
    GEO.beastTail = new THREE.BoxGeometry(2, 2, 12);
    // 头顶血条 / 接触阴影 / 血池
    GEO.hpBack = new THREE.PlaneGeometry(22, 3.2);
    GEO.hpFill = new THREE.PlaneGeometry(22, 3.2);
    GEO.shadowDisc = new THREE.CircleGeometry(12, 18);
    GEO.bloodDisc = new THREE.CircleGeometry(16, 18);
    // 保留旧占位（无害）
    GEO.humanBody = new THREE.CapsuleGeometry(6, 16, 4, 10);
    GEO.humanHeadOld = new THREE.SphereGeometry(5, 12, 10);
    // 环境
    GEO.wall = new THREE.BoxGeometry(16, 34, 16);
    GEO.fireBase = new THREE.CylinderGeometry(7, 9, 10, 8);
    GEO.fireFlame = new THREE.ConeGeometry(5, 16, 8);
    GEO.tent = new THREE.ConeGeometry(46, 54, 6);
    GEO.loot = new THREE.BoxGeometry(11, 8, 11);
    GEO.ring = new THREE.RingGeometry(13, 17, 28);
    GEO.townDisc = new THREE.CircleGeometry(220, 40);
  }

  function mat(color) {
    if (!matCache.has(color)) {
      matCache.set(color, new THREE.MeshLambertMaterial({ color: color }));
    }
    return matCache.get(color);
  }

  function init() {
    if (inited) return;
    canvas3d = document.createElement('canvas');
    canvas3d.id = 'game3d';
    document.body.appendChild(canvas3d);

    renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    renderer.setSize(root.innerWidth, root.innerHeight, false);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcdb892);
    scene.fog = new THREE.Fog(0xcdb892, 1100, 3400);

    camera = new THREE.PerspectiveCamera(50, root.innerWidth / root.innerHeight, 1, 8000);

    hemi = new THREE.HemisphereLight(0xbfd1e6, 0x8a6b3a, 0.9);
    scene.add(hemi);

    sun = new THREE.DirectionalLight(0xffe8b0, 1.0);
    sun.position.set(800, 1200, 400);
    scene.add(sun);

    buildGeo();

    // 地面（沙漠）
    ground = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshLambertMaterial({ color: 0xb89a63 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(2000, 0, 2000);
    scene.add(ground);

    inited = true;
    root.addEventListener('resize', resize);
    attachInput();
  }

  function resize() {
    if (!renderer) return;
    renderer.setSize(root.innerWidth, root.innerHeight, false);
    camera.aspect = root.innerWidth / root.innerHeight;
    camera.updateProjectionMatrix();
  }

  // ---------------- 输入：射线拾取 → 世界坐标 → 回流游戏逻辑 ----------------
  function screenToGround(clientX, clientY) {
    var rect = canvas3d.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    var ok = raycaster.ray.intersectPlane(groundPlane, hitPoint);
    if (!ok) return null;
    return { x: hitPoint.x, y: hitPoint.z };
  }

  function attachInput() {
    canvas3d.addEventListener('mousedown', function (e) {
      if (!active) return;
      var w = screenToGround(e.clientX, e.clientY);
      if (e.button === 2) {
        if (w) WR.LegacyGame.worldInput('right', w.x, w.y);
        return;
      }
      if (e.button === 0) {
        dragClient = { x: e.clientX, y: e.clientY };
        dragWorld = w;
      }
    });

    root.addEventListener('mouseup', function (e) {
      if (!active || e.button !== 0 || !dragClient) return;
      var w = screenToGround(e.clientX, e.clientY);
      var dx = e.clientX - dragClient.x, dy = e.clientY - dragClient.y;
      if (dx * dx + dy * dy > 64 && w && dragWorld) {
        WR.LegacyGame.worldInput('leftdrag', w.x, w.y, { w0: dragWorld });
      } else if (w) {
        WR.LegacyGame.worldInput('left', w.x, w.y, { shift: e.shiftKey });
      }
      dragClient = null; dragWorld = null;
    });

    canvas3d.addEventListener('wheel', function (e) {
      if (!active) return;
      e.preventDefault();
      WR.LegacyGame.zoomBy(e.deltaY < 0 ? 1.12 : 0.89);
    }, { passive: false });

    canvas3d.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  // ---------------- 网格工厂 ----------------
  // ---------------- 网格工厂（参数化低多边形） ----------------
  var RED = new THREE.Color(0x6e1f1a);
  var MET = new THREE.Color(0xa7adb6);
  var GREY = new THREE.Color(0x55504a);
  function newMat(hex) { return new THREE.MeshLambertMaterial({ color: hex }); }

  function makeWeaponMesh(key) {
    var grp = new THREE.Group();
    if (key === 'iron' || key === 'katana') {
      grp.add(new THREE.Mesh(GEO.wBlade, newMat(0xc9d2dd)));
    } else if (key === 'spear') {
      grp.add(new THREE.Mesh(GEO.wSpear, newMat(0x6b4a2a)));
      var tip = new THREE.Mesh(GEO.wSpearTip, newMat(0xc9d2dd)); tip.position.y = 26; grp.add(tip);
    } else if (key === 'mace') {
      grp.add(new THREE.Mesh(GEO.wMaceH, newMat(0x6b4a2a)));
      var ball = new THREE.Mesh(GEO.wMaceBall, newMat(0x8a8f98)); ball.position.y = 11; grp.add(ball);
    } else if (key === 'stick') {
      grp.add(new THREE.Mesh(GEO.wStick, newMat(0x6b4a2a)));
    }
    return grp;
  }

  function makeHpBar() {
    var grp = new THREE.Group();
    var back = new THREE.Mesh(GEO.hpBack, new THREE.MeshBasicMaterial({ color: 0x20160e }));
    var fill = new THREE.Mesh(GEO.hpFill, new THREE.MeshBasicMaterial({ color: 0x46c24a }));
    fill.position.z = 0.1;
    grp.add(back); grp.add(fill);
    grp.userData = { fill: fill };
    return grp;
  }

  function makeHumanoid(u) {
    var g = new THREE.Group();
    var base = u.bodyColor || '#8a6b3a';
    var skin = u.headColor || '#d9b48a';
    var hair = u.hairColor || '#2a201a';
    var ud = { partMat: {}, partMesh: {}, partPivot: {}, baseCol: {}, dmg: { sig: '' } };

    var torsoMat = newMat(base); ud.partMat.chest = torsoMat; ud.baseCol.chest = new THREE.Color(base);
    var torso = new THREE.Mesh(GEO.humanTorso, torsoMat); torso.position.y = 14; g.add(torso); ud.partMesh.chest = torso;

    if (u.armor) {
      var ac = u.armor.key === 'chain' ? 0x9ea6b1 : 0x8c6c46;
      var armor = new THREE.Mesh(GEO.humanTorso, new THREE.MeshLambertMaterial({ color: ac }));
      armor.scale.set(1.22, 1.02, 1.22); armor.position.y = 14; g.add(armor);
    }

    var headMat = newMat(skin); ud.partMat.head = headMat; ud.baseCol.head = new THREE.Color(skin);
    var head = new THREE.Mesh(GEO.humanHead, headMat); head.position.y = 26; g.add(head); ud.partMesh.head = head;
    var hairMesh = new THREE.Mesh(GEO.humanHair, newMat(hair)); hairMesh.position.y = 29.4; g.add(hairMesh);

    var armMat = newMat(base);
    var legMat = newMat(base);
    function limbPart(geo, mat, jx, jy, len, pk) {
      var pivot = new THREE.Group(); pivot.position.set(jx, jy, 0);
      var m = new THREE.Mesh(geo, mat); m.position.y = -len / 2; pivot.add(m);
      g.add(pivot);
      ud.partMat[pk] = mat; ud.baseCol[pk] = mat.color.clone();
      ud.partMesh[pk] = m; ud.partPivot[pk] = pivot;
    }
    limbPart(GEO.humanArm, armMat, -5, 22, 14, 'armL');
    limbPart(GEO.humanArm, armMat, 5, 22, 14, 'armR');
    limbPart(GEO.humanLeg, legMat, -2.5, 6, 16, 'legL');
    limbPart(GEO.humanLeg, legMat, 2.5, 6, 16, 'legR');

    var weapon = makeWeaponMesh(u.weapon && u.weapon.key);
    weapon.position.y = -14; ud.partPivot.armR.add(weapon);

    g.userData = ud;
    if (u.scale && u.scale !== 1) g.scale.setScalar(u.scale);
    return g;
  }

  function makeBeast(u) {
    var g = new THREE.Group();
    var base = u.bodyColor || '#5a5048';
    var ud = { partMat: {}, partMesh: {}, partPivot: {}, baseCol: {}, dmg: { sig: '' } };
    var bodyMat = newMat(base); ud.partMat.chest = bodyMat; ud.baseCol.chest = new THREE.Color(base);
    var body = new THREE.Mesh(GEO.beastBody, bodyMat); body.position.y = 11; g.add(body); ud.partMesh.chest = body;
    var headMat = newMat(base); ud.partMat.head = headMat; ud.baseCol.head = new THREE.Color(base);
    var head = new THREE.Group(); head.position.set(0, 12, 13);
    head.add(new THREE.Mesh(GEO.beastHead, headMat));
    var snout = new THREE.Mesh(GEO.beastSnout, newMat(0x3f392f)); snout.position.set(0, -1, 7); head.add(snout);
    g.add(head); ud.partMesh.head = head.children[0]; ud.partPivot.head = head;
    function leg(jx, jz, pk) {
      var pivot = new THREE.Group(); pivot.position.set(jx, 6, jz);
      var m = new THREE.Mesh(GEO.beastLeg, newMat(base)); m.position.y = -6; pivot.add(m);
      g.add(pivot); ud.partMat[pk] = m.material; ud.baseCol[pk] = m.material.color.clone();
      ud.partMesh[pk] = m; ud.partPivot[pk] = pivot;
    }
    leg(-4, 8, 'legFL'); leg(4, 8, 'legFR'); leg(-4, -8, 'legBL'); leg(4, -8, 'legBR');
    var tail = new THREE.Group(); tail.position.set(0, 12, -12);
    var tm = new THREE.Mesh(GEO.beastTail, newMat(base)); tm.position.z = -6; tail.add(tm); g.add(tail);
    ud.partPivot.tail = tail;
    g.userData = ud;
    if (u.scale && u.scale !== 1) g.scale.setScalar(u.scale);
    return g;
  }

  // ---------------- 部位损伤 / limbState 可视化（镜像 2D drawHumanDir） ----------------
  function applyDamageVisual(u, g) {
    var ud = g.userData; if (!ud || !ud.partMat) return;
    var sig = '';
    for (var i = 0; i < PART_KEYS.length; i++) {
      var p = PART_KEYS[i];
      var b = u.body[p]; if (!b) continue;
      var ls = u.limbState[p];
      sig += (ls || 'n') + (b.hp <= 0 ? '0' : '1');
    }
    if (sig === ud.dmg.sig) return;
    ud.dmg.sig = sig;
    for (var j = 0; j < PART_KEYS.length; j++) {
      var pk = PART_KEYS[j];
      var bp = u.body[pk]; if (!bp) continue;
      var mat = ud.partMat[pk]; if (!mat) continue;
      var lsp = u.limbState[pk];
      var pivot = ud.partPivot[pk];
      if (lsp === 'robo') {
        mat.color.copy(MET); if (pivot) pivot.scale.setScalar(1);
      } else if (lsp === 'cut' || bp.hp <= 0) {
        if (pk === 'chest') { mat.color.copy(ud.baseCol.chest).lerp(RED, 0.7); }
        else if (pk === 'head') { mat.color.copy(GREY); }
        else if (pivot) { pivot.scale.setScalar(0.2); }
      } else {
        var r = bp.hp / bp.max;
        mat.color.copy(ud.baseCol[pk]).lerp(RED, 1 - r);
        if (pivot) pivot.scale.setScalar(1);
      }
    }
  }

  // ---------------- 程序化动画（行走/攻击/受击，仅转枢轴组） ----------------
  function animateUnit(u, g, now) {
    var ud = g.userData; if (!ud || !ud.partPivot) return;
    var moving = u.moving ? 1 : 0;
    var sw = moving ? Math.sin(u.walkT * 10) : 0;
    if (ud.partPivot.legR) {
      ud.partPivot.legR.rotation.x = sw * 0.5;
      ud.partPivot.legL.rotation.x = -sw * 0.5;
      ud.partPivot.armL.rotation.x = -sw * 0.4;
      if (u.swingT > 0) { var sp = 1 - u.swingT / 0.22; ud.partPivot.armR.rotation.x = -1.35 + sp * 2.35; }
      else { ud.partPivot.armR.rotation.x = sw * 0.4; }
    }
    if (ud.partPivot.legFL) {
      var a = moving ? Math.sin(u.walkT * 12) : 0;
      ud.partPivot.legFL.rotation.x = a * 0.5;
      ud.partPivot.legBR.rotation.x = a * 0.5;
      ud.partPivot.legFR.rotation.x = -a * 0.5;
      ud.partPivot.legBL.rotation.x = -a * 0.5;
    }
    if (ud.partPivot.tail) ud.partPivot.tail.rotation.x = Math.sin(now * 0.004) * 0.3;
    if (ud.partPivot.head && u.swingT > 0) ud.partPivot.head.rotation.x = -0.4 * (1 - u.swingT / 0.22);
    var flash = u.flashT > 0.08;
    var bleeding = (u.state === 'down' && u.body.chest.hp <= 0);
    for (var k in ud.partMat) {
      var m = ud.partMat[k];
      if (flash) m.emissive.setHex(0x884422);
      else if (k === 'chest' && bleeding) m.emissive.setHex(0x551008);
      else m.emissive.setHex(0x000000);
    }
  }
  function makeRing() {
    var m = new THREE.Mesh(GEO.ring, new THREE.MeshBasicMaterial({ color: 0x9fe07a, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 1.5;
    return m;
  }

  // ---------------- 每帧同步 ----------------
  function syncCamera(cam) {
    var dist = 820 / (cam.z || 1.15);
    camera.position.set(cam.x, dist * 0.82, cam.y + dist * 0.57);
    camera.lookAt(cam.x, 0, cam.y);
  }

  function syncDayNight() {
    var tod = 0.3, bright = 0.85;
    if (WR.App && WR.App.time && typeof WR.App.time.tod === 'number') {
      tod = WR.App.time.tod;
      bright = 0.5 - 0.5 * Math.cos((tod % 1) * Math.PI * 2);
    }
    sun.intensity = 0.18 + 1.05 * bright;
    hemi.intensity = 0.35 + 0.6 * bright;
    var dayCol = new THREE.Color(0xcdb892);
    var nightCol = new THREE.Color(0x0e1626);
    var sky = nightCol.clone().lerp(dayCol, bright);
    scene.background.copy(sky);
    scene.fog.color.copy(sky);
    var a = tod * Math.PI * 2;
    if (WR.App && WR.App.camera) {
      sun.position.set(WR.App.camera.x + Math.cos(a) * 1000, 900, WR.App.camera.y + Math.sin(a) * 1000);
    }
  }

  function syncUnits(units, selection) {
    var seen = new Set();
    var now = performance.now();
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      seen.add(u.id);
      var g = unitMeshes.get(u.id);
      if (!g) {
        g = u.isBeast ? makeBeast(u) : makeHumanoid(u);
        unitMeshes.set(u.id, g);
        scene.add(g);
        var sh = new THREE.Mesh(GEO.shadowDisc, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
        sh.rotation.x = -Math.PI / 2; sh.position.y = 0.6;
        shadowMeshes.set(u.id, sh); scene.add(sh);
        var hp0 = makeHpBar(); hpBarMeshes.set(u.id, hp0); scene.add(hp0);
      }
      var down = (u.state === 'down' || u.state === 'dead');
      g.position.x = u.x; g.position.z = u.y;
      if (u.face != null) g.rotation.y = -u.face + Math.PI / 2;
      if (down) { g.rotation.x = Math.PI / 2; g.position.y = u.isBeast ? 2 : 4; }
      else { g.rotation.x = 0; g.position.y = 0; applyDamageVisual(u, g); animateUnit(u, g, now); }

      // 头顶血条（独立顶层，避免随 facing 旋转；billboard 朝向相机）
      var hpBar = hpBarMeshes.get(u.id);
      if (hpBar) {
        hpBar.position.set(u.x, u.isBeast ? 30 : 37, u.y);
        hpBar.quaternion.copy(camera.quaternion);
        var cr = clamp01(u.body.chest.hp / u.body.chest.max);
        hpBar.userData.fill.scale.x = Math.max(0.02, cr);
        hpBar.userData.fill.position.x = -(22 * (1 - cr)) / 2;
        hpBar.userData.fill.material.color.setHSL(0.33 * cr, 0.75, 0.5);
        hpBar.visible = !down;
      }
      // 流血血池（胸血空且倒地）
      var bleeding = (u.state === 'down' && u.body.chest.hp <= 0);
      var bl = bloodMeshes.get(u.id);
      if (!bl && bleeding) { bl = new THREE.Mesh(GEO.bloodDisc, new THREE.MeshBasicMaterial({ color: 0x7a1410, transparent: true, opacity: 0.7, depthWrite: false })); bl.rotation.x = -Math.PI / 2; bl.position.y = 1.0; bloodMeshes.set(u.id, bl); scene.add(bl); }
      if (bl) { bl.visible = bleeding; bl.position.x = u.x; bl.position.z = u.y; }
      // 接触阴影跟随（不随放倒旋转）
      var sh2 = shadowMeshes.get(u.id);
      if (sh2) { sh2.position.x = u.x; sh2.position.z = u.y; sh2.visible = !down; }
      // 选中环
      var sel = selection.indexOf(u) >= 0;
      var ring = ringMeshes.get(u.id);
      if (sel && !ring) { ring = makeRing(); ringMeshes.set(u.id, ring); scene.add(ring); }
      if (ring) { ring.visible = sel; ring.position.x = u.x; ring.position.z = u.y; }
    }
    // 清理已消失的单位及其附属网格
    unitMeshes.forEach(function (g, id) { if (!seen.has(id)) { scene.remove(g); unitMeshes.delete(id); } });
    ringMeshes.forEach(function (r, id) { if (!seen.has(id)) { scene.remove(r); ringMeshes.delete(id); } });
    shadowMeshes.forEach(function (s, id) { if (!seen.has(id)) { scene.remove(s); shadowMeshes.delete(id); } });
    hpBarMeshes.forEach(function (h, id) { if (!seen.has(id)) { scene.remove(h); hpBarMeshes.delete(id); } });
    bloodMeshes.forEach(function (b, id) { if (!seen.has(id)) { scene.remove(b); bloodMeshes.delete(id); } });
  }

  function syncStructures(structures) {
    for (var i = 0; i < structures.length; i++) {
      var s = structures[i];
      var key = s.x + ',' + s.y;
      if (structMeshes.has(key)) continue;
      var m;
      if (s.kind === 2) {
        // 篝火
        var grp = new THREE.Group();
        var base = new THREE.Mesh(GEO.fireBase, mat(0x4a4038));
        base.position.y = 5;
        var flame = new THREE.Mesh(GEO.fireFlame, new THREE.MeshBasicMaterial({ color: 0xff7a2c }));
        flame.position.y = 14;
        grp.add(base); grp.add(flame);
        var fl = new THREE.PointLight(0xff8a3c, 1.2, 320);
        fl.position.set(0, 18, 0);
        grp.add(fl);
        fireLights.push(fl);
        m = grp;
      } else {
        m = new THREE.Mesh(GEO.wall, mat(0x9a8c74));
        m.position.y = 17;
      }
      m.position.x = s.x;
      m.position.z = s.y;
      structMeshes.set(key, m);
      scene.add(m);
    }
  }

  function syncCamps(camps) {
    for (var i = 0; i < camps.length; i++) {
      var c = camps[i];
      var key = c.x + ',' + c.y;
      if (campMeshes.has(key)) continue;
      var grp = new THREE.Group();
      var tent = new THREE.Mesh(GEO.tent, mat(0xb98a4a));
      tent.position.y = 27;
      var fire = new THREE.Mesh(GEO.fireBase, mat(0x4a4038));
      fire.position.set(34, 5, -6);
      var fl = new THREE.PointLight(0xff8a3c, 1.0, 300);
      fl.position.set(34, 16, -6);
      grp.add(tent); grp.add(fire); grp.add(fl);
      fireLights.push(fl);
      grp.position.set(c.x, 0, c.y);
      campMeshes.set(key, grp);
      scene.add(grp);
    }
  }

  function syncLoot(loot) {
    // loot 是对象数组，用索引做 key（掉落物不会很多）
    for (var i = 0; i < loot.length; i++) {
      var l = loot[i];
      if (lootMeshes.has(i)) continue;
      var m = new THREE.Mesh(GEO.loot, mat(0x7a5a32));
      m.position.set(l.x, 4, l.y);
      lootMeshes.set(i, m);
      scene.add(m);
    }
    // loot 数量只会减少；多出来的旧网格移除
    lootMeshes.forEach(function (m, idx) {
      if (idx >= loot.length) { scene.remove(m); lootMeshes.delete(idx); }
    });
  }

  function syncTowns(towns) {
    for (var i = 0; i < towns.length; i++) {
      var t = towns[i];
      if (campMeshes.has('town' + t.x + ',' + t.y)) continue;
      var disc = new THREE.Mesh(GEO.townDisc, new THREE.MeshLambertMaterial({ color: 0xc8b483 }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(t.x, 0.5, t.y);
      scene.add(disc);
      campMeshes.set('town' + t.x + ',' + t.y, disc);
    }
  }

  function flickerFires() {
    var t = performance.now() * 0.006;
    for (var i = 0; i < fireLights.length; i++) {
      fireLights[i].intensity = 0.9 + Math.sin(t + i) * 0.3 + Math.random() * 0.15;
    }
  }

  // ---------------- 对外接口 ----------------
  R3D.onToggle = function (isActive) {
    active = isActive;
    if (isActive) {
      if (!inited) init();
      document.body.classList.add('r3d');
      resize();
    } else {
      document.body.classList.remove('r3d');
      // 切回 2D 时清理 3D 网格，下次进入重新建
      clearAll();
    }
  };

  function clearAll() {
    unitMeshes.forEach(function (g) { scene.remove(g); }); unitMeshes.clear();
    ringMeshes.forEach(function (r) { scene.remove(r); }); ringMeshes.clear();
    shadowMeshes.forEach(function (s) { scene.remove(s); }); shadowMeshes.clear();
    hpBarMeshes.forEach(function (h) { scene.remove(h); }); hpBarMeshes.clear();
    bloodMeshes.forEach(function (b) { scene.remove(b); }); bloodMeshes.clear();
    structMeshes.forEach(function (m) { scene.remove(m); }); structMeshes.clear();
    campMeshes.forEach(function (m) { scene.remove(m); }); campMeshes.clear();
    lootMeshes.forEach(function (m) { scene.remove(m); }); lootMeshes.clear();
    fireLights = [];
  }

  R3D.render = function () {
    if (!active || !inited || !WR.LegacyGame) return;
    var dbg = root.__ronin;
    if (!dbg) return;
    var cam = dbg.getCam();
    syncCamera(cam);
    syncDayNight();
    syncUnits(dbg.unitsList(), dbg.selectionList());
    syncStructures(dbg.world().structures);
    syncCamps(dbg.world().camps);
    syncLoot(dbg.lootList());
    syncTowns(dbg.townsList());
    flickerFires();
    renderer.render(scene, camera);
  };

  R3D.resize = resize;
  WR.R3D = R3D;
})(typeof self !== 'undefined' ? self : this);
