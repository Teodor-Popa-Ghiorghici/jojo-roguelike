/* npm run replay -- <file.json>
   Reruns a recorded replay headlessly (replay.js's buildCombatFromHeader
   + the same input log) and asserts the fresh run's final state and
   per-second checkpoints match what was recorded. On a match, prints one
   OK line. On divergence, prints the seed and the first checkpoint frame
   where the two runs disagree -- the number the mission brief calls "the
   most valuable number in this entire phase" -- and nothing else. */

import { readFileSync } from 'node:fs';
import { replayRun, firstDivergence } from '../replay.js';

const file = process.argv[2];
if (!file) {
  console.log('usage: npm run replay -- <replay.json>');
  process.exit(1);
}

const replayData = JSON.parse(readFileSync(file, 'utf8'));
const fresh = replayRun(replayData);
const div = firstDivergence(replayData.checkpoints, fresh.checkpoints);

const finalMatches = replayData.final &&
  replayData.final.frame === fresh.final.frame &&
  replayData.final.outcome === fresh.final.outcome &&
  replayData.final.playerHp === fresh.final.playerHp &&
  replayData.final.enemyHp === fresh.final.enemyHp;

if (div == null && finalMatches) {
  console.log(`OK   replay ${file}: seed=${replayData.header.seed} frame=${fresh.final.frame} outcome=${fresh.final.outcome} -- matches recorded state`);
} else {
  console.log(`FAIL replay ${file}: seed=${replayData.header.seed}`);
  if (div != null) console.log(`  first divergent checkpoint frame: ${div} (checksum window ${div}-${div + 59})`);
  if (!finalMatches) {
    console.log(`  recorded final: ${JSON.stringify(replayData.final)}`);
    console.log(`  fresh final:    ${JSON.stringify(fresh.final)}`);
  }
  process.exit(1);
}
