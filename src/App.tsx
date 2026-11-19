import { useCallback, useEffect, useRef, useState } from 'react';
import { LabSceneEngine } from './game/LabSceneEngine';
import { soundEngine } from './audio/soundEngine';
import { getVaultById, VAULTS } from './data/vaultData';
import {
  AudioSettings,
  CinematicSceneId,
  GamePhase,
  InteractableTarget,
  NexusMessage,
  SavedProgress,
  VaultDefinition,
  VaultId,
} from './types/game';
import { CinematicOverlay } from './components/CinematicOverlay';
import { GameplayHUD } from './components/GameplayHUD';
import { VaultTerminalModal } from './components/VaultTerminalModal';
import { MissionMapModal } from './components/MissionMapModal';
import { CompletionRewardModal } from './components/CompletionRewardModal';
import { MobileTouchControls } from './components/MobileTouchControls';

function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}

const STORAGE_KEY = 'bioquest_blackout_protocol_v1';

const DEFAULT_PROGRESS: SavedProgress = {
  completedVaults: [],
  collectedKeys: [],
  placedKeys: [],
  mainDoorOpen: false,
  enteredModernWorld: false,
  facilityRestored: false,
  introSeen: false,
};

const NEXUS_CINEMATIC_LINES: Array<{ atSec: number; text: string }> = [
  { atSec: 25.1, text: 'Emergency protocol activated.' },
  { atSec: 27.3, text: 'Critical failure detected in the research facility.' },
  { atSec: 30.0, text: 'All external exits have been locked.' },
  { atSec: 32.3, text: 'Five research vaults remain secured.' },
  {
    atSec: 34.4,
    text: 'Your mission is to recover all five authentication keys, investigate the incident and restore the facility.',
  },
];

function loadSavedProgress(): SavedProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    const validVaults = Array.isArray(parsed.completedVaults)
      ? parsed.completedVaults.filter((v): v is VaultId => [1, 2, 3, 4, 5].includes(v))
      : [];
    const validPlaced = Array.isArray(parsed.placedKeys)
      ? parsed.placedKeys.filter((v): v is VaultId => validVaults.includes(v))
      : [];
    const mainDoorOpen = Boolean(parsed.mainDoorOpen) && validPlaced.length >= 5;
    return {
      completedVaults: validVaults,
      collectedKeys: validVaults,
      placedKeys: validPlaced,
      mainDoorOpen,
      enteredModernWorld: Boolean(parsed.enteredModernWorld) && mainDoorOpen,
      facilityRestored: Boolean(parsed.facilityRestored) || mainDoorOpen,
      introSeen: Boolean(parsed.introSeen),
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<LabSceneEngine | null>(null);

  const [progress, setProgress] = useState<SavedProgress>(() => loadSavedProgress());
  const [phase, setPhase] = useState<GamePhase>('cinematic');
  const [cinematicScene, setCinematicScene] = useState<CinematicSceneId>(1);
  const [cinematicTime, setCinematicTime] = useState(0);
  const [nexusSubtitle, setNexusSubtitle] = useState('');
  const [needsAutoplayTap, setNeedsAutoplayTap] = useState(false);
  const [fadeBlack, setFadeBlack] = useState(false);

  // Gameplay HUD & Modals
  const [pointerLocked, setPointerLocked] = useState(false);
  const [touchControlsEnabled, setTouchControlsEnabled] = useState<boolean>(() => detectTouchDevice());
  const [hoverTarget, setHoverTarget] = useState<InteractableTarget | null>(null);
  const [playerMapPos, setPlayerMapPos] = useState({ x: 0, z: 14.5 });
  const [activeVault, setActiveVault] = useState<VaultDefinition | null>(null);
  const [fumeStatus, setFumeStatus] = useState<{ ppm: number; smellCue: string | null }>({
    ppm: 0,
    smellCue: null,
  });
  const [showMap, setShowMap] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [nexusMessage, setNexusMessage] = useState<NexusMessage | null>(null);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => soundEngine.getSettings());

  const progressRef = useRef(progress);
  progressRef.current = progress;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const triggeredCuesRef = useRef<Set<string>>(new Set());
  const nexusTimerRef = useRef<number | null>(null);

  const isInModernWorld = progress.mainDoorOpen && playerMapPos.z < -21.5;

  // Persist progress & sync 3D facility state
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // ignore
    }
    engineRef.current?.syncProgress(
      progress.completedVaults,
      progress.placedKeys,
      progress.mainDoorOpen,
      progress.facilityRestored
    );
  }, [progress]);

  const announceNexus = useCallback((text: string, tone: 'info' | 'warning' | 'success' = 'info', durationMs = 8000) => {
    setNexusMessage({ id: Date.now(), text, tone });
    soundEngine.speakNexus(text);
    if (nexusTimerRef.current) window.clearTimeout(nexusTimerRef.current);
    nexusTimerRef.current = window.setTimeout(() => {
      setNexusMessage(null);
    }, durationMs);
  }, []);

  const handleEnterModernWorld = useCallback(() => {
    soundEngine.playVictoryFanfare();
    setProgress((prev) => ({ ...prev, enteredModernWorld: true, facilityRestored: true }));
    announceNexus(
      'Welcome to the Modernized World! You have unlocked the BioQuest Grand Gate, restored scientific integrity, and stepped into the future plaza. Walk up to the Celebration Monument or click Reward anytime.',
      'success',
      11000
    );
  }, [announceNexus]);

  const handleEnterModernWorldRef = useRef(handleEnterModernWorld);
  handleEnterModernWorldRef.current = handleEnterModernWorld;

  const handleInteract = useCallback(
    (target: InteractableTarget) => {
      soundEngine.unlock();
      const curr = progressRef.current;

      if (target.kind === 'vault' && target.vaultId) {
        const vault = getVaultById(target.vaultId);
        if (!vault) return;
        const highestUnlocked = Math.min(5, curr.completedVaults.length + 1);
        if (vault.id > highestUnlocked) {
          soundEngine.playIncorrect();
          announceNexus(
            `${vault.code} is currently sealed. Complete Vault 0${vault.id - 1} first to acquire its authentication key and unlock this chamber.`,
            'warning'
          );
          return;
        }
        soundEngine.playTerminalOpen();
        setActiveVault(vault);
        announceNexus(vault.nexusIntro, 'info', 9000);
      } else if (target.kind === 'nexus') {
        soundEngine.playHologramActivate();
        const unplaced = curr.completedVaults.filter((k) => !curr.placedKeys.includes(k));
        const nextVault = VAULTS.find((v) => !curr.completedVaults.includes(v.id));

        if (curr.mainDoorOpen) {
          announceNexus(
            'The Grand Main Door is wide open! Walk straight north through the gateway to explore the Modernized World.',
            'success'
          );
        } else if (curr.completedVaults.length >= 5) {
          announceNexus(
            `You hold all five keys! Walk north to the Grand Main Door pedestals and press E to place your keys and open the gate to the Modern World.`,
            'success'
          );
        } else if (unplaced.length > 0 && nextVault) {
          announceNexus(
            `You are carrying ${unplaced.length} unplaced key(s). You can place them at the North Main Door pedestals now, or continue to ${nextVault.code} (${nextVault.title}) in the ${nextVault.wing}.`,
            'info'
          );
        } else if (nextVault) {
          announceNexus(
            `You have ${curr.placedKeys.length} of 5 keys placed in the Main Door. Proceed to ${nextVault.code}, ${nextVault.title}, in the ${nextVault.wing}.`,
            'info'
          );
        }
      } else if (target.kind === 'exit') {
        // Grand Main Door key placement & opening logic!
        if (curr.mainDoorOpen) {
          announceNexus(
            'The Grand Main Door is open! Walk straight forward through the glowing archway into the Modernized World.',
            'success'
          );
          return;
        }

        const unplacedKeys = curr.completedVaults.filter((k) => !curr.placedKeys.includes(k));
        if (unplacedKeys.length > 0) {
          const nextPlaced = Array.from(new Set([...curr.placedKeys, ...unplacedKeys])).sort(
            (a, b) => a - b
          ) as VaultId[];
          const opensNow = nextPlaced.length >= 5;

          soundEngine.playKeyInsert();
          if (opensNow) {
            soundEngine.playVaultUnlock();
            soundEngine.playVictoryFanfare();
            engineRef.current?.triggerMainDoorFireworks();
            setProgress((prev) => ({
              ...prev,
              placedKeys: nextPlaced,
              mainDoorOpen: true,
              facilityRestored: true,
            }));
            announceNexus(
              'All five authentication keys are locked in! The Grand Main Door is opening! Walk straight ahead through the gate to enter the Modernized World!',
              'success',
              11000
            );
          } else {
            engineRef.current?.triggerLabFireworks(2);
            setProgress((prev) => ({
              ...prev,
              placedKeys: nextPlaced,
            }));
            announceNexus(
              `Placed ${unplacedKeys.length} authentication key${unplacedKeys.length > 1 ? 's' : ''} into the Main Door pedestals (${nextPlaced.length}/5 placed). Solve the remaining vaults to unlock the gateway to the Modern World.`,
              'success',
              8500
            );
          }
        } else if (curr.placedKeys.length >= 5) {
          soundEngine.playVaultUnlock();
          soundEngine.playVictoryFanfare();
          engineRef.current?.triggerMainDoorFireworks();
          setProgress((prev) => ({
            ...prev,
            mainDoorOpen: true,
            facilityRestored: true,
          }));
          announceNexus(
            'The Grand Main Door is opening! Walk forward into the Modernized World!',
            'success',
            10000
          );
        } else {
          soundEngine.playIncorrect();
          announceNexus(
            `Main Door locked (${curr.placedKeys.length}/5 keys placed). Solve the Research Vaults first to collect keys, then bring them here and press E to place them.`,
            'warning'
          );
        }
      } else if (target.kind === 'monument') {
        soundEngine.playTerminalOpen();
        setShowReward(true);
      }
    },
    [announceNexus]
  );

  const handleInteractRef = useRef(handleInteract);
  handleInteractRef.current = handleInteract;

  const handleCinematicTime = useCallback((t: number, sceneId: CinematicSceneId) => {
    setCinematicTime(t);
    setCinematicScene(sceneId);
    const cues = triggeredCuesRef.current;

    if (sceneId === 1 && !cues.has('s1-amb')) {
      cues.add('s1-amb');
      soundEngine.setAmbience('lab-calm');
    }
    if (sceneId === 2 && !cues.has('s2-alert')) {
      cues.add('s2-alert');
      soundEngine.setAmbience('alert-tension');
      soundEngine.playElectricalSpark();
      soundEngine.startEmergencyAlarm();
    }
    if (t >= 13.0 && !cues.has('s2-spark2')) {
      cues.add('s2-spark2');
      soundEngine.playElectricalSpark();
    }
    if (sceneId === 3 && !cues.has('s3-blackout')) {
      cues.add('s3-blackout');
      soundEngine.playPowerDown();
      soundEngine.playBlastDoorSlam();
    }
    if (t >= 19.5 && !cues.has('s3-spark')) {
      cues.add('s3-spark');
      soundEngine.playElectricalSpark();
    }
    if (sceneId === 4 && !cues.has('s4-nexus')) {
      cues.add('s4-nexus');
      soundEngine.stopEmergencyAlarm();
      soundEngine.setAmbience('gameplay-thriller');
      soundEngine.playHologramActivate();
    }

    for (let i = 0; i < NEXUS_CINEMATIC_LINES.length; i++) {
      const line = NEXUS_CINEMATIC_LINES[i];
      const cueKey = `nexus-line-${i}`;
      if (t >= line.atSec && !cues.has(cueKey)) {
        cues.add(cueKey);
        setNexusSubtitle(line.text);
        soundEngine.speakNexus(line.text);
      }
    }
  }, []);

  // Mount Three.js LabSceneEngine ONCE
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new LabSceneEngine(mount, {
      onCinematicTimeUpdate: (t, sceneId) => {
        handleCinematicTime(t, sceneId);
      },
      onCinematicComplete: () => {
        soundEngine.stopEmergencyAlarm();
        soundEngine.setAmbience('gameplay-thriller');
        setPhase('title');
        setProgress((prev) => ({ ...prev, introSeen: true }));
      },
      onPointerLockChange: (locked) => {
        setPointerLocked(locked);
      },
      onHoverTargetChange: (target) => {
        setHoverTarget(target);
      },
      onInteract: (target) => {
        handleInteractRef.current(target);
      },
      onPlayerPositionUpdate: (x, z) => {
        setPlayerMapPos({ x, z });
      },
      onEnterModernWorld: () => {
        handleEnterModernWorldRef.current();
      },
      onFireworkBurst: () => {
        soundEngine.playFireworkBurst();
      },
      onFumeLevelChange: (ppm, smellCue) => {
        setFumeStatus({ ppm, smellCue });
      },
      onChemicalHiss: () => {
        soundEngine.playChemicalHiss();
      },
      onAmbientCreak: () => {
        soundEngine.playDistantLabCreak();
      },
    });

    engineRef.current = engine;

    triggeredCuesRef.current.clear();
    engine.startCinematic();
    soundEngine.unlock().then((audioUnlocked) => {
      if (!audioUnlocked) {
        engine.pauseCinematic();
        setNeedsAutoplayTap(true);
      } else {
        setNeedsAutoplayTap(false);
        soundEngine.setAmbience('lab-calm');
      }
    });

    return () => {
      soundEngine.stopEmergencyAlarm();
      soundEngine.stopAmbience();
      soundEngine.stopSpeech();
      engine.dispose();
      engineRef.current = null;
    };
  }, [handleCinematicTime]);

  const anyModalOpen = Boolean(activeVault || showMap || showReward);
  useEffect(() => {
    if (phase === 'gameplay') {
      engineRef.current?.setPaused(anyModalOpen);
    }
  }, [anyModalOpen, phase]);

  // Global gameplay shortcuts: M (Map), N (NEXUS Guidance)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phaseRef.current !== 'gameplay') return;
      if (activeVault || showReward) return;

      if (e.code === 'KeyM') {
        e.preventDefault();
        soundEngine.playButtonClick();
        setShowMap((prev) => !prev);
      } else if (e.code === 'KeyN') {
        e.preventDefault();
        const curr = progressRef.current;
        const nextVault = VAULTS.find((v) => !curr.completedVaults.includes(v.id));
        if (curr.mainDoorOpen) {
          announceNexus(
            'The Grand Main Door is open! Walk north through the archway into the Modernized World plaza.',
            'success'
          );
        } else if (nextVault) {
          announceNexus(
            `Current objective: Locate ${nextVault.code} (${nextVault.title}) in the ${nextVault.wing}. After collecting keys, bring them to the North Main Door pedestals.`,
            'info'
          );
        } else {
          announceNexus(
            'All five keys are with you! Walk to the North Main Door pedestals and press E to place them and open the gate to the Modern World.',
            'success'
          );
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeVault, showReward, announceNexus]);

  const handleStartIntroWithAudio = async () => {
    await soundEngine.unlock();
    triggeredCuesRef.current.clear();
    setNeedsAutoplayTap(false);
    setNexusSubtitle('');
    soundEngine.setAmbience('lab-calm');
    engineRef.current?.startCinematic();
  };

  const handleSkipIntro = async () => {
    await soundEngine.unlock();
    soundEngine.playButtonClick();
    soundEngine.stopEmergencyAlarm();
    soundEngine.stopSpeech();
    soundEngine.setAmbience('gameplay-thriller');
    setNeedsAutoplayTap(false);
    engineRef.current?.jumpToTitleScene();
    setPhase('title');
    setProgress((prev) => ({ ...prev, introSeen: true }));
  };

  const handleReplayIntro = async () => {
    await soundEngine.unlock();
    soundEngine.playButtonClick();
    soundEngine.stopEmergencyAlarm();
    soundEngine.stopSpeech();
    setActiveVault(null);
    setShowMap(false);
    setShowReward(false);
    setNexusMessage(null);
    setNexusSubtitle('');
    setNeedsAutoplayTap(false);
    triggeredCuesRef.current.clear();
    setPhase('cinematic');
    setCinematicScene(1);
    setCinematicTime(0);
    engineRef.current?.startCinematic();
    soundEngine.setAmbience('lab-calm');
  };

  const handleStartGame = async () => {
    await soundEngine.unlock();
    soundEngine.playButtonClick();
    soundEngine.stopEmergencyAlarm();
    soundEngine.stopSpeech();

    setFadeBlack(true);
    window.setTimeout(() => {
      setPhase('gameplay');
      const curr = progressRef.current;
      engineRef.current?.enterGameplay(
        curr.completedVaults,
        curr.placedKeys,
        curr.mainDoorOpen,
        curr.facilityRestored
      );
      soundEngine.setAmbience(curr.mainDoorOpen || curr.facilityRestored ? 'victory' : 'gameplay-thriller');

      if (curr.completedVaults.length === 0) {
        setShowMap(true);
        announceNexus(
          'Welcome to the Grand BioQuest Research Complex. Solve all five vaults to carry their authentication keys, place them at the North Main Door pedestals, and open the gate to the Modernized World.',
          'info',
          10000
        );
      } else {
        announceNexus(
          `Welcome back, Researcher. ${curr.completedVaults.length} of 5 keys collected and ${curr.placedKeys.length} placed in the Main Door. Click the viewport to resume.`,
          'info',
          7500
        );
      }

      window.setTimeout(() => {
        setFadeBlack(false);
      }, 280);
    }, 420);
  };

  const handleCompleteVault = (vault: VaultDefinition) => {
    soundEngine.playKeyCollected();
    const alreadyDone = progressRef.current.completedVaults.includes(vault.id);
    if (!alreadyDone) {
      soundEngine.playVaultUnlock();
      setProgress((prev) => {
        const nextCompleted = [...prev.completedVaults, vault.id].sort((a, b) => a - b) as VaultId[];
        return {
          ...prev,
          completedVaults: nextCompleted,
          collectedKeys: nextCompleted,
        };
      });
    }
    // Launch celebratory bursting fireworks right inside the grand lab!
    engineRef.current?.triggerLabFireworks(vault.id === 5 ? 5 : 3);
    announceNexus(
      vault.id === 5
        ? 'Research Key 05 acquired! You now have all five keys! Bring them to the Grand Main Door at the North wall and press E to place them and open the gate to the Modern World!'
        : `${vault.nexusCompletion} You can carry this key with you or place it into the North Main Door pedestals anytime.`,
      'success',
      10000
    );
  };

  const handleUpdateAudio = (partial: Partial<AudioSettings>) => {
    soundEngine.unlock();
    soundEngine.updateSettings(partial);
    setAudioSettings(soundEngine.getSettings());
  };

  const handleToggleMute = () => {
    handleUpdateAudio({ muted: !audioSettings.muted });
  };

  const handleResetProgress = () => {
    soundEngine.playButtonClick();
    window.localStorage.removeItem(STORAGE_KEY);
    setProgress({ ...DEFAULT_PROGRESS, introSeen: true });
    setShowReward(false);
    setActiveVault(null);
    engineRef.current?.syncProgress([], [], false, false);
  };

  const handleNavigateToVault = (vaultId: VaultId) => {
    soundEngine.playDoorSlide();
    setShowMap(false);
    engineRef.current?.teleportNearVault(vaultId);
    const v = getVaultById(vaultId);
    if (v) {
      announceNexus(`Navigated to ${v.code} — ${v.title}. Press E at the terminal to access this vault.`, 'info', 5500);
    }
  };

  const handleNavigateToMainDoor = () => {
    soundEngine.playDoorSlide();
    setShowMap(false);
    engineRef.current?.teleportToMainDoor();
    const curr = progressRef.current;
    if (curr.mainDoorOpen) {
      announceNexus('You are at the open Grand Main Door. Walk straight ahead into the Modern World!', 'success', 6000);
    } else {
      announceNexus(
        `You are at the Grand Main Door Key Pedestals (${curr.placedKeys.length}/5 placed). Press E to place any keys you are carrying.`,
        'info',
        6500
      );
    }
  };

  const handleReturnToTitle = () => {
    soundEngine.playButtonClick();
    soundEngine.stopSpeech();
    setActiveVault(null);
    setShowMap(false);
    setShowReward(false);
    setNexusMessage(null);
    engineRef.current?.jumpToTitleScene();
    setPhase('title');
  };

  return (
    <main className="relative w-screen h-[100dvh] overflow-hidden bg-[#060911]">
      {/* Isolated stable WebGL 3D Viewport Container */}
      <div ref={canvasMountRef} className="fixed inset-0 w-full h-full z-0 touch-none" />

      {/* Smooth Cinematic-to-Gameplay Fade Curtain */}
      <div
        className={`fixed inset-0 z-50 bg-black pointer-events-none transition-opacity duration-500 ${
          fadeBlack ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Opening Cinematic & Scene 5 Title Reveal */}
      <CinematicOverlay
        phase={phase}
        sceneId={cinematicScene}
        cinematicTime={cinematicTime}
        nexusSubtitle={nexusSubtitle}
        needsAutoplayTap={needsAutoplayTap}
        audioSettings={audioSettings}
        hasSavedProgress={progress.completedVaults.length > 0}
        completedCount={progress.completedVaults.length}
        onStartIntroWithAudio={handleStartIntroWithAudio}
        onSkipIntro={handleSkipIntro}
        onStartGame={handleStartGame}
        onReplayIntro={handleReplayIntro}
        onResetProgress={handleResetProgress}
        onToggleMute={handleToggleMute}
      />

      {/* Interactive First-Person 3D Gameplay HUD */}
      {phase === 'gameplay' && (
        <GameplayHUD
          completedVaults={progress.completedVaults}
          placedKeys={progress.placedKeys}
          mainDoorOpen={progress.mainDoorOpen}
          isInModernWorld={isInModernWorld}
          fumeStatus={fumeStatus}
          pointerLocked={pointerLocked}
          touchControlsEnabled={touchControlsEnabled}
          modalOpen={anyModalOpen}
          hoverTarget={hoverTarget}
          nexusMessage={nexusMessage}
          audioSettings={audioSettings}
          onResumePointerLock={() => {
            soundEngine.unlock();
            engineRef.current?.requestPointerLock();
          }}
          onToggleTouchControls={() => {
            soundEngine.playButtonClick();
            setTouchControlsEnabled((prev) => {
              const next = !prev;
              if (!next) {
                engineRef.current?.setVirtualMove(0, 0);
              } else {
                engineRef.current?.releasePointerLock();
              }
              return next;
            });
          }}
          onOpenMap={() => {
            soundEngine.playButtonClick();
            setShowMap(true);
          }}
          onOpenReward={() => {
            soundEngine.playButtonClick();
            setShowReward(true);
          }}
          onAskNexusGuidance={() => {
            soundEngine.playHologramActivate();
            const nextVault = VAULTS.find((v) => !progress.completedVaults.includes(v.id));
            if (progress.mainDoorOpen) {
              announceNexus(
                'The Grand Main Door is open! Walk straight north through the gate to explore the Modernized World.',
                'success'
              );
            } else if (nextVault) {
              announceNexus(
                `You have ${progress.completedVaults.length} of 5 keys (${progress.placedKeys.length} placed in Main Door). Next vault: ${nextVault.code} (${nextVault.title}) in the ${nextVault.wing}.`,
                'info'
              );
            } else {
              announceNexus(
                'All five keys are collected! Bring them to the North Main Door pedestals and press E to place them and open the gate to the Modern World!',
                'success'
              );
            }
          }}
          onReplayIntro={handleReplayIntro}
          onReturnToTitle={handleReturnToTitle}
          onUpdateAudio={handleUpdateAudio}
          onInteractCurrent={() => {
            if (hoverTarget) handleInteract(hoverTarget);
          }}
        />
      )}

      {/* Mobile & Tablet Virtual Analog Joystick + Contextual Interact Thumb Pad */}
      {phase === 'gameplay' && touchControlsEnabled && !anyModalOpen && (
        <MobileTouchControls
          hoverTarget={hoverTarget}
          onMoveVector={(x, z) => {
            engineRef.current?.setVirtualMove(x, z);
          }}
          onInteract={() => {
            if (hoverTarget) handleInteract(hoverTarget);
          }}
        />
      )}

      {/* Five-Vault Mission Map Modal */}
      {phase === 'gameplay' && showMap && (
        <MissionMapModal
          completedVaults={progress.completedVaults}
          placedKeys={progress.placedKeys}
          mainDoorOpen={progress.mainDoorOpen}
          playerPos={playerMapPos}
          onClose={() => {
            soundEngine.playButtonClick();
            setShowMap(false);
          }}
          onNavigateToVault={handleNavigateToVault}
          onNavigateToMainDoor={handleNavigateToMainDoor}
        />
      )}

      {/* Vault Research Terminal Modal (Vaults 01–05) */}
      {phase === 'gameplay' && activeVault && (
        <VaultTerminalModal
          vault={activeVault}
          alreadyCompleted={progress.completedVaults.includes(activeVault.id)}
          onCompleteVault={handleCompleteVault}
          onClose={() => {
            soundEngine.playButtonClick();
            setActiveVault(null);
            // Fire an immediate celebratory burst inside the lab so the player sees it live when closing the terminal!
            if (progressRef.current.completedVaults.includes(activeVault.id)) {
              engineRef.current?.triggerLabFireworks(2);
            }
          }}
        />
      )}

      {/* Final 5-Key Completion & Subscription Discount Eligibility Modal */}
      {phase === 'gameplay' && showReward && (
        <CompletionRewardModal
          collectedKeys={progress.collectedKeys}
          onExploreRestored={() => {
            soundEngine.playButtonClick();
            setShowReward(false);
          }}
          onReplayIntro={handleReplayIntro}
          onResetProgress={handleResetProgress}
        />
      )}
    </main>
  );
}
