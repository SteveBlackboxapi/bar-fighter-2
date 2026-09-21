# BAR FIGHTER 2

Local two-player arcade brawler. Somebody bumps somebody. Pints fly. Round 1 is a cheers. Then you fight.

Not Street Fighter II. A playable bar-fight prototype you can run on a Mac with Bluetooth pads.

## Play in 30 seconds

1. Clone or download this repo.
2. Open a terminal in the folder:

```bash
python3 -m http.server 8080
```

3. In **Chrome** (best Gamepad support on Mac) go to [http://localhost:8080](http://localhost:8080)
4. Pair your pads:
   - System Settings → Bluetooth → connect DualShock / DualSense / Xbox / 8BitDo / Switch Pro
   - Click the game tab, then **press a button on each pad** so the browser wakes them
5. Press Start (or Enter / pad Start) and fight

Opening `index.html` as a file also works for keyboard. Use the local server for pads.

GitHub Pages (after you flip it on in Settings → Pages → Deploy from main):
https://steveblackboxapi.github.io/bar-fighter-2/

## Controls

| Action | Player 1 keyboard | Player 2 keyboard | Any standard pad |
|---|---|---|---|
| Walk | A / D | ← / → | Left stick or D-pad |
| Jump | W | ↑ | Up on stick / D-pad |
| Crouch | S | ↓ | Down |
| Punch | J | Numpad 1 or `,` | A / Cross / South, or X / Square / West |
| Kick | K | Numpad 2 or `.` | B / Circle / East, or Y / Triangle / North |
| Pint special | L | Numpad 3 or `/` | LB / L1 or RB / R1 |
| Start / rematch | Enter | Enter | Start / Options |

Hold **back** (away from the other guy) to block.

## How a round works

1. Title — insert coin energy
2. **Bump** — they walk into each other, beer spills, that's the fight
3. **Cheers** — two pints slam in from the sides. ROUND 1. FIGHT
4. Health bars are beer mugs. Special is a thrown pint
5. KO, then rematch with Start

## Repo

https://github.com/SteveBlackboxapi/bar-fighter-2

Idea is twenty years old. Engine is a weekend canvas fighter. Sprites are drawn, not scanned from Capcom.
