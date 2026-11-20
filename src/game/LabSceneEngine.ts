import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createFacilityTextures, FacilityTextures } from './facilityTextures';
import { ResearcherCharacter } from './ResearcherCharacter';
import { FutureCitySystem } from './FutureCitySystem';
import { buildRedesignedFacilityZones, RedesignedFacilityZones } from './FacilityZonesBuilder';
import { buildVaultChambers, VaultChambersSystem } from './VaultChambersBuilder';
import { VAULTS } from '../data/vaultData';
import {
  CinematicSceneId,
  GamePhase,
  InteractableTarget,
  VaultId,
  VehicleHudState,
} from '../types/game';

interface BoxCollider {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY?: number;
  active: boolean;
}

interface VaultVisual {
  id: VaultId;
  group: THREE.Group;
  rotY: number;
  doorLeft: THREE.Group;
  doorRight: THREE.Group;
  lockRing: THREE.Group;
  beaconMat: THREE.MeshStandardMaterial;
  beaconLight: THREE.PointLight;
  kioskScreenMat: THREE.MeshStandardMaterial;
  targetBeaconColor: THREE.Color;
  targetScreenColor: THREE.Color;
  hologramGroup: THREE.Group;
  terminalPos: THREE.Vector3;
  doorOpenAmount: number;
  targetOpen: number;
  lockRetract: number;
  targetLockRetract: number;
  collider: BoxCollider;
}

interface InteractableNode {
  id: string;
  kind: 'vault' | 'nexus' | 'exit' | 'monument' | 'evidence';
  position: THREE.Vector3;
  radius: number;
  label: string;
  sublabel: string;
  vaultId?: VaultId;
  entityId?: string;
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
  onVehicleHudChange?: (state: VehicleHudState) => void;
  onCityActionFeedback?: (msg: string) => void;
  onVaultInteriorChange?: (vaultId: VaultId | null) => void;
  onAutoDoorToggle?: (action: 'open' | 'close', doorId: VaultId | 'main-gate') => void;
}

// Module-scope scratch math objects to guarantee zero GC in the animation loop
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _toNode = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _camPivot = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _camSample = new THREE.Vector3();
const _transSpark = new THREE.Vector3();

const _bgLab = new THREE.Color('#091326');
const _bgAlert = new THREE.Color('#140814');
const _bgModern = new THREE.Color('#8ecae6');
const _bgCurrent = new THREE.Color('#091326');
const _hemiSkyLab = new THREE.Color('#bae6fd');
const _hemiSkyModern = new THREE.Color('#e0f2fe');
const _hemiGndLab = new THREE.Color('#1e1b4b');
const _hemiGndModern = new THREE.Color('#94a3b8');
const _cyanColor = new THREE.Color('#38bdf8');
const _cyanEmissive = new THREE.Color('#0284c7');
const _purpleColor = new THREE.Color('#a855f7');
const _purpleEmissive = new THREE.Color('#7e22ce');
const _redColor = new THREE.Color('#ef4444');
const _redEmissive = new THREE.Color('#dc2626');

const FIREWORK_SLOTS = 5;
const PARTICLES_PER_FIREWORK = 64;
const TOTAL_FIREWORK_PARTICLES = FIREWORK_SLOTS * PARTICLES_PER_FIREWORK;
const FIREWORK_PALETTES = [
  [0x22d3ee, 0xa5f3fc, 0xffffff],
  [0xfbbf24, 0xf59e0b, 0xfef3c7],
  [0x10b981, 0x6ee7b7, 0x38bdf8],
  [0xf472b6, 0xc084fc, 0xffffff],
  [0xfb7185, 0xfde047, 0x38bdf8],
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
  private composer: EffectComposer | null = null;
  private composerRT: THREE.WebGLRenderTarget | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: FacilityTextures;
  private pmremRT: THREE.WebGLRenderTarget | null = null;

  private disposables: Array<{ dispose: () => void }> = [];
  private colliders: BoxCollider[] = [];
  private interactables: InteractableNode[] = [];
  private vaultVisuals: Map<VaultId, VaultVisual> = new Map();

  // Dynamic lighting & architectural strips
  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private mainLights: THREE.PointLight[] = [];
  private emergencyLights: THREE.PointLight[] = [];
  private beaconRotors: THREE.Group[] = [];
  private securityCameras: THREE.Group[] = [];
  private workstationMonitorMats: THREE.MeshStandardMaterial[] = [];
  private floorGuideMat!: THREE.MeshStandardMaterial;
  private ceilingLedMat!: THREE.MeshStandardMaterial;

  // Redesigned multi-zone biotech facility + 5 physically attached 3D Vault Interior Chambers
  private facilityZones!: RedesignedFacilityZones;
  private vaultChambers!: VaultChambersSystem;
  private activeInteriorVault: VaultId | null = null;
  private visibleVaultsSet: Set<VaultId> = new Set();

  // Main Door & 5 Physical Key Pedestals
  private exitScreenMat!: THREE.MeshStandardMaterial;
  private exitShutterLeft!: THREE.Mesh;
  private exitShutterRight!: THREE.Mesh;
  private mainDoorCollider!: BoxCollider;
  private keySocketMats: THREE.MeshStandardMaterial[] = [];
  private placedKeyHolograms: THREE.Group[] = [];

  // NEXUS AI Hologram Core
  private nexusGroup!: THREE.Group;
  private nexusRingOuter!: THREE.Mesh;
  private nexusRingInner!: THREE.Mesh;
  private nexusCoreMesh!: THREE.Mesh;
  private nexusLight!: THREE.PointLight;
  private nexusActivation = 0;

  // Visibly Distinct 3D Human Characters + GTA Future City
  private playerCharacter!: ResearcherCharacter;
  private rogueCharacter!: ResearcherCharacter;
  private rogueMonitorMat!: THREE.MeshStandardMaterial;
  private rogueDrugHologram!: THREE.Group;
  private futureCity!: FutureCitySystem;
  private outdoorBlend = 0;
  private modernWorldEnteredNotified = false;
  private vehicleHudAccum = 0;

  // Electrical sparks (for NEXUS uplink intercept in Scene 2)
  private sparkPoints!: THREE.Points;
  private sparkPositions!: Float32Array;
  private sparkVelocities: Float32Array = new Float32Array(42 * 3);
  private sparkLife: Float32Array = new Float32Array(42);
  private sparkLight!: THREE.PointLight;

  // Bursting 3D Fireworks System
  private fwPoints!: THREE.Points;
  private fwPositions!: Float32Array;
  private fwColors!: Float32Array;
  private fwBaseColors!: Float32Array;
  private fwVelocities!: Float32Array;
  private fwSlots: FireworkSlot[] = [];
  private fwLight!: THREE.PointLight;
  private pendingFireworkQueue: Array<{ delay: number; x: number; y: number; z: number; scale: number }> = [];
  private autoFireworkCooldown = 2.4;

  // State
  private phase: GamePhase = 'cinematic';
  private paused = false;
  private cinematicElapsed = 0;
  private cinematicRunning = false;
  private lastCinematicScene: CinematicSceneId = 1;
  private completedVaults: Set<VaultId> = new Set();
  private placedKeys: Set<VaultId> = new Set();
  private collectedEvidence: Set<string> = new Set();
  private mainDoorOpen = false;
  private mainDoorTargetOpen = false;
  private mainDoorOpenAmount = 0;
  private facilityRestored = false;

  // Third-person 3D Investigator Controller & Camera
  private playerPos = new THREE.Vector3(0, 0, 24.5);
  private playerVel = new THREE.Vector3();
  private playerVerticalVel = 0;
  private isGrounded = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private characterYaw = Math.PI; // Faces -Z (into the grand research complex)
  private prevCharacterYaw = Math.PI;
  private interactPulse = 0;
  private yaw = 0;
  private pitch = 0.22;
  private smoothCamPos = new THREE.Vector3(0.36, 3.1, 28.6);
  private smoothCamLook = new THREE.Vector3(0, 1.56, 24.5);
  private cameraShake = 0;
  private baseFov = 64;
  private keys: Record<string, boolean> = {};
  private pointerLocked = false;
  private isDraggingLook = false;
  private lastDragX = 0;
  private lastDragY = 0;
  private virtualMoveX = 0;
  private virtualMoveZ = 0;
  private virtualRun = false;
  private shiftKeyDown = false;
  private sprintToggle = false;
  private shiftPressTime = 0;
  private lookTouchId: number | null = null;
  private lastTouchX = 0;
  private lastTouchY = 0;
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
  private onTouchStartBound: (e: TouchEvent) => void;
  private onTouchMoveBound: (e: TouchEvent) => void;
  private onTouchEndBound: (e: TouchEvent) => void;
  private onPointerLockChangeBound: () => void;
  private onBlurBound: () => void;
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
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = _bgLab.clone();
    this.scene.fog = new THREE.FogExp2('#091326', 0.0028);

    // Mandatory studio environment reflection map
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.pmremRT.texture;
    this.scene.environmentIntensity = 0.46;
    pmremGenerator.dispose();

    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    this.baseFov = aspect < 0.85 ? 74 : 64;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.1, 420);
    this.camera.rotation.order = 'YXZ';

    this.textures = createFacilityTextures(this.renderer.capabilities.getMaxAnisotropy());

    this.buildLighting();
    this.buildGrandFacilityArchitecture();
    this.buildCentralNexusCore();
    this.buildGrandMainDoorAndKeyPedestals();
    this.buildLabWorkstations();
    this.buildFiveVaults();
    this.vaultChambers = buildVaultChambers(this.scene, this.textures, !this.isSoftwareGl);
    this.buildRedesignedZones();
    this.buildCharacters();
    this.buildModernizedWorld();
    this.buildSparksSystem();
    this.buildFireworksSystem();

    // GPU-only HDR UnrealBloomPass for tight neon highlights without milky white wash
    if (!this.isSoftwareGl) {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      this.composerRT = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
      });
      this.composer = new EffectComposer(this.renderer, this.composerRT);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.16, 0.16, 1.18);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
      this.renderer.compile(this.scene, this.camera);
    }

    // Bind Desktop & Mobile Input Events
    this.onResizeBound = this.handleResize.bind(this);
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    this.onKeyUpBound = this.handleKeyUp.bind(this);
    this.onMouseMoveBound = this.handleMouseMove.bind(this);
    this.onMouseDownBound = this.handleMouseDown.bind(this);
    this.onMouseUpBound = this.handleMouseUp.bind(this);
    this.onTouchStartBound = this.handleTouchStart.bind(this);
    this.onTouchMoveBound = this.handleTouchMove.bind(this);
    this.onTouchEndBound = this.handleTouchEnd.bind(this);
    this.onPointerLockChangeBound = this.handlePointerLockChange.bind(this);
    this.onBlurBound = () => {
      this.keys = {};
      this.shiftKeyDown = false;
      this.sprintToggle = false;
      this.isDraggingLook = false;
    };
    this.onContextLostBound = (e: Event) => e.preventDefault();

    window.addEventListener('resize', this.onResizeBound);
    window.addEventListener('orientationchange', this.onResizeBound);
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('mousemove', this.onMouseMoveBound);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDownBound);
    window.addEventListener('mouseup', this.onMouseUpBound);
    window.addEventListener('blur', this.onBlurBound);
    this.renderer.domElement.addEventListener('touchstart', this.onTouchStartBound, { passive: true });
    this.renderer.domElement.addEventListener('touchmove', this.onTouchMoveBound, { passive: false });
    this.renderer.domElement.addEventListener('touchend', this.onTouchEndBound, { passive: true });
    this.renderer.domElement.addEventListener('touchcancel', this.onTouchEndBound, { passive: true });
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
    this.hemiLight = new THREE.HemisphereLight('#bae6fd', '#1e1b4b', 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff3db', 1.08);
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

    // Crisp overhead architectural scientific lights across the expansive 68m x 62m lab
    const mainPositions: Array<[number, number, number, string]> = [
      [0, 11.8, 30, '#bae6fd'],
      [0, 11.8, 14, '#7dd3fc'],
      [0, 11.8, -2, '#bae6fd'],
      [0, 11.8, -15, '#bae6fd'],
      [-22, 11.8, 12, '#38bdf8'],
      [22, 11.8, 12, '#c4b5fd'],
      [-22, 11.8, -9, '#7dd3fc'],
      [22, 11.8, -9, '#a78bfa'],
    ];
    for (const [x, y, z, col] of mainPositions) {
      const pl = new THREE.PointLight(col, 30, 38, 1.3);
      pl.position.set(x, y, z);
      this.scene.add(pl);
      this.mainLights.push(pl);
    }

    // Rotating Red Emergency Security Beacons across all corners & wings (Ref #3 red/cyan contrast!)
    const emergencyPositions: Array<[number, number, number]> = [
      [-31.0, 11.4, -18.5],
      [31.0, 11.4, -18.5],
      [-31.0, 11.4, 15.0],
      [31.0, 11.4, 15.0],
      [-28.0, 11.4, 36.5],
      [28.0, 11.4, 36.5],
    ];
    const housingGeo = this.track(new THREE.CylinderGeometry(0.3, 0.36, 0.28, 10));
    const housingMat = this.track(new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.8, roughness: 0.3 }));
    const lensGeo = this.track(new THREE.CylinderGeometry(0.24, 0.24, 0.34, 10));
    const lensMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#ef4444',
        emissive: '#dc2626',
        emissiveIntensity: 2.1,
        roughness: 0.2,
      })
    );

    for (const [x, y, z] of emergencyPositions) {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      const housing = new THREE.Mesh(housingGeo, housingMat);
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.y = -0.24;
      group.add(housing, lens);
      this.scene.add(group);
      this.beaconRotors.push(group);

      const redLight = new THREE.PointLight('#dc2626', 0, 38, 1.3);
      redLight.position.set(x, y - 0.9, z);
      this.scene.add(redLight);
      this.emergencyLights.push(redLight);
    }
  }

  private buildGrandFacilityArchitecture() {
    // Expansive 68m wide x 62m deep x 13.5m high Multi-Wing Biotechnology Research Complex
    // X: -34..+34, Z: -21..+41 (center Z = +10)
    const labW = 68;
    const labD = 62;
    const labH = 13.5;
    const labCenterZ = 10;

    // High-gloss reflective dark-navy composite laboratory deck (Ref Image 1 specular sheen!)
    const floor = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(labW, labD)),
      this.track(
        new THREE.MeshPhysicalMaterial({
          map: this.textures.floor,
          roughness: 0.3,
          metalness: 0.42,
          clearcoat: 0.55,
          clearcoatRoughness: 0.24,
        })
      )
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = labCenterZ;
    floor.receiveShadow = !this.isSoftwareGl;
    this.scene.add(floor);

    // Dynamic floor guidance strips (Electric Blue/Cyan -> Red during breach/lockdown)
    this.floorGuideMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        emissive: '#0284c7',
        emissiveIntensity: 1.35,
        roughness: 0.18,
      })
    );
    const northGuide = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.36, 0.03, 56)), this.floorGuideMat);
    northGuide.position.set(0, 0.016, 10);
    this.scene.add(northGuide);

    for (const cz of [-6.5, 13.5, 25.0]) {
      const cross = new THREE.Mesh(this.track(new THREE.BoxGeometry(58, 0.03, 0.24)), this.floorGuideMat);
      cross.position.set(0, 0.016, cz);
      this.scene.add(cross);
    }

    // Architectural Ceiling & Structural Steel Trusses with Luminous LED Ribbons
    const ceilMat = this.track(new THREE.MeshStandardMaterial({ color: '#070e1c', roughness: 0.68, metalness: 0.4 }));
    const ceiling = new THREE.Mesh(this.track(new THREE.PlaneGeometry(labW, labD)), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, labH, labCenterZ);
    this.scene.add(ceiling);

    const trussMat = this.track(new THREE.MeshStandardMaterial({ color: '#111c33', metalness: 0.82, roughness: 0.3 }));
    this.ceilingLedMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        emissive: '#0284c7',
        emissiveIntensity: 1.45,
        roughness: 0.18,
      })
    );
    const beamGeo = this.track(new THREE.BoxGeometry(labW - 1, 0.52, 0.72));
    const ledGeo = this.track(new THREE.BoxGeometry(labW - 8, 0.12, 0.26));
    for (const z of [-15, -6, 3, 12, 21, 30, 38]) {
      const beam = new THREE.Mesh(beamGeo, trussMat);
      beam.position.set(0, labH - 0.34, z);
      this.scene.add(beam);
      const led = new THREE.Mesh(ledGeo, this.ceilingLedMat);
      led.position.set(0, labH - 0.64, z);
      this.scene.add(led);
    }

    // Perimeter Architectural Walls (X: ±34, North Z: -21, South Z: +41)
    const wallMat = this.track(
      new THREE.MeshStandardMaterial({
        map: this.textures.wall,
        roughness: 0.42,
        metalness: 0.4,
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

    // West & East outer walls split cleanly around Vault 01/02 (West) & Vault 04/05 (East) 3.8m x 4.25m doorways
    for (const wallX of [-34, 34]) {
      // North segment (Z: -21 to -9.4, len 11.6)
      addWall(0.8, labH, 11.6, wallX, labH / 2, -15.2);
      // Middle segment (Z: -5.6 to +8.6, len 14.2)
      addWall(0.8, labH, 14.2, wallX, labH / 2, 1.5);
      // South segment (Z: +12.4 to +41.0, len 28.6)
      addWall(0.8, labH, 28.6, wallX, labH / 2, 26.7);
      // Overhead lintels above the 4.25m vault doorways (no colliders)
      addWall(0.8, labH - 4.25, 3.8, wallX, 4.25 + (labH - 4.25) / 2, -7.5, false);
      addWall(0.8, labH - 4.25, 3.8, wallX, 4.25 + (labH - 4.25) / 2, 10.5, false);
    }

    // North wall split around Vault 03 doorway (X: -21.4..-17.6) & Grand Main Door gateway (X: -4..+4, Z = -21)
    addWall(12.6, labH, 0.85, -27.7, labH / 2, -21);
    addWall(13.6, labH, 0.85, -10.8, labH / 2, -21);
    addWall(3.8, labH - 4.25, 0.85, -19.5, 4.25 + (labH - 4.25) / 2, -21, false);
    addWall(30, labH, 0.85, 19, labH / 2, -21);
    addWall(8.4, labH - 6.2, 0.85, 0, 6.2 + (labH - 6.2) / 2, -21, false);

    // South wall split around the 6m Investigator Entry Airlock (x: -3..+3, z = +41)
    addWall(31, labH, 0.8, -18.5, labH / 2, 41);
    addWall(31, labH, 0.8, 18.5, labH / 2, 41);
    addWall(6.6, labH - 5.2, 0.8, 0, 5.2 + (labH - 5.2) / 2, 41, false);
    this.colliders.push({
      id: 'south-airlock-barrier',
      minX: -3.6,
      maxX: 3.6,
      minZ: 40.0,
      maxZ: 41.6,
      active: true,
    });

    // Grand Illuminated Structural Atrium Columns framing the central wings
    const pillarGeo = this.track(new THREE.BoxGeometry(0.88, labH, 0.88));
    const pillarMat = this.track(new THREE.MeshStandardMaterial({ color: '#17233b', metalness: 0.82, roughness: 0.25 }));
    const colAccentGeo = this.track(new THREE.BoxGeometry(0.14, labH - 1.5, 0.94));
    const colAccentMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 1.35, roughness: 0.18 })
    );
    for (const [px, pz] of [
      [-14.5, -13.5],
      [14.5, -13.5],
      [-14.5, 1.0],
      [14.5, 1.0],
      [-14.5, 16.0],
      [14.5, 16.0],
    ]) {
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(px, labH / 2, pz);
      const strip = new THREE.Mesh(colAccentGeo, colAccentMat);
      strip.position.set(px, labH / 2, pz);
      this.scene.add(p, strip);
      this.colliders.push({
        id: `pillar-${px}-${pz}`,
        minX: px - 0.72,
        maxX: px + 0.72,
        minZ: pz - 0.72,
        maxZ: pz + 0.72,
        active: true,
      });
    }

    // Security Surveillance Cameras
    const camBodyGeo = this.track(new THREE.BoxGeometry(0.34, 0.26, 0.64));
    const camLensGeo = this.track(new THREE.CylinderGeometry(0.095, 0.095, 0.18, 10));
    const redLedGeo = this.track(new THREE.SphereGeometry(0.05, 8, 8));
    const redLedMat = this.track(new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 2.2 }));

    for (const [cx, cz, baseYaw] of [
      [-28, -16, -Math.PI / 4],
      [28, -16, Math.PI / 4],
      [-28, 22, (-3 * Math.PI) / 4],
      [28, 22, (3 * Math.PI) / 4],
    ]) {
      const camGroup = new THREE.Group();
      camGroup.position.set(cx, 9.2, cz);
      camGroup.userData.baseYaw = baseYaw;
      const body = new THREE.Mesh(camBodyGeo, pillarMat);
      const lens = new THREE.Mesh(camLensGeo, trussMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.z = 0.36;
      const led = new THREE.Mesh(redLedGeo, redLedMat);
      led.position.set(0.1, 0.07, 0.32);
      camGroup.add(body, lens, led);
      camGroup.rotation.x = 0.38;
      this.scene.add(camGroup);
      this.securityCameras.push(camGroup);
    }
  }

  private buildCentralNexusCore() {
    const baseGroup = new THREE.Group();
    baseGroup.position.set(0, 0, 0.5);

    const metalDark = this.track(new THREE.MeshStandardMaterial({ color: '#111c33', metalness: 0.85, roughness: 0.24 }));
    const cyanAccent = this.track(
      new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        emissive: '#0284c7',
        emissiveIntensity: 1.85,
        roughness: 0.18,
      })
    );
    const purpleAccent = this.track(
      new THREE.MeshStandardMaterial({
        color: '#c084fc',
        emissive: '#9333ea',
        emissiveIntensity: 1.6,
        roughness: 0.18,
      })
    );

    const baseTier1 = new THREE.Mesh(this.track(new THREE.CylinderGeometry(2.6, 3.0, 0.42, 8)), metalDark);
    baseTier1.position.y = 0.21;
    const baseTier2 = new THREE.Mesh(this.track(new THREE.CylinderGeometry(1.65, 1.95, 0.86, 8)), metalDark);
    baseTier2.position.y = 0.82;
    const emitterRing = new THREE.Mesh(this.track(new THREE.TorusGeometry(1.52, 0.065, 12, 36)), cyanAccent);
    emitterRing.rotation.x = Math.PI / 2;
    emitterRing.position.y = 1.28;
    const outerRim = new THREE.Mesh(this.track(new THREE.TorusGeometry(2.75, 0.055, 10, 40)), cyanAccent);
    outerRim.rotation.x = Math.PI / 2;
    outerRim.position.y = 0.44;

    baseGroup.add(baseTier1, baseTier2, emitterRing, outerRim);
    this.scene.add(baseGroup);

    this.colliders.push({
      id: 'nexus-pedestal',
      minX: -2.8,
      maxX: 2.8,
      minZ: 0.5 - 2.8,
      maxZ: 0.5 + 2.8,
      maxY: 2.5,
      active: true,
    });

    this.nexusGroup = new THREE.Group();
    this.nexusGroup.position.set(0, 3.25, 0.5);

    const holoMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        emissive: '#0ea5e9',
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.86,
        wireframe: true,
      })
    );
    const solidCoreMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#e0f2fe',
        emissive: '#0284c7',
        emissiveIntensity: 2.2,
        transparent: true,
        opacity: 0.9,
        roughness: 0.1,
      })
    );

    this.nexusCoreMesh = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.6, 1)), solidCoreMat);
    this.nexusRingOuter = new THREE.Mesh(this.track(new THREE.TorusGeometry(1.26, 0.04, 10, 44)), holoMat);
    this.nexusRingInner = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.9, 0.032, 10, 36)), purpleAccent);
    this.nexusRingInner.rotation.x = Math.PI / 3;

    const coneMat = this.track(
      new THREE.MeshBasicMaterial({
        color: '#0ea5e9',
        transparent: true,
        opacity: 0.045,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    const cone = new THREE.Mesh(this.track(new THREE.ConeGeometry(1.28, 1.9, 24, 1, true)), coneMat);
    cone.position.y = -0.92;
    cone.rotation.x = Math.PI;

    this.nexusLight = new THREE.PointLight('#38bdf8', 0, 20, 1.45);
    this.nexusGroup.add(this.nexusCoreMesh, this.nexusRingOuter, this.nexusRingInner, cone, this.nexusLight);
    this.nexusGroup.scale.setScalar(0.001);
    this.scene.add(this.nexusGroup);

    this.interactables.push({
      id: 'nexus-core',
      kind: 'nexus',
      position: new THREE.Vector3(0, 2.0, 0.5),
      radius: 5.0,
      label: 'NEXUS AI Monitoring Core',
      sublabel: 'Press [E] for Investigation Briefing & Objective Guidance',
    });
  }

  private buildGrandMainDoorAndKeyPedestals() {
    const frameMat = this.track(new THREE.MeshStandardMaterial({ color: '#1b2842', metalness: 0.85, roughness: 0.26 }));
    const shutterMat = this.track(new THREE.MeshStandardMaterial({ color: '#243554', metalness: 0.78, roughness: 0.32 }));
    const accentTrim = this.track(
      new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 1.0, roughness: 0.22 })
    );

    const exitGroup = new THREE.Group();
    exitGroup.position.set(0, 0, -20.8);

    const leftPost = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.85, 6.5, 1.2)), frameMat);
    leftPost.position.set(-4.1, 3.25, 0);
    const rightPost = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.85, 6.5, 1.2)), frameMat);
    rightPost.position.set(4.1, 3.25, 0);
    const lintel = new THREE.Mesh(this.track(new THREE.BoxGeometry(9.2, 1.2, 1.3)), frameMat);
    lintel.position.set(0, 6.7, 0);

    const doorGeo = this.track(new THREE.BoxGeometry(3.75, 6.1, 0.36));
    this.exitShutterLeft = new THREE.Mesh(doorGeo, shutterMat);
    this.exitShutterLeft.position.set(-1.88, 3.05, 0);
    this.exitShutterRight = new THREE.Mesh(doorGeo, shutterMat);
    this.exitShutterRight.position.set(1.88, 3.05, 0);

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

    this.mainDoorCollider = {
      id: 'main-door-barrier',
      minX: -4.2,
      maxX: 4.2,
      minZ: -21.5,
      maxZ: -20.1,
      active: true,
    };
    this.colliders.push(this.mainDoorCollider);

    // 5 Physical Authentication Key Pedestals
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

      this.colliders.push({
        id: `key-ped-${i}`,
        minX: pedestalXs[i] - 0.5,
        maxX: pedestalXs[i] + 0.5,
        minZ: pedestalZs[i] - 0.5,
        maxZ: pedestalZs[i] + 0.5,
        active: true,
      });
    }

    const conduit = new THREE.Mesh(this.track(new THREE.BoxGeometry(9.6, 0.05, 0.16)), accentTrim);
    conduit.position.set(0, 0.03, -17.5);
    this.scene.add(conduit);

    this.interactables.push({
      id: 'main-exit-console',
      kind: 'exit',
      position: new THREE.Vector3(0, 1.5, -17.0),
      radius: 6.2,
      label: 'Grand Security Gate — Key Pedestals',
      sublabel: 'Place Verified Research Keys to Lift Lockdown',
    });
  }

  private buildLabWorkstations() {
    const deskMat = this.track(new THREE.MeshStandardMaterial({ color: '#16223b', metalness: 0.68, roughness: 0.32 }));
    const legMat = this.track(new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.82, roughness: 0.28 }));
    const trimMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 0.9, roughness: 0.2 })
    );
    const glassRackMat = this.track(
      new THREE.MeshPhysicalMaterial({ color: '#38bdf8', transparent: true, opacity: 0.55, roughness: 0.12 })
    );

    const benchCoords: Array<{ x: number; z: number; rotY: number }> = [
      { x: -8.5, z: 11.5, rotY: 0.35 },   // Desk #0: Culprit's Restricted Compound BQ-X9 Breach Terminal
      { x: 9.2, z: 11.5, rotY: -0.35 },   // Desk #1: Assay Data Analytics Workstation
      { x: -9.0, z: -7.5, rotY: 0.48 },   // Desk #2: Molecular Informatics Desk
      { x: 9.0, z: -7.5, rotY: -0.48 },   // Desk #3: XGBoost Model Validation Station
    ];

    const topGeo = this.track(new THREE.BoxGeometry(2.7, 0.12, 1.15));
    const trimGeo = this.track(new THREE.BoxGeometry(2.74, 0.04, 1.18));
    const legGeo = this.track(new THREE.BoxGeometry(0.14, 0.88, 0.92));
    const screenFrameGeo = this.track(new THREE.BoxGeometry(1.42, 0.86, 0.09));
    const screenFaceGeo = this.track(new THREE.PlaneGeometry(1.3, 0.76));
    const vialGeo = this.track(new THREE.CylinderGeometry(0.06, 0.06, 0.28, 8));

    for (let bIdx = 0; bIdx < benchCoords.length; bIdx++) {
      const b = benchCoords[bIdx];
      const group = new THREE.Group();
      group.position.set(b.x, 0, b.z);
      group.rotation.y = b.rotY;

      const top = new THREE.Mesh(topGeo, deskMat);
      top.position.y = 0.88;
      const trim = new THREE.Mesh(trimGeo, trimMat);
      trim.position.y = 0.94;
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-1.16, 0.44, 0);
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.position.set(1.16, 0.44, 0);

      const mMat = this.track(
        new THREE.MeshStandardMaterial({
          map: bIdx === 0 ? this.textures.drugRecordNormal : this.textures.monitorNormal,
          emissive: bIdx === 0 ? '#38bdf8' : '#06b6d4',
          emissiveMap: bIdx === 0 ? this.textures.drugRecordNormal : this.textures.monitorNormal,
          emissiveIntensity: bIdx === 0 ? 1.1 : 0.85,
          roughness: 0.2,
        })
      );
      if (bIdx === 0) {
        this.rogueMonitorMat = mMat;
      } else {
        this.workstationMonitorMats.push(mMat);
      }

      const frame = new THREE.Mesh(screenFrameGeo, legMat);
      frame.position.set(-0.24, 1.46, -0.2);
      const face = new THREE.Mesh(screenFaceGeo, mMat);
      face.position.set(-0.24, 1.46, -0.15);

      for (let v = 0; v < 3; v++) {
        const vial = new THREE.Mesh(vialGeo, glassRackMat);
        vial.position.set(0.76 + v * 0.18, 1.08, 0.05);
        group.add(vial);
      }

      // Culprit's Breach Terminal (#0): Floating purple/cyan Compound BQ-X9 molecular hologram
      if (bIdx === 0) {
        this.rogueDrugHologram = this.createMolecularHologram(2, '#c084fc');
        this.rogueDrugHologram.scale.setScalar(0.46);
        this.rogueDrugHologram.position.set(0.86, 1.52, -0.05);
        group.add(this.rogueDrugHologram);

        const deskLight = new THREE.PointLight('#7c3aed', 10, 9, 1.4);
        deskLight.position.set(0.3, 1.85, 0.45);
        group.add(deskLight);
      }

      group.add(top, trim, legL, legR, frame, face);
      this.scene.add(group);

      this.colliders.push({
        id: `bench-${b.x}-${b.z}`,
        minX: b.x - 1.5,
        maxX: b.x + 1.5,
        minZ: b.z - 0.95,
        maxZ: b.z + 0.95,
        active: true,
      });
    }
  }

  private createMolecularHologram(vaultId: VaultId, accentHex: string): THREE.Group {
    const group = new THREE.Group();
    const atomMat = this.track(
      new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: accentHex,
        emissiveIntensity: 1.45,
        roughness: 0.2,
        metalness: 0.3,
      })
    );
    const oxyMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#f43f5e',
        emissive: '#e11d48',
        emissiveIntensity: 1.35,
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

    const vaultConfigs: Array<{ id: VaultId; x: number; z: number; rotY: number }> = [
      { id: 1, x: -31.8, z: 10.5, rotY: Math.PI / 2 },
      { id: 2, x: -31.8, z: -7.5, rotY: Math.PI / 2 },
      { id: 3, x: -19.5, z: -18.8, rotY: 0 },
      { id: 4, x: 31.8, z: -7.5, rotY: -Math.PI / 2 },
      { id: 5, x: 31.8, z: 10.5, rotY: -Math.PI / 2 },
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
          emissiveIntensity: 0.75,
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

      const dGeo = this.track(new THREE.BoxGeometry(1.94, 4.18, 0.22));
      const seamGeo = this.track(new THREE.BoxGeometry(0.08, 3.88, 0.26));
      const braceGeo = this.track(new THREE.BoxGeometry(1.66, 0.22, 0.28));
      const boltGeo = this.track(new THREE.BoxGeometry(0.32, 0.14, 0.3));

      const buildVaultLeaf = (side: -1 | 1): THREE.Group => {
        const leaf = new THREE.Group();
        leaf.position.set(side * 0.97, 2.09, 0);
        const panel = new THREE.Mesh(dGeo, doorMat);
        const seam = new THREE.Mesh(seamGeo, beaconMat);
        seam.position.set(-side * 0.91, 0, 0);
        const braceTop = new THREE.Mesh(braceGeo, frameMat);
        braceTop.position.set(0, 1.12, 0);
        const braceBot = new THREE.Mesh(braceGeo, frameMat);
        braceBot.position.set(0, -1.12, 0);
        const bolt = new THREE.Mesh(boltGeo, frameMat);
        bolt.position.set(-side * 0.62, 0, 0.04);
        leaf.add(panel, seam, braceTop, braceBot, bolt);
        return leaf;
      };

      const doorLeft = buildVaultLeaf(-1);
      const doorRight = buildVaultLeaf(1);

      // Central mechanical locking wheel/seal that rotates & retracts directly when the vault unlocks
      const lockRing = new THREE.Group();
      lockRing.position.set(0, 2.09, 0.18);
      const lockOuter = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.46, 0.065, 10, 24)), frameMat);
      const lockGlow = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.34, 0.032, 8, 24)), beaconMat);
      const lockCross1 = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.82, 0.08, 0.09)), frameMat);
      const lockCross2 = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.08, 0.82, 0.09)), frameMat);
      lockRing.add(lockOuter, lockGlow, lockCross1, lockCross2);

      // Position Vault access kiosk neatly beside the doorway so the Investigator walks straight through into the chamber!
      const kiosk = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.88, 1.3, 0.56)), terminalMat);
      kiosk.position.set(2.25, 0.65, 1.35);
      const kioskScreenMat = this.track(
        new THREE.MeshStandardMaterial({
          map: this.textures.monitorNormal,
          color: '#fef3c7',
          emissive: '#f59e0b',
          emissiveMap: this.textures.monitorNormal,
          emissiveIntensity: 0.95,
          roughness: 0.2,
        })
      );
      const kioskScreen = new THREE.Mesh(this.track(new THREE.PlaneGeometry(0.72, 0.44)), kioskScreenMat);
      kioskScreen.position.set(2.25, 1.38, 1.42);
      kioskScreen.rotation.x = -0.55;

      const hologramGroup = this.createMolecularHologram(cfg.id, def.accentHex);
      hologramGroup.position.set(2.25, 2.55, 1.35);

      vGroup.add(
        pL,
        pR,
        header,
        sign,
        beaconMesh,
        beaconLight,
        doorLeft,
        doorRight,
        lockRing,
        kiosk,
        kioskScreen,
        hologramGroup
      );
      this.scene.add(vGroup);

      const termLocal = new THREE.Vector3(0, 1.4, 1.55);
      vGroup.updateMatrixWorld(true);
      const terminalPos = termLocal.applyMatrix4(vGroup.matrixWorld);

      // Tight doorway plane collider that automatically opens (active = false) as soon as the blast doors slide apart
      const isSideWall = Math.abs(Math.sin(cfg.rotY)) > 0.7;
      const collider: BoxCollider = {
        id: `vault-door-${cfg.id}`,
        minX: cfg.x - (isSideWall ? 0.55 : 1.95),
        maxX: cfg.x + (isSideWall ? 0.55 : 1.95),
        minZ: cfg.z - (isSideWall ? 1.95 : 0.55),
        maxZ: cfg.z + (isSideWall ? 1.95 : 0.55),
        active: true,
      };
      this.colliders.push(collider);

      this.vaultVisuals.set(cfg.id, {
        id: cfg.id,
        group: vGroup,
        rotY: cfg.rotY,
        doorLeft,
        doorRight,
        lockRing,
        beaconMat,
        beaconLight,
        kioskScreenMat,
        targetBeaconColor: new THREE.Color('#f59e0b'),
        targetScreenColor: new THREE.Color('#f59e0b'),
        hologramGroup,
        terminalPos,
        doorOpenAmount: 0,
        targetOpen: 0,
        lockRetract: 0,
        targetLockRetract: 0,
        collider,
      });

      this.interactables.push({
        id: `vault-terminal-${cfg.id}`,
        kind: 'vault',
        position: terminalPos,
        radius: 4.5,
        label: `${def.code} — ${def.title}`,
        sublabel: `${def.difficulty} · Press [E] to Open Vault Doors`,
        vaultId: cfg.id,
      });
    }
  }

  private buildRedesignedZones() {
    this.facilityZones = buildRedesignedFacilityZones(
      this.scene,
      this.textures,
      this.track.bind(this),
      !this.isSoftwareGl
    );
    for (const c of this.facilityZones.colliders) {
      this.colliders.push(c);
    }
    for (const ev of this.facilityZones.evidenceNodes) {
      this.interactables.push({
        id: ev.id,
        kind: 'evidence',
        entityId: ev.id,
        position: ev.position,
        radius: ev.radius,
        label: ev.label,
        sublabel: ev.sublabel,
      });
    }
  }

  private buildCharacters() {
    const enableShadows = !this.isSoftwareGl;

    // 1. Playable 3D Lead Scientific Investigator (Ref #5 sculpted hooded tactical jacket)
    this.playerCharacter = new ResearcherCharacter('investigator', enableShadows);
    this.playerCharacter.root.position.set(0, 0, 38.8);
    this.playerCharacter.root.rotation.y = Math.PI;
    this.playerCharacter.root.visible = false;
    this.scene.add(this.playerCharacter.root);

    // 2. Culprit Insider Researcher (Charcoal covert jacket, ash hair, crimson drive)
    this.rogueCharacter = new ResearcherCharacter('rogue', enableShadows);
    this.rogueCharacter.root.position.set(-8.15, 0, 12.42);
    this.rogueCharacter.root.rotation.y = Math.PI + 0.35;
    this.rogueCharacter.root.visible = true;
    this.scene.add(this.rogueCharacter.root);
  }

  private buildModernizedWorld() {
    this.futureCity = new FutureCitySystem(
      this.scene,
      this.textures,
      this.renderer.capabilities.getMaxAnisotropy(),
      this.isSoftwareGl
    );

    this.interactables.push({
      id: 'modern-world-monument',
      kind: 'monument',
      position: new THREE.Vector3(0, 2.0, -45.5),
      radius: 6.5,
      label: 'Modern World Celebration Monument',
      sublabel: 'Press [E] to View Mission Completion & Reward',
    });
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
        size: 0.22,
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
    let slot = this.fwSlots.find((s) => !s.active);
    if (!slot) slot = this.fwSlots.reduce((a, b) => (a.age > b.age ? a : b));

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
    if (this.activeInteriorVault !== null) {
      const ch = this.vaultChambers.chambers.get(this.activeInteriorVault);
      if (ch) {
        for (let i = 0; i < burstCount; i++) {
          this.pendingFireworkQueue.push({
            delay: i * 0.36,
            x: ch.centerWorld.x + (Math.random() - 0.5) * 6.5,
            y: 4.9 + Math.random() * 1.1,
            z: ch.centerWorld.z + (Math.random() - 0.5) * 6.5,
            scale: 0.62,
          });
        }
        return;
      }
    }
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
    this.closeAllVaultDoors(true);
    this.activeInteriorVault = null;
    this.callbacks.onVaultInteriorChange?.(null);
    this.cinematicElapsed = 0;
    this.cinematicRunning = true;
    this.lastCinematicScene = 1;
    this.nexusActivation = 0;
    this.outdoorBlend = 0;
    this.releasePointerLock();
    this.setMonitorsAlert(false);
    this.setRogueMonitorMode('record');
    this.exitShutterLeft.position.x = -3.4;
    this.exitShutterRight.position.x = 3.4;
    this.facilityZones.entryAirlockLeft.position.x = -1.38;
    this.facilityZones.entryAirlockRight.position.x = 1.38;
    this.playerCharacter.root.visible = false;
    this.playerCharacter.root.position.set(0, 0, 38.8);
    this.playerCharacter.root.rotation.set(0, Math.PI, 0);
    this.rogueCharacter.root.visible = true;
    this.rogueCharacter.root.position.set(-8.15, 0, 12.42);
    this.rogueCharacter.root.rotation.set(0, Math.PI + 0.35, 0);
  }

  public pauseCinematic() {
    this.cinematicRunning = false;
  }

  public resumeCinematic() {
    this.cinematicRunning = true;
  }

  public jumpToTitleScene() {
    this.phase = 'title';
    this.closeAllVaultDoors(true);
    this.activeInteriorVault = null;
    this.callbacks.onVaultInteriorChange?.(null);
    this.cinematicRunning = false;
    this.cinematicElapsed = 34.5;
    this.nexusActivation = 1;
    this.outdoorBlend = 0;
    this.nexusGroup.scale.setScalar(1);
    this.nexusLight.intensity = 14;
    this.exitShutterLeft.position.x = -1.88;
    this.exitShutterRight.position.x = 1.88;
    this.facilityZones.entryAirlockLeft.position.x = -1.38;
    this.facilityZones.entryAirlockRight.position.x = 1.38;
    this.setMonitorsAlert(true);
    this.setRogueMonitorMode('breach');
    this.rogueCharacter.root.visible = false;
    this.playerCharacter.root.visible = true;
    this.playerCharacter.root.position.set(0, 0, 24.5);
    this.playerCharacter.root.rotation.set(0, Math.PI, 0);
    this.releasePointerLock();
  }

  public enterGameplay(
    completedVaults: VaultId[],
    placedKeys: VaultId[],
    collectedEvidence: string[],
    mainDoorOpen: boolean,
    facilityRestored: boolean,
    preserveCameraFromIntro = false
  ) {
    this.phase = 'gameplay';
    this.cinematicRunning = false;
    this.paused = false;
    this.closeAllVaultDoors(true);
    this.activeInteriorVault = null;
    this.callbacks.onVaultInteriorChange?.(null);

    if (this.futureCity.isDriving()) {
      this.futureCity.toggleVehicle(undefined, this.playerPos);
      this.callbacks.onVehicleHudChange?.({ active: false, name: '', kind: 'car', speedKmh: 0, boosting: false });
    }
    this.keys = {};
    this.shiftKeyDown = false;
    this.sprintToggle = false;
    this.virtualMoveX = 0;
    this.virtualMoveZ = 0;
    this.virtualRun = false;

    this.nexusActivation = 1;
    this.nexusGroup.scale.setScalar(1);
    this.nexusLight.intensity = 14;
    this.facilityZones.entryAirlockLeft.position.x = -1.38;
    this.facilityZones.entryAirlockRight.position.x = 1.38;
    this.mainDoorTargetOpen = false;
    this.mainDoorOpenAmount = 0;
    this.exitShutterLeft.position.x = -1.88;
    this.exitShutterRight.position.x = 1.88;

    // Hide culprit; show playable 3D Human Investigator!
    this.rogueCharacter.root.visible = false;
    this.playerCharacter.root.visible = true;

    this.playerPos.set(0, 0, 24.5);
    this.playerVel.set(0, 0, 0);
    this.playerVerticalVel = 0;
    this.isGrounded = true;
    this.coyoteTimer = 0.14;
    this.jumpBufferTimer = 0;
    this.characterYaw = Math.PI;
    this.prevCharacterYaw = Math.PI;
    this.yaw = 0;
    this.pitch = 0.22;
    this.outdoorBlend = 0;
    this.modernWorldEnteredNotified = false;

    this.playerCharacter.root.position.copy(this.playerPos);
    this.playerCharacter.root.rotation.set(0, this.characterYaw, 0);

    if (!preserveCameraFromIntro) {
      this.smoothCamPos.set(0.36, 3.05, 28.5);
      this.smoothCamLook.set(0.36, 1.56, 24.5);
      this.camera.position.copy(this.smoothCamPos);
      this.camera.lookAt(this.smoothCamLook);
    } else {
      this.smoothCamPos.copy(this.camera.position);
      this.smoothCamLook.set(0.36, 1.56, 24.5);
    }

    this.syncProgress(completedVaults, placedKeys, collectedEvidence, mainDoorOpen, facilityRestored);
  }

  public syncProgress(
    completedVaults: VaultId[],
    placedKeys: VaultId[],
    collectedEvidence: string[],
    mainDoorOpen: boolean,
    facilityRestored: boolean
  ) {
    this.completedVaults = new Set(completedVaults);
    this.placedKeys = new Set(placedKeys);
    this.collectedEvidence = new Set(collectedEvidence);
    this.mainDoorOpen = mainDoorOpen;
    this.facilityRestored = facilityRestored;

    this.mainDoorCollider.active = !mainDoorOpen;
    const highestUnlocked = Math.min(5, completedVaults.length + 1) as VaultId;

    for (const [id, vis] of this.vaultVisuals.entries()) {
      const isCompleted = this.completedVaults.has(id);
      const isAvailable = id <= highestUnlocked;
      // Locked vaults always stay sealed; unlocked vaults stay closed until player opens the door directly!
      if (!isAvailable) {
        vis.targetOpen = 0;
        vis.targetLockRetract = 0;
      }

      if (isCompleted) {
        // Secure Cyan upon successful completion
        vis.targetBeaconColor.set('#22d3ee');
        vis.targetScreenColor.set('#06b6d4');
        vis.kioskScreenMat.color.set('#cffafe');
        vis.beaconLight.intensity = 7.5;
      } else if (isAvailable) {
        // Warning Amber while terminal awaits verification
        vis.targetBeaconColor.set('#f59e0b');
        vis.targetScreenColor.set('#f59e0b');
        vis.kioskScreenMat.color.set('#fef3c7');
        vis.beaconLight.intensity = 7.2;
      } else {
        // Locked warning amber-red
        vis.targetBeaconColor.set('#d97706');
        vis.targetScreenColor.set('#b45309');
        vis.kioskScreenMat.color.set('#fde68a');
        vis.beaconLight.intensity = 4.4;
      }
    }

    this.vaultChambers?.syncCompleted(this.completedVaults);

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
        mat.color.set('#0284c7');
        mat.emissive.set('#38bdf8');
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

    this.setMonitorsAlert(!(mainDoorOpen || facilityRestored));
    this.setRogueMonitorMode(mainDoorOpen || facilityRestored ? 'record' : 'breach');
  }

  public setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) {
      this.keys = {};
      this.shiftKeyDown = false;
      this.sprintToggle = false;
      this.virtualMoveX = 0;
      this.virtualMoveZ = 0;
      this.jumpBufferTimer = 0;
      this.lookTouchId = null;
      this.isDraggingLook = false;
      this.releasePointerLock();
    }
  }

  public setVirtualMove(x: number, z: number) {
    this.virtualMoveX = THREE.MathUtils.clamp(x, -1, 1);
    this.virtualMoveZ = THREE.MathUtils.clamp(z, -1, 1);
  }

  public setVirtualRun(running: boolean) {
    this.virtualRun = running;
  }

  public triggerJump() {
    if (this.phase !== 'gameplay' || this.paused) return;
    if (this.futureCity.isDriving()) return;
    // Buffer jump input for 140ms so presses just before landing or leaving a ledge always fire crisply
    this.jumpBufferTimer = 0.14;
    const floorY =
      this.activeInteriorVault !== null
        ? 0
        : this.playerPos.z < -21.0
          ? this.futureCity.getGroundHeightAt(this.playerPos.x, this.playerPos.z, this.playerPos.y)
          : this.facilityZones.getElevationAt(this.playerPos.x, this.playerPos.z, this.playerPos.y);
    if (this.isGrounded || this.coyoteTimer > 0 || Math.abs(this.playerPos.y - floorY) < 0.25) {
      this.playerVerticalVel = 7.8;
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
    }
  }

  public triggerInteractGesture() {
    this.interactPulse = 1.0;
  }

  public handleCityInteract(target: InteractableTarget): boolean {
    if (target.kind === 'vehicle') {
      const res = this.futureCity.toggleVehicle(target.entityId, this.playerPos);
      if (res.entered) {
        this.callbacks.onCityActionFeedback?.(
          `Entered ${res.vehicleName}! W/S Drive · A/D Steer · SHIFT Turbo Boost · SPACE Drift · E/F Exit.`
        );
        this.callbacks.onVehicleHudChange?.(this.futureCity.getVehicleHudState(false));
      } else if (res.exited && res.exitPos) {
        this.playerPos.copy(res.exitPos);
        this.playerPos.y = this.futureCity.getGroundHeightAt(this.playerPos.x, this.playerPos.z, 0.5);
        this.playerVel.set(0, 0, 0);
        this.playerVerticalVel = 0;
        this.isGrounded = true;
        this.playerCharacter.root.visible = true;
        this.playerCharacter.root.rotation.z = 0;
        this.callbacks.onVehicleHudChange?.({ active: false, name: '', kind: 'car', speedKmh: 0, boosting: false });
        this.callbacks.onCityActionFeedback?.(`Exited ${res.vehicleName}.`);
      }
      return true;
    }

    if (target.kind === 'lift' && target.entityId) {
      this.triggerInteractGesture();
      const msg = this.futureCity.interactLift(target.entityId, this.playerPos);
      if (msg) this.callbacks.onCityActionFeedback?.(msg);
      return true;
    }

    if (target.kind === 'tv' && target.entityId) {
      this.triggerInteractGesture();
      const msg = this.futureCity.interactTv(target.entityId);
      if (msg) this.callbacks.onCityActionFeedback?.(msg);
      return true;
    }

    return false;
  }

  public applyLookDelta(dx: number, dy: number) {
    if (this.phase !== 'gameplay' || this.paused) return;
    const sensitivity = 0.0044;
    this.yaw -= dx * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * sensitivity, -0.22, 1.02);
  }

  public requestPointerLock() {
    if (this.phase !== 'gameplay' || this.paused) return;
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // drag-look fallback always works
    }
  }

  public releasePointerLock() {
    try {
      if (document.pointerLockElement) document.exitPointerLock?.();
    } catch {
      // ignore
    }
  }

  private closeAllVaultDoors(instant = false) {
    for (const vis of this.vaultVisuals.values()) {
      vis.targetOpen = 0;
      vis.targetLockRetract = 0;
      if (instant) {
        vis.doorOpenAmount = 0;
        vis.lockRetract = 0;
        vis.collider.active = true;
      }
    }
  }

  public isVaultDoorOpen(vaultId: VaultId): boolean {
    const vis = this.vaultVisuals.get(vaultId);
    return Boolean(vis && vis.targetOpen >= 0.5);
  }

  public openVaultDoorDirectly(vaultId: VaultId): boolean {
    const vis = this.vaultVisuals.get(vaultId);
    if (!vis) return false;
    if (vis.targetOpen >= 0.5) return false;

    // Spin & retract the mechanical lock wheel, spark at the seam, and slide both heavy blast doors wide open directly!
    vis.targetLockRetract = 1;
    vis.targetOpen = 1;

    vis.group.updateMatrixWorld(true);
    _transSpark.set(0, 2.1, 0.25);
    vis.group.localToWorld(_transSpark);
    this.spawnSparkBurst(_transSpark.x, _transSpark.y, _transSpark.z);
    this.cameraShake = 0.042;
    this.currentHover = null;
    this.callbacks.onHoverTargetChange(null);
    return true;
  }

  public exitVaultInterior() {
    if (this.activeInteriorVault === null) return;
    const prevVault = this.activeInteriorVault;
    const vis = this.vaultVisuals.get(prevVault);
    const ch = this.vaultChambers.chambers.get(prevVault);
    if (vis) {
      vis.targetLockRetract = 1;
      vis.targetOpen = 1;
      vis.collider.active = false;
    }

    this.activeInteriorVault = null;
    this.callbacks.onVaultInteriorChange?.(null);

    if (ch && vis) {
      this.playerPos.copy(ch.exitSpotWorld);
      this.playerVel.set(0, 0, 0);
      this.playerVerticalVel = 0;
      this.isGrounded = true;
      this.coyoteTimer = 0.14;
      this.jumpBufferTimer = 0;
      this.yaw = vis.rotY + Math.PI;
      this.characterYaw = vis.rotY;
      this.prevCharacterYaw = vis.rotY;
      this.pitch = 0.2;
      this.playerCharacter.root.visible = true;
      this.playerCharacter.root.position.copy(this.playerPos);
      this.playerCharacter.root.rotation.set(0, this.characterYaw, 0);

      const backX = Math.sin(this.yaw) * 3.8;
      const backZ = Math.cos(this.yaw) * 3.8;
      this.smoothCamPos.set(this.playerPos.x + backX, 2.9, this.playerPos.z + backZ);
      this.smoothCamLook.set(this.playerPos.x, 1.56, this.playerPos.z);
      this.camera.position.copy(this.smoothCamPos);
      this.camera.lookAt(this.smoothCamLook);
    }

    this.currentHover = null;
    this.callbacks.onHoverTargetChange(null);
  }

  public teleportNearVault(vaultId: VaultId, openDoor = false) {
    if (this.activeInteriorVault !== null) {
      this.activeInteriorVault = null;
      this.callbacks.onVaultInteriorChange?.(null);
    }
    if (this.futureCity.isDriving()) {
      this.futureCity.toggleVehicle(undefined, this.playerPos);
      this.callbacks.onVehicleHudChange?.({ active: false, name: '', kind: 'car', speedKmh: 0, boosting: false });
    }
    const vis = this.vaultVisuals.get(vaultId);
    if (!vis) return;
    const targetMap: Record<VaultId, [number, number]> = {
      1: [-26.8, 10.5],
      2: [-26.8, -7.5],
      3: [-19.5, -14.5],
      4: [26.8, -7.5],
      5: [26.8, 10.5],
    };
    const [tx, tz] = targetMap[vaultId];
    this.playerPos.set(tx, 0, tz);
    this.playerVel.set(0, 0, 0);
    this.playerVerticalVel = 0;
    this.isGrounded = true;
    const dx = vis.terminalPos.x - tx;
    const dz = vis.terminalPos.z - tz;
    this.yaw = Math.atan2(-dx, -dz);
    this.characterYaw = Math.atan2(dx, dz);
    this.prevCharacterYaw = this.characterYaw;
    this.pitch = 0.2;
    this.playerCharacter.root.visible = true;
    if (openDoor) {
      vis.targetLockRetract = 1;
      vis.targetOpen = 1;
    }
  }

  public teleportToMainDoor() {
    if (this.activeInteriorVault !== null) {
      this.activeInteriorVault = null;
      this.callbacks.onVaultInteriorChange?.(null);
    }
    if (this.futureCity.isDriving()) {
      this.futureCity.toggleVehicle(undefined, this.playerPos);
      this.callbacks.onVehicleHudChange?.({ active: false, name: '', kind: 'car', speedKmh: 0, boosting: false });
    }
    this.playerPos.set(0, 0, -13.2);
    this.playerVel.set(0, 0, 0);
    this.playerVerticalVel = 0;
    this.isGrounded = true;
    this.yaw = 0;
    this.characterYaw = Math.PI;
    this.pitch = 0.2;
    this.playerCharacter.root.visible = true;
  }

  public teleportToFutureCity() {
    this.closeAllVaultDoors(true);
    if (this.activeInteriorVault !== null) {
      this.activeInteriorVault = null;
      this.callbacks.onVaultInteriorChange?.(null);
    }
    if (this.futureCity.isDriving()) {
      this.futureCity.toggleVehicle(undefined, this.playerPos);
      this.callbacks.onVehicleHudChange?.({ active: false, name: '', kind: 'car', speedKmh: 0, boosting: false });
    }
    this.playerPos.set(0, 0, -29.5);
    this.playerVel.set(0, 0, 0);
    this.playerVerticalVel = 0;
    this.isGrounded = true;
    this.yaw = 0;
    this.characterYaw = Math.PI;
    this.pitch = 0.22;
    this.outdoorBlend = 1;
    this.playerCharacter.root.visible = true;
    this.smoothCamPos.set(0.4, 3.2, -25.2);
    this.smoothCamLook.set(0, 1.5, -29.5);
  }

  private setRogueMonitorMode(mode: 'record' | 'transfer' | 'breach') {
    if (!this.rogueMonitorMat) return;
    if (mode === 'record') {
      this.rogueMonitorMat.map = this.textures.drugRecordNormal;
      this.rogueMonitorMat.emissive.set('#38bdf8');
    } else if (mode === 'transfer') {
      this.rogueMonitorMat.map = this.textures.drugTransferAttempt;
      this.rogueMonitorMat.emissive.set('#f59e0b');
    } else {
      this.rogueMonitorMat.map = this.textures.securityBreachAlert;
      this.rogueMonitorMat.emissive.set('#ef4444');
    }
    this.rogueMonitorMat.emissiveMap = this.rogueMonitorMat.map;
    this.rogueMonitorMat.needsUpdate = true;
  }

  private setMonitorsAlert(alertActive: boolean) {
    for (const mat of this.workstationMonitorMats) {
      mat.map = alertActive ? this.textures.monitorAlert : this.textures.monitorNormal;
      mat.emissiveMap = mat.map;
      mat.emissive.set(alertActive ? '#ef4444' : '#38bdf8');
      mat.needsUpdate = true;
    }
  }

  // =========================================================================
  // INPUT HANDLERS
  // =========================================================================

  private handleResize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const aspect = w / Math.max(1, h);
    this.baseFov = aspect < 0.85 ? 74 : 64;
    this.camera.fov = this.baseFov;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setSize(w, h);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(w, h);
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (this.phase !== 'gameplay' || this.paused) return;
    if (e.code) {
      this.keys[e.code] = true;
    }

    const isShiftKey = e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight';
    if (isShiftKey) {
      if (!this.shiftKeyDown) {
        this.shiftPressTime = performance.now();
      }
      this.shiftKeyDown = true;
    } else if (e.shiftKey) {
      this.shiftKeyDown = true;
    }

    if (e.code === 'Space' && !this.futureCity.isDriving()) {
      e.preventDefault();
      this.triggerJump();
      return;
    }

    if ((e.code === 'KeyE' || e.code === 'KeyF') && this.futureCity.isDriving()) {
      e.preventDefault();
      this.handleCityInteract({
        id: 'exit-vehicle',
        kind: 'vehicle',
        label: 'Exit Vehicle',
        sublabel: '',
      });
      return;
    }

    if ((e.code === 'KeyE' || e.code === 'KeyF') && this.currentHover) {
      if (e.code === 'KeyF' && this.currentHover.kind !== 'vehicle') return;
      e.preventDefault();
      this.triggerInteractGesture();
      this.callbacks.onInteract(this.currentHover);
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    if (e.code) {
      this.keys[e.code] = false;
    }
    const isShiftKey = e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight';
    if (isShiftKey) {
      const holdMs = performance.now() - this.shiftPressTime;
      this.shiftKeyDown = false;
      // Support both holding Shift AND tapping Shift (<280ms) to toggle sprint on/off
      if (holdMs < 280) {
        this.sprintToggle = !this.sprintToggle;
      } else {
        this.sprintToggle = false;
      }
    } else if (!e.shiftKey) {
      this.shiftKeyDown = false;
    }
  }

  private handleMouseDown(e: MouseEvent) {
    if (this.phase !== 'gameplay' || this.paused) return;
    this.isDraggingLook = true;
    this.lastDragX = e.clientX;
    this.lastDragY = e.clientY;
    if (!this.pointerLocked) {
      this.requestPointerLock();
    }
  }

  private handleMouseUp() {
    this.isDraggingLook = false;
  }

  private handleMouseMove(e: MouseEvent) {
    if (this.phase !== 'gameplay' || this.paused) return;
    this.shiftKeyDown = e.shiftKey || Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const sensitivity = 0.0025;
    if (this.pointerLocked) {
      this.yaw -= e.movementX * sensitivity;
      this.pitch = THREE.MathUtils.clamp(this.pitch + e.movementY * sensitivity, -0.22, 1.02);
    } else if (this.isDraggingLook) {
      const dx = e.clientX - this.lastDragX;
      const dy = e.clientY - this.lastDragY;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
      this.yaw -= dx * sensitivity * 1.45;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * sensitivity * 1.45, -0.22, 1.02);
    }
  }

  private handleTouchStart(e: TouchEvent) {
    if (this.phase !== 'gameplay' || this.paused) return;
    if (this.lookTouchId !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    this.lookTouchId = touch.identifier;
    this.lastTouchX = touch.clientX;
    this.lastTouchY = touch.clientY;
  }

  private handleTouchMove(e: TouchEvent) {
    if (this.phase !== 'gameplay' || this.paused) return;
    if (this.lookTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.lookTouchId) {
        e.preventDefault();
        const dx = touch.clientX - this.lastTouchX;
        const dy = touch.clientY - this.lastTouchY;
        this.lastTouchX = touch.clientX;
        this.lastTouchY = touch.clientY;
        this.applyLookDelta(dx, dy);
        break;
      }
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    if (this.lookTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.lookTouchId) {
        this.lookTouchId = null;
        break;
      }
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
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
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
    this.updateSparks(dt);
    this.updateFireworks(dt);

    if (this.bloomPass) {
      // Crisp, tight neon accents indoors and near-zero bloom outdoors in bright Future City
      const targetBloom = THREE.MathUtils.lerp(0.16, 0.05, this.outdoorBlend);
      this.bloomPass.strength = THREE.MathUtils.damp(this.bloomPass.strength, targetBloom, 5, dt);
    }

    if (this.composer && !this.isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

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

  // =========================================================================
  // 4-SCENE ANIMATED 3D STORY CINEMATIC (34s -> Seamless Third-Person Handover!)
  // =========================================================================
  private updateCinematic(dt: number, elapsedSec: number) {
    if (this.cinematicRunning) {
      this.cinematicElapsed += dt;
    }
    const t = this.cinematicElapsed;

    let sceneId: CinematicSceneId = 1;
    if (t < 9.0) sceneId = 1;        // Scene 1: Secret Research Activity & Unauthorized Transfer Attempt
    else if (t < 16.5) sceneId = 2;  // Scene 2: Security Detection (NEXUS intercepts, red emergency lights)
    else if (t < 24.5) sceneId = 3;  // Scene 3: Emergency Lockdown (Doors close, NEXUS announces containment)
    else if (t < 34.0) sceneId = 4;  // Scene 4: Player Introduction (NEW Investigator enters & camera moves behind!)
    else sceneId = 5;

    // One-time scene transition triggers
    if (sceneId === 1 && t >= 4.4 && this.rogueMonitorMat.map !== this.textures.drugTransferAttempt) {
      this.setRogueMonitorMode('transfer');
    }
    if (sceneId !== this.lastCinematicScene) {
      if (sceneId === 2) {
        this.setRogueMonitorMode('breach');
        this.setMonitorsAlert(true);
        this.spawnSparkBurst(-8.5, 2.1, 11.5);
      } else if (sceneId === 3) {
        this.rogueCharacter.root.visible = false;
        this.spawnSparkBurst(0, 4.6, -19.5);
      } else if (sceneId === 4) {
        // Culprit is locked out; introduce our NEW Investigator character at South Airlock!
        this.rogueCharacter.root.visible = false;
        this.playerCharacter.root.visible = true;
        this.playerCharacter.root.position.set(0, 0, 38.8);
        this.playerCharacter.root.rotation.set(0, Math.PI, 0);
      }
      this.lastCinematicScene = sceneId;
    }

    if (this.rogueDrugHologram) {
      this.rogueDrugHologram.rotation.y += dt * (sceneId === 1 ? 1.8 : 0.8);
    }

    if (sceneId === 1) {
      // SCENE 1 (0–9s): Sweeps across Holographic Molecular Ring into Culprit at Compound BQ-X9 terminal
      this.scene.background = _bgLab;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.copy(_bgLab);
        this.scene.fog.density = 0.0028;
      }
      this.scene.environmentIntensity = 0.46;
      this.hemiLight.intensity = 0.88;
      this.sunLight.intensity = 0.95;
      this.ceilingLedMat.color.copy(t >= 4.4 ? _purpleColor : _cyanColor);
      this.ceilingLedMat.emissive.copy(t >= 4.4 ? _purpleEmissive : _cyanEmissive);
      this.ceilingLedMat.emissiveIntensity = 1.4;
      this.floorGuideMat.color.copy(_cyanColor);
      this.floorGuideMat.emissive.copy(_cyanEmissive);
      this.floorGuideMat.emissiveIntensity = 1.3;

      this.rogueCharacter.root.visible = true;
      this.playerCharacter.root.visible = false;
      this.rogueCharacter.update(dt, {
        speed: 0,
        isRunning: false,
        isGrounded: true,
        verticalVelocity: 0,
        turnRate: 0,
        interactPulse: t >= 4.4 ? Math.sin(t * 2.8) * 0.4 + 0.4 : 0,
        isTypingCinematic: true,
        isShockedCinematic: false,
        elapsedSec,
      });

      const p = THREE.MathUtils.smoothstep(t / 9.0, 0, 1);
      this.camera.position.set(
        THREE.MathUtils.lerp(2.2, -6.5, p),
        THREE.MathUtils.lerp(4.4, 1.85, p),
        THREE.MathUtils.lerp(21.5, 13.4, p)
      );
      _lookTarget.set(
        THREE.MathUtils.lerp(-4.5, -8.5, p),
        THREE.MathUtils.lerp(2.2, 1.48, p),
        THREE.MathUtils.lerp(13.0, 11.4, p)
      );
      this.camera.lookAt(_lookTarget);

      this.mainLights.forEach((l) => (l.intensity = 30));
      this.emergencyLights.forEach((l) => (l.intensity = 0));
    } else if (sceneId === 2) {
      // SCENE 2 (9–16.5s): NEXUS Security Detection — Dramatic RED emergency lights flash, cameras lock on, culprit recoils!
      const p = Math.min(1, (t - 9.0) / 7.5);
      this.scene.background = _bgAlert;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.copy(_bgAlert);
        this.scene.fog.density = 0.0036;
      }
      this.ceilingLedMat.color.copy(_redColor);
      this.ceilingLedMat.emissive.copy(_redEmissive);
      this.ceilingLedMat.emissiveIntensity = 1.65;
      this.floorGuideMat.color.copy(_redColor);
      this.floorGuideMat.emissive.copy(_redEmissive);
      this.floorGuideMat.emissiveIntensity = 1.5;

      this.rogueCharacter.root.visible = true;
      this.rogueCharacter.root.position.set(
        THREE.MathUtils.lerp(-8.15, -7.2, Math.min(1, p * 1.5)),
        0,
        THREE.MathUtils.lerp(12.42, 13.5, Math.min(1, p * 1.5))
      );
      this.rogueCharacter.update(dt, {
        speed: 0,
        isRunning: false,
        isGrounded: true,
        verticalVelocity: 0,
        turnRate: 0,
        interactPulse: 0,
        isTypingCinematic: false,
        isShockedCinematic: true,
        elapsedSec,
      });

      this.mainLights.forEach((l) => (l.intensity = THREE.MathUtils.lerp(l.intensity, 18, dt * 4)));
      const pulse = 22 + Math.sin(elapsedSec * 8.5) * 10.0;
      this.emergencyLights.forEach((l) => (l.intensity = pulse));

      const shake = Math.sin(t * 34) * 0.032;
      this.camera.position.set(
        THREE.MathUtils.lerp(-6.5, -4.4, p) + shake,
        THREE.MathUtils.lerp(1.85, 2.55, p),
        THREE.MathUtils.lerp(13.4, 15.6, p)
      );
      _lookTarget.set(
        THREE.MathUtils.lerp(-8.5, -7.6, p),
        THREE.MathUtils.lerp(1.5, 1.55, p),
        THREE.MathUtils.lerp(11.4, 12.6, p)
      );
      this.camera.lookAt(_lookTarget);
    } else if (sceneId === 3) {
      // SCENE 3 (16.5–24.5s): Emergency Lockdown — Heavy blast doors slam shut; NEXUS Core activates under giant hexagonal halo!
      const p = Math.min(1, (t - 16.5) / 8.0);
      this.scene.background = _bgAlert;
      this.ceilingLedMat.color.copy(_redColor);
      this.ceilingLedMat.emissive.copy(_redEmissive);
      this.floorGuideMat.color.copy(_redColor);
      this.floorGuideMat.emissive.copy(_redEmissive);

      const slamP = Math.min(1, p * 2.2);
      this.exitShutterLeft.position.x = THREE.MathUtils.lerp(-3.4, -1.88, slamP);
      this.exitShutterRight.position.x = THREE.MathUtils.lerp(3.4, 1.88, slamP);

      this.nexusActivation = Math.min(1, (t - 17.0) / 1.8);
      const scale = Math.max(0.001, THREE.MathUtils.smoothstep(this.nexusActivation, 0, 1));
      this.nexusGroup.scale.setScalar(scale);
      this.nexusLight.intensity = scale * 18;

      this.mainLights.forEach((l) => (l.intensity = 22));
      this.emergencyLights.forEach((l) => (l.intensity = 16 + Math.sin(elapsedSec * 4.5) * 6.5));

      if (p < 0.45) {
        const sub = p / 0.45;
        this.camera.position.set(THREE.MathUtils.lerp(4.2, 1.0, sub), 3.6, THREE.MathUtils.lerp(-6.0, -10.8, sub));
        _lookTarget.set(0, 3.3, -20.5);
      } else {
        const sub = (p - 0.45) / 0.55;
        const ang = THREE.MathUtils.lerp(-0.7, 0.5, sub);
        this.camera.position.set(Math.sin(ang) * 7.8, 3.8, 0.5 + Math.cos(ang) * 7.8);
        _lookTarget.set(0, 3.1, 0.5);
      }
      this.camera.lookAt(_lookTarget);
    } else if (sceneId === 4) {
      // SCENE 4 (24.5–34.0s): NEW INVESTIGATOR ENTERS through South Airlock -> strides past Turbine Hall -> camera glides behind!
      const p = Math.min(1, (t - 24.5) / 9.5);
      this.scene.background = _bgLab;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.copy(_bgLab);
        this.scene.fog.density = 0.0026;
      }

      this.ceilingLedMat.color.copy(_cyanColor);
      this.ceilingLedMat.emissive.copy(_cyanEmissive);
      this.ceilingLedMat.emissiveIntensity = 1.4;
      this.floorGuideMat.color.copy(_cyanColor);
      this.floorGuideMat.emissive.copy(_cyanEmissive);
      this.floorGuideMat.emissiveIntensity = 1.3;

      this.mainLights.forEach((l) => (l.intensity = 30));
      this.emergencyLights.forEach((l) => (l.intensity = 11 + Math.sin(elapsedSec * 3.0) * 4.5));
      this.nexusActivation = 1;
      this.nexusGroup.scale.setScalar(1);
      this.nexusLight.intensity = 15;

      // Slide South Investigator Airlock open as Investigator enters, then close behind them
      const airlockOpen = p < 0.45 ? Math.min(1, p * 4.5) : Math.max(0, 1 - (p - 0.45) * 3.0);
      this.facilityZones.entryAirlockLeft.position.x = -1.38 - airlockOpen * 2.4;
      this.facilityZones.entryAirlockRight.position.x = 1.38 + airlockOpen * 2.4;

      // Animate the Lead Investigator physically striding from z = 38.8 to z = 24.5!
      const walkProgress = THREE.MathUtils.smoothstep(Math.min(1, p / 0.7), 0, 1);
      const nextZ = THREE.MathUtils.lerp(38.8, 24.5, walkProgress);
      const walkSpeed = p < 0.68 ? 2.5 : 0;

      this.playerCharacter.root.visible = true;
      this.playerCharacter.root.position.set(0, 0, nextZ);
      this.playerCharacter.root.rotation.set(0, Math.PI, 0);
      this.playerCharacter.update(dt, {
        speed: walkSpeed,
        isRunning: false,
        isGrounded: true,
        verticalVelocity: 0,
        turnRate: 0,
        interactPulse: 0,
        isTypingCinematic: false,
        isShockedCinematic: false,
        elapsedSec,
      });

      // Dramatic front-quarter reveal (p < 0.55) -> smooth sweep behind Investigator's shoulder facing the Holographic Ring & Lab!
      if (p < 0.55) {
        const sub = THREE.MathUtils.smoothstep(p / 0.55, 0, 1);
        this.camera.position.set(
          THREE.MathUtils.lerp(-2.8, 2.4, sub),
          THREE.MathUtils.lerp(1.5, 2.25, sub),
          THREE.MathUtils.lerp(31.5, 23.0, sub)
        );
        _lookTarget.set(0, 1.4, nextZ);
      } else {
        const sub = THREE.MathUtils.smoothstep((p - 0.55) / 0.45, 0, 1);
        this.camera.position.set(
          THREE.MathUtils.lerp(2.4, 0.36, sub),
          THREE.MathUtils.lerp(2.25, 3.05, sub),
          THREE.MathUtils.lerp(23.0, 28.5, sub)
        );
        _lookTarget.set(
          THREE.MathUtils.lerp(0, 0.36, sub),
          THREE.MathUtils.lerp(1.4, 1.56, sub),
          THREE.MathUtils.lerp(nextZ, 24.5, sub)
        );
      }
      this.camera.lookAt(_lookTarget);
    } else {
      // Seamless handoff straight to playable Third-Person Gameplay!
      this.cinematicRunning = false;
      this.callbacks.onCinematicComplete();
      return;
    }

    this.callbacks.onCinematicTimeUpdate(t, sceneId);
  }

  private updateTitleBackdrop(dt: number, elapsedSec: number) {
    this.scene.background = _bgLab;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(_bgLab);
      this.scene.fog.density = 0.0026;
    }
    this.scene.environmentIntensity = 0.46;
    this.hemiLight.intensity = 0.88;
    this.sunLight.intensity = 1.0;
    this.ceilingLedMat.color.copy(_cyanColor);
    this.ceilingLedMat.emissive.copy(_cyanEmissive);
    this.floorGuideMat.color.copy(_cyanColor);
    this.floorGuideMat.emissive.copy(_cyanEmissive);

    this.playerCharacter.root.visible = true;
    this.playerCharacter.update(dt, {
      speed: 0,
      isRunning: false,
      isGrounded: true,
      verticalVelocity: 0,
      turnRate: 0,
      interactPulse: 0,
      isTypingCinematic: false,
      isShockedCinematic: false,
      elapsedSec,
    });

    const angle = Math.sin(elapsedSec * 0.22) * 0.45;
    this.camera.position.set(Math.sin(angle) * 5.8, 2.75, 24.5 + Math.cos(angle) * 4.8);
    _lookTarget.set(0, 1.55, 22.0);
    this.camera.lookAt(_lookTarget);

    this.mainLights.forEach((l) => (l.intensity = 30));
    this.emergencyLights.forEach((l) => (l.intensity = 11 + Math.sin(elapsedSec * 3.1) * 4.5));
  }

  private updateGameplay(dt: number, elapsedSec: number) {
    const insideChamber = this.activeInteriorVault !== null;
    const isOutside = !insideChamber && this.playerPos.z < -21.2;
    const isLockdown = !this.mainDoorOpen && !this.facilityRestored;
    const targetBlend = isOutside ? 1 : 0;
    this.outdoorBlend = THREE.MathUtils.damp(this.outdoorBlend, targetBlend, 2.8, dt);

    _bgCurrent.copy(_bgLab).lerp(_bgModern, this.outdoorBlend);
    this.scene.background = _bgCurrent;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(_bgCurrent);
      this.scene.fog.density = THREE.MathUtils.lerp(0.0028, 0.0014, this.outdoorBlend);
    }

    this.scene.environmentIntensity = THREE.MathUtils.lerp(0.46, 0.78, this.outdoorBlend);
    this.hemiLight.color.copy(_hemiSkyLab).lerp(_hemiSkyModern, this.outdoorBlend);
    this.hemiLight.groundColor.copy(_hemiGndLab).lerp(_hemiGndModern, this.outdoorBlend);
    this.hemiLight.intensity = THREE.MathUtils.lerp(0.88, 1.4, this.outdoorBlend);
    this.sunLight.intensity = THREE.MathUtils.lerp(1.05, 2.2, this.outdoorBlend);

    // Signature Biotech Thriller Palette: Dark Navy + Electric Blue + Cyan + Purple + Red Emergency Accents
    if (isLockdown) {
      this.ceilingLedMat.color.copy(_purpleColor);
      this.ceilingLedMat.emissive.copy(_purpleEmissive);
      this.ceilingLedMat.emissiveIntensity = 0.95;
      this.floorGuideMat.color.copy(_cyanColor);
      this.floorGuideMat.emissive.copy(_cyanEmissive);
      this.floorGuideMat.emissiveIntensity = 0.9 + Math.sin(elapsedSec * 2.5) * 0.14;
    } else {
      this.ceilingLedMat.color.copy(_cyanColor);
      this.ceilingLedMat.emissive.copy(_cyanEmissive);
      this.ceilingLedMat.emissiveIntensity = 1.05;
      this.floorGuideMat.color.copy(_cyanColor);
      this.floorGuideMat.emissive.copy(_cyanEmissive);
      this.floorGuideMat.emissiveIntensity = 1.0;
    }

    const targetMain = isLockdown ? 25 : 29;
    this.mainLights.forEach((l) => {
      l.intensity = THREE.MathUtils.damp(l.intensity, targetMain, 6, dt);
    });
    this.emergencyLights.forEach((l, idx) => {
      const phasePulse = isLockdown ? 11.5 + Math.sin(elapsedSec * 3.6 + idx * 1.5) * 5.0 : 0;
      l.intensity = THREE.MathUtils.damp(l.intensity, phasePulse, 6, dt);
    });

    // Animate Grand Main Door shutters via movement-driven proximity sensor
    const gateRate = this.mainDoorTargetOpen ? 4.8 : 3.4;
    this.mainDoorOpenAmount = THREE.MathUtils.damp(
      this.mainDoorOpenAmount,
      this.mainDoorOpen && this.mainDoorTargetOpen ? 1 : 0,
      gateRate,
      dt
    );
    const gateSlideX = THREE.MathUtils.lerp(1.88, 5.2, this.mainDoorOpenAmount);
    this.exitShutterLeft.position.x = -gateSlideX;
    this.exitShutterRight.position.x = gateSlideX;
    this.mainDoorCollider.active = !this.mainDoorOpen || this.mainDoorOpenAmount < 0.35;

    // Periodic celebratory fireworks once Main Door is open
    if (this.mainDoorOpen) {
      this.autoFireworkCooldown -= dt;
      if (this.autoFireworkCooldown <= 0) {
        this.autoFireworkCooldown = 2.0 + Math.random() * 1.6;
        if (this.playerPos.z < -18) {
          this.spawnFireworkAt(
            this.playerPos.x + (Math.random() - 0.5) * 48,
            22 + Math.random() * 14,
            this.playerPos.z - 25 - Math.random() * 35,
            1.75
          );
        } else {
          this.spawnFireworkAt(
            (Math.random() - 0.5) * 22,
            7.2 + Math.random() * 2.2,
            (Math.random() - 0.5) * 20,
            0.85
          );
        }
      }
    }

    this.interactPulse = Math.max(0, this.interactPulse - dt * 1.8);

    // =========================================================================
    // THIRD-PERSON INVESTIGATOR CONTROLLER & GTA VEHICLE DRIVING
    // =========================================================================
    if (!this.paused) {
      const kbZ =
        Number(!!(this.keys['KeyW'] || this.keys['ArrowUp'])) -
        Number(!!(this.keys['KeyS'] || this.keys['ArrowDown']));
      const kbX =
        Number(!!(this.keys['KeyD'] || this.keys['ArrowRight'])) -
        Number(!!(this.keys['KeyA'] || this.keys['ArrowLeft']));
      const moveZ = THREE.MathUtils.clamp(kbZ + this.virtualMoveZ, -1, 1);
      const moveX = THREE.MathUtils.clamp(kbX + this.virtualMoveX, -1, 1);
      const isShiftHeld = Boolean(
        this.shiftKeyDown ||
          this.sprintToggle ||
          this.keys['ShiftLeft'] ||
          this.keys['ShiftRight'] ||
          this.virtualRun
      );
      const isSpaceHeld = Boolean(this.keys['Space']);

      if (this.futureCity.isDriving()) {
        const vState = this.futureCity.updateVehicleDriving(dt, moveZ, moveX, isShiftHeld, isSpaceHeld);
        const activeVeh = this.futureCity.getActiveVehicle();
        if (vState && activeVeh) {
          this.playerPos.set(vState.x, vState.y, vState.z);
          if (activeVeh.kind === 'bike') {
            this.playerCharacter.root.visible = true;
            this.playerCharacter.root.position.set(vState.x, 0.36, vState.z);
            this.playerCharacter.root.rotation.set(0.18, vState.yaw + Math.PI, vState.leanAngle);
            this.playerCharacter.update(dt, {
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
          } else {
            this.playerCharacter.root.visible = false;
          }

          let yawDiff = vState.yaw - this.yaw;
          while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
          while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
          if (Math.abs(vState.speed) > 1.2) {
            this.yaw += yawDiff * Math.min(1, dt * 2.6);
          }

          const chaseDist = activeVeh.kind === 'bike' ? 5.6 : 7.6;
          const chasePitch = THREE.MathUtils.clamp(this.pitch, 0.08, 0.75);
          _camPivot.set(vState.x, 1.8, vState.z);
          _camDesired.set(
            _camPivot.x + Math.sin(this.yaw) * Math.cos(chasePitch) * chaseDist,
            _camPivot.y + Math.sin(chasePitch) * chaseDist + 0.65,
            _camPivot.z + Math.cos(this.yaw) * Math.cos(chasePitch) * chaseDist
          );
          this.smoothCamPos.lerp(_camDesired, 1 - Math.exp(-9 * dt));
          this.smoothCamLook.lerp(_camPivot, 1 - Math.exp(-12 * dt));
          this.camera.position.copy(this.smoothCamPos);
          this.camera.lookAt(this.smoothCamLook);

          const targetFov = this.baseFov + THREE.MathUtils.clamp(Math.abs(vState.speed) * 0.42, 0, 15);
          if (Math.abs(this.camera.fov - targetFov) > 0.1) {
            this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
            this.camera.updateProjectionMatrix();
          }

          this.vehicleHudAccum += dt;
          if (this.vehicleHudAccum >= 0.08) {
            this.vehicleHudAccum = 0;
            this.callbacks.onVehicleHudChange?.(this.futureCity.getVehicleHudState(isShiftHeld && Math.abs(vState.speed) > 2));
          }
        }
      } else {
        // ON-FOOT THIRD-PERSON INVESTIGATOR CONTROLLER
        this.playerCharacter.root.visible = true;

        const liftCarryDelta = this.futureCity.getLiftVerticalCarryDelta(this.playerPos);
        if (Math.abs(liftCarryDelta) > 0.0001) {
          this.playerPos.y += liftCarryDelta;
        }

        _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

        _move.set(0, 0, 0);
        _move.addScaledVector(_forward, moveZ);
        _move.addScaledVector(_right, moveX);
        const mag = Math.min(1, _move.length());

        const walkSpeed = isOutside ? 5.2 : 4.6;
        const runSpeed = isOutside ? 12.2 : 10.6;
        const isActivelySprinting = isShiftHeld && mag > 0.05;
        const targetSpeed = (isShiftHeld ? runSpeed : walkSpeed) * mag;

        // Dynamic sprint camera FOV surge for immediate, unmistakable speed feel
        const onFootFov = this.baseFov + (isActivelySprinting ? 7.5 : 0);
        if (Math.abs(this.camera.fov - onFootFov) > 0.08) {
          this.camera.fov = THREE.MathUtils.damp(this.camera.fov, onFootFov, 7, dt);
          this.camera.updateProjectionMatrix();
        }

        if (mag > 0.02) {
          _move.normalize().multiplyScalar(targetSpeed);
        }

        this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, _move.x, 12, dt);
        this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, _move.z, 12, dt);

        const nextX = this.playerPos.x + this.playerVel.x * dt;
        if (!this.collidesAt(nextX, this.playerPos.z, this.playerPos.y)) {
          this.playerPos.x = nextX;
        }
        const nextZ = this.playerPos.z + this.playerVel.z * dt;
        if (!this.collidesAt(this.playerPos.x, nextZ, this.playerPos.y)) {
          this.playerPos.z = nextZ;
        }

        // Seamless live detection when walking directly through any open Vault blast door!
        const detectedVault = this.vaultChambers.detectInteriorVault(this.playerPos.x, this.playerPos.z);
        if (detectedVault !== this.activeInteriorVault) {
          this.activeInteriorVault = detectedVault;
          this.callbacks.onVaultInteriorChange?.(detectedVault);
        }

        const inVaultNow = this.activeInteriorVault !== null;
        if (!inVaultNow) {
          if (this.playerPos.z < -21.0) {
            this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x, -132, 132);
            this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z, -232, 40);
          } else {
            // Allow walking past ±32.8 / -20.2 ONLY when passing through an open Vault doorway
            const inOpenDoorway = this.isPointInAnyOpenVault(this.playerPos.x, 1.0, this.playerPos.z, 0.05);
            if (!inOpenDoorway) {
              this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x, -33.1, 33.1);
              this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z, this.mainDoorOpen ? -232 : -20.4, 39.4);
            }
          }
        }

        const floorY = inVaultNow
          ? 0
          : this.playerPos.z < -21.0
            ? this.futureCity.getGroundHeightAt(this.playerPos.x, this.playerPos.z, this.playerPos.y)
            : this.facilityZones.getElevationAt(this.playerPos.x, this.playerPos.z, this.playerPos.y);
        if (!this.isGrounded || this.playerPos.y > floorY + 0.08) {
          this.playerVerticalVel -= 22.0 * dt;
          this.playerPos.y += this.playerVerticalVel * dt;
          if (this.playerPos.y <= floorY) {
            if (this.playerVerticalVel < -4.0) {
              this.cameraShake = Math.min(0.14, Math.abs(this.playerVerticalVel) * 0.012);
            }
            this.playerPos.y = floorY;
            this.playerVerticalVel = 0;
            this.isGrounded = true;
            this.coyoteTimer = 0.14;
          } else {
            this.isGrounded = false;
            this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
          }
        } else {
          this.playerPos.y = THREE.MathUtils.damp(this.playerPos.y, floorY, 22, dt);
          this.playerVerticalVel = 0;
          this.isGrounded = true;
          this.coyoteTimer = 0.14;
        }

        if (this.jumpBufferTimer > 0) {
          this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
          if (this.coyoteTimer > 0) {
            this.playerVerticalVel = 7.8;
            this.isGrounded = false;
            this.coyoteTimer = 0;
            this.jumpBufferTimer = 0;
          }
        }

        if (this.cameraShake > 0.001) {
          this.cameraShake = THREE.MathUtils.damp(this.cameraShake, 0, 14, dt);
        } else {
          this.cameraShake = 0;
        }

        const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
        if (horizSpeed > 0.25) {
          const desiredCharYaw = Math.atan2(this.playerVel.x, this.playerVel.z);
          let diff = desiredCharYaw - this.characterYaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          this.characterYaw += diff * (1 - Math.exp(-12 * dt));
        }
        let dCharYaw = this.characterYaw - this.prevCharacterYaw;
        while (dCharYaw > Math.PI) dCharYaw -= Math.PI * 2;
        while (dCharYaw < -Math.PI) dCharYaw += Math.PI * 2;
        const turnRate = dCharYaw / Math.max(0.001, dt);
        this.prevCharacterYaw = this.characterYaw;

        this.playerCharacter.root.position.copy(this.playerPos);
        this.playerCharacter.root.rotation.set(0, this.characterYaw, 0);
        this.playerCharacter.update(dt, {
          speed: horizSpeed,
          isRunning: isShiftHeld && horizSpeed > 1.8,
          isGrounded: this.isGrounded,
          verticalVelocity: this.playerVerticalVel,
          turnRate,
          interactPulse: this.interactPulse,
          isTypingCinematic: false,
          isShockedCinematic: false,
          elapsedSec,
        });

        // Third-Person Behind-the-Investigator Follow Camera with Wall/Object Collision Avoidance
        const shoulderRightX = Math.cos(this.yaw) * 0.34;
        const shoulderRightZ = -Math.sin(this.yaw) * 0.34;
        const shakeY = this.cameraShake > 0 ? Math.sin(elapsedSec * 52) * this.cameraShake : 0;
        _camPivot.set(
          this.playerPos.x + shoulderRightX,
          this.playerPos.y + 1.56 + shakeY,
          this.playerPos.z + shoulderRightZ
        );

        const desiredDist = isOutside ? 4.4 : 3.85;
        const cosP = Math.cos(this.pitch);
        const sinP = Math.sin(this.pitch);
        _camDesired.set(
          _camPivot.x + Math.sin(this.yaw) * cosP * desiredDist,
          _camPivot.y + sinP * desiredDist,
          _camPivot.z + Math.cos(this.yaw) * cosP * desiredDist
        );

        // Collision-safe 8-step ray march bridging seamlessly between Main Lab & attached 3D Vault Chambers
        let safeFraction = 1.0;
        const playerInsideLab = this.activeInteriorVault === null && this.playerPos.z >= -21.0;
        for (let step = 1; step <= 8; step++) {
          const f = step / 8;
          _camSample.lerpVectors(_camPivot, _camDesired, f);
          const hitFloor = _camSample.y < this.playerPos.y + 0.35;
          const sampleInVault = this.isPointInAnyOpenVault(_camSample.x, _camSample.y, _camSample.z, 0.35);
          const hitCeil = sampleInVault ? false : playerInsideLab && _camSample.y > 12.6;
          const hitLabBounds =
            !sampleInVault &&
            playerInsideLab &&
            (_camSample.x < -33.2 ||
              _camSample.x > 33.2 ||
              _camSample.z > 39.8 ||
              (!this.mainDoorOpen && _camSample.z < -20.3));
          const hitSolid = this.collidesAt(_camSample.x, _camSample.z, _camSample.y, 0.28);
          if (hitFloor || hitCeil || hitLabBounds || hitSolid) {
            safeFraction = Math.max(0.24, (step - 1) / 8);
            break;
          }
        }
        _camDesired.lerpVectors(_camPivot, _camDesired, safeFraction);
        _camDesired.y = Math.max(this.playerPos.y + 0.42, _camDesired.y);

        this.smoothCamPos.lerp(_camDesired, 1 - Math.exp(-14 * dt));
        this.smoothCamLook.lerp(_camPivot, 1 - Math.exp(-16 * dt));
        this.camera.position.copy(this.smoothCamPos);
        this.camera.lookAt(this.smoothCamLook);
      }

      const nowInsideChamber = this.activeInteriorVault !== null;
      if (!nowInsideChamber && this.mainDoorOpen && this.playerPos.z < -23.5 && !this.modernWorldEnteredNotified) {
        this.modernWorldEnteredNotified = true;
        this.callbacks.onEnterModernWorld?.();
      }

      // Movement-driven automatic open & close sensors for all 5 Research Vaults and the Grand Main Gate
      this.updateProximityDoors();

      this.updateHoverInteractable();

      this.mapUpdateAccum += dt;
      if (this.mapUpdateAccum > 0.12 && this.callbacks.onPlayerPositionUpdate) {
        this.mapUpdateAccum = 0;
        if (!nowInsideChamber) {
          this.callbacks.onPlayerPositionUpdate(this.playerPos.x, this.playerPos.z, this.yaw);
        }
      }
    }
  }

  private updateProximityDoors() {
    const highestUnlocked = Math.min(5, this.completedVaults.size + 1);
    const isOutsideInCity = this.activeInteriorVault === null && this.playerPos.z < -22.0;

    // 1. All 5 Research Vault Blast Doors: automatically open as player approaches from either side,
    // and automatically close behind the player once they move away from the threshold.
    for (const [id, vis] of this.vaultVisuals.entries()) {
      if (id > highestUnlocked) {
        if (vis.targetOpen > 0 || vis.targetLockRetract > 0) {
          vis.targetOpen = 0;
          vis.targetLockRetract = 0;
        }
        continue;
      }

      const dx = this.playerPos.x - vis.group.position.x;
      const dz = this.playerPos.z - vis.group.position.z;
      const cosR = Math.cos(vis.rotY);
      const sinR = Math.sin(vis.rotY);
      const lx = dx * cosR - dz * sinR;
      const lz = dx * sinR + dz * cosR;

      if (vis.targetOpen < 0.5) {
        // Generous open sensor on both Lab side (+lz) and Vault Interior side (-lz)
        const shouldOpen = !isOutsideInCity && Math.abs(lx) < 3.4 && lz > -5.2 && lz < 5.6;
        if (shouldOpen) {
          vis.targetOpen = 1;
          vis.targetLockRetract = 1;
          vis.group.updateMatrixWorld(true);
          _transSpark.set(0, 2.1, 0.25);
          vis.group.localToWorld(_transSpark);
          this.spawnSparkBurst(_transSpark.x, _transSpark.y, _transSpark.z);
          this.cameraShake = Math.max(this.cameraShake, 0.022);
          this.callbacks.onAutoDoorToggle?.('open', id);
        }
      } else {
        // Clean hysteresis so doors never chatter while standing near the threshold
        const shouldClose = isOutsideInCity || Math.abs(lx) > 4.4 || lz < -6.6 || lz > 6.8;
        if (shouldClose) {
          vis.targetOpen = 0;
          vis.targetLockRetract = 0;
          this.callbacks.onAutoDoorToggle?.('close', id);
        }
      }
    }

    // 2. Grand Main North Gate (once unlocked by all 5 keys): auto-opens on approach from Lab or Future City
    if (this.mainDoorOpen) {
      if (!this.mainDoorTargetOpen) {
        const nearGate =
          this.activeInteriorVault === null &&
          Math.abs(this.playerPos.x) < 7.2 &&
          this.playerPos.z > -30.5 &&
          this.playerPos.z < -11.0;
        if (nearGate) {
          this.mainDoorTargetOpen = true;
          this.callbacks.onAutoDoorToggle?.('open', 'main-gate');
        }
      } else {
        const farFromGate =
          this.activeInteriorVault !== null ||
          Math.abs(this.playerPos.x) > 8.8 ||
          this.playerPos.z < -33.0 ||
          this.playerPos.z > -8.8;
        if (farFromGate) {
          this.mainDoorTargetOpen = false;
          this.callbacks.onAutoDoorToggle?.('close', 'main-gate');
        }
      }
    } else {
      this.mainDoorTargetOpen = false;
    }
  }

  private isPointInAnyOpenVault(x: number, y: number, z: number, margin = 0.35): boolean {
    for (const [id, vis] of this.vaultVisuals.entries()) {
      if (vis.doorOpenAmount <= 0.05 && this.activeInteriorVault !== id) continue;
      if (this.vaultChambers.isPointInsideVaultZone(id, x, y, z, margin)) {
        return true;
      }
    }
    return false;
  }

  private collidesAt(x: number, z: number, y = 0.5, r = 0.45): boolean {
    const insideVaultId = this.vaultChambers.detectInteriorVault(x, z);
    if (insideVaultId !== null) {
      return this.vaultChambers.collidesInChamber(insideVaultId, x, z, r);
    }
    if (this.activeInteriorVault === null && z < -21.0) {
      return this.futureCity.collidesAt(x, z, y, r);
    }
    for (const box of this.colliders) {
      if (!box.active) continue;
      if (box.minY !== undefined && y + 1.6 < box.minY) continue;
      if (box.maxY !== undefined && y > box.maxY) continue;
      if (x + r > box.minX && x - r < box.maxX && z + r > box.minZ && z - r < box.maxZ) {
        return true;
      }
    }
    return false;
  }

  private updateHoverInteractable() {
    this.camera.getWorldDirection(_camDir);

    // 0. Check Interactive Research Stations & Exit Door when inside a 3D Vault Chamber
    if (this.activeInteriorVault !== null) {
      const ch = this.vaultChambers.chambers.get(this.activeInteriorVault);
      let bestStation: InteractableTarget | null = null;
      if (ch) {
        let bestScore = -Infinity;
        const playerChestY = this.playerPos.y + 1.3;
        for (const node of ch.interactables) {
          _toNode.set(
            node.position.x - this.playerPos.x,
            node.position.y - playerChestY,
            node.position.z - this.playerPos.z
          );
          const dist = _toNode.length();
          if (dist > node.radius + 0.5) continue;
          _toNode.divideScalar(dist || 1);
          const align = _camDir.dot(_toNode);
          if (dist > 3.2 && align < 0.25) continue;
          const score = align * 1.8 - dist * 0.35;
          if (score > bestScore) {
            bestScore = score;
            const vaultCompleted = this.completedVaults.has(node.vaultId);
            bestStation = {
              id: node.id,
              kind: node.kind,
              vaultId: node.vaultId,
              stationTab: node.stationTab,
              label: node.label,
              sublabel:
                node.stationTab === 'challenges' && vaultCompleted
                  ? 'Chamber Secured · Press [E] to Replay Challenges or Review Key'
                  : node.sublabel,
            };
          }
        }
      }
      if (bestStation?.id !== this.currentHover?.id || bestStation?.sublabel !== this.currentHover?.sublabel) {
        this.currentHover = bestStation;
        this.callbacks.onHoverTargetChange(bestStation);
      }
      return;
    }

    // 1. Check GTA Future City interactables (Vehicles, Working Lifts, Working TVs)
    const cityTargets = this.futureCity.getNearbyInteractables(this.playerPos);
    if (cityTargets.length > 0) {
      const topCity = cityTargets[0];
      if (topCity.id !== this.currentHover?.id || topCity.sublabel !== this.currentHover?.sublabel) {
        this.currentHover = topCity;
        this.callbacks.onHoverTargetChange(topCity);
      }
      return;
    }

    // 2. Check Lab Workstations, Evidence Terminals, NEXUS Core, Main Gate & Monument
    let bestNode: InteractableNode | null = null;
    let bestScore = -Infinity;
    const playerChestY = this.playerPos.y + 1.3;

    const highestUnlocked = Math.min(5, this.completedVaults.size + 1);

    for (const node of this.interactables) {
      // Unlocked Vault doors open & close automatically via movement proximity — only prompt for locked vaults!
      if (node.kind === 'vault' && node.vaultId && node.vaultId <= highestUnlocked) {
        continue;
      }
      _toNode.set(
        node.position.x - this.playerPos.x,
        node.position.y - playerChestY,
        node.position.z - this.playerPos.z
      );
      const dist = _toNode.length();
      if (dist > node.radius + 0.6) continue;
      _toNode.divideScalar(dist || 1);
      const align = _camDir.dot(_toNode);
      if (dist > 3.6 && align < 0.35) continue;
      const score = align * 1.8 - dist * 0.32;
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    const unplacedKeysCount = Array.from(this.completedVaults).filter((k) => !this.placedKeys.has(k)).length;

    const nextHover: InteractableTarget | null = bestNode
      ? {
          id: bestNode.id,
          kind: bestNode.kind,
          entityId: bestNode.entityId,
          label: bestNode.label,
          sublabel:
            bestNode.kind === 'vault' && bestNode.vaultId
              ? bestNode.vaultId > highestUnlocked
                ? `Locked · Complete Vault 0${bestNode.vaultId - 1} First`
                : this.completedVaults.has(bestNode.vaultId)
                  ? 'Chamber Secured · Press [E] to Open Vault Doors'
                  : 'Vault Unlocked · Press [E] to Open Vault Doors'
              : bestNode.kind === 'evidence' && bestNode.entityId
                ? this.collectedEvidence.has(bestNode.entityId)
                  ? 'Evidence Logged · Press [E] to Review Analysis'
                  : bestNode.sublabel
                : bestNode.kind === 'exit'
                  ? this.mainDoorOpen
                    ? 'Main Gate Open · Walk Straight Ahead to the Future City!'
                    : unplacedKeysCount > 0
                      ? `Press [E] to Place ${unplacedKeysCount} Carried Key${unplacedKeysCount > 1 ? 's' : ''} (${this.placedKeys.size}/5 Placed)`
                      : this.placedKeys.size >= 5
                        ? 'All 5 Keys Placed · Press [E] to Open Main Gate!'
                        : `Keys Placed: ${this.placedKeys.size}/5 · Verify Research Vaults First`
                  : bestNode.sublabel,
          vaultId: bestNode.vaultId,
          locked:
            bestNode.kind === 'vault' && bestNode.vaultId
              ? bestNode.vaultId > highestUnlocked
              : bestNode.kind === 'exit'
                ? !this.mainDoorOpen && unplacedKeysCount === 0 && this.placedKeys.size < 5
                : false,
        }
      : null;

    if (nextHover?.id !== this.currentHover?.id || nextHover?.sublabel !== this.currentHover?.sublabel) {
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
      this.nexusGroup.position.y = 3.05 + Math.sin(elapsedSec * 1.8) * 0.1;
    }

    for (let i = 0; i < this.placedKeyHolograms.length; i++) {
      const kh = this.placedKeyHolograms[i];
      if (kh.visible) {
        kh.rotation.y += dt * 1.8;
        kh.position.y = 1.68 + Math.sin(elapsedSec * 2.5 + i) * 0.06;
      }
    }

    this.visibleVaultsSet.clear();
    for (const vis of this.vaultVisuals.values()) {
      vis.hologramGroup.rotation.y += dt * 0.85;
      vis.hologramGroup.position.y = 2.55 + Math.sin(elapsedSec * 2.0 + vis.id) * 0.08;

      // Mechanical lock wheel spins & retracts cleanly before blast doors part
      vis.lockRetract = THREE.MathUtils.damp(vis.lockRetract, vis.targetLockRetract, 8.0, dt);
      vis.lockRing.rotation.z = vis.lockRetract * Math.PI * 1.25;
      const lockScale = Math.max(0.01, 1 - vis.lockRetract * 0.99);
      vis.lockRing.scale.setScalar(lockScale);
      vis.lockRing.visible = vis.lockRetract < 0.96;

      // Heavy blast doors slide smoothly apart directly revealing the real attached 3D Vault Chamber!
      const doorRate = vis.targetOpen > vis.doorOpenAmount ? 5.8 : 4.2;
      vis.doorOpenAmount = THREE.MathUtils.damp(vis.doorOpenAmount, vis.targetOpen, doorRate, dt);
      const slideOffset = vis.doorOpenAmount * 1.62;
      vis.doorLeft.position.x = -0.97 - slideOffset;
      vis.doorRight.position.x = 0.97 + slideOffset;
      vis.collider.active = vis.doorOpenAmount < 0.35;

      if (vis.doorOpenAmount > 0.01 || this.activeInteriorVault === vis.id) {
        this.visibleVaultsSet.add(vis.id);
      }

      // Smoothly transition 3D vault terminal screen & beacon from warning amber -> secure cyan
      const lerpAlpha = 1 - Math.exp(-3.6 * dt);
      vis.beaconMat.color.lerp(vis.targetBeaconColor, lerpAlpha);
      vis.beaconMat.emissive.lerp(vis.targetBeaconColor, lerpAlpha);
      vis.beaconLight.color.lerp(vis.targetBeaconColor, lerpAlpha);
      vis.kioskScreenMat.emissive.lerp(vis.targetScreenColor, lerpAlpha);
    }

    // Animate Holographic Proteins, Robotic Synthesis Arms, Conveyor Vials, Breach Cubes & Living NPC Scientists
    const isLockdown = !this.mainDoorOpen && !this.facilityRestored;
    this.facilityZones.update(dt, elapsedSec, isLockdown);

    // Security cameras track culprit during Scene 2 detection
    for (let i = 0; i < this.securityCameras.length; i++) {
      const cam = this.securityCameras[i];
      if (this.phase === 'cinematic' && this.lastCinematicScene === 2) {
        const dx = -8.1 - cam.position.x;
        const dz = 12.4 - cam.position.z;
        const aimYaw = Math.atan2(dx, dz);
        cam.rotation.y = THREE.MathUtils.damp(cam.rotation.y, aimYaw, 5, dt);
      } else {
        cam.rotation.y = (cam.userData.baseYaw || 0) + Math.sin(elapsedSec * 0.65 + i * 1.5) * 0.42;
      }
    }

    for (const rotor of this.beaconRotors) {
      rotor.rotation.y += dt * 3.0;
    }

    const cityVisible =
      this.phase === 'gameplay' &&
      this.activeInteriorVault === null &&
      (this.mainDoorOpen || this.playerPos.z < -21.5);
    this.futureCity.update(dt, elapsedSec, cityVisible);
    this.vaultChambers?.update(dt, elapsedSec, this.visibleVaultsSet);
  }

  private updateSparks(dt: number) {
    let anyActive = false;
    const count = this.sparkLife.length;
    for (let i = 0; i < count; i++) {
      if (this.sparkLife[i] > 0) {
        anyActive = true;
        this.sparkLife[i] -= dt;
        const i3 = i * 3;
        this.sparkVelocities[i3 + 1] -= 9.8 * dt;
        this.sparkPositions[i3] += this.sparkVelocities[i3] * dt;
        this.sparkPositions[i3 + 1] += this.sparkVelocities[i3 + 1] * dt;
        this.sparkPositions[i3 + 2] += this.sparkVelocities[i3 + 2] * dt;
        if (this.sparkPositions[i3 + 1] < 0.05 || this.sparkLife[i] <= 0) {
          this.sparkPositions[i3 + 1] = -25;
          this.sparkLife[i] = 0;
        }
      }
    }
    if (anyActive) {
      (this.sparkPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
    this.sparkLight.intensity = THREE.MathUtils.damp(this.sparkLight.intensity, 0, 8, dt);
  }

  private updateFireworks(dt: number) {
    for (let i = this.pendingFireworkQueue.length - 1; i >= 0; i--) {
      this.pendingFireworkQueue[i].delay -= dt;
      if (this.pendingFireworkQueue[i].delay <= 0) {
        const q = this.pendingFireworkQueue[i];
        this.pendingFireworkQueue.splice(i, 1);
        this.spawnFireworkAt(q.x, q.y, q.z, q.scale);
      }
    }

    let anyUpdated = false;
    for (const slot of this.fwSlots) {
      if (!slot.active) continue;
      anyUpdated = true;
      slot.age += dt;
      const lifeRatio = 1 - slot.age / slot.duration;
      if (lifeRatio <= 0) {
        slot.active = false;
        for (let i = 0; i < slot.count; i++) {
          this.fwPositions[(slot.startIndex + i) * 3 + 1] = -50;
        }
        continue;
      }

      const drag = Math.exp(-1.5 * dt);
      const fade = Math.max(0, lifeRatio * lifeRatio);
      for (let i = 0; i < slot.count; i++) {
        const i3 = (slot.startIndex + i) * 3;
        this.fwVelocities[i3] *= drag;
        this.fwVelocities[i3 + 1] = this.fwVelocities[i3 + 1] * drag - 4.2 * dt;
        this.fwVelocities[i3 + 2] *= drag;

        this.fwPositions[i3] += this.fwVelocities[i3] * dt;
        this.fwPositions[i3 + 1] += this.fwVelocities[i3 + 1] * dt;
        this.fwPositions[i3 + 2] += this.fwVelocities[i3 + 2] * dt;

        this.fwColors[i3] = this.fwBaseColors[i3] * fade;
        this.fwColors[i3 + 1] = this.fwBaseColors[i3 + 1] * fade;
        this.fwColors[i3 + 2] = this.fwBaseColors[i3 + 2] * fade;
      }
    }

    if (anyUpdated) {
      (this.fwPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.fwPoints.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    }
    this.fwLight.intensity = THREE.MathUtils.damp(this.fwLight.intensity, 0, 5, dt);
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    this.releasePointerLock();

    window.removeEventListener('resize', this.onResizeBound);
    window.removeEventListener('orientationchange', this.onResizeBound);
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    window.removeEventListener('mousemove', this.onMouseMoveBound);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDownBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);
    window.removeEventListener('blur', this.onBlurBound);
    this.renderer.domElement.removeEventListener('touchstart', this.onTouchStartBound);
    this.renderer.domElement.removeEventListener('touchmove', this.onTouchMoveBound);
    this.renderer.domElement.removeEventListener('touchend', this.onTouchEndBound);
    this.renderer.domElement.removeEventListener('touchcancel', this.onTouchEndBound);
    document.removeEventListener('pointerlockchange', this.onPointerLockChangeBound);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLostBound);

    this.playerCharacter?.dispose();
    this.rogueCharacter?.dispose();
    this.facilityZones?.dispose();
    this.vaultChambers?.dispose();
    this.futureCity?.dispose();
    this.textures.disposeAll();
    this.composer?.dispose();
    this.composerRT?.dispose();
    this.pmremRT?.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
