import type { ReactNode } from "react";
import type { GameOverStats, HudData, Rarity, UpgradeChoice, WeaponId } from "../game/data";
import { RARITY_LABEL, WEAPONS, WEAPON_ORDER, fmtScore, fmtTime } from "../game/data";

/* ─────────────── иконки (inline SVG) ─────────────── */

export function Icon({ name, className = "w-6 h-6" }: { name: string; className?: string }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "pistol":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <path d="M3 8h18v3.5h-6.5L13 17H9l1.4-5.5H3z" />
          <path d="M6 11.5v2.5" />
        </svg>
      );
    case "smg":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <path d="M2 9h20v3.5h-7L13.5 17h-4l1.4-4.5H8L7 15H4.5l1-2.5H2z" />
          <path d="M14 6.5h4V9" />
        </svg>
      );
    case "shotgun":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <path d="M2 8h20M2 11h20" />
          <path d="M2 8v6h4l2.5-2.5" />
          <path d="M13 13.5v2.5" />
        </svg>
      );
    case "laser":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <rect x="2" y="8.5" width="11" height="7" />
          <path d="M13 12h9M16 8.5h6M16 15.5h6" opacity="0.75" />
          <path d="M6 15.5V18" />
        </svg>
      );
    case "bullet":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <path d="M9 3c3 2.5 4.5 6 4.5 9.5H9zM9 12.5h4.5V21H9z" />
          <path d="M6 21h10" />
        </svg>
      );
    case "gauge":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <path d="M4 17a9 9 0 1 1 16 0" />
          <path d="M12 13l4.5-4.5" />
          <circle cx="12" cy="13" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case "boots":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <path d="M4 4l6 5-6 5" />
          <path d="M13 6l6 5-6 5" opacity="0.65" />
          <path d="M4 19h16" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <path d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6z" />
          <path d="M12 8v6M9 11h6" />
        </svg>
      );
    case "pierce":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <circle cx="10" cy="12" r="5.5" />
          <path d="M7 12h14M18 9l3 3-3 3" />
        </svg>
      );
    case "twin":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <path d="M7 4c2 1.8 3 4.4 3 7v10H7V11c0-2.6 0-5 0-7z" transform="translate(-1.5 0)" />
          <path d="M15 4c2 1.8 3 4.4 3 7v10h-3V11c0-2.6 0-5 0-7z" transform="translate(1.5 0)" opacity="0.7" />
        </svg>
      );
    case "target":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      );
    case "cross":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <rect x="4" y="4" width="16" height="16" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case "heart":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <path d="M12 20s-7.5-4.6-9-9.3C2 7.6 4 5 6.8 5 9 5 10.8 6.4 12 8c1.2-1.6 3-3 5.2-3C20 5 22 7.6 21 10.7c-1.5 4.7-9 9.3-9 9.3z" />
          <path d="M8 11h2.5l1.5-2 1.5 3 1-1.5H17" opacity="0.8" />
        </svg>
      );
    case "lock":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <rect x="5" y="11" width="14" height="9" />
          <path d="M8 11V8a4 4 0 1 1 8 0v3" />
        </svg>
      );
    case "sound":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <path d="M4 9v6h4l5 4V5L8 9z" />
          <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a9 9 0 0 1 0 12" />
        </svg>
      );
    case "soundOff":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <path d="M4 9v6h4l5 4V5L8 9z" />
          <path d="M17 9l5 6M22 9l-5 6" />
        </svg>
      );
    case "skull":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 5 3.5 6.2V21h9v-3.8C18.5 16 20 14 20 11a8 8 0 0 0-8-8z" />
          <circle cx="9" cy="11" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="15" cy="11" r="1.6" fill="currentColor" stroke="none" />
          <path d="M10.5 21v-2M13.5 21v-2" />
        </svg>
      );
    case "wave":
      return (
        <svg viewBox="0 0 24 24" className={className} {...s}>
          <path d="M2 12c2.5 0 2.5-4 5-4s2.5 8 5 8 2.5-8 5-8 2.5 4 5 4" />
        </svg>
      );
    default:
      return null;
  }
}

/* ─────────────── палитра редкости ─────────────── */

const RAR: Record<Rarity, { color: string; rgb: string }> = {
  common: { color: "#35f0ff", rgb: "53,240,255" },
  rare: { color: "#ffb020", rgb: "255,176,32" },
  epic: { color: "#ff3864", rgb: "255,56,100" },
  weapon: { color: "#c8ff2e", rgb: "200,255,46" },
};

/* ─────────────── HUD ─────────────── */

export function Hud({
  hud,
  onWeapon,
  onMute,
  onHover,
}: {
  hud: HudData;
  onWeapon: (w: WeaponId) => void;
  onMute: () => void;
  onHover: () => void;
}) {
  const frac = hud.maxHp > 0 ? hud.hp / hud.maxHp : 0;
  const low = frac < 0.3;
  return (
    <div className="absolute inset-0 pointer-events-none z-20 font-body">
      {/* верхняя строка */}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between px-4 pt-3 gap-3">
        {/* HP */}
        <div className="panel-base clip-panel px-4 py-2.5 w-[300px] max-w-[40vw] anim-hud">
          <div className="flex items-baseline justify-between">
            <span className={`text-[10px] font-bold tracking-[0.22em] ${low ? "text-blood-400 anim-danger" : "text-neon-400"}`}>
              ЦЕЛОСТНОСТЬ
            </span>
            <span className={`font-disp text-sm ${low ? "text-blood-300" : "text-white"}`}>
              {hud.hp}
              <span className="text-white/40 text-[11px] font-body font-semibold"> / {hud.maxHp}</span>
            </span>
          </div>
          <div className="mt-1.5 h-3 bg-ink-950/90 clip-slot relative overflow-hidden border border-white/10">
            <div
              className="absolute inset-y-0 left-0 transition-[width] duration-150 ease-out"
              style={{
                width: `${Math.max(0, Math.min(100, frac * 100))}%`,
                background: low
                  ? "linear-gradient(90deg,#d61f4b,#ff3864)"
                  : "linear-gradient(90deg,#12c8e0,#c8ff2e)",
                boxShadow: low ? "0 0 12px rgba(255,56,100,0.7)" : "0 0 12px rgba(200,255,46,0.45)",
              }}
            />
            <div className="absolute inset-0 opacity-30" style={{ background: "repeating-linear-gradient(-55deg, transparent 0 6px, rgba(0,0,0,0.35) 6px 8px)" }} />
          </div>
          {hud.regen > 0 && (
            <div className="mt-1 text-[10px] font-semibold text-acid-400/80 tracking-wider">+{hud.regen} HP/С · НАНОРЕМОНТ</div>
          )}
        </div>

        {/* волна */}
        <div className="panel-base clip-panel px-6 py-2 text-center anim-hud">
          <div className="text-[10px] font-bold tracking-[0.3em] text-neon-400/80">СЕКТОР 9</div>
          <div className="font-disp text-2xl leading-none text-white mt-0.5">
            ВОЛНА <span className="text-acid-400">{hud.wave}</span>
          </div>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-blood-300">
            <Icon name="skull" className="w-3.5 h-3.5" />
            ОСТАЛОСЬ: {hud.enemiesLeft}
          </div>
        </div>

        {/* счёт */}
        <div className="panel-base clip-panel px-4 py-2.5 w-[240px] max-w-[34vw] text-right anim-hud">
          <div className="text-[10px] font-bold tracking-[0.22em] text-neon-400/80">СЧЁТ</div>
          <div className="font-disp text-2xl leading-tight text-ember-400 tabular-nums">{fmtScore(hud.score)}</div>
          <div className="flex justify-end gap-3 text-[11px] font-semibold text-white/60 tabular-nums">
            <span>УБИЙСТВА: <span className="text-white/90">{hud.kills}</span></span>
            <span>{fmtTime(hud.time)}</span>
          </div>
        </div>
      </div>

      {/* нижняя строка: оружие */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-2">
        {WEAPON_ORDER.map((id, i) => {
          const owned = hud.owned.includes(id);
          const active = hud.weapon === id;
          const w = WEAPONS[id];
          return (
            <button
              key={id}
              onMouseEnter={onHover}
              onClick={() => owned && onWeapon(id)}
              className={`pointer-events-auto relative w-[76px] h-[68px] clip-slot flex flex-col items-center justify-center gap-0.5 transition-all duration-100 cursor-pointer ${
                active
                  ? "bg-acid-400/15 border border-acid-400 text-acid-300 shadow-[0_0_24px_rgba(200,255,46,0.35)]"
                  : owned
                    ? "panel-base text-neon-300/80 hover:text-neon-300 hover:-translate-y-1"
                    : "bg-ink-900/70 border border-white/10 text-white/25"
              }`}
              style={active ? { translate: "0 -4px" } : undefined}
            >
              <span className="absolute top-1 left-1.5 text-[9px] font-bold text-white/50">{i + 1}</span>
              {owned ? <Icon name={id} className="w-7 h-7" /> : <Icon name="lock" className="w-6 h-6" />}
              <span className="text-[9px] font-bold tracking-widest">{owned ? w.name.toUpperCase() : "ЗАКРЫТО"}</span>
              {active && <span className="absolute -bottom-0.5 h-0.5 w-10 bg-acid-400 shadow-[0_0_8px_rgba(200,255,46,0.9)]" />}
            </button>
          );
        })}
      </div>

      {/* подсказки + звук */}
      <div className="absolute bottom-3 left-4 text-[10px] font-semibold text-white/35 leading-relaxed hidden md:block">
        <div>WASD — движение · МЫШЬ — прицел · ЛКМ — огонь</div>
        <div>Q / КОЛЕСО — оружие · ESC — пауза · M — звук</div>
      </div>
      <button
        onMouseEnter={onHover}
        onClick={onMute}
        className="pointer-events-auto absolute bottom-3 right-4 panel-base clip-slot w-10 h-10 flex items-center justify-center text-neon-300/80 hover:text-neon-300 hover:-translate-y-0.5 transition-all cursor-pointer"
      >
        <Icon name={hud.muted ? "soundOff" : "sound"} className="w-5 h-5" />
      </button>
    </div>
  );
}

/* ─────────────── баннер волны ─────────────── */

export function Banner({ banner }: { banner: { id: number; text: string; sub?: string } }) {
  return (
    <div key={banner.id} className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none -translate-y-16">
      <div className="anim-banner text-center">
        <div
          className="font-disp text-6xl md:text-8xl text-white"
          style={{ textShadow: "0 0 30px rgba(200,255,46,0.5), 5px 5px 0 rgba(255,56,100,0.45), -5px -4px 0 rgba(53,240,255,0.4)" }}
        >
          {banner.text}
        </div>
        {banner.sub && (
          <div className="mt-3 text-neon-300 font-bold tracking-[0.35em] text-sm uppercase">{banner.sub}</div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── выбор улучшения ─────────────── */

export function UpgradeModal({
  choices,
  onPick,
  onHover,
}: {
  choices: UpgradeChoice[];
  onPick: (i: number) => void;
  onHover: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(4,6,13,0.72)] backdrop-blur-[3px] anim-screen">
      <div className="flex flex-col items-center px-4 max-w-full">
        <div className="text-acid-400 text-xs font-bold tracking-[0.5em] uppercase">Зачищено</div>
        <h2 className="font-disp text-4xl md:text-6xl text-white mt-2 text-center" style={{ textShadow: "0 0 24px rgba(53,240,255,0.35)" }}>
          ВЫБЕРИ УСИЛЕНИЕ
        </h2>
        <p className="text-white/50 font-semibold mt-2 mb-8 text-sm tracking-wide">
          одна карта · решение необратимо · <span className="text-white/70">клавиши 1–3</span>
        </p>
        <div className="flex flex-wrap justify-center gap-5">
          {choices.map((c, i) => {
            const r = RAR[c.rarity];
            return (
              <button
                key={c.key + i}
                onMouseEnter={onHover}
                onClick={() => onPick(i)}
                className="card-upgrade anim-card group relative w-60 md:w-64 panel-base clip-panel p-6 pt-7 text-left cursor-pointer bg-ink-900/80"
                style={{
                  animationDelay: `${0.08 + i * 0.1}s`,
                  borderColor: `${r.color}55`,
                  boxShadow: `0 0 0 1px rgba(5,7,15,0.6), 0 14px 40px rgba(0,0,0,0.5)`,
                }}
              >
                <span
                  className="absolute top-0 left-0 h-1 w-full"
                  style={{ background: `linear-gradient(90deg, ${r.color}, transparent)` }}
                />
                <span className="absolute top-3 right-3 w-7 h-7 clip-slot bg-ink-950/80 border border-white/15 text-white/60 font-disp text-sm flex items-center justify-center group-hover:text-white group-hover:border-white/40">
                  {i + 1}
                </span>
                <div
                  className="w-16 h-16 clip-panel flex items-center justify-center mb-4"
                  style={{ background: `rgba(${r.rgb},0.12)`, color: r.color, boxShadow: `inset 0 0 18px rgba(${r.rgb},0.25)` }}
                >
                  <Icon name={c.icon} className="w-9 h-9" />
                </div>
                <div className="text-[10px] font-bold tracking-[0.28em] uppercase" style={{ color: r.color }}>
                  {RARITY_LABEL[c.rarity]}
                </div>
                <div className="font-disp text-xl text-white mt-1 leading-tight">{c.name}</div>
                <div className="text-white/55 text-[13px] font-medium leading-snug mt-2 min-h-10">{c.desc}</div>
                <div
                  className="mt-4 text-[11px] font-bold tracking-[0.2em] uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: r.color }}
                >
                  Взять ▸
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── экраны ─────────────── */

function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block min-w-7 text-center px-1.5 py-0.5 bg-ink-800 border border-neon-400/35 text-neon-300 text-[11px] font-bold rounded-[3px] shadow-[0_2px_0_rgba(0,0,0,0.5)]">
      {children}
    </span>
  );
}

function BigButton({
  children,
  onClick,
  onHover,
  variant = "acid",
}: {
  children: ReactNode;
  onClick: () => void;
  onHover: () => void;
  variant?: "acid" | "ghost" | "blood";
}) {
  const cls =
    variant === "acid"
      ? "bg-acid-400 text-ink-950 shadow-[0_0_34px_rgba(200,255,46,0.4)]"
      : variant === "blood"
        ? "bg-blood-500/20 text-blood-300 border border-blood-400/50 hover:bg-blood-500/30"
        : "bg-ink-800/80 text-neon-300 border border-neon-400/35 hover:border-neon-400/70";
  return (
    <button onMouseEnter={onHover} onClick={onClick} className={`btn-game clip-btn font-disp text-lg tracking-wider px-8 py-3.5 cursor-pointer ${cls}`}>
      {children}
    </button>
  );
}

export function MenuScreen({ onStart, onHover }: { onStart: () => void; onHover: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(4,6,13,0.78)] anim-screen overflow-y-auto">
      <div className="flex flex-col lg:flex-row items-center lg:items-center gap-10 lg:gap-16 px-6 py-10 max-w-6xl w-full justify-center">
        {/* левая колонка */}
        <div className="flex-1 min-w-0 max-w-xl">
          <div className="flex items-center gap-2 text-neon-400 text-[11px] font-bold tracking-[0.4em] uppercase">
            <Icon name="wave" className="w-5 h-5" />
            Протокол выживания · сектор 9
          </div>
          <h1 className="anim-title font-disp text-[7rem] md:text-[9.5rem] leading-[0.9] text-acid-400 mt-3">
            РОЙ
          </h1>
          <p className="text-white/65 font-medium text-base md:text-lg leading-relaxed mt-4 max-w-md">
            Они приходят <span className="text-blood-400 font-bold">волнами</span> — с каждым разом быстрее, злее и живучее.
            Зачищай арену, собирай <span className="text-neon-300 font-bold">улучшения</span> и держись до последнего.
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-7">
            <BigButton onClick={onStart} onHover={onHover}>
              В БОЙ <span className="opacity-60 text-sm">[ENTER]</span>
            </BigButton>
            <span className="text-white/40 text-sm font-semibold anim-caret">▮</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-8 text-[12px] font-semibold text-white/45">
            <span className="flex items-center gap-1.5"><Kbd>W</Kbd><Kbd>A</Kbd><Kbd>S</Kbd><Kbd>D</Kbd> движение</span>
            <span className="flex items-center gap-1.5"><Kbd>ЛКМ</Kbd> огонь</span>
            <span className="flex items-center gap-1.5"><Kbd>Q</Kbd> смена оружия</span>
            <span className="flex items-center gap-1.5"><Kbd>ESC</Kbd> пауза</span>
          </div>
        </div>

        {/* правая колонка: арсенал */}
        <div className="w-full max-w-sm flex flex-col gap-3">
          <div className="panel-base clip-panel p-5">
            <div className="text-[10px] font-bold tracking-[0.3em] text-neon-400/80 mb-3">АРСЕНАЛ</div>
            <div className="flex flex-col gap-2.5">
              {WEAPON_ORDER.map((id, i) => (
                <div key={id} className="flex items-center gap-3">
                  <span className={`w-10 h-10 clip-slot flex items-center justify-center border ${i === 0 ? "text-acid-400 border-acid-400/40 bg-acid-400/10" : "text-white/35 border-white/12 bg-ink-950/60"}`}>
                    <Icon name={id} className="w-6 h-6" />
                  </span>
                  <div className="min-w-0">
                    <div className={`font-disp text-sm ${i === 0 ? "text-white" : "text-white/55"}`}>
                      {WEAPONS[id].name}
                      <span className="ml-2 text-[9px] font-body font-bold text-white/35 tracking-widest">{i === 0 ? "ВЫДАН" : "НАЙТИ В ВОЛНАХ"}</span>
                    </div>
                    <div className="text-[11px] text-white/40 font-medium truncate">{WEAPONS[id].tag}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="panel-base clip-panel p-5">
            <div className="text-[10px] font-bold tracking-[0.3em] text-blood-400/90 mb-2.5">БРИФИНГ</div>
            <ul className="text-[12px] font-medium text-white/55 leading-relaxed space-y-1.5">
              <li>▸ Каждая зачищенная волна — выбор 1 из 3 усилений</li>
              <li>▸ Враги мутируют: растут HP, скорость и урон</li>
              <li>▸ С 4-й волны выходят <span className="text-[#c04dff] font-bold">Громилы</span> — держи дистанцию</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PauseScreen({
  onResume,
  onRestart,
  onMenu,
  onHover,
}: {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  onHover: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(4,6,13,0.7)] backdrop-blur-[2px] anim-screen">
      <div className="panel-base clip-panel p-9 w-[380px] max-w-[92vw] text-center">
        <h2 className="font-disp text-5xl text-white" style={{ textShadow: "0 0 24px rgba(53,240,255,0.4)" }}>
          ПАУЗА
        </h2>
        <div className="text-neon-300/70 text-[11px] font-bold tracking-[0.4em] mt-1.5 uppercase">система приостановлена</div>
        <div className="flex flex-col gap-2.5 mt-7">
          <BigButton onClick={onResume} onHover={onHover}>ПРОДОЛЖИТЬ</BigButton>
          <BigButton variant="ghost" onClick={onRestart} onHover={onHover}>ЗАНОВО</BigButton>
          <BigButton variant="ghost" onClick={onMenu} onHover={onHover}>В МЕНЮ</BigButton>
        </div>
        <div className="mt-6 text-[11px] font-semibold text-white/40 leading-relaxed">
          <Kbd>ESC</Kbd> — вернуться в бой
        </div>
      </div>
    </div>
  );
}

export function GameOverScreen({
  stats,
  onRestart,
  onMenu,
  onHover,
}: {
  stats: GameOverStats;
  onRestart: () => void;
  onMenu: () => void;
  onHover: () => void;
}) {
  const rows = [
    { label: "СЧЁТ", value: fmtScore(stats.score), color: "#ffb020" },
    { label: "УБИЙСТВА", value: String(stats.kills), color: "#ff3864" },
    { label: "ВОЛНА", value: String(stats.wave), color: "#35f0ff" },
    { label: "ВРЕМЯ", value: fmtTime(stats.time), color: "#c8ff2e" },
  ];
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(4,6,13,0.78)] anim-screen">
      <div className="text-center px-6 max-w-lg w-full">
        <div className="flex items-center justify-center gap-3 text-blood-400 text-[11px] font-bold tracking-[0.5em] uppercase">
          <Icon name="skull" className="w-5 h-5" /> связь прервана
        </div>
        <h2
          className="font-disp text-6xl md:text-8xl text-blood-400 mt-3 leading-none"
          style={{ textShadow: "0 0 34px rgba(255,56,100,0.55), 4px 4px 0 rgba(53,240,255,0.3)" }}
        >
          СИГНАЛ ПОТЕРЯН
        </h2>
        <p className="text-white/50 font-semibold mt-3 text-sm tracking-wide">арена захвачена роем · протокол завершён</p>

        <div className="grid grid-cols-2 gap-2.5 mt-8">
          {rows.map((r) => (
            <div key={r.label} className="panel-base clip-panel px-4 py-3 text-left">
              <div className="text-[10px] font-bold tracking-[0.25em] text-white/40">{r.label}</div>
              <div className="font-disp text-3xl tabular-nums" style={{ color: r.color }}>{r.value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-3.5 mt-8">
          <BigButton onClick={onRestart} onHover={onHover}>ЕЩЁ РАЗ <span className="opacity-60 text-sm">[ENTER]</span></BigButton>
          <BigButton variant="ghost" onClick={onMenu} onHover={onHover}>В МЕНЮ</BigButton>
        </div>
      </div>
    </div>
  );
}
