import React from 'react';

interface MoleculeDiagramProps {
  id: string;
  className?: string;
}

export const MoleculeDiagram: React.FC<MoleculeDiagramProps> = ({ id, className = 'w-28 h-20' }) => {
  switch (id) {
    case 'ethanol':
      return (
        <svg viewBox="0 0 140 80" className={className} aria-label="Ethanol molecular structure CCO">
          <line x1="22" y1="52" x2="58" y2="28" stroke="#67e8f9" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="58" y1="28" x2="94" y2="52" stroke="#67e8f9" strokeWidth="2.5" strokeLinecap="round" />
          <text x="14" y="66" fill="#94a3b8" fontSize="11" fontFamily="monospace">CH3</text>
          <text x="51" y="20" fill="#94a3b8" fontSize="11" fontFamily="monospace">CH2</text>
          <text x="98" y="56" fill="#f87171" fontSize="13" fontWeight="bold" fontFamily="monospace">OH</text>
        </svg>
      );
    case 'acetone':
      return (
        <svg viewBox="0 0 140 80" className={className} aria-label="Acetone molecular structure CC(=O)C">
          <line x1="28" y1="62" x2="70" y2="42" stroke="#67e8f9" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="70" y1="42" x2="112" y2="62" stroke="#67e8f9" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="67" y1="42" x2="67" y2="18" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="73" y1="42" x2="73" y2="18" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" />
          <text x="64" y="14" fill="#f87171" fontSize="13" fontWeight="bold" fontFamily="monospace">O</text>
          <text x="12" y="72" fill="#94a3b8" fontSize="10" fontFamily="monospace">CH3</text>
          <text x="106" y="72" fill="#94a3b8" fontSize="10" fontFamily="monospace">CH3</text>
        </svg>
      );
    case 'benzene':
      return (
        <svg viewBox="0 0 140 80" className={className} aria-label="Benzene aromatic ring c1ccccc1">
          <polygon
            points="70,10 98,25 98,55 70,70 42,55 42,25"
            fill="none"
            stroke="#67e8f9"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <circle cx="70" cy="40" r="16" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeDasharray="4 3" />
        </svg>
      );
    case 'acetic_acid':
      return (
        <svg viewBox="0 0 140 80" className={className} aria-label="Acetic acid molecular structure CC(=O)O">
          <line x1="22" y1="54" x2="62" y2="40" stroke="#67e8f9" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="62" y1="40" x2="96" y2="54" stroke="#67e8f9" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="59" y1="40" x2="59" y2="17" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="65" y1="40" x2="65" y2="17" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" />
          <text x="56" y="13" fill="#f87171" fontSize="13" fontWeight="bold" fontFamily="monospace">O</text>
          <text x="100" y="60" fill="#f87171" fontSize="13" fontWeight="bold" fontFamily="monospace">OH</text>
          <text x="8" y="66" fill="#94a3b8" fontSize="10" fontFamily="monospace">CH3</text>
        </svg>
      );
    case 'bq714':
      return (
        <svg viewBox="0 0 260 90" className={className} aria-label="Candidate BQ-714 amide diaryl scaffold">
          {/* Left aromatic ring */}
          <line x1="18" y1="46" x2="36" y2="46" stroke="#67e8f9" strokeWidth="2.2" />
          <polygon points="36,46 50,24 76,24 90,46 76,68 50,68" fill="none" stroke="#67e8f9" strokeWidth="2.2" />
          <circle cx="63" cy="46" r="12" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="3 3" />
          {/* Amide linker -NH-C(=O)- */}
          <line x1="90" y1="46" x2="112" y2="46" stroke="#67e8f9" strokeWidth="2.2" />
          <text x="114" y="50" fill="#818cf8" fontSize="12" fontWeight="bold" fontFamily="monospace">NH</text>
          <line x1="133" y1="46" x2="154" y2="46" stroke="#67e8f9" strokeWidth="2.2" />
          <line x1="152" y1="46" x2="152" y2="23" stroke="#f87171" strokeWidth="2" />
          <line x1="157" y1="46" x2="157" y2="23" stroke="#f87171" strokeWidth="2" />
          <text x="149" y="18" fill="#f87171" fontSize="12" fontWeight="bold" fontFamily="monospace">O</text>
          <line x1="155" y1="46" x2="176" y2="46" stroke="#67e8f9" strokeWidth="2.2" />
          {/* Right aromatic ring */}
          <polygon points="176,46 190,24 216,24 230,46 216,68 190,68" fill="none" stroke="#10b981" strokeWidth="2.2" />
          <circle cx="203" cy="46" r="12" fill="none" stroke="#34d399" strokeWidth="1.5" strokeDasharray="3 3" />
          <text x="4" y="50" fill="#94a3b8" fontSize="10" fontFamily="monospace">CH3</text>
        </svg>
      );
    default:
      return null;
  }
};
