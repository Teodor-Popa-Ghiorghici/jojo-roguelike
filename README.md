# HOLYTRON DM-640

A beige CRT with TempleOS inside it. One HTML file. Sixteen colours.

---

## Where this came from

TempleOS was written by Terry A. Davis, alone, over more than a decade, and
released into the public domain. He called it God's third temple. It ran in ring
0 with no network, no protection, no users but one. Every document was a program.
Every program could be edited where it sat. The whole thing — kernel, compiler,
editor, graphics, games, documentation — was held to 100,000 lines on purpose,
because he had decided that was what an operating system should cost. He died in
2018.

This is not that. It cannot boot, it cannot compile to machine code, and it does
not pretend otherwise. It is a replica built the way you'd build a model ship: to
understand the shape of the thing by making one, and to let someone who has only
ever read about it turn the knobs.

The choices that make TempleOS look the way it does were not decoration. 640×480
and sixteen colours because that is what every machine can do without a driver.
No anti-aliasing because a pixel is either lit or it isn't. One voice, one task
tree, one font. This build keeps that palette absolutely — the only thing allowed
off it is the plastic of the case, because plastic is not phosphor.

---

## What you're looking at

The monitor is the page. It isn't a picture of a computer sitting on a desk; the
case grows and shrinks with your browser window, and the beige is lit from the
upper left like injection-molded plastic under an office ceiling. The tube sits
in a recessed well behind glass with its own corner radius, wider than it is
tall, the way real glass is.

Underneath are the controls, and they all do something.

| Control | What it does |
|---|---|
| **LENS** | `FLAT` / `SOFT` / `FULL`. Bends the glass and the picture bends with it. The case, the well and the tube all deepen their corner radius to follow the same curve. `FULL` bends harder than the pointer can honestly track, and says so — it is there for screenshots. |
| **SCAN** | Scanline pitch in pixels, 0–4. `0` is off. |
| **DGAUSS** | Degausses. Hold it on a cold tube. |
| **PHOS** | Phosphor persistence: `P1` fast, `P4`, `P7` smearing. The same number widens the glow on lit characters *and* sets how little the canvas apps clear between frames, so the starfield, AfterEgypt and GodDoodle all drag their own tails. |
| **BURN** | Twenty years of the same menu bar ghosted into the coating. |
| **MUS** / **SFX** | Volume pots. Drag to turn, scroll, or use the arrow keys. |
| **VHLD** / **HHLD** | Vertical and horizontal hold. Both start locked at 5. Anything else and the picture rolls. |
| **LOBBY** | The hymn. Stays on while you use the desktop. |
| **POWER** | Really works. The tube collapses to a line and goes dark, and everything inside it stops. |

Knob positions are saved. The machine comes back the way you left it.

---

## Inside the tube

A boot POST counts the memory, nine boot lines scroll, and you land on a desktop.

**The desktop** has draggable icons that remember where you put them and refuse
to overlap — drop one on an occupied square and it spirals outwards to the
nearest free slot. Right-click for a context menu. Windows drag, resize, stack,
minimise to the taskbar, and are children of Seth.

**The editor** writes back into the file. Open `AutoExec.HC`, change it, close
it, open it again — your text is there, and `File > REVERT EDITED FILES` puts the
stock ones back.

**The terminal** is the compiler, because in HolyC those are the same program.
It walks the real file tree first and only falls through to canned answers for
things the tree doesn't claim.

```
DIR / LS        CD / CHDIR      TYPE / CAT      OPEN / RUN
DEL / RM        MD / MKDIR      TREE            PWD
COMPILE         MEM             BELL            CLS / CLEAR

NEOFETCH   UNAME   COWSAY   SL   FORTUNE   PING   SUDO
GODWORD [n]   GODDOODLE   GODSONG
TASKS   AFTEREGYPT   BEKKEDAL   MAGEN   COOK   STACK   NOTES   BOTTLE
ELEPHANT   DEFRAG   SAVER   CMOS   DEGAUSS   PANIC   LINES
```

Up-arrow walks back through history, and the history survives a reload. Every
command answers with exactly one sound, chosen from the loudest class of line it
printed — a verdict, not a stream of beeps.

`PING` and `CURL` are answered honestly: there is no network stack, and none was
ever written. `SUDO` points out you are already God. The fork bomb, in any
spelling, gets *THERE IS NO FORK. ONE ADDRESS SPACE. ONE RING. NOTHING TO
DOUBLE.*

`LINES` audits the file against Terry's 100,000-line budget and reports the
percentage spent.

`PANIC` drops you into the debugger with a register dump, because ring 0 has no
safety net — and so does any genuine uncaught exception anywhere in the build. A
crash here is not swallowed; it is displayed.

### HolyC

A real subset: tokeniser, recursive-descent parser, tree-walking evaluator. What
makes it HolyC rather than C is that a statement which is only a string prints
it, a format string takes its arguments as the rest of the statement, and a
function name on its own line is a call.

```c
"HELLO, TEMPLE.\n";              // this is a complete program

I64 i;
for (i = 0; i < 7; i++)
  "DAY %d\n", i;

GodWord;                          // same as GodWord()
```

`U0` `I64` `F64` `U8`, assignment, arithmetic, comparison, `&&` `||`, `if/else`,
`while`, `for`, blocks, function definitions, and calls with or without parens.
Built in: `Print`, `GodWord`, `GodDoodle`, `GodSong`, `Beep`, `BellRing`,
`Sleep`, `Rand`, `RandU16`, `StrLen`, `Cd`, `Dir`, `MemSet`, `Panic`, `Exit`.

`AutoExec.HC` really runs at boot, through this same interpreter. Break it and
the machine tells you which line.

### DolDoc

A document that is a program drawing itself. Commands sit between dollar signs
and take effect where they stand — colour as a command, a sprite sitting inside a
line of text, links and buttons as commands. This is the one thing about TempleOS
you genuinely cannot get anywhere else, which is why it got a real parser rather
than a nod.

```
$FG,14$$TX+CX,"HOLYC"$$FG$
$HL$
A bare string is a $FG,12$print$FG$. There is no main().
$SP,"cross"$ a sprite, in the middle of a line of prose.
$LK,"go to the kernel",A="::/Kernel/Kernel.DD"$
$MA,"RUN A LOOP",LM="I64 i; for(i=0;i<7;i++) \"DAY %d\\n\", i;"$
$TR,"A COLLAPSIBLE TREE"$
  ...contents...
$TR-$
```

Implemented: `FG` `BG` `BK` `UL` `ID` `HL` `TX` `SP` `LK` `MA` `CL` `TR`.
`$MA$` buttons run their `LM=` payload through the HolyC interpreter — the
document really is executable.

---

## The apps

Each one is a window, a child of Seth, and obeys the palette.



**Zen Garden** — twelve pots, eight species, a twenty-minute day. Plants grow
off wall-clock timestamps, so they keep growing while the window is shut and
while the machine is off; SUN tokens pile up on the shelf, capped at twenty, and
wait for you. Un-watered plants stop producing and never die. Nothing in this app
can be lost, which is the whole of its design. Each species is tuned to a
different note of a pentatonic scale, so poking them in any order is a tune.
After dark the fireflies come out and the nightpea starts paying.

---


## SUN

The six rooms are one machine because they share a currency.

`Economy` is a singleton with four methods — `balance`, `earn`, `spend`,
`onChange` — and everything in the build goes through it. The garden drops it
passively and keeps accruing at 40% while you are away. Sweeper pays 15/60/200
by difficulty plus a time bonus. Solitaire pays by move count. The Cook pays per
medal, once, the first time each one is earned — a bench already beaten is a
thing to come back to, not a tap to leave running. AfterEgypt pays 50 for
reaching the third temple, which is the one payout moment it already had.
Crayon pays nothing at all, on purpose: it is the one place on the machine that
is not keeping score, and neither does the Elephant, which has nothing to score.
Magen keeps its own books in mitzvot and is left alone: an incremental game with
a second currency bolted to the side of it is two games in one window.

The only sink is Dave. The counter in the taskbar rolls a digit at a time and the
sun sprite turns one revolution whenever it changes, and `ACCOUNT.EXE` — the
sun in the taskbar is the button — keeps the last fifty transactions with their
sources.

Everything bought is a look and nothing bought does anything. Frames replace the
plastic around the screen and tint the phosphor with it; logos replace the temple
on the boot splash; pointers are PNGs minted at boot from pixel arrays; schemes
recolour every terminal and dialog in the build. All four are CSS custom
properties on `#room` set by `Cos`, which is why the apps written before any of
it existed inherit all of it without one of them being edited.

Everything is written to `localStorage` under the same `templeos.*` namespace the
rest of the machine already used — one key per subsystem, debounced half a
second, defaults filled in for any key a save from before this update does not
carry. A key that will not parse is copied to `<key>.bak` and the machine says
`DISK ERROR` rather than starting over quietly. Typing `FORMAT` on the bare
desktop, with nothing focused, wipes all of it after asking once.

---


**To add a file or a folder, add a node to `FS` in section 2 and nothing else.**
Every icon, folder window, editor and viewer in the build is generated from that
one tree.

```js
{ name: "X",     type: "folder", children: [ /* more nodes */ ] }
{ name: "X.TXT", type: "text",   content: "the editable body text" }
{ name: "X.DD",  type: "doc",    content: "$FG,14$a DolDoc$FG$" }
{ name: "X.HC",  type: "code",   content: "\"HELLO\\n\";" }
{ name: "X.BMP", type: "image",  src: "data:... or https://..." }
{ name: "X",     type: "app",    app: "bekkedal" }
```

Nesting is arbitrary — folders inside folders inside folders all work. Edits made
in a text window write back into this object. To add an app, write an
`openThing()` and add one line to `runApp()` in section 25. To change what the
terminal says when it doesn't recognise you, edit `TERM` in section 3.

### The rules the code follows

- **Sixteen colours, no exceptions inside the tube.** The VGA palette is the only
  thing allowed on the phosphor. The beige plastic of the case is off-palette on
  purpose and is the only thing that is.
- **No anti-aliasing.** `shape-rendering: crispEdges`, `image-rendering:
  pixelated`, `-webkit-font-smoothing: none`. Curves are drawn as staircases of
  rectangles.
- **No gradients, radii, shadows or transitions** in the interface. The scanline
  overlay and the plastic are the exceptions, and they are hardware.
- **Whole pixels.** Animations move in integers and snap with `steps()`.
- **Fades are dithers.** Evening in Bekkedal, the ending, the degauss — ordered
  4×4 dither, never an alpha wash, because an alpha wash invents colours.

---

## Licence and thanks

TempleOS was released into the public domain by Terry A. Davis. This replica
follows it there.

Terry wrote the original alone, and every good idea in this file is his.

---

*A limit is not a shortage. It is a decision about what is allowed to be
complicated.*
