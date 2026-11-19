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
  bloodDragTrail: THREE.CanvasTexture;
  fingerprintsOverlay: THREE.CanvasTexture;
  specimenWarning: THREE.CanvasTexture;
  fogSprite: THREE.CanvasTexture;
  horrorWallScrawls: THREE.CanvasTexture[];
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

  // 1. Grungy, Corroded, Blood-Stained Dark Horror Lab Floor Tiles
  const [fCanvas, fCtx] = makeCanvas(512, 512);
  fCtx.fillStyle = '#07090d';
  fCtx.fillRect(0, 0, 512, 512);
  // Dark grime & oil mottling across concrete/steel panels
  for (let i = 0; i < 42; i++) {
    const gx = (i * 97) % 512;
    const gy = (i * 173) % 512;
    const gr = 28 + (i % 5) * 18;
    const g = fCtx.createRadialGradient(gx, gy, 2, gx, gy, gr);
    g.addColorStop(0, i % 4 === 0 ? 'rgba(65, 12, 12, 0.28)' : 'rgba(18, 22, 26, 0.42)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    fCtx.fillStyle = g;
    fCtx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }
  // Rusted metallic floor panel seams
  fCtx.strokeStyle = '#1b1718';
  fCtx.lineWidth = 4;
  fCtx.strokeRect(4, 4, 248, 248);
  fCtx.strokeRect(260, 4, 248, 248);
  fCtx.strokeRect(4, 260, 248, 248);
  fCtx.strokeRect(260, 260, 248, 248);
  // Jagged floor cracks
  fCtx.strokeStyle = '#020305';
  fCtx.lineWidth = 2.5;
  fCtx.beginPath();
  fCtx.moveTo(42, 18);
  fCtx.lineTo(88, 92);
  fCtx.lineTo(132, 118);
  fCtx.lineTo(185, 205);
  fCtx.moveTo(310, 290);
  fCtx.lineTo(368, 355);
  fCtx.lineTo(445, 392);
  fCtx.stroke();
  // Dried crimson splatter dots & scuff marks
  fCtx.fillStyle = 'rgba(110, 14, 14, 0.45)';
  for (const [bx, by, br] of [
    [118, 124, 14],
    [136, 134, 6],
    [380, 340, 11],
    [396, 362, 5],
    [220, 420, 8],
  ]) {
    fCtx.beginPath();
    fCtx.arc(bx, by, br, 0, Math.PI * 2);
    fCtx.fill();
  }
  const floor = configureTexture(fCanvas, maxAnisotropy, 12, 10);
  allTextures.push(floor);

  // 2. Weathered, Rust-Streaked Dark Containment Wall Panels
  const [wCanvas, wCtx] = makeCanvas(512, 512);
  wCtx.fillStyle = '#0a0c12';
  wCtx.fillRect(0, 0, 512, 512);
  wCtx.fillStyle = '#0e1118';
  wCtx.fillRect(10, 12, 492, 228);
  wCtx.fillRect(10, 270, 492, 230);
  // Vertical leaking grime & rust streaks dripping downward
  for (let i = 0; i < 18; i++) {
    const sx = 24 + ((i * 67) % 468);
    const len = 90 + (i % 4) * 70;
    const grad = wCtx.createLinearGradient(sx, 12, sx, 12 + len);
    grad.addColorStop(0, i % 3 === 0 ? 'rgba(95, 16, 16, 0.55)' : 'rgba(20, 26, 14, 0.52)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    wCtx.fillStyle = grad;
    wCtx.fillRect(sx, 12, 6 + (i % 5) * 3, len);
  }
  wCtx.strokeStyle = '#040508';
  wCtx.lineWidth = 5;
  wCtx.strokeRect(10, 12, 492, 228);
  wCtx.strokeRect(10, 270, 492, 230);
  // Weathered dark crimson bio-hazard trim band
  wCtx.fillStyle = '#5c1116';
  wCtx.fillRect(0, 246, 512, 10);
  wCtx.fillStyle = '#1f0709';
  for (let x = 0; x < 512; x += 36) {
    wCtx.fillRect(x, 246, 14, 10);
  }
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

  // 4. Glitched Critical Horror Monitor
  const [gCanvas, gCtx] = makeCanvas(512, 320);
  gCtx.fillStyle = '#170306';
  gCtx.fillRect(0, 0, 512, 320);
  gCtx.fillStyle = '#450a0a';
  gCtx.fillRect(0, 42, 512, 26);
  gCtx.fillRect(0, 136, 512, 34);
  gCtx.fillRect(0, 240, 512, 22);
  gCtx.strokeStyle = '#dc2626';
  gCtx.lineWidth = 5;
  gCtx.strokeRect(10, 10, 492, 300);
  gCtx.fillStyle = '#ef4444';
  gCtx.font = 'bold 28px monospace';
  gCtx.fillText('CONTAINMENT BREACH 2045', 46, 108);
  gCtx.fillStyle = '#fca5a5';
  gCtx.font = 'bold 20px monospace';
  gCtx.fillText('BIO-HAZARD LEVEL 5 · LOCKDOWN', 66, 152);
  gCtx.fillStyle = '#f87171';
  gCtx.font = '15px monospace';
  gCtx.fillText('ERR: SPECIMEN ESCAPE // TOXIC LEAK', 84, 206);
  gCtx.fillText('RECOVER ALL 5 VAULT KEYS TO ESCAPE', 84, 238);
  const monitorGlitch = configureTexture(gCanvas, maxAnisotropy);
  allTextures.push(monitorGlitch);

  // 5. Main Door Locked Screen (Place 5 Keys)
  const [eCanvas, eCtx] = makeCanvas(512, 256);
  eCtx.fillStyle = '#180306';
  eCtx.fillRect(0, 0, 512, 256);
  eCtx.strokeStyle = '#dc2626';
  eCtx.lineWidth = 6;
  eCtx.strokeRect(12, 12, 488, 232);
  eCtx.fillStyle = '#ef4444';
  eCtx.font = 'bold 34px monospace';
  eCtx.textAlign = 'center';
  eCtx.fillText('MAIN GATE SEALED', 256, 86);
  eCtx.fillStyle = '#fca5a5';
  eCtx.font = 'bold 22px monospace';
  eCtx.fillText('PLACE ALL 5 KEYS AT CONSOLE', 256, 138);
  eCtx.fillStyle = '#f87171';
  eCtx.font = '16px monospace';
  eCtx.fillText('QUARANTINE PROTOCOL 2045 · NO EXIT', 256, 194);
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
  pCtx.fillStyle = '#38bdf8';
  pCtx.fillRect(250, 0, 12, 512);
  pCtx.fillRect(0, 250, 512, 12);
  const plazaGround = configureTexture(pCanvas, maxAnisotropy, 18, 18);
  allTextures.push(plazaGround);

  // 6c. Toxic Chemical Spill Puddles (Glowing Acidic Green & Corrosive Blood-Amber)
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
    drawBlob(128, 128, 92, 0.95);
    drawBlob(78, 98, 52, 0.88);
    drawBlob(176, 148, 56, 0.86);
    drawBlob(148, 76, 40, 0.82);
    drawBlob(70, 170, 34, 0.78);
    sCtx.globalAlpha = 0.72;
    sCtx.strokeStyle = '#ffffff';
    sCtx.lineWidth = 1.6;
    for (const [bx, by, br] of [
      [115, 118, 7],
      [148, 134, 4.5],
      [96, 142, 5.5],
      [162, 108, 4],
    ]) {
      sCtx.beginPath();
      sCtx.arc(bx, by, br, 0, Math.PI * 2);
      sCtx.stroke();
    }
    const tex = configureTexture(sCanvas, maxAnisotropy);
    allTextures.push(tex);
    return tex;
  };

  const chemicalSpillGreen = makeSpillTexture('#a3e635', '#3f6212', 'rgba(20, 83, 45, 0)');
  const chemicalSpillAmber = makeSpillTexture('#dc2626', '#7f1d1d', 'rgba(45, 5, 5, 0)');

  // 6d. Crimson Blood & Sludge Floor Drag Trail (leading out of breached containment pods)
  const [bdCanvas, bdCtx] = makeCanvas(256, 512);
  bdCtx.clearRect(0, 0, 256, 512);
  for (let i = 0; i < 6; i++) {
    const x = 58 + i * 26 + Math.sin(i * 1.9) * 8;
    const grad = bdCtx.createLinearGradient(x, 20, x, 495);
    grad.addColorStop(0, 'rgba(135, 12, 16, 0.88)');
    grad.addColorStop(0.55, 'rgba(92, 8, 12, 0.65)');
    grad.addColorStop(1, 'rgba(40, 4, 6, 0)');
    bdCtx.fillStyle = grad;
    bdCtx.fillRect(x - 6, 20, 12 + (i % 2) * 6, 475);
  }
  for (let s = 0; s < 24; s++) {
    const sx = 30 + ((s * 43) % 196);
    const sy = 30 + ((s * 83) % 440);
    bdCtx.fillStyle = 'rgba(155, 16, 20, 0.72)';
    bdCtx.beginPath();
    bdCtx.arc(sx, sy, 3 + (s % 6) * 2.5, 0, Math.PI * 2);
    bdCtx.fill();
  }
  const bloodDragTrail = configureTexture(bdCanvas, maxAnisotropy);
  allTextures.push(bloodDragTrail);

  // 6e. Vivid Bloody Palm Prints, Frantic Claw Drag Marks & Fingerprints
  const [fpCanvas, fpCtx] = makeCanvas(512, 512);
  fpCtx.clearRect(0, 0, 512, 512);
  const drawHandprint = (cx: number, cy: number, scale: number, rot: number, stainColor: string) => {
    fpCtx.save();
    fpCtx.translate(cx, cy);
    fpCtx.rotate(rot);
    fpCtx.scale(scale, scale);
    fpCtx.fillStyle = stainColor;
    fpCtx.beginPath();
    fpCtx.ellipse(0, 16, 28, 32, 0, 0, Math.PI * 2);
    fpCtx.fill();
    const fingers: Array<[number, number, number, number]> = [
      [-30, -4, 7.5, 20],
      [-15, -30, 7.5, 26],
      [0, -36, 8, 29],
      [16, -28, 7.5, 25],
      [29, -15, 7, 19],
    ];
    for (const [fx, fy, rx, ry] of fingers) {
      fpCtx.beginPath();
      fpCtx.ellipse(fx, fy, rx, ry, 0, 0, Math.PI * 2);
      fpCtx.fill();
      // Long frantic downward claw drag streaks
      fpCtx.fillRect(fx - 3, fy, 6, 86);
    }
    fpCtx.restore();
  };

  drawHandprint(145, 195, 1.38, -0.16, 'rgba(185, 18, 22, 0.78)');
  drawHandprint(355, 265, 1.25, 0.22, 'rgba(153, 14, 18, 0.68)');
  drawHandprint(255, 120, 0.95, 0.08, 'rgba(132, 204, 22, 0.56)');
  for (const [fx, fy, col] of [
    [88, 360, 'rgba(205, 22, 26, 0.7)'],
    [112, 345, 'rgba(205, 22, 26, 0.62)'],
    [136, 355, 'rgba(205, 22, 26, 0.56)'],
    [390, 120, 'rgba(163, 230, 53, 0.62)'],
    [412, 136, 'rgba(163, 230, 53, 0.52)'],
    [220, 410, 'rgba(185, 28, 28, 0.58)'],
    [244, 398, 'rgba(185, 28, 28, 0.52)'],
  ] as Array<[number, number, string]>) {
    fpCtx.strokeStyle = col;
    fpCtx.lineWidth = 2.4;
    for (let r = 4; r <= 13; r += 3.5) {
      fpCtx.beginPath();
      fpCtx.ellipse(fx, fy, r * 0.72, r, 0.2, 0, Math.PI * 2);
      fpCtx.stroke();
    }
  }
  const fingerprintsOverlay = configureTexture(fpCanvas, maxAnisotropy);
  allTextures.push(fingerprintsOverlay);

  // 6f. Cracked Failed Bio-Specimen Warning Plate
  const [spCanvas, spCtx] = makeCanvas(256, 128);
  spCtx.fillStyle = '#180507';
  spCtx.fillRect(0, 0, 256, 128);
  spCtx.strokeStyle = '#dc2626';
  spCtx.lineWidth = 5;
  spCtx.strokeRect(6, 6, 244, 116);
  spCtx.fillStyle = '#ef4444';
  spCtx.font = 'bold 20px monospace';
  spCtx.textAlign = 'center';
  spCtx.fillText('CONTAINMENT BREACH', 128, 46);
  spCtx.fillStyle = '#fca5a5';
  spCtx.font = 'bold 16px monospace';
  spCtx.fillText('FAILED SPECIMEN', 128, 78);
  spCtx.fillStyle = '#a3e635';
  spCtx.font = '13px monospace';
  spCtx.fillText('DO NOT APPROACH · BIO-LEAK', 128, 106);
  const specimenWarning = configureTexture(spCanvas, maxAnisotropy);
  allTextures.push(specimenWarning);

  // 6g. Soft Volumetric Mist Sprite Texture (for thick eerie floor fog & toxic vapor)
  const [fogCanvas, fogCtx] = makeCanvas(128, 128);
  const fGrad = fogCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
  fGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
  fGrad.addColorStop(0.4, 'rgba(210, 235, 220, 0.35)');
  fGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  fogCtx.fillStyle = fGrad;
  fogCtx.fillRect(0, 0, 128, 128);
  const fogSprite = configureTexture(fogCanvas, maxAnisotropy);
  allTextures.push(fogSprite);

  // 6h. Scrawled Desperate Bloody Wall Warnings
  const makeScrawl = (line1: string, line2: string) => {
    const [scCanvas, scCtx] = makeCanvas(512, 256);
    scCtx.clearRect(0, 0, 512, 256);
    scCtx.save();
    scCtx.translate(256, 118);
    scCtx.rotate(-0.06);
    scCtx.textAlign = 'center';
    scCtx.fillStyle = 'rgba(185, 16, 20, 0.88)';
    scCtx.font = 'bold 46px monospace';
    scCtx.fillText(line1, 0, -10);
    scCtx.fillStyle = 'rgba(148, 12, 16, 0.82)';
    scCtx.font = 'bold 34px monospace';
    scCtx.fillText(line2, 0, 44);
    scCtx.restore();
    // Dripping blood streaks from letters
    for (let d = 0; d < 18; d++) {
      const dx = 68 + ((d * 29) % 380);
      const dy = 110 + (d % 3) * 28;
      const dLen = 28 + (d % 5) * 18;
      const g = scCtx.createLinearGradient(dx, dy, dx, dy + dLen);
      g.addColorStop(0, 'rgba(170, 14, 18, 0.78)');
      g.addColorStop(1, 'rgba(90, 5, 8, 0)');
      scCtx.fillStyle = g;
      scCtx.fillRect(dx, dy, 3 + (d % 3), dLen);
    }
    const tex = configureTexture(scCanvas, maxAnisotropy);
    allTextures.push(tex);
    return tex;
  };

  const horrorWallScrawls = [
    makeScrawl("DON'T LOOK UP", 'IT IS WATCHING'),
    makeScrawl('BREACH 2045', 'DO NOT BREATHE'),
    makeScrawl('5 KEYS OR DIE', 'GET OUT NOW'),
  ];

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
    bloodDragTrail,
    fingerprintsOverlay,
    specimenWarning,
    fogSprite,
    horrorWallScrawls,
    vaultSigns,
    dispose: () => {
      allTextures.forEach((t) => t.dispose());
    },
  };
}
