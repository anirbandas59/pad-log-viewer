// Execution-log row density.
/* eslint-disable @typescript-eslint/no-unused-vars -- M7 stubs until the implementation lands */
export type Density = 'comfortable' | 'compact'

export const ROW_HEIGHT: Record<Density, number> = { comfortable: 0, compact: 0 }

export function readDensity(_stored: unknown): Density {
  throw new Error('not implemented')
}
