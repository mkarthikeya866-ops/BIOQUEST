import * as THREE from 'three';
import { VAULTS } from '../data/vaultData';
import { FacilityTextures } from './facilityTextures';
import { VaultId, VaultStationTab } from '../types/game';

export interface VaultDoorMount {
  id: VaultId;
  x: number;
  z: number;
  rotY: number;
}

export const VAULT_DOOR_MOUNTS: VaultDoorMount[] = [
  { id: 1, x: -31.8, z: 10.5, rotY: Math.PI / 2 },
  { id: 2, x: -31.8, z: -7.5, rotY: Math.PI / 2 },
  { id: 3, x: -19.5, z: -18.8, rotY: 0 },
  { id: 4, x: 31.8, z: -7.5, rotY: -Math.PI / 2 },
  { id: 5, x: 31.8, z: 10.5, rotY: -Math.PI / 2 },
];

export interface VaultChamberInteractable {
  id: string;
  kind: 'vault-station' | 'vault-exit';
  vaultId: VaultId;
  stationTab?: VaultStationTab;
  position: THREE.Vector3;
  radius: number;
  label: string;
  sublabel: string;
}

export interface VaultChamberData {
  id: VaultId;
  originX: number;
  originZ: number;
  rotY: number;
  cosInv: number;
  sinInv: number;
  halfW: number;
  vestibuleEndZ: number; // -2.75
  backWallZ: number;     // -20.75
  height: number;
  centerWorld: THREE.Vector3;
  entryWalkSpotWorld: THREE.Vector3;
  exitSpotWorld: THREE.Vector3;
  group: THREE.Group;
  centerpiece: THREE.Group;
  keyGroup: THREE.Group;
  accentMat: THREE.MeshStandardMaterial;
  screenMat: THREE.MeshStandardMaterial;
  keyMat: THREE.MeshStandardMaterial;
  chamberLight: THREE.PointLight;
  pedestalLight: THREE.PointLight;
  targetColor: THREE.Color;
  interactables: VaultChamberInteractable[];
}

export interface VaultChambersSystem {
  chambers: Map<VaultId, VaultChamberData>;
  detectInteriorVault: (x: number, z: number) => VaultId | null;
  isPointInsideVaultZone: (vaultId: VaultId, x: number, y: number, z: number, margin?: number) => boolean;
  collidesInChamber: (vaultId: VaultId, x: number, z: number, r: number) => boolean;
  syncCompleted: (completedVaults: Set<VaultId>) => void;
  update: (dt: number, elapsedSec: number, visibleVaults: Set<VaultId>) => void;
  dispose: () => void;
}

const AMBER_WARN = new THREE.Color('#f59e0b');
const CYAN_SECURE = new THREE.Color('#22d3ee');

// Local chamber constants (vault-local space, where local Z = 0 is the blast door plane and -Z goes deep into the vault)
const HALF_W = 7.6; // 15.2m wide (clean 2.8m clearance between adjacent West/East vaults)
const VESTIBULE_END_Z = -2.75;
const CHAMBER_DEPTH = 18.0;
const BACK_WALL_Z = VESTIBULE_END_Z - CHAMBER_DEPTH; // -20.75
const CHAMBER_CENTER_Z = VESTIBULE_END_Z - CHAMBER_DEPTH / 2; // -11.75
const CHAMBER_HEIGHT = 6.8;
const PEDESTAL_Z = -11.4;
const NORTH_CONSOLE_Z = -17.4;
const SIDE_CONSOLE_X = 5.3;

function worldToChamberLocal(ch: VaultChamberData, wx: number, wz: number): { lx: number; lz: number } {
  const dx = wx - ch.originX;
  const dz = wz - ch.originZ;
  // Inverse rotation around Y by -rotY:
  // Three.js Ry(theta): x' = x*cos + z*sin, z' = -x*sin + z*cos
  // Ry(-theta): lx = dx*cos - dz*sin, lz = dx*sin + dz*cos
  return {
    lx: dx * ch.cosInv - dz * ch.sinInv,
    lz: dx * ch.sinInv + dz * ch.cosInv,
  };
}

function createStationSignTexture(
  title: string,
  subtitle: string,
  accentHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#07101f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

  ctx.fillStyle = accentHex;
  ctx.fillRect(14, 14, canvas.width - 28, 10);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 34px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, canvas.width / 2, 72);

  ctx.fillStyle = accentHex;
  ctx.font = '600 20px "JetBrains Mono", monospace';
  ctx.fillText(subtitle, canvas.width / 2, 118);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildVaultCenterpiece(
  vaultId: VaultId,
  accentHex: string,
  track: <T extends { dispose: () => void }>(item: T) => T
): THREE.Group {
  const group = new THREE.Group();

  const primaryMat = track(
    new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 1.35,
      roughness: 0.2,
      metalness: 0.35,
    })
  );
  const secondaryMat = track(
    new THREE.MeshStandardMaterial({
      color: '#f43f5e',
      emissive: '#e11d48',
      emissiveIntensity: 1.25,
      roughness: 0.22,
    })
  );
  const strutMat = track(
    new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      emissive: accentHex,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.5,
    })
  );

  const nodeGeo = track(new THREE.SphereGeometry(0.16, 12, 12));
  const smallNodeGeo = track(new THREE.SphereGeometry(0.11, 10, 10));

  if (vaultId === 1) {
    const rungGeo = track(new THREE.CylinderGeometry(0.03, 0.03, 1.32, 8));
    for (let i = 0; i < 12; i++) {
      const angle = i * 0.62;
      const y = (i - 5.5) * 0.24;
      const a1 = new THREE.Mesh(smallNodeGeo, primaryMat);
      a1.position.set(Math.cos(angle) * 0.66, y, Math.sin(angle) * 0.66);
      const a2 = new THREE.Mesh(smallNodeGeo, secondaryMat);
      a2.position.set(-Math.cos(angle) * 0.66, y, -Math.sin(angle) * 0.66);
      const rung = new THREE.Mesh(rungGeo, strutMat);
      rung.position.y = y;
      rung.rotation.z = Math.PI / 2;
      rung.rotation.y = -angle;
      group.add(a1, a2, rung);
    }
    const baseRing = new THREE.Mesh(track(new THREE.TorusGeometry(1.15, 0.035, 10, 36)), strutMat);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = -1.35;
    group.add(baseRing);
  } else if (vaultId === 2) {
    const bondGeo = track(new THREE.CylinderGeometry(0.04, 0.04, 0.92, 8));
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const c = new THREE.Mesh(nodeGeo, primaryMat);
      c.position.set(Math.cos(a) * 0.92, Math.sin(a) * 0.92, 0);
      group.add(c);
      const b = new THREE.Mesh(bondGeo, strutMat);
      const midA = a + Math.PI / 6;
      b.position.set(Math.cos(midA) * 0.79, Math.sin(midA) * 0.79, 0);
      b.rotation.z = midA;
      group.add(b);
    }
    const ohBond = new THREE.Mesh(bondGeo, strutMat);
    ohBond.position.set(1.36, 0, 0);
    ohBond.rotation.z = Math.PI / 2;
    const oxy = new THREE.Mesh(nodeGeo, secondaryMat);
    oxy.position.set(1.72, 0, 0);
    const orbit = new THREE.Mesh(track(new THREE.TorusGeometry(1.35, 0.025, 8, 36)), strutMat);
    orbit.rotation.x = Math.PI / 3;
    group.add(ohBond, oxy, orbit);
  } else if (vaultId === 3) {
    const core = new THREE.Mesh(
      track(new THREE.IcosahedronGeometry(0.92, 1)),
      track(
        new THREE.MeshStandardMaterial({
          color: accentHex,
          emissive: accentHex,
          emissiveIntensity: 1.15,
          wireframe: true,
        })
      )
    );
    const nucleus = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.45, 0)), secondaryMat);
    group.add(core, nucleus);

    const pillarGeo = track(new THREE.CylinderGeometry(0.07, 0.07, 1.8, 10));
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i + Math.PI / 4;
      const p = new THREE.Mesh(pillarGeo, strutMat);
      p.position.set(Math.cos(a) * 1.18, 0, Math.sin(a) * 1.18);
      group.add(p);
    }
  } else if (vaultId === 4) {
    const layers = [
      [new THREE.Vector3(-1.05, 0.65, 0), new THREE.Vector3(-1.05, -0.65, 0)],
      [
        new THREE.Vector3(0, 0.85, 0.35),
        new THREE.Vector3(0, 0, -0.35),
        new THREE.Vector3(0, -0.85, 0.35),
      ],
      [new THREE.Vector3(1.05, 0, 0)],
    ];
    layers.forEach((layer, lIdx) => {
      layer.forEach((pos) => {
        const n = new THREE.Mesh(nodeGeo, lIdx === 2 ? secondaryMat : primaryMat);
        n.position.copy(pos);
        group.add(n);
      });
    });
    const r1 = new THREE.Mesh(track(new THREE.TorusGeometry(1.25, 0.032, 10, 40)), strutMat);
    const r2 = new THREE.Mesh(track(new THREE.TorusGeometry(1.05, 0.025, 10, 36)), primaryMat);
    r2.rotation.y = Math.PI / 2;
    group.add(r1, r2);
  } else {
    const core = new THREE.Mesh(track(new THREE.DodecahedronGeometry(0.68, 0)), primaryMat);
    const r1 = new THREE.Mesh(track(new THREE.TorusGeometry(1.18, 0.04, 10, 40)), strutMat);
    const r2 = new THREE.Mesh(track(new THREE.TorusGeometry(1.18, 0.04, 10, 40)), secondaryMat);
    r2.rotation.x = Math.PI / 2;
    const r3 = new THREE.Mesh(track(new THREE.TorusGeometry(0.95, 0.03, 10, 36)), primaryMat);
    r3.rotation.y = Math.PI / 2;
    group.add(core, r1, r2, r3);
  }

  return group;
}

export function buildVaultChambers(
  scene: THREE.Scene,
  textures: FacilityTextures,
  enableShadows: boolean
): VaultChambersSystem {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const chambers = new Map<VaultId, VaultChamberData>();

  // Shared geometries
  const floorGeo = track(new THREE.PlaneGeometry(HALF_W * 2, CHAMBER_DEPTH));
  const ceilGeo = track(new THREE.PlaneGeometry(HALF_W * 2, CHAMBER_DEPTH));
  const sideWallGeo = track(new THREE.BoxGeometry(0.45, CHAMBER_HEIGHT, CHAMBER_DEPTH));
  const backWallGeo = track(new THREE.BoxGeometry(HALF_W * 2, CHAMBER_HEIGHT, 0.45));
  const frontSideWidth = HALF_W - 1.9; // 5.7m on each side of the 3.8m doorway
  const frontSideGeo = track(new THREE.BoxGeometry(frontSideWidth, CHAMBER_HEIGHT, 0.45));
  const frontTopGeo = track(new THREE.BoxGeometry(3.9, CHAMBER_HEIGHT - 4.3, 0.45));

  const vestLen = Math.abs(VESTIBULE_END_Z) + 0.1; // 2.85m seamless bridge from door (z=0) to chamber (z=-2.75)
  const vestFloorGeo = track(new THREE.PlaneGeometry(3.85, vestLen));
  const vestCeilGeo = track(new THREE.BoxGeometry(3.95, 0.18, vestLen));
  const vestWallGeo = track(new THREE.BoxGeometry(0.22, 4.35, vestLen));
  const vestRibGeo = track(new THREE.BoxGeometry(0.08, 3.9, 0.14));

  const ribGeo = track(new THREE.BoxGeometry(HALF_W * 2 - 0.5, 0.36, 0.42));
  const ceilingStripGeo = track(new THREE.BoxGeometry(HALF_W * 2 - 2.2, 0.09, 0.18));
  const sideStripGeo = track(new THREE.BoxGeometry(0.12, 0.14, CHAMBER_DEPTH - 1.8));
  const pillarGeo = track(new THREE.BoxGeometry(0.48, CHAMBER_HEIGHT, 0.48));

  const deskBaseGeo = track(new THREE.BoxGeometry(2.5, 1.05, 0.92));
  const deskScreenFrameGeo = track(new THREE.BoxGeometry(1.86, 1.12, 0.12));
  const deskScreenFaceGeo = track(new THREE.PlaneGeometry(1.72, 1.0));
  const signBoardGeo = track(new THREE.PlaneGeometry(2.45, 0.76));
  const pedestalBaseGeo = track(new THREE.CylinderGeometry(1.65, 1.95, 0.55, 16));
  const pedestalRingGeo = track(new THREE.TorusGeometry(1.7, 0.06, 10, 36));

  const keyShaftGeo = track(new THREE.CylinderGeometry(0.055, 0.055, 0.55, 10));
  const keyHeadGeo = track(new THREE.TorusGeometry(0.17, 0.048, 10, 20));
  const keyToothGeo = track(new THREE.BoxGeometry(0.15, 0.07, 0.07));

  const floorMat = track(
    new THREE.MeshPhysicalMaterial({
      map: textures.floor,
      color: '#111c33',
      roughness: 0.32,
      metalness: 0.45,
      clearcoat: 0.48,
      clearcoatRoughness: 0.25,
    })
  );
  const wallMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.wall,
      color: '#121d31',
      roughness: 0.46,
      metalness: 0.42,
    })
  );
  const ceilMat = track(
    new THREE.MeshStandardMaterial({
      color: '#070e1c',
      roughness: 0.68,
      metalness: 0.35,
    })
  );
  const frameMat = track(
    new THREE.MeshStandardMaterial({
      color: '#16233a',
      metalness: 0.78,
      roughness: 0.28,
    })
  );
  const deskMat = track(
    new THREE.MeshStandardMaterial({
      color: '#0f182a',
      metalness: 0.72,
      roughness: 0.32,
    })
  );

  for (const mount of VAULT_DOOR_MOUNTS) {
    const def = VAULTS.find((v) => v.id === mount.id)!;

    // Physically mounted directly behind each vault's real exterior blast doors!
    const group = new THREE.Group();
    group.position.set(mount.x, 0, mount.z);
    group.rotation.y = mount.rotY;
    group.visible = false;
    scene.add(group);

    // Per-chamber dynamic materials that transition smoothly from Warning Amber -> Secure Cyan
    const accentMat = track(
      new THREE.MeshStandardMaterial({
        color: '#f59e0b',
        emissive: '#f59e0b',
        emissiveIntensity: 1.5,
        roughness: 0.2,
      })
    );
    const screenMat = track(
      new THREE.MeshStandardMaterial({
        map: textures.monitorNormal,
        color: '#fef3c7',
        emissive: '#f59e0b',
        emissiveMap: textures.monitorNormal,
        emissiveIntensity: 0.95,
        roughness: 0.2,
      })
    );
    const keyMat = track(
      new THREE.MeshStandardMaterial({
        color: '#f59e0b',
        emissive: '#f59e0b',
        emissiveIntensity: 1.2,
        metalness: 0.75,
        roughness: 0.18,
      })
    );

    // 1. Walkable Airlock Vestibule Tunnel bridging directly from Blast Doors (z=0) into the Chamber (z=-2.75)
    const vestFloor = new THREE.Mesh(vestFloorGeo, floorMat);
    vestFloor.rotation.x = -Math.PI / 2;
    vestFloor.position.set(0, 0.014, -vestLen / 2 + 0.04);
    vestFloor.receiveShadow = enableShadows;
    const vestCeil = new THREE.Mesh(vestCeilGeo, frameMat);
    vestCeil.position.set(0, 4.34, -vestLen / 2 + 0.04);
    const vestWallL = new THREE.Mesh(vestWallGeo, frameMat);
    vestWallL.position.set(-1.98, 2.175, -vestLen / 2 + 0.04);
    const vestWallR = new THREE.Mesh(vestWallGeo, frameMat);
    vestWallR.position.set(1.98, 2.175, -vestLen / 2 + 0.04);
    const vestRibL = new THREE.Mesh(vestRibGeo, accentMat);
    vestRibL.position.set(-1.82, 2.1, -1.35);
    const vestRibR = new THREE.Mesh(vestRibGeo, accentMat);
    vestRibR.position.set(1.82, 2.1, -1.35);
    group.add(vestFloor, vestCeil, vestWallL, vestWallR, vestRibL, vestRibR);

    // 2. Main Chamber Floor & Ceiling
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.012, CHAMBER_CENTER_Z);
    floor.receiveShadow = enableShadows;
    group.add(floor);

    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, CHAMBER_HEIGHT, CHAMBER_CENTER_Z);
    group.add(ceil);

    // 3. Perimeter Walls enclosing the attached 3D Chamber (front wall split around the open vestibule archway)
    const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
    leftWall.position.set(-HALF_W, CHAMBER_HEIGHT / 2, CHAMBER_CENTER_Z);
    const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
    rightWall.position.set(HALF_W, CHAMBER_HEIGHT / 2, CHAMBER_CENTER_Z);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, CHAMBER_HEIGHT / 2, BACK_WALL_Z);

    const frontLeft = new THREE.Mesh(frontSideGeo, wallMat);
    frontLeft.position.set(-(1.9 + frontSideWidth / 2), CHAMBER_HEIGHT / 2, VESTIBULE_END_Z);
    const frontRight = new THREE.Mesh(frontSideGeo, wallMat);
    frontRight.position.set(1.9 + frontSideWidth / 2, CHAMBER_HEIGHT / 2, VESTIBULE_END_Z);
    const frontTop = new THREE.Mesh(frontTopGeo, wallMat);
    frontTop.position.set(0, 4.3 + (CHAMBER_HEIGHT - 4.3) / 2, VESTIBULE_END_Z);
    group.add(leftWall, rightWall, backWall, frontLeft, frontRight, frontTop);

    // Overhead structural steel ribs + glowing amber->cyan ceiling strips
    for (const rz of [-5.6, -9.8, -14.0, -18.2]) {
      const rib = new THREE.Mesh(ribGeo, frameMat);
      rib.position.set(0, CHAMBER_HEIGHT - 0.22, rz);
      const led = new THREE.Mesh(ceilingStripGeo, accentMat);
      led.position.set(0, CHAMBER_HEIGHT - 0.44, rz);
      group.add(rib, led);
    }

    // Horizontal luminous bands on Left & Right walls
    const leftStrip = new THREE.Mesh(sideStripGeo, accentMat);
    leftStrip.position.set(-HALF_W + 0.3, 3.6, CHAMBER_CENTER_Z);
    const rightStrip = new THREE.Mesh(sideStripGeo, accentMat);
    rightStrip.position.set(HALF_W - 0.3, 3.6, CHAMBER_CENTER_Z);
    group.add(leftStrip, rightStrip);

    // Corner structural columns
    for (const [px, pz] of [
      [-HALF_W + 0.42, BACK_WALL_Z + 0.42],
      [HALF_W - 0.42, BACK_WALL_Z + 0.42],
      [-HALF_W + 0.42, VESTIBULE_END_Z - 0.42],
      [HALF_W - 0.42, VESTIBULE_END_Z - 0.42],
    ]) {
      const col = new THREE.Mesh(pillarGeo, frameMat);
      col.position.set(px, CHAMBER_HEIGHT / 2, pz);
      group.add(col);
    }

    // Luminous floor walkways running straight from the open blast door threshold -> Center Pedestal -> 3 Stations
    const mainWalk = new THREE.Mesh(track(new THREE.BoxGeometry(0.28, 0.024, 17.0)), accentMat);
    mainWalk.position.set(0, 0.02, -8.8);
    const crossWalk = new THREE.Mesh(track(new THREE.BoxGeometry(10.2, 0.024, 0.24)), accentMat);
    crossWalk.position.set(0, 0.02, PEDESTAL_Z);
    group.add(mainWalk, crossWalk);

    // Vault Title Banner high on Back Wall (clearly visible right through the open blast doors!)
    const vaultBannerTex = textures.vaultSigns.get(def.id);
    if (vaultBannerTex) {
      const bannerMat = track(
        new THREE.MeshStandardMaterial({
          map: vaultBannerTex,
          emissive: def.accentHex,
          emissiveMap: vaultBannerTex,
          emissiveIntensity: 0.9,
          roughness: 0.22,
        })
      );
      const banner = new THREE.Mesh(track(new THREE.PlaneGeometry(5.6, 1.5)), bannerMat);
      banner.position.set(0, 5.1, BACK_WALL_Z + 0.3);
      group.add(banner);
    }

    // Overhead Exit Sign on the interior side of the open archway back to the Main Lab
    const exitSignTex = track(
      createStationSignTexture('MAIN BIOQUEST LAB', 'WALK OUT OR PRESS [E] TO TOGGLE DOOR', '#38bdf8')
    );
    const exitSignMat = track(
      new THREE.MeshStandardMaterial({
        map: exitSignTex,
        emissive: '#38bdf8',
        emissiveMap: exitSignTex,
        emissiveIntensity: 0.85,
        roughness: 0.25,
      })
    );
    const exitSign = new THREE.Mesh(track(new THREE.PlaneGeometry(3.4, 0.85)), exitSignMat);
    exitSign.position.set(0, 4.95, VESTIBULE_END_Z - 0.28);
    exitSign.rotation.y = Math.PI;
    group.add(exitSign);

    // Central Pedestal + Giant Vault-Specific 3D Scientific Centerpiece + Physical Floating Key
    const pedBase = new THREE.Mesh(pedestalBaseGeo, frameMat);
    pedBase.position.set(0, 0.275, PEDESTAL_Z);
    const pedRing = new THREE.Mesh(pedestalRingGeo, accentMat);
    pedRing.rotation.x = Math.PI / 2;
    pedRing.position.set(0, 0.56, PEDESTAL_Z);
    group.add(pedBase, pedRing);

    const centerpiece = buildVaultCenterpiece(def.id, def.accentHex, track);
    centerpiece.position.set(0, 3.15, PEDESTAL_Z);
    group.add(centerpiece);

    const keyGroup = new THREE.Group();
    keyGroup.position.set(0, 1.38, PEDESTAL_Z);
    const shaft = new THREE.Mesh(keyShaftGeo, keyMat);
    const head = new THREE.Mesh(keyHeadGeo, keyMat);
    head.position.y = 0.36;
    const t1 = new THREE.Mesh(keyToothGeo, keyMat);
    t1.position.set(0.09, -0.15, 0);
    const t2 = new THREE.Mesh(keyToothGeo, keyMat);
    t2.position.set(0.09, -0.26, 0);
    keyGroup.add(shaft, head, t1, t2);
    group.add(keyGroup);

    // Interior Lighting (2 crisp point lights per chamber)
    const chamberLight = new THREE.PointLight('#f59e0b', 24, 28, 1.3);
    chamberLight.position.set(0, 5.6, CHAMBER_CENTER_Z + 1.2);
    group.add(chamberLight);

    const pedestalLight = new THREE.PointLight('#f59e0b', 14, 15, 1.4);
    pedestalLight.position.set(0, 2.4, PEDESTAL_Z);
    group.add(pedestalLight);

    group.updateMatrixWorld(true);
    const interactables: VaultChamberInteractable[] = [];

    const addStation = (opts: {
      id: string;
      tab: VaultStationTab;
      localX: number;
      localZ: number;
      rotY: number;
      signTitle: string;
      signSubtitle: string;
      signColor: string;
      label: string;
      sublabel: string;
    }) => {
      const sGroup = new THREE.Group();
      sGroup.position.set(opts.localX, 0, opts.localZ);
      sGroup.rotation.y = opts.rotY;

      const base = new THREE.Mesh(deskBaseGeo, deskMat);
      base.position.y = 0.525;
      const trim = new THREE.Mesh(track(new THREE.BoxGeometry(2.58, 0.06, 0.98)), accentMat);
      trim.position.y = 1.06;

      const screenFrame = new THREE.Mesh(deskScreenFrameGeo, frameMat);
      screenFrame.position.set(0, 1.72, -0.18);
      screenFrame.rotation.x = -0.12;
      const screenFace = new THREE.Mesh(deskScreenFaceGeo, screenMat);
      screenFace.position.set(0, 1.72, -0.11);
      screenFace.rotation.x = -0.12;

      const signTex = track(createStationSignTexture(opts.signTitle, opts.signSubtitle, opts.signColor));
      const signMat = track(
        new THREE.MeshStandardMaterial({
          map: signTex,
          emissive: opts.signColor,
          emissiveMap: signTex,
          emissiveIntensity: 0.72,
          roughness: 0.25,
        })
      );
      const signMesh = new THREE.Mesh(signBoardGeo, signMat);
      signMesh.position.set(0, 2.86, -0.18);

      sGroup.add(base, trim, screenFrame, screenFace, signMesh);
      group.add(sGroup);

      const worldPos = new THREE.Vector3(opts.localX, 1.4, opts.localZ).applyMatrix4(group.matrixWorld);
      interactables.push({
        id: `vault-${def.id}-station-${opts.id}`,
        kind: 'vault-station',
        vaultId: def.id,
        stationTab: opts.tab,
        position: worldPos,
        radius: 3.6,
        label: opts.label,
        sublabel: opts.sublabel,
      });
    };

    // 1. FAR-CENTER MASTER CHALLENGE CONSOLE (Straight ahead across the centerpiece)
    addStation({
      id: 'challenges',
      tab: 'challenges',
      localX: 0,
      localZ: NORTH_CONSOLE_Z,
      rotY: 0,
      signTitle: 'VAULT CHALLENGES',
      signSubtitle: `VERIFY ${def.keyName.toUpperCase()}`,
      signColor: '#22d3ee',
      label: `${def.code} · Challenge Verification Console`,
      sublabel: `Press [E] to Play ${def.title} Challenges (${def.challenges.length} Tasks)`,
    });

    // 2. LEFT CONCEPT BRIEFING TERMINAL
    addStation({
      id: 'concepts',
      tab: 'concepts',
      localX: -SIDE_CONSOLE_X,
      localZ: PEDESTAL_Z,
      rotY: Math.PI / 2,
      signTitle: 'CONCEPT GUIDE',
      signSubtitle: 'NEXUS RESEARCH BRIEFING',
      signColor: '#38bdf8',
      label: `${def.code} · Scientific Concept Guide`,
      sublabel: `Press [E] to Study ${def.concepts.length} Key Concepts & Examples`,
    });

    // 3. RIGHT INCIDENT LOG TERMINAL
    addStation({
      id: 'story',
      tab: 'story',
      localX: SIDE_CONSOLE_X,
      localZ: PEDESTAL_Z,
      rotY: -Math.PI / 2,
      signTitle: 'INCIDENT LOG',
      signSubtitle: def.storyLog.code,
      signColor: '#f59e0b',
      label: `${def.code} · Classified Incident Log`,
      sublabel: `Press [E] to Inspect ${def.storyLog.title}`,
    });

    const centerWorld = new THREE.Vector3(0, 0, PEDESTAL_Z).applyMatrix4(group.matrixWorld);
    const entryWalkSpotWorld = new THREE.Vector3(0, 0, -5.0).applyMatrix4(group.matrixWorld);
    const exitSpotWorld = new THREE.Vector3(0, 0, 4.4).applyMatrix4(group.matrixWorld);

    chambers.set(def.id, {
      id: def.id,
      originX: mount.x,
      originZ: mount.z,
      rotY: mount.rotY,
      cosInv: Math.cos(mount.rotY),
      sinInv: Math.sin(mount.rotY),
      halfW: HALF_W,
      vestibuleEndZ: VESTIBULE_END_Z,
      backWallZ: BACK_WALL_Z,
      height: CHAMBER_HEIGHT,
      centerWorld,
      entryWalkSpotWorld,
      exitSpotWorld,
      group,
      centerpiece,
      keyGroup,
      accentMat,
      screenMat,
      keyMat,
      chamberLight,
      pedestalLight,
      targetColor: AMBER_WARN.clone(),
      interactables,
    });
  }

  return {
    chambers,
    detectInteriorVault(x: number, z: number): VaultId | null {
      for (const ch of chambers.values()) {
        if (!ch.group.visible) continue;
        const { lx, lz } = worldToChamberLocal(ch, x, z);
        if (lz <= -0.35 && lz >= ch.backWallZ - 0.5 && Math.abs(lx) <= ch.halfW + 0.5) {
          return ch.id;
        }
      }
      return null;
    },
    isPointInsideVaultZone(vaultId: VaultId, x: number, y: number, z: number, margin = 0.42): boolean {
      const ch = chambers.get(vaultId);
      if (!ch || !ch.group.visible) return false;
      const { lx, lz } = worldToChamberLocal(ch, x, z);
      // Inside vestibule bridge corridor
      if (lz <= 0.45 && lz >= ch.vestibuleEndZ - 0.25) {
        return Math.abs(lx) <= 1.9 - margin && y <= 4.3 - margin;
      }
      // Inside main vault chamber
      if (lz < ch.vestibuleEndZ - 0.25 && lz >= ch.backWallZ + margin) {
        return Math.abs(lx) <= ch.halfW - margin && y <= ch.height - margin;
      }
      return false;
    },
    collidesInChamber(vaultId: VaultId, x: number, z: number, r: number): boolean {
      const ch = chambers.get(vaultId);
      if (!ch) return false;
      const { lx, lz } = worldToChamberLocal(ch, x, z);

      // Inside vestibule doorway corridor
      if (lz > ch.vestibuleEndZ - 0.2) {
        if (lz <= 0.25 && Math.abs(lx) + r > 1.82) return true;
        return false;
      }

      // Outer chamber walls
      if (Math.abs(lx) + r > ch.halfW - 0.28) return true;
      if (lz - r < ch.backWallZ + 0.28) return true;

      // Front chamber wall (solid except across the 3.6m vestibule doorway opening)
      if (lz + r > ch.vestibuleEndZ - 0.24 && Math.abs(lx) + r > 1.82) return true;

      // Central pedestal
      if (Math.abs(lx) < 1.95 + r && Math.abs(lz - PEDESTAL_Z) < 1.95 + r) return true;

      // North Challenge Console
      if (Math.abs(lx) < 1.35 + r && Math.abs(lz - NORTH_CONSOLE_Z) < 0.62 + r) return true;

      // Left Concept Guide Terminal
      if (Math.abs(lx - -SIDE_CONSOLE_X) < 0.62 + r && Math.abs(lz - PEDESTAL_Z) < 1.35 + r) return true;

      // Right Incident Log Terminal
      if (Math.abs(lx - SIDE_CONSOLE_X) < 0.62 + r && Math.abs(lz - PEDESTAL_Z) < 1.35 + r) return true;

      return false;
    },
    syncCompleted(completedVaults: Set<VaultId>) {
      for (const [id, ch] of chambers.entries()) {
        const done = completedVaults.has(id);
        ch.targetColor.copy(done ? CYAN_SECURE : AMBER_WARN);
        ch.screenMat.color.set(done ? '#cffafe' : '#fef3c7');
        ch.chamberLight.intensity = done ? 30 : 24;
        ch.pedestalLight.intensity = done ? 18 : 13;
        ch.keyMat.emissiveIntensity = done ? 2.1 : 0.9;
      }
    },
    update(dt: number, elapsedSec: number, visibleVaults: Set<VaultId>) {
      const lerpAlpha = 1 - Math.exp(-3.4 * dt);
      for (const [id, ch] of chambers.entries()) {
        const visible = visibleVaults.has(id);
        ch.group.visible = visible;
        if (!visible) continue;

        ch.centerpiece.rotation.y += dt * 0.72;
        ch.centerpiece.position.y = 3.15 + Math.sin(elapsedSec * 1.9 + id) * 0.1;

        ch.keyGroup.rotation.y += dt * 1.9;
        ch.keyGroup.position.y = 1.38 + Math.sin(elapsedSec * 2.6 + id) * 0.07;

        ch.accentMat.color.lerp(ch.targetColor, lerpAlpha);
        ch.accentMat.emissive.lerp(ch.targetColor, lerpAlpha);
        ch.screenMat.emissive.lerp(ch.targetColor, lerpAlpha);
        ch.keyMat.color.lerp(ch.targetColor, lerpAlpha);
        ch.keyMat.emissive.lerp(ch.targetColor, lerpAlpha);
        ch.chamberLight.color.lerp(ch.targetColor, lerpAlpha);
        ch.pedestalLight.color.lerp(ch.targetColor, lerpAlpha);
      }
    },
    dispose() {
      for (const ch of chambers.values()) {
        scene.remove(ch.group);
      }
      chambers.clear();
      for (const d of disposables) {
        d.dispose();
      }
      disposables.length = 0;
    },
  };
}
