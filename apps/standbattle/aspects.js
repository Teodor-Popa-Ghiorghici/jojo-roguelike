/* Aspects — 16 of them, 4 per Stand (GDD §9.1: "12 additional Aspects, 4
   are available from the start"). An Aspect is the second half of the
   Stand rack: you pick a Stand, then you pick how that Stand *works this
   run*.

   THE RULE, and the reason this file is the payoff for Phase 3: an Aspect
   REWRITES A RULE AND NEVER ADDS A STAT. Every entry below is nothing but
   `effects`/`queries` naming verbs that already exist in effect_lib.js's
   vocabulary -- the exact same shape a Fragment uses, installed through
   the exact same seam (`installFragment`, the one data.js's
   `innateAbilities` already proved in Phase 9d). There is no Aspect code
   path in the engine, no `if (aspect === ...)` anywhere, and no field on
   an Aspect that a resolver reads. Adding the 17th is a row here.

   meta_check.js's checkAspects() enforces three things on every entry:
   the Stand exists, every verb resolves, and the union of the entry's
   verb categories is non-empty -- GDD §6.7's synergy bar, applied to
   Aspects for the same reason it is applied to Fragments. An Aspect whose
   clauses were all pure arithmetic would fail the build. */

export const ASPECT_LIST = Object.freeze([
  /* ---- STAR PLATINUM -- precision, and what precision costs ---- */
  {
    id: 'sp_ora_barrage', standId: 'star_platinum', name: 'ORA BARRAGE', baseline: true,
    desc: 'Your Light chain has no cap. Every Light past the third costs 4 Persistence.',
    tags: ['risk'], tradeoff: 'An empty Persistence bar cuts the chain dead mid-string.',
    queries: [{ hook: 'getChainCap', fn: 'removeCapForSlot', data: { slot: 'light' } }],
    effects: [{ hook: 'onHitLanded', fn: 'payResource', data: { resource: 'persistence', amount: 4, slot: 'light', atChainAtLeast: 4 } }]
  },
  {
    id: 'sp_star_finger', standId: 'star_platinum', name: 'STAR FINGER',
    desc: 'Heavy no longer lands a blow. It Breaks the two nearest enemies instead.',
    tags: ['crowd'],
    effects: [
      { hook: 'onHitResolve', fn: 'markNearestBroken', data: { slot: 'heavy', count: 2 } },
      { hook: 'onHitResolve', fn: 'cancel', data: { slot: 'heavy' } }
    ]
  },
  {
    id: 'sp_time_thief', standId: 'star_platinum', name: 'TIME THIEF',
    desc: 'A Perfect Clash stops the world for 45 frames and returns a Step charge.',
    tags: ['time', 'mobility'],
    effects: [
      { hook: 'onPerfectClash', fn: 'triggerTimeStop', data: { frames: 45 } },
      { hook: 'onPerfectClash', fn: 'refundStepCharge', data: { amount: 1 } }
    ]
  },
  {
    id: 'sp_world_echo', standId: 'star_platinum', name: 'THE WORLD ECHO',
    desc: 'Your first Special costs no Persistence. It costs 12% of your HP and pays Momentum.',
    tags: ['risk', 'time'], tradeoff: 'Every Special is paid for in blood, and blood does not regenerate.',
    queries: [{ hook: 'getPersistenceCost', fn: 'zeroCostForSlot', data: { slot: 'special_1' } }],
    effects: [{ hook: 'onMoveStart', fn: 'spendHpForResource', data: { slot: 'special_1', hpPct: 0.12, resource: 'momentum', amount: 22 } }]
  },

  /* ---- SILVER CHARIOT -- the fencer: speed traded against protection ---- */
  {
    id: 'sc_fencer', standId: 'silver_chariot', name: 'FENCER', baseline: true,
    desc: 'Every third Light applies 2 Mark. Killing anything returns a Step charge.',
    tags: ['single-target', 'mobility'],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'light', atChain: 3, status: 'mark', stacks: 2 } },
      { hook: 'onKill', fn: 'refundStepCharge', data: { amount: 1 } }
    ]
  },
  {
    id: 'sc_ricochet', standId: 'silver_chariot', name: 'RICOCHET',
    desc: 'Medium throws the target’s Mark onto the next enemy over, and Breaks them.',
    tags: ['crowd'],
    effects: [
      { hook: 'onHitResolve', fn: 'transferStatusToNearest', data: { slot: 'medium', status: 'mark', radius: 220 } },
      { hook: 'onHitResolve', fn: 'markNearestBroken', data: { slot: 'medium', count: 1 } }
    ]
  },
  {
    id: 'sc_armour_off', standId: 'silver_chariot', name: 'ARMOUR OFF',
    desc: 'Step costs 6 Persistence and stores a Charge. A landed Clash spends every Charge for Momentum.',
    tags: ['risk', 'mobility'], tradeoff: 'Stepping on an empty bar simply does not happen.',
    effects: [
      { hook: 'onStepStart', fn: 'payResource', data: { resource: 'persistence', amount: 6 } },
      { hook: 'onStepStart', fn: 'applyStatusToSelf', data: { status: 'charge', stacks: 1 } },
      { hook: 'onClashSuccess', fn: 'convertResource', data: { from: 'charge', to: 'momentum', ratio: 9 } }
    ]
  },
  {
    id: 'sc_requiem_stance', standId: 'silver_chariot', name: 'REQUIEM STANCE',
    desc: 'Heavy winds up and recovers in half the frames, and leaves Gravity on you.',
    tags: ['risk'], tradeoff: 'Gravity on yourself is the price of a Heavy nobody can react to.',
    queries: [{ hook: 'getMoveFrames', fn: 'rewriteSlotFrames', data: { slot: 'heavy', windupMult: 0.5, recoverMult: 0.5 } }],
    effects: [{ hook: 'onMoveStart', fn: 'applyStatusToSelf', data: { slot: 'heavy', status: 'gravity', stacks: 1 } }]
  },

  /* ---- HIEROPHANT GREEN -- the zoner: everything keyed to Projecting ---- */
  {
    id: 'hg_web', standId: 'hierophant_green', name: 'WEB', baseline: true,
    desc: 'Projecting Marks everything nearby. Hitting a Marked target pays 3 Persistence.',
    tags: ['projection', 'crowd'],
    effects: [
      { hook: 'onProjectStart', fn: 'applyStatusToNearby', data: { status: 'mark', stacks: 1, count: 4, radius: 200 } },
      { hook: 'onHitLanded', fn: 'grantResourceIfDefenderStatus', data: { status: 'mark', resource: 'persistence', amount: 3 } }
    ]
  },
  {
    id: 'hg_emerald_lattice', standId: 'hierophant_green', name: 'EMERALD LATTICE',
    desc: 'Over-extending the tether no longer drains you. It converts the strain into Momentum.',
    tags: ['projection'],
    effects: [
      { hook: 'onTetherStrain', fn: 'convertResource', data: { from: 'persistence', to: 'momentum', ratio: 2, max: 3 } },
      { hook: 'onTetherStrain', fn: 'cancel', data: {} }
    ]
  },
  {
    id: 'hg_barrier', standId: 'hierophant_green', name: 'BARRIER',
    desc: 'Breaking a guard Freezes everything around it and returns a Step charge.',
    tags: ['crowd', 'mobility'],
    effects: [
      { hook: 'onGuardBreak', fn: 'applyStatusToNearby', data: { status: 'frozen', stacks: 1, count: 5, radius: 130 } },
      { hook: 'onGuardBreak', fn: 'refundStepCharge', data: { amount: 1 } }
    ]
  },
  {
    id: 'hg_hierophant_trap', standId: 'hierophant_green', name: 'HIEROPHANT TRAP',
    desc: 'A kill detonates the corpse’s Marks across the crowd and pays you Momentum.',
    tags: ['crowd', 'projection'],
    effects: [
      { hook: 'onKill', fn: 'applyStatusToNearby', data: { from: 'target', status: 'mark', stacks: 2, count: 5, radius: 220 } },
      { hook: 'onKill', fn: 'grantResource', data: { resource: 'momentum', amount: 12 } }
    ]
  },

  /* ---- KILLER QUEEN -- everything is a delayed detonation ---- */
  {
    id: 'kq_detonator', standId: 'killer_queen', name: 'DETONATOR', baseline: true,
    desc: 'Medium plants a Charge. Any Heavy consumes every Charge on the target for damage.',
    tags: ['single-target'],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'medium', status: 'charge', stacks: 1 } },
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'charge', dmgPerStack: 14, persistencePerStack: 2 } }
    ]
  },
  {
    id: 'kq_third_bomb', standId: 'killer_queen', name: 'THIRD BOMB',
    desc: 'Every third hit you land goes off twice.',
    tags: ['single-target'],
    effects: [{ hook: 'onHitResolve', fn: 'echoNthHit', data: { everyN: 3, mult: 1.85 } }]
  },
  {
    id: 'kq_sheer_heart', standId: 'killer_queen', name: 'SHEER HEART ATTACK',
    desc: 'Kills leave a hunting mote behind. The motes cost you 1 HP every second.',
    tags: ['risk', 'crowd'], tradeoff: 'The clock runs against you for the whole fight, not just while a mote lives.',
    effects: [
      { hook: 'onKill', fn: 'spawnFriendlyMote', data: { at: 'target', radius: 26, lifeFrames: 900, momentumAmount: 6 } },
      { hook: 'onCombatTick', fn: 'selfDamage', data: { perSec: 1 } }
    ]
  },
  {
    id: 'kq_bites_the_dust', standId: 'killer_queen', name: 'BITES THE DUST',
    desc: 'The first lethal hit of each fight is erased, and the world stops for 90 frames.',
    tags: ['time'],
    effects: [
      { hook: 'onDamageIncoming', fn: 'preventLethalOnce', data: {} },
      { hook: 'onDamageIncoming', fn: 'triggerTimeStop', data: { frames: 90 } }
    ]
  }
]);

export const ASPECTS = Object.freeze(Object.fromEntries(ASPECT_LIST.map(a => [a.id, a])));

export function aspectsForStand(standId) {
  return ASPECT_LIST.filter(a => a.standId === standId);
}

/* The Aspect a Stand starts with when nothing has been chosen -- the
   baseline entry, which is also the one ARCHIVE_BASELINE hands out free. */
export function defaultAspectFor(standId) {
  const list = aspectsForStand(standId);
  return (list.find(a => a.baseline) || list[0] || null);
}

/* Installed exactly like data.js's innateAbilities: an Aspect def IS a
   content def as far as installFragment is concerned, so combat.js needs
   one more line and the engine needs none. */
export function aspectAsContentDef(aspect) {
  return { id: 'aspect:' + aspect.id, effects: aspect.effects || [], queries: aspect.queries || [] };
}
