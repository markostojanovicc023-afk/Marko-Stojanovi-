/**
 * Enhanced Particle, Floating Text, and Dropped Skulls System
 * Matches Ragdoll Archers visual aesthetics:
 * - Blood splatters, wood chips, arrow trails
 * - Dropped Skulls that bounce and gravitate to the player bank
 * - Apple pop juice splatters (Red, Green, Gold)
 * - Electric sparks and explosion blast waves
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  gravity: number;
  type: 'blood' | 'spark' | 'smoke' | 'wood' | 'electric' | 'apple';
}

export interface FloatingSkull {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  scale: number;
  collected: boolean;
  spawnTime: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  fontSize: number;
  alpha: number;
  scale: number;
  bold: boolean;
}

export class ParticleSystem {
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];
  public skulls: FloatingSkull[] = [];

  public emitBlood(x: number, y: number, count = 14, dirX = 0, dirY = -1) {
    for (let i = 0; i < count; i++) {
      const angle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 1.5;
      const speed = Math.random() * 6 + 2;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.4 ? '#ef4444' : '#991b1b',
        size: Math.random() * 3 + 2,
        alpha: 1.0,
        decay: Math.random() * 0.02 + 0.015,
        gravity: 0.25,
        type: 'blood',
      });
    }
  }

  public emitAppleJuice(x: number, y: number, type: 'red' | 'green' | 'gold') {
    const color = type === 'red' ? '#ef4444' : type === 'green' ? '#22c55e' : '#f59e0b';
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: Math.random() * 3.5 + 2,
        alpha: 1.0,
        decay: 0.03,
        gravity: 0.18,
        type: 'apple',
      });
    }
  }

  public emitElectricSparks(x: number, y: number, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.5 ? '#38bdf8' : '#e0f2fe',
        size: Math.random() * 2.5 + 1.5,
        alpha: 1.0,
        decay: 0.05,
        gravity: 0.05,
        type: 'electric',
      });
    }
  }

  public emitExplosion(x: number, y: number) {
    // Fire sparks
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 9 + 3;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.5 ? '#f97316' : '#ef4444',
        size: Math.random() * 4 + 2,
        alpha: 1.0,
        decay: 0.035,
        gravity: 0.15,
        type: 'spark',
      });
    }
  }

  public emitWoodChips(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        color: Math.random() > 0.5 ? '#d97706' : '#78350f',
        size: Math.random() * 3 + 1.5,
        alpha: 1.0,
        decay: 0.03,
        gravity: 0.2,
        type: 'wood',
      });
    }
  }

  public emitArrowTrail(x: number, y: number, color = 'rgba(255,255,255,0.4)', size = 2) {
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      color,
      size,
      alpha: 0.6,
      decay: 0.05,
      gravity: 0.01,
      type: 'smoke',
    });
  }

  public dropSkulls(x: number, y: number, count = 3) {
    for (let i = 0; i < count; i++) {
      this.skulls.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 5 - 2,
        alpha: 1.0,
        scale: 1.0,
        collected: false,
        spawnTime: performance.now(),
      });
    }
  }

  public addFloatingText(x: number, y: number, text: string, color = '#fbbf24', fontSize = 20, bold = true) {
    this.floatingTexts.push({
      id: Math.random().toString(),
      x,
      y,
      vy: -1.8,
      text,
      color,
      fontSize,
      alpha: 1.0,
      scale: 1.3,
      bold,
    });
  }

  public update(targetCollectionX = 1200, targetCollectionY = 40) {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= 0.02;
      if (ft.scale > 1.0) {
        ft.scale -= 0.03;
      }
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Update skulls (hover and fly to collection bank)
    const now = performance.now();
    for (let i = this.skulls.length - 1; i >= 0; i--) {
      const s = this.skulls[i];
      const age = now - s.spawnTime;

      if (age < 600) {
        // Initial bounce
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.2;
      } else {
        // Gravitate toward HUD skull counter
        const dx = targetCollectionX - s.x;
        const dy = targetCollectionY - s.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 30) {
          s.collected = true;
          this.skulls.splice(i, 1);
          continue;
        }

        s.vx = (dx / dist) * 12;
        s.vy = (dy / dist) * 12;
        s.x += s.vx;
        s.y += s.vy;
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D) {
    // Draw particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Skulls
    for (const s of this.skulls) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(s.scale, s.scale);
      // Clean white skull icon
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(0, -2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-4, 2, 8, 4);
      // Eye holes
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-2.5, -2, 1.8, 0, Math.PI * 2);
      ctx.arc(2.5, -2, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw floating texts
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = `${ft.bold ? 'bold' : 'normal'} ${Math.round(ft.fontSize * ft.scale)}px 'Rajdhani', sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 6;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  public clear() {
    this.particles = [];
    this.floatingTexts = [];
    this.skulls = [];
  }
}
