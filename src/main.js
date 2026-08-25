/* ============================================================
 * 荒原浪人 src/main.js — 装配根（T018）
 * 职责：初始化核心服务（RNG/EventBus/Time/Camera/Input/Engine），
 *       然后启动 LegacyGame（迁移期过渡；系统迁完后由 Engine 接管循环）。
 * 加载顺序：core/* → js/game.js(定义 WR.LegacyGame) → 本文件
 * ============================================================ */
(function (root) {
  var WR = root.WR = root.WR || {};

  /* 全局服务容器（联机时服务器/客户端各持一份） */
  WR.App = {
    seed: (Date.now() % 2147483646) + 1,
    rng: null,      // 世界种子随机（战斗/掉落/生成）
    bus: null,      // 事件总线
    time: null,     // 昼夜/天数
    camera: null,   // 相机
    input: null,    // 输入意图队列
    engine: null,   // 主循环
    booted: false
  };

  function boot() {
    if (WR.App.booted) return;
    var App = WR.App;

    App.rng = new WR.RNG(App.seed);
    App.bus = new WR.EventBus();
    App.time = WR.Time.create({ dayLength: 150, startTod: 0.3 });
    App.camera = WR.Camera.create({
      x: 1530, y: 1980, zoom: 1.15,
      world: { w: 4000, h: 4000 },
      viewportW: root.innerWidth || 1280,
      viewportH: root.innerHeight || 800
    });
    App.input = WR.Input.create();
    App.engine = new WR.Engine({
      tickRate: 60,
      onUpdate: null,   // 系统迁移完成后接管
      onRender: null
    });

    /* UI 总线事件 → Legacy 接口（T017 桥接） */
    if (WR.LegacyGame) {
      App.bus.on('ui/shopClose', function () { WR.LegacyGame.closeShop(); });
      App.bus.on('ui/helpClose', function () { WR.LegacyGame.toggleHelp(); });
      /* T040 相机事件化 */
      App.bus.on('cam/toggleFollow', function () {
        if (WR.LegacyGame.toggleCamFollow) WR.LegacyGame.toggleCamFollow();
      });
      App.bus.on('combat/toggleAutoDefend', function () {
        if (WR.LegacyGame.toggleAutoDefend) WR.LegacyGame.toggleAutoDefend();
      });
    }

    /* 启动旧游戏体（迁移完成前，主循环仍由其内部 rAF 驱动） */
    if (WR.LegacyGame && WR.LegacyGame.boot) WR.LegacyGame.boot();

    /* 核心服务就绪广播 */
    App.bus.emit('app/booted', { seed: App.seed });
    App.booted = true;
  }

  boot();

})(typeof self !== 'undefined' ? self : this);
