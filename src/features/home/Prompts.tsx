import { useCallback } from 'react'
import { useStore } from '../../app/store.ts'
import { Button, Dialog } from '../../components/index.ts'

/** The one open question, if any: replace a re-export, confirm a delete, or overwrite on import. */
export function Prompts() {
  const replace = useStore((s) => s.replacePrompts[0])
  const confirm = useStore((s) => s.confirm)
  const importPrompt = useStore((s) => s.importPrompt)
  const resolveReplace = useStore((s) => s.resolveReplace)
  const resolveConfirm = useStore((s) => s.resolveConfirm)
  const resolveImport = useStore((s) => s.resolveImport)
  const cancelReplace = useCallback(() => void resolveReplace(false), [resolveReplace])
  const cancelConfirm = useCallback(() => void resolveConfirm(false), [resolveConfirm])
  const cancelImport = useCallback(() => void resolveImport(false), [resolveImport])

  if (replace) {
    return (
      <Dialog
        title="Replace the stored run?"
        onCancel={cancelReplace}
        actions={
          <>
            <Button onClick={cancelReplace}>Cancel</Button>
            <Button variant="primary" onClick={() => void resolveReplace(true)}>
              Replace
            </Button>
          </>
        }
      >
        <p>
          “{replace.existing.displayName}” is already in history from another export of the same
          run.
        </p>
        <p className="font-mono text-xs break-all">
          Stored: {replace.existing.fileName}
          <br />
          New: {replace.run.meta.fileName}
        </p>
        <p>Replace keeps its name, tags, bookmarks and notes.</p>
      </Dialog>
    )
  }
  if (confirm) {
    const all = confirm.kind === 'clear'
    return (
      <Dialog
        title={all ? 'Clear all history?' : 'Delete this run?'}
        onCancel={cancelConfirm}
        actions={
          <>
            <Button onClick={cancelConfirm}>Cancel</Button>
            <Button variant="danger" onClick={() => void resolveConfirm(true)}>
              {all ? 'Clear all' : 'Delete'}
            </Button>
          </>
        }
      >
        <p>
          {all
            ? 'Every run, with its bookmarks and notes, is removed from this browser.'
            : `“${confirm.run.displayName}” and its bookmarks and notes are removed from this browser.`}{' '}
          This cannot be undone; export your workspace first to keep a copy.
        </p>
      </Dialog>
    )
  }
  if (importPrompt) {
    const n = importPrompt.conflicts.length
    return (
      <Dialog
        title="Overwrite runs already in history?"
        onCancel={cancelImport}
        actions={
          <>
            <Button onClick={cancelImport}>Keep mine</Button>
            <Button variant="primary" onClick={() => void resolveImport(true)}>
              Overwrite
            </Button>
          </>
        }
      >
        <p>
          {n} run{n === 1 ? ' is' : 's are'} in both the workspace file and this browser. Other runs
          are imported either way.
        </p>
        <ul className="list-disc pl-5">
          {importPrompt.conflicts.slice(0, 5).map((r) => (
            <li key={r.id}>{r.displayName}</li>
          ))}
          {n > 5 && <li>and {n - 5} more</li>}
        </ul>
      </Dialog>
    )
  }
  return null
}
