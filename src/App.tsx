import { useCallback, useEffect, useRef, useState } from 'react';
import { LabSceneEngine } from './game/LabSceneEngine';
import { getVaultAmbienceMode, soundEngine } from './audio/soundEngine';
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
  VaultStationTab,
  VehicleHudState,
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
  visitedVaults: [],
  collectedKeys: [],
  placedKeys: [],
  collectedEvidence: [],
  mainDoorOpen: false,
  enteredModernWorld: false,
  facilityRestored: false,
  introSeen: false,
};

const VALID_EVIDENCE_IDS = ['evidence-terminal', 'evidence-storage', 'evidence-nexus-log'] as const;

const EVIDENCE_REPORTS: Record<string, { title: string; report: string }> = {
  'evidence-terminal': {
    title: 'Breach Workstation Audit',
    report:
      'Evidence Logged (Breach Terminal): The rogue researcher attempted to export unvalidated Compound BQ-X9 at 23:48 using a forged authorization override. NEXUS severed the external uplink at 78% before publication.',
  },
  'evidence-storage': {
    title: 'Cryo-Storage Inventory Verification',
    report:
      'Evidence Logged (Drug Cryo-Storage): Physical audit confirmed — all 14 cryo-vials of experimental Compound BQ-X9 remain sealed inside containment. This was strictly an unauthorized digital data release attempt, not a physical leak.',
  },
  'evidence-nexus-log': {
    title: 'NEXUS Security Intercept Trace',
    report:
      'Evidence Logged (AI Monitoring Console): NEXUS intercept records show tampered bioactivity (IC50), SMILES, Lipinski, and XGBoost validation records across Vaults 01 through 05. Independent scientific verification is required.',
  },
};

// Synchronized with LabSceneEngine 34-second 4-Scene Cinematic:
// Scene 3 (16.5–24.5s): Emergency Lockdown · Scene 4 (24.5–34.0s): Investigator Introduction
const NEXUS_CINEMATIC_LINES: Array<{ atSec: number; text: string }> = [
  {
    atSec: 17.0,
    text: 'Security breach confirmed. Unauthorized experimental drug data transfer has been blocked before publication.',
  },
  {
    atSec: 20.8,
    text: 'BioQuest Facility is now under Emergency Lockdown. All five research vaults have been sealed.',
  },
  {
    atSec: 25.0,
    text: 'South Airlock opened for Lead Scientific Investigator. Identity and clearance verified.',
  },
  {
    atSec: 29.0,
    text: 'Your assignment: inspect the breach evidence, validate all five research vaults, and restore facility authorization.',
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
    const rawVisited = Array.isArray(parsed.visitedVaults)
      ? parsed.visitedVaults.filter((v): v is VaultId => [1, 2, 3, 4, 5].includes(v))
      : [];
    const validVisited = Array.from(new Set([...rawVisited, ...validVaults])).sort((a, b) => a - b) as VaultId[];
    const validPlaced = Array.isArray(parsed.placedKeys)
      ? parsed.placedKeys.filter((v): v is VaultId => validVaults.includes(v))
      : [];
    const validEvidence = Array.isArray(parsed.collectedEvidence)
      ? parsed.collectedEvidence.filter((e): e is string =>
          (VALID_EVIDENCE_IDS as readonly string[]).includes(e)
        )
      : [];
    const mainDoorOpen = Boolean(parsed.mainDoorOpen) && validPlaced.length >= 5;
    return {
      completedVaults: validVaults,
      visitedVaults: validVisited,
      collectedKeys: validVaults,
      placedKeys: validPlaced,
      collectedEvidence: validEvidence,
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
  const [playerMapPos, setPlayerMapPos] = useState({ x: 0, z: 13.2 });
  const [activeVault, setActiveVault] = useState<VaultDefinition | null>(null);
  const [activeVaultTab, setActiveVaultTab] = useState<VaultStationTab>('challenges');
  const [activeInteriorVault, setActiveInteriorVault] = useState<VaultId | null>(null);
  const [vehicleHud, setVehicleHud] = useState<VehicleHudState>({
    active: false,
    name: '',
    kind: 'car',
    speedKmh: 0,
    boosting: false,
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
  const vaultAnnounceTimeRef = useRef<Record<number, number>>({});

  const isInModernWorld = activeInteriorVault === null && playerMapPos.z < -21.5;

  // Persist progress & sync 3D facility state
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // ignore storage quota errors
    }
    engineRef.current?.syncProgress(
      progress.completedVaults,
      progress.placedKeys,
      progress.collectedEvidence,
      progress.mainDoorOpen,
      progress.facilityRestored
    );
  }, [progress]);

  // Dynamically switch ambient soundscape between each of the 5 unique Research Vault profiles and the Main Facility
  useEffect(() => {
    if (phase !== 'gameplay') return;
    if (activeInteriorVault !== null) {
      soundEngine.setAmbience(getVaultAmbienceMode(activeInteriorVault));
    } else {
      soundEngine.setAmbience(
        progress.mainDoorOpen || progress.facilityRestored || isInModernWorld
          ? 'victory'
          : 'gameplay-thriller'
      );
    }
  }, [phase, activeInteriorVault, progress.mainDoorOpen, progress.facilityRestored, isInModernWorld]);

  const markVaultVisited = useCallback((vaultId: VaultId) => {
    setProgress((prev) => {
      if (prev.visitedVaults.includes(vaultId)) return prev;
      const nextVisited = [...prev.visitedVaults, vaultId].sort((a, b) => a - b) as VaultId[];
      return { ...prev, visitedVaults: nextVisited };
    });
  }, []);

  const announceNexus = useCallback((text: string, tone: 'info' | 'warning' | 'success' = 'info', durationMs = 8500) => {
    setNexusMessage({ id: Date.now(), text, tone });
    soundEngine.speakNexus(text);
    if (nexusTimerRef.current) window.clearTimeout(nexusTimerRef.current);
    nexusTimerRef.current = window.setTimeout(() => {
      setNexusMessage(null);
    }, durationMs);
  }, []);

  const enterThirdPersonGameplay = useCallback(
    (preserveCameraFromIntro: boolean) => {
      const curr = progressRef.current;
      soundEngine.stopEmergencyAlarm();
      soundEngine.setAmbience(curr.mainDoorOpen || curr.facilityRestored ? 'victory' : 'gameplay-thriller');
      setNeedsAutoplayTap(false);
      setPhase('gameplay');
      setProgress((prev) => (prev.introSeen ? prev : { ...prev, introSeen: true }));

      engineRef.current?.enterGameplay(
        curr.completedVaults,
        curr.placedKeys,
        curr.collectedEvidence,
        curr.mainDoorOpen,
        curr.facilityRestored,
        preserveCameraFromIntro
      );

      if (curr.completedVaults.length === 0) {
        announceNexus(
          'Investigation active. Move with W A S D, hold SHIFT to run, SPACE to jump, and walk straight up to Vault 01 in the West Wing — unlocked vault doors open and close automatically.',
          'info',
          9500
        );
      } else {
        announceNexus(
          `Welcome back, Investigator. ${curr.completedVaults.length} of 5 vaults verified and ${curr.collectedEvidence.length} of 3 breach clues logged.`,
          'info',
          7500
        );
      }
    },
    [announceNexus]
  );

  const enterThirdPersonGameplayRef = useRef(enterThirdPersonGameplay);
  enterThirdPersonGameplayRef.current = enterThirdPersonGameplay;

  const handleEnterModernWorld = useCallback(() => {
    soundEngine.playVictoryFanfare();
    setProgress((prev) => ({ ...prev, enteredModernWorld: true, facilityRestored: true }));
    announceNexus(
      'Welcome to the Future Metropolis! You have verified all five research vaults, lifted the BioQuest lockdown, and restored scientific integrity. Explore the city or inspect the Celebration Monument for your reward.',
      'success',
      11000
    );
  }, [announceNexus]);

  const handleEnterModernWorldRef = useRef(handleEnterModernWorld);
  handleEnterModernWorldRef.current = handleEnterModernWorld;

  const handleInteract = useCallback(
    (target: InteractableTarget) => {
      soundEngine.unlock();
      engineRef.current?.triggerInteractGesture();

      // Handle Future City Vehicles, Working Lifts & Working TVs directly
      if (target.kind === 'vehicle' || target.kind === 'lift' || target.kind === 'tv') {
        soundEngine.playButtonClick();
        engineRef.current?.handleCityInteract(target);
        return;
      }

      const curr = progressRef.current;

      // Handle Investigation Evidence Terminals (Breach Terminal, Drug Cryo-Storage, AI Monitoring Console)
      if (target.kind === 'evidence') {
        const evidenceKey = target.entityId || target.id;
        const info = EVIDENCE_REPORTS[evidenceKey];
        if (!info) return;

        const alreadyCollected = curr.collectedEvidence.includes(evidenceKey);
        if (!alreadyCollected) {
          soundEngine.playKeyCollected();
          const nextEvidence = [...curr.collectedEvidence, evidenceKey];
          setProgress((prev) => ({
            ...prev,
            collectedEvidence: Array.from(new Set([...prev.collectedEvidence, evidenceKey])),
          }));
          const countSuffix =
            nextEvidence.length >= 3
              ? ' All 3 breach evidence records have been logged!'
              : ` (${nextEvidence.length}/3 evidence logged)`;
          announceNexus(`${info.report}${countSuffix}`, 'success', 10500);
        } else {
          soundEngine.playTerminalOpen();
          announceNexus(info.report, 'info', 9000);
        }
        return;
      }

      if (target.kind === 'vault' && target.vaultId) {
        const vault = getVaultById(target.vaultId);
        if (!vault) return;
        const highestUnlocked = Math.min(5, curr.completedVaults.length + 1);
        if (vault.id > highestUnlocked) {
          soundEngine.playIncorrect();
          announceNexus(
            `${vault.code} is currently sealed under lockdown. Complete Vault 0${vault.id - 1} first to acquire its authentication key and unlock this chamber.`,
            'warning'
          );
          return;
        }
        const opened = engineRef.current?.openVaultDoorDirectly(vault.id);
        markVaultVisited(vault.id);
        if (opened) {
          soundEngine.playVaultUnlock();
          soundEngine.playDoorSlide();
          announceNexus(
            `${vault.code} (${vault.title}) blast doors opening! Walk straight inside to access the Challenge Verification Console, Concept Guide, and Incident Log.`,
            'info',
            8500
          );
        }
        return;
      }

      if (target.kind === 'vault-station' && target.vaultId) {
        const vault = getVaultById(target.vaultId);
        if (!vault) return;
        soundEngine.playTerminalOpen();
        setActiveVaultTab(target.stationTab ?? 'challenges');
        setActiveVault(vault);
        return;
      }

      if (target.kind === 'vault-exit') {
        soundEngine.playDoorSlide();
        engineRef.current?.exitVaultInterior();
        return;
      }

      if (target.kind === 'nexus') {
        soundEngine.playHologramActivate();
        const unplaced = curr.completedVaults.filter((k) => !curr.placedKeys.includes(k));
        const nextVault = VAULTS.find((v) => !curr.completedVaults.includes(v.id));

        if (curr.mainDoorOpen) {
          announceNexus(
            'The Grand Security Gate is open! Walk straight north through the gateway to explore the Future Metropolis.',
            'success'
          );
        } else if (curr.completedVaults.length >= 5) {
          announceNexus(
            'You hold all five authentication keys! Walk north to the Grand Security Gate pedestals and press E to lift the lockdown.',
            'success'
          );
        } else if (unplaced.length > 0 && nextVault) {
          announceNexus(
            `You are carrying ${unplaced.length} unplaced key(s) and have logged ${curr.collectedEvidence.length}/3 breach clues. Insert keys at the North Gate or proceed to ${nextVault.code} (${nextVault.title}) in the ${nextVault.wing}.`,
            'info'
          );
        } else if (nextVault) {
          announceNexus(
            `Case Status: ${curr.completedVaults.length}/5 vaults verified, ${curr.collectedEvidence.length}/3 breach clues logged. Next objective: ${nextVault.code} — ${nextVault.title} in the ${nextVault.wing}.`,
            'info'
          );
        }
      } else if (target.kind === 'exit') {
        if (curr.mainDoorOpen) {
          announceNexus(
            'The Grand Security Gate is open! Walk straight forward through the glowing archway into the Future Metropolis.',
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
              'All five authentication keys are verified! Emergency Lockdown lifted — the Grand Security Gate is opening to the Future Metropolis!',
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
              `Inserted ${unplacedKeys.length} authentication key${unplacedKeys.length > 1 ? 's' : ''} into the Grand Gate pedestals (${nextPlaced.length}/5 placed). Validate the remaining vaults to lift the lockdown.`,
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
            'The Grand Security Gate is opening! Walk forward into the Future Metropolis!',
            'success',
            10000
          );
        } else {
          soundEngine.playIncorrect();
          announceNexus(
            `Grand Gate sealed (${curr.placedKeys.length}/5 keys placed). Complete the five Research Vaults to collect authentication keys, then press E here to insert them.`,
            'warning'
          );
        }
      } else if (target.kind === 'monument') {
        soundEngine.playTerminalOpen();
        setShowReward(true);
      }
    },
    [announceNexus, markVaultVisited]
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
    if (sceneId === 1 && t >= 4.4 && !cues.has('s1-transfer')) {
      cues.add('s1-transfer');
      soundEngine.setAmbience('alert-tension');
      soundEngine.playHorrorRiser(4.5);
    }
    if (sceneId === 2 && !cues.has('s2-breach')) {
      cues.add('s2-breach');
      soundEngine.playHorrorSystemFailure();
      soundEngine.startEmergencyAlarm();
    }
    if (sceneId === 2 && t >= 11.4 && !cues.has('s2-shock')) {
      cues.add('s2-shock');
      soundEngine.playHeartbeatPulse();
      soundEngine.playElectricalSpark();
    }
    if (sceneId === 2 && t >= 13.0 && !cues.has('s2-horror-sting')) {
      cues.add('s2-horror-sting');
      soundEngine.playHorrorGlitchSting();
    }
    if (sceneId === 2 && t >= 15.1 && !cues.has('s2-grid-drop')) {
      cues.add('s2-grid-drop');
      soundEngine.playHeartbeatPulse();
      soundEngine.playPowerDown();
    }
    if (sceneId === 3 && !cues.has('s3-lockdown')) {
      cues.add('s3-lockdown');
      soundEngine.stopEmergencyAlarm();
      soundEngine.playBlastDoorSlam();
      soundEngine.playDistantLabCreak();
    }
    if (sceneId === 3 && t >= 19.6 && !cues.has('s3-nexus-core')) {
      cues.add('s3-nexus-core');
      soundEngine.setAmbience('gameplay-thriller');
      soundEngine.playHologramActivate();
    }
    if (sceneId === 4 && !cues.has('s4-investigator')) {
      cues.add('s4-investigator');
      soundEngine.playDoorSlide();
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
        // Seamlessly hand over from Scene 4 behind-the-Investigator camera directly to playable third-person gameplay!
        enterThirdPersonGameplayRef.current(true);
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
      onVehicleHudChange: (state) => {
        setVehicleHud(state);
      },
      onCityActionFeedback: (msg) => {
        setNexusMessage({ id: Date.now(), text: msg, tone: 'info' });
        if (nexusTimerRef.current) window.clearTimeout(nexusTimerRef.current);
        nexusTimerRef.current = window.setTimeout(() => {
          setNexusMessage(null);
        }, 6500);
      },
      onVaultInteriorChange: (vaultId) => {
        setActiveInteriorVault(vaultId);
        if (vaultId !== null) {
          markVaultVisited(vaultId);
          const vault = getVaultById(vaultId);
          const now = Date.now();
          const lastTime = vaultAnnounceTimeRef.current[vaultId] ?? 0;
          if (vault && now - lastTime > 15000) {
            vaultAnnounceTimeRef.current[vaultId] = now;
            soundEngine.playHologramActivate();
            const alreadyDone = progressRef.current.completedVaults.includes(vault.id);
            announceNexus(
              alreadyDone
                ? `Entered ${vault.code} (${vault.title}) — Chamber Secured. Revisit the Challenge Console ahead, Concept Guide on the left, or walk back to the doorway to auto-open and exit.`
                : `Welcome inside ${vault.code} — ${vault.title}. Walk straight ahead to the Challenge Verification Console [E] to play this vault's challenges, or inspect the Concept Guide (left) and Incident Log (right).`,
              alreadyDone ? 'success' : 'info',
              9500
            );
          }
        }
      },
      onAutoDoorToggle: (action, doorId) => {
        soundEngine.playDoorSlide();
        if (action === 'open' && typeof doorId === 'number') {
          markVaultVisited(doorId);
        }
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
  }, [handleCinematicTime, announceNexus, markVaultVisited]);

  const anyModalOpen = Boolean(activeVault || showMap || showReward);
  useEffect(() => {
    if (phase === 'gameplay') {
      engineRef.current?.setPaused(anyModalOpen);
    }
  }, [anyModalOpen, phase]);

  // Global shortcuts: Enter/Space on Title Screen; Esc (Close Modal / Pause Menu), M (Map), N (NEXUS Guidance)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (phaseRef.current === 'title') {
        if ((e.code === 'Enter' || e.code === 'Space') && !isTyping) {
          e.preventDefault();
          soundEngine.unlock().then(() => {
            soundEngine.playButtonClick();
            soundEngine.stopEmergencyAlarm();
            soundEngine.stopSpeech();
            setFadeBlack(true);
            window.setTimeout(() => {
              enterThirdPersonGameplayRef.current(false);
              window.setTimeout(() => {
                setFadeBlack(false);
              }, 240);
            }, 300);
          });
        }
        return;
      }

      if (phaseRef.current !== 'gameplay') return;

      if (e.code === 'Escape') {
        if (activeVault) {
          e.preventDefault();
          soundEngine.playButtonClick();
          setActiveVault(null);
          return;
        }
        if (showMap) {
          e.preventDefault();
          soundEngine.playButtonClick();
          setShowMap(false);
          return;
        }
        if (showReward) {
          e.preventDefault();
          soundEngine.playButtonClick();
          setShowReward(false);
          return;
        }
        if (!document.pointerLockElement) {
          e.preventDefault();
          soundEngine.playButtonClick();
          soundEngine.stopSpeech();
          setNexusMessage(null);
          engineRef.current?.jumpToTitleScene();
          setPhase('title');
        }
        return;
      }

      if (activeVault || showReward || isTyping) return;

      if (e.code === 'KeyM') {
        e.preventDefault();
        soundEngine.playButtonClick();
        setShowMap((prev) => !prev);
      } else if (e.code === 'KeyN') {
        e.preventDefault();
        const curr = progressRef.current;
        if (activeInteriorVault !== null) {
          const chamberVault = getVaultById(activeInteriorVault);
          if (chamberVault) {
            const done = curr.completedVaults.includes(chamberVault.id);
            announceNexus(
              done
                ? `${chamberVault.code} (${chamberVault.title}) is secured! You can revisit the Challenge Console, Concept Guide, Incident Log, or walk right back out through the open blast doors.`
                : `You are inside ${chamberVault.code} (${chamberVault.title}). Walk ahead to the Challenge Verification Console [E] to solve the vault challenges, or use the Concept Guide (left) and Incident Log (right).`,
              done ? 'success' : 'info'
            );
            return;
          }
        }
        const nextVault = VAULTS.find((v) => !curr.completedVaults.includes(v.id));
        if (curr.mainDoorOpen) {
          announceNexus(
            'The Grand Security Gate is open! Walk north through the archway into the Future Metropolis.',
            'success'
          );
        } else if (nextVault) {
          announceNexus(
            `Current objective: Walk up to ${nextVault.code} (${nextVault.title}) in the ${nextVault.wing} — its blast doors open automatically as you approach. You have logged ${curr.collectedEvidence.length}/3 breach evidence items.`,
            'info'
          );
        } else {
          announceNexus(
            'All five keys are verified! Walk to the North Grand Gate pedestals and press E to insert them and lift the lockdown.',
            'success'
          );
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeVault, activeInteriorVault, showMap, showReward, announceNexus]);

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

    setFadeBlack(true);
    window.setTimeout(() => {
      enterThirdPersonGameplay(false);
      window.setTimeout(() => {
        setFadeBlack(false);
      }, 220);
    }, 240);
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
      enterThirdPersonGameplay(false);
      window.setTimeout(() => {
        setFadeBlack(false);
      }, 240);
    }, 300);
  };

  const handleCompleteVault = (vault: VaultDefinition) => {
    soundEngine.playKeyCollected();
    const alreadyDone = progressRef.current.completedVaults.includes(vault.id);
    if (!alreadyDone) {
      soundEngine.playVaultUnlock();
      setProgress((prev) => {
        const nextCompleted = [...prev.completedVaults, vault.id].sort((a, b) => a - b) as VaultId[];
        const nextVisited = Array.from(new Set([...prev.visitedVaults, vault.id])).sort((a, b) => a - b) as VaultId[];
        return {
          ...prev,
          completedVaults: nextCompleted,
          visitedVaults: nextVisited,
          collectedKeys: nextCompleted,
        };
      });
    }
    engineRef.current?.triggerLabFireworks(vault.id === 5 ? 5 : 3);
    announceNexus(
      vault.id === 5
        ? 'Research Key 05 verified! You now hold all five keys! Bring them to the Grand Security Gate at the North wall and press E to lift the lockdown!'
        : `${vault.nexusCompletion} You can carry this key or insert it at the North Grand Gate pedestals anytime.`,
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
    soundEngine.stopSpeech();
    soundEngine.stopEmergencyAlarm();
    window.localStorage.removeItem(STORAGE_KEY);

    setShowReward(false);
    setActiveVault(null);
    setActiveInteriorVault(null);
    setShowMap(false);
    setHoverTarget(null);
    setNexusMessage(null);
    vaultAnnounceTimeRef.current = {};

    const freshProgress: SavedProgress = { ...DEFAULT_PROGRESS, introSeen: true };
    progressRef.current = freshProgress;
    setProgress(freshProgress);

    setFadeBlack(true);
    window.setTimeout(() => {
      setVehicleHud({ active: false, name: '', kind: 'car', speedKmh: 0, boosting: false });
      setPlayerMapPos({ x: 0, z: 24.5 });
      setPhase('gameplay');
      engineRef.current?.enterGameplay([], [], [], false, false, false);
      soundEngine.setAmbience('gameplay-thriller');
      announceNexus(
        'Mission restarted! Inspect the breach evidence, verify all five research vaults (Vault 01 to Vault 05), and place all five keys at the North Grand Security Gate.',
        'info',
        9500
      );
      window.setTimeout(() => {
        setFadeBlack(false);
      }, 240);
    }, 260);
  };

  const handleNavigateToVault = (vaultId: VaultId) => {
    soundEngine.playHologramActivate();
    soundEngine.playDoorSlide();
    setShowMap(false);
    engineRef.current?.teleportNearVault(vaultId, true);
    const v = getVaultById(vaultId);
    if (v) {
      announceNexus(
        `Fast Traveled to ${v.code} — ${v.title} (${v.wing}). Blast doors opening ahead.`,
        'info',
        5500
      );
    }
  };

  const handleNavigateToMainDoor = () => {
    soundEngine.playDoorSlide();
    setShowMap(false);
    engineRef.current?.teleportToMainDoor();
    const curr = progressRef.current;
    if (curr.mainDoorOpen) {
      announceNexus('You are at the open Grand Security Gate. Walk straight ahead into the Future Metropolis!', 'success', 6000);
    } else {
      announceNexus(
        `You are at the Grand Security Gate Key Pedestals (${curr.placedKeys.length}/5 placed). Press E to insert keys you are carrying.`,
        'info',
        6500
      );
    }
  };

  const handleNavigateToFutureCity = () => {
    soundEngine.playDoorSlide();
    setShowMap(false);
    engineRef.current?.teleportToFutureCity();
    soundEngine.setAmbience('victory');
    announceNexus(
      'Welcome to the Future Metropolis! Drive Cyber Cars & Bikes with E, ride the panoramic Glass Lifts, climb the Plaza Stairs, and tune the live Giant City TVs!',
      'success',
      8500
    );
  };

  const handleExitVaultChamber = useCallback(() => {
    setActiveVault(null);
    soundEngine.playDoorSlide();
    engineRef.current?.exitVaultInterior();
  }, []);

  const handleReturnToTitle = () => {
    soundEngine.playButtonClick();
    soundEngine.stopSpeech();
    setActiveVault(null);
    setActiveInteriorVault(null);
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
        className={`fixed inset-0 z-50 bg-black pointer-events-none transition-opacity duration-400 ${
          fadeBlack ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* 4-Scene Animated Story Cinematic & Optional Pause Menu */}
      <CinematicOverlay
        phase={phase}
        sceneId={cinematicScene}
        cinematicTime={cinematicTime}
        nexusSubtitle={nexusSubtitle}
        needsAutoplayTap={needsAutoplayTap}
        audioSettings={audioSettings}
        hasSavedProgress={progress.completedVaults.length > 0}
        completedCount={progress.completedVaults.length}
        evidenceCount={progress.collectedEvidence.length}
        onStartIntroWithAudio={handleStartIntroWithAudio}
        onSkipIntro={handleSkipIntro}
        onStartGame={handleStartGame}
        onReplayIntro={handleReplayIntro}
        onResetProgress={handleResetProgress}
        onToggleMute={handleToggleMute}
      />

      {/* Interactive Third-Person 3D Gameplay HUD */}
      {phase === 'gameplay' && (
        <GameplayHUD
          completedVaults={progress.completedVaults}
          placedKeys={progress.placedKeys}
          collectedEvidence={progress.collectedEvidence}
          mainDoorOpen={progress.mainDoorOpen}
          isInModernWorld={isInModernWorld}
          activeInteriorVault={activeInteriorVault}
          vehicleHud={vehicleHud}
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
                engineRef.current?.setVirtualRun(false);
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
            if (activeInteriorVault !== null) {
              const chamberVault = getVaultById(activeInteriorVault);
              if (chamberVault) {
                const done = progress.completedVaults.includes(chamberVault.id);
                announceNexus(
                  done
                    ? `${chamberVault.code} (${chamberVault.title}) is secured! Revisit any station inside or walk straight out the open blast doors to return to the Main Facility.`
                    : `You are inside ${chamberVault.code} — ${chamberVault.title}. Walk straight ahead to the Challenge Console [E] to play the vault challenges, or explore the Concept Guide (left) and Incident Log (right).`,
                  done ? 'success' : 'info'
                );
                return;
              }
            }
            const nextVault = VAULTS.find((v) => !progress.completedVaults.includes(v.id));
            if (isInModernWorld) {
              announceNexus(
                'You are exploring the Future Metropolis! Walk up to Cyber Cars or Bikes and press E to drive, climb the Plaza Stairs, ride the Glass Lifts to the Rooftop Deck, or press E near any Giant TV to change channels.',
                'success'
              );
            } else if (progress.mainDoorOpen) {
              announceNexus(
                'The Grand Security Gate is open! Walk straight north through the gate to explore the Future Metropolis.',
                'success'
              );
            } else if (nextVault) {
              announceNexus(
                `Progress: ${progress.completedVaults.length}/5 vaults verified, ${progress.collectedEvidence.length}/3 breach clues logged. Next objective: Enter ${nextVault.code} (${nextVault.title}) in the ${nextVault.wing}.`,
                'info'
              );
            } else {
              announceNexus(
                'All five keys are verified! Bring them to the North Grand Gate pedestals and press E to lift the lockdown and step into the Future Metropolis!',
                'success'
              );
            }
          }}
          onReplayIntro={handleReplayIntro}
          onReturnToTitle={handleReturnToTitle}
          onUpdateAudio={handleUpdateAudio}
          onInteractCurrent={() => {
            if (vehicleHud.active) {
              engineRef.current?.handleCityInteract({
                id: 'exit-vehicle',
                kind: 'vehicle',
                label: 'Exit Vehicle',
                sublabel: '',
              });
            } else if (hoverTarget) {
              handleInteract(hoverTarget);
            }
          }}
          onQuickVisitCity={() => {
            if (isInModernWorld) {
              handleNavigateToMainDoor();
            } else {
              handleNavigateToFutureCity();
            }
          }}
          onRestartGame={handleResetProgress}
          onExitVaultChamber={handleExitVaultChamber}
        />
      )}

      {/* Mobile & Tablet Virtual Analog Joystick + Jump/Run/Interact Controls */}
      {phase === 'gameplay' && touchControlsEnabled && !anyModalOpen && (
        <MobileTouchControls
          hoverTarget={hoverTarget}
          isDriving={vehicleHud.active}
          onMoveVector={(x, z) => {
            engineRef.current?.setVirtualMove(x, z);
          }}
          onInteract={() => {
            if (vehicleHud.active) {
              engineRef.current?.handleCityInteract({
                id: 'exit-vehicle',
                kind: 'vehicle',
                label: 'Exit Vehicle',
                sublabel: '',
              });
            } else if (hoverTarget) {
              handleInteract(hoverTarget);
            }
          }}
          onJump={() => {
            engineRef.current?.triggerJump();
          }}
          onRunChange={(running) => {
            engineRef.current?.setVirtualRun(running);
          }}
        />
      )}

      {/* Five-Vault Mission Map Modal */}
      {phase === 'gameplay' && showMap && (
        <MissionMapModal
          completedVaults={progress.completedVaults}
          visitedVaults={progress.visitedVaults}
          placedKeys={progress.placedKeys}
          mainDoorOpen={progress.mainDoorOpen}
          playerPos={playerMapPos}
          onClose={() => {
            soundEngine.playButtonClick();
            setShowMap(false);
          }}
          onNavigateToVault={handleNavigateToVault}
          onNavigateToMainDoor={handleNavigateToMainDoor}
          onNavigateToFutureCity={handleNavigateToFutureCity}
        />
      )}

      {/* Vault Research Terminal Modal (Vaults 01–05 Stations Inside Each Vault Chamber) */}
      {phase === 'gameplay' && activeVault && (
        <VaultTerminalModal
          key={`${activeVault.id}-${activeVaultTab}`}
          vault={activeVault}
          initialTab={activeVaultTab}
          alreadyCompleted={progress.completedVaults.includes(activeVault.id)}
          onCompleteVault={handleCompleteVault}
          onClose={() => {
            soundEngine.playButtonClick();
            setActiveVault(null);
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
