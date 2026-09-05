/* Общие типы и игровые данные: оружие, враги, улучшения. */

export type WeaponId = "pistol" | "smg" | "shotgun" | "laser";
export type EnemyType = "chaser" | "runner" | "spitter" | "brute";
export type Phase = "menu" | "playing" | "intermission" | "paused" | "gameover";
export type Rarity = "common" | "rare" | "epic" | "weapon";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  tag: string;
  kind: "bullet" | "beam";
  dmg: number; // урон за пулю (или DPS для лазера)
  rate: number; // выстрелов в секунду
  speed: number; // скорость пули
  spread: number; // разброс, рад
  pellets: number; // дробин за выстрел
  life: number; // время жизни пули, с
  color: string;
  kick: number; // отдача игрока
  shake: number; // тряска экрана
}

export const WEAPON_ORDER: WeaponId[] = ["pistol", "smg", "shotgun", "laser"];

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: "pistol",
    name: "Пистолет",
    tag: "П-9 «ОСА» · надёжен в любой заварушке",
    kind: "bullet",
    dmg: 13,
    rate: 4.2,
    speed: 820,
    spread: 0.035,
    pellets: 1,
    life: 0.9,
    color: "#c8ff2e",
    kick: 26,
    shake: 1.4,
  },
  smg: {
    id: "smg",
    name: "Автомат",
    tag: "АК-«ШЕРШЕНЬ» · очередь решает всё",
    kind: "bullet",
    dmg: 6.5,
    rate: 11,
    speed: 880,
    spread: 0.1,
    pellets: 1,
    life: 0.8,
    color: "#ffb020",
    kick: 14,
    shake: 1.1,
  },
  shotgun: {
    id: "shotgun",
    name: "Дробовик",
    tag: "«МОЛОТ» · 6 дробин в упор",
    kind: "bullet",
    dmg: 8,
    rate: 1.7,
    speed: 700,
    spread: 0.34,
    pellets: 6,
    life: 0.3,
    color: "#ff3864",
    kick: 130,
    shake: 6,
  },
  laser: {
    id: "laser",
    name: "Лазер",
    tag: "ЛГ-«ПРИЗМА» · прожигает всех на линии",
    kind: "beam",
    dmg: 62,
    rate: 0,
    speed: 0,
    spread: 0,
    pellets: 1,
    life: 0,
    color: "#35f0ff",
    kick: 0,
    shake: 0.4,
  },
};

export interface EnemyDef {
  type: EnemyType;
  name: string;
  r: number;
  hp: number;
  speed: number;
  dmg: number;
  score: number;
  color: string;
  minWave: number;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  chaser: { type: "chaser", name: "Жвал", r: 15, hp: 26, speed: 78, dmg: 10, score: 10, color: "#ff3864", minWave: 1 },
  runner: { type: "runner", name: "Гонец", r: 10, hp: 14, speed: 158, dmg: 7, score: 15, color: "#ffb020", minWave: 2 },
  spitter: { type: "spitter", name: "Плевун", r: 13, hp: 48, speed: 62, dmg: 8, score: 25, color: "#7dff5e", minWave: 3 },
  brute: { type: "brute", name: "Громила", r: 27, hp: 170, speed: 42, dmg: 22, score: 40, color: "#c04dff", minWave: 4 },
};

/* ── игрок ── */

export interface PlayerStats {
  damage: number; // множитель
  fireRate: number; // множитель
  moveSpeed: number; // множитель
  maxHp: number;
  hp: number;
  pierce: number;
  extraShots: number;
  crit: number; // 0..1
  regen: number; // HP/сек
  taken: Record<string, number>;
}

export const initialStats = (): PlayerStats => ({
  damage: 1,
  fireRate: 1,
  moveSpeed: 1,
  maxHp: 100,
  hp: 100,
  pierce: 0,
  extraShots: 0,
  crit: 0.05,
  regen: 0,
  taken: {},
});

/* ── улучшения ── */

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  rarity: Rarity;
  max: number;
  apply: (s: PlayerStats) => void;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: "dmg",
    name: "Разрывные пули",
    desc: "+25% к урону всего оружия",
    icon: "bullet",
    rarity: "common",
    max: 6,
    apply: (s) => (s.damage *= 1.25),
  },
  {
    id: "rate",
    name: "Ускоритель",
    desc: "+18% к темпу огня",
    icon: "gauge",
    rarity: "common",
    max: 6,
    apply: (s) => (s.fireRate *= 1.18),
  },
  {
    id: "speed",
    name: "Сервоприводы",
    desc: "+12% к скорости передвижения",
    icon: "boots",
    rarity: "common",
    max: 5,
    apply: (s) => (s.moveSpeed *= 1.12),
  },
  {
    id: "armor",
    name: "Бронепластины",
    desc: "+30 к макс. здоровью и лечит 30 HP",
    icon: "shield",
    rarity: "rare",
    max: 5,
    apply: (s) => {
      s.maxHp += 30;
      s.hp = Math.min(s.maxHp, s.hp + 30);
    },
  },
  {
    id: "pierce",
    name: "Пронзатель",
    desc: "Пули пробивают +1 врага насквозь",
    icon: "pierce",
    rarity: "rare",
    max: 3,
    apply: (s) => (s.pierce += 1),
  },
  {
    id: "twin",
    name: "Дуплет",
    desc: "+1 дополнительный снаряд к каждому выстрелу",
    icon: "twin",
    rarity: "epic",
    max: 2,
    apply: (s) => (s.extraShots += 1),
  },
  {
    id: "crit",
    name: "Точка разрыва",
    desc: "+12% шанс крита (урон ×2)",
    icon: "target",
    rarity: "rare",
    max: 5,
    apply: (s) => (s.crit = Math.min(0.8, s.crit + 0.12)),
  },
  {
    id: "regen",
    name: "Наноремонт",
    desc: "+1 HP в секунду (восстанавливается)",
    icon: "cross",
    rarity: "rare",
    max: 3,
    apply: (s) => (s.regen += 1),
  },
  {
    id: "heal",
    name: "Полевой хирург",
    desc: "Мгновенно восстанавливает 60% здоровья",
    icon: "heart",
    rarity: "common",
    max: 99,
    apply: (s) => (s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.6)),
  },
];

export interface UpgradeChoice {
  key: string; // "up:dmg" | "wpn:shotgun"
  kind: "upgrade" | "weapon";
  name: string;
  desc: string;
  icon: string;
  rarity: Rarity;
  weaponId?: WeaponId;
}

export interface HudData {
  hp: number;
  maxHp: number;
  regen: number;
  wave: number;
  enemiesLeft: number;
  score: number;
  kills: number;
  time: number;
  weapon: WeaponId;
  owned: WeaponId[];
  muted: boolean;
}

export interface GameOverStats {
  score: number;
  kills: number;
  wave: number;
  time: number;
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Обычное",
  rare: "Редкое",
  epic: "Эпическое",
  weapon: "Оружие",
};

export const fmtTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const fmtScore = (n: number) => n.toLocaleString("ru-RU");
