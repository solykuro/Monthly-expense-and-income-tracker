import type { BudgetItem } from '../../domain/types'

let seq = 0

/** 建立測試用項目，預設為每月支出 */
export function makeItem(overrides: Partial<BudgetItem> = {}): BudgetItem {
  seq += 1
  const created = new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString()
  return {
    id: `item-${seq}`,
    name: `項目${seq}`,
    type: 'expense',
    amount: 1000,
    frequency: 'monthly',
    anchorMonth: null,
    dayOfMonth: 1,
    startMonth: '2026-01',
    endMonth: null,
    category: '其他',
    amountChanges: [],
    createdAt: created,
    updatedAt: created,
    ...overrides,
  }
}
