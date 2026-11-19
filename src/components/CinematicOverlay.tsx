import React from 'react';
import { Volume2, VolumeX, Play, FastForward, RotateCcw, ShieldAlert, Cpu } from 'lucide-react';
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
  onStartIntroWithAudio: () => void;
  onSkipIntro: () => void;
  onStartGame: () => void;
  onReplayIntro: () => void;
  onResetProgress: () => void;
  onToggleMute: () => void;
}

const SCENE_LABELS: Record<CinematicSceneId, string> = {
  1: 'Scene 01 · Research Facility',
  2: 'Scene 02 · System Anomaly',
  3: 'Scene 03 · The Blackout',
  4: 'Scene 04 · NEXUS Activation',
  5: 'Scene 05 · Title Reveal',
};

export const CinematicOverlay: React.FC<CinematicOverlayProps> = ({
  phase,
  sceneId,
  cinematicTime,
  nexusSubtitle,
  needsAutoplayTap,
  audioSettings,
  hasSavedProgress,
  completedCount,
  onStartIntroWithAudio,
  onSkipIntro,
  onStartGame,
  onReplayIntro,
  onResetProgress,
  onToggleMute,
}) => {
  if (phase === 'gameplay') return null;

  const progressPct = Math.min(100, (cinematicTime / 37.5) * 100);

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none select-none">
      {/* Subtle letterbox bars strictly during cinematic playback */}
      {phase === 'cinematic' && (
        <>
          <div className="h-12 bg-[#03060c] border-b border-slate-800/80 flex items-center justify-between px-3 sm:px-6 pointer-events-auto gap-2">
            <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-mono-data text-slate-400 min-w-0">
              <span className="text-cyan-400 font-semibold tracking-wider truncate">BIOQUEST FEED</span>
              <span className="hidden sm:inline" aria-hidden="true">·</span>
              <span className="hidden sm:inline truncate">{SCENE_LABELS[sceneId]}</span>
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
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-cyan-200 bg-cyan-950/80 border border-cyan-500/40 hover:bg-cyan-900/80 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Skip</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Center Stage Overlays */}
      <div className="flex-1 relative flex items-center justify-center px-3 sm:px-6 overflow-y-auto py-4">
        {/* Autoplay blocked fallback prompt */}
        {phase === 'cinematic' && needsAutoplayTap && (
          <div className="pointer-events-auto max-w-md w-full bg-[#080e1c]/95 border border-cyan-500/40 rounded-lg p-7 text-center shadow-2xl animate-cinema-in">
            <p className="text-xs font-mono-data text-cyan-400 tracking-widest mb-2">
              OPENING CINEMATIC READY
            </p>
            <h1 className="font-display text-3xl font-bold tracking-wide text-white mb-2">
              BIOQUEST
            </h1>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              The Blackout Protocol opens with a full audio-visual incident sequence. Press below to launch with sound and NEXUS voice narration.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onStartIntroWithAudio}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play Intro</span>
              </button>
              <button
                type="button"
                onClick={onSkipIntro}
                className="px-4 py-2.5 text-sm font-medium text-slate-300 bg-slate-900 border border-slate-700 hover:text-white hover:border-slate-500 rounded transition-colors cursor-pointer whitespace-nowrap"
              >
                Skip Intro
              </button>
            </div>
          </div>
        )}

        {/* SCENE 1 — Timestamp & Facility Establishing Text */}
        {phase === 'cinematic' && !needsAutoplayTap && sceneId === 1 && (
          <div className="absolute left-8 bottom-14 md:left-14 md:bottom-16 animate-cinema-in">
            <div className="bg-[#05070c]/92 border border-red-900/55 px-6 py-4 rounded shadow-2xl">
              <p className="font-mono-data text-xl md:text-2xl font-semibold tracking-widest text-cyan-300">
                DECEMBER 2045
              </p>
              <p className="font-mono-data text-base md:text-lg text-slate-200 tracking-wider mt-0.5">
                11:48 PM
              </p>
              <p className="text-xs text-slate-400 mt-2">
                BioQuest Molecular Containment Facility · Deep-Night Shift
              </p>
            </div>
          </div>
        )}

        {/* SCENE 2 — Critical System Failure Warning */}
        {phase === 'cinematic' && !needsAutoplayTap && sceneId === 2 && (
          <div className="max-w-xl w-full bg-[#1a070b]/92 border border-red-500/70 rounded px-7 py-6 text-center animate-glitch">
            <div className="flex items-center justify-center gap-2 text-red-400 mb-2">
              <ShieldAlert className="w-5 h-5" />
              <span className="font-mono-data text-xs tracking-widest">SECURITY ALERT · SECTOR ALL</span>
            </div>
            <h2 className="font-display text-2xl md:text-4xl font-bold tracking-wider text-red-400">
              CRITICAL SYSTEM FAILURE
            </h2>
            <p className="font-mono-data text-sm md:text-base tracking-widest text-red-200 mt-2">
              UNAUTHORIZED ACCESS DETECTED
            </p>
            <p className="text-xs font-mono-data text-red-300/80 mt-3">
              BIOACTIVITY ARCHIVE CORRUPTION · SMILES PARSER FAULT · POWER SURGE
            </p>
          </div>
        )}

        {/* SCENE 3 — The Blackout Lockdown Banner */}
        {phase === 'cinematic' && !needsAutoplayTap && sceneId === 3 && (
          <div className="max-w-xl w-full bg-[#140508]/95 border border-red-600/80 rounded px-7 py-6 text-center animate-cinema-in">
            <p className="font-mono-data text-xs tracking-widest text-red-400 mb-2">
              CONTAINMENT SHUTTERS ENGAGED · MAIN POWER OFFLINE
            </p>
            <h2 className="font-display text-2xl md:text-4xl font-bold tracking-wider text-white">
              FACILITY LOCKDOWN ACTIVATED
            </h2>
            <p className="font-display text-lg md:text-2xl font-semibold tracking-widest text-red-500 mt-2">
              ACCESS DENIED
            </p>
          </div>
        )}

        {/* SCENE 4 — NEXUS Activation Subtitles */}
        {phase === 'cinematic' && !needsAutoplayTap && sceneId === 4 && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 max-w-2xl w-[92%] animate-cinema-in">
            <div className="bg-[#061121]/95 border border-cyan-400/50 rounded-lg px-6 py-5">
              <div className="flex items-center justify-between text-xs font-mono-data text-cyan-400 mb-2">
                <span className="flex items-center gap-2 font-semibold tracking-wider">
                  <Cpu className="w-4 h-4" />
                  NEXUS · FACILITY AI ASSISTANT
                </span>
                <span className="text-slate-400">HOLOGRAPHIC UPLINK ACTIVE</span>
              </div>
              <p className="text-base md:text-lg text-cyan-50 font-medium leading-relaxed min-h-[3.2rem]">
                {nexusSubtitle || 'Initializing holographic interface...'}
              </p>
            </div>
          </div>
        )}

        {/* SCENE 5 — TITLE REVEAL SCREEN */}
        {phase === 'title' && (
          <div className="pointer-events-auto max-w-2xl w-full max-h-[90dvh] overflow-y-auto terminal-scroll bg-[#05070d]/92 border border-red-900/50 rounded-xl px-5 py-6 sm:px-8 sm:py-10 text-center shadow-2xl animate-cinema-in">
            <p className="font-mono-data text-[10px] sm:text-xs tracking-[0.18em] sm:tracking-[0.22em] text-red-400 mb-2.5 sm:mb-3">
              DECEMBER 2045 · BIOTECH HORROR THRILLER · FIVE RESEARCH VAULTS
            </p>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-wider text-white mb-1.5 sm:mb-2">
              BIOQUEST
            </h1>
            <p className="font-display text-base sm:text-lg md:text-2xl font-semibold tracking-[0.16em] sm:tracking-[0.2em] text-cyan-300 mb-4 sm:mb-5">
              THE BLACKOUT PROTOCOL
            </p>
            <p className="text-xs sm:text-sm md:text-base text-slate-300 max-w-lg mx-auto leading-relaxed mb-6 sm:mb-8">
              Trapped inside a dark, leaking containment facility in 2045, navigate toxic corridors with NEXUS and unlock all five secured research vaults to escape.
            </p>

            {hasSavedProgress && (
              <p className="text-xs font-mono-data text-emerald-400 mb-5">
                Saved Progress Detected · {completedCount} of 5 Authentication Keys Recovered
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onStartGame}
                className="flex items-center gap-2 px-7 py-3 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{hasSavedProgress ? 'Resume Investigation' : 'Start Game'}</span>
              </button>
              <button
                type="button"
                onClick={onReplayIntro}
                className="flex items-center gap-2 px-5 py-3 text-sm font-medium text-slate-200 bg-slate-900 border border-slate-700 hover:border-cyan-500/60 hover:text-cyan-200 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Replay Intro</span>
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

            {hasSavedProgress && (
              <div className="mt-6 pt-5 border-t border-slate-800/90">
                <button
                  type="button"
                  onClick={onResetProgress}
                  className="text-xs text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                >
                  Reset saved demo progress
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Cinematic Progress Bar */}
      {phase === 'cinematic' && (
        <div className="h-10 bg-[#03060c] border-t border-slate-800/80 px-6 flex items-center justify-between gap-6">
          <span className="text-xs font-mono-data text-slate-400 whitespace-nowrap">
            {needsAutoplayTap ? 'Awaiting playback' : 'Opening Sequence'}
          </span>
          <div className="flex-1 h-1 bg-slate-800 rounded overflow-hidden max-w-2xl">
            <div
              className="h-full bg-cyan-400 transition-all duration-150"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs font-mono-data text-slate-400 whitespace-nowrap">
            {Math.min(38, Math.floor(cinematicTime)).toString().padStart(2, '0')}s / 38s
          </span>
        </div>
      )}
    </div>
  );
};
