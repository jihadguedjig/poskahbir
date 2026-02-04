import { Flame } from 'lucide-react'

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center">
      <div className="flex items-center gap-3 mb-8">
        <Flame className="w-12 h-12 text-primary-500 animate-pulse" />
        <span className="text-4xl font-bold text-white">Showaya</span>
      </div>
      <div className="spinner w-8 h-8 border-primary-500"></div>
    </div>
  )
}
