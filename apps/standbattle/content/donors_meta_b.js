/* Meta donor pool B — White Album (Ghiaccio), Harvest (Shigechi) and
   Highway Star (Yuya). Companion file to donors_meta_a.js (split only for
   the repo's 300-line cap); same discipline -- no new verb, no engine
   branch, every entry composed from the merged EFFECT_LIB/QUERY_LIB and
   cleared through content_registry.js's GDD §6.7 synergy union.

   White Album is the ice donor: Frozen is a boolean refresh status
   (status.js) so its Fragments plant it, amplify against it, or shatter it
   for a payoff, never stack it. Harvest is the economy donor -- a thousand
   tiny hands means Persistence/Momentum conversion and friendly motes, the
   deliberate non-damage axis GDD §6.1 asks for so builds don't converge.
   Highway Star is the pursuit donor: Mark to track, drain to feed, and
   two 'risk' entries whose HP cost is stated at pickup per spec §6.3. */

export const DONORS_META_B = ['white_album', 'harvest', 'highway_star'];

export const FRAGMENTS_META_B = [
  /* ---- White Album — absolute zero, defensive ice ------------------------- */
  { id: 'frag_white_album_light', donor: 'white_album', slot: 'light',
    name: 'Frostbite Jab', rarity: 'common', tags: ['crowd'],
    levelDesc: [
      'Your 3rd Light in a string Freezes its target. Frozen enemies take 15% more damage from you.',
      'Your 2nd Light in a string Freezes its target. Frozen enemies take 25% more damage from you.',
      'Every Light Freezes its target. Frozen enemies take 40% more damage from you, and your Light chain has no cap.'],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'light', status: 'frozen', atChain: [3, 2, null] } }],
    queries: [
      { hook: 'getDamage', fn: 'bonusIfDefenderStatus', data: { status: 'frozen', minStacks: 1, mult: [1.15, 1.25, 1.4] } },
      { hook: 'getChainCap', fn: 'removeCapForSlot', minLevel: 3, data: { slot: 'light' } }] },

  { id: 'frag_white_album_medium', donor: 'white_album', slot: 'medium',
    name: 'Shatter', rarity: 'rare', tags: ['single-target', 'economy'],
    levelDesc: [
      'Medium shatters the ice: consumes Frozen for +12 damage and +3 Persistence.',
      'Medium shatters the ice: consumes Frozen for +20 damage and +5 Persistence.',
      'Medium shatters the ice: consumes Frozen for +32 damage and +7 Persistence, then re-freezes the target in the same breath.'],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'frozen', dmgPerStack: [12, 20, 32], persistencePerStack: [3, 5, 7] } },
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', minLevel: 3, data: { slot: 'medium', status: 'frozen' } }] },

  { id: 'frag_white_album_heavy', donor: 'white_album', slot: 'heavy',
    name: 'Gently Weeps', rarity: 'epic', tags: ['crowd'],
    levelDesc: [
      'Heavy hits Freeze the nearest enemy and chill 4 damage into them.',
      'Heavy hits Freeze the 2 nearest enemies and chill 7 damage into them.',
      'Heavy hits Freeze the 3 nearest enemies and chill 12 damage into them.'],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'frozen', count: [1, 2, 3], radius: [70, 85, 100] } },
      { hook: 'onHitLanded', fn: 'damageNearby', data: { amount: [4, 7, 12], count: [1, 2, 3], radius: [70, 85, 100] } }] },

  { id: 'frag_white_album_special_1', donor: 'white_album', slot: 'special_1',
    name: 'Absolute Zero', rarity: 'legendary', tags: ['crowd'],
    levelDesc: [
      'Special hits drop the temperature: the 2 nearest enemies Freeze solid.',
      'Special hits drop the temperature: the 3 nearest enemies Freeze solid.',
      'Special hits drop the temperature: the 5 nearest enemies Freeze solid, and Frozen enemies take 35% more poise damage.'],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'frozen', count: [2, 3, 5], radius: [90, 105, 125] } }],
    queries: [
      { hook: 'getPoiseDamage', fn: 'bonusIfDefenderStatus', minLevel: 3, data: { status: 'frozen', minStacks: 1, mult: 1.35 } }] },

  { id: 'frag_white_album_step', donor: 'white_album', slot: 'step',
    name: 'Ice Trail', rarity: 'common', tags: ['mobility', 'crowd'],
    levelDesc: [
      'Stepping Freezes the nearest enemy in the wake of the cold.',
      'Stepping Freezes the 2 nearest enemies in the wake of the cold.',
      'Stepping Freezes the 3 nearest enemies and refunds the charge you spent.'],
    effects: [
      { hook: 'onStepStart', fn: 'applyStatusToNearby', data: { status: 'frozen', count: [1, 2, 3], radius: [50, 65, 80] } },
      { hook: 'onStepStart', fn: 'refundStepCharge', minLevel: 3, data: { amount: 1 } }] },

  { id: 'frag_white_album_clash', donor: 'white_album', slot: 'clash',
    name: 'Frozen Guard', rarity: 'rare', tags: ['single-target'],
    levelDesc: [
      'A successful Clash Freezes your opponent.',
      'A successful Clash Freezes your opponent, and 15% of any damage you take is returned as frostburn.',
      'A successful Clash Freezes your opponent, 25% of damage taken is returned as frostburn, and a Perfect Clash Freezes the 3 nearest enemies.'],
    effects: [
      { hook: 'onClashSuccess', fn: 'applyStatusToNearby', data: { status: 'frozen', count: 1, radius: 60 } },
      { hook: 'onDamageTaken', fn: 'reflectPctDamageToAttacker', minLevel: 2, data: { pct: [0, 0.15, 0.25] } },
      { hook: 'onPerfectClash', fn: 'applyStatusToNearby', minLevel: 3, data: { status: 'frozen', count: 3, radius: 95 } }] },

  { id: 'frag_white_album_aura', donor: 'white_album', slot: 'aura',
    name: 'Zero Shell', rarity: 'legendary', tags: ['risk', 'crowd'],
    tradeoff: 'The shell is colder than you are: you lose 1 HP per second of every fight (2 at level 3).',
    levelDesc: [
      'A freezing shell surrounds you: 20% of damage taken is reflected back. It costs you 1 HP per second.',
      'A freezing shell surrounds you: 30% of damage taken is reflected back. It costs you 1 HP per second.',
      'A freezing shell surrounds you: 45% of damage taken is reflected back and every hit you land Freezes. It costs you 2 HP per second.'],
    effects: [
      { hook: 'onDamageTaken', fn: 'reflectPctDamageToAttacker', data: { pct: [0.2, 0.3, 0.45] } },
      { hook: 'onCombatTick', fn: 'selfDamage', data: { perSec: [1, 1, 2] } },
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', minLevel: 3, data: { status: 'frozen' } }] },

  /* ---- Harvest — a thousand tiny hands, scavenging and economy ------------ */
  { id: 'frag_harvest_light', donor: 'harvest', slot: 'light',
    name: 'Pickpocket', rarity: 'common', tags: ['economy'],
    levelDesc: [
      'Every Light hit scavenges 2 Persistence off the target.',
      'Every Light hit scavenges 4 Persistence off the target.',
      'Every Light hit scavenges 6 Persistence and 4 Momentum, and your Light chain has no cap.'],
    effects: [
      { hook: 'onHitLanded', fn: 'grantResource', data: { slot: 'light', resource: 'persistence', amount: [2, 4, 6] } },
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 3, data: { slot: 'light', resource: 'momentum', amount: 4 } }],
    queries: [
      { hook: 'getChainCap', fn: 'removeCapForSlot', minLevel: 3, data: { slot: 'light' } }] },

  { id: 'frag_harvest_medium', donor: 'harvest', slot: 'medium',
    name: 'Scavenged Strike', rarity: 'rare', tags: ['economy'],
    levelDesc: [
      'Landing a Medium melts 6 Momentum down into Persistence at 1:1.',
      'Landing a Medium melts 10 Momentum down into 1.5x Persistence.',
      'Landing a Medium melts 14 Momentum down into double Persistence, and Marks the target so the hands know where to go next.'],
    effects: [
      { hook: 'onHitLanded', fn: 'convertResource', data: { from: 'momentum', to: 'persistence', ratio: [1, 1.5, 2], max: [6, 10, 14] } },
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', minLevel: 3, data: { slot: 'medium', status: 'mark' } }] },

  { id: 'frag_harvest_special_1', donor: 'harvest', slot: 'special_1',
    name: 'Swarm Gather', rarity: 'epic', tags: ['crowd', 'economy'],
    levelDesc: [
      'Special hits leave a scavenged mote worth 4 HP where the target stood.',
      'Special hits leave a mote worth 6 HP and 10 Momentum, and grant 5 Persistence.',
      'Special hits leave a mote worth 10 HP and 16 Momentum, and grant 9 Persistence.'],
    effects: [
      { hook: 'onHitLanded', fn: 'spawnFriendlyMote', data: { healAmount: [4, 6, 10], momentumAmount: [0, 10, 16], radius: 20 } },
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 2, data: { slot: 'special_1', resource: 'persistence', amount: [0, 5, 9] } }] },

  { id: 'frag_harvest_special_2', donor: 'harvest', slot: 'special_2',
    name: 'A Thousand Hands', rarity: 'legendary', tags: ['crowd', 'economy'],
    levelDesc: [
      'Special 2 swarms the field: Marks the 3 nearest enemies, strips 6 damage off each, and brings back 8 Persistence.',
      'Special 2 swarms the field: Marks the 4 nearest enemies, strips 10 damage off each, and brings back 13 Persistence.',
      'Special 2 swarms the field: Marks the 6 nearest enemies, strips 16 damage off each, and brings back 20 Persistence and 12 Momentum.'],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'mark', count: [3, 4, 6], radius: 110 } },
      { hook: 'onHitLanded', fn: 'damageNearby', data: { amount: [6, 10, 16], count: [3, 4, 6], radius: 110 } },
      { hook: 'onHitLanded', fn: 'grantResource', data: { slot: 'special_2', resource: 'persistence', amount: [8, 13, 20] } },
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 3, data: { slot: 'special_2', resource: 'momentum', amount: 12 } }] },

  { id: 'frag_harvest_rush', donor: 'harvest', slot: 'rush',
    name: 'Gleaning Rush', rarity: 'epic', tags: ['economy', 'heal'],
    levelDesc: [
      'The swarm brings back 10% of all damage you deal as HP.',
      'The swarm brings back 16% of all damage you deal as HP, and Rush hits grant 5 Momentum.',
      'The swarm brings back 25% of all damage you deal as HP, and Rush hits grant 9 Momentum.'],
    effects: [
      { hook: 'onHitResolve', fn: 'healPctOfDamage', data: { pct: [0.1, 0.16, 0.25] } },
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 2, data: { slot: 'rush', resource: 'momentum', amount: [0, 5, 9] } }] },

  { id: 'frag_harvest_step', donor: 'harvest', slot: 'step',
    name: 'Quick Fingers', rarity: 'common', tags: ['mobility', 'economy'],
    levelDesc: [
      'Stepping sends the hands out: 5 Persistence back.',
      'Stepping sends the hands out: 9 Persistence and 6 Momentum back.',
      'Stepping sends the hands out: 14 Persistence, 10 Momentum, and the charge you spent is refunded.'],
    effects: [
      { hook: 'onStepStart', fn: 'grantResource', data: { resource: 'persistence', amount: [5, 9, 14] } },
      { hook: 'onStepStart', fn: 'grantResource', minLevel: 2, data: { resource: 'momentum', amount: [0, 6, 10] } },
      { hook: 'onStepStart', fn: 'refundStepCharge', minLevel: 3, data: { amount: 1 } }] },

  { id: 'frag_harvest_aura', donor: 'harvest', slot: 'aura',
    name: 'Everything Has a Price', rarity: 'legendary', tags: ['economy', 'risk'],
    tradeoff: 'Every move you start spends 3% of your current HP (5% at level 3). It can never kill you, but it never stops either.',
    levelDesc: [
      'Starting any move pays 3% of current HP and buys 8 Persistence. Kills refund 6 Persistence.',
      'Starting any move pays 3% of current HP and buys 13 Persistence. Kills refund 11 Persistence.',
      'Starting any move pays 5% of current HP and buys 20 Persistence. Kills refund 18 Persistence and 10 Momentum.'],
    effects: [
      { hook: 'onMoveStart', fn: 'spendHpForResource', data: { hpPct: [0.03, 0.03, 0.05], resource: 'persistence', amount: [8, 13, 20] } },
      { hook: 'onKill', fn: 'grantResource', data: { resource: 'persistence', amount: [6, 11, 18] } },
      { hook: 'onKill', fn: 'grantResource', minLevel: 3, data: { resource: 'momentum', amount: 10 } }] },

  /* ---- Highway Star — relentless pursuit, drains what it catches ---------- */
  { id: 'frag_highway_star_light', donor: 'highway_star', slot: 'light',
    name: 'Sapping Touch', rarity: 'common', tags: ['single-target', 'heal'],
    levelDesc: [
      'Light hits Mark their target, and you drain 5% of all damage dealt as HP.',
      'Light hits Mark their target, and you drain 9% of all damage dealt as HP.',
      'Light hits Mark their target, you drain 14% of all damage dealt as HP, and your Light chain has no cap.'],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'light', status: 'mark' } },
      { hook: 'onHitResolve', fn: 'healPctOfDamage', data: { pct: [0.05, 0.09, 0.14] } }],
    queries: [
      { hook: 'getChainCap', fn: 'removeCapForSlot', minLevel: 3, data: { slot: 'light' } }] },

  { id: 'frag_highway_star_heavy', donor: 'highway_star', slot: 'heavy',
    name: 'Marrow Drain', rarity: 'rare', tags: ['heal', 'single-target'],
    levelDesc: [
      "Heavy tears the Mark off the target for +9 damage.",
      "Heavy tears the Mark off the target for +16 damage and feeds 20% of it back as HP.",
      "Heavy tears the Mark off the target for +25 damage and 4 Persistence, and feeds 30% of it back as HP."],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'mark', dmgPerStack: [9, 16, 25], persistencePerStack: [0, 0, 4] } },
      { hook: 'onHitResolve', fn: 'healPctOfDamage', minLevel: 2, data: { pct: [0, 0.2, 0.3] } }] },

  { id: 'frag_highway_star_special_1', donor: 'highway_star', slot: 'special_1',
    name: 'Relentless Pursuit', rarity: 'epic', tags: ['mobility', 'single-target'],
    levelDesc: [
      'Special hits Mark the target -- it can no longer get away from you.',
      'Special hits Mark the target and drag you onto it wherever it went.',
      'Special hits Mark the target, drag you onto it, and grant 8 Momentum for every hit landed on Marked prey.'],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'special_1', status: 'mark' } },
      { hook: 'onHitResolve', fn: 'teleportAttackerToTarget', minLevel: 2, data: { standoff: [0, 26, 20] } },
      { hook: 'onHitLanded', fn: 'grantResourceIfDefenderStatus', minLevel: 3, data: { status: 'mark', resource: 'momentum', amount: 8 } }] },

  { id: 'frag_highway_star_special_2', donor: 'highway_star', slot: 'special_2',
    name: 'Nutrient Siphon', rarity: 'legendary', tags: ['heal', 'crowd'],
    levelDesc: [
      'Special 2 Marks the 2 nearest enemies, siphons 7 damage from each, and returns 15% of your damage as HP.',
      'Special 2 Marks the 3 nearest enemies, siphons 12 damage from each, and returns 22% of your damage as HP.',
      'Special 2 Marks the 5 nearest enemies, siphons 19 damage from each, and returns 32% of your damage as HP.'],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'mark', count: [2, 3, 5], radius: 105 } },
      { hook: 'onHitLanded', fn: 'damageNearby', data: { amount: [7, 12, 19], count: [2, 3, 5], radius: 105 } },
      { hook: 'onHitResolve', fn: 'healPctOfDamage', data: { pct: [0.15, 0.22, 0.32] } }] },

  { id: 'frag_highway_star_rush', donor: 'highway_star', slot: 'rush',
    name: 'It Never Stops', rarity: 'epic', tags: ['mobility'],
    levelDesc: [
      'Rush recovers 15% faster. The chase does not pause.',
      'Rush recovers 25% faster and winds up 10% faster, and Rush hits grant 6 Momentum.',
      'Rush recovers 40% faster and winds up 20% faster, and Rush hits grant 11 Momentum.'],
    effects: [
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 2, data: { slot: 'rush', resource: 'momentum', amount: [0, 6, 11] } }],
    queries: [
      { hook: 'getMoveFrames', fn: 'rewriteSlotFrames', data: { slot: 'rush', recoverMult: [0.85, 0.75, 0.6], windupMult: [1, 0.9, 0.8] } }] },

  { id: 'frag_highway_star_clash', donor: 'highway_star', slot: 'clash',
    name: 'Leech Guard', rarity: 'rare', tags: ['heal', 'economy'],
    levelDesc: [
      'A successful Clash grants 6 Persistence.',
      'A successful Clash grants 10 Persistence, and a Perfect Clash Marks the 2 nearest enemies.',
      'A successful Clash grants 16 Persistence and 8 Momentum, and a Perfect Clash Marks the 4 nearest enemies.'],
    effects: [
      { hook: 'onClashSuccess', fn: 'grantResource', data: { resource: 'persistence', amount: [6, 10, 16] } },
      { hook: 'onPerfectClash', fn: 'applyStatusToNearby', minLevel: 2, data: { status: 'mark', count: [0, 2, 4], radius: 90 } },
      { hook: 'onClashSuccess', fn: 'grantResource', minLevel: 3, data: { resource: 'momentum', amount: 8 } }] },

  { id: 'frag_highway_star_aura', donor: 'highway_star', slot: 'aura',
    name: 'Highway to Hell', rarity: 'legendary', tags: ['heal', 'risk'],
    tradeoff: 'The pursuit runs on you as much as on them: you lose 1 HP per second of every fight (2 at level 3).',
    levelDesc: [
      'Every hit on a Marked enemy grants 5 Momentum, and you drain 8% of your damage as HP. Costs 1 HP per second.',
      'Every hit on a Marked enemy grants 9 Momentum, and you drain 14% of your damage as HP. Costs 1 HP per second.',
      'Every hit on a Marked enemy grants 14 Momentum, you drain 22% of your damage as HP, and every hit you land Marks. Costs 2 HP per second.'],
    effects: [
      { hook: 'onHitLanded', fn: 'grantResourceIfDefenderStatus', data: { status: 'mark', resource: 'momentum', amount: [5, 9, 14] } },
      { hook: 'onHitResolve', fn: 'healPctOfDamage', data: { pct: [0.08, 0.14, 0.22] } },
      { hook: 'onCombatTick', fn: 'selfDamage', data: { perSec: [1, 1, 2] } },
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', minLevel: 3, data: { status: 'mark' } }] }
];
