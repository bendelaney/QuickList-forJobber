import { NextRequest, NextResponse } from 'next/server'
import { redirect } from 'next/navigation'

export async function GET(request: NextRequest) {
  try {
    // Check for required environment variables
    const requiredEnvs = {
      JOBBER_AUTHORIZATION_URL: process.env.JOBBER_AUTHORIZATION_URL,
      JOBBER_CLIENT_ID: process.env.JOBBER_CLIENT_ID,
      JOBBER_CALLBACK_URL: process.env.JOBBER_CALLBACK_URL,
      JOBBER_SCOPE: process.env.JOBBER_SCOPE
    }

    const missing = Object.entries(requiredEnvs).filter(([key, value]) => !value)
    if (missing.length > 0) {
      console.error('Missing environment variables:', missing.map(([key]) => key))
      return NextResponse.json({ 
        error: 'Server configuration error', 
        missing: missing.map(([key]) => key)
      }, { status: 500 })
    }

    // Redirect to Jobber OAuth
    const authUrl = new URL(process.env.JOBBER_AUTHORIZATION_URL!)
    authUrl.searchParams.set('client_id', process.env.JOBBER_CLIENT_ID!)
    authUrl.searchParams.set('redirect_uri', process.env.JOBBER_CALLBACK_URL!)
    authUrl.searchParams.set('scope', process.env.JOBBER_SCOPE!)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('state', 'random-state-string') // Should be random in production
    
    console.log('Redirecting to:', authUrl.toString())
    return NextResponse.redirect(authUrl.toString())
  } catch (error: any) {
    console.error('OAuth redirect error:', error)
    return NextResponse.json({ 
      error: 'Failed to initiate OAuth flow',
      details: error.message 
    }, { status: 500 })
  }
}