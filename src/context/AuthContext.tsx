import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { auth } from '../services/firebase'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'

export interface AuthContextType {
  currentUser: User | null
  loading: boolean
  signup: (email: string, pass: string) => Promise<any>
  login: (email: string, pass: string) => Promise<any>
  logout: () => Promise<void>
}

const defaultContext: AuthContextType = {
  currentUser: null,
  loading: true,
  signup: async () => {
    throw new Error('AuthProvider not initialized')
  },
  login: async () => {
    throw new Error('AuthProvider not initialized')
  },
  logout: async () => {
    throw new Error('AuthProvider not initialized')
  },
}

const AuthContext = createContext<AuthContextType>(defaultContext)

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signup = (email: string, pass: string) => createUserWithEmailAndPassword(auth, email, pass)

  const login = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass)

  const logout = async () => {
    await signOut(auth)
  }

  const value: AuthContextType = { currentUser, loading, signup, login, logout }

  if (loading) return null

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
