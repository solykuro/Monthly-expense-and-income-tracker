import type { Repository } from '../../db/repository'
import { APP_ID, SCHEMA_VERSION, type BackupFile } from './format'

export function backupFileName(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `fixed-cashflow-${y}${m}${d}.json`
}

export async function buildBackup(repo: Repository, now: Date = new Date()): Promise<BackupFile> {
  const [settings, items] = await Promise.all([repo.getSettings(), repo.listItems()])
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    settings,
    items,
  }
}

/** 產生備份並觸發下載，回傳檔名 */
export async function downloadBackup(repo: Repository, now: Date = new Date()): Promise<string> {
  const backup = await buildBackup(repo, now)
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const name = backupFileName(now)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return name
}
