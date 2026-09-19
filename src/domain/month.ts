import type { Month } from './types'

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/

export function isValidMonth(value: unknown): value is Month {
  return typeof value === 'string' && MONTH_PATTERN.test(value)
}

/** 轉為連續月序號：year * 12 + (month - 1) */
export function toIndex(month: Month): number {
  const match = MONTH_PATTERN.exec(month)
  if (!match) throw new Error(`無效的月份：${month}`)
  return Number(match[1]) * 12 + Number(match[2]) - 1
}

export function fromIndex(index: number): Month {
  const year = Math.floor(index / 12)
  const month = index - year * 12 + 1
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
}

export function addMonths(month: Month, count: number): Month {
  return fromIndex(toIndex(month) + count)
}

/** 小於 0 表示 a 較早，等於 0 表示相同，大於 0 表示 a 較晚 */
export function compareMonths(a: Month, b: Month): number {
  return toIndex(a) - toIndex(b)
}

/** 月份數字（1–12） */
export function monthOfYear(month: Month): number {
  return Number(month.slice(5, 7))
}

export function yearOf(month: Month): number {
  return Number(month.slice(0, 4))
}

/** 裝置當地時間所在的月份 */
export function currentMonth(date: Date = new Date()): Month {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function daysInMonth(month: Month): number {
  return new Date(yearOf(month), monthOfYear(month), 0).getDate()
}

/** 發生日期顯示：超出當月天數時取月底，格式 "YYYY-MM-DD" */
export function displayDate(month: Month, dayOfMonth: number): string {
  const day = Math.min(dayOfMonth, daysInMonth(month))
  return `${month}-${String(day).padStart(2, '0')}`
}

/** 月份的中文顯示，例如 "2026 年 9 月" */
export function formatMonth(month: Month): string {
  return `${yearOf(month)} 年 ${monthOfYear(month)} 月`
}
