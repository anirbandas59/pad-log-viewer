// Theme tokens and light/dark toggle.
//
// The tokens are CSS variables in src/styles/index.css; this module only switches
// `data-theme` on <html>. The choice is kept in localStorage (read before the first paint,
// so the page never flashes the wrong theme) and mirrored to the IndexedDB settings store.

export type Theme = 'dark' | 'light'

/** Settings-store key and localStorage key for the theme. */
export const THEME_SETTING = 'theme'
const LOCAL_KEY = 'pad-log-viewer.theme'

export function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light'
}

/** The last chosen theme in this browser; dark when none was chosen or storage is blocked. */
export function readStoredTheme(): Theme {
  try {
    const value = localStorage.getItem(LOCAL_KEY)
    return isTheme(value) ? value : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(LOCAL_KEY, theme)
  } catch {
    // Storage blocked: the theme still applies for this session.
  }
}
