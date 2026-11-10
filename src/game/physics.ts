/**
 * Matter.js Collision Filters and Physics Configuration
 * Exact match for Ragdoll Archers:
 * - Limbs, Arrows, Ground, Floating Apples, and Collectibles
 */

export const COLLISION_CATEGORIES = {
  GROUND: 0x0001,
  PLAYER_LIMB: 0x0002,
  ENEMY_LIMB: 0x0004,
  PLAYER_ARROW: 0x0008,
  ENEMY_ARROW: 0x0010,
  SHIELD: 0x0020,
  APPLE: 0x0040,
};

export interface BodyPartMetadata {
  type: 'head' | 'torso' | 'pelvis' | 'armUpper' | 'armLower' | 'legUpper' | 'legLower' | 'foot' | 'shield';
  ragdollId: string;
  isPlayer: boolean;
  damageMultiplier: number;
}
