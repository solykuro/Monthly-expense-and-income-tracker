import { addMonths, compareMonths, displayDate, toIndex, yearOf } from './month'
import { amountAt, nextOccurrence, occursIn, previousOccurrence } from './occurrence'
import { FREQUENCY_MONTHS, type BudgetItem, type ItemType, type Month, type Settings } from './types'

export interface OccurrenceLine {
  itemId: string
  name: string
  type: ItemType
  amount: number
  date: string
  /** 非每月支出由預留金支付 */
  fromReserve: boolean
}

export interface ReserveLine {
  itemId: string
  name: string
  amount: number
  /** 平時（穩定狀態）每月應預留金額 */
  steadyAmount: number
  catchUp: boolean
}

export interface MonthRow {
  month: Month
  income: number
  monthlyExpense: number
  reserve: number
  paidFromReserve: number
  investable: number
  reserveBalance: number
  occurrences: OccurrenceLine[]
  reserves: ReserveLine[]
}

export interface YearRow {
  year: number
  firstMonth: Month
  monthCount: number
  partial: boolean
  income: number
  monthlyExpense: number
  reserve: number
  paidFromReserve: number
  investable: number
  reserveBalance: number
}

export interface Allocation {
  allocations: Map<string, number>
  unallocated: number
}

export interface Projection {
  startMonth: Month
  months: MonthRow[]
  allocations: Map<string, number>
  unallocatedReserve: number
}

export function isReserveItem(item: BudgetItem): boolean {
  return item.type === 'expense' && item.frequency !== 'monthly'
}

/** 初始預留金分配：依下一次發生月份（相同時依建立時間）排序，依序分配 */
export function allocateInitialReserve(items: BudgetItem[], initialReserve: number, startMonth: Month): Allocation {
  const candidates = items
    .filter(isReserveItem)
    .map((item) => ({ item, next: nextOccurrence(item, startMonth) }))
    .filter((c): c is { item: BudgetItem; next: Month } => c.next !== null)
    .sort((a, b) => compareMonths(a.next, b.next) || a.item.createdAt.localeCompare(b.item.createdAt))

  const allocations = new Map<string, number>()
  let remaining = Math.max(0, initialReserve)
  for (const { item, next } of candidates) {
    const allocated = Math.min(remaining, amountAt(item, next))
    allocations.set(item.id, allocated)
    remaining -= allocated
  }
  return { allocations, unallocated: remaining }
}

export interface ReserveMonth {
  month: Month
  contribution: number
  payment: number
  balance: number
  steadyAmount: number
  catchUp: boolean
}

/** 單一非每月支出項目的逐月預留計算（design 第 6 點） */
export function simulateReserve(
  item: BudgetItem,
  startMonth: Month,
  monthCount: number,
  startingBalance: number,
): ReserveMonth[] {
  const period = FREQUENCY_MONTHS[item.frequency]
  const result: ReserveMonth[] = []
  let balance = startingBalance

  for (let i = 0; i < monthCount; i++) {
    const t = addMonths(startMonth, i)
    const due = nextOccurrence(item, t)
    let contribution = 0
    let steadyAmount = 0

    if (due !== null) {
      const amount = amountAt(item, due)
      steadyAmount = Math.ceil(amount / period)
      const previous = previousOccurrence(item, due)
      const candidates = [toIndex(startMonth), toIndex(item.startMonth)]
      if (previous !== null) candidates.push(toIndex(previous) + 1)
      const windowStart = Math.max(...candidates)
      const tIndex = toIndex(t)
      if (tIndex >= windowStart) {
        const monthsLeft = toIndex(due) - tIndex + 1
        contribution = Math.max(0, Math.ceil((amount - balance) / monthsLeft))
      }
    }

    balance += contribution
    let payment = 0
    if (due === t) {
      payment = amountAt(item, t)
      balance -= payment
    }

    result.push({
      month: t,
      contribution,
      payment,
      balance,
      steadyAmount,
      catchUp: contribution > steadyAmount,
    })
  }
  return result
}

export function monthCountFor(settings: Pick<Settings, 'horizonYears'>): number {
  return settings.horizonYears * 12
}

export function project(items: BudgetItem[], settings: Settings, startMonth: Month): Projection {
  const count = monthCountFor(settings)
  const { allocations, unallocated } = allocateInitialReserve(items, settings.initialReserve, startMonth)

  const reserveItems = items.filter(isReserveItem)
  const simulations = new Map(
    reserveItems.map((item) => [item.id, simulateReserve(item, startMonth, count, allocations.get(item.id) ?? 0)]),
  )

  const months: MonthRow[] = []
  for (let i = 0; i < count; i++) {
    const month = addMonths(startMonth, i)
    let income = 0
    let monthlyExpense = 0
    let reserve = 0
    let paidFromReserve = 0
    let reserveBalance = unallocated
    const occurrences: OccurrenceLine[] = []
    const reserves: ReserveLine[] = []

    for (const item of items) {
      if (!occursIn(item, month)) continue
      const amount = amountAt(item, month)
      const fromReserve = isReserveItem(item)
      occurrences.push({
        itemId: item.id,
        name: item.name,
        type: item.type,
        amount,
        date: displayDate(month, item.dayOfMonth),
        fromReserve,
      })
      if (item.type === 'income') income += amount
      else if (!fromReserve) monthlyExpense += amount
    }

    for (const item of reserveItems) {
      const r = simulations.get(item.id)![i]
      reserve += r.contribution
      paidFromReserve += r.payment
      reserveBalance += r.balance
      if (r.contribution > 0) {
        reserves.push({
          itemId: item.id,
          name: item.name,
          amount: r.contribution,
          steadyAmount: r.steadyAmount,
          catchUp: r.catchUp,
        })
      }
    }

    occurrences.sort(
      (a, b) =>
        (a.type === b.type ? 0 : a.type === 'income' ? -1 : 1) ||
        a.date.localeCompare(b.date) ||
        a.name.localeCompare(b.name, 'zh-Hant'),
    )
    reserves.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))

    months.push({
      month,
      income,
      monthlyExpense,
      reserve,
      paidFromReserve,
      investable: income - monthlyExpense - reserve,
      reserveBalance,
      occurrences,
      reserves,
    })
  }

  return { startMonth, months, allocations, unallocatedReserve: unallocated }
}

export function aggregateByYear(rows: MonthRow[]): YearRow[] {
  const years: YearRow[] = []
  for (const row of rows) {
    const year = yearOf(row.month)
    let current = years[years.length - 1]
    if (!current || current.year !== year) {
      current = {
        year,
        firstMonth: row.month,
        monthCount: 0,
        partial: false,
        income: 0,
        monthlyExpense: 0,
        reserve: 0,
        paidFromReserve: 0,
        investable: 0,
        reserveBalance: 0,
      }
      years.push(current)
    }
    current.monthCount += 1
    current.income += row.income
    current.monthlyExpense += row.monthlyExpense
    current.reserve += row.reserve
    current.paidFromReserve += row.paidFromReserve
    current.investable += row.investable
    current.reserveBalance = row.reserveBalance
  }
  for (const y of years) y.partial = y.monthCount < 12
  return years
}

export interface DeficitWarning {
  month: Month
  amount: number
}

export function deficitWarnings(rows: MonthRow[]): DeficitWarning[] {
  return rows.filter((r) => r.investable < 0).map((r) => ({ month: r.month, amount: r.investable }))
}

export interface CatchUpNotice {
  itemId: string
  name: string
  fromMonth: Month
  toMonth: Month
  minAmount: number
  maxAmount: number
  steadyAmount: number
}

/** 將每個項目連續的追趕月份合併為一則提示 */
export function catchUpNotices(rows: MonthRow[]): CatchUpNotice[] {
  const notices: CatchUpNotice[] = []
  const open = new Map<string, CatchUpNotice>()

  for (const row of rows) {
    const catching = new Set<string>()
    for (const line of row.reserves) {
      if (!line.catchUp) continue
      catching.add(line.itemId)
      const current = open.get(line.itemId)
      if (current) {
        current.toMonth = row.month
        current.minAmount = Math.min(current.minAmount, line.amount)
        current.maxAmount = Math.max(current.maxAmount, line.amount)
      } else {
        const notice: CatchUpNotice = {
          itemId: line.itemId,
          name: line.name,
          fromMonth: row.month,
          toMonth: row.month,
          minAmount: line.amount,
          maxAmount: line.amount,
          steadyAmount: line.steadyAmount,
        }
        open.set(line.itemId, notice)
        notices.push(notice)
      }
    }
    for (const id of open.keys()) {
      if (!catching.has(id)) open.delete(id)
    }
  }

  return notices.sort((a, b) => compareMonths(a.fromMonth, b.fromMonth) || a.name.localeCompare(b.name, 'zh-Hant'))
}
