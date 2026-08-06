/* Stand Bonds — GDD §9.3. Pure data: one 9-beat relationship track per
   playable Stand, advanced by USING that Stand across runs (clearing acts,
   hitting milestones, and dying in particular ways), never by a currency
   the player spends. Beat 9 hands over that Stand's Keepsake, defined in
   keepsakes.js -- a sidegrade Relic, so a completed Bond changes how a run
   opens without making it stronger (spec §7's no-power-creep rule).

   Counters are cumulative ACROSS runs and scoped per Stand; the nine the
   trigger vocabulary allows are:
     runsWithStand, actsClearedWithStand, winsWithStand, lossesWithStand,
     bossKillsWithStand, perfectClashesWithStand, flawlessNodesWithStand,
     menaceBestWithStand, nodesClearedWithStand
   `op` is '>=' | '>' | '=='. Exactly one clause per beat -- a Bond beat is
   a milestone, not a puzzle, so there is deliberately no and/or grammar to
   author against (and nothing here needs one).

   Pacing target: beat 1 fires almost immediately and beat 9 sits around
   28 runs' worth of play, with the intermediate beats at roughly
   2/4/6/9/12/16/21 runs. Which counter carries each beat varies per track
   so two Stands never advance on the same schedule -- Silver Chariot pays
   in Perfect Clashes, Killer Queen in deaths, Crazy Diamond in nodes. */

const COUNTERS = Object.freeze([
  'runsWithStand', 'actsClearedWithStand', 'winsWithStand', 'lossesWithStand',
  'bossKillsWithStand', 'perfectClashesWithStand', 'flawlessNodesWithStand',
  'menaceBestWithStand', 'nodesClearedWithStand'
]);
export const BOND_COUNTERS = COUNTERS;

/* 'lossesWithStand>=3' -> { counter, op, value }. Authoring shorthand only:
   every beat below still stores the same three-field trigger object the
   Bond evaluator reads, and an unknown counter throws at import time
   rather than silently never firing. */
function T(spec) {
  const m = /^([A-Za-z]+)(>=|==|>)(\d+)$/.exec(spec);
  if (!m || !COUNTERS.includes(m[1])) throw new Error(`[bonds] bad trigger "${spec}"`);
  return Object.freeze({ counter: m[1], op: m[2], value: Number(m[3]) });
}

function b(id, index, spec, speaker, lines, keepsake) {
  const beat = { id, index, trigger: T(spec), speaker, lines: Object.freeze(lines) };
  if (keepsake) beat.keepsake = keepsake;
  return Object.freeze(beat);
}

export const BOND_TRACKS = Object.freeze({
  /* Jotaro Kujo — terse, stoic, hides that he cares. Says the important
     thing last, in the fewest words that will carry it. */
  star_platinum: Object.freeze([
    b('bond_sp_1', 1, 'runsWithStand>=1', 'JOTARO',
      ['Yare yare daze. You again.', "Don't slow me down and we'll get along."]),
    b('bond_sp_2', 2, 'nodesClearedWithStand>=8', 'JOTARO',
      ["You keep your guard where I'd put it.", 'Good. Fewer things I have to say twice.']),
    b('bond_sp_3', 3, 'lossesWithStand>=3', 'JOTARO',
      ['Three times down. You still walk back in.', "That's the part that matters."]),
    b('bond_sp_4', 4, 'actsClearedWithStand>=4', 'JOTARO',
      ["The Stand isn't the strong one. You are.", 'It only does what you already decided.']),
    b('bond_sp_5', 5, 'perfectClashesWithStand>=25', 'JOTARO',
      ['You read that punch before I threw it.', "That isn't reflex anymore."]),
    b('bond_sp_6', 6, 'winsWithStand>=2', 'JOTARO',
      ['My grandfather crossed the world for my mother.', 'I never told him it mattered. It did.']),
    b('bond_sp_7', 7, 'flawlessNodesWithStand>=16', 'JOTARO',
      ['Not a scratch on you all night. Show-off.', "...Don't stop."]),
    b('bond_sp_8', 8, 'bossKillsWithStand>=5', 'JOTARO',
      ["Killing a monster doesn't make you clean.", 'It means somebody else gets home. Enough.']),
    b('bond_sp_9', 9, 'runsWithStand>=28', 'JOTARO',
      ["Take the cap. It's heavy and it hides your eyes.", 'People stop reading you. Worth something.',
        "Yare yare daze. Don't lose it."], 'keepsake_sp_cap')
  ]),

  /* Jean Pierre Polnareff — loud, warm, tragic. Every compliment is at
     full volume; the grief arrives mid-sentence and he keeps going. */
  silver_chariot: Object.freeze([
    b('bond_sc_1', 1, 'runsWithStand>=1', 'POLNAREFF',
      ['Ohh, a new partner! Excellent, excellent!', 'Silver Chariot salutes you. En garde!']),
    b('bond_sc_2', 2, 'perfectClashesWithStand>=6', 'POLNAREFF',
      ['Your footwork is terrible and I love it!', 'Speed first, form second. Chariot will teach you.']),
    b('bond_sc_3', 3, 'nodesClearedWithStand>=16', 'POLNAREFF',
      ['You know why I fence? Because it is honest.', 'A blade tells the truth faster than a mouth.']),
    b('bond_sc_4', 4, 'lossesWithStand>=5', 'POLNAREFF',
      ['Five times I have carried you out of there.', 'I do not mind. I have carried worse.',
        'I have carried people who did not get up.']),
    b('bond_sc_5', 5, 'perfectClashesWithStand>=28', 'POLNAREFF',
      ['THAT! That parry! Magnifique!', 'Chariot has not sung like that in years.']),
    b('bond_sc_6', 6, 'actsClearedWithStand>=8', 'POLNAREFF',
      ['I had a sister. He had two right hands.', 'I chased him for years. Do not ask if it helped.']),
    b('bond_sc_7', 7, 'winsWithStand>=3', 'POLNAREFF',
      ['Revenge is a long road with a short ending.', 'You gave me somewhere else to walk. Merci.']),
    b('bond_sc_8', 8, 'flawlessNodesWithStand>=22', 'POLNAREFF',
      ['Untouched again! Chariot is showing off!', 'Let him. He earned it. So did you.']),
    b('bond_sc_9', 9, 'perfectClashesWithStand>=90', 'POLNAREFF',
      ['Here. Chariot armor. He does not need it now.', 'Without it, nothing alive is faster than him.',
        'He also bruises. Choose knowingly, mon ami.'], 'keepsake_sc_armor')
  ]),

  /* Noriaki Kakyoin — precise, watchful, lonely. Counts things nobody
     asked him to count; that IS the affection. */
  hierophant_green: Object.freeze([
    b('bond_hg_1', 1, 'runsWithStand>=1', 'KAKYOIN',
      ["I'll observe first. Don't take it personally.", 'Hierophant works best from a distance.']),
    b('bond_hg_2', 2, 'nodesClearedWithStand>=8', 'KAKYOIN',
      ['Your third step always drifts left.', "I've mapped it. It won't kill you while I watch."]),
    b('bond_hg_3', 3, 'flawlessNodesWithStand>=4', 'KAKYOIN',
      ['Clean. Not lucky - clean.', "I can tell the difference. Most people can't."]),
    b('bond_hg_4', 4, 'lossesWithStand>=5', 'KAKYOIN',
      ['You died because you closed the distance.', 'I did that too, when the quiet frightened me.']),
    b('bond_hg_5', 5, 'actsClearedWithStand>=6', 'KAKYOIN',
      ['I spent years pretending I had friends.', 'The emeralds were easier. They never asked.']),
    b('bond_hg_6', 6, 'menaceBestWithStand>=3', 'KAKYOIN',
      ['You chose the harder road on purpose.', 'So did I once. It was my first honest act.']),
    b('bond_hg_7', 7, 'winsWithStand>=3', 'KAKYOIN',
      ["We're a good pair. I don't say that lightly.", "I've said it about exactly four people."]),
    b('bond_hg_8', 8, 'flawlessNodesWithStand>=21', 'KAKYOIN',
      ['Twenty-one nodes untouched. I counted.', "Of course I counted. That's what I'm for."]),
    b('bond_hg_9', 9, 'bossKillsWithStand>=6', 'KAKYOIN',
      ["Take the emerald. One only - I'm not sentimental.", 'It marks whatever you look at too long.',
        "The rest you'll have to hold by yourself."], 'keepsake_hg_emerald')
  ]),

  /* Yoshikage Kira — fastidious, quietly monstrous. Never raises his
     voice; the horror is that his standards are sincere. */
  killer_queen: Object.freeze([
    b('bond_kq_1', 1, 'runsWithStand>=1', 'KIRA',
      ['I did not ask for a partner.', 'Still. You are quiet. I can work with quiet.']),
    b('bond_kq_2', 2, 'nodesClearedWithStand>=9', 'KIRA',
      ['You clean your hands afterward. I noticed.', 'Most do not. It says something about you.']),
    b('bond_kq_3', 3, 'lossesWithStand>=4', 'KIRA',
      ['Death should be tidy. Yours was not.', 'Do it properly next time, or not at all.']),
    b('bond_kq_4', 4, 'winsWithStand>=1', 'KIRA',
      ['A victory. Fine. Do not celebrate loudly.', 'Attention is the only thing that ever hurt me.']),
    b('bond_kq_5', 5, 'actsClearedWithStand>=6', 'KIRA',
      ['My father kept my secret until he died.', 'That is the nearest thing to love I know.']),
    b('bond_kq_6', 6, 'bossKillsWithStand>=3', 'KIRA',
      ['You kill efficiently now. No wasted motion.', 'I would call it beautiful. I still might.']),
    b('bond_kq_7', 7, 'lossesWithStand>=12', 'KIRA',
      ['Twelve deaths, and you keep coming back.', 'I arranged my whole life to avoid one.']),
    b('bond_kq_8', 8, 'menaceBestWithStand>=4', 'KIRA',
      ['You court danger. I do not understand it.', 'I only ever wanted a quiet life. I still do.']),
    b('bond_kq_9', 9, 'winsWithStand>=6', 'KIRA',
      ["Take the ring. Sheer Heart Attack's trigger.", 'Touch a thing and it ends. That is all it does.',
        'It will not make you quiet. Nothing does.'], 'keepsake_kq_ring')
  ]),

  /* Josuke Higashikata — cheerful, fiercely loyal, physically incapable
     of leaving someone broken. (Do not mention the hair.) */
  crazy_diamond: Object.freeze([
    b('bond_cd_1', 1, 'runsWithStand>=1', 'JOSUKE',
      ['Yo! Josuke Higashikata. Nice to meet ya.', 'Crazy Diamond fixes stuff. Mostly people.']),
    b('bond_cd_2', 2, 'nodesClearedWithStand>=8', 'JOSUKE',
      ['You got knocked around pretty good back there.', "Hold still. DORARARA - and you're fine."]),
    b('bond_cd_3', 3, 'actsClearedWithStand>=3', 'JOSUKE',
      ["My town's full of weirdos I'd die for.", "Guess you're on the list now. Congrats."]),
    b('bond_cd_4', 4, 'lossesWithStand>=5', 'JOSUKE',
      ['I can put a wall back together. Not a person.', "That's the one rule. I hate that rule."]),
    b('bond_cd_5', 5, 'flawlessNodesWithStand>=9', 'JOSUKE',
      ['Not a scratch! See, this is what I mean!', "Keep it up and I've got nothing to do."]),
    b('bond_cd_6', 6, 'winsWithStand>=2', 'JOSUKE',
      ['A guy in a student uniform saved my life once.', "Never got his name. I've been paying it back."]),
    b('bond_cd_7', 7, 'nodesClearedWithStand>=64', 'JOSUKE',
      ['Notice we only ever stop when someone is hurt?', "That's a good habit. Don't lose it."]),
    b('bond_cd_8', 8, 'bossKillsWithStand>=5', 'JOSUKE',
      ["Beating a monster doesn't fix the town.", 'Showing up tomorrow does. So show up.']),
    b('bond_cd_9', 9, 'actsClearedWithStand>=20', 'JOSUKE',
      ["Here - a piece of the thing I couldn't fix.", 'Crazy Diamond mends it out of your own steam.',
        'Costs you. Everything good does. Take it.'], 'keepsake_cd_shard')
  ]),

  /* Giorno Giovanna — calm, immovable conviction. Never argues, never
     hurries, and has already decided. */
  gold_experience: Object.freeze([
    b('bond_ge_1', 1, 'runsWithStand>=1', 'GIORNO',
      ['I have a dream. You need not share it.', 'Only walk beside it, for now.']),
    b('bond_ge_2', 2, 'actsClearedWithStand>=2', 'GIORNO',
      ['You hesitated. That is not weakness.', 'It is the moment before a decision. Use it.']),
    b('bond_ge_3', 3, 'nodesClearedWithStand>=16', 'GIORNO',
      ['Gold Experience creates life. Nothing else.', 'What it destroys, it destroys reluctantly.']),
    b('bond_ge_4', 4, 'lossesWithStand>=5', 'GIORNO',
      ['You have fallen again. Stand up slowly.', 'A resolve that is rushed is not resolve.']),
    b('bond_ge_5', 5, 'winsWithStand>=1', 'GIORNO',
      ['I was a child no one ever thanked.', "One stranger's kindness chose who I became."]),
    b('bond_ge_6', 6, 'bossKillsWithStand>=3', 'GIORNO',
      ['I do not enjoy this. I never have.', 'But I will not hand the work to someone kinder.']),
    b('bond_ge_7', 7, 'menaceBestWithStand>=4', 'GIORNO',
      ['You take the harder road unasked.', 'It is the only qualification I have cared about.']),
    b('bond_ge_8', 8, 'winsWithStand>=4', 'GIORNO',
      ['This is not a gang. It is a promise.', 'You have kept yours four times now.']),
    b('bond_ge_9', 9, 'runsWithStand>=28', 'GIORNO',
      ['Take this. A ladybug - alive, stubbornly so.', 'It will give life back to you, slowly.',
        'It will refuse to help you kill. Deliberate.'], 'keepsake_ge_ladybug')
  ]),

  /* Bruno Bucciarati — dutiful, protective, morally exact. States the
     cost out loud, including his own. */
  sticky_fingers: Object.freeze([
    b('bond_sf_1', 1, 'runsWithStand>=1', 'BUCCIARATI',
      ['Arrivederci to whoever you were before.', 'From here, you answer for what you do.']),
    b('bond_sf_2', 2, 'nodesClearedWithStand>=8', 'BUCCIARATI',
      ['You stepped in front of someone. I saw it.', 'Do that again and we will get along.']),
    b('bond_sf_3', 3, 'flawlessNodesWithStand>=4', 'BUCCIARATI',
      ['Untouched. Good - the wounded slow a team.', 'And I am the one who carries them.']),
    b('bond_sf_4', 4, 'actsClearedWithStand>=4', 'BUCCIARATI',
      ['This taste in my mouth means someone lied.', 'It has never once been wrong. It is tiring.']),
    b('bond_sf_5', 5, 'lossesWithStand>=7', 'BUCCIARATI',
      ['You have died seven times for other people.', 'I will not call it noble. I call it correct.']),
    b('bond_sf_6', 6, 'winsWithStand>=2', 'BUCCIARATI',
      ['I sold poison once, to feed my neighbourhood.', 'There is no version where I was clean.']),
    b('bond_sf_7', 7, 'perfectClashesWithStand>=48', 'BUCCIARATI',
      ["Your timing is a soldier's now.", 'I would have taken you into my squad. Gladly.']),
    b('bond_sf_8', 8, 'flawlessNodesWithStand>=21', 'BUCCIARATI',
      ['You keep everyone standing. Even me.', 'No one has done that since my father.']),
    b('bond_sf_9', 9, 'bossKillsWithStand>=6', 'BUCCIARATI',
      ['Take the zipper. It opens what should stay shut.', 'You will move faster than a man should.',
        'It costs you every time. Pay it honestly.'], 'keepsake_sf_zipper')
  ]),

  /* Joseph Joestar — brash, theatrical, and considerably craftier and
     older than the volume suggests. The bragging is load-bearing. */
  hermit_purple: Object.freeze([
    b('bond_hp_1', 1, 'runsWithStand>=1', 'JOSEPH',
      ['HA! A partner! Your next line is: who are you?', 'Joseph Joestar! Hermit Purple, at your service!']),
    b('bond_hp_2', 2, 'runsWithStand>=2', 'JOSEPH',
      ['Back for a second round, huh? Good.', 'Anyone is brave once. Twice is a personality.']),
    b('bond_hp_3', 3, 'lossesWithStand>=3', 'JOSEPH',
      ['You lost! Big deal, I lose constantly.', 'The trick is losing in a direction you picked.']),
    b('bond_hp_4', 4, 'nodesClearedWithStand>=24', 'JOSEPH',
      ['Hermit Purple is a lousy fighting Stand.', 'It is a magnificent cheating Stand. Watch.']),
    b('bond_hp_5', 5, 'perfectClashesWithStand>=27', 'JOSEPH',
      ['Ohhh, nice! You clashed like you meant it!', 'Your next line is: I did mean it. HA!']),
    b('bond_hp_6', 6, 'actsClearedWithStand>=8', 'JOSEPH',
      ['Everyone thinks I win by being clever.', 'I win by running away until clever shows up.']),
    b('bond_hp_7', 7, 'winsWithStand>=3', 'JOSEPH',
      ['I lost people getting to where I stand now.', 'I make noise so I do not hear that part.']),
    b('bond_hp_8', 8, 'menaceBestWithStand>=5', 'JOSEPH',
      ['You pick fights above your weight class now.', 'Terrible instinct. Your best one. Keep it.']),
    b('bond_hp_9', 9, 'runsWithStand>=28', 'JOSEPH',
      ['Here. A length of my vine, still warm.', 'It shows what is coming. All of it, at once.',
        'You will read the future and trip over now.'], 'keepsake_hp_vine')
  ])
});

export const BOND_STANDS = Object.freeze(Object.keys(BOND_TRACKS));
