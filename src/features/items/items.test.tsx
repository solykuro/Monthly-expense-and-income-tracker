import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { repository } from '../../db/repository'
import { makeItem } from '../../test/fixtures/item'
import { freezeDate, resetDB, seed } from '../../test/helpers'
import { ItemsPage } from './ItemsPage'

beforeEach(async () => {
  freezeDate('2026-09-17T10:00:00+08:00')
  await resetDB()
})
afterEach(() => vi.useRealTimers())

async function openNewForm() {
  const user = userEvent.setup()
  render(<ItemsPage />)
  await user.click(await screen.findByRole('button', { name: '新增項目' }))
  return { user, dialog: await screen.findByRole('dialog', { name: '新增項目' }) }
}

describe('項目清單', () => {
  it('沒有任何項目時顯示空狀態', async () => {
    render(<ItemsPage />)
    expect(await screen.findByText('還沒有項目')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新增項目' })).toBeInTheDocument()
  })

  it('依收入、支出分組並依名稱排序', async () => {
    await seed([
      makeItem({ name: '壽險', frequency: 'yearly', anchorMonth: 3, dayOfMonth: 15, amount: 12000 }),
      makeItem({ name: '房租', amount: 15000, dayOfMonth: 5, category: '居住' }),
      makeItem({ name: '薪水', type: 'income', amount: 60000 }),
    ])
    render(<ItemsPage />)
    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map((h) => h.textContent)).toEqual(['收入', '支出'])
    const expense = screen.getByRole('region', { name: '支出' })
    const names = within(expense).getAllByRole('button').map((b) => b.textContent)
    // 繁中依筆畫排序：房（8 畫）在壽（14 畫）之前
    expect(names[0]).toContain('房租')
    expect(names[1]).toContain('壽險')
    expect(names[1]).toContain('每年 3 月 15 日')
    expect(names[1]).toContain('12,000')
    expect(names[0]).toContain('每月 5 日')
    expect(names[0]).toContain('居住')
  })

  it('顯示當月適用的金額', async () => {
    await seed([makeItem({ name: '房租', amount: 15000, amountChanges: [{ effectiveMonth: '2026-06', amount: 16000 }], startMonth: '2026-01' })])
    render(<ItemsPage />)
    expect(await screen.findByText('16,000')).toBeInTheDocument()
  })
})

describe('新增項目表單', () => {
  it('預設分類為「其他」且只有九個分類', async () => {
    const { dialog } = await openNewForm()
    const select = within(dialog).getByLabelText('分類') as HTMLSelectElement
    expect(select.value).toBe('其他')
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['居住', '交通', '保險', '訂閱', '稅費', '教育', '生活', '薪資', '其他'])
  })

  it('每月項目隱藏發生月份欄位', async () => {
    const { user, dialog } = await openNewForm()
    expect(within(dialog).queryByLabelText('發生月份')).not.toBeInTheDocument()
    await user.selectOptions(within(dialog).getByLabelText('週期'), 'yearly')
    expect(within(dialog).getByLabelText('發生月份')).toBeInTheDocument()
  })

  it('建立每月支出', async () => {
    const { user, dialog } = await openNewForm()
    await user.type(within(dialog).getByLabelText('名稱'), '房租')
    await user.type(within(dialog).getByLabelText('金額（元）'), '15000')
    const day = within(dialog).getByLabelText('每月發生日')
    await user.clear(day)
    await user.type(day, '5')
    await user.selectOptions(within(dialog).getByLabelText('分類'), '居住')
    await user.click(within(dialog).getByRole('button', { name: '儲存' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const row = await screen.findByRole('button', { name: /房租/ })
    expect(row).toHaveTextContent('15,000')
    expect(row).toHaveTextContent('每月 5 日')
    const [saved] = await repository.listItems()
    expect(saved).toMatchObject({ frequency: 'monthly', anchorMonth: null, startMonth: '2026-09', endMonth: null, category: '居住' })
  })

  it('建立年繳支出', async () => {
    const { user, dialog } = await openNewForm()
    await user.type(within(dialog).getByLabelText('名稱'), '壽險')
    await user.type(within(dialog).getByLabelText('金額（元）'), '12000')
    await user.selectOptions(within(dialog).getByLabelText('週期'), 'yearly')
    await user.selectOptions(within(dialog).getByLabelText('發生月份'), '3')
    const day = within(dialog).getByLabelText('每月發生日')
    await user.clear(day)
    await user.type(day, '15')
    await user.click(within(dialog).getByRole('button', { name: '儲存' }))
    expect(await screen.findByRole('button', { name: /壽險/ })).toHaveTextContent('每年 3 月 15 日')
  })

  it('顯示欄位錯誤且不儲存', async () => {
    const { user, dialog } = await openNewForm()
    await user.type(within(dialog).getByLabelText('名稱'), '   ')
    await user.type(within(dialog).getByLabelText('金額（元）'), '1.5')
    await user.selectOptions(within(dialog).getByLabelText('週期'), 'quarterly')
    const day = within(dialog).getByLabelText('每月發生日')
    await user.clear(day)
    await user.type(day, '32')
    const start = within(dialog).getByLabelText('開始月份')
    await user.clear(start)
    await user.type(start, '2027-01')
    await user.type(within(dialog).getByLabelText('結束月份'), '2026-12')
    await user.click(within(dialog).getByRole('button', { name: '儲存' }))

    expect(within(dialog).getByText('請輸入名稱')).toBeInTheDocument()
    expect(within(dialog).getByText('金額必須是大於 0 的整數')).toBeInTheDocument()
    expect(within(dialog).getByText('請選擇發生月份')).toBeInTheDocument()
    expect(within(dialog).getByText('日期必須介於 1 到 31')).toBeInTheDocument()
    expect(within(dialog).getByText('結束月份不能早於開始月份')).toBeInTheDocument()
    expect(await repository.listItems()).toEqual([])
  })
})

describe('金額異動紀錄', () => {
  it('新增、拒絕重複與超出範圍、刪除', async () => {
    await seed([makeItem({ name: '保費', amount: 2800, startMonth: '2026-01' })])
    const user = userEvent.setup()
    render(<ItemsPage />)
    await user.click(await screen.findByRole('button', { name: /保費/ }))
    const dialog = await screen.findByRole('dialog', { name: '編輯項目' })
    const month = within(dialog).getByLabelText('生效月份')
    const amount = within(dialog).getByLabelText('新金額')

    await user.type(month, '2028-01')
    await user.type(amount, '3200')
    await user.click(within(dialog).getByRole('button', { name: '加入異動' }))
    expect(within(dialog).getByText(/2028-01 起/)).toHaveTextContent('3,200')

    await user.type(month, '2028-01')
    await user.type(amount, '3300')
    await user.click(within(dialog).getByRole('button', { name: '加入異動' }))
    expect(within(dialog).getByText('此月份已有異動紀錄')).toBeInTheDocument()

    await user.clear(month)
    await user.type(month, '2026-01')
    await user.click(within(dialog).getByRole('button', { name: '加入異動' }))
    expect(within(dialog).getByText('生效月份必須在項目期間內，且晚於開始月份')).toBeInTheDocument()

    await user.clear(month)
    await user.type(month, '2029-01')
    await user.clear(amount)
    await user.type(amount, '0')
    await user.click(within(dialog).getByRole('button', { name: '加入異動' }))
    expect(within(dialog).getByText('金額必須是大於 0 的整數')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: '儲存' }))
    await waitFor(async () => expect((await repository.listItems())[0].amountChanges).toEqual([{ effectiveMonth: '2028-01', amount: 3200 }]))

    await user.click(await screen.findByRole('button', { name: /保費/ }))
    const again = await screen.findByRole('dialog', { name: '編輯項目' })
    await user.click(within(again).getByRole('button', { name: '刪除 2028-01 的異動紀錄' }))
    await user.click(within(again).getByRole('button', { name: '儲存' }))
    await waitFor(async () => expect((await repository.listItems())[0].amountChanges).toEqual([]))
  })

  it('編輯異動紀錄', async () => {
    await seed([makeItem({ name: '保費', amountChanges: [{ effectiveMonth: '2028-01', amount: 3200 }] })])
    const user = userEvent.setup()
    render(<ItemsPage />)
    await user.click(await screen.findByRole('button', { name: /保費/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '編輯' }))
    const amount = within(dialog).getByLabelText('新金額')
    await user.clear(amount)
    await user.type(amount, '3500')
    await user.click(within(dialog).getByRole('button', { name: '更新異動' }))
    expect(within(dialog).getByText(/2028-01 起/)).toHaveTextContent('3,500')
  })
})

describe('編輯與刪除項目', () => {
  beforeEach(async () => {
    await seed([makeItem({ name: '房租', amount: 15000 })])
  })

  it('編輯項目', async () => {
    const user = userEvent.setup()
    render(<ItemsPage />)
    await user.click(await screen.findByRole('button', { name: /房租/ }))
    const dialog = await screen.findByRole('dialog')
    const amount = within(dialog).getByLabelText('金額（元）')
    await user.clear(amount)
    await user.type(amount, '16000')
    await user.click(within(dialog).getByRole('button', { name: '儲存' }))
    expect(await screen.findByText('16,000')).toBeInTheDocument()
  })

  it('確認刪除', async () => {
    const user = userEvent.setup()
    render(<ItemsPage />)
    await user.click(await screen.findByRole('button', { name: /房租/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '刪除' }))
    const confirm = await screen.findByRole('alertdialog', { name: '刪除「房租」？' })
    await user.click(within(confirm).getByRole('button', { name: '刪除' }))
    expect(await screen.findByText('還沒有項目')).toBeInTheDocument()
    expect(await repository.listItems()).toEqual([])
  })

  it('取消刪除', async () => {
    const user = userEvent.setup()
    render(<ItemsPage />)
    await user.click(await screen.findByRole('button', { name: /房租/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '刪除' }))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(await repository.listItems()).toHaveLength(1)
    expect((await repository.listItems())[0].amount).toBe(15000)
  })
})
