import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createFacilityTextures, FacilityTextures } from './facilityTextures';
import { VAULTS, ATRIUM_INCIDENT_LOGS, FAILED_EXPERIMENTS } from '../data/vaultData';
import { CinematicSceneId, GamePhase, InteractableTarget, VaultId } from '../types/game';

interface BoxCollider {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  active: boolean;
}

interface VaultVisual {
  id: VaultId;
  doorLeft: THREE.Mesh;
  doorRight: THREE.Mesh;
  beaconMat: THREE.MeshStandardMaterial;
  beaconLight: THREE.PointLight;
  hologramGroup: THREE.Group;
  terminalPos: THREE.Vector3;
  doorOpenAmount: number;
  targetOpen: number;
  collider: BoxCollider;
}

interface InteractableNode {
  id: string;
  kind: 'vault' | 'log' | 'nexus' | 'exit' | 'monument' | 'experiment';
  position: THREE.Vector3;
  radius: number;
  label: string;
  sublabel: string;
  vaultId?: VaultId;
  logId?: string;
  experimentId?: string;
}

interface ExperimentPodVisual {
  id: string;
  specimen: THREE.Group;
  light: THREE.PointLight;
  ringMat: THREE.MeshStandardMaterial;
  baseColorHex: string;
  phaseOffset: number;
}

interface ChemicalLeakZone {
  x: number;
  z: number;
  radius: number;
  maxPpm: number;
  smellCue: string;
}

interface FireworkSlot {
  active: boolean;
  age: number;
  duration: number;
  startIndex: number;
  count: number;
}

export interface LabEngineCallbacks {
  onCinematicTimeUpdate: (timeSec: number, sceneId: CinematicSceneId) => void;
  onCinematicComplete: () => void;
  onPointerLockChange: (locked: boolean) => void;
  onHoverTargetChange: (target: InteractableTarget | null) => void;
  onInteract: (target: InteractableTarget) => void;
  onPlayerPositionUpdate?: (x: number, z: number, yaw: number) => void;
  onEnterModernWorld?: () => void;
  onFireworkBurst?: () => void;
  onFumeLevelChange?: (ppm: number, smellCue: string | null) => void;
  onChemicalHiss?: () => void;
  onAmbientCreak?: () => void;
}

// Reusable scratch vectors to guarantee zero per-frame GC
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _toNode = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _bgDark = new THREE.Color('#04070d');
const _bgModern = new THREE.Color('#8ecae6');
const _bgCurrent = new THREE.Color('#04070d');
const _fogHorror = new THREE.Color('#071012');
const _hemiSkyDark = new THREE.Color('#5eead4');
const _hemiSkyModern = new THREE.Color('#e0f2fe');
const _hemiGndDark = new THREE.Color('#080b12');
const _hemiGndModern = new THREE.Color('#94a3b8');

const FIREWORK_SLOTS = 5;
const PARTICLES_PER_FIREWORK = 64;
const TOTAL_FIREWORK_PARTICLES = FIREWORK_SLOTS * PARTICLES_PER_FIREWORK;
const FIREWORK_PALETTES = [
  [0x22d3ee, 0xa5f3fc, 0xffffff], // Cyan & white
  [0xfbbf24, 0xf59e0b, 0xfef3c7], // Gold & amber
  [0x10b981, 0x6ee7b7, 0x38bdf8], // Emerald & sky
  [0xf472b6, 0xc084fc, 0xffffff], // Magenta & violet
  [0xfb7185, 0xfde047, 0x38bdf8], // Coral, gold & cyan
];

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class LabSceneEngine {
  private container: HTMLElement;
  private callbacks: LabEngineCallbacks;
  private isSoftwareGl: boolean;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: FacilityTextures;
  private pmremRT: THREE.WebGLRenderTarget | null = null;

  private disposables: Array<{ dispose: () => void }> = [];
  private colliders: BoxCollider[] = [];
  private interactables: InteractableNode[] = [];
  private vaultVisuals: Map<VaultId, VaultVisual> = new Map();

  // Dynamic lighting & props
  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private mainLights: THREE.PointLight[] = [];
  private emergencyLights: THREE.PointLight[] = [];
  private beaconRotors: THREE.Group[] = [];
  private securityCameras: THREE.Group[] = [];
  private workstationMonitorMats: THREE.MeshStandardMaterial[] = [];

  // Main Door & 5 Physical Key Pedestals
  private exitScreenMat!: THREE.MeshStandardMaterial;
  private exitShutterLeft!: THREE.Mesh;
  private exitShutterRight!: THREE.Mesh;
  private facadeShutter!: THREE.Mesh;
  private mainDoorCollider!: BoxCollider;
  private keySocketMats: THREE.MeshStandardMaterial[] = [];
  private placedKeyHolograms: THREE.Group[] = [];

  // NEXUS hologram parts
  private nexusGroup!: THREE.Group;
  private nexusRingOuter!: THREE.Mesh;
  private nexusRingInner!: THREE.Mesh;
  private nexusCoreMesh!: THREE.Mesh;
  private nexusLight!: THREE.PointLight;
  private nexusActivation = 0;

  // Modern World animated props
  private modernMonumentRings: THREE.Mesh[] = [];
  private maglevPods: Array<{ mesh: THREE.Group; speed: number; dir: number; baseZ: number }> = [];
  private outdoorBlend = 0; // 0 = dark lab, 1 = sunlit modernized world
  private modernWorldEnteredNotified = false;

  // Electrical sparks (pooled, lightweight)
  private sparkPoints!: THREE.Points;
  private sparkPositions!: Float32Array;
  private sparkVelocities: Float32Array = new Float32Array(42 * 3);
  private sparkLife: Float32Array = new Float32Array(42);
  private sparkLight!: THREE.PointLight;

  // Bursting 3D Fireworks System (Lab + Modern World)
  private fwPoints!: THREE.Points;
  private fwPositions!: Float32Array;
  private fwColors!: Float32Array;
  private fwBaseColors!: Float32Array;
  private fwVelocities!: Float32Array;
  private fwSlots: FireworkSlot[] = [];
  private fwLight!: THREE.PointLight;
  private pendingFireworkQueue: Array<{ delay: number; x: number; y: number; z: number; scale: number }> = [];
  private autoFireworkCooldown = 2.4;

  // Horror atmosphere: Headlamp, Failed Experiments, Chemical Leaks & Rising Fumes
  private headlamp!: THREE.SpotLight;
  private headlampTarget!: THREE.Object3D;
  private experimentPods: Map<string, ExperimentPodVisual> = new Map();
  private chemicalLeaks: ChemicalLeakZone[] = [];
  private fumePoints!: THREE.Points;
  private fumePositions!: Float32Array;
  private fumeOrigins!: Float32Array;
  private fumeSpeeds!: Float32Array;
  private fumeMat!: THREE.PointsMaterial;
  private fumeCheckAccum = 0;
  private lastReportedPpm = -1;
  private lastReportedSmell: string | null = null;
  private hissCooldown = 0;
  private ambientCreakTimer = 11.5;

  // State
  private phase: GamePhase = 'cinematic';
  private paused = false;
  private cinematicElapsed = 0;
  private cinematicRunning = false;
  private lastCinematicScene: CinematicSceneId = 1;
  private completedVaults: Set<VaultId> = new Set();
  private placedKeys: Set<VaultId> = new Set();
  private resolvedExperiments: Set<string> = new Set();
  private mainDoorOpen = false;
  private facilityRestored = false;

  // First-person player controller
  private playerPos = new THREE.Vector3(0, 1.65, 14.5);
  private playerVel = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private walkBobPhase = 0;
  private keys: Record<string, boolean> = {};
  private pointerLocked = false;
  private isDraggingLook = false;
  private lastDragX = 0;
  private lastDragY = 0;
  private currentHover: InteractableTarget | null = null;

  // Animation loop
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private mapUpdateAccum = 0;

  // Bound event listeners
  private onResizeBound: () => void;
  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;
  private onMouseMoveBound: (e: MouseEvent) => void;
  private onMouseDownBound: (e: MouseEvent) => void;
  private onMouseUpBound: () => void;
  private onPointerLockChangeBound: () => void;
  private onContextLostBound: (e: Event) => void;

  constructor(container: HTMLElement, callbacks: LabEngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = _bgDark.clone();
    this.scene.fog = new THREE.FogExp2('#050912', 0.017);

    // Studio procedural reflections (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.pmremRT.texture;
    this.scene.environmentIntensity = 0.6;
    pmremGenerator.dispose();

    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(64, aspect, 0.1, 240);
    this.camera.rotation.order = 'YXZ';

    this.textures = createFacilityTextures(this.renderer.capabilities.getMaxAnisotropy());

    this.buildLighting();
    this.buildSouthExteriorBackdrop();
    this.buildGrandFacilityArchitecture();
    this.buildCentralNexusCore();
    this.buildGrandMainDoorAndKeyPedestals();
    this.buildLabWorkstationsAndLogs();
    this.buildFiveVaults();
    this.buildHorrorLabDetails();
    this.buildModernizedWorld();
    this.buildSparksSystem();
    this.buildFireworksSystem();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Bind events
    this.onResizeBound = this.handleResize.bind(this);
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    this.onKeyUpBound = this.handleKeyUp.bind(this);
    this.onMouseMoveBound = this.handleMouseMove.bind(this);
    this.onMouseDownBound = this.handleMouseDown.bind(this);
    this.onMouseUpBound = this.handleMouseUp.bind(this);
    this.onPointerLockChangeBound = this.handlePointerLockChange.bind(this);
    this.onContextLostBound = (e: Event) => e.preventDefault();

    window.addEventListener('resize', this.onResizeBound);
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('mousemove', this.onMouseMoveBound);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDownBound);
    window.addEventListener('mouseup', this.onMouseUpBound);
    document.addEventListener('pointerlockchange', this.onPointerLockChangeBound);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLostBound);

    this.lastTime = performance.now();
    this.tick();
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private buildLighting() {
    this.hemiLight = new THREE.HemisphereLight('#67e8f9', '#090e1a', 0.6);
    this.scene.add(this.hemiLight);

    // Directional key light (warms & brightens smoothly in the Modern World)
    this.sunLight = new THREE.DirectionalLight('#bae6fd', 0.75);
    this.sunLight.position.set(16, 26, -18);
    if (!this.isSoftwareGl) {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.sunLight.shadow.camera.left = -28;
      this.sunLight.shadow.camera.right = 28;
      this.sunLight.shadow.camera.top = 28;
      this.sunLight.shadow.camera.bottom = -28;
      this.sunLight.shadow.bias = -0.0005;
      this.sunLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.sunLight);

    // Spacious grand ceiling lights across the 44m x 42m lab
    const mainPositions: Array<[number, number, number]> = [
      [0, 9.6, 10],
      [0, 9.6, -6],
      [-13, 9.6, 2],
      [13, 9.6, 2],
      [0, 9.6, -15],
    ];
    for (const [x, y, z] of mainPositions) {
      const pl = new THREE.PointLight('#bae6fd', 26, 28, 1.35);
      pl.position.set(x, y, z);
      this.scene.add(pl);
      this.mainLights.push(pl);
    }

    // Red emergency corner beacons
    const emergencyPositions: Array<[number, number, number]> = [
      [-19.5, 9.2, -18.5],
      [19.5, 9.2, -18.5],
      [-19.5, 9.2, 18.5],
      [19.5, 9.2, 18.5],
    ];

    const housingGeo = this.track(new THREE.CylinderGeometry(0.28, 0.34, 0.25, 10));
    const housingMat = this.track(new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.8, roughness: 0.3 }));
    const lensGeo = this.track(new THREE.CylinderGeometry(0.22, 0.22, 0.32, 10));
    const lensMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#ef4444',
        emissive: '#dc2626',
        emissiveIntensity: 1.8,
        roughness: 0.2,
      })
    );

    for (const [x, y, z] of emergencyPositions) {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      const housing = new THREE.Mesh(housingGeo, housingMat);
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.y = -0.22;
      group.add(housing, lens);
      this.scene.add(group);
      this.beaconRotors.push(group);

      const redLight = new THREE.PointLight('#ef4444', 0, 22, 1.5);
      redLight.position.set(x, y - 0.8, z);
      this.scene.add(redLight);
      this.emergencyLights.push(redLight);
    }

    // First-Person Tactical Suit Headlamp (active inside dark locked lab, fades out in Modern World)
    this.headlamp = new THREE.SpotLight('#d8f3ff', 0, 26, Math.PI / 5.2, 0.55, 1.45);
    this.headlampTarget = new THREE.Object3D();
    this.scene.add(this.headlamp);
    this.scene.add(this.headlampTarget);
    this.headlamp.target = this.headlampTarget;
  }

  private buildSouthExteriorBackdrop() {
    // Seen during Scene 1 exterior night approach before camera enters south glass bay (z = +21)
    const groundGeo = this.track(new THREE.PlaneGeometry(110, 60));
    const groundMat = this.track(new THREE.MeshStandardMaterial({ color: '#060b14', roughness: 0.85, metalness: 0.2 }));
    const extGround = new THREE.Mesh(groundGeo, groundMat);
    extGround.rotation.x = -Math.PI / 2;
    extGround.position.set(0, -0.02, 46);
    this.scene.add(extGround);

    const towerMat = this.track(new THREE.MeshStandardMaterial({ color: '#0d1626', metalness: 0.65, roughness: 0.35 }));
    const windowStripMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#0891b2',
        emissive: '#06b6d4',
        emissiveIntensity: 1.15,
        roughness: 0.2,
      })
    );

    const wingGeo = this.track(new THREE.BoxGeometry(10, 14, 12));
    const stripGeo = this.track(new THREE.BoxGeometry(10.1, 0.32, 12.1));

    for (const side of [-1, 1]) {
      const tower = new THREE.Group();
      tower.position.set(side * 24, 7, 26);
      tower.add(new THREE.Mesh(wingGeo, towerMat));
      for (const y of [-3.5, 0, 3.5]) {
        const s = new THREE.Mesh(stripGeo, windowStripMat);
        s.position.y = y;
        tower.add(s);
      }
      this.scene.add(tower);
    }

    const pathGeo = this.track(new THREE.BoxGeometry(0.22, 0.04, 18));
    for (const sx of [-3.6, 3.6]) {
      const strip = new THREE.Mesh(pathGeo, windowStripMat);
      strip.position.set(sx, 0.02, 30);
      this.scene.add(strip);
    }

    const canopy = new THREE.Mesh(this.track(new THREE.BoxGeometry(18, 0.6, 6)), towerMat);
    canopy.position.set(0, 9.2, 24);
    this.scene.add(canopy);
  }

  private buildGrandFacilityArchitecture() {
    // Expanded Grand Research Hall: 44m wide x 42m deep x 11m tall!
    const labW = 44;
    const labD = 42;
    const labH = 11;

    const floorGeo = this.track(new THREE.PlaneGeometry(labW, labD));
    const floorMat = this.track(
      new THREE.MeshStandardMaterial({
        map: this.textures.floor,
        roughness: 0.3,
        metalness: 0.45,
      })
    );
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = !this.isSoftwareGl;
    this.scene.add(floor);

    // Glowing recessed floor navigation guide strips connecting NEXUS to all 5 Vaults & the Main Door
    const guideMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#22d3ee',
        emissive: '#06b6d4',
        emissiveIntensity: 0.9,
        roughness: 0.25,
      })
    );
    const northGuide = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.32, 0.03, 32)), guideMat);
    northGuide.position.set(0, 0.015, -3.5);
    this.scene.add(northGuide);

    const crossGuide1 = new THREE.Mesh(this.track(new THREE.BoxGeometry(36, 0.03, 0.24)), guideMat);
    crossGuide1.position.set(0, 0.015, 8.5);
    this.scene.add(crossGuide1);

    const crossGuide2 = new THREE.Mesh(this.track(new THREE.BoxGeometry(36, 0.03, 0.24)), guideMat);
    crossGuide2.position.set(0, 0.015, -6.5);
    this.scene.add(crossGuide2);

    // Towering Ceiling
    const ceilMat = this.track(new THREE.MeshStandardMaterial({ color: '#09101d', roughness: 0.7, metalness: 0.4 }));
    const ceiling = new THREE.Mesh(this.track(new THREE.PlaneGeometry(labW, labD)), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = labH;
    this.scene.add(ceiling);

    // Soaring Structural Ceiling Arches & LED Light Ribbons
    const trussMat = this.track(new THREE.MeshStandardMaterial({ color: '#1b263b', metalness: 0.78, roughness: 0.32 }));
    const stripMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#a5f3fc',
        emissive: '#22d3ee',
        emissiveIntensity: 0.95,
        roughness: 0.2,
      })
    );
    const beamGeo = this.track(new THREE.BoxGeometry(labW - 1, 0.45, 0.65));
    const ledGeo = this.track(new THREE.BoxGeometry(labW - 6, 0.1, 0.22));
    for (const z of [-15, -7, 1, 9, 16]) {
      const beam = new THREE.Mesh(beamGeo, trussMat);
      beam.position.set(0, labH - 0.3, z);
      this.scene.add(beam);
      const led = new THREE.Mesh(ledGeo, stripMat);
      led.position.set(0, labH - 0.58, z);
      this.scene.add(led);
    }

    // Elevated Mezzanine Observation Catwalks along East & West Upper Walls (gives massive scale!)
    const catwalkFloorGeo = this.track(new THREE.BoxGeometry(2.6, 0.24, labD - 6));
    const glassRailMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: '#67e8f9',
        roughness: 0.1,
        metalness: 0.1,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
      })
    );
    const railGeo = this.track(new THREE.PlaneGeometry(labD - 6, 1.15));
    for (const side of [-1, 1]) {
      const deck = new THREE.Mesh(catwalkFloorGeo, trussMat);
      deck.position.set(side * (labW / 2 - 1.5), 6.2, 0);
      this.scene.add(deck);
      const rail = new THREE.Mesh(railGeo, glassRailMat);
      rail.position.set(side * (labW / 2 - 2.8), 6.9, 0);
      rail.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
      rail.renderOrder = 2;
      this.scene.add(rail);
    }

    // Perimeter Walls
    const wallMat = this.track(
      new THREE.MeshStandardMaterial({
        map: this.textures.wall,
        roughness: 0.55,
        metalness: 0.3,
      })
    );

    const addWall = (w: number, h: number, d: number, x: number, y: number, z: number, addCollider = true) => {
      const mesh = new THREE.Mesh(this.track(new THREE.BoxGeometry(w, h, d)), wallMat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      if (addCollider) {
        this.colliders.push({
          id: `wall-${x}-${z}`,
          minX: x - w / 2 - 0.35,
          maxX: x + w / 2 + 0.35,
          minZ: z - d / 2 - 0.35,
          maxZ: z + d / 2 + 0.35,
          active: true,
        });
      }
      return mesh;
    };

    // West & East outer walls (42m long, 11m tall)
    addWall(0.7, labH, labD, -22, labH / 2, 0);
    addWall(0.7, labH, labD, 22, labH / 2, 0);

    // North wall SPLIT cleanly around the 8m-wide Grand Main Door portal (x: -4..+4)!
    addWall(18, labH, 0.8, -13, labH / 2, -21);
    addWall(18, labH, 0.8, 13, labH / 2, -21);
    // Upper transom wall above the 6.2m tall Main Door opening
    addWall(8.4, labH - 6.2, 0.8, 0, 6.2 + (labH - 6.2) / 2, -21, false);

    // South wall with grand glass observation bay (z = +21)
    addWall(15, labH, 0.7, -14.5, labH / 2, 21);
    addWall(15, labH, 0.7, 14.5, labH / 2, 21);
    addWall(14.4, labH - 6.5, 0.7, 0, 6.5 + (labH - 6.5) / 2, 21, false);
    this.colliders.push({
      id: 'south-facade-lock',
      minX: -7.5,
      maxX: 7.5,
      minZ: 20.4,
      maxZ: 21.6,
      active: true,
    });

    const southGlass = new THREE.Mesh(this.track(new THREE.PlaneGeometry(14, 6.5)), glassRailMat);
    southGlass.position.set(0, 3.25, 21);
    southGlass.renderOrder = 2;
    this.scene.add(southGlass);

    // Heavy south security shutter (slams down in Scene 3)
    const shutterMat = this.track(new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.85, roughness: 0.35 }));
    this.facadeShutter = new THREE.Mesh(this.track(new THREE.BoxGeometry(14.2, 6.6, 0.4)), shutterMat);
    this.facadeShutter.position.set(0, 10.5, 20.65);
    this.scene.add(this.facadeShutter);

    // Grand Atrium Structural Columns framing the expansive floor
    const pillarGeo = this.track(new THREE.BoxGeometry(0.75, labH, 0.75));
    const pillarMat = this.track(new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.78, roughness: 0.28 }));
    for (const [px, pz] of [
      [-10.5, -10],
      [10.5, -10],
      [-10.5, 11],
      [10.5, 11],
      [-10.5, 0.5],
      [10.5, 0.5],
    ]) {
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(px, labH / 2, pz);
      this.scene.add(p);
      this.colliders.push({
        id: `pillar-${px}-${pz}`,
        minX: px - 0.7,
        maxX: px + 0.7,
        minZ: pz - 0.7,
        maxZ: pz + 0.7,
        active: true,
      });
    }

    // Security Cameras mounted high near corners
    const camBodyGeo = this.track(new THREE.BoxGeometry(0.32, 0.24, 0.6));
    const camLensGeo = this.track(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 10));
    const redLedGeo = this.track(new THREE.SphereGeometry(0.04, 8, 8));
    const redLedMat = this.track(new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 2 }));

    for (const [cx, cz, baseYaw] of [
      [-20, -16, -Math.PI / 4],
      [20, -16, Math.PI / 4],
      [-20, 16, (-3 * Math.PI) / 4],
      [20, 16, (3 * Math.PI) / 4],
    ]) {
      const camGroup = new THREE.Group();
      camGroup.position.set(cx, 7.6, cz);
      camGroup.userData.baseYaw = baseYaw;
      const body = new THREE.Mesh(camBodyGeo, pillarMat);
      const lens = new THREE.Mesh(camLensGeo, trussMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.z = 0.34;
      const led = new THREE.Mesh(redLedGeo, redLedMat);
      led.position.set(0.1, 0.07, 0.3);
      camGroup.add(body, lens, led);
      camGroup.rotation.x = 0.38;
      this.scene.add(camGroup);
      this.securityCameras.push(camGroup);
    }
  }

  private buildCentralNexusCore() {
    // Monumental Central NEXUS Pedestal at (0, 0, 2.0)
    const baseGroup = new THREE.Group();
    baseGroup.position.set(0, 0, 2.0);

    const metalDark = this.track(new THREE.MeshStandardMaterial({ color: '#111c30', metalness: 0.85, roughness: 0.25 }));
    const cyanAccent = this.track(
      new THREE.MeshStandardMaterial({
        color: '#22d3ee',
        emissive: '#06b6d4',
        emissiveIntensity: 1.6,
        roughness: 0.2,
      })
    );

    const baseTier1 = new THREE.Mesh(this.track(new THREE.CylinderGeometry(2.1, 2.5, 0.4, 8)), metalDark);
    baseTier1.position.y = 0.2;
    const baseTier2 = new THREE.Mesh(this.track(new THREE.CylinderGeometry(1.4, 1.7, 0.8, 8)), metalDark);
    baseTier2.position.y = 0.78;
    const emitterRing = new THREE.Mesh(this.track(new THREE.TorusGeometry(1.3, 0.06, 12, 36)), cyanAccent);
    emitterRing.rotation.x = Math.PI / 2;
    emitterRing.position.y = 1.22;

    baseGroup.add(baseTier1, baseTier2, emitterRing);
    this.scene.add(baseGroup);

    this.colliders.push({
      id: 'nexus-pedestal',
      minX: -2.4,
      maxX: 2.4,
      minZ: 2.0 - 2.4,
      maxZ: 2.0 + 2.4,
      active: true,
    });

    // Holographic NEXUS Avatar
    this.nexusGroup = new THREE.Group();
    this.nexusGroup.position.set(0, 3.0, 2.0);

    const holoMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#22d3ee',
        emissive: '#06b6d4',
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.84,
        wireframe: true,
      })
    );
    const solidCoreMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#a5f3fc',
        emissive: '#0891b2',
        emissiveIntensity: 2.3,
        transparent: true,
        opacity: 0.88,
        roughness: 0.1,
      })
    );

    this.nexusCoreMesh = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.58, 1)), solidCoreMat);
    this.nexusRingOuter = new THREE.Mesh(this.track(new THREE.TorusGeometry(1.22, 0.04, 10, 44)), holoMat);
    this.nexusRingInner = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.88, 0.032, 10, 36)), cyanAccent);
    this.nexusRingInner.rotation.x = Math.PI / 3;

    const coneMat = this.track(
      new THREE.MeshBasicMaterial({
        color: '#06b6d4',
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    const cone = new THREE.Mesh(this.track(new THREE.ConeGeometry(1.25, 1.9, 24, 1, true)), coneMat);
    cone.position.y = -0.92;
    cone.rotation.x = Math.PI;

    this.nexusLight = new THREE.PointLight('#22d3ee', 0, 18, 1.5);

    this.nexusGroup.add(this.nexusCoreMesh, this.nexusRingOuter, this.nexusRingInner, cone, this.nexusLight);
    this.nexusGroup.scale.setScalar(0.001);
    this.scene.add(this.nexusGroup);

    this.interactables.push({
      id: 'nexus-core',
      kind: 'nexus',
      position: new THREE.Vector3(0, 2.0, 2.0),
      radius: 4.5,
      label: 'NEXUS AI Core',
      sublabel: 'Request Mission Guidance',
    });
  }

  private buildGrandMainDoorAndKeyPedestals() {
    // Grand Main Door Gateway at North Wall (0, 0, -20.8) — opens directly into the Modern World!
    const frameMat = this.track(new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.85, roughness: 0.28 }));
    const shutterMat = this.track(new THREE.MeshStandardMaterial({ color: '#273549', metalness: 0.78, roughness: 0.34 }));
    const accentTrim = this.track(
      new THREE.MeshStandardMaterial({ color: '#06b6d4', emissive: '#0891b2', emissiveIntensity: 0.9, roughness: 0.25 })
    );

    const exitGroup = new THREE.Group();
    exitGroup.position.set(0, 0, -20.8);

    // Massive Portal Pillars & Arch Header
    const leftPost = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.85, 6.5, 1.2)), frameMat);
    leftPost.position.set(-4.1, 3.25, 0);
    const rightPost = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.85, 6.5, 1.2)), frameMat);
    rightPost.position.set(4.1, 3.25, 0);
    const lintel = new THREE.Mesh(this.track(new THREE.BoxGeometry(9.2, 1.2, 1.3)), frameMat);
    lintel.position.set(0, 6.7, 0);

    // Heavy Animated Blast Doors (wide 7.4m total opening)
    const doorGeo = this.track(new THREE.BoxGeometry(3.75, 6.1, 0.36));
    this.exitShutterLeft = new THREE.Mesh(doorGeo, shutterMat);
    this.exitShutterLeft.position.set(-1.88, 3.05, 0);
    this.exitShutterRight = new THREE.Mesh(doorGeo, shutterMat);
    this.exitShutterRight.position.set(1.88, 3.05, 0);

    // Overhead Status Display
    this.exitScreenMat = this.track(
      new THREE.MeshStandardMaterial({
        map: this.textures.exitLocked,
        emissive: '#ef4444',
        emissiveMap: this.textures.exitLocked,
        emissiveIntensity: 0.95,
        roughness: 0.22,
      })
    );
    const screen = new THREE.Mesh(this.track(new THREE.PlaneGeometry(5.6, 2.2)), this.exitScreenMat);
    screen.position.set(0, 7.6, 0.72);

    exitGroup.add(leftPost, rightPost, lintel, this.exitShutterLeft, this.exitShutterRight, screen);
    this.scene.add(exitGroup);

    // Main Doorway Collider (active while locked, disabled when all 5 keys are placed and door opens!)
    this.mainDoorCollider = {
      id: 'main-door-barrier',
      minX: -4.2,
      maxX: 4.2,
      minZ: -21.5,
      maxZ: -20.1,
      active: true,
    };
    this.colliders.push(this.mainDoorCollider);

    // 5 Physical Key Placement Pedestals arrayed cleanly beside/in front of the Main Door
    const pedBodyGeo = this.track(new THREE.CylinderGeometry(0.32, 0.42, 1.15, 8));
    const pedCapGeo = this.track(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 16));
    const keyShaftGeo = this.track(new THREE.CylinderGeometry(0.04, 0.04, 0.46, 8));
    const keyRingGeo = this.track(new THREE.TorusGeometry(0.13, 0.03, 8, 18));
    const keyToothGeo = this.track(new THREE.BoxGeometry(0.14, 0.06, 0.05));

    const keyHolomat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#34d399',
        emissive: '#10b981',
        emissiveIntensity: 2.2,
        roughness: 0.15,
        metalness: 0.5,
      })
    );

    const pedestalXs = [-4.6, -2.3, 0, 2.3, 4.6];
    const pedestalZs = [-17.4, -16.8, -16.5, -16.8, -17.4];

    for (let i = 0; i < 5; i++) {
      const pGroup = new THREE.Group();
      pGroup.position.set(pedestalXs[i], 0, pedestalZs[i]);

      const body = new THREE.Mesh(pedBodyGeo, frameMat);
      body.position.y = 0.575;

      const sMat = this.track(
        new THREE.MeshStandardMaterial({
          color: '#7f1d1d',
          emissive: '#ef4444',
          emissiveIntensity: 1.1,
          roughness: 0.25,
        })
      );
      this.keySocketMats.push(sMat);
      const cap = new THREE.Mesh(pedCapGeo, sMat);
      cap.position.y = 1.2;

      // Glowing 3D Key model that appears when the user places Key 0(i+1)
      const keyMeshGroup = new THREE.Group();
      keyMeshGroup.position.y = 1.65;
      const shaft = new THREE.Mesh(keyShaftGeo, keyHolomat);
      const ring = new THREE.Mesh(keyRingGeo, keyHolomat);
      ring.position.y = 0.26;
      const tooth1 = new THREE.Mesh(keyToothGeo, keyHolomat);
      tooth1.position.set(0.08, -0.15, 0);
      const tooth2 = new THREE.Mesh(keyToothGeo, keyHolomat);
      tooth2.position.set(0.08, -0.04, 0);
      keyMeshGroup.add(shaft, ring, tooth1, tooth2);
      keyMeshGroup.visible = false;
      this.placedKeyHolograms.push(keyMeshGroup);

      pGroup.add(body, cap, keyMeshGroup);
      this.scene.add(pGroup);

      // Small pedestal collider so you walk smoothly between/around them
      this.colliders.push({
        id: `key-ped-${i}`,
        minX: pedestalXs[i] - 0.5,
        maxX: pedestalXs[i] + 0.5,
        minZ: pedestalZs[i] - 0.5,
        maxZ: pedestalZs[i] + 0.5,
        active: true,
      });
    }

    // Power conduits linking key pedestals to the Main Door frame
    const conduit = new THREE.Mesh(this.track(new THREE.BoxGeometry(9.6, 0.05, 0.16)), accentTrim);
    conduit.position.set(0, 0.03, -17.5);
    this.scene.add(conduit);

    this.interactables.push({
      id: 'main-exit-console',
      kind: 'exit',
      position: new THREE.Vector3(0, 1.5, -17.0),
      radius: 6.2,
      label: 'Grand Main Door — Key Console',
      sublabel: 'Place Keys to Open the Modern World Gate',
    });
  }

  private buildLabWorkstationsAndLogs() {
    const deskMat = this.track(new THREE.MeshStandardMaterial({ color: '#162033', metalness: 0.65, roughness: 0.35 }));
    const legMat = this.track(new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.8, roughness: 0.3 }));
    const glassRackMat = this.track(
      new THREE.MeshPhysicalMaterial({ color: '#38bdf8', transparent: true, opacity: 0.5, roughness: 0.15 })
    );

    const benchCoords: Array<{ x: number; z: number; rotY: number; logIdx?: number }> = [
      { x: -6.8, z: 9.5, rotY: 0.35, logIdx: 0 }, // Security Cam #04 Terminal
      { x: 6.8, z: 9.5, rotY: -0.35, logIdx: 1 }, // Corrupted Batch Dump Terminal
      { x: -6.8, z: -4.2, rotY: Math.PI * 0.25, logIdx: 2 }, // Dr. Vance Shift Memo
      { x: 6.8, z: -4.2, rotY: -Math.PI * 0.25 }, // Molecular Analysis Workstation
      { x: -14.5, z: 14.5, rotY: 0.5 }, // South-West Analytical Cluster
      { x: 14.5, z: 14.5, rotY: -0.5 }, // South-East Analytical Cluster
    ];

    const topGeo = this.track(new THREE.BoxGeometry(2.6, 0.12, 1.1));
    const legGeo = this.track(new THREE.BoxGeometry(0.14, 0.88, 0.9));
    const screenFrameGeo = this.track(new THREE.BoxGeometry(1.35, 0.82, 0.09));
    const screenFaceGeo = this.track(new THREE.PlaneGeometry(1.24, 0.72));
    const vialGeo = this.track(new THREE.CylinderGeometry(0.06, 0.06, 0.28, 8));

    for (const b of benchCoords) {
      const group = new THREE.Group();
      group.position.set(b.x, 0, b.z);
      group.rotation.y = b.rotY;

      const top = new THREE.Mesh(topGeo, deskMat);
      top.position.y = 0.88;
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-1.12, 0.44, 0);
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.position.set(1.12, 0.44, 0);

      const mMat = this.track(
        new THREE.MeshStandardMaterial({
          map: this.textures.monitorNormal,
          emissive: '#06b6d4',
          emissiveMap: this.textures.monitorNormal,
          emissiveIntensity: 0.78,
          roughness: 0.2,
        })
      );
      this.workstationMonitorMats.push(mMat);

      const frame = new THREE.Mesh(screenFrameGeo, legMat);
      frame.position.set(-0.22, 1.44, -0.2);
      const face = new THREE.Mesh(screenFaceGeo, mMat);
      face.position.set(-0.22, 1.44, -0.15);

      for (let v = 0; v < 3; v++) {
        const vial = new THREE.Mesh(vialGeo, glassRackMat);
        vial.position.set(0.72 + v * 0.18, 1.06, 0.05);
        group.add(vial);
      }

      group.add(top, legL, legR, frame, face);
      this.scene.add(group);

      this.colliders.push({
        id: `bench-${b.x}-${b.z}`,
        minX: b.x - 1.5,
        maxX: b.x + 1.5,
        minZ: b.z - 0.95,
        maxZ: b.z + 0.95,
        active: true,
      });

      if (b.logIdx !== undefined) {
        const log = ATRIUM_INCIDENT_LOGS[b.logIdx];
        if (log) {
          this.interactables.push({
            id: `terminal-${log.id}`,
            kind: 'log',
            position: new THREE.Vector3(b.x, 1.35, b.z),
            radius: 3.4,
            label: log.title,
            sublabel: `${log.classification} · Inspect Terminal`,
            logId: log.id,
          });
        }
      }
    }
  }

  private createMolecularHologram(vaultId: VaultId, accentHex: string): THREE.Group {
    const group = new THREE.Group();
    const atomMat = this.track(
      new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: accentHex,
        emissiveIntensity: 1.4,
        roughness: 0.2,
        metalness: 0.3,
      })
    );
    const oxyMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#f43f5e',
        emissive: '#e11d48',
        emissiveIntensity: 1.3,
        roughness: 0.2,
      })
    );
    const bondMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#94a3b8',
        emissive: accentHex,
        emissiveIntensity: 0.45,
        roughness: 0.3,
      })
    );

    const sphereGeo = this.track(new THREE.SphereGeometry(0.13, 10, 10));
    const smallSphereGeo = this.track(new THREE.SphereGeometry(0.095, 8, 8));
    const bondGeo = this.track(new THREE.CylinderGeometry(0.028, 0.028, 0.48, 6));

    if (vaultId === 1) {
      for (let i = 0; i < 8; i++) {
        const angle = i * 0.72;
        const y = (i - 3.5) * 0.18;
        const a1 = new THREE.Mesh(smallSphereGeo, atomMat);
        a1.position.set(Math.cos(angle) * 0.42, y, Math.sin(angle) * 0.42);
        const a2 = new THREE.Mesh(smallSphereGeo, oxyMat);
        a2.position.set(-Math.cos(angle) * 0.42, y, -Math.sin(angle) * 0.42);
        const rung = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.02, 0.02, 0.84, 6)), bondMat);
        rung.position.y = y;
        rung.rotation.z = Math.PI / 2;
        rung.rotation.y = -angle;
        group.add(a1, a2, rung);
      }
    } else if (vaultId === 2) {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const c = new THREE.Mesh(sphereGeo, atomMat);
        c.position.set(Math.cos(a) * 0.48, Math.sin(a) * 0.48, 0);
        group.add(c);
        const b = new THREE.Mesh(bondGeo, bondMat);
        const midA = a + Math.PI / 6;
        b.position.set(Math.cos(midA) * 0.41, Math.sin(midA) * 0.41, 0);
        b.rotation.z = midA;
        group.add(b);
      }
      const o = new THREE.Mesh(sphereGeo, oxyMat);
      o.position.set(0.86, 0, 0);
      group.add(o);
    } else if (vaultId === 3) {
      const lattice = new THREE.Mesh(
        this.track(new THREE.IcosahedronGeometry(0.54, 0)),
        this.track(new THREE.MeshStandardMaterial({ color: accentHex, emissive: accentHex, emissiveIntensity: 1.2, wireframe: true }))
      );
      const center = new THREE.Mesh(sphereGeo, oxyMat);
      group.add(lattice, center);
    } else if (vaultId === 4) {
      const layers = [
        [new THREE.Vector3(-0.5, 0.3, 0), new THREE.Vector3(-0.5, -0.3, 0)],
        [new THREE.Vector3(0, 0.44, 0.16), new THREE.Vector3(0, 0, -0.16), new THREE.Vector3(0, -0.44, 0.16)],
        [new THREE.Vector3(0.5, 0, 0)],
      ];
      layers.forEach((layer, lIdx) => {
        layer.forEach((pos) => {
          const n = new THREE.Mesh(smallSphereGeo, lIdx === 2 ? oxyMat : atomMat);
          n.position.copy(pos);
          group.add(n);
        });
      });
      const ring = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.64, 0.024, 8, 28)), bondMat);
      group.add(ring);
    } else {
      const core = new THREE.Mesh(this.track(new THREE.DodecahedronGeometry(0.42, 0)), atomMat);
      const r1 = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.66, 0.028, 8, 32)), bondMat);
      const r2 = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.66, 0.028, 8, 32)), bondMat);
      r2.rotation.x = Math.PI / 2;
      group.add(core, r1, r2);
    }

    return group;
  }

  private buildFiveVaults() {
    const frameMat = this.track(new THREE.MeshStandardMaterial({ color: '#172338', metalness: 0.82, roughness: 0.28 }));
    const doorMat = this.track(new THREE.MeshStandardMaterial({ color: '#24344d', metalness: 0.72, roughness: 0.34 }));
    const terminalMat = this.track(new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.75, roughness: 0.3 }));

    // Spacious positions around the expanded 44m x 42m research complex
    const vaultConfigs: Array<{ id: VaultId; x: number; z: number; rotY: number }> = [
      { id: 1, x: -19.6, z: 8.5, rotY: Math.PI / 2 },    // South-West Wing
      { id: 2, x: -19.6, z: -6.5, rotY: Math.PI / 2 },   // North-West Wing
      { id: 3, x: -12.5, z: -18.8, rotY: 0 },            // North-West Corridor (clear of center Main Door)
      { id: 4, x: 19.6, z: -6.5, rotY: -Math.PI / 2 },   // North-East Wing
      { id: 5, x: 19.6, z: 8.5, rotY: -Math.PI / 2 },    // South-East Wing
    ];

    for (const cfg of vaultConfigs) {
      const def = VAULTS.find((v) => v.id === cfg.id)!;
      const vGroup = new THREE.Group();
      vGroup.position.set(cfg.x, 0, cfg.z);
      vGroup.rotation.y = cfg.rotY;

      const postGeo = this.track(new THREE.BoxGeometry(0.55, 4.6, 0.95));
      const pL = new THREE.Mesh(postGeo, frameMat);
      pL.position.set(-2.2, 2.3, 0);
      const pR = new THREE.Mesh(postGeo, frameMat);
      pR.position.set(2.2, 2.3, 0);
      const header = new THREE.Mesh(this.track(new THREE.BoxGeometry(5.0, 1.05, 1.05)), frameMat);
      header.position.set(0, 5.05, 0);

      const signTex = this.textures.vaultSigns.get(cfg.id);
      const signMat = this.track(
        new THREE.MeshStandardMaterial({
          map: signTex,
          emissive: def.accentHex,
          emissiveMap: signTex,
          emissiveIntensity: 0.7,
          roughness: 0.25,
        })
      );
      const sign = new THREE.Mesh(this.track(new THREE.PlaneGeometry(3.8, 1.02)), signMat);
      sign.position.set(0, 5.05, 0.55);

      const beaconMat = this.track(
        new THREE.MeshStandardMaterial({
          color: '#ef4444',
          emissive: '#ef4444',
          emissiveIntensity: 1.6,
          roughness: 0.2,
        })
      );
      const beaconMesh = new THREE.Mesh(this.track(new THREE.BoxGeometry(3.0, 0.16, 0.2)), beaconMat);
      beaconMesh.position.set(0, 4.35, 0.52);

      const beaconLight = new THREE.PointLight('#ef4444', 5.0, 13, 1.5);
      beaconLight.position.set(0, 4.0, 1.3);

      const dGeo = this.track(new THREE.BoxGeometry(1.94, 4.15, 0.2));
      const doorLeft = new THREE.Mesh(dGeo, doorMat);
      doorLeft.position.set(-0.97, 2.075, 0);
      const doorRight = new THREE.Mesh(dGeo, doorMat);
      doorRight.position.set(0.97, 2.075, 0);

      const kiosk = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.95, 1.3, 0.6)), terminalMat);
      kiosk.position.set(0, 0.65, 1.65);
      const kioskScreen = new THREE.Mesh(
        this.track(new THREE.PlaneGeometry(0.76, 0.46)),
        this.track(
          new THREE.MeshStandardMaterial({
            map: this.textures.monitorNormal,
            emissive: def.accentHex,
            emissiveMap: this.textures.monitorNormal,
            emissiveIntensity: 0.75,
            roughness: 0.2,
          })
        )
      );
      kioskScreen.position.set(0, 1.38, 1.72);
      kioskScreen.rotation.x = -0.55;

      const hologramGroup = this.createMolecularHologram(cfg.id, def.accentHex);
      hologramGroup.position.set(0, 2.55, 1.65);

      vGroup.add(pL, pR, header, sign, beaconMesh, beaconLight, doorLeft, doorRight, kiosk, kioskScreen, hologramGroup);
      this.scene.add(vGroup);

      const termLocal = new THREE.Vector3(0, 1.35, 1.75);
      vGroup.updateMatrixWorld(true);
      const terminalPos = termLocal.applyMatrix4(vGroup.matrixWorld);

      const collider: BoxCollider = {
        id: `vault-door-${cfg.id}`,
        minX: cfg.x - 1.7,
        maxX: cfg.x + 1.7,
        minZ: cfg.z - 1.7,
        maxZ: cfg.z + 1.7,
        active: true,
      };
      this.colliders.push(collider);

      this.vaultVisuals.set(cfg.id, {
        id: cfg.id,
        doorLeft,
        doorRight,
        beaconMat,
        beaconLight,
        hologramGroup,
        terminalPos,
        doorOpenAmount: 0,
        targetOpen: 0,
        collider,
      });

      this.interactables.push({
        id: `vault-terminal-${cfg.id}`,
        kind: 'vault',
        position: terminalPos,
        radius: 4.2,
        label: `${def.code} — ${def.title}`,
        sublabel: `${def.difficulty} · Open Research Terminal`,
        vaultId: cfg.id,
      });
    }
  }

  private buildHorrorLabDetails() {
    // 1. FOUR FUTURISTIC FAILED EXPERIMENT CONTAINMENT PODS (Medicinal Chemistry Horror Audits)
    const podPlacements: Array<{
      id: string;
      x: number;
      z: number;
      rotY: number;
      toxicHex: string;
      spillType: 'green' | 'amber';
      smellCue: string;
    }> = [
      {
        id: 'exp-herg-toxicity',
        x: -14.2,
        z: 1.5,
        rotY: Math.PI / 2,
        toxicHex: '#84cc16',
        spillType: 'green',
        smellCue: 'Bitter almonds & ruptured cardiac-assay buffer leaking beneath Pod B-07',
      },
      {
        id: 'exp-assay-noise',
        x: 14.2,
        z: 1.5,
        rotY: -Math.PI / 2,
        toxicHex: '#f59e0b',
        spillType: 'amber',
        smellCue: 'Acrid DMSO & burnt sulfur colloidal precipitate pooling at Pod D-14',
      },
      {
        id: 'exp-mutation-escape',
        x: -12.5,
        z: -11.8,
        rotY: 0.45,
        toxicHex: '#a3e635',
        spillType: 'green',
        smellCue: 'Sharp ozone & metallic bleach vapor hissing from cracked Pod X-03',
      },
      {
        id: 'exp-trial-collapse',
        x: 12.5,
        z: -12.5,
        rotY: -0.55,
        toxicHex: '#ea580c',
        spillType: 'amber',
        smellCue: 'Sour acetone & necrotic liver-microsome solvent seeping from Pod C-19',
      },
    ];

    const podMetalMat = this.track(new THREE.MeshStandardMaterial({ color: '#141c2b', metalness: 0.85, roughness: 0.32 }));
    const podGlassMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: '#a3e635',
        transparent: true,
        opacity: 0.24,
        roughness: 0.14,
        metalness: 0.08,
        depthWrite: false,
      })
    );
    const specimenBodyMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#1f2937',
        emissive: '#365314',
        emissiveIntensity: 0.65,
        roughness: 0.35,
        metalness: 0.25,
      })
    );
    const specimenNodeMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#dc2626',
        emissive: '#991b1b',
        emissiveIntensity: 1.1,
        roughness: 0.4,
      })
    );
    const warningMat = this.track(
      new THREE.MeshStandardMaterial({
        map: this.textures.specimenWarning,
        emissive: '#d97706',
        emissiveMap: this.textures.specimenWarning,
        emissiveIntensity: 0.5,
        roughness: 0.35,
      })
    );
    const printDecalMat = this.track(
      new THREE.MeshBasicMaterial({
        map: this.textures.fingerprintsOverlay,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    );

    const baseGeo = this.track(new THREE.CylinderGeometry(1.05, 1.22, 0.72, 12));
    const capGeo = this.track(new THREE.CylinderGeometry(1.12, 1.05, 0.56, 12));
    const tubeGeo = this.track(new THREE.CylinderGeometry(0.86, 0.86, 2.75, 18, 1, true));
    const strutGeo = this.track(new THREE.BoxGeometry(0.11, 2.9, 0.14));
    const ringGeo = this.track(new THREE.TorusGeometry(0.95, 0.055, 8, 28));
    const warningGeo = this.track(new THREE.PlaneGeometry(0.92, 0.48));
    const podPrintGeo = this.track(new THREE.PlaneGeometry(0.95, 0.95));

    // Shared spill materials (glossy wet reflective chemical puddles)
    const spillGreenMat = this.track(
      new THREE.MeshStandardMaterial({
        map: this.textures.chemicalSpillGreen,
        emissive: '#4d7c0f',
        emissiveMap: this.textures.chemicalSpillGreen,
        emissiveIntensity: 0.72,
        transparent: true,
        opacity: 0.9,
        roughness: 0.1,
        metalness: 0.15,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );
    const spillAmberMat = this.track(
      new THREE.MeshStandardMaterial({
        map: this.textures.chemicalSpillAmber,
        emissive: '#9a3412',
        emissiveMap: this.textures.chemicalSpillAmber,
        emissiveIntensity: 0.65,
        transparent: true,
        opacity: 0.9,
        roughness: 0.12,
        metalness: 0.15,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );

    const spillPlaneGeo = this.track(new THREE.PlaneGeometry(3.8, 3.8));

    podPlacements.forEach((p, idx) => {
      const exp = FAILED_EXPERIMENTS.find((e) => e.id === p.id);
      if (!exp) return;

      const group = new THREE.Group();
      group.position.set(p.x, 0, p.z);
      group.rotation.y = p.rotY;

      const base = new THREE.Mesh(baseGeo, podMetalMat);
      base.position.y = 0.36;
      const cap = new THREE.Mesh(capGeo, podMetalMat);
      cap.position.y = 3.72;
      const glass = new THREE.Mesh(tubeGeo, podGlassMat);
      glass.position.y = 2.08;

      const ringMat = this.track(
        new THREE.MeshStandardMaterial({
          color: p.toxicHex,
          emissive: p.toxicHex,
          emissiveIntensity: 1.6,
          roughness: 0.25,
        })
      );
      const bottomRing = new THREE.Mesh(ringGeo, ringMat);
      bottomRing.rotation.x = Math.PI / 2;
      bottomRing.position.y = 0.74;
      const topRing = new THREE.Mesh(ringGeo, ringMat);
      topRing.rotation.x = Math.PI / 2;
      topRing.position.y = 3.44;

      // 3 external titanium containment struts
      for (let s = 0; s < 3; s++) {
        const ang = (s * Math.PI * 2) / 3 + Math.PI / 6;
        const strut = new THREE.Mesh(strutGeo, podMetalMat);
        strut.position.set(Math.cos(ang) * 0.96, 2.08, Math.sin(ang) * 0.96);
        strut.rotation.y = -ang;
        group.add(strut);
      }

      // Suspended failed biological/crystallized specimen inside the glass tank
      const specimen = new THREE.Group();
      specimen.position.y = 2.1;
      const knot = new THREE.Mesh(
        this.track(new THREE.TorusKnotGeometry(0.32, 0.1, 42, 7, 2, 3 + (idx % 2))),
        specimenBodyMat
      );
      specimen.add(knot);
      for (let n = 0; n < 4; n++) {
        const blister = new THREE.Mesh(this.track(new THREE.DodecahedronGeometry(0.11, 0)), specimenNodeMat);
        const a = (n * Math.PI) / 2;
        blister.position.set(Math.cos(a) * 0.34, (n - 1.5) * 0.22, Math.sin(a) * 0.34);
        specimen.add(blister);
      }

      // Cracked biohazard warning sign plate on pedestal front
      const plate = new THREE.Mesh(warningGeo, warningMat);
      plate.position.set(0, 0.42, 1.15);
      plate.rotation.x = -0.18;

      // Smeared frantic handprint/fingerprints pressed on the inside/outside of the glass
      const smear = new THREE.Mesh(podPrintGeo, printDecalMat);
      smear.position.set(0.08, 1.95, 0.89);

      const podLight = new THREE.PointLight(p.toxicHex, 5.5, 11, 1.6);
      podLight.position.set(0, 2.2, 1.15);

      group.add(base, cap, glass, bottomRing, topRing, specimen, plate, smear, podLight);
      this.scene.add(group);

      // Leaking chemical spill puddle pooling beneath the failed pod
      const puddle = new THREE.Mesh(spillPlaneGeo, p.spillType === 'green' ? spillGreenMat : spillAmberMat);
      puddle.rotation.x = -Math.PI / 2;
      puddle.rotation.z = idx * 1.1;
      puddle.position.set(p.x + Math.sin(p.rotY) * 0.95, 0.025, p.z + Math.cos(p.rotY) * 0.95);
      this.scene.add(puddle);

      this.colliders.push({
        id: `pod-${p.id}`,
        minX: p.x - 1.35,
        maxX: p.x + 1.35,
        minZ: p.z - 1.35,
        maxZ: p.z + 1.35,
        active: true,
      });

      this.experimentPods.set(p.id, {
        id: p.id,
        specimen,
        light: podLight,
        ringMat,
        baseColorHex: p.toxicHex,
        phaseOffset: idx * 1.7,
      });

      this.chemicalLeaks.push({
        x: p.x + Math.sin(p.rotY) * 0.95,
        z: p.z + Math.cos(p.rotY) * 0.95,
        radius: 5.2,
        maxPpm: 215,
        smellCue: p.smellCue,
      });

      this.interactables.push({
        id: `interact-${p.id}`,
        kind: 'experiment',
        position: new THREE.Vector3(p.x, 1.7, p.z),
        radius: 4.3,
        label: `${exp.podCode} — ${exp.title}`,
        sublabel: 'Failed Experiment · Press [E] to Audit Risk',
        experimentId: exp.id,
      });
    });

    // 2. THREE OVERTURNED LEAKING CHEMICAL DRUMS & EXTRA TOXIC PUDDLES
    const drumBodyGeo = this.track(new THREE.CylinderGeometry(0.42, 0.42, 1.25, 12));
    const drumBandGeo = this.track(new THREE.CylinderGeometry(0.44, 0.44, 0.2, 12));
    const drumMat = this.track(new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.72, roughness: 0.38 }));
    const hazardBandMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#eab308', emissive: '#a16207', emissiveIntensity: 0.45, roughness: 0.4 })
    );

    const drumLeaks: Array<{ x: number; z: number; rotY: number; type: 'green' | 'amber'; smellCue: string }> = [
      {
        x: -7.8,
        z: 3.2,
        rotY: 0.65,
        type: 'green',
        smellCue: 'Pungent chloroform & leaked organophosphate solvent across the West floor',
      },
      {
        x: 8.4,
        z: -10.8,
        rotY: -1.1,
        type: 'amber',
        smellCue: 'Rotten-egg mercaptan & corrosive acidic reagent spilling from ruptured drum',
      },
      {
        x: -3.8,
        z: -12.6,
        rotY: 2.1,
        type: 'green',
        smellCue: 'Choking formaldehyde & volatile acetonitrile pooling near the North corridor',
      },
    ];

    for (const d of drumLeaks) {
      const drum = new THREE.Group();
      drum.position.set(d.x, 0.42, d.z);
      drum.rotation.y = d.rotY;
      drum.rotation.z = Math.PI / 2;
      drum.add(new THREE.Mesh(drumBodyGeo, drumMat));
      const b1 = new THREE.Mesh(drumBandGeo, hazardBandMat);
      b1.position.y = 0.28;
      const b2 = new THREE.Mesh(drumBandGeo, hazardBandMat);
      b2.position.y = -0.28;
      drum.add(b1, b2);
      this.scene.add(drum);

      const spill = new THREE.Mesh(
        this.track(new THREE.PlaneGeometry(3.2, 3.2)),
        d.type === 'green' ? spillGreenMat : spillAmberMat
      );
      spill.rotation.x = -Math.PI / 2;
      spill.rotation.z = d.rotY;
      spill.position.set(d.x + Math.cos(d.rotY) * 0.85, 0.024, d.z - Math.sin(d.rotY) * 0.85);
      this.scene.add(spill);

      this.chemicalLeaks.push({
        x: d.x + Math.cos(d.rotY) * 0.85,
        z: d.z - Math.sin(d.rotY) * 0.85,
        radius: 4.5,
        maxPpm: 178,
        smellCue: d.smellCue,
      });
    }

    // 3. FRANTIC FINGERPRINTS & HANDPRINTS SMEARED HERE AND THERE (Main Door, Glass Bay, Pillars, Workstations)
    const wallPrintGeo = this.track(new THREE.PlaneGeometry(1.4, 1.4));

    // Smeared handprints on the inner faces of the locked Main Door blast shutters (someone tried to claw out!)
    const doorPrintL = new THREE.Mesh(wallPrintGeo, printDecalMat);
    doorPrintL.position.set(0.35, -0.95, 0.21);
    this.exitShutterLeft.add(doorPrintL);

    const doorPrintR = new THREE.Mesh(wallPrintGeo, printDecalMat);
    doorPrintR.position.set(-0.45, -1.25, 0.21);
    doorPrintR.rotation.z = -0.24;
    this.exitShutterRight.add(doorPrintR);

    // Additional smears across structural columns & South containment glass
    const surfacePrints: Array<{ x: number; y: number; z: number; rotY: number; rotZ: number; scale: number }> = [
      { x: -10.5, y: 1.55, z: -9.32, rotY: 0, rotZ: 0.12, scale: 0.85 },
      { x: 10.5, y: 1.45, z: 1.18, rotY: 0, rotZ: -0.18, scale: 0.85 },
      { x: -10.5, y: 1.6, z: 11.68, rotY: 0, rotZ: 0.08, scale: 0.8 },
      { x: -3.2, y: 1.5, z: 20.65, rotY: Math.PI, rotZ: -0.1, scale: 1.15 },
      { x: 4.8, y: 1.4, z: 20.65, rotY: Math.PI, rotZ: 0.22, scale: 1.05 },
      { x: -6.8, y: 1.25, z: 8.62, rotY: Math.PI, rotZ: 0.14, scale: 0.72 },
      { x: 6.8, y: 1.25, z: -3.32, rotY: 0, rotZ: -0.2, scale: 0.72 },
    ];
    for (const sp of surfacePrints) {
      const m = new THREE.Mesh(wallPrintGeo, printDecalMat);
      m.position.set(sp.x, sp.y, sp.z);
      m.rotation.set(0, sp.rotY, sp.rotZ);
      m.scale.setScalar(sp.scale);
      this.scene.add(m);
    }

    // 4. RISING TOXIC CHEMICAL VAPOR PLUMES (Lightweight pooled Points from all 7 leak zones)
    const fumeCount = 98;
    this.fumePositions = new Float32Array(fumeCount * 3);
    this.fumeOrigins = new Float32Array(fumeCount * 3);
    this.fumeSpeeds = new Float32Array(fumeCount);

    for (let i = 0; i < fumeCount; i++) {
      const leak = this.chemicalLeaks[i % this.chemicalLeaks.length];
      const ox = leak.x + (Math.random() - 0.5) * 2.2;
      const oz = leak.z + (Math.random() - 0.5) * 2.2;
      const startY = 0.08 + Math.random() * 2.6;

      this.fumeOrigins[i * 3] = ox;
      this.fumeOrigins[i * 3 + 1] = 0.08;
      this.fumeOrigins[i * 3 + 2] = oz;

      this.fumePositions[i * 3] = ox;
      this.fumePositions[i * 3 + 1] = startY;
      this.fumePositions[i * 3 + 2] = oz;
      this.fumeSpeeds[i] = 0.28 + Math.random() * 0.34;
    }

    const fumeGeo = this.track(new THREE.BufferGeometry());
    fumeGeo.setAttribute('position', new THREE.BufferAttribute(this.fumePositions, 3));
    this.fumeMat = this.track(
      new THREE.PointsMaterial({
        color: '#a3e635',
        size: 0.52,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      })
    );
    this.fumePoints = new THREE.Points(fumeGeo, this.fumeMat);
    this.fumePoints.frustumCulled = false;
    this.scene.add(this.fumePoints);
  }

  private buildModernizedWorld() {
    // Expansive Modernized Future City stretching north of the Main Door (z = -21 to -160)
    // Extended outdoor terrain so there is never a boxed void edge
    const outerGround = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(340, 220)),
      this.track(new THREE.MeshStandardMaterial({ color: '#1b3644', roughness: 0.82, metalness: 0.1 }))
    );
    outerGround.rotation.x = -Math.PI / 2;
    outerGround.position.set(0, -0.05, -130);
    this.scene.add(outerGround);

    // Sleek Modern Architectural Plaza Surface (z: -21 to -86, x: -45 to +45)
    const plaza = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(92, 68)),
      this.track(
        new THREE.MeshStandardMaterial({
          map: this.textures.plazaGround,
          roughness: 0.28,
          metalness: 0.22,
        })
      )
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, 0.01, -55);
    plaza.receiveShadow = !this.isSoftwareGl;
    this.scene.add(plaza);

    // Illuminated Glass Promenade leading straight out of the Main Door (z: -21 to -42)
    const railMat = this.track(
      new THREE.MeshPhysicalMaterial({ color: '#38bdf8', transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false })
    );
    const chromeMat = this.track(new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.85, roughness: 0.18 }));
    const cyanGlowMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0ea5e9', emissiveIntensity: 1.5, roughness: 0.2 })
    );
    const goldGlowMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#fde68a', emissive: '#f59e0b', emissiveIntensity: 1.3, roughness: 0.2 })
    );

    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.28, 0.08, 22)), cyanGlowMat);
      strip.position.set(side * 4.4, 0.05, -32);
      this.scene.add(strip);

      const glassWall = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.08, 1.1, 16)), railMat);
      glassWall.position.set(side * 4.8, 0.6, -29.5);
      this.scene.add(glassWall);
    }

    // Centerpiece Modern World Monument — Bio-Innovation Spire & Reflecting Pool at (0, 0, -52)
    const monumentGroup = new THREE.Group();
    monumentGroup.position.set(0, 0, -52);

    const poolRim = new THREE.Mesh(this.track(new THREE.TorusGeometry(6.2, 0.35, 10, 42)), chromeMat);
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

    const pedestal = new THREE.Mesh(this.track(new THREE.CylinderGeometry(1.8, 2.4, 1.2, 12)), chromeMat);
    pedestal.position.y = 0.6;

    // Soaring sculpted twin arches
    const spireMat = this.track(new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.5, roughness: 0.22 }));
    const spireLeft = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.25, 0.55, 10.5, 10)), spireMat);
    spireLeft.position.set(-1.1, 5.8, 0);
    spireLeft.rotation.z = -0.14;
    const spireRight = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.25, 0.55, 10.5, 10)), spireMat);
    spireRight.position.set(1.1, 5.8, 0);
    spireRight.rotation.z = 0.14;

    // Rotating futuristic golden/cyan energy rings crowning the monument
    const ring1 = new THREE.Mesh(this.track(new THREE.TorusGeometry(2.6, 0.08, 12, 48)), cyanGlowMat);
    ring1.position.y = 6.8;
    const ring2 = new THREE.Mesh(this.track(new THREE.TorusGeometry(1.9, 0.07, 12, 40)), goldGlowMat);
    ring2.position.y = 6.8;
    ring2.rotation.x = Math.PI / 3;
    this.modernMonumentRings.push(ring1, ring2);

    const orb = new THREE.Mesh(this.track(new THREE.IcosahedronGeometry(0.9, 1)), cyanGlowMat);
    orb.position.y = 6.8;

    const monumentLight = new THREE.PointLight('#38bdf8', 18, 28, 1.4);
    monumentLight.position.set(0, 7.2, 0);

    monumentGroup.add(poolRim, waterDisk, pedestal, spireLeft, spireRight, ring1, ring2, orb, monumentLight);
    this.scene.add(monumentGroup);

    this.colliders.push({
      id: 'modern-monument',
      minX: -5.8,
      maxX: 5.8,
      minZ: -52 - 5.8,
      maxZ: -52 + 5.8,
      active: true,
    });

    this.interactables.push({
      id: 'modern-world-monument',
      kind: 'monument',
      position: new THREE.Vector3(0, 2.0, -46.0),
      radius: 6.5,
      label: 'Modern World Celebration Monument',
      sublabel: 'Press [E] to View Mission Completion & Reward',
    });

    // Futuristic Skyscraper Skyline encircling the Modern Plaza (composite multi-tier towers)
    const glassTowerMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.72, roughness: 0.18 })
    );
    const darkGlassMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#1e3a5f', metalness: 0.82, roughness: 0.14 })
    );

    const towerSpecs: Array<{ x: number; z: number; w: number; d: number; h: number; glow: 'cyan' | 'gold' }> = [
      { x: -34, z: -38, w: 9, d: 9, h: 32, glow: 'cyan' },
      { x: 34, z: -38, w: 9, d: 9, h: 34, glow: 'gold' },
      { x: -42, z: -60, w: 11, d: 11, h: 46, glow: 'cyan' },
      { x: 42, z: -60, w: 11, d: 11, h: 42, glow: 'cyan' },
      { x: -28, z: -84, w: 12, d: 10, h: 52, glow: 'gold' },
      { x: 0, z: -96, w: 14, d: 12, h: 64, glow: 'cyan' },
      { x: 28, z: -84, w: 12, d: 10, h: 50, glow: 'gold' },
      { x: -56, z: -82, w: 13, d: 13, h: 58, glow: 'cyan' },
      { x: 56, z: -82, w: 13, d: 13, h: 56, glow: 'gold' },
      { x: -16, z: -108, w: 10, d: 10, h: 48, glow: 'cyan' },
      { x: 16, z: -108, w: 10, d: 10, h: 46, glow: 'gold' },
    ];

    for (const ts of towerSpecs) {
      const tGroup = new THREE.Group();
      tGroup.position.set(ts.x, 0, ts.z);
      const glowM = ts.glow === 'cyan' ? cyanGlowMat : goldGlowMat;

      // Primary sleek glass body
      const body = new THREE.Mesh(this.track(new THREE.BoxGeometry(ts.w, ts.h, ts.d)), darkGlassMat);
      body.position.y = ts.h / 2;
      // Upper architectural setback crown
      const crown = new THREE.Mesh(this.track(new THREE.BoxGeometry(ts.w * 0.72, ts.h * 0.24, ts.d * 0.72)), glassTowerMat);
      crown.position.y = ts.h + ts.h * 0.12;
      // Glowing horizontal architectural sky-bands
      const band1 = new THREE.Mesh(this.track(new THREE.BoxGeometry(ts.w + 0.3, 0.55, ts.d + 0.3)), glowM);
      band1.position.y = ts.h * 0.45;
      const band2 = new THREE.Mesh(this.track(new THREE.BoxGeometry(ts.w + 0.3, 0.55, ts.d + 0.3)), glowM);
      band2.position.y = ts.h * 0.85;
      // Rooftop antenna spire
      const antenna = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.12, 0.35, 8, 8)), chromeMat);
      antenna.position.y = ts.h + ts.h * 0.24 + 4;

      tGroup.add(body, crown, band1, band2, antenna);
      this.scene.add(tGroup);
    }

    // Elevated Futuristic Maglev Transit Skyway spanning across the Modern Skyline (z = -74, y = 13.5)
    const skywayTrack = new THREE.Mesh(this.track(new THREE.BoxGeometry(140, 0.75, 2.8)), chromeMat);
    skywayTrack.position.set(0, 13.5, -74);
    const skywayGlow = new THREE.Mesh(this.track(new THREE.BoxGeometry(140, 0.22, 3.0)), cyanGlowMat);
    skywayGlow.position.set(0, 13.1, -74);
    this.scene.add(skywayTrack, skywayGlow);

    // Skyway support pylons
    for (const px of [-38, -14, 14, 38]) {
      const pylon = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.65, 0.95, 13.5, 10)), chromeMat);
      pylon.position.set(px, 6.75, -74);
      this.scene.add(pylon);
    }

    // 3 Animated Streamlined Futuristic Maglev Pods gliding along the skyway
    const podHullGeo = this.track(new THREE.BoxGeometry(6.8, 1.3, 1.8));
    const podGlowGeo = this.track(new THREE.BoxGeometry(7.0, 0.28, 1.9));
    const podSpecs = [
      { x: -35, speed: 16, dir: 1, zOff: -0.55 },
      { x: 25, speed: 19, dir: -1, zOff: 0.55 },
      { x: 5, speed: 14, dir: 1, zOff: -0.55 },
    ];
    for (const ps of podSpecs) {
      const pod = new THREE.Group();
      pod.position.set(ps.x, 14.65, -74 + ps.zOff);
      const hull = new THREE.Mesh(podHullGeo, spireMat);
      const stripe = new THREE.Mesh(podGlowGeo, ps.dir > 0 ? cyanGlowMat : goldGlowMat);
      stripe.position.y = -0.25;
      pod.add(hull, stripe);
      this.scene.add(pod);
      this.maglevPods.push({ mesh: pod, speed: ps.speed, dir: ps.dir, baseZ: -74 + ps.zOff });
    }

    // Modern Urban Eco-Park Trees & Solar Garden Bollards lining the plaza
    const trunkGeo = this.track(new THREE.CylinderGeometry(0.22, 0.34, 2.4, 8));
    const trunkMat = this.track(new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.85 }));
    const foliageGeo1 = this.track(new THREE.ConeGeometry(1.75, 2.6, 8));
    const foliageGeo2 = this.track(new THREE.ConeGeometry(1.3, 2.2, 8));
    const foliageMat = this.track(new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.65 }));
    const lampPoleGeo = this.track(new THREE.CylinderGeometry(0.08, 0.12, 3.4, 8));
    const lampOrbGeo = this.track(new THREE.SphereGeometry(0.26, 10, 10));

    const treeCoords: Array<[number, number]> = [
      [-14, -30], [14, -30],
      [-18, -42], [18, -42],
      [-22, -55], [22, -55],
      [-16, -66], [16, -66],
      [-26, -34], [26, -34],
      [-28, -50], [28, -50],
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
      this.scene.add(tree);
    }

    for (const lx of [-10, 10]) {
      for (const lz of [-36, -48, -60]) {
        const lamp = new THREE.Group();
        lamp.position.set(lx, 0, lz);
        const pole = new THREE.Mesh(lampPoleGeo, chromeMat);
        pole.position.y = 1.7;
        const orbMesh = new THREE.Mesh(lampOrbGeo, goldGlowMat);
        orbMesh.position.y = 3.55;
        lamp.add(pole, orbMesh);
        this.scene.add(lamp);
      }
    }
  }

  private buildSparksSystem() {
    const count = 42;
    this.sparkPositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.sparkPositions[i * 3 + 1] = -25;
      this.sparkLife[i] = 0;
    }
    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    const mat = this.track(
      new THREE.PointsMaterial({
        color: '#fbbf24',
        size: 0.2,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      })
    );
    this.sparkPoints = new THREE.Points(geo, mat);
    this.sparkPoints.frustumCulled = false;
    this.scene.add(this.sparkPoints);

    this.sparkLight = new THREE.PointLight('#fb923c', 0, 14, 1.5);
    this.sparkLight.position.set(-6.8, 2.2, 9.5);
    this.scene.add(this.sparkLight);
  }

  private buildFireworksSystem() {
    this.fwPositions = new Float32Array(TOTAL_FIREWORK_PARTICLES * 3);
    this.fwColors = new Float32Array(TOTAL_FIREWORK_PARTICLES * 3);
    this.fwBaseColors = new Float32Array(TOTAL_FIREWORK_PARTICLES * 3);
    this.fwVelocities = new Float32Array(TOTAL_FIREWORK_PARTICLES * 3);

    for (let i = 0; i < TOTAL_FIREWORK_PARTICLES; i++) {
      this.fwPositions[i * 3 + 1] = -50;
    }
    for (let s = 0; s < FIREWORK_SLOTS; s++) {
      this.fwSlots.push({
        active: false,
        age: 0,
        duration: 1.8,
        startIndex: s * PARTICLES_PER_FIREWORK,
        count: PARTICLES_PER_FIREWORK,
      });
    }

    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(this.fwPositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.fwColors, 3));

    const mat = this.track(
      new THREE.PointsMaterial({
        size: 0.42,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.fwPoints = new THREE.Points(geo, mat);
    this.fwPoints.frustumCulled = false;
    this.scene.add(this.fwPoints);

    this.fwLight = new THREE.PointLight('#38bdf8', 0, 32, 1.3);
    this.fwLight.position.set(0, 8, 0);
    this.scene.add(this.fwLight);
  }

  private spawnFireworkAt(x: number, y: number, z: number, speedScale = 1.0) {
    // Pick an inactive slot or oldest active slot
    let slot = this.fwSlots.find((s) => !s.active);
    if (!slot) {
      slot = this.fwSlots.reduce((a, b) => (a.age > b.age ? a : b));
    }

    slot.active = true;
    slot.age = 0;
    slot.duration = 1.65 + Math.random() * 0.45;

    const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
    const tmpColor = new THREE.Color();

    this.fwLight.position.set(x, y, z);
    this.fwLight.color.setHex(palette[0]);
    this.fwLight.intensity = 22 * speedScale;

    for (let i = 0; i < slot.count; i++) {
      const idx = slot.startIndex + i;
      const i3 = idx * 3;
      this.fwPositions[i3] = x;
      this.fwPositions[i3 + 1] = y;
      this.fwPositions[i3 + 2] = z;

      // Spherical starburst velocity distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const spd = (3.8 + Math.random() * 4.8) * speedScale;

      this.fwVelocities[i3] = Math.sin(phi) * Math.cos(theta) * spd;
      this.fwVelocities[i3 + 1] = Math.cos(phi) * spd + 1.2;
      this.fwVelocities[i3 + 2] = Math.sin(phi) * Math.sin(theta) * spd;

      tmpColor.setHex(palette[i % palette.length]);
      this.fwBaseColors[i3] = tmpColor.r;
      this.fwBaseColors[i3 + 1] = tmpColor.g;
      this.fwBaseColors[i3 + 2] = tmpColor.b;
      this.fwColors[i3] = tmpColor.r;
      this.fwColors[i3 + 1] = tmpColor.g;
      this.fwColors[i3 + 2] = tmpColor.b;
    }

    (this.fwPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.fwPoints.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    this.callbacks.onFireworkBurst?.();
  }

  public triggerLabFireworks(burstCount = 3) {
    // Launches colorful celebratory bursting fireworks right inside the 11m tall Lab Atrium!
    const anchors: Array<[number, number, number]> = [
      [0, 7.6, -2],
      [-8.5, 7.4, 3.5],
      [8.5, 7.8, 3.5],
      [-5.5, 8.2, -10.5],
      [5.5, 8.0, -10.5],
    ];
    for (let i = 0; i < burstCount; i++) {
      const [ax, ay, az] = anchors[(Math.floor(Math.random() * anchors.length) + i) % anchors.length];
      this.pendingFireworkQueue.push({
        delay: i * 0.42,
        x: ax + (Math.random() - 0.5) * 3,
        y: ay + (Math.random() - 0.5) * 1.1,
        z: az + (Math.random() - 0.5) * 3,
        scale: 0.85,
      });
    }
  }

  public triggerMainDoorFireworks() {
    this.pendingFireworkQueue.push(
      { delay: 0.05, x: -3.2, y: 7.4, z: -15.5, scale: 0.9 },
      { delay: 0.38, x: 3.2, y: 7.8, z: -15.5, scale: 0.9 },
      { delay: 0.72, x: 0, y: 8.6, z: -17.5, scale: 1.0 },
      { delay: 1.1, x: 0, y: 16, z: -48, scale: 1.9 }
    );
  }

  private spawnSparkBurst(originX: number, originY: number, originZ: number) {
    this.sparkLight.position.set(originX, originY, originZ);
    this.sparkLight.intensity = 16;
    const count = 42;
    for (let i = 0; i < count; i++) {
      this.sparkPositions[i * 3] = originX;
      this.sparkPositions[i * 3 + 1] = originY;
      this.sparkPositions[i * 3 + 2] = originZ;
      this.sparkVelocities[i * 3] = (Math.random() - 0.5) * 5.2;
      this.sparkVelocities[i * 3 + 1] = Math.random() * 3.8 + 0.6;
      this.sparkVelocities[i * 3 + 2] = (Math.random() - 0.5) * 5.2;
      this.sparkLife[i] = 0.45 + Math.random() * 0.75;
    }
    (this.sparkPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  // =========================================================================
  // PUBLIC API FOR REACT ORCHESTRATOR
  // =========================================================================

  public startCinematic() {
    this.phase = 'cinematic';
    this.cinematicElapsed = 0;
    this.cinematicRunning = true;
    this.lastCinematicScene = 1;
    this.nexusActivation = 0;
    this.outdoorBlend = 0;
    this.releasePointerLock();
    this.setMonitorsGlitched(false);
    this.facadeShutter.position.y = 10.5;
    this.exitShutterLeft.position.x = -3.4;
    this.exitShutterRight.position.x = 3.4;
  }

  public pauseCinematic() {
    this.cinematicRunning = false;
  }

  public resumeCinematic() {
    this.cinematicRunning = true;
  }

  public jumpToTitleScene() {
    this.phase = 'title';
    this.cinematicRunning = false;
    this.cinematicElapsed = 38;
    this.nexusActivation = 1;
    this.outdoorBlend = 0;
    this.nexusGroup.scale.setScalar(1);
    this.nexusLight.intensity = 10;
    this.facadeShutter.position.y = 3.3;
    this.exitShutterLeft.position.x = -1.88;
    this.exitShutterRight.position.x = 1.88;
    this.setMonitorsGlitched(true);
    this.releasePointerLock();
  }

  public enterGameplay(
    completedVaults: VaultId[],
    placedKeys: VaultId[],
    mainDoorOpen: boolean,
    facilityRestored: boolean,
    resolvedExperiments: string[] = []
  ) {
    this.phase = 'gameplay';
    this.cinematicRunning = false;
    this.paused = false;

    this.nexusActivation = 1;
    this.nexusGroup.scale.setScalar(1);
    this.nexusLight.intensity = 10;
    this.facadeShutter.position.y = 3.3;

    // Spawn inside the grand south atrium looking north across the vast lab
    this.playerPos.set(0, 1.65, 14.5);
    this.playerVel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.outdoorBlend = 0;
    this.modernWorldEnteredNotified = false;
    this.camera.position.copy(this.playerPos);
    this.camera.rotation.set(0, 0, 0, 'YXZ');

    this.syncProgress(completedVaults, placedKeys, mainDoorOpen, facilityRestored, resolvedExperiments);
  }

  public syncProgress(
    completedVaults: VaultId[],
    placedKeys: VaultId[],
    mainDoorOpen: boolean,
    facilityRestored: boolean,
    resolvedExperiments: string[] = []
  ) {
    this.completedVaults = new Set(completedVaults);
    this.placedKeys = new Set(placedKeys);
    this.resolvedExperiments = new Set(resolvedExperiments);
    this.mainDoorOpen = mainDoorOpen;
    this.facilityRestored = facilityRestored;

    // Shift audited containment pods from eerie toxic green/amber to stabilized cyan
    for (const [expId, pod] of this.experimentPods.entries()) {
      const stabilized = this.resolvedExperiments.has(expId) || mainDoorOpen;
      const col = stabilized ? '#22d3ee' : pod.baseColorHex;
      pod.ringMat.color.set(col);
      pod.ringMat.emissive.set(col);
      pod.light.color.set(col);
      pod.light.intensity = stabilized ? 4.2 : 6.2;
    }

    // Disable North Main Door collider once open so player walks straight into the Modern World!
    this.mainDoorCollider.active = !mainDoorOpen;

    const highestUnlocked = Math.min(5, completedVaults.length + 1) as VaultId;

    for (const [id, vis] of this.vaultVisuals.entries()) {
      const isCompleted = this.completedVaults.has(id);
      const isAvailable = id <= highestUnlocked;
      vis.targetOpen = isAvailable ? 1 : 0;

      if (isCompleted) {
        vis.beaconMat.color.set('#10b981');
        vis.beaconMat.emissive.set('#10b981');
        vis.beaconLight.color.set('#10b981');
        vis.beaconLight.intensity = 7.0;
      } else if (isAvailable) {
        vis.beaconMat.color.set('#22d3ee');
        vis.beaconMat.emissive.set('#06b6d4');
        vis.beaconLight.color.set('#06b6d4');
        vis.beaconLight.intensity = 7.5;
      } else {
        vis.beaconMat.color.set('#ef4444');
        vis.beaconMat.emissive.set('#dc2626');
        vis.beaconLight.color.set('#ef4444');
        vis.beaconLight.intensity = 4.2;
      }
    }

    // Update the 5 physical Key Pedestals at the Main Door
    this.keySocketMats.forEach((mat, idx) => {
      const keyId = (idx + 1) as VaultId;
      const isPlaced = this.placedKeys.has(keyId);
      const isCarried = this.completedVaults.has(keyId) && !isPlaced;

      if (this.placedKeyHolograms[idx]) {
        this.placedKeyHolograms[idx].visible = isPlaced;
      }

      if (isPlaced) {
        mat.color.set('#10b981');
        mat.emissive.set('#34d399');
        mat.emissiveIntensity = 2.2;
      } else if (isCarried) {
        mat.color.set('#0891b2');
        mat.emissive.set('#22d3ee');
        mat.emissiveIntensity = 1.6;
      } else {
        mat.color.set('#7f1d1d');
        mat.emissive.set('#ef4444');
        mat.emissiveIntensity = 0.9;
      }
    });

    this.exitScreenMat.map = mainDoorOpen ? this.textures.exitRestored : this.textures.exitLocked;
    this.exitScreenMat.emissiveMap = this.exitScreenMat.map;
    this.exitScreenMat.emissive.set(mainDoorOpen ? '#10b981' : '#ef4444');
    this.exitScreenMat.needsUpdate = true;

    this.setMonitorsGlitched(!(mainDoorOpen || facilityRestored));
  }

  public setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) {
      this.keys = {};
      this.releasePointerLock();
    }
  }

  public requestPointerLock() {
    if (this.phase !== 'gameplay' || this.paused) return;
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // drag look fallback active
    }
  }

  public releasePointerLock() {
    if (document.pointerLockElement === this.renderer.domElement) {
      try {
        document.exitPointerLock?.();
      } catch {
        // ignore
      }
    }
  }

  public teleportNearVault(vaultId: VaultId) {
    const vis = this.vaultVisuals.get(vaultId);
    if (!vis) return;
    const toCenter = new THREE.Vector3(-vis.terminalPos.x, 0, -vis.terminalPos.z).normalize();
    this.playerPos.set(
      vis.terminalPos.x + toCenter.x * 3.0,
      1.65,
      vis.terminalPos.z + toCenter.z * 3.0
    );
    const dx = vis.terminalPos.x - this.playerPos.x;
    const dz = vis.terminalPos.z - this.playerPos.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = -0.04;
  }

  public teleportToMainDoor() {
    this.playerPos.set(0, 1.65, -13.2);
    this.yaw = 0;
    this.pitch = 0;
  }

  public teleportNearExperiment(experimentId: string) {
    const node = this.interactables.find((n) => n.kind === 'experiment' && n.experimentId === experimentId);
    if (!node) return;
    const toCenter = new THREE.Vector3(-node.position.x, 0, -node.position.z).normalize();
    this.playerPos.set(
      node.position.x + toCenter.x * 3.1,
      1.65,
      node.position.z + toCenter.z * 3.1
    );
    const dx = node.position.x - this.playerPos.x;
    const dz = node.position.z - this.playerPos.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = -0.02;
  }

  private setMonitorsGlitched(glitched: boolean) {
    for (const mat of this.workstationMonitorMats) {
      mat.map = glitched ? this.textures.monitorGlitch : this.textures.monitorNormal;
      mat.emissiveMap = mat.map;
      mat.emissive.set(glitched ? '#ef4444' : '#06b6d4');
      mat.needsUpdate = true;
    }
  }

  // =========================================================================
  // INPUT HANDLERS
  // =========================================================================

  private handleResize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (this.phase !== 'gameplay' || this.paused) return;
    this.keys[e.code] = true;

    if (e.code === 'KeyE' && this.currentHover) {
      e.preventDefault();
      this.callbacks.onInteract(this.currentHover);
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.keys[e.code] = false;
  }

  private handleMouseDown(e: MouseEvent) {
    if (this.phase !== 'gameplay' || this.paused) return;
    if (!this.pointerLocked) {
      this.requestPointerLock();
      this.isDraggingLook = true;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
    }
  }

  private handleMouseUp() {
    this.isDraggingLook = false;
  }

  private handleMouseMove(e: MouseEvent) {
    if (this.phase !== 'gameplay' || this.paused) return;
    const sensitivity = 0.0022;
    if (this.pointerLocked) {
      this.yaw -= e.movementX * sensitivity;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * sensitivity, -Math.PI / 2.4, Math.PI / 2.4);
    } else if (this.isDraggingLook) {
      const dx = e.clientX - this.lastDragX;
      const dy = e.clientY - this.lastDragY;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
      this.yaw -= dx * sensitivity * 1.3;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sensitivity * 1.3, -Math.PI / 2.4, Math.PI / 2.4);
    }
  }

  private handlePointerLockChange() {
    const locked = document.pointerLockElement === this.renderer.domElement;
    this.pointerLocked = locked;
    if (!locked) {
      this.keys = {};
    }
    this.callbacks.onPointerLockChange(locked);
  }

  // =========================================================================
  // MAIN SIMULATION & RENDER LOOP
  // =========================================================================

  private tick = () => {
    if (this.disposed) return;

    const now = performance.now();
    const dt = Math.min(0.06, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    const elapsedSec = now * 0.001;

    if (this.phase === 'cinematic') {
      this.updateCinematic(dt, elapsedSec);
    } else if (this.phase === 'title') {
      this.updateTitleBackdrop(dt, elapsedSec);
    } else {
      this.updateGameplay(dt, elapsedSec);
    }

    this.updateAmbientAnimations(dt, elapsedSec);
    this.updateFumes(dt, elapsedSec);
    this.updateSparks(dt);
    this.updateFireworks(dt);

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.scheduleAfterDraw();
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private scheduleAfterDraw() {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 8);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(this.tick, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 8);
    } else {
      this.frameId = window.setTimeout(this.tick, 80);
    }
  }

  private updateCinematic(dt: number, elapsedSec: number) {
    if (this.cinematicRunning) {
      this.cinematicElapsed += dt;
    }
    const t = this.cinematicElapsed;

    let sceneId: CinematicSceneId = 1;
    if (t < 9.0) sceneId = 1;
    else if (t < 16.5) sceneId = 2;
    else if (t < 24.5) sceneId = 3;
    else if (t < 37.5) sceneId = 4;
    else sceneId = 5;

    if (sceneId !== this.lastCinematicScene) {
      if (sceneId === 2) {
        this.setMonitorsGlitched(true);
      } else if (sceneId === 3) {
        this.spawnSparkBurst(-6.8, 2.2, 9.5);
      }
      this.lastCinematicScene = sceneId;
    }

    // Keep dark atmosphere during cinematic
    this.scene.background = _bgDark;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(_bgDark);
      this.scene.fog.density = 0.017;
    }

    if (sceneId === 1) {
      // Scene 1 (0–9s): Exterior night approach gliding into the grand 44m x 42m lab
      const p = THREE.MathUtils.smoothstep(t / 9.0, 0, 1);
      this.camera.position.set(
        THREE.MathUtils.lerp(6.5, 1.2, p),
        THREE.MathUtils.lerp(6.0, 3.0, p),
        THREE.MathUtils.lerp(36.0, 14.0, p)
      );
      _lookTarget.set(THREE.MathUtils.lerp(0, -1.5, p), 2.4, THREE.MathUtils.lerp(18, -4.0, p));
      this.camera.lookAt(_lookTarget);

      this.mainLights.forEach((l) => (l.intensity = 28));
      this.emergencyLights.forEach((l) => (l.intensity = 0));
    } else if (sceneId === 2) {
      const p = (t - 9.0) / 7.5;
      const flicker = Math.sin(t * 38) * Math.cos(t * 21) > -0.15 ? 20 : 2.5;
      this.mainLights.forEach((l) => (l.intensity = flicker));
      this.emergencyLights.forEach((l) => (l.intensity = Math.max(0, Math.sin(t * 6)) * 8));

      const shakeX = Math.sin(t * 28) * 0.05;
      const shakeY = Math.cos(t * 33) * 0.04;
      this.camera.position.set(
        THREE.MathUtils.lerp(1.2, -4.2, p) + shakeX,
        THREE.MathUtils.lerp(3.0, 2.5, p) + shakeY,
        THREE.MathUtils.lerp(14.0, 6.2, p)
      );
      _lookTarget.set(THREE.MathUtils.lerp(-1.5, -6.5, p), 1.6, THREE.MathUtils.lerp(-4.0, 8.5, p));
      this.camera.lookAt(_lookTarget);

      if (Math.abs(t - 13.0) < 0.06) {
        this.spawnSparkBurst(6.8, 2.0, 9.5);
      }
    } else if (sceneId === 3) {
      const p = Math.min(1, (t - 16.5) / 8.0);
      this.mainLights.forEach((l) => (l.intensity = THREE.MathUtils.lerp(l.intensity, 2.0, dt * 4)));
      const pulse = 9 + Math.sin(elapsedSec * 5.2) * 5.5;
      this.emergencyLights.forEach((l) => (l.intensity = pulse));

      const slamP = Math.min(1, p * 2.2);
      this.facadeShutter.position.y = THREE.MathUtils.lerp(10.5, 3.3, slamP * slamP);
      this.exitShutterLeft.position.x = THREE.MathUtils.lerp(-3.4, -1.88, slamP);
      this.exitShutterRight.position.x = THREE.MathUtils.lerp(3.4, 1.88, slamP);

      this.camera.position.set(
        THREE.MathUtils.lerp(-4.2, 2.8, p),
        THREE.MathUtils.lerp(2.5, 3.4, p),
        THREE.MathUtils.lerp(6.2, -7.5, p)
      );
      _lookTarget.set(0, 3.6, -20.8);
      this.camera.lookAt(_lookTarget);

      if (Math.abs(t - 19.5) < 0.06 || Math.abs(t - 22.0) < 0.06) {
        this.spawnSparkBurst(0, 4.6, -19.5);
      }
    } else if (sceneId === 4) {
      const p = Math.min(1, (t - 24.5) / 13.0);
      this.mainLights.forEach((l) => (l.intensity = 5.0));
      this.emergencyLights.forEach((l) => (l.intensity = 5.5 + Math.sin(elapsedSec * 2.2) * 2.0));

      this.nexusActivation = Math.min(1, (t - 24.8) / 2.2);
      const glitchJitter = t < 27.5 ? (Math.random() > 0.72 ? 0.85 : 1.0) : 1.0;
      const scale = Math.max(0.001, THREE.MathUtils.smoothstep(this.nexusActivation, 0, 1) * glitchJitter);
      this.nexusGroup.scale.setScalar(scale);
      this.nexusLight.intensity = scale * 14;

      const angle = THREE.MathUtils.lerp(-0.55, 0.55, p);
      this.camera.position.set(Math.sin(angle) * 6.0, 3.0, 2.0 + Math.cos(angle) * 6.0);
      _lookTarget.set(0, 2.8, 2.0);
      this.camera.lookAt(_lookTarget);
    } else {
      this.phase = 'title';
      this.cinematicRunning = false;
      this.callbacks.onCinematicComplete();
    }

    this.callbacks.onCinematicTimeUpdate(t, sceneId);
  }

  private updateTitleBackdrop(_dt: number, elapsedSec: number) {
    const angle = Math.sin(elapsedSec * 0.14) * 0.45;
    this.camera.position.set(Math.sin(angle) * 11.5, 4.8, 13.5 + Math.cos(angle) * 2.2);
    _lookTarget.set(0, 2.8, -6.5);
    this.camera.lookAt(_lookTarget);

    this.mainLights.forEach((l) => (l.intensity = 6.5));
    this.emergencyLights.forEach((l) => (l.intensity = 6.5 + Math.sin(elapsedSec * 2.4) * 2.5));
  }

  private updateGameplay(dt: number, elapsedSec: number) {
    // Smoothly shift atmosphere when stepping outside through the open Main Door into the Modern World!
    const isOutside = this.playerPos.z < -21.2;
    const isLockedDarkLab = !this.mainDoorOpen && !this.facilityRestored;
    const targetBlend = isOutside ? 1 : 0;
    this.outdoorBlend = THREE.MathUtils.damp(this.outdoorBlend, targetBlend, 2.6, dt);

    const indoorBg = isLockedDarkLab ? _fogHorror : _bgDark;
    _bgCurrent.copy(indoorBg).lerp(_bgModern, this.outdoorBlend);
    this.scene.background = _bgCurrent;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(_bgCurrent);
      // Thicker claustrophobic toxic fog while locked inside; crisp open sky outside
      const indoorFogDensity = isLockedDarkLab ? 0.025 : 0.013;
      this.scene.fog.density = THREE.MathUtils.lerp(indoorFogDensity, 0.0055, this.outdoorBlend);
    }
    this.hemiLight.color.copy(_hemiSkyDark).lerp(_hemiSkyModern, this.outdoorBlend);
    this.hemiLight.groundColor.copy(_hemiGndDark).lerp(_hemiGndModern, this.outdoorBlend);
    this.hemiLight.intensity = THREE.MathUtils.lerp(isLockedDarkLab ? 0.34 : 0.65, 1.35, this.outdoorBlend);
    this.sunLight.intensity = THREE.MathUtils.lerp(isLockedDarkLab ? 0.38 : 0.8, 2.1, this.outdoorBlend);

    // Dim eerie ceiling lighting with sporadic unstable electrical flickers while locked down;
    // brightens cleanly once Main Door opens / facility restored
    const flickerDip =
      isLockedDarkLab && Math.sin(elapsedSec * 23.0) * Math.sin(elapsedSec * 7.3) > 0.86 ? 0.42 : 1.0;
    const targetMain = isLockedDarkLab ? 4.4 * flickerDip : 26;
    const targetRed = isLockedDarkLab ? 7.8 + Math.sin(elapsedSec * 3.1) * 3.2 : 0;
    this.mainLights.forEach((l, i) => {
      const perLightTarget = isLockedDarkLab && i % 2 === 1 ? targetMain * 0.82 : targetMain;
      l.intensity = THREE.MathUtils.damp(l.intensity, perLightTarget, 5, dt);
    });
    this.emergencyLights.forEach((l) => (l.intensity = THREE.MathUtils.damp(l.intensity, targetRed, 4, dt)));

    // Sync first-person tactical headlamp to camera (illuminates dark corridors & smeared glass)
    const targetHeadlamp = isLockedDarkLab ? 18 * (1 - this.outdoorBlend) : 0;
    this.headlamp.intensity = THREE.MathUtils.damp(this.headlamp.intensity, targetHeadlamp, 6, dt);
    if (this.headlamp.intensity > 0.05) {
      this.headlamp.position.copy(this.camera.position);
      this.camera.getWorldDirection(_camDir);
      this.headlampTarget.position.copy(this.camera.position).addScaledVector(_camDir, 10);
    }

    // Sparse ambient horror metallic creaks while trapped in the dark lab
    if (isLockedDarkLab && !this.paused) {
      this.ambientCreakTimer -= dt;
      if (this.ambientCreakTimer <= 0) {
        this.ambientCreakTimer = 11.5 + Math.random() * 8.5;
        this.callbacks.onAmbientCreak?.();
      }
    }

    // Chemical fume & olfactory air-sensor proximity check
    this.hissCooldown = Math.max(0, this.hissCooldown - dt);
    this.fumeCheckAccum += dt;
    if (this.fumeCheckAccum >= 0.2) {
      this.fumeCheckAccum = 0;
      let ppm = 0;
      let nearestSmell: string | null = null;
      if (isLockedDarkLab && !isOutside) {
        ppm = 18; // Baseline lingering volatile solvent smell inside locked lab
        let highestLeakPpm = 0;
        for (const leak of this.chemicalLeaks) {
          const dist = Math.hypot(this.playerPos.x - leak.x, this.playerPos.z - leak.z);
          if (dist < leak.radius) {
            const factor = 1 - dist / leak.radius;
            const leakPpm = Math.round(18 + factor * factor * (leak.maxPpm - 18));
            if (leakPpm > highestLeakPpm) {
              highestLeakPpm = leakPpm;
              nearestSmell = leak.smellCue;
            }
          }
        }
        if (highestLeakPpm > ppm) {
          ppm = highestLeakPpm;
        }
        if (ppm >= 85 && this.lastReportedPpm < 85 && this.hissCooldown <= 0) {
          this.hissCooldown = 4.5;
          this.callbacks.onChemicalHiss?.();
        }
      }
      if (ppm !== this.lastReportedPpm || nearestSmell !== this.lastReportedSmell) {
        this.lastReportedPpm = ppm;
        this.lastReportedSmell = nearestSmell;
        this.callbacks.onFumeLevelChange?.(ppm, nearestSmell);
      }
    }

    // Animate massive Main Door blast gates wide open once all 5 keys are placed!
    const targetDoorX = this.mainDoorOpen ? 5.2 : 1.88;
    this.exitShutterLeft.position.x = THREE.MathUtils.damp(this.exitShutterLeft.position.x, -targetDoorX, 2.6, dt);
    this.exitShutterRight.position.x = THREE.MathUtils.damp(this.exitShutterRight.position.x, targetDoorX, 2.6, dt);

    // Trigger periodic celebratory fireworks in the Modern World sky (and restored lab atrium)
    if (this.mainDoorOpen) {
      this.autoFireworkCooldown -= dt;
      if (this.autoFireworkCooldown <= 0) {
        this.autoFireworkCooldown = 1.6 + Math.random() * 1.4;
        if (this.playerPos.z < -18) {
          // Grand colorful sky fireworks over the Modern World skyline!
          this.spawnFireworkAt(
            (Math.random() - 0.5) * 46,
            18 + Math.random() * 14,
            -46 - Math.random() * 34,
            1.75
          );
        } else {
          // Celebratory lab atrium fireworks
          this.spawnFireworkAt(
            (Math.random() - 0.5) * 22,
            7.2 + Math.random() * 2.2,
            (Math.random() - 0.5) * 20,
            0.85
          );
        }
      }
    }

    // First-person movement
    if (!this.paused) {
      const moveZ =
        Number(!!(this.keys['KeyW'] || this.keys['ArrowUp'])) -
        Number(!!(this.keys['KeyS'] || this.keys['ArrowDown']));
      const moveX =
        Number(!!(this.keys['KeyD'] || this.keys['ArrowRight'])) -
        Number(!!(this.keys['KeyA'] || this.keys['ArrowLeft']));

      _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

      _move.set(0, 0, 0);
      _move.addScaledVector(_forward, moveZ);
      _move.addScaledVector(_right, moveX);
      if (_move.lengthSq() > 0.001) {
        // Slightly brisker walk speed to enjoy the spacious lab & Modern World plaza
        _move.normalize().multiplyScalar(isOutside ? 8.2 : 6.8);
      }

      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, _move.x, 10, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, _move.z, 10, dt);

      const nextX = this.playerPos.x + this.playerVel.x * dt;
      if (!this.collidesAt(nextX, this.playerPos.z)) {
        this.playerPos.x = nextX;
      }
      const nextZ = this.playerPos.z + this.playerVel.z * dt;
      if (!this.collidesAt(this.playerPos.x, nextZ)) {
        this.playerPos.z = nextZ;
      }

      // World bounds: inside lab (-21..21, -20.4..20), or once through Main Door, wide Modern World (-40..40, -82..20)
      if (this.playerPos.z < -21.0) {
        this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x, -38, 38);
        this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z, -80, 20);
      } else {
        this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x, -21.1, 21.1);
        this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z, this.mainDoorOpen ? -80 : -20.2, 20.0);
      }

      // Detect walking through the Main Door into the Modern World!
      if (this.mainDoorOpen && this.playerPos.z < -23.5 && !this.modernWorldEnteredNotified) {
        this.modernWorldEnteredNotified = true;
        this.callbacks.onEnterModernWorld?.();
      }

      const speed = Math.hypot(this.playerVel.x, this.playerVel.z);
      if (speed > 0.35) {
        this.walkBobPhase += dt * speed * 1.65;
      }
      const bobOffset = speed > 0.35 ? Math.sin(this.walkBobPhase) * 0.032 : 0;

      this.camera.position.set(this.playerPos.x, 1.65 + bobOffset, this.playerPos.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

      this.updateHoverInteractable();

      this.mapUpdateAccum += dt;
      if (this.mapUpdateAccum > 0.12 && this.callbacks.onPlayerPositionUpdate) {
        this.mapUpdateAccum = 0;
        this.callbacks.onPlayerPositionUpdate(this.playerPos.x, this.playerPos.z, this.yaw);
      }
    }
  }

  private collidesAt(x: number, z: number): boolean {
    const r = 0.45;
    for (const box of this.colliders) {
      if (!box.active) continue;
      if (x + r > box.minX && x - r < box.maxX && z + r > box.minZ && z - r < box.maxZ) {
        return true;
      }
    }
    return false;
  }

  private updateHoverInteractable() {
    this.camera.getWorldDirection(_camDir);

    let bestNode: InteractableNode | null = null;
    let bestScore = -Infinity;

    for (const node of this.interactables) {
      _toNode.copy(node.position).sub(this.camera.position);
      const dist = _toNode.length();
      if (dist > node.radius) continue;
      _toNode.divideScalar(dist || 1);
      const align = _camDir.dot(_toNode);
      if (align < 0.54) continue;
      const score = align * 2.2 - dist * 0.2;
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    const highestUnlocked = Math.min(5, this.completedVaults.size + 1);
    const unplacedKeysCount = Array.from(this.completedVaults).filter((k) => !this.placedKeys.has(k)).length;

    const nextHover: InteractableTarget | null = bestNode
      ? {
          id: bestNode.id,
          kind: bestNode.kind,
          label: bestNode.label,
          sublabel:
            bestNode.kind === 'vault' && bestNode.vaultId
              ? bestNode.vaultId > highestUnlocked
                ? `Locked · Complete Vault 0${bestNode.vaultId - 1} First`
                : this.completedVaults.has(bestNode.vaultId)
                  ? 'Completed · Press [E] to Revisit'
                  : 'Available · Press [E] to Access'
              : bestNode.kind === 'exit'
                ? this.mainDoorOpen
                  ? 'Main Gate Open · Walk Straight Ahead to the Modern World!'
                  : unplacedKeysCount > 0
                    ? `Press [E] to Place ${unplacedKeysCount} Carried Key${unplacedKeysCount > 1 ? 's' : ''} (${this.placedKeys.size}/5 Placed)`
                    : this.placedKeys.size >= 5
                      ? 'All 5 Keys Placed · Press [E] to Open Main Gate!'
                      : `Keys Placed: ${this.placedKeys.size}/5 · Solve Vaults to Collect Keys`
                  : bestNode.kind === 'experiment' && bestNode.experimentId
                    ? this.resolvedExperiments.has(bestNode.experimentId)
                      ? 'Containment Stabilized · Press [E] to Review Case File'
                      : 'Failed Experiment · Press [E] to Audit Risk & Contain'
                    : bestNode.sublabel,
          vaultId: bestNode.vaultId,
          logId: bestNode.logId,
          experimentId: bestNode.experimentId,
          locked:
            bestNode.kind === 'vault' && bestNode.vaultId
              ? bestNode.vaultId > highestUnlocked
              : bestNode.kind === 'exit'
                ? !this.mainDoorOpen && unplacedKeysCount === 0 && this.placedKeys.size < 5
                : false,
        }
      : null;

    if (
      nextHover?.id !== this.currentHover?.id ||
      nextHover?.sublabel !== this.currentHover?.sublabel
    ) {
      this.currentHover = nextHover;
      this.callbacks.onHoverTargetChange(nextHover);
    }
  }

  private updateAmbientAnimations(dt: number, elapsedSec: number) {
    if (this.nexusActivation > 0.01) {
      this.nexusCoreMesh.rotation.y += dt * 0.9;
      this.nexusCoreMesh.rotation.x += dt * 0.4;
      this.nexusRingOuter.rotation.z += dt * 0.55;
      this.nexusRingOuter.rotation.x = Math.sin(elapsedSec * 0.7) * 0.45;
      this.nexusRingInner.rotation.y -= dt * 1.1;
      this.nexusGroup.position.y = 3.0 + Math.sin(elapsedSec * 1.8) * 0.1;
    }

    // Rotate placed 3D keys above the Main Door pedestals
    for (let i = 0; i < this.placedKeyHolograms.length; i++) {
      const kh = this.placedKeyHolograms[i];
      if (kh.visible) {
        kh.rotation.y += dt * 1.8;
        kh.position.y = 1.68 + Math.sin(elapsedSec * 2.5 + i) * 0.06;
      }
    }

    for (const vis of this.vaultVisuals.values()) {
      vis.hologramGroup.rotation.y += dt * 0.85;
      vis.hologramGroup.position.y = 2.55 + Math.sin(elapsedSec * 2.0 + vis.id) * 0.08;

      vis.doorOpenAmount = THREE.MathUtils.damp(vis.doorOpenAmount, vis.targetOpen, 3.8, dt);
      const slideOffset = vis.doorOpenAmount * 1.45;
      vis.doorLeft.position.x = -0.97 - slideOffset;
      vis.doorRight.position.x = 0.97 + slideOffset;
    }

    for (let i = 0; i < this.securityCameras.length; i++) {
      const cam = this.securityCameras[i];
      cam.rotation.y = (cam.userData.baseYaw || 0) + Math.sin(elapsedSec * 0.65 + i * 1.5) * 0.42;
    }

    for (const rotor of this.beaconRotors) {
      rotor.rotation.y += dt * 3.0;
    }

    // Modern World monument rings & Maglev skyway pods
    if (this.modernMonumentRings.length >= 2) {
      this.modernMonumentRings[0].rotation.y += dt * 0.65;
      this.modernMonumentRings[0].rotation.x = Math.sin(elapsedSec * 0.5) * 0.35;
      this.modernMonumentRings[1].rotation.z -= dt * 0.85;
      this.modernMonumentRings[1].rotation.y += dt * 0.45;
    }

    for (const pod of this.maglevPods) {
      pod.mesh.position.x += pod.speed * pod.dir * dt;
      if (pod.mesh.position.x > 68) pod.mesh.position.x = -68;
      if (pod.mesh.position.x < -68) pod.mesh.position.x = 68;
    }

    // Unsettling subtle twitch & rotation on suspended failed specimens inside containment pods
    for (const [expId, pod] of this.experimentPods.entries()) {
      const stabilized = this.resolvedExperiments.has(expId) || this.mainDoorOpen;
      const twitch = !stabilized && Math.sin(elapsedSec * 9.5 + pod.phaseOffset) > 0.93 ? 0.12 : 0;
      pod.specimen.rotation.y += dt * (stabilized ? 0.25 : 0.65);
      pod.specimen.rotation.z = Math.sin(elapsedSec * 1.6 + pod.phaseOffset) * 0.14 + twitch;
      pod.specimen.position.y = 2.08 + Math.sin(elapsedSec * 1.4 + pod.phaseOffset) * 0.08;
    }
  }

  private updateFumes(dt: number, elapsedSec: number) {
    // Fade out toxic rising vapor smoothly once ventilation restores with Main Door open
    const targetOpacity = this.mainDoorOpen || this.facilityRestored ? 0.0 : 0.25;
    this.fumeMat.opacity = THREE.MathUtils.damp(this.fumeMat.opacity, targetOpacity, 2.2, dt);
    this.fumePoints.visible = this.fumeMat.opacity > 0.01;
    if (!this.fumePoints.visible) return;

    const count = this.fumeSpeeds.length;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      this.fumePositions[i3 + 1] += this.fumeSpeeds[i] * dt;
      this.fumePositions[i3] = this.fumeOrigins[i3] + Math.sin(elapsedSec * 1.1 + i) * 0.28;
      this.fumePositions[i3 + 2] = this.fumeOrigins[i3 + 2] + Math.cos(elapsedSec * 0.9 + i) * 0.28;
      if (this.fumePositions[i3 + 1] > 2.85) {
        this.fumePositions[i3 + 1] = 0.08;
      }
    }
    (this.fumePoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  private updateSparks(dt: number) {
    let anyAlive = false;
    const count = 42;
    for (let i = 0; i < count; i++) {
      if (this.sparkLife[i] > 0) {
        anyAlive = true;
        this.sparkLife[i] -= dt;
        this.sparkVelocities[i * 3 + 1] -= 9.5 * dt;
        this.sparkPositions[i * 3] += this.sparkVelocities[i * 3] * dt;
        this.sparkPositions[i * 3 + 1] += this.sparkVelocities[i * 3 + 1] * dt;
        this.sparkPositions[i * 3 + 2] += this.sparkVelocities[i * 3 + 2] * dt;
        if (this.sparkPositions[i * 3 + 1] < 0.05) {
          this.sparkPositions[i * 3 + 1] = 0.05;
          this.sparkVelocities[i * 3 + 1] *= -0.3;
        }
        if (this.sparkLife[i] <= 0) {
          this.sparkPositions[i * 3 + 1] = -25;
        }
      }
    }
    if (anyAlive) {
      (this.sparkPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
    if (this.sparkLight.intensity > 0.05) {
      this.sparkLight.intensity = THREE.MathUtils.damp(this.sparkLight.intensity, 0, 8, dt);
    } else {
      this.sparkLight.intensity = 0;
    }
  }

  private updateFireworks(dt: number) {
    // Process queued staggered bursts
    for (let q = this.pendingFireworkQueue.length - 1; q >= 0; q--) {
      const item = this.pendingFireworkQueue[q];
      item.delay -= dt;
      if (item.delay <= 0) {
        this.spawnFireworkAt(item.x, item.y, item.z, item.scale);
        this.pendingFireworkQueue.splice(q, 1);
      }
    }

    let anyUpdated = false;
    const drag = Math.exp(-1.55 * dt);

    for (const slot of this.fwSlots) {
      if (!slot.active) continue;
      anyUpdated = true;
      slot.age += dt;
      const progress = slot.age / slot.duration;
      const fade = Math.max(0, 1 - progress * progress);

      if (progress >= 1) {
        slot.active = false;
        for (let i = 0; i < slot.count; i++) {
          const i3 = (slot.startIndex + i) * 3;
          this.fwPositions[i3 + 1] = -50;
          this.fwColors[i3] = 0;
          this.fwColors[i3 + 1] = 0;
          this.fwColors[i3 + 2] = 0;
        }
        continue;
      }

      for (let i = 0; i < slot.count; i++) {
        const i3 = (slot.startIndex + i) * 3;
        this.fwVelocities[i3] *= drag;
        this.fwVelocities[i3 + 1] = this.fwVelocities[i3 + 1] * drag - 4.4 * dt;
        this.fwVelocities[i3 + 2] *= drag;

        this.fwPositions[i3] += this.fwVelocities[i3] * dt;
        this.fwPositions[i3 + 1] += this.fwVelocities[i3 + 1] * dt;
        this.fwPositions[i3 + 2] += this.fwVelocities[i3 + 2] * dt;

        // Subtle sparkle twinkle near end of burst
        const twinkle = progress > 0.55 && Math.random() > 0.72 ? 1.25 : 1.0;
        this.fwColors[i3] = this.fwBaseColors[i3] * fade * twinkle;
        this.fwColors[i3 + 1] = this.fwBaseColors[i3 + 1] * fade * twinkle;
        this.fwColors[i3 + 2] = this.fwBaseColors[i3 + 2] * fade * twinkle;
      }
    }

    if (anyUpdated) {
      (this.fwPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.fwPoints.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    }

    if (this.fwLight.intensity > 0.05) {
      this.fwLight.intensity = THREE.MathUtils.damp(this.fwLight.intensity, 0, 5.5, dt);
    } else {
      this.fwLight.intensity = 0;
    }
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    this.releasePointerLock();

    window.removeEventListener('resize', this.onResizeBound);
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    window.removeEventListener('mousemove', this.onMouseMoveBound);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDownBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);
    document.removeEventListener('pointerlockchange', this.onPointerLockChangeBound);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLostBound);

    this.textures.dispose();
    this.pmremRT?.dispose();
    for (const item of this.disposables) {
      item.dispose();
    }
    this.disposables = [];

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
