import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Hand, Move, ArrowUp, Zap } from 'lucide-react';
import { InteractableTarget } from '../types/game';

interface MobileTouchControlsProps {
  hoverTarget: InteractableTarget | null;
  isDriving: boolean;
  onMoveVector: (x: number, z: number) => void;
  onInteract: () => void;
  onJump: () => void;
  onRunChange: (running: boolean) => void;
}

const JOYSTICK_RADIUS = 44;

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  hoverTarget,
  isDriving,
  onMoveVector,
  onInteract,
  onJump,
  onRunChange,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const activeTouchId = useRef<number | null>(null);
  const mouseDragging = useRef(false);
  const lastTouchActionMs = useRef(0);

  // Keep latest callbacks in refs so parent re-renders never disrupt active touch drags
  const onMoveVectorRef = useRef(onMoveVector);
  const onInteractRef = useRef(onInteract);
  const onJumpRef = useRef(onJump);
  const onRunChangeRef = useRef(onRunChange);

  onMoveVectorRef.current = onMoveVector;
  onInteractRef.current = onInteract;
  onJumpRef.current = onJump;
  onRunChangeRef.current = onRunChange;

  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [runActive, setRunActive] = useState(false);
  const [jumpFlash, setJumpFlash] = useState(false);

  const canInteract = isDriving || Boolean(hoverTarget);
  const canInteractRef = useRef(canInteract);
  canInteractRef.current = canInteract;

  const updateStickFromClientPoint = useCallback((clientX: number, clientY: number) => {
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
    const normX = Math.abs(dx) < 5 ? 0 : dx / JOYSTICK_RADIUS;
    const normZ = Math.abs(dy) < 5 ? 0 : -dy / JOYSTICK_RADIUS;
    onMoveVectorRef.current(normX, normZ);
  }, []);

  const resetStick = useCallback(() => {
    activeTouchId.current = null;
    mouseDragging.current = false;
    setIsDragging(false);
    setKnobOffset({ x: 0, y: 0 });
    onMoveVectorRef.current(0, 0);
  }, []);

  // Native non-passive multi-touch + mouse listeners for rock-solid mobile joystick tracking
  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (activeTouchId.current !== null) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      activeTouchId.current = touch.identifier;
      mouseDragging.current = false;
      setIsDragging(true);
      updateStickFromClientPoint(touch.clientX, touch.clientY);
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (activeTouchId.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === activeTouchId.current) {
          e.preventDefault();
          updateStickFromClientPoint(touch.clientX, touch.clientY);
          break;
        }
      }
    };

    const handleWindowTouchEnd = (e: TouchEvent) => {
      if (activeTouchId.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeTouchId.current) {
          resetStick();
          break;
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (activeTouchId.current !== null) return;
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      mouseDragging.current = true;
      setIsDragging(true);
      updateStickFromClientPoint(e.clientX, e.clientY);
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!mouseDragging.current) return;
      updateStickFromClientPoint(e.clientX, e.clientY);
    };

    const handleWindowMouseUp = () => {
      if (!mouseDragging.current) return;
      resetStick();
    };

    pad.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
    window.addEventListener('touchend', handleWindowTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleWindowTouchEnd, { passive: true });

    pad.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      pad.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
      window.removeEventListener('touchcancel', handleWindowTouchEnd);

      pad.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [updateStickFromClientPoint, resetStick]);

  // Reset movement and run ONLY on true component unmount
  useEffect(() => {
    return () => {
      activeTouchId.current = null;
      mouseDragging.current = false;
      onMoveVectorRef.current(0, 0);
      onRunChangeRef.current(false);
    };
  }, []);

  const triggerRunToggle = useCallback(() => {
    setRunActive((prev) => {
      const next = !prev;
      onRunChangeRef.current(next);
      return next;
    });
  }, []);

  const triggerJumpAction = useCallback(() => {
    onJumpRef.current();
    setJumpFlash(true);
    window.setTimeout(() => setJumpFlash(false), 160);
  }, []);

  const triggerInteractAction = useCallback(() => {
    if (canInteractRef.current) {
      onInteractRef.current();
    }
  }, []);

  const runBtnRef = useRef<HTMLButtonElement | null>(null);
  const jumpBtnRef = useRef<HTMLButtonElement | null>(null);
  const interactBtnRef = useRef<HTMLButtonElement | null>(null);

  // Attach native non-passive touchstart on action buttons so multi-touch (Move + Jump/Run) fires instantaneously
  useEffect(() => {
    const runEl = runBtnRef.current;
    const jumpEl = jumpBtnRef.current;
    const interactEl = interactBtnRef.current;

    const onRunTouch = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      lastTouchActionMs.current = Date.now();
      triggerRunToggle();
    };
    const onJumpTouch = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      lastTouchActionMs.current = Date.now();
      triggerJumpAction();
    };
    const onInteractTouch = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      lastTouchActionMs.current = Date.now();
      triggerInteractAction();
    };

    runEl?.addEventListener('touchstart', onRunTouch, { passive: false });
    jumpEl?.addEventListener('touchstart', onJumpTouch, { passive: false });
    interactEl?.addEventListener('touchstart', onInteractTouch, { passive: false });

    return () => {
      runEl?.removeEventListener('touchstart', onRunTouch);
      jumpEl?.removeEventListener('touchstart', onJumpTouch);
      interactEl?.removeEventListener('touchstart', onInteractTouch);
    };
  }, [isDriving, triggerRunToggle, triggerJumpAction, triggerInteractAction]);

  const actionLabel = isDriving
    ? 'EXIT'
    : hoverTarget
      ? hoverTarget.kind === 'vault'
        ? 'OPEN'
        : hoverTarget.kind === 'vault-station'
          ? 'OPEN'
          : hoverTarget.kind === 'vault-exit'
            ? 'EXIT'
            : hoverTarget.kind === 'exit'
              ? 'DOOR'
              : hoverTarget.kind === 'nexus'
                ? 'NEXUS'
                : hoverTarget.kind === 'vehicle'
                  ? 'RIDE'
                  : hoverTarget.kind === 'lift'
                    ? 'LIFT'
                    : hoverTarget.kind === 'tv'
                      ? 'TV CH'
                      : hoverTarget.kind === 'evidence'
                        ? 'INSPECT'
                        : 'REWARD'
      : 'USE';

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 pointer-events-none select-none flex items-end justify-between px-3.5 pb-3.5 sm:px-6 sm:pb-5">
      {/* Left Thumb Virtual Analog Movement / Steering Joystick */}
      <div className="flex flex-col items-center gap-1 pointer-events-auto">
        <div
          ref={padRef}
          className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 touch-none flex items-center justify-center transition-colors ${
            isDragging
              ? 'bg-[#071324]/80 border-cyan-400/90 shadow-[0_0_24px_rgba(34,211,238,0.28)]'
              : 'bg-[#070d1a]/65 border-slate-500/55'
          }`}
          aria-label="Virtual movement joystick"
        >
          <span className="absolute top-2 text-[9px] font-mono-data text-slate-400/70 pointer-events-none">▲</span>
          <span className="absolute bottom-2 text-[9px] font-mono-data text-slate-400/70 pointer-events-none">▼</span>
          <span className="absolute left-2.5 text-[9px] font-mono-data text-slate-400/70 pointer-events-none">◀</span>
          <span className="absolute right-2.5 text-[9px] font-mono-data text-slate-400/70 pointer-events-none">▶</span>

          <div
            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors pointer-events-none ${
              isDragging
                ? 'bg-cyan-400/90 border-cyan-100 text-slate-950'
                : 'bg-slate-800/85 border-cyan-400/60 text-cyan-300'
            }`}
            style={{
              transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
            }}
          >
            <Move className="w-5 h-5" />
          </div>
        </div>
        <span className="text-[10px] font-mono-data text-slate-400/85 tracking-wider">
          {isDriving ? 'DRIVE / STEER' : 'MOVE'}
        </span>
      </div>

      {/* Right Thumb Cluster: Run/Boost, Jump, and Contextual Interact */}
      <div className="flex flex-col items-end gap-1.5 pointer-events-auto">
        {!hoverTarget && (
          <span className="hidden sm:inline-block text-[10px] font-mono-data text-slate-300/85 bg-[#070d1a]/75 border border-slate-800 rounded px-2 py-0.5">
            Drag screen to orbit
          </span>
        )}

        <div className="flex items-end gap-2 sm:gap-2.5">
          {/* Run / Turbo Boost Toggle */}
          <button
            ref={runBtnRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (Date.now() - lastTouchActionMs.current < 450) return;
              triggerRunToggle();
            }}
            className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center gap-0.5 touch-none cursor-pointer transition-all ${
              runActive
                ? 'bg-amber-400/95 border-amber-100 text-slate-950 scale-105 shadow-[0_0_18px_rgba(251,191,36,0.45)]'
                : 'bg-[#070d1a]/80 border-slate-600/80 text-slate-200'
            }`}
            aria-label={isDriving ? 'Toggle Turbo Boost' : 'Toggle Sprint'}
          >
            <Zap className="w-4 h-4 pointer-events-none" />
            <span className="font-mono-data text-[9px] font-bold leading-none pointer-events-none">
              {isDriving ? 'BOOST' : 'RUN'}
            </span>
          </button>

          {/* Jump Button (on foot) */}
          {!isDriving && (
            <button
              ref={jumpBtnRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (Date.now() - lastTouchActionMs.current < 450) return;
                triggerJumpAction();
              }}
              className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center gap-0.5 touch-none cursor-pointer transition-all ${
                jumpFlash
                  ? 'bg-cyan-400/95 border-cyan-100 text-slate-950 scale-95 shadow-[0_0_18px_rgba(34,211,238,0.45)]'
                  : 'bg-[#070d1a]/80 border-cyan-500/70 text-cyan-200 active:scale-95'
              }`}
              aria-label="Jump"
            >
              <ArrowUp className="w-4 h-4 pointer-events-none" />
              <span className="font-mono-data text-[9px] font-bold leading-none pointer-events-none">JUMP</span>
            </button>
          )}

          {/* Contextual Interact / Ride / Lift / TV / Exit Button */}
          <button
            ref={interactBtnRef}
            type="button"
            disabled={!canInteract}
            onClick={(e) => {
              e.stopPropagation();
              if (Date.now() - lastTouchActionMs.current < 450) return;
              triggerInteractAction();
            }}
            className={`w-20 h-20 sm:w-22 sm:h-22 rounded-full border-2 flex flex-col items-center justify-center gap-1 transition-all touch-none ${
              canInteract
                ? isDriving
                  ? 'bg-rose-500/95 border-rose-200 text-white active:scale-95 cursor-pointer'
                  : 'bg-cyan-400/95 border-cyan-100 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.4)] active:scale-95 cursor-pointer'
                : 'bg-[#070d1a]/65 border-slate-700/70 text-slate-500 cursor-default'
            }`}
            aria-label="Interact with nearby object"
          >
            <Hand className="w-5 h-5 pointer-events-none" />
            <span className="font-mono-data text-[10px] font-bold tracking-wider leading-none text-center px-1 pointer-events-none">
              {actionLabel}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
