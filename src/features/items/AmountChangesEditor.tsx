import { useState } from 'react'
import { formatAmount } from '../../domain/format'
import { compareMonths } from '../../domain/month'
import { hasErrors, parseInteger, validateAmountChange, type FieldErrors } from '../../domain/validation'
import type { AmountChange, BudgetItem } from '../../domain/types'

interface Props {
  changes: AmountChange[]
  range: Pick<BudgetItem, 'startMonth' | 'endMonth'>
  onChange: (changes: AmountChange[]) => void
}

export function AmountChangesEditor({ changes, range, onChange }: Props) {
  const [month, setMonth] = useState('')
  const [amount, setAmount] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})

  const sorted = changes
    .map((c, index) => ({ ...c, index }))
    .sort((a, b) => compareMonths(a.effectiveMonth, b.effectiveMonth))

  function reset() {
    setMonth('')
    setAmount('')
    setEditingIndex(null)
    setErrors({})
  }

  function submit() {
    const change: AmountChange = { effectiveMonth: month, amount: parseInteger(amount) ?? Number.NaN }
    const others = changes.filter((_, i) => i !== editingIndex)
    const errs = validateAmountChange(change, range, others)
    setErrors(errs)
    if (hasErrors(errs)) return
    const next = [...others, change].sort((a, b) => compareMonths(a.effectiveMonth, b.effectiveMonth))
    onChange(next)
    reset()
  }

  function edit(index: number) {
    setEditingIndex(index)
    setMonth(changes[index].effectiveMonth)
    setAmount(String(changes[index].amount))
    setErrors({})
  }

  function remove(index: number) {
    onChange(changes.filter((_, i) => i !== index))
    if (editingIndex === index) reset()
  }

  return (
    <section className="changes" aria-labelledby="changes-title">
      <div>
        <h3 id="changes-title">金額異動</h3>
        <p className="muted">已知會調整的金額，例如保費在某個月起變成多少。</p>
      </div>

      {sorted.length > 0 && (
        <ul className="changes-list">
          {sorted.map((c) => (
            <li key={c.effectiveMonth} className={c.index === editingIndex ? 'is-editing' : undefined}>
              <span>
                {c.effectiveMonth} 起 <span className="num">{formatAmount(c.amount)}</span>
              </span>
              <span className="changes-actions">
                <button type="button" className="plain" onClick={() => edit(c.index)}>
                  編輯
                </button>
                <button
                  type="button"
                  className="plain"
                  aria-label={`刪除 ${c.effectiveMonth} 的異動紀錄`}
                  onClick={() => remove(c.index)}
                >
                  刪除
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="changes-form">
        <div className="row">
          <div className="field">
            <label htmlFor="c-month">生效月份</label>
            <input
              id="c-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              aria-invalid={!!errors.effectiveMonth}
              aria-describedby={errors.effectiveMonth ? 'err-c-month' : undefined}
            />
          </div>
          <div className="field">
            <label htmlFor="c-amount">新金額</label>
            <input
              id="c-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={!!errors.amount}
              aria-describedby={errors.amount ? 'err-c-amount' : undefined}
            />
          </div>
        </div>
        {errors.effectiveMonth && (
          <p className="field-error" id="err-c-month">
            {errors.effectiveMonth}
          </p>
        )}
        {errors.amount && (
          <p className="field-error" id="err-c-amount">
            {errors.amount}
          </p>
        )}
        <div className="changes-form-actions">
          {editingIndex !== null && (
            <button type="button" onClick={reset}>
              取消編輯
            </button>
          )}
          <button type="button" onClick={submit}>
            {editingIndex !== null ? '更新異動' : '加入異動'}
          </button>
        </div>
      </div>
    </section>
  )
}
