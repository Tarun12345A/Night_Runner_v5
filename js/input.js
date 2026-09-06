// =========================================================================
// input.js — every mobile control scheme (Swipe, Tap, Buttons, Tilt) lives
// here, and every one of them calls the exact same two functions on the
// game object: tryLaneMove(delta) and trySetLane(lane) (see game.js).
// There is no separate movement logic per input method — this file only
// decides WHEN to call them.
//
// Keyboard input is handled directly in game.js's updatePlaying() since it
// naturally belongs to the per-frame update; everything else (being
// event-driven) lives here.
// =========================================================================
(function (NR) {
  "use strict";

  function game() { return window.__NR_GAME || null; }
  function playing() {
    const g = game();
    return !!g && g.state === NR.State.PLAYING && g.countdown <= 0;
  }

  const SENSITIVITY_PX = { low: 58, medium: 40, high: 26 };
  function swipeThreshold() {
    return SENSITIVITY_PX[NR.saved.settings.swipeSensitivity] || SENSITIVITY_PX.medium;
  }

  // ---- Swipe (default) -----------------------------------------------------
  // One finger, one gesture, one lane change — the gesture is "consumed"
  // the instant a threshold is crossed so a long continued drag can't fire
  // multiple lane changes from a single swipe.
  const swipeState = new Map(); // pointerId -> { startX, startY, consumed, brakeEngaged }

  function onSwipeDown(e) {
    if (NR.saved.settings.controlMode !== "swipe") return;
    swipeState.set(e.pointerId, { startX: e.clientX, startY: e.clientY, consumed: false, brakeEngaged: false });
  }
  function onSwipeMove(e) {
    if (NR.saved.settings.controlMode !== "swipe") return;
    const st = swipeState.get(e.pointerId);
    if (!st || st.consumed || !playing()) return;
    const dx = e.clientX - st.startX, dy = e.clientY - st.startY;
    const threshold = swipeThreshold();
    if (Math.abs(dy) > threshold && Math.abs(dy) > Math.abs(dx)) {
      if (dy > 0) { NR.press("ArrowDown"); st.brakeEngaged = true; }
      st.consumed = true;
      return;
    }
    if (Math.abs(dx) > threshold) {
      game().tryLaneMove(dx > 0 ? 1 : -1);
      st.consumed = true;
    }
  }
  function onSwipeUp(e) {
    const st = swipeState.get(e.pointerId);
    if (st && st.brakeEngaged) NR.release("ArrowDown");
    swipeState.delete(e.pointerId);
  }

  // ---- Tap (absolute lane zones) --------------------------------------------
  // The canvas width is divided into LANE_COUNT equal zones; tapping a zone
  // jumps straight to that lane. A quick double-tap still brakes, same as
  // in Swipe mode, so players don't lose that gesture when they switch modes.
  let lastTap = { time: 0, x: 0, y: 0 };
  const DOUBLE_TAP_MS = 300, DOUBLE_TAP_DIST = 44, BRAKE_PULSE_MS = 260;

  function onTapDown(e) {
    if (NR.saved.settings.controlMode !== "tap") return;
    const p = NR.pointerToCanvas(e.clientX, e.clientY);
    const now = performance.now();
    const isDouble = (now - lastTap.time < DOUBLE_TAP_MS) && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < DOUBLE_TAP_DIST;
    lastTap = isDouble ? { time: 0, x: 0, y: 0 } : { time: now, x: p.x, y: p.y };
    if (!playing()) return;
    if (isDouble) { NR.press("ArrowDown"); setTimeout(() => NR.release("ArrowDown"), BRAKE_PULSE_MS); return; }
    const zone = Math.floor((p.x / NR.W) * NR.LANE_COUNT);
    game().trySetLane(Math.max(0, Math.min(NR.LANE_COUNT - 1, zone)));
  }

  // ---- Tilt (best-effort; device/browser support varies) -------------------
  // Uses window.deviceorientation's gamma (left/right tilt in degrees).
  // Hysteresis: must return near-level before the next tilt can trigger, so
  // holding the phone tilted doesn't spam lane changes every frame.
  const TILT_TRIGGER_DEG = 13, TILT_RESET_DEG = 6;
  let tiltArmed = true, tiltPermissionRequested = false, tiltListenerAttached = false;

  function onDeviceOrientation(e) {
    if (NR.saved.settings.controlMode !== "tilt" || !playing()) return;
    const gamma = e.gamma; // -90 (left) .. +90 (right)
    if (gamma == null) return;
    if (Math.abs(gamma) < TILT_RESET_DEG) { tiltArmed = true; return; }
    if (!tiltArmed) return;
    if (gamma <= -TILT_TRIGGER_DEG) { game().tryLaneMove(-1); tiltArmed = false; }
    else if (gamma >= TILT_TRIGGER_DEG) { game().tryLaneMove(1); tiltArmed = false; }
  }

  function ensureTiltActive() {
    if (NR.saved.settings.controlMode !== "tilt" || tiltListenerAttached) return;
    const attach = () => { window.addEventListener("deviceorientation", onDeviceOrientation); tiltListenerAttached = true; };
    // iOS 13+ requires an explicit user-gesture permission prompt; other
    // browsers expose deviceorientation directly with no such API at all.
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      if (tiltPermissionRequested) return;
      tiltPermissionRequested = true;
      DeviceOrientationEvent.requestPermission().then((r) => { if (r === "granted") attach(); }).catch(() => {});
    } else {
      attach();
    }
  }

  // ---- Buttons mode: show/hide the overlay buttons --------------------------
  function refreshControlModeUI() {
    const laneButtons = document.getElementById("lane-buttons");
    if (laneButtons) laneButtons.classList.toggle("show", NR.saved.settings.controlMode === "buttons");
    if (NR.saved.settings.controlMode === "tilt") ensureTiltActive();
  }
  NR.Input = { refreshControlModeUI };

  // ---- wiring ----------------------------------------------------------
  // Pointer Events unify touch/mouse/pen into one stream, so touch can
  // never double-fire as a separate synthetic mouse/click event here.
  NR.canvas.addEventListener("pointerdown", (e) => { onSwipeDown(e); onTapDown(e); });
  NR.canvas.addEventListener("pointermove", onSwipeMove);
  NR.canvas.addEventListener("pointerup", onSwipeUp);
  NR.canvas.addEventListener("pointercancel", onSwipeUp);
  NR.canvas.addEventListener("pointerleave", onSwipeUp);

  // Safety net: if focus is lost mid-gesture (app switch, alert, etc.)
  // there's no pointerup to clean up with — release everything held.
  window.addEventListener("blur", () => {
    for (const id of Array.from(swipeState.keys())) onSwipeUp({ pointerId: id });
    NR.release("ArrowDown");
  });

  document.addEventListener("DOMContentLoaded", refreshControlModeUI);
})(window.NR);
