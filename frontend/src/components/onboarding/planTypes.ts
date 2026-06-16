/**
 * Types for the guided WorldSee AI onboarding chat. The chat advances through
 * ordered stages; for each, the model proposes editable items the user reviews
 * and adds before moving on. Nothing persists until the user confirms a stage.
 */
export type ChatStage = 'description' | 'locations' | 'initiatives' | 'metrics' | 'groups'

export interface DescriptionItem {
  statement: string
  description: string
}
export interface LocationItem {
  name: string
  country?: string
}
export interface InitiativeItem {
  title: string
  description?: string
  region?: string
}
export interface MetricItem {
  title: string
  description?: string
  unit_of_measurement: string
  metric_type: 'number' | 'percentage'
  category: 'input' | 'output' | 'impact'
  tags?: string[]
}
export interface GroupItem {
  name: string
  description?: string
  total_number?: number | null
  age_range_start?: number | null
  age_range_end?: number | null
}

export type SectionItem = DescriptionItem | LocationItem | InitiativeItem | MetricItem | GroupItem

export interface OnboardingChatResponse {
  type: 'message' | 'proposal'
  stage: ChatStage
  content: string
  items?: SectionItem[]
}

export interface ChatContext {
  orgName?: string
  initiativeTitle?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
