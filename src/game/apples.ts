/**
 * Floating Apples System (Iconic to Ragdoll Archers)
 * - Red Apple: Restores Health (HP)
 * - Green Apple: Restores Stamina
 * - Golden Apple: Restores both Health and Stamina + Bonus Skulls!
 */

import Matter from 'matter-js';
import { COLLISION_CATEGORIES } from './physics';

const { Bodies, Composite, Body } = Matter;

export type AppleType = 'red' | 'green' | 'gold';

export class FloatingApple {
  public id: string;
  public body: Matter.Body;
  public type: AppleType;
  public radius: number = 14;
  public isPopped: boolean = false;
  public bobOffset: number;
  public bobSpeed: number;
  public vx: number;
  public spawnTime: number = performance.now();

  constructor(world: Matter.World, x: number, y: number, type: AppleType = 'red') {
    this.id = Math.random().toString();
    this.type = type;
    this.bobOffset = Math.random() * Math.PI * 2;
    this.bobSpeed = 0.003 + Math.random() * 0.002;
    this.vx = -(0.8 + Math.random() * 0.6); // Drifts slowly right to left across the battlefield

    this.body = Bodies.circle(x, y, this.radius, {
      isStatic: false,
      frictionAir: 0.02,
      collisionFilter: {
        category: COLLISION_CATEGORIES.APPLE,
        mask: COLLISION_CATEGORIES.PLAYER_ARROW | COLLISION_CATEGORIES.ENEMY_ARROW,
      },
      label: 'apple',
    });

    // Zero out gravity on the apple so it floats like a balloon
    Body.setMass(this.body, 0.01);
    this.body.customApple = this;

    Composite.add(world, this.body);
  }

  public update(now: number) {
    if (this.isPopped) return;
    // Gentle floating bob motion
    const bobY = Math.sin(now * this.bobSpeed + this.bobOffset) * 0.8;
    Body.setVelocity(this.body, { x: this.vx, y: bobY });
  }

  public destroy(world: Matter.World) {
    if (this.isPopped) return;
    this.isPopped = true;
    Composite.remove(world, this.body);
  }
}

// Extend declaration for custom property
declare module 'matter-js' {
  interface Body {
    customApple?: FloatingApple;
    customRagdoll?: unknown;
    customArrow?: unknown;
    customMeta?: unknown;
  }
}
