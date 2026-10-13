import { FileUp } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { useStore } from '../../app/store.ts'
import { Button } from '../../components/index.ts'

/** Drag one or more run-log CSVs here, or pick them with "Browse files". */
export function DropZone() {
  const addFiles = useStore((s) => s.addFiles)
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const onDrag = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setOver(true)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    void addFiles([...e.dataTransfer.files])
  }

  return (
    <section
      data-testid="drop-zone"
      aria-label="Add run logs"
      onDragEnter={onDrag}
      onDragOver={onDrag}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center sm:py-10 ${
        over ? 'border-accent bg-accent/10' : 'border-border bg-surface'
      }`}
    >
      <FileUp aria-hidden size={32} className="text-muted" />
      <div>
        <p className="font-medium">Drop Power Automate Desktop run-log CSVs here</p>
        <p className="mt-1 text-sm text-muted">
          One or more files. They stay in this browser; nothing is uploaded.
        </p>
      </div>
      <Button variant="primary" onClick={() => input.current?.click()}>
        Browse files
      </Button>
      <input
        ref={input}
        data-testid="file-input"
        type="file"
        accept=".csv,text/csv"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          void addFiles(files)
        }}
      />
    </section>
  )
}
