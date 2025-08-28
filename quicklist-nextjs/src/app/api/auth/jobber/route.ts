import { NextRequest, NextResponse } from 'next/server'
import { redirect } from 'next/navigation'

export async function GET(request: NextRequest) {
  // Redirect to Jobber OAuth
  const authUrl = new URL(process.env.JOBBER_AUTHORIZATION_URL!)
  authUrl.searchParams.set('client_id', process.env.JOBBER_CLIENT_ID!)
  authUrl.searchParams.set('redirect_uri', process.env.JOBBER_CALLBACK_URL!)
  authUrl.searchParams.set('scope', process.env.JOBBER_SCOPE!)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('state', 'random-state-string') // Should be random in production
  
  return NextResponse.redirect(authUrl.toString())
}