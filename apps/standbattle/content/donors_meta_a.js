/* Meta donor pool A — Aerosmith (Narancia), Six Pistols (Mista) and Moody
   Blues (Abbacchio). Three donors x 7 Fragments, one per slot, authored
   purely from the existing EFFECT_LIB/QUERY_LIB verb vocabulary: nothing
   here adds an engine branch (.claude/rules/content.md), and every entry
   clears GDD §6.7 through content_registry.js's synergy union rather than
   author honesty. Split from donors_meta_b.js only for the repo's
   300-line cap, exactly as content/fragments/<donor>.js was.

   Aerosmith is the tracking donor -- CO2 radar means Mark, and every
   clause either plants it, amplifies against it or cashes it in. Six
   Pistols is the autonomy donor -- friendly motes (hazards.js) and Charge
   spread across the crowd, six small things acting without you. Moody
   Blues is the replay donor -- echoNthHit, rewriteSlotFrames, time-stop
   and returnToAnchor are all "this already happened, watch it again". */

export const DONORS_META_A = ['aerosmith', 'six_pistols', 'moody_blues'];

export const FRAGMENTS_META_A = [
  /* ---- Aerosmith — CO2 tracking, Mark ------------------------------------ */
  { id: 'frag_aerosmith_light', donor: 'aerosmith', slot: 'light',
    name: 'Contrail Sting', rarity: 'common', tags: ['single-target'],
    levelDesc: [
      'Light hits paint the target with Mark. You deal 12% more damage to Marked targets.',
      'Light hits paint the target with Mark. You deal 22% more damage to Marked targets.',
      'Light hits paint the target with Mark. You deal 35% more damage to Marked targets, and your Light chain has no cap.'],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'light', status: 'mark', stacks: 1 } }],
    queries: [
      { hook: 'getDamage', fn: 'bonusIfDefenderStatus', data: { status: 'mark', minStacks: 1, mult: [1.12, 1.22, 1.35] } },
      { hook: 'getChainCap', fn: 'removeCapForSlot', minLevel: 3, data: { slot: 'light' } }] },

  { id: 'frag_aerosmith_medium', donor: 'aerosmith', slot: 'medium',
    name: 'Lock and Strafe', rarity: 'rare', tags: ['single-target', 'economy'],
    levelDesc: [
      "Medium burns off the target's Mark for +7 damage and +2 Persistence.",
      "Medium burns off the target's Mark for +12 damage and +3 Persistence.",
      "Medium burns off the target's Mark for +18 damage and +5 Persistence, then immediately repaints it -- the radar never loses the lock."],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'mark', dmgPerStack: [7, 12, 18], persistencePerStack: [2, 3, 5] } },
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', minLevel: 3, data: { slot: 'medium', status: 'mark', stacks: 1 } }] },

  { id: 'frag_aerosmith_special_1', donor: 'aerosmith', slot: 'special_1',
    name: 'CO2 Sweep', rarity: 'epic', tags: ['crowd'],
    levelDesc: [
      'Special hits sweep the air and Mark the 2 nearest enemies.',
      'Special hits sweep the air and Mark the 3 nearest enemies, and landing on a Marked target grants 5 Momentum.',
      'Special hits sweep the air and Mark the 4 nearest enemies, and landing on a Marked target grants 9 Momentum.'],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'mark', stacks: 1, count: [2, 3, 4], radius: [70, 85, 100] } },
      { hook: 'onHitLanded', fn: 'grantResourceIfDefenderStatus', minLevel: 2, data: { status: 'mark', resource: 'momentum', amount: [0, 5, 9] } }] },

  { id: 'frag_aerosmith_rush', donor: 'aerosmith', slot: 'rush',
    name: 'Strafing Run', rarity: 'epic', tags: ['mobility', 'single-target'],
    levelDesc: [
      'Stand Rush hits Mark whatever they land on.',
      'Rush hits Mark their target and pull you in behind the run.',
      'Rush hits Mark their target, pull you in tight, and Mark 2 more enemies caught in the pass.'],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'rush', status: 'mark', stacks: 1 } },
      { hook: 'onHitResolve', fn: 'teleportAttackerToTarget', minLevel: 2, data: { standoff: [0, 28, 18] } },
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', minLevel: 3, data: { status: 'mark', stacks: 1, count: 2, radius: 55 } }] },

  { id: 'frag_aerosmith_step', donor: 'aerosmith', slot: 'step',
    name: 'Bombing Line', rarity: 'common', tags: ['mobility', 'crowd'],
    levelDesc: [
      'Stepping Marks the nearest enemy.',
      'Stepping Marks the 2 nearest enemies, from a wider sweep.',
      'Stepping Marks the 3 nearest enemies from a wider sweep, and refunds a Step charge whenever it catches a Broken one.'],
    effects: [
      { hook: 'onStepStart', fn: 'applyStatusToNearby', data: { status: 'mark', stacks: 1, count: [1, 2, 3], radius: [55, 70, 85] } },
      { hook: 'onHitLanded', fn: 'refundStepCharge', minLevel: 3, data: { requiresBreak: true, amount: 1 } }] },

  { id: 'frag_aerosmith_clash', donor: 'aerosmith', slot: 'clash',
    name: 'Tracer Fire', rarity: 'rare', tags: ['single-target', 'economy'],
    levelDesc: [
      'A successful Clash Marks your opponent.',
      'A successful Clash Marks your opponent and grants 6 Persistence.',
      'A successful Clash Marks your opponent and grants 10 Persistence. A Perfect Clash Marks the 3 nearest enemies instead.'],
    effects: [
      { hook: 'onClashSuccess', fn: 'applyStatusToNearby', data: { status: 'mark', stacks: 1, count: 1, radius: 60 } },
      { hook: 'onClashSuccess', fn: 'grantResource', minLevel: 2, data: { resource: 'persistence', amount: [0, 6, 10] } },
      { hook: 'onPerfectClash', fn: 'applyStatusToNearby', minLevel: 3, data: { status: 'mark', stacks: 1, count: 3, radius: 95 } }] },

  { id: 'frag_aerosmith_aura', donor: 'aerosmith', slot: 'aura',
    name: 'It Never Loses You', rarity: 'legendary', tags: ['single-target'],
    levelDesc: [
      'Every hit you land Marks its target.',
      'Every hit you land Marks its target, and hitting an already-Marked enemy grants 4 Momentum.',
      'Every hit you land Marks its target, hitting an already-Marked enemy grants 8 Momentum, and Marked enemies take 25% more poise damage.'],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { status: 'mark', stacks: 1 } },
      { hook: 'onHitLanded', fn: 'grantResourceIfDefenderStatus', minLevel: 2, data: { status: 'mark', resource: 'momentum', amount: [0, 4, 8] } }],
    queries: [
      { hook: 'getPoiseDamage', fn: 'bonusIfDefenderStatus', minLevel: 3, data: { status: 'mark', minStacks: 1, mult: 1.25 } }] },

  /* ---- Six Pistols — six autonomous helpers, Charge + friendly motes ------ */
  { id: 'frag_six_pistols_light', donor: 'six_pistols', slot: 'light',
    name: 'Number Four Fires', rarity: 'common', tags: ['crowd'],
    levelDesc: [
      'Light hits leave 1 Charge on the target and spray 3 damage into the 1 nearest bystander.',
      'Light hits leave 2 Charge on the target and spray 5 damage into the 2 nearest bystanders.',
      'Light hits leave 3 Charge on the target and spray 8 damage into the 3 nearest bystanders.'],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'light', status: 'charge', stacks: [1, 2, 3] } },
      { hook: 'onHitLanded', fn: 'damageNearby', data: { amount: [3, 5, 8], count: [1, 2, 3], radius: 60 } }] },

  { id: 'frag_six_pistols_heavy', donor: 'six_pistols', slot: 'heavy',
    name: 'Number One Reloads', rarity: 'rare', tags: ['crowd', 'economy'],
    levelDesc: [
      'Heavy hits drop a shell casing the squad brings back: a mote worth 4 HP.',
      'Heavy hits drop a mote worth 6 HP and 8 Momentum, and grant 6 Persistence on landing.',
      'Heavy hits drop a mote worth 10 HP and 14 Momentum, and grant 10 Persistence on landing.'],
    effects: [
      { hook: 'onHitLanded', fn: 'spawnFriendlyMote', data: { healAmount: [4, 6, 10], momentumAmount: [0, 8, 14], radius: 20, lifeFrames: 600 } },
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 2, data: { slot: 'heavy', resource: 'persistence', amount: [0, 6, 10] } }] },

  { id: 'frag_six_pistols_special_1', donor: 'six_pistols', slot: 'special_1',
    name: 'Squad Volley', rarity: 'epic', tags: ['crowd'],
    levelDesc: [
      'Special hits scatter 2 Charge onto the 2 nearest enemies and deal 5 damage to each.',
      'Special hits scatter 2 Charge onto the 3 nearest enemies and deal 8 damage to each.',
      'Special hits scatter 3 Charge onto the 4 nearest enemies and deal 13 damage to each.'],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'charge', stacks: [2, 2, 3], count: [2, 3, 4], radius: 90 } },
      { hook: 'onHitLanded', fn: 'damageNearby', data: { amount: [5, 8, 13], count: [2, 3, 4], radius: 90 } }] },

  { id: 'frag_six_pistols_special_2', donor: 'six_pistols', slot: 'special_2',
    name: 'Six Way Split', rarity: 'legendary', tags: ['crowd', 'economy'],
    levelDesc: [
      'Special 2 sends the squad out: 3 Charge onto the 3 nearest enemies, and a mote left where you stand.',
      'Special 2 sends the squad out: 4 Charge onto the 4 nearest enemies, and a richer mote left where you stand.',
      'Special 2 sends the squad out: 5 Charge onto the 6 nearest enemies, a richer mote where you stand, and 12 damage into everything it touches.'],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'charge', stacks: [3, 4, 5], count: [3, 4, 6], radius: 110 } },
      { hook: 'onHitLanded', fn: 'spawnFriendlyMote', data: { at: 'attacker', healAmount: [4, 7, 7], momentumAmount: [6, 10, 14], radius: 22 } },
      { hook: 'onHitLanded', fn: 'damageNearby', minLevel: 3, data: { amount: 12, count: 6, radius: 110 } }] },

  { id: 'frag_six_pistols_rush', donor: 'six_pistols', slot: 'rush',
    name: 'Pistol Barrage', rarity: 'epic', tags: ['single-target'],
    levelDesc: [
      "Every 4th Rush hit fires twice. Rush also detonates the target's Charge for +3 damage per stack.",
      "Every 3rd Rush hit fires twice. Rush also detonates the target's Charge for +5 damage per stack.",
      "Every 2nd Rush hit fires twice. Rush also detonates the target's Charge for +8 damage per stack and 1 Persistence per stack."],
    effects: [
      { hook: 'onHitResolve', fn: 'echoNthHit', data: { slot: 'rush', everyN: [4, 3, 2], mult: 2 } },
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'charge', dmgPerStack: [3, 5, 8], persistencePerStack: [0, 0, 1] } }] },

  { id: 'frag_six_pistols_step', donor: 'six_pistols', slot: 'step',
    name: 'Scatter Formation', rarity: 'common', tags: ['mobility', 'crowd'],
    levelDesc: [
      'Stepping leaves a mote behind where you were standing.',
      'Stepping leaves a richer mote behind, and puts 1 Charge on the nearest enemy.',
      'Stepping leaves a richer mote behind, puts 2 Charge on the 2 nearest enemies, and refunds a Step charge.'],
    effects: [
      { hook: 'onStepStart', fn: 'spawnFriendlyMote', data: { at: 'attacker', healAmount: [3, 5, 5], momentumAmount: [0, 6, 10], radius: 18 } },
      { hook: 'onStepStart', fn: 'applyStatusToNearby', minLevel: 2, data: { status: 'charge', stacks: [1, 1, 2], count: [1, 1, 2], radius: 65 } },
      { hook: 'onStepStart', fn: 'refundStepCharge', minLevel: 3, data: { amount: 1 } }] },

  { id: 'frag_six_pistols_aura', donor: 'six_pistols', slot: 'aura',
    name: 'The Squad Reports In', rarity: 'legendary', tags: ['crowd', 'economy'],
    levelDesc: [
      'When an enemy dies, the squad tags the 2 nearest survivors with 2 Charge and brings you back 6 Persistence.',
      'When an enemy dies, the squad tags the 3 nearest survivors with 3 Charge and brings you back 10 Persistence.',
      'When an enemy dies, the squad tags the 4 nearest survivors with 4 Charge, brings you back 16 Persistence, and 10 Momentum.'],
    effects: [
      { hook: 'onKill', fn: 'applyStatusToNearby', data: { status: 'charge', stacks: [2, 3, 4], count: [2, 3, 4], radius: 95, from: 'target' } },
      { hook: 'onKill', fn: 'grantResource', data: { resource: 'persistence', amount: [6, 10, 16] } },
      { hook: 'onKill', fn: 'grantResource', minLevel: 3, data: { resource: 'momentum', amount: 10 } }] },

  /* ---- Moody Blues — replay what already happened ------------------------- */
  { id: 'frag_moody_blues_light', donor: 'moody_blues', slot: 'light',
    name: 'Rewind Jab', rarity: 'common', tags: ['time'],
    levelDesc: [
      'Every 4th Light hit plays back a second time.',
      'Every 3rd Light hit plays back a second time.',
      'Every 2nd Light hit plays back a second time, and your Light chain has no cap.'],
    effects: [
      { hook: 'onHitResolve', fn: 'echoNthHit', data: { slot: 'light', everyN: [4, 3, 2], mult: 2 } }],
    queries: [
      { hook: 'getChainCap', fn: 'removeCapForSlot', minLevel: 3, data: { slot: 'light' } }] },

  { id: 'frag_moody_blues_medium', donor: 'moody_blues', slot: 'medium',
    name: 'Recorded Blow', rarity: 'rare', tags: ['time', 'economy'],
    levelDesc: [
      'Landing a Medium spools 4 of your Momentum into Persistence at 1:1.',
      'Landing a Medium spools 7 of your Momentum into 1.5x Persistence.',
      'Landing a Medium spools 10 of your Momentum into double Persistence, and grants 4 Persistence outright.'],
    effects: [
      { hook: 'onHitLanded', fn: 'convertResource', data: { from: 'momentum', to: 'persistence', ratio: [1, 1.5, 2], max: [4, 7, 10] } },
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 3, data: { slot: 'medium', resource: 'persistence', amount: 4 } }] },

  { id: 'frag_moody_blues_heavy', donor: 'moody_blues', slot: 'heavy',
    name: 'Frame Advance', rarity: 'rare', tags: ['time'],
    levelDesc: [
      'Your Heavy winds up 10% faster -- you have already seen it happen.',
      'Your Heavy winds up 20% faster and recovers 10% faster.',
      'Your Heavy winds up 30% faster, recovers 20% faster, and grants 8 Momentum on landing.'],
    effects: [
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 3, data: { slot: 'heavy', resource: 'momentum', amount: 8 } }],
    queries: [
      { hook: 'getMoveFrames', fn: 'rewriteSlotFrames', data: { slot: 'heavy', windupMult: [0.9, 0.8, 0.7], recoverMult: [1, 0.9, 0.8] } }] },

  { id: 'frag_moody_blues_special_2', donor: 'moody_blues', slot: 'special_2',
    name: 'Replay', rarity: 'legendary', tags: ['time'],
    levelDesc: [
      'Staggering an enemy freezes the recording for 0.5s -- the world stops, you do not.',
      'Staggering an enemy freezes the recording for 0.75s.',
      'Staggering an enemy freezes the recording for 1s, and a Guard Break does the same.'],
    effects: [
      { hook: 'onStaggerStart', fn: 'triggerTimeStop', data: { frames: [30, 45, 60] } },
      { hook: 'onGuardBreak', fn: 'triggerTimeStop', minLevel: 3, data: { frames: 60 } }] },

  { id: 'frag_moody_blues_rush', donor: 'moody_blues', slot: 'rush',
    name: 'Rerun', rarity: 'epic', tags: ['time', 'single-target'],
    levelDesc: [
      'Every 2nd Rush hit replays at 50% extra force.',
      'Every 2nd Rush hit replays at 75% extra force, and Rush snaps you back onto the target.',
      'Every 2nd Rush hit replays at double force, and Rush snaps you tight onto the target.'],
    effects: [
      { hook: 'onHitResolve', fn: 'echoNthHit', data: { slot: 'rush', everyN: 2, mult: [1.5, 1.75, 2] } },
      { hook: 'onHitResolve', fn: 'teleportAttackerToTarget', minLevel: 2, data: { standoff: [0, 26, 18] } }] },

  { id: 'frag_moody_blues_clash', donor: 'moody_blues', slot: 'clash',
    name: 'Perfect Recall', rarity: 'rare', tags: ['time', 'mobility'],
    levelDesc: [
      'A Perfect Clash rewinds the tape for 0.4s.',
      'A Perfect Clash rewinds the tape for 0.6s, and any successful Clash refunds a Step charge.',
      'A Perfect Clash rewinds the tape for 0.85s, any successful Clash refunds a Step charge, and Breaks the nearest enemy.'],
    effects: [
      { hook: 'onPerfectClash', fn: 'triggerTimeStop', data: { frames: [24, 36, 50] } },
      { hook: 'onClashSuccess', fn: 'refundStepCharge', minLevel: 2, data: { amount: 1 } },
      { hook: 'onPerfectClash', fn: 'markNearestBroken', minLevel: 3, data: { count: 1 } }] },

  { id: 'frag_moody_blues_aura', donor: 'moody_blues', slot: 'aura',
    name: 'Track Back', rarity: 'legendary', tags: ['time', 'mobility'],
    levelDesc: [
      'Stepping rewinds your position to where the fight began.',
      'Stepping rewinds your position to where the fight began and refunds the charge you spent.',
      'Stepping rewinds your position to where the fight began, refunds the charge you spent, and stops the tape for 0.35s.'],
    effects: [
      { hook: 'onStepStart', fn: 'returnToAnchor', data: {} },
      { hook: 'onStepStart', fn: 'refundStepCharge', minLevel: 2, data: { amount: 1 } },
      { hook: 'onStepStart', fn: 'triggerTimeStop', minLevel: 3, data: { frames: 21 } }] }
];
