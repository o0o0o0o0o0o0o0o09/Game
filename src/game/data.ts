/* Общие типы и игровые данные: оружие, враги, биомы, боссы, улучшения, крафт. */

export type WeaponId = "pistol" | "smg" | "shotgun" | "laser" | "plasma" | "rail" | "minigun";
export type EnemyType = "chaser" | "runner" | "spitter" | "brute" | "bomber" | "wisp" | "healer" | "gazer" | "scuttler";
export type BossId = "mother" | "juggernaut" | "overseer" | "stiletto" | "hydra" | "magnetar" | "boneking" | "titan";
export type BiomeId = "wasteland" | "frost" | "ember" | "fungal";
export type Phase = "menu" | "playing" | "intermission" | "paused" | "craft" | "gameover";
export type Rarity = "common" | "rare" | "epic" | "weapon";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  tag: string;
  kind: "bullet" | "beam" | "rail";
  dmg: number;
  rate: number;
  speed: number;
  spread: number;
  pellets: number;
  life: number;
  color: string;
  kick: number;
  shake: number;
  explode?: number; // радиус взрыва снаряда
}

export const WEAPON_ORDER: WeaponId[] = ["pistol", "smg", "shotgun", "laser", "plasma", "rail", "minigun"];

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: { id: "pistol", name: "Пистолет", tag: "П-9 «ОСА» · надёжен в любой заварушке", kind: "bullet", dmg: 13, rate: 4.2, speed: 820, spread: 0.035, pellets: 1, life: 0.9, color: "#c8ff2e", kick: 26, shake: 1.4 },
  smg: { id: "smg", name: "Автомат", tag: "АК-«ШЕРШЕНЬ» · очередь решает всё", kind: "bullet", dmg: 6.5, rate: 11, speed: 880, spread: 0.1, pellets: 1, life: 0.8, color: "#ffb020", kick: 14, shake: 1.1 },
  shotgun: { id: "shotgun", name: "Дробовик", tag: "«МОЛОТ» · 6 дробин в упор", kind: "bullet", dmg: 8, rate: 1.7, speed: 700, spread: 0.34, pellets: 6, life: 0.3, color: "#ff3864", kick: 130, shake: 6 },
  laser: { id: "laser", name: "Лазер", tag: "ЛГ-«ПРИЗМА» · прожигает всех на линии", kind: "beam", dmg: 62, rate: 0, speed: 0, spread: 0, pellets: 1, life: 0, color: "#35f0ff", kick: 0, shake: 0.4 },
  plasma: { id: "plasma", name: "Плазмоид", tag: "ПЛ-«ГРОЗА» · снаряд взрывается по площади", kind: "bullet", dmg: 34, rate: 2.1, speed: 430, spread: 0.02, pellets: 1, life: 1.6, color: "#ff6bd6", kick: 40, shake: 2.5, explode: 80 },
  rail: { id: "rail", name: "Рельсотрон", tag: "РГ-«ПРОБОЙ» · прошивает всю линию насквозь", kind: "rail", dmg: 95, rate: 1.15, speed: 0, spread: 0, pellets: 1, life: 0, color: "#8df6ff", kick: 160, shake: 9 },
  minigun: { id: "minigun", name: "Миниган", tag: "МГ-«ШКВАЛ» · 17 пуль в секунду", kind: "bullet", dmg: 4, rate: 17, speed: 950, spread: 0.16, pellets: 1, life: 0.7, color: "#ffd27a", kick: 8, shake: 0.7 },
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
  aggro: boolean;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  chaser: { type: "chaser", name: "Жвал", r: 15, hp: 26, speed: 78, dmg: 10, score: 10, color: "#ff3864", minWave: 1, aggro: true },
  runner: { type: "runner", name: "Гонец", r: 10, hp: 14, speed: 158, dmg: 7, score: 15, color: "#ffb020", minWave: 2, aggro: true },
  spitter: { type: "spitter", name: "Плевун", r: 13, hp: 48, speed: 62, dmg: 8, score: 25, color: "#7dff5e", minWave: 3, aggro: true },
  brute: { type: "brute", name: "Громила", r: 27, hp: 170, speed: 42, dmg: 22, score: 40, color: "#c04dff", minWave: 4, aggro: true },
  bomber: { type: "bomber", name: "Подрывник", r: 12, hp: 30, speed: 105, dmg: 26, score: 25, color: "#ff8b2e", minWave: 3, aggro: true },
  wisp: { type: "wisp", name: "Огонёк", r: 8, hp: 12, speed: 190, dmg: 6, score: 15, color: "#8df6ff", minWave: 4, aggro: true },
  healer: { type: "healer", name: "Нянька", r: 14, hp: 55, speed: 70, dmg: 5, score: 35, color: "#5eff9c", minWave: 5, aggro: true },
  gazer: { type: "gazer", name: "Око", r: 14, hp: 60, speed: 66, dmg: 10, score: 30, color: "#c04dff", minWave: 5, aggro: true },
  scuttler: { type: "scuttler", name: "Падальщик", r: 9, hp: 8, speed: 90, dmg: 0, score: 2, color: "#9aa7c7", minWave: 1, aggro: false },
};

export interface BiomeDef {
  id: BiomeId;
  name: string;
  ground: string;
  ground2: string;
  accent: string;
  decos: string[];
}

export const BIOME_ORDER: BiomeId[] = ["wasteland", "frost", "ember", "fungal"];

export const BIOMES: Record<BiomeId, BiomeDef> = {
  wasteland: { id: "wasteland", name: "ПУСТОШЬ", ground: "#11141f", ground2: "#161a28", accent: "#c8ff2e", decos: ["crack", "rock", "grass"] },
  frost: { id: "frost", name: "МЕРЗЛОТА", ground: "#0d1626", ground2: "#122036", accent: "#8df6ff", decos: ["shard", "snow", "rock"] },
  ember: { id: "ember", name: "ТЛЕЮЩИЕ ЗЕМЛИ", ground: "#1a0f12", ground2: "#221318", accent: "#ffb020", decos: ["lava", "stump", "crack"] },
  fungal: { id: "fungal", name: "МИКОДЖУНГЛИ", ground: "#140f1e", ground2: "#1a1329", accent: "#c04dff", decos: ["shroom", "dot", "grass"] },
};

export interface BossDef {
  id: BossId;
  name: string;
  sub: string;
  color: string;
  r: number;
  hp: number;
  speed: number;
  dmg: number;
  score: number;
  retinue: EnemyType[];
}

export const BOSSES: Record<BossId, BossDef> = {
  mother: { id: "mother", name: "МАТРИАРХ", sub: "порождает рой", color: "#ff3864", r: 42, hp: 700, speed: 52, dmg: 26, score: 250, retinue: ["chaser", "runner", "chaser"] },
  juggernaut: { id: "juggernaut", name: "ИСТРЕБИТЕЛЬ", sub: "сокрушает всё", color: "#ffb020", r: 40, hp: 950, speed: 44, dmg: 30, score: 300, retinue: ["brute", "bomber", "chaser"] },
  overseer: { id: "overseer", name: "НАДЗИРАТЕЛЬ", sub: "видит всё", color: "#c04dff", r: 34, hp: 620, speed: 60, dmg: 18, score: 280, retinue: ["wisp", "gazer", "wisp"] },
  stiletto: { id: "stiletto", name: "СТРИЖ", sub: "неуловимый убийца", color: "#8df6ff", r: 18, hp: 440, speed: 175, dmg: 12, score: 260, retinue: ["runner", "wisp", "runner"] },
  hydra: { id: "hydra", name: "ГИДРА", sub: "три головы — одна цель", color: "#7dff5e", r: 28, hp: 580, speed: 62, dmg: 12, score: 280, retinue: ["spitter", "gazer", "chaser"] },
  magnetar: { id: "magnetar", name: "МАГНЕТАР", sub: "стягивает и рвёт", color: "#e06bff", r: 26, hp: 520, speed: 56, dmg: 10, score: 300, retinue: ["wisp", "chaser", "wisp"] },
  boneking: { id: "boneking", name: "КОСТЯНОЙ КОРОЛЬ", sub: "кость к кости", color: "#f0e6d2", r: 32, hp: 740, speed: 40, dmg: 14, score: 320, retinue: ["chaser", "bomber", "chaser"] },
  titan: { id: "titan", name: "ПЕПЕЛЬНЫЙ ТИТАН", sub: "земля горит под ним", color: "#ff6a2e", r: 46, hp: 1050, speed: 26, dmg: 26, score: 350, retinue: ["brute", "bomber", "bomber"] },
};

/* ── игрок ── */

export interface PlayerStats {
  damage: number;
  fireRate: number;
  moveSpeed: number;
  maxHp: number;
  hp: number;
  pierce: number;
  extraShots: number;
  crit: number;
  regen: number;
  dashMax: number;
  abilityCdMul: number;
  novaPower: number;
  mineMax: number;
  magnetR: number;
  lootMul: number;
  overloadBonus: number;
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
  dashMax: 1,
  abilityCdMul: 1,
  novaPower: 1,
  mineMax: 3,
  magnetR: 90,
  lootMul: 1,
  overloadBonus: 0,
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
  { id: "dmg", name: "Разрывные пули", desc: "+25% к урону всего оружия", icon: "bullet", rarity: "common", max: 6, apply: (s) => (s.damage *= 1.25) },
  { id: "rate", name: "Ускоритель", desc: "+18% к темпу огня", icon: "gauge", rarity: "common", max: 6, apply: (s) => (s.fireRate *= 1.18) },
  { id: "speed", name: "Сервоприводы", desc: "+12% к скорости передвижения", icon: "boots", rarity: "common", max: 5, apply: (s) => (s.moveSpeed *= 1.12) },
  { id: "armor", name: "Бронепластины", desc: "+30 к макс. здоровью и лечит 30 HP", icon: "shield", rarity: "rare", max: 5, apply: (s) => { s.maxHp += 30; s.hp = Math.min(s.maxHp, s.hp + 30); } },
  { id: "pierce", name: "Пронзатель", desc: "Пули пробивают +1 врага насквозь", icon: "pierce", rarity: "rare", max: 3, apply: (s) => (s.pierce += 1) },
  { id: "twin", name: "Дуплет", desc: "+1 дополнительный снаряд к каждому выстрелу", icon: "twin", rarity: "epic", max: 2, apply: (s) => (s.extraShots += 1) },
  { id: "crit", name: "Точка разрыва", desc: "+12% шанс крита (урон ×2)", icon: "target", rarity: "rare", max: 5, apply: (s) => (s.crit = Math.min(0.8, s.crit + 0.12)) },
  { id: "regen", name: "Наноремонт", desc: "+1 HP в секунду (восстанавливается)", icon: "cross", rarity: "rare", max: 3, apply: (s) => (s.regen += 1) },
  { id: "heal", name: "Полевой хирург", desc: "Мгновенно восстанавливает 60% здоровья", icon: "heart", rarity: "common", max: 99, apply: (s) => (s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.6)) },
  { id: "abilityCd", name: "Хроно-модуль", desc: "−18% к перезарядке всех способностей", icon: "chrono", rarity: "rare", max: 4, apply: (s) => (s.abilityCdMul *= 0.82) },
  { id: "novaPower", name: "Термоядро", desc: "+35% к урону и радиусу «Новы»", icon: "core", rarity: "epic", max: 3, apply: (s) => (s.novaPower *= 1.35) },
  { id: "dashMax", name: "Фазовый конденсатор", desc: "+1 заряд «Рывка» (заряды восстанавливаются)", icon: "capacitor", rarity: "epic", max: 2, apply: (s) => (s.dashMax += 1) },
  { id: "mineMax", name: "Инженерный пакет", desc: "+2 к запасу мин и +1 полный заряд", icon: "mine", rarity: "epic", max: 2, apply: (s) => (s.mineMax += 2) },
  { id: "overloadT", name: "Разгонщик", desc: "+1.5 с к длительности «Перегрузки»", icon: "bolt", rarity: "rare", max: 3, apply: (s) => (s.overloadBonus += 1.5) },
  { id: "loot", name: "Мародёр", desc: "+35% к добываемым ресурсам", icon: "gem", rarity: "rare", max: 3, apply: (s) => (s.lootMul *= 1.35) },
  { id: "magnet", name: "Магнит", desc: "+60 к радиусу притяжения ресурсов", icon: "magnet", rarity: "common", max: 3, apply: (s) => (s.magnetR += 60) },
];

export interface UpgradeChoice {
  key: string;
  kind: "upgrade" | "weapon";
  name: string;
  desc: string;
  icon: string;
  rarity: Rarity;
  weaponId?: WeaponId;
}

/* ── крафт ── */

export interface RecipeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  cost: { scrap?: number; bio?: number; core?: number };
  canUse?: (s: PlayerStats) => boolean;
  apply: (s: PlayerStats) => void;
}

export const RECIPES: RecipeDef[] = [
  { id: "medkit", name: "Аптечка", desc: "Восстановить 50% здоровья", icon: "cross", cost: { scrap: 20, bio: 12 }, canUse: (s) => s.hp < s.maxHp, apply: (s) => (s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.5)) },
  { id: "plate", name: "Бронепластина", desc: "+25 к макс. здоровью (и сразу +25 HP)", icon: "shield", cost: { scrap: 45 }, apply: (s) => { s.maxHp += 25; s.hp = Math.min(s.maxHp, s.hp + 25); } },
  { id: "chip", name: "Чип урона", desc: "+15% к урону оружия", icon: "chip", cost: { scrap: 25, core: 1 }, apply: (s) => (s.damage *= 1.15) },
  { id: "cell", name: "Фазовая ячейка", desc: "+1 заряд рывка, заряды полные", icon: "capacitor", cost: { scrap: 30, core: 1 }, apply: (s) => (s.dashMax += 1) },
  { id: "adrenaline", name: "Адреналин", desc: "+8% к скорости передвижения", icon: "gauge", cost: { scrap: 10, bio: 25 }, apply: (s) => (s.moveSpeed *= 1.08) },
  { id: "minePack", name: "Минный набор", desc: "+1 к запасу мин", icon: "mine", cost: { scrap: 35, core: 1 }, apply: (s) => (s.mineMax += 1) },
];

/* ── HUD ── */

export interface AbilityHud {
  id: "dash" | "nova" | "shield" | "overload" | "mine";
  cd: number;
  maxCd: number;
  charges: number;
  maxCharges: number;
  active: number;
  activeMax: number;
}

export interface Resources {
  scrap: number;
  bio: number;
  core: number;
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
  abilities: AbilityHud[];
  res: Resources;
  boss: { name: string; color: string; hp: number; maxHp: number } | null;
  biome: string;
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
