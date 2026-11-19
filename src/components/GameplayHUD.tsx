import React, { useState } from 'react';
import {
  Map as MapIcon,
  Volume2,
  VolumeX,
  KeyRound,
  Cpu,
  SlidersHorizontal,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Award,
  Home,
  DoorOpen,
  Wind,
  Gamepad2,
} from 'lucide-react';
import { AudioSettings, InteractableTarget, NexusMessage, VaultId } from '../types/game';
import { VAULTS } from '../data/vaultData';

interface GameplayHUDProps {
  completedVaults: VaultId[];
  placedKeys: VaultId[];
  mainDoorOpen: boolean;
  isInModernWorld: boolean;
  fumeStatus: { ppm: number; smellCue: string | null };
  pointerLocked: boolean;
  touchControlsEnabled: boolean;
  modalOpen: boolean;
  hoverTarget: InteractableTarget | null;
  nexusMessage: NexusMessage | null;
  audioSettings: AudioSettings;
  onResumePointerLock: () => void;
  onToggleTouchControls: () => void;
  onOpenMap: () => void;
  onOpenReward: () => void;
  onAskNexusGuidance: () => void;
  onReplayIntro: () => void;
  onReturnToTitle: () => void;
  onUpdateAudio: (partial: Partial<AudioSettings>) => void;
  onInteractCurrent: () => void;
}

export const GameplayHUD: React.FC<GameplayHUDProps> = ({
  completedVaults,
  placedKeys,
  mainDoorOpen,
  isInModernWorld,
  fumeStatus,
  pointerLocked,
  touchControlsEnabled,
  modalOpen,
  hoverTarget,
  nexusMessage,
  audioSettings,
  onResumePointerLock,
  onToggleTouchControls,
  onOpenMap,
  onOpenReward,
  onAskNexusGuidance,
  onReplayIntro,
  onReturnToTitle,
  onUpdateAudio,
  onInteractCurrent,
}) => {
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);

  const nextVault = VAULTS.find((v) => !completedVaults.includes(v.id));
  const carriedUnplaced = completedVaults.filter((k) => !placedKeys.includes(k));
  const allCollected = completedVaults.length >= 5;

  const objectiveText = isInModernWorld
    ? 'Modernized World Plaza · Explore the city or press E at the Monument for Reward'
    : mainDoorOpen
      ? 'Main Gate Open · Walk straight through the North Main Door to the Modern World'
      : allCollected
        ? `Place remaining keys at the North Main Door (${placedKeys.length}/5 placed)`
        : carriedUnplaced.length > 0
          ? `Next: ${nextVault?.code} (${nextVault?.wing}) · Or place ${carriedUnplaced.length} key(s) at Main Door`
          : `Next Objective: ${nextVault?.code} — ${nextVault?.title} (${nextVault?.wing})`;

  const isLockedHorrorLab = !isInModernWorld && !mainDoorOpen;
  const highFumes = isLockedHorrorLab && fumeStatus.ppm >= 45;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none flex flex-col justify-between p-2.5 sm:p-4">
      {/* TOP BAR */}
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="flex flex-col gap-1.5 sm:gap-2 items-start min-w-0">
          <div className="pointer-events-auto bg-[#070d1a]/92 border border-slate-800 rounded-md px-2.5 py-1.5 sm:px-4 sm:py-2.5 flex flex-wrap items-center gap-x-2.5 sm:gap-x-4 gap-y-1">
            <span className="font-display text-xs sm:text-sm font-bold tracking-wider text-cyan-300 whitespace-nowrap">
              {isInModernWorld ? 'MODERN WORLD' : 'BIOQUEST · 2045'}
            </span>
            <span className="text-slate-600" aria-hidden="true">|</span>
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-mono-data">
              <KeyRound className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-white font-semibold whitespace-nowrap">
                <span className="hidden sm:inline">Carried: </span>{carriedUnplaced.length}
              </span>
            </div>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-mono-data">
              <DoorOpen className={`w-3.5 h-3.5 shrink-0 ${mainDoorOpen ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span className={`font-semibold whitespace-nowrap ${mainDoorOpen ? 'text-emerald-300' : 'text-slate-200'}`}>
                <span className="hidden sm:inline">Door: </span>{placedKeys.length}/5
              </span>
            </div>
            <span className="hidden lg:inline text-slate-600" aria-hidden="true">·</span>
            <span className="hidden lg:inline text-xs text-slate-300 truncate max-w-md">
              {objectiveText}
            </span>
          </div>

          {/* Olfactory / Volatile Chemical Leak Warning Strip */}
          {highFumes && fumeStatus.smellCue && !modalOpen && (
            <div className="bg-[#12170a]/95 border border-lime-500/45 rounded-md px-2.5 py-1.5 sm:px-3.5 sm:py-2 flex items-center gap-2 max-w-[260px] sm:max-w-xl">
              <Wind className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-lime-400 shrink-0" />
              <div className="text-[11px] sm:text-xs leading-snug">
                <span className="font-mono-data font-semibold text-lime-300 mr-1.5">
                  {fumeStatus.ppm} PPM
                </span>
                <span className="text-amber-100/90 hidden sm:inline">{fumeStatus.smellCue}</span>
                <span className="text-amber-100/90 sm:hidden">Toxic chemical leak nearby</span>
              </div>
            </div>
          )}
        </div>

        {/* Right HUD Controls */}
        <div className="pointer-events-auto relative flex items-center gap-1.5 sm:gap-2 shrink-0">
          {mainDoorOpen && (
            <button
              type="button"
              onClick={onOpenReward}
              className="flex items-center gap-1 px-2.5 py-2 sm:px-3 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors cursor-pointer whitespace-nowrap"
            >
              <Award className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reward</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenMap}
            className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3 text-xs font-medium text-slate-100 bg-[#070d1a]/92 border border-slate-700 hover:border-cyan-400 rounded transition-colors cursor-pointer whitespace-nowrap"
            aria-label="Open Mission Map"
          >
            <MapIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Map [M]</span>
            <span className="sm:hidden">Map</span>
          </button>
          <button
            type="button"
            onClick={onAskNexusGuidance}
            className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3 text-xs font-medium text-slate-100 bg-[#070d1a]/92 border border-slate-700 hover:border-cyan-400 rounded transition-colors cursor-pointer whitespace-nowrap"
            aria-label="Ask NEXUS Guidance"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">NEXUS [N]</span>
            <span className="md:hidden">AI</span>
          </button>
          <button
            type="button"
            onClick={onToggleTouchControls}
            className={`p-2 border rounded transition-colors cursor-pointer ${
              touchControlsEnabled
                ? 'text-cyan-300 bg-cyan-950/90 border-cyan-400/70'
                : 'text-slate-300 bg-[#070d1a]/92 border-slate-700 hover:border-cyan-400'
            }`}
            title={touchControlsEnabled ? 'Switch to Laptop Keyboard/Mouse Mode' : 'Enable Mobile Touch Controls'}
            aria-label={touchControlsEnabled ? 'Disable touch controls' : 'Enable touch controls'}
          >
            <Gamepad2 className="w-4 h-4" />
          </button>
          {touchControlsEnabled && (
            <button
              type="button"
              onClick={onReturnToTitle}
              className="p-2 text-slate-200 bg-[#070d1a]/92 border border-slate-700 hover:border-cyan-400 rounded transition-colors cursor-pointer"
              aria-label="Return to Main Menu"
            >
              <Home className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onUpdateAudio({ muted: !audioSettings.muted })}
            className="p-2 text-slate-200 bg-[#070d1a]/92 border border-slate-700 hover:border-cyan-400 rounded transition-colors cursor-pointer"
            aria-label={audioSettings.muted ? 'Unmute audio' : 'Mute audio'}
          >
            {audioSettings.muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>
          <button
            type="button"
            onClick={() => setShowAudioPanel((v) => !v)}
            className="hidden sm:inline-flex p-2 text-slate-200 bg-[#070d1a]/92 border border-slate-700 hover:border-cyan-400 rounded transition-colors cursor-pointer"
            aria-label="Audio mixer settings"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {showAudioPanel && (
            <div className="absolute right-0 top-12 w-64 bg-[#091120] border border-slate-700 rounded-lg p-4 shadow-2xl space-y-3 z-30">
              <p className="text-xs font-mono-data text-cyan-400">AUDIO CONTROLS</p>
              <label className="block text-xs text-slate-300">
                <div className="flex justify-between mb-1">
                  <span>Music & Ambience</span>
                  <span className="font-mono-data">{Math.round(audioSettings.musicVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={audioSettings.musicVolume}
                  onChange={(e) => onUpdateAudio({ musicVolume: Number(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </label>
              <label className="block text-xs text-slate-300">
                <div className="flex justify-between mb-1">
                  <span>Sound Effects</span>
                  <span className="font-mono-data">{Math.round(audioSettings.sfxVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={audioSettings.sfxVolume}
                  onChange={(e) => onUpdateAudio({ sfxVolume: Number(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between text-xs text-slate-300 pt-1 cursor-pointer">
                <span>NEXUS Voice Narration</span>
                <input
                  type="checkbox"
                  checked={audioSettings.voiceEnabled}
                  onChange={(e) => onUpdateAudio({ voiceEnabled: e.target.checked })}
                  className="accent-cyan-400 cursor-pointer"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* CENTER RETICLE & INTERACTION PROMPT */}
      {!modalOpen && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-2.5 h-2.5 rounded-full border transition-transform ${
                hoverTarget
                  ? 'border-cyan-300 bg-cyan-400/50 scale-125'
                  : 'border-white/70 bg-white/25'
              }`}
            />
            {hoverTarget && (
              <div className="mt-3 sm:mt-4 pointer-events-auto bg-[#070d1a]/95 border border-cyan-500/60 rounded-md px-3.5 py-2 sm:px-4 sm:py-2.5 text-center shadow-lg max-w-[84vw] sm:max-w-sm">
                <p className="text-xs font-mono-data text-cyan-300 font-semibold">
                  {hoverTarget.label}
                </p>
                <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">{hoverTarget.sublabel}</p>
                <button
                  type="button"
                  onClick={onInteractCurrent}
                  className="mt-2 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer"
                >
                  {touchControlsEnabled ? 'Tap to Interact' : 'Press [E] or Click to Interact'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAUSE / POINTER-UNLOCKED BAR (Desktop / Laptop only — hidden on touch controls mode) */}
      {!modalOpen && !pointerLocked && !touchControlsEnabled && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-auto max-w-[94vw]">
          <div className="bg-[#080f1e]/95 border border-cyan-500/45 rounded-lg px-4 py-2.5 sm:px-5 sm:py-3 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 shadow-xl">
            <span className="text-xs text-slate-300 text-center">
              Mouse unlocked — click viewport or press Resume for first-person look
            </span>
            <button
              type="button"
              onClick={onResumePointerLock}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume Controls</span>
            </button>
            <button
              type="button"
              onClick={onReplayIntro}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Replay Intro</span>
            </button>
            <button
              type="button"
              onClick={onReturnToTitle}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded transition-colors cursor-pointer whitespace-nowrap"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Main Menu</span>
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM UNIFIED DOCK: NEXUS Subtitle + Collapsible Laptop Controls Guide */}
      <div
        className={`flex flex-col items-center gap-2.5 w-full max-w-2xl mx-auto ${
          touchControlsEnabled ? 'mb-36 sm:mb-40 px-2' : ''
        }`}
      >
        {nexusMessage && !modalOpen && (
          <div className="w-full bg-[#071121]/95 border border-cyan-500/45 rounded-lg px-3.5 py-2.5 sm:px-5 sm:py-3">
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono-data text-cyan-400 mb-0.5 sm:mb-1">
              <Cpu className="w-3.5 h-3.5" />
              <span>NEXUS ASSISTANT</span>
            </div>
            <p className="text-xs sm:text-sm text-cyan-50 leading-relaxed">{nexusMessage.text}</p>
          </div>
        )}

        {!touchControlsEnabled && (
          <div className="pointer-events-auto flex flex-col items-center">
            <button
              type="button"
              onClick={() => setControlsCollapsed((c) => !c)}
              className="flex items-center gap-1 px-3 py-1 text-[11px] font-mono-data text-slate-400 bg-[#070d1a]/92 border border-slate-800 border-b-0 rounded-t hover:text-cyan-300 transition-colors cursor-pointer"
            >
              {controlsCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span>{controlsCollapsed ? 'Show Controls' : 'Hide Controls'}</span>
            </button>

            {!controlsCollapsed && (
              <div className="bg-[#070d1a]/92 border border-slate-800 rounded-md px-4 py-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-mono-data text-slate-300">
                <span>
                  <strong className="text-cyan-300">W A S D</strong> Move
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>
                  <strong className="text-cyan-300">Mouse</strong> Look
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>
                  <strong className="text-cyan-300">E</strong> Interact / Place Key
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>
                  <strong className="text-cyan-300">M</strong> Mission Map
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>
                  <strong className="text-cyan-300">ESC</strong> Release Mouse
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
