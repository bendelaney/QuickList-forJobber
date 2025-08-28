import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import axios from 'axios'

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
    const response = await axios.post(process.env.JOBBER_API_URL!, graphQLQuery, {
      headers: {
        'Authorization': `Bearer ${accessToken.value}`,
        'Content-Type': 'application/json',
        'X-JOBBER-GRAPHQL-VERSION': process.env.JOBBER_API_VERSION
      }
    })
    
    return NextResponse.json(response.data)
  } catch (error: any) {
    if (error.response) {
      console.error('Error fetching visits:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      })
    } else {
      console.error('Error fetching visits:', error.message)
    }
    return NextResponse.json({ error: 'Failed to fetch visits' }, { status: 500 })
  }
}