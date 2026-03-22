import { useCallback, useEffect, useRef, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS = 40;
const ROWS = 30;
const CELL = 16;
const CANVAS_W = COLS * CELL; // 640
const CANVAS_H = ROWS * CELL; // 480
const START_SPEED = 150;
const MIN_SPEED = 60;
const SPEED_STEP = 5;

type Dir = { x: number; y: number };
type Point = { x: number; y: number };
type GameState = "START" | "PLAYING" | "GAMEOVER";

// ─── Maze (border + interior walls) ──────────────────────────────────────────
function buildWalls(): Set<string> {
  const walls = new Set<string>();
  const add = (x: number, y: number) => walls.add(`${x},${y}`);

  // Border
  for (let x = 0; x < COLS; x++) {
    add(x, 0);
    add(x, ROWS - 1);
  }
  for (let y = 0; y < ROWS; y++) {
    add(0, y);
    add(COLS - 1, y);
  }

  // Interior horizontal segments
  for (let x = 5; x <= 12; x++) add(x, 5);
  for (let x = 5; x <= 12; x++) add(x, 24);
  for (let x = 27; x <= 34; x++) add(x, 5);
  for (let x = 27; x <= 34; x++) add(x, 24);
  for (let x = 15; x <= 24; x++) add(x, 8);
  for (let x = 15; x <= 24; x++) add(x, 21);
  for (let x = 8; x <= 14; x++) add(x, 14);
  for (let x = 25; x <= 31; x++) add(x, 14);

  // Interior vertical segments
  for (let y = 5; y <= 10; y++) add(5, y);
  for (let y = 5; y <= 10; y++) add(34, y);
  for (let y = 19; y <= 24; y++) add(5, y);
  for (let y = 19; y <= 24; y++) add(34, y);
  for (let y = 8; y <= 13; y++) add(15, y);
  for (let y = 8; y <= 13; y++) add(24, y);
  for (let y = 16; y <= 21; y++) add(15, y);
  for (let y = 16; y <= 21; y++) add(24, y);
  for (let y = 11; y <= 13; y++) add(10, y);
  for (let y = 11; y <= 13; y++) add(29, y);
  for (let y = 16; y <= 18; y++) add(10, y);
  for (let y = 16; y <= 18; y++) add(29, y);

  // Small decorations
  for (let x = 18; x <= 21; x++) add(x, 3);
  for (let x = 18; x <= 21; x++) add(x, 26);
  for (let y = 11; y <= 18; y++) add(2, y);
  for (let y = 11; y <= 18; y++) add(37, y);

  return walls;
}

const WALLS = buildWalls();
const WALL_ARR: Point[] = Array.from(WALLS).map((s) => {
  const [x, y] = s.split(",").map(Number);
  return { x, y };
});

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
    this.playNote(1600, "sine", t + 0.12, 0.08, 0.3);
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
  ctx.strokeStyle = "rgba(80,40,180,0.12)";
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

function drawWalls(ctx: CanvasRenderingContext2D) {
  for (const w of WALL_ARR) {
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

function drawFood(ctx: CanvasRenderingContext2D, food: Point, tick: number) {
  const px = food.x * CELL + CELL / 2;
  const py = food.y * CELL + CELL / 2;
  const pulse = 3 + Math.sin(tick * 0.15) * 2;
  const hue = (tick * 3) % 360;
  const color = `hsl(${hue},100%,60%)`;
  ctx.shadowBlur = 20;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(px, py, pulse + 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(px - 2, py - 2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawHUD(ctx: CanvasRenderingContext2D, score: number, speed: number) {
  const level = Math.floor((START_SPEED - speed) / SPEED_STEP) + 1;
  const speedLabel = speed <= 80 ? "FAST" : speed <= 120 ? "NORMAL" : "SLOW";
  ctx.font = "9px 'Press Start 2P'";
  ctx.textBaseline = "top";
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#FFD84A";
  ctx.fillStyle = "#FFD84A";
  ctx.fillText(`SCORE:${String(score).padStart(6, "0")}`, 8, 6);
  ctx.shadowColor = "#39E6FF";
  ctx.fillStyle = "#39E6FF";
  const rightText = `LV:${level} ${speedLabel}`;
  const tw = ctx.measureText(rightText).width;
  ctx.fillText(rightText, CANVAS_W - tw - 8, 6);
  ctx.shadowBlur = 0;
}

function drawStartScreen(ctx: CanvasRenderingContext2D, tick: number) {
  const titleY = 120;
  ctx.font = "bold 28px 'Press Start 2P'";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = 30;
  ctx.shadowColor = "#39E6FF";
  ctx.fillStyle = "#39E6FF";
  ctx.fillText("NIBBLY '92", CANVAS_W / 2, titleY);
  ctx.shadowColor = "#FF43C6";
  ctx.fillStyle = "rgba(255,67,198,0.5)";
  ctx.fillText("NIBBLY '92", CANVAS_W / 2 + 2, titleY + 2);
  ctx.shadowBlur = 0;
  ctx.font = "8px 'Press Start 2P'";
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#8B4DFF";
  ctx.fillStyle = "#8B4DFF";
  ctx.fillText("NEON RETRO MODERN", CANVAS_W / 2, titleY + 42);
  ctx.shadowBlur = 0;
  const blink = Math.sin(tick * 0.08) > 0;
  if (blink) {
    ctx.font = "8px 'Press Start 2P'";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#49FF8A";
    ctx.fillStyle = "#49FF8A";
    ctx.fillText("PRESS ANY KEY TO START", CANVAS_W / 2, 240);
    ctx.shadowBlur = 0;
  }
  ctx.font = "6px 'Press Start 2P'";
  ctx.fillStyle = "rgba(57,230,255,0.6)";
  ctx.fillText("ARROWS / WASD TO MOVE", CANVAS_W / 2, 280);
  ctx.fillText("AVOID WALLS AND YOURSELF", CANVAS_W / 2, 296);
  ctx.textAlign = "left";
}

function drawGameOverScreen(
  ctx: CanvasRenderingContext2D,
  score: number,
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
  ctx.fillText("GAME OVER", CANVAS_W / 2, CANVAS_H / 2 - 50);
  ctx.font = "10px 'Press Start 2P'";
  ctx.shadowColor = "#FFD84A";
  ctx.fillStyle = "#FFD84A";
  ctx.fillText(
    `SCORE: ${String(score).padStart(6, "0")}`,
    CANVAS_W / 2,
    CANVAS_H / 2 + 4,
  );
  const blink = Math.sin(tick * 0.08) > 0;
  if (blink) {
    ctx.font = "7px 'Press Start 2P'";
    ctx.shadowColor = "#49FF8A";
    ctx.fillStyle = "#49FF8A";
    ctx.fillText("PRESS ANY KEY TO RESTART", CANVAS_W / 2, CANVAS_H / 2 + 50);
  }
  ctx.shadowBlur = 0;
  ctx.textAlign = "left";
}

// ─── D-Pad Button ──────────────────────────────────────────────────────────────
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
        transition: "background 0.1s, box-shadow 0.1s",
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
  const foodRef = useRef<Point>({ x: 20, y: 15 });
  const scoreRef = useRef(0);
  const speedRef = useRef(START_SPEED);
  const tickRef = useRef(0);
  const rafRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoSnakeRef = useRef<Point[]>([]);
  const demoDirRef = useRef<Dir>({ x: 1, y: 0 });
  const demoTickRef = useRef(0);
  // Touch swipe tracking
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const getCtx = useCallback(() => {
    return canvasRef.current?.getContext("2d") ?? null;
  }, []);

  const spawnFood = useCallback(() => {
    const snake = snakeRef.current;
    const snakeSet = new Set(snake.map((p) => `${p.x},${p.y}`));
    const free: Point[] = [];
    for (let x = 1; x < COLS - 1; x++) {
      for (let y = 1; y < ROWS - 1; y++) {
        const key = `${x},${y}`;
        if (!WALLS.has(key) && !snakeSet.has(key)) {
          free.push({ x, y });
        }
      }
    }
    if (free.length > 0) {
      foodRef.current = free[Math.floor(Math.random() * free.length)];
    }
  }, []);

  const initGame = useCallback(() => {
    snakeRef.current = [
      { x: 22, y: 15 },
      { x: 21, y: 15 },
      { x: 20, y: 15 },
    ];
    dirRef.current = { x: 1, y: 0 };
    nextDirRef.current = { x: 1, y: 0 };
    scoreRef.current = 0;
    speedRef.current = START_SPEED;
    spawnFood();
  }, [spawnFood]);

  const gameTick = useCallback(() => {
    if (stateRef.current !== "PLAYING") return;

    const snake = snakeRef.current;
    dirRef.current = nextDirRef.current;
    const head = snake[0];
    const newHead: Point = {
      x: head.x + dirRef.current.x,
      y: head.y + dirRef.current.y,
    };

    const key = `${newHead.x},${newHead.y}`;
    const hitWall = WALLS.has(key);
    const hitSelf = snake.some((s) => s.x === newHead.x && s.y === newHead.y);

    if (hitWall || hitSelf) {
      stateRef.current = "GAMEOVER";
      audioEngine.stopMusic();
      audioEngine.playGameOver();
      return;
    }

    const food = foodRef.current;
    const ate = newHead.x === food.x && newHead.y === food.y;
    const newSnake = [newHead, ...snake];
    if (!ate) {
      newSnake.pop();
    } else {
      scoreRef.current += 10;
      speedRef.current = Math.max(MIN_SPEED, speedRef.current - SPEED_STEP);
      audioEngine.playEat();
      spawnFood();
    }
    snakeRef.current = newSnake;

    timeoutRef.current = setTimeout(gameTick, speedRef.current);
  }, [spawnFood]);

  const startGameLoop = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(gameTick, speedRef.current);
  }, [gameTick]);

  // ─── Shared direction handler (used by keyboard + touch + d-pad) ────────────
  const handleDirection = useCallback(
    (dir: "UP" | "DOWN" | "LEFT" | "RIGHT") => {
      if (stateRef.current === "START" || stateRef.current === "GAMEOVER") {
        stateRef.current = "PLAYING";
        initGame();
        startGameLoop();
        audioEngine.startMusic();
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
    [initGame, startGameLoop],
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
    drawWalls(ctx);

    if (state === "START") {
      demoTickRef.current++;
      if (demoTickRef.current % 10 === 0) {
        const ds = demoSnakeRef.current;
        if (ds.length > 0) {
          const head = ds[0];
          let dir = demoDirRef.current;
          const nx = head.x + dir.x;
          const ny = head.y + dir.y;
          if (WALLS.has(`${nx},${ny}`)) {
            const turns: Dir[] = [
              { x: dir.y, y: -dir.x },
              { x: -dir.y, y: dir.x },
              { x: -dir.x, y: -dir.y },
            ];
            for (const t of turns) {
              if (!WALLS.has(`${head.x + t.x},${head.y + t.y}`)) {
                dir = t;
                demoDirRef.current = dir;
                break;
              }
            }
          }
          const newHead = {
            x: head.x + demoDirRef.current.x,
            y: head.y + demoDirRef.current.y,
          };
          if (!WALLS.has(`${newHead.x},${newHead.y}`)) {
            demoSnakeRef.current = [newHead, ...ds].slice(0, 20);
          }
        }
      }
      drawSnake(ctx, demoSnakeRef.current);
      drawStartScreen(ctx, tick);
    } else if (state === "PLAYING") {
      drawFood(ctx, foodRef.current, tick);
      drawSnake(ctx, snakeRef.current);
      drawHUD(ctx, scoreRef.current, speedRef.current);
    } else if (state === "GAMEOVER") {
      drawFood(ctx, foodRef.current, tick);
      drawSnake(ctx, snakeRef.current);
      drawHUD(ctx, scoreRef.current, speedRef.current);
      drawGameOverScreen(ctx, scoreRef.current, tick);
    }

    rafRef.current = requestAnimationFrame(renderLoop);
  }, [getCtx]);

  useEffect(() => {
    // Detect touch device
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
      setIsTouchDevice(true);
    }

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
      const key = e.key;

      if (stateRef.current === "START" || stateRef.current === "GAMEOVER") {
        stateRef.current = "PLAYING";
        initGame();
        startGameLoop();
        audioEngine.startMusic();
        return;
      }

      const cur = dirRef.current;
      if ((key === "ArrowUp" || key === "w" || key === "W") && cur.y !== 1) {
        nextDirRef.current = { x: 0, y: -1 };
      } else if (
        (key === "ArrowDown" || key === "s" || key === "S") &&
        cur.y !== -1
      ) {
        nextDirRef.current = { x: 0, y: 1 };
      } else if (
        (key === "ArrowLeft" || key === "a" || key === "A") &&
        cur.x !== 1
      ) {
        nextDirRef.current = { x: -1, y: 0 };
      } else if (
        (key === "ArrowRight" || key === "d" || key === "D") &&
        cur.x !== -1
      ) {
        nextDirRef.current = { x: 1, y: 0 };
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
        e.preventDefault();
      }
    };

    // ─── Swipe detection on canvas ──────────────────────────────────────────
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
      const threshold = 20;

      if (absDx < threshold && absDy < threshold) {
        // Tap — treat as start/restart
        if (stateRef.current === "START" || stateRef.current === "GAMEOVER") {
          stateRef.current = "PLAYING";
          initGame();
          startGameLoop();
          audioEngine.startMusic();
        }
        return;
      }

      if (absDx > absDy) {
        handleDirection(dx > 0 ? "RIGHT" : "LEFT");
      } else {
        handleDirection(dy > 0 ? "DOWN" : "UP");
      }
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
  }, [renderLoop, initGame, startGameLoop, handleDirection]);

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

      {/* ─── On-screen D-Pad (touch devices only) ─────────────────────────── */}
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
          {/* Row 1: empty, up, empty */}
          <div />
          <DPadButton
            label="▲"
            ocid="game.button"
            onPress={() => handleDirection("UP")}
          />
          <div />
          {/* Row 2: left, empty center, right */}
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
          {/* Row 3: empty, down, empty */}
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
