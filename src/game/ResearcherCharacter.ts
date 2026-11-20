import * as THREE from 'three';

export type ResearcherVariant = 'investigator' | 'rogue' | 'scientist';

export interface CharacterAnimationInput {
  speed: number; // horizontal ground speed (m/s)
  isRunning: boolean;
  isGrounded: boolean;
  verticalVelocity: number;
  turnRate: number; // rad/s signed
  interactPulse: number; // 0..1 timed interact gesture
  isTypingCinematic: boolean;
  isShockedCinematic: boolean;
  elapsedSec: number;
}

/**
 * High-detail articulated 3D human character with sculpted proportions and fluid locomotion:
 * - 'investigator': Lead Scientific Investigator in sleek sculpted dark-charcoal/white
 *   hooded tactical research jacket with warm-amber & electric-cyan accents (inspired by Ref #5),
 *   smooth layered collar/hood, articulated limbs, glowing forearm holo-display, and cyan visor.
 * - 'rogue': Culprit Insider in dark covert coat, crimson vest, ash-silver hair, amber visor,
 *   carrying a glowing crimson unauthorized data-extraction drive.
 * - 'scientist': Cleanroom BioQuest Researcher NPC in crisp white & teal lab coat, protective
 *   visor, and glowing cyan diagnostic tablet — used for living lab personnel patrolling & working.
 */
export class ResearcherCharacter {
  public readonly root: THREE.Group;

  private pelvis: THREE.Group;
  private torso: THREE.Group;
  private headGroup: THREE.Group;

  private leftShoulder: THREE.Group;
  private leftElbow: THREE.Group;
  private rightShoulder: THREE.Group;
  private rightElbow: THREE.Group;

  private leftHip: THREE.Group;
  private leftKnee: THREE.Group;
  private leftAnkle: THREE.Group;
  private rightHip: THREE.Group;
  private rightKnee: THREE.Group;
  private rightAnkle: THREE.Group;

  private coatFlapL: THREE.Group;
  private coatFlapR: THREE.Group;
  private contactShadow: THREE.Mesh;

  private stridePhase = 0;
  private landingSquash = 0;
  private wasGrounded = true;
  private smoothSpeed = 0;

  private disposables: Array<{ dispose: () => void }> = [];

  constructor(variant: ResearcherVariant = 'investigator', enableShadows = true) {
    this.root = new THREE.Group();
    this.root.name = `researcher-${variant}`;

    const isInv = variant === 'investigator';
    const isRogue = variant === 'rogue';
    const isSci = variant === 'scientist';

    const track = <T extends { dispose: () => void }>(item: T): T => {
      this.disposables.push(item);
      return item;
    };

    // Sculpted PBR material palettes with realistic roughness/metalness contrast
    const jacketMat = track(
      new THREE.MeshStandardMaterial({
        color: isInv ? '#16202e' : isRogue ? '#171923' : '#f1f5f9', // Ref #5 sleek dark jacket vs crisp white scientist coat
        roughness: isSci ? 0.68 : 0.54,
        metalness: isSci ? 0.05 : 0.18,
      })
    );
    const hoodOrCollarMat = track(
      new THREE.MeshStandardMaterial({
        color: isInv ? '#e2e8f0' : isRogue ? '#27272a' : '#0f766e', // Crisp folded white hood on Investigator (Ref #5!)
        roughness: 0.72,
        metalness: 0.04,
      })
    );
    const yokeAccentMat = track(
      new THREE.MeshStandardMaterial({
        color: isInv ? '#ea580c' : isRogue ? '#dc2626' : '#0ea5e9', // Signature shoulder chevron (Ref #5 orange-amber)
        emissive: isInv ? '#9a3412' : isRogue ? '#991b1b' : '#0284c7',
        emissiveIntensity: isInv ? 0.28 : 0.55,
        roughness: 0.42,
        metalness: 0.16,
      })
    );
    const glowAccentMat = track(
      new THREE.MeshStandardMaterial({
        color: isInv ? '#38bdf8' : isRogue ? '#ef4444' : '#22d3ee',
        emissive: isInv ? '#0ea5e9' : isRogue ? '#dc2626' : '#06b6d4',
        emissiveIntensity: 1.55,
        roughness: 0.2,
        metalness: 0.35,
      })
    );
    const shirtMat = track(
      new THREE.MeshStandardMaterial({
        color: isInv ? '#0f172a' : isRogue ? '#450a0a' : '#1e3a5f',
        roughness: 0.82,
        metalness: 0.05,
      })
    );
    const trouserMat = track(
      new THREE.MeshStandardMaterial({
        color: isInv ? '#0c121e' : isRogue ? '#1f1f23' : '#1e293b',
        roughness: 0.76,
        metalness: 0.08,
      })
    );
    const shoeMat = track(
      new THREE.MeshStandardMaterial({
        color: isInv ? '#1e293b' : '#18181b',
        roughness: 0.4,
        metalness: 0.25,
      })
    );
    const soleMat = track(
      new THREE.MeshStandardMaterial({
        color: isInv ? '#38bdf8' : isRogue ? '#52525b' : '#e2e8f0',
        emissive: isInv ? '#0284c7' : '#000000',
        emissiveIntensity: isInv ? 0.4 : 0,
        roughness: 0.65,
        metalness: 0.1,
      })
    );
    const skinMat = track(
      new THREE.MeshStandardMaterial({
        color: isInv ? '#e6b89c' : isRogue ? '#cfa084' : '#eabca0',
        roughness: 0.58,
        metalness: 0.02,
      })
    );
    const hairMat = track(
      new THREE.MeshStandardMaterial({
        color: isInv ? '#1a1412' : isRogue ? '#948a82' : '#261e1b',
        roughness: 0.84,
        metalness: 0.05,
      })
    );
    const visorFrameMat = track(
      new THREE.MeshStandardMaterial({
        color: '#0f172a',
        roughness: 0.25,
        metalness: 0.82,
      })
    );
    const visorLensMat = track(
      new THREE.MeshPhysicalMaterial({
        color: isInv ? '#38bdf8' : isRogue ? '#fb923c' : '#67e8f9',
        emissive: isInv ? '#0ea5e9' : isRogue ? '#ef4444' : '#06b6d4',
        emissiveIntensity: 0.85,
        roughness: 0.08,
        metalness: 0.2,
        transparent: true,
        opacity: 0.82,
      })
    );
    const beltMat = track(
      new THREE.MeshStandardMaterial({
        color: '#0a0f1c',
        roughness: 0.38,
        metalness: 0.45,
      })
    );

    const makeMesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const m = new THREE.Mesh(geo, mat);
      if (enableShadows) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
      return m;
    };

    // Grounded soft radial contact shadow
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 64;
    shadowCanvas.height = 64;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(32, 32, 4, 32, 32, 30);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
      grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.24)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 64, 64);
    }
    const shadowTex = track(new THREE.CanvasTexture(shadowCanvas));
    const shadowMat = track(
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
      })
    );
    this.contactShadow = new THREE.Mesh(track(new THREE.PlaneGeometry(1.05, 1.05)), shadowMat);
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.022;
    this.root.add(this.contactShadow);

    // =========================================================================
    // PELVIS (Hip center at y = 0.94m for crisp, athletic 1.80m human height)
    // =========================================================================
    this.pelvis = new THREE.Group();
    this.pelvis.position.set(0, 0.94, 0);
    this.root.add(this.pelvis);

    const hipCore = makeMesh(track(new THREE.CylinderGeometry(0.155, 0.145, 0.16, 12)), trouserMat);
    hipCore.scale.set(1.12, 1, 0.72);
    this.pelvis.add(hipCore);

    const belt = makeMesh(track(new THREE.CylinderGeometry(0.165, 0.165, 0.052, 14)), beltMat);
    belt.scale.set(1.12, 1, 0.74);
    belt.position.y = 0.065;
    this.pelvis.add(belt);

    // Investigator hip forensic scanner holster
    if (isInv) {
      const holster = makeMesh(track(new THREE.BoxGeometry(0.055, 0.14, 0.11)), visorFrameMat);
      holster.position.set(0.19, 0.02, 0.02);
      const pad = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.095, 0.075)), glowAccentMat);
      pad.position.set(0.194, 0.03, 0.02);
      this.pelvis.add(holster, pad);
    }

    // Tapered coat lower hem flaps
    const flapLen = isSci ? 0.44 : 0.28;
    const flapGeo = track(new THREE.BoxGeometry(0.15, flapLen, 0.19));
    this.coatFlapL = new THREE.Group();
    this.coatFlapL.position.set(-0.088, 0.02, 0);
    const flapML = makeMesh(flapGeo, jacketMat);
    flapML.position.set(0, -flapLen * 0.46, -0.01);
    this.coatFlapL.add(flapML);

    this.coatFlapR = new THREE.Group();
    this.coatFlapR.position.set(0.088, 0.02, 0);
    const flapMR = makeMesh(flapGeo, jacketMat);
    flapMR.position.set(0, -flapLen * 0.46, -0.01);
    this.coatFlapR.add(flapMR);

    const backTail = makeMesh(track(new THREE.BoxGeometry(0.32, flapLen, 0.045)), jacketMat);
    backTail.position.set(0, -flapLen * 0.45, -0.108);
    this.pelvis.add(this.coatFlapL, this.coatFlapR, backTail);

    // =========================================================================
    // SCULPTED ATHLETIC TORSO (Tapered chest + shoulder yoke + folded hood)
    // =========================================================================
    this.torso = new THREE.Group();
    this.torso.position.set(0, 0.085, 0);
    this.pelvis.add(this.torso);

    // Tapered athletic torso cylinder (wider at chest, narrower at waist)
    const upperTorso = makeMesh(track(new THREE.CylinderGeometry(0.198, 0.152, 0.49, 14)), jacketMat);
    upperTorso.scale.set(1.08, 1, 0.68);
    upperTorso.position.y = 0.255;
    this.torso.add(upperTorso);

    // Inner front shirt panel
    const innerChest = makeMesh(track(new THREE.BoxGeometry(0.13, 0.44, 0.05)), shirtMat);
    innerChest.position.set(0, 0.26, 0.112);
    this.torso.add(innerChest);

    // Ref #5 signature angled shoulder yoke accent across upper back & chest!
    const yokeBack = makeMesh(track(new THREE.CylinderGeometry(0.205, 0.196, 0.135, 14)), yokeAccentMat);
    yokeBack.scale.set(1.09, 1, 0.7);
    yokeBack.position.y = 0.43;
    this.torso.add(yokeBack);

    // Sculpted layered hood / standing lab collar resting on shoulders (Ref #5!)
    if (isInv) {
      const hoodOuter = makeMesh(track(new THREE.CylinderGeometry(0.138, 0.188, 0.15, 12)), hoodOrCollarMat);
      hoodOuter.scale.set(1.12, 1, 0.85);
      hoodOuter.position.set(0, 0.495, -0.055);
      hoodOuter.rotation.x = 0.28;
      const hoodFold = makeMesh(track(new THREE.TorusGeometry(0.115, 0.036, 8, 16)), hoodOrCollarMat);
      hoodFold.rotation.x = Math.PI / 2 + 0.18;
      hoodFold.position.set(0, 0.525, -0.02);
      this.torso.add(hoodOuter, hoodFold);
    } else {
      const collar = makeMesh(track(new THREE.CylinderGeometry(0.115, 0.145, 0.095, 12, 1, true)), hoodOrCollarMat);
      collar.position.set(0, 0.51, -0.01);
      this.torso.add(collar);
    }

    // Crisp illuminated spine bar & holographic back telemetry patch (readable from third-person camera)
    const spineStrip = new THREE.Mesh(track(new THREE.BoxGeometry(0.036, 0.22, 0.016)), glowAccentMat);
    spineStrip.position.set(0, 0.28, -0.138);
    const backBadge = new THREE.Mesh(track(new THREE.BoxGeometry(0.22, 0.022, 0.014)), glowAccentMat);
    backBadge.position.set(0, 0.37, -0.142);
    this.torso.add(spineStrip, backBadge);

    // Front glowing BioQuest credential badge
    const frontId = new THREE.Mesh(track(new THREE.BoxGeometry(0.062, 0.084, 0.014)), glowAccentMat);
    frontId.position.set(-0.112, 0.33, 0.136);
    this.torso.add(frontId);

    // =========================================================================
    // HEAD & NECK (Natural oval cranium, sculpted hair crown & jawline)
    // =========================================================================
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.515, 0);
    this.torso.add(this.headGroup);

    const neck = makeMesh(track(new THREE.CylinderGeometry(0.052, 0.064, 0.105, 12)), skinMat);
    neck.position.y = 0.045;
    this.headGroup.add(neck);

    const cranium = makeMesh(track(new THREE.SphereGeometry(0.118, 16, 14)), skinMat);
    cranium.scale.set(0.9, 1.12, 0.96);
    cranium.position.set(0, 0.19, 0.01);
    this.headGroup.add(cranium);

    // Sculpted modern stylized hair (Ref #5 crisp dark undercut/textured crown for Investigator)
    const hairCrown = makeMesh(
      track(new THREE.SphereGeometry(0.128, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62)),
      hairMat
    );
    hairCrown.scale.set(0.95, 1.08, 1.06);
    hairCrown.position.set(0, 0.212, -0.004);
    this.headGroup.add(hairCrown);

    const hairBack = makeMesh(track(new THREE.CylinderGeometry(0.105, 0.088, 0.14, 12)), hairMat);
    hairBack.scale.set(1.0, 1, 0.62);
    hairBack.position.set(0, 0.155, -0.068);
    this.headGroup.add(hairBack);

    const hairCrest = makeMesh(track(new THREE.BoxGeometry(0.13, 0.055, 0.16)), hairMat);
    hairCrest.position.set(0, 0.295, 0.025);
    hairCrest.rotation.x = -0.14;
    this.headGroup.add(hairCrest);

    // Sleek futuristic optical safety visor
    const visorFrame = makeMesh(track(new THREE.BoxGeometry(0.2, 0.058, 0.046)), visorFrameMat);
    visorFrame.position.set(0, 0.2, 0.098);
    const visorLens = new THREE.Mesh(track(new THREE.BoxGeometry(0.184, 0.042, 0.022)), visorLensMat);
    visorLens.position.set(0, 0.2, 0.118);
    this.headGroup.add(visorFrame, visorLens);

    // =========================================================================
    // ARMS (Rounded deltoid -> tapered sleeve -> elbow -> forearm -> sculpted hand)
    // =========================================================================
    const shoulderCapGeo = track(new THREE.SphereGeometry(0.064, 12, 10));
    const upperArmGeo = track(new THREE.CapsuleGeometry(0.048, 0.21, 6, 10));
    const forearmGeo = track(new THREE.CapsuleGeometry(0.039, 0.19, 6, 10));
    const cuffGeo = track(new THREE.CylinderGeometry(0.042, 0.04, 0.032, 12));
    const handGeo = track(new THREE.CapsuleGeometry(0.026, 0.052, 6, 8));

    const buildArm = (side: -1 | 1) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.236, 0.455, 0);
      this.torso.add(shoulder);

      const cap = makeMesh(shoulderCapGeo, isInv ? yokeAccentMat : jacketMat);
      shoulder.add(cap);

      const upper = makeMesh(upperArmGeo, jacketMat);
      upper.position.y = -0.145;
      shoulder.add(upper);

      const elbow = new THREE.Group();
      elbow.position.y = -0.29;
      shoulder.add(elbow);

      const forearm = makeMesh(forearmGeo, jacketMat);
      forearm.position.y = -0.135;
      elbow.add(forearm);

      const cuff = makeMesh(cuffGeo, glowAccentMat);
      cuff.position.y = -0.248;
      elbow.add(cuff);

      const hand = makeMesh(handGeo, skinMat);
      hand.scale.set(0.9, 1.0, 0.65);
      hand.position.y = -0.305;
      elbow.add(hand);

      // Investigator glowing forearm holographic wrist pad (left arm)
      if (isInv && side === -1) {
        const wristPad = new THREE.Mesh(track(new THREE.BoxGeometry(0.056, 0.085, 0.02)), glowAccentMat);
        wristPad.position.set(-0.022, -0.18, 0.035);
        elbow.add(wristPad);
      }

      // Culprit holds glowing crimson unauthorized extraction drive
      if (isRogue && side === -1) {
        const driveBody = new THREE.Mesh(track(new THREE.BoxGeometry(0.055, 0.028, 0.11)), visorFrameMat);
        driveBody.position.set(0, -0.32, 0.05);
        const driveLed = new THREE.Mesh(track(new THREE.BoxGeometry(0.04, 0.016, 0.06)), glowAccentMat);
        driveLed.position.set(0, -0.305, 0.06);
        elbow.add(driveBody, driveLed);
      }

      // NPC Lab Scientist holds a glowing diagnostic tablet
      if (isSci && side === 1) {
        const tabFrame = new THREE.Mesh(track(new THREE.BoxGeometry(0.16, 0.018, 0.22)), visorFrameMat);
        tabFrame.position.set(-0.04, -0.31, 0.09);
        tabFrame.rotation.x = -0.35;
        const tabGlow = new THREE.Mesh(track(new THREE.BoxGeometry(0.13, 0.012, 0.18)), glowAccentMat);
        tabGlow.position.set(-0.04, -0.3, 0.09);
        tabGlow.rotation.x = -0.35;
        elbow.add(tabFrame, tabGlow);
      }

      return { shoulder, elbow };
    };

    const leftArm = buildArm(-1);
    this.leftShoulder = leftArm.shoulder;
    this.leftElbow = leftArm.elbow;

    const rightArm = buildArm(1);
    this.rightShoulder = rightArm.shoulder;
    this.rightElbow = rightArm.elbow;

    // =========================================================================
    // LEGS (Hip -> Capsule Thigh -> Knee -> Capsule Shin -> Ankle -> Sleek Boot)
    // =========================================================================
    const thighGeo = track(new THREE.CapsuleGeometry(0.068, 0.31, 6, 10));
    const shinGeo = track(new THREE.CapsuleGeometry(0.052, 0.32, 6, 10));
    const shoeUpperGeo = track(new THREE.BoxGeometry(0.1, 0.072, 0.235));
    const shoeSoleGeo = track(new THREE.BoxGeometry(0.11, 0.028, 0.248));

    const buildLeg = (side: -1 | 1) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.098, -0.04, 0);
      this.pelvis.add(hip);

      const thigh = makeMesh(thighGeo, trouserMat);
      thigh.position.y = -0.22;
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.y = -0.44;
      hip.add(knee);

      const shin = makeMesh(shinGeo, trouserMat);
      shin.position.y = -0.21;
      knee.add(shin);

      const ankle = new THREE.Group();
      ankle.position.y = -0.42;
      knee.add(ankle);

      const shoe = makeMesh(shoeUpperGeo, shoeMat);
      shoe.position.set(0, -0.01, 0.048);
      ankle.add(shoe);

      const sole = makeMesh(shoeSoleGeo, soleMat);
      sole.position.set(0, -0.048, 0.048);
      ankle.add(sole);

      return { hip, knee, ankle };
    };

    const leftLeg = buildLeg(-1);
    this.leftHip = leftLeg.hip;
    this.leftKnee = leftLeg.knee;
    this.leftAnkle = leftLeg.ankle;

    const rightLeg = buildLeg(1);
    this.rightHip = rightLeg.hip;
    this.rightKnee = rightLeg.knee;
    this.rightAnkle = rightLeg.ankle;
  }

  public update(dt: number, input: CharacterAnimationInput) {
    const {
      speed,
      isRunning,
      isGrounded,
      verticalVelocity,
      turnRate,
      interactPulse,
      isTypingCinematic,
      isShockedCinematic,
      elapsedSec,
    } = input;

    if (isGrounded && !this.wasGrounded) {
      this.landingSquash = 1.0;
    }
    this.wasGrounded = isGrounded;
    this.landingSquash = THREE.MathUtils.damp(this.landingSquash, 0, 12, dt);
    this.smoothSpeed = THREE.MathUtils.damp(this.smoothSpeed, speed, 10, dt);

    // Advance stride directly proportional to real distance covered -> zero foot sliding
    const isMoving = this.smoothSpeed > 0.12 && isGrounded;
    if (isMoving) {
      const strideFactor = isRunning ? 1.62 : 1.72;
      this.stridePhase += this.smoothSpeed * dt * strideFactor;
    }

    const moveBlend = isGrounded ? THREE.MathUtils.clamp(this.smoothSpeed / 4.0, 0, 1) : 0;
    const runBlend = isGrounded && isRunning ? THREE.MathUtils.clamp((this.smoothSpeed - 3.0) / 4.0, 0, 1) : 0;

    let pelvisY = 0.94 - this.landingSquash * 0.075;
    let pelvisRoll = 0;
    let pelvisX = 0;
    let torsoPitch = 0;
    let torsoYaw = 0;
    let torsoRoll = 0;
    let headYaw = 0;
    let headPitch = 0;

    let lHipX = 0;
    let lKneeX = 0;
    let lAnkleX = 0;
    let rHipX = 0;
    let rKneeX = 0;
    let rAnkleX = 0;

    let lShX = 0;
    let lShZ = 0.07;
    let lElbX = -0.14;
    let rShX = 0;
    let rShZ = -0.07;
    let rElbX = -0.14;

    let flapLX = 0;
    let flapRX = 0;

    if (!isGrounded) {
      const riseFactor = THREE.MathUtils.clamp(verticalVelocity / 7.5, -1, 1);
      torsoPitch = 0.11 - riseFactor * 0.06;
      lHipX = -0.44 - riseFactor * 0.18;
      lKneeX = 0.74;
      lAnkleX = 0.22;
      rHipX = 0.24 - riseFactor * 0.1;
      rKneeX = 0.45;
      rAnkleX = 0.15;
      lShX = -0.58 - riseFactor * 0.32;
      lShZ = 0.3;
      lElbX = -0.46;
      rShX = -0.5 - riseFactor * 0.32;
      rShZ = -0.3;
      rElbX = -0.46;
      flapLX = -0.22;
      flapRX = -0.18;
    } else if (isTypingCinematic) {
      const typeL = Math.sin(elapsedSec * 15.0) * 0.085;
      const typeR = Math.cos(elapsedSec * 17.5) * 0.085;
      torsoPitch = 0.13 + Math.sin(elapsedSec * 2.1) * 0.02;
      headPitch = 0.15 + Math.sin(elapsedSec * 1.4) * 0.04;
      headYaw = Math.sin(elapsedSec * 0.9) * 0.15;
      lShX = -0.92 + typeL;
      lShZ = -0.1;
      lElbX = -0.68 - typeL * 0.5;
      rShX = -0.95 + typeR;
      rShZ = 0.1;
      rElbX = -0.65 - typeR * 0.5;
    } else if (isShockedCinematic) {
      torsoPitch = -0.16;
      headPitch = -0.18;
      headYaw = Math.sin(elapsedSec * 5.2) * 0.32;
      lShX = -0.88;
      lShZ = 0.44;
      lElbX = -0.9;
      rShX = -0.84;
      rShZ = -0.44;
      rElbX = -0.9;
      lHipX = -0.18;
      lKneeX = 0.25;
      rHipX = 0.22;
      rKneeX = 0.18;
    } else if (moveBlend > 0.03) {
      const sinP = Math.sin(this.stridePhase);
      const cosP = Math.cos(this.stridePhase);
      const legAmp = THREE.MathUtils.lerp(0.6, 1.02, runBlend) * moveBlend;
      const armAmp = THREE.MathUtils.lerp(0.54, 1.08, runBlend) * moveBlend;

      // Natural human weight-shift vertical bounce & gentle pelvic sway
      const bobAmp = THREE.MathUtils.lerp(0.034, 0.068, runBlend) * moveBlend;
      pelvisY += Math.abs(sinP) * bobAmp - bobAmp * 0.38;
      pelvisX = cosP * 0.022 * moveBlend;
      pelvisRoll = sinP * THREE.MathUtils.lerp(0.035, 0.06, runBlend) * moveBlend;

      lHipX = sinP * legAmp;
      rHipX = -sinP * legAmp;
      lKneeX = Math.max(0, -cosP) * THREE.MathUtils.lerp(0.68, 1.28, runBlend) * moveBlend + 0.05;
      rKneeX = Math.max(0, cosP) * THREE.MathUtils.lerp(0.68, 1.28, runBlend) * moveBlend + 0.05;

      // Natural ankle push-off & heel-strike pitch
      lAnkleX = Math.max(0, cosP) * 0.26 * moveBlend - Math.max(0, -sinP) * 0.16 * moveBlend;
      rAnkleX = Math.max(0, -cosP) * 0.26 * moveBlend - Math.max(0, sinP) * 0.16 * moveBlend;

      lShX = -sinP * armAmp;
      rShX = sinP * armAmp;
      lShZ = 0.09 + runBlend * 0.05;
      rShZ = -0.09 - runBlend * 0.05;
      lElbX = -THREE.MathUtils.lerp(0.28, 1.05, runBlend) - Math.max(0, sinP) * 0.25;
      rElbX = -THREE.MathUtils.lerp(0.28, 1.05, runBlend) - Math.max(0, -sinP) * 0.25;

      // Athletic forward lean + smooth banking into turns
      torsoPitch = THREE.MathUtils.lerp(0.06, 0.2, runBlend) * moveBlend;
      torsoYaw = -sinP * THREE.MathUtils.lerp(0.09, 0.17, runBlend) * moveBlend;
      torsoRoll = THREE.MathUtils.clamp(-turnRate * 0.065, -0.15, 0.15) - pelvisRoll * 0.6;
      headYaw = THREE.MathUtils.clamp(turnRate * 0.14, -0.36, 0.36);

      flapLX = Math.min(0.18, lHipX * 0.55) - runBlend * 0.12;
      flapRX = Math.min(0.18, rHipX * 0.55) - runBlend * 0.12;
    } else {
      // Natural relaxed breathing & observant head glance
      const breath = Math.sin(elapsedSec * 2.0);
      pelvisY += breath * 0.007;
      torsoPitch = breath * 0.014;
      headYaw = Math.sin(elapsedSec * 0.58) * 0.15 + THREE.MathUtils.clamp(turnRate * 0.14, -0.3, 0.3);
      headPitch = Math.sin(elapsedSec * 0.85) * 0.028;
      lShZ = 0.08 + breath * 0.014;
      rShZ = -0.08 - breath * 0.014;
      lElbX = -0.16;
      rElbX = -0.16;
      lKneeX = 0.035;
      rKneeX = 0.035;
    }

    if (interactPulse > 0.01) {
      const p = Math.sin(interactPulse * Math.PI);
      rShX = THREE.MathUtils.lerp(rShX, -1.16, p);
      rShZ = THREE.MathUtils.lerp(rShZ, 0.06, p);
      rElbX = THREE.MathUtils.lerp(rElbX, -0.42, p);
      torsoPitch = THREE.MathUtils.lerp(torsoPitch, 0.12, p);
    }

    const k = 15;
    this.pelvis.position.y = THREE.MathUtils.damp(this.pelvis.position.y, pelvisY, k, dt);
    this.pelvis.position.x = THREE.MathUtils.damp(this.pelvis.position.x, pelvisX, k, dt);
    this.pelvis.rotation.z = THREE.MathUtils.damp(this.pelvis.rotation.z, pelvisRoll, k, dt);

    this.torso.rotation.x = THREE.MathUtils.damp(this.torso.rotation.x, torsoPitch, k, dt);
    this.torso.rotation.y = THREE.MathUtils.damp(this.torso.rotation.y, torsoYaw, k, dt);
    this.torso.rotation.z = THREE.MathUtils.damp(this.torso.rotation.z, torsoRoll, k, dt);

    this.headGroup.rotation.y = THREE.MathUtils.damp(this.headGroup.rotation.y, headYaw, k, dt);
    this.headGroup.rotation.x = THREE.MathUtils.damp(this.headGroup.rotation.x, headPitch, k, dt);

    this.leftHip.rotation.x = THREE.MathUtils.damp(this.leftHip.rotation.x, lHipX, k, dt);
    this.leftKnee.rotation.x = THREE.MathUtils.damp(this.leftKnee.rotation.x, lKneeX, k, dt);
    this.leftAnkle.rotation.x = THREE.MathUtils.damp(this.leftAnkle.rotation.x, lAnkleX, k, dt);

    this.rightHip.rotation.x = THREE.MathUtils.damp(this.rightHip.rotation.x, rHipX, k, dt);
    this.rightKnee.rotation.x = THREE.MathUtils.damp(this.rightKnee.rotation.x, rKneeX, k, dt);
    this.rightAnkle.rotation.x = THREE.MathUtils.damp(this.rightAnkle.rotation.x, rAnkleX, k, dt);

    this.leftShoulder.rotation.x = THREE.MathUtils.damp(this.leftShoulder.rotation.x, lShX, k, dt);
    this.leftShoulder.rotation.z = THREE.MathUtils.damp(this.leftShoulder.rotation.z, lShZ, k, dt);
    this.leftElbow.rotation.x = THREE.MathUtils.damp(this.leftElbow.rotation.x, lElbX, k, dt);

    this.rightShoulder.rotation.x = THREE.MathUtils.damp(this.rightShoulder.rotation.x, rShX, k, dt);
    this.rightShoulder.rotation.z = THREE.MathUtils.damp(this.rightShoulder.rotation.z, rShZ, k, dt);
    this.rightElbow.rotation.x = THREE.MathUtils.damp(this.rightElbow.rotation.x, rElbX, k, dt);

    this.coatFlapL.rotation.x = THREE.MathUtils.damp(this.coatFlapL.rotation.x, flapLX, k, dt);
    this.coatFlapR.rotation.x = THREE.MathUtils.damp(this.coatFlapR.rotation.x, flapRX, k, dt);

    const heightAboveFloor = Math.max(0, this.root.position.y);
    this.contactShadow.position.y = 0.022 - heightAboveFloor;
    const shadowScale = Math.max(0.45, 1 - heightAboveFloor * 0.16);
    this.contactShadow.scale.setScalar(shadowScale);
    (this.contactShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.18, 0.85 - heightAboveFloor * 0.18);
  }

  public dispose() {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
