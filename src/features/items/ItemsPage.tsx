import { useState } from 'react'
import { useCurrentMonth, useItems } from '../../app/hooks'
import { describeSchedule, formatAmount } from '../../domain/format'
import { amountAt } from '../../domain/occurrence'
import type { BudgetItem, ItemType } from '../../domain/types'
import { ItemForm } from './ItemForm'
import './items.css'

interface Props {
  /** 從總覽空狀態進來時，直接開啟新增表單 */
  startWithNewItem?: boolean
}

type Editing = { mode: 'new' } | { mode: 'edit'; item: BudgetItem } | null

const GROUPS: { type: ItemType; title: string }[] = [
  { type: 'income', title: '收入' },
  { type: 'expense', title: '支出' },
]

export function ItemsPage({ startWithNewItem }: Props) {
  const items = useItems()
  const month = useCurrentMonth()
  const [editing, setEditing] = useState<Editing>(startWithNewItem ? { mode: 'new' } : null)

  const addButton = (
    <button type="button" className="primary" onClick={() => setEditing({ mode: 'new' })}>
      新增項目
    </button>
  )

  return (
    <div className="page">
      <header className="page-header">
        <h1>收支項目</h1>
        {items && items.length > 0 && addButton}
      </header>

      {items && items.length === 0 && (
        <section className="empty">
          <h2>還沒有項目</h2>
          <p className="muted">把每月或每年固定會進出的錢加進來，例如薪水、房租、保險。</p>
          {addButton}
        </section>
      )}

      {items &&
        GROUPS.map(({ type, title }) => {
          const group = items
            .filter((i) => i.type === type)
            .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
          if (group.length === 0) return null
          return (
            <section key={type} className="item-group" aria-labelledby={`group-${type}`}>
              <h2 id={`group-${type}`}>{title}</h2>
              <ul className="item-list">
                {group.map((item) => (
                  <li key={item.id}>
                    <button type="button" className="item-row" onClick={() => setEditing({ mode: 'edit', item })}>
                      <span className="item-row-main">
                        <span className="item-name">{item.name}</span>
                        <span className="muted">
                          {describeSchedule(item)}　{item.category}
                        </span>
                      </span>
                      <span className={`num item-amount item-amount--${item.type}`}>
                        {formatAmount(amountAt(item, month))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}

      {editing && (
        <ItemForm
          key={editing.mode === 'edit' ? editing.item.id : 'new'}
          item={editing.mode === 'edit' ? editing.item : undefined}
          defaultStartMonth={month}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
