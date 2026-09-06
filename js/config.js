// =========================================================================
// config.js — shared constants, canvas handle, low-level input plumbing.
// Loaded first; every other module reads/writes window.NR.
// =========================================================================
window.NR = window.NR || {};

(function (NR) {
  "use strict";

  NR.W = 900;
  NR.H = 560;
  NR.ROAD_WIDTH = 400;
  NR.ROAD_LEFT = (NR.W - NR.ROAD_WIDTH) / 2 - 90;
  NR.ROAD_RIGHT = NR.ROAD_LEFT + NR.ROAD_WIDTH;
  NR.LANE_COUNT = 4;
  NR.LANE_WIDTH = NR.ROAD_WIDTH / NR.LANE_COUNT;
  NR.CAR_W = 44;
  NR.CAR_H = 76;

  NR.State = {
    MAIN_MENU: "MAIN_MENU",
    MODE_SELECT: "MODE_SELECT",
    DIFFICULTY: "DIFFICULTY",
    SETTINGS: "SETTINGS",
    HOW_TO: "HOW_TO",
    GARAGE: "GARAGE",
    ACHIEVEMENTS: "ACHIEVEMENTS",
    STATS: "STATS",
    PLAYING: "PLAYING",
    IMPACT: "IMPACT",
    PAUSED: "PAUSED",
    GAME_OVER: "GAME_OVER",
    EXITED: "EXITED",
  };

  NR.Mode = { ENDLESS: "endless", DISTANCE: "distance" };
  NR.DISTANCE_TARGETS_KM = [2, 5, 10, 20]; // Distance Challenge tiers

  NR.Diff = { EASY: "Easy", NORMAL: "Normal", HARD: "Hard", NIGHTMARE: "Nightmare" };

  // Gameplay-affecting difficulty parameters (used by traffic.js / scoring.js).
  NR.DIFF_PARAMS = {
    [NR.Diff.EASY]: { speedMul: 0.82, densityMul: 0.75, intervalMul: 1.25, scoreMul: 1.0 },
    [NR.Diff.NORMAL]: { speedMul: 1.0, densityMul: 1.0, intervalMul: 1.0, scoreMul: 1.5 },
    [NR.Diff.HARD]: { speedMul: 1.22, densityMul: 1.25, intervalMul: 0.8, scoreMul: 2.0 },
    [NR.Diff.NIGHTMARE]: { speedMul: 1.48, densityMul: 1.5, intervalMul: 0.62, scoreMul: 3.0 },
  };

  NR.canvas = document.getElementById("game");
  NR.ctx = NR.canvas.getContext("2d");

  NR.pointerToCanvas = function (clientX, clientY) {
    const rect = NR.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (NR.W / rect.width),
      y: (clientY - rect.top) * (NR.H / rect.height),
    };
  };

  // ---- keyboard state -----------------------------------------------------
  const keysDown = new Set();
  const keysPressed = new Set();
  function press(code) {
    if (!keysDown.has(code)) keysPressed.add(code);
    keysDown.add(code);
  }
  function release(code) {
    keysDown.delete(code);
  }
  window.addEventListener("keydown", (e) => {
    press(e.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => release(e.code));

  NR.keysDown = keysDown;
  NR.wasPressed = (code) => keysPressed.has(code);
  NR.clearPressed = () => keysPressed.clear();
  NR.press = press;     // exposed so input.js can simulate key input from gestures
  NR.release = release;

  NR.bindHold = function (id, code) {
    const el = document.getElementById(id);
    if (!el) return;
    const down = (e) => { e.preventDefault(); press(code); el.classList.add("active"); };
    const up = (e) => { e.preventDefault(); release(code); el.classList.remove("active"); };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointerleave", up);
    el.addEventListener("pointercancel", up);
  };

  // ---- shared drawing primitives (used by player.js & traffic.js) --------
  NR.roundRect = function (x, y, w, h, r, fill) {
    const ctx = NR.ctx;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  };
  NR.roundRectStroke = function (x, y, w, h, r) {
    const ctx = NR.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.stroke();
  };
  NR.drawCar = function (x, y, w, h, bodyColor, glassColor, brakeLit) {
    const ctx = NR.ctx;
    NR.roundRect(x, y, w, h, 10, bodyColor);
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1.5;
    NR.roundRectStroke(x, y, w, h, 10);
    NR.roundRect(x + 6, y + 10, w - 12, 18, 6, glassColor);
    NR.roundRect(x + 6, y + h - 24, w - 12, 14, 6, glassColor);
    ctx.fillStyle = "#ffe14d";
    ctx.beginPath(); ctx.arc(x + 8, y + 6, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w - 8, y + 6, 3, 0, Math.PI * 2); ctx.fill();
    if (brakeLit) {
      ctx.fillStyle = "#ff4444";
      ctx.beginPath(); ctx.arc(x + 8, y + h - 5, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w - 8, y + h - 5, 3.2, 0, Math.PI * 2); ctx.fill();
    }
  };
})(window.NR);
