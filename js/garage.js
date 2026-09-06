// =========================================================================
// garage.js — car customization. Coins are earned from your score at the
// end of each run (see game.js endRun) and spent here on cosmetic color
// and permanent stat upgrades. Nothing here touches gameplay directly;
// player.js reads the "effective*" helpers once per run start.
// =========================================================================
(function (NR) {
  "use strict";

  const CAR_COLORS = [
    { id: "teal", label: "TEAL", hex: "#2fe6c9" },
    { id: "pink", label: "PINK", hex: "#ff3d7a" },
    { id: "amber", label: "AMBER", hex: "#ffb545" },
    { id: "violet", label: "VIOLET", hex: "#9a6cff" },
    { id: "lime", label: "LIME", hex: "#5ac878" },
    { id: "white", label: "WHITE", hex: "#f4eee0" },
  ];

  const UPGRADE_DEFS = [
    {
      id: "engine", label: "TOP SPEED", desc: "Higher top speed & speedometer ceiling",
      maxLevel: 5, baseCost: 120, costGrowth: 1.42,
    },
    {
      id: "accel", label: "ACCELERATION", desc: "Faster pickup when you hit the gas",
      maxLevel: 5, baseCost: 100, costGrowth: 1.38,
    },
    {
      id: "handling", label: "HANDLING", desc: "Sharper, more responsive steering",
      maxLevel: 5, baseCost: 100, costGrowth: 1.38,
    },
  ];

  function costFor(def, level) {
    if (level >= def.maxLevel) return null;
    return Math.round(def.baseCost * Math.pow(def.costGrowth, level));
  }

  function colorHex(id) {
    const c = CAR_COLORS.find((c) => c.id === id);
    return c ? c.hex : CAR_COLORS[0].hex;
  }

  // Coins earned at the end of a run — deliberately modest so upgrades feel
  // like a genuine mid/long-term goal rather than an instant unlock.
  function coinsForScore(score) { return Math.max(0, Math.floor(score / 40)); }

  function purchase(defId) {
    const def = UPGRADE_DEFS.find((d) => d.id === defId);
    if (!def) return { ok: false, reason: "unknown" };
    const level = NR.saved.upgrades[defId] || 0;
    const cost = costFor(def, level);
    if (cost === null) return { ok: false, reason: "maxed" };
    if (NR.saved.coins < cost) return { ok: false, reason: "poor" };
    NR.saved.coins -= cost;
    NR.saved.upgrades[defId] = level + 1;
    NR.persist();
    return { ok: true, newLevel: level + 1, cost };
  }

  // ---- effective gameplay stats, read once per run by player.js ----------
  function effectiveMaxS(baseMaxS) {
    return baseMaxS + (NR.saved.upgrades.engine || 0) * 0.13;
  }
  function effectiveKmhMax(baseKmhMax) {
    return baseKmhMax + (NR.saved.upgrades.engine || 0) * 24;
  }
  function effectiveAccelMul() {
    return 1 + (NR.saved.upgrades.accel || 0) * 0.16;
  }
  function effectiveHandlingMul() {
    return 1 + (NR.saved.upgrades.handling || 0) * 0.14;
  }

  NR.Garage = {
    CAR_COLORS, UPGRADE_DEFS, costFor, colorHex, coinsForScore, purchase,
    effectiveMaxS, effectiveKmhMax, effectiveAccelMul, effectiveHandlingMul,
  };
})(window.NR);
