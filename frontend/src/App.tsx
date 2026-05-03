import { useEffect, useState } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:8000'

interface HealthResponse {
  status: string
  app: string
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios
      .get<HealthResponse>(`${API_BASE}/health`)
      .then((res) => setHealth(res.data))
      .catch(() => setError('Cannot reach backend — is it running on port 8000?'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-md p-10 w-full max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-800">GLPack Modern</h1>
        <p className="text-slate-500 text-sm">General Ledger Accounting System</p>

        <div className="mt-6 p-4 rounded-lg border border-slate-200 bg-slate-50 text-left font-mono text-sm">
          <p className="text-slate-400 text-xs mb-2">GET /health</p>
          {loading && <p className="text-slate-400">Connecting...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {health && (
            <pre className="text-green-600">{JSON.stringify(health, null, 2)}</pre>
          )}
        </div>

        {health && (
          <p className="text-green-600 font-medium text-sm">
            Backend connected successfully
          </p>
        )}
      </div>
    </div>
  )
}

export default App
