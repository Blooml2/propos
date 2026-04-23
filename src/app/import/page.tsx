'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

// Columns in the leads table we want to map CSV headers to
const LEAD_FIELDS = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'company', label: 'Company' },
  { key: 'title', label: 'Title' },
  { key: 'location', label: 'Location' },
  { key: 'status', label: 'Status' },
  { key: 'score', label: 'Score' },
  { key: 'assigned_agent', label: 'Assigned Agent' },
  { key: 'classification', label: 'Classification' },
  { key: 'notes', label: 'Notes' },
]

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length === 0) return { headers: [], rows: [] }

  function parseLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(parseLine)
  return { headers, rows }
}

function autoMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  const normalized = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '')

  for (const field of LEAD_FIELDS) {
    const match = headers.find(
      (h) =>
        normalized(h) === normalized(field.key) ||
        normalized(h) === normalized(field.label)
    )
    if (match) map[field.key] = match
  }
  return map
}

type ImportStatus = 'idle' | 'mapped' | 'importing' | 'done' | 'error'

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [result, setResult] = useState<{ inserted: number; errors?: string[] } | null>(null)
  const [fileName, setFileName] = useState('')

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a .csv file')
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers: h, rows: r } = parseCSV(text)
      setHeaders(h)
      setRows(r)
      setMapping(autoMap(h))
      setStatus('mapped')
    }
    reader.readAsText(file)
  }, [])

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleImport() {
    setStatus('importing')

    const colIndex = (csvHeader: string) => headers.indexOf(csvHeader)

    const leads = rows
      .filter((row) => row.some((c) => c.trim() !== ''))
      .map((row) => {
        const lead: Record<string, string | number | null> = {}
        for (const field of LEAD_FIELDS) {
          const csvHeader = mapping[field.key]
          if (csvHeader) {
            const idx = colIndex(csvHeader)
            const val = idx >= 0 ? row[idx]?.trim() ?? '' : ''
            if (val !== '') {
              if (field.key === 'score') {
                const n = parseFloat(val)
                lead[field.key] = isNaN(n) ? null : n
              } else {
                lead[field.key] = val
              }
            }
          }
        }
        return lead
      })
      .filter((l) => Object.keys(l).length > 0)

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setResult(data)
      setStatus('done')
    } catch (err) {
      setResult({ inserted: 0, errors: [err instanceof Error ? err.message : 'Unknown error'] })
      setStatus('error')
    }
  }

  function reset() {
    setHeaders([])
    setRows([])
    setMapping({})
    setStatus('idle')
    setResult(null)
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-white">Import Contacts</h1>
        <p className="text-gray-500 text-sm mt-0.5">Upload a CSV to add contacts to your leads table</p>
      </div>

      {/* Step 1: Upload */}
      {status === 'idle' && (
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
            dragOver
              ? 'border-blue-500 bg-blue-500/5'
              : 'border-gray-700 hover:border-gray-600 hover:bg-gray-900/50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-white font-medium mb-1">Drop a CSV file here</p>
          <p className="text-gray-500 text-sm mb-4">or click to browse</p>
          <span className="text-xs text-gray-600 bg-gray-800 px-3 py-1 rounded-full">
            .csv files only
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      )}

      {/* Step 2: Map columns */}
      {(status === 'mapped' || status === 'importing') && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
            <FileText size={16} className="text-blue-400" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{fileName}</p>
              <p className="text-gray-500 text-xs">{rows.length} rows · {headers.length} columns detected</p>
            </div>
            <button onClick={reset} className="text-gray-600 hover:text-gray-400 text-xs transition-colors">
              Change file
            </button>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-white">Map CSV Columns</h2>
              <p className="text-gray-500 text-xs mt-0.5">Match your CSV headers to the correct fields</p>
            </div>
            <div className="divide-y divide-gray-800">
              {LEAD_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm text-white">{field.label}</p>
                    <p className="text-xs text-gray-600 font-mono">{field.key}</p>
                  </div>
                  <select
                    value={mapping[field.key] ?? ''}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-w-40"
                  >
                    <option value="">— Skip —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          {rows.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800">
                <h2 className="text-sm font-semibold text-white">Preview <span className="text-gray-500 font-normal">(first 3 rows)</span></h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {headers.map((h) => (
                        <th key={h} className="text-left px-4 py-2 text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {rows.slice(0, 3).map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-4 py-2 text-gray-400 truncate max-w-32">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={status === 'importing'}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-md transition-colors"
          >
            {status === 'importing' ? `Importing ${rows.length} contacts…` : `Import ${rows.length} Contacts`}
          </button>
        </div>
      )}

      {/* Step 3: Result */}
      {(status === 'done' || status === 'error') && result && (
        <div className="space-y-4">
          <div className={`border rounded-xl p-6 text-center ${
            status === 'done'
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-red-500/10 border-red-500/20'
          }`}>
            {status === 'done' ? (
              <CheckCircle size={32} className="mx-auto text-green-400 mb-3" />
            ) : (
              <XCircle size={32} className="mx-auto text-red-400 mb-3" />
            )}
            <p className="text-white font-medium mb-1">
              {status === 'done' ? `${result.inserted} contacts imported!` : 'Import failed'}
            </p>
            {result.errors && result.errors.length > 0 && (
              <div className="mt-3 text-left">
                {result.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-red-400 mt-1">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    {e}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-md transition-colors"
            >
              Import Another
            </button>
            <a
              href="/clients"
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors text-center"
            >
              View Clients →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
