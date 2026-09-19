import { useRef, useState, type ChangeEvent } from 'react'
import { useSettings } from '../../app/hooks'
import { ConfirmDialog } from '../../components/Sheet'
import { Segmented } from '../../components/Segmented'
import { repository } from '../../db/repository'
import { HORIZON_OPTIONS, type HorizonYears, type Settings } from '../../domain/types'
import { parseInteger, validateSettings } from '../../domain/validation'
import { downloadBackup } from '../backup/export'
import { formatExportDate, IMPORT_MESSAGES, parseBackup } from '../backup/import'
import './settings.css'

type Pending = { settings: Settings; items: Awaited<ReturnType<typeof repository.listItems>>; exportedAt: string | null }
type Status = { kind: 'success' | 'error'; text: string } | null

export function SettingsPage() {
  const settings = useSettings()
  if (!settings) return <div className="page" aria-busy="true" />
  return <SettingsForm settings={settings} />
}

function SettingsForm({ settings }: { settings: Settings }) {
  const [reserveText, setReserveText] = useState(() => String(settings.initialReserve))
  const [reserveError, setReserveError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [status, setStatus] = useState<Status>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function changeReserve(e: ChangeEvent<HTMLInputElement>) {
    const text = e.target.value
    setReserveText(text)
    const error = validateSettings({ initialReserve: text, horizonYears: settings.horizonYears }).initialReserve
    setReserveError(error ?? null)
    if (!error) await repository.saveSettings({ ...settings, initialReserve: parseInteger(text)! })
  }

  async function changeHorizon(horizonYears: HorizonYears) {
    await repository.saveSettings({ ...settings, horizonYears })
  }

  async function exportBackup() {
    const name = await downloadBackup(repository)
    setStatus({ kind: 'success', text: `已匯出 ${name}` })
  }

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const result = parseBackup(await file.text())
    if (!result.ok) {
      setStatus({ kind: 'error', text: result.error })
      return
    }
    setStatus(null)
    setPending(result)
  }

  async function confirmImport() {
    if (!pending) return
    const data = pending
    setPending(null)
    try {
      await repository.replaceAll(data.settings, data.items)
      setReserveText(String(data.settings.initialReserve))
      setReserveError(null)
      setStatus({ kind: 'success', text: `已匯入 ${data.items.length} 個項目` })
    } catch {
      setStatus({ kind: 'error', text: IMPORT_MESSAGES.writeFailed })
    }
  }

  const exportDate = pending ? formatExportDate(pending.exportedAt) : null

  return (
    <div className="page">
      <header className="page-header">
        <h1>設定</h1>
      </header>

      <section className="settings-section" aria-labelledby="plan-title">
        <h2 id="plan-title">推演</h2>
        <div className="field">
          <label htmlFor="s-reserve">初始預留金（元）</label>
          <input
            id="s-reserve"
            inputMode="numeric"
            value={reserveText}
            onChange={changeReserve}
            aria-invalid={!!reserveError}
            aria-describedby={reserveError ? 'err-reserve' : 'hint-reserve'}
          />
          {reserveError ? (
            <p className="field-error" id="err-reserve">
              {reserveError}
            </p>
          ) : (
            <p className="muted" id="hint-reserve">
              目前手上為年繳、季繳等費用留著、不拿去投資的錢。
            </p>
          )}
        </div>
        <Segmented
          label="推演年數"
          value={settings.horizonYears}
          onChange={changeHorizon}
          options={HORIZON_OPTIONS.map((y) => ({ value: y, label: `${y} 年` }))}
        />
      </section>

      <section className="settings-section" aria-labelledby="backup-title">
        <h2 id="backup-title">備份</h2>
        <div className="settings-actions">
          <button type="button" onClick={exportBackup}>
            匯出備份
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            匯入備份
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            aria-label="選擇備份檔"
            tabIndex={-1}
            onChange={pickFile}
          />
        </div>
        {status && (
          <p className={status.kind === 'error' ? 'field-error' : 'status-ok'} role="status">
            {status.text}
          </p>
        )}
      </section>

      <section className="settings-notes" aria-labelledby="notes-title">
        <h2 id="notes-title">提醒</h2>
        <p>預留金不會自動追蹤實際帳戶，請定期把初始預留金更新為目前實際預留的金額。</p>
        <p>資料只存在這台裝置，請定期匯出備份。</p>
      </section>

      {pending && (
        <ConfirmDialog
          title="匯入並取代目前資料？"
          message={
            <>
              <p>
                備份檔包含 {pending.items.length} 個項目{exportDate ? `（匯出於 ${exportDate}）` : ''}。
              </p>
              <p>匯入後，目前所有項目與設定都會被取代。建議先匯出一份目前的備份。</p>
            </>
          }
          confirmLabel="匯入並取代"
          danger
          onConfirm={confirmImport}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}
