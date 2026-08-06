/* Act variants -- GDD §5.5: "2-3 unlockable layout/theming variants per
   Act (Morioh Day/Night/Rain), each with a different enemy weighting,
   hazard set and one exclusive Rule Fight. Unlocked via the Archive."

   Pure data + a pure transform (`applyActVariant`), the same shape
   map_data.js's own `weightOf`/`LEAN_MULT` already use for lean-driven
   weighting -- a variant is one more multiplier table over the exact same
   BASE_WEIGHT axis, never a second map generator. `exclusiveRuleFight`
   points at one of Phase 11-B's 8 `rule_fights.js`/`rule_fights_2.js` ids
   wrapped around that Act's own roster (data_encounters.js can wrap any
   enemy in any of the 8 -- see budogaoka_sheer_heart_attack etc. for the
   pattern), so "exclusive" content is a pool-membership rule, not new
   rule code.

   Known gap, same shape as Phase 10's Requiems: no Archive unlock entry
   or run-start variant picker consumes this table yet (map_gen.js's
   generateActMap takes an Act number, not a variant id) -- content-
   complete, not run-reachable. Flagged in the phase report, not silently
   dropped. */

export const ACT_VARIANTS = {
  1: [
    { id: 'morioh_day', label: 'MORIOH -- DAY', enemyWeightMult: { combat: 1, elite: 1, event: 1 }, hazardSet: 'none', exclusiveRuleFight: 'rf_baby_face' },
    { id: 'morioh_night', label: 'MORIOH -- NIGHT', enemyWeightMult: { combat: 1.2, elite: 1.4, event: 0.8 }, hazardSet: 'streetlamp_flicker', exclusiveRuleFight: 'rf_cheap_trick' },
    { id: 'morioh_rain', label: 'MORIOH -- RAIN', enemyWeightMult: { combat: 0.9, elite: 1, event: 1.3 }, hazardSet: 'slick_road', exclusiveRuleFight: 'rf_illusos_mirror' }
  ],
  2: [
    { id: 'cairo_day', label: 'CAIRO -- DAY', enemyWeightMult: { combat: 1, elite: 1, event: 1 }, hazardSet: 'none', exclusiveRuleFight: 'rf_sheer_heart_attack' },
    { id: 'cairo_dust_storm', label: 'CAIRO -- DUST STORM', enemyWeightMult: { combat: 1.15, elite: 1.2, event: 0.85 }, hazardSet: 'sandstorm', exclusiveRuleFight: 'rf_rolling_stones' }
  ],
  3: [
    { id: 'naples_day', label: 'NAPLES -- DAY', enemyWeightMult: { combat: 1, elite: 1, event: 1 }, hazardSet: 'none', exclusiveRuleFight: 'rf_formaggios_shrink' },
    { id: 'naples_vineyard_dusk', label: 'NAPLES -- VINEYARD DUSK', enemyWeightMult: { combat: 0.95, elite: 1.3, event: 1.1 }, hazardSet: 'grapevine_snare', exclusiveRuleFight: 'rf_yellow_temperance' }
  ],
  4: [
    { id: 'gauntlet_prime', label: 'THE GAUNTLET -- PRIME', enemyWeightMult: { combat: 1, elite: 1, event: 1 }, hazardSet: 'none', exclusiveRuleFight: 'rf_bites_the_dust' },
    { id: 'gauntlet_fractured', label: 'THE GAUNTLET -- FRACTURED TIME', enemyWeightMult: { combat: 1.25, elite: 1.5, event: 0.7 }, hazardSet: 'reality_tear', exclusiveRuleFight: 'rf_bites_the_dust' }
  ]
};

/* Returns a NEW config (never mutates `cfg`) with combat/elite/event
   weight multipliers folded in on top of whatever lean multiplier a path
   already applies -- map_data.js's `weightOf(type, lean)` would become
   `weightOf(type, lean) * variantMult(type)` if a caller threaded a
   variant through; unconsumed today (see the gap note above), kept pure
   so wiring it in later is a one-line change at that call site. */
export function applyActVariant(cfg, actNumber, variantId) {
  const variant = (ACT_VARIANTS[actNumber] || []).find(v => v.id === variantId);
  if (!variant) return cfg;
  return { ...cfg, variantId, variantLabel: variant.label, enemyWeightMult: variant.enemyWeightMult, hazardSet: variant.hazardSet };
}
