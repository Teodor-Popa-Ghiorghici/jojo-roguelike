/* The Archive tree — Track A data (GDD §9.1, §19). 34 nodes, 4,295 Fate
   total, front-loaded hard: 16 of the 34 sit in tier 1 at 40-80 Fate,
   against GDD §19's "average run ~= 60 Fate", so something opens roughly
   every 1-2 runs for the first ten hours and every 3-4 after that.

   Node schema -- and note what is absent:
     { id, tier, cost, name, desc, requires: [nodeId], grants: [{kind, id}] }
   `cost` and `tier` are the ONLY numeric fields a node may carry;
   meta_check.js's checkArchiveNodes() walks every entry and fails the
   build on a number anywhere else, which is what makes "nothing here
   makes a number bigger" (GDD §9.1) a property of the data rather than a
   promise in a comment. Every grant is a kind from
   meta_archive.js's ARCHIVE_GRANT_KINDS and an id that must resolve to
   real content -- checkGrantTargets() enforces that too.

   The six new donors are the growth engine: each adds 6-8 Fragments to
   the reward pool (content/donors_*.js), and the last of them sits in
   tier 3, so the pool is still expanding at run 45 exactly as §19 asks.
   Options at equal power, never power. */

export const ARCHIVE_NODES = Object.freeze([
  /* ---- TIER 1 -- 40-80 Fate, 895 total. Runs ~2-16, one every run or two. ---- */
  { id: 'aspect_sp_2', tier: 1, cost: 40, name: 'STAR FINGER', desc: 'An Aspect for Star Platinum.', requires: [], grants: [{ kind: 'aspect', id: 'sp_star_finger' }] },
  { id: 'aspect_sc_2', tier: 1, cost: 40, name: 'RICOCHET', desc: 'An Aspect for Silver Chariot.', requires: [], grants: [{ kind: 'aspect', id: 'sc_ricochet' }] },
  { id: 'aspect_hg_2', tier: 1, cost: 40, name: 'EMERALD LATTICE', desc: 'An Aspect for Hierophant Green.', requires: [], grants: [{ kind: 'aspect', id: 'hg_emerald_lattice' }] },
  { id: 'aspect_kq_2', tier: 1, cost: 45, name: 'THIRD BOMB', desc: 'An Aspect for Killer Queen.', requires: [], grants: [{ kind: 'aspect', id: 'kq_third_bomb' }] },
  { id: 'donor_aerosmith', tier: 1, cost: 45, name: 'DONOR: AEROSMITH', desc: 'Seven Fragments enter the pool. Carbon-dioxide tracking.', requires: [], grants: [{ kind: 'donor', id: 'aerosmith' }] },
  { id: 'donor_six_pistols', tier: 1, cost: 50, name: 'DONOR: SEX PISTOLS', desc: 'Seven Fragments enter the pool. Six little helpers.', requires: [], grants: [{ kind: 'donor', id: 'six_pistols' }] },
  { id: 'node_duel', tier: 1, cost: 50, name: 'DUEL NODE', desc: 'A one-on-one node type joins the map pool.', requires: [], grants: [{ kind: 'nodeType', id: 'duel' }] },
  { id: 'hud_databook', tier: 1, cost: 55, name: 'DATABOOK HUD', desc: 'An alternate HUD skin.', requires: [], grants: [{ kind: 'hudSkin', id: 'databook' }] },
  { id: 'cosmetic_title_case', tier: 1, cost: 55, name: 'TITLE CASE', desc: 'Your earned titles display in the hub.', requires: [], grants: [{ kind: 'cosmetic', id: 'title_case' }] },
  { id: 'hub_rooftop', tier: 1, cost: 60, name: 'THE ROOFTOP', desc: 'A hub scene: the safehouse roof, and who waits there.', requires: [], grants: [{ kind: 'hubScene', id: 'rooftop' }] },
  { id: 'aspect_sp_3', tier: 1, cost: 60, name: 'TIME THIEF', desc: 'A second Aspect for Star Platinum.', requires: ['aspect_sp_2'], grants: [{ kind: 'aspect', id: 'sp_time_thief' }] },
  { id: 'aspect_sc_3', tier: 1, cost: 65, name: 'ARMOUR OFF', desc: 'A second Aspect for Silver Chariot.', requires: ['aspect_sc_2'], grants: [{ kind: 'aspect', id: 'sc_armour_off' }] },
  { id: 'donor_moody_blues', tier: 1, cost: 65, name: 'DONOR: MOODY BLUES', desc: 'Seven Fragments enter the pool. Replay what already happened.', requires: ['donor_aerosmith'], grants: [{ kind: 'donor', id: 'moody_blues' }] },
  { id: 'cosmetic_arrow_cursor', tier: 1, cost: 70, name: 'THE ARROW', desc: 'A cosmetic cursor.', requires: [], grants: [{ kind: 'cosmetic', id: 'arrow_cursor' }] },
  { id: 'aspect_hg_3', tier: 1, cost: 75, name: 'BARRIER', desc: 'A second Aspect for Hierophant Green.', requires: ['aspect_hg_2'], grants: [{ kind: 'aspect', id: 'hg_barrier' }] },
  { id: 'aspect_kq_3', tier: 1, cost: 80, name: 'SHEER HEART ATTACK', desc: 'A second Aspect for Killer Queen.', requires: ['aspect_kq_2'], grants: [{ kind: 'aspect', id: 'kq_sheer_heart' }] },

  /* ---- TIER 2 -- 100-160 Fate, 1,130 total. Runs ~17-35. ---- */
  { id: 'donor_white_album', tier: 2, cost: 100, name: 'DONOR: WHITE ALBUM', desc: 'Seven Fragments enter the pool. Absolute zero.', requires: ['donor_six_pistols'], grants: [{ kind: 'donor', id: 'white_album' }] },
  { id: 'donor_harvest', tier: 2, cost: 100, name: 'DONOR: HARVEST', desc: 'Seven Fragments enter the pool. A thousand small hands.', requires: ['donor_moody_blues'], grants: [{ kind: 'donor', id: 'harvest' }] },
  { id: 'node_gamble', tier: 2, cost: 110, name: 'GAMBLE NODE', desc: 'A risk-for-reward node type joins the map pool.', requires: ['node_duel'], grants: [{ kind: 'nodeType', id: 'gamble' }] },
  { id: 'act_variant_ii', tier: 2, cost: 120, name: 'MORIOH BY NIGHT', desc: 'An alternate layout and roster for Act II.', requires: [], grants: [{ kind: 'actVariant', id: 'act2_night' }] },
  { id: 'act_variant_iii', tier: 2, cost: 120, name: 'THE STORM ROAD', desc: 'An alternate layout and roster for Act III.', requires: ['act_variant_ii'], grants: [{ kind: 'actVariant', id: 'act3_storm' }] },
  { id: 'hub_bond_annex', tier: 2, cost: 130, name: 'THE ANNEX', desc: 'A hub scene: the room where the Stands wait.', requires: ['hub_rooftop'], grants: [{ kind: 'hubScene', id: 'bond_annex' }] },
  { id: 'aspect_sp_4', tier: 2, cost: 140, name: 'THE WORLD ECHO', desc: 'The last Aspect for Star Platinum.', requires: ['aspect_sp_3'], grants: [{ kind: 'aspect', id: 'sp_world_echo' }] },
  { id: 'stand_gold_experience', tier: 2, cost: 150, name: 'GIORNO GIOVANNA', desc: 'Gold Experience joins the rack.', requires: ['donor_six_pistols'], grants: [{ kind: 'stand', id: 'gold_experience' }] },
  { id: 'stand_crazy_diamond', tier: 2, cost: 160, name: 'JOSUKE HIGASHIKATA', desc: 'Crazy Diamond joins the rack.', requires: ['donor_aerosmith'], grants: [{ kind: 'stand', id: 'crazy_diamond' }] },

  /* ---- TIER 3 -- 200-280 Fate, 1,310 total. Runs ~36-60. The pool is
     still growing here: donor_highway_star lands at run ~45. ---- */
  { id: 'donor_highway_star', tier: 3, cost: 200, name: 'DONOR: HIGHWAY STAR', desc: 'Seven Fragments enter the pool. It never stops following.', requires: ['donor_white_album'], grants: [{ kind: 'donor', id: 'highway_star' }] },
  { id: 'aspect_sc_4', tier: 3, cost: 200, name: 'REQUIEM STANCE', desc: 'The last Aspect for Silver Chariot.', requires: ['aspect_sc_3'], grants: [{ kind: 'aspect', id: 'sc_requiem_stance' }] },
  { id: 'act_variant_iv', tier: 3, cost: 210, name: 'THE GREEN BABY', desc: 'An alternate layout and roster for Act IV.', requires: ['act_variant_iii'], grants: [{ kind: 'actVariant', id: 'act4_heaven' }] },
  { id: 'node_arrow_shrine', tier: 3, cost: 220, name: 'ARROW SHRINE', desc: 'A Requiem-adjacent node type joins the map pool.', requires: ['node_gamble'], grants: [{ kind: 'nodeType', id: 'arrow_shrine' }] },
  { id: 'stand_hermit_purple', tier: 3, cost: 230, name: 'JOSEPH JOESTAR', desc: 'Hermit Purple joins the rack.', requires: ['stand_gold_experience'], grants: [{ kind: 'stand', id: 'hermit_purple' }] },
  { id: 'stand_sticky_fingers', tier: 3, cost: 250, name: 'BRUNO BUCCIARATI', desc: 'Sticky Fingers joins the rack.', requires: ['stand_crazy_diamond'], grants: [{ kind: 'stand', id: 'sticky_fingers' }] },

  /* ---- TIER 4 -- 300-400 Fate, 960 total. Runs ~61+. ---- */
  { id: 'aspect_hg_4', tier: 4, cost: 300, name: 'HIEROPHANT TRAP', desc: 'The last Aspect for Hierophant Green.', requires: ['aspect_hg_3'], grants: [{ kind: 'aspect', id: 'hg_hierophant_trap' }] },
  { id: 'aspect_kq_4', tier: 4, cost: 320, name: 'BITES THE DUST', desc: 'The last Aspect for Killer Queen.', requires: ['aspect_kq_3'], grants: [{ kind: 'aspect', id: 'kq_bites_the_dust' }] },
  { id: 'hub_vault', tier: 4, cost: 340, name: 'THE VAULT', desc: 'A hub scene, a HUD skin and a cosmetic: the Foundation opens its archive properly.', requires: ['hub_bond_annex'], grants: [{ kind: 'hubScene', id: 'speedwagon_vault' }, { kind: 'hudSkin', id: 'stone_mask' }, { kind: 'cosmetic', id: 'vault_frame' }] }
]);

export const ARCHIVE_TOTAL_FATE = ARCHIVE_NODES.reduce((n, x) => n + x.cost, 0);
