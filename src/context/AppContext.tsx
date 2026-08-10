import React, { createContext, useContext, useState } from 'react'
import type { AppState } from '../types'

type AppContextType = {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}

const defaultState: AppState = { jobs: [] }

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(defaultState)

  return <AppContext.Provider value={{ state, setState }}>{children}</AppContext.Provider>
}

export const useApp = (): AppContextType => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
