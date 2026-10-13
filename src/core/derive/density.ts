// Execution-log row density.
export type Density = 'comfortable' | 'compact'

/** Table row height in px for each density (architecture: Visual system). */
export const ROW_HEIGHT: Record<Density, number> = { comfortable: 40, compact: 28 }

/** The density saved in settings; anything else is comfortable. */
export function readDensity(stored: unknown): Density {
  return stored === 'compact' ? 'compact' : 'comfortable'
}
