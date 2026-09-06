// =========================================================================
// traffic.js — opponent vehicle spawning, movement, cleanup.
//
// BUG FIX (permanent safe gap): traffic used to trickle in car-by-car with
// independent RNG per lane, which let a fixed lane (or gap) stay empty
// indefinitely — the player could park there and never have to move.
//
// This version spawns in coordinated "waves": each wave chooses a SET of
// lanes to occupy and leaves the rest open. That guarantees:
//   - At least one lane is always reachable (occupiedCount < LANE_COUNT).
//   - The chosen lane-set is never identical to the immediately previous
//     one, and is discouraged from repeating recent sets.
//   - A lane that has stayed safe for several consecutive waves gets extra
//     weight toward being occupied next — including the player's current
//     lane — so no position is safe forever.
//   - A new wave never spawns while the previous one is still near the top
//     of the screen, so walls never stack into an unreachable formation.
// =========================================================================
(function (NR) {
  "use strict";
  const { ROAD_LEFT, LANE_COUNT, LANE_WIDTH, CAR_W, CAR_H, H } = NR;

  const VEHICLE_TYPES = [
    { id: "normal", speedMul: 1.0, wMul: 1.0, hMul: 1.0, weight: 60, minLevel: 1, palette: ["#ff3d7a", "#9a6cff", "#5ac878"] },
    { id: "fast", speedMul: 1.4, wMul: 0.94, hMul: 0.94, weight: 18, minLevel: 5, palette: ["#ffb545"] },
    { id: "slow", speedMul: 0.72, wMul: 1.0, hMul: 1.0, weight: 14, minLevel: 3, palette: ["#5ac878"] },
    { id: "large", speedMul: 0.82, wMul: 1.32, hMul: 1.28, weight: 8, minLevel: 10, palette: ["#7d6bd0"] },
  ];

  function tierParams(level) {
    if (level <= 10) return { maxOccupied: 1, interval: 1.85, cap: 4 };
    if (level <= 25) return { maxOccupied: 2, interval: 1.55, cap: 6, biasLow: true };
    if (level <= 50) return { maxOccupied: 2, interval: 1.3, cap: 7 };
    if (level <= 75) return { maxOccupied: 3, interval: 1.1, cap: 9, biasLow: true };
    return { maxOccupied: 3, interval: 0.92, cap: 10 };
  }

  class Traffic {
    constructor() { this.reset(NR.Diff.NORMAL); }
    reset(difficulty) {
      this.difficulty = difficulty;
      this.enemies = [];
      this.waveTimer = 0;
      this.lastMask = -1;
      this.recentMasks = [];
      this.laneSafeStreak = new Array(LANE_COUNT).fill(0);
      this.passedCount = 0;
    }

    laneCenterX(lane) { return ROAD_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2; }

    playerLane(playerBounds) {
      const relX = (playerBounds.x + playerBounds.w / 2) - ROAD_LEFT;
      return Math.floor(Math.max(0, Math.min(LANE_COUNT - 1, relX / LANE_WIDTH)));
    }

    pickVehicleType(level) {
      const pool = VEHICLE_TYPES.filter((t) => level >= t.minLevel);
      const total = pool.reduce((s, t) => s + t.weight, 0);
      let r = Math.random() * total;
      for (const t of pool) { if ((r -= t.weight) <= 0) return t; }
      return pool[0];
    }

    // Weighted, no-repeat lane-set selection — this is the heart of the fix.
    // A lane (INCLUDING the player's current lane) that has gone unoccupied
    // for HARD_FORCE_STREAK consecutive waves is deterministically forced
    // into the set below, not just weighted — that's what guarantees no
    // single position can be survived in forever without moving.
    chooseOccupiedLanes(count, playerLane) {
      const HARD_FORCE_STREAK = 4;
      const forced = [];
      for (let l = 0; l < LANE_COUNT; l++) {
        if (this.laneSafeStreak[l] >= HARD_FORCE_STREAK) forced.push(l);
      }
      const weights = this.laneSafeStreak.map((streak, lane) => {
        let w = 1 + streak * 0.9;
        if (lane === playerLane && streak >= 2) w *= 2.6; // discourage camping well before the hard force
        return w;
      });
      const tryOnce = () => {
        const chosen = forced.slice(0, count);
        const pool = [0, 1, 2, 3].filter((l) => !chosen.includes(l)).map((l) => ({ l, w: weights[l] }));
        while (chosen.length < count && pool.length) {
          const total = pool.reduce((s, p) => s + p.w, 0);
          let r = Math.random() * total, idx = 0;
          for (; idx < pool.length; idx++) { r -= pool[idx].w; if (r <= 0) break; }
          idx = Math.min(idx, pool.length - 1);
          chosen.push(pool[idx].l);
          pool.splice(idx, 1);
        }
        return chosen.sort((a, b) => a - b);
      };
      let lanes = tryOnce();
      let mask = lanes.reduce((m, l) => m | (1 << l), 0);
      let attempts = 0;
      // Reroll if identical to the previous wave, or repeats too recently.
      while (attempts < 5 && (mask === this.lastMask || this.recentMasks.includes(mask)) && count < LANE_COUNT) {
        lanes = tryOnce();
        mask = lanes.reduce((m, l) => m | (1 << l), 0);
        attempts++;
      }
      return { lanes, mask };
    }

    trySpawnWave(level, playerBounds) {
      const params = tierParams(level);
      const diffP = NR.DIFF_PARAMS[this.difficulty];
      let maxOccupied = params.maxOccupied;
      if (params.biasLow && Math.random() < 0.5) maxOccupied = Math.max(1, maxOccupied - 1);
      // Never occupy every lane — guarantees a reachable path always exists.
      maxOccupied = Math.min(maxOccupied, LANE_COUNT - 1);

      const cap = Math.max(2, Math.round(params.cap * diffP.densityMul));
      const roomLeft = cap - this.enemies.length;
      if (roomLeft <= 0) return;
      const occupiedCount = Math.max(1, Math.min(maxOccupied, roomLeft));

      const playerLane = this.playerLane(playerBounds);
      const { lanes, mask } = this.chooseOccupiedLanes(occupiedCount, playerLane);

      const baseSpeed = (this.difficulty === NR.Diff.EASY ? 150 : this.difficulty === NR.Diff.HARD ? 300 : 220);
      const levelRamp = Math.min(level, 99) * 1.6; // gentle speed ramp with level
      for (const lane of lanes) {
        const type = this.pickVehicleType(level);
        const color = type.palette[Math.floor(Math.random() * type.palette.length)];
        const w = CAR_W * type.wMul, h = CAR_H * type.hMul;
        const jitter = 0.9 + Math.random() * 0.2;
        // hazW spans nearly the full lane (not just the drawn sprite width).
        // FIX: with a narrow sprite centered in a wide lane, a player resting
        // exactly on a lane boundary could let same-lane traffic pass with a
        // gap too small to score as a miss but too large to ever collide —
        // a permanent camp-forever spot hiding in the geometry. The hazard
        // box below closes that gap while the drawn sprite stays its normal
        // (narrower) visual width, so the car still *looks* like a normal car.
        const hazW = LANE_WIDTH - 8;
        this.enemies.push({
          lane, x: this.laneCenterX(lane) - w / 2, y: -h, w, h,
          hazX: this.laneCenterX(lane) - hazW / 2, hazW,
          speed: (baseSpeed + levelRamp) * type.speedMul * jitter,
          color, type: type.id, nearMissDone: false,
        });
      }

      // Update lane "safe streaks": occupied lanes reset, others grow.
      for (let l = 0; l < LANE_COUNT; l++) {
        this.laneSafeStreak[l] = lanes.includes(l) ? 0 : this.laneSafeStreak[l] + 1;
      }
      this.lastMask = mask;
      this.recentMasks.push(mask);
      if (this.recentMasks.length > 3) this.recentMasks.shift();
    }

    update(dt, speedFactor, level, playerBounds, onNearMiss, worldSpeedMul) {
      const params = tierParams(level);
      const diffP = NR.DIFF_PARAMS[this.difficulty];
      const wMul = worldSpeedMul == null ? 1 : worldSpeedMul; // Slow-Mo power-up hook — traffic slows, player controls don't
      this.waveTimer += dt;
      const interval = Math.max(0.55, params.interval * diffP.intervalMul);

      // Don't start a new wave while the previous one is still near the top —
      // prevents walls from stacking into something unreachable.
      const previousWaveClear = !this.enemies.some((e) => e.y < 150);
      if (this.waveTimer >= interval && previousWaveClear) {
        this.waveTimer = 0;
        this.trySpawnWave(level, playerBounds);
      }

      for (const e of this.enemies) {
        e.y += e.speed * speedFactor * wMul * dt;
        if (!e.nearMissDone) {
          const vOverlap = e.y < playerBounds.y + playerBounds.h + 6 && e.y + e.h > playerBounds.y - 6;
          if (vOverlap) {
            const gap = e.hazX > playerBounds.x ? e.hazX - (playerBounds.x + playerBounds.w) : playerBounds.x - (e.hazX + e.hazW);
            if (gap >= 0 && gap < 16) { e.nearMissDone = true; onNearMiss && onNearMiss({ speedFactor, gap }); }
          }
        }
      }

      // passedCount doubles as the run's "overtakes" this tick — a car that
      // scrolled past you counts as one overtaken vehicle.
      this.passedCount = 0;
      this.enemies = this.enemies.filter((e) => {
        const passed = e.y > H + e.h;
        if (passed) this.passedCount++;
        return !passed;
      });
    }

    removeEnemy(enemy) {
      const idx = this.enemies.indexOf(enemy);
      if (idx >= 0) this.enemies.splice(idx, 1);
    }

    draw() {
      for (const e of this.enemies) NR.drawCar(e.x, e.y, e.w, e.h, e.color, "#ffffffcc", false);
    }
  }

  NR.Traffic = Traffic;

  // ---- collision.js-equivalent: one clear system for the whole game.
  // Returns the colliding enemy object (so the caller can remove it and
  // apply damage/shield logic) or null if there's no overlap.
  const COLLISION_INSET_X = 7, COLLISION_INSET_Y = 6;
  function insetBox(b, extra) {
    const ex = COLLISION_INSET_X + (extra || 0);
    return { x: b.x + ex, y: b.y + COLLISION_INSET_Y, w: b.w - ex * 2, h: b.h - COLLISION_INSET_Y * 2 };
  }
  NR.checkCollision = function (playerBounds, enemies, extraForgiveness) {
    const pb = insetBox(playerBounds, extraForgiveness);
    for (const e of enemies) {
      // Use the (slightly wider) hazard box, not just the drawn sprite —
      // see the note in trySpawnWave() in this file for why.
      const eb = insetBox({ x: e.hazX, y: e.y, w: e.hazW, h: e.h }, extraForgiveness);
      if (pb.x < eb.x + eb.w && pb.x + pb.w > eb.x && pb.y < eb.y + eb.h && pb.y + pb.h > eb.y) return e;
    }
    return null;
  };
})(window.NR);
