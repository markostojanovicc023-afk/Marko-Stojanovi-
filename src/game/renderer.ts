/**
 * Canvas 2D Renderer for Ragdoll Archers.
 * Authentic Crazy Games style:
 * - Minimalist dark arena with subtle grid lines
 * - Crisp stickman characters with round joints and capsule limbs
 * - Health (Red) and Stamina (Blue) status bars
 * - Floating Apples (Red, Green, Gold)
 * - Skulls, dynamic bows, and parabolic trajectory preview dots
 */

import Matter from 'matter-js';
import { Ragdoll } from './ragdoll';
import { Arrow } from './arrow';
import { FloatingApple } from './apples';

export class GameRenderer {
  public ctx: CanvasRenderingContext2D;
  public width: number = 0;
  public height: number = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Minimalist Dark Arena with subtle tactical grid
   */
  public renderBackground(platforms: Matter.Body[]) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 1. Dark charcoal/slate gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#101520');
    skyGrad.addColorStop(0.7, '#0c0f17');
    skyGrad.addColorStop(1, '#07090e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Subtle Arena Grid Lines
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.lineWidth = 1;

    const gridSize = 50;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Distance marker numbers along bottom
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    for (let x = 100; x < w; x += 100) {
      ctx.fillText(`${x}m`, x, h - 10);
    }
    ctx.restore();

    // 3. Render Platforms and Ground
    for (const p of platforms) {
      this.drawPlatform(ctx, p);
    }
  }

  private drawPlatform(ctx: CanvasRenderingContext2D, body: Matter.Body) {
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);

    const bounds = body.bounds;
    const w = bounds.max.x - bounds.min.x;
    const h = bounds.max.y - bounds.min.y;

    // Dark slate platform slab
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 4);
    ctx.fill();

    // Vibrant accent boundary strip along the top
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-w / 2, -h / 2, w, 3);

    // Inner bevel
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    ctx.restore();
  }

  /**
   * Render Stickman Character (Player or Enemy)
   */
  public renderRagdoll(ragdoll: Ragdoll) {
    const ctx = this.ctx;
    const { primary, accent, helmet } = ragdoll.colorTheme;
    const s = ragdoll.scale;

    // Back limbs
    this.drawStickLimb(ctx, ragdoll.rightThigh, primary, 7 * s);
    this.drawStickLimb(ctx, ragdoll.rightShin, primary, 6 * s);
    this.drawJoint(ctx, ragdoll.rightFoot.position.x, ragdoll.rightFoot.position.y, 4.5 * s, primary);

    // Front legs
    this.drawStickLimb(ctx, ragdoll.leftThigh, primary, 7.5 * s);
    this.drawStickLimb(ctx, ragdoll.leftShin, primary, 6.5 * s);
    this.drawJoint(ctx, ragdoll.leftFoot.position.x, ragdoll.leftFoot.position.y, 5 * s, primary);

    // Pelvis & Spine
    this.drawStickLimb(ctx, ragdoll.pelvis, primary, 8 * s);
    this.drawStickLimb(ctx, ragdoll.torso, primary, 9 * s);

    // Right arm (draw arm)
    this.drawStickLimb(ctx, ragdoll.rightUpperArm, primary, 6.5 * s);
    this.drawStickLimb(ctx, ragdoll.rightForearm, primary, 6 * s);

    // Head
    this.drawStickHead(ctx, ragdoll, primary, accent, helmet);

    // Left arm (bow arm)
    this.drawStickLimb(ctx, ragdoll.leftUpperArm, primary, 7 * s);
    this.drawStickLimb(ctx, ragdoll.leftForearm, primary, 6.5 * s);

    // Shield
    if (ragdoll.shieldBody) {
      this.drawShield(ctx, ragdoll.shieldBody);
    }

    // Bow
    if (ragdoll.isAlive) {
      this.drawBow(ctx, ragdoll);
    }

    // Floating HP & Stamina Bars
    this.drawStatusBars(ctx, ragdoll);
  }

  private drawStickLimb(ctx: CanvasRenderingContext2D, body: Matter.Body, color: string, thickness: number) {
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);

    const bounds = body.bounds;
    const w = bounds.max.x - bounds.min.x;
    const h = bounds.max.y - bounds.min.y;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, thickness / 2);
    ctx.fill();

    // Darker outline for vector stickman punch
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  private drawJoint(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawStickHead(ctx: CanvasRenderingContext2D, ragdoll: Ragdoll, color: string, accent: string, helmet?: string) {
    const head = ragdoll.head;
    const r = head.circleRadius || 14;

    ctx.save();
    ctx.translate(head.position.x, head.position.y);
    ctx.rotate(head.angle);

    // Stickman circle head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Headband / Helmet / Crown
    if (ragdoll.isBoss) {
      // Golden Crown
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-r - 2, -r + 2);
      ctx.lineTo(-r, -r - 10);
      ctx.lineTo(-r / 2, -r - 4);
      ctx.lineTo(0, -r - 12);
      ctx.lineTo(r / 2, -r - 4);
      ctx.lineTo(r, -r - 10);
      ctx.lineTo(r + 2, -r + 2);
      ctx.closePath();
      ctx.fill();
    } else if (helmet && !ragdoll.helmetPopped) {
      ctx.fillStyle = helmet;
      ctx.beginPath();
      ctx.arc(0, -2, r + 1, Math.PI, Math.PI * 2, false);
      ctx.lineTo(r + 2, 0);
      ctx.lineTo(-r - 2, 0);
      ctx.closePath();
      ctx.fill();
    } else if (ragdoll.isPlayer) {
      // Emerald Headband
      ctx.fillStyle = accent;
      ctx.fillRect(-r, -4, r * 2, 5);
      // Trailing bandana cloth
      ctx.beginPath();
      ctx.moveTo(-r, -2);
      ctx.lineTo(-r - 8, -6);
      ctx.lineTo(-r - 6, 2);
      ctx.closePath();
      ctx.fill();
    }

    // Eyes
    const eyeDir = ragdoll.isPlayer ? 1 : -1;
    if (ragdoll.isAlive) {
      ctx.fillStyle = ragdoll.isBoss ? '#ef4444' : '#0f172a';
      ctx.beginPath();
      ctx.arc(eyeDir * 4, -1, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(eyeDir * 4 - 3, -4);
      ctx.lineTo(eyeDir * 4 + 3, 2);
      ctx.moveTo(eyeDir * 4 + 3, -4);
      ctx.lineTo(eyeDir * 4 - 3, 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawShield(ctx: CanvasRenderingContext2D, shield: Matter.Body) {
    ctx.save();
    ctx.translate(shield.position.x, shield.position.y);
    ctx.rotate(shield.angle);

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(-6, -22, 12, 44, 4);
    ctx.fill();

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawBow(ctx: CanvasRenderingContext2D, ragdoll: Ragdoll) {
    const bowHand = ragdoll.getBowHandPosition();
    const aimAngle = ragdoll.aimAngle;
    const power = ragdoll.bowDrawPower;
    const s = ragdoll.scale;

    ctx.save();
    ctx.translate(bowHand.x, bowHand.y);
    ctx.rotate(aimAngle);

    const bowRadius = 26 * s;
    const pullBack = power * 14 * s;

    // Bow curve
    ctx.strokeStyle = ragdoll.isBoss ? '#eab308' : '#b45309';
    ctx.lineWidth = 4 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, bowRadius, -Math.PI / 3, Math.PI / 3, false);
    ctx.stroke();

    const tipTopX = Math.cos(-Math.PI / 3) * bowRadius;
    const tipTopY = Math.sin(-Math.PI / 3) * bowRadius;
    const tipBotX = Math.cos(Math.PI / 3) * bowRadius;
    const tipBotY = Math.sin(Math.PI / 3) * bowRadius;

    // Dynamic Bowstring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(tipTopX, tipTopY);
    ctx.lineTo(-pullBack, 0);
    ctx.lineTo(tipBotX, tipBotY);
    ctx.stroke();

    // Nocked Arrow
    if (power > 0.05) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-pullBack, 0);
      ctx.lineTo(34 * s - pullBack, 0);
      ctx.stroke();

      ctx.fillStyle = ragdoll.isPlayer ? '#10b981' : '#ef4444';
      ctx.beginPath();
      ctx.moveTo(36 * s - pullBack, 0);
      ctx.lineTo(28 * s - pullBack, -4);
      ctx.lineTo(28 * s - pullBack, 4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Health (Red) and Stamina (Blue) Bars over Ragdoll heads
   */
  private drawStatusBars(ctx: CanvasRenderingContext2D, ragdoll: Ragdoll) {
    const head = ragdoll.head;
    const barW = (ragdoll.isBoss ? 70 : ragdoll.isPlayer ? 54 : 42) * ragdoll.scale;
    const barH = 4;
    const x = head.position.x - barW / 2;
    const y = head.position.y - 28 * ragdoll.scale;

    ctx.save();
    // 1. Health Bar (Red)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(x - 1, y - 1, barW + 2, barH + 2, 2);
    ctx.fill();

    const hpPct = Math.max(0, ragdoll.health / ragdoll.maxHealth);
    ctx.fillStyle = ragdoll.isPlayer ? '#22c55e' : '#ef4444';
    ctx.beginPath();
    ctx.roundRect(x, y, barW * hpPct, barH, 2);
    ctx.fill();

    // 2. Stamina Bar (Blue) - Shown for Player
    if (ragdoll.isPlayer) {
      const stamY = y + barH + 2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.beginPath();
      ctx.roundRect(x - 1, stamY - 1, barW + 2, 3, 1.5);
      ctx.fill();

      const stamPct = Math.max(0, ragdoll.stamina / ragdoll.maxStamina);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.roundRect(x, stamY, barW * stamPct, 2, 1);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Render Floating Apples (Red = HP, Green = Stamina, Gold = Both)
   */
  public renderApples(apples: FloatingApple[]) {
    const ctx = this.ctx;

    for (const apple of apples) {
      if (apple.isPopped) continue;

      const x = apple.body.position.x;
      const y = apple.body.position.y;
      const r = apple.radius;

      ctx.save();
      // Mini parachute or balloon string
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y - r - 16);
      ctx.stroke();

      // Mini parachute canopy
      ctx.fillStyle = apple.type === 'gold' ? '#fde047' : '#f1f5f9';
      ctx.beginPath();
      ctx.arc(x, y - r - 16, 12, Math.PI, 0);
      ctx.closePath();
      ctx.fill();

      // Apple Body
      const appleColor = apple.type === 'red' ? '#ef4444' : apple.type === 'green' ? '#22c55e' : '#eab308';
      ctx.fillStyle = appleColor;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // Little leaf on top
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.ellipse(x + 3, y - r + 2, 4, 2, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();

      // Golden sparkle
      if (apple.type === 'gold') {
        ctx.shadowColor = '#eab308';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  /**
   * Render flying & stuck arrows
   */
  public renderArrows(arrows: Arrow[]) {
    const ctx = this.ctx;

    for (const arrow of arrows) {
      if (arrow.isDestroyed) continue;

      ctx.save();
      ctx.translate(arrow.body.position.x, arrow.body.position.y);
      ctx.rotate(arrow.body.angle);

      const halfL = 23;

      // Shaft
      let shaftColor = '#d97706';
      if (arrow.type === 'electric') shaftColor = '#38bdf8';
      else if (arrow.type === 'poison') shaftColor = '#22c55e';
      else if (arrow.type === 'explosive') shaftColor = '#f97316';

      ctx.strokeStyle = shaftColor;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-halfL, 0);
      ctx.lineTo(halfL - 6, 0);
      ctx.stroke();

      // Arrowhead
      let headColor = '#94a3b8';
      if (arrow.type === 'electric') headColor = '#e0f2fe';
      else if (arrow.type === 'poison') headColor = '#4ade80';
      else if (arrow.type === 'explosive') headColor = '#ef4444';

      ctx.fillStyle = headColor;
      ctx.beginPath();
      ctx.moveTo(halfL, 0);
      ctx.lineTo(halfL - 8, -4.5);
      ctx.lineTo(halfL - 8, 4.5);
      ctx.closePath();
      ctx.fill();

      // Fletchings
      ctx.fillStyle = arrow.isPlayer ? '#38bdf8' : '#ef4444';
      ctx.beginPath();
      ctx.moveTo(-halfL, 0);
      ctx.lineTo(-halfL + 8, -4);
      ctx.lineTo(-halfL + 4, 0);
      ctx.lineTo(-halfL + 8, 4);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Parabolic trajectory preview dots
   */
  public renderTrajectory(startX: number, startY: number, vx: number, vy: number, gravity: number = 0.55) {
    const ctx = this.ctx;
    const steps = 24;
    const dt = 1.1;

    let currX = startX;
    let currY = startY;
    let currVx = vx;
    let currVy = vy;

    ctx.save();
    for (let i = 0; i < steps; i++) {
      currX += currVx * dt;
      currY += currVy * dt;
      currVy += gravity * dt;

      const alpha = 1 - (i / steps);
      const dotRadius = Math.max(1.5, 3.2 * alpha);

      ctx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.75})`;
      ctx.beginPath();
      ctx.arc(currX, currY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
