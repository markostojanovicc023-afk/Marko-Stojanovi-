/**
 * Ragdoll Archers - Authentic Crazy Games Remake
 * 
 * Features:
 * - Red Health Bar & Blue Stamina Bar
 * - Spacebar Jump to dodge incoming arrows
 * - Floating Apples (Red = HP, Green = Stamina, Gold = Full Restore + Skulls)
 * - Skulls Currency 💀 dropped by defeated enemies
 * - Upgrades Store (Health, Stamina, Damage, Draw Speed)
 * - Special Quiver Arrows (Standard, Electric, Poison, Explosive, Triple)
 * - Boss Stickman with Crown every 5 waves
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GameStats, UpgradesState } from './game/gameEngine';
import { ArrowType } from './game/arrow';
import { sounds } from './game/audio';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  HelpCircle,
  Pause,
  Play,
  Crosshair,
  Zap,
  Flame,
  Layers,
  ArrowUp,
  ShoppingBag,
  Heart,
  Activity,
  Sword,
  Gauge,
  X,
  Skull,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [stats, setStats] = useState<GameStats>({
    score: 0,
    wave: 1,
    skulls: 0,
    kills: 0,
    headshots: 0,
    playerHealth: 100,
    playerMaxHealth: 100,
    playerStamina: 100,
    playerMaxStamina: 100,
    isGameOver: false,
    isWaveCleared: false,
    selectedArrowType: 'standard',
    unlockedArrows: ['standard', 'electric', 'poison', 'explosive', 'triple'],
    upgrades: {
      healthLevel: 1,
      staminaLevel: 1,
      damageLevel: 1,
      drawSpeedLevel: 1,
    },
  });

  const [drawPower, setDrawPower] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showShop, setShowShop] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 1280;
    canvas.height = 720;

    const engine = new GameEngine(canvas);
    engineRef.current = engine;

    engine.onStatsUpdate = (newStats) => {
      setStats({ ...newStats });
    };

    let powerAnimId: number;
    const updatePower = () => {
      if (engineRef.current) {
        setDrawPower(engineRef.current.drawPower);
      }
      powerAnimId = requestAnimationFrame(updatePower);
    };
    powerAnimId = requestAnimationFrame(updatePower);

    return () => {
      cancelAnimationFrame(powerAnimId);
      engine.destroy();
    };
  }, []);

  // Keyboard controls listener (Space to jump, 1-5 for quiver, P to pause)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      if (e.key === '1') engine.setArrowType('standard');
      if (e.key === '2') engine.setArrowType('electric');
      if (e.key === '3') engine.setArrowType('poison');
      if (e.key === '4') engine.setArrowType('explosive');
      if (e.key === '5') engine.setArrowType('triple');

      if (e.key === ' ' || e.code === 'Space') {
        // Spacebar is Jump in Ragdoll Archers!
        e.preventDefault();
        engine.jumpPlayer();
      }

      if (e.key === 'ArrowUp') {
        engine.aimAngle = Math.max(-Math.PI / 2 + 0.1, engine.aimAngle - 0.05);
        engine.player?.updateAim(engine.aimAngle, engine.drawPower);
      }
      if (e.key === 'ArrowDown') {
        engine.aimAngle = Math.min(Math.PI / 4, engine.aimAngle + 0.05);
        engine.player?.updateAim(engine.aimAngle, engine.drawPower);
      }

      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        togglePause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!canvasRef.current || !engineRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    engineRef.current.handleMouseMove(e.clientX, e.clientY, rect);
    engineRef.current.handleMouseDown();
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !engineRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    engineRef.current.handleMouseMove(e.clientX, e.clientY, rect);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!engineRef.current) return;
    engineRef.current.handleMouseUp();
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sounds.enabled = next;
  };

  const togglePause = () => {
    setIsPaused((prev) => {
      const next = !prev;
      engineRef.current?.setPaused(next);
      return next;
    });
  };

  const handleRestart = () => {
    engineRef.current?.restartGame();
    setIsPaused(false);
  };

  const handleUpgrade = (stat: keyof UpgradesState) => {
    engineRef.current?.upgradeStat(stat);
  };

  const healthPct = Math.max(0, Math.min(100, (stats.playerHealth / stats.playerMaxHealth) * 100));
  const staminaPct = Math.max(0, Math.min(100, (stats.playerStamina / stats.playerMaxStamina) * 100));

  return (
    <div className="relative w-screen h-screen bg-[#07090e] flex flex-col items-center justify-center select-none overflow-hidden font-rajdhani">
      {/* Physics Canvas Viewport */}
      <div className="relative w-full h-full max-w-[1500px] max-h-[840px] flex items-center justify-center p-2">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="w-full h-full object-contain rounded-xl shadow-2xl border border-slate-800 bg-[#090d16] cursor-crosshair touch-none"
        />

        {/* HUD Top Bar: Authentic Ragdoll Archers Layout */}
        <div className="absolute top-4 left-6 right-6 flex items-center justify-between pointer-events-none">
          {/* Top-Left: Red Health Bar & Blue Stamina Bar + Jump Action */}
          <div className="flex items-center gap-3 bg-[#0d131f]/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-800 shadow-xl pointer-events-auto">
            <div className="flex flex-col gap-1.5 w-48">
              {/* Health Bar (Red) */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-red-400 mb-0.5">
                  <span className="flex items-center gap-1">
                    <Heart size={11} className="fill-red-500 text-red-500" /> HP
                  </span>
                  <span className="font-mono text-slate-300">{Math.round(stats.playerHealth)} / {stats.playerMaxHealth}</span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-150"
                    style={{ width: `${healthPct}%` }}
                  />
                </div>
              </div>

              {/* Stamina Bar (Blue) */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-sky-400 mb-0.5">
                  <span className="flex items-center gap-1">
                    <Activity size={11} /> STAMINA
                  </span>
                  <span className="font-mono text-slate-300">{Math.round(stats.playerStamina)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-600 to-cyan-400 transition-all duration-100"
                    style={{ width: `${staminaPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Jump Button (Spacebar) */}
            <button
              onClick={() => engineRef.current?.jumpPlayer()}
              className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 transition"
              title="Jump (Spacebar)"
            >
              <ArrowUp size={16} className="text-emerald-400" />
              <span className="text-[10px] font-bold font-mono tracking-wider">SPACE</span>
            </button>
          </div>

          {/* Top-Center: Wave Badge & Score */}
          <div className="flex flex-col items-center bg-[#0d131f]/90 backdrop-blur-md px-6 py-2 rounded-2xl border border-slate-800 shadow-xl">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold uppercase tracking-widest ${stats.wave % 5 === 0 ? 'text-purple-400 animate-pulse' : 'text-amber-400'}`}>
                {stats.wave % 5 === 0 ? '👑 BOSS WAVE' : `WAVE ${stats.wave}`}
              </span>
            </div>
            <div className="text-2xl font-black text-white tracking-tight">
              {stats.score.toLocaleString()} <span className="text-xs font-semibold text-slate-400">PTS</span>
            </div>
          </div>

          {/* Top-Right: Skulls Currency, Shop, & Menu */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Skulls Currency Display */}
            <div className="flex items-center gap-2 bg-[#0d131f]/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 shadow-lg text-slate-100">
              <span className="text-lg">💀</span>
              <span className="text-base font-extrabold font-mono text-amber-300">{stats.skulls}</span>
            </div>

            {/* Upgrades Store Button */}
            <button
              onClick={() => setShowShop(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-950/80 hover:bg-amber-900 active:scale-95 text-amber-300 border border-amber-600/50 text-xs font-bold transition shadow-lg"
              title="Upgrades Store"
            >
              <ShoppingBag size={16} />
              <span>SHOP</span>
            </button>

            <button
              onClick={togglePause}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition shadow-md"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button
              onClick={handleRestart}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition shadow-md"
              title="Restart Battle"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={toggleSound}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition shadow-md"
              title={soundEnabled ? 'Mute' : 'Unmute'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              onClick={() => setShowInstructions(true)}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition shadow-md"
              title="How to Play"
            >
              <HelpCircle size={16} />
            </button>
          </div>
        </div>

        {/* HUD Bottom Bar: Arrow Quiver Selector & Bow Draw Tension Meter */}
        <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between pointer-events-none">
          {/* Arrow Quiver Selector (1-5) */}
          <div className="bg-[#0d131f]/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-2 pointer-events-auto">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Quiver:</span>

            {/* Standard Wooden Arrow */}
            <button
              onClick={() => engineRef.current?.setArrowType('standard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                stats.selectedArrowType === 'standard'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/50 border border-emerald-400'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              <Crosshair size={13} />
              <span>Normal [1]</span>
            </button>

            {/* Electric Arrow */}
            <button
              onClick={() => engineRef.current?.setArrowType('electric')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                stats.selectedArrowType === 'electric'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-900/50 border border-sky-400'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              <Zap size={13} className="text-cyan-300" />
              <span>Electric [2]</span>
            </button>

            {/* Poison Arrow */}
            <button
              onClick={() => engineRef.current?.setArrowType('poison')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                stats.selectedArrowType === 'poison'
                  ? 'bg-green-600 text-white shadow-md shadow-green-900/50 border border-green-400'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              <span className="text-sm">🧪</span>
              <span>Poison [3]</span>
            </button>

            {/* Explosive Arrow */}
            <button
              onClick={() => engineRef.current?.setArrowType('explosive')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                stats.selectedArrowType === 'explosive'
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-900/50 border border-orange-400'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              <Flame size={13} className="text-amber-300" />
              <span>Bomb [4]</span>
            </button>

            {/* Triple Shot */}
            <button
              onClick={() => engineRef.current?.setArrowType('triple')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                stats.selectedArrowType === 'triple'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/50 border border-purple-400'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              <Layers size={13} />
              <span>Triple [5]</span>
            </button>
          </div>

          {/* Bow Power Meter */}
          <div className="bg-[#0d131f]/90 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-slate-800 shadow-xl flex flex-col items-center pointer-events-auto w-60">
            <div className="flex items-center justify-between w-full text-xs font-bold text-slate-300 mb-1">
              <span>Bowstring Tension</span>
              <span className="font-mono text-cyan-400">{Math.round(drawPower * 100)}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-amber-400 to-rose-500 transition-all duration-75"
                style={{ width: `${Math.round(drawPower * 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Hold Left Click to Draw, Release to Shoot
            </div>
          </div>
        </div>

        {/* Upgrades Store Modal */}
        {showShop && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-6 z-40">
            <div className="bg-[#0f172a] border border-amber-600/40 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative">
              <button
                onClick={() => setShowShop(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X size={20} />
              </button>

              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">💀</span>
                  <div>
                    <h3 className="text-xl font-bold text-white uppercase tracking-wider">Upgrades Store</h3>
                    <p className="text-xs text-slate-400">Spend Skulls earned in battle to boost your archer!</p>
                  </div>
                </div>
                <div className="px-3.5 py-1.5 bg-amber-950/60 border border-amber-500/40 rounded-xl text-amber-300 font-mono font-bold text-sm">
                  {stats.skulls} 💀
                </div>
              </div>

              <div className="space-y-3">
                {/* Max Health Upgrade */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-red-950 border border-red-600/40 flex items-center justify-center text-red-400">
                      <Heart size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Max Health (Lvl {stats.upgrades.healthLevel})</div>
                      <div className="text-xs text-slate-400">+25 Max HP per level</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUpgrade('healthLevel')}
                    disabled={stats.skulls < stats.upgrades.healthLevel * 10}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <span>{stats.upgrades.healthLevel * 10} 💀</span>
                  </button>
                </div>

                {/* Max Stamina Upgrade */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-sky-950 border border-sky-600/40 flex items-center justify-center text-sky-400">
                      <Activity size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Max Stamina (Lvl {stats.upgrades.staminaLevel})</div>
                      <div className="text-xs text-slate-400">+20 Max Energy for longer draws</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUpgrade('staminaLevel')}
                    disabled={stats.skulls < stats.upgrades.staminaLevel * 10}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <span>{stats.upgrades.staminaLevel * 10} 💀</span>
                  </button>
                </div>

                {/* Arrow Damage Upgrade */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-950 border border-amber-600/40 flex items-center justify-center text-amber-400">
                      <Sword size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Bow Damage (Lvl {stats.upgrades.damageLevel})</div>
                      <div className="text-xs text-slate-400">+25% kinetic damage on all arrows</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUpgrade('damageLevel')}
                    disabled={stats.skulls < stats.upgrades.damageLevel * 10}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <span>{stats.upgrades.damageLevel * 10} 💀</span>
                  </button>
                </div>

                {/* Draw Speed / Arrow Velocity Upgrade */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-950 border border-purple-600/40 flex items-center justify-center text-purple-400">
                      <Gauge size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Draw Speed (Lvl {stats.upgrades.drawSpeedLevel})</div>
                      <div className="text-xs text-slate-400">+15% faster bowstring draw & velocity</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUpgrade('drawSpeedLevel')}
                    disabled={stats.skulls < stats.upgrades.drawSpeedLevel * 10}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <span>{stats.upgrades.drawSpeedLevel * 10} 💀</span>
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowShop(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs tracking-wider transition"
              >
                Back to Battle
              </button>
            </div>
          </div>
        )}

        {/* Game Over Modal */}
        {stats.isGameOver && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-50">
            <div className="bg-[#0f172a] border border-red-500/50 rounded-2xl p-7 max-w-md w-full text-center shadow-2xl">
              <div className="w-16 h-16 bg-red-950 border border-red-600/40 rounded-full flex items-center justify-center mx-auto mb-3 text-red-500">
                <Skull size={32} />
              </div>
              <h2 className="text-3xl font-extrabold text-white tracking-wide mb-1">ARCHER DEFEATED</h2>
              <p className="text-slate-400 text-xs mb-5">
                Your ragdoll collapsed. You survived to <strong className="text-amber-400">Wave {stats.wave}</strong>!
              </p>

              <div className="grid grid-cols-3 gap-2.5 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 mb-5 text-center">
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Score</div>
                  <div className="text-lg font-bold text-white font-mono">{stats.score}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Kills</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono">{stats.kills}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Skulls</div>
                  <div className="text-lg font-bold text-amber-300 font-mono">{stats.skulls} 💀</div>
                </div>
              </div>

              <button
                onClick={handleRestart}
                className="w-full py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold tracking-wide shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                <span>Play Again</span>
              </button>
            </div>
          </div>
        )}

        {/* Instructions Modal */}
        {showInstructions && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative">
              <button
                onClick={() => setShowInstructions(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🏹</span>
                <div>
                  <h3 className="text-xl font-bold text-white">How to Play Ragdoll Archers</h3>
                  <p className="text-xs text-slate-400">Physics Archery Battle Rules</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <strong className="text-emerald-400">🎯 Aim & Shoot:</strong>
                  <p className="text-slate-400 mt-0.5">Move mouse to aim. Hold Left Mouse Button to draw bow power, release to fire arrow.</p>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <strong className="text-sky-400">⬆️ [SPACEBAR] Jump:</strong>
                  <p className="text-slate-400 mt-0.5">Press Spacebar to jump and leap over incoming enemy arrows.</p>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <strong className="text-amber-400">🍎 Floating Apples:</strong>
                  <p className="text-slate-400 mt-0.5">Shoot drifting apples in the sky! <strong>Red = Health (+HP)</strong>, <strong>Green = Stamina</strong>, <strong>Gold = Full Restore & Skulls</strong>!</p>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <strong className="text-purple-400">💀 Skulls & Upgrades:</strong>
                  <p className="text-slate-400 mt-0.5">Defeated enemies drop skulls. Spend skulls in the <strong>SHOP</strong> to upgrade Health, Stamina, and Damage!</p>
                </div>
              </div>

              <button
                onClick={() => setShowInstructions(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
              >
                Got It, Let's Play!
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
