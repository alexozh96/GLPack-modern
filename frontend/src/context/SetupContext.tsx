import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getSetup } from '../api/setup'
import type { SetupData } from '../api/setup'

interface SetupContextValue {
  setup: SetupData | null
  loading: boolean
}

const SetupContext = createContext<SetupContextValue>({ setup: null, loading: true })

export function SetupProvider({ children }: { children: ReactNode }) {
  const [setup, setSetup] = useState<SetupData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSetup()
      .then(setSetup)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return <SetupContext.Provider value={{ setup, loading }}>{children}</SetupContext.Provider>
}

export function useSetup() {
  return useContext(SetupContext)
}
