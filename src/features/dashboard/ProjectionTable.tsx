import { useState } from 'react'
import { Segmented } from '../../components/Segmented'
import { formatAmount } from '../../domain/format'
import { aggregateByYear, type MonthRow } from '../../domain/projection'
import type { Month } from '../../domain/types'

type View = 'month' | 'year'

interface Props {
  rows: MonthRow[]
  onSelectMonth: (month: Month) => void
}

const COLUMNS = ['收入', '固定支出', '應預留', '預留金支付', '可投資', '預留金餘額']

function values(r: Pick<MonthRow, 'income' | 'monthlyExpense' | 'reserve' | 'paidFromReserve' | 'investable' | 'reserveBalance'>) {
  return [r.income, r.monthlyExpense, r.reserve, r.paidFromReserve, r.investable, r.reserveBalance]
}

export function ProjectionTable({ rows, onSelectMonth }: Props) {
  const [view, setView] = useState<View>('month')
  const years = view === 'year' ? aggregateByYear(rows) : []

  function jumpToYear(firstMonth: Month) {
    setView('month')
    requestAnimationFrame(() => {
      const el = document.getElementById(`row-${firstMonth}`)
      el?.scrollIntoView?.({ block: 'center' })
      el?.focus({ preventScroll: true })
    })
  }

  return (
    <section className="dash-section" aria-labelledby="table-title">
      <div className="table-head">
        <h2 id="table-title">推演明細</h2>
        <Segmented
          label="顯示方式"
          hideLabel
          value={view}
          onChange={setView}
          options={[
            { value: 'month', label: '逐月' },
            { value: 'year', label: '逐年' },
          ]}
        />
      </div>
      <div className="table-scroll" tabIndex={0} aria-label="推演表格，可左右捲動">
        <table className="projection-table">
          <thead>
            <tr>
              <th scope="col">{view === 'month' ? '月份' : '年度'}</th>
              {COLUMNS.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view === 'month' &&
              rows.map((r) => (
                <tr
                  key={r.month}
                  id={`row-${r.month}`}
                  tabIndex={-1}
                  className={r.investable < 0 ? 'is-negative' : undefined}
                  onClick={() => onSelectMonth(r.month)}
                >
                  <th scope="row">
                    <button
                      type="button"
                      className="row-link"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectMonth(r.month)
                      }}
                    >
                      {r.month}
                    </button>
                  </th>
                  {values(r).map((v, i) => (
                    <td key={COLUMNS[i]} className="num">
                      {formatAmount(v)}
                    </td>
                  ))}
                </tr>
              ))}
            {view === 'year' &&
              years.map((y) => (
                <tr key={y.year} className={y.investable < 0 ? 'is-negative' : undefined}>
                  <th scope="row">
                    <button type="button" className="row-link" onClick={() => jumpToYear(y.firstMonth)}>
                      {y.year}
                      {y.partial && <span className="partial">部分年度</span>}
                    </button>
                  </th>
                  {values(y).map((v, i) => (
                    <td key={COLUMNS[i]} className="num">
                      {formatAmount(v)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
