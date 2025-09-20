import { ScheduledItemsResponse, AssessmentNode } from './types'
import { formatDate, formatTime } from '@/utils/date'

// Extract estimators (first names) from assessment items
export function extractAssessors(data: ScheduledItemsResponse): string[] {
  const estimators = new Set<string>()
  const edges = data?.data?.scheduledItems?.edges || []
  edges.forEach(edge => {
    const node = edge.node as AssessmentNode
    if (node?.__typename !== 'Assessment') return
    const first = getEstimatorFirstName(node)
    if (first) estimators.add(first)
  })
  return Array.from(estimators).sort()
}

function addressFromAssessment(node: AssessmentNode): string {
  const addr = node.request?.property?.address as any
  if (addr) {
    // Use street/street1+street2 only (omit city/province for brevity)
    const street = (addr.street || [addr.street1, addr.street2].filter(Boolean).join(' ')).trim()
    if (street) return street
    if (addr.name) return String(addr.name).trim()
  }
  // Fallback to parsing from title: [jobIdentifier, geoCode, address, workCode]
  const tokens = parseTitleParts(node.request?.title || '')
  return tokens[2] || '?'
}

function geoCodeFromRequestTitle(node: AssessmentNode): string | undefined {
  // Geocode is letters wrapped directly by dashes: -ANYLETTERS-
  // Match the first such occurrence and return the inner letters.
  const title = node.request?.title || ''
  const match = title.match(/-([A-Za-z]+)-/)
  return match?.[1] || undefined
}

function lastNameFromRequest(node: AssessmentNode): string {
  const client: any = node.request?.client
  if (!client) return 'Unknown'
  const nameField = client.name
  if (!nameField) return 'Unknown'
  if (typeof nameField === 'string') {
    const parts = nameField.trim().split(/\s+/)
    return parts[parts.length - 1] || 'Unknown'
  }
  const last = nameField.last?.trim()
  return last || 'Unknown'
}

function getEstimatorFirstName(node: AssessmentNode): string {
  const nm: any = node.assignedUsers?.nodes?.[0]?.name ?? node.assignedUsers?.edges?.[0]?.node?.name
  if (!nm) return ''
  return typeof nm === 'string' ? (nm.split(' ')[0] || '').trim() : (nm?.first?.trim() || '')
}

function buildAssessmentLink(node: AssessmentNode): string {
  const encId = node.id || ''
  let numericId = ''
  try { numericId = atob(encId).replace(/.*\/(\d+)$/, '$1') } catch (_) { numericId = '' }
  const base = node.request?.jobberWebUri || ''
  return base && numericId ? `${base}?appointment_id=${numericId}` : base
}

// ADDRESS -GEOCODE- LAST_NAME
export function formatRequestList(
  data: ScheduledItemsResponse,
  settings: any,
  startDate: Date | null,
  endDate: Date | null,
  formatType: 'markdown' | 'plaintext' = 'markdown',
  filterText: string = ''
): string {
  // If user chose "Include Selected" estimators but selected none, show nothing
  if (settings?.salespersonFilter === 'showSelected') {
    const selected = settings.selectedSalespeople || []
    if (selected.length === 0) {
      return ''
    }
  }
  let output = ''
  let count = 0
  let lines = ''

  const items = data?.data?.scheduledItems?.edges ? data.data.scheduledItems.edges : []

  // Sorting based on settings.sortBy (date, alphabetical, estimator)
  const sortKey = settings.sortBy
  items.sort((a, b) => {
    const A = a.node as AssessmentNode
    const B = b.node as AssessmentNode
    if (A?.__typename !== 'Assessment' || B?.__typename !== 'Assessment') return 0
    switch (sortKey) {
      case 'alphabetical':
        return lastNameFromRequest(A).localeCompare(lastNameFromRequest(B))
      case 'salesperson':
        return getEstimatorFirstName(A).localeCompare(getEstimatorFirstName(B))
      case 'geoCode': {
        const aGeo = geoCodeFromRequestTitle(A) || ''
        const bGeo = geoCodeFromRequestTitle(B) || ''
        return aGeo.localeCompare(bGeo)
      }
      case 'date':
      default:
        return new Date(A.startAt || 0).getTime() - new Date(B.startAt || 0).getTime()
    }
  })

  items.forEach(edge => {
    const node = edge.node as AssessmentNode
    if (node?.__typename !== 'Assessment') return

    // If filtering by selected estimators but none are selected, show nothing
    if (settings.salespersonFilter === 'showSelected') {
      const selected = settings.selectedSalespeople || []
      if (selected.length === 0) return
    }

    // Build display and filter text
    const address = addressFromAssessment(node)
    const lastName = lastNameFromRequest(node)
    const geoCode = geoCodeFromRequestTitle(node) || '?'

    const textBlob = `${address} ${lastName} ${geoCode}`.toLowerCase()
    if (filterText && !textBlob.includes(filterText.toLowerCase())) return

    // Annual filters not applicable to requests; ignore settings.annual

    // People filter (estimator) with support for 'Unassigned'
    if (settings.salespersonFilter === 'showSelected') {
      const first = getEstimatorFirstName(node)
      const selected = settings.selectedSalespeople || []
      const wantsUnassigned = selected.includes('Unassigned')
      if (first) {
        if (!selected.includes(first)) return
      } else {
        if (!wantsUnassigned) return
      }
    }

    // Day filter (match Visits behavior): include only selected days
    if (settings.dayFilter === 'showSelected') {
      if (!node.startAt) return
      const jobDate = new Date(node.startAt)
      const dayOfWeek = jobDate.getDay() // 0=Sun..6=Sat
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const dayName = dayNames[dayOfWeek]
      if (!settings.selectedDays || settings.selectedDays.length === 0 || !settings.selectedDays.includes(dayName)) {
        return
      }
    }

    // Date/time formatting
    const visitDate = node.startAt ? formatDate(node.startAt) : ''
    const startTime = node.startAt ? formatTime(node.startAt) : ''
    const endTime = node.endAt ? formatTime(node.endAt) : ''
    let timeRange = ''
    if (settings.showTime) {
      let t = ''
      if (startTime && startTime !== '12:00 AM') t = startTime
      if (endTime && endTime !== '11:59 PM') t = t ? `${t}-${endTime}` : endTime
      timeRange = (t || '').replace(/\s?(AM|PM)/gi, '').trim()
    }

    count++

    if (formatType === 'markdown') {
      const datePart = settings.showDates ? ` **\`${visitDate}\`** ` : ''
      const timePart = settings.showTime && timeRange ? ` **\`${timeRange}\`**` : ''
      const estimatorFirst = getEstimatorFirstName(node)
      const estimator = settings.showSalesperson ? ` \`${estimatorFirst || 'Unknown'}\`` : ''
      const assessLink = buildAssessmentLink(node)
      const lastNameMd = assessLink ? `[**${lastName}**](${assessLink})` : `**${lastName}**`
      const mapsAddress = `${address}`.replace(/\s\/\s/g, '+').replace(/\s/g, '+') + '+Spokane,WA'
      const googleMapsUrl = `https://www.google.com/maps/place/${mapsAddress}`
      const addressMd = `[${address}](${googleMapsUrl})`
      lines += `${datePart}${lastNameMd} -${geoCode}- ${addressMd}${timePart}${estimator}\n\n`
    } else {
      const datePart = settings.showDates ? ` ${visitDate}` : ''
      const timePart = settings.showTime && timeRange ? ` ${timeRange}` : ''
      const estimatorFirst = getEstimatorFirstName(node)
      const estimator = settings.showSalesperson ? ` - ${estimatorFirst || 'Unknown'}` : ''
      lines += `${lastName} -${geoCode}- ${address}${datePart}${timePart}${estimator}\n\n`
    }
  })

  if (settings.showRangeInfo && startDate && endDate) {
    const formattedStartDate = formatDate(startDate.toISOString())
    const formattedEndDate = formatDate(endDate.toISOString())
    if (formatType === 'markdown') {
      output += `# **${formattedStartDate} &ndash; ${formattedEndDate}** **\`${count} Requests\`**\n\n`
    } else {
      output += `${formattedStartDate}&ndash;${formattedEndDate}, ${count} Requests\n\n------------------------------\n\n`
    }
  }

  output += lines
  return output
}

function parseTitleParts(title: string): [string, string, string, string] {
  // Reuse the regex pattern from visits title parsing
  const match = title.match(/(^[^-]+)|(-[A-Z]+-)|([^-\s][^-\n]*[^-\s])|(-[^-\s][^-\n]*[^-\s])/g) || []
  const jobIdentifier = (match[0] || '').trim()
  const geoCode = (match[1] || '').replace(/-/g, '').trim()
  const address = (match[2] || '').trim()
  const workCode = (match[3] || '').replace(/-/g, '').trim()
  return [jobIdentifier, geoCode, address, workCode]
}
