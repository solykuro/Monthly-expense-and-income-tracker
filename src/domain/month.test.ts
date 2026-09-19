import { addMonths, compareMonths, currentMonth, displayDate, fromIndex, isValidMonth, toIndex } from './month'

describe('month 工具', () => {
  it('月序號可以互相轉換', () => {
    expect(fromIndex(toIndex('2026-09'))).toBe('2026-09')
    expect(toIndex('2027-01') - toIndex('2026-12')).toBe(1)
  })

  it('跨年加減月份', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(addMonths('2027-01', -1)).toBe('2026-12')
    expect(addMonths('2026-09', 59)).toBe('2031-08')
  })

  it('比較月份', () => {
    expect(compareMonths('2026-12', '2027-01')).toBeLessThan(0)
    expect(compareMonths('2027-01', '2027-01')).toBe(0)
  })

  it('驗證月份格式', () => {
    expect(isValidMonth('2026-09')).toBe(true)
    expect(isValidMonth('2026-13')).toBe(false)
    expect(isValidMonth('2026-9')).toBe(false)
    expect(isValidMonth(null)).toBe(false)
  })

  it('以裝置當地時間取得目前月份', () => {
    expect(currentMonth(new Date(2026, 8, 17))).toBe('2026-09')
    expect(currentMonth(new Date(2026, 9, 1))).toBe('2026-10')
  })

  // budget-items / 顯示發生日期
  it('小月份的日期調整：31 日在 2027-02 顯示為 2027-02-28', () => {
    expect(displayDate('2027-02', 31)).toBe('2027-02-28')
  })

  it('閏年二月：30 日在 2028-02 顯示為 2028-02-29', () => {
    expect(displayDate('2028-02', 30)).toBe('2028-02-29')
  })

  it('未超出天數時照原日期顯示', () => {
    expect(displayDate('2026-09', 5)).toBe('2026-09-05')
  })
})
