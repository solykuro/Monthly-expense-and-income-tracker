import { useMemo, useState } from 'react'
import { useProjection } from '../../app/hooks'
import { formatMonth } from '../../domain/month'
import { catchUpNotices, deficitWarnings } from '../../domain/projection'
import type { Month } from '../../domain/types'
import { InvestableChart } from './InvestableChart'
import { MonthDetail } from './MonthDetail'
import { ProjectionTable } from './ProjectionTable'
import { SummaryCard } from './SummaryCard'
import { CatchUpList, DeficitList } from './Warnings'
import './dashboard.css'

interface Props {
  onAddItem: () => void
}

export function DashboardPage({ onAddItem }: Props) {
  const { items, projection, month } = useProjection()
  const [detailMonth, setDetailMonth] = useState<Month | null>(null)

  const deficits = useMemo(() => (projection ? deficitWarnings(projection.months) : []), [projection])
  const catchUps = useMemo(() => (projection ? catchUpNotices(projection.months) : []), [projection])

  if (!items || !projection) return <div className="page" aria-busy="true" />

  if (items.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>總覽</h1>
        </header>
        <section className="empty">
          <p>先新增你的固定收入與支出，就能看到未來每月可投資的金額</p>
          <button type="button" className="primary" onClick={onAddItem}>
            新增項目
          </button>
        </section>
      </div>
    )
  }

  const detailRow = detailMonth ? projection.months.find((m) => m.month === detailMonth) : undefined
  const first = projection.months[0]
  const last = projection.months[projection.months.length - 1]

  return (
    <div className="page">
      <header className="page-header">
        <h1>{formatMonth(month)}</h1>
      </header>

      <SummaryCard row={first} unallocated={projection.unallocatedReserve} />

      {deficits.length > 0 && <DeficitList warnings={deficits} onSelect={setDetailMonth} />}
      {catchUps.length > 0 && <CatchUpList notices={catchUps} />}

      <section className="dash-section" aria-labelledby="chart-title">
        <div>
          <h2 id="chart-title">每月可投資金額</h2>
          <p className="muted">
            {first.month} 至 {last.month}
          </p>
        </div>
        <InvestableChart rows={projection.months} />
      </section>

      <ProjectionTable rows={projection.months} onSelectMonth={setDetailMonth} />

      {detailRow && <MonthDetail row={detailRow} onClose={() => setDetailMonth(null)} />}
    </div>
  )
}
