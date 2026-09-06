// =========================================================================
// game.js — game lifecycle: init, start/pause/resume/restart, game-over,
// the single requestAnimationFrame loop, and coordination of every other
// system. Does not contain traffic/scoring/storage implementation details.
// =========================================================================
(function (NR) {
  "use strict";
  const { ctx, W, H } = NR;

  class Game {
    constructor() {
      this.state = NR.State.MAIN_MENU;
      this.toasts = [];
      this.screenShake = 0;
      this.scorePulseTimer = 0;
      this._lastScoreSeen = 0;
      this.records = { newHighScore: false, newBestLevel: false, newBestDistance: false };
      this.levelBanner = null;

      this.player = new NR.Player();
      this.traffic = new NR.Traffic();
      this.road = new NR.Road();
      this.background = new NR.Background();
      this.weather = new NR.Weather();
      this.particles = new NR.Particles();
      this.progression = new NR.Progression();
      this.scoreMgr = new NR.ScoreManager();
      this.health = new NR.Health();
      this.powerups = new NR.PowerUpManager();
      this.mode = NR.Mode.ENDLESS;
      this.distanceTargetKm = null;
      this.session = null; // populated in startNewRun(); feeds achievements + stats
      this.newAchievements = [];
      this.impactIsSuccess = false;

      this.mainMenu = new NR.Menu(["Play", "Garage", "Achievements", "Stats", "How To Play", "Settings", "Exit"]);
      this.modeMenu = new NR.Menu(["Endless Night Run", "Distance: 2 KM", "Distance: 5 KM", "Distance: 10 KM", "Distance: 20 KM", "Back"]);
      this.difficultyMenu = new NR.Menu(["Easy", "Normal", "Hard", "Nightmare", "Back"]);
      this.pauseMenu = new NR.Menu(["Resume", "Restart", "Main Menu", "Exit"]);
      this.gameOverMenu = new NR.Menu(["Play Again", "Main Menu", "Exit"]);
      this.exitMenu = new NR.Menu(["Back To Menu"]);
      this.settingsIndex = 0;
      this.garageIndex = 0;
      this._garageColorHover = -1;
      this.countdown = 0;
      this.lastCoinsEarned = 0;

      this.bindDom();
      this.lastTime = performance.now();
      window.__NR_GAME = this; // lightweight debug hook; harmless in production
      requestAnimationFrame(this.loop.bind(this));
    }

    bindDom() {
      this.soundBtn = document.getElementById("sound-toggle");
      this.syncSoundBtn();
      this.soundBtn.addEventListener("click", () => { NR.saved.settings.sound = !NR.saved.settings.sound; this.syncSoundBtn(); NR.persist(); });

    const fsBtn = document.getElementById("fullscreen-btn");
    const cabinet = document.getElementById("cabinet");
    const stageWrap = document.getElementById("stage-wrap");

    const toggleFullscreen = () => {
      if (!document.fullscreenElement) (cabinet.requestFullscreen || cabinet.webkitRequestFullscreen || function () {}).call(cabinet);
      else (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
    };
    fsBtn.addEventListener("click", toggleFullscreen);
    this._toggleFullscreen = toggleFullscreen;

    // Pause overlay — floats on the canvas itself (top-right corner) instead
    // of sharing layout space with it, so it works identically for mouse
    // and touch without stealing any screen real estate from the game.
    const pauseOverlay = document.getElementById("pause-overlay");
    this._pauseOverlayEl = pauseOverlay;
    pauseOverlay.addEventListener("click", () => {
      if (this.state === NR.State.PLAYING) { NR.Audio.back(); this.state = NR.State.PAUSED; }
      else if (this.state === NR.State.PAUSED) { NR.Audio.confirm(); this.state = NR.State.PLAYING; }
    });

    // Optional on-screen lane buttons (Buttons control mode) — shown/hidden
    // by input.js based on the selected control mode, not hard-coded here.
    const bindRepeatable = (id, onFire) => {
      const el = document.getElementById(id);
      let repeatTimer = null, initialTimer = null;
      const fire = () => { onFire(); };
      const start = (e) => {
        e.preventDefault();
        fire();
        initialTimer = setTimeout(() => { repeatTimer = setInterval(fire, 220); }, 350);
      };
      const stop = () => { clearTimeout(initialTimer); clearInterval(repeatTimer); };
      el.addEventListener("pointerdown", start);
      el.addEventListener("pointerup", stop);
      el.addEventListener("pointerleave", stop);
      el.addEventListener("pointercancel", stop);
    };
    bindRepeatable("btn-left", () => this.tryLaneMove(-1));
    bindRepeatable("btn-right", () => this.tryLaneMove(1));
    const brakeBtn = document.getElementById("btn-brake");
    brakeBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); NR.press("ArrowDown"); });
    ["pointerup", "pointerleave", "pointercancel"].forEach((evt) => brakeBtn.addEventListener(evt, () => NR.release("ArrowDown")));

    // Touch devices (phones/tablets) auto-maximize permanently — many touch
    // browsers, notably iOS Safari, don't support requestFullscreen() on
    // arbitrary elements at all, so a button-triggered fullscreen alone
    // left them stuck small with no way out. This CSS class does the same
    // "fill the screen" layout without needing that permission, and
    // recomputes on its own on rotation since it's driven by vw/dvh units.
    const isTouchDevice = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    const updateMaximizedClass = () => {
      cabinet.classList.toggle("nr-maximized", isTouchDevice || !!document.fullscreenElement);
    };
    updateMaximizedClass();

    // Sizes #stage-wrap in real pixels so the 900x560 stage always fits
    // fully inside the viewport whenever maximized — no scrollbars, no crop,
    // no letterboxing. Re-run on rotation (resize/orientationchange), on
    // real fullscreen toggles, and on mobile browser chrome show/hide
    // (visualViewport), since any of those change the available space.
    // V5: controls are overlays now (see CSS), not layout siblings, so the
    // canvas simply gets the full viewport minus a small fixed margin.
    const sizeStage = () => {
      updateMaximizedClass();
      if (!cabinet.classList.contains("nr-maximized")) {
        stageWrap.style.width = ""; stageWrap.style.height = "";
        return;
      }
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
      const margin = 24; // cabinet + screen-frame padding, both axes
      const ratio = NR.W / NR.H;
      let w = vw - margin, h = w / ratio;
      if (h > vh - margin) { h = vh - margin; w = h * ratio; }
      stageWrap.style.width = Math.max(240, Math.floor(w)) + "px";
      stageWrap.style.height = Math.max(150, Math.floor(h)) + "px";
    };
    document.addEventListener("fullscreenchange", sizeStage);
    document.addEventListener("webkitfullscreenchange", sizeStage);
    window.addEventListener("resize", sizeStage);
    window.addEventListener("orientationchange", () => setTimeout(sizeStage, 120));
    if (window.visualViewport) window.visualViewport.addEventListener("resize", sizeStage);
    // Run once after layout settles (fonts/marquee height affect the calc).
    requestAnimationFrame(sizeStage);

    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyF") toggleFullscreen();
      if (e.code === "KeyM") { NR.saved.settings.sound = !NR.saved.settings.sound; this.syncSoundBtn(); NR.persist(); }
    });
    }
    syncSoundBtn() { this.soundBtn.textContent = "SOUND: " + (NR.saved.settings.sound ? "ON" : "OFF"); }

    toast(text, color) { this.toasts.push({ text, color: color || "#f4eee0", life: 1.6 }); }

    // ---- THE single shared movement entry point -----------------------
    // Keyboard, swipe, tap, on-screen buttons, and tilt (see input.js) all
    // call one of these two methods — there is exactly one place that
    // actually moves the player, however the input arrived.
    tryLaneMove(delta) {
      if (this.state !== NR.State.PLAYING || this.countdown > 0) return false;
      const moved = this.player.moveToLane(delta);
      if (moved) {
        NR.Audio.move();
        NR.Haptics.pulse("lane");
        this.particles.spawn(3, () => ({
          x: this.player.x + NR.CAR_W / 2 + (delta < 0 ? 18 : -18), y: this.player.y + 30,
          vx: delta * -40 + (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 30,
          life: 0.25, maxLife: 0.25, size: 2 + Math.random() * 1.5, color: "rgba(47,230,201,0.55)", grav: 0,
        }));
      }
      return moved;
    }
    trySetLane(lane) {
      if (this.state !== NR.State.PLAYING || this.countdown > 0) return false;
      const moved = this.player.setLane(lane);
      if (moved) { NR.Audio.move(); NR.Haptics.pulse("lane"); }
      return moved;
    }

    attemptGaragePurchase(defId) {
      const result = NR.Garage.purchase(defId);
      if (result.ok) NR.Audio.confirm();
      else NR.Audio.back(); // "maxed" or "not enough coins" — same gentle negative cue either way
      return result;
    }

    startNewRun() {
      this.player.reset();
      this.traffic.reset(NR.saved.settings.difficulty);
      this.road.reset(); this.background.reset(); this.weather.reset();
      this.progression.reset(); this.scoreMgr.reset();
      this.health.reset(); this.powerups.reset();
      this.particles.list = [];
      this._lastScoreSeen = 0; this.scorePulseTimer = 0;
      this.records = { newHighScore: false, newBestLevel: false, newBestDistance: false };
      this.newAchievements = [];
      this.toasts = [];
      this.levelBanner = null;
      this.impactIsSuccess = false;
      this.countdown = 2.6; // brief "get ready" window before traffic can hit you
      this.session = {
        survivalTime: 0, hitMaxSpeed: false, maxCombo: 1, tookDamage: false,
        nearMissCount: 0, powerupTypesCollected: new Set(),
        difficulty: NR.saved.settings.difficulty, challengeCompleted: false,
      };
      this.state = NR.State.PLAYING;
    }

    endRun() {
      this.scoreMgr.calculateFinalScore(NR.saved.settings.difficulty);
      this.records = NR.updateRecords(this.scoreMgr.score, this.progression.level, this.progression.distanceKm);
      this.lastCoinsEarned = NR.Garage.coinsForScore(this.scoreMgr.score);
      NR.saved.coins += this.lastCoinsEarned;

      const s = NR.saved.stats;
      s.gamesPlayed += 1;
      s.totalDistanceKm += this.progression.distanceKm;
      s.totalNearMisses += this.session.nearMissCount;
      s.totalOvertakes += this.scoreMgr.overtakeCount;
      s.totalPlayTimeSec += this.session.survivalTime;
      s.totalCoinsEarned += this.lastCoinsEarned;
      s.maxSpeedKmh = Math.max(s.maxSpeedKmh, Math.round(this.player.kmh));
      NR.persist();

      this.newAchievements = NR.Achievements.checkAll({
        stats: s,
        session: { ...this.session, distanceKm: this.progression.distanceKm, score: this.scoreMgr.score },
      });
      for (const a of this.newAchievements) this.toast(`ACHIEVEMENT: ${a.name}`, "#ffe14d");
      if (this.newAchievements.length) NR.Audio.levelup();

      NR.Haptics.pulse("gameover");
      this.state = NR.State.GAME_OVER;
    }

    doExit() {
      NR.Audio.back();
      // Browsers only allow scripts to close tabs/windows they themselves
      // opened; if this tab was opened normally, window.close() is silently
      // ignored — that's a browser security rule, not a bug here.
      try { window.close(); } catch (e) { /* ignored by browser, expected */ }
      this.state = NR.State.EXITED;
    }

    handleCollision(hitEnemy) {
      this.traffic.removeEnemy(hitEnemy);
      const shielded = this.powerups.isActive("shield");
      const result = this.health.takeHit(shielded);
      if (result.blocked) return; // still invulnerable from a previous hit this instant

      if (result.absorbed) {
        this.powerups.consume("shield");
        NR.Audio.confirm();
        this.toast("SHIELD ABSORBED HIT!", "#2fe6c9");
        this.screenShake = Math.max(this.screenShake, 0.22);
        return;
      }

      this.session.tookDamage = true;
      this.scoreMgr.resetCombo();
      NR.Audio.crash();
      NR.Haptics.pulse("collision");
      this.particles.spawn(14, () => ({
        x: this.player.x + NR.CAR_W / 2, y: this.player.y + 10,
        vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 300 - 60,
        life: 0.5, maxLife: 0.5, size: 2 + Math.random() * 2,
        color: Math.random() < 0.5 ? "#ffb545" : "#ff3d7a", grav: 300,
      }));

      if (result.died) {
        this.screenShake = 0.4;
        this.impactIsSuccess = false;
        this.state = NR.State.IMPACT;
        this.impactTimer = 0.5;
      } else {
        this.screenShake = 0.25;
        this.player.speedFactor = Math.max(this.player.minS, this.player.speedFactor * 0.55);
        this.toast(`HIT! ${this.health.segments}/${NR.HEALTH_MAX_SEGMENTS} HEALTH`, "#ff3d7a");
      }
    }

    // Distance Challenge target reached — a softer, celebratory version of
    // the same IMPACT->endRun transition used for a fatal crash.
    completeChallenge() {
      if (this.session.challengeCompleted) return;
      this.session.challengeCompleted = true;
      this.scoreMgr.nearMissPoints += 2000; // flat completion bonus, folded into the existing near-miss pool for simplicity
      NR.Audio.levelup();
      this.impactIsSuccess = true;
      this.state = NR.State.IMPACT;
      this.impactTimer = 1.1;
    }

    updatePlaying(dt) {
      if (NR.wasPressed("KeyP") || NR.wasPressed("Space") || NR.wasPressed("Escape")) { NR.Audio.back(); this.state = NR.State.PAUSED; return; }

      // Countdown window: background/road animate so it doesn't feel frozen,
      // but no traffic spawns and no collision can happen yet.
      if (this.countdown > 0) {
        this.countdown -= dt;
        this.background.update(dt, 0.6);
        this.road.update(dt, 0.6);
        return;
      }

      // Discrete lane movement: one key-press = one lane, regardless of how
      // long it's held (matches swipe/tap/buttons — see input.js). Braking
      // is still a held action, and there's no accelerate key: the car's
      // cruise speed rises automatically with level (see cruiseTarget below).
      if (NR.wasPressed("KeyA") || NR.wasPressed("ArrowLeft")) this.tryLaneMove(-1);
      if (NR.wasPressed("KeyD") || NR.wasPressed("ArrowRight")) this.tryLaneMove(1);
      const down = NR.keysDown.has("KeyS") || NR.keysDown.has("ArrowDown");
      const nitro = this.powerups.isActive("nitro");
      const cruiseTarget = Math.min(this.player.maxS, 1.0 + this.progression.level * 0.012);

      this.player.update(dt, down, cruiseTarget, nitro);
      this.health.update(dt);

      if ((nitro || this.player.speedFactor > 1.05) && Math.random() < 0.6) {
        const nitroColor = nitro ? (Math.random() < 0.5 ? "#ffb545" : "#ff8a3d") : "rgba(200,200,210,0.35)";
        this.particles.spawn(nitro ? 2 : 1, () => ({
          x: this.player.x + NR.CAR_W / 2 + (Math.random() - 0.5) * 8, y: this.player.y + NR.CAR_H,
          vx: (Math.random() - 0.5) * (nitro ? 40 : 20), vy: (nitro ? 170 : 110) + Math.random() * 40,
          life: 0.4, maxLife: 0.4, size: (nitro ? 3 : 2) + Math.random() * 2, color: nitroColor, grav: 0,
        }));
      }

      this.background.update(dt, this.player.speedFactor);
      this.road.update(dt, this.player.speedFactor);
      this.weather.update(dt, this.particles);
      this.particles.update(dt);

      const worldSpeedMul = this.powerups.isActive("slowmo") ? 0.45 : 1;
      this.traffic.update(dt, this.player.speedFactor, this.progression.level, this.player.bounds(), (info) => {
        this.session.nearMissCount++;
        const pts = this.scoreMgr.registerNearMiss({ speedFactor: info.speedFactor, level: this.progression.level, difficulty: NR.saved.settings.difficulty });
        NR.Audio.nearmiss();
        this.toast(`NEAR MISS +${pts} (x${this.scoreMgr.combo})`, "#2fe6c9");
      }, worldSpeedMul);
      if (this.traffic.passedCount > 0) { this.scoreMgr.addOvertakes(this.traffic.passedCount); NR.Audio.point(); }

      this.powerups.update(dt, this.player.speedFactor, this.traffic, this.player.bounds(), (type) => {
        const def = NR.POWERUP_TYPES[type];
        this.session.powerupTypesCollected.add(type);
        NR.Audio.confirm();
        NR.Haptics.pulse("pickup");
        this.toast(`${def.label}!`, def.color);
      });
      this.scoreMgr.doubleScoreActive = this.powerups.isActive("doublescore");

      const { leveledUp, milestoneHit } = this.progression.update(dt, this.player.speedFactor, NR.saved.settings.difficulty);
      this.scoreMgr.update(dt);
      this.session.survivalTime += dt;
      if (this.player.kmh >= this.player.kmhMax * 0.985) this.session.hitMaxSpeed = true;
      this.session.maxCombo = Math.max(this.session.maxCombo, this.scoreMgr.combo);
      this.scoreMgr.addSurvivalTime(dt);
      this.scoreMgr.syncDistance(this.progression.distanceKm);
      this.scoreMgr.syncLevel(this.progression.level);
      this.scoreMgr.calculateFinalScore(NR.saved.settings.difficulty);

      if (leveledUp) {
        NR.Audio.levelup();
        this.levelBanner = { level: this.progression.level, timer: 2.2, maxTimer: 2.2 };
      }
      if (milestoneHit) {
        NR.Audio.milestone();
        this.toast(`DISTANCE MILESTONE: ${milestoneHit} KM`, "#ffb545");
      }
      if (this.mode === NR.Mode.DISTANCE && this.distanceTargetKm && this.progression.distanceKm >= this.distanceTargetKm) {
        this.completeChallenge();
        return;
      }
      if (this.scoreMgr.score > this._lastScoreSeen) { this.scorePulseTimer = 0.3; this._lastScoreSeen = this.scoreMgr.score; }
      this.scorePulseTimer = Math.max(0, this.scorePulseTimer - dt);

      this.toasts = this.toasts.filter((t) => (t.life -= dt) > 0);
      if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 2.4);
      if (this.levelBanner) { this.levelBanner.timer -= dt; if (this.levelBanner.timer <= 0) this.levelBanner = null; }

      const easyForgiveness = NR.saved.settings.easyMode ? 5 : 0;
      const hitEnemy = NR.checkCollision(this.player.bounds(), this.traffic.enemies, easyForgiveness);
      if (hitEnemy) this.handleCollision(hitEnemy);
    }

    updateImpact(dt) {
      this.impactTimer -= dt;
      this.particles.update(dt);
      if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 1.6);
      if (this.impactTimer <= 0) this.endRun();
    }

    bg() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#1c1730"); g.addColorStop(1, "#100d18");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    drawScene() {
      const theme = NR.themeForLevel(this.progression.level);
      this.background.draw(theme, this.weather.label());
      this.road.draw(this.weather.label() === "RAIN");
      this.traffic.draw();
      this.powerups.draw();
      this.player.draw();
      this.particles.draw();
      this.weather.drawOverlay();
    }

    drawHUDWrapper() {
      NR.drawHUD({
        player: this.player,
        scoreMgr: this.scoreMgr,
        progression: this.progression,
        difficulty: NR.saved.settings.difficulty,
        toasts: this.toasts,
        levelBanner: this.levelBanner,
        weatherLabel: this.weather.label(),
        scorePulse: this.scorePulseTimer,
        health: this.health,
        powerups: this.powerups,
        mode: this.mode,
        distanceTargetKm: this.distanceTargetKm,
      });
    }

    loop(now) {
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      NR.currentState = this.state; // lets input.js know what the current gesture should do

      const showPauseBtn = this.state === NR.State.PLAYING || this.state === NR.State.PAUSED;
      if (this._pauseOverlayVisible !== showPauseBtn) {
        this._pauseOverlayEl.style.display = showPauseBtn ? "" : "none";
        this._pauseOverlayVisible = showPauseBtn;
      }

      ctx.save();
      if (this.screenShake > 0) {
        const s = this.screenShake * 10;
        ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      }

      switch (this.state) {
        case NR.State.MAIN_MENU: NR.Screens.mainMenu(this); break;
        case NR.State.MODE_SELECT: NR.Screens.modeSelect(this); break;
        case NR.State.DIFFICULTY: NR.Screens.difficultyMenu(this); break;
        case NR.State.SETTINGS: NR.Screens.settings(this); break;
        case NR.State.HOW_TO: NR.Screens.howTo(this); break;
        case NR.State.GARAGE: NR.Screens.garage(this); break;
        case NR.State.ACHIEVEMENTS: NR.Screens.achievements(this); break;
        case NR.State.STATS: NR.Screens.stats(this); break;
        case NR.State.PLAYING:
          this.updatePlaying(dt);
          this.drawScene(); this.drawHUDWrapper();
          NR.activeMenu = null; NR.pointerRouter = null;
          break;
        case NR.State.IMPACT:
          this.updateImpact(dt);
          this.drawScene(); this.drawHUDWrapper();
          if (this.impactIsSuccess) {
            ctx.fillStyle = `rgba(60,255,180,${0.14 + 0.1 * Math.sin(now / 40)})`;
            ctx.fillRect(0, 0, W, H);
            NR.center("TARGET REACHED!", H / 2, 18, "#2fe6c9", "'Press Start 2P', monospace");
          } else {
            ctx.fillStyle = `rgba(255,60,60,${0.18 + 0.14 * Math.sin(now / 40)})`;
            ctx.fillRect(0, 0, W, H);
            NR.center("GAME OVER", H / 2, 18, "#ff3d7a", "'Press Start 2P', monospace");
          }
          break;
        case NR.State.PAUSED: NR.Screens.pause(this); break;
        case NR.State.GAME_OVER: NR.Screens.gameOver(this); break;
        case NR.State.EXITED: NR.Screens.exited(this); break;
      }

      ctx.restore();
      NR.clearPressed();
      requestAnimationFrame(this.loop.bind(this));
    }
  }

  window.addEventListener("DOMContentLoaded", () => { new Game(); });
})(window.NR);
