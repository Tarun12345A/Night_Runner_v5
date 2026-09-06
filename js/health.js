// =========================================================================
// health.js — replaces "one collision = instant game over" with a real
// health bar. Each hit costs one segment and triggers a short invulnerable
// window (so a single physical impact can't register as multiple hits) and
// a brief speed penalty. Game over only happens once health reaches zero.
// A Shield power-up (see powerups.js) can absorb one hit entirely.
// =========================================================================
(function (NR) {
  "use strict";

  const MAX_SEGMENTS = 3;
  const INVULN_SEC = 1.3;

  class Health {
    constructor() { this.reset(); }
    reset() {
      this.segments = MAX_SEGMENTS;
      this.invulnTimer = 0;
      this.hitFlashTimer = 0;
    }
    get isInvulnerable() { return this.invulnTimer > 0; }
    get isDead() { return this.segments <= 0; }
    get pct() { return this.segments / MAX_SEGMENTS; }

    update(dt) {
      if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
      if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }

    // Returns a description of what happened, so game.js can react
    // (screen shake strength, whether the run actually ends, etc).
    takeHit(shielded) {
      if (this.isInvulnerable) return { absorbed: false, blocked: true, died: false };
      if (shielded) { this.invulnTimer = 0.6; this.hitFlashTimer = 0.3; return { absorbed: true, blocked: false, died: false }; }
      this.segments = Math.max(0, this.segments - 1);
      this.invulnTimer = INVULN_SEC;
      this.hitFlashTimer = 0.4;
      return { absorbed: false, blocked: false, died: this.segments <= 0 };
    }
  }

  NR.Health = Health;
  NR.HEALTH_MAX_SEGMENTS = MAX_SEGMENTS;
})(window.NR);
