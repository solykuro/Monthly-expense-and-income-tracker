import { makeItem } from '../test/fixtures/item'
import { addMonths } from './month'
import { amountAt, nextOccurrence, occursIn, previousOccurrence } from './occurrence'

function occurrencesBetween(item: ReturnType<typeof makeItem>, from: string, count: number): string[] {
  const result: string[] = []
  for (let i = 0; i < count; i++) {
    const m = addMonths(from, i)
    if (occursIn(item, m)) result.push(m)
  }
  return result
}

describe('判定項目的發生月份', () => {
  it('每月項目在期間內每月發生', () => {
    const item = makeItem({ startMonth: '2026-09', endMonth: '2026-11' })
    expect(occurrencesBetween(item, '2026-06', 12)).toEqual(['2026-09', '2026-10', '2026-11'])
  })

  it('每季項目依發生月份推算', () => {
    const item = makeItem({ frequency: 'quarterly', anchorMonth: 2, startMonth: '2026-01' })
    expect(occurrencesBetween(item, '2026-01', 24)).toEqual([
      '2026-02', '2026-05', '2026-08', '2026-11',
      '2027-02', '2027-05', '2027-08', '2027-11',
    ])
  })

  it('每半年項目', () => {
    const item = makeItem({ frequency: 'semiannual', anchorMonth: 10, startMonth: '2026-01' })
    expect(occurrencesBetween(item, '2026-01', 12)).toEqual(['2026-04', '2026-10'])
  })

  it('開始月份在未來：第一次發生為 2028-03', () => {
    const item = makeItem({ frequency: 'yearly', anchorMonth: 3, startMonth: '2027-06' })
    expect(occursIn(item, '2027-03')).toBe(false)
    expect(nextOccurrence(item, '2026-01')).toBe('2028-03')
  })

  it('結束月份之後不再發生', () => {
    const item = makeItem({ frequency: 'yearly', anchorMonth: 3, startMonth: '2026-01', endMonth: '2027-02' })
    expect(occursIn(item, '2026-03')).toBe(true)
    expect(occursIn(item, '2027-03')).toBe(false)
    expect(occurrencesBetween(item, '2027-03', 60)).toEqual([])
    expect(nextOccurrence(item, '2026-09')).toBeNull()
  })

  it('上一次發生月份', () => {
    const item = makeItem({ frequency: 'yearly', anchorMonth: 3, startMonth: '2026-01' })
    expect(previousOccurrence(item, '2027-03')).toBe('2026-03')
    expect(previousOccurrence(item, '2027-04')).toBe('2027-03')
    expect(previousOccurrence(item, '2026-03')).toBeNull()
  })

  it('下一次發生月份包含當月', () => {
    const item = makeItem({ frequency: 'yearly', anchorMonth: 9, startMonth: '2026-01' })
    expect(nextOccurrence(item, '2026-09')).toBe('2026-09')
    expect(nextOccurrence(item, '2026-10')).toBe('2027-09')
  })
})

describe('金額異動紀錄', () => {
  it('異動紀錄生效', () => {
    const item = makeItem({ amount: 2800, amountChanges: [{ effectiveMonth: '2028-01', amount: 3200 }] })
    expect(amountAt(item, '2027-12')).toBe(2800)
    expect(amountAt(item, '2028-01')).toBe(3200)
    expect(amountAt(item, '2030-06')).toBe(3200)
  })

  it('多筆異動紀錄', () => {
    const item = makeItem({
      amount: 1000,
      amountChanges: [
        { effectiveMonth: '2027-01', amount: 1100 },
        { effectiveMonth: '2028-01', amount: 1300 },
      ],
    })
    expect(amountAt(item, '2026-12')).toBe(1000)
    expect(amountAt(item, '2027-06')).toBe(1100)
    expect(amountAt(item, '2028-06')).toBe(1300)
  })

  it('異動紀錄順序不影響結果', () => {
    const item = makeItem({
      amount: 1000,
      amountChanges: [
        { effectiveMonth: '2028-01', amount: 1300 },
        { effectiveMonth: '2027-01', amount: 1100 },
      ],
    })
    expect(amountAt(item, '2028-06')).toBe(1300)
  })

  it('刪除異動紀錄後使用基本金額', () => {
    const item = makeItem({ amount: 2800, amountChanges: [] })
    expect(amountAt(item, '2030-01')).toBe(2800)
  })
})
