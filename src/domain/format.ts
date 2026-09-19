import { FREQUENCY_LABELS, FREQUENCY_MONTHS, type BudgetItem } from './types'

const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** 千分位金額，例如 44,000、-1,000 */
export function formatAmount(value: number): string {
  return formatter.format(value)
}

/** 週期與發生日期的說明，例如「每月 5 日」「每年 3 月 15 日」「每季（2、5、8、11 月）15 日」 */
export function describeSchedule(item: Pick<BudgetItem, 'frequency' | 'anchorMonth' | 'dayOfMonth'>): string {
  const day = `${item.dayOfMonth} 日`
  if (item.frequency === 'monthly') return `每月 ${day}`
  const anchor = item.anchorMonth ?? 1
  if (item.frequency === 'yearly') return `每年 ${anchor} 月 ${day}`
  const period = FREQUENCY_MONTHS[item.frequency]
  const months: number[] = []
  for (let m = 1; m <= 12; m++) {
    if ((((m - anchor) % period) + period) % period === 0) months.push(m)
  }
  return `${FREQUENCY_LABELS[item.frequency]}（${months.join('、')} 月）${day}`
}
