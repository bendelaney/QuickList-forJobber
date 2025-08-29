'use client'

import { useState, useEffect } from 'react'
import AuthLoading from '@/components/AuthLoading'
import QuickList from '@/components/QuickList'

export default function Page() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  
  // Check authentication on mount
  useEffect(() => {
    checkAuthentication()
  }, [])

  const checkAuthentication = async () => {
    try {
      const response = await fetch('/api/authenticated', { 
        headers: { 'Accept': 'application/json' } 
      })
      setIsAuthenticated(response.ok)
      if (!response.ok) {
        window.location.href = '/api/auth/jobber'
        return
      }
    } catch (error) {
      console.log('Not authenticated, redirecting to login...')
      window.location.href = '/api/auth/jobber'
      return
    }
  }

  // Don't render anything until authentication is checked
  if (isAuthenticated === null) {
    return <AuthLoading state="checking" />
  }

  if (!isAuthenticated) {
    return <AuthLoading state="redirecting" />
  }

  return <QuickList />
}
