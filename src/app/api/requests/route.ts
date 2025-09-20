import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Fetch Requests based on Assessment schedule dates using scheduledItems.
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('access_token')

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const includeAssignees = searchParams.get('includeAssignees') === '1'

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
  }

  // scheduledItems filter requires occursWithin: DateRange and scheduleItemType
  const assigneesFragment = (withAssignees: boolean) => withAssignees
    ? `assignedUsers(first: 1) { nodes { name { first last } } }`
    : ``

  const baseQuery = (withAssignees: boolean) => `
      query AssessmentsByDateRange($start: ISO8601DateTime!, $end: ISO8601DateTime!, $first: Int, $assignedTo: [EncodedId!], $includeUnassigned: Boolean!) {
        scheduledItems(
          filter: {
            occursWithin: { startAt: $start, endAt: $end }
            scheduleItemType: ASSESSMENT
            includeUnassigned: $includeUnassigned
            assignedTo: $assignedTo
          }
          first: $first
        ) {
          edges {
            node {
              __typename
               ... on Assessment {
                 id
                 startAt
                 endAt
                 title
                 ${assigneesFragment(withAssignees)}
                 request {
                   id
                   jobberWebUri
                   requestStatus
                   title
                  client { name }
                  property {
                    address {
                      street
                      street1
                      street2
                      city
                    }
                  }
                }
              }
            }
          }
        }
      }
    `

  const makeQueryBody = (withAssignees: boolean, assignedToIds: string[] | null) => ({
    query: baseQuery(withAssignees),
    variables: { start: startDate, end: endDate, first: 50, assignedTo: assignedToIds, includeUnassigned: true }
  })

  try {
    async function doFetch(withAssignees: boolean, assignedToIds: string[] | null) {
      const response = await fetch(process.env.JOBBER_API_URL!, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken!.value}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': process.env.JOBBER_API_VERSION!
        },
        body: JSON.stringify(makeQueryBody(withAssignees, assignedToIds))
      })
      const json = await response.json()
      return { ok: response.ok, json }
    }

    // Try to fetch all user IDs to include all assignees instead of defaulting to "current user only".
    let assignedToIds: string[] | null = null
    try {
      const usersQuery = {
        query: `query UsersForSchedule { users(first: 100) { edges { node { id } } } }`
      }
      const usersResp = await fetch(process.env.JOBBER_API_URL!, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken!.value}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': process.env.JOBBER_API_VERSION!
        },
        body: JSON.stringify(usersQuery)
      })
      if (usersResp.ok) {
        const usersJson = await usersResp.json()
        const edges = usersJson?.data?.users?.edges || []
        assignedToIds = edges.map((e: any) => e?.node?.id).filter(Boolean)
        if (!Array.isArray(assignedToIds) || assignedToIds.length === 0) {
          assignedToIds = null
        }
      }
    } catch (_) {
      assignedToIds = null
    }

    let attemptWithAssignees = includeAssignees
    let res = await doFetch(attemptWithAssignees, assignedToIds)
    const throttled = (r: any) => Array.isArray(r?.errors) && r.errors.some((e: any) => e?.extensions?.code === 'THROTTLED')

    if (!res.ok || throttled(res.json)) {
      // Retry once without assignees to reduce cost
      await new Promise(r => setTimeout(r, 250))
      attemptWithAssignees = false
      res = await doFetch(false, assignedToIds)
      if (!res.ok || throttled(res.json)) {
        console.error('Requests API throttled or failed after retry.')
        return NextResponse.json({ error: 'Throttled fetching requests' }, { status: 429 })
      }
    }

    return NextResponse.json(res.json)
  } catch (error: any) {
    console.error('Error fetching assessments via scheduledItems:', error.message)
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
  }
}
