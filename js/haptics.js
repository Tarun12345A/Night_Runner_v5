// =========================================================================
// haptics.js — thin, safe wrapper around navigator.vibrate(). Every call
// is wrapped so an unsupported or misbehaving browser can never throw or
// break gameplay; it just silently does nothing.
// =========================================================================
(function (NR) {
  "use strict";

  const PATTERNS = {
    lane: 8,           // lane change — very short
    pickup: [8, 30, 8], // coin/power-up — subtle double-tap
    collision: 35,      // hit — stronger, single pulse
    gameover: [40, 40, 90], // distinct pattern so it doesn't feel like a hit
  };

  function supported() {
    return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  }

  function pulse(type) {
    if (!NR.saved.settings.haptics) return;
    if (!supported()) return;
    try { navigator.vibrate(PATTERNS[type] || 10); } catch (e) { /* never let a vibration failure affect gameplay */ }
  }

  NR.Haptics = { pulse, supported };
})(window.NR);
