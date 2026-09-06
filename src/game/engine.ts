/* Движок «РОЙ»: бесконечный мир, биомы, боссы, крафт. */

import { Sfx } from "./audio";
import {
  BIOMES,
  BIOME_ORDER,
  BOSSES,
  ENEMIES,
  RECIPES,
  UPGRADES,
  WEAPONS,
  WEAPON_ORDER,
  initialStats,
  type BiomeDef,
  type BiomeId,
  type BossId,
  type EnemyType,
  type GameOverStats,
  type HudData,
  type Phase,
  type PlayerStats,
  type Resources,
  type UpgradeChoice,
  type WeaponId,
} from "./data";

/* ── сущности ── */

interface Enemy {
  type: EnemyType;
  x: number; y: number; kx: number; ky: number;
  hp: number; maxHp: number;
  speed: number; r: number; dmg: number;
  flash: number; t: number; seed: number;
  shootCd: number; tick: number;
  score: number;
  boss?: BossId;
  atkCd: number;
  tele: number;
  teleX: number; teleY: number;
  chargeT: number;
  ringCd: number;
  wander: number;
  bossVx: number;
  bossVy: number;
}

interface Bullet {
  x: number; y: number; vx: number; vy: number;
  dmg: number; life: number; pierce: number;
  color: string; crit: boolean;
  explode?: number;
  hit: Set<Enemy>;
}

interface EBullet {
  x: number; y: number; vx: number; vy: number;
  dmg: number; r: number; life: number; t: number; color: string;
}

interface Particle {
  kind: "spark" | "smoke" | "shell" | "ring" | "flash" | "debris" | "ghost" | "beam";
  x: number; y: number; vx: number; vy: number;
  t: number; life: number; size: number; color: string;
  rot: number; vr: number;
}

interface Floater {
  x: number; y: number; text: string; color: string;
  t: number; life: number; size: number; disp: boolean;
}

interface WeatherP {
  x: number; y: number; vx: number; vy: number;
  t: number; life: number; size: number; color: string;
}

interface Orb {
  x: number; y: number; vx: number; vy: number;
  kind: "scrap" | "bio" | "core" | "heal";
  val: number; t: number; life: number;
}

interface Chest { x: number; y: number; t: number; opened: boolean; openT: number }
interface MineEnt { x: number; y: number; arm: number; fuse: number }
interface DamageRing { x: number; y: number; r: number; speed: number; maxR: number; dmg: number; color: string; hit: boolean }
interface Decal { x: number; y: number; r: number; color: string; a: number }

interface Wall { x: number; y: number; w: number; h: number }
interface Pillar { x: number; y: number; r: number }
interface CrateEnt { x: number; y: number; s: number; hp: number; maxHp: number; flash: number }
interface Deco { kind: string; x: number; y: number; r: number; rot: number; v: number }
interface Chunk {
  cx: number; cy: number; biome: BiomeId;
  walls: Wall[]; pillars: Pillar[]; crates: CrateEnt[]; decos: Deco[];
}

export interface EngineCallbacks {
  onHud: (h: HudData) => void;
  onPhase: (p: Phase) => void;
  onChoices: (c: UpgradeChoice[]) => void;
  onGameOver: (s: GameOverStats) => void;
  onBanner: (text: string, sub?: string) => void;
}

const TAU = Math.PI * 2;
const CHUNK = 640;
const SEED = 90210;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const DASH_TIME = 0.16;
const DASH_SPEED = 1250;
const DASH_CD = 2.4;
const NOVA_CD = 6;
const NOVA_BASE_DMG = 55;
const NOVA_RADIUS = 225;
const SHIELD_TIME = 3;
const SHIELD_CD = 10;
const OVERLOAD_CD = 14;
const MINE_CD = 5;

const BOSS_IDS: BossId[] = ["mother", "juggernaut", "overseer"];

function hash2(x: number, y: number): number {
  let h = (x * 73856093) ^ (y * 19349663) ^ SEED;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Engine {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: EngineCallbacks;
  private sfx = new Sfx();

  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;

  phase: Phase = "menu";

  /* игрок */
  private px = 0; private py = 0;
  private pkx = 0; private pky = 0;
  private stats: PlayerStats = initialStats();
  private owned: WeaponId[] = ["pistol"];
  private weapon: WeaponId = "pistol";
  private cooldown = 0;
  private iframes = 0;
  private aim = 0;
  private moving = false;
  private laserOn = false;

  /* камера и мир */
  private camX = 0; private camY = 0;
  private chunks = new Map<string, Chunk>();
  private decals: Decal[] = [];

  /* сущности */
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private ebullets: EBullet[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private weather: WeatherP[] = [];
  private orbs: Orb[] = [];
  private chests: Chest[] = [];
  private mines: MineEnt[] = [];
  private rings: DamageRing[] = [];

  /* волна */
  private wave = 0;
  private quota = 0;
  private spawned = 0;
  private spawnT = 0;
  private bossId: BossId = "mother";
  private bossRef: Enemy | null = null;
  private bossSpawnT = 0;
  private lastBoss: BossId | null = null;
  private score = 0;
  private kills = 0;
  private time = 0;
  private choices: UpgradeChoice[] = [];

  /* ресурсы */
  private res: Resources = { scrap: 0, bio: 0, core: 0 };

  /* способности */
  private dashT = 0;
  private dashDx = 0; private dashDy = -1;
  private dashCharges = 1;
  private dashRecover = 0;
  private novaCd = 0;
  private shieldT = 0;
  private shieldCd = 0;
  private ovT = 0;
  private ovCd = 0;
  private mineCharges = 3;
  private mineRecover = 0;

  /* fx-состояния */
  private shake = 0;
  private hurtT = 0;
  private recoilT = 0;
  private hudT = 0;
  private hitStop = 0;
  private weatherT = 0;
  private scuttleT = 0;

  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, down: false };

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks) {
    this.cv = canvas;
    this.cb = cb;
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    this.camX = this.px;
    this.camY = this.py;
    this.mouse.x = this.w / 2;
    this.mouse.y = this.h / 3;
  }

  /* ── ввод ── */

  private onKeyDown = (e: KeyboardEvent) => {
    const c = e.code;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(c)) e.preventDefault();
    this.keys.add(c);
    if (c === "KeyM") this.toggleMute();
    if (c === "Escape" || c === "KeyP") {
      if (this.phase === "playing") this.pause();
      else if (this.phase === "paused") this.resume();
      else if (this.phase === "craft") this.closeCraft();
      return;
    }
    if (c === "KeyC") {
      if (this.phase === "playing") this.openCraft();
      else if (this.phase === "craft") this.closeCraft();
      return;
    }
    if (this.phase === "menu" || this.phase === "gameover") {
      if (c === "Enter" || c === "Space") this.newGame();
      return;
    }
    if (this.phase === "intermission") {
      if (c === "Digit1") this.chooseByIndex(0);
      if (c === "Digit2") this.chooseByIndex(1);
      if (c === "Digit3") this.chooseByIndex(2);
      return;
    }
    if (this.phase === "playing") {
      for (let i = 0; i < WEAPON_ORDER.length; i++) {
        if (c === `Digit${i + 1}`) this.selectWeapon(WEAPON_ORDER[i]);
      }
      if (c === "Space") this.tryDash();
      if (c === "KeyE") this.tryNova();
      if (c === "KeyQ") this.tryShield();
      if (c === "KeyF") this.tryOverload();
      if (c === "KeyR") this.tryMine();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onMouseMove = (e: MouseEvent) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; };
  private onMouseDown = (e: MouseEvent) => { if (e.button === 0) { this.sfx.unlock(); this.mouse.down = true; } };
  private onMouseUp = () => (this.mouse.down = false);
  private onCtx = (e: Event) => e.preventDefault();
  private onWheel = (e: WheelEvent) => { if (this.phase === "playing") this.cycleWeapon(e.deltaY > 0 ? 1 : -1); };
  private onResize = () => this.resize();
  private onBlur = () => { this.keys.clear(); this.mouse.down = false; };

  private resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.cv.width = Math.floor(this.w * dpr);
    this.cv.height = Math.floor(this.h * dpr);
    this.cv.style.width = `${this.w}px`;
    this.cv.style.height = `${this.h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ── жизненный цикл ── */

  start() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    this.cv.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    this.cv.addEventListener("contextmenu", this.onCtx);
    window.addEventListener("wheel", this.onWheel);
    window.addEventListener("resize", this.onResize);
    window.addEventListener("blur", this.onBlur);
    this.last = performance.now();
    const tick = (t: number) => {
      let dt = clamp((t - this.last) / 1000, 0, 0.035);
      this.last = t;
      if (this.hitStop > 0) {
        this.hitStop -= dt;
        dt *= 0.15;
      }
      if (this.phase === "playing") this.update(dt);
      this.ambient(dt);
      this.draw(t / 1000);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    this.cv.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.cv.removeEventListener("contextmenu", this.onCtx);
    window.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("blur", this.onBlur);
    this.stopLaser();
  }

  newGame() {
    this.sfx.unlock();
    this.stats = initialStats();
    this.owned = ["pistol"];
    this.weapon = "pistol";
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.floaters = [];
    this.particles = [];
    this.orbs = [];
    this.chests = [];
    this.mines = [];
    this.rings = [];
    this.decals = [];
    this.chunks.clear();
    this.res = { scrap: 0, bio: 0, core: 0 };
    this.score = 0;
    this.kills = 0;
    this.time = 0;
    this.iframes = 0;
    this.pkx = 0; this.pky = 0;
    this.px = 0; this.py = 0;
    this.camX = 0; this.camY = 0;
    this.dashCharges = this.stats.dashMax;
    this.dashRecover = 0;
    this.dashT = 0;
    this.novaCd = 0;
    this.shieldT = 0; this.shieldCd = 0;
    this.ovT = 0; this.ovCd = 0;
    this.mineCharges = this.stats.mineMax;
    this.mineRecover = 0;
    this.bossRef = null;
    this.lastBoss = null;
    this.mouse.down = false;
    this.stopLaser();
    this.setPhase("playing");
    this.startWave(1);
    this.emitHud();
  }

  pause() { if (this.phase !== "playing") return; this.stopLaser(); this.mouse.down = false; this.setPhase("paused"); }
  resume() { if (this.phase !== "paused") return; this.setPhase("playing"); }
  openCraft() { if (this.phase !== "playing") return; this.stopLaser(); this.mouse.down = false; this.setPhase("craft"); this.emitHud(); }
  closeCraft() { if (this.phase !== "craft") return; this.setPhase("playing"); }
  toMenu() { this.stopLaser(); this.enemies = []; this.bullets = []; this.ebullets = []; this.floaters = []; this.setPhase("menu"); }
  toggleMute() { this.sfx.setMuted(!this.sfx.muted); this.emitHud(); }
  uiSound(kind: "hover" | "click") { this.sfx.unlock(); if (kind === "hover") this.sfx.uiHover(); else this.sfx.uiClick(); }

  craft(id: string) {
    if (this.phase !== "craft") return;
    const r = RECIPES.find((x) => x.id === id);
    if (!r) return;
    const cost = r.cost;
    if ((cost.scrap ?? 0) > this.res.scrap || (cost.bio ?? 0) > this.res.bio || (cost.core ?? 0) > this.res.core) {
      this.sfx.craftFail();
      return;
    }
    if (r.canUse && !r.canUse(this.stats)) { this.sfx.craftFail(); return; }
    this.res.scrap -= cost.scrap ?? 0;
    this.res.bio -= cost.bio ?? 0;
    this.res.core -= cost.core ?? 0;
    r.apply(this.stats);
    if (id === "cell") { this.dashCharges = this.stats.dashMax; this.dashRecover = 0; }
    if (id === "minePack") this.mineCharges = Math.min(this.stats.mineMax, this.mineCharges + 1);
    this.sfx.craftOk();
    this.float(this.px, this.py - 40, r.name.toUpperCase(), "#c8ff2e", 18, true);
    this.emitHud();
  }

  private setPhase(p: Phase) { this.phase = p; this.cb.onPhase(p); }

  /* ── генерация мира ── */

  private hashF(x: number, y: number): number { return (hash2(x, y) % 10000) / 10000; }

  private biomeAtChunk(cx: number, cy: number): BiomeId {
    const x = cx / 3.1;
    const y = cy / 3.1;
    const xi = Math.floor(x); const yi = Math.floor(y);
    const xf = x - xi; const yf = y - yi;
    const sm = (t: number) => t * t * (3 - 2 * t);
    const a = this.hashF(xi, yi); const b = this.hashF(xi + 1, yi);
    const c = this.hashF(xi, yi + 1); const d = this.hashF(xi + 1, yi + 1);
    const v = (a * (1 - sm(xf)) + b * sm(xf)) * (1 - sm(yf)) + (c * (1 - sm(xf)) + d * sm(xf)) * sm(yf);
    return BIOME_ORDER[Math.min(3, Math.floor(v * 4))];
  }

  private biomeAt(x: number, y: number): BiomeId {
    return this.biomeAtChunk(Math.floor(x / CHUNK), Math.floor(y / CHUNK));
  }

  private chunkKey(cx: number, cy: number) { return `${cx},${cy}`; }

  private getChunk(cx: number, cy: number): Chunk {
    const key = this.chunkKey(cx, cy);
    let ch = this.chunks.get(key);
    if (ch) return ch;
    ch = this.genChunk(cx, cy);
    this.chunks.set(key, ch);
    if (this.chunks.size > 60) {
      /* выкидываем самый дальний от игрока */
      const pcx = this.px / CHUNK; const pcy = this.py / CHUNK;
      let worst: string | null = null;
      let worstD = -1;
      for (const [k, c] of this.chunks) {
        const d = (c.cx - pcx) * (c.cx - pcx) + (c.cy - pcy) * (c.cy - pcy);
        if (d > worstD) { worstD = d; worst = k; }
      }
      if (worst) this.chunks.delete(worst);
    }
    return ch;
  }

  private genChunk(cx: number, cy: number): Chunk {
    const biome = this.biomeAtChunk(cx, cy);
    const rnd = mulberry(hash2(cx * 31 + 7, cy * 57 + 13));
    const walls: Wall[] = [];
    const pillars: Pillar[] = [];
    const crates: CrateEnt[] = [];
    const decos: Deco[] = [];
    const bx = cx * CHUNK; const by = cy * CHUNK;
    const nearStart = Math.hypot(bx + CHUNK / 2, by + CHUNK / 2) < 700;
    const defs = BIOMES[biome];

    if (!nearStart) {
      /* руины: прямоугольные стены */
      if (rnd() < 0.55) {
        const n = 2 + Math.floor(rnd() * 3);
        for (let i = 0; i < n; i++) {
          const horiz = rnd() < 0.5;
          const len = 160 + rnd() * 180;
          const th = 24;
          const x = bx + 50 + rnd() * (CHUNK - 100 - (horiz ? len : th));
          const y = by + 50 + rnd() * (CHUNK - 100 - (horiz ? th : len));
          walls.push(horiz ? { x, y, w: len, h: th } : { x, y, w: th, h: len });
        }
      }
      /* колонны */
      if (rnd() < 0.5) {
        const n = 2 + Math.floor(rnd() * 4);
        for (let i = 0; i < n; i++) {
          pillars.push({ x: bx + 60 + rnd() * (CHUNK - 120), y: by + 60 + rnd() * (CHUNK - 120), r: 20 + rnd() * 14 });
        }
      }
      /* ящики */
      if (rnd() < 0.62) {
        const n = 2 + Math.floor(rnd() * 5);
        const cxr = bx + 90 + rnd() * (CHUNK - 180);
        const cyr = by + 90 + rnd() * (CHUNK - 180);
        for (let i = 0; i < n; i++) {
          crates.push({ x: cxr + (i % 3) * 40 + rnd() * 10, y: cyr + Math.floor(i / 3) * 40 + rnd() * 10, s: 32, hp: 30, maxHp: 30, flash: 0 });
        }
      }
    }
    /* декорации */
    const nd = 8 + Math.floor(rnd() * 7);
    for (let i = 0; i < nd; i++) {
      const kind = defs.decos[Math.floor(rnd() * defs.decos.length)];
      decos.push({
        kind,
        x: bx + rnd() * CHUNK,
        y: by + rnd() * CHUNK,
        r: 8 + rnd() * 22,
        rot: rnd() * TAU,
        v: rnd(),
      });
    }
    return { cx, cy, biome, walls, pillars, crates, decos };
  }

  private nearChunks(x: number, y: number, radPx: number): Chunk[] {
    const minCx = Math.floor((x - radPx) / CHUNK);
    const maxCx = Math.floor((x + radPx) / CHUNK);
    const minCy = Math.floor((y - radPx) / CHUNK);
    const maxCy = Math.floor((y + radPx) / CHUNK);
    const out: Chunk[] = [];
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) out.push(this.getChunk(cx, cy));
    }
    return out;
  }

  private resolveCircle(x: number, y: number, r: number): { x: number; y: number } {
    const chs = this.nearChunks(x, y, CHUNK);
    for (const ch of chs) {
      for (const w of ch.walls) {
        const nx = clamp(x, w.x, w.x + w.w);
        const ny = clamp(y, w.y, w.y + w.h);
        const dx = x - nx; const dy = y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          if (d2 < 0.0001) {
            const l = x - w.x; const rr = w.x + w.w - x; const tp = y - w.y; const bt = w.y + w.h - y;
            const m = Math.min(l, rr, tp, bt);
            if (m === l) x = w.x - r;
            else if (m === rr) x = w.x + w.w + r;
            else if (m === tp) y = w.y - r;
            else y = w.y + w.h + r;
          } else {
            const d = Math.sqrt(d2);
            x = nx + (dx / d) * r;
            y = ny + (dy / d) * r;
          }
        }
      }
      for (const p of ch.pillars) {
        const dx = x - p.x; const dy = y - p.y;
        const d2 = dx * dx + dy * dy;
        const rr = r + p.r;
        if (d2 < rr * rr && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = p.x + (dx / d) * rr;
          y = p.y + (dy / d) * rr;
        }
      }
      for (const cr of ch.crates) {
        const hw = cr.s / 2;
        const nx = clamp(x, cr.x - hw, cr.x + hw);
        const ny = clamp(y, cr.y - hw, cr.y + hw);
        const dx = x - nx; const dy = y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          if (d2 < 0.0001) { y = cr.y - hw - r; }
          else {
            const d = Math.sqrt(d2);
            x = nx + (dx / d) * r;
            y = ny + (dy / d) * r;
          }
        }
      }
    }
    return { x, y };
  }

  private pointBlocked(x: number, y: number): boolean {
    const chs = this.nearChunks(x, y, CHUNK);
    for (const ch of chs) {
      for (const w of ch.walls) if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return true;
      for (const p of ch.pillars) {
        const dx = x - p.x; const dy = y - p.y;
        if (dx * dx + dy * dy < p.r * p.r) return true;
      }
      for (const cr of ch.crates) {
        const hw = cr.s / 2;
        if (x >= cr.x - hw && x <= cr.x + hw && y >= cr.y - hw && y <= cr.y + hw) return true;
      }
    }
    return false;
  }

  /* ── волны и боссы ── */

  private startWave(n: number) {
    this.wave = n;
    this.quota = Math.min(34, 5 + n * 2 + Math.floor(Math.pow(n, 1.25)));
    this.spawned = 0;
    this.spawnT = 1.1;
    this.bossSpawnT = 2.6;
    this.bossRef = null;
    const pool = BOSS_IDS.filter((b) => b !== this.lastBoss);
    this.bossId = pool[Math.floor(Math.random() * pool.length)];
    this.lastBoss = this.bossId;
    this.sfx.waveHorn();
    this.cb.onBanner(`ВОЛНА ${n}`, `${BIOMES[this.biomeAt(this.px, this.py)].name} · целей: ${this.quota + 1}`);
  }

  private hpMul() { return 1 + (this.wave - 1) * 0.16; }
  private spdMul() { return Math.min(1.75, 1 + (this.wave - 1) * 0.045); }
  private dmgMul() { return 1 + (this.wave - 1) * 0.07; }

  private pickType(): EnemyType {
    const biome = this.biomeAt(this.px, this.py);
    const pool: Array<[EnemyType, number]> = [["chaser", 10]];
    if (this.wave >= 2) pool.push(["runner", 6]);
    if (this.wave >= 3) pool.push(["spitter", biome === "fungal" ? 6.5 : 4.5]);
    if (this.wave >= 3) pool.push(["bomber", biome === "ember" ? 6 : 3.5]);
    if (this.wave >= 4) pool.push(["brute", 2.6]);
    if (this.wave >= 4) pool.push(["wisp", biome === "frost" ? 6 : 3.5]);
    if (this.wave >= 5) pool.push(["healer", biome === "fungal" ? 4 : 2.5]);
    if (this.wave >= 5) pool.push(["gazer", biome === "frost" ? 4 : 3]);
    let total = 0;
    for (const [, wgt] of pool) total += wgt;
    let roll = Math.random() * total;
    for (const [t, wgt] of pool) {
      roll -= wgt;
      if (roll <= 0) return t;
    }
    return "chaser";
  }

  private spawnAt(type: EnemyType, x: number, y: number, scale = 1): Enemy {
    const def = ENEMIES[type];
    const e: Enemy = {
      type, x, y, kx: 0, ky: 0,
      hp: def.hp * this.hpMul() * scale,
      maxHp: def.hp * this.hpMul() * scale,
      speed: def.speed * this.spdMul() * rand(0.88, 1.12),
      r: def.r,
      dmg: def.dmg * this.dmgMul(),
      flash: 0, t: rand(0, TAU), seed: rand(0, TAU),
      shootCd: rand(1.2, 2.4), tick: 0,
      score: def.score,
      atkCd: rand(2, 4), tele: 0, teleX: 0, teleY: 1, chargeT: 0, ringCd: 0,
      wander: rand(0, TAU), bossVx: 0, bossVy: 0,
    };
    this.enemies.push(e);
    this.puff(x, y, def.color, 5);
    return e;
  }

  private spawnEnemy() {
    /* пока босс жив — часть волны приходит из его свиты */
    if (this.bossRef && Math.random() < 0.45) {
      this.spawnRetinue();
      this.spawned++;
      return;
    }
    const type = this.pickType();
    const a = rand(0, TAU);
    const d = rand(720, 1050);
    let x = this.px + Math.cos(a) * d;
    let y = this.py + Math.sin(a) * d;
    const pos = this.resolveCircle(x, y, ENEMIES[type].r + 2);
    x = pos.x; y = pos.y;
    this.spawnAt(type, x, y);
    this.spawned++;
  }

  private spawnBoss() {
    const def = BOSSES[this.bossId];
    const a = rand(0, TAU);
    const d = 620;
    const x = this.px + Math.cos(a) * d;
    const y = this.py + Math.sin(a) * d;
    const hpScale = this.hpMul() * (1 + (this.wave - 1) * 0.1);
    const e: Enemy = {
      type: "brute",
      boss: this.bossId,
      x, y, kx: 0, ky: 0,
      hp: def.hp * hpScale,
      maxHp: def.hp * hpScale,
      speed: def.speed * this.spdMul(),
      r: def.r,
      dmg: def.dmg * this.dmgMul(),
      flash: 0, t: 0, seed: rand(0, TAU),
      shootCd: rand(1.5, 2.5), tick: 0,
      score: def.score,
      atkCd: 2.5, tele: 0, teleX: 0, teleY: 1, chargeT: 0, ringCd: 0,
      wander: 0, bossVx: 0, bossVy: 0,
    };
    this.enemies.push(e);
    this.bossRef = e;
    this.sfx.bossRoar();
    this.shake = Math.min(20, this.shake + 12);
    this.cb.onBanner(`БОСС: ${def.name}`, def.sub);
    this.particles.push({ kind: "ring", x, y, vx: 0, vy: 0, t: 0, life: 0.7, size: def.r, color: def.color, rot: 0, vr: 0 });
    this.burst(x, y, def.color, 20);
    this.emitHud();
  }

  private spawnRetinue() {
    const def = BOSSES[this.bossId];
    const type = def.retinue[Math.floor(Math.random() * def.retinue.length)];
    if (this.enemies.length > 44) return;
    const a = rand(0, TAU);
    const x = this.px + Math.cos(a) * rand(400, 700);
    const y = this.py + Math.sin(a) * rand(400, 700);
    this.spawnAt(type, x, y);
  }

  /* ── апгрейды ── */

  private buildChoices() {
    const pool: UpgradeChoice[] = [];
    const unowned = WEAPON_ORDER.filter((id) => !this.owned.includes(id));
    const wantWeapon = unowned.length > 0 && (this.wave === 1 || Math.random() < 0.5);
    if (wantWeapon) {
      const id = unowned[Math.floor(Math.random() * unowned.length)];
      const w = WEAPONS[id];
      pool.push({ key: `wpn:${id}`, kind: "weapon", name: w.name, desc: w.tag, icon: id, rarity: "weapon", weaponId: id });
    }
    const avail = UPGRADES.filter((u) => {
      const taken = this.stats.taken[u.id] ?? 0;
      if (taken >= u.max) return false;
      if (u.id === "heal" && this.stats.hp >= this.stats.maxHp * 0.98) return false;
      return true;
    }).sort(() => Math.random() - 0.5);
    for (const u of avail) {
      if (pool.length >= 3) break;
      pool.push({ key: `up:${u.id}`, kind: "upgrade", name: u.name, desc: u.desc, icon: u.icon, rarity: u.rarity });
    }
    while (pool.length < 3) {
      pool.push({ key: "up:heal", kind: "upgrade", name: "Полевой хирург", desc: "Восстанавливает 60% здоровья", icon: "heart", rarity: "common" });
    }
    this.choices = pool.slice(0, 3);
    this.cb.onChoices(this.choices);
  }

  chooseByIndex(i: number) {
    if (this.phase !== "intermission") return;
    const c = this.choices[i];
    if (!c) return;
    this.applyChoice(c);
  }

  private applyChoice(c: UpgradeChoice) {
    if (c.kind === "weapon" && c.weaponId) {
      this.owned.push(c.weaponId);
      this.selectWeapon(c.weaponId);
      this.float(this.px, this.py - 40, `+ ${c.name.toUpperCase()}`, WEAPONS[c.weaponId].color, 20, true);
    } else {
      const def = UPGRADES.find((u) => `up:${u.id}` === c.key);
      if (def) {
        def.apply(this.stats);
        this.stats.taken[def.id] = (this.stats.taken[def.id] ?? 0) + 1;
        if (def.id === "dashMax") { this.dashCharges = this.stats.dashMax; this.dashRecover = 0; }
        if (def.id === "mineMax") this.mineCharges = Math.min(this.stats.mineMax, this.mineCharges + 1);
        this.float(this.px, this.py - 40, def.name.toUpperCase(), "#35f0ff", 18, true);
      }
    }
    this.sfx.upgrade();
    this.burst(this.px, this.py, "#c8ff2e", 26);
    this.setPhase("playing");
    this.startWave(this.wave + 1);
    this.emitHud();
  }

  /* ── оружие ── */

  selectWeapon(id: WeaponId) {
    if (!this.owned.includes(id) || this.weapon === id) return;
    this.stopLaser();
    this.weapon = id;
    this.cooldown = Math.min(this.cooldown, 0.12);
    this.sfx.uiClick();
    this.emitHud();
  }

  private cycleWeapon(dir: number) {
    const idx = this.owned.indexOf(this.weapon);
    const next = this.owned[(idx + dir + this.owned.length) % this.owned.length];
    this.selectWeapon(next);
  }

  private stopLaser() {
    if (this.laserOn) { this.laserOn = false; this.sfx.laserOff(); }
  }

  /* ── суперспособности ── */

  private moveDir(): { x: number; y: number } {
    let dx = 0; let dy = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) dy -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) dy += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) dx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) dx += 1;
    if (dx === 0 && dy === 0) return { x: Math.cos(this.aim), y: Math.sin(this.aim) };
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  private tryDash() {
    if (this.phase !== "playing" || this.dashT > 0 || this.dashCharges <= 0) return;
    const d = this.moveDir();
    this.dashDx = d.x; this.dashDy = d.y;
    this.dashT = DASH_TIME;
    this.dashCharges--;
    if (this.dashRecover <= 0) this.dashRecover = DASH_CD * this.stats.abilityCdMul;
    this.sfx.dash();
    this.shake = Math.min(12, this.shake + 3);
    this.puff(this.px - d.x * 16, this.py - d.y * 16, "#c8ff2e", 9);
    this.emitHud();
  }

  private tryNova() {
    if (this.phase !== "playing" || this.novaCd > 0) return;
    const s = this.stats;
    const novaUp = s.taken["novaPower"] ?? 0;
    const radius = NOVA_RADIUS * (1 + 0.15 * novaUp);
    const dmg = NOVA_BASE_DMG * s.damage * s.novaPower;
    this.novaCd = NOVA_CD * s.abilityCdMul;

    const targets = this.enemies.filter((e) => Math.hypot(e.x - this.px, e.y - this.py) < radius + e.r);
    for (const e of targets) {
      if (e.hp <= 0) continue;
      const dx = e.x - this.px; const dy = e.y - this.py;
      const d = Math.hypot(dx, dy) || 1;
      const kb = e.boss ? 120 : e.type === "brute" ? 320 : 780;
      this.damageEnemy(e, dmg, false, (dx / d) * kb, (dy / d) * kb, true);
    }
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const b = this.ebullets[i];
      if (Math.hypot(b.x - this.px, b.y - this.py) < radius) {
        this.puff(b.x, b.y, "#7dff5e", 4);
        this.ebullets.splice(i, 1);
      }
    }
    this.particles.push({ kind: "flash", x: this.px, y: this.py, vx: 0, vy: 0, t: 0, life: 0.18, size: 70, color: "#ffb020", rot: rand(0, TAU), vr: 0 });
    this.particles.push({ kind: "ring", x: this.px, y: this.py, vx: 0, vy: 0, t: 0, life: 0.4, size: 26, color: "#ffb020", rot: 0, vr: 0 });
    this.particles.push({ kind: "ring", x: this.px, y: this.py, vx: 0, vy: 0, t: 0, life: 0.55, size: radius * 0.5, color: "#ff3864", rot: 0, vr: 0 });
    this.burst(this.px, this.py, "#ffb020", 28);
    this.decal(this.px, this.py, radius * 0.7, "rgba(20,14,8,0.5)");
    this.shake = Math.min(22, this.shake + 13);
    this.sfx.nova();
    this.float(this.px, this.py - 46, "НОВА", "#ffb020", 22, true);
    this.emitHud();
  }

  private tryShield() {
    if (this.phase !== "playing" || this.shieldCd > 0 || this.shieldT > 0) return;
    this.shieldT = SHIELD_TIME;
    this.shieldCd = SHIELD_CD * this.stats.abilityCdMul;
    this.particles.push({ kind: "ring", x: this.px, y: this.py, vx: 0, vy: 0, t: 0, life: 0.35, size: 20, color: "#35f0ff", rot: 0, vr: 0 });
    this.puff(this.px, this.py, "#35f0ff", 10);
    this.sfx.shieldUp();
    this.float(this.px, this.py - 40, "ЩИТ", "#35f0ff", 18, true);
    this.emitHud();
  }

  private tryOverload() {
    if (this.phase !== "playing" || this.ovCd > 0 || this.ovT > 0) return;
    this.ovT = 4 + this.stats.overloadBonus;
    this.ovCd = OVERLOAD_CD * this.stats.abilityCdMul;
    this.sfx.overload();
    this.particles.push({ kind: "ring", x: this.px, y: this.py, vx: 0, vy: 0, t: 0, life: 0.35, size: 18, color: "#ffd27a", rot: 0, vr: 0 });
    this.float(this.px, this.py - 40, "ПЕРЕГРУЗКА", "#ffd27a", 18, true);
    this.emitHud();
  }

  private tryMine() {
    if (this.phase !== "playing" || this.mineCharges <= 0) return;
    const mx = this.px + Math.cos(this.aim) * 44;
    const my = this.py + Math.sin(this.aim) * 44;
    this.mines.push({ x: mx, y: my, arm: 0.35, fuse: -1 });
    this.mineCharges--;
    if (this.mineRecover <= 0) this.mineRecover = MINE_CD * this.stats.abilityCdMul;
    this.sfx.minePlace();
    this.emitHud();
  }

  /* ── стрельба ── */

  private fireBullets() {
    const s = this.stats;
    const w = WEAPONS[this.weapon];
    const mx = this.px + Math.cos(this.aim) * 24;
    const my = this.py + Math.sin(this.aim) * 24;
    const shots = w.pellets + s.extraShots;
    for (let i = 0; i < shots; i++) {
      const off = shots > 1 ? (i - (shots - 1) / 2) * w.spread * 0.66 : 0;
      const a = this.aim + off + rand(-w.spread, w.spread) * 0.5;
      const crit = Math.random() < s.crit;
      const dmg = w.dmg * s.damage * (crit ? 2 : 1);
      this.bullets.push({
        x: mx, y: my,
        vx: Math.cos(a) * w.speed * rand(0.92, 1.08),
        vy: Math.sin(a) * w.speed * rand(0.92, 1.08),
        dmg, life: w.life, pierce: s.pierce,
        color: crit ? "#ffd27a" : w.color, crit,
        explode: w.explode,
        hit: new Set(),
      });
    }
    this.pkx -= Math.cos(this.aim) * w.kick;
    this.pky -= Math.sin(this.aim) * w.kick;
    this.recoilT = 0.08;
    this.shake = Math.min(14, this.shake + w.shake);
    this.particles.push({ kind: "flash", x: mx, y: my, vx: 0, vy: 0, t: 0, life: 0.06, size: w.id === "shotgun" ? 26 : 14, color: w.color, rot: this.aim, vr: 0 });
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        kind: "spark", x: mx, y: my,
        vx: Math.cos(this.aim + rand(-0.5, 0.5)) * rand(120, 320),
        vy: Math.sin(this.aim + rand(-0.5, 0.5)) * rand(120, 320),
        t: 0, life: rand(0.08, 0.16), size: rand(1, 2.4), color: w.color, rot: 0, vr: 0,
      });
    }
    const side = this.aim + Math.PI / 2;
    this.particles.push({
      kind: "shell", x: this.px + Math.cos(side) * 10, y: this.py + Math.sin(side) * 10,
      vx: Math.cos(side) * rand(60, 130) + rand(-20, 20), vy: Math.sin(side) * rand(60, 130) - 80,
      t: 0, life: rand(0.4, 0.7), size: 3, color: "#ffb020", rot: rand(0, TAU), vr: rand(-14, 14),
    });
    if (w.id === "pistol") this.sfx.shootPistol();
    else if (w.id === "smg") this.sfx.shootSmg();
    else if (w.id === "shotgun") this.sfx.shootShotgun();
    else if (w.id === "minigun") this.sfx.shootMinigun();
    else this.sfx.shootPlasma();
  }

  private fireRail() {
    const s = this.stats;
    const w = WEAPONS.rail;
    const dirX = Math.cos(this.aim);
    const dirY = Math.sin(this.aim);
    const x1 = this.px + dirX * 24;
    const y1 = this.py + dirY * 24;
    let len = 1500;
    for (let d = 20; d < 1500; d += 16) {
      if (this.pointBlocked(x1 + dirX * d, y1 + dirY * d)) { len = d; break; }
    }
    const x2 = x1 + dirX * len;
    const y2 = y1 + dirY * len;
    for (const e of [...this.enemies]) {
      if (e.hp <= 0) continue;
      const d = distToSeg(e.x, e.y, x1, y1, x2, y2);
      if (d < e.r + 8) {
        const crit = Math.random() < s.crit;
        this.damageEnemy(e, w.dmg * s.damage * (crit ? 2 : 1), crit, dirX * 220, dirY * 220, false);
      }
    }
    this.particles.push({ kind: "beam", x: x1, y: y1, vx: 0, vy: 0, t: 0, life: 0.14, size: len, color: w.color, rot: this.aim, vr: 0 });
    this.particles.push({ kind: "flash", x: x1, y: y1, vx: 0, vy: 0, t: 0, life: 0.09, size: 24, color: "#ffffff", rot: this.aim, vr: 0 });
    if (this.pointBlocked(x2, y2)) {
      this.burst(x2, y2, "#8df6ff", 8);
      this.decal(x2, y2, 10, "rgba(141,246,255,0.2)");
    }
    this.pkx -= dirX * w.kick;
    this.pky -= dirY * w.kick;
    this.shake = Math.min(16, this.shake + w.shake);
    this.sfx.shootRail();
  }

  private fireLaser(dps: number, dt: number) {
    const s = this.stats;
    const dirX = Math.cos(this.aim);
    const dirY = Math.sin(this.aim);
    const x1 = this.px + dirX * 24;
    const y1 = this.py + dirY * 24;
    const x2 = this.px + dirX * 1600;
    const y2 = this.py + dirY * 1600;
    for (const e of this.enemies) {
      const d = distToSeg(e.x, e.y, x1, y1, x2, y2);
      if (d < e.r + 8) {
        const crit = Math.random() < s.crit * 0.25;
        e.hp -= dps * s.damage * dt * (crit ? 2 : 1);
        e.flash = 0.09;
        e.kx += dirX * 26 * dt;
        e.ky += dirY * 26 * dt;
        e.tick -= dt;
        if (e.tick <= 0) {
          e.tick = 0.13;
          const shown = Math.max(1, Math.round(dps * s.damage * 0.13 * (crit ? 2 : 1)));
          this.float(e.x + rand(-8, 8), e.y - e.r - 6, `${shown}`, crit ? "#ffd27a" : "#8df6ff", crit ? 18 : 12, crit);
          this.sfx.hit();
        }
        if (Math.random() < 0.3) {
          this.particles.push({
            kind: "spark", x: e.x + rand(-e.r, e.r) * 0.5, y: e.y + rand(-e.r, e.r) * 0.5,
            vx: rand(-140, 140), vy: rand(-140, 140),
            t: 0, life: rand(0.1, 0.22), size: rand(1, 2.2), color: "#35f0ff", rot: 0, vr: 0,
          });
        }
        if (e.hp <= 0) {
          const idx = this.enemies.indexOf(e);
          if (idx >= 0) this.killEnemy(idx);
        }
      }
    }
  }

  private plasmaExplode(x: number, y: number, radius: number, dmg: number) {
    for (const e of [...this.enemies]) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius + e.r) {
        const dx = (e.x - x) / (d || 1); const dy = (e.y - y) / (d || 1);
        this.damageEnemy(e, dmg, false, dx * 200, dy * 200, true);
      }
    }
    this.particles.push({ kind: "ring", x, y, vx: 0, vy: 0, t: 0, life: 0.3, size: radius * 0.4, color: "#ff6bd6", rot: 0, vr: 0 });
    this.burst(x, y, "#ff6bd6", 14);
    this.decal(x, y, radius * 0.5, "rgba(255,107,214,0.12)");
    this.shake = Math.min(14, this.shake + 4);
    this.sfx.explosion();
  }

  /* ── обновление ── */

  private update(dt: number) {
    this.time += dt;
    this.iframes = Math.max(0, this.iframes - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.recoilT = Math.max(0, this.recoilT - dt);
    this.novaCd = Math.max(0, this.novaCd - dt);
    this.shieldCd = Math.max(0, this.shieldCd - dt);
    this.shieldT = Math.max(0, this.shieldT - dt);
    this.ovCd = Math.max(0, this.ovCd - dt);
    this.ovT = Math.max(0, this.ovT - dt);
    if (this.dashCharges < this.stats.dashMax) {
      this.dashRecover -= dt;
      if (this.dashRecover <= 0) {
        this.dashCharges++;
        this.dashRecover = this.dashCharges < this.stats.dashMax ? DASH_CD * this.stats.abilityCdMul : 0;
        this.float(this.px, this.py - 34, "ЗАРЯД +1", "#c8ff2e", 13, false);
        this.emitHud();
      }
    }
    if (this.mineCharges < this.stats.mineMax) {
      this.mineRecover -= dt;
      if (this.mineRecover <= 0) {
        this.mineCharges++;
        this.mineRecover = this.mineCharges < this.stats.mineMax ? MINE_CD * this.stats.abilityCdMul : 0;
        this.emitHud();
      }
    }

    const s = this.stats;
    s.hp = Math.min(s.maxHp, s.hp + s.regen * dt);

    /* движение */
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.px += this.dashDx * DASH_SPEED * dt;
      this.py += this.dashDy * DASH_SPEED * dt;
      const pos = this.resolveCircle(this.px, this.py, 15);
      this.px = pos.x; this.py = pos.y;
      this.pkx = this.dashDx * 265 * s.moveSpeed;
      this.pky = this.dashDy * 265 * s.moveSpeed;
      this.moving = true;
      this.particles.push({ kind: "ghost", x: this.px, y: this.py, vx: 0, vy: 0, t: 0, life: 0.3, size: 13, color: "#c8ff2e", rot: this.aim, vr: 0 });
    } else {
      const d = this.rawMoveDir();
      this.moving = d.x !== 0 || d.y !== 0;
      const overMul = this.ovT > 0 ? 1.35 : 1;
      const spd = 265 * s.moveSpeed * overMul;
      const ease = 1 - Math.exp(-14 * dt);
      this.pkx += (d.x * spd - this.pkx) * ease;
      this.pky += (d.y * spd - this.pky) * ease;
      this.px += this.pkx * dt;
      this.py += this.pky * dt;
      const pos = this.resolveCircle(this.px, this.py, 15);
      this.px = pos.x; this.py = pos.y;
      if (this.moving && Math.random() < dt * 26) {
        this.particles.push({
          kind: "smoke", x: this.px - d.x * 14 + rand(-4, 4), y: this.py - d.y * 14 + rand(-4, 4),
          vx: -d.x * 30 + rand(-12, 12), vy: -d.y * 30 + rand(-12, 12),
          t: 0, life: rand(0.25, 0.5), size: rand(2, 5), color: "#35f0ff", rot: 0, vr: 0,
        });
      }
    }

    /* прицел (экранные координаты мыши → мир) */
    const spx = this.px - this.camX + this.w / 2;
    const spy = this.py - this.camY + this.h / 2;
    this.aim = Math.atan2(this.mouse.y - spy, this.mouse.x - spx);

    /* стрельба */
    const w = WEAPONS[this.weapon];
    const rateMul = s.fireRate * (this.ovT > 0 ? 2.5 : 1);
    if (this.mouse.down) {
      if (w.kind === "beam") {
        if (!this.laserOn) { this.laserOn = true; this.sfx.laserOn(); }
        this.fireLaser(w.dmg * (this.ovT > 0 ? 1.6 : 1), dt);
        this.shake = Math.min(10, this.shake + w.shake * dt * 8);
      } else if (w.kind === "rail") {
        if (this.cooldown <= 0) { this.fireRail(); this.cooldown = 1 / (w.rate * rateMul); }
      } else if (this.cooldown <= 0) {
        this.fireBullets();
        this.cooldown = 1 / (w.rate * rateMul);
      }
    } else {
      this.stopLaser();
    }

    /* спавн волны */
    if (this.spawned < this.quota) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnEnemy();
        if (Math.random() < (this.wave >= 5 ? 0.3 : 0.12) && this.spawned < this.quota) this.spawnEnemy();
        this.spawnT = Math.max(0.3, 1.05 - this.wave * 0.05) * rand(0.7, 1.3);
      }
    }
    if (!this.bossRef && this.bossSpawnT > 0) {
      this.bossSpawnT -= dt;
      if (this.bossSpawnT <= 0) this.spawnBoss();
    }

    /* падальщики (нейтральная фауна) */
    this.scuttleT -= dt;
    const scuttlers = this.enemies.filter((e) => e.type === "scuttler").length;
    if (this.scuttleT <= 0 && scuttlers < 6) {
      this.scuttleT = rand(2, 4);
      const a = rand(0, TAU);
      const d = rand(500, 900);
      this.spawnAt("scuttler", this.px + Math.cos(a) * d, this.py + Math.sin(a) * d);
    }

    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateEnemyBullets(dt);
    this.updateMines(dt);
    this.updateOrbs(dt);
    this.updateChests(dt);
    this.updateRings(dt);

    /* камера */
    const ce = 1 - Math.exp(-6 * dt);
    this.camX += (this.px - this.camX) * ce;
    this.camY += (this.py - this.camY) * ce;

    /* перегрузка: искры */
    if (this.ovT > 0 && Math.random() < dt * 26) {
      const a = rand(0, TAU);
      this.particles.push({
        kind: "spark", x: this.px + Math.cos(a) * 16, y: this.py + Math.sin(a) * 16,
        vx: Math.cos(a) * rand(60, 180), vy: Math.sin(a) * rand(60, 180),
        t: 0, life: rand(0.1, 0.2), size: rand(1, 2), color: Math.random() < 0.5 ? "#ffd27a" : "#8df6ff", rot: 0, vr: 0,
      });
    }

    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.emitHud(); }
  }

  private rawMoveDir(): { x: number; y: number } {
    let dx = 0; let dy = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) dy -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) dy += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) dx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) dx += 1;
    const len = Math.hypot(dx, dy);
    if (len === 0) return { x: 0, y: 0 };
    return { x: dx / len, y: dy / len };
  }

  private updateMines(dt: number) {
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      m.arm = Math.max(0, m.arm - dt);
      if (m.arm <= 0 && m.fuse < 0) {
        for (const e of this.enemies) {
          if (Math.hypot(e.x - m.x, e.y - m.y) < 70 + e.r) {
            m.fuse = 0.16;
            this.sfx.mineBeep();
            break;
          }
        }
      }
      if (m.fuse >= 0) {
        m.fuse -= dt;
        if (m.fuse <= 0) {
          this.mines.splice(i, 1);
          const dmg = 95 * this.stats.damage;
          for (const e of [...this.enemies]) {
            if (e.hp <= 0) continue;
            const d = Math.hypot(e.x - m.x, e.y - m.y);
            if (d < 135 + e.r) {
              const dx = (e.x - m.x) / (d || 1); const dy = (e.y - m.y) / (d || 1);
              this.damageEnemy(e, dmg * (1 - d / 260), false, dx * 420, dy * 420, true);
            }
          }
          this.particles.push({ kind: "ring", x: m.x, y: m.y, vx: 0, vy: 0, t: 0, life: 0.35, size: 30, color: "#ffb020", rot: 0, vr: 0 });
          this.burst(m.x, m.y, "#ffb020", 20);
          this.decal(m.x, m.y, 26, "rgba(16,13,20,0.5)");
          this.shake = Math.min(16, this.shake + 8);
          this.sfx.explosion();
        }
      }
    }
  }

  private updateOrbs(dt: number) {
    const magnet = this.stats.magnetR;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.t += dt;
      o.life -= dt;
      const dx = this.px - o.x; const dy = this.py - o.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < magnet) {
        const pull = 900 * (1 - d / magnet) + 220;
        o.vx += (dx / d) * pull * dt * 4;
        o.vy += (dy / d) * pull * dt * 4;
      }
      o.vx *= Math.exp(-3 * dt);
      o.vy *= Math.exp(-3 * dt);
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (d < 26) {
        this.collectOrb(o);
        this.orbs.splice(i, 1);
        continue;
      }
      if (o.life <= 0) this.orbs.splice(i, 1);
    }
  }

  private collectOrb(o: Orb) {
    if (o.kind === "heal") {
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + o.val);
      this.float(this.px, this.py - 30, `+${o.val} HP`, "#5eff9c", 14, false);
      this.sfx.healPickup();
    } else {
      this.res[o.kind] += o.val;
      const label = o.kind === "scrap" ? "ЛОМ" : o.kind === "bio" ? "БИО" : "ЯДРО";
      const color = o.kind === "scrap" ? "#ffd27a" : o.kind === "bio" ? "#7dff5e" : "#8df6ff";
      this.float(this.px, this.py - 30, `+${o.val} ${label}`, color, o.kind === "core" ? 16 : 13, o.kind === "core");
      if (o.kind === "core") this.sfx.corePickup();
      else this.sfx.pickup();
    }
    this.emitHud();
  }

  private updateChests(dt: number) {
    for (const ch of this.chests) {
      ch.t += dt;
      if (!ch.opened && Math.hypot(this.px - ch.x, this.py - ch.y) < 46) {
        ch.opened = true;
        ch.openT = 0.6;
        this.score += 100 * this.wave;
        this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + this.stats.maxHp * 0.15);
        this.sfx.chestOpen();
        this.burst(ch.x, ch.y, "#ffb020", 22);
        this.particles.push({ kind: "ring", x: ch.x, y: ch.y, vx: 0, vy: 0, t: 0, life: 0.5, size: 26, color: "#ffb020", rot: 0, vr: 0 });
        this.cb.onBanner("ЛУТ ДОБЫТ", `бонус +${100 * this.wave}`);
        const lootMul = this.stats.lootMul;
        const drop = (kind: Orb["kind"], n: number, val: number) => {
          for (let i = 0; i < n; i++) {
            const a = rand(0, TAU);
            this.orbs.push({
              x: ch.x, y: ch.y,
              vx: Math.cos(a) * rand(90, 260), vy: Math.sin(a) * rand(90, 260),
              kind, val: Math.max(1, Math.round(val * lootMul)), t: 0, life: 30,
            });
          }
        };
        drop("scrap", 5, 3);
        drop("bio", 4, 2);
        drop("core", 2, 1);
        drop("heal", 1, Math.round(this.stats.maxHp * 0.2));
        this.emitHud();
      }
      if (ch.opened && ch.openT > 0) {
        ch.openT -= dt;
        if (ch.openT <= 0 && this.phase === "playing") {
          this.stopLaser();
          this.sfx.waveClear();
          this.buildChoices();
          this.setPhase("intermission");
          this.emitHud();
        }
      }
    }
    this.chests = this.chests.filter((c) => !(c.opened && c.openT <= 0));
  }

  private updateRings(dt: number) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.r += r.speed * dt;
      if (!r.hit) {
        const d = Math.hypot(this.px - r.x, this.py - r.y);
        if (Math.abs(d - r.r) < 26) {
          r.hit = true;
          this.damagePlayer(r.dmg);
        }
      }
      if (r.r >= r.maxR) this.rings.splice(i, 1);
    }
  }

  private updateEnemyBullets(dt: number) {
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const b = this.ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.t += dt;
      b.life -= dt;
      if (this.pointBlocked(b.x, b.y)) {
        this.puff(b.x, b.y, b.color, 4);
        this.ebullets.splice(i, 1);
        continue;
      }
      const dx = b.x - this.px; const dy = b.y - this.py;
      if (this.shieldT > 0 && dx * dx + dy * dy < 44 * 44) {
        this.puff(b.x, b.y, "#35f0ff", 5);
        this.sfx.shieldBlock();
        this.ebullets.splice(i, 1);
        continue;
      }
      if (dx * dx + dy * dy < (b.r + 15) * (b.r + 15)) {
        this.damagePlayer(b.dmg);
        this.puff(b.x, b.y, b.color, 6);
        this.ebullets.splice(i, 1);
        continue;
      }
      if (b.life <= 0 || Math.hypot(b.x - this.px, b.y - this.py) > 1600) {
        this.ebullets.splice(i, 1);
      }
    }
  }

  private updateBullets(dt: number) {
    const pr = 5;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      let blocked = false;
      if (!dead) {
        /* стены и колонны */
        if (this.pointBlocked(b.x, b.y)) {
          dead = true;
          blocked = true;
          this.puff(b.x, b.y, "#9aa7c7", 3);
        } else {
          /* ящики */
          const chs = this.nearChunks(b.x, b.y, CHUNK);
          outer: for (const ch of chs) {
            for (const cr of ch.crates) {
              const hw = cr.s / 2;
              if (b.x > cr.x - hw - pr && b.x < cr.x + hw + pr && b.y > cr.y - hw - pr && b.y < cr.y + hw + pr) {
                cr.hp -= b.dmg;
                cr.flash = 0.1;
                this.puff(b.x, b.y, "#c8a25e", 4);
                this.sfx.hit();
                if (cr.hp <= 0) this.breakCrate(ch, cr);
                dead = true;
                blocked = true;
                break outer;
              }
            }
          }
        }
      }
      if (!dead) {
        for (const e of this.enemies) {
          if (b.hit.has(e) || e.hp <= 0) continue;
          const rr = e.r + pr;
          const dx = e.x - b.x; const dy = e.y - b.y;
          if (dx * dx + dy * dy < rr * rr) {
            b.hit.add(e);
            const kb = e.boss ? 20 : e.type === "brute" ? 40 : 130;
            const inv = 1 / (Math.hypot(b.vx, b.vy) || 1);
            this.damageEnemy(e, b.dmg, b.crit, b.vx * inv * kb, b.vy * inv * kb, false);
            if (b.hit.size > b.pierce) { dead = true; break; }
          }
        }
      }
      if (dead) {
        if (b.explode) this.plasmaExplode(b.x, b.y, b.explode, b.dmg * (blocked ? 0.7 : 0.55));
        this.bullets.splice(i, 1);
      }
    }
  }

  private breakCrate(ch: Chunk, cr: CrateEnt) {
    const idx = ch.crates.indexOf(cr);
    if (idx >= 0) ch.crates.splice(idx, 1);
    this.burst(cr.x, cr.y, "#c8a25e", 12);
    this.sfx.explosion();
    this.decal(cr.x, cr.y, 16, "rgba(60,45,25,0.4)");
    const lootMul = this.stats.lootMul;
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const roll = Math.random();
      const kind: Orb["kind"] = roll < 0.6 ? "scrap" : roll < 0.9 ? "bio" : "core";
      this.orbs.push({
        x: cr.x, y: cr.y,
        vx: Math.cos(a) * rand(60, 180), vy: Math.sin(a) * rand(60, 180),
        kind, val: Math.max(1, Math.round((kind === "core" ? 1 : 2) * lootMul)), t: 0, life: 30,
      });
    }
  }

  private updateEnemies(dt: number) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      const dx = this.px - e.x;
      const dy = this.py - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      const aggro = ENEMIES[e.type].aggro;

      let vx = 0;
      let vy = 0;

      if (e.boss) {
        this.updateBoss(e, dt, nx, ny, dist);
        vx = e.bossVx ?? 0;
        vy = e.bossVy ?? 0;
      } else if (!aggro) {
        /* падальщик */
        e.wander += rand(-2.4, 2.4) * dt;
        vx = Math.cos(e.wander) * e.speed * 0.45;
        vy = Math.sin(e.wander) * e.speed * 0.45;
        if (dist < 160) { vx = -nx * e.speed; vy = -ny * e.speed; }
      } else if (e.type === "spitter") {
        if (dist < 230) { vx = -nx * e.speed * 0.8; vy = -ny * e.speed * 0.8; }
        else if (dist < 330) { vx = -ny * e.speed * 0.5; vy = nx * e.speed * 0.5; }
        else { vx = nx * e.speed; vy = ny * e.speed; }
        e.shootCd -= dt;
        if (e.shootCd <= 0 && dist < 560) {
          e.shootCd = rand(2.0, 2.7);
          const a = Math.atan2(dy, dx) + rand(-0.08, 0.08);
          this.ebullets.push({ x: e.x + nx * e.r, y: e.y + ny * e.r, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, dmg: 10 * this.dmgMul(), r: 6, life: 3.2, t: 0, color: "#7dff5e" });
          this.sfx.hit();
        }
      } else if (e.type === "bomber") {
        if (e.tele > 0) {
          e.tele -= dt;
          if (e.tele <= 0) { this.detonateBomber(i); continue; }
        } else if (dist < 80) {
          e.tele = 0.55;
          this.sfx.mineBeep();
        } else {
          vx = nx * e.speed;
          vy = ny * e.speed;
        }
      } else if (e.type === "wisp") {
        const strafe = Math.sin(e.t * 7 + e.seed) * 0.95;
        vx = (nx + -ny * strafe) * e.speed;
        vy = (ny + nx * strafe) * e.speed;
      } else if (e.type === "healer") {
        if (dist < 260) { vx = -nx * e.speed; vy = -ny * e.speed; }
        else if (dist > 360) { vx = nx * e.speed; vy = ny * e.speed; }
        e.shootCd -= dt;
        if (e.shootCd <= 0) {
          e.shootCd = 1.3;
          let healed = false;
          for (const o of this.enemies) {
            if (o !== e && o.hp < o.maxHp && Math.hypot(o.x - e.x, o.y - e.y) < 170) {
              o.hp = Math.min(o.maxHp, o.hp + 9);
              o.flash = 0.12;
              healed = true;
            }
          }
          if (healed) {
            this.particles.push({ kind: "ring", x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.4, size: 20, color: "#5eff9c", rot: 0, vr: 0 });
            this.sfx.healPickup();
          }
        }
      } else if (e.type === "gazer") {
        if (dist < 340) { vx = -nx * e.speed * 0.6; vy = -ny * e.speed * 0.6; }
        else if (dist > 440) { vx = nx * e.speed; vy = ny * e.speed; }
        e.shootCd -= dt;
        if (e.shootCd <= 0 && dist < 640) {
          e.shootCd = rand(2.2, 2.9);
          const a = Math.atan2(dy, dx);
          this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, dmg: 11 * this.dmgMul(), r: 5, life: 2.4, t: 0, color: "#e06bff" });
          this.puff(e.x, e.y, "#e06bff", 4);
        }
      } else {
        vx = nx * e.speed;
        vy = ny * e.speed;
      }

      e.x += (vx + e.kx) * dt;
      e.y += (vy + e.ky) * dt;
      const dec = Math.exp(-9 * dt);
      e.kx *= dec;
      e.ky *= dec;
      const pos = this.resolveCircle(e.x, e.y, e.r * 0.85);
      e.x = pos.x; e.y = pos.y;

      /* контактный урон */
      if (aggro && dist < e.r + 15) {
        if (this.shieldT > 0) {
          e.kx = -nx * 540; e.ky = -ny * 540;
          this.puff(this.px + nx * 20, this.py + ny * 20, "#35f0ff", 5);
          this.sfx.shieldBlock();
        } else if (this.dashT <= 0) {
          this.damagePlayer(e.dmg);
          e.kx = -nx * 260; e.ky = -ny * 260;
        }
      }

      if (e.hp <= 0) { this.killEnemy(i); continue; }

      /* расталкивание */
      for (let j = i - 1; j >= 0; j--) {
        const o = this.enemies[j];
        const sx = e.x - o.x; const sy = e.y - o.y;
        const sr = e.r + o.r;
        const d2 = sx * sx + sy * sy;
        if (d2 > 0.01 && d2 < sr * sr) {
          const d = Math.sqrt(d2);
          const push = ((sr - d) / d) * 0.5;
          e.x += sx * push; e.y += sy * push;
          o.x -= sx * push; o.y -= sy * push;
        }
      }
      if (e.hp <= 0) this.killEnemy(i);
    }
  }

  private updateBoss(e: Enemy, dt: number, nx: number, ny: number, dist: number) {
    e.atkCd -= dt;
    e.shootCd -= dt;
    let vx = nx * e.speed;
    let vy = ny * e.speed;

    if (e.chargeT > 0) {
      e.chargeT -= dt;
      vx = e.teleX * e.speed * (e.boss === "juggernaut" ? 13 : 6.5);
      vy = e.teleY * e.speed * (e.boss === "juggernaut" ? 13 : 6.5);
      if (e.boss === "juggernaut") {
        e.ringCd -= dt;
        if (e.ringCd <= 0) {
          e.ringCd = 0.17;
          this.rings.push({ x: e.x, y: e.y, r: 10, speed: 330, maxR: 190, dmg: 14 * this.dmgMul(), color: "#ffb020", hit: false });
        }
        this.shake = Math.min(14, this.shake + 14 * dt);
      }
    } else if (e.tele > 0) {
      e.tele -= dt;
      vx = 0; vy = 0;
      this.shake = Math.min(8, this.shake + 8 * dt);
      if (e.tele <= 0) {
        if (e.boss === "juggernaut") {
          const a = Math.atan2(this.py - e.y, this.px - e.x);
          e.teleX = Math.cos(a); e.teleY = Math.sin(a);
          e.chargeT = 0.55;
          e.ringCd = 0.1;
          this.sfx.bossRoar();
        } else {
          const a = Math.atan2(this.py - e.y, this.px - e.x);
          e.teleX = Math.cos(a); e.teleY = Math.sin(a);
          e.chargeT = 0.45;
        }
      }
    } else {
      if (e.boss === "mother") {
        if (e.atkCd <= 0 && this.enemies.length < 40) {
          e.atkCd = 4.2;
          const n = 2 + Math.min(3, Math.floor(this.wave / 3));
          for (let k = 0; k < n; k++) {
            const a = rand(0, TAU);
            this.spawnAt(Math.random() < 0.6 ? "chaser" : "runner", e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60);
          }
          this.particles.push({ kind: "ring", x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.4, size: 30, color: "#ff3864", rot: 0, vr: 0 });
        }
        if (e.shootCd <= 0 && dist > 200) {
          e.shootCd = 7;
          e.tele = 0.6;
          this.sfx.mineBeep();
        }
      } else if (e.boss === "juggernaut") {
        if (e.shootCd <= 0 && dist > 140) {
          e.shootCd = 5.5;
          e.tele = 0.7;
          const a = Math.atan2(this.py - e.y, this.px - e.x);
          e.teleX = Math.cos(a); e.teleY = Math.sin(a);
          this.sfx.mineBeep();
        }
      } else {
        /* надзиратель */
        if (dist < 380) { vx = -nx * e.speed; vy = -ny * e.speed; }
        else if (dist > 480) { vx = nx * e.speed; vy = ny * e.speed; }
        else { vx = -ny * e.speed * 0.6; vy = nx * e.speed * 0.6; }
        if (e.atkCd <= 0) {
          e.atkCd = 3.2;
          const n = 14;
          const base = rand(0, TAU);
          for (let k = 0; k < n; k++) {
            const a = base + (k / n) * TAU;
            this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 175, vy: Math.sin(a) * 175, dmg: 9 * this.dmgMul(), r: 7, life: 4, t: 0, color: "#e06bff" });
          }
          this.particles.push({ kind: "ring", x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.35, size: 22, color: "#c04dff", rot: 0, vr: 0 });
          this.sfx.shootPlasma();
        }
        if (e.shootCd <= 0) {
          e.shootCd = 8;
          this.puff(e.x, e.y, "#c04dff", 12);
          const a = rand(0, TAU);
          const d = 280;
          const target = this.resolveCircle(this.px + Math.cos(a) * d, this.py + Math.sin(a) * d, e.r);
          e.x = target.x; e.y = target.y;
          this.particles.push({ kind: "flash", x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.2, size: 40, color: "#c04dff", rot: rand(0, TAU), vr: 0 });
          this.puff(e.x, e.y, "#c04dff", 12);
        }
      }
    }
    e.bossVx = vx;
    e.bossVy = vy;
  }

  private detonateBomber(idx: number) {
    const e = this.enemies[idx];
    this.enemies.splice(idx, 1);
    const d = Math.hypot(this.px - e.x, this.py - e.y);
    if (d < 115 && this.shieldT <= 0 && this.dashT <= 0) this.damagePlayer(e.dmg);
    for (const o of [...this.enemies]) {
      if (o.hp <= 0) continue;
      const od = Math.hypot(o.x - e.x, o.y - e.y);
      if (od < 110) this.damageEnemy(o, 40, false, ((o.x - e.x) / (od || 1)) * 300, ((o.y - e.y) / (od || 1)) * 300, true);
    }
    this.particles.push({ kind: "ring", x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.3, size: 24, color: "#ff8b2e", rot: 0, vr: 0 });
    this.burst(e.x, e.y, "#ff8b2e", 16);
    this.decal(e.x, e.y, 20, "rgba(30,16,8,0.45)");
    this.shake = Math.min(16, this.shake + 7);
    this.sfx.explosion();
    this.dropLoot(e, true);
    this.kills++;
    this.score += e.score;
    this.emitHud();
  }

  private damageEnemy(e: Enemy, dmg: number, crit: boolean, kx: number, ky: number, silent: boolean) {
    e.hp -= dmg;
    e.flash = 0.09;
    e.kx += kx;
    e.ky += ky;
    const col = e.boss ? BOSSES[e.boss].color : ENEMIES[e.type].color;
    this.float(e.x + rand(-8, 8), e.y - e.r - 6, `${Math.max(1, Math.round(dmg))}`, crit ? "#ffd27a" : "#e8f6ff", crit ? 19 : 13, crit);
    this.puff(e.x, e.y, col, crit ? 7 : 3);
    if (!silent) {
      if (crit) this.sfx.crit();
      else this.sfx.hit();
    }
    if (e.hp <= 0) {
      const idx = this.enemies.indexOf(e);
      if (idx >= 0) this.killEnemy(idx);
    }
  }

  private dropLoot(e: Enemy, forced = false) {
    const lootMul = this.stats.lootMul;
    const scatter = (kind: Orb["kind"], val: number) => {
      const a = rand(0, TAU);
      this.orbs.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * rand(50, 170), vy: Math.sin(a) * rand(50, 170),
        kind, val: Math.max(1, Math.round(val * lootMul)), t: 0, life: 25,
      });
    };
    if (e.type === "scuttler") {
      scatter("bio", 1 + Math.floor(Math.random() * 2));
      return;
    }
    if (forced || Math.random() < 0.62) scatter("scrap", 1 + Math.floor(Math.random() * 2));
    if (forced || Math.random() < 0.45) scatter("bio", 1 + Math.floor(Math.random() * 2));
    const coreChance = e.type === "brute" ? 0.14 : 0.028;
    if (Math.random() < coreChance) scatter("core", 1);
    if (Math.random() < 0.06) {
      const a = rand(0, TAU);
      this.orbs.push({ x: e.x, y: e.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, kind: "heal", val: 10, t: 0, life: 25 });
    }
  }

  private killEnemy(idx: number) {
    const e = this.enemies[idx];
    this.enemies.splice(idx, 1);
    const col = e.boss ? BOSSES[e.boss].color : ENEMIES[e.type].color;
    this.kills++;
    this.score += e.score;
    this.hitStop = e.boss ? 0.12 : 0.035;
    this.shake = Math.min(16, this.shake + (e.boss ? 16 : e.type === "brute" ? 9 : 3));
    this.burst(e.x, e.y, col, e.boss ? 40 : e.type === "brute" ? 26 : 12);
    this.particles.push({ kind: "ring", x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.3, size: e.r * 1.4, color: col, rot: 0, vr: 0 });
    this.decal(e.x, e.y, e.r * 0.8, hexA(col, 0.16));

    if (e.boss) {
      this.onBossKilled(e);
    } else {
      this.dropLoot(e);
    }
    if (e.type === "brute" || e.boss) this.sfx.bruteKill();
    else this.sfx.kill();
    this.emitHud();
  }

  private onBossKilled(e: Enemy) {
    this.bossRef = null;
    this.sfx.explosion();
    this.particles.push({ kind: "ring", x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.8, size: 40, color: BOSSES[e.boss!].color, rot: 0, vr: 0 });
    this.particles.push({ kind: "ring", x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 1, size: 90, color: "#ffb020", rot: 0, vr: 0 });
    this.decal(e.x, e.y, 60, "rgba(16,13,20,0.55)");
    /* остатки свиты разлетаются */
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const o = this.enemies[i];
      if (ENEMIES[o.type].aggro) {
        this.burst(o.x, o.y, ENEMIES[o.type].color, 8);
        this.score += Math.floor(o.score / 2);
        this.kills++;
        this.enemies.splice(i, 1);
      }
    }
    this.ebullets = [];
    this.chests.push({ x: e.x, y: e.y, t: 0, opened: false, openT: 0 });
    this.float(e.x, e.y - 60, "БОСС ПОВЕРЖЕН", "#ffb020", 24, true);
    this.emitHud();
  }

  private damagePlayer(dmg: number) {
    if (this.iframes > 0 || this.phase !== "playing") return;
    this.stats.hp -= dmg;
    this.iframes = 0.9;
    this.hurtT = 0.45;
    this.shake = Math.min(20, this.shake + 10);
    this.sfx.hurt();
    this.puff(this.px, this.py, "#ff3864", 10);
    this.emitHud();
    if (this.stats.hp <= 0) {
      this.stats.hp = 0;
      this.gameOver();
    }
  }

  private gameOver() {
    this.stopLaser();
    this.burst(this.px, this.py, "#c8ff2e", 40);
    this.burst(this.px, this.py, "#ff3864", 24);
    this.particles.push({ kind: "ring", x: this.px, y: this.py, vx: 0, vy: 0, t: 0, life: 0.7, size: 30, color: "#c8ff2e", rot: 0, vr: 0 });
    this.shake = 22;
    this.sfx.gameOver();
    this.cb.onGameOver({ score: this.score, kills: this.kills, wave: this.wave, time: this.time });
    this.setPhase("gameover");
  }

  /* ── эффекты ── */

  private decal(x: number, y: number, r: number, color: string) {
    if (this.decals.length > 160) this.decals.shift();
    this.decals.push({ x, y, r, color, a: 1 });
  }

  private puff(x: number, y: number, color: string, n: number) {
    if (this.particles.length > 520) return;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(40, 220);
      this.particles.push({ kind: "spark", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(0.15, 0.35), size: rand(1, 2.6), color, rot: 0, vr: 0 });
    }
  }

  private burst(x: number, y: number, color: string, n: number) {
    if (this.particles.length > 520) return;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(60, 380);
      this.particles.push({ kind: Math.random() < 0.4 ? "debris" : "spark", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(0.25, 0.6), size: rand(2, 5), color, rot: rand(0, TAU), vr: rand(-10, 10) });
    }
  }

  private float(x: number, y: number, text: string, color: string, size: number, disp: boolean) {
    if (this.floaters.length > 90) this.floaters.shift();
    this.floaters.push({ x, y, text, color, t: 0, life: disp ? 1.1 : 0.7, size, disp });
  }

  private ambient(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 34);

    /* погода биома */
    this.weatherT -= dt;
    if (this.weatherT <= 0 && (this.phase === "playing" || this.phase === "menu" || this.phase === "intermission" || this.phase === "craft" || this.phase === "paused")) {
      this.weatherT = 0.045;
      if (this.weather.length < 130) {
        const biome = this.biomeAt(this.px, this.py);
        if (biome === "frost") {
          this.weather.push({ x: rand(0, this.w), y: -8, vx: rand(-14, 6), vy: rand(46, 90), t: 0, life: rand(6, 10), size: rand(1, 2.6), color: "rgba(200,240,255,0.5)" });
        } else if (biome === "ember") {
          this.weather.push({ x: rand(0, this.w), y: this.h + 8, vx: rand(-10, 10), vy: -rand(30, 70), t: 0, life: rand(4, 8), size: rand(1, 2.4), color: "rgba(255,150,50,0.55)" });
        } else if (biome === "fungal") {
          this.weather.push({ x: rand(0, this.w), y: rand(0, this.h), vx: rand(-12, 12), vy: rand(-16, 8), t: 0, life: rand(4, 7), size: rand(1.4, 3.4), color: "rgba(192,77,255,0.35)" });
        } else {
          this.weather.push({ x: -10, y: rand(0, this.h), vx: rand(120, 260), vy: rand(-8, 8), t: 0, life: rand(2, 4), size: rand(0.8, 1.6), color: "rgba(154,167,199,0.3)" });
        }
      }
    }
    for (let i = this.weather.length - 1; i >= 0; i--) {
      const p = this.weather[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.t >= p.life || p.y > this.h + 12 || p.y < -12 || p.x > this.w + 12) this.weather.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.t += dt;
      if (p.t >= p.life) { this.particles.splice(i, 1); continue; }
      if (p.kind === "shell") p.vy += 420 * dt;
      if (p.kind === "debris") { p.vx *= Math.exp(-3 * dt); p.vy *= Math.exp(-3 * dt); }
      if (p.kind === "spark") { p.vx *= Math.exp(-5 * dt); p.vy *= Math.exp(-5 * dt); }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      f.y -= 34 * dt;
      if (f.t >= f.life) this.floaters.splice(i, 1);
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      this.decals[i].a -= dt * 0.016;
      if (this.decals[i].a <= 0) this.decals.splice(i, 1);
    }
  }

  /* ── отрисовка ── */

  private draw(t: number) {
    const c = this.ctx;
    const w = this.w;
    const h = this.h;
    c.fillStyle = "#05070f";
    c.fillRect(0, 0, w, h);

    const sx = this.shake > 0 ? rand(-this.shake, this.shake) * 0.5 : 0;
    const sy = this.shake > 0 ? rand(-this.shake, this.shake) * 0.5 : 0;
    const ox = Math.round(w / 2 - this.camX + sx);
    const oy = Math.round(h / 2 - this.camY + sy);

    c.save();
    c.translate(ox, oy);

    this.drawChunks(c, t);

    /* декали */
    for (const d of this.decals) {
      c.globalAlpha = Math.max(0, d.a);
      c.fillStyle = d.color;
      c.beginPath();
      c.arc(d.x, d.y, d.r, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;

    /* ящики */
    for (const ch of this.visibleChunks()) {
      for (const cr of ch.crates) {
        cr.flash = Math.max(0, cr.flash - 0.016);
        const hw = cr.s / 2;
        c.fillStyle = "#0d1017";
        c.fillRect(cr.x - hw + 3, cr.y - hw + 4, cr.s, cr.s);
        c.fillStyle = "#4a3b22";
        c.fillRect(cr.x - hw, cr.y - hw, cr.s, cr.s);
        c.strokeStyle = "#6d5830";
        c.lineWidth = 2;
        c.strokeRect(cr.x - hw, cr.y - hw, cr.s, cr.s);
        c.beginPath();
        c.moveTo(cr.x - hw, cr.y - hw); c.lineTo(cr.x + hw, cr.y + hw);
        c.moveTo(cr.x + hw, cr.y - hw); c.lineTo(cr.x - hw, cr.y + hw);
        c.stroke();
        if (cr.hp < cr.maxHp) {
          c.strokeStyle = "rgba(0,0,0,0.55)";
          c.lineWidth = 1.4;
          c.beginPath();
          c.moveTo(cr.x - hw * 0.6, cr.y - hw);
          c.lineTo(cr.x - hw * 0.1, cr.y - hw * 0.2);
          c.lineTo(cr.x - hw * 0.5, cr.y + hw * 0.5);
          c.stroke();
        }
        if (cr.flash > 0) {
          c.fillStyle = `rgba(255,255,255,${cr.flash * 5})`;
          c.fillRect(cr.x - hw, cr.y - hw, cr.s, cr.s);
        }
      }
    }

    /* сундуки */
    for (const ch of this.chests) {
      const pulse = 0.6 + 0.4 * Math.sin(t * 5);
      c.save();
      c.translate(ch.x, ch.y);
      if (!ch.opened) {
        c.fillStyle = hexA("#ffb020", 0.12 * pulse);
        c.beginPath();
        c.arc(0, 0, 46, 0, TAU);
        c.fill();
        c.fillStyle = "#0d1017";
        c.fillRect(-17, -11, 38, 30);
        c.fillStyle = "#7a5b1e";
        c.fillRect(-19, -14, 38, 28);
        c.strokeStyle = "#ffd27a";
        c.lineWidth = 2;
        c.strokeRect(-19, -14, 38, 28);
        c.fillStyle = "#ffd27a";
        c.fillRect(-4, -4, 8, 10);
        c.strokeStyle = hexA("#ffd27a", 0.5 + 0.5 * pulse);
        c.beginPath();
        c.arc(0, 0, 30 + pulse * 5, 0, TAU);
        c.stroke();
      } else {
        const k = Math.max(0, ch.openT / 0.6);
        c.fillStyle = hexA("#ffd27a", 0.25 * k);
        c.fillRect(-24, -70 * (1 - k) - 14, 48, 70 * (1 - k));
        c.fillStyle = "#5c451a";
        c.fillRect(-19, -14, 38, 28);
        c.strokeStyle = "#ffd27a";
        c.strokeRect(-19, -14, 38, 28);
      }
      c.restore();
    }

    /* мины */
    for (const m of this.mines) {
      const armed = m.arm <= 0;
      c.save();
      c.translate(m.x, m.y);
      c.fillStyle = "#11151f";
      c.beginPath();
      c.arc(0, 0, 9, 0, TAU);
      c.fill();
      c.strokeStyle = armed ? "#ffb020" : "#5a6residue";
      c.strokeStyle = armed ? "#ffb020" : "#5a6480";
      c.lineWidth = 2;
      c.stroke();
      const blink = m.fuse >= 0 ? Math.sin(t * 40) > 0 : Math.sin(t * 6) > 0;
      if (blink) {
        c.fillStyle = m.fuse >= 0 ? "#ff3864" : "#c8ff2e";
        c.beginPath();
        c.arc(0, 0, 3, 0, TAU);
        c.fill();
      }
      if (m.fuse >= 0) {
        c.strokeStyle = "rgba(255,56,100,0.6)";
        c.beginPath();
        c.arc(0, 0, 135, 0, TAU);
        c.stroke();
      }
      c.restore();
    }

    /* ресурсы */
    for (const o of this.orbs) {
      const blink = o.life < 5 && Math.sin(t * 14) > 0;
      if (blink) continue;
      c.save();
      c.translate(o.x, o.y);
      const bob = Math.sin(o.t * 5 + o.x) * 2;
      c.translate(0, bob);
      if (o.kind === "scrap") {
        c.fillStyle = "rgba(255,210,122,0.18)";
        c.beginPath(); c.arc(0, 0, 10, 0, TAU); c.fill();
        c.fillStyle = "#ffd27a";
        c.rotate(o.t * 2);
        c.fillRect(-4, -3, 8, 6);
        c.fillStyle = "#a8834a";
        c.fillRect(-4, -3, 8, 2);
      } else if (o.kind === "bio") {
        c.fillStyle = "rgba(125,255,94,0.18)";
        c.beginPath(); c.arc(0, 0, 10, 0, TAU); c.fill();
        c.fillStyle = "#7dff5e";
        c.beginPath();
        c.moveTo(0, -6);
        c.bezierCurveTo(6, 0, 4, 6, 0, 6);
        c.bezierCurveTo(-4, 6, -6, 0, 0, -6);
        c.fill();
      } else if (o.kind === "core") {
        c.fillStyle = hexA("#8df6ff", 0.22 + 0.1 * Math.sin(t * 8));
        c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fill();
        c.fillStyle = "#8df6ff";
        c.rotate(t * 3);
        c.beginPath();
        c.moveTo(0, -7); c.lineTo(6, 0); c.lineTo(0, 7); c.lineTo(-6, 0);
        c.closePath();
        c.fill();
        c.fillStyle = "#eafdff";
        c.beginPath(); c.arc(0, 0, 2, 0, TAU); c.fill();
      } else {
        c.fillStyle = "rgba(94,255,156,0.2)";
        c.beginPath(); c.arc(0, 0, 11, 0, TAU); c.fill();
        c.fillStyle = "#5eff9c";
        c.fillRect(-5, -1.6, 10, 3.2);
        c.fillRect(-1.6, -5, 3.2, 10);
      }
      c.restore();
    }

    /* вражеские снаряды */
    for (const b of this.ebullets) {
      const pulse = 1 + 0.25 * Math.sin(b.t * 20);
      c.fillStyle = hexA(b.color, 0.25);
      c.beginPath();
      c.arc(b.x, b.y, b.r * 2.1 * pulse, 0, TAU);
      c.fill();
      c.fillStyle = b.color;
      c.beginPath();
      c.arc(b.x, b.y, b.r * pulse, 0, TAU);
      c.fill();
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(b.x, b.y, b.r * 0.4, 0, TAU);
      c.fill();
    }

    /* телеграфы боссов */
    for (const e of this.enemies) {
      if (!e.boss || e.tele <= 0 || e.chargeT > 0) continue;
      if (e.boss === "juggernaut") {
        const a = Math.atan2(e.teleY, e.teleX);
        const pulse = 0.35 + 0.3 * Math.sin(t * 24);
        c.save();
        c.translate(e.x, e.y);
        c.rotate(a);
        const g = c.createLinearGradient(0, 0, 760, 0);
        g.addColorStop(0, `rgba(255,176,32,${pulse})`);
        g.addColorStop(1, "rgba(255,176,32,0)");
        c.fillStyle = g;
        c.fillRect(0, -34, 760, 68);
        c.strokeStyle = `rgba(255,56,100,${pulse + 0.2})`;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, -34); c.lineTo(760, -34);
        c.moveTo(0, 34); c.lineTo(760, 34);
        c.stroke();
        c.restore();
      } else if (e.boss === "mother") {
        const pulse = 0.4 + 0.4 * Math.sin(t * 20);
        c.strokeStyle = `rgba(255,56,100,${pulse})`;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(e.x, e.y, e.r + 14, 0, TAU);
        c.stroke();
      }
    }

    /* враги */
    for (const e of this.enemies) this.drawEnemy(c, e, t);

    /* кольца урона */
    for (const r of this.rings) {
      const k = 1 - r.r / r.maxR;
      c.strokeStyle = hexA(r.color, 0.65 * k + 0.1);
      c.lineWidth = 5;
      c.beginPath();
      c.arc(r.x, r.y, r.r, 0, TAU);
      c.stroke();
      c.strokeStyle = hexA("#ffffff", 0.3 * k);
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(r.x, r.y, r.r - 4, 0, TAU);
      c.stroke();
    }

    /* пули / лазер / рельса */
    c.globalCompositeOperation = "lighter";
    for (const b of this.bullets) {
      const tx = b.x - b.vx * 0.02;
      const ty = b.y - b.vy * 0.02;
      const big = !!b.explode;
      c.strokeStyle = hexA(b.color, 0.28);
      c.lineWidth = big ? 10 : b.crit ? 7 : 5;
      c.beginPath(); c.moveTo(tx, ty); c.lineTo(b.x, b.y); c.stroke();
      c.strokeStyle = b.color;
      c.lineWidth = big ? 5 : b.crit ? 3 : 2;
      c.beginPath(); c.moveTo(tx, ty); c.lineTo(b.x, b.y); c.stroke();
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(b.x, b.y, big ? 6 : b.crit ? 2.6 : 1.8, 0, TAU);
      c.fill();
      if (big) {
        c.fillStyle = hexA(b.color, 0.25);
        c.beginPath();
        c.arc(b.x, b.y, 10, 0, TAU);
        c.fill();
      }
    }

    if (this.laserOn && this.phase === "playing") {
      const dirX = Math.cos(this.aim);
      const dirY = Math.sin(this.aim);
      const x1 = this.px + dirX * 24;
      const y1 = this.py + dirY * 24;
      const x2 = this.px + dirX * 1600;
      const y2 = this.py + dirY * 1600;
      const wob = 1 + 0.35 * Math.sin(t * 46);
      c.strokeStyle = "rgba(53,240,255,0.14)";
      c.lineWidth = 16 * wob;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.strokeStyle = "rgba(53,240,255,0.5)";
      c.lineWidth = 6 * wob;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.strokeStyle = "#eafdff";
      c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.fillStyle = "rgba(53,240,255,0.5)";
      c.beginPath();
      c.arc(x1, y1, 7 * wob, 0, TAU);
      c.fill();
    }

    /* частицы */
    for (const p of this.particles) {
      const k = 1 - p.t / p.life;
      if (p.kind === "spark") {
        c.strokeStyle = hexA(p.color, k);
        c.lineWidth = p.size;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        c.stroke();
      } else if (p.kind === "ring") {
        const rr = p.size * (0.4 + (p.t / p.life) * 2.4);
        c.strokeStyle = hexA(p.color, 0.7 * k);
        c.lineWidth = 2.5 * k + 0.5;
        c.beginPath();
        c.arc(p.x, p.y, rr, 0, TAU);
        c.stroke();
      } else if (p.kind === "flash") {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillStyle = hexA(p.color, 0.9 * k);
        c.beginPath();
        c.arc(0, 0, p.size * 0.4, 0, TAU);
        c.fill();
        c.strokeStyle = hexA(p.color, 0.5 * k);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-p.size, 0); c.lineTo(p.size, 0);
        c.moveTo(0, -p.size * 0.7); c.lineTo(0, p.size * 0.7);
        c.stroke();
        c.restore();
      } else if (p.kind === "beam") {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.strokeStyle = hexA(p.color, 0.85 * k);
        c.lineWidth = 9 * k + 1;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(p.size, 0); c.stroke();
        c.strokeStyle = `rgba(255,255,255,${0.8 * k})`;
        c.lineWidth = 2.4;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(p.size, 0); c.stroke();
        c.restore();
      } else if (p.kind === "smoke") {
        c.fillStyle = hexA(p.color, 0.13 * k);
        c.beginPath();
        c.arc(p.x, p.y, p.size * (1 + p.t * 3), 0, TAU);
        c.fill();
      } else if (p.kind === "shell") {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillStyle = hexA(p.color, 0.8 * k);
        c.fillRect(-2.5, -1, 5, 2);
        c.restore();
      } else if (p.kind === "debris") {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillStyle = hexA(p.color, 0.9 * k);
        c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        c.restore();
      } else if (p.kind === "ghost") {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.globalAlpha = 0.45 * k;
        c.strokeStyle = p.color;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(0, 0, p.size, 0, TAU);
        c.moveTo(5, -8);
        c.lineTo(16, 0);
        c.lineTo(5, 8);
        c.closePath();
        c.stroke();
        c.restore();
        c.globalAlpha = 1;
      }
    }
    c.globalCompositeOperation = "source-over";

    /* игрок */
    if (this.phase !== "menu") this.drawPlayer(c, t);

    /* числа урона */
    for (const f of this.floaters) {
      const k = 1 - f.t / f.life;
      c.font = f.disp ? `${f.size}px "Russo One"` : `700 ${f.size}px Rubik`;
      c.textAlign = "center";
      c.fillStyle = `rgba(5,7,15,${0.6 * k})`;
      c.fillText(f.text, f.x + 1.5, f.y + 1.5);
      c.fillStyle = hexA(f.color, k);
      c.fillText(f.text, f.x, f.y);
    }

    c.restore();

    /* ── экранное пространство ── */

    /* погода */
    for (const p of this.weather) {
      c.fillStyle = p.color;
      if (p.vx > 100) {
        c.fillRect(p.x, p.y, p.size * 7, p.size * 0.7);
      } else {
        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, TAU);
        c.fill();
      }
    }

    /* стрелки к боссу / сундуку */
    if (this.phase === "playing" || this.phase === "intermission") {
      const targets: Array<{ x: number; y: number; color: string; label: string }> = [];
      if (this.bossRef) targets.push({ x: this.bossRef.x, y: this.bossRef.y, color: BOSSES[this.bossRef.boss!].color, label: "БОСС" });
      for (const ch of this.chests) if (!ch.opened) targets.push({ x: ch.x, y: ch.y, color: "#ffd27a", label: "ЛУТ" });
      for (const tg of targets) {
        const scrX = tg.x + ox;
        const scrY = tg.y + oy;
        if (scrX > 70 && scrX < w - 70 && scrY > 90 && scrY < h - 90) continue;
        const cxp = w / 2;
        const cyp = h / 2;
        const a = Math.atan2(scrY - cyp, scrX - cxp);
        const ex = clamp(scrX, 60, w - 60);
        const ey = clamp(scrY, 96, h - 96);
        const pulse = 0.7 + 0.3 * Math.sin(t * 6);
        c.save();
        c.translate(ex, ey);
        c.rotate(a);
        c.fillStyle = hexA(tg.color, 0.9 * pulse);
        c.beginPath();
        c.moveTo(14, 0); c.lineTo(-8, -9); c.lineTo(-8, 9);
        c.closePath();
        c.fill();
        c.rotate(-a);
        c.font = '10px "Russo One"';
        c.textAlign = "center";
        c.fillStyle = hexA(tg.color, 0.85);
        c.fillText(tg.label, 0, 26);
        c.restore();
      }
    }

    /* красная вспышка урона + низкое HP */
    if (this.hurtT > 0) {
      const a = this.hurtT / 0.45;
      const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.62);
      g.addColorStop(0, "rgba(255,56,100,0)");
      g.addColorStop(1, `rgba(255,56,100,${0.4 * a})`);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }
    const low = this.phase === "playing" && this.stats.hp / this.stats.maxHp < 0.3;
    if (low) {
      const a = 0.16 + 0.12 * Math.sin(t * 6);
      const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.62);
      g.addColorStop(0, "rgba(255,56,100,0)");
      g.addColorStop(1, `rgba(255,56,100,${a})`);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }

    /* прицел */
    if (this.phase === "playing") {
      const mx = this.mouse.x;
      const my = this.mouse.y;
      const gap = 7 + this.recoilT * 60;
      c.strokeStyle = "rgba(200,255,46,0.95)";
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(mx, my, 2.2, 0, TAU);
      c.stroke();
      c.beginPath();
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        c.moveTo(mx + ax * gap, my + ay * gap);
        c.lineTo(mx + ax * (gap + 7), my + ay * (gap + 7));
      }
      c.stroke();
    }
  }

  private visibleChunks(): Chunk[] {
    const minCx = Math.floor((this.camX - this.w / 2) / CHUNK) - 1;
    const maxCx = Math.floor((this.camX + this.w / 2) / CHUNK) + 1;
    const minCy = Math.floor((this.camY - this.h / 2) / CHUNK) - 1;
    const maxCy = Math.floor((this.camY + this.h / 2) / CHUNK) + 1;
    const out: Chunk[] = [];
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) out.push(this.getChunk(cx, cy));
    }
    return out;
  }

  private drawChunks(c: CanvasRenderingContext2D, t: number) {
    for (const ch of this.visibleChunks()) {
      const biome = BIOMES[ch.biome];
      const bx = ch.cx * CHUNK;
      const by = ch.cy * CHUNK;
      const hsh = hash2(ch.cx, ch.cy);

      c.fillStyle = (hsh & 1) === 0 ? biome.ground : biome.ground2;
      c.fillRect(bx, by, CHUNK, CHUNK);

      /* пятна грунта */
      const rnd = mulberry(hsh ^ 0x51ab);
      c.fillStyle = biome.ground2;
      for (let i = 0; i < 5; i++) {
        const px = bx + rnd() * CHUNK;
        const py = by + rnd() * CHUNK;
        const sz = 70 + rnd() * 160;
        c.globalAlpha = 0.35;
        c.fillRect(px, py, sz, sz * (0.5 + rnd() * 0.6));
      }
      c.globalAlpha = 1;

      /* секторная сетка */
      c.strokeStyle = hexA(biome.accent, 0.05);
      c.lineWidth = 1;
      c.strokeRect(bx + 0.5, by + 0.5, CHUNK, CHUNK);
      c.strokeStyle = "rgba(255,255,255,0.025)";
      c.beginPath();
      c.moveTo(bx + CHUNK / 2, by); c.lineTo(bx + CHUNK / 2, by + CHUNK);
      c.moveTo(bx, by + CHUNK / 2); c.lineTo(bx + CHUNK, by + CHUNK / 2);
      c.stroke();

      /* декорации */
      for (const d of ch.decos) this.drawDeco(c, d, biome, t);

      /* стены */
      for (const wl of ch.walls) {
        c.fillStyle = "rgba(0,0,0,0.4)";
        c.fillRect(wl.x + 4, wl.y + 5, wl.w, wl.h);
        c.fillStyle = "#232b3f";
        c.fillRect(wl.x, wl.y, wl.w, wl.h);
        c.fillStyle = "#2e3950";
        c.fillRect(wl.x, wl.y, wl.w, Math.min(8, wl.h * 0.35));
        c.strokeStyle = hexA(biome.accent, 0.14);
        c.lineWidth = 1.5;
        c.strokeRect(wl.x, wl.y, wl.w, wl.h);
      }

      /* колонны */
      for (const p of ch.pillars) {
        c.fillStyle = "rgba(0,0,0,0.4)";
        c.beginPath();
        c.arc(p.x + 4, p.y + 5, p.r, 0, TAU);
        c.fill();
        c.fillStyle = "#28324a";
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, TAU);
        c.fill();
        c.strokeStyle = hexA(biome.accent, 0.2);
        c.lineWidth = 2;
        c.stroke();
        c.fillStyle = "#33405c";
        c.beginPath();
        c.arc(p.x - p.r * 0.2, p.y - p.r * 0.2, p.r * 0.6, 0, TAU);
        c.fill();
      }
    }
  }

  private drawDeco(c: CanvasRenderingContext2D, d: Deco, biome: BiomeDef, t: number) {
    c.save();
    c.translate(d.x, d.y);
    c.rotate(d.rot);
    const acc = biome.accent;
    switch (d.kind) {
      case "crack": {
        c.strokeStyle = "rgba(0,0,0,0.4)";
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(-d.r, 0);
        c.lineTo(-d.r * 0.3, d.r * 0.25);
        c.lineTo(d.r * 0.2, -d.r * 0.15);
        c.lineTo(d.r, d.r * 0.1);
        c.stroke();
        break;
      }
      case "rock": {
        c.fillStyle = "#2a3040";
        c.beginPath();
        c.moveTo(-d.r * 0.8, d.r * 0.5);
        c.lineTo(-d.r * 0.5, -d.r * 0.6);
        c.lineTo(d.r * 0.4, -d.r * 0.7);
        c.lineTo(d.r * 0.8, d.r * 0.1);
        c.lineTo(d.r * 0.3, d.r * 0.6);
        c.closePath();
        c.fill();
        c.fillStyle = "#39415a";
        c.beginPath();
        c.moveTo(-d.r * 0.5, -d.r * 0.6);
        c.lineTo(d.r * 0.4, -d.r * 0.7);
        c.lineTo(d.r * 0.2, -d.r * 0.2);
        c.closePath();
        c.fill();
        break;
      }
      case "grass": {
        c.strokeStyle = hexA(acc, 0.22);
        c.lineWidth = 1.5;
        c.beginPath();
        for (let i = -1; i <= 1; i++) {
          c.moveTo(i * 4, d.r * 0.5);
          c.lineTo(i * 4 + 3, -d.r * 0.5);
        }
        c.stroke();
        break;
      }
      case "shard": {
        c.fillStyle = hexA("#8df6ff", 0.16);
        c.beginPath();
        c.moveTo(0, -d.r);
        c.lineTo(d.r * 0.45, d.r * 0.6);
        c.lineTo(-d.r * 0.45, d.r * 0.6);
        c.closePath();
        c.fill();
        c.strokeStyle = hexA("#c9f4ff", 0.35);
        c.lineWidth = 1.2;
        c.stroke();
        break;
      }
      case "snow": {
        c.fillStyle = "rgba(200,235,255,0.06)";
        c.beginPath();
        c.ellipse(0, 0, d.r * 1.4, d.r * 0.9, 0, 0, TAU);
        c.fill();
        break;
      }
      case "lava": {
        const glow = 0.4 + 0.3 * Math.sin(t * 2.4 + d.v * 9);
        c.strokeStyle = hexA("#ff6a2e", 0.5 * glow + 0.15);
        c.lineWidth = 3.4;
        c.beginPath();
        c.moveTo(-d.r, 0);
        c.quadraticCurveTo(0, d.r * 0.5 * (d.v - 0.5), d.r, -d.r * 0.2);
        c.stroke();
        c.strokeStyle = hexA("#ffd27a", 0.5 * glow);
        c.lineWidth = 1.2;
        c.stroke();
        break;
      }
      case "stump": {
        c.fillStyle = "#241a17";
        c.beginPath();
        c.arc(0, 0, d.r * 0.6, 0, TAU);
        c.fill();
        c.strokeStyle = "rgba(255,140,60,0.2)";
        c.lineWidth = 1.2;
        c.beginPath();
        c.arc(0, 0, d.r * 0.35, 0, TAU);
        c.stroke();
        break;
      }
      case "shroom": {
        const glow = 0.55 + 0.35 * Math.sin(t * 1.8 + d.v * 12);
        c.fillStyle = hexA(acc, 0.14 * glow + 0.05);
        c.beginPath();
        c.arc(0, 0, d.r, 0, TAU);
        c.fill();
        c.fillStyle = hexA(acc, 0.5 * glow + 0.15);
        c.beginPath();
        c.arc(0, 0, d.r * 0.45, 0, TAU);
        c.fill();
        c.fillStyle = hexA("#ffffff", 0.35 * glow);
        c.beginPath();
        c.arc(-d.r * 0.1, -d.r * 0.1, d.r * 0.14, 0, TAU);
        c.fill();
        break;
      }
      case "dot": {
        c.fillStyle = hexA(acc, 0.2);
        c.beginPath();
        c.arc(0, 0, d.r * 0.18, 0, TAU);
        c.fill();
        break;
      }
    }
    c.restore();
  }

  private drawEnemy(c: CanvasRenderingContext2D, e: Enemy, t: number) {
    const def = ENEMIES[e.type];
    const col = e.boss ? BOSSES[e.boss].color : def.color;
    const ang = Math.atan2(this.py - e.y, this.px - e.x);
    c.save();
    c.translate(e.x, e.y);

    c.fillStyle = hexA(col, e.boss ? 0.16 : 0.12);
    c.beginPath();
    c.arc(0, 0, e.r * 1.5, 0, TAU);
    c.fill();

    if (e.type === "scuttler") {
      c.rotate(e.wander);
      c.fillStyle = "#2a3145";
      c.strokeStyle = "#9aa7c7";
      c.lineWidth = 1.4;
      c.beginPath();
      c.ellipse(0, 0, e.r, e.r * 0.7, 0, 0, TAU);
      c.fill();
      c.stroke();
      c.strokeStyle = "rgba(154,167,199,0.6)";
      c.beginPath();
      for (let i = -1; i <= 1; i++) {
        const sw = Math.sin(t * 14 + i) * 3;
        c.moveTo(i * 4, -e.r * 0.6); c.lineTo(i * 4 + sw, -e.r * 1.3);
        c.moveTo(i * 4, e.r * 0.6); c.lineTo(i * 4 - sw, e.r * 1.3);
      }
      c.stroke();
      c.restore();
      return;
    }

    c.rotate(ang);
    const wob = Math.sin(t * 5 + e.seed) * 0.12;

    c.fillStyle = "#0d1322";
    c.strokeStyle = col;
    c.lineWidth = e.boss ? 3 : 2;

    if (e.boss === "mother" || (!e.boss && e.type === "chaser")) {
      c.beginPath();
      const spikes = e.boss ? 13 : 9;
      for (let i = 0; i <= spikes * 2; i++) {
        const a = (i / (spikes * 2)) * TAU;
        const rr = e.r * (i % 2 === 0 ? 1 + wob : 0.68);
        c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath();
      c.fill();
      c.stroke();
      if (e.boss) {
        c.strokeStyle = hexA(col, 0.5);
        c.beginPath();
        c.arc(0, 0, e.r * 0.55 + Math.sin(t * 6) * 3, 0, TAU);
        c.stroke();
      }
    } else if (e.boss === "juggernaut" || e.type === "brute") {
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + t * 0.6;
        c.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
      }
      c.closePath();
      c.fill();
      c.stroke();
      c.strokeStyle = hexA(col, 0.5);
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU - t * 0.4;
        c.lineTo(Math.cos(a) * e.r * 0.6, Math.sin(a) * e.r * 0.6);
      }
      c.closePath();
      c.stroke();
      if (e.boss) {
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(e.r * 0.7, -e.r * 0.55);
        c.lineTo(e.r * 1.25, -e.r * 0.85);
        c.lineTo(e.r * 0.95, -e.r * 0.3);
        c.closePath();
        c.moveTo(e.r * 0.7, e.r * 0.55);
        c.lineTo(e.r * 1.25, e.r * 0.85);
        c.lineTo(e.r * 0.95, e.r * 0.3);
        c.closePath();
        c.fill();
      }
    } else if (e.boss === "overseer" || e.type === "gazer") {
      const rr = e.r * (1 + wob * 0.4);
      c.beginPath();
      c.arc(0, 0, rr, 0, TAU);
      c.fill();
      c.stroke();
      const open = 0.5 + 0.5 * Math.sin(e.t * 4);
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.ellipse(rr * 0.25, 0, rr * 0.5, rr * 0.5 * (0.4 + open * 0.6), 0, 0, TAU);
      c.fill();
      c.fillStyle = e.boss ? "#c04dff" : "#5b1e80";
      c.beginPath();
      c.arc(rr * 0.4, 0, rr * 0.2, 0, TAU);
      c.fill();
      if (e.boss) {
        c.strokeStyle = hexA(col, 0.6);
        for (let i = 0; i < 3; i++) {
          const a = t * 1.2 + (i / 3) * TAU;
          c.beginPath();
          c.arc(Math.cos(a) * rr * 1.3, Math.sin(a) * rr * 1.3, 4, 0, TAU);
          c.stroke();
        }
      }
    } else if (e.type === "runner") {
      c.beginPath();
      c.moveTo(e.r * 1.3, 0);
      c.lineTo(-e.r * 0.9, -e.r * (0.85 + wob));
      c.lineTo(-e.r * 0.4, 0);
      c.lineTo(-e.r * 0.9, e.r * (0.85 + wob));
      c.closePath();
      c.fill();
      c.stroke();
    } else if (e.type === "spitter") {
      c.rotate(Math.PI / 4);
      const rr = e.r * (1 + wob * 0.5);
      c.beginPath();
      c.rect(-rr * 0.85, -rr * 0.85, rr * 1.7, rr * 1.7);
      c.fill();
      c.stroke();
      c.rotate(-Math.PI / 4);
      const open = 0.5 + 0.5 * Math.sin(e.t * 6);
      c.fillStyle = hexA(col, 0.85);
      c.beginPath();
      c.arc(e.r * 0.55, 0, 2.5 + open * 2.5, 0, TAU);
      c.fill();
    } else if (e.type === "bomber") {
      const blink = e.tele > 0 && Math.sin(t * 30) > 0;
      c.fillStyle = blink ? "#ffd9b0" : "#0d1322";
      c.beginPath();
      c.arc(0, 0, e.r * (e.tele > 0 ? 1.2 : 1), 0, TAU);
      c.fill();
      c.stroke();
      c.fillStyle = col;
      c.beginPath();
      c.arc(0, 0, e.r * 0.45, 0, TAU);
      c.fill();
      c.strokeStyle = hexA(col, 0.7);
      c.beginPath();
      c.moveTo(-e.r * 0.6, -e.r * 0.6); c.lineTo(e.r * 0.6, e.r * 0.6);
      c.moveTo(e.r * 0.6, -e.r * 0.6); c.lineTo(-e.r * 0.6, e.r * 0.6);
      c.stroke();
    } else if (e.type === "wisp") {
      const flick = 0.7 + 0.3 * Math.sin(t * 16 + e.seed);
      c.fillStyle = hexA(col, 0.3 * flick);
      c.beginPath();
      c.arc(0, 0, e.r * 1.8, 0, TAU);
      c.fill();
      c.fillStyle = col;
      c.beginPath();
      c.arc(0, 0, e.r * flick, 0, TAU);
      c.fill();
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(0, 0, e.r * 0.4, 0, TAU);
      c.fill();
    } else if (e.type === "healer") {
      c.beginPath();
      c.arc(0, 0, e.r, 0, TAU);
      c.fill();
      c.stroke();
      c.fillStyle = col;
      c.fillRect(-e.r * 0.55, -e.r * 0.18, e.r * 1.1, e.r * 0.36);
      c.fillRect(-e.r * 0.18, -e.r * 0.55, e.r * 0.36, e.r * 1.1);
    }

    /* глаза (для форм с телом) */
    if (e.type === "chaser" || e.type === "runner" || e.type === "brute" || e.type === "bomber" || e.boss === "mother" || e.boss === "juggernaut") {
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(e.r * 0.42, -e.r * 0.22, e.boss ? 4 : 2.6, 0, TAU);
      c.arc(e.r * 0.42, e.r * 0.22, e.boss ? 4 : 2.6, 0, TAU);
      c.fill();
      c.fillStyle = "#05070f";
      c.beginPath();
      c.arc(e.r * 0.5, -e.r * 0.22, e.boss ? 2 : 1.2, 0, TAU);
      c.arc(e.r * 0.5, e.r * 0.22, e.boss ? 2 : 1.2, 0, TAU);
      c.fill();
    }

    if (e.flash > 0) {
      c.fillStyle = `rgba(255,255,255,${(e.flash / 0.09) * 0.75})`;
      c.beginPath();
      c.arc(0, 0, e.r * 1.15, 0, TAU);
      c.fill();
    }
    c.restore();

    /* полоска HP */
    if (e.hp < e.maxHp && !e.boss) {
      const bw = e.r * 2;
      const frac = clamp(e.hp / e.maxHp, 0, 1);
      c.fillStyle = "rgba(5,7,15,0.7)";
      c.fillRect(e.x - bw / 2, e.y - e.r - 11, bw, 4);
      c.fillStyle = frac > 0.4 ? col : "#ff3864";
      c.fillRect(e.x - bw / 2, e.y - e.r - 11, bw * frac, 4);
    }
  }

  private drawPlayer(c: CanvasRenderingContext2D, t: number) {
    const blink = this.iframes > 0 && Math.floor(t * 18) % 2 === 0;
    c.save();
    c.translate(this.px, this.py);
    if (blink) c.globalAlpha = 0.45;

    if (this.iframes > 0) {
      c.strokeStyle = "rgba(200,255,46,0.4)";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, 23 + Math.sin(t * 12) * 2, 0, TAU);
      c.stroke();
    }

    if (this.shieldT > 0) {
      const fade = this.shieldT < 0.9 ? (Math.sin(t * 26) > 0 ? 0.55 : 0.16) : 0.55;
      c.strokeStyle = `rgba(53,240,255,${fade})`;
      c.lineWidth = 2;
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + t * 1.4;
        c.lineTo(Math.cos(a) * 27, Math.sin(a) * 27);
      }
      c.closePath();
      c.stroke();
      c.fillStyle = "rgba(53,240,255,0.07)";
      c.fill();
    }

    if (this.ovT > 0) {
      c.strokeStyle = `rgba(255,210,122,${0.4 + 0.3 * Math.sin(t * 20)})`;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, 19, t * 8, t * 8 + 4.2);
      c.stroke();
    }

    c.rotate(this.aim);
    if (this.moving) {
      const fl = 8 + Math.sin(t * 40) * 3;
      c.fillStyle = "rgba(53,240,255,0.55)";
      c.beginPath();
      c.moveTo(-13, -5);
      c.lineTo(-13 - fl, 0);
      c.lineTo(-13, 5);
      c.closePath();
      c.fill();
    }
    c.fillStyle = "#101830";
    c.strokeStyle = "#c8ff2e";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, 13, 0, TAU);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(4, -9);
    c.lineTo(16, 0);
    c.lineTo(4, 9);
    c.closePath();
    c.fillStyle = "#1a2440";
    c.fill();
    c.stroke();
    const w = WEAPONS[this.weapon];
    c.fillStyle = w.color;
    if (w.id === "shotgun") {
      c.fillRect(8, -4.5, 18, 4);
      c.fillRect(8, 0.5, 18, 4);
    } else if (w.id === "laser") {
      c.fillRect(8, -2, 20, 4);
      c.fillStyle = "#eafdff";
      c.fillRect(26, -1, 3, 2);
    } else if (w.id === "rail") {
      c.fillRect(6, -3, 26, 6);
      c.fillStyle = "#eafdff";
      c.fillRect(30, -1.5, 4, 3);
      c.fillStyle = w.color;
      c.fillRect(10, -6, 6, 2);
      c.fillRect(10, 4, 6, 2);
    } else if (w.id === "plasma") {
      c.fillRect(8, -3, 16, 6);
      c.fillStyle = "#ffffff";
      c.fillRect(22, -2, 4, 4);
    } else if (w.id === "minigun") {
      c.fillRect(8, -5, 20, 3);
      c.fillRect(8, -1.5, 20, 3);
      c.fillRect(8, 2, 20, 3);
    } else if (w.id === "smg") {
      c.fillRect(8, -2.5, 20, 5);
      c.fillRect(14, 2, 4, 7);
    } else {
      c.fillRect(8, -2.5, 15, 5);
    }
    c.fillStyle = "#35f0ff";
    c.beginPath();
    c.arc(3, 0, 3.4, 0, TAU);
    c.fill();
    c.restore();
  }

  /* ── HUD ── */

  private emitHud() {
    const aggroLeft = this.enemies.filter((e) => ENEMIES[e.type].aggro).length;
    const remaining = Math.max(0, this.quota - this.spawned) + aggroLeft + (this.bossRef ? 1 : 0) + this.chests.filter((x) => !x.opened).length;
    this.cb.onHud({
      hp: Math.max(0, Math.ceil(this.stats.hp)),
      maxHp: this.stats.maxHp,
      regen: this.stats.regen,
      wave: this.wave,
      enemiesLeft: remaining,
      score: this.score,
      kills: this.kills,
      time: this.time,
      weapon: this.weapon,
      owned: [...this.owned],
      muted: this.sfx.muted,
      res: { ...this.res },
      boss: this.bossRef
        ? { name: BOSSES[this.bossRef.boss!].name, color: BOSSES[this.bossRef.boss!].color, hp: Math.max(0, this.bossRef.hp), maxHp: Math.round(this.bossRef.maxHp) }
        : null,
      biome: BIOMES[this.biomeAt(this.px, this.py)].name,
      abilities: [
        { id: "dash", cd: this.dashCharges > 0 ? 0 : this.dashRecover, maxCd: DASH_CD * this.stats.abilityCdMul, charges: this.dashCharges, maxCharges: this.stats.dashMax, active: this.dashT, activeMax: DASH_TIME },
        { id: "nova", cd: this.novaCd, maxCd: NOVA_CD * this.stats.abilityCdMul, charges: this.novaCd > 0 ? 0 : 1, maxCharges: 1, active: 0, activeMax: 0 },
        { id: "shield", cd: this.shieldCd, maxCd: SHIELD_CD * this.stats.abilityCdMul, charges: this.shieldCd > 0 || this.shieldT > 0 ? 0 : 1, maxCharges: 1, active: this.shieldT, activeMax: SHIELD_TIME },
        { id: "overload", cd: this.ovCd, maxCd: OVERLOAD_CD * this.stats.abilityCdMul, charges: this.ovCd > 0 || this.ovT > 0 ? 0 : 1, maxCharges: 1, active: this.ovT, activeMax: 4 + this.stats.overloadBonus },
        { id: "mine", cd: this.mineCharges > 0 ? 0 : this.mineRecover, maxCd: MINE_CD * this.stats.abilityCdMul, charges: this.mineCharges, maxCharges: this.stats.mineMax, active: 0, activeMax: 0 },
      ],
    });
  }
}

/* ── утилиты ── */

function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let tt = ((px - x1) * dx + (py - y1) * dy) / l2;
  tt = clamp(tt, 0, 1);
  return Math.hypot(px - (x1 + tt * dx), py - (y1 + tt * dy));
}

function hexA(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${clamp(a, 0, 1)})`;
}
