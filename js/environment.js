// =========================================================================
// environment.js — parallax background, road surface, weather, particles.
// Purely visual; reads level/speed but owns no gameplay state.
// =========================================================================
(function (NR) {
  "use strict";
  const { W, H, ROAD_LEFT, ROAD_RIGHT, ROAD_WIDTH, LANE_COUNT, LANE_WIDTH, ctx } = NR;

  // ---- particles -----------------------------------------------------------
  const MAX_PARTICLES = 220;
  class Particles {
    constructor() { this.list = []; }
    spawn(n, factory) {
      if (!NR.saved.settings.weatherEffects && factory.__weather) return;
      for (let i = 0; i < n; i++) {
        if (this.list.length >= MAX_PARTICLES) this.list.shift();
        this.list.push(factory());
      }
    }
    update(dt) {
      for (const p of this.list) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.grav) p.vy += p.grav * dt;
      }
      this.list = this.list.filter((p) => p.life > 0 && p.y < H + 40);
    }
    draw() {
      for (const p of this.list) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        if (p.shape === "line") {
          ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); ctx.stroke();
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---- weather --------------------------------------------------------------
  class Weather {
    constructor() { this.reset(); }
    reset() { this.current = "clear"; this.target = "clear"; this.mix = 1; this.timer = 20; }
    update(dt, particles) {
      if (!NR.saved.settings.weatherEffects) return;
      this.timer -= dt;
      if (this.timer <= 0 && this.mix >= 1) {
        const options = ["clear", "rain", "fog"].filter((w) => w !== this.current);
        this.target = options[Math.floor(Math.random() * options.length)];
        this.mix = 0; this.timer = 26 + Math.random() * 14;
      }
      if (this.mix < 1) { this.mix = Math.min(1, this.mix + dt / 3.5); if (this.mix >= 1) this.current = this.target; }
      const active = this.mix >= 1 ? this.current : this.target;
      if (active === "rain" && Math.random() < 0.85) {
        const f = () => ({ x: ROAD_LEFT - 30 + Math.random() * (ROAD_WIDTH + 60), y: -10, vx: -30, vy: 640 + Math.random() * 160, life: 0.6, maxLife: 0.6, size: 1.3, color: "rgba(160,200,255,0.5)", shape: "line", grav: 0 });
        f.__weather = true;
        particles.spawn(2, f);
      }
    }
    drawOverlay() {
      if (!NR.saved.settings.weatherEffects) return;
      const draw = (type, s) => {
        if (type === "fog") { ctx.fillStyle = `rgba(200,205,215,${0.15 * s})`; ctx.fillRect(0, 0, W, H); }
        if (type === "rain") { ctx.fillStyle = `rgba(20,30,60,${0.10 * s})`; ctx.fillRect(0, 0, W, H); }
      };
      if (this.mix >= 1) { if (this.current !== "clear") draw(this.current, 1); }
      else { if (this.current !== "clear") draw(this.current, 1 - this.mix); if (this.target !== "clear") draw(this.target, this.mix); }
    }
    label() { if (!NR.saved.settings.weatherEffects) return "CLEAR NIGHT"; return { clear: "CLEAR NIGHT", rain: "RAIN", fog: "FOG" }[this.mix >= 1 ? this.current : this.target]; }
  }

  // ---- level themes (cycled, since levels run 1-99) -------------------------
  const LEVEL_THEMES = [
    { name: "NIGHT DRIVE", sky: ["#241a33", "#120e1c"], building: "#2a2140" },
    { name: "TRAFFIC FLOW", sky: ["#1c2038", "#0e111e"], building: "#232b48" },
    { name: "HIGH SPEED", sky: ["#151d33", "#0b0e1a"], building: "#1c2740" },
    { name: "TRAFFIC RUSH", sky: ["#22103a", "#100819"], building: "#2e1650" },
    { name: "NIGHTMARE HIGHWAY", sky: ["#2a0d1c", "#12060c"], building: "#3a1230" },
    { name: "STORM CIRCUIT", sky: ["#131b2c", "#080b13"], building: "#20304a" },
    { name: "RED ZONE", sky: ["#2c0d12", "#120508"], building: "#401820" },
  ];
  function themeForLevel(level) {
    // Cycle through the palette instead of hard-coding 99 themes; the name
    // still reflects genuine progression via LEVEL_THEMES.length buckets.
    const idx = Math.min(LEVEL_THEMES.length - 1, Math.floor((level - 1) / Math.ceil(99 / LEVEL_THEMES.length)));
    return LEVEL_THEMES[idx];
  }
  NR.themeForLevel = themeForLevel;

  class Background {
    constructor() {
      this.reset();
      this.stars = Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.5, r: Math.random() * 1.5 + 0.3, tw: Math.random() * Math.PI * 2 }));
      this.buildings = this.genBuildings();
    }
    genBuildings() { const arr = []; let x = -40; while (x < W + 40) { const w = 40 + Math.random() * 50; const h = 60 + Math.random() * 150; arr.push({ x, w, h }); x += w + 6; } return arr; }
    reset() { this.skyTime = 0; this.midOff = 0; this.lightOff = 0; this.barrierOff = 0; }
    update(dt, speedFactor) {
      this.skyTime += dt;
      this.midOff = (this.midOff + 26 * speedFactor * dt) % (W + 100);
      this.lightOff = (this.lightOff + 130 * speedFactor * dt) % 220;
      this.barrierOff = (this.barrierOff + 320 * speedFactor * dt) % 40;
    }
    draw(theme, weatherLabel) {
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.62);
      g.addColorStop(0, theme.sky[0]); g.addColorStop(1, theme.sky[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      if (weatherLabel !== "FOG") {
        for (const s of this.stars) {
          ctx.globalAlpha = 0.55 + 0.45 * Math.sin(this.skyTime * 2 + s.tw);
          ctx.fillStyle = "#f4eee0";
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(244,238,224,0.9)";
        ctx.beginPath(); ctx.arc(W - 80, 64, 24, 0, Math.PI * 2); ctx.fill();
      }

      for (const b of this.buildings) {
        let bx = b.x - (this.midOff % (W + 100));
        if (bx < -80) bx += (W + 100);
        ctx.fillStyle = theme.building;
        ctx.fillRect(bx, H * 0.6 - b.h, b.w, b.h);
        ctx.fillStyle = "rgba(255,220,150,0.5)";
        for (let wy = H * 0.6 - b.h + 10; wy < H * 0.6 - 8; wy += 14) {
          for (let wx = bx + 4; wx < bx + b.w - 4; wx += 10) {
            if (((wx | 0) * 7 + (wy | 0) * 13) % 5 === 0) ctx.fillRect(wx, wy, 3, 5);
          }
        }
      }

      ctx.fillStyle = "#0f2016";
      ctx.fillRect(0, H * 0.6, ROAD_LEFT, H * 0.4);
      ctx.fillRect(ROAD_RIGHT, H * 0.6, W - ROAD_RIGHT, H * 0.4);

      ctx.fillStyle = "rgba(255,210,140,0.85)";
      for (let y = -this.lightOff; y < H; y += 220) {
        ctx.beginPath(); ctx.arc(ROAD_LEFT - 20, y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ROAD_RIGHT + 20, y, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  class Road {
    constructor() { this.reset(); }
    reset() { this.scroll = 0; this.barrierScroll = 0; }
    update(dt, speedFactor) {
      const dash = 34, gap = 26;
      this.scroll = (this.scroll + 250 * speedFactor * dt) % (dash + gap);
      this.barrierScroll = (this.barrierScroll + 420 * speedFactor * dt) % 40;
    }
    draw(wet) {
      ctx.fillStyle = wet ? "#33363f" : "#2c2c34";
      ctx.fillRect(ROAD_LEFT, 0, ROAD_WIDTH, H);
      ctx.fillStyle = "#c9cdd6";
      for (let y = -this.barrierScroll; y < H; y += 40) { ctx.fillRect(ROAD_LEFT - 10, y, 4, 22); ctx.fillRect(ROAD_RIGHT + 6, y, 4, 22); }
      ctx.fillStyle = "#2fe6c9";
      ctx.fillRect(ROAD_LEFT - 4, 0, 4, H); ctx.fillRect(ROAD_RIGHT, 0, 4, H);
      const dash = 34, gap = 26;
      ctx.fillStyle = "#ffb545";
      for (let lane = 1; lane < LANE_COUNT; lane++) {
        const x = ROAD_LEFT + lane * LANE_WIDTH - 2;
        let y = -dash + this.scroll;
        while (y < H) { ctx.fillRect(x, y, 4, dash); y += dash + gap; }
      }
    }
  }

  NR.Particles = Particles;
  NR.Weather = Weather;
  NR.Background = Background;
  NR.Road = Road;
})(window.NR);
