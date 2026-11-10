/**
 * Enemy AI Controller for Ragdoll Archers.
 * Calculates ballistic trajectory arcs towards the player, simulates bow draw timing,
 * and handles interrupt/stagger when hit mid-draw.
 */

import { Ragdoll } from './ragdoll';
import { ArrowType } from './arrow';

export interface EnemyAIConfig {
  drawDuration: number;    // Milliseconds to draw the bow
  cooldownDuration: number; // Milliseconds between shots
  accuracyNoise: number;   // Radians of aim error (lower = deadlier)
  projectileSpeed: number; // Arrow launch velocity
  arrowType?: ArrowType;
}

export class EnemyAI {
  public ragdoll: Ragdoll;
  public config: EnemyAIConfig;
  public state: 'idle' | 'drawing' | 'shoot';
  public timer: number = 0;
  public drawProgress: number = 0;
  public calculatedAngle: number = Math.PI; // Default facing left towards player
  public onShootCallback?: (ragdoll: Ragdoll, angle: number, speed: number) => void;

  constructor(ragdoll: Ragdoll, config?: Partial<EnemyAIConfig>) {
    this.ragdoll = ragdoll;
    this.config = {
      drawDuration: 900,
      cooldownDuration: 2200 + Math.random() * 1200,
      accuracyNoise: 0.1,
      projectileSpeed: 23,
      arrowType: 'standard',
      ...config,
    };
    this.state = 'idle';
    // Offset initial timer so all enemies don't fire at the exact same millisecond
    this.timer = Math.random() * 1200;
  }

  public update(dt: number, playerRagdoll: Ragdoll | null) {
    if (!this.ragdoll.isAlive || this.ragdoll.isCollapsed || !playerRagdoll) {
      return;
    }

    this.timer += dt;

    // Calculate aim target (player head or chest)
    const shooterPos = this.ragdoll.torso.position;
    const targetPos = playerRagdoll.torso.position;

    const dx = targetPos.x - shooterPos.x;
    const dy = targetPos.y - shooterPos.y;
    const dist = Math.hypot(dx, dy);

    // Ballistic trajectory estimation: compensate for gravity arc
    // Gravity pulls arrow down, so archer needs to aim slightly higher
    const speed = this.config.projectileSpeed;
    const gravity = 0.7; // Matter.js world gravity factor
    const timeInAir = dist / speed;
    const drop = 0.5 * gravity * (timeInAir * timeInAir) * 0.15;

    // Aim above target by drop amount
    const aimTargetY = targetPos.y - drop;
    const baseAngle = Math.atan2(aimTargetY - shooterPos.y, dx);

    if (this.state === 'idle') {
      this.drawProgress = 0;
      this.ragdoll.updateAim(baseAngle, 0);

      if (this.timer >= this.config.cooldownDuration) {
        this.state = 'drawing';
        this.timer = 0;
      }
    } else if (this.state === 'drawing') {
      this.drawProgress = Math.min(1.0, this.timer / this.config.drawDuration);

      // Smooth aim adjustment while drawing
      this.ragdoll.updateAim(baseAngle, this.drawProgress);

      if (this.timer >= this.config.drawDuration) {
        // Fire arrow with configured accuracy
        const finalAngle = baseAngle + (Math.random() - 0.5) * this.config.accuracyNoise;
        this.onShootCallback?.(this.ragdoll, finalAngle, speed);

        this.state = 'idle';
        this.timer = 0;
        this.drawProgress = 0;
        this.ragdoll.updateAim(baseAngle, 0);
      }
    }
  }

  /**
   * Interrupts draw if the archer takes a hard hit
   */
  public interrupt() {
    if (this.state === 'drawing') {
      this.state = 'idle';
      this.timer = 0;
      this.drawProgress = 0;
    }
  }
}
