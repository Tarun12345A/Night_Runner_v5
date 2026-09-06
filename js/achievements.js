// =========================================================================
// achievements.js — ~13 meaningful achievements, checked once at the end
// of each run against that run's session data plus lifetime stats
// (storage.js). Unlocked state persists in NR.saved.achievements.
// =========================================================================
(function (NR) {
  "use strict";

  const LIST = [
    { id: "first_run", name: "FIRST RUN", desc: "Play your first game.", check: (c) => c.stats.gamesPlayed >= 1 },
    { id: "road_warrior", name: "ROAD WARRIOR", desc: "Travel 10 KM in total.", check: (c) => c.stats.totalDistanceKm >= 10 },
    { id: "speed_demon", name: "SPEED DEMON", desc: "Reach your car's maximum speed.", check: (c) => c.session.hitMaxSpeed },
    { id: "near_miss_master", name: "NEAR MISS MASTER", desc: "Perform 25 near misses in total.", check: (c) => c.stats.totalNearMisses >= 25 },
    { id: "survivor", name: "SURVIVOR", desc: "Survive 5 minutes in one run.", check: (c) => c.session.survivalTime >= 300 },
    { id: "nightmare_runner", name: "NIGHTMARE RUNNER", desc: "Complete a run on Nightmare difficulty.", check: (c) => c.session.difficulty === NR.Diff.NIGHTMARE && c.session.distanceKm >= 1 },
    { id: "overtake_ace", name: "OVERTAKE ACE", desc: "Perform 50 overtakes in total.", check: (c) => c.stats.totalOvertakes >= 50 },
    { id: "score_master", name: "SCORE MASTER", desc: "Score 10,000+ points in one run.", check: (c) => c.session.score >= 10000 },
    { id: "high_roller", name: "HIGH ROLLER", desc: "Earn 500 coins in total.", check: (c) => c.stats.totalCoinsEarned >= 500 },
    { id: "combo_king", name: "COMBO KING", desc: "Reach a x5 near-miss combo.", check: (c) => c.session.maxCombo >= 5 },
    { id: "distance_champion", name: "DISTANCE CHAMPION", desc: "Complete a Distance Challenge.", check: (c) => c.session.challengeCompleted },
    { id: "untouchable", name: "UNTOUCHABLE", desc: "Survive 2+ KM without taking damage.", check: (c) => c.session.distanceKm >= 2 && !c.session.tookDamage },
    { id: "collector", name: "COLLECTOR", desc: "Collect every power-up type in one run.", check: (c) => c.session.powerupTypesCollected && c.session.powerupTypesCollected.size >= 4 },
  ];

  // Returns the list of achievement defs newly unlocked this call.
  function checkAll(context) {
    const unlocked = [];
    for (const a of LIST) {
      if (NR.saved.achievements[a.id]) continue;
      let pass = false;
      try { pass = !!a.check(context); } catch (e) { pass = false; }
      if (pass) { NR.saved.achievements[a.id] = true; unlocked.push(a); }
    }
    if (unlocked.length) NR.persist();
    return unlocked;
  }

  NR.Achievements = { LIST, checkAll };
})(window.NR);
