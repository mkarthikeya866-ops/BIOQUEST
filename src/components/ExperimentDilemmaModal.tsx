import React, { useEffect, useState } from 'react';
import { X, Skull, AlertTriangle, CheckCircle2, Wind } from 'lucide-react';
import { ExperimentDilemma } from '../types/game';
import { soundEngine } from '../audio/soundEngine';

interface ExperimentDilemmaModalProps {
  experiment: ExperimentDilemma;
  alreadyResolved: boolean;
  onResolve: (experimentId: string) => void;
  onClose: () => void;
}

export const ExperimentDilemmaModal: React.FC<ExperimentDilemmaModalProps> = ({
  experiment,
  alreadyResolved,
  onResolve,
  onClose,
}) => {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedChoiceId(null);
    soundEngine.playHeartbeatPulse();
  }, [experiment.id]);

  const selectedChoice = experiment.choices.find((c) => c.id === selectedChoiceId) || null;

  const handleChoose = (choiceId: string) => {
    const choice = experiment.choices.find((c) => c.id === choiceId);
    if (!choice) return;
    setSelectedChoiceId(choiceId);
    if (choice.isSafeScientific) {
      soundEngine.playCorrect();
      soundEngine.speakNexus(choice.outcomeText);
      onResolve(experiment.id);
    } else {
      soundEngine.playIncorrect();
      soundEngine.playHeartbeatPulse();
      soundEngine.playChemicalHiss();
      soundEngine.speakNexus(choice.outcomeText);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4">
      <div className="max-w-2xl w-full max-h-[90vh] bg-[#0a0d14] border border-red-900/70 rounded-lg overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-[#140a0d] border-b border-red-950 flex items-center justify-between gap-4 shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono-data text-red-400">
              <Skull className="w-3.5 h-3.5" />
              <span>{experiment.riskCategory}</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-400">{experiment.podCode}</span>
              {alreadyResolved && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-400">CONTAINMENT STABILIZED</span>
                </>
              )}
            </div>
            <h2 className="font-display text-xl font-bold text-white mt-1">{experiment.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close failed experiment dossier"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto terminal-scroll space-y-5">
          {/* Olfactory / Chemical Atmosphere Cue */}
          <div className="flex items-center gap-2.5 text-xs font-mono-data text-lime-300 bg-[#0d140a] border border-lime-900/60 rounded px-3.5 py-2.5">
            <Wind className="w-4 h-4 shrink-0" />
            <span>AIR SENSOR: {experiment.smellCue}</span>
          </div>

          {/* Unsettling Lab Incident Notes */}
          <div className="space-y-2.5 text-sm text-slate-200 leading-relaxed">
            {experiment.briefing.map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>

          {/* Medicinal Chemistry Risk Telemetry Table */}
          <div className="bg-[#06080d] border border-slate-800 rounded p-4">
            <p className="text-xs font-mono-data text-amber-400 mb-2.5">
              PRECLINICAL FAILURE TELEMETRY · {experiment.statusTag}
            </p>
            <div className="divide-y divide-slate-800/80">
              {experiment.telemetry.map((row, i) => (
                <div key={i} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-slate-400">{row.label}</span>
                  <span
                    className={`font-mono-data font-semibold ${
                      row.tone === 'red'
                        ? 'text-red-400'
                        : row.tone === 'amber'
                          ? 'text-amber-300'
                          : 'text-cyan-300'
                    }`}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* High-Stakes Go / No-Go Decision */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white">{experiment.question}</p>
            <div className="space-y-2.5">
              {experiment.choices.map((choice) => {
                const isSelected = selectedChoiceId === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => handleChoose(choice.id)}
                    className={`w-full text-left p-4 rounded border transition-colors cursor-pointer ${
                      isSelected
                        ? choice.isSafeScientific
                          ? 'bg-emerald-950/50 border-emerald-500 text-white'
                          : 'bg-red-950/60 border-red-500 text-white'
                        : 'bg-[#0d121d] border-slate-800 text-slate-200 hover:border-amber-500/60'
                    }`}
                  >
                    <p className="text-sm font-semibold">{choice.label}</p>
                    <p className="text-xs text-slate-400 mt-1">{choice.detail}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Consequence Feedback */}
          {selectedChoice && (
            <div
              className={`rounded-lg p-4 border ${
                selectedChoice.isSafeScientific
                  ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-100'
                  : 'bg-red-950/55 border-red-500/70 text-red-100'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-mono-data font-semibold mb-1.5">
                {selectedChoice.isSafeScientific ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">{selectedChoice.outcomeTitle}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-red-400">{selectedChoice.outcomeTitle}</span>
                  </>
                )}
              </div>
              <p className="text-sm leading-relaxed">{selectedChoice.outcomeText}</p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer"
            >
              Step Back Into Lab
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
