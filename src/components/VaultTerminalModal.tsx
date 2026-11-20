import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  BookOpen,
  FlaskConical,
  FileWarning,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Cpu,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import {
  ClassificationChallenge,
  MatchingChallenge,
  MultiSelectChallenge,
  MultipleChoiceChallenge,
  VaultDefinition,
  VaultStationTab,
} from '../types/game';
import { MoleculeDiagram } from './MoleculeDiagram';
import { soundEngine } from '../audio/soundEngine';

interface VaultTerminalModalProps {
  vault: VaultDefinition;
  initialTab?: VaultStationTab;
  alreadyCompleted: boolean;
  onCompleteVault: (vault: VaultDefinition) => void;
  onClose: () => void;
}

export const VaultTerminalModal: React.FC<VaultTerminalModalProps> = ({
  vault,
  initialTab = 'challenges',
  alreadyCompleted,
  onCompleteVault,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<VaultStationTab>(initialTab);
  const [challengeIdx, setChallengeIdx] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<{ status: 'correct' | 'incorrect'; text: string } | null>(null);
  const [vaultClearedNow, setVaultClearedNow] = useState(false);
  const [powerSurgeActive, setPowerSurgeActive] = useState(false);
  const surgeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (surgeTimerRef.current !== null) {
        window.clearTimeout(surgeTimerRef.current);
      }
    };
  }, []);

  // Per-challenge answer states
  const [selectedMc, setSelectedMc] = useState<string | null>(null);
  const [selectedMulti, setSelectedMulti] = useState<string[]>([]);
  const [matchAnswers, setMatchAnswers] = useState<Record<string, string>>({});
  const [classAnswers, setClassAnswers] = useState<Record<string, string>>({});

  const isSecure = vaultClearedNow || alreadyCompleted;
  const currentChallenge = vault.challenges[challengeIdx];

  // Deterministically shuffle right-hand matching options per challenge
  const shuffledRightLabels = useMemo(() => {
    if (currentChallenge.type !== 'matching') return [];
    const items = currentChallenge.pairs.map((p) => p.rightLabel);
    // Deterministic rotation/interleave so order never equals left order
    if (items.length <= 1) return items;
    return [...items.slice(1), items[0]];
  }, [currentChallenge]);

  const resetChallengeInputs = () => {
    setSelectedMc(null);
    setSelectedMulti([]);
    setMatchAnswers({});
    setClassAnswers({});
    setShowHint(false);
    setFeedback(null);
  };

  const handleToggleHint = () => {
    soundEngine.playButtonClick();
    if (!showHint) {
      soundEngine.speakNexus(currentChallenge.hint);
    }
    setShowHint((prev) => !prev);
  };

  const evaluateCurrentChallenge = () => {
    let isCorrect = false;

    if (currentChallenge.type === 'multiple-choice') {
      if (!selectedMc) return;
      isCorrect = selectedMc === currentChallenge.correctOptionId;
    } else if (currentChallenge.type === 'multi-select') {
      if (selectedMulti.length === 0) return;
      const expected = [...currentChallenge.correctOptionIds].sort();
      const actual = [...selectedMulti].sort();
      isCorrect = expected.length === actual.length && expected.every((v, i) => v === actual[i]);
    } else if (currentChallenge.type === 'matching') {
      const allAnswered = currentChallenge.pairs.every((p) => Boolean(matchAnswers[p.id]));
      if (!allAnswered) return;
      isCorrect = currentChallenge.pairs.every((p) => matchAnswers[p.id] === p.rightLabel);
    } else if (currentChallenge.type === 'classification') {
      const allAnswered = currentChallenge.items.every((item) => Boolean(classAnswers[item.id]));
      if (!allAnswered) return;
      isCorrect = currentChallenge.items.every((item) => classAnswers[item.id] === item.correctCategory);
    }

    if (isCorrect) {
      soundEngine.playCorrect();
      setFeedback({ status: 'correct', text: currentChallenge.correctExplanation });
      soundEngine.speakNexus(currentChallenge.correctExplanation);
    } else {
      soundEngine.playIncorrect();
      setFeedback({ status: 'incorrect', text: currentChallenge.incorrectExplanation });
      soundEngine.speakNexus(currentChallenge.incorrectExplanation);
    }
  };

  const handleNextChallenge = () => {
    soundEngine.playButtonClick();
    if (challengeIdx + 1 < vault.challenges.length) {
      setChallengeIdx((i) => i + 1);
      resetChallengeInputs();
    } else {
      soundEngine.playElectricalSpark();
      setPowerSurgeActive(true);
      if (surgeTimerRef.current !== null) {
        window.clearTimeout(surgeTimerRef.current);
      }
      surgeTimerRef.current = window.setTimeout(() => {
        setPowerSurgeActive(false);
        surgeTimerRef.current = null;
      }, 1180);
      setVaultClearedNow(true);
      onCompleteVault(vault);
    }
  };

  const canSubmit = (() => {
    if (feedback?.status === 'correct') return false;
    if (currentChallenge.type === 'multiple-choice') return selectedMc !== null;
    if (currentChallenge.type === 'multi-select') return selectedMulti.length > 0;
    if (currentChallenge.type === 'matching') {
      return currentChallenge.pairs.every((p) => Boolean(matchAnswers[p.id]));
    }
    if (currentChallenge.type === 'classification') {
      return currentChallenge.items.every((i) => Boolean(classAnswers[i.id]));
    }
    return false;
  })();

  const renderChallengeBody = () => {
    if (currentChallenge.type === 'multiple-choice') {
      const ch = currentChallenge as MultipleChoiceChallenge;
      return (
        <div className="space-y-4">
          {ch.moleculeDiagram && (
            <div className="bg-[#060b16] border border-slate-800 rounded p-4 flex flex-col items-center">
              <MoleculeDiagram id={ch.moleculeDiagram} className="w-64 h-24" />
              <span className="text-xs font-mono-data text-slate-400 mt-1">
                Recovered Molecular Structure Schematic
              </span>
            </div>
          )}

          {ch.contextData && (
            <div className="bg-[#060b16] border border-slate-800 rounded p-4">
              <p className="text-xs font-mono-data text-cyan-400 mb-3">{ch.contextData.title}</p>
              <div className="divide-y divide-slate-800/80">
                {ch.contextData.rows.map((row, idx) => (
                  <div key={idx} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-slate-400">{row.label}</span>
                    <span
                      className={`font-mono-data font-medium ${
                        row.highlight === 'red'
                          ? 'text-red-400'
                          : row.highlight === 'amber'
                            ? 'text-amber-300'
                            : row.highlight === 'emerald'
                              ? 'text-emerald-400'
                              : row.highlight === 'cyan'
                                ? 'text-cyan-300'
                                : 'text-slate-200'
                      }`}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            {ch.options.map((opt) => {
              const selected = selectedMc === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playButtonClick();
                    setSelectedMc(opt.id);
                    if (feedback?.status === 'incorrect') setFeedback(null);
                  }}
                  className={`w-full text-left p-4 rounded border transition-colors cursor-pointer ${
                    selected
                      ? 'bg-cyan-950/60 border-cyan-400 text-white'
                      : 'bg-[#0b1324] border-slate-800 text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <p className="text-sm font-semibold leading-snug">{opt.label}</p>
                  {opt.sublabel && <p className="text-xs text-slate-400 mt-1">{opt.sublabel}</p>}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (currentChallenge.type === 'multi-select') {
      const ch = currentChallenge as MultiSelectChallenge;
      const toggleOption = (id: string) => {
        soundEngine.playButtonClick();
        setSelectedMulti((prev) =>
          prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
        if (feedback?.status === 'incorrect') setFeedback(null);
      };
      return (
        <div className="space-y-3">
          <p className="text-xs font-mono-data text-slate-400">{ch.instruction}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ch.options.map((opt) => {
              const checked = selectedMulti.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleOption(opt.id)}
                  className={`text-left p-4 rounded border transition-colors cursor-pointer ${
                    checked
                      ? 'bg-cyan-950/60 border-cyan-400 text-white'
                      : 'bg-[#0b1324] border-slate-800 text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                        checked ? 'bg-cyan-400 border-cyan-400 text-slate-950 font-bold' : 'border-slate-600'
                      }`}
                    >
                      {checked ? '✓' : ''}
                    </span>
                  </div>
                  {opt.code && (
                    <p className="font-mono-data text-sm text-cyan-300 mt-2 bg-[#060b16] px-2.5 py-1.5 rounded border border-slate-800">
                      {opt.code}
                    </p>
                  )}
                  {opt.detail && <p className="text-xs text-slate-400 mt-1.5">{opt.detail}</p>}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (currentChallenge.type === 'matching') {
      const ch = currentChallenge as MatchingChallenge;
      return (
        <div className="space-y-3">
          {ch.pairs.map((pair) => (
            <div
              key={pair.id}
              className="bg-[#0b1324] border border-slate-800 rounded p-3.5 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
            >
              <div className="md:col-span-5 flex items-center gap-3">
                {pair.moleculeDiagram && (
                  <div className="bg-[#060b16] border border-slate-800 rounded p-1.5 shrink-0">
                    <MoleculeDiagram id={pair.moleculeDiagram} className="w-20 h-12" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-white">{pair.leftLabel}</p>
                  {pair.leftCode && (
                    <p className="font-mono-data text-xs text-cyan-300 mt-0.5">{pair.leftCode}</p>
                  )}
                </div>
              </div>

              <div className="md:col-span-7">
                <select
                  value={matchAnswers[pair.id] || ''}
                  onChange={(e) => {
                    soundEngine.playButtonClick();
                    setMatchAnswers((prev) => ({ ...prev, [pair.id]: e.target.value }));
                    if (feedback?.status === 'incorrect') setFeedback(null);
                  }}
                  className="w-full bg-[#060b16] border border-slate-700 focus:border-cyan-400 rounded px-3 py-2 text-sm text-slate-100 outline-none cursor-pointer"
                >
                  <option value="">Select matching description...</option>
                  {shuffledRightLabels.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // classification
    const ch = currentChallenge as ClassificationChallenge;
    return (
      <div className="space-y-4">
        <div className="bg-cyan-950/35 border border-cyan-500/35 rounded px-4 py-2.5 text-xs font-mono-data text-cyan-200">
          {ch.ruleSummary}
        </div>
        <div className="space-y-2.5">
          {ch.items.map((item) => (
            <div
              key={item.id}
              className="bg-[#0b1324] border border-slate-800 rounded p-3.5 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-semibold text-white">{item.name}</p>
                <p className="text-xs font-mono-data text-slate-400 mt-0.5">{item.metric}</p>
              </div>
              <div className="flex items-center gap-2">
                {ch.categories.map((cat) => {
                  const chosen = classAnswers[item.id] === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        soundEngine.playButtonClick();
                        setClassAnswers((prev) => ({ ...prev, [item.id]: cat }));
                        if (feedback?.status === 'incorrect') setFeedback(null);
                      }}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded border transition-colors cursor-pointer whitespace-nowrap ${
                        chosen
                          ? 'bg-cyan-400 border-cyan-400 text-slate-950'
                          : 'bg-[#060b16] border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 md:p-6 transition-colors duration-700 ease-in-out ${
        isSecure ? 'bg-[#02121b]/84' : 'bg-[#170d02]/84'
      }`}
    >
      {/* Full-Viewport Screen-Space Power Surge Flicker Overlay (Warning Amber -> Voltage Surge -> Secure Cyan) */}
      {powerSurgeActive && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
        >
          {/* Primary full-screen amber-to-cyan voltage flash & brownout flicker */}
          <div className="absolute inset-0 animate-power-surge-overlay" />

          {/* Subtle horizontal CRT interference scanlines across the viewport */}
          <div className="absolute inset-0 opacity-35 power-surge-scanlines animate-power-surge-terminal" />

          {/* Sweeping amber-to-cyan power surge band */}
          <div className="absolute inset-x-0 top-0 h-28 animate-power-surge-scan bg-gradient-to-b from-transparent via-cyan-300/45 to-amber-300/20" />

          {/* Screen-edge electrical border flash */}
          <div className="absolute inset-0 shadow-[inset_0_0_95px_rgba(34,211,238,0.58)] animate-power-surge-overlay" />
        </div>
      )}

      <div
        className={`relative max-w-4xl w-full max-h-[92dvh] rounded-xl overflow-hidden flex flex-col border transition-all duration-700 ease-in-out ${
          isSecure
            ? 'bg-[#051a26] border-cyan-400/75 shadow-[0_0_55px_rgba(34,211,238,0.28)]'
            : 'bg-[#1b1105] border-amber-500/65 shadow-[0_0_55px_rgba(245,158,11,0.24)]'
        } ${powerSurgeActive ? 'animate-power-surge-terminal' : ''}`}
      >
        {/* Cross-fading Atmospheric Interface Background Wash: Warning Amber -> Secure Cyan */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ease-in-out bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.24)_0%,_rgba(120,53,15,0.12)_48%,_transparent_80%)] ${
            isSecure ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ease-in-out bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.24)_0%,_rgba(8,145,178,0.12)_48%,_transparent_80%)] ${
            isSecure ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Header */}
        <div
          className={`relative z-10 px-4 py-3 sm:px-6 sm:py-4 border-b flex items-center justify-between gap-3 shrink-0 transition-colors duration-700 ease-in-out ${
            isSecure
              ? 'bg-[#072434]/95 border-cyan-400/45'
              : 'bg-[#261707]/95 border-amber-500/40'
          }`}
        >
          <div className="min-w-0">
            <div
              className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs font-mono-data transition-colors duration-700 ${
                isSecure ? 'text-cyan-300' : 'text-amber-300'
              }`}
            >
              <span>{vault.code}</span>
              <span aria-hidden="true">·</span>
              <span>{vault.difficulty}</span>
              <span className="hidden sm:inline" aria-hidden="true">·</span>
              <span className="hidden sm:inline text-slate-300/80">{vault.wing}</span>
              <span aria-hidden="true">·</span>
              <span
                className={`font-semibold tracking-wider transition-colors duration-700 ${
                  isSecure ? 'text-cyan-300' : 'text-amber-400'
                }`}
              >
                {isSecure ? 'SECURE · VERIFIED' : 'WARNING · LOCKED TERMINAL'}
              </span>
            </div>
            <h2 className="font-display text-lg sm:text-2xl font-bold text-white mt-0.5 truncate">{vault.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            aria-label="Close vault terminal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        {!vaultClearedNow && (
          <div
            className={`relative z-10 px-3 sm:px-6 py-2 border-b flex items-center justify-between gap-3 shrink-0 overflow-x-auto transition-colors duration-700 ease-in-out ${
              isSecure
                ? 'bg-[#061d2b]/90 border-cyan-500/30'
                : 'bg-[#1e1206]/90 border-amber-500/30'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playButtonClick();
                  setActiveTab('concepts');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors duration-500 cursor-pointer whitespace-nowrap ${
                  activeTab === 'concepts'
                    ? isSecure
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Guide ({vault.concepts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playButtonClick();
                  setActiveTab('challenges');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors duration-500 cursor-pointer whitespace-nowrap ${
                  activeTab === 'challenges'
                    ? isSecure
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>
                  Challenges ({challengeIdx + 1}/{vault.challenges.length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playButtonClick();
                  setActiveTab('story');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors duration-500 cursor-pointer whitespace-nowrap ${
                  activeTab === 'story'
                    ? isSecure
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <FileWarning className="w-3.5 h-3.5" />
                <span>Incident Log</span>
              </button>
            </div>

            <span
              className={`hidden md:inline text-xs font-mono-data whitespace-nowrap transition-colors duration-700 ${
                isSecure ? 'text-cyan-300' : 'text-amber-200/80'
              }`}
            >
              Reward: {vault.keyName}
            </span>
          </div>
        )}

        {/* Main Scrollable Workspace */}
        <div className="relative z-10 flex-1 overflow-y-auto terminal-scroll p-4 sm:p-6">
          {vaultClearedNow ? (
            /* KEY COLLECTION CELEBRATION — SECURE CYAN STATE */
            <div className="max-w-xl mx-auto text-center py-6 space-y-6 animate-cinema-in">
              <div className="w-20 h-20 rounded-full bg-cyan-950/80 border-2 border-cyan-400 shadow-[0_0_28px_rgba(34,211,238,0.4)] flex items-center justify-center mx-auto">
                <KeyRound className="w-10 h-10 text-cyan-300" />
              </div>
              <div>
                <p className="font-mono-data text-xs tracking-widest text-cyan-300 mb-1">
                  TERMINAL SECURED · AUTHENTICATION KEY RECOVERED
                </p>
                <h3 className="font-display text-3xl font-bold text-white">
                  {vault.keyName} Acquired
                </h3>
                <p className="text-sm text-cyan-50/90 mt-2 leading-relaxed">
                  {vault.nexusCompletion}
                </p>
              </div>

              <div className="bg-[#04141f]/90 border border-cyan-400/45 rounded-lg p-5 text-left">
                <div className="flex items-center gap-2 text-xs font-mono-data text-cyan-300 mb-2">
                  <FileWarning className="w-4 h-4" />
                  <span>STORY CLUE UNCOVERED · {vault.storyLog.code}</span>
                </div>
                <p className="text-sm font-semibold text-white mb-2">{vault.storyLog.title}</p>
                <div className="space-y-2 text-xs font-mono-data text-slate-200 leading-relaxed">
                  {vault.storyLog.body.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playButtonClick();
                    setVaultClearedNow(false);
                    setChallengeIdx(0);
                    resetChallengeInputs();
                    setActiveTab('challenges');
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-cyan-100 bg-cyan-950/60 border border-cyan-500/45 hover:border-cyan-300 rounded transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Replay Challenges</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded shadow-[0_0_20px_rgba(34,211,238,0.35)] transition-colors cursor-pointer"
                >
                  Return to {vault.code} Chamber
                </button>
              </div>
            </div>
          ) : activeTab === 'concepts' ? (
            <div className="space-y-5">
              {/* NEXUS Briefing Box */}
              <div className="bg-cyan-950/35 border border-cyan-500/35 rounded-lg p-4">
                <div className="flex items-center gap-2 text-xs font-mono-data text-cyan-400 mb-1.5">
                  <Cpu className="w-4 h-4" />
                  <span>NEXUS BRIEFING</span>
                </div>
                <p className="text-sm text-cyan-50 leading-relaxed">{vault.nexusIntro}</p>
              </div>

              {/* Concepts List with 2 Examples Each */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vault.concepts.map((concept) => (
                  <div
                    key={concept.term}
                    className="bg-[#0b1324] border border-slate-800 rounded-lg p-4 flex flex-col justify-between"
                  >
                    <div>
                      <h3 className="font-display text-base font-bold text-cyan-300 mb-1.5">
                        {concept.term}
                      </h3>
                      <p className="text-sm text-slate-200 leading-relaxed mb-3">
                        {concept.explanation}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-800 space-y-1.5">
                      <p className="text-[11px] font-mono-data text-slate-400">EXAMPLES</p>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        1. {concept.examples[0]}
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        2. {concept.examples[1]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playButtonClick();
                    setActiveTab('challenges');
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer"
                >
                  <span>Start Vault Challenges</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : activeTab === 'story' ? (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="flex items-center gap-3 text-xs font-mono-data text-amber-400">
                <span>{vault.storyLog.classification}</span>
                <span aria-hidden="true">·</span>
                <span>{vault.storyLog.code}</span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-400">{vault.storyLog.timestamp}</span>
              </div>
              <h3 className="font-display text-2xl font-bold text-white">{vault.storyLog.title}</h3>
              <div className="bg-[#060b16] border border-slate-800 rounded-lg p-5 font-mono-data text-sm text-slate-200 space-y-3 leading-relaxed">
                {vault.storyLog.body.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
              <div className="bg-cyan-950/35 border border-cyan-500/35 rounded-lg p-4">
                <div className="flex items-center gap-2 text-xs font-mono-data text-cyan-400 mb-1">
                  <Cpu className="w-4 h-4" />
                  <span>NEXUS NOTE</span>
                </div>
                <p className="text-sm text-cyan-100 leading-relaxed">{vault.storyLog.nexusNote}</p>
              </div>
            </div>
          ) : (
            /* CHALLENGES TAB */
            <div className="space-y-5 max-w-3xl mx-auto">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-mono-data text-cyan-400">
                  CHALLENGE {challengeIdx + 1} OF {vault.challenges.length}
                </span>
                <button
                  type="button"
                  onClick={handleToggleHint}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-950/40 border border-amber-500/40 hover:bg-amber-950/70 rounded transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{showHint ? 'Hide NEXUS Hint' : 'Ask NEXUS for Hint'}</span>
                </button>
              </div>

              <h3 className="text-base md:text-lg font-semibold text-white leading-relaxed">
                {currentChallenge.prompt}
              </h3>

              {showHint && (
                <div className="bg-amber-950/30 border border-amber-500/40 rounded p-3.5 text-sm text-amber-100">
                  <span className="font-mono-data text-xs text-amber-400 block mb-1">NEXUS HINT</span>
                  {currentChallenge.hint}
                </div>
              )}

              {renderChallengeBody()}

              {/* Feedback Banner */}
              {feedback && (
                <div
                  className={`rounded-lg p-4 border ${
                    feedback.status === 'correct'
                      ? 'bg-emerald-950/45 border-emerald-500/60 text-emerald-100'
                      : 'bg-red-950/45 border-red-500/60 text-red-100'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-mono-data font-semibold mb-1">
                    {feedback.status === 'correct' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400">VERIFIED — SCIENTIFICALLY ACCURATE</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-red-400">RECHECK RESULT — NEXUS EXPLANATION</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{feedback.text}</p>
                </div>
              )}

              {/* Action Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playButtonClick();
                    setActiveTab('concepts');
                  }}
                  className="text-xs font-medium text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                >
                  Review Concept Guide
                </button>

                {feedback?.status === 'correct' ? (
                  <button
                    type="button"
                    onClick={handleNextChallenge}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors cursor-pointer"
                  >
                    <span>
                      {challengeIdx + 1 < vault.challenges.length
                        ? 'Next Challenge'
                        : `Claim ${vault.keyName}`}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={evaluateCurrentChallenge}
                    className={`px-6 py-2.5 text-sm font-semibold rounded transition-colors ${
                      canSubmit
                        ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 cursor-pointer'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    Verify Answer
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
