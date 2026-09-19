import { useCallback, useState, type FormEvent } from 'react'
import { ConfirmDialog, Sheet } from '../../components/Sheet'
import { Segmented } from '../../components/Segmented'
import { repository } from '../../db/repository'
import {
  hasErrors,
  parseInteger,
  validateAmountChange,
  validateItemFields,
  type FieldErrors,
  type ItemFields,
} from '../../domain/validation'
import {
  CATEGORIES,
  DEFAULT_CATEGORY,
  FREQUENCY_LABELS,
  type AmountChange,
  type BudgetItem,
  type Category,
  type Frequency,
  type ItemType,
  type Month,
} from '../../domain/types'
import { AmountChangesEditor } from './AmountChangesEditor'

interface Props {
  item?: BudgetItem
  defaultStartMonth: Month
  onClose: () => void
}

interface Draft {
  name: string
  type: ItemType
  amount: string
  frequency: Frequency
  anchorMonth: string
  dayOfMonth: string
  startMonth: string
  endMonth: string
  category: Category
  amountChanges: AmountChange[]
}

function toDraft(item: BudgetItem | undefined, defaultStartMonth: Month): Draft {
  if (!item) {
    return {
      name: '',
      type: 'expense',
      amount: '',
      frequency: 'monthly',
      anchorMonth: '',
      dayOfMonth: '1',
      startMonth: defaultStartMonth,
      endMonth: '',
      category: DEFAULT_CATEGORY,
      amountChanges: [],
    }
  }
  return {
    name: item.name,
    type: item.type,
    amount: String(item.amount),
    frequency: item.frequency,
    anchorMonth: item.anchorMonth === null ? '' : String(item.anchorMonth),
    dayOfMonth: String(item.dayOfMonth),
    startMonth: item.startMonth,
    endMonth: item.endMonth ?? '',
    category: item.category,
    amountChanges: item.amountChanges,
  }
}

function toFields(d: Draft): ItemFields {
  return {
    name: d.name,
    type: d.type,
    amount: parseInteger(d.amount) ?? Number.NaN,
    frequency: d.frequency,
    anchorMonth: d.frequency === 'monthly' || d.anchorMonth === '' ? null : Number(d.anchorMonth),
    dayOfMonth: parseInteger(d.dayOfMonth) ?? Number.NaN,
    startMonth: d.startMonth,
    endMonth: d.endMonth === '' ? null : d.endMonth,
    category: d.category,
  }
}

const FREQUENCIES = Object.keys(FREQUENCY_LABELS) as Frequency[]

export function ItemForm({ item, defaultStartMonth, onClose }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(item, defaultStartMonth))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [changeError, setChangeError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const close = useCallback(() => onClose(), [onClose])

  async function save(e: FormEvent) {
    e.preventDefault()
    const fields = toFields(draft)
    const fieldErrors = validateItemFields(fields)
    setErrors(fieldErrors)
    if (hasErrors(fieldErrors)) return

    // 開始或結束月份變更後，重新檢查所有異動紀錄
    for (let i = 0; i < draft.amountChanges.length; i++) {
      const others = draft.amountChanges.filter((_, j) => j !== i)
      const msg = Object.values(validateAmountChange(draft.amountChanges[i], fields, others))[0]
      if (msg) {
        setChangeError(`${draft.amountChanges[i].effectiveMonth} 的異動紀錄：${msg}`)
        return
      }
    }
    setChangeError(null)

    setSaving(true)
    try {
      const data = { ...fields, name: fields.name.trim(), amountChanges: draft.amountChanges }
      if (item) await repository.updateItem({ ...item, ...data })
      else await repository.addItem(data)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!item) return
    await repository.deleteItem(item.id)
    setConfirmDelete(false)
    onClose()
  }

  const errorId = (key: string) => (errors[key] ? `err-${key}` : undefined)
  const errorText = (key: string) =>
    errors[key] ? (
      <p className="field-error" id={`err-${key}`}>
        {errors[key]}
      </p>
    ) : null

  return (
    <>
      <Sheet
        title={item ? '編輯項目' : '新增項目'}
        onClose={close}
        footer={
          <>
            {item && (
              <button type="button" className="danger footer-start" onClick={() => setConfirmDelete(true)}>
                刪除
              </button>
            )}
            <button type="button" onClick={close}>
              取消
            </button>
            <button type="submit" form="item-form" className="primary" disabled={saving}>
              儲存
            </button>
          </>
        }
      >
        <form id="item-form" className="item-form" onSubmit={save} noValidate>
          <Segmented
            label="類型"
            hideLabel
            value={draft.type}
            onChange={(v) => set('type', v)}
            options={[
              { value: 'expense', label: '支出' },
              { value: 'income', label: '收入' },
            ]}
          />

          <div className="field">
            <label htmlFor="f-name">名稱</label>
            <input
              id="f-name"
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              aria-invalid={!!errors.name}
              aria-describedby={errorId('name')}
              autoComplete="off"
            />
            {errorText('name')}
          </div>

          <div className="field">
            <label htmlFor="f-amount">金額（元）</label>
            <input
              id="f-amount"
              inputMode="numeric"
              value={draft.amount}
              onChange={(e) => set('amount', e.target.value)}
              aria-invalid={!!errors.amount}
              aria-describedby={errorId('amount')}
            />
            {errorText('amount')}
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="f-frequency">週期</label>
              <select
                id="f-frequency"
                value={draft.frequency}
                onChange={(e) => set('frequency', e.target.value as Frequency)}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
            {draft.frequency !== 'monthly' && (
              <div className="field">
                <label htmlFor="f-anchor">發生月份</label>
                <select
                  id="f-anchor"
                  value={draft.anchorMonth}
                  onChange={(e) => set('anchorMonth', e.target.value)}
                  aria-invalid={!!errors.anchorMonth}
                  aria-describedby={errorId('anchorMonth')}
                >
                  <option value="">請選擇</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1} 月
                    </option>
                  ))}
                </select>
                {errorText('anchorMonth')}
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="f-day">每月發生日</label>
            <input
              id="f-day"
              inputMode="numeric"
              value={draft.dayOfMonth}
              onChange={(e) => set('dayOfMonth', e.target.value)}
              aria-invalid={!!errors.dayOfMonth}
              aria-describedby={errorId('dayOfMonth') ?? 'hint-day'}
            />
            {errorText('dayOfMonth') ?? (
              <p className="muted" id="hint-day">
                超過當月天數時以月底計算
              </p>
            )}
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="f-start">開始月份</label>
              <input
                id="f-start"
                type="month"
                value={draft.startMonth}
                onChange={(e) => set('startMonth', e.target.value)}
                aria-invalid={!!errors.startMonth}
                aria-describedby={errorId('startMonth')}
              />
              {errorText('startMonth')}
            </div>
            <div className="field">
              <label htmlFor="f-end">結束月份</label>
              <input
                id="f-end"
                type="month"
                value={draft.endMonth}
                onChange={(e) => set('endMonth', e.target.value)}
                aria-invalid={!!errors.endMonth}
                aria-describedby={errorId('endMonth') ?? 'hint-end'}
              />
              {errorText('endMonth') ?? (
                <p className="muted" id="hint-end">
                  留空表示持續
                </p>
              )}
            </div>
          </div>

          <div className="field">
            <label htmlFor="f-category">分類</label>
            <select id="f-category" value={draft.category} onChange={(e) => set('category', e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </form>

        <AmountChangesEditor
          changes={draft.amountChanges}
          range={toFields(draft)}
          onChange={(changes) => {
            set('amountChanges', changes)
            setChangeError(null)
          }}
        />
        {changeError && (
          <p className="field-error" role="alert">
            {changeError}
          </p>
        )}
      </Sheet>

      {confirmDelete && item && (
        <ConfirmDialog
          title={`刪除「${item.name}」？`}
          message={<p>這個項目和它的金額異動紀錄都會被刪除，推演結果也會一併更新。</p>}
          confirmLabel="刪除"
          danger
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
