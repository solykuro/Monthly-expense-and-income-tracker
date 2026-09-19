import type { BudgetItem, Settings } from '../domain/types'
import { DEFAULT_SETTINGS } from '../domain/types'
import { compareMonths } from '../domain/month'
import { db as defaultDB, type PlannerDB } from './db'

export type NewItem = Omit<BudgetItem, 'id' | 'createdAt' | 'updatedAt'>

function sortChanges(item: BudgetItem): BudgetItem {
  return {
    ...item,
    name: item.name.trim(),
    amountChanges: [...item.amountChanges].sort((a, b) => compareMonths(a.effectiveMonth, b.effectiveMonth)),
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createRepository(db: PlannerDB = defaultDB) {
  return {
    db,

    async listItems(): Promise<BudgetItem[]> {
      return db.items.toArray()
    },

    async getItem(id: string): Promise<BudgetItem | undefined> {
      return db.items.get(id)
    },

    async addItem(input: NewItem, now: Date = new Date()): Promise<BudgetItem> {
      const timestamp = now.toISOString()
      const item = sortChanges({ ...input, id: newId(), createdAt: timestamp, updatedAt: timestamp })
      await db.items.add(item)
      return item
    },

    async updateItem(item: BudgetItem, now: Date = new Date()): Promise<BudgetItem> {
      const updated = sortChanges({ ...item, updatedAt: now.toISOString() })
      await db.items.put(updated)
      return updated
    },

    async deleteItem(id: string): Promise<void> {
      await db.items.delete(id)
    },

    async getSettings(): Promise<Settings> {
      const row = await db.settings.get('default')
      if (!row) return { ...DEFAULT_SETTINGS }
      return { initialReserve: row.initialReserve, horizonYears: row.horizonYears }
    },

    async saveSettings(settings: Settings): Promise<void> {
      await db.settings.put({ key: 'default', ...settings })
    },

    /** 在單一交易中清空並寫入；任何錯誤都會回復原資料 */
    async replaceAll(settings: Settings, items: BudgetItem[]): Promise<void> {
      await db.transaction('rw', db.items, db.settings, async () => {
        await db.items.clear()
        await db.settings.clear()
        await db.settings.put({ key: 'default', ...settings })
        await db.items.bulkAdd(items.map(sortChanges))
      })
    },
  }
}

export type Repository = ReturnType<typeof createRepository>

export const repository = createRepository()
