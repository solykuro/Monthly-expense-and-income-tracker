import { repository } from '../db/repository'
import type { BudgetItem } from '../domain/types'

/** 清空預設資料庫 */
export async function resetDB() {
  repository.db.close()
  await repository.db.delete()
  await repository.db.open()
}

export async function seed(items: BudgetItem[], settings = { initialReserve: 0, horizonYears: 5 as const }) {
  await repository.replaceAll(settings, items)
}

/** 只固定 Date，不影響計時器與非同步 */
export function freezeDate(iso: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(iso))
}
