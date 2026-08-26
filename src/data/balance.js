/* ============================================================
 * 荒原浪人 data/balance — 全局数值平衡表（唯一事实源）
 * 设计要点：调参只改这里。系统模块提供 fallback，
 * 但运行时以本表为准（身份同源性可测试验证）。
 * 双模式：浏览器挂 WR.BALANCE；Node 可 require。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.WR = root.WR || {}; root.WR.BALANCE = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    /* ---- AI（M6/T153-T156 迁入） ---- */
    AI: {
      CHASE_GIVE_UP: 620,     /* 距攻击目标超过此值 → 放弃追击返回 */
      GUARD_LEASH: 340,       /* 卫兵离岗 leash 距离 */
      NIGHT_VISION_MIN: 0.6,  /* 深夜视野系数（×白天全值） */
      WANDER_TOWN_R: 140,     /* 卫兵巡城半径 */
      WANDER_WILD_R: 260,     /* 野怪游荡半径 */
      THINK_MIN: 0.3,         /* T172 决策节流下限(秒)——天然分帧错峰 */
      THINK_MAX: 0.5,         /* T172 决策节流上限(秒) */
      SUPPORT_RADIUS: 300,    /* T157 协防半径 */
      SUPPORT_TICK: 0.5,      /* T176 协防扫描节流(秒)=响应时间上限 */
      GUARD_CALL_RADIUS: 620, /* T166 城镇支援呼叫半径 */
      REP_ASSIST_RADIUS: 420, /* T168 声望驰援半径 */
      REP_ASSIST_MIN: 20,     /* T168 触发驰援的最低声望 */
      DEBUG: false            /* T154: 状态迁移追踪开关 */
    },

    /* ---- 战斗（M1/T035-T036 迁入） ---- */
    COMBAT: {
      SWING_TIME: 0.22,
      DODGE_BASE: 0.04,
      DODGE_PER_DIFF: 0.012,
      DODGE_MIN: 0.03,
      DODGE_MAX: 0.42,
      DMG_STR_COEF: 0.028,
      DMG_RAND_MIN: 0.85,
      DMG_RAND_MAX: 1.15,
      ARM_MULT_BASE: 0.6,
      ARM_MULT_PER: 0.2,
      SEVER_AT_RATIO: -0.5,
      ROBO_FLOOR_RATIO: 0.35,
      XP: {
        HIT_ATTACKER_MELEE: 4,
        HIT_ATTACKER_STR: 2,
        HIT_VICTIM_TGH: 3,
        DODGE_VICTIM: 3,
        DODGE_ATTACKER: 1
      },
      KNOCKDOWN_DUST: 6,
      SHAKE_ON_PLAYER_HIT: 1.0,
      SHAKE_MAX: 5,
      COMBAT_T_ON_HIT: 4,

      /* ---- 部位命中加权表（和恒为 1）---- */
      PART_WEIGHTS: [
        ['chest', 0.38], ['head', 0.15],
        ['armR', 0.15], ['armL', 0.15],
        ['legL', 0.085], ['legR', 0.085]
      ]
    },

    /* ---- 倒地流血死亡阈值 ---- */
    BLEED_DEATH_RATIO: 0.6,

    /* ---- 小队编队偏移（T039，按选择顺序取位）---- */
    FORMATION: [
      [0, 0], [38, 8], [-38, 8],
      [0, -40], [40, -46], [-40, -46]
    ],

    /* ---- 生存系统（M1/T038 从 Survival.SURV 迁入）---- */
    SURVIVAL: {
      HUNGER_DECAY_PER_SEC: 100 / 420,
      HUNGER_WARN_AT: 25,
      STARVE_CHEST_DPS: 2,
      EAT_RESTORE: 45,
      EAT_MAX: 98,
      DOWN_HEAD_REGEN_POS: 0.9,
      DOWN_HEAD_REGEN_NEG: 0.3,
      DOWN_CHEST_REGEN_POS: 0.6,
      BLEED_RATE: 0.55,
      CLOT_RATE: 0.32,
      CLOT_ABOVE_RATIO: 0.3,
      DEATH_AT_RATIO: 0.6,
      WAKE_CHEST: 0.3,
      WAKE_HEAD: 0.5,
      RESCUE_TIME: 2.5,
      RESCUE_START_RANGE: 46,
      RESCUE_KEEP_RANGE: 55,
      RESCUE_CHEST_TO: 0.33,
      RESCUE_HEAD_TO: 0.6,
      BANDAGE_TIME: 2.2,
      BANDAGE_HEAL_TO: 0.7,
      NATURAL_REGEN: 0.55,
      CAMP_REGEN_MULT: 3,
      CAMP_REGEN_RADIUS: 150,

      /* ---- M2 新增 ---- */
      WAKE_GRACE: 1.5,            // 苏醒后不可被选中时长(秒)
      SLEEP_HEAL_RATIO: 0.45,     // 睡眠各部位至少回复 max 的比例
      SLEEP_HUNGER_COST: 18,      // 睡眠消耗饱食
      CAMP_SLEEP_RADIUS: 180      // 距营火多远可入睡
    },

    /* ---- 断肢对能力的影响系数（M2/T073）----
     * usable 数 n ∈{0,1,2}: 攻速=BASE+PER*n, 伤害同理, 移速同构 */
    LIMBS: {
      ARM_CD_BASE: 0.55,
      ARM_CD_PER: 0.225,
      ARM_DMG_BASE: 0.6,
      ARM_DMG_PER: 0.2,
      LEG_SPD_BASE: 0.5,
      LEG_SPD_PER: 0.25
    },

    /* ---- 昼夜表现（M1/T044）---- */
    TIME: {
      NIGHT_MAX_ALPHA: 0.5,
      DUSK_PEAK: 0.13,
      DUSK_LO: 0.3,
      DUSK_HI: 0.72,
      PHASE_DAY_GT: 0.68,
      PHASE_DUSK_GT: 0.32
    },

    /* ---- 特效与生命周期（M1/T045-T047）---- */
    FX: {
      PARTICLE_SOFT_CAP: 280,
      PARTICLE_HARD_CAP: 300,
      DECAL_CAP: 350,
      BLOOD_N: 7,
      SPARK_N: 4,
      COIN_N: 6,
      DUST_STEP_GAP: 30
    },
    WORLD_LIFE: {
      DEAD_TTL: 45,
      LOOT_TTL: 90,
      LOOT_FADE_AT: 10
    },

    /* ---- HUD 节拍（M1/T048）---- */
    HUD_INTERVAL_MS: 180,

    /* ---- 预留区（后续里程碑填充）----
     * SPAWNER: {}    // M5 距离梯度参数化
     * ECONOMY: {}    // M4 供需浮动参数
     */
  };
});
