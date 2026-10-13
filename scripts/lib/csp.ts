// Content-Security-Policy for the shipped single-file HTML (M8). Stubs until implemented.
/* eslint-disable @typescript-eslint/no-unused-vars -- M8 stubs until the implementation lands */

export interface InlineHashes {
  scripts: string[]
  styles: string[]
}

export function inlineHashes(_html: string): InlineHashes {
  throw new Error('not implemented')
}

export function externalReferences(_html: string): string[] {
  throw new Error('not implemented')
}

export function contentSecurityPolicy(_hashes: InlineHashes): string {
  throw new Error('not implemented')
}

export function addCsp(_html: string): string {
  throw new Error('not implemented')
}
