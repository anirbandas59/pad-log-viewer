// Maps Tailwind colour names to the CSS-variable theme tokens in src/styles/index.css.
export default {
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        fg: 'var(--color-fg)',
        muted: 'var(--color-muted)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        success: 'var(--color-success)',
        failure: 'var(--color-failure)',
        warning: 'var(--color-warning)',
        unknown: 'var(--color-unknown)',
      },
    },
  },
}
