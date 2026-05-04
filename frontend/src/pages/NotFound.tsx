import { useNavigate } from 'react-router-dom'

export function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-6xl font-bold text-slate-300">404</p>
        <p className="text-xl font-semibold text-slate-700">Page not found</p>
        <p className="text-sm text-slate-500">The page you're looking for doesn't exist.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
