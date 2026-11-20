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
  Gamepad2,
  Gauge,
  Building2,
  FileSearch,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { AudioSettings, InteractableTarget, NexusMessage, VaultId, VehicleHudState } from '../types/game';
import { VAULTS } from '../data/vaultData';

interface GameplayHUDProps {
  completedVaults: VaultId[];
  placedKeys: VaultId[];
  collectedEvidence: string[];
  mainDoorOpen: boolean;
  isInModernWorld: boolean;
  activeInteriorVault: VaultId | null;
  vehicleHud: VehicleHudState;
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
  onQuickVisitCity: () => void;
  onRestartGame: () => void;
  onExitVaultChamber: () => void;
}

export const GameplayHUD: React.FC<GameplayHUDProps> = ({
  completedVaults,
  placedKeys,
  collectedEvidence,
  mainDoorOpen,
  isInModernWorld,
  activeInteriorVault,
  vehicleHud,
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
  onQuickVisitCity,
  onRestartGame,
  onExitVaultChamber,
}) => {
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);

  const nextVault = VAULTS.find((v) => !completedVaults.includes(v.id));
  const currentChamberDef =
    activeInteriorVault !== null ? VAULTS.find((v) => v.id === activeInteriorVault) ?? null : null;
  const currentChamberCleared =
    activeInteriorVault !== null && completedVaults.includes(activeInteriorVault);
  const carriedUnplaced = completedVaults.filter((k) => !placedKeys.includes(k));
  const allCollected = completedVaults.length >= 5;

  const objectiveText = currentChamberDef
    ? currentChamberCleared
      ? `Inside ${currentChamberDef.code} (Secured) · Walk back to the doorway (auto-opens) or click Exit Vault`
      : `Inside ${currentChamberDef.code} · Ahead: Challenges [E] · Left: Concept Guide · Right: Incident Log · Behind: Auto-Exit`
    : isInModernWorld
      ? 'Future Metropolis · Drive Cars & Bikes · Ride Glass Lifts · Climb Stairs · Tune Live TVs'
      : mainDoorOpen
        ? 'Lockdown Lifted · Walk north toward the Grand Security Gate (opens automatically)'
        : allCollected
          ? `Insert remaining authentication keys at North Gate Pedestals (${placedKeys.length}/5)`
          : carriedUnplaced.length > 0
            ? `Objective: Walk into ${nextVault?.code} (${nextVault?.title}) · Or insert ${carriedUnplaced.length} key(s) at North Gate`
            : `Objective: Walk into ${nextVault?.code} — ${nextVault?.title} (${nextVault?.wing})`;

  const nexusBorderClass =
    nexusMessage?.tone === 'warning'
      ? 'border-amber-400/70'
      : nexusMessage?.tone === 'success'
        ? 'border-emerald-400/70'
        : 'border-cyan-400/60';

  const nexusHeaderClass =
    nexusMessage?.tone === 'warning'
      ? 'text-amber-300'
      : nexusMessage?.tone === 'success'
        ? 'text-emerald-300'
        : 'text-cyan-400';

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none flex flex-col justify-between p-2.5 sm:p-4">
      {/* TOP SCIENTIFIC HUD SECTION (Flex Flow — Zero Overlap with Camera Bar or Directive) */}
      <div className="flex flex-col gap-2 w-full">
        <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
          <div className="flex flex-col gap-1.5 items-start min-w-0 max-w-full">
            {/* Primary Facility Telemetry Strip */}
            <div className="pointer-events-auto bg-[#060d1c]/95 border border-cyan-900/70 rounded-md px-2.5 py-1.5 sm:px-4 sm:py-2 flex flex-wrap items-center gap-x-2.5 sm:gap-x-3.5 gap-y-1 shadow-lg">
              <span
                className={`font-display text-xs sm:text-sm font-bold tracking-wider whitespace-nowrap ${
                  currentChamberDef
                    ? currentChamberCleared
                      ? 'text-cyan-300'
                      : 'text-amber-300'
                    : 'text-cyan-300'
                }`}
              >
                {currentChamberDef
                  ? `${currentChamberDef.code} · CHAMBER`
                  : isInModernWorld
                    ? 'FUTURE CITY · 2045'
                    : 'BIOQUEST · 2045'}
              </span>
              <span className="text-slate-700" aria-hidden="true">|</span>

              {/* Emergency / Facility Status */}
              <div className="flex items-center gap-1 text-[11px] sm:text-xs font-mono-data whitespace-nowrap">
                {mainDoorOpen || isInModernWorld ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-300 font-semibold">
                      {isInModernWorld ? 'METROPOLIS' : 'CLEARED'}
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="text-red-300 font-semibold">LOCKDOWN</span>
                  </>
                )}
              </div>

              <span className="text-slate-700" aria-hidden="true">·</span>

              {/* Missions Progress */}
              <div className="flex items-center gap-1 text-[11px] sm:text-xs font-mono-data tabular-nums whitespace-nowrap">
                <KeyRound className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-white font-semibold">
                  <span className="hidden sm:inline">Missions: </span>
                  {completedVaults.length}/5
                </span>
              </div>

              <span className="text-slate-700" aria-hidden="true">·</span>

              {/* Investigation Evidence Clues */}
              <div className="flex items-center gap-1 text-[11px] sm:text-xs font-mono-data tabular-nums whitespace-nowrap">
                <FileSearch className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="text-purple-200 font-semibold">
                  <span className="hidden sm:inline">Evidence: </span>
                  {collectedEvidence.length}/3
                </span>
              </div>

              <span className="text-slate-700" aria-hidden="true">·</span>

              {/* Grand Security Gate Keys */}
              <div className="flex items-center gap-1 text-[11px] sm:text-xs font-mono-data tabular-nums whitespace-nowrap">
                <DoorOpen className={`w-3.5 h-3.5 shrink-0 ${mainDoorOpen ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span className={`font-semibold ${mainDoorOpen ? 'text-emerald-300' : 'text-slate-200'}`}>
                  <span className="hidden sm:inline">Gate: </span>
                  {placedKeys.length}/5
                </span>
              </div>
            </div>

            {/* Concise Live Objective Strip */}
            {!modalOpen && (
              <div className="hidden md:flex items-center gap-2 bg-[#060d1c]/90 border border-slate-800 rounded px-3 py-1 max-w-xl">
                <span className="font-mono-data text-[10px] tracking-wider text-cyan-400 uppercase shrink-0">
                  DIRECTIVE
                </span>
                <span className="text-xs text-slate-200 truncate">{objectiveText}</span>
              </div>
            )}
          </div>

          {/* Right HUD Controls */}
          <div className="pointer-events-auto relative flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          {currentChamberDef && (
            <button
              type="button"
              onClick={onExitVaultChamber}
              className="flex items-center gap-1 px-2.5 py-2 sm:px-3 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors cursor-pointer whitespace-nowrap"
              title={`Exit ${currentChamberDef.code} Chamber to Main Facility`}
            >
              <DoorOpen className="w-3.5 h-3.5" />
              <span>Exit Vault</span>
            </button>
          )}
          <button
            type="button"
            onClick={onQuickVisitCity}
            className="flex items-center gap-1 px-2.5 py-2 sm:px-3 text-xs font-semibold text-sky-100 bg-indigo-950/95 border border-sky-400/55 hover:bg-indigo-900 rounded transition-colors cursor-pointer whitespace-nowrap"
            title={isInModernWorld ? 'Return to BioQuest Research Centre' : 'Visit Future City Free-Roam'}
          >
            <Building2 className="w-3.5 h-3.5 text-sky-300" />
            <span className="hidden sm:inline">{isInModernWorld ? 'Lab' : 'Future City'}</span>
          </button>
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
          {(mainDoorOpen || completedVaults.length >= 5) && (
            <button
              type="button"
              onClick={onRestartGame}
              className="flex items-center gap-1 px-2.5 py-2 sm:px-3 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer whitespace-nowrap"
              title="Restart BioQuest Game From Beginning"
              aria-label="Restart Game"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restart Game</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenMap}
            className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3 text-xs font-medium text-slate-100 bg-[#060d1c]/95 border border-slate-700 hover:border-cyan-400 rounded transition-colors cursor-pointer whitespace-nowrap"
            aria-label="Open Mission Map"
          >
            <MapIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Map [M]</span>
            <span className="sm:hidden">Map</span>
          </button>
          <button
            type="button"
            onClick={onAskNexusGuidance}
            className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3 text-xs font-medium text-slate-100 bg-[#060d1c]/95 border border-slate-700 hover:border-cyan-400 rounded transition-colors cursor-pointer whitespace-nowrap"
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
                ? 'text-cyan-300 bg-cyan-950/95 border-cyan-400/70'
                : 'text-slate-300 bg-[#060d1c]/95 border-slate-700 hover:border-cyan-400'
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
              className="p-2 text-slate-200 bg-[#060d1c]/95 border border-slate-700 hover:border-cyan-400 rounded transition-colors cursor-pointer"
              aria-label="Return to Main Menu"
            >
              <Home className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onUpdateAudio({ muted: !audioSettings.muted })}
            className="p-2 text-slate-200 bg-[#060d1c]/95 border border-slate-700 hover:border-cyan-400 rounded transition-colors cursor-pointer"
            aria-label={audioSettings.muted ? 'Unmute audio' : 'Mute audio'}
          >
            {audioSettings.muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>
          <button
            type="button"
            onClick={() => setShowAudioPanel((v) => !v)}
            className="hidden sm:inline-flex p-2 text-slate-200 bg-[#060d1c]/95 border border-slate-700 hover:border-cyan-400 rounded transition-colors cursor-pointer"
            aria-label="Audio mixer settings"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {showAudioPanel && (
            <div className="absolute right-0 top-12 w-64 bg-[#071022] border border-slate-700 rounded-lg p-4 shadow-2xl space-y-3 z-30">
              <p className="text-xs font-mono-data text-cyan-400">AUDIO CONTROLS</p>
              <label className="block text-xs text-slate-300">
                <div className="flex justify-between mb-1">
                  <span>Music &amp; Ambience</span>
                  <span className="font-mono-data tabular-nums">{Math.round(audioSettings.musicVolume * 100)}%</span>
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
                  <span className="font-mono-data tabular-nums">{Math.round(audioSettings.sfxVolume * 100)}%</span>
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

        {/* COMPACT CAMERA / MENU BAR (In-flow directly below Top HUD — Never overlaps Directive or Telemetry) */}
        {!modalOpen && !pointerLocked && !touchControlsEnabled && (
          <div className="self-center pointer-events-auto max-w-[94vw]">
            <div className="bg-[#060e1e]/94 border border-cyan-500/40 rounded-md px-3.5 py-1.5 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 shadow-xl">
              <span className="text-[11px] sm:text-xs text-slate-300">
                Click or drag viewport to orbit camera
              </span>
              <button
                type="button"
                onClick={onResumePointerLock}
                className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Lock Mouse</span>
              </button>
              <button
                type="button"
                onClick={onReplayIntro}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-700 hover:border-cyan-500/60 rounded transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Replay Intro</span>
              </button>
              <button
                type="button"
                onClick={onReturnToTitle}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded transition-colors cursor-pointer whitespace-nowrap"
              >
                <Home className="w-3 h-3" />
                <span>Menu</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SUBTLE THIRD-PERSON RETICLE (Never obscures investigator) */}
      {!modalOpen && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
          <div
            className={`w-2 h-2 rounded-full border transition-transform ${
              hoverTarget
                ? 'border-cyan-300 bg-cyan-400/60 scale-125'
                : 'border-white/55 bg-white/15'
            }`}
          />
        </div>
      )}

      {/* BOTTOM UNIFIED DOCK: Interaction Prompt + Vehicle Speedometer + NEXUS AI Communication + Controls (Zero Overlap) */}
      <div
        className={`flex flex-col items-center gap-2 w-full max-w-3xl mx-auto ${
          touchControlsEnabled ? 'mb-44 sm:mb-48 px-1' : ''
        }`}
      >
        {!modalOpen && hoverTarget && (
          <div className="pointer-events-auto max-w-[90vw] sm:max-w-lg">
            <div className="bg-[#060f20]/96 border border-cyan-400/75 rounded-md px-3.5 py-2 sm:px-4 sm:py-2.5 flex items-center gap-3 sm:gap-3.5 shadow-xl">
              <div className="min-w-0">
                <p className="text-xs font-mono-data text-cyan-300 font-semibold truncate">
                  {hoverTarget.label}
                </p>
                <p className="text-[11px] text-slate-300 truncate mt-0.5">{hoverTarget.sublabel}</p>
              </div>
              <button
                type="button"
                onClick={onInteractCurrent}
                className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {touchControlsEnabled ? 'Interact' : '[E] Interact'}
              </button>
            </div>
          </div>
        )}

        {vehicleHud.active && !modalOpen && (
          <div className="bg-[#060f22]/96 border border-cyan-400/65 rounded-lg px-4 py-2.5 flex items-center gap-4 shadow-xl">
            <Gauge className={`w-5 h-5 ${vehicleHud.boosting ? 'text-amber-400' : 'text-cyan-400'}`} />
            <div>
              <p className="text-[11px] font-mono-data text-cyan-300 uppercase tracking-wider">
                {vehicleHud.name}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-white tabular-nums">{vehicleHud.speedKmh}</span>
                <span className="text-xs font-mono-data text-slate-400">KM/H</span>
                {vehicleHud.boosting && (
                  <span className="text-[11px] font-mono-data font-bold text-amber-300 ml-1">TURBO</span>
                )}
              </div>
            </div>
            <div className="hidden sm:block border-l border-slate-700 pl-3 text-[11px] font-mono-data text-slate-300">
              <div><strong className="text-cyan-300">W/S</strong> Drive · <strong className="text-cyan-300">A/D</strong> Steer</div>
              <div><strong className="text-amber-300">SHIFT</strong> Boost · <strong className="text-cyan-300">SPACE</strong> Drift · <strong className="text-rose-300">E/F</strong> Exit</div>
            </div>
          </div>
        )}

        {nexusMessage && !modalOpen && (
          <div className={`w-full max-w-2xl bg-[#061022]/96 border ${nexusBorderClass} rounded-lg px-3.5 py-2.5 sm:px-5 sm:py-3 shadow-xl`}>
            <div className={`flex items-center gap-2 text-[10px] sm:text-[11px] font-mono-data ${nexusHeaderClass} mb-0.5 sm:mb-1`}>
              <Cpu className="w-3.5 h-3.5" />
              <span>NEXUS AI · INVESTIGATION CHANNEL</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-100 leading-relaxed">{nexusMessage.text}</p>
          </div>
        )}

        {!touchControlsEnabled && (
          <div className="pointer-events-auto flex flex-col items-center">
            <button
              type="button"
              onClick={() => setControlsCollapsed((c) => !c)}
              className="flex items-center gap-1 px-3 py-1 text-[11px] font-mono-data text-slate-400 bg-[#060d1c]/94 border border-slate-800 border-b-0 rounded-t hover:text-cyan-300 transition-colors cursor-pointer"
            >
              {controlsCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span>{controlsCollapsed ? 'Show Controls' : 'Hide Controls'}</span>
            </button>

            {!controlsCollapsed && (
              <div className="bg-[#060d1c]/94 border border-slate-800 rounded-md px-4 py-1.5 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 text-xs font-mono-data text-slate-300">
                <span>
                  <strong className="text-cyan-300">W A S D</strong> Move
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>
                  <strong className="text-cyan-300">SHIFT</strong> {vehicleHud.active ? 'Boost' : 'Run'}
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>
                  <strong className="text-cyan-300">SPACE</strong> {vehicleHud.active ? 'Drift' : 'Jump'}
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>
                  <strong className="text-cyan-300">Mouse</strong> Orbit
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>
                  <strong className="text-cyan-300">E</strong> {vehicleHud.active ? 'Exit' : 'Interact'}
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>
                  <strong className="text-cyan-300">M</strong> Map
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>
                  <strong className="text-cyan-300">N</strong> NEXUS
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
