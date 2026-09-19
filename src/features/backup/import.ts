import { validateItem, validateSettings } from '../../domain/validation'
import type { BudgetItem, Settings } from '../../domain/types'
import { APP_ID, SCHEMA_VERSION } from './format'

export const IMPORT_MESSAGES = {
  notJson: '檔案格式錯誤，無法讀取',
  wrongApp: '這不是本工具的備份檔',
  newerVersion: '備份檔版本較新，請更新 App 後再匯入',
  invalidSettings: '備份檔的設定資料有誤',
  invalidItems: '備份檔的項目資料有誤',
  itemError: (index: number, message: string) => `第 ${index} 個項目資料有誤：${message}`,
  duplicateId: (index: number) => `第 ${index} 個項目資料有誤：識別碼重複`,
  writeFailed: '匯入失敗，資料未變更',
} as const

export type ImportResult =
  | { ok: true; settings: Settings; items: BudgetItem[]; exportedAt: string | null }
  | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const REQUIRED_KEYS: (keyof BudgetItem)[] = [
  'id', 'name', 'type', 'amount', 'frequency', 'anchorMonth', 'dayOfMonth',
  'startMonth', 'endMonth', 'category', 'amountChanges', 'createdAt', 'updatedAt',
]

export function parseBackup(text: string): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: IMPORT_MESSAGES.notJson }
  }
  if (!isRecord(data) || data.app !== APP_ID) return { ok: false, error: IMPORT_MESSAGES.wrongApp }

  const version = data.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: IMPORT_MESSAGES.wrongApp }
  }
  if (version > SCHEMA_VERSION) return { ok: false, error: IMPORT_MESSAGES.newerVersion }

  if (!isRecord(data.settings)) return { ok: false, error: IMPORT_MESSAGES.invalidSettings }
  const settingsInput = { initialReserve: data.settings.initialReserve, horizonYears: data.settings.horizonYears }
  if (typeof settingsInput.initialReserve !== 'number' || Object.keys(validateSettings(settingsInput)).length > 0) {
    return { ok: false, error: IMPORT_MESSAGES.invalidSettings }
  }
  const settings = settingsInput as Settings

  if (!Array.isArray(data.items)) return { ok: false, error: IMPORT_MESSAGES.invalidItems }
  const items: BudgetItem[] = []
  const ids = new Set<string>()
  for (let i = 0; i < data.items.length; i++) {
    const raw = data.items[i]
    const position = i + 1
    if (!isRecord(raw) || REQUIRED_KEYS.some((k) => !(k in raw))) {
      return { ok: false, error: IMPORT_MESSAGES.itemError(position, '缺少必要欄位') }
    }
    if (typeof raw.id !== 'string' || raw.id === '' || typeof raw.createdAt !== 'string' || typeof raw.updatedAt !== 'string') {
      return { ok: false, error: IMPORT_MESSAGES.itemError(position, '缺少必要欄位') }
    }
    if (typeof raw.amount !== 'number' || typeof raw.dayOfMonth !== 'number') {
      return { ok: false, error: IMPORT_MESSAGES.itemError(position, '金額必須是大於 0 的整數') }
    }
    if (!Array.isArray(raw.amountChanges) || raw.amountChanges.some((c) => !isRecord(c) || typeof c.amount !== 'number')) {
      return { ok: false, error: IMPORT_MESSAGES.itemError(position, '金額異動紀錄格式錯誤') }
    }
    const item = raw as unknown as BudgetItem
    if (item.frequency === 'monthly' && item.anchorMonth !== null) {
      return { ok: false, error: IMPORT_MESSAGES.itemError(position, '每月項目不應有發生月份') }
    }
    const message = validateItem(item)
    if (message) return { ok: false, error: IMPORT_MESSAGES.itemError(position, message) }
    if (ids.has(item.id)) return { ok: false, error: IMPORT_MESSAGES.duplicateId(position) }
    ids.add(item.id)
    items.push({
      id: item.id,
      name: item.name,
      type: item.type,
      amount: item.amount,
      frequency: item.frequency,
      anchorMonth: item.anchorMonth,
      dayOfMonth: item.dayOfMonth,
      startMonth: item.startMonth,
      endMonth: item.endMonth,
      category: item.category,
      amountChanges: item.amountChanges.map((c) => ({ effectiveMonth: c.effectiveMonth, amount: c.amount })),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })
  }

  const exportedAt = typeof data.exportedAt === 'string' ? data.exportedAt : null
  return { ok: true, settings: { initialReserve: settings.initialReserve, horizonYears: settings.horizonYears }, items, exportedAt }
}

/** 顯示用的匯出日期（YYYY-MM-DD，裝置當地時間） */
export function formatExportDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
