import Dexie, { type EntityTable } from 'dexie'
import type { BudgetItem, Settings } from '../domain/types'

export interface SettingsRow extends Settings {
  key: 'default'
}

export type PlannerDB = Dexie & {
  items: EntityTable<BudgetItem, 'id'>
  settings: EntityTable<SettingsRow, 'key'>
}

export const DB_NAME = 'fixed-cashflow-planner'

export function createDB(name: string = DB_NAME): PlannerDB {
  const db = new Dexie(name) as PlannerDB
  db.version(1).stores({
    items: 'id, type, name',
    settings: 'key',
  })
  return db
}

export const db = createDB()
