import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  
  if (!code) {
    return NextResponse.json({ error: 'Authorization code not provided' }, { status: 400 })
  }
  
  try {
    // Exchange code for access token
    const tokenData = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.JOBBER_CALLBACK_URL!,
      client_id: process.env.JOBBER_CLIENT_ID!,
      client_secret: process.env.JOBBER_CLIENT_SECRET!
    })

    console.log('Token request data:', {
      url: process.env.JOBBER_TOKEN_URL,
      redirect_uri: process.env.JOBBER_CALLBACK_URL,
      client_id: process.env.JOBBER_CLIENT_ID,
      code: code?.substring(0, 10) + '...' // Log partial code for debugging
    })

    const tokenResponse = await fetch(process.env.JOBBER_TOKEN_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenData
    })
    
    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenResponse.status, tokenResponse.statusText)
      return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
    }
    
    const tokenData_response = await tokenResponse.json()
    const { access_token, refresh_token } = tokenData_response
    
    // In a real app, you'd store these tokens securely (database, encrypted cookies, etc.)
    // For now, we'll use a simple cookie approach
    const baseUrl = request.nextUrl.origin
    const response = NextResponse.redirect(`${baseUrl}/`)
    response.cookies.set('access_token', access_token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600 // 1 hour
    })
    
    if (refresh_token) {
      response.cookies.set('refresh_token', refresh_token, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 86400 * 30 // 30 days
      })
    }
    
    return response
    
  } catch (error: any) {
    console.error('OAuth callback error:', error)
    return NextResponse.json({ 
      error: 'Authentication failed',
      details: error.message || 'Unknown error'
    }, { status: 500 })
  }
}