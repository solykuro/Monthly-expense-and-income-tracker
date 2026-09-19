import { compareMonths, isValidMonth } from './month'
import {
  CATEGORIES,
  FREQUENCY_MONTHS,
  HORIZON_OPTIONS,
  type AmountChange,
  type BudgetItem,
  type Settings,
} from './types'

export const MESSAGES = {
  nameRequired: '請輸入名稱',
  amountInvalid: '金額必須是大於 0 的整數',
  endBeforeStart: '結束月份不能早於開始月份',
  anchorRequired: '請選擇發生月份',
  dayInvalid: '日期必須介於 1 到 31',
  monthInvalid: '請選擇月份',
  typeInvalid: '請選擇收入或支出',
  frequencyInvalid: '請選擇週期',
  categoryInvalid: '請選擇分類',
  changeDuplicate: '此月份已有異動紀錄',
  changeOutOfRange: '生效月份必須在項目期間內，且晚於開始月份',
  reserveInvalid: '預留金必須是 0 以上的整數',
  horizonInvalid: '請選擇推演年數',
} as const

export type FieldErrors = Partial<Record<string, string>>

/** 可接受數字或字串（表單輸入）；回傳解析後的整數或 null */
export function parseInteger(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!/^-?\d+$/.test(trimmed)) return null
    return Number(trimmed)
  }
  return null
}

export function isPositiveInteger(value: unknown): boolean {
  const n = parseInteger(value)
  return n !== null && n > 0 && Number.isSafeInteger(n)
}

/** 項目主要欄位驗證（不含異動紀錄） */
export type ItemFields = Pick<
  BudgetItem,
  'name' | 'type' | 'amount' | 'frequency' | 'anchorMonth' | 'dayOfMonth' | 'startMonth' | 'endMonth' | 'category'
>

export function validateItemFields(item: ItemFields): FieldErrors {
  const errors: FieldErrors = {}
  if (typeof item.name !== 'string' || item.name.trim() === '') errors.name = MESSAGES.nameRequired
  if (item.type !== 'income' && item.type !== 'expense') errors.type = MESSAGES.typeInvalid
  if (!isPositiveInteger(item.amount)) errors.amount = MESSAGES.amountInvalid

  const frequencyValid = typeof item.frequency === 'string' && item.frequency in FREQUENCY_MONTHS
  if (!frequencyValid) errors.frequency = MESSAGES.frequencyInvalid
  if (frequencyValid && item.frequency !== 'monthly') {
    const anchor = item.anchorMonth
    if (typeof anchor !== 'number' || !Number.isInteger(anchor) || anchor < 1 || anchor > 12) {
      errors.anchorMonth = MESSAGES.anchorRequired
    }
  }

  const day = parseInteger(item.dayOfMonth)
  if (day === null || day < 1 || day > 31) errors.dayOfMonth = MESSAGES.dayInvalid

  if (!isValidMonth(item.startMonth)) errors.startMonth = MESSAGES.monthInvalid
  if (item.endMonth !== null && !isValidMonth(item.endMonth)) errors.endMonth = MESSAGES.monthInvalid
  if (
    !errors.startMonth &&
    !errors.endMonth &&
    item.endMonth !== null &&
    compareMonths(item.endMonth, item.startMonth) < 0
  ) {
    errors.endMonth = MESSAGES.endBeforeStart
  }

  if (!(CATEGORIES as readonly string[]).includes(item.category)) errors.category = MESSAGES.categoryInvalid
  return errors
}

/**
 * 驗證一筆異動紀錄。
 * @param others 同一項目的其他異動紀錄（不含正在驗證的這筆）
 */
export function validateAmountChange(
  change: AmountChange,
  item: Pick<BudgetItem, 'startMonth' | 'endMonth'>,
  others: AmountChange[],
): FieldErrors {
  const errors: FieldErrors = {}
  if (!isValidMonth(change.effectiveMonth)) {
    errors.effectiveMonth = MESSAGES.monthInvalid
  } else if (
    !isValidMonth(item.startMonth) ||
    compareMonths(change.effectiveMonth, item.startMonth) <= 0 ||
    (item.endMonth !== null && compareMonths(change.effectiveMonth, item.endMonth) > 0)
  ) {
    errors.effectiveMonth = MESSAGES.changeOutOfRange
  } else if (others.some((o) => o.effectiveMonth === change.effectiveMonth)) {
    errors.effectiveMonth = MESSAGES.changeDuplicate
  }
  if (!isPositiveInteger(change.amount)) errors.amount = MESSAGES.amountInvalid
  return errors
}

/** 驗證整個項目（含所有異動紀錄），回傳第一個錯誤訊息或 null */
export function validateItem(item: BudgetItem): string | null {
  const fieldErrors = validateItemFields(item)
  const first = Object.values(fieldErrors)[0]
  if (first) return first
  if (!Array.isArray(item.amountChanges)) return MESSAGES.amountInvalid
  for (let i = 0; i < item.amountChanges.length; i++) {
    const change = item.amountChanges[i]
    const others = item.amountChanges.filter((_, j) => j !== i)
    const errors = validateAmountChange(change, item, others)
    const msg = Object.values(errors)[0]
    if (msg) return msg
  }
  return null
}

export function validateSettings(settings: { initialReserve: unknown; horizonYears: unknown }): FieldErrors {
  const errors: FieldErrors = {}
  const reserve = parseInteger(settings.initialReserve)
  if (reserve === null || reserve < 0 || !Number.isSafeInteger(reserve)) errors.initialReserve = MESSAGES.reserveInvalid
  if (!(HORIZON_OPTIONS as readonly unknown[]).includes(settings.horizonYears)) errors.horizonYears = MESSAGES.horizonInvalid
  return errors
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some(Boolean)
}

export type { Settings }
