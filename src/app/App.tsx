// Screen switch: Home | Run view.
import { Moon, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { HomeScreen, Prompts } from '../features/home/index.ts'
import { RunScreen } from '../features/run/index.ts'
import { useStore } from './store.ts'

export default function App() {
  const init = useStore((s) => s.init)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const activeRunId = useStore((s) => s.activeRunId)
  const next = theme === 'dark' ? 'light' : 'dark'

  useEffect(() => {
    void init()
  }, [init])

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <h1 className="flex-1 text-lg font-semibold">PAD Log Viewer</h1>
          <button
            type="button"
            aria-label={`Switch to ${next} theme`}
            title={`Switch to ${next} theme`}
            onClick={toggleTheme}
            className="rounded-md p-2 text-muted hover:bg-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
          >
            {theme === 'dark' ? <Sun aria-hidden size={18} /> : <Moon aria-hidden size={18} />}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">
        {activeRunId ? <RunScreen id={activeRunId} /> : <HomeScreen />}
      </main>
      <Prompts />
    </div>
  )
}
