/* Behaviour profiles — GDD §4.1/§16: describe token USAGE, not bespoke
   state machines. Each profile is a small weighting function over whether
   an enemy should be preferred for the next free attack token (token.js),
   layered on top of the two biases every candidate gets regardless of
   profile (GDD §16: "prefers enemies with a clean line and biases toward
   whoever the player is not facing"). A new enemy that wants one of these
   behaviours is a one-line `profile: '<name>'` data entry (data.js) --
   nothing here is written against a specific enemy id, and none of it
   replaces ai.js's PATTERNS/state machine, only decides who gets to use it
   next.

   Only `aggressor` (Delinquent), `opportunist` (Knife Thug) and `turtle`
   (Brute) are exercised by Phase 5's three shipped enemy types; `spacer`,
   `flanker` and `support` are real, ready for the Zoner/Hound/Puppeteer
   types GDD §4.2 reserves them for, without needing another engine change
   when those are added. */

export const PROFILES = {
  aggressor: { eagerness: 1.4 },
  spacer: { eagerness: 0.6 },
  turtle: { eagerness: 0.75 },
  flanker: { eagerness: 1.1, flankBonus: 1.4 },
  opportunist: { eagerness: 1.0, punishBonus: 2.2 },
  support: { eagerness: 0.5 }
};

const CLEAN_LINE_RANGE_MULT = 1.3; // "clean line" -- already within engageable range of its own pattern
const CLEAN_LINE_BONUS = 1.6;
const UNFACED_BONUS = 1.5; // bias toward whoever the player is not facing
const FLANK_Z_THRESHOLD = 20; // world units off the player's own depth to count as "flanking"

function isPlayerVulnerable(player) {
  return (player.state === 'attack' && player.movePhase === 'recover') ||
    player.state === 'hitstun' || player.state === 'staggered';
}

/* Higher score -> more likely to win token.js's weighted roll. Never a
   hard gate: every eligible candidate can always win, just with different
   odds, so no profile can starve outright -- only bias how often it does. */
export function scoreForToken(enemy, player) {
  const profile = PROFILES[enemy.def.profile] || PROFILES.aggressor;
  let score = profile.eagerness;

  const dist = Math.abs(player.x - enemy.x);
  if (dist <= enemy.ai.approachRange * CLEAN_LINE_RANGE_MULT) score *= CLEAN_LINE_BONUS;

  const enemySide = enemy.x >= player.x ? 1 : -1;
  if (enemySide !== (player.facing || 1)) score *= UNFACED_BONUS;

  if (enemy.def.profile === 'flanker' && Math.abs(enemy.z - player.z) > FLANK_Z_THRESHOLD) {
    score *= profile.flankBonus;
  }
  if (enemy.def.profile === 'opportunist' && isPlayerVulnerable(player)) {
    score *= profile.punishBonus;
  }
  return score;
}
