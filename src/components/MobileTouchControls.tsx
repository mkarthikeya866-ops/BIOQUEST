import React, { useRef, useState } from 'react';
import { Hand, Move } from 'lucide-react';
import { InteractableTarget } from '../types/game';

interface MobileTouchControlsProps {
  hoverTarget: InteractableTarget | null;
  onMoveVector: (x: number, z: number) => void;
  onInteract: () => void;
}

const JOYSTICK_RADIUS = 44;

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  hoverTarget,
  onMoveVector,
  onInteract,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const updateStickFromClientPoint = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist > JOYSTICK_RADIUS) {
      dx = (dx / dist) * JOYSTICK_RADIUS;
      dy = (dy / dist) * JOYSTICK_RADIUS;
    }

    setKnobOffset({ x: dx, y: dy });
    // Screen up (-dy) corresponds to forward (+z in player movement space)
    const normX = Math.abs(dx) < 5 ? 0 : dx / JOYSTICK_RADIUS;
    const normZ = Math.abs(dy) < 5 ? 0 : -dy / JOYSTICK_RADIUS;
    onMoveVector(normX, normZ);
  };

  const resetStick = () => {
    activePointerId.current = null;
    setIsDragging(false);
    setKnobOffset({ x: 0, y: 0 });
    onMoveVector(0, 0);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (activePointerId.current !== null) return;
    activePointerId.current = e.pointerId;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateStickFromClientPoint(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    updateStickFromClientPoint(e.clientX, e.clientY);
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    resetStick();
  };

  const actionLabel = hoverTarget
    ? hoverTarget.kind === 'vault'
      ? 'OPEN VAULT'
      : hoverTarget.kind === 'exit'
        ? 'MAIN DOOR'
        : hoverTarget.kind === 'nexus'
          ? 'NEXUS'
          : 'REWARD'
    : 'INTERACT';

  return (
    <div className="fixed inset-x-0 bottom-0 z-25 pointer-events-none select-none flex items-end justify-between px-4 pb-5 sm:px-6 sm:pb-6">
      {/* Left Thumb Virtual Analog Movement Joystick */}
      <div className="flex flex-col items-center gap-1.5 pointer-events-auto">
        <div
          ref={padRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrCancel}
          onPointerCancel={handlePointerUpOrCancel}
          className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 touch-none flex items-center justify-center transition-colors ${
            isDragging
              ? 'bg-[#071324]/75 border-cyan-400/80 shadow-[0_0_24px_rgba(34,211,238,0.22)]'
              : 'bg-[#070d1a]/60 border-slate-500/50'
          }`}
          aria-label="Virtual movement joystick"
        >
          {/* Subtle directional guide ticks */}
          <span className="absolute top-2 text-[9px] font-mono-data text-slate-400/70">▲</span>
          <span className="absolute bottom-2 text-[9px] font-mono-data text-slate-400/70">▼</span>
          <span className="absolute left-2.5 text-[9px] font-mono-data text-slate-400/70">◀</span>
          <span className="absolute right-2.5 text-[9px] font-mono-data text-slate-400/70">▶</span>

          {/* Movable thumb puck */}
          <div
            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors ${
              isDragging
                ? 'bg-cyan-400/85 border-cyan-100 text-slate-950'
                : 'bg-slate-800/85 border-cyan-400/60 text-cyan-300'
            }`}
            style={{
              transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
            }}
          >
            <Move className="w-5 h-5" />
          </div>
        </div>
        <span className="text-[10px] font-mono-data text-slate-400/80 tracking-wider">MOVE</span>
      </div>

      {/* Right Thumb Contextual Interact Button & Look Hint */}
      <div className="flex flex-col items-end gap-2 pointer-events-auto">
        <span className="text-[10px] font-mono-data text-slate-400/85 bg-[#070d1a]/75 border border-slate-800 rounded px-2 py-0.5">
          Drag screen to look
        </span>

        <button
          type="button"
          disabled={!hoverTarget}
          onClick={(e) => {
            e.stopPropagation();
            if (hoverTarget) onInteract();
          }}
          className={`w-22 h-22 sm:w-24 sm:h-24 rounded-full border-2 flex flex-col items-center justify-center gap-1 transition-all touch-none ${
            hoverTarget
              ? 'bg-cyan-400/95 border-cyan-100 text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.45)] active:scale-95 cursor-pointer'
              : 'bg-[#070d1a]/60 border-slate-700/70 text-slate-500 cursor-default'
          }`}
          aria-label="Interact with nearby object"
        >
          <Hand className="w-6 h-6" />
          <span className="font-mono-data text-[10px] font-bold tracking-wider leading-none text-center px-1">
            {actionLabel}
          </span>
        </button>
      </div>
    </div>
  );
};
