import { makeItem } from '../test/fixtures/item'
import { addMonths, currentMonth } from './month'
import {
  aggregateByYear,
  allocateInitialReserve,
  catchUpNotices,
  deficitWarnings,
  project,
  type MonthRow,
} from './projection'
import type { BudgetItem, Settings } from './types'

const s = (initialReserve = 0, horizonYears: Settings['horizonYears'] = 5): Settings => ({ initialReserve, horizonYears })

function row(p: { months: MonthRow[] }, month: string): MonthRow {
  const r = p.months.find((m) => m.month === month)
  if (!r) throw new Error(`找不到 ${month}`)
  return r
}

function reserveOf(r: MonthRow, id: string): number {
  return r.reserves.find((l) => l.itemId === id)?.amount ?? 0
}

function yearly(overrides: Partial<BudgetItem>): BudgetItem {
  return makeItem({ frequency: 'yearly', type: 'expense', ...overrides })
}

describe('推演期間', () => {
  it('預設推演 60 個月：2026-09 到 2031-08', () => {
    const start = currentMonth(new Date(2026, 8, 17))
    const p = project([], s(), start)
    expect(p.months).toHaveLength(60)
    expect(p.months[0].month).toBe('2026-09')
    expect(p.months[59].month).toBe('2031-08')
  })

  it('推演年數為 1：2026-09 到 2027-08', () => {
    const p = project([], s(0, 1), '2026-09')
    expect(p.months).toHaveLength(12)
    expect(p.months[11].month).toBe('2027-08')
  })

  it('跨月重新計算：起始月跟著裝置日期', () => {
    const p = project([], s(), currentMonth(new Date(2026, 9, 1)))
    expect(p.months[0].month).toBe('2026-10')
  })
})

describe('每月項目的計入方式', () => {
  it('每月收支計入', () => {
    const salary = makeItem({ type: 'income', amount: 60000, startMonth: '2026-01' })
    const rent = makeItem({ amount: 15000, startMonth: '2026-01' })
    const p = project([salary, rent], s(), '2026-09')
    for (const m of p.months) {
      expect(m.income).toBe(60000)
      expect(m.monthlyExpense).toBe(15000)
    }
  })

  it('項目尚未開始時不計入', () => {
    const job = makeItem({ type: 'income', amount: 50000, startMonth: '2027-01' })
    const p = project([job], s(), '2026-09')
    expect(row(p, '2026-12').income).toBe(0)
    expect(row(p, '2027-01').income).toBe(50000)
  })

  it('套用金額異動', () => {
    const rent = makeItem({ amount: 2800, amountChanges: [{ effectiveMonth: '2028-01', amount: 3200 }] })
    const p = project([rent], s(), '2026-09')
    expect(row(p, '2027-12').monthlyExpense).toBe(2800)
    expect(row(p, '2028-01').monthlyExpense).toBe(3200)
  })
})

describe('非每月收入的計入方式', () => {
  it('年終獎金只計入 2 月', () => {
    const bonus = makeItem({ type: 'income', frequency: 'yearly', anchorMonth: 2, amount: 100000 })
    const p = project([bonus], s(), '2026-09')
    expect(row(p, '2027-02').income).toBe(100000)
    expect(row(p, '2028-02').income).toBe(100000)
    expect(row(p, '2027-03').income).toBe(0)
    expect(row(p, '2027-02').reserve).toBe(0)
  })
})

describe('非每月支出的預留計算', () => {
  it('穩定狀態的年繳', () => {
    const life = yearly({ name: '壽險', amount: 12000, anchorMonth: 3, startMonth: '2026-01' })
    const p = project([life], s(), '2026-04')
    for (let i = 0; i < 24; i++) {
      expect(reserveOf(p.months[i], life.id)).toBe(1000)
    }
    expect(row(p, '2027-03').paidFromReserve).toBe(12000)
    expect(row(p, '2027-03').occurrences[0]).toMatchObject({ name: '壽險', fromReserve: true, amount: 12000 })
    expect(row(p, '2027-03').monthlyExpense).toBe(0)
  })

  it('到期時間太近時追趕', () => {
    const car = yearly({ name: '車險', amount: 12000, anchorMonth: 10, startMonth: '2026-09' })
    const p = project([car], s(), '2026-09')
    expect(reserveOf(row(p, '2026-09'), car.id)).toBe(6000)
    expect(reserveOf(row(p, '2026-10'), car.id)).toBe(6000)
    expect(row(p, '2026-10').paidFromReserve).toBe(12000)
    for (const m of p.months.slice(2)) expect(reserveOf(m, car.id)).toBe(1000)
  })

  it('無條件進位後總額不變', () => {
    const tax = yearly({ name: '房屋稅', amount: 10000, anchorMonth: 11, startMonth: '2026-09' })
    const p = project([tax], s(), '2026-09')
    const got = ['2026-09', '2026-10', '2026-11'].map((m) => reserveOf(row(p, m), tax.id))
    expect(got).toEqual([3334, 3333, 3333])
    expect(got.reduce((a, b) => a + b)).toBe(10000)
  })

  it('金額異動影響預留', () => {
    const fee = yearly({
      name: '保費',
      amount: 3000,
      anchorMonth: 1,
      startMonth: '2026-01',
      amountChanges: [{ effectiveMonth: '2028-01', amount: 3200 }],
    })
    const p = project([fee], s(), '2027-02')
    expect(reserveOf(row(p, '2027-02'), fee.id)).toBe(267)
    const total = p.months.slice(0, 12).reduce((sum, m) => sum + reserveOf(m, fee.id), 0)
    expect(total).toBe(3200)
    expect(row(p, '2028-01').paidFromReserve).toBe(3200)
  })

  it('項目已結束不再預留', () => {
    const ended = yearly({ anchorMonth: 3, startMonth: '2026-01', endMonth: '2027-02' })
    const p = project([ended], s(), '2026-09')
    for (const m of p.months) {
      expect(m.reserve).toBe(0)
      expect(m.paidFromReserve).toBe(0)
    }
  })

  it('下一次發生月份在推演期間之後', () => {
    const item = yearly({ amount: 12000, anchorMonth: 9, startMonth: '2026-01' })
    const p = project([item], s(0, 1), '2026-09')
    expect(reserveOf(row(p, '2026-09'), item.id)).toBe(12000)
    expect(row(p, '2026-09').paidFromReserve).toBe(12000)
    for (const m of p.months.slice(1)) expect(reserveOf(m, item.id)).toBe(1000)
    expect(p.months.at(-1)!.month).toBe('2027-08')
  })

  it('項目在未來才開始', () => {
    const item = yearly({ amount: 12000, anchorMonth: 6, startMonth: '2027-01' })
    const p = project([item], s(), '2026-09')
    for (const m of ['2026-09', '2026-10', '2026-11', '2026-12']) expect(reserveOf(row(p, m), item.id)).toBe(0)
    for (const m of ['2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06']) {
      expect(reserveOf(row(p, m), item.id)).toBe(2000)
    }
  })

  it('每季與每半年項目也依週期預留', () => {
    const q = makeItem({ frequency: 'quarterly', anchorMonth: 3, amount: 3000, startMonth: '2026-01' })
    const h = makeItem({ frequency: 'semiannual', anchorMonth: 6, amount: 6000, startMonth: '2026-01' })
    const p = project([q, h], s(), '2026-07')
    // 2026-07 起：季繳下次 2026-09（上次 2026-06），半年繳下次 2026-12（上次 2026-06）
    expect(reserveOf(row(p, '2026-07'), q.id)).toBe(1000)
    expect(reserveOf(row(p, '2026-07'), h.id)).toBe(1000)
  })
})

describe('初始預留金分配', () => {
  it('初始預留金部分支應', () => {
    const car = yearly({ name: '車險', amount: 12000, anchorMonth: 10, startMonth: '2026-09' })
    const p = project([car], s(8000), '2026-09')
    expect(p.allocations.get(car.id)).toBe(8000)
    expect(reserveOf(row(p, '2026-09'), car.id)).toBe(2000)
    expect(reserveOf(row(p, '2026-10'), car.id)).toBe(2000)
  })

  const a = () => yearly({ name: 'A', amount: 12000, anchorMonth: 10, startMonth: '2026-01' })
  const b = () => yearly({ name: 'B', amount: 6000, anchorMonth: 12, startMonth: '2026-01' })

  it('依到期先後分配', () => {
    const [ia, ib] = [a(), b()]
    // 故意把較晚到期的放前面
    const result = allocateInitialReserve([ib, ia], 15000, '2026-09')
    expect(result.allocations.get(ia.id)).toBe(12000)
    expect(result.allocations.get(ib.id)).toBe(3000)
    expect(result.unallocated).toBe(0)
  })

  it('到期月份相同時依建立時間', () => {
    const first = yearly({ amount: 5000, anchorMonth: 10 })
    const second = yearly({ amount: 5000, anchorMonth: 10 })
    const result = allocateInitialReserve([second, first], 6000, '2026-09')
    expect(result.allocations.get(first.id)).toBe(5000)
    expect(result.allocations.get(second.id)).toBe(1000)
  })

  it('初始預留金有剩餘', () => {
    const [ia, ib] = [a(), b()]
    const result = allocateInitialReserve([ia, ib], 20000, '2026-09')
    expect(result.allocations.get(ia.id)).toBe(12000)
    expect(result.allocations.get(ib.id)).toBe(6000)
    expect(result.unallocated).toBe(2000)
  })

  it('沒有非每月支出', () => {
    const rent = makeItem({ amount: 15000 })
    const bonus = makeItem({ type: 'income', frequency: 'yearly', anchorMonth: 2 })
    const p = project([rent, bonus], s(5000), '2026-09')
    expect(p.unallocatedReserve).toBe(5000)
    expect(p.months[0].reserveBalance).toBe(5000)
  })
})

describe('每月可投資金額', () => {
  const build = () => {
    const salary = makeItem({ type: 'income', amount: 60000 })
    const rent = makeItem({ amount: 15000 })
    const life = yearly({ name: '壽險', amount: 12000, anchorMonth: 3, startMonth: '2026-01' })
    return project([salary, rent, life], s(), '2026-04')
  }

  it('一般月份', () => {
    expect(row(build(), '2026-04').investable).toBe(44000)
  })

  it('非每月支出到期的月份', () => {
    const r = row(build(), '2027-03')
    expect(r.investable).toBe(44000)
    expect(r.paidFromReserve).toBe(12000)
  })

  it('入不敷出為負數', () => {
    const income = makeItem({ type: 'income', amount: 30000 })
    const spend = makeItem({ amount: 25000 })
    const big = yearly({ amount: 12000, anchorMonth: 10, startMonth: '2026-09' })
    const p = project([income, spend, big], s(), '2026-09')
    expect(row(p, '2026-09').investable).toBe(-1000)
  })
})

describe('預留金餘額', () => {
  it('餘額隨時間變化', () => {
    const life = yearly({ amount: 12000, anchorMonth: 3, startMonth: '2026-01' })
    const p = project([life], s(), '2026-04')
    expect(row(p, '2026-04').reserveBalance).toBe(1000)
    expect(row(p, '2027-02').reserveBalance).toBe(11000)
    expect(row(p, '2027-03').reserveBalance).toBe(0)
  })

  it('包含未分配預留金', () => {
    const x = yearly({ amount: 12000, anchorMonth: 10, startMonth: '2026-01' })
    const y = yearly({ amount: 6000, anchorMonth: 12, startMonth: '2026-01' })
    const p = project([x, y], s(20000), '2026-09')
    expect(p.unallocatedReserve).toBe(2000)
    // 月底：x 12000、y 6000，加上未分配 2000
    expect(row(p, '2026-09').reserveBalance).toBe(20000)
    // 2026-11 月底：x 已付款後新週期預留 1000，y 6000
    expect(row(p, '2026-11').reserveBalance).toBe(1000 + 6000 + 2000)
  })
})

describe('追趕預留判定', () => {
  it('標記追趕月份', () => {
    const car = yearly({ name: '車險', amount: 12000, anchorMonth: 10, startMonth: '2026-09' })
    const p = project([car], s(), '2026-09')
    const flags = p.months.slice(0, 4).map((m) => m.reserves[0].catchUp)
    expect(flags).toEqual([true, true, false, false])
    expect(p.months.slice(2).every((m) => m.reserves.every((l) => !l.catchUp))).toBe(true)

    const notices = catchUpNotices(p.months)
    expect(notices).toEqual([
      expect.objectContaining({ name: '車險', fromMonth: '2026-09', toMonth: '2026-10', minAmount: 6000, maxAmount: 6000, steadyAmount: 1000 }),
    ])
  })

  it('穩定狀態不標記', () => {
    const life = yearly({ amount: 12000, anchorMonth: 3, startMonth: '2026-01' })
    const p = project([life], s(), '2026-04')
    expect(p.months.every((m) => m.reserves.every((l) => !l.catchUp))).toBe(true)
    expect(catchUpNotices(p.months)).toEqual([])
  })

  it('追趕期間金額不同時記錄最高與最低', () => {
    const tax = yearly({ name: '房屋稅', amount: 10000, anchorMonth: 11, startMonth: '2026-09' })
    const [notice] = catchUpNotices(project([tax], s(), '2026-09').months)
    expect(notice).toMatchObject({ minAmount: 3333, maxAmount: 3334, steadyAmount: 834 })
  })
})

describe('逐年彙總', () => {
  it('部分年度', () => {
    const years = aggregateByYear(project([], s(), '2026-09').months)
    expect(years.map((y) => y.year)).toEqual([2026, 2027, 2028, 2029, 2030, 2031])
    expect(years[0]).toMatchObject({ monthCount: 4, partial: true })
    expect(years[5]).toMatchObject({ monthCount: 8, partial: true })
    expect(years.slice(1, 5).every((y) => !y.partial)).toBe(true)
  })

  it('年度加總與年底餘額', () => {
    const salary = makeItem({ type: 'income', amount: 60000 })
    const rent = makeItem({ amount: 15000 })
    const life = yearly({ amount: 12000, anchorMonth: 3, startMonth: '2026-01' })
    const p = project([salary, rent, life], s(), '2026-04')
    const y2027 = aggregateByYear(p.months).find((y) => y.year === 2027)!
    expect(y2027.investable).toBe(528000)
    expect(y2027.paidFromReserve).toBe(12000)
    expect(y2027.reserveBalance).toBe(row(p, '2027-12').reserveBalance)
    expect(y2027.firstMonth).toBe('2027-01')
  })
})

describe('入不敷出警示', () => {
  it('列出負數月份', () => {
    const rows = [
      { month: '2027-03', investable: -1000 },
      { month: '2027-04', investable: 0 },
      { month: '2028-03', investable: -500 },
    ] as MonthRow[]
    expect(deficitWarnings(rows)).toEqual([
      { month: '2027-03', amount: -1000 },
      { month: '2028-03', amount: -500 },
    ])
  })
})

describe('性質測試', () => {
  // 以固定種子產生隨機項目，確認預留模型的不變量
  function rng(seed: number) {
    return () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
  }

  it('到期月底餘額不小於 0，且每個完整週期的預留合計等於應付金額', () => {
    const rand = rng(42)
    const freqs = ['quarterly', 'semiannual', 'yearly'] as const
    for (let round = 0; round < 200; round++) {
      const start = addMonths('2026-01', Math.floor(rand() * 24))
      const itemStart = addMonths('2025-06', Math.floor(rand() * 48))
      const item = yearly({
        frequency: freqs[Math.floor(rand() * 3)],
        anchorMonth: 1 + Math.floor(rand() * 12),
        amount: 1 + Math.floor(rand() * 50000),
        startMonth: itemStart,
        amountChanges: rand() < 0.5 ? [{ effectiveMonth: addMonths(itemStart, 1 + Math.floor(rand() * 30)), amount: 1 + Math.floor(rand() * 50000) }] : [],
      })
      const reserve = Math.floor(rand() * 30000)
      const p = project([item], s(reserve, 5), start)
      const allocated = p.allocations.get(item.id) ?? 0

      let cycleSum = allocated
      for (const m of p.months) {
        const line = m.reserves.find((l) => l.itemId === item.id)
        cycleSum += line?.amount ?? 0
        expect(m.reserveBalance - p.unallocatedReserve).toBeGreaterThanOrEqual(0)
        if (m.paidFromReserve > 0) {
          expect(cycleSum).toBe(m.paidFromReserve)
          cycleSum = 0
        }
      }
    }
  })
})
