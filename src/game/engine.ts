/* Движок «РОЙ»: волновое выживание на canvas. */

import { Sfx } from "./audio";
import {
  ENEMIES,
  UPGRADES,
  WEAPONS,
  WEAPON_ORDER,
  initialStats,
  type EnemyType,
  type GameOverStats,
  type HudData,
  type Phase,
  type PlayerStats,
  type UpgradeChoice,
  type WeaponId,
} from "./data";

/* ── сущности ── */

interface Enemy {
  type: EnemyType;
  x: number; y: number;
  kx: number; ky: number;
  hp: number; maxHp: number;
  speed: number; r: number; dmg: number;
  flash: number; t: number; seed: number;
  shootCd: number;
  tick: number; // тик цифр урона от лазера
  score: number;
}

interface Bullet {
  x: number; y: number; vx: number; vy: number;
  dmg: number; life: number; pierce: number;
  color: string; crit: boolean;
  hit: Set<Enemy>;
}

interface EnemyBullet {
  x: number; y: number; vx: number; vy: number;
  dmg: number; r: number; life: number; t: number;
}

interface Particle {
  kind: "spark" | "smoke" | "shell" | "ring" | "flash" | "debris" | "ghost";
  x: number; y: number; vx: number; vy: number;
  t: number; life: number; size: number; color: string;
  rot: number; vr: number;
}

interface Floater {
  x: number; y: number; text: string; color: string;
  t: number; life: number; size: number; disp: boolean;
}

interface Mote { x: number; y: number; r: number; spd: number; ph: number }

export interface EngineCallbacks {
  onHud: (h: HudData) => void;
  onPhase: (p: Phase) => void;
  onChoices: (c: UpgradeChoice[]) => void;
  onGameOver: (s: GameOverStats) => void;
  onBanner: (text: string, sub?: string) => void;
}

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/* суперспособности */
const DASH_TIME = 0.16;
const DASH_SPEED = 1250;
const DASH_CD = 2.4;
const NOVA_CD = 6;
const NOVA_BASE_DMG = 55;
const NOVA_RADIUS = 225;
const SHIELD_TIME = 3;
const SHIELD_CD = 10;

export class Engine {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private splat: HTMLCanvasElement;
  private splatCtx: CanvasRenderingContext2D;
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

  /* мир */
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private ebullets: EnemyBullet[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private motes: Mote[] = [];

  private wave = 0;
  private quota = 0;
  private spawned = 0;
  private spawnT = 0;
  private score = 0;
  private kills = 0;
  private time = 0;
  private choices: UpgradeChoice[] = [];

  private shake = 0;
  private hurtT = 0;
  private recoilT = 0;
  private hudT = 0;
  private ambientT = 0;

  /* суперспособности */
  private dashT = 0;
  private dashDx = 0;
  private dashDy = -1;
  private dashCharges = 1;
  private dashRecover = 0;
  private novaCd = 0;
  private shieldT = 0;
  private shieldCd = 0;

  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, down: false };

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks) {
    this.cv = canvas;
    this.cb = cb;
    this.ctx = canvas.getContext("2d")!;
    this.splat = document.createElement("canvas");
    this.splatCtx = this.splat.getContext("2d")!;
    this.resize();
    this.px = this.w / 2;
    this.py = this.h / 2;
    this.mouse.x = this.w / 2;
    this.mouse.y = this.h / 3;
    for (let i = 0; i < 70; i++) {
      this.motes.push({ x: Math.random() * this.w, y: Math.random() * this.h, r: rand(0.6, 2.2), spd: rand(4, 16), ph: rand(0, TAU) });
    }
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
      if (c === "Digit1") this.selectWeapon("pistol");
      if (c === "Digit2") this.selectWeapon("smg");
      if (c === "Digit3") this.selectWeapon("shotgun");
      if (c === "Digit4") this.selectWeapon("laser");
      if (c === "Space") this.tryDash();
      if (c === "KeyE") this.tryNova();
      if (c === "KeyQ") this.tryShield();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  private onMouseMove = (e: MouseEvent) => {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      this.sfx.unlock();
      this.mouse.down = true;
    }
  };

  private onMouseUp = () => (this.mouse.down = false);

  private onCtx = (e: Event) => e.preventDefault();

  private onWheel = (e: WheelEvent) => {
    if (this.phase === "playing") this.cycleWeapon(e.deltaY > 0 ? 1 : -1);
  };

  private onResize = () => this.resize();

  private onBlur = () => {
    this.keys.clear();
    this.mouse.down = false;
  };

  private resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    for (const c of [this.cv, this.splat]) {
      c.width = Math.floor(this.w * dpr);
      c.height = Math.floor(this.h * dpr);
    }
    this.cv.style.width = `${this.w}px`;
    this.cv.style.height = `${this.h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.splatCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.px = clamp(this.px, 20, this.w - 20);
    this.py = clamp(this.py, 20, this.h - 20);
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
      const dt = clamp((t - this.last) / 1000, 0, 0.035);
      this.last = t;
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
    this.score = 0;
    this.kills = 0;
    this.time = 0;
    this.iframes = 0;
    this.pkx = 0;
    this.pky = 0;
    this.dashT = 0;
    this.dashCharges = 1;
    this.dashRecover = 0;
    this.novaCd = 0;
    this.shieldT = 0;
    this.shieldCd = 0;
    this.px = this.w / 2;
    this.py = this.h / 2;
    this.splatCtx.clearRect(0, 0, this.w, this.h);
    this.mouse.down = false;
    this.stopLaser();
    this.setPhase("playing");
    this.startWave(1);
    this.emitHud();
  }

  pause() {
    if (this.phase !== "playing") return;
    this.stopLaser();
    this.mouse.down = false;
    this.setPhase("paused");
  }

  resume() {
    if (this.phase !== "paused") return;
    this.setPhase("playing");
  }

  toMenu() {
    this.stopLaser();
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.floaters = [];
    this.setPhase("menu");
  }

  toggleMute() {
    this.sfx.setMuted(!this.sfx.muted);
    this.emitHud();
  }

  uiSound(kind: "hover" | "click") {
    this.sfx.unlock();
    if (kind === "hover") this.sfx.uiHover();
    else this.sfx.uiClick();
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.cb.onPhase(p);
  }

  /* ── волны ── */

  private startWave(n: number) {
    this.wave = n;
    this.quota = Math.min(60, 6 + n * 3 + Math.floor(Math.pow(n, 1.35)));
    this.spawned = 0;
    this.spawnT = 1.1;
    this.sfx.waveHorn();
    this.cb.onBanner(`ВОЛНА ${n}`, `противников: ${this.quota}`);
  }

  private hpMul() { return 1 + (this.wave - 1) * 0.16; }
  private spdMul() { return Math.min(1.75, 1 + (this.wave - 1) * 0.045); }
  private dmgMul() { return 1 + (this.wave - 1) * 0.07; }

  private pickType(): EnemyType {
    const pool: Array<[EnemyType, number]> = [["chaser", 10]];
    if (this.wave >= 2) pool.push(["runner", 6]);
    if (this.wave >= 3) pool.push(["spitter", 4.5]);
    const brutes = this.enemies.filter((e) => e.type === "brute").length;
    if (this.wave >= 4 && brutes < Math.ceil(this.wave / 3) + 1) pool.push(["brute", 2.6]);
    let total = 0;
    for (const [, wgt] of pool) total += wgt;
    let roll = Math.random() * total;
    for (const [t, wgt] of pool) {
      roll -= wgt;
      if (roll <= 0) return t;
    }
    return "chaser";
  }

  private spawnEnemy() {
    const def = ENEMIES[this.pickType()];
    const side = Math.floor(Math.random() * 4);
    const m = 30;
    let x = 0;
    let y = 0;
    if (side === 0) { x = rand(-m, this.w + m); y = -m; }
    else if (side === 1) { x = this.w + m; y = rand(-m, this.h + m); }
    else if (side === 2) { x = rand(-m, this.w + m); y = this.h + m; }
    else { x = -m; y = rand(-m, this.h + m); }
    const scale = def.type === "brute" ? rand(0.9, 1.15) : rand(0.9, 1.1);
    this.enemies.push({
      type: def.type,
      x, y, kx: 0, ky: 0,
      hp: def.hp * this.hpMul() * scale,
      maxHp: def.hp * this.hpMul() * scale,
      speed: def.speed * this.spdMul() * rand(0.88, 1.12),
      r: def.r * (def.type === "brute" ? scale : 1),
      dmg: def.dmg * this.dmgMul(),
      flash: 0, t: rand(0, TAU), seed: rand(0, TAU),
      shootCd: rand(1.2, 2.4),
      tick: 0,
      score: def.score,
    });
    this.spawned++;
    this.puff(x, y, ENEMIES[def.type].color, 5);
  }

  /* ── апгрейды ── */

  private buildChoices() {
    const pool: UpgradeChoice[] = [];
    const unowned = WEAPON_ORDER.filter((id) => !this.owned.includes(id));
    const wantWeapon = unowned.length > 0 && (this.wave === 1 || Math.random() < 0.5);
    if (wantWeapon) {
      const id = unowned[Math.floor(Math.random() * unowned.length)];
      const w = WEAPONS[id];
      pool.push({
        key: `wpn:${id}`,
        kind: "weapon",
        name: w.name,
        desc: w.tag,
        icon: id,
        rarity: "weapon",
        weaponId: id,
      });
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
        if (def.id === "dashMax") {
          this.dashCharges = this.stats.dashMax;
          this.dashRecover = 0;
        }
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
    if (this.laserOn) {
      this.laserOn = false;
      this.sfx.laserOff();
    }
  }

  /* ── суперспособности ── */

  private tryDash() {
    if (this.phase !== "playing" || this.dashT > 0 || this.dashCharges <= 0) return;
    let dx = 0;
    let dy = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) dy -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) dy += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) dx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) dx += 1;
    if (dx === 0 && dy === 0) {
      dx = Math.cos(this.aim);
      dy = Math.sin(this.aim);
    }
    const len = Math.hypot(dx, dy) || 1;
    this.dashDx = dx / len;
    this.dashDy = dy / len;
    this.dashT = DASH_TIME;
    this.dashCharges--;
    if (this.dashRecover <= 0) this.dashRecover = DASH_CD * this.stats.abilityCdMul;
    this.sfx.dash();
    this.shake = Math.min(12, this.shake + 3);
    this.puff(this.px - this.dashDx * 16, this.py - this.dashDy * 16, "#c8ff2e", 9);
    this.emitHud();
  }

  private tryNova() {
    if (this.phase !== "playing" || this.novaCd > 0) return;
    const s = this.stats;
    const novaUp = s.taken["novaPower"] ?? 0;
    const radius = NOVA_RADIUS * (1 + 0.15 * novaUp);
    const dmg = NOVA_BASE_DMG * s.damage * s.novaPower;
    this.novaCd = NOVA_CD * s.abilityCdMul;

    const targets = this.enemies.filter(
      (e) => Math.hypot(e.x - this.px, e.y - this.py) < radius + e.r
    );
    for (const e of targets) {
      if (e.hp <= 0) continue;
      const dx = e.x - this.px;
      const dy = e.y - this.py;
      const d = Math.hypot(dx, dy) || 1;
      const kb = e.type === "brute" ? 320 : 780;
      this.damageEnemy(e, dmg, false, (dx / d) * kb, (dy / d) * kb, true);
    }
    /* сбить вражеские снаряды */
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const b = this.ebullets[i];
      if (Math.hypot(b.x - this.px, b.y - this.py) < radius) {
        this.puff(b.x, b.y, "#7dff5e", 4);
        this.ebullets.splice(i, 1);
      }
    }
    /* fx */
    this.particles.push({ kind: "flash", x: this.px, y: this.py, vx: 0, vy: 0, t: 0, life: 0.18, size: 70, color: "#ffb020", rot: rand(0, TAU), vr: 0 });
    this.particles.push({ kind: "ring", x: this.px, y: this.py, vx: 0, vy: 0, t: 0, life: 0.4, size: 26, color: "#ffb020", rot: 0, vr: 0 });
    this.particles.push({ kind: "ring", x: this.px, y: this.py, vx: 0, vy: 0, t: 0, life: 0.55, size: radius * 0.5, color: "#ff3864", rot: 0, vr: 0 });
    this.burst(this.px, this.py, "#ffb020", 28);
    /* подпалина на полу */
    const sc = this.splatCtx;
    sc.strokeStyle = "rgba(16,13,20,0.5)";
    sc.lineWidth = 26;
    sc.beginPath();
    sc.arc(this.px, this.py, radius * 0.72, 0, TAU);
    sc.stroke();
    sc.strokeStyle = "rgba(255,176,32,0.18)";
    sc.lineWidth = 3;
    sc.beginPath();
    sc.arc(this.px, this.py, radius * 0.92, 0, TAU);
    sc.stroke();
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
    if (this.dashCharges < this.stats.dashMax) {
      this.dashRecover -= dt;
      if (this.dashRecover <= 0) {
        this.dashCharges++;
        this.dashRecover = DASH_CD * this.stats.abilityCdMul;
        this.float(this.px, this.py - 34, "ЗАРЯД +1", "#c8ff2e", 13, false);
        this.emitHud();
      }
    } else {
      this.dashRecover = 0;
    }

    const s = this.stats;
    s.hp = Math.min(s.maxHp, s.hp + s.regen * dt);

    /* движение игрока */
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.px = clamp(this.px + this.dashDx * DASH_SPEED * dt, 18, this.w - 18);
      this.py = clamp(this.py + this.dashDy * DASH_SPEED * dt, 18, this.h - 18);
      this.pkx = this.dashDx * 265 * s.moveSpeed;
      this.pky = this.dashDy * 265 * s.moveSpeed;
      this.moving = true;
      /* призрак-след */
      this.particles.push({
        kind: "ghost", x: this.px, y: this.py, vx: 0, vy: 0,
        t: 0, life: 0.3, size: 13, color: "#c8ff2e", rot: this.aim, vr: 0,
      });
    } else {
      let dx = 0;
      let dy = 0;
      if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) dy -= 1;
      if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) dy += 1;
      if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) dx -= 1;
      if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) dx += 1;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      this.moving = dx !== 0 || dy !== 0;
      const spd = 265 * s.moveSpeed;
      const ease = 1 - Math.exp(-14 * dt);
      this.pkx += (dx * spd - this.pkx) * ease;
      this.pky += (dy * spd - this.pky) * ease;
      this.px = clamp(this.px + this.pkx * dt, 18, this.w - 18);
      this.py = clamp(this.py + this.pky * dt, 18, this.h - 18);

      if (this.moving && Math.random() < dt * 30) {
        this.particles.push({
          kind: "smoke", x: this.px - dx * 14 + rand(-4, 4), y: this.py - dy * 14 + rand(-4, 4),
          vx: -dx * 30 + rand(-12, 12), vy: -dy * 30 + rand(-12, 12),
          t: 0, life: rand(0.25, 0.5), size: rand(2, 5), color: "#35f0ff", rot: 0, vr: 0,
        });
      }
    }

    this.aim = Math.atan2(this.mouse.y - this.py, this.mouse.x - this.px);

    /* стрельба */
    const w = WEAPONS[this.weapon];
    if (this.mouse.down) {
      if (w.kind === "beam") {
        if (!this.laserOn) {
          this.laserOn = true;
          this.sfx.laserOn();
        }
        this.fireLaser(w.dmg, dt);
        this.shake = Math.min(10, this.shake + w.shake * dt * 8);
      } else if (this.cooldown <= 0) {
        this.fireBullets();
        this.cooldown = 1 / (w.rate * s.fireRate);
      }
    } else {
      this.stopLaser();
    }

    /* спавн волны */
    if (this.spawned < this.quota) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnEnemy();
        const burstChance = this.wave >= 5 ? 0.3 : 0.12;
        if (Math.random() < burstChance && this.spawned < this.quota) this.spawnEnemy();
        this.spawnT = Math.max(0.24, 1.05 - this.wave * 0.055) * rand(0.7, 1.3);
      }
    }

    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateEnemyBullets(dt);

    /* конец волны */
    if (this.spawned >= this.quota && this.enemies.length === 0 && this.ebullets.length === 0) {
      this.onWaveCleared();
    }

    /* HUD с троттлингом */
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.1;
      this.emitHud();
    }
  }

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
        hit: new Set(),
      });
    }
    /* отдача + вспышка */
    this.pkx -= Math.cos(this.aim) * w.kick;
    this.pky -= Math.sin(this.aim) * w.kick;
    this.recoilT = 0.08;
    this.shake = Math.min(14, this.shake + w.shake);
    this.particles.push({
      kind: "flash", x: mx, y: my, vx: 0, vy: 0,
      t: 0, life: 0.06, size: w.id === "shotgun" ? 26 : 14, color: w.color, rot: this.aim, vr: 0,
    });
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        kind: "spark", x: mx, y: my,
        vx: Math.cos(this.aim + rand(-0.5, 0.5)) * rand(120, 320),
        vy: Math.sin(this.aim + rand(-0.5, 0.5)) * rand(120, 320),
        t: 0, life: rand(0.08, 0.16), size: rand(1, 2.4), color: w.color, rot: 0, vr: 0,
      });
    }
    /* гильза */
    const side = this.aim + Math.PI / 2;
    this.particles.push({
      kind: "shell", x: this.px + Math.cos(side) * 10, y: this.py + Math.sin(side) * 10,
      vx: Math.cos(side) * rand(60, 130) + rand(-20, 20), vy: Math.sin(side) * rand(60, 130) - 80,
      t: 0, life: rand(0.4, 0.7), size: 3, color: "#ffb020", rot: rand(0, TAU), vr: rand(-14, 14),
    });
    if (w.id === "pistol") this.sfx.shootPistol();
    else if (w.id === "smg") this.sfx.shootSmg();
    else this.sfx.shootShotgun();
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

  private updateBullets(dt: number) {
    const pr = 5;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < -40 || b.x > this.w + 40 || b.y < -40 || b.y > this.h + 40;
      if (!dead) {
        for (const e of this.enemies) {
          if (b.hit.has(e)) continue;
          const rr = e.r + pr;
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          if (dx * dx + dy * dy < rr * rr) {
            b.hit.add(e);
            const kb = e.type === "brute" ? 40 : 130;
            const inv = 1 / (Math.hypot(b.vx, b.vy) || 1);
            this.damageEnemy(e, b.dmg, b.crit, b.vx * inv * kb, b.vy * inv * kb, false);
            if (b.hit.size > b.pierce) {
              dead = true;
              break;
            }
          }
        }
      }
      if (dead) this.bullets.splice(i, 1);
    }
  }

  private updateEnemyBullets(dt: number) {
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const b = this.ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.t += dt;
      b.life -= dt;
      const dx = b.x - this.px;
      const dy = b.y - this.py;
      if (this.shieldT > 0 && dx * dx + dy * dy < 44 * 44) {
        this.puff(b.x, b.y, "#35f0ff", 5);
        this.sfx.shieldBlock();
        this.ebullets.splice(i, 1);
        continue;
      }
      if (dx * dx + dy * dy < (b.r + 15) * (b.r + 15)) {
        this.damagePlayer(b.dmg);
        this.puff(b.x, b.y, "#7dff5e", 6);
        this.ebullets.splice(i, 1);
        continue;
      }
      if (b.life <= 0 || b.x < -60 || b.x > this.w + 60 || b.y < -60 || b.y > this.h + 60) {
        this.ebullets.splice(i, 1);
      }
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

      let vx = nx * e.speed;
      let vy = ny * e.speed;

      if (e.type === "spitter") {
        if (dist < 230) { vx = -nx * e.speed * 0.8; vy = -ny * e.speed * 0.8; }
        else if (dist < 330) { vx = -ny * e.speed * 0.5; vy = nx * e.speed * 0.5; }
        e.shootCd -= dt;
        if (e.shootCd <= 0 && dist < 560) {
          e.shootCd = rand(2.0, 2.7);
          const a = Math.atan2(dy, dx) + rand(-0.08, 0.08);
          this.ebullets.push({
            x: e.x + nx * e.r, y: e.y + ny * e.r,
            vx: Math.cos(a) * 300, vy: Math.sin(a) * 300,
            dmg: 10 * this.dmgMul(), r: 6, life: 3.2, t: 0,
          });
          this.sfx.hit();
        }
      }

      e.x += (vx + e.kx) * dt;
      e.y += (vy + e.ky) * dt;
      const dec = Math.exp(-9 * dt);
      e.kx *= dec;
      e.ky *= dec;

      /* контактный урон */
      if (dist < e.r + 15) {
        if (this.shieldT > 0) {
          e.kx = -nx * 540;
          e.ky = -ny * 540;
          this.puff(this.px + nx * 20, this.py + ny * 20, "#35f0ff", 5);
          this.sfx.shieldBlock();
        } else {
          this.damagePlayer(e.dmg);
          e.kx = -nx * 260;
          e.ky = -ny * 260;
        }
      }

      if (e.hp <= 0) {
        this.killEnemy(i);
        continue;
      }

      /* расталкивание */
      for (let j = i - 1; j >= 0; j--) {
        const o = this.enemies[j];
        const sx = e.x - o.x;
        const sy = e.y - o.y;
        const sr = e.r + o.r;
        const d2 = sx * sx + sy * sy;
        if (d2 > 0.01 && d2 < sr * sr) {
          const d = Math.sqrt(d2);
          const push = ((sr - d) / d) * 0.5;
          e.x += sx * push;
          e.y += sy * push;
          o.x -= sx * push;
          o.y -= sy * push;
        }
      }

      if (e.hp <= 0) this.killEnemy(i);
    }
  }

  private damageEnemy(e: Enemy, dmg: number, crit: boolean, kx: number, ky: number, silent: boolean) {
    e.hp -= dmg;
    e.flash = 0.09;
    e.kx += kx;
    e.ky += ky;
    const col = ENEMIES[e.type].color;
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

  private killEnemy(idx: number) {
    const e = this.enemies[idx];
    this.enemies.splice(idx, 1);
    const def = ENEMIES[e.type];
    this.kills++;
    this.score += e.score;
    this.shake = Math.min(16, this.shake + (e.type === "brute" ? 9 : 3));
    this.burst(e.x, e.y, def.color, e.type === "brute" ? 26 : 12);
    this.particles.push({ kind: "ring", x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.3, size: e.r * 1.4, color: def.color, rot: 0, vr: 0 });
    /* пятно на полу */
    const sc = this.splatCtx;
    const n = e.type === "brute" ? 9 : 5;
    for (let i = 0; i < n; i++) {
      sc.fillStyle = hexA(def.color, rand(0.1, 0.24));
      sc.beginPath();
      sc.arc(e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r), rand(3, e.r * 0.5), 0, TAU);
      sc.fill();
    }
    if (e.type === "brute") this.sfx.bruteKill();
    else this.sfx.kill();
    this.emitHud();
  }

  private damagePlayer(dmg: number) {
    if (this.iframes > 0 || this.dashT > 0 || this.shieldT > 0 || this.phase !== "playing") return;
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

  private onWaveCleared() {
    this.stopLaser();
    const bonus = 100 * this.wave;
    this.score += bonus;
    /* немного милосердия */
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + this.stats.maxHp * 0.15);
    this.sfx.waveClear();
    this.cb.onBanner(`ВОЛНА ${this.wave} ЗАЧИЩЕНА`, `бонус +${bonus} · выберите улучшение`);
    this.buildChoices();
    this.setPhase("intermission");
    this.emitHud();
  }

  /* ── эффекты ── */

  private puff(x: number, y: number, color: string, n: number) {
    if (this.particles.length > 520) return;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(40, 220);
      this.particles.push({
        kind: "spark", x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        t: 0, life: rand(0.15, 0.35), size: rand(1, 2.6), color, rot: 0, vr: 0,
      });
    }
  }

  private burst(x: number, y: number, color: string, n: number) {
    if (this.particles.length > 520) return;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(60, 380);
      this.particles.push({
        kind: Math.random() < 0.4 ? "debris" : "spark", x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        t: 0, life: rand(0.25, 0.6), size: rand(2, 5), color, rot: rand(0, TAU), vr: rand(-10, 10),
      });
    }
  }

  private float(x: number, y: number, text: string, color: string, size: number, disp: boolean) {
    if (this.floaters.length > 90) this.floaters.shift();
    this.floaters.push({ x, y, text, color, t: 0, life: disp ? 1.1 : 0.7, size, disp });
  }

  private ambient(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 34);
    this.ambientT -= dt;
    if ((this.phase === "menu" || this.phase === "gameover") && this.ambientT <= 0) {
      this.ambientT = rand(0.8, 1.6);
      this.particles.push({
        kind: "ring", x: rand(0, this.w), y: rand(0, this.h), vx: 0, vy: 0,
        t: 0, life: rand(0.8, 1.4), size: rand(10, 26),
        color: ["#35f0ff", "#ff3864", "#c8ff2e"][Math.floor(rand(0, 3))], rot: 0, vr: 0,
      });
    }
    for (const m of this.motes) {
      m.y -= m.spd * dt;
      m.ph += dt;
      if (m.y < -6) { m.y = this.h + 6; m.x = Math.random() * this.w; }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.t += dt;
      if (p.t >= p.life) {
        this.particles.splice(i, 1);
        continue;
      }
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
    /* медленное затухание пятен */
    const sc = this.splatCtx;
    sc.globalCompositeOperation = "destination-out";
    sc.fillStyle = "rgba(0,0,0,0.012)";
    sc.fillRect(0, 0, this.w, this.h);
    sc.globalCompositeOperation = "source-over";
  }

  /* ── отрисовка ── */

  private draw(t: number) {
    const c = this.ctx;
    const w = this.w;
    const h = this.h;
    c.clearRect(0, 0, w, h);

    const sx = this.shake > 0 ? rand(-this.shake, this.shake) * 0.5 : 0;
    const sy = this.shake > 0 ? rand(-this.shake, this.shake) * 0.5 : 0;
    c.save();
    c.translate(sx, sy);

    /* фон */
    const bg = c.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#070b18");
    bg.addColorStop(0.55, "#05070f");
    bg.addColorStop(1, "#0a0d1c");
    c.fillStyle = bg;
    c.fillRect(-20, -20, w + 40, h + 40);

    const glow = c.createRadialGradient(this.px, this.py, 0, this.px, this.py, 340);
    glow.addColorStop(0, "rgba(53,240,255,0.055)");
    glow.addColorStop(1, "rgba(53,240,255,0)");
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);

    /* сетка */
    c.strokeStyle = "rgba(53,240,255,0.05)";
    c.lineWidth = 1;
    c.beginPath();
    const grid = 64;
    for (let x = grid; x < w; x += grid) { c.moveTo(x, 0); c.lineTo(x, h); }
    for (let y = grid; y < h; y += grid) { c.moveTo(0, y); c.lineTo(w, y); }
    c.stroke();

    /* пылинки */
    for (const m of this.motes) {
      c.fillStyle = `rgba(141,246,255,${0.08 + 0.07 * Math.sin(m.ph * 2)})`;
      c.beginPath();
      c.arc(m.x, m.y, m.r, 0, TAU);
      c.fill();
    }

    c.drawImage(this.splat, 0, 0, w, h);

    /* частицы (нижний слой: дым, гильзы, обломки) */
    for (const p of this.particles) {
      const k = 1 - p.t / p.life;
      if (p.kind === "smoke") {
        c.fillStyle = hexA(p.color, 0.14 * k);
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

    /* вражеские снаряды */
    for (const b of this.ebullets) {
      const pulse = 1 + 0.25 * Math.sin(b.t * 20);
      c.fillStyle = "rgba(125,255,94,0.25)";
      c.beginPath();
      c.arc(b.x, b.y, b.r * 2.1 * pulse, 0, TAU);
      c.fill();
      c.fillStyle = "#7dff5e";
      c.beginPath();
      c.arc(b.x, b.y, b.r * pulse, 0, TAU);
      c.fill();
      c.fillStyle = "#eaffe4";
      c.beginPath();
      c.arc(b.x, b.y, b.r * 0.45, 0, TAU);
      c.fill();
    }

    /* враги */
    for (const e of this.enemies) this.drawEnemy(c, e, t);

    /* пули */
    c.globalCompositeOperation = "lighter";
    for (const b of this.bullets) {
      const tx = b.x - b.vx * 0.02;
      const ty = b.y - b.vy * 0.02;
      c.strokeStyle = hexA(b.color, 0.28);
      c.lineWidth = b.crit ? 7 : 5;
      c.beginPath();
      c.moveTo(tx, ty);
      c.lineTo(b.x, b.y);
      c.stroke();
      c.strokeStyle = b.color;
      c.lineWidth = b.crit ? 3 : 2;
      c.beginPath();
      c.moveTo(tx, ty);
      c.lineTo(b.x, b.y);
      c.stroke();
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(b.x, b.y, b.crit ? 2.6 : 1.8, 0, TAU);
      c.fill();
    }

    /* лазер */
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
      /* вспышки у дула */
      c.fillStyle = "rgba(53,240,255,0.5)";
      c.beginPath();
      c.arc(x1, y1, 7 * wob, 0, TAU);
      c.fill();
    }

    /* искры/кольца/вспышки (поверх) */
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
      c.fillStyle = hexA("#05070f", 0.6 * k);
      c.fillText(f.text, f.x + 1.5, f.y + 1.5);
      c.fillStyle = hexA(f.color, k);
      c.fillText(f.text, f.x, f.y);
    }

    c.restore();

    /* красная вспышка урона + виньетка */
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

    c.rotate(this.aim);
    /* сопло */
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
    /* корпус */
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
    /* ствол */
    const w = WEAPONS[this.weapon];
    c.fillStyle = w.color;
    if (w.id === "shotgun") {
      c.fillRect(8, -4.5, 18, 4);
      c.fillRect(8, 0.5, 18, 4);
    } else if (w.id === "laser") {
      c.fillRect(8, -2, 20, 4);
      c.fillStyle = "#eafdff";
      c.fillRect(26, -1, 3, 2);
    } else if (w.id === "smg") {
      c.fillRect(8, -2.5, 20, 5);
      c.fillRect(14, 2, 4, 7);
    } else {
      c.fillRect(8, -2.5, 15, 5);
    }
    /* визор */
    c.fillStyle = "#35f0ff";
    c.beginPath();
    c.arc(3, 0, 3.4, 0, TAU);
    c.fill();
    c.restore();
  }

  private drawEnemy(c: CanvasRenderingContext2D, e: Enemy, t: number) {
    const def = ENEMIES[e.type];
    const ang = Math.atan2(this.py - e.y, this.px - e.x);
    c.save();
    c.translate(e.x, e.y);

    /* тень-свечение */
    c.fillStyle = hexA(def.color, 0.12);
    c.beginPath();
    c.arc(0, 0, e.r * 1.5, 0, TAU);
    c.fill();

    c.rotate(ang);
    const wob = Math.sin(t * 5 + e.seed) * 0.12;

    c.fillStyle = "#0d1322";
    c.strokeStyle = def.color;
    c.lineWidth = 2;

    if (e.type === "chaser") {
      c.beginPath();
      const spikes = 9;
      for (let i = 0; i <= spikes * 2; i++) {
        const a = (i / (spikes * 2)) * TAU;
        const rr = e.r * (i % 2 === 0 ? 1 + wob : 0.68);
        c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath();
      c.fill();
      c.stroke();
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
      c.fillStyle = hexA(def.color, 0.85);
      c.beginPath();
      c.arc(e.r * 0.55, 0, 2.5 + open * 2.5, 0, TAU);
      c.fill();
    } else {
      /* громила — бронированный шестиугольник */
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + t * 0.6;
        c.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
      }
      c.closePath();
      c.fill();
      c.stroke();
      c.strokeStyle = hexA(def.color, 0.5);
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU - t * 0.4;
        c.lineTo(Math.cos(a) * e.r * 0.6, Math.sin(a) * e.r * 0.6);
      }
      c.closePath();
      c.stroke();
    }

    /* глаза */
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(e.r * 0.42, -e.r * 0.22, 2.6, 0, TAU);
    c.arc(e.r * 0.42, e.r * 0.22, 2.6, 0, TAU);
    c.fill();
    c.fillStyle = "#05070f";
    c.beginPath();
    c.arc(e.r * 0.5, -e.r * 0.22, 1.2, 0, TAU);
    c.arc(e.r * 0.5, e.r * 0.22, 1.2, 0, TAU);
    c.fill();

    /* вспышка попадания */
    if (e.flash > 0) {
      c.fillStyle = `rgba(255,255,255,${(e.flash / 0.09) * 0.75})`;
      c.beginPath();
      c.arc(0, 0, e.r * 1.15, 0, TAU);
      c.fill();
    }
    c.restore();

    /* полоска HP */
    if (e.hp < e.maxHp) {
      const bw = e.r * 2;
      const frac = clamp(e.hp / e.maxHp, 0, 1);
      c.fillStyle = "rgba(5,7,15,0.7)";
      c.fillRect(e.x - bw / 2, e.y - e.r - 11, bw, 4);
      c.fillStyle = frac > 0.4 ? def.color : "#ff3864";
      c.fillRect(e.x - bw / 2, e.y - e.r - 11, bw * frac, 4);
    }
  }

  /* ── HUD ── */

  private emitHud() {
    this.cb.onHud({
      hp: Math.max(0, Math.ceil(this.stats.hp)),
      maxHp: this.stats.maxHp,
      regen: this.stats.regen,
      wave: this.wave,
      enemiesLeft: this.quota - this.spawned + this.enemies.length,
      score: this.score,
      kills: this.kills,
      time: this.time,
      weapon: this.weapon,
      owned: [...this.owned],
      muted: this.sfx.muted,
      abilities: [
        {
          id: "dash",
          cd: this.dashCharges > 0 ? 0 : this.dashRecover,
          maxCd: DASH_CD * this.stats.abilityCdMul,
          charges: this.dashCharges,
          maxCharges: this.stats.dashMax,
          active: this.dashT,
          activeMax: DASH_TIME,
        },
        {
          id: "nova",
          cd: this.novaCd,
          maxCd: NOVA_CD * this.stats.abilityCdMul,
          charges: this.novaCd > 0 ? 0 : 1,
          maxCharges: 1,
          active: 0,
          activeMax: 0,
        },
        {
          id: "shield",
          cd: this.shieldCd,
          maxCd: SHIELD_CD * this.stats.abilityCdMul,
          charges: this.shieldCd > 0 || this.shieldT > 0 ? 0 : 1,
          maxCharges: 1,
          active: this.shieldT,
          activeMax: SHIELD_TIME,
        },
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
  const b = parseInt(hex.slice(5, 5 + 2), 16);
  return `rgba(${r},${g},${b},${clamp(a, 0, 1)})`;
}
