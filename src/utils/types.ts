export type Mode = 'visits' | 'requests'

export interface PersonName {
  first?: string
  last?: string
}

export interface Address {
  street?: string
  street1?: string
  street2?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
  name?: string
}

export interface JobberCustomField {
  label?: string
  value?: string | number | null
}

export interface RequestNode {
  id: string
  requestStatus?: string
  jobberWebUri?: string
  client?: { name?: PersonName | string }
  property?: { address?: Address }
  title?: string
  customFields?: JobberCustomField[]
}

export interface AssessmentNode {
  __typename?: 'Assessment'
  id: string
  startAt?: string
  endAt?: string
  title?: string
  assignedUsers?: {
    nodes?: Array<{ name?: PersonName | string }>
    edges?: Array<{ node?: { name?: PersonName | string } }>
  }
  request?: RequestNode
}

export interface ScheduledItemsResponse {
  data?: {
    scheduledItems?: {
      edges?: Array<{ node: AssessmentNode | any }>
    }
  }
}
