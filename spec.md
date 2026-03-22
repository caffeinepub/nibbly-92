# Nibbly '92

## Current State
New project, no existing application files.

## Requested Changes (Diff)

### Add
- Full 2D snake game (Nibbly '92 clone) built entirely in the frontend using Canvas API
- 40x30 grid, 16x16px cells = 640x480px canvas
- Fixed maze/wall layout inside the play field
- Snake: start length 3, grid-based movement in 4 directions, no 180° reversal
- Controls: Arrow keys + WASD
- Food: spawns randomly on free cells
- Eating food: +1 segment, +10 points, slight speed increase
- Collision detection: walls and self = Game Over
- Neon aesthetic: black background, neon walls (pink/cyan/purple/green), glowing snake (cyan→blue→pink gradient), neon food (red/yellow)
- HUD: pixel font, score top-left, level/speed top-right
- Game Over screen: centered large neon pixel text
- Start screen: "NIBBLY '92" large pixel title, blinking "Press any key to start"
- Optional: animated background snake on start screen
- Sound: Web Audio API synthesized sounds
  - Background: synthwave/chiptune looping melody
  - Eat: short neon synth beep
  - Game Over: 8-bit neon FX tone
- Minimal Motoko backend (just a stub actor)

### Modify
N/A

### Remove
N/A

## Implementation Plan
1. Stub Motoko backend actor
2. Build game in React component using Canvas API and requestAnimationFrame
3. Implement game loop, grid logic, snake movement, collision detection
4. Draw maze walls with neon colors, snake with gradient, food with glow
5. Web Audio API for all sounds (no external files needed)
6. Start screen, Game Over screen with neon pixel styling
7. HUD overlay with pixel font
8. CSS font: use a pixel/monospace font (Press Start 2P from Google Fonts)
