/* Steps every enemy in the encounter once per sim frame: the attack-token
   pool (token.js, GDD §16) first, so `enemy.hasToken` is fresh before any
   AI decision reads it, then each enemy's own movement/AI/attack step
   (combat_enemy.js), then the encounter's wave-spawn/win-condition
   bookkeeping (encounter.js) last, so a kill landed during this frame's
   enemy stepping is caught the same frame. Mirrors the player/enemy split
   combat_player.js/combat_enemy.js already established -- this is the
   third seam, for "the crowd as a whole" rather than any one fighter. */

import { stepEnemyMovementAndAI } from './combat_enemy.js';
import { stepTokens } from './token.js';
import { stepEncounter } from './encounter.js';

export function stepCrowd(combat, aiRng) {
  stepTokens(combat.tokenSystem, combat.enemies, combat.player, aiRng);
  combat.enemies.forEach(enemy => stepEnemyMovementAndAI(combat, enemy, aiRng));
  stepEncounter(combat, combat.encounter, combat.spawnOpts, combat.encounterRng);
}
