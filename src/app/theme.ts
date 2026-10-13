// Theme tokens and light/dark toggle.
//
// The tokens are CSS variables in src/styles/index.css; this module only switches
// `data-theme` on <html>. localStorage holds the choice: it is written on every toggle and
// read before the first paint, so the page never flashes the wrong theme. The IndexedDB
// settings store keeps a copy, used only when localStorage has none (e.g. it was cleared).

export type Theme = 'dark' | 'light'

/** Settings-store key and localStorage key for the theme. */
export const THEME_SETTING = 'theme'
const LOCAL_KEY = 'pad-log-viewer.theme'

export function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light'
}

/** The theme last chosen in this browser, from localStorage; null when none is stored or readable. */
export function readLocalTheme(): Theme | null {
  try {
    const value = localStorage.getItem(LOCAL_KEY)
    return isTheme(value) ? value : null
  } catch {
    return null
  }
}

/** The theme to start with: the last choice, else dark. */
export function readStoredTheme(): Theme {
  return readLocalTheme() ?? 'dark'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

/** Remembers the user's choice in this browser. */
export function saveLocalTheme(theme: Theme): void {
  try {
    localStorage.setItem(LOCAL_KEY, theme)
  } catch {
    // Storage blocked: the theme still applies for this session.
  }
}
