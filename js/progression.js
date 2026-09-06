// =========================================================================
// progression.js — distance accumulation and Level 1-99 progression.
// Uses a formula (not 99 hard-coded levels). Exposes clean values other
// systems read: currentLevel, distanceKm, trafficLevel (fed to traffic.js).
// =========================================================================
(function (NR) {
  "use strict";

  // Level thresholds grow quadratically: the "cost" of each level is a bit
  // higher than the one before it (constant A = cost of level 2, constant B
  // = how much that cost grows per level). This replaces an earlier sqrt-
  // based curve that let players hit level 7 in about ten seconds — levels
  // now come noticeably slower up front, and keep getting slower.
  //
  // At baseline speed (speedFactor 1) this curve works out to roughly:
  //   level 5  ~= 1.2 min survived     level 25 ~= 10 min survived
  //   level 10 ~= 3 min survived       level 50 ~= 26 min survived
  //   level 99 ~= 75 min survived (a full, long run)
  // Driving faster / covering more distance still reaches each level sooner.
  const LEVEL_COST_BASE = 5;      // progress needed to go from level 1 -> 2
  const LEVEL_COST_GROWTH = 1 / 6; // extra progress each subsequent level costs

  function calcLevel(distanceKm, survivalPoints) {
    const progress = distanceKm * 3.1 + survivalPoints / 55;
    const A = LEVEL_COST_BASE, B = LEVEL_COST_GROWTH;
    if (progress < A) return 1;
    // Invert the quadratic cumulative-cost curve to solve for how many
    // "level-ups" the accumulated progress buys.
    const half = A - B / 2;
    const n = (-half + Math.sqrt(half * half + 2 * B * progress)) / B;
    const level = Math.floor(n) + 1;
    return Math.max(1, Math.min(99, level));
  }

  class Progression {
    constructor() { this.reset(); }
    reset() {
      this.distanceKm = 0;
      this.level = 1;
      this.survivalPoints = 0;
      this.nextMilestoneKm = 1;
    }
    // dt-based update; returns { leveledUp, milestoneHit }
    update(dt, speedFactor, difficulty) {
      // ~1 game-second at speedFactor 1.0 covers roughly 33 metres of "highway".
      const METRES_PER_SEC = 33;
      this.distanceKm += (speedFactor * METRES_PER_SEC * dt) / 1000;
      this.survivalPoints += speedFactor * 10 * dt;

      const prevLevel = this.level;
      this.level = calcLevel(this.distanceKm, this.survivalPoints);
      const leveledUp = this.level !== prevLevel;

      let milestoneHit = false;
      if (this.distanceKm >= this.nextMilestoneKm) {
        milestoneHit = this.nextMilestoneKm;
        this.nextMilestoneKm += 1; // every full km
      }

      return { leveledUp, milestoneHit };
    }
    // Multipliers fed into scoring/traffic difficulty scaling as the level climbs.
    difficultyMultiplier() { return 1 + (this.level - 1) * 0.018; }
  }

  NR.calcLevel = calcLevel;
  NR.Progression = Progression;
})(window.NR);
