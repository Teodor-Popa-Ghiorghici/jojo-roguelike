/* Bizarre Encounter events — split out of data.js (Phase 9d, 300-line
   cap). Every choice still routes into the same Fragment-offer/heal flow
   run_flow.js's applyEventChoice already generalizes (Phase 7); a new
   event is text plus that same two-choice shape, never a new resolution
   path. One new event per Act (Phase 9d) so a 2-3-Bizarre-Encounter-node
   run doesn't repeat the same flavour text across Acts. */

export const EVENTS = {
  stray_cat: {
    title: 'BIZARRE ENCOUNTER',
    text: 'A cat watches you from the alley mouth. Its front paw glints — not fur. Metal.',
    choices: [
      { label: 'PET IT', kind: 'fragment', flavor: 'The cat purrs static. Something in your Stand feels sharper.' },
      { label: 'WALK AWAY', kind: 'heal', amount: 12, flavor: 'Nothing happens. You catch your breath instead.' }
    ]
  },
  vending_machine: {
    title: 'BIZARRE ENCOUNTER',
    text: 'A vending machine hums a tune that was never recorded. It takes no coins, only intent.',
    choices: [
      { label: 'FEED IT INTENT', kind: 'fragment', flavor: 'Something drops. It was never in the machine to begin with.' },
      { label: 'UNPLUG IT', kind: 'heal', amount: 12, flavor: 'The hum stops. You feel steadier for it.' }
    ]
  },
  rokakaka_stand: {
    title: 'BIZARRE ENCOUNTER',
    text: 'A fruit stand sells something that looks like a durian but definitely isn’t.',
    choices: [
      { label: 'TASTE IT', kind: 'fragment', flavor: 'The world resets by exactly one wrong decision. Yours, apparently.' },
      { label: 'WALK ON', kind: 'heal', amount: 12, flavor: 'Morioh stays quiet. You keep walking.' }
    ]
  },
  cairo_market_stall: {
    title: 'BIZARRE ENCOUNTER',
    text: 'A market stall sells medallions engraved with a face you almost recognize. The vendor won’t meet your eyes.',
    choices: [
      { label: 'BUY ONE', kind: 'fragment', flavor: 'The medallion warms in your hand, then goes still. You feel changed.' },
      { label: 'KEEP WALKING', kind: 'heal', amount: 12, flavor: 'The desert wind covers your tracks. You breathe easier.' }
    ]
  },
  sphinx_riddle: {
    title: 'BIZARRE ENCOUNTER',
    text: 'A stone sphinx half-buried in sand asks you a riddle you already know the answer to, somehow.',
    choices: [
      { label: 'ANSWER IT', kind: 'fragment', flavor: 'The sand shifts. The sphinx exhales dust that was never air.' },
      { label: 'STAY SILENT', kind: 'heal', amount: 12, flavor: 'The sphinx settles back into the dune. You move on rested.' }
    ]
  },
  vineyard_shrine: {
    title: 'BIZARRE ENCOUNTER',
    text: 'A roadside shrine to a saint nobody in Naples can name. Someone has left today’s offering still warm.',
    choices: [
      { label: 'LEAVE AN OFFERING', kind: 'fragment', flavor: 'The candle gutters and relights itself. Something answers.' },
      { label: 'SAY A PRAYER', kind: 'heal', amount: 12, flavor: 'You feel, for a moment, genuinely watched over.' }
    ]
  },
  gondola_gambit: {
    title: 'BIZARRE ENCOUNTER',
    text: 'A boatman on a canal that shouldn’t connect to anything offers passage, for "something you won’t miss".',
    choices: [
      { label: 'PAY HIS PRICE', kind: 'fragment', flavor: 'You don’t remember what you gave him. Your Stand does.' },
      { label: 'DECLINE', kind: 'heal', amount: 12, flavor: 'He shrugs and poles away. You rest on the quiet bank.' }
    ]
  },
  reality_tear: {
    title: 'BIZARRE ENCOUNTER',
    text: 'A tear hangs in the air, showing a street that shouldn’t exist. Through it, another you is looking back.',
    choices: [
      { label: 'REACH THROUGH', kind: 'fragment', flavor: 'Your hand comes back different. So does the world, slightly.' },
      { label: 'LOOK AWAY', kind: 'heal', amount: 12, flavor: 'The tear closes. You’re not sure it was ever there.' }
    ]
  },
  echo_of_yourself: {
    title: 'BIZARRE ENCOUNTER',
    text: 'A fractured echo of your own Stand stands across from you, wearing your posture like a borrowed coat.',
    choices: [
      { label: 'MERGE WITH IT', kind: 'fragment', flavor: 'It steps into you and is gone. You feel briefly doubled, then whole.' },
      { label: 'WALK PAST IT', kind: 'heal', amount: 12, flavor: 'It fades without a sound. You feel, oddly, more yourself.' }
    ]
  }
};
