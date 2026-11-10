/**
 * Game Engine for Ragdoll Archers.
 * Orchestrates Matter.js physics, stickman ragdolls, floating apples,
 * skull currency drops, upgrades store, jump physics, and arrow ballistics.
 */

import Matter from 'matter-js';
import { Ragdoll } from './ragdoll';
import { Arrow, ArrowType } from './arrow';
import { FloatingApple, AppleType } from './apples';
import { EnemyAI } from './ai';
import { ParticleSystem } from './particles';
import { GameRenderer } from './renderer';
import { sounds } from './audio';
import { COLLISION_CATEGORIES, BodyPartMetadata } from './physics';
import confetti from 'canvas-confetti';

const { Engine, World, Bodies, Composite, Events, Body } = Matter;

export interface UpgradesState {
  healthLevel: number;
  staminaLevel: number;
  damageLevel: number;
  drawSpeedLevel: number;
}

export interface GameStats {
  score: number;
  wave: number;
  skulls: number;
  kills: number;
  headshots: number;
  playerHealth: number;
  playerMaxHealth: number;
  playerStamina: number;
  playerMaxStamina: number;
  isGameOver: boolean;
  isWaveCleared: boolean;
  selectedArrowType: ArrowType;
  unlockedArrows: ArrowType[];
  upgrades: UpgradesState;
}

export class GameEngine {
  public engine: Matter.Engine;
  public world: Matter.World;
  public renderer: GameRenderer | null = null;
  public particles: ParticleSystem = new ParticleSystem();

  public player: Ragdoll | null = null;
  public enemies: Ragdoll[] = [];
  public enemyAIs: EnemyAI[] = [];
  public arrows: Arrow[] = [];
  public apples: FloatingApple[] = [];
  public platforms: Matter.Body[] = [];

  // Progression & Currency
  public score: number = 0;
  public wave: number = 1;
  public skulls: number = 0;
  public kills: number = 0;
  public headshots: number = 0;
  public isGameOver: boolean = false;
  public isWaveCleared: boolean = false;
  public isPaused: boolean = false;

  // Upgrades
  public upgrades: UpgradesState = {
    healthLevel: 1,
    staminaLevel: 1,
    damageLevel: 1,
    drawSpeedLevel: 1,
  };

  // Quiver selection
  public selectedArrowType: ArrowType = 'standard';
  public unlockedArrows: ArrowType[] = ['standard', 'electric', 'poison', 'explosive', 'triple'];

  // Aiming & Input
  public isDrawing: boolean = false;
  public drawPower: number = 0;
  public aimAngle: number = -0.3;
  public mousePos: { x: number; y: number } = { x: 500, y: 300 };

  // Viewport
  public width: number = 1280;
  public height: number = 720;

  // Timers
  private lastTime: number = performance.now();
  private animFrameId: number | null = null;
  private slowMoTimeout: number | null = null;
  private nextAppleSpawn: number = performance.now() + 8000;

  public onStatsUpdate?: (stats: GameStats) => void;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')!;
    this.renderer = new GameRenderer(ctx);
    this.width = canvas.width;
    this.height = canvas.height;
    this.renderer.resize(this.width, this.height);

    this.engine = Engine.create({
      gravity: { x: 0, y: 0.95, scale: 0.001 },
    });
    this.world = this.engine.world;

    this.setupCollisionHandlers();
    this.setupTerrain();
    this.spawnPlayer();
    this.startWave(1);
    this.startLoop();
  }

  private setupTerrain() {
    for (const p of this.platforms) {
      Composite.remove(this.world, p);
    }
    this.platforms = [];

    const groundY = this.height - 40;
    const groundThickness = 80;

    // Flat Arena Ground
    const ground = Bodies.rectangle(this.width / 2, groundY + groundThickness / 2, this.width + 400, groundThickness, {
      isStatic: true,
      friction: 0.9,
      collisionFilter: { category: COLLISION_CATEGORIES.GROUND, mask: 0xffffff },
      label: 'ground',
    });

    // Left Player Platform
    const playerPlatform = Bodies.rectangle(160, groundY - 50, 180, 100, {
      isStatic: true,
      friction: 0.8,
      collisionFilter: { category: COLLISION_CATEGORIES.GROUND, mask: 0xffffff },
      label: 'platform',
    });

    // Right Enemy Tier 1 Platform
    const enemyPlatform1 = Bodies.rectangle(this.width - 200, groundY - 60, 240, 120, {
      isStatic: true,
      friction: 0.8,
      collisionFilter: { category: COLLISION_CATEGORIES.GROUND, mask: 0xffffff },
      label: 'platform',
    });

    // Right Enemy Tier 2 Watchtower
    const enemyPlatform2 = Bodies.rectangle(this.width - 390, groundY - 30, 170, 60, {
      isStatic: true,
      friction: 0.8,
      collisionFilter: { category: COLLISION_CATEGORIES.GROUND, mask: 0xffffff },
      label: 'platform',
    });

    this.platforms = [ground, playerPlatform, enemyPlatform1, enemyPlatform2];
    Composite.add(this.world, this.platforms);
  }

  public spawnPlayer() {
    if (this.player) {
      this.player.destroy(this.world);
    }

    const maxHp = 100 + (this.upgrades.healthLevel - 1) * 25;
    const maxStam = 100 + (this.upgrades.staminaLevel - 1) * 20;

    this.player = new Ragdoll(this.world, {
      id: 'player',
      x: 160,
      y: this.height - 165,
      isPlayer: true,
      maxHealth: maxHp,
      maxStamina: maxStam,
      scale: 1.05,
      colorTheme: {
        primary: '#f8fafc',
        accent: '#10b981',
        helmet: '#38bdf8',
      },
    });

    this.isGameOver = false;
    this.broadcastStats();
  }

  public startWave(waveNumber: number) {
    this.wave = waveNumber;
    this.isWaveCleared = false;

    for (const enemy of this.enemies) {
      enemy.destroy(this.world);
    }
    this.enemies = [];
    this.enemyAIs = [];

    const groundY = this.height - 40;
    const isBoss = waveNumber % 5 === 0;

    if (isBoss) {
      // Boss Stickman Archer
      const boss = new Ragdoll(this.world, {
        id: `boss_w${waveNumber}`,
        x: this.width - 200,
        y: groundY - 180,
        isPlayer: false,
        isBoss: true,
        maxHealth: 320 + waveNumber * 30,
        hasShield: true,
        scale: 1.4,
        colorTheme: {
          primary: '#9333ea',
          accent: '#fbbf24',
          helmet: '#f59e0b',
        },
      });

      const ai = new EnemyAI(boss, {
        drawDuration: 750,
        cooldownDuration: 1800,
        accuracyNoise: 0.04,
        projectileSpeed: 27,
        arrowType: 'explosive',
      });
      ai.onShootCallback = (ragdoll, angle, speed) => {
        this.shootArrow(ragdoll, angle, speed, false, 'explosive');
      };

      this.enemies.push(boss);
      this.enemyAIs.push(ai);
    } else {
      // Standard wave composition
      const count = Math.min(3, 1 + Math.floor(waveNumber / 2));
      const spawnSpots = [
        { x: this.width - 200, y: groundY - 150, shield: waveNumber >= 3 },
        { x: this.width - 390, y: groundY - 80, shield: false },
        { x: this.width - 120, y: groundY - 70, shield: waveNumber >= 4 },
      ];

      for (let i = 0; i < count; i++) {
        const spot = spawnSpots[i % spawnSpots.length];
        const enemy = new Ragdoll(this.world, {
          id: `enemy_w${waveNumber}_${i}`,
          x: spot.x,
          y: spot.y,
          isPlayer: false,
          maxHealth: 75 + waveNumber * 12,
          hasShield: spot.shield,
          scale: 1.0,
          colorTheme: {
            primary: '#ef4444',
            accent: '#991b1b',
            helmet: '#475569',
          },
        });

        const ai = new EnemyAI(enemy, {
          drawDuration: Math.max(650, 1100 - waveNumber * 40),
          cooldownDuration: Math.max(1800, 3200 - waveNumber * 120),
          accuracyNoise: Math.max(0.04, 0.13 - waveNumber * 0.015),
          projectileSpeed: 22 + Math.min(6, waveNumber * 0.8),
          arrowType: waveNumber >= 4 && i === 0 ? 'electric' : 'standard',
        });
        ai.onShootCallback = (ragdoll, angle, speed) => {
          this.shootArrow(ragdoll, angle, speed, false, ai.config.arrowType || 'standard');
        };

        this.enemies.push(enemy);
        this.enemyAIs.push(ai);
      }
    }

    const titleText = isBoss ? `BOSS WAVE ${waveNumber}!` : `WAVE ${waveNumber}`;
    const titleColor = isBoss ? '#c084fc' : '#38bdf8';
    this.particles.addFloatingText(this.width / 2, this.height * 0.35, titleText, titleColor, 38, true);
    this.broadcastStats();
  }

  public jumpPlayer() {
    if (this.player && this.player.isAlive) {
      const jumped = this.player.jump();
      if (jumped) {
        sounds.playJump();
      }
    }
  }

  public shootArrow(
    shooter: Ragdoll,
    angle: number,
    speed: number,
    isPlayer: boolean,
    type: ArrowType = 'standard'
  ) {
    const bowHand = shooter.getBowHandPosition();
    const spawnX = bowHand.x + Math.cos(angle) * 16;
    const spawnY = bowHand.y + Math.sin(angle) * 16;

    // Upgrades boost arrow damage
    const damageMultiplier = isPlayer ? 1 + (this.upgrades.damageLevel - 1) * 0.25 : 1.0;
    const baseDmg = type === 'explosive' ? 65 : type === 'electric' ? 52 : type === 'poison' ? 45 : 45;
    const finalDamage = Math.round(baseDmg * damageMultiplier);

    if (type === 'triple') {
      const spreadAngles = [-0.1, 0, 0.1];
      spreadAngles.forEach((spread) => {
        const a = angle + spread;
        const arrow = new Arrow(this.world, {
          id: Math.random().toString(),
          x: spawnX,
          y: spawnY,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          isPlayer,
          type: 'triple',
          damage: Math.round(36 * damageMultiplier),
        });
        this.arrows.push(arrow);
      });
    } else {
      const arrow = new Arrow(this.world, {
        id: Math.random().toString(),
        x: spawnX,
        y: spawnY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        isPlayer,
        type,
        damage: finalDamage,
      });
      this.arrows.push(arrow);
    }

    sounds.playArrowShoot(Math.min(1.0, speed / 32));
  }

  private setupCollisionHandlers() {
    Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;

        const arrowBody = bodyA.label.includes('arrow') ? bodyA : bodyB.label.includes('arrow') ? bodyB : null;
        const otherBody = arrowBody === bodyA ? bodyB : bodyA;

        if (!arrowBody) continue;

        const arrow = arrowBody.customArrow as Arrow | undefined;
        if (!arrow || arrow.isStuck || arrow.isDestroyed) continue;

        const contactPoint = pair.collision.supports[0] || arrowBody.position;

        // 1. Arrow hits Floating Apple
        if (otherBody.label === 'apple') {
          const apple = otherBody.customApple as FloatingApple | undefined;
          if (apple && !apple.isPopped) {
            this.handleApplePopped(apple, contactPoint);
            arrow.destroy(this.world);
          }
          continue;
        }

        // 2. Arrow hits Terrain
        if (otherBody.label === 'ground' || otherBody.label === 'platform') {
          arrow.stickInto(otherBody, contactPoint, this.world);
          sounds.playArrowHit(false);
          this.particles.emitWoodChips(contactPoint.x, contactPoint.y, 6);
          continue;
        }

        // 3. Arrow hits Shield
        const meta = otherBody.customMeta as BodyPartMetadata | undefined;
        if (meta && meta.type === 'shield') {
          arrow.stickInto(otherBody, contactPoint, this.world);
          sounds.playArrowHit(false);
          this.particles.emitWoodChips(contactPoint.x, contactPoint.y, 10);
          this.particles.addFloatingText(contactPoint.x, contactPoint.y - 12, 'BLOCKED!', '#94a3b8', 16, true);
          continue;
        }

        // 4. Arrow hits Ragdoll Body Part
        if (meta && arrow.isPlayer !== meta.isPlayer) {
          this.handleArrowHitLimb(arrow, otherBody, meta, contactPoint);
        }
      }
    });
  }

  private handleApplePopped(apple: FloatingApple, pos: { x: number; y: number }) {
    apple.destroy(this.world);
    sounds.playAppleCrunch();
    this.particles.emitAppleJuice(pos.x, pos.y, apple.type);

    if (apple.type === 'red') {
      if (this.player) {
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 40);
        this.particles.addFloatingText(pos.x, pos.y - 10, '+40 HP', '#ef4444', 24, true);
      }
    } else if (apple.type === 'green') {
      if (this.player) {
        this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + 60);
        this.particles.addFloatingText(pos.x, pos.y - 10, '+STAMINA', '#22c55e', 24, true);
      }
    } else if (apple.type === 'gold') {
      if (this.player) {
        this.player.health = this.player.maxHealth;
        this.player.stamina = this.player.maxStamina;
        this.skulls += 15;
        this.particles.addFloatingText(pos.x, pos.y - 10, '+FULL RESTORE & +15 💀', '#f59e0b', 26, true);
      }
    }
    this.broadcastStats();
  }

  private handleArrowHitLimb(
    arrow: Arrow,
    limbBody: Matter.Body,
    meta: BodyPartMetadata,
    contactPoint: { x: number; y: number }
  ) {
    const isHeadshot = meta.type === 'head';
    const targetRagdoll = meta.isPlayer ? this.player : this.enemies.find((e) => e.id === meta.ragdollId);

    if (!targetRagdoll || !targetRagdoll.isAlive) return;

    const speed = Math.hypot(arrow.body.velocity.x, arrow.body.velocity.y);
    const speedRatio = Math.min(1.4, Math.max(0.4, speed / 20));
    const totalDamage = Math.round(arrow.damage * speedRatio * meta.damageMultiplier);

    // Apply knockback impulse
    const impulse = 0.035 * (arrow.type === 'explosive' ? 2.5 : 1.0);
    Body.applyForce(limbBody, contactPoint, {
      x: arrow.body.velocity.x * impulse,
      y: arrow.body.velocity.y * impulse,
    });

    // Special arrow effects
    if (arrow.type === 'electric') {
      sounds.playElectricZap();
      this.particles.emitElectricSparks(contactPoint.x, contactPoint.y, 16);
      this.particles.addFloatingText(contactPoint.x, contactPoint.y - 25, '⚡ SHOCK!', '#38bdf8', 18, true);
    } else if (arrow.type === 'explosive') {
      sounds.playExplosion();
      this.particles.emitExplosion(contactPoint.x, contactPoint.y);
      // Area knockback to all ragdoll limbs
      for (const b of targetRagdoll.composite.bodies) {
        Body.applyForce(b, b.position, {
          x: (arrow.isPlayer ? 0.02 : -0.02),
          y: -0.025,
        });
      }
    }

    sounds.playArrowHit(isHeadshot);
    this.particles.emitBlood(contactPoint.x, contactPoint.y, isHeadshot ? 22 : 12, arrow.body.velocity.x, arrow.body.velocity.y);

    if (isHeadshot) {
      this.particles.addFloatingText(contactPoint.x, contactPoint.y - 20, `HEADSHOT! -${totalDamage}`, '#f59e0b', 24, true);
      this.triggerSlowMo(380);
      if (arrow.isPlayer) {
        this.headshots++;
        this.score += 150;
        this.skulls += 3;
      }
    } else {
      const partLabel = meta.type === 'torso' ? 'CHEST' : 'LIMB';
      this.particles.addFloatingText(contactPoint.x, contactPoint.y - 15, `${partLabel} -${totalDamage}`, '#f87171', 18, true);
      if (arrow.isPlayer) {
        this.score += 40;
      }
    }

    arrow.stickInto(limbBody, contactPoint, this.world);
    const killed = targetRagdoll.takeDamage(totalDamage, this.world, isHeadshot);

    if (killed) {
      sounds.playRagdollThud();
      if (arrow.isPlayer) {
        this.kills++;
        this.score += 200;
        const droppedSkulls = targetRagdoll.isBoss ? 15 : 4;
        this.skulls += droppedSkulls;
        sounds.playSkullCollect();
        this.particles.dropSkulls(targetRagdoll.head.position.x, targetRagdoll.head.position.y, droppedSkulls);
        this.particles.addFloatingText(targetRagdoll.head.position.x, targetRagdoll.head.position.y - 35, `+${droppedSkulls} 💀 SKULLS`, '#e2e8f0', 22, true);
      }
      this.checkWaveProgress();
    } else {
      const enemyAI = this.enemyAIs.find((ai) => ai.ragdoll === targetRagdoll);
      enemyAI?.interrupt();
    }

    if (targetRagdoll === this.player && killed) {
      this.isGameOver = true;
      sounds.playGameOver();
    }

    this.broadcastStats();
  }

  private triggerSlowMo(durationMs: number = 350) {
    this.engine.timing.timeScale = 0.28;
    if (this.slowMoTimeout) clearTimeout(this.slowMoTimeout);
    this.slowMoTimeout = window.setTimeout(() => {
      this.engine.timing.timeScale = 1.0;
      this.slowMoTimeout = null;
    }, durationMs);
  }

  private checkWaveProgress() {
    const allEnemiesDefeated = this.enemies.every((e) => !e.isAlive || e.isCollapsed);
    if (allEnemiesDefeated && !this.isWaveCleared && !this.isGameOver) {
      this.isWaveCleared = true;
      sounds.playWaveComplete();

      try {
        confetti({
          particleCount: 75,
          spread: 80,
          origin: { y: 0.6 },
        });
      } catch {
        // Ignored
      }

      this.score += this.wave * 300;
      this.skulls += this.wave * 2;
      this.particles.addFloatingText(this.width / 2, this.height * 0.4, 'WAVE CLEARED!', '#10b981', 40, true);

      setTimeout(() => {
        if (!this.isGameOver) {
          this.startWave(this.wave + 1);
        }
      }, 2400);

      this.broadcastStats();
    }
  }

  // --- Upgrades Store Handler ---
  public upgradeStat(stat: keyof UpgradesState): boolean {
    const cost = this.getUpgradeCost(stat);
    if (this.skulls >= cost) {
      this.skulls -= cost;
      this.upgrades[stat]++;
      sounds.playSkullCollect();

      if (stat === 'healthLevel' && this.player) {
        this.player.maxHealth += 25;
        this.player.health = this.player.maxHealth;
      }
      if (stat === 'staminaLevel' && this.player) {
        this.player.maxStamina += 20;
        this.player.stamina = this.player.maxStamina;
      }

      this.broadcastStats();
      return true;
    }
    return false;
  }

  public getUpgradeCost(stat: keyof UpgradesState): number {
    const lvl = this.upgrades[stat];
    return lvl * 10;
  }

  // --- Input Handlers ---
  public handleMouseMove(clientX: number, clientY: number, canvasRect: DOMRect) {
    const scaleX = this.width / canvasRect.width;
    const scaleY = this.height / canvasRect.height;

    this.mousePos = {
      x: (clientX - canvasRect.left) * scaleX,
      y: (clientY - canvasRect.top) * scaleY,
    };

    if (this.player && this.player.isAlive) {
      const bowHand = this.player.getBowHandPosition();
      const dx = this.mousePos.x - bowHand.x;
      const dy = this.mousePos.y - bowHand.y;
      this.aimAngle = Math.atan2(dy, dx);
      this.player.updateAim(this.aimAngle, this.drawPower);
    }
  }

  public handleMouseDown() {
    if (!this.player || !this.player.isAlive || this.isGameOver || this.isPaused) return;
    if (this.player.stamina < 10) return; // Need stamina to draw
    this.isDrawing = true;
    this.drawPower = 0.1;
    sounds.startBowDraw();
  }

  public handleMouseUp() {
    if (!this.isDrawing || !this.player || !this.player.isAlive || this.isGameOver) {
      this.isDrawing = false;
      sounds.stopBowDraw();
      return;
    }

    this.isDrawing = false;
    sounds.stopBowDraw();

    const drawSpeedMultiplier = 1 + (this.upgrades.drawSpeedLevel - 1) * 0.15;
    const minSpeed = 15;
    const maxSpeed = 34 * drawSpeedMultiplier;
    const speed = minSpeed + this.drawPower * (maxSpeed - minSpeed);

    this.shootArrow(this.player, this.aimAngle, speed, true, this.selectedArrowType);

    this.drawPower = 0;
    this.player.updateAim(this.aimAngle, 0);
  }

  public setArrowType(type: ArrowType) {
    this.selectedArrowType = type;
    this.broadcastStats();
  }

  public restartGame() {
    this.score = 0;
    this.kills = 0;
    this.headshots = 0;
    this.isGameOver = false;
    this.isWaveCleared = false;

    for (const a of this.arrows) a.destroy(this.world);
    this.arrows = [];
    for (const apple of this.apples) apple.destroy(this.world);
    this.apples = [];

    this.particles.clear();
    this.spawnPlayer();
    this.startWave(1);
    this.broadcastStats();
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
  }

  public broadcastStats() {
    this.onStatsUpdate?.({
      score: this.score,
      wave: this.wave,
      skulls: this.skulls,
      kills: this.kills,
      headshots: this.headshots,
      playerHealth: this.player ? this.player.health : 0,
      playerMaxHealth: this.player ? this.player.maxHealth : 100,
      playerStamina: this.player ? this.player.stamina : 0,
      playerMaxStamina: this.player ? this.player.maxStamina : 100,
      isGameOver: this.isGameOver,
      isWaveCleared: this.isWaveCleared,
      selectedArrowType: this.selectedArrowType,
      unlockedArrows: this.unlockedArrows,
      upgrades: { ...this.upgrades },
    });
  }

  private startLoop() {
    const loop = (time: number) => {
      const dt = Math.min(32, time - this.lastTime);
      this.lastTime = time;

      if (!this.isPaused) {
        this.update(dt, time);
        this.render();
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  private update(dt: number, now: number) {
    Engine.update(this.engine, dt);

    // Player Bow Draw & Stamina
    if (this.player && this.player.isAlive) {
      if (this.isDrawing) {
        const drawRate = 0.002 * (1 + (this.upgrades.drawSpeedLevel - 1) * 0.15);
        this.drawPower = Math.min(1.0, this.drawPower + dt * drawRate);

        // Drain stamina while drawing
        this.player.stamina = Math.max(0, this.player.stamina - dt * 0.035);
        if (this.player.stamina <= 0) {
          // Ran out of stamina: force release
          this.handleMouseUp();
        } else {
          this.player.updateAim(this.aimAngle, this.drawPower);
        }
      } else {
        // Regenerate stamina
        this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + dt * 0.025);
      }
    }

    // Spawn floating apples occasionally
    if (now > this.nextAppleSpawn) {
      this.nextAppleSpawn = now + 12000 + Math.random() * 8000;
      const rand = Math.random();
      const type: AppleType = rand > 0.85 ? 'gold' : rand > 0.45 ? 'green' : 'red';
      const apple = new FloatingApple(this.world, this.width + 30, 160 + Math.random() * 220, type);
      this.apples.push(apple);
    }

    // Update floating apples
    for (let i = this.apples.length - 1; i >= 0; i--) {
      const apple = this.apples[i];
      apple.update(now);
      if (apple.body.position.x < -40 || apple.isPopped) {
        apple.destroy(this.world);
        this.apples.splice(i, 1);
      }
    }

    // Update Enemy AIs
    for (const ai of this.enemyAIs) {
      ai.update(dt, this.player);
    }

    // Update Arrows
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i];
      arrow.updateAerodynamics(this.particles);

      if (now - arrow.spawnTime > arrow.lifeTime || arrow.body.position.y > this.height + 150) {
        arrow.destroy(this.world);
        this.arrows.splice(i, 1);
      }
    }

    // Update particles and gravitate skulls toward HUD
    this.particles.update(this.width - 120, 30);
  }

  private render() {
    if (!this.renderer) return;

    this.renderer.renderBackground(this.platforms);

    // Trajectory Preview
    if (this.isDrawing && this.player && this.player.isAlive) {
      const bowHand = this.player.getBowHandPosition();
      const minSpeed = 15;
      const maxSpeed = 34 * (1 + (this.upgrades.drawSpeedLevel - 1) * 0.15);
      const speed = minSpeed + this.drawPower * (maxSpeed - minSpeed);
      const vx = Math.cos(this.aimAngle) * speed;
      const vy = Math.sin(this.aimAngle) * speed;

      this.renderer.renderTrajectory(bowHand.x, bowHand.y, vx, vy, 0.52);
    }

    // Floating Apples
    this.renderer.renderApples(this.apples);

    // Enemies
    for (const enemy of this.enemies) {
      this.renderer.renderRagdoll(enemy);
    }

    // Player
    if (this.player) {
      this.renderer.renderRagdoll(this.player);
    }

    // Arrows
    this.renderer.renderArrows(this.arrows);

    // Particles & Skulls
    this.particles.draw(this.renderer.ctx);
  }

  public destroy() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.slowMoTimeout) clearTimeout(this.slowMoTimeout);
    World.clear(this.world, false);
    Engine.clear(this.engine);
  }
}
