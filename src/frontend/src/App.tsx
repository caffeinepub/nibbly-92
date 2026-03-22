import { useCallback, useEffect, useRef, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS = 26;
const ROWS = 20;
const CELL = 24;
const CANVAS_W = COLS * CELL;
const CANVAS_H = ROWS * CELL;
const MIN_SPEED = 100;
const SPEED_STEP = 2;
const FOOD_DENSITY = 0.25;

// Speed per level start: Level 1 = 380ms (very slow), each level ~22ms faster
function levelStartSpeed(level: number): number {
  return Math.max(MIN_SPEED, 380 - (level - 1) * 22);
}

type Dir = { x: number; y: number };
type Point = { x: number; y: number };
type GameState = "START" | "PLAYING" | "LEVELUP" | "GAMEOVER";

// ─── Maze per level ───────────────────────────────────────────────────────────
function buildWalls(level: number): Set<string> {
  const walls = new Set<string>();
  const add = (x: number, y: number) => walls.add(`${x},${y}`);
  const hLine = (x1: number, x2: number, y: number) => {
    for (let x = x1; x <= x2; x++) add(x, y);
  };
  const vLine = (y1: number, y2: number, x: number) => {
    for (let y = y1; y <= y2; y++) add(x, y);
  };
  const box = (x1: number, y1: number, x2: number, y2: number) => {
    hLine(x1, x2, y1);
    hLine(x1, x2, y2);
    vLine(y1, y2, x1);
    vLine(y1, y2, x2);
  };

  // Always: border walls
  for (let x = 0; x < COLS; x++) {
    add(x, 0);
    add(x, ROWS - 1);
  }
  for (let y = 0; y < ROWS; y++) {
    add(0, y);
    add(COLS - 1, y);
  }

  if (level === 1) {
    // Very few obstacles
    hLine(6, 9, 5);
    hLine(16, 19, 5);
  } else if (level === 2) {
    hLine(6, 9, 5);
    hLine(16, 19, 5);
    hLine(6, 9, 14);
    hLine(16, 19, 14);
  } else if (level === 3) {
    hLine(6, 9, 5);
    hLine(16, 19, 5);
    hLine(6, 9, 14);
    hLine(16, 19, 14);
    vLine(7, 10, 12);
    vLine(9, 12, 13);
  } else if (level === 4) {
    box(4, 3, 7, 6);
    box(18, 3, 21, 6);
    box(4, 13, 7, 16);
    box(18, 13, 21, 16);
    hLine(11, 14, 9);
  } else if (level === 5) {
    box(4, 3, 7, 6);
    box(18, 3, 21, 6);
    box(4, 13, 7, 16);
    box(18, 13, 21, 16);
    hLine(11, 14, 9);
    vLine(5, 7, 12);
    vLine(12, 14, 12);
  } else if (level === 6) {
    hLine(3, 7, 4);
    hLine(19, 22, 4);
    hLine(3, 7, 15);
    hLine(19, 22, 15);
    vLine(7, 12, 8);
    vLine(7, 12, 17);
    hLine(11, 14, 9);
    hLine(11, 14, 10);
    vLine(4, 7, 13);
    vLine(12, 15, 13);
  } else {
    const lv = (level - 7) % 3;
    if (lv === 0) {
      hLine(3, 10, 5);
      hLine(15, 22, 5);
      hLine(3, 10, 14);
      hLine(15, 22, 14);
      vLine(7, 12, 5);
      hLine(10, 15, 9);
      hLine(10, 15, 10);
    } else if (lv === 1) {
      box(3, 3, 6, 6);
      box(19, 3, 22, 6);
      box(3, 13, 6, 16);
      box(19, 13, 22, 16);
      hLine(10, 15, 9);
      vLine(7, 12, 12);
      add(12, 5);
      add(13, 5);
      add(12, 14);
      add(13, 14);
    } else {
      vLine(3, 9, 7);
      vLine(10, 16, 7);
      vLine(3, 9, 18);
      vLine(10, 16, 18);
      hLine(9, 16, 4);
      hLine(9, 16, 15);
      hLine(5, 8, 10);
      hLine(17, 20, 10);
    }
  }

  return walls;
}

// ─── Lo-fi Audio Engine ───────────────────────────────────────────────────────
class AudioEngine {
  ctx: AudioContext | null = null;
  musicIntervalId: ReturnType<typeof setInterval> | null = null;
  masterGain: GainNode | null = null;
  step = 0;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.22;
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    type: OscillatorType,
    startTime: number,
    duration: number,
    gainPeak: number,
    attack = 0.04,
    release = 0.3,
  ) {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.linearRampToValueAtTime(gainPeak, startTime + attack);
    g.gain.setValueAtTime(gainPeak, startTime + duration - release);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(g);
    g.connect(this.masterGain!);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  startMusic() {
    const ctx = this.getCtx();
    if (ctx.state === "suspended") ctx.resume();
    this.step = 0;

    // Lo-fi @ ~72 BPM: eighth note = 417ms
    // Chord cycle (16 steps = 1 bar): Fmaj7 -> Em7 -> Am7 -> Dm7
    // Bass root notes (octave 2): F2=87, E2=82, A2=110, D2=73
    const bassNotes = [
      87, 0, 87, 0, 82, 0, 82, 0, 110, 0, 110, 0, 73, 0, 73, 0,
    ];
    // Chord pads (played at chord change, held)
    const chordFreqs = [
      [349, 440, 523, 659], // Fmaj7
      [330, 392, 494, 587], // Em7
      [220, 262, 330, 392], // Am7
      [294, 349, 440, 523], // Dm7
    ];
    // Sparse melody over the progression
    const melodyNotes = [
      523, 0, 494, 440, 0, 392, 440, 0, 392, 330, 0, 294, 330, 0, 262, 0,
    ];

    const EIGHTH = 417; // ms per eighth note

    this.musicIntervalId = setInterval(() => {
      const s = this.step % 16;
      const t = ctx.currentTime;

      // Bass — soft triangle, on beats 1 & 3 (steps 0, 4, 8, 12)
      if (bassNotes[s] > 0) {
        this.playTone(bassNotes[s], "triangle", t, 0.75, 0.38, 0.02, 0.4);
      }

      // Chord pad — only at chord change (every 4 steps)
      if (s % 4 === 0) {
        const chord = chordFreqs[s / 4];
        const holdDur = (EIGHTH / 1000) * 3.6;
        for (const freq of chord) {
          this.playTone(freq, "sine", t, holdDur, 0.07, 0.12, 0.5);
        }
      }

      // Melody — sparse sine notes
      if (melodyNotes[s] > 0) {
        this.playTone(melodyNotes[s], "sine", t, 0.5, 0.18, 0.04, 0.3);
      }

      // Soft hi-hat on steps 4 and 12 (beats 2 & 4)
      if (s === 4 || s === 12) {
        const buf = ctx.createBuffer(
          1,
          Math.floor(ctx.sampleRate * 0.05),
          ctx.sampleRate,
        );
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] =
            (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
        }
        const src = ctx.createBufferSource();
        const hpf = ctx.createBiquadFilter();
        hpf.type = "highpass";
        hpf.frequency.value = 7000;
        const g = ctx.createGain();
        g.gain.value = 0.06;
        src.buffer = buf;
        src.connect(hpf);
        hpf.connect(g);
        g.connect(this.masterGain!);
        src.start(t);
      }

      // Very quiet vinyl crackle every few steps
      if (s % 3 === 0) {
        const len = Math.floor(ctx.sampleRate * 0.015);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        const lpf = ctx.createBiquadFilter();
        lpf.type = "lowpass";
        lpf.frequency.value = 2000;
        const g = ctx.createGain();
        g.gain.value = 0.018;
        src.buffer = buf;
        src.connect(lpf);
        lpf.connect(g);
        g.connect(this.masterGain!);
        src.start(t);
      }

      this.step++;
    }, EIGHTH);
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
    this.playTone(880, "sine", t, 0.08, 0.3, 0.01, 0.06);
    this.playTone(1200, "sine", t + 0.07, 0.07, 0.22, 0.01, 0.05);
  }

  playLevelUp() {
    const ctx = this.getCtx();
    const t = ctx.currentTime;
    this.playTone(523, "triangle", t, 0.12, 0.4);
    this.playTone(659, "triangle", t + 0.14, 0.12, 0.4);
    this.playTone(784, "triangle", t + 0.28, 0.12, 0.4);
    this.playTone(1047, "triangle", t + 0.42, 0.22, 0.5);
  }

  playGameOver() {
    const ctx = this.getCtx();
    const t = ctx.currentTime;
    this.playTone(440, "triangle", t, 0.28, 0.4);
    this.playTone(330, "triangle", t + 0.32, 0.28, 0.4);
    this.playTone(220, "triangle", t + 0.65, 0.38, 0.4);
    this.playTone(110, "triangle", t + 1.08, 0.5, 0.4);
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
      ctx.fillRect(px + 5, py + 5, 4, 4);
      ctx.fillRect(px + 15, py + 5, 4, 4);
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
  ctx.shadowBlur = 10;
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    const hue = (hue1 + i * 13) % 360;
    const color = `hsl(${hue},100%,65%)`;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (const f of foods) {
    ctx.beginPath();
    ctx.arc(
      f.x * CELL + CELL / 2 - 1.5,
      f.y * CELL + CELL / 2 - 1.5,
      1.8,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function drawHUD(
  ctx: CanvasRenderingContext2D,
  score: number,
  level: number,
  remaining: number,
  total: number,
) {
  ctx.font = "10px 'Press Start 2P'";
  ctx.textBaseline = "top";
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#FFD84A";
  ctx.fillStyle = "#FFD84A";
  ctx.fillText(`SCORE:${String(score).padStart(6, "0")}`, 8, 6);
  ctx.shadowColor = "#39E6FF";
  ctx.fillStyle = "#39E6FF";
  const lvText = `LV:${level}`;
  ctx.fillText(lvText, CANVAS_W - ctx.measureText(lvText).width - 8, 6);
  ctx.shadowColor = "#FF43C6";
  ctx.fillStyle = "#FF43C6";
  const rem = `BALLS:${remaining}/${total}`;
  ctx.fillText(rem, CANVAS_W / 2 - ctx.measureText(rem).width / 2, 6);
  ctx.shadowBlur = 0;
}

function drawStartScreen(ctx: CanvasRenderingContext2D, tick: number) {
  ctx.font = "bold 26px 'Press Start 2P'";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = 30;
  ctx.shadowColor = "#39E6FF";
  ctx.fillStyle = "#39E6FF";
  ctx.fillText("NIBBLY '92", CANVAS_W / 2, CANVAS_H * 0.28);
  ctx.shadowColor = "#FF43C6";
  ctx.fillStyle = "rgba(255,67,198,0.5)";
  ctx.fillText("NIBBLY '92", CANVAS_W / 2 + 2, CANVAS_H * 0.28 + 2);
  ctx.shadowBlur = 0;
  ctx.font = "7px 'Press Start 2P'";
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#8B4DFF";
  ctx.fillStyle = "#8B4DFF";
  ctx.fillText(
    "COLLECT ALL BALLS - NEXT LEVEL!",
    CANVAS_W / 2,
    CANVAS_H * 0.46,
  );
  ctx.fillText(
    "WALLS BOUNCE - SELF = GAME OVER",
    CANVAS_W / 2,
    CANVAS_H * 0.54,
  );
  ctx.shadowBlur = 0;
  if (Math.sin(tick * 0.08) > 0) {
    ctx.font = "8px 'Press Start 2P'";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#49FF8A";
    ctx.fillStyle = "#49FF8A";
    ctx.fillText("PRESS ANY KEY TO START", CANVAS_W / 2, CANVAS_H * 0.68);
    ctx.shadowBlur = 0;
  }
  ctx.font = "6px 'Press Start 2P'";
  ctx.fillStyle = "rgba(57,230,255,0.6)";
  ctx.fillText("ARROWS / WASD TO MOVE", CANVAS_W / 2, CANVAS_H * 0.8);
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
  if (Math.sin(tick * 0.15) > 0) {
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
  if (Math.sin(tick * 0.08) > 0) {
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
  const speedRef = useRef(levelStartSpeed(1));
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
        if (
          !wallsRef.current.has(key) &&
          !snakeSet.has(key) &&
          (x * 3 + y * 7) % Math.round(1 / FOOD_DENSITY) === 0
        ) {
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
      // Reset speed to this level's starting speed
      speedRef.current = levelStartSpeed(level);
      if (!keepSnake) {
        snakeRef.current = [
          { x: 13, y: 10 },
          { x: 12, y: 10 },
          { x: 11, y: 10 },
        ];
        dirRef.current = { x: 1, y: 0 };
        nextDirRef.current = { x: 1, y: 0 };
      } else {
        dirRef.current = { x: 1, y: 0 };
        nextDirRef.current = { x: 1, y: 0 };
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
            { x: 13, y: 10 },
            { x: 12, y: 10 },
            { x: 11, y: 10 },
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
    speedRef.current = levelStartSpeed(1);
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

    if (walls.has(`${newHead.x},${newHead.y}`)) {
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
        timeoutRef.current = setTimeout(gameTick, speedRef.current);
        return;
      }
    }

    const hitSelf = snake.some((s) => s.x === newHead.x && s.y === newHead.y);
    if (hitSelf) {
      stateRef.current = "GAMEOVER";
      audioEngine.stopMusic();
      audioEngine.playGameOver();
      return;
    }

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
      { x: 13, y: 10 },
      { x: 12, y: 10 },
      { x: 11, y: 10 },
      { x: 10, y: 10 },
      { x: 9, y: 10 },
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
