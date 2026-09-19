/** 月份，格式 "YYYY-MM" */
export type Month = string

export type ItemType = 'income' | 'expense'

export type Frequency = 'monthly' | 'quarterly' | 'semiannual' | 'yearly'

export const FREQUENCY_MONTHS: Record<Frequency, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
}

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  monthly: '每月',
  quarterly: '每季',
  semiannual: '每半年',
  yearly: '每年',
}

export const CATEGORIES = ['居住', '交通', '保險', '訂閱', '稅費', '教育', '生活', '薪資', '其他'] as const
export type Category = (typeof CATEGORIES)[number]
export const DEFAULT_CATEGORY: Category = '其他'

export const HORIZON_OPTIONS = [1, 3, 5, 10] as const
export type HorizonYears = (typeof HORIZON_OPTIONS)[number]

export interface AmountChange {
  /** 從這個月起生效 */
  effectiveMonth: Month
  /** 正整數（新台幣元） */
  amount: number
}

export interface BudgetItem {
  id: string
  name: string
  type: ItemType
  /** 基本金額，正整數 */
  amount: number
  frequency: Frequency
  /** 1–12；非每月項目必填，每月項目為 null */
  anchorMonth: number | null
  /** 1–31，只用於顯示 */
  dayOfMonth: number
  startMonth: Month
  /** null 表示持續 */
  endMonth: Month | null
  category: Category
  /** 依 effectiveMonth 遞增排序 */
  amountChanges: AmountChange[]
  createdAt: string
  updatedAt: string
}

export interface Settings {
  /** 非負整數 */
  initialReserve: number
  horizonYears: HorizonYears
}

export const DEFAULT_SETTINGS: Settings = {
  initialReserve: 0,
  horizonYears: 5,
}
