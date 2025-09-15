import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { THEMES, getThemeByMode } from '../styles/colors'

const ThemeContext = createContext({
  mode: 'dark',
  theme: THEMES.darkMint,
  toggleTheme: () => {},
  setMode: () => {}
})

export const ThemeProvider = ({ initialMode = 'dark', children }) => {
  const [mode, setMode] = useState(initialMode)

  // Persist choice (localStorage)
  useEffect(() => {
    try { localStorage.setItem('defi10_theme_mode', mode) } catch {}
  }, [mode])

  // Load persisted
  useEffect(() => {
    try {
      const stored = localStorage.getItem('defi10_theme_mode')
      if (stored && (stored === 'dark' || stored === 'light')) setMode(stored)
    } catch {}
  }, [])

  const toggleTheme = useCallback(() => {
    setMode(m => m === 'dark' ? 'light' : 'dark')
  }, [])

  const value = {
    mode,
    theme: getThemeByMode(mode),
    toggleTheme,
    setMode
  }

  // Apply body background instantly for full-screen feel
  useEffect(() => {
    const t = getThemeByMode(mode)
    document.body.style.backgroundColor = t.bgApp
    document.body.style.color = t.textPrimary
  }, [mode])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

export default ThemeContext
