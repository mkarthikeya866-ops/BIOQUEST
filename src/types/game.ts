export type GamePhase = 'cinematic' | 'title' | 'gameplay';

export type CinematicSceneId = 1 | 2 | 3 | 4 | 5;

export type VaultId = 1 | 2 | 3 | 4 | 5;

export interface AudioSettings {
  muted: boolean;
  musicVolume: number; // 0 to 1
  sfxVolume: number;   // 0 to 1
  voiceEnabled: boolean;
}

export interface ConceptEntry {
  term: string;
  explanation: string;
  examples: [string, string];
}

export type ChallengeType =
  | 'multiple-choice'
  | 'matching'
  | 'multi-select'
  | 'classification';

export interface MultipleChoiceChallenge {
  id: string;
  type: 'multiple-choice';
  prompt: string;
  contextData?: {
    title: string;
    rows: Array<{ label: string; value: string; highlight?: 'cyan' | 'amber' | 'red' | 'emerald' }>;
  };
  moleculeDiagram?: string; // key into MoleculeDiagram
  options: Array<{ id: string; label: string; sublabel?: string }>;
  correctOptionId: string;
  hint: string;
  correctExplanation: string;
  incorrectExplanation: string;
}

export interface MatchingChallenge {
  id: string;
  type: 'matching';
  prompt: string;
  pairs: Array<{
    id: string;
    leftLabel: string;
    leftCode?: string;
    moleculeDiagram?: string;
    rightLabel: string;
  }>;
  hint: string;
  correctExplanation: string;
  incorrectExplanation: string;
}

export interface MultiSelectChallenge {
  id: string;
  type: 'multi-select';
  prompt: string;
  instruction: string;
  options: Array<{ id: string; label: string; code?: string; detail?: string }>;
  correctOptionIds: string[];
  hint: string;
  correctExplanation: string;
  incorrectExplanation: string;
}

export interface ClassificationChallenge {
  id: string;
  type: 'classification';
  prompt: string;
  ruleSummary: string;
  categories: [string, string];
  items: Array<{
    id: string;
    name: string;
    metric: string;
    correctCategory: string;
  }>;
  hint: string;
  correctExplanation: string;
  incorrectExplanation: string;
}

export type VaultChallenge =
  | MultipleChoiceChallenge
  | MatchingChallenge
  | MultiSelectChallenge
  | ClassificationChallenge;

export interface StoryLogEntry {
  id: string;
  code: string;
  title: string;
  timestamp: string;
  source: string;
  classification: 'INCIDENT RECORD' | 'SECURITY CAM' | 'CORRUPTED FILE' | 'RESEARCH LOG';
  body: string[];
  nexusNote: string;
}

export interface VaultDefinition {
  id: VaultId;
  code: string;
  title: string;
  wing: string;
  difficulty: 'Easy' | 'Easy to Medium' | 'Medium';
  keyName: string;
  accentHex: string;
  nexusIntro: string;
  nexusCompletion: string;
  storyLog: StoryLogEntry;
  concepts: ConceptEntry[];
  challenges: VaultChallenge[];
  mapPosition: { x: number; y: number }; // percentage on 2D mission map
  worldPosition: { x: number; z: number };
}

export interface ExperimentDilemma {
  id: string;
  podCode: string;
  title: string;
  riskCategory: 'OFF-TARGET TOXICITY' | 'ASSAY NOISE' | 'MUTATION ESCAPE' | 'TRIAL & FUNDING COLLAPSE';
  smellCue: string;
  statusTag: string;
  briefing: string[];
  telemetry: Array<{ label: string; value: string; tone?: 'red' | 'amber' | 'cyan' }>;
  question: string;
  choices: Array<{
    id: string;
    label: string;
    detail: string;
    isSafeScientific: boolean;
    outcomeTitle: string;
    outcomeText: string;
  }>;
}

export interface InteractableTarget {
  id: string;
  kind: 'vault' | 'log' | 'nexus' | 'exit' | 'monument' | 'experiment';
  label: string;
  sublabel: string;
  vaultId?: VaultId;
  logId?: string;
  experimentId?: string;
  locked?: boolean;
}

export interface SavedProgress {
  completedVaults: VaultId[];
  collectedKeys: VaultId[];
  placedKeys: VaultId[];
  mainDoorOpen: boolean;
  enteredModernWorld: boolean;
  discoveredLogs: string[];
  resolvedExperiments: string[];
  facilityRestored: boolean;
  introSeen: boolean;
}

export interface NexusMessage {
  id: number;
  text: string;
  tone?: 'info' | 'warning' | 'success';
}
