import React from 'react';
import { X, Lock, CheckCircle2, KeyRound, Zap, DoorOpen, Building2, MapPin } from 'lucide-react';
import { VAULTS } from '../data/vaultData';
import { VaultId } from '../types/game';

interface MissionMapModalProps {
  completedVaults: VaultId[];
  visitedVaults: VaultId[];
  placedKeys: VaultId[];
  mainDoorOpen: boolean;
  playerPos: { x: number; z: number };
  onClose: () => void;
  onNavigateToVault: (vaultId: VaultId) => void;
  onNavigateToMainDoor: () => void;
  onNavigateToFutureCity: () => void;
}

export const MissionMapModal: React.FC<MissionMapModalProps> = ({
  completedVaults,
  visitedVaults,
  placedKeys,
  mainDoorOpen,
  playerPos,
  onClose,
  onNavigateToVault,
  onNavigateToMainDoor,
  onNavigateToFutureCity,
}) => {
  const highestUnlocked = Math.min(5, completedVaults.length + 1) as VaultId;
  const visitedSet = new Set<VaultId>([...visitedVaults, ...completedVaults]);
  const visitedCount = visitedSet.size;

  // Map expanded 68m x 62m multi-level lab coords (x: -34..34, z: -21..41) to schematic %
  const clampedZ = Math.max(-28, Math.min(41, playerPos.z));
  const playerPctX = Math.max(8, Math.min(92, ((playerPos.x + 34) / 68) * 100));
  const playerPctY = Math.max(6, Math.min(92, ((clampedZ + 28) / 69) * 100));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-2.5 sm:p-4">
      <div className="max-w-4xl w-full max-h-[92dvh] bg-[#091120] border border-slate-700 rounded-lg overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-800 bg-[#0c1629] shrink-0 gap-3">
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-mono-data text-cyan-400 truncate">
              FIVE-VAULT MAP · {completedVaults.length}/5 CLEARED · {visitedCount}/5 VISITED · {placedKeys.length}/5 IN DOOR
            </p>
            <h2 className="font-display text-lg sm:text-xl font-bold text-white mt-0.5 truncate">
              Grand BioQuest Facility &amp; Main Gate
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Close mission map"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 p-4 sm:p-6 overflow-y-auto terminal-scroll flex-1">
          {/* Left 7 cols: Spatial Floorplan Schematic (Flex header + dedicated map stage + footer — Zero Overlap) */}
          <div className="md:col-span-7 bg-[#060b16] border border-slate-800 rounded-lg p-3 sm:p-4 flex flex-col gap-2.5 min-h-[340px] sm:min-h-[410px]">
            {/* Top Waypoints: Future City & Grand Main Door in normal flex flow */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onNavigateToFutureCity}
                className="w-full py-2 px-3 rounded border border-sky-400/60 bg-sky-950/60 hover:bg-sky-900/75 flex items-center justify-center gap-2 text-[10px] sm:text-xs font-mono-data text-sky-200 text-center cursor-pointer transition-colors"
              >
                <Building2 className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                <span>
                  {mainDoorOpen
                    ? 'FUTURE CITY METROPOLIS — CLICK TO EXPLORE'
                    : 'FUTURE CITY FREE-ROAM · CLICK TO VISIT'}
                </span>
              </button>

              <button
                type="button"
                onClick={onNavigateToMainDoor}
                className={`px-3 py-1.5 text-[11px] sm:text-xs font-mono-data tabular-nums border rounded transition-colors cursor-pointer whitespace-nowrap ${
                  mainDoorOpen
                    ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 hover:bg-emerald-900'
                    : 'bg-amber-950/85 border-amber-500/70 text-amber-200 hover:bg-amber-900'
                }`}
              >
                MAIN DOOR ({placedKeys.length}/5 KEYS) · CLICK TO GO
              </button>
            </div>

            {/* Dedicated Lab Map Area (Pins & live player marker never touch top buttons or footer) */}
            <div className="relative flex-1 min-h-[220px] sm:min-h-[260px] rounded border border-slate-800/80 bg-[#050912]">
              {/* Central NEXUS marker */}
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
                style={{ left: '50%', top: '54%' }}
              >
                <div className="w-8 h-8 rounded-full border border-cyan-400 bg-cyan-950/80 flex items-center justify-center mx-auto text-[10px] font-mono-data text-cyan-300">
                  AI
                </div>
                <span className="text-[11px] font-mono-data text-cyan-400 mt-1 block">NEXUS</span>
              </div>

              {/* Vault Pins */}
              {VAULTS.map((vault) => {
                const completed = completedVaults.includes(vault.id);
                const visited = visitedSet.has(vault.id);
                const unlocked = vault.id <= highestUnlocked;
                const coords: Record<VaultId, { left: string; top: string }> = {
                  1: { left: '17%', top: '80%' },
                  2: { left: '17%', top: '46%' },
                  3: { left: '34%', top: '18%' },
                  4: { left: '83%', top: '46%' },
                  5: { left: '83%', top: '80%' },
                };
                const pos = coords[vault.id];
                return (
                  <button
                    key={vault.id}
                    type="button"
                    disabled={!visited}
                    onClick={() => onNavigateToVault(vault.id)}
                    title={
                      visited
                        ? `Fast Travel to ${vault.code} (${vault.title})`
                        : unlocked
                          ? `Visit ${vault.code} in the ${vault.wing} to unlock Fast Travel`
                          : `Locked · Complete Vault 0${vault.id - 1}`
                    }
                    style={{ left: pos.left, top: pos.top }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded border text-left transition-colors ${
                      completed
                        ? 'bg-emerald-950/90 border-emerald-500/70 text-emerald-200 hover:bg-emerald-900 cursor-pointer'
                        : visited
                          ? 'bg-cyan-950/95 border-cyan-400 text-cyan-100 hover:bg-cyan-900 cursor-pointer'
                          : unlocked
                            ? 'bg-amber-950/60 border-amber-400/65 text-amber-200 cursor-default'
                            : 'bg-slate-900/90 border-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <div className="font-mono-data text-[10px] sm:text-[11px] font-semibold whitespace-nowrap flex items-center gap-1">
                      {visited && <Zap className="w-2.5 h-2.5 shrink-0" />}
                      <span>{vault.code}</span>
                    </div>
                    <div className="text-[9px] sm:text-[10px] opacity-85 whitespace-nowrap">
                      {completed ? 'Fast Travel' : visited ? 'Fast Travel' : unlocked ? 'Discover' : 'Locked'}
                    </div>
                  </button>
                );
              })}

              {/* Live Player Position Marker */}
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
                style={{ left: `${playerPctX}%`, top: `${playerPctY}%` }}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-slate-950 mx-auto" />
                <span className="text-[10px] font-mono-data text-amber-300 font-semibold block text-center mt-0.5">
                  YOU
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-[11px] font-mono-data text-slate-400 shrink-0">
              <span>Grand Multi-Level Lab (68m × 62m) · Year 2045</span>
              <span>Fast Travel unlocked for visited vaults ({visitedCount}/5)</span>
            </div>
          </div>

          {/* Right 5 cols: Sequential Mission List + Main Door */}
          <div className="md:col-span-5 flex flex-col justify-between space-y-2.5">
            <div className="space-y-2">
              {VAULTS.map((vault) => {
                const completed = completedVaults.includes(vault.id);
                const visited = visitedSet.has(vault.id);
                const placed = placedKeys.includes(vault.id);
                const unlocked = vault.id <= highestUnlocked;
                return (
                  <div
                    key={vault.id}
                    className={`p-2.5 rounded border flex items-center justify-between gap-2.5 ${
                      completed
                        ? 'bg-emerald-950/25 border-emerald-500/35'
                        : visited
                          ? 'bg-cyan-950/35 border-cyan-500/50'
                          : unlocked
                            ? 'bg-amber-950/20 border-amber-500/35'
                            : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs font-mono-data">
                        <span
                          className={
                            completed
                              ? 'text-emerald-400'
                              : visited
                                ? 'text-cyan-400'
                                : unlocked
                                  ? 'text-amber-300'
                                  : 'text-slate-500'
                          }
                        >
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
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">Key Placed in Main Door</span>
                          </>
                        ) : completed ? (
                          <>
                            <KeyRound className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                            <span className="truncate">Key Carried · {vault.wing}</span>
                          </>
                        ) : visited ? (
                          <>
                            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span className="truncate">Visited · {vault.wing}</span>
                          </>
                        ) : unlocked ? (
                          <>
                            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">Unvisited · Locate in {vault.wing}</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="truncate">Locked · Complete Vault 0{vault.id - 1}</span>
                          </>
                        )}
                      </p>
                    </div>
                    {visited && (
                      <button
                        type="button"
                        onClick={() => onNavigateToVault(vault.id)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                          completed
                            ? 'text-emerald-100 bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-500/60'
                            : 'text-slate-950 bg-cyan-400 hover:bg-cyan-300'
                        }`}
                        title={`Fast Travel to ${vault.code} (${vault.wing})`}
                      >
                        <Zap className="w-3.5 h-3.5 shrink-0" />
                        <span>Fast Travel</span>
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
                    {mainDoorOpen ? 'Open — Future City Gateway' : `Place All 5 Keys (${placedKeys.length}/5)`}
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

              {/* GTA Future City Metropolis Row */}
              <div className="p-2.5 rounded border bg-indigo-950/60 border-sky-400/50 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-mono-data text-sky-300">GTA FUTURE METROPOLIS · 2045</p>
                  <p className="text-sm font-semibold text-white truncate">
                    Cars, Cyber-Bikes, Lifts, Stairs &amp; Live TVs
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onNavigateToFutureCity}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded transition-colors shrink-0 cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Visit</span>
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
