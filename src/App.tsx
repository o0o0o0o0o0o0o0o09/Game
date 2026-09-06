import { useEffect, useRef, useState } from "react";
import { Engine } from "./game/engine";
import type { GameOverStats, HudData, Phase, UpgradeChoice, WeaponId } from "./game/data";
import {
  Banner,
  CraftScreen,
  GameOverScreen,
  Hud,
  MenuScreen,
  PauseScreen,
  UpgradeModal,
} from "./ui/Overlays";

const initialHud: HudData = {
  hp: 100,
  maxHp: 100,
  regen: 0,
  wave: 0,
  enemiesLeft: 0,
  score: 0,
  kills: 0,
  time: 0,
  weapon: "pistol",
  owned: ["pistol"],
  muted: false,
  res: { scrap: 0, bio: 0, core: 0 },
  boss: null,
  biome: "ПУСТОШЬ",
  abilities: [
    { id: "dash", cd: 0, maxCd: 2.4, charges: 1, maxCharges: 1, active: 0, activeMax: 0.16 },
    { id: "nova", cd: 0, maxCd: 6, charges: 1, maxCharges: 1, active: 0, activeMax: 0 },
    { id: "shield", cd: 0, maxCd: 10, charges: 1, maxCharges: 1, active: 0, activeMax: 3 },
    { id: "overload", cd: 0, maxCd: 14, charges: 1, maxCharges: 1, active: 0, activeMax: 4 },
    { id: "mine", cd: 0, maxCd: 5, charges: 3, maxCharges: 3, active: 0, activeMax: 0 },
  ],
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [phase, setPhase] = useState<Phase>("menu");
  const [hud, setHud] = useState<HudData>(initialHud);
  const [choices, setChoices] = useState<UpgradeChoice[]>([]);
  const [banner, setBanner] = useState<{ id: number; text: string; sub?: string } | null>(null);
  const [goStats, setGoStats] = useState<GameOverStats | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const eng = new Engine(cv, {
      onHud: setHud,
      onPhase: setPhase,
      onChoices: setChoices,
      onGameOver: setGoStats,
      onBanner: (text, sub) => setBanner({ id: Date.now() + Math.random(), text, sub }),
    });
    engineRef.current = eng;
    eng.start();
    return () => {
      eng.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 2000);
    return () => clearTimeout(t);
  }, [banner]);

  const eng = () => engineRef.current;
  const hover = () => eng()?.uiSound("hover");

  const inGame = phase === "playing" || phase === "paused" || phase === "intermission" || phase === "craft";

  return (
    <div className="relative w-full h-full bg-ink-950 scanlines overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block"
        style={{ cursor: phase === "playing" ? "none" : "default" }}
      />
      <div className="absolute inset-0 pointer-events-none vignette z-10" />

      {inGame && (
        <Hud
          hud={hud}
          onWeapon={(w: WeaponId) => eng()?.selectWeapon(w)}
          onMute={() => eng()?.toggleMute()}
          onCraft={() => eng()?.openCraft()}
          onHover={hover}
        />
      )}

      {banner && phase !== "intermission" && phase !== "craft" && <Banner banner={banner} />}

      {phase === "intermission" && (
        <UpgradeModal choices={choices} onPick={(i) => eng()?.chooseByIndex(i)} onHover={hover} />
      )}
      {phase === "craft" && (
        <CraftScreen
          res={hud.res}
          hpFrac={hud.maxHp > 0 ? hud.hp / hud.maxHp : 1}
          onCraft={(id) => eng()?.craft(id)}
          onClose={() => eng()?.closeCraft()}
          onHover={hover}
        />
      )}
      {phase === "menu" && <MenuScreen onStart={() => eng()?.newGame()} onHover={hover} />}
      {phase === "paused" && (
        <PauseScreen
          onResume={() => eng()?.resume()}
          onRestart={() => eng()?.newGame()}
          onMenu={() => eng()?.toMenu()}
          onHover={hover}
        />
      )}
      {phase === "gameover" && goStats && (
        <GameOverScreen
          stats={goStats}
          onRestart={() => eng()?.newGame()}
          onMenu={() => eng()?.toMenu()}
          onHover={hover}
        />
      )}
    </div>
  );
}
