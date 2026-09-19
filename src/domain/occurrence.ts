import { compareMonths, fromIndex, monthOfYear, toIndex } from './month'
import { FREQUENCY_MONTHS, type BudgetItem, type Month } from './types'

type OccurrenceItem = Pick<BudgetItem, 'frequency' | 'anchorMonth' | 'startMonth' | 'endMonth'>

function inRange(item: OccurrenceItem, month: Month): boolean {
  if (compareMonths(month, item.startMonth) < 0) return false
  if (item.endMonth !== null && compareMonths(month, item.endMonth) > 0) return false
  return true
}

function matchesCycle(item: OccurrenceItem, month: Month): boolean {
  if (item.frequency === 'monthly') return true
  const period = FREQUENCY_MONTHS[item.frequency]
  const anchor = item.anchorMonth ?? 1
  const diff = monthOfYear(month) - anchor
  return ((diff % period) + period) % period === 0
}

export function occursIn(item: OccurrenceItem, month: Month): boolean {
  return inRange(item, month) && matchesCycle(item, month)
}

/** 項目在某月適用的金額：生效月份不晚於該月的最後一筆異動，否則為基本金額 */
export function amountAt(item: Pick<BudgetItem, 'amount' | 'amountChanges'>, month: Month): number {
  let amount = item.amount
  let latest: Month | null = null
  for (const change of item.amountChanges) {
    if (compareMonths(change.effectiveMonth, month) <= 0 && (latest === null || compareMonths(change.effectiveMonth, latest) > 0)) {
      latest = change.effectiveMonth
      amount = change.amount
    }
  }
  return amount
}

/** 在 fromMonth 或之後的下一次發生月份；不存在則為 null */
export function nextOccurrence(item: OccurrenceItem, fromMonth: Month): Month | null {
  const period = FREQUENCY_MONTHS[item.frequency]
  let idx = Math.max(toIndex(fromMonth), toIndex(item.startMonth))
  const end = item.endMonth === null ? Infinity : toIndex(item.endMonth)
  // 最多檢查一個週期即可找到符合的月份
  for (let i = 0; i < period; i++, idx++) {
    if (idx > end) return null
    const month = fromIndex(idx)
    if (matchesCycle(item, month)) return month
  }
  return null
}

/** 在 beforeMonth 之前（不含）的上一次發生月份；不存在則為 null */
export function previousOccurrence(item: OccurrenceItem, beforeMonth: Month): Month | null {
  const period = FREQUENCY_MONTHS[item.frequency]
  let idx = toIndex(beforeMonth) - 1
  if (item.endMonth !== null) idx = Math.min(idx, toIndex(item.endMonth))
  const start = toIndex(item.startMonth)
  for (let i = 0; i < period; i++, idx--) {
    if (idx < start) return null
    const month = fromIndex(idx)
    if (matchesCycle(item, month)) return month
  }
  return null
}
