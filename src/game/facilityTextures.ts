import * as THREE from 'three';
import { VaultId } from '../types/game';
import { VAULTS } from '../data/vaultData';

export interface FacilityTextures {
  floor: THREE.CanvasTexture;
  wall: THREE.CanvasTexture;
  monitorNormal: THREE.CanvasTexture;
  monitorAlert: THREE.CanvasTexture;
  drugRecordNormal: THREE.CanvasTexture;
  drugTransferAttempt: THREE.CanvasTexture;
  securityBreachAlert: THREE.CanvasTexture;
  breachPadlockDisplay: THREE.CanvasTexture;
  molecularWallScreen: THREE.CanvasTexture;
  biometricScanDisplay: THREE.CanvasTexture;
  bioquestHexDisplay: THREE.CanvasTexture;
  holoPadDisplay: THREE.CanvasTexture;
  drugStorageDisplay: THREE.CanvasTexture;
  aiMonitorWall: THREE.CanvasTexture;
  archiveWallDisplay: THREE.CanvasTexture;
  exitLocked: THREE.CanvasTexture;
  exitRestored: THREE.CanvasTexture;
  plazaGround: THREE.CanvasTexture;
  cityRoad: THREE.CanvasTexture;
  citySidewalk: THREE.CanvasTexture;
  vaultSigns: Map<VaultId, THREE.CanvasTexture>;
  disposeAll: () => void;
}

function makeCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    draw(ctx, width, height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

export function createFacilityTextures(maxAnisotropy: number): FacilityTextures {
  const created: THREE.CanvasTexture[] = [];
  const register = (t: THREE.CanvasTexture) => {
    created.push(t);
    return t;
  };

  // 1. High-Gloss Dark-Navy Composite Laboratory Deck (Ref Image 1 & 2)
  const floor = register(
    makeCanvasTexture(
      512,
      512,
      (ctx, w, h) => {
        const bg = ctx.createLinearGradient(0, 0, w, h);
        bg.addColorStop(0, '#071022');
        bg.addColorStop(0.5, '#0b1830');
        bg.addColorStop(1, '#070f20');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Sleek brushed metallic micro-sheen
        for (let i = 0; i < 64; i++) {
          ctx.fillStyle = i % 2 === 0 ? 'rgba(56, 189, 248, 0.025)' : 'rgba(14, 165, 233, 0.015)';
          ctx.fillRect(0, i * 8, w, 2);
        }

        // Beveled 2x2 architectural deck tiles
        ctx.strokeStyle = '#142b4d';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.beginPath();
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w / 2, h);
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        // Luminous recessed cyan micro-seams & corner locks
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.36)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(18, 18, w / 2 - 36, h / 2 - 36);
        ctx.strokeRect(w / 2 + 18, 18, w / 2 - 36, h / 2 - 36);
        ctx.strokeRect(18, h / 2 + 18, w / 2 - 36, h / 2 - 36);
        ctx.strokeRect(w / 2 + 18, h / 2 + 18, w / 2 - 36, h / 2 - 36);

        ctx.fillStyle = 'rgba(56, 189, 248, 0.65)';
        for (const cx of [14, w / 2 - 14, w / 2 + 14, w - 14]) {
          for (const cy of [14, h / 2 - 14, h / 2 + 14, h - 14]) {
            ctx.fillRect(cx - 2, cy - 2, 4, 4);
          }
        }
      },
      maxAnisotropy,
      17,
      16
    )
  );

  // 2. Sculpted Deep-Navy & Brushed Titanium Wall Bulkhead Panels (Ref Image 2 & 3)
  const wall = register(
    makeCanvasTexture(
      512,
      512,
      (ctx, w, h) => {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#0a1529');
        grad.addColorStop(0.45, '#13223d');
        grad.addColorStop(0.55, '#101d36');
        grad.addColorStop(1, '#091121');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Recessed titanium cladding ribs
        ctx.strokeStyle = '#213659';
        ctx.lineWidth = 4;
        ctx.strokeRect(10, 12, w - 20, h - 24);
        ctx.beginPath();
        ctx.moveTo(w / 2, 12);
        ctx.lineTo(w / 2, h - 12);
        ctx.moveTo(10, h * 0.28);
        ctx.lineTo(w - 10, h * 0.28);
        ctx.moveTo(10, h * 0.72);
        ctx.lineTo(w - 10, h * 0.72);
        ctx.stroke();

        // Crisp cyan & indigo architectural trim conduits
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(10, h * 0.72 - 4, w - 20, 4);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(10, h * 0.28 - 2, w - 20, 2);

        // Precision micro-vent louvers
        ctx.fillStyle = '#060c18';
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(42, h * 0.78 + i * 11, 140, 5);
          ctx.fillRect(w - 182, h * 0.78 + i * 11, 140, 5);
        }
      },
      maxAnisotropy,
      12,
      2
    )
  );

  // 3. Standard Scientific Monitor
  const monitorNormal = register(
    makeCanvasTexture(
      512,
      320,
      (ctx, w, h) => {
        ctx.fillStyle = '#041022';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 4;
        ctx.strokeRect(8, 8, w - 16, h - 16);

        ctx.fillStyle = '#08223d';
        ctx.fillRect(14, 14, w - 28, 38);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 18px monospace';
        ctx.fillText('BIOQUEST · MOLECULAR TELEMETRY OS', 26, 39);

        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          const x = 115 + Math.cos(a) * 56;
          const y = 175 + Math.sin(a) * 56;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let x = 210; x < 475; x += 10) {
          const y = 148 + Math.sin((x - 210) * 0.048) * 32 + Math.cos(x * 0.025) * 10;
          if (x === 210) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '14px monospace';
        ctx.fillText('ASSAY PIPELINE: NOMINAL', 210, 224);
        ctx.fillText('IC50 VALIDATION: PENDING', 210, 248);
        ctx.fillStyle = '#34d399';
        ctx.fillText('NEXUS GUARDIAN: ONLINE', 210, 274);
      },
      maxAnisotropy
    )
  );

  // 4. Emergency Lockdown Monitor
  const monitorAlert = register(
    makeCanvasTexture(
      512,
      320,
      (ctx, w, h) => {
        ctx.fillStyle = '#18050b';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, w - 16, h - 16);

        ctx.fillStyle = '#991b1b';
        ctx.fillRect(16, 16, w - 32, 46);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 21px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('EMERGENCY LOCKDOWN ACTIVE', w / 2, 47);

        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 22px monospace';
        ctx.fillText('UNAUTHORIZED TRANSFER', w / 2, 134);
        ctx.fillText('BLOCKED BY NEXUS AI', w / 2, 168);

        ctx.fillStyle = '#fde047';
        ctx.font = '15px monospace';
        ctx.fillText('ALL 5 RESEARCH VAULTS SEALED', w / 2, 228);
        ctx.fillStyle = '#fca5a5';
        ctx.fillText('INVESTIGATOR AUDIT REQUIRED', w / 2, 260);
      },
      maxAnisotropy
    )
  );

  // 5. Scene 1 Monitor — Confidential Drug Record (Compound BQ-X9)
  const drugRecordNormal = register(
    makeCanvasTexture(
      512,
      320,
      (ctx, w, h) => {
        ctx.fillStyle = '#051024';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.strokeRect(8, 8, w - 16, h - 16);

        ctx.fillStyle = '#0f2847';
        ctx.fillRect(14, 14, w - 28, 36);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('RESTRICTED DRUG ARCHIVE · COMPOUND BQ-X9', 24, 38);

        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i;
          const x = 104 + Math.cos(a) * 48;
          const y = 160 + Math.sin(a) * 48;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = '#e0f2fe';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('COMPOUND ID: BQ-X9 (EXPERIMENTAL)', 202, 92);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px monospace';
        ctx.fillText('MW: 418.4 Da   LogP: 3.12', 202, 122);
        ctx.fillText('IC50 (PRELIM): 18.4 nM', 202, 146);
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('TOXICOLOGY: UNVERIFIED', 202, 186);
        ctx.fillText('PUBLICATION CLEARANCE: DENIED', 202, 212);
        ctx.fillStyle = '#c084fc';
        ctx.fillText('STATUS: LEVEL-5 RESTRICTED', 202, 250);
      },
      maxAnisotropy
    )
  );

  // 6. Scene 1b Monitor — Unauthorized External Transfer Bypass
  const drugTransferAttempt = register(
    makeCanvasTexture(
      512,
      320,
      (ctx, w, h) => {
        ctx.fillStyle = '#14081d';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 5;
        ctx.strokeRect(8, 8, w - 16, h - 16);

        ctx.fillStyle = '#78350f';
        ctx.fillRect(14, 14, w - 28, 38);
        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 17px monospace';
        ctx.fillText('WARNING: SAFETY VALIDATION INCOMPLETE', 24, 39);

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 18px monospace';
        ctx.fillText('EXTERNAL DRUG PUBLICATION BYPASS', 24, 96);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '14px monospace';
        ctx.fillText('TARGET: UNAPPROVED PUBLIC RELEASE', 24, 128);
        ctx.fillText('AUTHORIZATION OVERRIDE: FORCED', 24, 154);

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(24, 188, w - 48, 28);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(24, 188, (w - 48) * 0.78, 28);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('EXPORTING BQ-X9 PACKAGE... 78%', 116, 207);

        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 15px monospace';
        ctx.fillText('NEXUS ANOMALY SCAN TRIGGERED...', 24, 266);
      },
      maxAnisotropy
    )
  );

  // 7. Scene 2 Monitor — NEXUS Breach Intercept
  const securityBreachAlert = register(
    makeCanvasTexture(
      512,
      320,
      (ctx, w, h) => {
        ctx.fillStyle = '#1e0409';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, w - 16, h - 16);

        ctx.fillStyle = '#dc2626';
        ctx.fillRect(14, 14, w - 28, 46);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NEXUS SECURITY INTERCEPT', w / 2, 44);

        ctx.fillStyle = '#fca5a5';
        ctx.font = 'bold 22px monospace';
        ctx.fillText('UNAUTHORIZED DRUG DATA', w / 2, 128);
        ctx.fillText('TRANSFER DETECTED', w / 2, 160);

        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('UPLINK TERMINATED · RELEASE BLOCKED', w / 2, 214);
        ctx.fillStyle = '#f87171';
        ctx.fillText('EMERGENCY LOCKDOWN INITIATED', w / 2, 258);
      },
      maxAnisotropy
    )
  );

  // 8. Ref Image 4 — Crimson Padlock Cracked Security Display!
  const breachPadlockDisplay = register(
    makeCanvasTexture(
      512,
      384,
      (ctx, w, h) => {
        const bg = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, 290);
        bg.addColorStop(0, '#2a0616');
        bg.addColorStop(0.65, '#0c081c');
        bg.addColorStop(1, '#040610');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Hex/grid glow backdrop
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.lineWidth = 1.5;
        for (let x = 0; x < w; x += 28) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y < h; y += 28) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }

        // Digital shatter crack lines radiating from center
        ctx.strokeStyle = 'rgba(147, 197, 253, 0.45)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI * 2 * i) / 10 + 0.2;
          ctx.beginPath();
          ctx.moveTo(w / 2, h / 2);
          ctx.lineTo(w / 2 + Math.cos(a) * 110, h / 2 + Math.sin(a) * 90);
          ctx.lineTo(w / 2 + Math.cos(a + 0.14) * 230, h / 2 + Math.sin(a + 0.14) * 190);
          ctx.stroke();
        }

        // Glowing crimson digital padlock icon (Ref Image 4 centerpiece!)
        ctx.strokeStyle = '#ff2a5f';
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2 - 42, 46, Math.PI, 0);
        ctx.stroke();

        ctx.fillStyle = '#ff1e56';
        ctx.fillRect(w / 2 - 72, h / 2 - 36, 144, 114);
        ctx.strokeStyle = '#fda4af';
        ctx.lineWidth = 3;
        ctx.strokeRect(w / 2 - 72, h / 2 - 36, 144, 114);

        // Keyhole silhouette
        ctx.fillStyle = '#12030a';
        ctx.beginPath();
        ctx.arc(w / 2, h / 2 + 12, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(w / 2 - 8, h / 2 + 18, 16, 36);

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, w - 16, h - 16);

        ctx.fillStyle = '#fca5a5';
        ctx.font = 'bold 17px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('NEXUS LOCKOUT · COMPOUND BQ-X9 SEALED', w / 2, h - 24);
      },
      maxAnisotropy
    )
  );

  // 9. Ref Image 2 — Octagonal BioQuest Hex Emblem Display
  const bioquestHexDisplay = register(
    makeCanvasTexture(
      512,
      384,
      (ctx, w, h) => {
        const bg = ctx.createRadialGradient(w / 2, h / 2, 15, w / 2, h / 2, 280);
        bg.addColorStop(0, '#073552');
        bg.addColorStop(0.6, '#041a30');
        bg.addColorStop(1, '#020b18');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Dot matrix pattern
        ctx.fillStyle = 'rgba(34, 211, 238, 0.22)';
        for (let x = 24; x < w - 24; x += 18) {
          for (let y = 24; y < h - 24; y += 18) {
            ctx.fillRect(x, y, 2, 2);
          }
        }

        // Octagonal bright cyan bezel border
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 10;
        const cut = 52;
        ctx.beginPath();
        ctx.moveTo(cut, 14);
        ctx.lineTo(w - cut, 14);
        ctx.lineTo(w - 14, cut);
        ctx.lineTo(w - 14, h - cut);
        ctx.lineTo(w - cut, h - 14);
        ctx.lineTo(cut, h - 14);
        ctx.lineTo(14, h - cut);
        ctx.lineTo(14, cut);
        ctx.closePath();
        ctx.stroke();

        // Crisp BioQuest hexagonal spiral emblem
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 12;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          const x = w / 2 + Math.cos(a) * 72;
          const y = h / 2 - 10 + Math.sin(a) * 72;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2 - 10, 32, 0.3, Math.PI * 1.8);
        ctx.stroke();

        ctx.fillStyle = '#7dd3fc';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BIOQUEST RESEARCH SYSTEMS · SECTOR 01', w / 2, h - 42);
      },
      maxAnisotropy
    )
  );

  // 10. Ref Image 2 — Biometric / Pharmacokinetics Anatomy Wall Display
  const biometricScanDisplay = register(
    makeCanvasTexture(
      768,
      440,
      (ctx, w, h) => {
        ctx.fillStyle = '#031526';
        ctx.fillRect(0, 0, w, h);

        // Octagonal cyan border
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 10;
        const c = 44;
        ctx.beginPath();
        ctx.moveTo(c, 12);
        ctx.lineTo(w - c, 12);
        ctx.lineTo(w - 12, c);
        ctx.lineTo(w - 12, h - c);
        ctx.lineTo(w - c, h - 12);
        ctx.lineTo(c, h - 12);
        ctx.lineTo(12, h - c);
        ctx.lineTo(12, c);
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 24px monospace';
        ctx.fillText('PHARMACOKINETICS & ADMET RESPONSE', 48, 58);

        // Left telemetry readout bars
        ctx.fillStyle = '#bae6fd';
        ctx.font = '16px monospace';
        const metrics = [
          ['BIOAVAILABILITY', 0.86],
          ['BBB PERMEABILITY', 0.62],
          ['HEPATIC CLEARANCE', 0.74],
          ['HERG CARDIOTOXICITY', 0.91],
          ['TARGET AFFINITY', 0.82],
        ] as const;
        metrics.forEach(([label, val], idx) => {
          const y = 108 + idx * 54;
          ctx.fillStyle = '#7dd3fc';
          ctx.fillText(label, 48, y);
          ctx.fillStyle = '#0c2a44';
          ctx.fillRect(48, y + 10, 260, 14);
          ctx.fillStyle = val > 0.88 ? '#34d399' : '#22d3ee';
          ctx.fillRect(48, y + 10, 260 * val, 14);
        });

        // Two glowing anatomical/receptor silhouettes (Ref Image 2 right wall)
        const drawBodyScan = (cx: number) => {
          ctx.strokeStyle = '#67e8f9';
          ctx.fillStyle = 'rgba(34, 211, 238, 0.25)';
          ctx.lineWidth = 3;
          // Head
          ctx.beginPath();
          ctx.arc(cx, 128, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Torso
          ctx.beginPath();
          ctx.roundRect(cx - 28, 156, 56, 98, 12);
          ctx.fill();
          ctx.stroke();
          // Arms
          ctx.beginPath();
          ctx.moveTo(cx - 32, 166);
          ctx.lineTo(cx - 52, 248);
          ctx.moveTo(cx + 32, 166);
          ctx.lineTo(cx + 52, 248);
          // Legs
          ctx.moveTo(cx - 14, 256);
          ctx.lineTo(cx - 22, 356);
          ctx.moveTo(cx + 14, 256);
          ctx.lineTo(cx + 22, 356);
          ctx.stroke();
          // Target receptor highlight rings
          ctx.strokeStyle = '#34d399';
          ctx.beginPath();
          ctx.arc(cx, 194, 16, 0, Math.PI * 2);
          ctx.stroke();
        };
        drawBodyScan(465);
        drawBodyScan(625);

        ctx.fillStyle = '#67e8f9';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('CLINICAL PHASE I · PRE-VALIDATION TELEMETRY', 48, h - 34);
      },
      maxAnisotropy
    )
  );

  // 11. Ref Image 1 — Glowing Holographic Projection Pad Texture
  const holoPadDisplay = register(
    makeCanvasTexture(
      512,
      512,
      (ctx, w, h) => {
        ctx.fillStyle = '#031226';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 8;
        ctx.strokeRect(18, 18, w - 36, h - 36);

        const cx = w / 2;
        const cy = h / 2;
        const grad = ctx.createRadialGradient(cx, cy, 12, cx, cy, 210);
        grad.addColorStop(0, 'rgba(103, 232, 249, 0.92)');
        grad.addColorStop(0.35, 'rgba(14, 165, 233, 0.45)');
        grad.addColorStop(0.75, 'rgba(14, 165, 233, 0.14)');
        grad.addColorStop(1, 'rgba(3, 18, 38, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 4;
        for (const r of [56, 112, 168, 206]) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Precision tick marks
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        for (let i = 0; i < 24; i++) {
          const a = (Math.PI * 2 * i) / 24;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * 140, cy + Math.sin(a) * 140);
          ctx.lineTo(cx + Math.cos(a) * 165, cy + Math.sin(a) * 165);
          ctx.stroke();
        }
      },
      maxAnisotropy
    )
  );

  // 12. Large Wall Display — Molecular Research & Drug Discovery Analytics
  const molecularWallScreen = register(
    makeCanvasTexture(
      768,
      384,
      (ctx, w, h) => {
        ctx.fillStyle = '#051024';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, w - 16, h - 16);

        ctx.fillStyle = '#0b2244';
        ctx.fillRect(14, 14, w - 28, 46);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 22px monospace';
        ctx.fillText('MOLECULAR RESEARCH WING · SMILES & LIPINSKI LAB', 28, 45);

        const drawHex = (cx: number, cy: number, r: number, col: string) => {
          ctx.strokeStyle = col;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i;
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        };
        drawHex(135, 195, 58, '#22d3ee');
        drawHex(236, 195, 58, '#34d399');
        drawHex(185, 280, 44, '#c084fc');

        ctx.fillStyle = '#e0f2fe';
        ctx.font = 'bold 18px monospace';
        ctx.fillText('ACTIVE CANDIDATE: BQ-X9-A', 355, 112);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '15px monospace';
        ctx.fillText('SMILES: CC(=O)Nc1ccc(O)cc1', 355, 146);
        ctx.fillText('MW <= 500 Da · LogP <= 5', 355, 178);
        ctx.fillText('HBD <= 5 · HBA <= 10 · TPSA 64 Å²', 355, 210);

        const barVals = [0.72, 0.88, 0.64, 0.94, 0.56, 0.82];
        barVals.forEach((v, idx) => {
          const bx = 355 + idx * 58;
          const bh = v * 92;
          ctx.fillStyle = idx % 2 === 0 ? '#0ea5e9' : '#a855f7';
          ctx.fillRect(bx, 336 - bh, 36, bh);
        });
      },
      maxAnisotropy
    )
  );

  // 13. Experimental Drug Storage Wall Display
  const drugStorageDisplay = register(
    makeCanvasTexture(
      640,
      320,
      (ctx, w, h) => {
        ctx.fillStyle = '#070f22';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 5;
        ctx.strokeRect(8, 8, w - 16, h - 16);

        ctx.fillStyle = '#1e1038';
        ctx.fillRect(14, 14, w - 28, 42);
        ctx.fillStyle = '#d8b4fe';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('EXPERIMENTAL DRUG STORAGE · CRYO-BAY B', 26, 42);

        const items = [
          ['BQ-X9 · PHASE I', 'SEALED · AUDIT REQUIRED', '#f87171'],
          ['BQ-104 · KINASE', 'VALIDATED · -80°C', '#34d399'],
          ['BQ-219 · PROTEASE', 'IN ASSAY · -80°C', '#38bdf8'],
          ['BQ-311 · CONTROL', 'ARCHIVE LOCKED', '#c084fc'],
        ];
        items.forEach(([name, status, col], idx) => {
          const y = 104 + idx * 50;
          ctx.fillStyle = '#e2e8f0';
          ctx.font = 'bold 17px monospace';
          ctx.fillText(name, 30, y);
          ctx.fillStyle = col;
          ctx.font = '15px monospace';
          ctx.fillText(status, 270, y);
        });
      },
      maxAnisotropy
    )
  );

  // 14. AI Monitoring Room Wall Display
  const aiMonitorWall = register(
    makeCanvasTexture(
      768,
      384,
      (ctx, w, h) => {
        ctx.fillStyle = '#050d1e';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 5;
        ctx.strokeRect(8, 8, w - 16, h - 16);

        ctx.fillStyle = '#0a203e';
        ctx.fillRect(14, 14, w - 28, 44);
        ctx.fillStyle = '#22d3ee';
        ctx.font = 'bold 21px monospace';
        ctx.fillText('NEXUS AI MONITORING · XGBOOST PREDICTIVE CORE', 26, 44);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 3; j++) {
            ctx.beginPath();
            ctx.moveTo(95, 110 + i * 62);
            ctx.lineTo(240, 140 + j * 70);
            ctx.stroke();
          }
        }
        ctx.fillStyle = '#38bdf8';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(95, 110 + i * 62, 11, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#c084fc';
        for (let j = 0; j < 3; j++) {
          ctx.beginPath();
          ctx.arc(240, 140 + j * 70, 12, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = '#e0f2fe';
        ctx.font = 'bold 17px monospace';
        ctx.fillText('SECURITY AUDIT LOG · LIVE', 330, 116);
        ctx.fillStyle = '#f87171';
        ctx.font = '15px monospace';
        ctx.fillText('[23:48] UNAPPROVED BQ-X9 EXPORT HALTED', 330, 158);
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('[23:49] EMERGENCY LOCKDOWN ENGAGED', 330, 194);
        ctx.fillStyle = '#34d399';
        ctx.fillText('[23:54] INVESTIGATOR CLEARANCE GRANTED', 330, 230);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('MODEL R² ACCURACY: 0.94 · FEATURE SYNC OK', 330, 286);
      },
      maxAnisotropy
    )
  );

  // 15. Secure Research Archive Wall Display
  const archiveWallDisplay = register(
    makeCanvasTexture(
      640,
      320,
      (ctx, w, h) => {
        ctx.fillStyle = '#060e20';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 5;
        ctx.strokeRect(8, 8, w - 16, h - 16);

        ctx.fillStyle = '#151c44';
        ctx.fillRect(14, 14, w - 28, 42);
        ctx.fillStyle = '#a5b4fc';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('SECURE RESEARCH ARCHIVE · VAULTS 01–05', 26, 42);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '15px monospace';
        ctx.fillText('V01 · BIOACTIVITY ARCHIVE (IC50)', 28, 102);
        ctx.fillText('V02 · SMILES LABORATORY', 28, 140);
        ctx.fillText('V03 · MOLECULAR DETECTIVE (LIPINSKI)', 28, 178);
        ctx.fillText('V04 · AI PREDICTION CHAMBER (XGBOOST)', 28, 216);
        ctx.fillText('V05 · FINAL RESEARCH DECISION', 28, 254);
      },
      maxAnisotropy
    )
  );

  // 16. Main Gate Screens
  const exitLocked = register(
    makeCanvasTexture(
      512,
      256,
      (ctx, w, h) => {
        ctx.fillStyle = '#1a060c';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, w - 16, h - 16);
        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SECURITY LOCKDOWN', w / 2, 74);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('BIOQUEST MAIN GATE SEALED', w / 2, 128);
        ctx.fillStyle = '#fbbf24';
        ctx.font = '17px monospace';
        ctx.fillText('VERIFY ALL 5 RESEARCH VAULTS', w / 2, 186);
      },
      maxAnisotropy
    )
  );

  const exitRestored = register(
    makeCanvasTexture(
      512,
      256,
      (ctx, w, h) => {
        ctx.fillStyle = '#051f1c';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, w - 16, h - 16);
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('LOCKDOWN LIFTED', w / 2, 74);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('5/5 AUTHENTICATION KEYS VERIFIED', w / 2, 128);
        ctx.fillStyle = '#a7f3d0';
        ctx.font = '17px monospace';
        ctx.fillText('GATEWAY TO FUTURE CITY OPEN', w / 2, 186);
      },
      maxAnisotropy
    )
  );

  // 17. Future City Plaza, Road & Sidewalk Textures (Preserved)
  const plazaGround = register(
    makeCanvasTexture(
      512,
      512,
      (ctx, w, h) => {
        ctx.fillStyle = '#dde5ee';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#c5d2e0';
        ctx.lineWidth = 3;
        const step = 64;
        for (let x = 0; x <= w; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y <= h; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(14, 165, 233, 0.16)';
        ctx.fillRect(0, h / 2 - 6, w, 12);
      },
      maxAnisotropy,
      14,
      14
    )
  );

  const cityRoad = register(
    makeCanvasTexture(
      512,
      512,
      (ctx, w, h) => {
        ctx.fillStyle = '#232b38';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 700; i++) {
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
          ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
        }
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(14, 0, 8, h);
        ctx.fillRect(w - 22, 0, 8, h);
        ctx.fillStyle = '#facc15';
        for (let y = 18; y < h; y += 72) {
          ctx.fillRect(w / 2 - 6, y, 12, 42);
        }
      },
      maxAnisotropy,
      1,
      10
    )
  );

  const citySidewalk = register(
    makeCanvasTexture(
      256,
      256,
      (ctx, w, h) => {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.beginPath();
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w / 2, h);
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
      },
      maxAnisotropy,
      8,
      8
    )
  );

  // 18. Vault Header Signs (Vaults 01–05)
  const vaultSigns = new Map<VaultId, THREE.CanvasTexture>();
  for (const v of VAULTS) {
    const tex = register(
      makeCanvasTexture(
        512,
        160,
        (ctx, w, h) => {
          ctx.fillStyle = '#061124';
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = v.accentHex;
          ctx.lineWidth = 6;
          ctx.strokeRect(6, 6, w - 12, h - 12);

          ctx.fillStyle = v.accentHex;
          ctx.font = 'bold 26px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${v.code.toUpperCase()} · ${v.wing.toUpperCase()}`, w / 2, 54);

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 30px sans-serif';
          ctx.fillText(v.title, w / 2, 114);
        },
        maxAnisotropy
      )
    );
    vaultSigns.set(v.id, tex);
  }

  return {
    floor,
    wall,
    monitorNormal,
    monitorAlert,
    drugRecordNormal,
    drugTransferAttempt,
    securityBreachAlert,
    breachPadlockDisplay,
    molecularWallScreen,
    biometricScanDisplay,
    bioquestHexDisplay,
    holoPadDisplay,
    drugStorageDisplay,
    aiMonitorWall,
    archiveWallDisplay,
    exitLocked,
    exitRestored,
    plazaGround,
    cityRoad,
    citySidewalk,
    vaultSigns,
    disposeAll: () => {
      for (const t of created) {
        t.dispose();
      }
    },
  };
}
