import * as THREE from 'three';
import { FacilityTextures } from './facilityTextures';
import { ResearcherCharacter } from './ResearcherCharacter';

export interface ZoneCollider {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY?: number;
  active: boolean;
}

export interface ZoneEvidenceNode {
  id: string;
  position: THREE.Vector3;
  radius: number;
  label: string;
  sublabel: string;
}

interface RoboticArmRig {
  basePivot: THREE.Group;
  shoulderPivot: THREE.Group;
  elbowPivot: THREE.Group;
  phase: number;
}

interface NpcResearcherRig {
  character: ResearcherCharacter;
  waypoints: Array<{ x: number; y: number; z: number; pauseSec: number; faceYaw?: number }>;
  currentIndex: number;
  pauseTimer: number;
  pos: THREE.Vector3;
  yaw: number;
  prevYaw: number;
  walkSpeed: number;
}

export interface RedesignedFacilityZones {
  entryAirlockLeft: THREE.Mesh;
  entryAirlockRight: THREE.Mesh;
  rotatingHolograms: THREE.Group[];
  serverLedMats: THREE.MeshStandardMaterial[];
  colliders: ZoneCollider[];
  evidenceNodes: ZoneEvidenceNode[];
  getElevationAt: (x: number, z: number, currentY: number) => number;
  update: (dt: number, elapsedSec: number, isLockdown: boolean) => void;
  dispose: () => void;
}

/**
 * Builds the expansive 68m x 62m x 13.5m multi-level BioQuest Research Complex
 * directly inspired by the 5 AAA reference visual blueprints:
 * 1. Grand Holographic Molecular Synthesis Ring with 7 floating glowing proteins & pads
 * 2. Radial Spoked Turbine LED Ceiling Lights, Octagonal Cyan Wall Displays & Real Lab Glassware
 * 3. Curved Cyan Containment Observation Tank + Volumetric God-Ray Light Shafts + Red/Cyan Contrast
 * 4. Automated Pharma Conveyor Line with Moving Vials, Animated Robotic Pipette Arms,
 *    Central Compound BQ-X9 Core & Crimson Breach Padlock Display
 * 5. Walkable Elevated Mezzanine Observation Balcony + Dual Grand Staircases + Giant Overhead Hexagonal Halo
 * 6. Six Animated NPC Lab Scientists patrolling & working across the facility
 */
export function buildRedesignedFacilityZones(
  scene: THREE.Scene,
  textures: FacilityTextures,
  track: <T extends { dispose: () => void }>(item: T) => T,
  enableShadows = true
): RedesignedFacilityZones {
  const colliders: ZoneCollider[] = [];
  const evidenceNodes: ZoneEvidenceNode[] = [];
  const rotatingHolograms: THREE.Group[] = [];
  const serverLedMats: THREE.MeshStandardMaterial[] = [];
  const roboticArms: RoboticArmRig[] = [];
  const conveyorVials: THREE.Mesh[] = [];
  const breachDataCubes: Array<{ mesh: THREE.Mesh; baseX: number; baseZ: number; speed: number; phase: number }> = [];
  const npcRigs: NpcResearcherRig[] = [];

  // Shared high-craft PBR Materials
  const darkTitanium = track(new THREE.MeshStandardMaterial({ color: '#111b30', metalness: 0.84, roughness: 0.24 }));
  const brushedSteel = track(new THREE.MeshStandardMaterial({ color: '#273a59', metalness: 0.78, roughness: 0.28 }));
  const whiteLabComposite = track(new THREE.MeshStandardMaterial({ color: '#dbe7f3', metalness: 0.16, roughness: 0.34 }));
  const cyanNeon = track(
    new THREE.MeshStandardMaterial({
      color: '#67e8f9',
      emissive: '#06b6d4',
      emissiveIntensity: 2.0,
      roughness: 0.15,
    })
  );
  const emeraldNeon = track(
    new THREE.MeshStandardMaterial({
      color: '#6ee7b7',
      emissive: '#10b981',
      emissiveIntensity: 1.9,
      roughness: 0.15,
    })
  );
  const electricBlueNeon = track(
    new THREE.MeshStandardMaterial({
      color: '#60a5fa',
      emissive: '#2563eb',
      emissiveIntensity: 1.95,
      roughness: 0.15,
    })
  );
  const purpleNeon = track(
    new THREE.MeshStandardMaterial({
      color: '#c084fc',
      emissive: '#9333ea',
      emissiveIntensity: 1.75,
      roughness: 0.18,
    })
  );
  const crimsonNeon = track(
    new THREE.MeshStandardMaterial({
      color: '#fb7185',
      emissive: '#e11d48',
      emissiveIntensity: 2.2,
      roughness: 0.15,
    })
  );
  const glassWallMat = track(
    new THREE.MeshPhysicalMaterial({
      color: '#7dd3fc',
      roughness: 0.08,
      metalness: 0.08,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })
  );
  const flaskGlassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: '#e0f2fe',
      roughness: 0.06,
      metalness: 0.1,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    })
  );

  // Reusable LatheGeometry for authentic Erlenmeyer Flasks (Ref Image 2!)
  const flaskPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.11, 0.0),
    new THREE.Vector2(0.115, 0.03),
    new THREE.Vector2(0.042, 0.2),
    new THREE.Vector2(0.04, 0.3),
    new THREE.Vector2(0.052, 0.31),
  ];
  const erlenmeyerGeo = track(new THREE.LatheGeometry(flaskPoints, 14));
  const beakerGeo = track(new THREE.CylinderGeometry(0.065, 0.06, 0.18, 12, 1, true));

  const addLabGlasswareCluster = (parent: THREE.Object3D, x: number, y: number, z: number, liquidMat: THREE.Material) => {
    const cluster = new THREE.Group();
    cluster.position.set(x, y, z);
    const f1 = new THREE.Mesh(erlenmeyerGeo, flaskGlassMat);
    const liq1 = new THREE.Mesh(track(new THREE.CylinderGeometry(0.055, 0.095, 0.08, 12)), liquidMat);
    liq1.position.y = 0.045;
    const b1 = new THREE.Mesh(beakerGeo, flaskGlassMat);
    b1.position.set(0.24, 0.09, -0.06);
    const liq2 = new THREE.Mesh(track(new THREE.CylinderGeometry(0.052, 0.052, 0.1, 10)), cyanNeon);
    liq2.position.set(0.24, 0.055, -0.06);
    const f2 = new THREE.Mesh(erlenmeyerGeo, flaskGlassMat);
    f2.scale.setScalar(0.76);
    f2.position.set(-0.22, 0, 0.08);
    cluster.add(f1, liq1, b1, liq2, f2);
    parent.add(cluster);
  };

  // =========================================================================
  // 1. SOUTH INVESTIGATOR AIRLOCK & RADIAL TURBINE CEILING HALL (Ref #2)
  // =========================================================================
  const airlockZ = 40.3;
  const airlockFrame = new THREE.Group();
  airlockFrame.position.set(0, 0, airlockZ);

  const alPostGeo = track(new THREE.BoxGeometry(0.7, 5.2, 1.1));
  const alPostL = new THREE.Mesh(alPostGeo, darkTitanium);
  alPostL.position.set(-3.1, 2.6, 0);
  const alPostR = new THREE.Mesh(alPostGeo, darkTitanium);
  alPostR.position.set(3.1, 2.6, 0);
  const alLintel = new THREE.Mesh(track(new THREE.BoxGeometry(6.9, 0.9, 1.15)), darkTitanium);
  alLintel.position.set(0, 5.45, 0);
  const alBeacon = new THREE.Mesh(track(new THREE.BoxGeometry(5.6, 0.14, 0.18)), cyanNeon);
  alBeacon.position.set(0, 5.0, -0.58);

  const alDoorGeo = track(new THREE.BoxGeometry(2.75, 4.95, 0.28));
  const entryAirlockLeft = new THREE.Mesh(alDoorGeo, brushedSteel);
  entryAirlockLeft.position.set(-1.38, 2.48, 0);
  const entryAirlockRight = new THREE.Mesh(alDoorGeo, brushedSteel);
  entryAirlockRight.position.set(1.38, 2.48, 0);

  airlockFrame.add(alPostL, alPostR, alLintel, alBeacon, entryAirlockLeft, entryAirlockRight);
  scene.add(airlockFrame);

  // Signature Radial Spoked Turbine LED Ceiling Fixtures (Directly from Ref Image 2!)
  const buildTurbineCeilingLight = (x: number, y: number, z: number, radius: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const outerBezel = new THREE.Mesh(track(new THREE.TorusGeometry(radius, 0.18, 10, 28)), darkTitanium);
    outerBezel.rotation.x = Math.PI / 2;
    const innerRing = new THREE.Mesh(track(new THREE.TorusGeometry(radius * 0.86, 0.06, 8, 28)), cyanNeon);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = -0.06;
    const hub = new THREE.Mesh(track(new THREE.CylinderGeometry(radius * 0.16, radius * 0.18, 0.22, 16)), darkTitanium);
    g.add(outerBezel, innerRing, hub);

    const spokeGeo = track(new THREE.BoxGeometry(radius * 0.72, 0.05, 0.08));
    for (let s = 0; s < 14; s++) {
      const a = (Math.PI * 2 * s) / 14;
      const spoke = new THREE.Mesh(spokeGeo, cyanNeon);
      spoke.position.set(Math.cos(a) * radius * 0.48, -0.05, Math.sin(a) * radius * 0.48);
      spoke.rotation.y = -a;
      g.add(spoke);
    }
    scene.add(g);
  };

  // Place iconic spoked turbine lights across the entry hall & lateral wings
  buildTurbineCeilingLight(-5.2, 13.15, 31.5, 2.6);
  buildTurbineCeilingLight(5.2, 13.15, 31.5, 2.6);
  buildTurbineCeilingLight(-21.5, 13.15, 2.0, 2.9);
  buildTurbineCeilingLight(21.5, 13.15, 2.0, 2.9);
  buildTurbineCeilingLight(-18.0, 13.15, -12.0, 2.4);
  buildTurbineCeilingLight(18.0, 13.15, -12.0, 2.4);

  // Luminous blue grid ceiling light matrix (Ref Image 1 perspective grid!)
  const ceilPanelGeo = track(new THREE.BoxGeometry(1.75, 0.08, 0.72));
  const ceilPanelMat = track(
    new THREE.MeshStandardMaterial({
      color: '#7dd3fc',
      emissive: '#0ea5e9',
      emissiveIntensity: 1.65,
      roughness: 0.18,
    })
  );
  const ceilPanelCount = 4 * 10;
  const ceilPanelInst = new THREE.InstancedMesh(ceilPanelGeo, ceilPanelMat, ceilPanelCount);
  const dummy = new THREE.Object3D();
  let cpIdx = 0;
  for (const cx of [-13.5, -4.5, 4.5, 13.5]) {
    for (let rz = 0; rz < 10; rz++) {
      dummy.position.set(cx, 13.25, -16 + rz * 5.2);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      ceilPanelInst.setMatrixAt(cpIdx++, dummy.matrix);
    }
  }
  ceilPanelInst.instanceMatrix.needsUpdate = true;
  ceilPanelInst.computeBoundingSphere();
  scene.add(ceilPanelInst);

  // Octagonal Cyan-Bordered Wall Displays flanking the Entry Corridor (Ref Image 2!)
  const hexDisplayMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.bioquestHexDisplay,
      emissive: '#22d3ee',
      emissiveMap: textures.bioquestHexDisplay,
      emissiveIntensity: 1.15,
      roughness: 0.18,
    })
  );
  const bioScanMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.biometricScanDisplay,
      emissive: '#38bdf8',
      emissiveMap: textures.biometricScanDisplay,
      emissiveIntensity: 1.1,
      roughness: 0.18,
    })
  );

  const hexWallLeft = new THREE.Mesh(track(new THREE.PlaneGeometry(5.6, 3.6)), hexDisplayMat);
  hexWallLeft.position.set(-14.5, 2.6, 39.8);
  hexWallLeft.rotation.y = Math.PI;
  scene.add(hexWallLeft);

  const bioWallRight = new THREE.Mesh(track(new THREE.PlaneGeometry(6.8, 3.8)), bioScanMat);
  bioWallRight.position.set(14.5, 2.6, 39.8);
  bioWallRight.rotation.y = Math.PI;
  scene.add(bioWallRight);

  // =========================================================================
  // 2. WALKABLE ELEVATED OBSERVATION MEZZANINE + DUAL GRAND STAIRS (Ref #5!)
  // =========================================================================
  const mezY = 4.2;

  // Main elevated south-flank balconies & center skybridge (y = 4.2m)
  const buildMezzanineDeck = (w: number, d: number, x: number, z: number) => {
    const slab = new THREE.Mesh(track(new THREE.BoxGeometry(w, 0.34, d)), whiteLabComposite);
    slab.position.set(x, mezY - 0.17, z);
    if (enableShadows) {
      slab.castShadow = true;
      slab.receiveShadow = true;
    }
    const underTrim = new THREE.Mesh(track(new THREE.BoxGeometry(w, 0.12, 0.16)), cyanNeon);
    underTrim.position.set(x, mezY - 0.32, z - d / 2 + 0.08);
    scene.add(slab, underTrim);
  };

  // West Balcony (x: -29..-9.5, z: 27.5..38), East Balcony (x: 9.5..29, z: 27.5..38), Skybridge (x: -9.5..9.5, z: 32..38)
  buildMezzanineDeck(19.5, 10.5, -19.25, 32.75);
  buildMezzanineDeck(19.5, 10.5, 19.25, 32.75);
  buildMezzanineDeck(19.0, 6.0, 0, 35.0);

  // Structural support columns under the mezzanine
  const mezColGeo = track(new THREE.CylinderGeometry(0.32, 0.38, mezY - 0.3, 12));
  for (const [cx, cz] of [
    [-26, 28.2],
    [-16, 28.2],
    [16, 28.2],
    [26, 28.2],
    [-8.5, 32.5],
    [8.5, 32.5],
  ]) {
    const col = new THREE.Mesh(mezColGeo, darkTitanium);
    col.position.set(cx, (mezY - 0.3) / 2, cz);
    scene.add(col);
    colliders.push({
      id: `mez-col-${cx}-${cz}`,
      minX: cx - 0.5,
      maxX: cx + 0.5,
      minZ: cz - 0.5,
      maxZ: cz + 0.5,
      maxY: mezY - 0.4,
      active: true,
    });
  }

  // Sleek white cantilevered observation console desks along Mezzanine front edge (Ref Image 5!)
  const buildMezConsole = (x: number, z: number, w: number) => {
    const body = new THREE.Mesh(track(new THREE.BoxGeometry(w, 1.05, 0.72)), whiteLabComposite);
    body.position.set(x, mezY + 0.525, z);
    const pad = new THREE.Mesh(track(new THREE.BoxGeometry(w - 0.4, 0.06, 0.38)), cyanNeon);
    pad.position.set(x, mezY + 1.07, z + 0.08);
    const glassGuard = new THREE.Mesh(track(new THREE.PlaneGeometry(w, 1.1)), glassWallMat);
    glassGuard.position.set(x, mezY + 1.05, z - 0.36);
    glassGuard.renderOrder = 3;
    scene.add(body, pad, glassGuard);
  };
  buildMezConsole(0, 32.3, 14.5);
  buildMezConsole(-21.5, 27.8, 12.0);
  buildMezConsole(21.5, 27.8, 12.0);

  // Dual Walkable Illuminated Staircases: x in [-13.2..-9.6] and [+9.6..+13.2], z from 19.5 (y=0) up to 27.5 (y=4.2)
  const buildStaircase = (centerX: number) => {
    const stepCount = 16;
    const zStart = 19.5;
    const zEnd = 27.5;
    const stepGeo = track(new THREE.BoxGeometry(3.4, 0.26, 0.58));
    const stepLedGeo = track(new THREE.BoxGeometry(3.2, 0.04, 0.08));

    for (let i = 0; i < stepCount; i++) {
      const frac = (i + 0.5) / stepCount;
      const sy = frac * mezY;
      const sz = THREE.MathUtils.lerp(zStart, zEnd, frac);
      const step = new THREE.Mesh(stepGeo, darkTitanium);
      step.position.set(centerX, sy - 0.13, sz);
      const led = new THREE.Mesh(stepLedGeo, cyanNeon);
      led.position.set(centerX, sy + 0.01, sz - 0.25);
      scene.add(step, led);
    }

    // Sloped glass stringer handrails
    const railLen = Math.hypot(zEnd - zStart, mezY);
    const railAngle = Math.atan2(mezY, zEnd - zStart);
    const railGeo = track(new THREE.BoxGeometry(0.12, 0.12, railLen));
    for (const side of [-1.72, 1.72]) {
      const rail = new THREE.Mesh(railGeo, cyanNeon);
      rail.position.set(centerX + side, mezY * 0.5 + 0.95, (zStart + zEnd) * 0.5);
      rail.rotation.x = -railAngle;
      scene.add(rail);
    }
  };
  buildStaircase(-11.4);
  buildStaircase(11.4);

  // =========================================================================
  // 3. GRAND HOLOGRAPHIC MOLECULAR SYNTHESIS RING (x = 0, z = 14.5, Ref #1!)
  // =========================================================================
  const holoRingCenter = new THREE.Vector3(0, 0, 14.5);
  const holoRingGroup = new THREE.Group();
  holoRingGroup.position.copy(holoRingCenter);

  // Glowing floor holographic projection pad (Ref Image 1 centerpiece!)
  const holoPadMesh = new THREE.Mesh(
    track(new THREE.PlaneGeometry(5.6, 5.6)),
    track(
      new THREE.MeshStandardMaterial({
        map: textures.holoPadDisplay,
        emissive: '#22d3ee',
        emissiveMap: textures.holoPadDisplay,
        emissiveIntensity: 1.55,
        roughness: 0.15,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    )
  );
  holoPadMesh.rotation.x = -Math.PI / 2;
  holoPadMesh.position.y = 0.03;
  holoRingGroup.add(holoPadMesh);

  // Curved semi-circular laboratory counter bench (Open at North & South so player can walk around freely!)
  const buildCurvedBenchArc = (startAngle: number, endAngle: number) => {
    const segs = 12;
    const rad = 5.4;
    for (let i = 0; i < segs; i++) {
      const a0 = THREE.MathUtils.lerp(startAngle, endAngle, i / segs);
      const a1 = THREE.MathUtils.lerp(startAngle, endAngle, (i + 1) / segs);
      const midA = (a0 + a1) * 0.5;
      const segLen = rad * Math.abs(a1 - a0) + 0.08;

      const segGroup = new THREE.Group();
      segGroup.position.set(Math.cos(midA) * rad, 0, Math.sin(midA) * rad);
      segGroup.rotation.y = -midA;

      const base = new THREE.Mesh(track(new THREE.BoxGeometry(0.95, 0.92, segLen)), darkTitanium);
      base.position.y = 0.46;
      const top = new THREE.Mesh(track(new THREE.BoxGeometry(1.12, 0.08, segLen)), brushedSteel);
      top.position.y = 0.95;
      const rim = new THREE.Mesh(track(new THREE.BoxGeometry(1.16, 0.05, segLen)), cyanNeon);
      rim.position.y = 0.99;

      segGroup.add(base, top, rim);

      // Embedded glowing touch-screen tablet every 3rd segment & glassware flasks
      if (i % 3 === 1) {
        const tablet = new THREE.Mesh(track(new THREE.BoxGeometry(0.45, 0.04, 0.68)), cyanNeon);
        tablet.position.set(0.15, 1.04, 0);
        tablet.rotation.z = -0.25;
        segGroup.add(tablet);
      } else if (i % 3 === 2) {
        addLabGlasswareCluster(segGroup, 0, 1.0, 0, i % 2 === 0 ? cyanNeon : emeraldNeon);
      }

      holoRingGroup.add(segGroup);
    }
  };
  // West curved bench arc & East curved bench arc (wide open central walkway along Z!)
  buildCurvedBenchArc(Math.PI * 0.68, Math.PI * 1.32);
  buildCurvedBenchArc(-Math.PI * 0.32, Math.PI * 0.32);

  // Colliders for West & East curved bench arcs
  colliders.push(
    { id: 'holo-bench-w', minX: -6.2, maxX: -4.2, minZ: 10.5, maxZ: 18.5, maxY: 1.5, active: true },
    { id: 'holo-bench-e', minX: 4.2, maxX: 6.2, minZ: 10.5, maxZ: 18.5, maxY: 1.5, active: true }
  );

  // Build 7 luminous floating 3D holographic protein & molecular lattices (Ref Image 1!)
  const createProteinHologram = (
    scale: number,
    matPrimary: THREE.Material,
    matSecondary: THREE.Material,
    style: 'ring' | 'protein' | 'cage'
  ): THREE.Group => {
    const g = new THREE.Group();
    const atomGeo = track(new THREE.SphereGeometry(0.11 * scale, 10, 10));
    const bondGeo = track(new THREE.CylinderGeometry(0.025 * scale, 0.025 * scale, 0.44 * scale, 6));

    if (style === 'ring') {
      // Iconic hexagonal macro-molecule centerpiece (Ref Image 1 center!)
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const r = 0.95 * scale;
        const n = new THREE.Mesh(atomGeo, matPrimary);
        n.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
        g.add(n);
        const sub = new THREE.Mesh(atomGeo, matSecondary);
        sub.scale.setScalar(0.65);
        sub.position.set(Math.cos(a) * r * 1.32, Math.sin(a) * r * 1.32, Math.sin(i * 1.4) * 0.25 * scale);
        g.add(sub);

        const bond = new THREE.Mesh(track(new THREE.CylinderGeometry(0.028 * scale, 0.028 * scale, 0.95 * scale, 6)), matPrimary);
        const midA = a + Math.PI / 6;
        bond.position.set(Math.cos(midA) * r * 0.86, Math.sin(midA) * r * 0.86, 0);
        bond.rotation.z = midA;
        g.add(bond);
      }
      const halo = new THREE.Mesh(track(new THREE.TorusGeometry(1.18 * scale, 0.02 * scale, 8, 36)), matSecondary);
      g.add(halo);
    } else if (style === 'protein') {
      // Folded ribbon protein knot + bound ligand nodes
      const knot = new THREE.Mesh(
        track(new THREE.TorusKnotGeometry(0.55 * scale, 0.055 * scale, 48, 8, 2, 3)),
        matPrimary
      );
      g.add(knot);
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        const node = new THREE.Mesh(atomGeo, i % 2 === 0 ? matSecondary : matPrimary);
        node.scale.setScalar(0.7);
        node.position.set(Math.cos(a) * 0.72 * scale, Math.sin(a * 2) * 0.42 * scale, Math.sin(a) * 0.72 * scale);
        g.add(node);
      }
    } else {
      // Geodesic viral-receptor / enzyme active-site lattice
      const wireMat = track(
        new THREE.MeshBasicMaterial({
          color: (matPrimary as THREE.MeshStandardMaterial).color,
          wireframe: true,
          transparent: true,
          opacity: 0.88,
        })
      );
      const cage = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.7 * scale, 1)), wireMat);
      const core = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.28 * scale, 0)), matSecondary);
      const b1 = new THREE.Mesh(bondGeo, matPrimary);
      g.add(cage, core, b1);
    }

    return g;
  };

  const holoBeamMat = track(
    new THREE.MeshBasicMaterial({
      color: '#06b6d4',
      transparent: true,
      opacity: 0.025,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );

  // Centerpiece floating macro-molecule + 6 surrounding floating proteins!
  const holoSpecs: Array<{
    x: number;
    y: number;
    z: number;
    s: number;
    m1: THREE.Material;
    m2: THREE.Material;
    style: 'ring' | 'protein' | 'cage';
  }> = [
    { x: 0, y: 2.55, z: 0, s: 1.35, m1: cyanNeon, m2: electricBlueNeon, style: 'ring' },
    { x: -3.2, y: 2.35, z: 1.5, s: 0.82, m1: electricBlueNeon, m2: cyanNeon, style: 'protein' },
    { x: -3.4, y: 2.75, z: -1.8, s: 0.85, m1: emeraldNeon, m2: cyanNeon, style: 'cage' },
    { x: 3.2, y: 2.35, z: 1.5, s: 0.82, m1: emeraldNeon, m2: cyanNeon, style: 'protein' },
    { x: 3.4, y: 2.75, z: -1.8, s: 0.85, m1: electricBlueNeon, m2: purpleNeon, style: 'cage' },
    { x: -1.8, y: 3.35, z: -3.4, s: 0.72, m1: emeraldNeon, m2: electricBlueNeon, style: 'protein' },
    { x: 1.8, y: 3.35, z: -3.4, s: 0.72, m1: cyanNeon, m2: purpleNeon, style: 'protein' },
  ];

  for (const spec of holoSpecs) {
    const h = createProteinHologram(spec.s, spec.m1, spec.m2, spec.style);
    h.position.set(spec.x, spec.y, spec.z);
    h.userData.baseY = spec.y;
    holoRingGroup.add(h);
    rotatingHolograms.push(h);
  }

  // Subtle translucent holographic projection cone from central floor pad
  const padCone = new THREE.Mesh(track(new THREE.ConeGeometry(1.5, 2.2, 24, 1, true)), holoBeamMat);
  padCone.position.y = 1.1;
  padCone.rotation.x = Math.PI;
  holoRingGroup.add(padCone);

  const ringGlowLight = new THREE.PointLight('#06b6d4', 22, 18, 1.35);
  ringGlowLight.position.set(0, 3.2, 0);
  holoRingGroup.add(ringGlowLight);

  scene.add(holoRingGroup);

  // =========================================================================
  // 4. GIANT OVERHEAD HEXAGONAL HALO RING & CENTRAL AI CONSOLES (Ref #5!)
  // =========================================================================
  const hexHaloGroup = new THREE.Group();
  hexHaloGroup.position.set(0, 8.6, 0.5);
  const hexRadius = 7.4;
  const hexTubeGeo = track(new THREE.BoxGeometry(hexRadius * 1.02, 0.24, 0.34));
  const hexLedGeo = track(new THREE.BoxGeometry(hexRadius * 0.98, 0.14, 0.22));
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const seg = new THREE.Group();
    const midA = a + Math.PI / 6;
    const dist = hexRadius * Math.cos(Math.PI / 6);
    seg.position.set(Math.cos(midA) * dist, 0, Math.sin(midA) * dist);
    seg.rotation.y = -midA + Math.PI / 2;

    const frame = new THREE.Mesh(hexTubeGeo, darkTitanium);
    const led = new THREE.Mesh(hexLedGeo, cyanNeon);
    led.position.y = -0.14;
    seg.add(frame, led);
    hexHaloGroup.add(seg);

    // Suspension cables to ceiling
    const cable = new THREE.Mesh(track(new THREE.CylinderGeometry(0.035, 0.035, 4.8, 6)), brushedSteel);
    cable.position.set(Math.cos(a) * hexRadius, 2.4, Math.sin(a) * hexRadius);
    hexHaloGroup.add(cable);
  }
  scene.add(hexHaloGroup);

  // Glowing Octagonal Floor Ring surrounding NEXUS core (Ref Image 5 floor pattern!)
  const octFloorRing = new THREE.Mesh(track(new THREE.RingGeometry(4.1, 4.45, 8)), cyanNeon);
  octFloorRing.rotation.x = -Math.PI / 2;
  octFloorRing.position.set(0, 0.025, 0.5);
  scene.add(octFloorRing);

  // 4 AI Monitoring Consoles around Central NEXUS Core (0, 0.5)
  const aiConsoleCoords: Array<{ x: number; z: number; rotY: number }> = [
    { x: -5.4, z: -2.2, rotY: 0.72 },
    { x: 5.4, z: -2.2, rotY: -0.72 },
    { x: -5.4, z: 3.4, rotY: 2.35 },
    { x: 5.4, z: 3.4, rotY: -2.35 },
  ];
  const aiMonMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.aiMonitorWall,
      emissive: '#38bdf8',
      emissiveMap: textures.aiMonitorWall,
      emissiveIntensity: 1.0,
      roughness: 0.2,
    })
  );
  for (let i = 0; i < aiConsoleCoords.length; i++) {
    const c = aiConsoleCoords[i];
    const g = new THREE.Group();
    g.position.set(c.x, 0, c.z);
    g.rotation.y = c.rotY;

    const desk = new THREE.Mesh(track(new THREE.BoxGeometry(2.1, 0.94, 0.88)), darkTitanium);
    desk.position.y = 0.47;
    const trim = new THREE.Mesh(track(new THREE.BoxGeometry(2.14, 0.05, 0.92)), cyanNeon);
    trim.position.y = 0.96;
    const screen = new THREE.Mesh(track(new THREE.PlaneGeometry(1.75, 0.96)), aiMonMat);
    screen.position.set(0, 1.56, -0.14);
    screen.rotation.x = -0.14;
    g.add(desk, trim, screen);
    scene.add(g);

    colliders.push({
      id: `ai-console-${i}`,
      minX: c.x - 1.15,
      maxX: c.x + 1.15,
      minZ: c.z - 0.9,
      maxZ: c.z + 0.9,
      maxY: 1.8,
      active: true,
    });
  }

  // Evidence #3: AI Monitoring Room Breach Audit Console
  evidenceNodes.push({
    id: 'evidence-nexus-log',
    position: new THREE.Vector3(5.4, 1.5, 3.4),
    radius: 4.0,
    label: 'AI Monitoring Console · Breach Audit',
    sublabel: 'Press [E] to Inspect NEXUS Security Intercept Log',
  });

  // =========================================================================
  // 5. WEST CONTAINMENT BAY — CURVED CYAN GLASS TANK & VOLUMETRIC LIGHT SHAFTS (Ref #3!)
  // =========================================================================
  const tankGroup = new THREE.Group();
  tankGroup.position.set(-22.5, 0, 17.5);

  const tankBase = new THREE.Mesh(track(new THREE.CylinderGeometry(4.4, 4.7, 1.1, 24)), darkTitanium);
  tankBase.position.y = 0.55;
  const tankCap = new THREE.Mesh(track(new THREE.CylinderGeometry(4.6, 4.4, 0.9, 24)), darkTitanium);
  tankCap.position.y = 6.2;
  const tankRingBot = new THREE.Mesh(track(new THREE.TorusGeometry(4.42, 0.08, 10, 32)), cyanNeon);
  tankRingBot.rotation.x = Math.PI / 2;
  tankRingBot.position.y = 1.12;
  const tankRingTop = new THREE.Mesh(track(new THREE.TorusGeometry(4.42, 0.08, 10, 32)), cyanNeon);
  tankRingTop.rotation.x = Math.PI / 2;
  tankRingTop.position.y = 5.75;

  // Glowing cyan fluid interior & outer curved containment glass (Ref Image 3!)
  const tankLiquidMat = track(
    new THREE.MeshPhysicalMaterial({
      color: '#06b6d4',
      emissive: '#0891b2',
      emissiveIntensity: 1.45,
      roughness: 0.12,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    })
  );
  const tankInnerCore = new THREE.Mesh(track(new THREE.CylinderGeometry(3.85, 3.85, 4.5, 24)), tankLiquidMat);
  tankInnerCore.position.y = 3.45;
  const tankOuterGlass = new THREE.Mesh(track(new THREE.CylinderGeometry(4.28, 4.28, 4.65, 24, 1, true)), glassWallMat);
  tankOuterGlass.position.y = 3.45;
  tankOuterGlass.renderOrder = 4;

  // Floating bioreactor molecular column inside curved cyan tank
  const tankHolo = createProteinHologram(1.4, cyanNeon, emeraldNeon, 'protein');
  tankHolo.position.y = 3.5;
  tankHolo.userData.baseY = 3.5;
  rotatingHolograms.push(tankHolo);

  // Subtle diagonal light shafts streaming from curved cyan containment tank
  const rayMat = track(
    new THREE.MeshBasicMaterial({
      color: '#0ea5e9',
      transparent: true,
      opacity: 0.03,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  for (let r = 0; r < 2; r++) {
    const ray = new THREE.Mesh(track(new THREE.ConeGeometry(0.75 + r * 0.2, 5.2, 16, 1, true)), rayMat);
    ray.position.set(4.1 + r * 0.4, 2.1, -0.3 + r * 0.7);
    ray.rotation.z = -0.82;
    ray.rotation.y = 0.14 * (r - 0.5);
    tankGroup.add(ray);
  }

  const tankLight = new THREE.PointLight('#06b6d4', 32, 24, 1.35);
  tankLight.position.set(4.8, 3.6, 0);
  tankGroup.add(tankBase, tankCap, tankRingBot, tankRingTop, tankInnerCore, tankOuterGlass, tankHolo, tankLight);
  scene.add(tankGroup);

  colliders.push({
    id: 'curved-cyan-tank',
    minX: -27.2,
    maxX: -17.8,
    minZ: 12.8,
    maxZ: 22.2,
    maxY: 6.8,
    active: true,
  });

  // Experimental Drug Cryo-Storage Cabinets along West Wall South
  const cryoCabinetPositions: Array<{ x: number; z: number; rotY: number }> = [
    { x: -31.8, z: 24.5, rotY: Math.PI / 2 },
    { x: -31.8, z: 28.0, rotY: Math.PI / 2 },
    { x: -31.8, z: 31.5, rotY: Math.PI / 2 },
  ];
  const cabBodyGeo = track(new THREE.BoxGeometry(2.4, 3.2, 0.92));
  const cabGlassGeo = track(new THREE.PlaneGeometry(2.1, 2.4));
  const smallVialGeo = track(new THREE.CylinderGeometry(0.055, 0.055, 0.28, 8));

  for (let cIdx = 0; cIdx < cryoCabinetPositions.length; cIdx++) {
    const pos = cryoCabinetPositions[cIdx];
    const cab = new THREE.Group();
    cab.position.set(pos.x, 0, pos.z);
    cab.rotation.y = pos.rotY;

    const frame = new THREE.Mesh(cabBodyGeo, darkTitanium);
    frame.position.y = 1.6;
    const topStrip = new THREE.Mesh(track(new THREE.BoxGeometry(2.44, 0.1, 0.96)), purpleNeon);
    topStrip.position.y = 3.22;
    const glass = new THREE.Mesh(cabGlassGeo, glassWallMat);
    glass.position.set(0, 1.68, 0.48);
    glass.renderOrder = 3;

    for (let shelf = 0; shelf < 2; shelf++) {
      const sy = 1.15 + shelf * 0.88;
      const shelfPlate = new THREE.Mesh(track(new THREE.BoxGeometry(2.1, 0.06, 0.65)), brushedSteel);
      shelfPlate.position.set(0, sy, 0.1);
      cab.add(shelfPlate);
      for (let v = 0; v < 5; v++) {
        const vial = new THREE.Mesh(smallVialGeo, (v + shelf) % 2 === 0 ? cyanNeon : purpleNeon);
        vial.position.set(-0.76 + v * 0.38, sy + 0.18, 0.22);
        cab.add(vial);
      }
    }
    cab.add(frame, topStrip, glass);
    scene.add(cab);

    colliders.push({
      id: `cryo-cab-${cIdx}`,
      minX: pos.x - 0.85,
      maxX: pos.x + 0.85,
      minZ: pos.z - 1.35,
      maxZ: pos.z + 1.35,
      maxY: 3.5,
      active: true,
    });
  }

  // Cryo-Storage Wall Screen & Evidence #2
  const drugWallScreen = new THREE.Mesh(
    track(new THREE.PlaneGeometry(5.6, 2.7)),
    track(
      new THREE.MeshStandardMaterial({
        map: textures.drugStorageDisplay,
        emissive: '#a855f7',
        emissiveMap: textures.drugStorageDisplay,
        emissiveIntensity: 1.0,
        roughness: 0.2,
      })
    )
  );
  drugWallScreen.position.set(-33.4, 3.8, 20.5);
  drugWallScreen.rotation.y = Math.PI / 2;
  scene.add(drugWallScreen);

  evidenceNodes.push({
    id: 'evidence-storage',
    position: new THREE.Vector3(-30.5, 1.6, 28.0),
    radius: 4.4,
    label: 'Experimental Drug Cryo-Storage Bay',
    sublabel: 'Press [E] to Verify Sealed Compound BQ-X9 Inventory',
  });

  // =========================================================================
  // 6. EAST SYNTHESIS WING — ROBOTIC ARMS, CONVEYOR VIALS & COMPOUND BQ-X9 CORE (Ref #4!)
  // =========================================================================
  const synthGroup = new THREE.Group();
  synthGroup.position.set(20.5, 0, 15.5);

  // Automated Pharma Vial Conveyor Belt (10m stainless track along Z)
  const beltBase = new THREE.Mesh(track(new THREE.BoxGeometry(1.5, 0.92, 10.6)), darkTitanium);
  beltBase.position.y = 0.46;
  const beltSurface = new THREE.Mesh(track(new THREE.BoxGeometry(1.12, 0.06, 10.4)), brushedSteel);
  beltSurface.position.y = 0.95;
  const beltRailL = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.14, 10.5)), cyanNeon);
  beltRailL.position.set(-0.62, 1.0, 0);
  const beltRailR = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.14, 10.5)), cyanNeon);
  beltRailR.position.set(0.62, 1.0, 0);
  synthGroup.add(beltBase, beltSurface, beltRailL, beltRailR);

  // 12 Glowing Blue Experimental Vials smoothly gliding along the conveyor belt!
  const convVialGeo = track(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 10));
  const convCapGeo = track(new THREE.CylinderGeometry(0.075, 0.09, 0.07, 10));
  for (let i = 0; i < 12; i++) {
    const vMesh = new THREE.Mesh(convVialGeo, electricBlueNeon);
    const cap = new THREE.Mesh(convCapGeo, brushedSteel);
    cap.position.y = 0.2;
    vMesh.add(cap);
    vMesh.position.set(0, 1.15, -4.8 + i * 0.86);
    vMesh.userData.offset = i / 12;
    synthGroup.add(vMesh);
    conveyorVials.push(vMesh);
  }

  // Two Animated Multi-Jointed Robotic Pipette Synthesis Arms (Ref Image 4!)
  const buildRoboticArm = (ax: number, az: number, phase: number) => {
    const pedestal = new THREE.Mesh(track(new THREE.CylinderGeometry(0.42, 0.54, 1.05, 12)), darkTitanium);
    pedestal.position.set(ax, 0.525, az);
    synthGroup.add(pedestal);

    const basePivot = new THREE.Group();
    basePivot.position.set(ax, 1.08, az);
    synthGroup.add(basePivot);

    const turret = new THREE.Mesh(track(new THREE.CylinderGeometry(0.32, 0.36, 0.35, 12)), brushedSteel);
    basePivot.add(turret);

    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.y = 0.2;
    basePivot.add(shoulderPivot);

    const lowerArm = new THREE.Mesh(track(new THREE.BoxGeometry(0.24, 1.45, 0.24)), darkTitanium);
    lowerArm.position.y = 0.72;
    const armTrim = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 1.2, 0.28)), cyanNeon);
    armTrim.position.y = 0.72;
    shoulderPivot.add(lowerArm, armTrim);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.y = 1.42;
    shoulderPivot.add(elbowPivot);

    const elbowJoint = new THREE.Mesh(track(new THREE.SphereGeometry(0.2, 10, 10)), brushedSteel);
    const upperArm = new THREE.Mesh(track(new THREE.BoxGeometry(0.18, 1.25, 0.18)), brushedSteel);
    upperArm.position.y = 0.62;
    const pipetteTip = new THREE.Mesh(track(new THREE.ConeGeometry(0.07, 0.36, 8)), crimsonNeon);
    pipetteTip.rotation.x = Math.PI;
    pipetteTip.position.y = 1.38;
    elbowPivot.add(elbowJoint, upperArm, pipetteTip);

    roboticArms.push({ basePivot, shoulderPivot, elbowPivot, phase });
  };
  buildRoboticArm(-1.85, -2.4, 0);
  buildRoboticArm(-1.85, 2.4, Math.PI * 0.75);

  // Hero Illuminated Experimental Compound BQ-X9 Containment Vial Pedestal (Ref Image 4 centerpiece!)
  const heroPed = new THREE.Group();
  heroPed.position.set(3.4, 0, 0);
  const pedTier1 = new THREE.Mesh(track(new THREE.CylinderGeometry(1.35, 1.6, 0.55, 16)), darkTitanium);
  pedTier1.position.y = 0.275;
  const pedTier2 = new THREE.Mesh(track(new THREE.CylinderGeometry(0.95, 1.15, 0.55, 16)), brushedSteel);
  pedTier2.position.y = 0.8;
  const pedGlowRing = new THREE.Mesh(track(new THREE.TorusGeometry(0.98, 0.06, 10, 28)), crimsonNeon);
  pedGlowRing.rotation.x = Math.PI / 2;
  pedGlowRing.position.y = 1.08;

  // Giant glowing crimson glass Compound BQ-X9 vial + cap
  const heroVialGlass = new THREE.Mesh(track(new THREE.CylinderGeometry(0.58, 0.58, 1.75, 20)), flaskGlassMat);
  heroVialGlass.position.y = 1.98;
  heroVialGlass.renderOrder = 4;
  const heroLiquid = new THREE.Mesh(track(new THREE.CylinderGeometry(0.49, 0.49, 1.15, 18)), crimsonNeon);
  heroLiquid.position.y = 1.68;
  const heroCap = new THREE.Mesh(track(new THREE.CylinderGeometry(0.42, 0.46, 0.24, 16)), brushedSteel);
  heroCap.position.y = 2.95;

  const heroLight = new THREE.PointLight('#f43f5e', 24, 15, 1.4);
  heroLight.position.set(0, 2.2, 0);
  heroPed.add(pedTier1, pedTier2, pedGlowRing, heroVialGlass, heroLiquid, heroCap, heroLight);

  // Floating crimson breach data-cube particles rising from the BQ-X9 vial (Ref Image 4!)
  const cubeGeo = track(new THREE.BoxGeometry(0.11, 0.11, 0.11));
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI * 2 * i) / 16;
    const r = 0.75 + (i % 3) * 0.45;
    const cm = new THREE.Mesh(cubeGeo, crimsonNeon);
    const bx = Math.cos(a) * r;
    const bz = Math.sin(a) * r;
    cm.position.set(bx, 1.5 + (i % 5) * 0.6, bz);
    heroPed.add(cm);
    breachDataCubes.push({ mesh: cm, baseX: bx, baseZ: bz, speed: 0.7 + (i % 4) * 0.22, phase: i * 0.7 });
  }
  synthGroup.add(heroPed);

  // Crimson Padlock Breached Security Display beside the synthesis core (Ref Image 4 right screen!)
  const padlockMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.breachPadlockDisplay,
      emissive: '#ef4444',
      emissiveMap: textures.breachPadlockDisplay,
      emissiveIntensity: 1.25,
      roughness: 0.18,
    })
  );
  const padlockFrame = new THREE.Mesh(track(new THREE.BoxGeometry(0.16, 2.45, 3.3)), darkTitanium);
  padlockFrame.position.set(5.6, 2.35, -2.5);
  padlockFrame.rotation.y = -0.35;
  const padlockFace = new THREE.Mesh(track(new THREE.PlaneGeometry(3.1, 2.25)), padlockMat);
  padlockFace.position.set(5.48, 2.35, -2.5);
  padlockFace.rotation.y = -Math.PI / 2 - 0.35;
  synthGroup.add(padlockFrame, padlockFace);

  // Glowing Syringe & Injector Carousel Rack (Ref Image 4 lower-right detail!)
  const syrRack = new THREE.Mesh(track(new THREE.BoxGeometry(0.75, 0.92, 2.2)), darkTitanium);
  syrRack.position.set(4.4, 0.46, 3.6);
  synthGroup.add(syrRack);
  const syrGeo = track(new THREE.CylinderGeometry(0.05, 0.05, 0.48, 8));
  for (let s = 0; s < 5; s++) {
    const syr = new THREE.Mesh(syrGeo, s % 2 === 0 ? crimsonNeon : cyanNeon);
    syr.position.set(4.4, 1.18, 2.8 + s * 0.4);
    syr.rotation.z = 0.25;
    synthGroup.add(syr);
  }

  scene.add(synthGroup);

  colliders.push(
    { id: 'conveyor-line', minX: 19.3, maxX: 21.7, minZ: 9.8, maxZ: 21.2, maxY: 1.8, active: true },
    { id: 'hero-vial-ped', minX: 22.2, maxX: 25.6, minZ: 13.8, maxZ: 17.2, maxY: 3.5, active: true },
    { id: 'syr-rack', minX: 24.3, maxX: 25.5, minZ: 17.9, maxZ: 20.4, maxY: 1.8, active: true }
  );

  // Evidence #1: Culprit's Breach Workstation (positioned cleanly at x=-8.5, z=11.5 in main lab)
  evidenceNodes.push({
    id: 'evidence-terminal',
    position: new THREE.Vector3(-8.5, 1.4, 11.5),
    radius: 4.1,
    label: 'Breach Workstation · Compound BQ-X9',
    sublabel: 'Press [E] to Audit Unauthorized Drug Transfer Attempt',
  });

  // =========================================================================
  // 7. AUTHENTIC CLEANROOM LAB BAYS, FUME HOODS, CENTRIFUGES & SERVER RACKS
  // =========================================================================
  const buildLabInstrumentBench = (x: number, z: number, rotY: number, id: string) => {
    const b = new THREE.Group();
    b.position.set(x, 0, z);
    b.rotation.y = rotY;

    const base = new THREE.Mesh(track(new THREE.BoxGeometry(3.4, 0.9, 1.2)), darkTitanium);
    base.position.y = 0.45;
    const top = new THREE.Mesh(track(new THREE.BoxGeometry(3.5, 0.08, 1.26)), whiteLabComposite);
    top.position.y = 0.94;
    const strip = new THREE.Mesh(track(new THREE.BoxGeometry(3.52, 0.04, 1.28)), cyanNeon);
    strip.position.y = 0.98;

    // Laminar Flow Fume Hood on left half
    const hoodBack = new THREE.Mesh(track(new THREE.BoxGeometry(1.5, 1.25, 0.14)), whiteLabComposite);
    hoodBack.position.set(-0.85, 1.62, -0.5);
    const hoodTop = new THREE.Mesh(track(new THREE.BoxGeometry(1.52, 0.16, 0.96)), darkTitanium);
    hoodTop.position.set(-0.85, 2.28, -0.05);
    const hoodGlass = new THREE.Mesh(track(new THREE.PlaneGeometry(1.44, 1.05)), glassWallMat);
    hoodGlass.position.set(-0.85, 1.65, 0.42);
    hoodGlass.rotation.x = -0.15;
    hoodGlass.renderOrder = 3;

    // Centrifuge & Optical Microscope on right half
    const centrifuge = new THREE.Mesh(track(new THREE.CylinderGeometry(0.28, 0.34, 0.36, 12)), whiteLabComposite);
    centrifuge.position.set(0.55, 1.18, -0.08);
    const centLid = new THREE.Mesh(track(new THREE.CylinderGeometry(0.26, 0.28, 0.06, 12)), cyanNeon);
    centLid.position.set(0.55, 1.38, -0.08);

    const microBase = new THREE.Mesh(track(new THREE.BoxGeometry(0.26, 0.08, 0.32)), darkTitanium);
    microBase.position.set(1.22, 1.04, 0.08);
    const microArm = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.42, 0.1)), brushedSteel);
    microArm.position.set(1.22, 1.26, -0.02);
    const microLens = new THREE.Mesh(track(new THREE.CylinderGeometry(0.045, 0.035, 0.24, 8)), cyanNeon);
    microLens.position.set(1.22, 1.38, 0.12);
    microLens.rotation.x = 0.35;

    addLabGlasswareCluster(b, -0.85, 1.0, 0.05, emeraldNeon);
    b.add(base, top, strip, hoodBack, hoodTop, hoodGlass, centrifuge, centLid, microBase, microArm, microLens);
    scene.add(b);

    const halfX = Math.abs(Math.cos(rotY)) * 1.85 + Math.abs(Math.sin(rotY)) * 0.78;
    const halfZ = Math.abs(Math.sin(rotY)) * 1.85 + Math.abs(Math.cos(rotY)) * 0.78;
    colliders.push({
      id,
      minX: x - halfX,
      maxX: x + halfX,
      minZ: z - halfZ,
      maxZ: z + halfZ,
      maxY: 2.5,
      active: true,
    });
  };

  // Authentic scientific lab benches with fume hoods, centrifuges & microscopes across West & East wings!
  buildLabInstrumentBench(-20.5, 4.0, Math.PI / 2, 'lab-bench-w1');
  buildLabInstrumentBench(-20.5, -10.5, Math.PI / 2, 'lab-bench-w2');
  buildLabInstrumentBench(20.5, -10.5, -Math.PI / 2, 'lab-bench-e1');
  buildLabInstrumentBench(19.5, 2.5, -Math.PI / 2, 'lab-bench-e2');

  // Glass Cleanroom Partitions framing the North-West & North-East Research Wings
  const buildGlassPartition = (x: number, z: number, width: number, rotY: number, id: string) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    const curb = new THREE.Mesh(track(new THREE.BoxGeometry(width, 0.35, 0.22)), darkTitanium);
    curb.position.y = 0.175;
    const topRail = new THREE.Mesh(track(new THREE.BoxGeometry(width, 0.18, 0.22)), darkTitanium);
    topRail.position.y = 4.2;
    const neonTrim = new THREE.Mesh(track(new THREE.BoxGeometry(width - 0.2, 0.06, 0.24)), cyanNeon);
    neonTrim.position.y = 4.08;
    const pane = new THREE.Mesh(track(new THREE.PlaneGeometry(width - 0.2, 3.65)), glassWallMat);
    pane.position.y = 2.18;
    pane.renderOrder = 3;
    g.add(curb, topRail, neonTrim, pane);
    scene.add(g);

    const hx = Math.abs(Math.cos(rotY)) * (width * 0.5) + 0.25;
    const hz = Math.abs(Math.sin(rotY)) * (width * 0.5) + 0.25;
    colliders.push({ id, minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, maxY: 4.3, active: true });
  };

  buildGlassPartition(-14.5, -6.5, 6.2, Math.PI / 2, 'glass-part-nw');
  buildGlassPartition(14.5, -6.5, 6.2, Math.PI / 2, 'glass-part-ne');

  // High-Density AI Compute & Archive Server Racks (Red-lit Emergency Contrast Bays like Ref Image 3!)
  const rackBodyGeo = track(new THREE.BoxGeometry(1.15, 3.8, 0.95));
  const rackStripGeo = track(new THREE.BoxGeometry(0.14, 3.2, 0.06));
  const rackConfigs: Array<{ x: number; z: number; rotY: number; color: string }> = [
    { x: -13.2, z: -19.2, rotY: 0, color: '#ef4444' },
    { x: -11.4, z: -19.2, rotY: 0, color: '#ef4444' },
    { x: -9.6, z: -19.2, rotY: 0, color: '#38bdf8' },
    { x: 9.6, z: -19.2, rotY: 0, color: '#38bdf8' },
    { x: 11.4, z: -19.2, rotY: 0, color: '#a855f7' },
    { x: 13.2, z: -19.2, rotY: 0, color: '#ef4444' },
    { x: 15.0, z: -19.2, rotY: 0, color: '#ef4444' },
    { x: 16.8, z: -19.2, rotY: 0, color: '#38bdf8' },
  ];
  for (let i = 0; i < rackConfigs.length; i++) {
    const rc = rackConfigs[i];
    const rGroup = new THREE.Group();
    rGroup.position.set(rc.x, 0, rc.z);
    rGroup.rotation.y = rc.rotY;
    const body = new THREE.Mesh(rackBodyGeo, darkTitanium);
    body.position.y = 1.9;
    const ledMat = track(
      new THREE.MeshStandardMaterial({
        color: rc.color,
        emissive: rc.color,
        emissiveIntensity: 1.7,
        roughness: 0.2,
      })
    );
    serverLedMats.push(ledMat);
    const ledL = new THREE.Mesh(rackStripGeo, ledMat);
    ledL.position.set(-0.34, 1.9, 0.49);
    const ledR = new THREE.Mesh(rackStripGeo, ledMat);
    ledR.position.set(0.34, 1.9, 0.49);
    rGroup.add(body, ledL, ledR);
    scene.add(rGroup);

    colliders.push({
      id: `server-rack-${i}`,
      minX: rc.x - 0.72,
      maxX: rc.x + 0.72,
      minZ: rc.z - 0.65,
      maxZ: rc.z + 0.65,
      maxY: 4.0,
      active: true,
    });
  }

  // Large High-Resolution Wall Screens along West, East & North Walls
  const addWallScreen = (tex: THREE.CanvasTexture, emissiveHex: string, x: number, y: number, z: number, rotY: number, w: number, h: number) => {
    const mat = track(
      new THREE.MeshStandardMaterial({
        map: tex,
        emissive: emissiveHex,
        emissiveMap: tex,
        emissiveIntensity: 1.05,
        roughness: 0.2,
      })
    );
    const screen = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), mat);
    screen.position.set(x, y, z);
    screen.rotation.y = rotY;
    scene.add(screen);
  };

  addWallScreen(textures.molecularWallScreen, '#0ea5e9', -33.3, 4.6, 3.5, Math.PI / 2, 7.6, 3.6);
  addWallScreen(textures.aiMonitorWall, '#22d3ee', 33.3, 4.6, 3.5, -Math.PI / 2, 7.6, 3.6);
  addWallScreen(textures.archiveWallDisplay, '#6366f1', 23.0, 4.4, -20.1, 0, 6.2, 3.0);
  addWallScreen(textures.biometricScanDisplay, '#38bdf8', -27.5, 4.4, -20.1, 0, 6.4, 3.2);

  // =========================================================================
  // 8. SIX ANIMATED NPC LAB RESEARCHERS PATROLLING & WORKING IN THE FACILITY!
  // =========================================================================
  const npcRoutes: Array<{
    speed: number;
    waypoints: Array<{ x: number; y: number; z: number; pauseSec: number; faceYaw?: number }>;
  }> = [
    // Scientist #1: Patrols around the Holographic Molecular Synthesis Ring & West Wing
    {
      speed: 2.1,
      waypoints: [
        { x: -7.5, y: 0, z: 14.5, pauseSec: 3.4, faceYaw: Math.PI / 2 },
        { x: -7.5, y: 0, z: 4.5, pauseSec: 2.5, faceYaw: 0 },
        { x: -16.5, y: 0, z: 4.0, pauseSec: 4.2, faceYaw: -Math.PI / 2 },
        { x: -15.0, y: 0, z: 14.5, pauseSec: 2.2, faceYaw: Math.PI },
      ],
    },
    // Scientist #2: Patrols East Synthesis Wing (Robotic Conveyor & Compound BQ-X9 Bay)
    {
      speed: 2.2,
      waypoints: [
        { x: 16.2, y: 0, z: 12.0, pauseSec: 3.8, faceYaw: Math.PI / 2 },
        { x: 16.2, y: 0, z: 19.5, pauseSec: 3.2, faceYaw: Math.PI / 2 },
        { x: 9.0, y: 0, z: 15.5, pauseSec: 2.8, faceYaw: -Math.PI / 2 },
        { x: 10.5, y: 0, z: 6.5, pauseSec: 2.4, faceYaw: Math.PI },
      ],
    },
    // Scientist #3: Patrols North Research Corridor between Vaults 02, 03, 04 and NEXUS Core
    {
      speed: 2.3,
      waypoints: [
        { x: -9.5, y: 0, z: -8.5, pauseSec: 3.2, faceYaw: Math.PI },
        { x: 0.0, y: 0, z: -11.5, pauseSec: 2.8, faceYaw: Math.PI },
        { x: 9.5, y: 0, z: -8.5, pauseSec: 3.5, faceYaw: Math.PI / 2 },
        { x: 8.5, y: 0, z: -1.5, pauseSec: 2.6, faceYaw: -Math.PI / 2 },
        { x: -8.5, y: 0, z: -1.5, pauseSec: 2.6, faceYaw: Math.PI / 2 },
      ],
    },
    // Scientist #4: Elevated Observation Mezzanine Analyst patrolling the upper balcony (Ref Image 5!)
    {
      speed: 1.8,
      waypoints: [
        { x: -4.5, y: mezY, z: 34.2, pauseSec: 4.5, faceYaw: Math.PI },
        { x: 4.5, y: mezY, z: 34.2, pauseSec: 4.5, faceYaw: Math.PI },
        { x: 18.0, y: mezY, z: 30.2, pauseSec: 4.0, faceYaw: Math.PI },
        { x: 4.5, y: mezY, z: 34.2, pauseSec: 3.0, faceYaw: Math.PI },
      ],
    },
    // Scientist #5: Stationed in West Cleanroom Lab working at Fume Hood
    {
      speed: 1.5,
      waypoints: [
        { x: -18.5, y: 0, z: -10.5, pauseSec: 999, faceYaw: -Math.PI / 2 },
      ],
    },
    // Scientist #6: Stationed in East Cleanroom Lab inspecting HPLC / Microscopes
    {
      speed: 1.5,
      waypoints: [
        { x: 18.5, y: 0, z: -10.5, pauseSec: 999, faceYaw: Math.PI / 2 },
      ],
    },
  ];

  for (const route of npcRoutes) {
    const ch = new ResearcherCharacter('scientist', enableShadows);
    const start = route.waypoints[0];
    ch.root.position.set(start.x, start.y, start.z);
    const startYaw = start.faceYaw ?? 0;
    ch.root.rotation.y = startYaw;
    scene.add(ch.root);
    npcRigs.push({
      character: ch,
      waypoints: route.waypoints,
      currentIndex: 0,
      pauseTimer: route.waypoints.length > 1 ? Math.random() * 2.5 : 999,
      pos: new THREE.Vector3(start.x, start.y, start.z),
      yaw: startYaw,
      prevYaw: startYaw,
      walkSpeed: route.speed,
    });
  }

  // =========================================================================
  // ELEVATION HELPER FOR WALKABLE MEZZANINE & DUAL GRAND STAIRS
  // =========================================================================
  const getElevationAt = (x: number, z: number, currentY: number): number => {
    // Dual walkable staircases: x in [-13.4..-9.4] or [9.4..13.4], z in [19.3..27.7]
    const onStairX = (x >= -13.4 && x <= -9.4) || (x >= 9.4 && x <= 13.4);
    if (onStairX && z >= 19.3 && z <= 27.7) {
      const t = THREE.MathUtils.clamp((z - 19.5) / (27.5 - 19.5), 0, 1);
      return t * mezY;
    }

    // Upper Mezzanine Balcony & Skybridge (only snap up if player is already high enough, e.g. from stairs)
    if (currentY >= 2.2) {
      const onWestDeck = x >= -29.2 && x <= -9.3 && z >= 27.3 && z <= 38.2;
      const onEastDeck = x >= 9.3 && x <= 29.2 && z >= 27.3 && z <= 38.2;
      const onSkyBridge = x >= -9.6 && x <= 9.6 && z >= 31.8 && z <= 38.2;
      if (onWestDeck || onEastDeck || onSkyBridge) {
        return mezY;
      }
    }
    return 0;
  };

  // =========================================================================
  // PER-FRAME ANIMATION UPDATE (Robotic Arms, Vials, Holograms, NPCs)
  // =========================================================================
  const update = (dt: number, elapsedSec: number, isLockdown: boolean) => {
    // 1. Rotate & bob floating molecular/protein holograms
    for (let i = 0; i < rotatingHolograms.length; i++) {
      const h = rotatingHolograms[i];
      h.rotation.y += dt * (i === 0 ? 0.52 : 0.72 + (i % 3) * 0.14);
      h.rotation.x = Math.sin(elapsedSec * 0.65 + i) * 0.14;
      const baseY = (h.userData.baseY as number) ?? 2.4;
      h.position.y = baseY + Math.sin(elapsedSec * 1.45 + i * 1.1) * 0.12;
    }

    // 2. Pulse server rack status strips
    for (let i = 0; i < serverLedMats.length; i++) {
      serverLedMats[i].emissiveIntensity = (isLockdown ? 1.8 : 1.1) + Math.sin(elapsedSec * 3.8 + i * 0.9) * 0.55;
    }

    // 3. Glide experimental drug vials along conveyor belt
    for (let i = 0; i < conveyorVials.length; i++) {
      const v = conveyorVials[i];
      const u = ((v.userData.offset as number) + elapsedSec * 0.085) % 1;
      v.position.z = -5.0 + u * 10.0;
    }

    // 4. Articulate multi-jointed industrial robotic synthesis arms
    for (const arm of roboticArms) {
      const t = elapsedSec * 1.35 + arm.phase;
      arm.basePivot.rotation.y = Math.sin(t) * 0.42 + 0.12;
      arm.shoulderPivot.rotation.z = -0.52 + Math.sin(t * 1.5) * 0.24;
      arm.elbowPivot.rotation.z = -1.25 - Math.cos(t * 1.5) * 0.34;
    }

    // 5. Float crimson data-cube particles upward around Compound BQ-X9 pedestal
    for (const dc of breachDataCubes) {
      const cycle = ((elapsedSec * dc.speed + dc.phase) % 2.8) / 2.8;
      dc.mesh.position.y = 1.2 + cycle * 2.8;
      dc.mesh.position.x = dc.baseX * (1 + cycle * 0.35);
      dc.mesh.position.z = dc.baseZ * (1 + cycle * 0.35);
      dc.mesh.rotation.x += dt * 1.8;
      dc.mesh.rotation.y += dt * 2.2;
      dc.mesh.scale.setScalar(Math.sin(cycle * Math.PI) * 0.95 + 0.1);
    }

    // 6. Animate Living NPC Lab Scientists patrolling & working across the facility
    for (const npc of npcRigs) {
      if (npc.waypoints.length <= 1) {
        npc.character.update(dt, {
          speed: 0,
          isRunning: false,
          isGrounded: true,
          verticalVelocity: 0,
          turnRate: 0,
          interactPulse: 0,
          isTypingCinematic: true,
          isShockedCinematic: false,
          elapsedSec,
        });
        continue;
      }

      if (npc.pauseTimer > 0) {
        npc.pauseTimer -= dt;
        const wp = npc.waypoints[npc.currentIndex];
        if (wp.faceYaw !== undefined) {
          let diff = wp.faceYaw - npc.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          npc.yaw += diff * (1 - Math.exp(-6 * dt));
        }
        npc.character.root.rotation.y = npc.yaw;
        npc.character.update(dt, {
          speed: 0,
          isRunning: false,
          isGrounded: true,
          verticalVelocity: 0,
          turnRate: 0,
          interactPulse: 0,
          isTypingCinematic: npc.pauseTimer > 0.6,
          isShockedCinematic: false,
          elapsedSec,
        });
      } else {
        const nextIdx = (npc.currentIndex + 1) % npc.waypoints.length;
        const target = npc.waypoints[nextIdx];
        const dx = target.x - npc.pos.x;
        const dz = target.z - npc.pos.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.25) {
          npc.currentIndex = nextIdx;
          npc.pauseTimer = target.pauseSec;
        } else {
          const step = Math.min(dist, npc.walkSpeed * dt);
          npc.pos.x += (dx / dist) * step;
          npc.pos.z += (dz / dist) * step;
          npc.pos.y = THREE.MathUtils.damp(npc.pos.y, target.y, 10, dt);

          const targetYaw = Math.atan2(dx, dz);
          let diff = targetYaw - npc.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          npc.yaw += diff * (1 - Math.exp(-8 * dt));

          let dYaw = npc.yaw - npc.prevYaw;
          while (dYaw > Math.PI) dYaw -= Math.PI * 2;
          while (dYaw < -Math.PI) dYaw += Math.PI * 2;
          const turnRate = dYaw / Math.max(0.001, dt);
          npc.prevYaw = npc.yaw;

          npc.character.root.position.copy(npc.pos);
          npc.character.root.rotation.y = npc.yaw;
          npc.character.update(dt, {
            speed: npc.walkSpeed,
            isRunning: false,
            isGrounded: true,
            verticalVelocity: 0,
            turnRate,
            interactPulse: 0,
            isTypingCinematic: false,
            isShockedCinematic: false,
            elapsedSec,
          });
        }
      }
    }
  };

  const dispose = () => {
    for (const npc of npcRigs) {
      npc.character.dispose();
    }
  };

  return {
    entryAirlockLeft,
    entryAirlockRight,
    rotatingHolograms,
    serverLedMats,
    colliders,
    evidenceNodes,
    getElevationAt,
    update,
    dispose,
  };
}
