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
import {
  createContentRegistry, assertContentValid, installFragment, installRelic, installDisc, installDuo
} from './content_registry.js';
import { FRAGMENT_LIST, FRAGMENTS, DONORS } from './fragments.js';
import { RELIC_LIST } from './relics.js';
import { DISCS } from './content/discs.js';
import { DUO_LIST } from './duo_fragments.js';
import { stepStatuses } from './status.js';
import { createJuice } from './juice.js';
import { createFixedStepLoop } from './sim_loop.js';
import { updatePlayer, performAction, ACTION_KEYS } from './combat_player.js';
import { stepStand } from './combat_stand.js';
import { CONTROL_SCHEMES } from './stand_classes.js';
import { stepCrowd } from './combat_crowd.js';
import { createEncounter, normalizeEncounter, stepEncounter } from './encounter.js';
import { createTokenSystem } from './token.js';
import { stepHazards } from './hazards.js';
import { ARENA_MIN, FRAME_MS } from './constants.js';
import { ASPECTS, aspectAsContentDef } from './aspects.js';
import { BASE_PROFILE } from './meta_menace.js';
import { PRIORITY } from './hooks.js';

const INPUT_BUFFER_FRAMES = 9; // 150ms -- matches tech §3.6's "9-frame buffer" exactly
const TOKEN_MELEE_COUNT = 2; // GDD §16 -- 3 under Menace's Crowded condition, not implemented yet
const TOKEN_RANGED_COUNT = 1; // GDD §16 -- a separate, smaller pool; unused by Phase 5's melee-only roster

export function createCombat(enemyOrEncounterDef, ownedFragments, opts, rng) {
  opts = opts || {};
  const standDef = STANDS[opts.standId] || STANDS.star_platinum;

  /* Effect/query/content pipeline (tech §2.1/§2.2/§2.9, Phase 3) is built
     BEFORE any fighter, because a Fragment's getMaxPersistence query must
     already be registered when the player's max Persistence is resolved
     a few lines down. Phase 7: the WHOLE static Fragment pool is
     registered and validated every fight (assertContentValid), exactly
     like Phase 3 established for loadContent -- the validator runs on
     every real fight, not just fragment_check.js's standalone test --
     but only `ownedFragments` (this run's actual build, index.js's
     runState.fragmentsBySlot) is ever installed into the dispatcher.
     Being in the pool and being owned are deliberately different things
     now that Fragments are a real, chosen build instead of the prototype-
     era RUN_BUFFS every fight silently had access to. */
  const dispatcher = createDispatcher();
  const stats = createStatPipeline();
  const contentRegistry = createContentRegistry();
  DONORS.forEach(d => contentRegistry.registerDonor(d));
  FRAGMENT_LIST.forEach(f => contentRegistry.registerFragment(f));
  RELIC_LIST.forEach(r => contentRegistry.registerRelic(r));
  DISCS.forEach(d => contentRegistry.registerDisc(d));
  DUO_LIST.forEach(d => contentRegistry.registerDuo(d));
  assertContentValid(contentRegistry, dispatcher);
  (ownedFragments || []).forEach(owned => installFragment(dispatcher, FRAGMENTS[owned.id], owned.level));
  /* Phase 10: Relics/Duos are binary owned/not-owned, no slot/level (tech
     §3's own schemas never gave them one) -- opts.relics/opts.duos are
     plain arrays of owned ids, resolved against their pool the same way
     ownedFragments resolves against FRAGMENTS. opts.discs (GDD §6.4) is a
     {slot: discId} map for the three slots a Disc can occupy; a Disc
     installs its full clause set unconditionally and unleveled -- see
     content/discs.js's header for why "swap in another Stand's move" was
     scoped down to "fully overwrite this slot's behaviour". */
  const relicById = new Map(RELIC_LIST.map(r => [r.id, r]));
  const discById = new Map(DISCS.map(d => [d.id, d]));
  const duoById = new Map(DUO_LIST.map(d => [d.id, d]));
  (opts.relics || []).forEach(id => { const def = relicById.get(id); if (def) installRelic(dispatcher, def); });
  (opts.duos || []).forEach(id => { const def = duoById.get(id); if (def) installDuo(dispatcher, def); });
  Object.values(opts.discs || {}).forEach(id => { const def = discById.get(id); if (def) installDisc(dispatcher, def); });

  const player = createPlayerFighter(standDef, ARENA_MIN + 122, null, opts.assist);
  player.maxPersistence = dispatcher.runQuery('getMaxPersistence', player.maxPersistence, { entity: player });
  clampPersistence(player);
  /* No bespoke sprite per Stand yet (data.js's STANDS.<id>.tint comment) --
     a silhouette tint is the cheap generic stand-in, read by render.js's
     drawFighter (User body, already generic over f.tint) and drawStand
     (the Stand's own materialize glow). */
  player.tint = standDef.tint || null;
  /* Phase 9d: a Stand's own innate ability (Killer Queen's Bites the
     Dust utility) installs through the exact same seam a Fragment does --
     data.js names the effects, installFragment() doesn't care whether the
     def came from the reward pool or the base kit. */
  if (standDef.innateAbilities) {
    installFragment(dispatcher, { id: standDef.id + ':innate', effects: standDef.innateAbilities }, 1);
  }
  /* Phase 10 (GDD §9.1): the run's Aspect installs through that same
     seam, and that is the entire integration -- an Aspect is effects and
     queries over the existing verb vocabulary, so it needs no engine
     support of its own. Track A gates WHICH Aspects the rack offers; by
     the time one reaches here it is indistinguishable from a Fragment. */
  const aspectDef = ASPECTS[opts.aspectId];
  if (aspectDef) installFragment(dispatcher, aspectAsContentDef(aspectDef), 1);

  /* Track B (GDD §8.3), and the whole of its combat-side application.
     `menace` is meta_menace.js's frozen number struct; an empty pact
     resolves to BASE_PROFILE, whose every field is the identity, so the
     four lines below are exact no-ops for a default run.

     Killing Intent rides the ordinary getDamage query gated on the
     attacker NOT being the player -- the same choke point every Fragment
     uses, at MULTIPLY priority so it composes rather than overwrites.
     Note what is absent: nothing here touches windup frames. Sharpened
     Instinct reaches recovery only, via resolvers.js's resolvePatternFrames,
     so the spec §5.1 telegraph floor is unreachable from a pact by
     construction and not merely by the numbers happening to be small. */
  const menace = opts.menace || BASE_PROFILE;
  if (menace.enemyDamageMult !== 1) {
    dispatcher.query('getDamage', PRIORITY.MULTIPLY, (v, qctx) =>
      (qctx && qctx.isPlayerAttacker) ? v : v * menace.enemyDamageMult, 'menace');
  }
  /* Ripple Assist's third dial (GDD §21): incoming damage x0.7. Same
     getDamage seam as menace's enemyDamageMult above, composed rather than
     overwritten -- assist and Menace can both be active on the same fight. */
  if (opts.assist && opts.assist.damage) {
    dispatcher.query('getDamage', PRIORITY.MULTIPLY, (v, qctx) =>
      (qctx && qctx.isPlayerAttacker) ? v : v * 0.7, 'assist');
  }
  /* Phase 10 (Crazy Diamond donor's "return-to-position" identity, GDD
     §6.1): a fixed snapshot of the User's own starting spot, read by
     item_effect_lib.js's returnToAnchor -- no per-encounter "restore
     point" system exists otherwise, so this is the one anchor available. */
  const spawnAnchor = { x: player.x, z: player.z };
  /* Stand Class (GDD §3.4, Phase 9a): `standDef.controlScheme` picks the
     one CONTROL_SCHEMES entry that governs Step charges/damage/movement
     for this whole fight -- stamped onto the entity once here rather than
     re-resolved every frame, same pattern as maxPersistence above. */
  player.dodgeChargeMax = (CONTROL_SCHEMES[standDef.controlScheme] || CONTROL_SCHEMES.close).dodgeChargeMax;
  player.dodgeCharges = Math.min(player.dodgeCharges, player.dodgeChargeMax);
  /* The Stand (GDD §3.1, Phase 4) — a real second entity, not the render-
     only offset it was through Phase 3. Created right after the player so
     its owner link exists before anything (AI, render) can run a frame. */
  const stand = createStandFighter(player);

  const aiRng = rng.stream('ai');
  const combatRng = rng.stream('combat'); // reserved since Phase 0, now used for crit rolls (resolvers.js)
  const encounterRng = rng.stream('encounter'); // Phase 5 -- encounter_budget.js's composition draws, kept separate

  const juice = createJuice(opts.shakeEnabled, opts.reduceParticles);
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
    hazards: [], // GDD §4.6 Phase 2's "rule" (hazards.js) -- empty for every fight that never spawns one
    timeStopFrames: 0, // Phase 7 (GDD §6.1's The World donor) -- generic "the world pauses, the User doesn't" primitive
    spawnAnchor, tickSecondTimer: 60, // Phase 10 -- see spawnAnchor's own comment above and stepFrame's onCombatTick dispatch below
    menace, // read-only: ai.js passes it to resolvePatternFrames, nothing writes it
    spawnOpts: {
      hpMult: (opts.hpMult || 1) * menace.enemyHpMult, // Bloodthirst folds into the multiplier that already existed
      speedMult: opts.speedMult, tint: opts.tint, isElite: opts.isElite, menaceRank: opts.menaceRank,
      armorAll: menace.enemyArmorAll, extraEnemies: menace.extraEnemies
    },
    outcome: 'fighting', banner: '', bannerTimer: 84, // 1400ms
    log: [], pushLog: push, debug: false,
    // GDD §21 accessibility: read once by render.js's lazy createFx(); live
    // toggles go through combat._fx.setFlashEnabled/setReduceParticles.
    flashEnabled: opts.flashEnabled !== false, reduceParticles: !!opts.reduceParticles
  };

  const encounterDef = normalizeEncounter(enemyOrEncounterDef);
  combat.encounter = createEncounter(encounterDef);
  stepEncounter(combat, combat.encounter, combat.spawnOpts, encounterRng); // spawns wave 0 synchronously

  combat.enemy = combat.enemies[0];
  combat.isBoss = combat.enemies.length === 1 && !!combat.enemies[0].def.phases;
  /* Phase 9b: spawnWave already set combat.banner to an affix announcement
     (GDD §4.3's visibility contract) when wave 0 rolled any -- this only
     fills in the default label/name banner when it didn't. */
  combat.banner = combat.banner ||
    (encounterDef.label || (combat.enemies.length === 1 ? (combat.enemies[0].def.name || combat.enemies[0].def.standName) : 'MULTIPLE HOSTILES'));

  /* Edge-triggered: an action fires once per physical key-down, never on
     hold (tech audit item #1 -- dodge used to re-fire every frame it was
     held; Step's charge system is the real fix, this just keeps the input
     itself from spamming). A press made while busy is buffered instead of
     dropped (tech audit item #2 / §2.5 deliverable 3), and fires the
     instant a cancel window opens or the player returns to idle. */
  combat.setKey = (code, down) => {
    const was = keys[code];
    keys[code] = down;
    // GDD §4.7/§15: fleeing forfeits the reward, so it only exists where the encounter def opts in (Survive/the Stalker).
    if (down && !was && code === 'flee' && combat.outcome === 'fighting' && combat.encounter.def.fleeable) {
      combat.outcome = 'fled';
      return;
    }
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
    /* Phase 7's time-stop primitive (The World donor, GDD §6.1): "you act,
       the world doesn't" -- the User/Stand keep going (already stepped
       above), but the crowd (AI, tokens, projectiles, wave-spawn/win-check)
       and hazards freeze solid while this counts down. A Fragment sets it
       via a plain integer on `combat` (effect_lib.js's triggerTimeStop);
       zero effect on any fight that never touches it. */
    if (combat.timeStopFrames > 0) {
      combat.timeStopFrames -= 1;
    } else {
      stepCrowd(combat, aiRng); // tokens (GDD §16) -> every enemy's AI/attack -> wave-spawn/win-condition (encounter.js)
      stepHazards(combat); // GDD §4.6 Phase 2's "rule" -- a no-op sweep over an empty list for every other fight
    }
    combat.entities.forEach(e => {
      if (combat.timeStopFrames > 0 && e.kind === 'enemy') return; // the frozen world's own clocks stop too
      stepStatuses(e); // GDD §3.10 / tech §2.6 -- statuses are data, the engine only ticks them
    });
    /* Phase 10 (tech §3's Stone Mask example): fires once per real
       sim-second, never during time-stop (the world pausing pauses this
       too -- a Relic's periodic cost/payoff is part of "the world", not
       the User acting). */
    if (combat.timeStopFrames <= 0) {
      combat.tickSecondTimer -= 1;
      if (combat.tickSecondTimer <= 0) {
        combat.tickSecondTimer = 60;
        dispatcher.runEffect('onCombatTick', { entity: player, combat });
      }
    }
    if (player.hp <= 0 && combat.outcome === 'fighting') combat.outcome = 'lose';
  }

  const loop = createFixedStepLoop(stepFrame);
  /* Real usage (index.js's rAF loop): feed real elapsed ms, the fixed
     accumulator turns it into zero or more whole-frame steps. */
  combat.update = dtMs => { loop.advance(dtMs); };
  /* Headless/testing usage: advance exactly one frame, no wall clock. */
  combat.step = () => loop.stepOnce();
  /* Phase 13a: the fixed-step frame counter, read-only, for replay
     recording/playback (replay.js) -- neither writes it back. */
  combat.getFrame = () => loop.frame;

  return combat;
}
