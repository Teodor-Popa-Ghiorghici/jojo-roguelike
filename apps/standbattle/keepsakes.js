/* Keepsakes — GDD §9.3. The reward at the end of a Stand Bond track
   (bonds.js, beat 9): a starting Relic the player may equip at run start,
   belonging to the Stand whose Bond produced it (`standId`).

   These use the Relic schema exactly (relics.js / tech §3: { id, name,
   rarity, desc, tags, tradeoff, effects[], queries[] }) so they install
   through content_registry.js's installRelic with zero new plumbing --
   a Keepsake IS a Relic, it just has a non-shop source.

   SIDEGRADE ONLY. Spec §7 / GDD §9.3: 40 hours of Bond progress must
   change how a run OPENS, never how strong it opens. Every entry below
   gives one real thing and takes one real thing, so every one is tagged
   'risk' and carries a `tradeoff` string naming the actual cost -- the
   same "downside stated at pickup, never a hidden clause" rule Relics
   already live under, applied without exception here.

   Nothing in this file adds a verb: every `fn` named below already exists
   in EFFECT_LIB/QUERY_LIB (effect_lib.js and the item/aspect libraries it
   merges), and every status named is one of the five real ones. */

export const KEEPSAKE_LIST = Object.freeze([
  {
    id: 'keepsake_sp_cap', standId: 'star_platinum', name: "Jotaro's Cap Brim", rarity: 'legendary',
    desc: 'Read a clash the way he does: every Perfect Clash freezes the world for a beat. The brim sits heavy, and your Stand tires faster for wearing it.',
    tags: ['time', 'risk'],
    tradeoff: 'A flat -25 max Persistence for the whole run -- the time-stop is paid for out of your reserve, permanently.',
    effects: [
      { hook: 'onPerfectClash', fn: 'triggerTimeStop', data: { frames: 42 } }
    ],
    queries: [
      { hook: 'getMaxPersistence', fn: 'addFlat', data: { amount: -25 } }
    ]
  },
  {
    id: 'keepsake_sc_armor', standId: 'silver_chariot', name: "Chariot's Discarded Armor", rarity: 'legendary',
    desc: 'Polnareff takes the armor off and hands it to you as a memento, not a shield. Unburdened, you move at a speed nothing alive should manage -- and you bruise like he does.',
    tags: ['mobility', 'risk'],
    tradeoff: 'Every hit you take drains 8 Momentum, so a bad exchange strips the speed you were relying on.',
    effects: [
      { hook: 'onDamageTaken', fn: 'grantResource', data: { resource: 'momentum', amount: -8 } }
    ],
    queries: [
      { hook: 'getMoveSpeed', fn: 'multiplyFlat', data: { mult: 1.22 } }
    ]
  },
  {
    id: 'keepsake_hg_emerald', standId: 'hierophant_green', name: "Kakyoin's Single Emerald", rarity: 'epic',
    desc: 'One emerald, kept warm. Every Step strings it out to the two nearest enemies and Marks them for you -- Kakyoin watching the room so you do not have to.',
    tags: ['single-target', 'risk'],
    tradeoff: 'Each Step now costs 8 Persistence up front, and a Step you cannot pay for simply does not happen.',
    effects: [
      { hook: 'onStepStart', fn: 'applyStatusToNearby', data: { status: 'mark', stacks: 1, count: 2, radius: 140 } },
      { hook: 'onStepStart', fn: 'payResource', data: { resource: 'persistence', amount: 8 } }
    ],
    queries: []
  },
  {
    id: 'keepsake_kq_ring', standId: 'killer_queen', name: "Kira's Trigger Ring", rarity: 'legendary',
    desc: 'The detonator, worn as jewellery. Anything that dies near you goes off, and the blast does not politely check where you happen to be standing.',
    tags: ['crowd', 'risk'],
    tradeoff: 'Every kill also costs you 6 HP -- you are always inside your own blast radius.',
    effects: [
      { hook: 'onKill', fn: 'damageNearby', data: { amount: 14, count: 3, radius: 60, from: 'target' } },
      { hook: 'onKill', fn: 'selfDamage', data: { perSec: 6 } }
    ],
    queries: []
  },
  {
    id: 'keepsake_cd_shard', standId: 'crazy_diamond', name: 'The Piece He Could Not Fix', rarity: 'epic',
    desc: 'A shard Josuke never managed to restore. It mends YOU instead, converting a slice of every hit you land back into vitality -- slowly, and out of your own reserve.',
    tags: ['heal', 'risk'],
    tradeoff: 'A flat -20 max Persistence for the whole run; the healing is drawn from what your Stand no longer has to spend.',
    effects: [
      { hook: 'onHitResolve', fn: 'healPctOfDamage', data: { pct: 0.14 } }
    ],
    queries: [
      { hook: 'getMaxPersistence', fn: 'addFlat', data: { amount: -20 } }
    ]
  },
  {
    id: 'keepsake_ge_ladybug', standId: 'gold_experience', name: "Giorno's Living Ladybug", rarity: 'legendary',
    desc: 'Alive, and stubbornly so. Every enemy that falls leaves behind a mote of life for you to collect -- but the ladybug will not lend its strength to the killing itself.',
    tags: ['heal', 'risk'],
    tradeoff: 'All of your damage is reduced by 12%, permanently. Gold Experience creates; it will not be made into a weapon.',
    effects: [
      { hook: 'onKill', fn: 'spawnFriendlyMote', data: { at: 'defender', radius: 22, lifeFrames: 600, healAmount: 7, momentumAmount: 6 } }
    ],
    queries: [
      { hook: 'getDamage', fn: 'multiplyIfPlayerAttacker', data: { mult: 0.88 } }
    ]
  },
  {
    id: 'keepsake_sf_zipper', standId: 'sticky_fingers', name: "Bucciarati's Zipper Tab", rarity: 'epic',
    desc: 'A single tab, torn loose. Every hit you resolve zips you straight onto your target -- you are never out of range again, and never out of the way either.',
    tags: ['mobility', 'risk'],
    tradeoff: 'Each landed hit drains 5 Persistence, and the zipper puts you at point-blank range whether or not you wanted to be there.',
    effects: [
      { hook: 'onHitResolve', fn: 'teleportAttackerToTarget', data: { standoff: 20 } },
      { hook: 'onHitLanded', fn: 'grantResource', data: { resource: 'persistence', amount: -5 } }
    ],
    queries: []
  },
  {
    id: 'keepsake_hp_vine', standId: 'hermit_purple', name: "Joseph's Frayed Vine", rarity: 'epic',
    desc: 'A length of Hermit Purple, still warm. It reads the fight a second ahead and turns spare Momentum into Persistence every second -- while you spend that second looking at the future instead of your feet.',
    tags: ['economy', 'risk'],
    tradeoff: 'You move 10% slower for the whole run, and the conversion eats Momentum you might have wanted for a Rush.',
    effects: [
      { hook: 'onCombatTick', fn: 'convertResource', data: { from: 'momentum', to: 'persistence', ratio: 1, max: 6 } }
    ],
    queries: [
      { hook: 'getMoveSpeed', fn: 'multiplyFlat', data: { mult: 0.9 } }
    ]
  }
]);

export const KEEPSAKES = Object.freeze(Object.fromEntries(KEEPSAKE_LIST.map(k => [k.id, k])));
