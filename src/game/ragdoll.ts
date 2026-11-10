/**
 * Ragdoll Physics Character System - Stickman Aesthetic for Ragdoll Archers
 * 
 * - Articulated stickman ragdoll bodies with responsive limb physics.
 * - Jump ability (Spacebar) to dodge incoming arrows mid-air.
 * - Stamina management for drawing bows.
 * - Floppy collapse upon defeat.
 */

import Matter from 'matter-js';
import { COLLISION_CATEGORIES, BodyPartMetadata } from './physics';

const { Bodies, Body, Composite, Constraint } = Matter;

export interface RagdollOptions {
  id: string;
  x: number;
  y: number;
  scale?: number;
  isPlayer?: boolean;
  isBoss?: boolean;
  colorTheme?: {
    primary: string;    // Stickman body color
    accent: string;     // Headband / armor accent
    helmet?: string;
  };
  maxHealth?: number;
  maxStamina?: number;
  hasShield?: boolean;
}

export class Ragdoll {
  public id: string;
  public composite: Matter.Composite;
  public isPlayer: boolean;
  public isBoss: boolean;
  public isAlive: boolean = true;
  public isCollapsed: boolean = false;
  public health: number;
  public maxHealth: number;
  public stamina: number;
  public maxStamina: number;
  public hasShield: boolean;
  public scale: number;

  // Key stickman body parts
  public head: Matter.Body;
  public torso: Matter.Body;
  public pelvis: Matter.Body;
  public leftUpperArm: Matter.Body;
  public leftForearm: Matter.Body;
  public rightUpperArm: Matter.Body;
  public rightForearm: Matter.Body;
  public leftThigh: Matter.Body;
  public leftShin: Matter.Body;
  public leftFoot: Matter.Body;
  public rightThigh: Matter.Body;
  public rightShin: Matter.Body;
  public rightFoot: Matter.Body;
  public shieldBody: Matter.Body | null = null;

  // Active posture stabilizer constraints
  public balanceConstraints: Matter.Constraint[] = [];
  public groundPinConstraint: Matter.Constraint | null = null;
  public spineConstraint: Matter.Constraint | null = null;

  public colorTheme: {
    primary: string;
    accent: string;
    helmet?: string;
  };

  // Aiming & Stamina state
  public aimAngle: number = 0;
  public bowDrawPower: number = 0;
  public lastHitTime: number = 0;
  public helmetPopped: boolean = false;
  public isGrounded: boolean = true;
  public lastJumpTime: number = 0;

  constructor(world: Matter.World, options: RagdollOptions) {
    this.id = options.id;
    this.isPlayer = !!options.isPlayer;
    this.isBoss = !!options.isBoss;
    this.scale = options.scale || (this.isBoss ? 1.35 : 1.0);
    this.maxHealth = options.maxHealth || (this.isPlayer ? 120 : this.isBoss ? 280 : 80);
    this.health = this.maxHealth;
    this.maxStamina = options.maxStamina || 100;
    this.stamina = this.maxStamina;
    this.hasShield = !!options.hasShield;

    // Classic stickman color themes
    this.colorTheme = options.colorTheme || (this.isPlayer ? {
      primary: '#f8fafc',  // Crisp white stickman
      accent: '#10b981',   // Emerald headband
      helmet: '#38bdf8',
    } : this.isBoss ? {
      primary: '#9333ea',  // Purple King stickman
      accent: '#fbbf24',   // Gold Crown
      helmet: '#eab308',
    } : {
      primary: '#ef4444',  // Crimson stickman
      accent: '#7f1d1d',   // Dark iron band
      helmet: '#64748b',   // Steel helmet
    });

    const x = options.x;
    const y = options.y;
    const s = this.scale;

    const groupId = -Math.abs(this.hashString(this.id));
    const categoryLimb = this.isPlayer ? COLLISION_CATEGORIES.PLAYER_LIMB : COLLISION_CATEGORIES.ENEMY_LIMB;
    const maskLimb = COLLISION_CATEGORIES.GROUND | (this.isPlayer ? COLLISION_CATEGORIES.ENEMY_ARROW : COLLISION_CATEGORIES.PLAYER_ARROW);

    const limbFilter: Matter.ICollisionFilter = {
      group: groupId,
      category: categoryLimb,
      mask: maskLimb,
    };

    // 1. HEAD (Stickman circle head)
    const headRadius = 14 * s;
    this.head = Bodies.circle(x, y - 50 * s, headRadius, {
      collisionFilter: limbFilter,
      friction: 0.6,
      restitution: 0.2,
      density: 0.002,
      label: 'head',
    });
    this.attachMetadata(this.head, 'head', 3.5);

    // 2. TORSO / SPINE (Stickman chest)
    this.torso = Bodies.rectangle(x, y - 22 * s, 14 * s, 34 * s, {
      collisionFilter: limbFilter,
      friction: 0.8,
      density: 0.003,
      chamfer: { radius: 6 * s },
      label: 'torso',
    });
    this.attachMetadata(this.torso, 'torso', 1.0);

    // 3. PELVIS / HIPS
    this.pelvis = Bodies.rectangle(x, y + 2 * s, 14 * s, 14 * s, {
      collisionFilter: limbFilter,
      friction: 0.8,
      density: 0.003,
      chamfer: { radius: 4 * s },
      label: 'pelvis',
    });
    this.attachMetadata(this.pelvis, 'pelvis', 1.0);

    // 4. ARMS (Stickman limbs)
    const armW = 7 * s;
    this.leftUpperArm = Bodies.rectangle(x - 4 * s, y - 28 * s, armW, 22 * s, {
      collisionFilter: limbFilter,
      density: 0.0015,
      chamfer: { radius: 3 * s },
      label: 'armUpper',
    });
    this.attachMetadata(this.leftUpperArm, 'armUpper', 0.6);

    this.leftForearm = Bodies.rectangle(x - 4 * s, y - 9 * s, armW, 20 * s, {
      collisionFilter: limbFilter,
      density: 0.0015,
      chamfer: { radius: 3 * s },
      label: 'armLower',
    });
    this.attachMetadata(this.leftForearm, 'armLower', 0.5);

    this.rightUpperArm = Bodies.rectangle(x + 4 * s, y - 28 * s, armW, 22 * s, {
      collisionFilter: limbFilter,
      density: 0.0015,
      chamfer: { radius: 3 * s },
      label: 'armUpper',
    });
    this.attachMetadata(this.rightUpperArm, 'armUpper', 0.6);

    this.rightForearm = Bodies.rectangle(x + 4 * s, y - 9 * s, armW, 20 * s, {
      collisionFilter: limbFilter,
      density: 0.0015,
      chamfer: { radius: 3 * s },
      label: 'armLower',
    });
    this.attachMetadata(this.rightForearm, 'armLower', 0.5);

    // 5. LEGS
    const legW = 7 * s;
    this.leftThigh = Bodies.rectangle(x - 5 * s, y + 18 * s, legW, 24 * s, {
      collisionFilter: limbFilter,
      density: 0.0025,
      chamfer: { radius: 3 * s },
      label: 'legUpper',
    });
    this.attachMetadata(this.leftThigh, 'legUpper', 0.6);

    this.leftShin = Bodies.rectangle(x - 5 * s, y + 39 * s, legW, 24 * s, {
      collisionFilter: limbFilter,
      density: 0.0025,
      chamfer: { radius: 3 * s },
      label: 'legLower',
    });
    this.attachMetadata(this.leftShin, 'legLower', 0.5);

    this.leftFoot = Bodies.rectangle(x - 3 * s, y + 53 * s, 12 * s, 6 * s, {
      collisionFilter: limbFilter,
      friction: 1.0,
      label: 'foot',
    });
    this.attachMetadata(this.leftFoot, 'foot', 0.4);

    this.rightThigh = Bodies.rectangle(x + 5 * s, y + 18 * s, legW, 24 * s, {
      collisionFilter: limbFilter,
      density: 0.0025,
      chamfer: { radius: 3 * s },
      label: 'legUpper',
    });
    this.attachMetadata(this.rightThigh, 'legUpper', 0.6);

    this.rightShin = Bodies.rectangle(x + 5 * s, y + 39 * s, legW, 24 * s, {
      collisionFilter: limbFilter,
      density: 0.0025,
      chamfer: { radius: 3 * s },
      label: 'legLower',
    });
    this.attachMetadata(this.rightShin, 'legLower', 0.5);

    this.rightFoot = Bodies.rectangle(x + 5 * s, y + 53 * s, 12 * s, 6 * s, {
      collisionFilter: limbFilter,
      friction: 1.0,
      label: 'foot',
    });
    this.attachMetadata(this.rightFoot, 'foot', 0.4);

    // Optional Shield
    if (this.hasShield) {
      this.shieldBody = Bodies.rectangle(x - 18 * s, y - 10 * s, 12 * s, 44 * s, {
        collisionFilter: {
          group: groupId,
          category: COLLISION_CATEGORIES.SHIELD,
          mask: COLLISION_CATEGORIES.GROUND | COLLISION_CATEGORIES.PLAYER_ARROW,
        },
        friction: 0.5,
        density: 0.004,
        label: 'shield',
      });
      this.attachMetadata(this.shieldBody, 'shield', 0.1);
    }

    // 6. SKELETAL REVOLUTE CONSTRAINTS
    const jointStiffness = 0.95;
    const neck = Constraint.create({
      bodyA: this.torso,
      pointA: { x: 0, y: -17 * s },
      bodyB: this.head,
      pointB: { x: 0, y: 13 * s },
      stiffness: jointStiffness,
      length: 0,
    });

    const spine = Constraint.create({
      bodyA: this.torso,
      pointA: { x: 0, y: 17 * s },
      bodyB: this.pelvis,
      pointB: { x: 0, y: -7 * s },
      stiffness: jointStiffness,
      length: 0,
    });
    this.spineConstraint = spine;

    const leftShoulder = Constraint.create({
      bodyA: this.torso,
      pointA: { x: -7 * s, y: -13 * s },
      bodyB: this.leftUpperArm,
      pointB: { x: 0, y: -10 * s },
      stiffness: jointStiffness,
      length: 0,
    });

    const leftElbow = Constraint.create({
      bodyA: this.leftUpperArm,
      pointA: { x: 0, y: 10 * s },
      bodyB: this.leftForearm,
      pointB: { x: 0, y: -9 * s },
      stiffness: jointStiffness,
      length: 0,
    });

    const rightShoulder = Constraint.create({
      bodyA: this.torso,
      pointA: { x: 7 * s, y: -13 * s },
      bodyB: this.rightUpperArm,
      pointB: { x: 0, y: -10 * s },
      stiffness: jointStiffness,
      length: 0,
    });

    const rightElbow = Constraint.create({
      bodyA: this.rightUpperArm,
      pointA: { x: 0, y: 10 * s },
      bodyB: this.rightForearm,
      pointB: { x: 0, y: -9 * s },
      stiffness: jointStiffness,
      length: 0,
    });

    const leftHip = Constraint.create({
      bodyA: this.pelvis,
      pointA: { x: -5 * s, y: 7 * s },
      bodyB: this.leftThigh,
      pointB: { x: 0, y: -11 * s },
      stiffness: jointStiffness,
      length: 0,
    });

    const leftKnee = Constraint.create({
      bodyA: this.leftThigh,
      pointA: { x: 0, y: 11 * s },
      bodyB: this.leftShin,
      pointB: { x: 0, y: -11 * s },
      stiffness: jointStiffness,
      length: 0,
    });

    const leftAnkle = Constraint.create({
      bodyA: this.leftShin,
      pointA: { x: 0, y: 11 * s },
      bodyB: this.leftFoot,
      pointB: { x: 0, y: 0 },
      stiffness: jointStiffness,
      length: 0,
    });

    const rightHip = Constraint.create({
      bodyA: this.pelvis,
      pointA: { x: 5 * s, y: 7 * s },
      bodyB: this.rightThigh,
      pointB: { x: 0, y: -11 * s },
      stiffness: jointStiffness,
      length: 0,
    });

    const rightKnee = Constraint.create({
      bodyA: this.rightThigh,
      pointA: { x: 0, y: 11 * s },
      bodyB: this.rightShin,
      pointB: { x: 0, y: -11 * s },
      stiffness: jointStiffness,
      length: 0,
    });

    const rightAnkle = Constraint.create({
      bodyA: this.rightShin,
      pointA: { x: 0, y: 11 * s },
      bodyB: this.rightFoot,
      pointB: { x: 0, y: 0 },
      stiffness: jointStiffness,
      length: 0,
    });

    const constraints = [
      neck, spine,
      leftShoulder, leftElbow,
      rightShoulder, rightElbow,
      leftHip, leftKnee, leftAnkle,
      rightHip, rightKnee, rightAnkle,
    ];

    if (this.shieldBody) {
      const shieldJoint = Constraint.create({
        bodyA: this.leftForearm,
        pointA: { x: 0, y: 0 },
        bodyB: this.shieldBody,
        pointB: { x: 0, y: 0 },
        stiffness: 0.98,
        length: 0,
      });
      constraints.push(shieldJoint);
    }

    // 7. ACTIVE POSTURE STABILIZER
    this.groundPinConstraint = Constraint.create({
      pointA: { x, y: y + 2 * s },
      bodyB: this.pelvis,
      pointB: { x: 0, y: 0 },
      stiffness: 0.14,
      damping: 0.15,
      length: 0,
    });

    const uprightChest = Constraint.create({
      pointA: { x, y: y - 28 * s },
      bodyB: this.torso,
      pointB: { x: 0, y: -10 * s },
      stiffness: 0.08,
      damping: 0.12,
      length: 0,
    });

    this.balanceConstraints = [this.groundPinConstraint, uprightChest];

    const allBodies: Matter.Body[] = [
      this.head, this.torso, this.pelvis,
      this.leftUpperArm, this.leftForearm,
      this.rightUpperArm, this.rightForearm,
      this.leftThigh, this.leftShin, this.leftFoot,
      this.rightThigh, this.rightShin, this.rightFoot,
    ];
    if (this.shieldBody) allBodies.push(this.shieldBody);

    this.composite = Composite.create({
      label: `ragdoll_${this.id}`,
      bodies: allBodies,
      constraints: [...constraints, ...this.balanceConstraints],
    });

    Composite.add(world, this.composite);
  }

  private attachMetadata(body: Matter.Body, type: BodyPartMetadata['type'], damageMultiplier: number) {
    const meta: BodyPartMetadata = {
      type,
      ragdollId: this.id,
      isPlayer: this.isPlayer,
      damageMultiplier,
    };
    (body as unknown as { customMeta: BodyPartMetadata }).customMeta = meta;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash || 1;
  }

  /**
   * Jump mechanic (Spacebar in Ragdoll Archers)
   */
  public jump(): boolean {
    if (!this.isAlive || this.isCollapsed) return false;
    const now = performance.now();
    if (now - this.lastJumpTime < 650) return false; // Jump cooldown
    this.lastJumpTime = now;

    // Apply upward-forward leap impulse
    const jumpImpulse = -0.045 * this.scale;
    Body.applyForce(this.pelvis, this.pelvis.position, { x: 0.005, y: jumpImpulse });
    Body.applyForce(this.torso, this.torso.position, { x: 0.005, y: jumpImpulse * 0.8 });

    // Slightly loosen pin temporarily to allow jump height
    if (this.groundPinConstraint) {
      this.groundPinConstraint.stiffness = 0.02;
      setTimeout(() => {
        if (this.groundPinConstraint && this.isAlive) {
          this.groundPinConstraint.stiffness = 0.14;
        }
      }, 450);
    }
    return true;
  }

  public takeDamage(amount: number, world: Matter.World, isHeadshot: boolean = false): boolean {
    if (!this.isAlive) return false;

    this.health = Math.max(0, this.health - amount);
    this.lastHitTime = performance.now();

    if (isHeadshot) {
      this.helmetPopped = true;
    }

    if (this.health <= 0) {
      this.collapse(world);
      return true;
    }

    if (amount > 35) {
      this.softenPosture();
    }

    return false;
  }

  public collapse(world: Matter.World) {
    if (this.isCollapsed) return;
    this.isAlive = false;
    this.isCollapsed = true;

    for (const c of this.balanceConstraints) {
      Composite.remove(this.composite, c);
    }
    this.balanceConstraints = [];
    this.groundPinConstraint = null;

    // Soften limbs so they flop in uncontrolled, funny ways
    for (const c of this.composite.constraints) {
      c.stiffness = 0.35;
      c.damping = 0.02;
    }

    Body.applyForce(this.torso, this.torso.position, {
      x: (this.isPlayer ? -1 : 1) * (0.015 + Math.random() * 0.02),
      y: -0.015,
    });
  }

  public softenPosture() {
    if (this.groundPinConstraint) {
      this.groundPinConstraint.stiffness = 0.03;
      setTimeout(() => {
        if (this.groundPinConstraint && this.isAlive) {
          this.groundPinConstraint.stiffness = 0.14;
        }
      }, 400);
    }
  }

  public updateAim(aimAngle: number, drawPower: number) {
    if (!this.isAlive || this.isCollapsed) return;

    this.aimAngle = aimAngle;
    this.bowDrawPower = drawPower;

    const forwardArmAngle = aimAngle;
    Body.setAngle(this.leftUpperArm, forwardArmAngle);
    Body.setAngle(this.leftForearm, forwardArmAngle);

    const pullBackOffset = 0.35 * (1 - drawPower);
    Body.setAngle(this.rightUpperArm, forwardArmAngle - 0.4 + pullBackOffset);
    Body.setAngle(this.rightForearm, forwardArmAngle + 0.3 - drawPower * 0.5);

    Body.setAngle(this.head, aimAngle * 0.3);
  }

  public getBowHandPosition(): { x: number; y: number } {
    const arm = this.leftForearm;
    const len = 14 * this.scale;
    return {
      x: arm.position.x + Math.cos(this.aimAngle) * len,
      y: arm.position.y + Math.sin(this.aimAngle) * len,
    };
  }

  public destroy(world: Matter.World) {
    Composite.remove(world, this.composite);
  }
}
