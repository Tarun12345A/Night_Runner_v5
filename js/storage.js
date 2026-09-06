// =========================================================================
// storage.js — the ONLY file that touches localStorage. Best score, best
// level, and best distance persist across refreshes; validated on load.
// =========================================================================
(function (NR) {
  "use strict";

  const mem = {};
  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const v = JSON.parse(raw);
      return (v === null || v === undefined) ? fallback : v;
    } catch (e) {
      return (key in mem) ? mem[key] : fallback;
    }
  }
  function set(key, value) {
    mem[key] = value;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* memory-only fallback */ }
  }

  NR.Storage = { get, set };

  NR.saved = {
    highScore: get("nr_highScore", 0),
    bestLevel: get("nr_bestLevel", 1),
    bestDistance: get("nr_bestDistance", 0), // kilometres
    settings: get("nr_settings", {
      sound: true, difficulty: NR.Diff.NORMAL, weatherEffects: true,
      controlMode: "swipe", haptics: true, swipeSensitivity: "medium", easyMode: false,
    }),
    coins: get("nr_coins", 0),
    carColor: get("nr_carColor", "teal"),
    upgrades: get("nr_upgrades", { engine: 0, accel: 0, handling: 0 }),
    stats: get("nr_stats", {
      gamesPlayed: 0, totalDistanceKm: 0, totalNearMisses: 0,
      totalOvertakes: 0, totalPlayTimeSec: 0, maxSpeedKmh: 0, totalCoinsEarned: 0,
    }),
    achievements: get("nr_achievements", {}), // { [id]: true }
  };

  // Guard against corrupted/old-format saves.
  if (typeof NR.saved.highScore !== "number" || isNaN(NR.saved.highScore)) NR.saved.highScore = 0;
  if (typeof NR.saved.bestLevel !== "number" || isNaN(NR.saved.bestLevel)) NR.saved.bestLevel = 1;
  if (typeof NR.saved.bestDistance !== "number" || isNaN(NR.saved.bestDistance)) NR.saved.bestDistance = 0;
  if (!Object.values(NR.Diff).includes(NR.saved.settings.difficulty)) NR.saved.settings.difficulty = NR.Diff.NORMAL;
  // Backward compatibility: older saves (pre-V5) won't have these fields at
  // all — fill them in individually rather than replacing the whole object,
  // so existing sound/difficulty/weather preferences are never lost.
  if (!["swipe", "tap", "buttons", "tilt"].includes(NR.saved.settings.controlMode)) NR.saved.settings.controlMode = "swipe";
  if (typeof NR.saved.settings.haptics !== "boolean") NR.saved.settings.haptics = true;
  if (!["low", "medium", "high"].includes(NR.saved.settings.swipeSensitivity)) NR.saved.settings.swipeSensitivity = "medium";
  if (typeof NR.saved.settings.easyMode !== "boolean") NR.saved.settings.easyMode = false;
  if (typeof NR.saved.coins !== "number" || isNaN(NR.saved.coins) || NR.saved.coins < 0) NR.saved.coins = 0;
  if (typeof NR.saved.carColor !== "string") NR.saved.carColor = "teal";
  if (!NR.saved.upgrades || typeof NR.saved.upgrades !== "object") NR.saved.upgrades = { engine: 0, accel: 0, handling: 0 };
  for (const k of ["engine", "accel", "handling"]) {
    if (typeof NR.saved.upgrades[k] !== "number" || isNaN(NR.saved.upgrades[k]) || NR.saved.upgrades[k] < 0) NR.saved.upgrades[k] = 0;
  }
  if (!NR.saved.stats || typeof NR.saved.stats !== "object") NR.saved.stats = {};
  for (const k of ["gamesPlayed", "totalDistanceKm", "totalNearMisses", "totalOvertakes", "totalPlayTimeSec", "maxSpeedKmh", "totalCoinsEarned"]) {
    if (typeof NR.saved.stats[k] !== "number" || isNaN(NR.saved.stats[k]) || NR.saved.stats[k] < 0) NR.saved.stats[k] = 0;
  }
  if (!NR.saved.achievements || typeof NR.saved.achievements !== "object") NR.saved.achievements = {};

  NR.persist = function () {
    set("nr_highScore", NR.saved.highScore);
    set("nr_bestLevel", NR.saved.bestLevel);
    set("nr_bestDistance", NR.saved.bestDistance);
    set("nr_settings", NR.saved.settings);
    set("nr_coins", NR.saved.coins);
    set("nr_carColor", NR.saved.carColor);
    set("nr_upgrades", NR.saved.upgrades);
    set("nr_stats", NR.saved.stats);
    set("nr_achievements", NR.saved.achievements);
  };

  // Called at end-of-run; returns which records were newly broken.
  NR.updateRecords = function (score, level, distanceKm) {
    const result = { newHighScore: false, newBestLevel: false, newBestDistance: false };
    if (score > NR.saved.highScore) { NR.saved.highScore = score; result.newHighScore = true; }
    if (level > NR.saved.bestLevel) { NR.saved.bestLevel = level; result.newBestLevel = true; }
    if (distanceKm > NR.saved.bestDistance) { NR.saved.bestDistance = distanceKm; result.newBestDistance = true; }
    NR.persist();
    return result;
  };
})(window.NR);
