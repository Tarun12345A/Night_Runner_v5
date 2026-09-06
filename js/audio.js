// =========================================================================
// audio.js — procedural sound effects. Respects the sound toggle, never
// plays before a user gesture (autoplay policies).
// =========================================================================
(function (NR) {
  "use strict";

  const Audio_ = {
    ctx: null,
    ensure() {
      if (!this.ctx) {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    },
    get enabled() { return NR.saved.settings.sound; },
    beep(freq, dur, type, vol) {
      if (!this.enabled) return;
      this.ensure();
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(vol || 0.06, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t0); osc.stop(t0 + dur);
    },
    move() { this.beep(520, 0.05, "square", 0.04); },
    confirm() { this.beep(700, 0.08, "square", 0.06); this.beep(920, 0.09, "square", 0.05); },
    back() { this.beep(300, 0.08, "square", 0.05); },
    point() { this.beep(1000, 0.05, "square", 0.03); },
    nearmiss() { this.beep(1300, 0.07, "sawtooth", 0.05); },
    levelup() { this.beep(660, 0.09, "square", 0.05); this.beep(880, 0.09, "square", 0.05); this.beep(1100, 0.14, "square", 0.06); },
    milestone() { this.beep(500, 0.06, "triangle", 0.05); this.beep(750, 0.1, "triangle", 0.05); },
    crash() {
      if (!this.enabled) return;
      this.ensure();
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, t0);
      osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.35);
      gain.gain.setValueAtTime(0.14, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.4);
    },
  };
  window.addEventListener("pointerdown", () => Audio_.ensure(), { once: true });
  window.addEventListener("keydown", () => Audio_.ensure(), { once: true });

  NR.Audio = Audio_;
})(window.NR);
