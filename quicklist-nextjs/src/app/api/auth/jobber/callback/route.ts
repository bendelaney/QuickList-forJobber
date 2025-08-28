import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

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

    const tokenResponse = await axios.post(process.env.JOBBER_TOKEN_URL!, tokenData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
    
    const { access_token, refresh_token } = tokenResponse.data
    
    // In a real app, you'd store these tokens securely (database, encrypted cookies, etc.)
    // For now, we'll use a simple cookie approach
    const response = NextResponse.redirect(new URL('/', request.url))
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
    
  } catch (error) {
    console.error('OAuth callback error:', error)
    if (axios.isAxiosError(error)) {
      console.error('Response status:', error.response?.status)
      console.error('Response data:', error.response?.data)
      console.error('Response headers:', error.response?.headers)
    }
    return NextResponse.json({ 
      error: 'Authentication failed',
      details: axios.isAxiosError(error) ? error.response?.data : 'Unknown error'
    }, { status: 500 })
  }
}