import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('access_token')
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  
  const searchParams = request.nextUrl.searchParams
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
  }
  
  const graphQLQuery = {
    query: `
      query VisitsByDateRange($start: ISO8601DateTime!, $end: ISO8601DateTime!) {
        visits(
          filter: {
            startAt: {
              after: $start,
              before: $end
            }
          }
          sort: {
            key: START_AT,
            direction: ASCENDING
          }
          timezone: "America/Los_Angeles"
        ) {
          edges {
            node {
              id
              title
              startAt
              endAt
              job {
                jobType
                jobberWebUri
                total
                salesperson {
                  name {
                    first
                    last
                  }
                }
              }
            }
          }
        }
      }
    `,
    variables: {
      start: startDate,
      end: endDate
    }
  }
  
  try {
    const response = await fetch(process.env.JOBBER_API_URL!, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.value}`,
        'Content-Type': 'application/json',
        'X-JOBBER-GRAPHQL-VERSION': process.env.JOBBER_API_VERSION!
      },
      body: JSON.stringify(graphQLQuery)
    })
    
    if (!response.ok) {
      console.error('Error fetching visits:', {
        status: response.status,
        statusText: response.statusText
      })
      return NextResponse.json({ error: 'Failed to fetch visits' }, { status: 500 })
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error fetching visits:', error.message)
    return NextResponse.json({ error: 'Failed to fetch visits' }, { status: 500 })
  }
}