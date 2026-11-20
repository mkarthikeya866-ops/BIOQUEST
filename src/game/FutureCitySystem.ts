import * as THREE from 'three';
import { FacilityTextures } from './facilityTextures';
import { InteractableTarget, VehicleHudState } from '../types/game';

export interface CityCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number; // height of collider so elevated walkways above maxY are clear
}

interface StairZone {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  axis: 'z' | 'x';
  startCoord: number; // coord where height == startY
  endCoord: number;   // coord where height == endY
  startY: number;
  endY: number;
}

interface DeckPlatform {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
}

export interface DrivableVehicle {
  id: string;
  name: string;
  kind: 'car' | 'bike';
  group: THREE.Group;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  steerAngle: number;
  leanAngle: number;
  wheels: THREE.Object3D[];
  frontWheels: THREE.Object3D[];
  seatOffset: THREE.Vector3;
  halfWidth: number;
  halfLength: number;
  maxSpeed: number;
  boostSpeed: number;
  accel: number;
}

interface CityLift {
  id: string;
  name: string;
  x: number;
  z: number;
  floors: number[]; // e.g., [0, 9.0, 18.0]
  currentFloorIdx: number;
  targetFloorIdx: number;
  currentY: number;
  prevY: number;
  cabinGroup: THREE.Group;
  doorL: THREE.Mesh;
  doorR: THREE.Mesh;
  doorOpen: number;
  moving: boolean;
  shaftRadius: number;
}

interface CityTvScreen {
  id: string;
  name: string;
  position: THREE.Vector3;
  interactPos: THREE.Vector3;
  radius: number;
  poweredOn: boolean;
  channel: number; // 0..3
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.MeshStandardMaterial;
  screenLight?: THREE.PointLight;
}

interface CityPedestrian {
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  waypoints: Array<[number, number]>;
  targetIdx: number;
  speed: number;
  stridePhase: number;
  x: number;
  z: number;
  yaw: number;
}

interface TrafficCar {
  group: THREE.Group;
  waypoints: Array<[number, number]>;
  targetIdx: number;
  speed: number;
  x: number;
  z: number;
  yaw: number;
}

const TV_CHANNELS = [
  'BIOQUEST NEWS 2045 LIVE',
  'NEON SYNTH MUSIC TV',
  'METRO SKYWAY WEATHER',
  'CYBER GRAND PRIX LIVE',
];

/**
 * Expansive GTA-Style Future Modern City extending north of the BioQuest Grand Gate (z = -21 to -235, x = -135 to +135).
 * Features:
 *  - Multi-block boulevards, illuminated plazas, parks & towering composite skyscrapers
 *  - 4 Player-Drivable Vehicles (2 Futuristic Cyber Supercars + 2 Neon Cyber-Bikes)
 *  - 28 Animated Walking NPC Citizens strolling sidewalks & crosswalks
 *  - 8 Autonomous AI Traffic Cars cruising city avenues
 *  - 2 Working Multi-Story Glass Elevators / Lifts (Ground 0m -> Skybridge 9m -> Rooftop 18m)
 *  - 3 Walkable 3D Staircases leading up to an Elevated Sky-Promenade (4.5m) & Level 2 Skybridge (9.0m)
 *  - 3 Live Working Interactive 3D TVs with 4 animated channels & Power ON/OFF
 */
export class FutureCitySystem {
  public readonly root: THREE.Group;
  public readonly colliders: CityCollider[] = [];

  private disposables: Array<{ dispose: () => void }> = [];
  private stairs: StairZone[] = [];
  private platforms: DeckPlatform[] = [];
  private vehicles: DrivableVehicle[] = [];
  private lifts: CityLift[] = [];
  private tvs: CityTvScreen[] = [];
  private pedestrians: CityPedestrian[] = [];
  private trafficCars: TrafficCar[] = [];
  private monumentRings: THREE.Mesh[] = [];
  private maglevPods: Array<{ mesh: THREE.Group; speed: number; dir: number }> = [];

  private activeVehicle: DrivableVehicle | null = null;
  private tvAnimAccum = 0;

  // Shared materials
  private chromeMat!: THREE.MeshStandardMaterial;
  private cyanGlowMat!: THREE.MeshStandardMaterial;
  private purpleGlowMat!: THREE.MeshStandardMaterial;
  private goldGlowMat!: THREE.MeshStandardMaterial;
  private glassMat!: THREE.MeshPhysicalMaterial;

  constructor(
    scene: THREE.Scene,
    textures: FacilityTextures,
    maxAnisotropy: number,
    isSoftwareGl: boolean
  ) {
    this.root = new THREE.Group();
    this.root.name = 'future-modern-city';
    scene.add(this.root);

    this.chromeMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.82, roughness: 0.2 })
    );
    this.cyanGlowMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0ea5e9', emissiveIntensity: 1.5, roughness: 0.2 })
    );
    this.purpleGlowMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#c084fc', emissive: '#9333ea', emissiveIntensity: 1.4, roughness: 0.2 })
    );
    this.goldGlowMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#fde68a', emissive: '#f59e0b', emissiveIntensity: 1.3, roughness: 0.2 })
    );
    this.glassMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.34,
        roughness: 0.1,
        metalness: 0.15,
        depthWrite: false,
      })
    );

    this.buildCityGroundAndRoads(textures, isSoftwareGl);
    this.buildMonumentAndPlaza();
    this.buildSkyscrapersAndBlocks();
    this.buildWalkableStairsAndSkyDecks();
    this.buildWorkingLifts();
    this.buildWorkingTvs(maxAnisotropy);
    this.buildMaglevSkyways();
    this.buildUrbanParksAndLamps();
    this.buildDrivableVehicles();
    this.buildTrafficCars();
    this.buildWalkingPedestrians();
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  // =========================================================================
  // 1. EXPANSIVE GROUND, BOULEVARDS & SIDEWALKS
  // =========================================================================

  private buildCityGroundAndRoads(textures: FacilityTextures, isSoftwareGl: boolean) {
    // Huge horizon base extending beyond playable bounds (no floating void edges!)
    const horizonBase = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(680, 520)),
      this.track(new THREE.MeshStandardMaterial({ color: '#1b3146', roughness: 0.85, metalness: 0.1 }))
    );
    horizonBase.rotation.x = -Math.PI / 2;
    horizonBase.position.set(0, -0.06, -180);
    this.root.add(horizonBase);

    // Main Sidewalk & City Deck Slab (280m x 220m)
    const citySlab = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(280, 220)),
      this.track(
        new THREE.MeshStandardMaterial({
          map: textures.citySidewalk,
          roughness: 0.42,
          metalness: 0.14,
        })
      )
    );
    citySlab.rotation.x = -Math.PI / 2;
    citySlab.position.set(0, 0.0, -131);
    citySlab.receiveShadow = !isSoftwareGl;
    this.root.add(citySlab);

    // Central Bio-Innovation Architectural Plaza (x: -36..36, z: -21..-84)
    const plaza = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(72, 64)),
      this.track(
        new THREE.MeshStandardMaterial({
          map: textures.plazaGround,
          roughness: 0.28,
          metalness: 0.2,
        })
      )
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, 0.015, -53);
    plaza.receiveShadow = !isSoftwareGl;
    this.root.add(plaza);

    // Illuminated Glass Promenade leading straight out of the Main Door
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.28, 0.08, 20)), this.cyanGlowMat);
      strip.position.set(side * 4.4, 0.05, -31);
      this.root.add(strip);

      const glassWall = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.08, 1.05, 14)), this.glassMat);
      glassWall.position.set(side * 4.8, 0.56, -28.5);
      this.root.add(glassWall);
    }

    // GTA 4-Lane Futuristic Avenue Network!
    // North-South Avenues at x = -48, x = +48, x = -108, x = +108
    // East-West Boulevards at z = -92, z = -158, z = -216
    const roadMatNS = this.track(
      new THREE.MeshStandardMaterial({
        map: textures.cityRoad,
        roughness: 0.55,
        metalness: 0.12,
      })
    );
    const roadTexEW = textures.cityRoad.clone();
    roadTexEW.needsUpdate = true;
    roadTexEW.repeat.set(1, 16);
    this.track(roadTexEW);
    const roadMatEW = this.track(
      new THREE.MeshStandardMaterial({
        map: roadTexEW,
        roughness: 0.55,
        metalness: 0.12,
      })
    );

    const nsXs = [-108, -48, 48, 108];
    const nsGeo = this.track(new THREE.PlaneGeometry(16, 198));
    for (const rx of nsXs) {
      const r = new THREE.Mesh(nsGeo, roadMatNS);
      r.rotation.x = -Math.PI / 2;
      r.position.set(rx, 0.025, -124);
      this.root.add(r);
    }

    const ewZs = [-92, -158, -216];
    const ewGeo = this.track(new THREE.PlaneGeometry(16, 250));
    for (const rz of ewZs) {
      const r = new THREE.Mesh(ewGeo, roadMatEW);
      r.rotation.x = -Math.PI / 2;
      r.rotation.z = Math.PI / 2;
      r.position.set(0, 0.028, rz);
      this.root.add(r);
    }

    // Crosswalk glowing strips at key plaza intersections
    const cwMat = this.track(new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#38bdf8', emissiveIntensity: 0.35 }));
    const stripeGeo = this.track(new THREE.BoxGeometry(0.6, 0.03, 3.2));
    for (const ix of [-48, 48]) {
      for (const iz of [-92, -158]) {
        for (let s = -4; s <= 4; s += 2) {
          const st1 = new THREE.Mesh(stripeGeo, cwMat);
          st1.position.set(ix + s, 0.035, iz + 9.2);
          this.root.add(st1);
          const st2 = new THREE.Mesh(stripeGeo, cwMat);
          st2.position.set(ix + s, 0.035, iz - 9.2);
          this.root.add(st2);
        }
      }
    }
  }

  // =========================================================================
  // 2. CENTRAL MONUMENT & REFLECTING POOL (PRESERVED HERO LANDMARK)
  // =========================================================================

  private buildMonumentAndPlaza() {
    const monumentGroup = new THREE.Group();
    monumentGroup.position.set(0, 0, -52);

    const poolRim = new THREE.Mesh(this.track(new THREE.TorusGeometry(6.2, 0.35, 10, 42)), this.chromeMat);
    poolRim.rotation.x = Math.PI / 2;
    poolRim.position.y = 0.25;

    const waterDisk = new THREE.Mesh(
      this.track(new THREE.CircleGeometry(6.0, 36)),
      this.track(
        new THREE.MeshPhysicalMaterial({
          color: '#0284c7',
          roughness: 0.08,
          metalness: 0.35,
          clearcoat: 1.0,
        })
      )
    );
    waterDisk.rotation.x = -Math.PI / 2;
    waterDisk.position.y = 0.14;

    const pedestal = new THREE.Mesh(this.track(new THREE.CylinderGeometry(1.8, 2.4, 1.2, 12)), this.chromeMat);
    pedestal.position.y = 0.6;

    const spireMat = this.track(new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.5, roughness: 0.22 }));
    const spireLeft = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.25, 0.55, 10.5, 10)), spireMat);
    spireLeft.position.set(-1.1, 5.8, 0);
    spireLeft.rotation.z = -0.14;
    const spireRight = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.25, 0.55, 10.5, 10)), spireMat);
    spireRight.position.set(1.1, 5.8, 0);
    spireRight.rotation.z = 0.14;

    const ring1 = new THREE.Mesh(this.track(new THREE.TorusGeometry(2.6, 0.08, 12, 48)), this.cyanGlowMat);
    ring1.position.y = 6.8;
    const ring2 = new THREE.Mesh(this.track(new THREE.TorusGeometry(1.9, 0.07, 12, 40)), this.goldGlowMat);
    ring2.position.y = 6.8;
    ring2.rotation.x = Math.PI / 3;
    this.monumentRings.push(ring1, ring2);

    const orb = new THREE.Mesh(this.track(new THREE.IcosahedronGeometry(0.9, 1)), this.cyanGlowMat);
    orb.position.y = 6.8;

    const monumentLight = new THREE.PointLight('#38bdf8', 18, 28, 1.4);
    monumentLight.position.set(0, 7.2, 0);

    monumentGroup.add(poolRim, waterDisk, pedestal, spireLeft, spireRight, ring1, ring2, orb, monumentLight);
    this.root.add(monumentGroup);

    this.colliders.push({
      minX: -5.8,
      maxX: 5.8,
      minZ: -57.8,
      maxZ: -46.2,
      maxY: 12,
    });
  }

  // =========================================================================
  // 3. COMPOSITE FUTURISTIC SKYSCRAPERS & CITY BLOCKS
  // =========================================================================

  private buildSkyscrapersAndBlocks() {
    const glassTowerMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.72, roughness: 0.18 })
    );
    const darkGlassMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#172d4d', metalness: 0.82, roughness: 0.14 })
    );
    const navyGlassMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#1b1d45', metalness: 0.78, roughness: 0.18 })
    );

    const towerSpecs: Array<{
      x: number;
      z: number;
      w: number;
      d: number;
      h: number;
      glow: 'cyan' | 'purple' | 'gold';
      solid?: boolean;
    }> = [
      // Inner City Towers bordering Central Avenue (z = -105..-145)
      { x: -18, z: -124, w: 18, d: 18, h: 48, glow: 'cyan', solid: true },
      { x: 18, z: -124, w: 18, d: 18, h: 52, glow: 'purple', solid: true },
      // West District Towers (x = -78)
      { x: -78, z: -56, w: 20, d: 20, h: 44, glow: 'cyan', solid: true },
      { x: -78, z: -124, w: 22, d: 22, h: 64, glow: 'purple', solid: true },
      { x: -78, z: -186, w: 20, d: 20, h: 56, glow: 'gold', solid: true },
      // East District Towers (x = +78)
      { x: 78, z: -56, w: 20, d: 20, h: 46, glow: 'gold', solid: true },
      { x: 78, z: -124, w: 22, d: 22, h: 62, glow: 'cyan', solid: true },
      { x: 78, z: -186, w: 20, d: 20, h: 58, glow: 'purple', solid: true },
      // North Downtown High-Rises (z = -186)
      { x: -20, z: -186, w: 20, d: 18, h: 72, glow: 'cyan', solid: true },
      { x: 20, z: -186, w: 20, d: 18, h: 68, glow: 'gold', solid: true },
      // Far Outer Skyline Perimeter (visual horizon depth)
      { x: -136, z: -65, w: 22, d: 22, h: 54, glow: 'cyan' },
      { x: -136, z: -128, w: 24, d: 24, h: 78, glow: 'purple' },
      { x: -136, z: -195, w: 22, d: 22, h: 64, glow: 'gold' },
      { x: 136, z: -65, w: 22, d: 22, h: 56, glow: 'gold' },
      { x: 136, z: -128, w: 24, d: 24, h: 80, glow: 'cyan' },
      { x: 136, z: -195, w: 22, d: 22, h: 66, glow: 'purple' },
      { x: -80, z: -248, w: 26, d: 22, h: 88, glow: 'cyan' },
      { x: -24, z: -252, w: 26, d: 24, h: 98, glow: 'purple' },
      { x: 26, z: -252, w: 26, d: 24, h: 94, glow: 'cyan' },
      { x: 80, z: -248, w: 26, d: 22, h: 84, glow: 'gold' },
    ];

    for (const ts of towerSpecs) {
      const tGroup = new THREE.Group();
      tGroup.position.set(ts.x, 0, ts.z);
      const glowM =
        ts.glow === 'cyan'
          ? this.cyanGlowMat
          : ts.glow === 'purple'
            ? this.purpleGlowMat
            : this.goldGlowMat;
      const bodyMat = ts.glow === 'purple' ? navyGlassMat : darkGlassMat;

      // Ground-floor illuminated lobby podium
      const podium = new THREE.Mesh(this.track(new THREE.BoxGeometry(ts.w + 1.2, 4.8, ts.d + 1.2)), glassTowerMat);
      podium.position.y = 2.4;
      // Primary sleek glass body
      const body = new THREE.Mesh(this.track(new THREE.BoxGeometry(ts.w, ts.h, ts.d)), bodyMat);
      body.position.y = ts.h / 2;
      // Upper architectural setback crown
      const crown = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(ts.w * 0.68, ts.h * 0.22, ts.d * 0.68)),
        glassTowerMat
      );
      crown.position.y = ts.h + ts.h * 0.11;
      // Glowing horizontal architectural sky-bands
      const band1 = new THREE.Mesh(this.track(new THREE.BoxGeometry(ts.w + 0.4, 0.55, ts.d + 0.4)), glowM);
      band1.position.y = 5.0;
      const band2 = new THREE.Mesh(this.track(new THREE.BoxGeometry(ts.w + 0.4, 0.55, ts.d + 0.4)), glowM);
      band2.position.y = ts.h * 0.5;
      const band3 = new THREE.Mesh(this.track(new THREE.BoxGeometry(ts.w + 0.4, 0.6, ts.d + 0.4)), glowM);
      band3.position.y = ts.h * 0.92;
      // Rooftop antenna spire
      const antenna = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.15, 0.42, 10, 8)), this.chromeMat);
      antenna.position.y = ts.h + ts.h * 0.22 + 5;

      tGroup.add(podium, body, crown, band1, band2, band3, antenna);
      this.root.add(tGroup);

      if (ts.solid) {
        this.colliders.push({
          minX: ts.x - ts.w / 2 - 0.8,
          maxX: ts.x + ts.w / 2 + 0.8,
          minZ: ts.z - ts.d / 2 - 0.8,
          maxZ: ts.z + ts.d / 2 + 0.8,
          maxY: ts.h + 15,
        });
      }
    }
  }

  // =========================================================================
  // 4. CLIMBABLE 3D STAIRS / STEPS + ELEVATED SKY-PROMENADE & SKYBRIDGES
  // =========================================================================

  private buildWalkableStairsAndSkyDecks() {
    const deckMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#dbeafe', metalness: 0.35, roughness: 0.32 })
    );
    const stepMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.42, roughness: 0.38 })
    );
    const stepEdgeMat = this.cyanGlowMat;

    // Helper to build a real 3D multi-step staircase + register walkable StairZone!
    const buildStaircase = (
      centerX: number,
      zStart: number, // bottom of stairs (startY)
      zEnd: number,   // top of stairs (endY)
      width: number,
      startY: number,
      endY: number,
      numSteps: number
    ) => {
      const totalRun = zEnd - zStart;
      const totalRise = endY - startY;
      const stepRun = Math.abs(totalRun) / numSteps;
      const stepRise = totalRise / numSteps;

      const group = new THREE.Group();
      for (let i = 0; i < numSteps; i++) {
        const frac = (i + 0.5) / numSteps;
        const sz = zStart + totalRun * frac;
        const sy = startY + (i + 1) * stepRise;

        const tread = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(width, stepRise, stepRun + 0.06)),
          stepMat
        );
        tread.position.set(centerX, sy - stepRise * 0.5, sz);
        group.add(tread);

        // Glowing cyan safety nosing strip on each step
        const nosing = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(width - 0.1, 0.04, 0.06)),
          stepEdgeMat
        );
        const noseZ = sz - Math.sign(totalRun) * (stepRun * 0.46);
        nosing.position.set(centerX, sy + 0.015, noseZ);
        group.add(nosing);
      }

      // Sleek glass stair balustrades along both sides
      const length = Math.hypot(totalRun, totalRise);
      const slopeAngle = Math.atan2(totalRise, Math.abs(totalRun));
      const railGeo = this.track(new THREE.BoxGeometry(0.1, 1.0, length));
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(railGeo, this.glassMat);
        rail.position.set(
          centerX + side * (width / 2 + 0.05),
          (startY + endY) / 2 + 0.55,
          (zStart + zEnd) / 2
        );
        rail.rotation.x = Math.sign(totalRun) > 0 ? -slopeAngle : slopeAngle;
        group.add(rail);
      }

      this.root.add(group);

      this.stairs.push({
        minX: centerX - width / 2 - 0.35,
        maxX: centerX + width / 2 + 0.35,
        minZ: Math.min(zStart, zEnd) - 0.4,
        maxZ: Math.max(zStart, zEnd) + 0.4,
        axis: 'z',
        startCoord: zStart,
        endCoord: zEnd,
        startY,
        endY,
      });
    };

    const buildPlatform = (
      minX: number,
      maxX: number,
      minZ: number,
      maxZ: number,
      y: number,
      addPillars = true,
      railSides: Array<'N' | 'S' | 'E' | 'W'> = []
    ) => {
      const w = maxX - minX;
      const d = maxZ - minZ;
      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;

      const slab = new THREE.Mesh(this.track(new THREE.BoxGeometry(w, 0.42, d)), deckMat);
      slab.position.set(cx, y - 0.21, cz);
      this.root.add(slab);

      const trim = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(w + 0.16, 0.1, d + 0.16)),
        this.cyanGlowMat
      );
      trim.position.set(cx, y - 0.04, cz);
      this.root.add(trim);

      if (addPillars && y > 1) {
        const pGeo = this.track(new THREE.CylinderGeometry(0.45, 0.55, y, 10));
        const corners: Array<[number, number]> = [
          [minX + 1.2, minZ + 1.2],
          [maxX - 1.2, minZ + 1.2],
          [minX + 1.2, maxZ - 1.2],
          [maxX - 1.2, maxZ - 1.2],
        ];
        for (const [px, pz] of corners) {
          const col = new THREE.Mesh(pGeo, this.chromeMat);
          col.position.set(px, y / 2 - 0.2, pz);
          this.root.add(col);
        }
      }

      for (const side of railSides) {
        if (side === 'N' || side === 'S') {
          const rail = new THREE.Mesh(this.track(new THREE.BoxGeometry(w, 1.05, 0.08)), this.glassMat);
          rail.position.set(cx, y + 0.54, side === 'N' ? minZ + 0.1 : maxZ - 0.1);
          this.root.add(rail);
        } else {
          const rail = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.08, 1.05, d)), this.glassMat);
          rail.position.set(side === 'W' ? minX + 0.1 : maxX - 0.1, y + 0.54, cz);
          this.root.add(rail);
        }
      }

      this.platforms.push({ minX, maxX, minZ, maxZ, y });
    };

    // --- GRAND STAIRCASE 1 & 2: Plaza Ground (0m) -> Elevated Sky-Lounge Terrace (y = 4.5m) ---
    // Located on the East & West sides of the Central Plaza so players spot them IMMEDIATELY upon entering the city!
    buildStaircase(-22, -40, -52, 4.6, 0, 4.5, 16);
    buildStaircase(22, -40, -52, 4.6, 0, 4.5, 16);

    // West Sky-Lounge Terrace (y = 4.5m) — connects to Stair 1 & Sky-Lounge Smart TV!
    buildPlatform(-32, -16, -70, -52, 4.5, true, ['W', 'N']);
    // East Sky-Lounge Terrace (y = 4.5m) — connects to Stair 2!
    buildPlatform(16, 32, -70, -52, 4.5, true, ['E', 'N']);

    // --- STAIRCASE 3: West Terrace (y = 4.5m) -> Level 2 Glass Skybridge (y = 9.0m)! ---
    buildStaircase(-20, -68, -80, 4.2, 4.5, 9.0, 16);

    // --- LEVEL 2 GRAND GLASS SKYBRIDGE (y = 9.0m) spanning across the city at z = -80..-86 ---
    // Connects Lift #1 (West BioTower at x = -28) across to East SkyDeck (x = +28) right over the plaza!
    buildPlatform(-32, 32, -86, -78, 9.0, true, ['N', 'S']);

    // --- LEVEL 3 ROOFTOP OBSERVATION DECK (y = 18.0m) reached by Lift #1! ---
    buildPlatform(-34, -18, -76, -60, 18.0, false, ['W', 'E', 'S']);
    // Rooftop Sky-Deck Support Tower Frame for Lift #1
    const towerPillarGeo = this.track(new THREE.BoxGeometry(0.6, 18.4, 0.6));
    for (const [px, pz] of [
      [-33.5, -75.5],
      [-18.5, -75.5],
      [-33.5, -60.5],
      [-18.5, -60.5],
    ]) {
      const p = new THREE.Mesh(towerPillarGeo, this.chromeMat);
      p.position.set(px, 9.0, pz);
      this.root.add(p);
    }

    // --- LEVEL 2 & 3 NORTH MEDIA SKY-DECK reached by Lift #2 (x = +32, z = -114) ---
    buildPlatform(24, 38, -122, -106, 9.0, true, ['N', 'S', 'E']);
    buildPlatform(24, 38, -122, -106, 18.0, false, ['N', 'S', 'E', 'W']);
  }

  // =========================================================================
  // 5. WORKING 3D GLASS ELEVATORS / LIFTS (MULTI-FLOOR RIDEABLE)
  // =========================================================================

  private buildWorkingLifts() {
    const liftConfigs = [
      {
        id: 'lift-plaza-west',
        name: 'BioTower Panoramic Glass Lift',
        x: -26,
        z: -74,
        floors: [0, 9.0, 18.0],
      },
      {
        id: 'lift-north-media',
        name: 'Skyline Plaza Glass Lift',
        x: 31,
        z: -114,
        floors: [0, 9.0, 18.0],
      },
    ];

    const frameMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.8, roughness: 0.25 })
    );
    const floorMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.5, roughness: 0.3 })
    );

    for (const cfg of liftConfigs) {
      const maxH = cfg.floors[cfg.floors.length - 1] + 4.2;

      // Vertical Glass Elevator Shaft Guide Rails
      const railGeo = this.track(new THREE.CylinderGeometry(0.14, 0.14, maxH, 8));
      for (const [ox, oz] of [
        [-2.1, -2.1],
        [2.1, -2.1],
        [-2.1, 2.1],
        [2.1, 2.1],
      ]) {
        const rail = new THREE.Mesh(railGeo, this.chromeMat);
        rail.position.set(cfg.x + ox, maxH / 2, cfg.z + oz);
        this.root.add(rail);
      }

      // Glowing vertical light strip up the back of the lift shaft
      const shaftLed = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.18, maxH, 0.18)),
        this.cyanGlowMat
      );
      shaftLed.position.set(cfg.x, maxH / 2, cfg.z - 2.15);
      this.root.add(shaftLed);

      // Moving Panoramic Glass Cabin
      const cabinGroup = new THREE.Group();
      cabinGroup.position.set(cfg.x, 0, cfg.z);

      const floorSlab = new THREE.Mesh(this.track(new THREE.BoxGeometry(4.0, 0.24, 4.0)), floorMat);
      floorSlab.position.y = -0.12;
      const floorRing = new THREE.Mesh(this.track(new THREE.BoxGeometry(4.1, 0.06, 4.1)), this.cyanGlowMat);
      floorRing.position.y = 0.01;
      const ceiling = new THREE.Mesh(this.track(new THREE.BoxGeometry(4.0, 0.22, 4.0)), frameMat);
      ceiling.position.y = 3.1;

      // Glass rear & side walls
      const wallBack = new THREE.Mesh(this.track(new THREE.BoxGeometry(3.8, 3.0, 0.08)), this.glassMat);
      wallBack.position.set(0, 1.5, -1.92);
      const wallL = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.08, 3.0, 3.8)), this.glassMat);
      wallL.position.set(-1.92, 1.5, 0);
      const wallR = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.08, 3.0, 3.8)), this.glassMat);
      wallR.position.set(1.92, 1.5, 0);

      // Sliding front glass doors (on +Z side)
      const doorGeo = this.track(new THREE.BoxGeometry(1.75, 2.9, 0.08));
      const doorL = new THREE.Mesh(doorGeo, this.glassMat);
      doorL.position.set(-1.6, 1.48, 1.92);
      const doorR = new THREE.Mesh(doorGeo, this.glassMat);
      doorR.position.set(1.6, 1.48, 1.92);

      // Glowing lift control panel inside cabin
      const panel = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.18, 0.7, 0.35)), this.purpleGlowMat);
      panel.position.set(1.75, 1.35, 1.3);

      const cabinLight = new THREE.PointLight('#38bdf8', 9, 10, 1.5);
      cabinLight.position.set(0, 2.75, 0);

      cabinGroup.add(floorSlab, floorRing, ceiling, wallBack, wallL, wallR, doorL, doorR, panel, cabinLight);
      this.root.add(cabinGroup);

      this.lifts.push({
        id: cfg.id,
        name: cfg.name,
        x: cfg.x,
        z: cfg.z,
        floors: cfg.floors,
        currentFloorIdx: 0,
        targetFloorIdx: 0,
        currentY: 0,
        prevY: 0,
        cabinGroup,
        doorL,
        doorR,
        doorOpen: 1,
        moving: false,
        shaftRadius: 2.0,
      });
    }
  }

  // =========================================================================
  // 6. WORKING LIVE ANIMATED 3D CITY TVs (4 CHANNELS + POWER ON/OFF)
  // =========================================================================

  private buildWorkingTvs(maxAnisotropy: number) {
    const tvSpecs = [
      {
        id: 'tv-jumbotron',
        name: 'Central Plaza Giant Sky-TV',
        pos: new THREE.Vector3(0, 6.2, -78.5),
        interactPos: new THREE.Vector3(0, 1.6, -73.0),
        w: 11.2,
        h: 6.0,
        rotY: 0,
        channel: 0,
        radius: 9.0,
        addStand: true,
      },
      {
        id: 'tv-lounge',
        name: 'Sky-Lounge Smart Holo-TV',
        pos: new THREE.Vector3(-24, 6.4, -69.2),
        interactPos: new THREE.Vector3(-24, 5.5, -65.5),
        w: 5.4,
        h: 3.0,
        rotY: 0,
        channel: 1,
        radius: 6.5,
        addStand: false,
      },
      {
        id: 'tv-boulevard',
        name: 'Avenue Café Live Street TV',
        pos: new THREE.Vector3(34, 3.0, -76.0),
        interactPos: new THREE.Vector3(34, 1.5, -72.0),
        w: 4.8,
        h: 2.7,
        rotY: -0.35,
        channel: 3,
        radius: 6.5,
        addStand: true,
      },
    ];

    const bezelMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.85, roughness: 0.25 })
    );

    for (const spec of tvSpecs) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 288;
      const ctx = canvas.getContext('2d')!;
      const texture = this.track(new THREE.CanvasTexture(canvas));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = maxAnisotropy;

      const mat = this.track(
        new THREE.MeshStandardMaterial({
          map: texture,
          emissive: '#ffffff',
          emissiveMap: texture,
          emissiveIntensity: 0.95,
          roughness: 0.18,
          metalness: 0.1,
        })
      );

      const tvGroup = new THREE.Group();
      tvGroup.position.copy(spec.pos);
      tvGroup.rotation.y = spec.rotY;

      const bezel = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(spec.w + 0.45, spec.h + 0.45, 0.32)),
        bezelMat
      );
      const neonRim = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(spec.w + 0.56, spec.h + 0.56, 0.16)),
        this.cyanGlowMat
      );
      neonRim.position.z = -0.05;
      const screenFace = new THREE.Mesh(this.track(new THREE.PlaneGeometry(spec.w, spec.h)), mat);
      screenFace.position.z = 0.17;

      tvGroup.add(bezel, neonRim, screenFace);

      if (spec.addStand) {
        const standH = spec.pos.y - spec.h / 2;
        if (standH > 0.2) {
          const pole = new THREE.Mesh(
            this.track(new THREE.CylinderGeometry(0.28, 0.38, standH, 10)),
            this.chromeMat
          );
          pole.position.y = -spec.h / 2 - standH / 2;
          tvGroup.add(pole);
        }
      }

      const screenLight = new THREE.PointLight('#38bdf8', 10, 18, 1.5);
      screenLight.position.set(0, 0, 2.2);
      tvGroup.add(screenLight);

      this.root.add(tvGroup);

      // Remote Kiosk Post near ground TVs
      if (spec.id === 'tv-jumbotron') {
        const kiosk = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.65, 1.25, 0.45)), bezelMat);
        kiosk.position.set(0, 0.62, -73.2);
        const kTop = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.55, 0.08, 0.35)), this.cyanGlowMat);
        kTop.position.set(0, 1.28, -73.2);
        this.root.add(kiosk, kTop);
      }

      const tvObj: CityTvScreen = {
        id: spec.id,
        name: spec.name,
        position: spec.pos,
        interactPos: spec.interactPos,
        radius: spec.radius,
        poweredOn: true,
        channel: spec.channel,
        canvas,
        ctx,
        texture,
        material: mat,
        screenLight,
      };
      this.drawTvFrame(tvObj, 0);
      this.tvs.push(tvObj);
    }
  }

  private drawTvFrame(tv: CityTvScreen, elapsedSec: number) {
    const { ctx, canvas } = tv;
    const W = canvas.width;
    const H = canvas.height;

    if (!tv.poweredOn) {
      ctx.fillStyle = '#040812';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TV STANDBY · PRESS [E] TO POWER ON', W / 2, H / 2);
      tv.material.emissiveIntensity = 0.15;
      if (tv.screenLight) tv.screenLight.intensity = 0;
      tv.texture.needsUpdate = true;
      return;
    }

    tv.material.emissiveIntensity = 0.95;
    if (tv.screenLight) tv.screenLight.intensity = 9;
    ctx.textAlign = 'left';

    if (tv.channel === 0) {
      // CH 01: BIOQUEST NEWS 2045 LIVE
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#091a3a');
      grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Header bar
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(16, 16, 86, 28);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('● LIVE', 26, 36);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('BIOQUEST METRO NEWS · 2045', 114, 36);

      // Animated molecular globe visual
      const cx = 128;
      const cy = 148;
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 56, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = elapsedSec * 1.4 + (i * Math.PI) / 3;
        const ax = cx + Math.cos(a) * 42;
        const ay = cy + Math.sin(a) * 42;
        ctx.fillStyle = i % 2 === 0 ? '#38bdf8' : '#c084fc';
        ctx.beginPath();
        ctx.arc(ax, ay, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Breaking News headline
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 21px monospace';
      ctx.fillText('FACILITY LOCKDOWN', 218, 118);
      ctx.fillStyle = '#34d399';
      ctx.fillText('SUCCESSFULLY RESOLVED', 218, 148);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px monospace';
      ctx.fillText('ALL 5 BIO-VAULTS AUTHENTICATED', 218, 180);
      ctx.fillText('METRO CITY SKYWAYS AT 100%', 218, 202);

      // Scrolling news ticker
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, H - 42, W, 42);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px monospace';
      const ticker =
        'BREAKING: BIOQUEST INVESTIGATOR SECURES COMPOUND BQ-X9  +++  FUTURE CITY MAGLEV & HOVER-BIKE LANES OPEN  +++  SUNNY 23°C METRO PLAZA  +++  ';
      const offset = (elapsedSec * 75) % (ticker.length * 9);
      ctx.fillText(ticker + ticker, -offset, H - 15);
    } else if (tv.channel === 1) {
      // CH 02: NEON SYNTH MUSIC TV
      ctx.fillStyle = '#0c0420';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e879f9';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('CH 02 · NEON SYNTHWAVE FM LIVE', 20, 34);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '13px monospace';
      ctx.fillText('NOW PLAYING: "FUTURE HORIZON 2045" — CYBER ORCHESTRA', 20, 56);

      // Animated equalizer bars
      const bars = 24;
      for (let i = 0; i < bars; i++) {
        const amp =
          0.25 +
          Math.abs(Math.sin(elapsedSec * 4.5 + i * 0.55) * Math.cos(elapsedSec * 2.3 - i * 0.35)) * 0.72;
        const bh = amp * 165;
        const bx = 22 + i * 19.8;
        const barGrad = ctx.createLinearGradient(0, H - 30 - bh, 0, H - 30);
        barGrad.addColorStop(0, '#38bdf8');
        barGrad.addColorStop(0.5, '#a855f7');
        barGrad.addColorStop(1, '#ec4899');
        ctx.fillStyle = barGrad;
        ctx.fillRect(bx, H - 32 - bh, 14, bh);
      }
    } else if (tv.channel === 2) {
      // CH 03: METRO SKYWAY WEATHER & RADAR
      ctx.fillStyle = '#061a26';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('CH 03 · FUTURE CITY RADAR & TRAFFIC', 20, 34);

      const rx = 140;
      const ry = 165;
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 2;
      for (const r of [30, 60, 90]) {
        ctx.beginPath();
        ctx.arc(rx, ry, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      const sweep = elapsedSec * 2.2;
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + Math.cos(sweep) * 90, ry + Math.sin(sweep) * 90);
      ctx.stroke();

      ctx.fillStyle = '#e0f2fe';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('23°C CLEAR', 265, 118);
      ctx.fillStyle = '#67e8f9';
      ctx.font = '15px monospace';
      ctx.fillText('MAGLEV LINE A : ON TIME', 265, 158);
      ctx.fillText('SKYBRIDGE LIFT: ACTIVE', 265, 184);
      ctx.fillText('AIR QUALITY   : 99% PURE', 265, 210);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('TRAFFIC FLOW  : OPTIMAL', 265, 236);
    } else {
      // CH 04: CYBER GRAND PRIX LIVE
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('CH 04 · CYBER GRAND PRIX LIVE', 20, 34);

      // Oval neon race track
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 36;
      ctx.beginPath();
      ctx.ellipse(W / 2, 162, 175, 76, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Animated racing cars
      const racers = [
        { phase: 0, speed: 1.9, col: '#22d3ee' },
        { phase: 1.4, speed: 1.75, col: '#f43f5e' },
        { phase: 3.1, speed: 1.85, col: '#fbbf24' },
        { phase: 4.5, speed: 1.68, col: '#a855f7' },
      ];
      for (const r of racers) {
        const a = elapsedSec * r.speed + r.phase;
        const px = W / 2 + Math.cos(a) * 175;
        const py = 162 + Math.sin(a) * 76;
        ctx.fillStyle = r.col;
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('LAP 14/20 · TOP SPEED 340 KM/H · PRESS [E] TO CHANGE CHANNEL', 24, H - 18);
    }

    // Channel badge bottom-right
    ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
    ctx.fillRect(W - 142, 14, 128, 24);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`CH 0${tv.channel + 1} · [E] NEXT`, W - 134, 30);

    tv.texture.needsUpdate = true;
  }

  // =========================================================================
  // 7. MAGLEV TRANSIT SKYWAYS, PARKS & STREET LAMPS
  // =========================================================================

  private buildMaglevSkyways() {
    const spireMat = this.track(new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.5, roughness: 0.22 }));
    const trackZs = [-102, -168];

    for (const tz of trackZs) {
      const track = new THREE.Mesh(this.track(new THREE.BoxGeometry(270, 0.75, 2.8)), this.chromeMat);
      track.position.set(0, 16.5, tz);
      const glow = new THREE.Mesh(this.track(new THREE.BoxGeometry(270, 0.22, 3.0)), this.cyanGlowMat);
      glow.position.set(0, 16.1, tz);
      this.root.add(track, glow);

      for (const px of [-96, -38, 38, 96]) {
        const pylon = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.65, 0.95, 16.5, 10)), this.chromeMat);
        pylon.position.set(px, 8.25, tz);
        this.root.add(pylon);
      }
    }

    const podHullGeo = this.track(new THREE.BoxGeometry(7.6, 1.4, 2.0));
    const podGlowGeo = this.track(new THREE.BoxGeometry(7.8, 0.28, 2.1));
    const podSpecs = [
      { x: -65, z: -102.55, speed: 24, dir: 1 },
      { x: 45, z: -101.45, speed: 28, dir: -1 },
      { x: -20, z: -168.55, speed: 26, dir: 1 },
      { x: 80, z: -167.45, speed: 22, dir: -1 },
    ];
    for (const ps of podSpecs) {
      const pod = new THREE.Group();
      pod.position.set(ps.x, 17.65, ps.z);
      const hull = new THREE.Mesh(podHullGeo, spireMat);
      const stripe = new THREE.Mesh(podGlowGeo, ps.dir > 0 ? this.cyanGlowMat : this.goldGlowMat);
      stripe.position.y = -0.25;
      pod.add(hull, stripe);
      this.root.add(pod);
      this.maglevPods.push({ mesh: pod, speed: ps.speed, dir: ps.dir });
    }
  }

  private buildUrbanParksAndLamps() {
    const trunkGeo = this.track(new THREE.CylinderGeometry(0.22, 0.34, 2.4, 8));
    const trunkMat = this.track(new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.85 }));
    const foliageGeo1 = this.track(new THREE.ConeGeometry(1.75, 2.6, 8));
    const foliageGeo2 = this.track(new THREE.ConeGeometry(1.3, 2.2, 8));
    const foliageMat = this.track(new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.65 }));
    const lampPoleGeo = this.track(new THREE.CylinderGeometry(0.09, 0.13, 4.2, 8));
    const lampOrbGeo = this.track(new THREE.SphereGeometry(0.28, 10, 10));

    const treeCoords: Array<[number, number]> = [
      [-14, -30], [14, -30],
      [-34, -36], [34, -36],
      [-36, -64], [36, -64],
      [-36, -110], [36, -110],
      [-36, -142], [36, -142],
      [-64, -80], [64, -80],
      [-64, -148], [64, -148],
      [-94, -80], [94, -80],
      [-94, -148], [94, -148],
      [-12, -148], [12, -148],
    ];
    for (const [tx, tz] of treeCoords) {
      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.2;
      const c1 = new THREE.Mesh(foliageGeo1, foliageMat);
      c1.position.y = 3.1;
      const c2 = new THREE.Mesh(foliageGeo2, foliageMat);
      c2.position.y = 4.5;
      tree.add(trunk, c1, c2);
      this.root.add(tree);
    }

    // Modern illuminated avenue street lamps
    for (const lx of [-38, 38, -58, 58]) {
      for (const lz of [-44, -74, -112, -144, -176]) {
        const lamp = new THREE.Group();
        lamp.position.set(lx, 0, lz);
        const pole = new THREE.Mesh(lampPoleGeo, this.chromeMat);
        pole.position.y = 2.1;
        const orb = new THREE.Mesh(lampOrbGeo, this.goldGlowMat);
        orb.position.y = 4.35;
        lamp.add(pole, orb);
        this.root.add(lamp);
      }
    }
  }

  // =========================================================================
  // 8. PLAYER-DRIVABLE FUTURISTIC CARS & CYBER-BIKES (GTA VEHICLE SYSTEM!)
  // =========================================================================

  private createCyberCarMesh(bodyHex: string, accentMat: THREE.MeshStandardMaterial) {
    const group = new THREE.Group();
    const bodyMat = this.track(
      new THREE.MeshStandardMaterial({ color: bodyHex, metalness: 0.78, roughness: 0.18 })
    );
    const darkTrimMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.65, roughness: 0.35 })
    );
    const canopyMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: '#0f172a',
        roughness: 0.08,
        metalness: 0.35,
        transparent: true,
        opacity: 0.62,
      })
    );
    const tireMat = this.track(new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.85 }));
    const tailMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#dc2626', emissiveIntensity: 2.0 })
    );
    const headMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#bae6fd', emissiveIntensity: 2.2 })
    );

    // Sculpted lower chassis + sleek wedge hood
    const chassis = new THREE.Mesh(this.track(new THREE.BoxGeometry(2.05, 0.56, 4.4)), bodyMat);
    chassis.position.set(0, 0.62, 0);
    const nose = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.9, 0.34, 1.3)), bodyMat);
    nose.position.set(0, 0.54, -2.0);
    nose.rotation.x = 0.14;
    const cabin = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.66, 0.56, 2.05)), canopyMat);
    cabin.position.set(0, 1.12, 0.12);
    const roof = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.56, 0.09, 1.55)), bodyMat);
    roof.position.set(0, 1.42, 0.18);
    // Rear aero spoiler
    const spoilerWing = new THREE.Mesh(this.track(new THREE.BoxGeometry(2.02, 0.08, 0.36)), darkTrimMat);
    spoilerWing.position.set(0, 1.12, 2.04);
    const neonUnder = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.88, 0.06, 3.8)), accentMat);
    neonUnder.position.set(0, 0.3, 0);
    // Headlights & Taillights
    const headBar = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.72, 0.12, 0.1)), headMat);
    headBar.position.set(0, 0.66, -2.58);
    const tailBar = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.84, 0.14, 0.1)), tailMat);
    tailBar.position.set(0, 0.72, 2.22);

    group.add(chassis, nose, cabin, roof, spoilerWing, neonUnder, headBar, tailBar);

    // 4 Articulated Wheels (front pair steer, all 4 spin!)
    const wheelGeo = this.track(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16));
    wheelGeo.rotateZ(Math.PI / 2);
    const rimGeo = this.track(new THREE.CylinderGeometry(0.24, 0.24, 0.3, 10));
    rimGeo.rotateZ(Math.PI / 2);

    const wheels: THREE.Object3D[] = [];
    const frontWheels: THREE.Object3D[] = [];
    const wPositions: Array<[number, number, boolean]> = [
      [-1.02, -1.38, true],
      [1.02, -1.38, true],
      [-1.02, 1.38, false],
      [1.02, 1.38, false],
    ];
    for (const [wx, wz, isFront] of wPositions) {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(wx, 0.38, wz);
      const wheelSpin = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      const rim = new THREE.Mesh(rimGeo, accentMat);
      wheelSpin.add(tire, rim);
      steerPivot.add(wheelSpin);
      group.add(steerPivot);
      wheels.push(wheelSpin);
      if (isFront) frontWheels.push(steerPivot);
    }

    return { group, wheels, frontWheels };
  }

  private createCyberBikeMesh(bodyHex: string, accentMat: THREE.MeshStandardMaterial) {
    const group = new THREE.Group();
    const bodyMat = this.track(
      new THREE.MeshStandardMaterial({ color: bodyHex, metalness: 0.78, roughness: 0.2 })
    );
    const darkMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.6, roughness: 0.38 })
    );
    const tireMat = this.track(new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.85 }));
    const headMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#38bdf8', emissiveIntensity: 2.2 })
    );

    // Sculpted futuristic sportbike frame + cowl + saddle + handlebars
    const frame = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.46, 0.44, 1.75)), bodyMat);
    frame.position.set(0, 0.68, 0);
    const fairing = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.52, 0.48, 0.78)), bodyMat);
    fairing.position.set(0, 0.86, -0.66);
    fairing.rotation.x = 0.28;
    const windshield = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.42, 0.36, 0.08)), this.glassMat);
    windshield.position.set(0, 1.14, -0.82);
    windshield.rotation.x = -0.55;
    const saddle = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.42, 0.14, 0.78)), darkMat);
    saddle.position.set(0, 0.92, 0.24);
    const handlebar = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.03, 0.03, 0.82, 8)), this.chromeMat);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 1.06, -0.52);
    const headlight = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.32, 0.14, 0.12)), headMat);
    headlight.position.set(0, 0.88, -1.04);
    const sideGlow = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.5, 0.08, 1.4)), accentMat);
    sideGlow.position.set(0, 0.62, 0);

    group.add(frame, fairing, windshield, saddle, handlebar, headlight, sideGlow);

    // Twin glowing cyber-wheels
    const tireGeo = this.track(new THREE.TorusGeometry(0.36, 0.11, 10, 22));
    tireGeo.rotateY(Math.PI / 2);
    const rimGeo = this.track(new THREE.TorusGeometry(0.24, 0.04, 8, 18));
    rimGeo.rotateY(Math.PI / 2);

    const wheels: THREE.Object3D[] = [];
    const frontWheels: THREE.Object3D[] = [];
    for (const [wz, isFront] of [
      [-0.95, true],
      [0.95, false],
    ] as Array<[number, boolean]>) {
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.42, wz);
      const spin = new THREE.Group();
      spin.add(new THREE.Mesh(tireGeo, tireMat), new THREE.Mesh(rimGeo, accentMat));
      pivot.add(spin);
      group.add(pivot);
      wheels.push(spin);
      if (isFront) frontWheels.push(pivot);
    }

    return { group, wheels, frontWheels };
  }

  private buildDrivableVehicles() {
    // Place 2 Cyber Supercars & 2 Neon Cyber-Bikes right near the Plaza & Boulevards so players find them easily!
    const car1 = this.createCyberCarMesh('#0ea5e9', this.cyanGlowMat);
    car1.group.position.set(-14, 0, -34);
    car1.group.rotation.y = Math.PI * 0.15;
    this.root.add(car1.group);
    this.vehicles.push({
      id: 'car-cyber-gt',
      name: 'Nova GT-2045 Cyber Supercar',
      kind: 'car',
      group: car1.group,
      x: -14,
      z: -34,
      yaw: Math.PI * 0.15,
      speed: 0,
      steerAngle: 0,
      leanAngle: 0,
      wheels: car1.wheels,
      frontWheels: car1.frontWheels,
      seatOffset: new THREE.Vector3(0, 0.25, 0.15),
      halfWidth: 1.15,
      halfLength: 2.35,
      maxSpeed: 28,
      boostSpeed: 42,
      accel: 18,
    });

    const car2 = this.createCyberCarMesh('#7c3aed', this.purpleGlowMat);
    car2.group.position.set(36, 0, -90);
    car2.group.rotation.y = Math.PI * 0.5;
    this.root.add(car2.group);
    this.vehicles.push({
      id: 'car-quantum-rs',
      name: 'Quantum RS-9 Interceptor',
      kind: 'car',
      group: car2.group,
      x: 36,
      z: -90,
      yaw: Math.PI * 0.5,
      speed: 0,
      steerAngle: 0,
      leanAngle: 0,
      wheels: car2.wheels,
      frontWheels: car2.frontWheels,
      seatOffset: new THREE.Vector3(0, 0.25, 0.15),
      halfWidth: 1.15,
      halfLength: 2.35,
      maxSpeed: 30,
      boostSpeed: 45,
      accel: 20,
    });

    const bike1 = this.createCyberBikeMesh('#f43f5e', this.goldGlowMat);
    bike1.group.position.set(12, 0, -34);
    bike1.group.rotation.y = -Math.PI * 0.12;
    this.root.add(bike1.group);
    this.vehicles.push({
      id: 'bike-volt-r',
      name: 'Volt-R Neon Cyber Bike',
      kind: 'bike',
      group: bike1.group,
      x: 12,
      z: -34,
      yaw: -Math.PI * 0.12,
      speed: 0,
      steerAngle: 0,
      leanAngle: 0,
      wheels: bike1.wheels,
      frontWheels: bike1.frontWheels,
      seatOffset: new THREE.Vector3(0, 0.36, 0.2),
      halfWidth: 0.6,
      halfLength: 1.25,
      maxSpeed: 34,
      boostSpeed: 48,
      accel: 24,
    });

    const bike2 = this.createCyberBikeMesh('#10b981', this.cyanGlowMat);
    bike2.group.position.set(-40, 0, -90);
    bike2.group.rotation.y = -Math.PI * 0.5;
    this.root.add(bike2.group);
    this.vehicles.push({
      id: 'bike-pulse-x',
      name: 'Pulse-X Street Hoverbike',
      kind: 'bike',
      group: bike2.group,
      x: -40,
      z: -90,
      yaw: -Math.PI * 0.5,
      speed: 0,
      steerAngle: 0,
      leanAngle: 0,
      wheels: bike2.wheels,
      frontWheels: bike2.frontWheels,
      seatOffset: new THREE.Vector3(0, 0.36, 0.2),
      halfWidth: 0.6,
      halfLength: 1.25,
      maxSpeed: 34,
      boostSpeed: 48,
      accel: 24,
    });
  }

  // =========================================================================
  // 9. AUTONOMOUS CITY TRAFFIC CARS CRUISING THE AVENUES
  // =========================================================================

  private buildTrafficCars() {
    const colors = ['#e2e8f0', '#38bdf8', '#f59e0b', '#ec4899', '#10b981', '#818cf8', '#f97316', '#06b6d4'];
    const outerLoop: Array<[number, number]> = [
      [-44, -96],
      [44, -96],
      [44, -154],
      [-44, -154],
    ];
    const grandLoop: Array<[number, number]> = [
      [-104, -88],
      [104, -88],
      [104, -212],
      [-104, -212],
    ];

    for (let i = 0; i < 8; i++) {
      const loop = i < 4 ? outerLoop : grandLoop;
      const startIdx = i % loop.length;
      const accent = i % 2 === 0 ? this.cyanGlowMat : this.goldGlowMat;
      const car = this.createCyberCarMesh(colors[i % colors.length], accent);
      const [sx, sz] = loop[startIdx];
      const nextIdx = (startIdx + 1) % loop.length;
      const [nx, nz] = loop[nextIdx];
      const t = 0.25 + (i % 2) * 0.4;
      const x = THREE.MathUtils.lerp(sx, nx, t);
      const z = THREE.MathUtils.lerp(sz, nz, t);
      const yaw = Math.atan2(-(nx - sx), -(nz - sz));
      car.group.position.set(x, 0, z);
      car.group.rotation.y = yaw;
      this.root.add(car.group);

      this.trafficCars.push({
        group: car.group,
        waypoints: loop,
        targetIdx: nextIdx,
        speed: 10.5 + (i % 3) * 2.5,
        x,
        z,
        yaw,
      });
    }
  }

  // =========================================================================
  // 10. LIVING WALKING PEDESTRIANS (28 ARTICULATED 3D CITIZENS!)
  // =========================================================================

  private buildWalkingPedestrians() {
    const jacketPalette = [
      '#0284c7', '#7c3aed', '#059669', '#e11d48', '#d97706', '#2563eb', '#0891b2', '#db2777', '#f8fafc',
    ];
    const skinPalette = ['#f1c29b', '#d9a482', '#a87556', '#e6b89c'];

    const torsoGeo = this.track(new THREE.BoxGeometry(0.36, 0.56, 0.22));
    const headGeo = this.track(new THREE.SphereGeometry(0.125, 10, 8));
    const limbGeo = this.track(new THREE.CylinderGeometry(0.055, 0.045, 0.72, 7));
    const armGeo = this.track(new THREE.CylinderGeometry(0.045, 0.038, 0.56, 7));
    const trouserMat = this.track(new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.85 }));

    const routes: Array<Array<[number, number]>> = [
      // Central Plaza Promenade Loop
      [[-10, -28], [-10, -70], [10, -70], [10, -28]],
      [[10, -28], [10, -70], [-10, -70], [-10, -28]],
      // Wide Plaza Sidewalk Ring
      [[-36, -30], [-36, -80], [36, -80], [36, -30]],
      [[36, -80], [-36, -80], [-36, -30], [36, -30]],
      // North Downtown Boulevard Sidewalks
      [[-36, -104], [36, -104], [36, -146], [-36, -146]],
      [[36, -146], [-36, -146], [-36, -104], [36, -104]],
      // West Avenue Stroll
      [[-60, -40], [-60, -170], [-60, -104]],
      // East Avenue Stroll
      [[60, -40], [60, -170], [60, -104]],
    ];

    const totalPeds = 28;
    for (let i = 0; i < totalPeds; i++) {
      const route = routes[i % routes.length];
      const seg = i % route.length;
      const nextSeg = (seg + 1) % route.length;
      const frac = ((i * 0.37) % 1);

      const x = THREE.MathUtils.lerp(route[seg][0], route[nextSeg][0], frac) + ((i % 3) - 1) * 1.1;
      const z = THREE.MathUtils.lerp(route[seg][1], route[nextSeg][1], frac) + (((i + 1) % 3) - 1) * 1.1;

      const group = new THREE.Group();
      const jacketMat = this.track(
        new THREE.MeshStandardMaterial({
          color: jacketPalette[i % jacketPalette.length],
          roughness: 0.72,
          metalness: 0.1,
        })
      );
      const skinMat = this.track(
        new THREE.MeshStandardMaterial({ color: skinPalette[i % skinPalette.length], roughness: 0.65 })
      );

      const torso = new THREE.Mesh(torsoGeo, jacketMat);
      torso.position.y = 1.12;
      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.y = 1.56;

      // Glowing cyber collar stripe
      const accent = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.38, 0.05, 0.24)),
        i % 2 === 0 ? this.cyanGlowMat : this.purpleGlowMat
      );
      accent.position.y = 1.36;

      const leftLeg = new THREE.Group();
      leftLeg.position.set(-0.095, 0.82, 0);
      const llMesh = new THREE.Mesh(limbGeo, trouserMat);
      llMesh.position.y = -0.38;
      leftLeg.add(llMesh);

      const rightLeg = new THREE.Group();
      rightLeg.position.set(0.095, 0.82, 0);
      const rlMesh = new THREE.Mesh(limbGeo, trouserMat);
      rlMesh.position.y = -0.38;
      rightLeg.add(rlMesh);

      const leftArm = new THREE.Group();
      leftArm.position.set(-0.24, 1.34, 0);
      const laMesh = new THREE.Mesh(armGeo, jacketMat);
      laMesh.position.y = -0.28;
      leftArm.add(laMesh);

      const rightArm = new THREE.Group();
      rightArm.position.set(0.24, 1.34, 0);
      const raMesh = new THREE.Mesh(armGeo, jacketMat);
      raMesh.position.y = -0.28;
      rightArm.add(raMesh);

      group.add(torso, head, accent, leftLeg, rightLeg, leftArm, rightArm);
      group.position.set(x, 0, z);
      this.root.add(group);

      this.pedestrians.push({
        group,
        leftLeg,
        rightLeg,
        leftArm,
        rightArm,
        waypoints: route,
        targetIdx: nextSeg,
        speed: 1.55 + (i % 5) * 0.25,
        stridePhase: i * 1.1,
        x,
        z,
        yaw: 0,
      });
    }
  }

  // =========================================================================
  // PUBLIC PHYSICS, HEIGHT, COLLISION & INTERACTION API
  // =========================================================================

  /**
   * Computes the exact walkable ground/step/deck/lift floor height at (x, z)
   * given the player's current elevation so players smoothly climb stairs,
   * cross elevated skybridges, and ride glass elevators!
   */
  public getGroundHeightAt(x: number, z: number, currentY: number): number {
    if (z > -21.0) return 0; // Inside BioQuest Laboratory

    let bestY = 0;

    // 1. Check active Glass Elevator Cabin floors
    for (const lift of this.lifts) {
      if (Math.abs(x - lift.x) <= lift.shaftRadius && Math.abs(z - lift.z) <= lift.shaftRadius) {
        if (currentY >= lift.currentY - 1.2 && currentY <= lift.currentY + 2.4) {
          bestY = Math.max(bestY, lift.currentY);
        }
      }
    }

    // 2. Check Walkable 3D Staircases (smooth step ramp)
    for (const s of this.stairs) {
      if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) {
        const coord = s.axis === 'z' ? z : x;
        const t = THREE.MathUtils.clamp((coord - s.startCoord) / (s.endCoord - s.startCoord), 0, 1);
        const stairY = THREE.MathUtils.lerp(s.startY, s.endY, t);
        if (currentY >= stairY - 1.15 && currentY <= stairY + 2.2) {
          bestY = Math.max(bestY, stairY);
        }
      }
    }

    // 3. Check Elevated Sky-Promenade, Skybridge & Rooftop Platforms
    for (const p of this.platforms) {
      if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
        if (currentY >= p.y - 0.85) {
          bestY = Math.max(bestY, p.y);
        }
      }
    }

    return bestY;
  }

  public collidesAt(x: number, z: number, y: number, r = 0.45): boolean {
    if (z > -21.0) return false;
    for (const c of this.colliders) {
      if (y < c.maxY && x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        return true;
      }
    }
    // Collide with parked vehicles when walking on foot at ground level
    if (!this.activeVehicle && y < 1.6) {
      for (const v of this.vehicles) {
        const dist = Math.hypot(x - v.x, z - v.z);
        if (dist < Math.max(v.halfWidth, v.halfLength) * 0.72) {
          return true;
        }
      }
    }
    return false;
  }

  public getNearbyInteractables(playerPos: THREE.Vector3): InteractableTarget[] {
    if (playerPos.z > -19.5) return [];
    const results: Array<{ target: InteractableTarget; dist: number }> = [];

    if (this.activeVehicle) {
      return [
        {
          id: `exit-${this.activeVehicle.id}`,
          kind: 'vehicle',
          entityId: this.activeVehicle.id,
          label: this.activeVehicle.name,
          sublabel: 'Press [E] or [F] to Exit Vehicle',
        },
      ];
    }

    // Drivable Cars & Bikes
    for (const v of this.vehicles) {
      const dist = Math.hypot(playerPos.x - v.x, playerPos.z - v.z);
      if (dist < 4.2 && playerPos.y < 2.2) {
        results.push({
          dist,
          target: {
            id: v.id,
            kind: 'vehicle',
            entityId: v.id,
            label: v.name,
            sublabel: v.kind === 'bike' ? 'Press [E] to Ride Cyber Bike' : 'Press [E] to Drive Cyber Car',
          },
        });
      }
    }

    // Working Glass Elevators / Lifts
    for (const lift of this.lifts) {
      const horiz = Math.hypot(playerPos.x - lift.x, playerPos.z - lift.z);
      if (horiz < 4.4) {
        const insideCabin =
          Math.abs(playerPos.x - lift.x) <= 2.1 &&
          Math.abs(playerPos.z - lift.z) <= 2.1 &&
          Math.abs(playerPos.y - lift.currentY) < 1.4;
        const nextIdx = (lift.targetFloorIdx + 1) % lift.floors.length;
        const nextFloorLabel = nextIdx === 0 ? 'Ground Plaza' : nextIdx === 1 ? 'Skybridge L2' : 'Rooftop Deck L3';
        results.push({
          dist: horiz,
          target: {
            id: lift.id,
            kind: 'lift',
            entityId: lift.id,
            label: lift.name,
            sublabel: insideCabin
              ? `Inside Lift · Press [E] to Ride to ${nextFloorLabel}`
              : `Press [E] to Call Lift to Your Floor`,
          },
        });
      }
    }

    // Working Live City TVs
    for (const tv of this.tvs) {
      const dist = playerPos.distanceTo(tv.interactPos);
      if (dist < tv.radius) {
        const chName = TV_CHANNELS[tv.channel];
        results.push({
          dist,
          target: {
            id: tv.id,
            kind: 'tv',
            entityId: tv.id,
            label: tv.name,
            sublabel: tv.poweredOn
              ? `${chName} · Press [E] to Switch Channel`
              : 'TV Off · Press [E] to Power On',
          },
        });
      }
    }

    results.sort((a, b) => a.dist - b.dist);
    return results.map((r) => r.target);
  }

  public isDriving(): boolean {
    return this.activeVehicle !== null;
  }

  public getActiveVehicle(): DrivableVehicle | null {
    return this.activeVehicle;
  }

  public getVehicleHudState(boosting: boolean): VehicleHudState {
    if (!this.activeVehicle) {
      return { active: false, name: '', kind: 'car', speedKmh: 0, boosting: false };
    }
    return {
      active: true,
      name: this.activeVehicle.name,
      kind: this.activeVehicle.kind,
      speedKmh: Math.round(Math.abs(this.activeVehicle.speed) * 3.6),
      boosting,
    };
  }

  public toggleVehicle(entityId?: string, playerPos?: THREE.Vector3): {
    entered: boolean;
    exited: boolean;
    vehicleName?: string;
    exitPos?: THREE.Vector3;
  } {
    if (this.activeVehicle) {
      const v = this.activeVehicle;
      v.speed *= 0.25;
      // Step player out to the left side of the vehicle
      const exitX = v.x - Math.cos(v.yaw) * (v.halfWidth + 1.15);
      const exitZ = v.z + Math.sin(v.yaw) * (v.halfWidth + 1.15);
      this.activeVehicle = null;
      return {
        entered: false,
        exited: true,
        vehicleName: v.name,
        exitPos: new THREE.Vector3(exitX, 0, exitZ),
      };
    }

    const found =
      this.vehicles.find((v) => v.id === entityId) ||
      (playerPos
        ? this.vehicles.find((v) => Math.hypot(playerPos.x - v.x, playerPos.z - v.z) < 4.5)
        : undefined);
    if (!found) return { entered: false, exited: false };
    this.activeVehicle = found;
    return { entered: true, exited: false, vehicleName: found.name };
  }

  public interactLift(liftId: string, playerPos: THREE.Vector3): string | null {
    const lift = this.lifts.find((l) => l.id === liftId);
    if (!lift) return null;

    const insideCabin =
      Math.abs(playerPos.x - lift.x) <= 2.15 &&
      Math.abs(playerPos.z - lift.z) <= 2.15 &&
      Math.abs(playerPos.y - lift.currentY) < 1.5;

    if (insideCabin) {
      lift.targetFloorIdx = (lift.targetFloorIdx + 1) % lift.floors.length;
      lift.moving = true;
      const names = ['Ground Plaza (0m)', 'Skybridge Level 2 (9m)', 'Rooftop Observation Deck (18m)'];
      return `${lift.name} departing for ${names[lift.targetFloorIdx]}.`;
    } else {
      // Call lift to closest floor to the player
      let nearestIdx = 0;
      let nearestDiff = Infinity;
      lift.floors.forEach((fy, idx) => {
        const diff = Math.abs(playerPos.y - fy);
        if (diff < nearestDiff) {
          nearestDiff = diff;
          nearestIdx = idx;
        }
      });
      lift.targetFloorIdx = nearestIdx;
      lift.moving = true;
      return `${lift.name} called to your floor. Step inside the glass cabin and press E to ride!`;
    }
  }

  public interactTv(tvId: string): string | null {
    const tv = this.tvs.find((t) => t.id === tvId);
    if (!tv) return null;

    if (!tv.poweredOn) {
      tv.poweredOn = true;
      tv.channel = 0;
    } else if (tv.channel >= TV_CHANNELS.length - 1) {
      tv.poweredOn = false;
    } else {
      tv.channel += 1;
    }
    this.drawTvFrame(tv, performance.now() * 0.001);
    return tv.poweredOn
      ? `${tv.name}: Tuned to CH 0${tv.channel + 1} — ${TV_CHANNELS[tv.channel]}.`
      : `${tv.name}: Switched to standby mode. Press E anytime to power back on.`;
  }

  /**
   * Drives the currently occupied Car or Cyber-Bike with realistic GTA arcade handling!
   */
  public updateVehicleDriving(
    dt: number,
    throttle: number, // -1..1
    steerInput: number, // -1 (left) .. 1 (right)
    boost: boolean,
    handbrake: boolean
  ): { x: number; y: number; z: number; yaw: number; speed: number; leanAngle: number } | null {
    const v = this.activeVehicle;
    if (!v) return null;

    const topSpd = boost ? v.boostSpeed : v.maxSpeed;
    const accelRate = boost ? v.accel * 1.45 : v.accel;

    if (handbrake) {
      v.speed = THREE.MathUtils.damp(v.speed, 0, 7.5, dt);
    } else if (Math.abs(throttle) > 0.05) {
      const target = throttle > 0 ? topSpd * throttle : -11.5 * Math.abs(throttle);
      v.speed = THREE.MathUtils.damp(v.speed, target, throttle > 0 ? accelRate * 0.14 : 5.5, dt);
    } else {
      v.speed = THREE.MathUtils.damp(v.speed, 0, 2.4, dt);
    }

    // Steering response scales cleanly with velocity so cars/bikes don't spin in place
    const speedFactor = THREE.MathUtils.clamp(Math.abs(v.speed) / 7.5, 0, 1);
    const reverseSign = v.speed >= -0.2 ? 1 : -1;
    const turnStrength = (v.kind === 'bike' ? 2.55 : 2.05) * (handbrake ? 1.35 : 1.0);
    v.yaw -= steerInput * turnStrength * speedFactor * reverseSign * dt;

    // Visual front wheel steer & bike corner lean!
    v.steerAngle = THREE.MathUtils.damp(v.steerAngle, -steerInput * 0.48, 10, dt);
    const targetLean = v.kind === 'bike' ? steerInput * 0.42 * speedFactor : -steerInput * 0.055 * speedFactor;
    v.leanAngle = THREE.MathUtils.damp(v.leanAngle, targetLean, 9, dt);

    // Move along vehicle forward axis (-sin(yaw), -cos(yaw))
    const fwdX = -Math.sin(v.yaw);
    const fwdZ = -Math.cos(v.yaw);
    const nextX = THREE.MathUtils.clamp(v.x + fwdX * v.speed * dt, -128, 128);
    const nextZ = THREE.MathUtils.clamp(v.z + fwdZ * v.speed * dt, -228, -26.5);

    const colR = v.kind === 'bike' ? 0.85 : 1.65;
    if (!this.collidesAt(nextX, v.z, 0.5, colR)) {
      v.x = nextX;
    } else {
      v.speed *= -0.25;
    }
    if (!this.collidesAt(v.x, nextZ, 0.5, colR)) {
      v.z = nextZ;
    } else {
      v.speed *= -0.25;
    }

    v.group.position.set(v.x, 0, v.z);
    v.group.rotation.set(0, v.yaw, v.leanAngle);

    for (const fw of v.frontWheels) {
      fw.rotation.y = v.steerAngle;
    }
    const wheelSpinDelta = (v.speed * dt) / 0.38;
    for (const w of v.wheels) {
      w.rotation.x -= wheelSpinDelta;
    }

    return {
      x: v.x,
      y: 0,
      z: v.z,
      yaw: v.yaw,
      speed: v.speed,
      leanAngle: v.leanAngle,
    };
  }

  /**
   * Returns any vertical delta applied by a moving lift cabin if the player is standing inside it.
   */
  public getLiftVerticalCarryDelta(playerPos: THREE.Vector3): number {
    for (const lift of this.lifts) {
      if (
        Math.abs(playerPos.x - lift.x) <= lift.shaftRadius &&
        Math.abs(playerPos.z - lift.z) <= lift.shaftRadius &&
        Math.abs(playerPos.y - lift.prevY) < 0.75
      ) {
        return lift.currentY - lift.prevY;
      }
    }
    return 0;
  }

  /**
   * Per-frame living city simulation:
   *  - Walking pedestrians
   *  - Cruising traffic cars
   *  - Glass elevators moving smoothly between floors
   *  - Live TV channel broadcasts
   *  - Maglev skyway pods & monument rings
   */
  public update(dt: number, elapsedSec: number, isCityVisible: boolean) {
    // Monument rotating rings
    if (this.monumentRings.length >= 2) {
      this.monumentRings[0].rotation.y += dt * 0.65;
      this.monumentRings[0].rotation.x = Math.sin(elapsedSec * 0.5) * 0.35;
      this.monumentRings[1].rotation.z -= dt * 0.85;
      this.monumentRings[1].rotation.y += dt * 0.45;
    }

    // Elevated Maglev Skyway Pods
    for (const pod of this.maglevPods) {
      pod.mesh.position.x += pod.speed * pod.dir * dt;
      if (pod.mesh.position.x > 132) pod.mesh.position.x = -132;
      if (pod.mesh.position.x < -132) pod.mesh.position.x = 132;
    }

    if (!isCityVisible) return;

    // Update Working Glass Elevators
    for (const lift of this.lifts) {
      lift.prevY = lift.currentY;
      const targetY = lift.floors[lift.targetFloorIdx];
      const diff = targetY - lift.currentY;
      if (Math.abs(diff) > 0.04) {
        lift.moving = true;
        // Close doors before moving
        lift.doorOpen = THREE.MathUtils.damp(lift.doorOpen, 0, 8, dt);
        if (lift.doorOpen < 0.15) {
          const step = Math.sign(diff) * Math.min(Math.abs(diff), 4.6 * dt);
          lift.currentY += step;
        }
      } else {
        lift.currentY = targetY;
        lift.currentFloorIdx = lift.targetFloorIdx;
        lift.moving = false;
        lift.doorOpen = THREE.MathUtils.damp(lift.doorOpen, 1, 7, dt);
      }
      lift.cabinGroup.position.y = lift.currentY;
      const slide = 0.86 + lift.doorOpen * 0.85;
      lift.doorL.position.x = -slide;
      lift.doorR.position.x = slide;
    }

    // Update Walking City Pedestrians (28 citizens!)
    for (const ped of this.pedestrians) {
      const [tx, tz] = ped.waypoints[ped.targetIdx];
      const dx = tx - ped.x;
      const dz = tz - ped.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.2) {
        ped.targetIdx = (ped.targetIdx + 1) % ped.waypoints.length;
      } else {
        const vx = (dx / dist) * ped.speed;
        const vz = (dz / dist) * ped.speed;
        ped.x += vx * dt;
        ped.z += vz * dt;
        const targetYaw = Math.atan2(dx, dz);
        let dYaw = targetYaw - ped.yaw;
        while (dYaw > Math.PI) dYaw -= Math.PI * 2;
        while (dYaw < -Math.PI) dYaw += Math.PI * 2;
        ped.yaw += dYaw * Math.min(1, dt * 6);
      }

      ped.stridePhase += ped.speed * dt * 2.4;
      const s = Math.sin(ped.stridePhase);
      ped.leftLeg.rotation.x = s * 0.55;
      ped.rightLeg.rotation.x = -s * 0.55;
      ped.leftArm.rotation.x = -s * 0.45;
      ped.rightArm.rotation.x = s * 0.45;
      ped.group.position.set(ped.x, Math.abs(s) * 0.035, ped.z);
      ped.group.rotation.y = ped.yaw;
    }

    // Update Autonomous City Traffic Cars
    for (const tc of this.trafficCars) {
      const [tx, tz] = tc.waypoints[tc.targetIdx];
      const dx = tx - tc.x;
      const dz = tz - tc.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3.0) {
        tc.targetIdx = (tc.targetIdx + 1) % tc.waypoints.length;
      } else {
        tc.x += (dx / dist) * tc.speed * dt;
        tc.z += (dz / dist) * tc.speed * dt;
        const targetYaw = Math.atan2(-dx, -dz);
        let dYaw = targetYaw - tc.yaw;
        while (dYaw > Math.PI) dYaw -= Math.PI * 2;
        while (dYaw < -Math.PI) dYaw += Math.PI * 2;
        tc.yaw += dYaw * Math.min(1, dt * 5.5);
      }
      tc.group.position.set(tc.x, 0, tc.z);
      tc.group.rotation.y = tc.yaw;
    }

    // Animate Live Working City TVs (~10 Hz crisp canvas refresh -> zero CPU bottleneck!)
    this.tvAnimAccum += dt;
    if (this.tvAnimAccum >= 0.1) {
      this.tvAnimAccum = 0;
      for (const tv of this.tvs) {
        if (tv.poweredOn) {
          this.drawTvFrame(tv, elapsedSec);
        }
      }
    }
  }

  public dispose() {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
