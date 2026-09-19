import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeItem } from '../../test/fixtures/item'
import { freezeDate, resetDB, seed } from '../../test/helpers'
import { lastBarProps } from '../../test/chartMock'
import { DashboardPage } from './DashboardPage'

vi.mock('react-chartjs-2', () => import('../../test/chartMock'))

beforeEach(async () => {
  freezeDate('2026-09-17T10:00:00+08:00')
  await resetDB()
})
afterEach(() => vi.useRealTimers())

const salary = () => makeItem({ name: '薪水', type: 'income', amount: 60000 })
const rent = () => makeItem({ name: '房租', amount: 15000, dayOfMonth: 5 })
const carInsurance = () => makeItem({ name: '車險', frequency: 'yearly', anchorMonth: 10, amount: 12000, startMonth: '2026-09' })

describe('總覽空狀態', () => {
  it('首次使用顯示說明與新增按鈕，不顯示其他區塊', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<DashboardPage onAddItem={onAdd} />)
    expect(await screen.findByText('先新增你的固定收入與支出，就能看到未來每月可投資的金額')).toBeInTheDocument()
    expect(screen.queryByText('本月可投資')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '新增項目' }))
    expect(onAdd).toHaveBeenCalled()
  })
})

describe('摘要卡片', () => {
  it('顯示本月摘要，沒有未分配預留金時不顯示該欄', async () => {
    const life = makeItem({ name: '壽險', frequency: 'yearly', anchorMonth: 8, amount: 12000, startMonth: '2026-01' })
    await seed([salary(), rent(), life])
    render(<DashboardPage onAddItem={() => {}} />)
    const summary = await screen.findByRole('region', { name: '本月摘要' })
    // 2026-09 起：壽險下次 2027-08，上次 2026-08，每月 1000
    expect(within(summary).getByText('本月可投資').nextSibling).toHaveTextContent('44,000')
    expect(within(summary).getByText('本月應預留').nextSibling).toHaveTextContent('1,000')
    expect(within(summary).getByText('預留金餘額').nextSibling).toHaveTextContent('1,000')
    expect(within(summary).queryByText('未分配預留金')).not.toBeInTheDocument()
  })

  it('本月入不敷出以紅色顯示', async () => {
    await seed([makeItem({ type: 'income', amount: 30000 }), makeItem({ amount: 25000 }), carInsurance()])
    render(<DashboardPage onAddItem={() => {}} />)
    const summary = await screen.findByRole('region', { name: '本月摘要' })
    const value = within(summary).getByText('本月可投資').nextSibling as HTMLElement
    expect(value).toHaveTextContent('-1,000')
    expect(value).toHaveClass('negative')
  })

  it('顯示未分配預留金', async () => {
    await seed([salary(), makeItem({ frequency: 'yearly', anchorMonth: 10, amount: 12000 }), makeItem({ frequency: 'yearly', anchorMonth: 12, amount: 6000 })], {
      initialReserve: 20000,
      horizonYears: 5,
    })
    render(<DashboardPage onAddItem={() => {}} />)
    const summary = await screen.findByRole('region', { name: '本月摘要' })
    expect(within(summary).getByText('未分配預留金').nextSibling).toHaveTextContent('2,000')
  })
})

describe('推演表格', () => {
  it('預設逐月，第一列為推演起始月', async () => {
    await seed([salary()])
    render(<DashboardPage onAddItem={() => {}} />)
    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(61)
    expect(rows[1]).toHaveTextContent('2026-09')
    expect(within(rows[0]).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      '月份', '收入', '固定支出', '應預留', '預留金支付', '可投資', '預留金餘額',
    ])
  })

  it('切換逐年並標示部分年度', async () => {
    await seed([salary()])
    const user = userEvent.setup()
    render(<DashboardPage onAddItem={() => {}} />)
    await user.click(await screen.findByRole('radio', { name: '逐年' }))
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(6)
    expect(rows[0]).toHaveTextContent('2026部分年度')
    expect(rows[1]).not.toHaveTextContent('部分年度')
    expect(rows[5]).toHaveTextContent('2031部分年度')
    expect(rows[1]).toHaveTextContent('720,000')
  })

  it('逐年列點選時切回逐月', async () => {
    await seed([salary()])
    const user = userEvent.setup()
    render(<DashboardPage onAddItem={() => {}} />)
    await user.click(await screen.findByRole('radio', { name: '逐年' }))
    await user.click(screen.getByRole('button', { name: '2027' }))
    expect(screen.getByRole('radio', { name: '逐月' })).toBeChecked()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.getElementById('row-2027-01')).toBeInTheDocument()
  })

  it('負數列標示', async () => {
    await seed([makeItem({ type: 'income', amount: 30000 }), makeItem({ amount: 25000 }), carInsurance()])
    render(<DashboardPage onAddItem={() => {}} />)
    await screen.findByRole('table')
    expect(document.getElementById('row-2026-09')).toHaveClass('is-negative')
    expect(document.getElementById('row-2026-11')).not.toHaveClass('is-negative')
  })
})

describe('月份明細', () => {
  it('到期月份標示由預留金支付', async () => {
    await seed([salary(), rent(), carInsurance()])
    const user = userEvent.setup()
    render(<DashboardPage onAddItem={() => {}} />)
    await screen.findByRole('table')
    await user.click(document.getElementById('row-2027-10')!.querySelector('td')!)
    const dialog = await screen.findByRole('dialog', { name: '2027 年 10 月' })
    const occ = within(dialog).getByRole('region', { name: '當月收支' })
    expect(within(occ).getByText('房租').closest('li')).toHaveTextContent('2027-10-05')
    expect(within(occ).getByText('房租').closest('li')).toHaveTextContent('15,000')
    const car = within(occ).getByText('車險').closest('li')!
    expect(car).toHaveTextContent('由預留金支付')
    expect(car).toHaveTextContent('12,000')
    expect(within(occ).getByText('房租').closest('li')).not.toHaveTextContent('由預留金支付')
  })

  it('追趕月份標示追趕', async () => {
    await seed([salary(), carInsurance()])
    const user = userEvent.setup()
    render(<DashboardPage onAddItem={() => {}} />)
    await user.click(await screen.findByRole('button', { name: '2026-09' }))
    const dialog = await screen.findByRole('dialog', { name: '2026 年 9 月' })
    const reserve = within(dialog).getByRole('region', { name: '當月應預留' })
    const line = within(reserve).getByText('車險').closest('li')!
    expect(line).toHaveTextContent('6,000')
    expect(line).toHaveTextContent('追趕')

    await user.click(within(dialog).getByRole('button', { name: '關閉' }))
    await user.click(screen.getByRole('button', { name: '2026-11' }))
    const next = await screen.findByRole('dialog', { name: '2026 年 11 月' })
    expect(within(next).getByText('車險').closest('li')).not.toHaveTextContent('追趕')
  })
})

describe('可投資金額長條圖', () => {
  it('顯示 60 根長條，負值為紅色', async () => {
    await seed([makeItem({ type: 'income', amount: 30000 }), makeItem({ amount: 25000 }), carInsurance()])
    render(<DashboardPage onAddItem={() => {}} />)
    expect(await screen.findByTestId('bar-chart')).toHaveAttribute('data-count', '60')
    const ds = lastBarProps.data!.datasets[0]
    const colors = ds.backgroundColor as string[]
    expect(lastBarProps.data!.labels![0]).toBe('2026-09')
    expect(colors[0]).toBe(colors[1])
    expect(colors[0]).not.toBe(colors[2])
    expect(ds.data[0]).toBe(-1000)
    expect(ds.data[2]).toBe(4000)
  })
})

describe('警示', () => {
  it('列出入不敷出月份，點選開啟明細', async () => {
    await seed([makeItem({ type: 'income', amount: 30000 }), makeItem({ amount: 25000 }), carInsurance()])
    const user = userEvent.setup()
    render(<DashboardPage onAddItem={() => {}} />)
    const section = await screen.findByRole('region', { name: '入不敷出的月份' })
    const items = within(section).getAllByRole('button')
    expect(items.map((b) => b.textContent)).toEqual(['2026-09-1,000', '2026-10-1,000'])
    await user.click(items[1])
    expect(await screen.findByRole('dialog', { name: '2026 年 10 月' })).toBeInTheDocument()
  })

  it('沒有入不敷出時不顯示', async () => {
    await seed([salary(), rent()])
    render(<DashboardPage onAddItem={() => {}} />)
    await screen.findByRole('table')
    expect(screen.queryByRole('region', { name: '入不敷出的月份' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '追趕預留' })).not.toBeInTheDocument()
  })

  it('顯示追趕提示', async () => {
    await seed([salary(), carInsurance()])
    render(<DashboardPage onAddItem={() => {}} />)
    const section = await screen.findByRole('region', { name: '追趕預留' })
    expect(section).toHaveTextContent('車險：2026-09 至 2026-10 每月需預留 6,000（平時 1,000）')
  })

  it('追趕期間金額不同時顯示範圍', async () => {
    await seed([salary(), makeItem({ name: '房屋稅', frequency: 'yearly', anchorMonth: 11, amount: 10000, startMonth: '2026-09' })])
    render(<DashboardPage onAddItem={() => {}} />)
    const section = await screen.findByRole('region', { name: '追趕預留' })
    expect(section).toHaveTextContent('每月需預留 3,333–3,334')
  })
})
