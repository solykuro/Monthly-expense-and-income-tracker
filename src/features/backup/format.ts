import type { BudgetItem, Settings } from '../../domain/types'

export const APP_ID = 'fixed-cashflow-planner'
export const SCHEMA_VERSION = 1

export interface BackupFile {
  app: typeof APP_ID
  schemaVersion: number
  exportedAt: string
  settings: Settings
  items: BudgetItem[]
}
