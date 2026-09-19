import { Sheet } from '../../components/Sheet'
import { formatAmount } from '../../domain/format'
import { formatMonth } from '../../domain/month'
import type { MonthRow } from '../../domain/projection'

export function MonthDetail({ row, onClose }: { row: MonthRow; onClose: () => void }) {
  return (
    <Sheet title={formatMonth(row.month)} onClose={onClose}>
      <dl className="detail-totals">
        <div>
          <dt>可投資</dt>
          <dd className={`num${row.investable < 0 ? ' negative' : ''}`}>{formatAmount(row.investable)}</dd>
        </div>
        <div>
          <dt>月底預留金餘額</dt>
          <dd className="num">{formatAmount(row.reserveBalance)}</dd>
        </div>
      </dl>

      <section aria-labelledby="detail-occ">
        <h3 id="detail-occ">當月收支</h3>
        {row.occurrences.length === 0 ? (
          <p className="muted">這個月沒有收支項目</p>
        ) : (
          <ul className="detail-list">
            {row.occurrences.map((o) => (
              <li key={o.itemId}>
                <span className="detail-main">
                  <span>
                    {o.name}
                    {o.fromReserve && <span className="tag tag--reserve">由預留金支付</span>}
                  </span>
                  <span className="muted">
                    {o.date}　{o.type === 'income' ? '收入' : '支出'}
                  </span>
                </span>
                <span className={`num detail-amount detail-amount--${o.type}`}>
                  {o.type === 'income' ? '+' : '-'}
                  {formatAmount(o.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="detail-res">
        <h3 id="detail-res">當月應預留</h3>
        {row.reserves.length === 0 ? (
          <p className="muted">這個月不需要預留</p>
        ) : (
          <ul className="detail-list">
            {row.reserves.map((r) => (
              <li key={r.itemId}>
                <span className="detail-main">
                  <span>
                    {r.name}
                    {r.catchUp && <span className="tag tag--catchup">追趕</span>}
                  </span>
                </span>
                <span className="num detail-amount">{formatAmount(r.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Sheet>
  )
}
