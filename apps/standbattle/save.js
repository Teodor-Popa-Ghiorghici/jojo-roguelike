/* Save — Phase 0 foundation. The single choke point over ctx.save/ctx.load.
   Two separate blobs, 'run' and 'meta', each wrapped as { version, data }
   and passed through a per-blob migration table keyed by the version it
   upgrades *from*. Corrupted or unreadable data returns a safe fallback
   instead of throwing, and the two blobs are loaded independently so a
   broken run save can never take meta down with it. */

const RUN_VERSION = 3;
const META_VERSION = 2;

/* Migration table: RUN_MIGRATIONS[v] upgrades data from version v to v+1.
   v1 -> v2 (Phase 7): RUN_BUFFS' bespoke `buffs` array is retired in
   favour of the real Fragment system (fragment_offers.js) -- a v1 save's
   `buffs` carried no state worth preserving (they were re-derived, never
   player-authored choices with commitment behind them the way an owned
   Fragment now is), so this just drops the field and seeds the new
   Fragment-run state fresh. upgradePoints is filled in properly by
   index.js on load (it needs the Stand's devPotential stat, which this
   file doesn't know about), not here.

   v2 -> v3 (Phase 8): deliberately NOT migrated. v2's run state is a
   linear `nodeIndex` into a fixed 6-node array; v3 is a seeded DAG
   (`graph`/`nodeId`/`visited`, run_flow.js). There is no sound mapping
   from "index 3 of 6" onto a position in a graph that didn't exist when
   that save was written, so a v2 save falls through `migrate()`'s
   existing "no migration step -> return fallback" path below (line ~38)
   exactly like any other unmigratable version -- the player starts a
   fresh run instead of resuming into a nonsensical position. */
const RUN_MIGRATIONS = {
  1: data => {
    const { buffs, ...rest } = data;
    return { ...rest, fragmentsBySlot: {}, nodesSinceRare: 0, slotOfferCounts: {}, upgradePoints: null };
  }
};
/* v1 -> v2 (Phase 10): meta grows from three display settings into the
   real meta-progression blob. Unlike the run migrations there is nothing
   to reconcile -- every new field is additive and starts empty, so a v1
   save keeps its shake/cleared/keymap and simply begins the Archive at
   zero Fate. Deliberately spelled out rather than defaulted lazily at each
   read site, so `meta.fate.fate` is guaranteed to exist everywhere. */
const META_MIGRATIONS = {
  1: data => ({ ...data, ...freshMetaProgress() })
};

/* Phase 10. Track A state (fate/archive/bonds) and Track B state (menace)
   sit side by side in the blob but are never merged: the two are read by
   two different modules and, per spec §7, neither can express the other's
   effect. `missions` and `titles` belong to neither -- they are the
   payout ledger both tracks feed. */
function freshMetaProgress() {
  return {
    fate: { fate: 0, lifetimeFate: 0 },
    archive: { purchased: [], seen: {} },
    menace: { pacts: {}, best: {} },
    bonds: {},
    missions: { completed: [] },
    titles: [],
    lastRun: null,
    loadout: {} // { [standId]: { aspectId, keepsakeId } }
  };
}

function defaultMeta() {
  // GDD §21 accessibility settings, persistent across runs like shakeEnabled/keymap already were.
  return {
    shakeEnabled: true, flashEnabled: true, reduceParticles: false, projectToggleMode: false,
    assist: { clash: false, step: false, damage: false },
    cleared: false, keymap: null, ...freshMetaProgress()
  };
}

/* Belt-and-braces for a blob written by a build between migrations: fills
   any missing top-level progress field without touching one that exists.
   index.js calls this right after loadMeta(). */
export function ensureMetaProgress(meta) {
  const fresh = freshMetaProgress();
  for (const key of Object.keys(fresh)) {
    if (meta[key] == null) meta[key] = fresh[key];
  }
  if (meta.fate.fate == null) meta.fate.fate = 0;
  if (!Array.isArray(meta.archive.purchased)) meta.archive.purchased = [];
  if (!meta.archive.seen) meta.archive.seen = {};
  if (!meta.menace.pacts) meta.menace.pacts = {};
  if (!meta.menace.best) meta.menace.best = {};
  if (!Array.isArray(meta.missions.completed)) meta.missions.completed = [];
  return meta;
}

function migrate(entry, migrations, targetVersion, fallback) {
  if (!entry || typeof entry !== 'object' || typeof entry.version !== 'number') return fallback;
  let version = entry.version;
  let data = entry.data;
  while (version < targetVersion) {
    const step = migrations[version];
    if (!step) return fallback; // unknown/unmigratable version -- don't guess
    data = step(data);
    version++;
  }
  return data === undefined ? fallback : data;
}

export function createSaveStore(ctx) {
  return {
    async loadRun() {
      try {
        const entry = await ctx.load('run');
        if (entry == null) return null;
        return migrate(entry, RUN_MIGRATIONS, RUN_VERSION, null);
      } catch (e) {
        return null;
      }
    },
    async saveRun(data) {
      await ctx.save('run', { version: RUN_VERSION, data });
    },
    async clearRun() {
      await ctx.save('run', null);
    },
    async loadMeta() {
      try {
        const entry = await ctx.load('meta');
        if (entry == null) return defaultMeta();
        return migrate(entry, META_MIGRATIONS, META_VERSION, defaultMeta());
      } catch (e) {
        return defaultMeta();
      }
    },
    async saveMeta(data) {
      await ctx.save('meta', { version: META_VERSION, data });
    }
  };
}
