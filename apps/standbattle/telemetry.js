/* Local telemetry — tech §2.11, Phase 8 deliverable 7. Append-only via
   `ctx.fs` (CLAUDE.md's arbitrary path-addressed channel, unused until
   now -- `ctx.save`/`ctx.load` is single-value-per-key, not append-
   friendly, so this deliberately doesn't go through save.js's choke
   point). One line of JSON per finished run (win or loss), never a
   console dump.

   `collector` is plain data carried on `runState.telemetry` so it
   serializes and resumes with the rest of the run for free -- nothing
   here needs its own save path. */

const TELEMETRY_PATH = 'standbattle/telemetry.jsonl';

export function createTelemetryCollector() {
  return { fragmentsOffered: [], fragmentsTaken: [], encounterDurationsMs: [], yenEarned: 0, yenSpent: 0, tensionMax: 0 };
}

export function recordOffer(collector, offer) {
  // A reward offer mixes Fragment/Duo/Relic/Disc candidates (Phase 10) --
  // each carries its id under a different field keyed by `kind`, same
  // shape run_choices.js's applyRewardChoice already switches on.
  offer.forEach(c => {
    const id = c.kind === 'duo' ? c.duo.id : c.kind === 'relic' ? c.relic.id : c.kind === 'disc' ? c.disc.id : c.frag.id;
    collector.fragmentsOffered.push(id);
  });
}
export function recordTaken(collector, fragId) {
  collector.fragmentsTaken.push(fragId);
}
export function recordEncounter(collector, ms) {
  collector.encounterDurationsMs.push(Math.round(ms));
}
export function recordYen(collector, earned, spent) {
  if (earned) collector.yenEarned += Math.max(0, earned);
  if (spent) collector.yenSpent += Math.max(0, spent);
}
export function recordTension(collector, tension) {
  collector.tensionMax = Math.max(collector.tensionMax, tension || 0);
}

/* schema: { ts, seed, stand, actReached, killer, fragmentsOffered,
   fragmentsTaken, encounterDurationsMs, yenEarned, yenSpent, tensionMax } */
export async function appendRunSummary(ctx, { seed, stand, actReached, killer, collector }) {
  const summary = {
    ts: Date.now(), seed, stand, actReached, killer: killer || null,
    fragmentsOffered: collector.fragmentsOffered,
    fragmentsTaken: collector.fragmentsTaken,
    encounterDurationsMs: collector.encounterDurationsMs,
    yenEarned: collector.yenEarned,
    yenSpent: collector.yenSpent,
    tensionMax: collector.tensionMax
  };
  let existing = '';
  try { existing = (await ctx.fs.read(TELEMETRY_PATH)) || ''; } catch (e) { existing = ''; }
  await ctx.fs.write(TELEMETRY_PATH, existing + JSON.stringify(summary) + '\n');
}
