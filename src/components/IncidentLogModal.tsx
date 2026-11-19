import React from 'react';
import { X, FileWarning, Cpu } from 'lucide-react';
import { StoryLogEntry } from '../types/game';

interface IncidentLogModalProps {
  log: StoryLogEntry;
  onClose: () => void;
}

export const IncidentLogModal: React.FC<IncidentLogModalProps> = ({ log, onClose }) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
      <div className="max-w-xl w-full bg-[#091120] border border-slate-700 rounded-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0c1629]">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono-data text-amber-400">
              <FileWarning className="w-3.5 h-3.5" />
              <span>{log.classification}</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-400">{log.code}</span>
            </div>
            <h2 className="font-display text-xl font-bold text-white mt-1">{log.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close terminal log"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-xs font-mono-data text-slate-400">
            <span>Recorded: {log.timestamp}</span>
            <span aria-hidden="true">·</span>
            <span>Source: {log.source}</span>
          </div>

          <div className="space-y-3 bg-[#060b16] border border-slate-800 rounded p-4 font-mono-data text-sm text-slate-200 leading-relaxed">
            {log.body.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>

          <div className="bg-cyan-950/40 border border-cyan-500/30 rounded p-4">
            <div className="flex items-center gap-2 text-xs font-mono-data text-cyan-400 mb-1.5">
              <Cpu className="w-3.5 h-3.5" />
              <span>NEXUS ANALYSIS</span>
            </div>
            <p className="text-sm text-cyan-100 leading-relaxed">{log.nexusNote}</p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer"
            >
              Return to Facility
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
