// =========================================================================
// ui.js — reusable keyboard+pointer menu widget, and all HUD rendering:
// speedometer, distance, level, score, near-miss popups, level-up banner,
// milestone toasts, difficulty indicator, high-speed visual effect.
// UI displays real data read from other systems; it computes nothing
// gameplay-critical itself.
// =========================================================================
(function (NR) {
  "use strict";
  const { W, H, ROAD_RIGHT, ctx } = NR;

  // ---- reusable menu widget --------------------------------------------
  class Menu {
    constructor(options) { this.options = options; this.index = 0; this.hitboxes = []; this.hoverIndex = -1; this.clicked = -1; }
    update() {
      if (NR.wasPressed("ArrowDown") || NR.wasPressed("KeyS")) { this.index = (this.index + 1) % this.options.length; NR.Audio.move(); }
      if (NR.wasPressed("ArrowUp") || NR.wasPressed("KeyW")) { this.index = (this.index - 1 + this.options.length) % this.options.length; NR.Audio.move(); }
      if (this.clicked >= 0) { const c = this.clicked; this.clicked = -1; NR.Audio.confirm(); return c; }
      if (NR.wasPressed("Enter") || NR.wasPressed("Space")) { NR.Audio.confirm(); return this.index; }
      if (NR.wasPressed("Escape")) { NR.Audio.back(); return -2; }
      return -1;
    }
    draw(x, y, spacing, size) {
      ctx.font = `${size}px 'Space Mono', monospace`; ctx.textAlign = "left";
      this.hitboxes = [];
      this.options.forEach((label, i) => {
        const selected = i === this.index || i === this.hoverIndex;
        const text = (selected ? "▶ " : "   ") + label;
        ctx.fillStyle = selected ? "#ffb545" : "#f4eee0";
        ctx.fillText(text, x, y + i * spacing);
        const width = ctx.measureText(text).width;
        this.hitboxes.push({ x: x - 6, y: y + i * spacing - size, w: width + 20, h: spacing, i });
      });
    }
    handlePointerMove(px, py) { this.hoverIndex = -1; for (const hb of this.hitboxes) if (px >= hb.x && px <= hb.x + hb.w && py >= hb.y && py <= hb.y + hb.h) { this.hoverIndex = hb.i; this.index = hb.i; break; } }
    handlePointerDown(px, py) { this.clicked = -1; for (const hb of this.hitboxes) if (px >= hb.x && px <= hb.x + hb.w && py >= hb.y && py <= hb.y + hb.h) { this.clicked = hb.i; break; } }
  }
  NR.Menu = Menu;
  NR.activeMenu = null;
  NR.pointerRouter = null;
  NR.canvas.addEventListener("pointermove", (e) => {
    const p = NR.pointerToCanvas(e.clientX, e.clientY);
    if (NR.activeMenu) NR.activeMenu.handlePointerMove(p.x, p.y);
    if (NR.pointerRouter) NR.pointerRouter.move(p.x, p.y);
  });
  NR.canvas.addEventListener("pointerdown", (e) => {
    const p = NR.pointerToCanvas(e.clientX, e.clientY);
    if (NR.activeMenu) NR.activeMenu.handlePointerDown(p.x, p.y);
    if (NR.pointerRouter) NR.pointerRouter.down(p.x, p.y);
  });

  function center(text, y, size, color, font) {
    ctx.textAlign = "center"; ctx.font = `${size}px ${font || "'Space Mono', monospace"}`;
    ctx.fillStyle = color; ctx.fillText(text, W / 2, y); ctx.textAlign = "left";
  }
  NR.center = center;

  // Small neon diamond "NR" badge — echoes the DOM logo above the canvas so
  // the branding is consistent whether you're looking at the marquee or the
  // in-game main menu itself.
  function drawLogoBadge(cx, cy, scale) {
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(scale, scale);
    const grad = ctx.createLinearGradient(-22, -22, 22, 22);
    grad.addColorStop(0, "#ff3d7a"); grad.addColorStop(1, "#2fe6c9");
    ctx.strokeStyle = grad; ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(0, -22); ctx.lineTo(22, 0); ctx.lineTo(0, 22); ctx.lineTo(-22, 0); ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = "#2fe6c9"; ctx.lineWidth = 2.8; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-9, 9); ctx.lineTo(-2, -6); ctx.lineTo(9, -6); ctx.lineTo(16, 9); ctx.stroke();
    ctx.fillStyle = "#ffb545";
    ctx.beginPath(); ctx.arc(-6, 11, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(11, 11, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  NR.drawLogoBadge = drawLogoBadge;

  // A clickable "◀ BACK" hitbox used on every non-main-menu screen, drawn
  // bottom-left so it never collides with in-menu content. Returns the
  // hitbox so callers can register a pointerRouter against it.
  function drawBackButton() {
    const label = "◀ BACK";
    ctx.font = "12px 'Space Mono', monospace";
    ctx.fillStyle = "#2fe6c9";
    ctx.textAlign = "left";
    ctx.fillText(label, 26, H - 26);
    const w = ctx.measureText(label).width;
    return { x: 16, y: H - 42, w: w + 20, h: 30 };
  }
  NR.drawBackButton = drawBackButton;

  // ---- speedometer --------------------------------------------------------
  function drawSpeedometer(cx, cy, r, kmh, kmhMax) {
    const startAngle = Math.PI * 0.75, endAngle = Math.PI * 2.25; // 270° sweep
    const t = Math.max(0, Math.min(1, kmh / kmhMax));
    const needleAngle = startAngle + t * (endAngle - startAngle);

    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(154,146,173,0.35)";
    ctx.beginPath(); ctx.arc(cx, cy, r, startAngle, endAngle); ctx.stroke();

    // Colored danger zone toward the top end of the gauge.
    ctx.strokeStyle = "#ff3d7a";
    ctx.beginPath(); ctx.arc(cx, cy, r, startAngle + (endAngle - startAngle) * 0.78, endAngle); ctx.stroke();

    // Tick marks, roughly every 20 km/h (spacing adapts to the upgraded max).
    const tickStep = Math.max(20, Math.round(kmhMax / 12 / 10) * 10);
    ctx.strokeStyle = "#9a92ad"; ctx.lineWidth = 2;
    for (let v = 0; v <= kmhMax; v += tickStep) {
      const a = startAngle + (v / kmhMax) * (endAngle - startAngle);
      const inner = r - 10, outer = r - 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      ctx.stroke();
    }

    // Needle.
    ctx.strokeStyle = "#ffb545"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAngle) * (r - 14), cy + Math.sin(needleAngle) * (r - 14));
    ctx.stroke();
    ctx.fillStyle = "#ffb545";
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    center("SPEED", cy + r + 16, 10, "#9a92ad", "'Press Start 2P', monospace");
    center(`${Math.round(kmh)} km/h`, cy + r + 34, 13, kmh > kmhMax * 0.82 ? "#ff3d7a" : "#2fe6c9");
  }

  // ---- HUD -----------------------------------------------------------------
  // hud: { player, scoreMgr, progression, difficulty, toasts, levelBanner,
  //        milestoneToast, newRecords }
  function drawHUD(hud) {
    const hx = ROAD_RIGHT + 24;
    ctx.textAlign = "left";

    // Speedometer gauge, top of HUD column.
    drawSpeedometer(hx + 78, 96, 62, hud.player.kmh, hud.player.kmhMax);

    ctx.fillStyle = "#f4eee0"; ctx.font = "bold 12px 'Press Start 2P', monospace";
    ctx.fillText("SCORE", hx, 198);
    ctx.fillStyle = hud.scorePulse > 0 ? "#ffe14d" : "#ffb545";
    ctx.font = "bold 16px 'Press Start 2P', monospace";
    ctx.fillText(String(hud.scoreMgr.score), hx, 220);

    ctx.font = "10px 'Space Mono', monospace"; ctx.fillStyle = "#9a92ad";
    ctx.fillText(`HIGH   ${NR.saved.highScore}`, hx, 240);
    ctx.fillText(`LEVEL  ${hud.progression.level} / 99`, hx, 258);
    ctx.fillStyle = "#2fe6c9"; ctx.fillText(NR.themeForLevel(hud.progression.level).name, hx, 274);
    ctx.fillStyle = "#9a92ad";
    if (hud.mode === NR.Mode.DISTANCE && hud.distanceTargetKm) {
      ctx.fillText(`DISTANCE  ${hud.progression.distanceKm.toFixed(2)} / ${hud.distanceTargetKm} KM`, hx, 294);
    } else {
      ctx.fillText(`DISTANCE  ${hud.progression.distanceKm.toFixed(2)} KM`, hx, 294);
    }
    ctx.font = "9px 'Space Mono', monospace";
    ctx.fillText(`${hud.difficulty.toUpperCase()} · ${hud.mode === NR.Mode.DISTANCE ? "DISTANCE" : "ENDLESS"}`, hx, 309);
    ctx.fillText(hud.weatherLabel, hx, 323);

    // Health bar — three segments; a hit costs one, not the whole run.
    if (hud.health) {
      const segW = 22, segH = 10, gap = 4;
      for (let i = 0; i < NR.HEALTH_MAX_SEGMENTS; i++) {
        const filled = i < hud.health.segments;
        ctx.fillStyle = filled ? (hud.health.segments <= 1 ? "#ff3d7a" : "#5ac878") : "rgba(154,146,173,0.25)";
        if (hud.health.isInvulnerable && filled && Math.floor(performance.now() / 100) % 2 === 0) ctx.fillStyle = "#ffe14d";
        NR.roundRect(hx + i * (segW + gap), 336, segW, segH, 3, ctx.fillStyle);
      }
      if (hud.scoreMgr.combo > 1) {
        ctx.font = "10px 'Space Mono', monospace"; ctx.fillStyle = "#ffb545";
        ctx.fillText(`COMBO x${hud.scoreMgr.combo}`, hx + 3 * (segW + gap) + 10, 345);
      }
    }

    // Active power-ups — small colored chips with remaining time.
    if (hud.powerups) {
      let px = hx;
      for (const type of hud.powerups.activeList()) {
        const def = NR.POWERUP_TYPES[type];
        const secs = Math.ceil(hud.powerups.active[type]);
        ctx.fillStyle = def.color;
        NR.roundRect(px, 356, 34, 18, 4, def.color);
        ctx.fillStyle = "#0d0b13"; ctx.font = "bold 9px 'Space Mono', monospace"; ctx.textAlign = "center";
        ctx.fillText(`${def.glyph} ${secs}`, px + 17, 369);
        ctx.textAlign = "left";
        px += 40;
      }
    }

    let ty = 392;
    for (const t of hud.toasts) {
      ctx.globalAlpha = Math.min(1, t.life / 0.4);
      ctx.fillStyle = t.color; ctx.font = "11px 'Space Mono', monospace";
      ctx.fillText(t.text, hx, ty);
      ctx.globalAlpha = 1; ty += 18;
    }

    if (hud.levelBanner) {
      const b = hud.levelBanner, p = b.timer / b.maxTimer;
      const alpha = p > 0.85 ? (1 - p) * 6.6 : p < 0.15 ? p * 6.6 : 1;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = "rgba(10,8,15,0.55)"; ctx.fillRect(0, H / 2 - 44, W, 88);
      center("━━━━━━━━━━━━━━━━", H / 2 - 12, 11, "#2fe6c9");
      center("LEVEL UP!", H / 2 + 10, 20, "#ffb545", "'Press Start 2P', monospace");
      center(`LEVEL ${b.level}`, H / 2 + 34, 13, "#f4eee0", "'Press Start 2P', monospace");
      ctx.globalAlpha = 1;
    }

    // High-speed visual effect: side speed-lines once the player is really moving.
    const speedRatio = (hud.player.kmh - hud.player.kmhMin) / (hud.player.kmhMax - hud.player.kmhMin);
    if (speedRatio > 0.7) {
      const a = (speedRatio - 0.7) / 0.3 * 0.5;
      ctx.strokeStyle = `rgba(244,238,224,${a})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const y = (i * 97 + (performance.now() / 4)) % H;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(30, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W - 30, y); ctx.lineTo(W, y); ctx.stroke();
      }
    }

    // Shield visual ring around the player while active.
    if (hud.powerups && hud.powerups.isActive("shield") && hud.player) {
      const cx = hud.player.x + NR.CAR_W / 2, cy = hud.player.y + NR.CAR_H / 2;
      ctx.save();
      ctx.strokeStyle = "rgba(47,230,201,0.75)"; ctx.lineWidth = 2.5;
      ctx.shadowColor = "#2fe6c9"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(cx, cy, NR.CAR_H * 0.62, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
  NR.drawHUD = drawHUD;
})(window.NR);
