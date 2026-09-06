// =========================================================================
// scoring.js — the ONLY place total score is calculated. Combines distance
// points, survival points, near-miss bonuses (with a combo multiplier),
// overtake bonuses, and level bonuses, then applies the difficulty
// multiplier and any active Double Score power-up.
//
//   totalScore = (distance + survival + nearMiss + overtakes + levelBonus)
//                * difficultyMultiplier
// =========================================================================
(function (NR) {
  "use strict";

  const DISTANCE_POINTS_PER_KM = 400;
  const SURVIVAL_POINTS_PER_SEC = 12;
  const LEVEL_BONUS_PER_LEVEL = 60;
  const OVERTAKE_POINTS = 15;
  const COMBO_WINDOW_SEC = 4;
  const COMBO_MAX = 5;

  class ScoreManager {
    constructor() { this.reset(); }
    reset() {
      this.distancePoints = 0;
      this.survivalPoints = 0;
      this.nearMissPoints = 0;
      this.overtakePoints = 0;
      this.levelBonus = 0;
      this.survivalTime = 0;
      this.overtakeCount = 0;
      this.combo = 1;
      this.comboTimer = 0;
      this.doubleScoreActive = false; // set by game.js from the power-up system each frame
      this.score = 0;
    }

    mul() { return this.doubleScoreActive ? 2 : 1; }

    update(dt) {
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) { this.comboTimer = 0; this.combo = 1; }
      }
    }

    addSurvivalTime(dt) {
      this.survivalTime += dt;
      this.survivalPoints = Math.floor(this.survivalTime * SURVIVAL_POINTS_PER_SEC * this.mul());
    }

    syncDistance(distanceKm) {
      this.distancePoints = Math.floor(distanceKm * DISTANCE_POINTS_PER_KM * this.mul());
    }

    syncLevel(level) {
      this.levelBonus = Math.floor((level - 1) * LEVEL_BONUS_PER_LEVEL * this.mul());
    }

    addOvertakes(count) {
      if (count <= 0) return;
      this.overtakeCount += count;
      this.overtakePoints += Math.floor(count * OVERTAKE_POINTS * this.mul());
    }

    // Called once per legitimate near miss (traffic.js already guarantees a
    // given car can only trigger this once, via its own nearMissDone flag).
    // Builds a combo: each consecutive near miss within COMBO_WINDOW_SEC
    // raises the multiplier (capped at COMBO_MAX); missing the window drops
    // it back to x1. A real collision also resets it (see resetCombo()).
    registerNearMiss({ speedFactor, level, difficulty }) {
      this.combo = Math.min(COMBO_MAX, this.combo + 1);
      this.comboTimer = COMBO_WINDOW_SEC;
      const diffP = NR.DIFF_PARAMS[difficulty];
      const base = 50;
      const speedBonus = Math.round(speedFactor * 30);
      const levelBonus = Math.round(level * 0.8);
      const points = Math.round((base + speedBonus + levelBonus) * (0.85 + diffP.scoreMul * 0.15) * this.combo * this.mul());
      this.nearMissPoints += points;
      return points;
    }

    resetCombo() { this.combo = 1; this.comboTimer = 0; }

    calculateFinalScore(difficulty) {
      const diffP = NR.DIFF_PARAMS[difficulty];
      const subtotal = this.distancePoints + this.survivalPoints + this.nearMissPoints + this.overtakePoints + this.levelBonus;
      this.score = Math.floor(subtotal * diffP.scoreMul);
      return this.score;
    }
  }

  NR.ScoreManager = ScoreManager;
})(window.NR);
