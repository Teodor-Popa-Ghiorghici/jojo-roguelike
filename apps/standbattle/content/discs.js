/* Discs — GDD §6.4, tech §3's schema. Phase 10.

   Deviation flagged: GDD's literal description ("swap a Special or your
   Rush for a DIFFERENT STAND'S move") needs that other Stand's real move
   -- frame data, hitbox, animation. Only Star Platinum has any of that
   (moves.js); the other 7 donors exist purely as Fragment-flavoured hook
   clauses, never full move definitions. Building 7 more real movesets is
   a content order of magnitude beyond this phase's budget (and this
   engine's own "content is data" contract still needs a real code path
   underneath the data, which doesn't exist for a second moveset).

   Scoped down to what the existing engine actually supports: a Disc is a
   single-level, single-slot content entry restricted to DISC_SLOTS
   (special_1/special_2/rush, content_registry.js) that FULLY overwrites
   what that slot does, installed via installDisc the same way a Fragment
   installs via installFragment minus the level -- same schema shape
   (`effects`/`queries`, same EFFECT_LIB/QUERY_LIB vocabulary), just no
   `donor`/`levelDesc` fields since a Disc doesn't level and isn't offered
   through the Fragment pity/starvation/convergence system. This keeps
   the "weapon variety inside a run" identity (GDD §6.4) real, just
   without a second sprite/animation set behind it.

   Also flagged: "dropped by Duel nodes and secret bosses" -- neither
   exists yet. Offered through Treasure nodes instead, alongside Relics
   (item_offers.js's generateTreasureOffer), same stand-in role Phase 8
   used Fragment offers for before Phase 10 gave Relics/Discs a real
   system.

   Schema (no donor/levelDesc -- Discs don't level): { id, name, slot,
   desc, tags, tradeoff?, effects[], queries[] }. */

export const DISCS = [
  /* The World (DIO) — Time. */
  {
    id: 'disc_the_world_special_1', name: 'Za Warudo', slot: 'special_1',
    desc: 'Special 1 becomes The World: every hit freezes the target and briefly stops time itself.',
    tags: ['time'],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'special_1', status: 'frozen', stacks: 2 } },
      { hook: 'onMoveStart', fn: 'triggerTimeStop', data: { moveId: 'sp_barrage', frames: 24 } }
    ]
  },
  {
    id: 'disc_the_world_rush', name: 'Stopped World Requiem', slot: 'rush',
    desc: 'Stand Rush opens with a full time-stop window and refunds Momentum on every hit that lands.',
    tags: ['time', 'economy', 'risk'],
    tradeoff: 'Channeling The World into your Rush costs 1 HP every second for the whole fight, win or lose.',
    effects: [
      { hook: 'onMoveStart', fn: 'triggerTimeStop', data: { moveId: 'sp_ora_rush', frames: 45 } },
      { hook: 'onHitLanded', fn: 'grantResource', data: { slot: 'rush', resource: 'momentum', amount: 6 } },
      { hook: 'onCombatTick', fn: 'selfDamage', data: { perSec: 1 } }
    ]
  },

  /* Purple Haze (Fugo) — Virus. */
  {
    id: 'disc_purple_haze_special_2', name: 'Rotting Bloom', slot: 'special_2',
    desc: 'Special 2 detonates the target\'s Virus for bonus damage, then blooms fresh Virus onto everyone nearby.',
    tags: ['virus', 'crowd'],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'virus', dmgPerStack: 4 } },
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'virus', stacks: 2, count: 3, radius: 60, from: 'target' } }
    ]
  },
  {
    id: 'disc_purple_haze_rush', name: 'Viral Ora', slot: 'rush',
    desc: 'Stand Rush\'s hits infect the whole crowd around the target with Virus instead of just the one target.',
    tags: ['virus', 'crowd'],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'virus', stacks: 1, count: 2, radius: 50, from: 'target' } },
      { hook: 'onHitLanded', fn: 'grantResource', data: { slot: 'rush', resource: 'persistence', amount: 2 } }
    ]
  },

  /* Sticky Fingers (Bruno) — Mobility + Break. */
  {
    id: 'disc_sticky_fingers_special_1', name: 'Zipper Barrage', slot: 'special_1',
    desc: 'Special 1 zips you to the target on every hit and strips its armor entirely if it\'s already Broken.',
    tags: ['mobility', 'single-target'],
    effects: [
      { hook: 'onHitResolve', fn: 'teleportAttackerToTarget', data: { standoff: 20 } },
      { hook: 'onHitResolve', fn: 'stripArmorIfBroken', data: {} }
    ]
  },
  {
    id: 'disc_sticky_fingers_rush', name: 'Vanishing Ora', slot: 'rush',
    desc: 'Stand Rush teleports you to the target on every hit and refunds a Step charge whenever it lands on a Broken enemy.',
    tags: ['mobility', 'risk'],
    tradeoff: 'Teleports you to melee range on every hit whether it lands clean or trades -- there is no extra defense while you\'re in reach.',
    effects: [
      { hook: 'onHitResolve', fn: 'teleportAttackerToTarget', data: { standoff: 18 } },
      { hook: 'onHitLanded', fn: 'refundStepCharge', data: { requiresBreak: true, amount: 1 } }
    ]
  },

  /* Crazy Diamond (Josuke) — Restoration. */
  {
    id: 'disc_crazy_diamond_special_2', name: 'Full Restoration', slot: 'special_2',
    desc: 'Special 2 becomes a full repair cycle: it cures Virus and Frozen, heals you, and returns you to your anchor.',
    tags: ['heal', 'mobility', 'economy'],
    effects: [
      { hook: 'onHitResolve', fn: 'cureStatus', data: { status: 'virus' } },
      { hook: 'onHitResolve', fn: 'cureStatus', data: { status: 'frozen' } },
      { hook: 'onHitResolve', fn: 'healEntity', data: { amount: 14 } },
      { hook: 'onHitResolve', fn: 'returnToAnchor', data: {} }
    ]
  },
  {
    id: 'disc_crazy_diamond_rush', name: 'Restorative Rush', slot: 'rush',
    desc: 'Your Rush restores instead of destroys: every hit heals you for a third of the damage it deals and cures Frozen on landing.',
    tags: ['heal'],
    effects: [
      { hook: 'onHitResolve', fn: 'healPctOfDamage', data: { pct: 0.30 } },
      { hook: 'onHitResolve', fn: 'cureStatus', data: { status: 'frozen' } }
    ]
  },

  /* Gold Experience (Giorno) — Life. */
  {
    id: 'disc_gold_experience_special_1', name: 'Golden Bloom', slot: 'special_1',
    desc: 'Special 1 plants a life mote at both you and the target on every hit, turning the barrage into a healing storm.',
    tags: ['heal', 'economy', 'crowd'],
    effects: [
      { hook: 'onHitLanded', fn: 'spawnFriendlyMote', data: { at: 'defender', radius: 22, lifeFrames: 480, healAmount: 6, momentumAmount: 10 } },
      { hook: 'onHitLanded', fn: 'spawnFriendlyMote', data: { at: 'attacker', radius: 22, lifeFrames: 480, healAmount: 6, momentumAmount: 10 } }
    ]
  },
  {
    id: 'disc_gold_experience_special_2', name: 'Reset Button', slot: 'special_2',
    desc: 'Special 2 recalls you to your starting anchor, cures Virus, and heals you the instant it connects.',
    tags: ['heal', 'mobility', 'economy'],
    effects: [
      { hook: 'onHitResolve', fn: 'returnToAnchor', data: {} },
      { hook: 'onHitResolve', fn: 'cureStatus', data: { status: 'virus' } },
      { hook: 'onHitResolve', fn: 'healEntity', data: { amount: 16 } }
    ]
  },

  /* Echoes ACT3 (Koichi) — Gravity. */
  {
    id: 'disc_echoes_act3_special_1', name: 'Gravity Well', slot: 'special_1',
    desc: 'Special 1 becomes a gravity well: every hit pulls the nearest enemies in and grounds them, and each hit can detonate the pile-up for bonus damage.',
    tags: ['crowd', 'economy'],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'gravity', stacks: 2, count: 3, radius: 70, from: 'target' } },
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'gravity', dmgPerStack: 3, persistencePerStack: 1 } }
    ]
  },

  /* Red Hot Chili Pepper (Akira) — Electricity. */
  {
    id: 'disc_red_hot_chili_pepper_special_2', name: 'Overload Circuit', slot: 'special_2',
    desc: 'Special 2 detonates the target\'s Charge for bonus damage and Persistence, then arcs damage to everyone nearby.',
    tags: ['crowd', 'economy'],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'charge', dmgPerStack: 5, persistencePerStack: 2 } },
      { hook: 'onHitLanded', fn: 'damageNearby', data: { amount: 6, count: 3, radius: 60, from: 'target' } }
    ]
  },
  {
    id: 'disc_red_hot_chili_pepper_rush', name: 'Live Wire Rush', slot: 'rush',
    desc: 'Stand Rush charges the target with every hit and arcs damage out to the two nearest other enemies as it lands.',
    tags: ['crowd'],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'rush', status: 'charge', stacks: 2 } },
      { hook: 'onHitLanded', fn: 'damageNearby', data: { amount: 5, count: 2, radius: 55, from: 'target' } }
    ]
  },

  /* Hermit Purple (Joseph) — Divination. */
  {
    id: 'disc_hermit_purple_special_2', name: 'Divined Strike', slot: 'special_2',
    desc: 'Special 2 marks the target with foresight, then consumes the Mark for bonus damage and Persistence.',
    tags: ['single-target', 'economy'],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'special_2', status: 'mark', stacks: 3 } },
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'mark', dmgPerStack: 5, persistencePerStack: 2 } }
    ]
  }
];
