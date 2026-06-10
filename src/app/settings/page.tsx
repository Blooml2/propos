'use client'

import { useEffect, useState } from 'react'

export default function SettingsPage() {
  const [autoAssign, setAutoAssign] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        setAutoAssign(data.auto_assign === 'true')
        setLoading(false)
      })
  }, [])

  async function handleToggle() {
    const newValue = !autoAssign
    setAutoAssign(newValue)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_assign: String(newValue) }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-xl font-semibold text-white mb-2">Settings</h2>
      <p className="text-sm text-gray-400 mb-8">Configure how ErickOS behaves for your brokerage.</p>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Agent Assignment</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Auto-Assign Agents</p>
            <p className="text-xs text-gray-400 mt-1">
              When enabled, ErickOS automatically assigns the best agent to every new prospect. When disabled, assignments must be done manually.
            </p>
          </div>
          <button
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-6 flex-shrink-0 ${
              autoAssign ? 'bg-green-500' : 'bg-gray-600'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              autoAssign ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {saved && (
          <p className="text-xs text-green-400 mt-4">Settings saved.</p>
        )}

        <div className="mt-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
          <p className="text-xs text-gray-400">
            Current status: <span className={`font-medium ${autoAssign ? 'text-green-400' : 'text-yellow-400'}`}>
              {autoAssign ? 'Auto-assign is ON — agents are assigned automatically' : 'Auto-assign is OFF — manual assignment required'}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}