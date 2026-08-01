/* Combat engine — orchestration only. Builds the player/Stand, the hook
   dispatcher and the juice system, wires input, and steps the sim's three
   per-frame systems (combat_player.js, combat_stand.js, combat_crowd.js)
   once per sim frame. All the actual frame-data/hitbox/defensive-triangle/
   AI logic lives in those files plus resolvers.js/hitbox.js/defense.js/
   poise.js/resources.js/token.js/encounter.js -- this file only ties them
   together.

   Phase 5 (GDD §4.4/§16): the arena now holds an *encounter* -- one or
   more waves of one or more enemies (encounter.js) -- instead of a single
   hardcoded enemy. `enemyOrEncounterDef` accepts either shape: a real
   encounter def, or a legacy single enemy/boss def, which
   encounter.js's normalizeEncounter() wraps into a trivial one-wave
   encounter. A boss/elite/solo fight is therefore just an N=1 crowd, not a
   separate code path -- combat.tokenSystem (token.js) and combat_crowd.js
   run over it exactly the same way, and are a no-op for it (one candidate,
   two token slots, always granted one immediately). */

import { STANDS } from './data.js';
import { createPlayerFighter, createStandFighter, clampPersistence } from './fighter.js';
import { createDispatcher } from './hooks.js';
import { createStatPipeline } from './stats.js';
import { createContentRegistry, loadContent } from './content_registry.js';
import { installRunBuffs } from './effect_lib.js';
import { stepStatuses } from './status.js';
import { createJuice } from './juice.js';
import { createFixedStepLoop } from './sim_loop.js';
import { updatePlayer, performAction, ACTION_KEYS } from './combat_player.js';
import { stepStand } from './combat_stand.js';
import { stepCrowd } from './combat_crowd.js';
import { createEncounter, normalizeEncounter, stepEncounter } from './encounter.js';
import { createTokenSystem } from './token.js';
import { ARENA_MIN, FRAME_MS } from './constants.js';

const INPUT_BUFFER_FRAMES = 9; // 150ms -- matches tech §3.6's "9-frame buffer" exactly
const TOKEN_MELEE_COUNT = 2; // GDD §16 -- 3 under Menace's Crowded condition, not implemented yet
const TOKEN_RANGED_COUNT = 1; // GDD §16 -- a separate, smaller pool; unused by Phase 5's melee-only roster

export function createCombat(enemyOrEncounterDef, runBuffs, opts, rng) {
  opts = opts || {};
  const standDef = STANDS.star_platinum;

  /* Effect/query/content pipeline (tech §2.1/§2.2/§2.9, Phase 3) is built
     BEFORE any fighter, because the run buffs' getMaxPersistence query
     (deliverable 6) must already be registered when the player's max
     Persistence is resolved a few lines down. contentRegistry is empty
     today -- no Fragment/Relic content exists yet (Phase 4+) -- but
     loadContent() still runs so the validator is exercised on every real
     fight, not just in content_check.js's standalone regression test. */
  const dispatcher = createDispatcher();
  const stats = createStatPipeline();
  installRunBuffs(dispatcher, runBuffs); // ports the 3 flat multiplier buffs off bespoke fighter.js fields
  const contentRegistry = createContentRegistry();
  loadContent(contentRegistry, dispatcher);

  const player = createPlayerFighter(standDef, ARENA_MIN + 122);
  player.maxPersistence = dispatcher.runQuery('getMaxPersistence', player.maxPersistence, { entity: player });
  clampPersistence(player);
  /* The Stand (GDD §3.1, Phase 4) — a real second entity, not the render-
     only offset it was through Phase 3. Created right after the player so
     its owner link exists before anything (AI, render) can run a frame. */
  const stand = createStandFighter(player);

  const aiRng = rng.stream('ai');
  const combatRng = rng.stream('combat'); // reserved since Phase 0, now used for crit rolls (resolvers.js)
  const encounterRng = rng.stream('encounter'); // Phase 5 -- encounter_budget.js's composition draws, kept separate

  const juice = createJuice(opts.shakeEnabled);
  const keys = {};
  function push(msg) { combat.log.unshift(msg); combat.log.length = Math.min(4, combat.log.length); }

  /* combat.entities is the arena's real entity store (tech §2.3): "the
     arena holds N entities, not player + enemy". combat.enemies (Phase 5)
     is the crowd's own entity list -- grows as later waves spawn.
     combat.enemy stays as a compat alias to enemies[0] purely for the
     boss/solo-fight-only render/HUD/sprite code (sprite_boss.js, hud.js's
     detailed single-enemy panel, index.js's tense-music check) that never
     sees more than one enemy in this phase's scope. */
  const combat = {
    player, stand, enemies: [], entities: [player, stand], juice, dispatcher, stats, keys, combatRng, encounterRng,
    tokenSystem: createTokenSystem(TOKEN_MELEE_COUNT, TOKEN_RANGED_COUNT),
    spawnOpts: { hpMult: opts.hpMult, speedMult: opts.speedMult, tint: opts.tint },
    outcome: 'fighting', banner: '', bannerTimer: 84, // 1400ms
    log: [], pushLog: push, debug: false
  };

  const encounterDef = normalizeEncounter(enemyOrEncounterDef);
  combat.encounter = createEncounter(encounterDef);
  stepEncounter(combat, combat.encounter, combat.spawnOpts, encounterRng); // spawns wave 0 synchronously

  combat.enemy = combat.enemies[0];
  combat.isBoss = combat.enemies.length === 1 && !!combat.enemies[0].def.phases;
  combat.banner = encounterDef.label ||
    (combat.enemies.length === 1 ? (combat.enemies[0].def.name || combat.enemies[0].def.standName) : 'MULTIPLE HOSTILES');

  /* Edge-triggered: an action fires once per physical key-down, never on
     hold (tech audit item #1 -- dodge used to re-fire every frame it was
     held; Step's charge system is the real fix, this just keeps the input
     itself from spamming). A press made while busy is buffered instead of
     dropped (tech audit item #2 / §2.5 deliverable 3), and fires the
     instant a cancel window opens or the player returns to idle. */
  combat.setKey = (code, down) => {
    const was = keys[code];
    keys[code] = down;
    if (down && !was && ACTION_KEYS.has(code)) {
      if (player.state === 'idle') performAction(combat, code);
      else player.bufferedAction = { kind: code, timer: INPUT_BUFFER_FRAMES };
    }
  };

  /* One whole sim frame. No canvas, no DOM, no rAF -- headless_harness.js
     drives this same function directly through combat.step(). */
  function stepFrame() {
    if (combat.outcome !== 'fighting') return;
    if (combat.bannerTimer > 0) combat.bannerTimer -= 1;
    if (juice.update(FRAME_MS)) return; // hit-stop freezes the sim; see the Phase 1 report
    stepStand(combat); // before updatePlayer so player.projecting/.strained are fresh this frame (GDD §3.2/§3.4)
    updatePlayer(combat);
    stepCrowd(combat, aiRng); // tokens (GDD §16) -> every enemy's AI/attack -> wave-spawn/win-condition (encounter.js)
    combat.entities.forEach(stepStatuses); // GDD §3.10 / tech §2.6 -- statuses are data, the engine only ticks them
    if (player.hp <= 0 && combat.outcome === 'fighting') combat.outcome = 'lose';
  }

  const loop = createFixedStepLoop(stepFrame);
  /* Real usage (index.js's rAF loop): feed real elapsed ms, the fixed
     accumulator turns it into zero or more whole-frame steps. */
  combat.update = dtMs => { loop.advance(dtMs); };
  /* Headless/testing usage: advance exactly one frame, no wall clock. */
  combat.step = () => loop.stepOnce();

  return combat;
}
