// =========================================================================
// menu.js — every menu screen and its navigation. FIX (dead-end bug): the
// difficulty/settings/how-to screens used to only accept an ESC keypress to
// go back, which is unreachable on touch devices — a real dead end on
// mobile. Every screen here now has BOTH a visible, tappable BACK control
// AND ESC support, so no screen can ever trap the player.
// =========================================================================
(function (NR) {
  "use strict";
  const { ctx, H, W } = NR;

  NR.Screens = {
    mainMenu(game) {
      game.background.update(0.016, 0.4); game.road.update(0.016, 0.4);
      game.background.draw(NR.themeForLevel(1), "CLEAR NIGHT");
      game.road.draw(false);
      ctx.fillStyle = "rgba(10,8,15,0.55)"; ctx.fillRect(0, 0, W, H);
      NR.activeMenu = game.mainMenu; NR.pointerRouter = null;

      NR.center("NIGHT RUNNER", 76, 22, "#ff3d7a", "'Press Start 2P', monospace");
      NR.drawLogoBadge(W / 2, 36, 0.65);
      NR.center("SURVIVE THE NEON HIGHWAY", 104, 11, "#9a92ad");
      NR.center("BY TARUN KUMAR DEY", 122, 9, "#5a5468", "'Press Start 2P', monospace");
      NR.center(
        `BEST SCORE ${NR.saved.highScore}   ·   BEST LEVEL ${NR.saved.bestLevel}   ·   BEST DIST ${NR.saved.bestDistance.toFixed(2)}KM`,
        144, 10, "#2fe6c9"
      );
      NR.center(`COINS  ${NR.saved.coins}`, 160, 11, "#ffb545", "'Press Start 2P', monospace");

      const choice = game.mainMenu.update();
      game.mainMenu.draw(W / 2 - 100, 210, 32, 15);
      if (choice === 0) { game.state = NR.State.MODE_SELECT; game.modeMenu.index = 0; }
      else if (choice === 1) { game.state = NR.State.GARAGE; game.garageIndex = 0; }
      else if (choice === 2) game.state = NR.State.ACHIEVEMENTS;
      else if (choice === 3) game.state = NR.State.STATS;
      else if (choice === 4) game.state = NR.State.HOW_TO;
      else if (choice === 5) game.state = NR.State.SETTINGS;
      else if (choice === 6) game.doExit();
    },

    modeSelect(game) {
      game.bg(); NR.activeMenu = game.modeMenu; NR.pointerRouter = null;
      NR.center("SELECT GAME MODE", 56, 17, "#ffb545", "'Press Start 2P', monospace");
      NR.center("ENDLESS · survive as long as you can, difficulty climbs forever", 100, 10, "#9a92ad");
      NR.center("DISTANCE · reach the target KM before you crash", 118, 10, "#9a92ad");

      const choice = game.modeMenu.update();
      game.modeMenu.draw(W / 2 - 120, 168, 32, 15);
      if (choice === 0) { game.mode = NR.Mode.ENDLESS; game.distanceTargetKm = null; game.state = NR.State.DIFFICULTY; game.difficultyMenu.index = 0; }
      else if (choice >= 1 && choice <= 4) {
        game.mode = NR.Mode.DISTANCE;
        game.distanceTargetKm = NR.DISTANCE_TARGETS_KM[choice - 1];
        game.state = NR.State.DIFFICULTY; game.difficultyMenu.index = 0;
      } else if (choice === 5 || choice === -2) game.state = NR.State.MAIN_MENU;
    },

    difficultyMenu(game) {
      game.bg(); NR.activeMenu = game.difficultyMenu; NR.pointerRouter = null;
      NR.center("SELECT DIFFICULTY", 52, 17, "#ffb545", "'Press Start 2P', monospace");
      if (game.mode === NR.Mode.DISTANCE) NR.center(`DISTANCE CHALLENGE · TARGET ${game.distanceTargetKm} KM`, 74, 10, "#2fe6c9");
      NR.center("EASY · lower density, more reaction time, 1.0x score", 98, 9, "#9a92ad");
      NR.center("NORMAL · balanced traffic and speed, 1.5x score", 114, 9, "#9a92ad");
      NR.center("HARD · faster, denser, complex patterns, 2.0x score", 130, 9, "#9a92ad");
      NR.center("NIGHTMARE · relentless traffic, max speed, 3.0x score", 146, 9, "#ff3d7a");

      const choice = game.difficultyMenu.update();
      game.difficultyMenu.draw(W / 2 - 90, 190, 34, 15);
      if (choice === 0) { NR.saved.settings.difficulty = NR.Diff.EASY; NR.persist(); game.startNewRun(); }
      else if (choice === 1) { NR.saved.settings.difficulty = NR.Diff.NORMAL; NR.persist(); game.startNewRun(); }
      else if (choice === 2) { NR.saved.settings.difficulty = NR.Diff.HARD; NR.persist(); game.startNewRun(); }
      else if (choice === 3) { NR.saved.settings.difficulty = NR.Diff.NIGHTMARE; NR.persist(); game.startNewRun(); }
      else if (choice === 4 || choice === -2) game.state = NR.State.MODE_SELECT;
    },

    achievements(game) {
      game.bg(); NR.activeMenu = null;
      NR.center("ACHIEVEMENTS", 40, 16, "#ffb545", "'Press Start 2P', monospace");
      const unlockedCount = NR.Achievements.LIST.filter((a) => NR.saved.achievements[a.id]).length;
      NR.center(`${unlockedCount} / ${NR.Achievements.LIST.length} UNLOCKED`, 60, 10, "#2fe6c9");

      let y = 92;
      for (const a of NR.Achievements.LIST) {
        const unlocked = !!NR.saved.achievements[a.id];
        ctx.textAlign = "left";
        ctx.font = "11px 'Space Mono', monospace";
        ctx.fillStyle = unlocked ? "#ffe14d" : "#5a5468";
        ctx.fillText((unlocked ? "\u2605 " : "\u2606 ") + a.name, W / 2 - 190, y);
        ctx.font = "9px 'Space Mono', monospace";
        ctx.fillStyle = unlocked ? "#9a92ad" : "#454052";
        ctx.fillText(a.desc, W / 2 - 190, y + 14);
        y += 32;
      }

      const backBox = NR.drawBackButton();
      NR.pointerRouter = { move: () => {}, down: (px, py) => { if (px >= backBox.x && px <= backBox.x + backBox.w && py >= backBox.y && py <= backBox.y + backBox.h) { NR.Audio.back(); game.state = NR.State.MAIN_MENU; } } };
      if (NR.wasPressed("Escape") || NR.wasPressed("Enter")) { NR.Audio.back(); game.state = NR.State.MAIN_MENU; }
    },

    stats(game) {
      game.bg(); NR.activeMenu = null;
      NR.center("STATISTICS", 46, 16, "#ffb545", "'Press Start 2P', monospace");
      const s = NR.saved.stats;
      const mins = Math.floor(s.totalPlayTimeSec / 60), secs = Math.floor(s.totalPlayTimeSec % 60);
      const rows = [
        ["GAMES PLAYED", s.gamesPlayed],
        ["TOTAL DISTANCE", `${s.totalDistanceKm.toFixed(2)} KM`],
        ["BEST DISTANCE", `${NR.saved.bestDistance.toFixed(2)} KM`],
        ["BEST SCORE", NR.saved.highScore],
        ["BEST LEVEL", NR.saved.bestLevel],
        ["TOTAL NEAR MISSES", s.totalNearMisses],
        ["TOTAL OVERTAKES", s.totalOvertakes],
        ["MAX SPEED REACHED", `${s.maxSpeedKmh} km/h`],
        ["TOTAL COINS EARNED", s.totalCoinsEarned],
        ["TOTAL PLAY TIME", `${mins}m ${secs}s`],
      ];
      let y = 92;
      for (const [label, value] of rows) {
        ctx.textAlign = "left"; ctx.font = "12px 'Space Mono', monospace"; ctx.fillStyle = "#9a92ad";
        ctx.fillText(label, W / 2 - 170, y);
        ctx.textAlign = "right"; ctx.fillStyle = "#f4eee0";
        ctx.fillText(String(value), W / 2 + 170, y);
        y += 30;
      }
      ctx.textAlign = "left";

      const backBox = NR.drawBackButton();
      NR.pointerRouter = { move: () => {}, down: (px, py) => { if (px >= backBox.x && px <= backBox.x + backBox.w && py >= backBox.y && py <= backBox.y + backBox.h) { NR.Audio.back(); game.state = NR.State.MAIN_MENU; } } };
      if (NR.wasPressed("Escape") || NR.wasPressed("Enter")) { NR.Audio.back(); game.state = NR.State.MAIN_MENU; }
    },

    settings(game) {
      game.bg(); NR.activeMenu = null;
      NR.center("SETTINGS", 50, 18, "#ffb545", "'Press Start 2P', monospace");
      const fields = [
        { label: "Sound", get: () => NR.saved.settings.sound ? "ON" : "OFF", cycle: () => { NR.saved.settings.sound = !NR.saved.settings.sound; game.syncSoundBtn(); } },
        { label: "Difficulty", get: () => NR.saved.settings.difficulty, cycle: () => { const order = [NR.Diff.EASY, NR.Diff.NORMAL, NR.Diff.HARD, NR.Diff.NIGHTMARE]; NR.saved.settings.difficulty = order[(order.indexOf(NR.saved.settings.difficulty) + 1) % order.length]; } },
        { label: "Weather Effects", get: () => NR.saved.settings.weatherEffects ? "ON" : "OFF", cycle: () => { NR.saved.settings.weatherEffects = !NR.saved.settings.weatherEffects; } },
        { label: "Control Mode", get: () => NR.saved.settings.controlMode.toUpperCase(), cycle: () => { const order = ["swipe", "tap", "buttons", "tilt"]; NR.saved.settings.controlMode = order[(order.indexOf(NR.saved.settings.controlMode) + 1) % order.length]; NR.Input.refreshControlModeUI(); } },
        { label: "Swipe Sensitivity", get: () => NR.saved.settings.swipeSensitivity.toUpperCase(), cycle: () => { const order = ["low", "medium", "high"]; NR.saved.settings.swipeSensitivity = order[(order.indexOf(NR.saved.settings.swipeSensitivity) + 1) % order.length]; } },
        { label: "Haptic Feedback", get: () => NR.saved.settings.haptics ? "ON" : "OFF", cycle: () => { NR.saved.settings.haptics = !NR.saved.settings.haptics; if (NR.saved.settings.haptics) NR.Haptics.pulse("lane"); } },
        { label: "Easy Control Mode", get: () => NR.saved.settings.easyMode ? "ON" : "OFF", cycle: () => { NR.saved.settings.easyMode = !NR.saved.settings.easyMode; } },
      ];
      const rowH = 42, startY = 130; const hitboxes = [];
      fields.forEach((f, i) => {
        const y = startY + i * rowH; const hovered = i === game.settingsIndex;
        ctx.textAlign = "left"; ctx.font = "14px 'Space Mono', monospace";
        ctx.fillStyle = hovered ? "#ffb545" : "#f4eee0";
        ctx.fillText((hovered ? "▶ " : "  ") + f.label, W / 2 - 170, y);
        ctx.fillStyle = "#2fe6c9"; ctx.fillText(f.get(), W / 2 + 70, y);
        hitboxes.push({ x: W / 2 - 180, y: y - 16, w: 350, h: rowH - 4, i });
      });
      NR.center("↑/↓ select · Enter/click to change · Esc or BACK to return", H - 56, 10, "#9a92ad");
      const backBox = NR.drawBackButton();

      NR.pointerRouter = {
        move: (px, py) => { for (const hb of hitboxes) if (px >= hb.x && px <= hb.x + hb.w && py >= hb.y && py <= hb.y + hb.h) { game.settingsIndex = hb.i; break; } },
        down: (px, py) => {
          if (px >= backBox.x && px <= backBox.x + backBox.w && py >= backBox.y && py <= backBox.y + backBox.h) { NR.Audio.back(); game.state = NR.State.MAIN_MENU; return; }
          for (const hb of hitboxes) if (px >= hb.x && px <= hb.x + hb.w && py >= hb.y && py <= hb.y + hb.h) { fields[hb.i].cycle(); NR.Audio.confirm(); NR.persist(); break; }
        },
      };
      if (NR.wasPressed("ArrowDown") || NR.wasPressed("KeyS")) { game.settingsIndex = (game.settingsIndex + 1) % fields.length; NR.Audio.move(); }
      if (NR.wasPressed("ArrowUp") || NR.wasPressed("KeyW")) { game.settingsIndex = (game.settingsIndex - 1 + fields.length) % fields.length; NR.Audio.move(); }
      if (NR.wasPressed("Enter") || NR.wasPressed("Space")) { fields[game.settingsIndex].cycle(); NR.Audio.confirm(); NR.persist(); }
      if (NR.wasPressed("Escape")) { NR.Audio.back(); game.state = NR.State.MAIN_MENU; }
    },

    howTo(game) {
      game.bg(); NR.activeMenu = null;
      NR.center("HOW TO PLAY", 46, 15, "#ffb545", "'Press Start 2P', monospace");
      const rows = [
        ["<- / A", "Move Left"], ["-> / D", "Move Right"], ["down / S", "Brake"],
        ["Space / P", "Pause / Resume"], ["M", "Toggle Sound"], ["F", "Toggle Fullscreen"], ["Esc", "Pause / Back"],
      ];
      let y = 92; ctx.textAlign = "left";
      for (const [k, a] of rows) {
        ctx.fillStyle = "#2fe6c9"; ctx.font = "bold 13px 'Space Mono', monospace"; ctx.fillText(k, W / 2 - 150, y);
        ctx.fillStyle = "#f4eee0"; ctx.font = "13px 'Space Mono', monospace"; ctx.fillText(a, W / 2 + 10, y);
        y += 24;
      }
      NR.center("Dodge traffic waves, chain near misses for a combo multiplier,", y + 14, 10, "#9a92ad");
      NR.center("collect NITRO / SHIELD / SLOW-MO / 2X SCORE power-ups, and climb", y + 29, 10, "#9a92ad");
      NR.center("from Level 1 to Level 99. You have 3 health — a hit costs one,", y + 44, 10, "#9a92ad");
      NR.center("not an instant game over. Earn coins to upgrade your car in the", y + 59, 10, "#9a92ad");
      NR.center("GARAGE. Your car drives forward automatically — no accelerator", y + 74, 10, "#9a92ad");
      NR.center("needed. On touch: swipe left/right to change lanes (default —", y + 89, 10, "#9a92ad");
      NR.center("Tap/Buttons/Tilt modes available in Settings), swipe/tap down to brake.", y + 104, 10, "#9a92ad");
      NR.center("press Esc / Enter, or tap BACK, to return", y + 126, 10, "#9a92ad");
      const backBox = NR.drawBackButton();
      NR.pointerRouter = {
        move: () => {},
        down: (px, py) => { if (px >= backBox.x && px <= backBox.x + backBox.w && py >= backBox.y && py <= backBox.y + backBox.h) { NR.Audio.back(); game.state = NR.State.MAIN_MENU; } },
      };
      if (NR.wasPressed("Escape") || NR.wasPressed("Enter")) { NR.Audio.back(); game.state = NR.State.MAIN_MENU; }
    },

    garage(game) {
      game.bg(); NR.activeMenu = null;
      const G = NR.Garage;
      NR.center("GARAGE", 42, 18, "#ffb545", "'Press Start 2P', monospace");
      NR.center(`COINS  ${NR.saved.coins}`, 66, 12, "#ffe14d", "'Press Start 2P', monospace");

      // Car preview.
      const carColor = G.colorHex(NR.saved.carColor);
      NR.drawCar(W / 2 - 22, 84, 44, 76, carColor, "#e6fffa", false);

      // ---- color row ----
      const colorY = 196, swatchR = 15, gap = 46;
      const totalW = (G.CAR_COLORS.length - 1) * gap;
      const startX = W / 2 - totalW / 2;
      const currentColorIdx = G.CAR_COLORS.findIndex((c) => c.id === NR.saved.carColor);
      NR.center("CAR COLOR", colorY - 26, 10, game.garageIndex === 0 ? "#ffb545" : "#9a92ad");
      const colorHitboxes = [];
      G.CAR_COLORS.forEach((c, i) => {
        const cx = startX + i * gap;
        ctx.beginPath(); ctx.arc(cx, colorY, swatchR, 0, Math.PI * 2);
        ctx.fillStyle = c.hex; ctx.fill();
        if (i === currentColorIdx) {
          ctx.lineWidth = 3; ctx.strokeStyle = "#f4eee0";
          ctx.beginPath(); ctx.arc(cx, colorY, swatchR + 5, 0, Math.PI * 2); ctx.stroke();
        } else if (game.garageIndex === 0 && i === game._garageColorHover) {
          ctx.lineWidth = 2; ctx.strokeStyle = "#ffb545";
          ctx.beginPath(); ctx.arc(cx, colorY, swatchR + 5, 0, Math.PI * 2); ctx.stroke();
        }
        colorHitboxes.push({ x: cx - swatchR - 6, y: colorY - swatchR - 6, w: (swatchR + 6) * 2, h: (swatchR + 6) * 2, i });
      });

      // ---- upgrade rows ----
      const rowY0 = 250, rowH = 56;
      const upgradeHitboxes = [];
      G.UPGRADE_DEFS.forEach((def, i) => {
        const y = rowY0 + i * rowH;
        const level = NR.saved.upgrades[def.id] || 0;
        const rowSelected = game.garageIndex === i + 1;
        ctx.textAlign = "left"; ctx.font = "12px 'Space Mono', monospace";
        ctx.fillStyle = rowSelected ? "#ffb545" : "#f4eee0";
        ctx.fillText((rowSelected ? "▶ " : "   ") + def.label, W / 2 - 170, y);
        ctx.font = "9px 'Space Mono', monospace"; ctx.fillStyle = "#9a92ad";
        ctx.fillText(def.desc, W / 2 - 170, y + 15);

        // level pips
        const pipsX = W / 2 + 70;
        for (let p = 0; p < def.maxLevel; p++) {
          ctx.beginPath(); ctx.arc(pipsX + p * 14, y - 4, 4, 0, Math.PI * 2);
          ctx.fillStyle = p < level ? "#2fe6c9" : "rgba(154,146,173,0.3)"; ctx.fill();
        }

        const cost = G.costFor(def, level);
        ctx.font = "10px 'Space Mono', monospace";
        if (cost === null) { ctx.fillStyle = "#5ac878"; ctx.fillText("MAXED", pipsX, y + 15); }
        else {
          const afford = NR.saved.coins >= cost;
          ctx.fillStyle = afford ? "#ffe14d" : "#ff3d7a";
          ctx.fillText(`UPGRADE: ${cost}c`, pipsX, y + 15);
        }
        upgradeHitboxes.push({ x: W / 2 - 180, y: y - 16, w: 380, h: rowH - 6, i });
      });

      const backBox = NR.drawBackButton();
      NR.center("↑/↓ select · ←/→ change color · Enter to buy · Esc/BACK to return", H - 56, 9, "#9a92ad");

      NR.pointerRouter = {
        move: (px, py) => {
          game._garageColorHover = -1;
          for (const hb of colorHitboxes) if (px >= hb.x && px <= hb.x + hb.w && py >= hb.y && py <= hb.y + hb.h) { game._garageColorHover = hb.i; break; }
        },
        down: (px, py) => {
          if (px >= backBox.x && px <= backBox.x + backBox.w && py >= backBox.y && py <= backBox.y + backBox.h) { NR.Audio.back(); game.state = NR.State.MAIN_MENU; return; }
          for (const hb of colorHitboxes) {
            if (px >= hb.x && px <= hb.x + hb.w && py >= hb.y && py <= hb.y + hb.h) {
              NR.saved.carColor = G.CAR_COLORS[hb.i].id; NR.persist(); NR.Audio.move(); game.garageIndex = 0; return;
            }
          }
          for (const hb of upgradeHitboxes) {
            if (px >= hb.x && px <= hb.x + hb.w && py >= hb.y && py <= hb.y + hb.h) {
              game.garageIndex = hb.i + 1;
              game.attemptGaragePurchase(G.UPGRADE_DEFS[hb.i].id);
              return;
            }
          }
        },
      };

      const rowCount = G.UPGRADE_DEFS.length + 1; // color row + upgrade rows
      if (NR.wasPressed("ArrowDown") || NR.wasPressed("KeyS")) { game.garageIndex = (game.garageIndex + 1) % rowCount; NR.Audio.move(); }
      if (NR.wasPressed("ArrowUp") || NR.wasPressed("KeyW")) { game.garageIndex = (game.garageIndex - 1 + rowCount) % rowCount; NR.Audio.move(); }
      if (game.garageIndex === 0 && (NR.wasPressed("ArrowRight") || NR.wasPressed("ArrowLeft"))) {
        const dir = NR.wasPressed("ArrowRight") ? 1 : -1;
        const next = (currentColorIdx + dir + G.CAR_COLORS.length) % G.CAR_COLORS.length;
        NR.saved.carColor = G.CAR_COLORS[next].id; NR.persist(); NR.Audio.move();
      }
      if (NR.wasPressed("Enter") || NR.wasPressed("Space")) {
        if (game.garageIndex >= 1) game.attemptGaragePurchase(G.UPGRADE_DEFS[game.garageIndex - 1].id);
      }
      if (NR.wasPressed("Escape")) { NR.Audio.back(); game.state = NR.State.MAIN_MENU; }
    },

    pause(game) {
      game.drawScene(); game.drawHUDWrapper();
      ctx.fillStyle = "rgba(10,8,15,0.72)"; ctx.fillRect(0, 0, W, H);
      NR.activeMenu = game.pauseMenu; NR.pointerRouter = null;
      NR.center("GAME PAUSED", 180, 18, "#ffb545", "'Press Start 2P', monospace");
      if (NR.wasPressed("KeyP") || NR.wasPressed("Space")) { NR.Audio.confirm(); game.state = NR.State.PLAYING; return; }
      const choice = game.pauseMenu.update();
      game.pauseMenu.draw(W / 2 - 76, 250, 34, 15);
      if (choice === 0 || choice === -2) game.state = NR.State.PLAYING;
      else if (choice === 1) game.startNewRun(NR.saved.settings.difficulty);
      else if (choice === 2) game.state = NR.State.MAIN_MENU;
      else if (choice === 3) game.doExit();
    },

    gameOver(game) {
      game.bg(); NR.activeMenu = game.gameOverMenu; NR.pointerRouter = null;
      const success = game.session && game.session.challengeCompleted;
      NR.center(success ? "TARGET REACHED!" : "GAME OVER", 46, 18, success ? "#2fe6c9" : "#ff3d7a", "'Press Start 2P', monospace");
      let y = 82;
      if (game.records.newHighScore) { NR.center("NEW HIGH SCORE!", y, 11, "#ffe14d", "'Press Start 2P', monospace"); y += 20; }
      if (game.records.newBestLevel) { NR.center("NEW BEST LEVEL!", y, 10, "#ffb545"); y += 18; }
      if (game.records.newBestDistance) { NR.center("NEW BEST DISTANCE!", y, 10, "#2fe6c9"); y += 18; }
      for (const a of game.newAchievements) { NR.center(`ACHIEVEMENT: ${a.name}`, y, 10, "#ffe14d"); y += 18; }
      y += 4;
      const rows = [
        ["FINAL SCORE ", game.scoreMgr.score],
        ["LEVEL REACHED ", game.progression.level],
        ["DISTANCE ", `${game.progression.distanceKm.toFixed(2)} KM`],
        ["NEAR MISSES ", game.session ? game.session.nearMissCount : 0],
        ["OVERTAKES ", game.scoreMgr.overtakeCount],
        ["MAX COMBO ", `x${game.session ? game.session.maxCombo : 1}`],
        ["COINS EARNED ", `+${game.lastCoinsEarned}`],
        ["BEST SCORE ", NR.saved.highScore],
      ];
      for (const [label, value] of rows) { NR.center(`${label}${value}`, y, 10, "#f4eee0"); y += 17; }
      const choice = game.gameOverMenu.update();
      game.gameOverMenu.draw(W / 2 - 80, y + 14, 28, 13);
      if (choice === 0) { game.state = NR.State.MODE_SELECT; game.modeMenu.index = 0; }
      else if (choice === 1 || choice === -2) game.state = NR.State.MAIN_MENU;
      else if (choice === 2) game.doExit();
    },

    exited(game) {
      game.bg(); NR.activeMenu = game.exitMenu; NR.pointerRouter = null;
      NR.center("THANKS FOR PLAYING", 200, 16, "#ffb545", "'Press Start 2P', monospace");
      NR.center("NIGHT RUNNER", 236, 20, "#ff3d7a", "'Press Start 2P', monospace");
      NR.center("You can close this browser tab now.", 280, 12, "#9a92ad");
      NR.center("(Some browsers don't allow pages to close themselves —", 300, 10, "#5a5468");
      NR.center("if this tab is still open, that's why.)", 314, 10, "#5a5468");
      const choice = game.exitMenu.update();
      game.exitMenu.draw(W / 2 - 90, 360, 30, 15);
      if (choice === 0 || choice === -2) game.state = NR.State.MAIN_MENU;
    },
  };
})(window.NR);
