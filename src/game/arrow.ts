/**
 * Arrow Physics and Ballistics System for Ragdoll Archers
 * Supports:
 * - Standard Wooden Arrow
 * - Electric Arrow (Chain shock sparks)
 * - Poison Arrow (Toxic damage over time)
 * - Explosive Arrow (Detonates with area knockback blast)
 * - Triple Spread Arrow
 */

import Matter from 'matter-js';
import { COLLISION_CATEGORIES } from './physics';
import { ParticleSystem } from './particles';

const { Bodies, Body, Composite, Constraint } = Matter;

export type ArrowType = 'standard' | 'electric' | 'poison' | 'explosive' | 'triple';

export interface ArrowOptions {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isPlayer: boolean;
  type?: ArrowType;
  damage?: number;
}

export class Arrow {
  public id: string;
  public body: Matter.Body;
  public isPlayer: boolean;
  public type: ArrowType;
  public damage: number;
  public isStuck: boolean = false;
  public stuckConstraint: Matter.Constraint | null = null;
  public stuckToBody: Matter.Body | null = null;
  public spawnTime: number = performance.now();
  public lifeTime: number = 14000;
  public isDestroyed: boolean = false;

  constructor(world: Matter.World, options: ArrowOptions) {
    this.id = options.id;
    this.isPlayer = options.isPlayer;
    this.type = options.type || 'standard';
    this.damage = options.damage || 45;

    const angle = Math.atan2(options.vy, options.vx);
    const length = 46;
    const thickness = 4;

    const category = this.isPlayer ? COLLISION_CATEGORIES.PLAYER_ARROW : COLLISION_CATEGORIES.ENEMY_ARROW;
    const mask = COLLISION_CATEGORIES.GROUND |
      (this.isPlayer ? COLLISION_CATEGORIES.ENEMY_LIMB : COLLISION_CATEGORIES.PLAYER_LIMB) |
      COLLISION_CATEGORIES.SHIELD |
      COLLISION_CATEGORIES.APPLE |
      (this.isPlayer ? COLLISION_CATEGORIES.ENEMY_ARROW : COLLISION_CATEGORIES.PLAYER_ARROW);

    this.body = Bodies.rectangle(options.x, options.y, length, thickness, {
      angle,
      frictionAir: 0.0015,
      friction: 0.8,
      density: 0.004,
      collisionFilter: {
        category,
        mask,
      },
      label: this.isPlayer ? 'player_arrow' : 'enemy_arrow',
    });

    Body.setVelocity(this.body, { x: options.vx, y: options.vy });
    this.body.customArrow = this;

    Composite.add(world, this.body);
  }

  public updateAerodynamics(particleSystem?: ParticleSystem) {
    if (this.isStuck || this.isDestroyed) return;

    const vx = this.body.velocity.x;
    const vy = this.body.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);

    if (speed > 1.2) {
      const targetAngle = Math.atan2(vy, vx);
      Body.setAngle(this.body, targetAngle);

      if (particleSystem && Math.random() > 0.25) {
        const tailX = this.body.position.x - Math.cos(targetAngle) * 20;
        const tailY = this.body.position.y - Math.sin(targetAngle) * 20;

        if (this.type === 'electric') {
          particleSystem.emitElectricSparks(tailX, tailY, 2);
        } else if (this.type === 'poison') {
          particleSystem.emitArrowTrail(tailX, tailY, 'rgba(34, 197, 94, 0.75)', 3.5);
        } else if (this.type === 'explosive') {
          particleSystem.emitArrowTrail(tailX, tailY, 'rgba(249, 115, 22, 0.8)', 4);
        } else {
          particleSystem.emitArrowTrail(tailX, tailY, 'rgba(255, 255, 255, 0.3)', 2);
        }
      }
    }
  }

  public stickInto(targetBody: Matter.Body, contactPoint: { x: number; y: number }, world: Matter.World) {
    if (this.isStuck || this.isDestroyed) return;
    this.isStuck = true;
    this.stuckToBody = targetBody;

    this.body.collisionFilter.category = 0;
    this.body.collisionFilter.mask = 0;

    const currentAngle = this.body.angle;
    const embedDepth = 8;
    Body.setPosition(this.body, {
      x: contactPoint.x + Math.cos(currentAngle) * (20 - embedDepth),
      y: contactPoint.y + Math.sin(currentAngle) * (20 - embedDepth),
    });

    Body.setVelocity(this.body, { x: 0, y: 0 });
    Body.setAngularVelocity(this.body, 0);

    if (targetBody.isStatic) {
      Body.setStatic(this.body, true);
    } else {
      const localPoint = {
        x: contactPoint.x - targetBody.position.x,
        y: contactPoint.y - targetBody.position.y,
      };

      this.stuckConstraint = Constraint.create({
        bodyA: targetBody,
        pointA: localPoint,
        bodyB: this.body,
        pointB: { x: 14, y: 0 },
        stiffness: 0.95,
        damping: 0.05,
        length: 0,
      });

      Composite.add(world, this.stuckConstraint);
    }
  }

  public destroy(world: Matter.World) {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this.stuckConstraint) {
      Composite.remove(world, this.stuckConstraint);
      this.stuckConstraint = null;
    }
    Composite.remove(world, this.body);
  }
}
