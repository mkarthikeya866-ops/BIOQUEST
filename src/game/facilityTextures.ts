import * as THREE from 'three';

export interface FacilityTextures {
  floor: THREE.CanvasTexture;
  wall: THREE.CanvasTexture;
  plazaGround: THREE.CanvasTexture;
  monitorNormal: THREE.CanvasTexture;
  monitorGlitch: THREE.CanvasTexture;
  exitLocked: THREE.CanvasTexture;
  exitRestored: THREE.CanvasTexture;
  chemicalSpillGreen: THREE.CanvasTexture;
  chemicalSpillAmber: THREE.CanvasTexture;
  fingerprintsOverlay: THREE.CanvasTexture;
  specimenWarning: THREE.CanvasTexture;
  vaultSigns: Map<number, THREE.CanvasTexture>;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, anisotropy);
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

export function createFacilityTextures(maxAnisotropy: number): FacilityTextures {
  const allTextures: THREE.CanvasTexture[] = [];

  // 1. Sleek Biotech Lab Floor Tiles
  const [fCanvas, fCtx] = makeCanvas(512, 512);
  fCtx.fillStyle = '#0d1422';
  fCtx.fillRect(0, 0, 512, 512);
  // Subtle micro grid
  fCtx.strokeStyle = '#18243a';
  fCtx.lineWidth = 3;
  fCtx.strokeRect(4, 4, 248, 248);
  fCtx.strokeRect(260, 4, 248, 248);
  fCtx.strokeRect(4, 260, 248, 248);
  fCtx.strokeRect(260, 260, 248, 248);
  // Faint specular metallic seam dots
  fCtx.fillStyle = '#243656';
  for (const x of [16, 240, 272, 496]) {
    for (const y of [16, 240, 272, 496]) {
      fCtx.fillRect(x - 2, y - 2, 4, 4);
    }
  }
  const floor = configureTexture(fCanvas, maxAnisotropy, 12, 10);
  allTextures.push(floor);

  // 2. Futuristic Cleanroom Wall Panels
  const [wCanvas, wCtx] = makeCanvas(512, 512);
  wCtx.fillStyle = '#121c2e';
  wCtx.fillRect(0, 0, 512, 512);
  wCtx.fillStyle = '#172338';
  wCtx.fillRect(10, 12, 492, 230);
  wCtx.fillRect(10, 268, 492, 232);
  wCtx.strokeStyle = '#0b111e';
  wCtx.lineWidth = 4;
  wCtx.strokeRect(10, 12, 492, 230);
  wCtx.strokeRect(10, 268, 492, 232);
  // Subtle cyan trim band along mid-wall
  wCtx.fillStyle = '#0e7490';
  wCtx.fillRect(0, 248, 512, 6);
  const wall = configureTexture(wCanvas, maxAnisotropy, 8, 1);
  allTextures.push(wall);

  // 3. Normal Operational Molecular Monitor
  const [mCanvas, mCtx] = makeCanvas(512, 320);
  mCtx.fillStyle = '#071324';
  mCtx.fillRect(0, 0, 512, 320);
  mCtx.strokeStyle = '#0891b2';
  mCtx.lineWidth = 3;
  mCtx.strokeRect(12, 12, 488, 296);
  mCtx.fillStyle = '#22d3ee';
  mCtx.font = 'bold 20px monospace';
  mCtx.fillText('BIOQUEST RESEARCH WORKSTATION', 28, 46);
  mCtx.fillStyle = '#67e8f9';
  mCtx.font = '14px monospace';
  mCtx.fillText('TARGET: EGFR / COX-2   ASSAY: IC50 SCREEN', 28, 74);
  mCtx.fillText('SMILES: Cc1ccc(NC(=O)c2ccccc2)cc1', 28, 100);
  // Draw clean hexagon molecular ring diagram
  mCtx.strokeStyle = '#22d3ee';
  mCtx.lineWidth = 3;
  mCtx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const x = 130 + Math.cos(a) * 46;
    const y = 200 + Math.sin(a) * 46;
    if (i === 0) mCtx.moveTo(x, y);
    else mCtx.lineTo(x, y);
  }
  mCtx.closePath();
  mCtx.stroke();
  // Bar graph on right
  mCtx.fillStyle = '#0ea5e9';
  const heights = [62, 108, 84, 130, 96, 118];
  heights.forEach((h, idx) => {
    mCtx.fillRect(250 + idx * 36, 260 - h, 22, h);
  });
  mCtx.fillStyle = '#10b981';
  mCtx.font = 'bold 15px monospace';
  mCtx.fillText('SYSTEM NOMINAL — ARCHIVE SYNC ACTIVE', 28, 290);
  const monitorNormal = configureTexture(mCanvas, maxAnisotropy);
  allTextures.push(monitorNormal);

  // 4. Glitched Critical Warning Monitor
  const [gCanvas, gCtx] = makeCanvas(512, 320);
  gCtx.fillStyle = '#1d070b';
  gCtx.fillRect(0, 0, 512, 320);
  // Corrupted horizontal glitch bands
  gCtx.fillStyle = '#450a0a';
  gCtx.fillRect(0, 48, 512, 22);
  gCtx.fillRect(0, 140, 512, 30);
  gCtx.fillRect(0, 245, 512, 18);
  gCtx.strokeStyle = '#ef4444';
  gCtx.lineWidth = 4;
  gCtx.strokeRect(10, 10, 492, 300);
  gCtx.fillStyle = '#f87171';
  gCtx.font = 'bold 28px monospace';
  gCtx.fillText('CRITICAL SYSTEM FAILURE', 52, 112);
  gCtx.fillStyle = '#fca5a5';
  gCtx.font = 'bold 20px monospace';
  gCtx.fillText('UNAUTHORIZED ACCESS DETECTED', 74, 152);
  gCtx.fillStyle = '#ef4444';
  gCtx.font = '15px monospace';
  gCtx.fillText('ERR: SMILES_PARSE_FAULT // BQ-409', 82, 206);
  gCtx.fillText('SAFEGUARD LEVEL 5 — LOCKDOWN ENGAGED', 74, 238);
  const monitorGlitch = configureTexture(gCanvas, maxAnisotropy);
  allTextures.push(monitorGlitch);

  // 5. Main Door Locked Screen (Place 5 Keys)
  const [eCanvas, eCtx] = makeCanvas(512, 256);
  eCtx.fillStyle = '#1f080b';
  eCtx.fillRect(0, 0, 512, 256);
  eCtx.strokeStyle = '#ef4444';
  eCtx.lineWidth = 6;
  eCtx.strokeRect(12, 12, 488, 232);
  eCtx.fillStyle = '#ef4444';
  eCtx.font = 'bold 32px monospace';
  eCtx.textAlign = 'center';
  eCtx.fillText('MAIN GATE LOCKED', 256, 86);
  eCtx.fillStyle = '#fca5a5';
  eCtx.font = 'bold 22px monospace';
  eCtx.fillText('PLACE ALL 5 KEYS AT CONSOLE', 256, 138);
  eCtx.fillStyle = '#f87171';
  eCtx.font = '16px monospace';
  eCtx.fillText('MODERN WORLD GATEWAY · ACCESS DENIED', 256, 194);
  const exitLocked = configureTexture(eCanvas, maxAnisotropy);
  allTextures.push(exitLocked);

  // 6. Main Door Open / Restored Screen
  const [rCanvas, rCtx] = makeCanvas(512, 256);
  rCtx.fillStyle = '#05221a';
  rCtx.fillRect(0, 0, 512, 256);
  rCtx.strokeStyle = '#10b981';
  rCtx.lineWidth = 6;
  rCtx.strokeRect(12, 12, 488, 232);
  rCtx.fillStyle = '#34d399';
  rCtx.font = 'bold 34px monospace';
  rCtx.textAlign = 'center';
  rCtx.fillText('MAIN GATE OPEN', 256, 86);
  rCtx.fillStyle = '#a7f3d0';
  rCtx.font = 'bold 22px monospace';
  rCtx.fillText('ALL 5 KEYS VERIFIED', 256, 138);
  rCtx.fillStyle = '#6ee7b7';
  rCtx.font = '16px monospace';
  rCtx.fillText('WALK THROUGH TO THE MODERN WORLD', 256, 194);
  const exitRestored = configureTexture(rCanvas, maxAnisotropy);
  allTextures.push(exitRestored);

  // 6b. Modern World Architectural Plaza Tiles
  const [pCanvas, pCtx] = makeCanvas(512, 512);
  pCtx.fillStyle = '#d7e3ee';
  pCtx.fillRect(0, 0, 512, 512);
  pCtx.fillStyle = '#cbd8e6';
  pCtx.fillRect(6, 6, 244, 244);
  pCtx.fillRect(262, 262, 244, 244);
  pCtx.strokeStyle = '#94a3b8';
  pCtx.lineWidth = 3;
  pCtx.strokeRect(4, 4, 248, 248);
  pCtx.strokeRect(260, 4, 248, 248);
  pCtx.strokeRect(4, 260, 248, 248);
  pCtx.strokeRect(260, 260, 248, 248);
  // Subtle modern cyan solar inlay accent
  pCtx.fillStyle = '#38bdf8';
  pCtx.fillRect(250, 0, 12, 512);
  pCtx.fillRect(0, 250, 512, 12);
  const plazaGround = configureTexture(pCanvas, maxAnisotropy, 18, 18);
  allTextures.push(plazaGround);

  // 6c. Toxic Chemical Spill Puddle (Green Acidic)
  const makeSpillTexture = (coreHex: string, midHex: string, edgeHex: string) => {
    const [sCanvas, sCtx] = makeCanvas(256, 256);
    sCtx.clearRect(0, 0, 256, 256);
    const drawBlob = (cx: number, cy: number, r: number, alpha: number) => {
      const grad = sCtx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      grad.addColorStop(0, coreHex);
      grad.addColorStop(0.55, midHex);
      grad.addColorStop(1, edgeHex);
      sCtx.globalAlpha = alpha;
      sCtx.fillStyle = grad;
      sCtx.beginPath();
      sCtx.arc(cx, cy, r, 0, Math.PI * 2);
      sCtx.fill();
    };
    drawBlob(128, 128, 86, 0.92);
    drawBlob(82, 102, 48, 0.85);
    drawBlob(174, 146, 54, 0.82);
    drawBlob(148, 78, 36, 0.78);
    drawBlob(72, 168, 30, 0.72);
    // Tiny chemical bubbles
    sCtx.globalAlpha = 0.65;
    sCtx.strokeStyle = '#ffffff';
    sCtx.lineWidth = 1.5;
    for (const [bx, by, br] of [
      [115, 118, 6],
      [148, 134, 4],
      [96, 142, 5],
      [162, 108, 3.5],
    ]) {
      sCtx.beginPath();
      sCtx.arc(bx, by, br, 0, Math.PI * 2);
      sCtx.stroke();
    }
    const tex = configureTexture(sCanvas, maxAnisotropy);
    allTextures.push(tex);
    return tex;
  };

  const chemicalSpillGreen = makeSpillTexture('#a3e635', '#4d7c0f', 'rgba(20, 83, 45, 0)');
  const chemicalSpillAmber = makeSpillTexture('#f59e0b', '#9a3412', 'rgba(69, 10, 10, 0)');

  // 6d. Smudged Fingerprints, Frantic Palm Prints & Glass Streaks
  const [fpCanvas, fpCtx] = makeCanvas(512, 512);
  fpCtx.clearRect(0, 0, 512, 512);
  const drawHandprint = (cx: number, cy: number, scale: number, rot: number, stainColor: string) => {
    fpCtx.save();
    fpCtx.translate(cx, cy);
    fpCtx.rotate(rot);
    fpCtx.scale(scale, scale);
    fpCtx.fillStyle = stainColor;
    // Palm smudge
    fpCtx.beginPath();
    fpCtx.ellipse(0, 16, 26, 30, 0, 0, Math.PI * 2);
    fpCtx.fill();
    // Five smeared fingers + drag streaks downward
    const fingers: Array<[number, number, number, number]> = [
      [-28, -4, 7, 19],
      [-15, -28, 7, 24],
      [0, -34, 7.5, 27],
      [15, -26, 7, 23],
      [27, -14, 6.5, 18],
    ];
    for (const [fx, fy, rx, ry] of fingers) {
      fpCtx.beginPath();
      fpCtx.ellipse(fx, fy, rx, ry, 0, 0, Math.PI * 2);
      fpCtx.fill();
      // Subtle downward smudge trail
      fpCtx.fillRect(fx - 2.5, fy, 5, 42);
    }
    fpCtx.restore();
  };

  drawHandprint(140, 210, 1.25, -0.18, 'rgba(153, 27, 27, 0.46)');
  drawHandprint(350, 280, 1.1, 0.24, 'rgba(132, 204, 22, 0.34)');
  drawHandprint(255, 130, 0.85, 0.08, 'rgba(148, 163, 184, 0.32)');
  // Scattered individual fingerprint whorls
  for (const [fx, fy, col] of [
    [90, 360, 'rgba(185, 28, 28, 0.42)'],
    [112, 345, 'rgba(185, 28, 28, 0.35)'],
    [134, 355, 'rgba(185, 28, 28, 0.3)'],
    [390, 120, 'rgba(163, 230, 53, 0.36)'],
    [412, 136, 'rgba(163, 230, 53, 0.28)'],
    [220, 410, 'rgba(203, 213, 225, 0.34)'],
    [244, 398, 'rgba(203, 213, 225, 0.28)'],
  ] as Array<[number, number, string]>) {
    fpCtx.strokeStyle = col;
    fpCtx.lineWidth = 2;
    for (let r = 4; r <= 12; r += 3.5) {
      fpCtx.beginPath();
      fpCtx.ellipse(fx, fy, r * 0.72, r, 0.2, 0, Math.PI * 2);
      fpCtx.stroke();
    }
  }
  const fingerprintsOverlay = configureTexture(fpCanvas, maxAnisotropy);
  allTextures.push(fingerprintsOverlay);

  // 6e. Cracked Failed Bio-Specimen Warning Plate
  const [spCanvas, spCtx] = makeCanvas(256, 128);
  spCtx.fillStyle = '#180a0b';
  spCtx.fillRect(0, 0, 256, 128);
  spCtx.strokeStyle = '#d97706';
  spCtx.lineWidth = 5;
  spCtx.strokeRect(6, 6, 244, 116);
  spCtx.fillStyle = '#f59e0b';
  spCtx.font = 'bold 20px monospace';
  spCtx.textAlign = 'center';
  spCtx.fillText('CONTAINMENT FAULT', 128, 46);
  spCtx.fillStyle = '#ef4444';
  spCtx.font = 'bold 16px monospace';
  spCtx.fillText('FAILED EXPERIMENT', 128, 78);
  spCtx.fillStyle = '#a3e635';
  spCtx.font = '13px monospace';
  spCtx.fillText('TOXIC VAPOR LEAK · [E] AUDIT', 128, 106);
  const specimenWarning = configureTexture(spCanvas, maxAnisotropy);
  allTextures.push(specimenWarning);

  // 7. Vault Header Signs
  const vaultMeta: Array<{ id: number; code: string; title: string; color: string }> = [
    { id: 1, code: 'VAULT 01', title: 'THE BIOACTIVITY ARCHIVE', color: '#06b6d4' },
    { id: 2, code: 'VAULT 02', title: 'THE SMILES LABORATORY', color: '#38bdf8' },
    { id: 3, code: 'VAULT 03', title: 'THE MOLECULAR DETECTIVE', color: '#2dd4bf' },
    { id: 4, code: 'VAULT 04', title: 'AI PREDICTION CHAMBER', color: '#818cf8' },
    { id: 5, code: 'VAULT 05', title: 'FINAL RESEARCH MISSION', color: '#10b981' },
  ];

  const vaultSigns = new Map<number, THREE.CanvasTexture>();
  for (const vm of vaultMeta) {
    const [vCanvas, vCtx] = makeCanvas(512, 144);
    vCtx.fillStyle = '#0a1222';
    vCtx.fillRect(0, 0, 512, 144);
    vCtx.strokeStyle = vm.color;
    vCtx.lineWidth = 4;
    vCtx.strokeRect(8, 8, 496, 128);
    vCtx.fillStyle = vm.color;
    vCtx.font = 'bold 34px monospace';
    vCtx.textAlign = 'center';
    vCtx.fillText(vm.code, 256, 62);
    vCtx.fillStyle = '#e2e8f0';
    vCtx.font = 'bold 20px monospace';
    vCtx.fillText(vm.title, 256, 106);
    const tex = configureTexture(vCanvas, maxAnisotropy);
    vaultSigns.set(vm.id, tex);
    allTextures.push(tex);
  }

  return {
    floor,
    wall,
    plazaGround,
    monitorNormal,
    monitorGlitch,
    exitLocked,
    exitRestored,
    chemicalSpillGreen,
    chemicalSpillAmber,
    fingerprintsOverlay,
    specimenWarning,
    vaultSigns,
    dispose: () => {
      allTextures.forEach((t) => t.dispose());
    },
  };
}
