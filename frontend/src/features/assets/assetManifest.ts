import type { ElementId } from '../world/elements'

export interface ElementAssets {
  characterModel?: string
  attackIcon?: string
  defenseIcon?: string
  skillIcon?: string
  skillTexture?: string
}

// Add files in frontend/public/assets. Paths here are URLs rooted at /assets.
// A missing entry keeps the lightweight procedural character and glyphs.
export const assetManifest: Partial<Record<ElementId, ElementAssets>> = {
  // fire: { characterModel: '/assets/characters/fire.glb', skillIcon: '/assets/skills/fire.png' },
}

export const assetsFor = (element: ElementId): ElementAssets => assetManifest[element] ?? {}
