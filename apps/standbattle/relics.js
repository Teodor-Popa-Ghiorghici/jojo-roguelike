/* Relics — GDD §6.3, tech §3's schema. Phase 10. Aggregator over
   content/relics/<theme>.js batches, same split-by-file discipline
   fragments.js established -- ~55 curated, no slot/level (binary owned/
   not-owned; content_registry.js's installRelic installs a relic's
   clauses unconditionally once owned, see combat.js/relic_offers.js). */

import { RELICS_POWER_RISK } from './content/relics/power_risk.js';
import { RELICS_DEFENSE_SURVIVAL } from './content/relics/defense_survival.js';
import { RELICS_ECONOMY_SHOP } from './content/relics/economy_shop.js';
import { RELICS_MOBILITY_UTILITY } from './content/relics/mobility_utility.js';
import { RELICS_CROWD_ELITE } from './content/relics/crowd_elite.js';
import { RELICS_BUILD_SYNERGY } from './content/relics/build_synergy.js';

export const RELIC_LIST = [
  ...RELICS_POWER_RISK, ...RELICS_DEFENSE_SURVIVAL, ...RELICS_ECONOMY_SHOP,
  ...RELICS_MOBILITY_UTILITY, ...RELICS_CROWD_ELITE, ...RELICS_BUILD_SYNERGY
];

export const RELICS = Object.fromEntries(RELIC_LIST.map(r => [r.id, r]));

/* Schema (tech §3's own Relic example, plus `desc` -- tech §3 didn't need
   one since no reward-card UI existed yet to read it; rewards.js's
   Treasure-offer card does now, the same role Fragments' `levelDesc`
   plays): { id, name, rarity, desc, tags, tradeoff?, effects[], queries[] }.
   No `donor`/`slot`/levels -- Relics are the one pool with neither. */
