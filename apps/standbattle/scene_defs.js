/* Arena scene configs — split out of background.js (Phase 9d, repo's
   300-line cap) now that every Act has its own named arenas. Each entry
   only ever picks one of background.js's existing `kind` shapes
   (alley/street/park/store) with its own sky/sun/wall/ground/hazeTo
   palette -- render.md's "additive changes only" rule for this app's art
   code: a new Act gets a new mood via colour data, never new backdrop
   geometry code. `SCENE_LIGHT` (render.js) is the matching per-scene rim
   light, kept there since it's consumed at sprite-stamp time, not here. */

import { SKY, TOWN } from './palette.js';

export const SCENES = {
  alley: {
    sky: SKY.dusk, sunX: 0.22, sunY: 0.30, sun: '#FFD79B', lit: 0.55,
    walls: [TOWN.wallB, TOWN.wallA], ground: TOWN.road, kind: 'alley', hazeTo: '#5B3A7A'
  },
  street: {
    sky: SKY.dusk, sunX: 0.78, sunY: 0.36, sun: '#FFE6B0', lit: 0.4,
    walls: [TOWN.wallA, TOWN.wallB, TOWN.wallC], ground: TOWN.road, kind: 'street', hazeTo: '#9E4E76'
  },
  park: {
    sky: SKY.night, sunX: 0.7, sunY: 0.2, sun: '#EAF2FF', lit: 0.3,
    walls: [TOWN.wallC, TOWN.wallA], ground: TOWN.walk, kind: 'park', hazeTo: '#2C3C72'
  },
  store: {
    sky: SKY.night, sunX: 0.5, sunY: 0.18, sun: '#C8D8FF', lit: 0.85,
    walls: [TOWN.wallA, TOWN.wallC], ground: TOWN.walk, kind: 'store', hazeTo: '#1D2A55'
  },
  /* Act II -- Cairo pursuit (Stardust Crusaders). */
  bazaar: {
    sky: SKY.day, sunX: 0.7, sunY: 0.25, sun: '#FFE9B0', lit: 0.6,
    walls: [TOWN.wood, TOWN.wallB], ground: TOWN.road, kind: 'street', hazeTo: '#4C8BD0'
  },
  nile_docks: {
    sky: SKY.day, sunX: 0.25, sunY: 0.35, sun: '#FFDE8A', lit: 0.5,
    walls: [TOWN.wallC, TOWN.metal], ground: TOWN.walk, kind: 'alley', hazeTo: '#7FB3E4'
  },
  train_car: {
    sky: SKY.night, sunX: 0.5, sunY: 0.2, sun: '#C8D8FF', lit: 0.7,
    walls: [TOWN.metal, TOWN.wallA], ground: TOWN.walk, kind: 'store', hazeTo: '#1D2A55'
  },
  /* Act III -- Naples vineyard (Golden Wind). */
  vineyard: {
    sky: SKY.dusk, sunX: 0.65, sunY: 0.25, sun: '#FFD79B', lit: 0.5,
    walls: [TOWN.wood, TOWN.leaf], ground: TOWN.walk, kind: 'park', hazeTo: '#D97A63'
  },
  piazza: {
    sky: SKY.dusk, sunX: 0.3, sunY: 0.3, sun: '#F2A96A', lit: 0.55,
    walls: [TOWN.wallB, TOWN.wood], ground: TOWN.road, kind: 'street', hazeTo: '#9E4E76'
  },
  villa: {
    sky: SKY.night, sunX: 0.5, sunY: 0.2, sun: '#FFC2D8', lit: 0.8,
    walls: [TOWN.neon, TOWN.wallA], ground: TOWN.walk, kind: 'store', hazeTo: '#2C3C72'
  },
  /* Act IV -- reality-warped finale. */
  ruin: {
    sky: SKY.storm, sunX: 0.5, sunY: 0.3, sun: '#828DAB', lit: 0.35,
    walls: [TOWN.wallC, TOWN.metal], ground: TOWN.road, kind: 'alley', hazeTo: '#353F5E'
  },
  voidscape: {
    sky: SKY.storm, sunX: 0.5, sunY: 0.18, sun: '#FFFFFF', lit: 0.9,
    walls: [TOWN.metal, TOWN.wallC], ground: TOWN.walk, kind: 'store', hazeTo: '#161B2C'
  },
  throneroom: {
    sky: SKY.night, sunX: 0.5, sunY: 0.15, sun: '#FFFFFF', lit: 0.4,
    walls: [TOWN.wallA, TOWN.neon], ground: TOWN.walk, kind: 'park', hazeTo: '#04060F'
  }
};
