import { formatAmount } from '../../domain/format'
import { describeCatchUp } from './describe'
import type { CatchUpNotice, DeficitWarning } from '../../domain/projection'
import type { Month } from '../../domain/types'

export function DeficitList({ warnings, onSelect }: { warnings: DeficitWarning[]; onSelect: (month: Month) => void }) {
  return (
    <section className="notice notice--deficit" aria-labelledby="deficit-title">
      <h2 id="deficit-title">入不敷出的月份</h2>
      <p className="muted">這些月份的收入不夠支付固定支出與預留，需要從別處調錢。</p>
      <ul>
        {warnings.map((w) => (
          <li key={w.month}>
            <button type="button" className="notice-row" onClick={() => onSelect(w.month)}>
              <span>{w.month}</span>
              <span className="num negative">{formatAmount(w.amount)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function CatchUpList({ notices }: { notices: CatchUpNotice[] }) {
  return (
    <section className="notice notice--catchup" aria-labelledby="catchup-title">
      <h2 id="catchup-title">追趕預留</h2>
      <p className="muted">到期時間較近，這些月份要多預留，可投資金額會暫時變少。</p>
      <ul>
        {notices.map((n) => (
          <li key={`${n.itemId}-${n.fromMonth}`} className="notice-text">
            {describeCatchUp(n)}
          </li>
        ))}
      </ul>
    </section>
  )
}
