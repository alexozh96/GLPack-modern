import { useNavigate } from 'react-router-dom'

export function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[#f4f6f8] flex items-center justify-center">
      <div className="text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-[#0875e1] flex items-center justify-center mx-auto shadow-md">
          <span className="text-white font-bold text-xl">GL</span>
        </div>
        <div className="space-y-2">
          <p className="text-7xl font-bold text-slate-200 leading-none">404</p>
          <p className="text-xl font-semibold text-slate-700">Page not found</p>
          <p className="text-sm text-slate-400">The page you're looking for doesn't exist.</p>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-5 py-2.5 bg-[#0875e1] hover:bg-[#0667c8] text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
