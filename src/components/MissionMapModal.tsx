import React from 'react';
import { X, Lock, CheckCircle2, KeyRound, Navigation, DoorOpen, Biohazard } from 'lucide-react';
import { FAILED_EXPERIMENTS, VAULTS } from '../data/vaultData';
import { VaultId } from '../types/game';

interface MissionMapModalProps {
  completedVaults: VaultId[];
  placedKeys: VaultId[];
  resolvedExperiments: string[];
  mainDoorOpen: boolean;
  playerPos: { x: number; z: number };
  onClose: () => void;
  onNavigateToVault: (vaultId: VaultId) => void;
  onNavigateToMainDoor: () => void;
  onNavigateToExperiment: (experimentId: string) => void;
}

export const MissionMapModal: React.FC<MissionMapModalProps> = ({
  completedVaults,
  placedKeys,
  resolvedExperiments,
  mainDoorOpen,
  playerPos,
  onClose,
  onNavigateToVault,
  onNavigateToMainDoor,
  onNavigateToExperiment,
}) => {
  const highestUnlocked = Math.min(5, completedVaults.length + 1) as VaultId;

  // Map expanded lab coords (-22..22, -21..21) to schematic %
  const clampedZ = Math.max(-28, Math.min(21, playerPos.z));
  const playerPctX = Math.max(8, Math.min(92, ((playerPos.x + 22) / 44) * 100));
  const playerPctY = Math.max(6, Math.min(92, ((clampedZ + 28) / 49) * 100));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
      <div className="max-w-4xl w-full bg-[#091120] border border-slate-700 rounded-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0c1629]">
          <div>
            <p className="text-xs font-mono-data text-cyan-400">
              FIVE-VAULT MISSION MAP · {completedVaults.length}/5 KEYS COLLECTED · {placedKeys.length}/5 PLACED IN MAIN DOOR
            </p>
            <h2 className="font-display text-xl font-bold text-white mt-0.5">
              Grand BioQuest Research Facility &amp; Modern World Gate
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close mission map"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6">
          {/* Left 7 cols: Spatial Floorplan Schematic */}
          <div className="md:col-span-7 bg-[#060b16] border border-slate-800 rounded-lg p-4 relative min-h-[380px]">
            {/* Modern World Zone strip at top */}
            <div className="absolute top-2 left-4 right-4 h-12 rounded border border-sky-500/35 bg-sky-950/35 flex items-center justify-center text-xs font-mono-data text-sky-300">
              {mainDoorOpen
                ? 'MODERNIZED WORLD PLAZA — GATE OPEN (WALK NORTH)'
                : 'MODERNIZED WORLD BEYOND MAIN DOOR (LOCKED)'}
            </div>

            {/* Grand Main Door clickable waypoint */}
            <button
              type="button"
              onClick={onNavigateToMainDoor}
              className={`absolute top-16 left-1/2 -translate-x-1/2 px-3 py-1.5 text-xs font-mono-data border rounded transition-colors cursor-pointer whitespace-nowrap ${
                mainDoorOpen
                  ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 hover:bg-emerald-900'
                  : 'bg-amber-950/85 border-amber-500/70 text-amber-200 hover:bg-amber-900'
              }`}
            >
              MAIN DOOR ({placedKeys.length}/5 KEYS) · CLICK TO GO
            </button>

            {/* Central NEXUS marker */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
              style={{ left: '50%', top: '60%' }}
            >
              <div className="w-8 h-8 rounded-full border border-cyan-400 bg-cyan-950/80 flex items-center justify-center mx-auto text-[10px] font-mono-data text-cyan-300">
                AI
              </div>
              <span className="text-[11px] font-mono-data text-cyan-400 mt-1 block">NEXUS</span>
            </div>

            {/* Vault Pins */}
            {VAULTS.map((vault) => {
              const completed = completedVaults.includes(vault.id);
              const unlocked = vault.id <= highestUnlocked;
              const coords: Record<VaultId, { left: string; top: string }> = {
                1: { left: '15%', top: '76%' },
                2: { left: '15%', top: '44%' },
                3: { left: '25%', top: '26%' },
                4: { left: '85%', top: '44%' },
                5: { left: '85%', top: '76%' },
              };
              const pos = coords[vault.id];
              return (
                <button
                  key={vault.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => onNavigateToVault(vault.id)}
                  style={{ left: pos.left, top: pos.top }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded border text-left transition-colors ${
                    completed
                      ? 'bg-emerald-950/90 border-emerald-500/70 text-emerald-200 hover:bg-emerald-900 cursor-pointer'
                      : unlocked
                        ? 'bg-cyan-950/90 border-cyan-400 text-cyan-100 hover:bg-cyan-900 cursor-pointer'
                        : 'bg-slate-900/90 border-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <div className="font-mono-data text-[11px] font-semibold whitespace-nowrap">
                    {vault.code}
                  </div>
                  <div className="text-[10px] opacity-80 whitespace-nowrap">
                    {completed ? 'Cleared' : unlocked ? 'Active' : 'Locked'}
                  </div>
                </button>
              );
            })}

            {/* Failed Experiment Containment Pods (Chemical Leak Biohazard Zones) */}
            {FAILED_EXPERIMENTS.map((exp) => {
              const resolved = resolvedExperiments.includes(exp.id);
              const podCoords: Record<string, { left: string; top: string }> = {
                'exp-herg-toxicity': { left: '24%', top: '60%' },
                'exp-assay-noise': { left: '76%', top: '60%' },
                'exp-mutation-escape': { left: '28%', top: '36%' },
                'exp-trial-collapse': { left: '73%', top: '35%' },
              };
              const pos = podCoords[exp.id];
              if (!pos) return null;
              return (
                <button
                  key={exp.id}
                  type="button"
                  onClick={() => onNavigateToExperiment(exp.id)}
                  style={{ left: pos.left, top: pos.top }}
                  title={`${exp.podCode} — ${exp.title}`}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded border text-[10px] font-mono-data flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                    resolved
                      ? 'bg-emerald-950/85 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900'
                      : 'bg-[#1a1f0b]/95 border-lime-500/70 text-lime-300 hover:bg-lime-950'
                  }`}
                >
                  <Biohazard className="w-3 h-3 shrink-0" />
                  <span>{exp.podCode.replace('POD ', '')}</span>
                </button>
              );
            })}

            {/* Live Player Position Marker */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${playerPctX}%`, top: `${playerPctY}%` }}
            >
              <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-slate-950" />
              <span className="text-[10px] font-mono-data text-amber-300 font-semibold block -ml-2 mt-0.5">
                YOU
              </span>
            </div>

            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono-data text-slate-400">
              <span>Grand Lab (44m × 42m) · {resolvedExperiments.length}/4 Leak Audits</span>
              <span>Click Vault, Pod, or Door to go</span>
            </div>
          </div>

          {/* Right 5 cols: Sequential Mission List + Main Door */}
          <div className="md:col-span-5 flex flex-col justify-between space-y-2.5">
            <div className="space-y-2">
              {VAULTS.map((vault) => {
                const completed = completedVaults.includes(vault.id);
                const placed = placedKeys.includes(vault.id);
                const unlocked = vault.id <= highestUnlocked;
                return (
                  <div
                    key={vault.id}
                    className={`p-2.5 rounded border flex items-center justify-between gap-3 ${
                      completed
                        ? 'bg-emerald-950/25 border-emerald-500/35'
                        : unlocked
                          ? 'bg-cyan-950/30 border-cyan-500/45'
                          : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs font-mono-data">
                        <span className={completed ? 'text-emerald-400' : unlocked ? 'text-cyan-400' : 'text-slate-500'}>
                          {vault.code}
                        </span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-slate-400">{vault.difficulty}</span>
                      </div>
                      <p className={`text-sm font-semibold truncate ${unlocked ? 'text-white' : 'text-slate-500'}`}>
                        {vault.title}
                      </p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        {placed ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Key Placed in Main Door</span>
                          </>
                        ) : completed ? (
                          <>
                            <KeyRound className="w-3.5 h-3.5 text-cyan-300" />
                            <span>Key Carried — Place at Main Door</span>
                          </>
                        ) : unlocked ? (
                          <>
                            <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Available · {vault.wing}</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5 text-slate-500" />
                            <span>Locked · Complete Vault 0{vault.id - 1}</span>
                          </>
                        )}
                      </p>
                    </div>
                    {unlocked && (
                      <button
                        type="button"
                        onClick={() => onNavigateToVault(vault.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-cyan-200 bg-slate-800 hover:bg-cyan-900 border border-slate-700 hover:border-cyan-500/60 rounded transition-colors shrink-0 cursor-pointer"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Go</span>
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Grand Main Door Row */}
              <div className="p-2.5 rounded border bg-slate-900/90 border-amber-500/45 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-mono-data text-amber-300">GRAND MAIN DOOR</p>
                  <p className="text-sm font-semibold text-white truncate">
                    {mainDoorOpen ? 'Open — Modern World Gateway' : `Place All 5 Keys (${placedKeys.length}/5)`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onNavigateToMainDoor}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors shrink-0 cursor-pointer"
                >
                  <DoorOpen className="w-3.5 h-3.5" />
                  <span>Go</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer"
            >
              Close Map
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
