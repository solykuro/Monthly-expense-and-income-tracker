import { makeItem } from '../test/fixtures/item'
import { MESSAGES, validateAmountChange, validateItem, validateItemFields, validateSettings } from './validation'

describe('項目欄位驗證', () => {
  it('合法的每月支出沒有錯誤', () => {
    expect(validateItemFields(makeItem())).toEqual({})
  })

  it('每月項目不需要發生月份', () => {
    expect(validateItemFields(makeItem({ frequency: 'monthly', anchorMonth: null }))).toEqual({})
  })

  it.each(['', '   '])('名稱空白（%j）', (name) => {
    expect(validateItemFields(makeItem({ name })).name).toBe(MESSAGES.nameRequired)
  })

  it.each([0, -5, 1.5, Number.NaN, 'abc' as unknown as number])('金額不合法（%j）', (amount) => {
    expect(validateItemFields(makeItem({ amount })).amount).toBe(MESSAGES.amountInvalid)
  })

  it('結束月份早於開始月份', () => {
    const errors = validateItemFields(makeItem({ startMonth: '2027-01', endMonth: '2026-12' }))
    expect(errors.endMonth).toBe(MESSAGES.endBeforeStart)
  })

  it('結束月份等於開始月份是合法的', () => {
    expect(validateItemFields(makeItem({ startMonth: '2027-01', endMonth: '2027-01' }))).toEqual({})
  })

  it.each(['quarterly', 'semiannual', 'yearly'] as const)('非每月項目（%s）缺少發生月份', (frequency) => {
    expect(validateItemFields(makeItem({ frequency, anchorMonth: null })).anchorMonth).toBe(MESSAGES.anchorRequired)
  })

  it.each([0, 32, 1.5])('每月發生日超出範圍（%j）', (dayOfMonth) => {
    expect(validateItemFields(makeItem({ dayOfMonth })).dayOfMonth).toBe(MESSAGES.dayInvalid)
  })

  it('不在清單中的分類無效', () => {
    expect(validateItemFields(makeItem({ category: '娛樂' as never })).category).toBe(MESSAGES.categoryInvalid)
  })
})

describe('異動紀錄驗證', () => {
  const item = makeItem({ startMonth: '2026-01', endMonth: '2030-12' })

  it('合法的異動紀錄', () => {
    expect(validateAmountChange({ effectiveMonth: '2028-01', amount: 3200 }, item, [])).toEqual({})
  })

  it('生效月份重複', () => {
    const errors = validateAmountChange({ effectiveMonth: '2028-01', amount: 3200 }, item, [
      { effectiveMonth: '2028-01', amount: 3000 },
    ])
    expect(errors.effectiveMonth).toBe(MESSAGES.changeDuplicate)
  })

  it.each(['2025-12', '2026-01', '2031-01'])('生效月份超出項目期間（%s）', (effectiveMonth) => {
    const errors = validateAmountChange({ effectiveMonth, amount: 3200 }, item, [])
    expect(errors.effectiveMonth).toBe(MESSAGES.changeOutOfRange)
  })

  it('結束月份當月可以生效', () => {
    expect(validateAmountChange({ effectiveMonth: '2030-12', amount: 1 }, item, [])).toEqual({})
  })

  it.each([0, -1, 2.5, 'x' as unknown as number])('異動金額不合法（%j）', (amount) => {
    const errors = validateAmountChange({ effectiveMonth: '2028-01', amount }, item, [])
    expect(errors.amount).toBe(MESSAGES.amountInvalid)
  })

  it('validateItem 會檢查所有異動紀錄', () => {
    const bad = makeItem({
      amountChanges: [
        { effectiveMonth: '2027-01', amount: 1100 },
        { effectiveMonth: '2027-01', amount: 1200 },
      ],
    })
    expect(validateItem(bad)).toBe(MESSAGES.changeDuplicate)
    expect(validateItem(makeItem())).toBeNull()
  })
})

describe('推演設定驗證', () => {
  it('合法設定', () => {
    expect(validateSettings({ initialReserve: 0, horizonYears: 5 })).toEqual({})
    expect(validateSettings({ initialReserve: '8000', horizonYears: 1 })).toEqual({})
  })

  it.each([-1, 1.5, 'abc', ''])('初始預留金不合法（%j）', (initialReserve) => {
    expect(validateSettings({ initialReserve, horizonYears: 5 }).initialReserve).toBe(MESSAGES.reserveInvalid)
  })

  it('推演年數必須在選項中', () => {
    expect(validateSettings({ initialReserve: 0, horizonYears: 2 }).horizonYears).toBe(MESSAGES.horizonInvalid)
  })
})
