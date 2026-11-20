import React from 'react';
import { Volume2, VolumeX, Play, FastForward, RotateCcw, ShieldAlert, Cpu, UserCheck } from 'lucide-react';
import { AudioSettings, CinematicSceneId, GamePhase } from '../types/game';

interface CinematicOverlayProps {
  phase: GamePhase;
  sceneId: CinematicSceneId;
  cinematicTime: number;
  nexusSubtitle: string;
  needsAutoplayTap: boolean;
  audioSettings: AudioSettings;
  hasSavedProgress: boolean;
  completedCount: number;
  evidenceCount: number;
  onStartIntroWithAudio: () => void;
  onSkipIntro: () => void;
  onStartGame: () => void;
  onReplayIntro: () => void;
  onResetProgress: () => void;
  onToggleMute: () => void;
}

const SCENE_LABELS: Record<CinematicSceneId, string> = {
  1: 'Scene 01 · Secret Research Activity',
  2: 'Scene 02 · Security Detection',
  3: 'Scene 03 · Emergency Lockdown',
  4: 'Scene 04 · Investigator Deployed',
  5: 'Third-Person Investigation Active',
};

const CINEMATIC_DURATION_SEC = 34.0;

export const CinematicOverlay: React.FC<CinematicOverlayProps> = ({
  phase,
  sceneId,
  cinematicTime,
  nexusSubtitle,
  needsAutoplayTap,
  audioSettings,
  hasSavedProgress,
  completedCount,
  evidenceCount,
  onStartIntroWithAudio,
  onSkipIntro,
  onStartGame,
  onReplayIntro,
  onResetProgress,
  onToggleMute,
}) => {
  if (phase === 'gameplay') return null;

  const progressPct = Math.min(100, (cinematicTime / CINEMATIC_DURATION_SEC) * 100);
  const transferStarted = sceneId === 1 && cinematicTime >= 4.4;

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none select-none">
      {/* Top Cinema Header Bar */}
      {phase === 'cinematic' && (
        <div className="h-12 bg-[#040916] border-b border-cyan-900/60 flex items-center justify-between px-3 sm:px-6 pointer-events-auto gap-2">
          <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-mono-data text-slate-300 min-w-0">
            <span className="text-cyan-400 font-semibold tracking-wider truncate">
              BIOQUEST RESEARCH CENTRE · 2045
            </span>
            <span className="hidden sm:inline text-slate-600" aria-hidden="true">|</span>
            <span className="hidden sm:inline truncate text-slate-200">{SCENE_LABELS[sceneId]}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleMute}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-700 hover:border-cyan-500/60 hover:text-cyan-300 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              aria-label={audioSettings.muted ? 'Unmute audio' : 'Mute audio'}
            >
              {audioSettings.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{audioSettings.muted ? 'Unmute' : 'Mute'}</span>
            </button>
            <button
              type="button"
              onClick={onSkipIntro}
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Skip to Gameplay</span>
            </button>
          </div>
        </div>
      )}

      {/* Center Stage Overlays — Positioned to keep 3D human actors unobstructed */}
      <div className="flex-1 relative flex items-center justify-center px-3 sm:px-6 overflow-y-auto py-4">
        {/* Autoplay blocked fallback prompt */}
        {phase === 'cinematic' && needsAutoplayTap && (
          <div className="pointer-events-auto max-w-md w-full bg-[#071022]/96 border border-cyan-500/50 rounded-lg p-7 text-center shadow-2xl animate-cinema-in">
            <p className="text-xs font-mono-data text-cyan-400 tracking-widest mb-2">
              BIOQUEST RESEARCH CENTRE · OPENING SEQUENCE
            </p>
            <h1 className="font-display text-3xl font-bold tracking-wide text-white mb-2">
              BIOQUEST
            </h1>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              Witness the unauthorized experimental drug data transfer that triggered NEXUS Emergency Lockdown, then take control of the Lead Scientific Investigator in third-person 3D.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onStartIntroWithAudio}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play Cinematic</span>
              </button>
              <button
                type="button"
                onClick={onSkipIntro}
                className="px-4 py-2.5 text-sm font-medium text-slate-200 bg-slate-900 border border-slate-700 hover:text-white hover:border-cyan-400/60 rounded transition-colors cursor-pointer whitespace-nowrap"
              >
                Enter Lab Now
              </button>
            </div>
          </div>
        )}

        {/* SCENE 1 — Secret Research Activity & Unauthorized Release Attempt */}
        {phase === 'cinematic' && !needsAutoplayTap && sceneId === 1 && (
          <div className="w-full h-full flex flex-col justify-end items-start p-2 sm:p-6 animate-cinema-in">
            <div
              className={`px-5 py-4 rounded border shadow-2xl max-w-lg ${
                transferStarted
                  ? 'bg-[#140a24]/94 border-amber-400/75'
                  : 'bg-[#060f22]/94 border-cyan-500/50'
              }`}
            >
              <p
                className={`font-mono-data text-xs tracking-widest ${
                  transferStarted ? 'text-amber-300' : 'text-cyan-400'
                }`}
              >
                {transferStarted
                  ? 'COMPOUND BQ-X9 · SAFETY VALIDATION INCOMPLETE'
                  : 'BIOQUEST RESEARCH CENTRE · SECURE LAB · 23:48'}
              </p>
              <p className="font-display text-lg sm:text-xl font-bold tracking-wide text-white mt-1">
                {transferStarted ? 'UNAUTHORIZED RELEASE ATTEMPT' : 'SECRET RESEARCH ACTIVITY'}
              </p>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                {transferStarted
                  ? 'The rogue researcher overrides authorization controls to export and publish unapproved experimental drug data externally.'
                  : 'A researcher secretly accesses restricted experimental drug files at a secure laboratory terminal after hours.'}
              </p>
            </div>
          </div>
        )}

        {/* SCENE 2 — Security Detection (Top banner so recoiling culprit & sparks stay visible) */}
        {phase === 'cinematic' && !needsAutoplayTap && sceneId === 2 && (
          <div className="w-full h-full flex flex-col justify-start items-center pt-2 sm:pt-4">
            <div className="max-w-2xl w-full bg-[#1a050a]/94 border border-red-500/85 rounded px-5 py-3.5 sm:px-6 sm:py-4 text-center animate-glitch shadow-2xl">
              <div className="flex items-center justify-center gap-2 text-red-400 mb-1.5">
                <ShieldAlert className="w-5 h-5" />
                <span className="font-mono-data text-xs tracking-widest">NEXUS AI SECURITY DETECTION</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-bold tracking-wider text-red-400">
                UNAUTHORIZED DRUG DATA TRANSFER DETECTED
              </h2>
              <p className="font-mono-data text-xs sm:text-sm tracking-widest text-amber-300 mt-1.5">
                SECURITY PROTOCOL VIOLATION · EXTERNAL UPLINK TERMINATED
              </p>
            </div>
          </div>
        )}

        {/* SCENE 3 — Emergency Lockdown + NEXUS Containment Announcement (Flex-spaced so top & bottom cards never collide) */}
        {phase === 'cinematic' && !needsAutoplayTap && sceneId === 3 && (
          <div className="w-full h-full flex flex-col justify-between items-center gap-3 py-2 sm:py-4">
            <div className="max-w-2xl w-full bg-[#16040a]/94 border border-red-600/80 rounded px-5 py-3.5 sm:px-6 sm:py-4 text-center animate-cinema-in shadow-2xl">
              <p className="font-mono-data text-xs tracking-[0.2em] text-red-400">
                NEXUS SECURITY CONTAINMENT PROTOCOL
              </p>
              <h2 className="font-display text-lg sm:text-2xl md:text-3xl font-bold tracking-wider text-white mt-1">
                BIOQUEST FACILITY — EMERGENCY LOCKDOWN
              </h2>
              <p className="font-mono-data text-[11px] sm:text-xs tracking-widest text-amber-300 mt-1">
                UNAUTHORIZED DRUG RELEASE PREVENTED · ALL RESEARCH CHAMBERS SEALED
              </p>
            </div>

            <div className="max-w-2xl w-full animate-cinema-in">
              <div className="bg-[#061124]/95 border border-cyan-400/65 rounded-lg px-4 py-3 sm:px-5 sm:py-4 shadow-2xl">
                <div className="flex items-center justify-between text-xs font-mono-data text-cyan-400 mb-1.5 gap-2">
                  <span className="flex items-center gap-2 font-semibold tracking-wider">
                    <Cpu className="w-4 h-4 shrink-0" />
                    NEXUS · FACILITY AI SECURITY
                  </span>
                  <span className="text-red-400 shrink-0">LOCKDOWN ACTIVE</span>
                </div>
                <p className="text-xs sm:text-sm md:text-base text-cyan-50 font-medium leading-relaxed min-h-[2.4rem]">
                  {nexusSubtitle || 'Emergency lockdown engaged. Preventing unauthorized drug publication...'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SCENE 4 — Player Introduction (Flex-spaced so badge & NEXUS card never overlap) */}
        {phase === 'cinematic' && !needsAutoplayTap && sceneId === 4 && (
          <div className="w-full h-full flex flex-col justify-between items-center gap-3 py-2 sm:py-4">
            <div className="self-start max-w-md w-full bg-[#061224]/94 border border-cyan-400/70 rounded px-4 py-3 sm:px-5 sm:py-3.5 animate-cinema-in shadow-2xl">
              <div className="flex items-center gap-2 text-cyan-300 mb-1">
                <UserCheck className="w-4 h-4 shrink-0" />
                <span className="font-mono-data text-xs tracking-widest">
                  INVESTIGATOR CLEARANCE VERIFIED
                </span>
              </div>
              <h2 className="font-display text-base sm:text-xl font-bold tracking-wide text-white">
                LEAD SCIENTIFIC INVESTIGATOR
              </h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Entering BioQuest Research Centre after lockdown to audit the breach and verify all experimental compounds.
              </p>
            </div>

            <div className="max-w-2xl w-full animate-cinema-in">
              <div className="bg-[#061124]/95 border border-cyan-400/65 rounded-lg px-4 py-3 sm:px-5 sm:py-4 shadow-2xl">
                <div className="flex items-center justify-between text-xs font-mono-data text-cyan-400 mb-1.5 gap-2">
                  <span className="flex items-center gap-2 font-semibold tracking-wider">
                    <Cpu className="w-4 h-4 shrink-0" />
                    NEXUS · MISSION ASSIGNMENT
                  </span>
                  <span className="text-emerald-400 shrink-0">HANDING CONTROL</span>
                </div>
                <p className="text-xs sm:text-sm md:text-base text-cyan-50 font-medium leading-relaxed min-h-[2.4rem]">
                  {nexusSubtitle || 'Opening South Airlock for Lead Scientific Investigator...'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PAUSE / MAIN MENU OVERLAY (Shown only when user opens Main Menu) */}
        {phase === 'title' && (
          <div className="pointer-events-auto max-w-2xl w-full max-h-[90dvh] overflow-y-auto terminal-scroll bg-[#071022]/95 border border-cyan-500/50 rounded-xl px-5 py-6 sm:px-8 sm:py-9 text-center shadow-2xl animate-cinema-in">
            <div className="flex justify-center mb-3" aria-hidden="true">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polygon points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5" stroke="#22d3ee" strokeWidth="2.4" fill="#06172d" />
                <polygon points="32,10 51,21 51,43 32,54 13,43 13,21" stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="1.2" fill="none" />
                <path d="M22 20 C32 24, 32 40, 42 44 M42 20 C32 24, 32 40, 22 44" stroke="#67e8f9" strokeWidth="2.4" strokeLinecap="round" />
                <line x1="25" y1="24" x2="39" y2="24" stroke="#a855f7" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="27" y1="32" x2="37" y2="32" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" />
                <line x1="25" y1="40" x2="39" y2="40" stroke="#a855f7" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="32" cy="32" r="3" fill="#22d3ee" />
              </svg>
            </div>
            <p className="font-mono-data text-[10px] sm:text-xs tracking-[0.18em] sm:tracking-[0.22em] text-cyan-400 mb-2">
              BIOQUEST RESEARCH CENTRE · 2045 · THIRD-PERSON 3D SCIENCE INVESTIGATION
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-wider text-white mb-1.5">
              BIOQUEST
            </h1>
            <p className="font-display text-sm sm:text-lg font-semibold tracking-[0.16em] text-purple-300 mb-4">
              SCIENTIFIC INTEGRITY INVESTIGATION
            </p>
            <p className="text-xs sm:text-sm md:text-base text-slate-300 max-w-lg mx-auto leading-relaxed mb-4">
              Explore the BioQuest Research Centre in third-person 3D as the Lead Investigator. Inspect breach evidence, validate all five scientific vaults with NEXUS, lift the lockdown gate, and step out into the Future City.
            </p>
            <p className="font-mono-data text-[11px] text-cyan-300/90 mb-5 tracking-wide">
              WASD Move · Shift Run · Space Jump · E Interact · M Map
            </p>

            {(hasSavedProgress || evidenceCount > 0) && (
              <p className="text-xs font-mono-data text-emerald-400 mb-5">
                Active Case · {completedCount}/5 Research Vaults Verified · {evidenceCount}/3 Breach Clues Logged
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onStartGame}
                className="flex items-center gap-2 px-7 py-3 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{hasSavedProgress || evidenceCount > 0 ? 'Resume Investigation' : 'Enter Facility'}</span>
              </button>
              <button
                type="button"
                onClick={onReplayIntro}
                className="flex items-center gap-2 px-5 py-3 text-sm font-medium text-slate-200 bg-slate-900 border border-slate-700 hover:border-cyan-500/60 hover:text-cyan-200 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Replay Intro Story</span>
              </button>
              <button
                type="button"
                onClick={onToggleMute}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-200 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                {audioSettings.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>{audioSettings.muted ? 'Unmute' : 'Mute'}</span>
              </button>
            </div>

            {(hasSavedProgress || evidenceCount > 0) && (
              <div className="mt-6 pt-5 border-t border-slate-800/90">
                <button
                  type="button"
                  onClick={onResetProgress}
                  className="text-xs text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                >
                  Reset saved investigation progress
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Cinematic Progress Bar */}
      {phase === 'cinematic' && (
        <div className="h-10 bg-[#040916] border-t border-cyan-900/60 px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-6">
          <span className="text-xs font-mono-data text-slate-400 whitespace-nowrap">
            {needsAutoplayTap ? 'Awaiting playback' : 'Opening Story Sequence'}
          </span>
          <div className="flex-1 h-1 bg-slate-800 rounded overflow-hidden max-w-2xl">
            <div
              className={`h-full transition-all duration-150 ${
                sceneId === 2 || sceneId === 3 ? 'bg-red-500' : 'bg-cyan-400'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs font-mono-data text-slate-400 whitespace-nowrap">
            {Math.min(34, Math.floor(cinematicTime)).toString().padStart(2, '0')}s / 34s
          </span>
        </div>
      )}
    </div>
  );
};
