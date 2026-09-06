// =========================================================================
// player.js — V5: discrete lane-based movement (the Night Runner V5
// redesign). The player always occupies one of LANE_COUNT lanes; every
// input method (keyboard, swipe, tap, buttons, tilt) calls the SAME
// moveToLane(delta) function, which just nudges a target lane index —
// this file owns the actual smooth easing toward that lane's center, so
// there is exactly one movement implementation for every control scheme.
//
// Speed is automatic: the car eases toward a rising "cruise" target that
// game.js derives from level/progression, with no accelerator needed.
// Braking (Down / swipe-down) temporarily cuts speed. The speedometer
// (ui.js) reads Player.speedFactor / Player.kmh directly.
// =========================================================================
(function (NR) {
  "use strict";
  const { ROAD_LEFT, LANE_COUNT, LANE_WIDTH, CAR_W, CAR_H, H, ctx } = NR;

  // Base gameplay speed multiplier range, and the realistic km/h range it
  // maps to for the speedometer. Garage "Top Speed" upgrades raise both
  // ceilings; see garage.js effectiveMaxS()/effectiveKmhMax().
  const BASE_MIN_S = 0.55, BASE_MAX_S = 1.85;
  const BASE_KMH_MIN = 35, BASE_KMH_MAX = 235;
  const LANE_TWEEN_RATE = 13; // per second; higher = snappier lane changes

  class Player {
    constructor() { this.reset(); }
    reset() {
      // Re-read garage upgrades at the start of every run — they only
      // change between runs (in the Garage screen), never mid-run.
      this.minS = BASE_MIN_S;
      this.maxS = NR.Garage ? NR.Garage.effectiveMaxS(BASE_MAX_S) : BASE_MAX_S;
      this.kmhMin = BASE_KMH_MIN;
      this.kmhMax = NR.Garage ? NR.Garage.effectiveKmhMax(BASE_KMH_MAX) : BASE_KMH_MAX;
      this.accelMul = NR.Garage ? NR.Garage.effectiveAccelMul() : 1;
      this.handlingMul = NR.Garage ? NR.Garage.effectiveHandlingMul() : 1;
      this.color = NR.Garage ? NR.Garage.colorHex(NR.saved.carColor) : "#2fe6c9";

      this.lane = Math.min(LANE_COUNT - 1, 1); // start in the second-from-left lane
      this.x = this.laneCenterX(this.lane) - CAR_W / 2;
      this.y = H - CAR_H - 26;
      this.tilt = 0;
      this.speedFactor = 1.0;
      this.kmh = this.kmhMin + ((this.speedFactor - this.minS) / (this.maxS - this.minS)) * (this.kmhMax - this.kmhMin);
      this.braking = false;
      this._lastX = this.x;
    }

    laneCenterX(lane) { return ROAD_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2; }

    // The one shared entry point for every input method. delta is -1 or +1.
    // Returns true if the lane actually changed (false if already at the
    // road edge), so callers can skip haptics/sound/trail effects for a
    // no-op tap at the boundary.
    moveToLane(delta) {
      const next = Math.max(0, Math.min(LANE_COUNT - 1, this.lane + delta));
      if (next === this.lane) return false;
      this.lane = next;
      return true;
    }

    // Absolute jump used by Tap mode (tapping a specific lane zone).
    setLane(lane) {
      const next = Math.max(0, Math.min(LANE_COUNT - 1, lane));
      if (next === this.lane) return false;
      this.lane = next;
      return true;
    }

    update(dt, braking, cruiseTarget, nitro) {
      this._lastX = this.x;
      const targetX = this.laneCenterX(this.lane) - CAR_W / 2;
      const tweenRate = LANE_TWEEN_RATE * this.handlingMul;
      this.x += (targetX - this.x) * Math.min(1, dt * tweenRate);
      const visualVx = (this.x - this._lastX) / Math.max(dt, 1 / 240);
      this.tilt += ((visualVx / 460) * 0.22 - this.tilt) * Math.min(1, dt * 10);

      // Nitro power-up: raises the ceiling and pulls speed toward it fast,
      // without touching the permanent garage-upgraded maxS.
      const ceiling = nitro ? this.maxS * 1.22 : this.maxS;
      const cruise = Math.min(ceiling, cruiseTarget == null ? 1.0 : cruiseTarget);
      this.braking = !!braking && !nitro;
      if (nitro) this.speedFactor += 3.2 * this.accelMul * dt;
      else if (this.braking) this.speedFactor -= 1.9 * this.accelMul * dt;
      else this.speedFactor += (cruise - this.speedFactor) * Math.min(1, dt * (1.1 * this.accelMul));
      this.speedFactor = Math.max(this.minS, Math.min(ceiling, this.speedFactor));

      // Smoothly-updating real-time km/h reading, directly derived from speedFactor.
      const targetKmh = this.kmhMin + ((this.speedFactor - this.minS) / (this.maxS - this.minS)) * (this.kmhMax - this.kmhMin);
      this.kmh += (targetKmh - this.kmh) * Math.min(1, dt * 6);
    }
    bounds() { return { x: this.x, y: this.y, w: CAR_W, h: CAR_H }; }
    draw() {
      ctx.save();
      ctx.translate(this.x + CAR_W / 2, this.y + CAR_H / 2);
      ctx.rotate(this.tilt);
      ctx.translate(-CAR_W / 2, -CAR_H / 2);
      NR.drawCar(0, 0, CAR_W, CAR_H, this.color, "#e6fffa", this.braking);
      ctx.restore();
    }
  }

  NR.Player = Player;
  NR.SPEED_RANGE = { MIN_S: BASE_MIN_S, MAX_S: BASE_MAX_S, KMH_MIN: BASE_KMH_MIN, KMH_MAX: BASE_KMH_MAX };
})(window.NR);
