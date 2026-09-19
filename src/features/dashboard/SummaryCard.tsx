import { formatAmount } from '../../domain/format'
import type { MonthRow } from '../../domain/projection'

interface Props {
  row: MonthRow
  unallocated: number
}

/** 本月資金流向：收入依序分給固定支出、預留、可投資 */
export function SummaryCard({ row, unallocated }: Props) {
  const investablePart = Math.max(row.investable, 0)
  const total = row.monthlyExpense + row.reserve + investablePart
  const pct = (v: number) => (total > 0 ? `${(v / total) * 100}%` : '0%')

  return (
    <section className="summary" aria-labelledby="summary-title">
      <h2 id="summary-title" className="visually-hidden">
        本月摘要
      </h2>

      {total > 0 && (
        <div className="flow" aria-hidden="true">
          <span className="flow-seg flow-seg--spend" style={{ width: pct(row.monthlyExpense) }} />
          <span className="flow-seg flow-seg--reserve" style={{ width: pct(row.reserve) }} />
          <span className="flow-seg flow-seg--invest" style={{ width: pct(investablePart) }} />
        </div>
      )}
      <p className="muted">
        本月收入 <span className="num">{formatAmount(row.income)}</span>，固定支出{' '}
        <span className="num">{formatAmount(row.monthlyExpense)}</span>
      </p>

      <dl className="summary-values">
        <div className="summary-value summary-value--invest">
          <dt>本月可投資</dt>
          <dd className={`num${row.investable < 0 ? ' negative' : ''}`}>{formatAmount(row.investable)}</dd>
        </div>
        <div className="summary-value summary-value--reserve">
          <dt>本月應預留</dt>
          <dd className="num">{formatAmount(row.reserve)}</dd>
        </div>
        <div className="summary-value">
          <dt>預留金餘額</dt>
          <dd className="num">{formatAmount(row.reserveBalance)}</dd>
        </div>
        {unallocated > 0 && (
          <div className="summary-value">
            <dt>未分配預留金</dt>
            <dd className="num">{formatAmount(unallocated)}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}
