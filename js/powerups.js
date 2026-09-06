// =========================================================================
// powerups.js — spawns collectible power-ups on the road and tracks which
// effects are currently active. Actually *applying* each effect (speed
// boost, traffic slowdown, score multiplier, collision immunity) is done
// by the systems that own that behavior — player.js, traffic.js,
// scoring.js, health.js — reading isActive()/consume() from here. This
// file only owns spawning, collection, and the countdown timers.
// =========================================================================
(function (NR) {
  "use strict";
  const { ROAD_LEFT, LANE_COUNT, LANE_WIDTH, H, ctx } = NR;

  const TYPES = {
    nitro: { color: "#ffb545", glyph: "N", duration: 4.0, label: "NITRO" },
    shield: { color: "#2fe6c9", glyph: "S", duration: 10.0, label: "SHIELD" }, // duration = how long it waits to be used
    slowmo: { color: "#9a6cff", glyph: "T", duration: 5.0, label: "SLOW-MO" },
    doublescore: { color: "#ffe14d", glyph: "×2", duration: 6.0, label: "2X SCORE" },
  };
  const TYPE_IDS = Object.keys(TYPES);
  const SIZE = 30;
  const MIN_SPAWN_GAP = 9, MAX_SPAWN_GAP = 15;

  class PowerUpManager {
    constructor() { this.reset(); }
    reset() {
      this.pickups = []; // on-road, uncollected
      this.active = {}; // type -> remaining seconds
      this.spawnTimer = MIN_SPAWN_GAP + Math.random() * (MAX_SPAWN_GAP - MIN_SPAWN_GAP);
    }

    isActive(type) { return (this.active[type] || 0) > 0; }
    consume(type) { this.active[type] = 0; }
    activeList() { return TYPE_IDS.filter((t) => this.isActive(t)); }

    laneCenterX(lane) { return ROAD_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2; }

    trySpawn(traffic) {
      // Only spawn into a lane that's currently clear near the top of the
      // screen, so a pickup never appears inside/behind an oncoming wave —
      // "no impossible-to-reach spawns", same principle as traffic.js.
      const busyLanes = new Set(traffic.enemies.filter((e) => e.y < 260).map((e) => e.lane));
      const freeLanes = [0, 1, 2, 3].filter((l) => !busyLanes.has(l));
      if (freeLanes.length === 0) return; // try again next tick
      const lane = freeLanes[Math.floor(Math.random() * freeLanes.length)];
      const type = TYPE_IDS[Math.floor(Math.random() * TYPE_IDS.length)];
      this.pickups.push({ type, lane, x: this.laneCenterX(lane) - SIZE / 2, y: -SIZE, w: SIZE, h: SIZE, spin: 0 });
    }

    update(dt, speedFactor, traffic, playerBounds, onCollect) {
      for (const t of TYPE_IDS) if (this.active[t] > 0) this.active[t] = Math.max(0, this.active[t] - dt);

      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.trySpawn(traffic);
        this.spawnTimer = MIN_SPAWN_GAP + Math.random() * (MAX_SPAWN_GAP - MIN_SPAWN_GAP);
      }

      const baseSpeed = 210;
      for (const p of this.pickups) { p.y += baseSpeed * speedFactor * dt; p.spin += dt * 3; }

      this.pickups = this.pickups.filter((p) => {
        if (p.y > H + p.h) return false;
        const overlap = playerBounds.x < p.x + p.w && playerBounds.x + playerBounds.w > p.x &&
          playerBounds.y < p.y + p.h && playerBounds.y + playerBounds.h > p.y;
        if (overlap) {
          this.active[p.type] = TYPES[p.type].duration;
          onCollect && onCollect(p.type);
          return false;
        }
        return true;
      });
    }

    draw() {
      for (const p of this.pickups) {
        const def = TYPES[p.type];
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.sin(p.spin) * 0.15);
        ctx.fillStyle = def.color;
        ctx.shadowColor = def.color; ctx.shadowBlur = 14;
        NR.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 8, def.color);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#0d0b13";
        ctx.font = "bold 13px 'Space Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(def.glyph, 0, 1);
        ctx.textBaseline = "alphabetic";
        ctx.restore();
      }
    }
  }

  NR.PowerUpManager = PowerUpManager;
  NR.POWERUP_TYPES = TYPES;
})(window.NR);
