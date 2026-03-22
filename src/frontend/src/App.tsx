import { useCallback, useEffect, useRef, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS = 40;
const ROWS = 30;
const CELL = 16;
const CANVAS_W = COLS * CELL;
const CANVAS_H = ROWS * CELL;
const START_SPEED = 160;
const MIN_SPEED = 50;
const SPEED_STEP = 4;

type Dir = { x: number; y: number };
type Point = { x: number; y: number };
type GameState = "START" | "PLAYING" | "LEVELUP" | "GAMEOVER";

// ─── Maze per level ───────────────────────────────────────────────────────────
function buildWalls(level: number): Set<string> {
  const walls = new Set<string>();
  const add = (x: number, y: number) => walls.add(`${x},${y}`);

  // Always: border
  for (let x = 0; x < COLS; x++) {
    add(x, 0);
    add(x, ROWS - 1);
  }
  for (let y = 0; y < ROWS; y++) {
    add(0, y);
    add(COLS - 1, y);
  }

  if (level === 1) {
    // Sparse maze – open corridors
    for (let x = 5; x <= 10; x++) add(x, 6);
    for (let x = 29; x <= 34; x++) add(x, 6);
    for (let x = 5; x <= 10; x++) add(x, 23);
    for (let x = 29; x <= 34; x++) add(x, 23);
    for (let y = 6; y <= 11; y++) add(5, y);
    for (let y = 6; y <= 11; y++) add(34, y);
    for (let y = 18; y <= 23; y++) add(5, y);
    for (let y = 18; y <= 23; y++) add(34, y);
    for (let x = 16; x <= 23; x++) add(x, 10);
    for (let x = 16; x <= 23; x++) add(x, 19);
    for (let y = 10; y <= 14; y++) add(16, y);
    for (let y = 10; y <= 14; y++) add(23, y);
    for (let y = 15; y <= 19; y++) add(16, y);
    for (let y = 15; y <= 19; y++) add(23, y);
  } else if (level === 2) {
    // More walls, cross pattern
    for (let x = 4; x <= 14; x++) add(x, 5);
    for (let x = 25; x <= 35; x++) add(x, 5);
    for (let x = 4; x <= 14; x++) add(x, 24);
    for (let x = 25; x <= 35; x++) add(x, 24);
    for (let y = 5; y <= 12; y++) add(4, y);
    for (let y = 5; y <= 12; y++) add(14, y);
    for (let y = 5; y <= 12; y++) add(25, y);
    for (let y = 5; y <= 12; y++) add(35, y);
    for (let y = 17; y <= 24; y++) add(4, y);
    for (let y = 17; y <= 24; y++) add(14, y);
    for (let y = 17; y <= 24; y++) add(25, y);
    for (let y = 17; y <= 24; y++) add(35, y);
    for (let x = 17; x <= 22; x++) add(x, 14);
    for (let x = 17; x <= 22; x++) add(x, 15);
    for (let y = 8; y <= 11; y++) add(19, y);
    for (let y = 8; y <= 11; y++) add(20, y);
    for (let y = 18; y <= 21; y++) add(19, y);
    for (let y = 18; y <= 21; y++) add(20, y);
    for (let x = 8; x <= 11; x++) add(x, 14);
    for (let x = 8; x <= 11; x++) add(x, 15);
    for (let x = 28; x <= 31; x++) add(x, 14);
    for (let x = 28; x <= 31; x++) add(x, 15);
  } else if (level === 3) {
    // Dense labyrinth with long corridors
    for (let x = 2; x <= 18; x++) add(x, 4);
    for (let x = 21; x <= 37; x++) add(x, 4);
    for (let x = 2; x <= 18; x++) add(x, 25);
    for (let x = 21; x <= 37; x++) add(x, 25);
    for (let y = 4; y <= 25; y++) add(2, y);
    for (let y = 4; y <= 25; y++) add(37, y);
    for (let y = 7; y <= 14; y++) add(6, y);
    for (let y = 7; y <= 14; y++) add(12, y);
    for (let y = 15; y <= 22; y++) add(6, y);
    for (let y = 15; y <= 22; y++) add(12, y);
    for (let y = 7; y <= 14; y++) add(27, y);
    for (let y = 7; y <= 14; y++) add(33, y);
    for (let y = 15; y <= 22; y++) add(27, y);
    for (let y = 15; y <= 22; y++) add(33, y);
    for (let x = 6; x <= 12; x++) add(x, 7);
    for (let x = 6; x <= 12; x++) add(x, 14);
    for (let x = 6; x <= 12; x++) add(x, 22);
    for (let x = 27; x <= 33; x++) add(x, 7);
    for (let x = 27; x <= 33; x++) add(x, 14);
    for (let x = 27; x <= 33; x++) add(x, 22);
    for (let x = 15; x <= 24; x++) add(x, 9);
    for (let x = 15; x <= 24; x++) add(x, 20);
    for (let y = 9; y <= 20; y++) add(15, y);
    for (let y = 9; y <= 20; y++) add(24, y);
  } else {
    // Level 4+: very dense maze
    const lv = (level - 4) % 3;
    // Outer frame
    for (let x = 3; x <= 36; x++) {
      add(x, 3);
      add(x, 26);
    }
    for (let y = 3; y <= 26; y++) {
      add(3, y);
      add(36, y);
    }
    if (lv === 0) {
      // Grid-like
      for (let x = 7; x <= 32; x += 5) {
        for (let y = 6; y <= 23; y++) add(x, y);
      }
      for (let y = 8; y <= 21; y += 5) {
        for (let x = 5; x <= 34; x++) add(x, y);
      }
      // Open some passages
      for (let x = 7; x <= 32; x += 5) {
        add(x, 12); // gap
        walls.delete(`${x},12`);
        walls.delete(`${x},13`);
        walls.delete(`${x},17`);
        walls.delete(`${x},18`);
      }
      for (let y = 8; y <= 21; y += 5) {
        walls.delete(`${17},${y}`);
        walls.delete(`${18},${y}`);
        walls.delete(`${22},${y}`);
        walls.delete(`${23},${y}`);
      }
    } else if (lv === 1) {
      // Spiral-ish
      for (let x = 7; x <= 32; x++) add(x, 7);
      for (let y = 7; y <= 22; y++) add(32, y);
      for (let x = 7; x <= 32; x++) add(x, 22);
      for (let y = 7; y <= 18; y++) add(7, y);
      for (let x = 11; x <= 28; x++) add(x, 11);
      for (let y = 11; y <= 22; y++) add(28, y);
      for (let x = 11; x <= 28; x++) add(x, 18);
      for (let y = 11; y <= 18; y++) add(11, y);
      // Open entries
      walls.delete("19,7");
      walls.delete("20,7");
      walls.delete("32,14");
      walls.delete("32,15");
      walls.delete("19,22");
      walls.delete("20,22");
      walls.delete("7,14");
      walls.delete("7,15");
      walls.delete("19,11");
      walls.delete("20,11");
      walls.delete("28,14");
      walls.delete("28,15");
      walls.delete("19,18");
      walls.delete("20,18");
      walls.delete("11,14");
      walls.delete("11,15");
    } else {
      // Rooms
      for (let x = 5; x <= 18; x++) {
        add(x, 6);
        add(x, 13);
      }
      for (let x = 21; x <= 34; x++) {
        add(x, 6);
        add(x, 13);
      }
      for (let x = 5; x <= 18; x++) {
        add(x, 16);
        add(x, 23);
      }
      for (let x = 21; x <= 34; x++) {
        add(x, 16);
        add(x, 23);
      }
      for (let y = 6; y <= 13; y++) {
        add(5, y);
        add(18, y);
      }
      for (let y = 6; y <= 13; y++) {
        add(21, y);
        add(34, y);
      }
      for (let y = 16; y <= 23; y++) {
        add(5, y);
        add(18, y);
      }
      for (let y = 16; y <= 23; y++) {
        add(21, y);
        add(34, y);
      }
      // doors
      walls.delete("11,6");
      walls.delete("12,6");
      walls.delete("27,6");
      walls.delete("28,6");
      walls.delete("11,13");
      walls.delete("12,13");
      walls.delete("27,13");
      walls.delete("28,13");
      walls.delete("11,16");
      walls.delete("12,16");
      walls.delete("27,16");
      walls.delete("28,16");
      walls.delete("11,23");
      walls.delete("12,23");
      walls.delete("27,23");
      walls.delete("28,23");
      walls.delete("18,9");
      walls.delete("18,10");
      walls.delete("21,9");
      walls.delete("21,10");
      walls.delete("18,19");
      walls.delete("18,20");
      walls.delete("21,19");
      walls.delete("21,20");
    }
  }

  return walls;
}

// ─── Audio ────────────────────────────────────────────────────────────────────
class AudioEngine {
  ctx: AudioContext | null = null;
  musicIntervalId: ReturnType<typeof setInterval> | null = null;
  masterGain: GainNode | null = null;
  step = 0;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.18;
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private playNote(
    freq: number,
    type: OscillatorType,
    startTime: number,
    duration: number,
    gain = 0.3,
  ) {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(g);
    g.connect(this.masterGain!);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  startMusic() {
    const ctx = this.getCtx();
    if (ctx.state === "suspended") ctx.resume();
    this.step = 0;
    const bassNotes = [55, 55, 69, 69, 82, 82, 69, 55];
    const melodyNotes = [
      220, 277, 330, 415, 330, 277, 220, 165, 196, 247, 330, 392, 330, 247, 196,
      165,
    ];
    this.musicIntervalId = setInterval(() => {
      const t = ctx.currentTime;
      const bNote = bassNotes[this.step % bassNotes.length];
      const mNote = melodyNotes[this.step % melodyNotes.length];
      this.playNote(bNote, "sawtooth", t, 0.18, 0.5);
      this.playNote(mNote, "square", t, 0.14, 0.25);
      if (this.step % 2 === 0) {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        const g = ctx.createGain();
        src.buffer = buf;
        g.gain.value = 0.08;
        src.connect(g);
        g.connect(this.masterGain!);
        src.start(t);
      }
      this.step++;
    }, 130);
  }

  stopMusic() {
    if (this.musicIntervalId !== null) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }
  }

  playEat() {
    const ctx = this.getCtx();
    const t = ctx.currentTime;
    this.playNote(880, "sine", t, 0.05, 0.4);
    this.playNote(1200, "sine", t + 0.06, 0.05, 0.35);
  }

  playLevelUp() {
    const ctx = this.getCtx();
    const t = ctx.currentTime;
    this.playNote(523, "square", t, 0.1, 0.4);
    this.playNote(659, "square", t + 0.12, 0.1, 0.4);
    this.playNote(784, "square", t + 0.24, 0.1, 0.4);
    this.playNote(1047, "square", t + 0.36, 0.2, 0.5);
  }

  playGameOver() {
    const ctx = this.getCtx();
    const t = ctx.currentTime;
    this.playNote(440, "sawtooth", t, 0.25, 0.5);
    this.playNote(330, "sawtooth", t + 0.3, 0.25, 0.5);
    this.playNote(220, "sawtooth", t + 0.6, 0.4, 0.5);
    this.playNote(110, "sawtooth", t + 1.05, 0.5, 0.5);
  }
}

const audioEngine = new AudioEngine();

// ─── Drawing helpers ──────────────────────────────────────────────────────────
const NEON_COLORS = ["#FF43C6", "#39E6FF", "#8B4DFF", "#49FF8A"];

function wallColor(x: number, y: number): string {
  return NEON_COLORS[(x + y * 3) % NEON_COLORS.length];
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "rgba(80,40,180,0.10)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL, 0);
    ctx.lineTo(x * CELL, CANVAS_H);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL);
    ctx.lineTo(CANVAS_W, y * CELL);
    ctx.stroke();
  }
}

function drawWalls(ctx: CanvasRenderingContext2D, wallArr: Point[]) {
  for (const w of wallArr) {
    const color = wallColor(w.x, w.y);
    const px = w.x * CELL;
    const py = w.y * CELL;
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(px + 2, py + 2, CELL - 4, 3);
    ctx.shadowBlur = 0;
  }
}

function drawSnake(ctx: CanvasRenderingContext2D, snake: Point[]) {
  const len = snake.length;
  for (let i = 0; i < len; i++) {
    const seg = snake[i];
    const t = i / Math.max(len - 1, 1);
    const r = Math.round(t * 255);
    const g = Math.round((1 - t) * 255);
    const color = `rgb(${r},${g},255)`;
    const glowColor =
      i === 0 ? "#00FFFF" : i < len * 0.5 ? "#0088FF" : "#FF00FF";
    const px = seg.x * CELL;
    const py = seg.y * CELL;
    ctx.shadowBlur = i === 0 ? 18 : 10;
    ctx.shadowColor = glowColor;
    ctx.fillStyle = i === 0 ? "#00FFFF" : color;
    ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
    if (i === 0) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#000";
      ctx.fillRect(px + 4, py + 4, 3, 3);
      ctx.fillRect(px + 9, py + 4, 3, 3);
    }
    ctx.shadowBlur = 0;
  }
}

function drawFoods(
  ctx: CanvasRenderingContext2D,
  foods: Point[],
  tick: number,
) {
  const hue1 = (tick * 2) % 360;
  const hue2 = (tick * 2 + 180) % 360;
  // Draw in two passes: outer glow, then inner dot
  ctx.shadowBlur = 8;
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    const hue = (hue1 + i * 13) % 360;
    const color = `hsl(${hue},100%,65%)`;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  // White highlight on every ball
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (const f of foods) {
    ctx.beginPath();
    ctx.arc(
      f.x * CELL + CELL / 2 - 1,
      f.y * CELL + CELL / 2 - 1,
      1.2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  void hue2;
}

function drawHUD(
  ctx: CanvasRenderingContext2D,
  score: number,
  level: number,
  remaining: number,
  total: number,
) {
  ctx.font = "8px 'Press Start 2P'";
  ctx.textBaseline = "top";
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#FFD84A";
  ctx.fillStyle = "#FFD84A";
  ctx.fillText(`SCORE:${String(score).padStart(6, "0")}`, 8, 6);
  ctx.shadowColor = "#39E6FF";
  ctx.fillStyle = "#39E6FF";
  const lvText = `LV:${level}`;
  const tw = ctx.measureText(lvText).width;
  ctx.fillText(lvText, CANVAS_W - tw - 8, 6);
  // Balls remaining bar
  ctx.shadowColor = "#FF43C6";
  ctx.fillStyle = "#FF43C6";
  const rem = `BALLS:${remaining}/${total}`;
  const rw = ctx.measureText(rem).width;
  ctx.fillText(rem, CANVAS_W / 2 - rw / 2, 6);
  ctx.shadowBlur = 0;
}

function drawStartScreen(ctx: CanvasRenderingContext2D, tick: number) {
  ctx.font = "bold 28px 'Press Start 2P'";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = 30;
  ctx.shadowColor = "#39E6FF";
  ctx.fillStyle = "#39E6FF";
  ctx.fillText("NIBBLY '92", CANVAS_W / 2, 110);
  ctx.shadowColor = "#FF43C6";
  ctx.fillStyle = "rgba(255,67,198,0.5)";
  ctx.fillText("NIBBLY '92", CANVAS_W / 2 + 2, 112);
  ctx.shadowBlur = 0;
  ctx.font = "7px 'Press Start 2P'";
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#8B4DFF";
  ctx.fillStyle = "#8B4DFF";
  ctx.fillText("COLLECT ALL BALLS - NEXT LEVEL!", CANVAS_W / 2, 152);
  ctx.fillText("WALLS BOUNCE - SELF = GAME OVER", CANVAS_W / 2, 168);
  ctx.shadowBlur = 0;
  const blink = Math.sin(tick * 0.08) > 0;
  if (blink) {
    ctx.font = "8px 'Press Start 2P'";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#49FF8A";
    ctx.fillStyle = "#49FF8A";
    ctx.fillText("PRESS ANY KEY TO START", CANVAS_W / 2, 220);
    ctx.shadowBlur = 0;
  }
  ctx.font = "6px 'Press Start 2P'";
  ctx.fillStyle = "rgba(57,230,255,0.6)";
  ctx.fillText("ARROWS / WASD TO MOVE", CANVAS_W / 2, 260);
  ctx.textAlign = "left";
}

function drawLevelUpScreen(
  ctx: CanvasRenderingContext2D,
  level: number,
  tick: number,
) {
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 22px 'Press Start 2P'";
  ctx.shadowBlur = 30;
  ctx.shadowColor = "#49FF8A";
  ctx.fillStyle = "#49FF8A";
  ctx.fillText("LEVEL CLEAR!", CANVAS_W / 2, CANVAS_H / 2 - 40);
  ctx.font = "12px 'Press Start 2P'";
  ctx.shadowColor = "#FFD84A";
  ctx.fillStyle = "#FFD84A";
  ctx.fillText(`LEVEL ${level} STARTING...`, CANVAS_W / 2, CANVAS_H / 2 + 10);
  const blink = Math.sin(tick * 0.15) > 0;
  if (blink) {
    ctx.font = "7px 'Press Start 2P'";
    ctx.shadowColor = "#39E6FF";
    ctx.fillStyle = "#39E6FF";
    ctx.fillText("PRESS ANY KEY TO CONTINUE", CANVAS_W / 2, CANVAS_H / 2 + 55);
  }
  ctx.shadowBlur = 0;
  ctx.textAlign = "left";
}

function drawGameOverScreen(
  ctx: CanvasRenderingContext2D,
  score: number,
  level: number,
  tick: number,
) {
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 28px 'Press Start 2P'";
  ctx.shadowBlur = 30;
  ctx.shadowColor = "#FF43C6";
  ctx.fillStyle = "#FF4040";
  ctx.fillText("GAME OVER", CANVAS_W / 2, CANVAS_H / 2 - 60);
  ctx.font = "9px 'Press Start 2P'";
  ctx.shadowColor = "#FFD84A";
  ctx.fillStyle = "#FFD84A";
  ctx.fillText(
    `SCORE: ${String(score).padStart(6, "0")}`,
    CANVAS_W / 2,
    CANVAS_H / 2 - 10,
  );
  ctx.fillText(`LEVEL REACHED: ${level}`, CANVAS_W / 2, CANVAS_H / 2 + 16);
  const blink = Math.sin(tick * 0.08) > 0;
  if (blink) {
    ctx.font = "7px 'Press Start 2P'";
    ctx.shadowColor = "#49FF8A";
    ctx.fillStyle = "#49FF8A";
    ctx.fillText("PRESS ANY KEY TO RESTART", CANVAS_W / 2, CANVAS_H / 2 + 55);
  }
  ctx.shadowBlur = 0;
  ctx.textAlign = "left";
}

// ─── D-Pad Button ─────────────────────────────────────────────────────────────
interface DPadButtonProps {
  label: string;
  ocid: string;
  onPress: () => void;
  style?: React.CSSProperties;
}

function DPadButton({ label, ocid, onPress, style }: DPadButtonProps) {
  return (
    <button
      type="button"
      data-ocid={ocid}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      style={{
        width: 56,
        height: 56,
        background: "rgba(0,0,0,0.7)",
        border: "2px solid #39E6FF",
        borderRadius: 8,
        color: "#39E6FF",
        fontSize: 22,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 0 10px #39E6FF, 0 0 20px rgba(57,230,255,0.3)",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        transition: "background 0.1s",
        ...style,
      }}
      onPointerEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(57,230,255,0.18)";
      }}
      onPointerLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(0,0,0,0.7)";
      }}
    >
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const stateRef = useRef<GameState>("START");
  const snakeRef = useRef<Point[]>([]);
  const dirRef = useRef<Dir>({ x: 1, y: 0 });
  const nextDirRef = useRef<Dir>({ x: 1, y: 0 });
  const foodsRef = useRef<Point[]>([]);
  const totalFoodsRef = useRef(0);
  const scoreRef = useRef(0);
  const speedRef = useRef(START_SPEED);
  const tickRef = useRef(0);
  const levelRef = useRef(1);
  const rafRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wallsRef = useRef<Set<string>>(buildWalls(1));
  const wallArrRef = useRef<Point[]>([]);
  const demoSnakeRef = useRef<Point[]>([]);
  const demoDirRef = useRef<Dir>({ x: 1, y: 0 });
  const demoTickRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const levelUpTickRef = useRef(0);

  const getCtx = useCallback(
    () => canvasRef.current?.getContext("2d") ?? null,
    [],
  );

  const rebuildWalls = useCallback((level: number) => {
    const walls = buildWalls(level);
    wallsRef.current = walls;
    wallArrRef.current = Array.from(walls).map((s) => {
      const [x, y] = s.split(",").map(Number);
      return { x, y };
    });
  }, []);

  const spawnAllFoods = useCallback(() => {
    const snake = snakeRef.current;
    const snakeSet = new Set(snake.map((p) => `${p.x},${p.y}`));
    const foods: Point[] = [];
    for (let x = 1; x < COLS - 1; x++) {
      for (let y = 1; y < ROWS - 1; y++) {
        const key = `${x},${y}`;
        if (!wallsRef.current.has(key) && !snakeSet.has(key)) {
          foods.push({ x, y });
        }
      }
    }
    foodsRef.current = foods;
    totalFoodsRef.current = foods.length;
  }, []);

  const initLevel = useCallback(
    (level: number, keepSnake: boolean) => {
      rebuildWalls(level);
      if (!keepSnake) {
        snakeRef.current = [
          { x: 22, y: 15 },
          { x: 21, y: 15 },
          { x: 20, y: 15 },
        ];
        dirRef.current = { x: 1, y: 0 };
        nextDirRef.current = { x: 1, y: 0 };
      } else {
        // Place snake in safe spot if needed
        dirRef.current = { x: 1, y: 0 };
        nextDirRef.current = { x: 1, y: 0 };
        // Find a safe start position
        let placed = false;
        outer: for (let x = 5; x < COLS - 5; x++) {
          for (let y = 5; y < ROWS - 5; y++) {
            if (
              !wallsRef.current.has(`${x},${y}`) &&
              !wallsRef.current.has(`${x - 1},${y}`) &&
              !wallsRef.current.has(`${x - 2},${y}`)
            ) {
              snakeRef.current = [
                { x, y },
                { x: x - 1, y },
                { x: x - 2, y },
              ];
              placed = true;
              break outer;
            }
          }
        }
        if (!placed) {
          snakeRef.current = [
            { x: 22, y: 15 },
            { x: 21, y: 15 },
            { x: 20, y: 15 },
          ];
        }
      }
      spawnAllFoods();
    },
    [rebuildWalls, spawnAllFoods],
  );

  const initGame = useCallback(() => {
    levelRef.current = 1;
    scoreRef.current = 0;
    speedRef.current = START_SPEED;
    initLevel(1, false);
  }, [initLevel]);

  const gameTick = useCallback(() => {
    if (stateRef.current !== "PLAYING") return;

    const snake = snakeRef.current;
    const walls = wallsRef.current;
    dirRef.current = nextDirRef.current;
    const head = snake[0];
    let dir = dirRef.current;

    let newHead: Point = { x: head.x + dir.x, y: head.y + dir.y };

    // Wall bounce: if next cell is a wall, try to turn
    if (walls.has(`${newHead.x},${newHead.y}`)) {
      // Try perpendicular directions (left turn, right turn relative to current dir)
      const perpLeft: Dir = { x: dir.y, y: -dir.x };
      const perpRight: Dir = { x: -dir.y, y: dir.x };
      if (!walls.has(`${head.x + perpLeft.x},${head.y + perpLeft.y}`)) {
        dir = perpLeft;
        nextDirRef.current = dir;
        dirRef.current = dir;
        newHead = { x: head.x + dir.x, y: head.y + dir.y };
      } else if (
        !walls.has(`${head.x + perpRight.x},${head.y + perpRight.y}`)
      ) {
        dir = perpRight;
        nextDirRef.current = dir;
        dirRef.current = dir;
        newHead = { x: head.x + dir.x, y: head.y + dir.y };
      } else {
        // Completely stuck — just don't move this tick
        timeoutRef.current = setTimeout(gameTick, speedRef.current);
        return;
      }
    }

    // Self-collision = game over
    const hitSelf = snake.some((s) => s.x === newHead.x && s.y === newHead.y);
    if (hitSelf) {
      stateRef.current = "GAMEOVER";
      audioEngine.stopMusic();
      audioEngine.playGameOver();
      return;
    }

    // Check food
    const foodIdx = foodsRef.current.findIndex(
      (f) => f.x === newHead.x && f.y === newHead.y,
    );
    const ate = foodIdx >= 0;
    const newSnake = [newHead, ...snake];
    if (!ate) {
      newSnake.pop();
    } else {
      scoreRef.current += 10;
      speedRef.current = Math.max(MIN_SPEED, speedRef.current - SPEED_STEP);
      audioEngine.playEat();
      foodsRef.current = [
        ...foodsRef.current.slice(0, foodIdx),
        ...foodsRef.current.slice(foodIdx + 1),
      ];
    }
    snakeRef.current = newSnake;

    // Check level complete
    if (foodsRef.current.length === 0) {
      stateRef.current = "LEVELUP";
      levelRef.current += 1;
      levelUpTickRef.current = 0;
      audioEngine.playLevelUp();
      return;
    }

    timeoutRef.current = setTimeout(gameTick, speedRef.current);
  }, []);

  const startGameLoop = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(gameTick, speedRef.current);
  }, [gameTick]);

  const handleDirection = useCallback(
    (dir: "UP" | "DOWN" | "LEFT" | "RIGHT") => {
      if (stateRef.current === "START" || stateRef.current === "GAMEOVER") {
        stateRef.current = "PLAYING";
        initGame();
        startGameLoop();
        audioEngine.startMusic();
        return;
      }
      if (stateRef.current === "LEVELUP") {
        stateRef.current = "PLAYING";
        initLevel(levelRef.current, true);
        startGameLoop();
        return;
      }

      const cur = dirRef.current;
      if (dir === "UP" && cur.y !== 1) nextDirRef.current = { x: 0, y: -1 };
      else if (dir === "DOWN" && cur.y !== -1)
        nextDirRef.current = { x: 0, y: 1 };
      else if (dir === "LEFT" && cur.x !== 1)
        nextDirRef.current = { x: -1, y: 0 };
      else if (dir === "RIGHT" && cur.x !== -1)
        nextDirRef.current = { x: 1, y: 0 };
    },
    [initGame, initLevel, startGameLoop],
  );

  const renderLoop = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) {
      rafRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    tickRef.current++;
    const tick = tickRef.current;
    const state = stateRef.current;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawGrid(ctx);
    drawWalls(ctx, wallArrRef.current);

    if (state === "START") {
      demoTickRef.current++;
      if (demoTickRef.current % 10 === 0) {
        const ds = demoSnakeRef.current;
        if (ds.length > 0) {
          const head = ds[0];
          let d = demoDirRef.current;
          const nx = head.x + d.x;
          const ny = head.y + d.y;
          if (wallsRef.current.has(`${nx},${ny}`)) {
            const turns: Dir[] = [
              { x: d.y, y: -d.x },
              { x: -d.y, y: d.x },
              { x: -d.x, y: -d.y },
            ];
            for (const t of turns) {
              if (!wallsRef.current.has(`${head.x + t.x},${head.y + t.y}`)) {
                d = t;
                demoDirRef.current = d;
                break;
              }
            }
          }
          const newHead = {
            x: head.x + demoDirRef.current.x,
            y: head.y + demoDirRef.current.y,
          };
          if (!wallsRef.current.has(`${newHead.x},${newHead.y}`)) {
            demoSnakeRef.current = [newHead, ...ds].slice(0, 20);
          }
        }
      }
      drawSnake(ctx, demoSnakeRef.current);
      drawStartScreen(ctx, tick);
    } else if (state === "PLAYING") {
      drawFoods(ctx, foodsRef.current, tick);
      drawSnake(ctx, snakeRef.current);
      drawHUD(
        ctx,
        scoreRef.current,
        levelRef.current,
        foodsRef.current.length,
        totalFoodsRef.current,
      );
    } else if (state === "LEVELUP") {
      levelUpTickRef.current++;
      drawFoods(ctx, foodsRef.current, tick);
      drawSnake(ctx, snakeRef.current);
      drawHUD(
        ctx,
        scoreRef.current,
        levelRef.current,
        0,
        totalFoodsRef.current,
      );
      drawLevelUpScreen(ctx, levelRef.current, levelUpTickRef.current);
    } else if (state === "GAMEOVER") {
      drawFoods(ctx, foodsRef.current, tick);
      drawSnake(ctx, snakeRef.current);
      drawHUD(
        ctx,
        scoreRef.current,
        levelRef.current,
        foodsRef.current.length,
        totalFoodsRef.current,
      );
      drawGameOverScreen(ctx, scoreRef.current, levelRef.current, tick);
    }

    rafRef.current = requestAnimationFrame(renderLoop);
  }, [getCtx]);

  useEffect(() => {
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0)
      setIsTouchDevice(true);

    rebuildWalls(1);
    demoSnakeRef.current = [
      { x: 20, y: 15 },
      { x: 19, y: 15 },
      { x: 18, y: 15 },
      { x: 17, y: 15 },
      { x: 16, y: 15 },
    ];
    demoDirRef.current = { x: 1, y: 0 };
    rafRef.current = requestAnimationFrame(renderLoop);

    const handleKey = (e: KeyboardEvent) => {
      if (stateRef.current === "START" || stateRef.current === "GAMEOVER") {
        stateRef.current = "PLAYING";
        initGame();
        startGameLoop();
        audioEngine.startMusic();
        return;
      }
      if (stateRef.current === "LEVELUP") {
        stateRef.current = "PLAYING";
        initLevel(levelRef.current, true);
        startGameLoop();
        return;
      }
      const key = e.key;
      const cur = dirRef.current;
      if ((key === "ArrowUp" || key === "w" || key === "W") && cur.y !== 1)
        nextDirRef.current = { x: 0, y: -1 };
      else if (
        (key === "ArrowDown" || key === "s" || key === "S") &&
        cur.y !== -1
      )
        nextDirRef.current = { x: 0, y: 1 };
      else if (
        (key === "ArrowLeft" || key === "a" || key === "A") &&
        cur.x !== 1
      )
        nextDirRef.current = { x: -1, y: 0 };
      else if (
        (key === "ArrowRight" || key === "d" || key === "D") &&
        cur.x !== -1
      )
        nextDirRef.current = { x: 1, y: 0 };
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key))
        e.preventDefault();
    };

    const canvas = canvasRef.current;
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX, y: t.clientY };
    };
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (!touchStartRef.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartRef.current.x;
      const dy = t.clientY - touchStartRef.current.y;
      touchStartRef.current = null;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx < 20 && absDy < 20) {
        if (stateRef.current === "START" || stateRef.current === "GAMEOVER") {
          stateRef.current = "PLAYING";
          initGame();
          startGameLoop();
          audioEngine.startMusic();
        } else if (stateRef.current === "LEVELUP") {
          stateRef.current = "PLAYING";
          initLevel(levelRef.current, true);
          startGameLoop();
        }
        return;
      }
      if (absDx > absDy) handleDirection(dx > 0 ? "RIGHT" : "LEFT");
      else handleDirection(dy > 0 ? "DOWN" : "UP");
    };

    if (canvas) {
      canvas.addEventListener("touchstart", handleTouchStart, {
        passive: false,
      });
      canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
    }
    window.addEventListener("keydown", handleKey);
    canvasRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKey);
      if (canvas) {
        canvas.removeEventListener("touchstart", handleTouchStart);
        canvas.removeEventListener("touchend", handleTouchEnd);
      }
      cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      audioEngine.stopMusic();
    };
  }, [
    renderLoop,
    initGame,
    initLevel,
    startGameLoop,
    handleDirection,
    rebuildWalls,
  ]);

  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #070812 0%, #0B0C18 50%, #07080F 100%)",
        fontFamily: "'Press Start 2P', monospace",
        paddingBottom: isTouchDevice ? 24 : 0,
      }}
    >
      <div
        style={{
          color: "#39E6FF",
          fontSize: "10px",
          letterSpacing: "4px",
          marginBottom: "12px",
          textShadow: "0 0 10px #39E6FF, 0 0 20px #8B4DFF",
          fontFamily: "'Press Start 2P', monospace",
        }}
      >
        NIBBLY &apos;92
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        tabIndex={0}
        data-ocid="game.canvas_target"
        style={{
          display: "block",
          cursor: "none",
          outline: "none",
          boxShadow:
            "0 0 10px #39E6FF, 0 0 30px #39E6FF, 0 0 60px #8B4DFF, 0 0 2px #FF43C6 inset",
          border: "2px solid #39E6FF",
          maxWidth: "100vw",
          touchAction: "none",
        }}
      />

      {isTouchDevice && (
        <div
          data-ocid="game.panel"
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "56px 56px 56px",
            gridTemplateRows: "56px 56px 56px",
            gap: 8,
          }}
        >
          <div />
          <DPadButton
            label="▲"
            ocid="game.button"
            onPress={() => handleDirection("UP")}
          />
          <div />
          <DPadButton
            label="◀"
            ocid="game.secondary_button"
            onPress={() => handleDirection("LEFT")}
          />
          <div
            style={{
              width: 56,
              height: 56,
              background: "rgba(57,230,255,0.06)",
              border: "2px solid rgba(57,230,255,0.2)",
              borderRadius: 8,
            }}
          />
          <DPadButton
            label="▶"
            ocid="game.toggle"
            onPress={() => handleDirection("RIGHT")}
          />
          <div />
          <DPadButton
            label="▼"
            ocid="game.primary_button"
            onPress={() => handleDirection("DOWN")}
          />
          <div />
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          color: "rgba(57,230,255,0.4)",
          fontSize: "6px",
          fontFamily: "'Press Start 2P', monospace",
          letterSpacing: "1px",
        }}
      >
        &copy; {new Date().getFullYear()}. Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noreferrer"
          style={{ color: "#39E6FF", textDecoration: "none" }}
        >
          caffeine.ai
        </a>
      </div>
    </div>
  );
}
