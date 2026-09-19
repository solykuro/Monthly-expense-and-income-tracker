import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { freezeDate, resetDB } from '../test/helpers'
import { App } from './App'

vi.mock('react-chartjs-2', () => import('../test/chartMock'))

beforeEach(async () => {
  freezeDate('2026-09-17T10:00:00+08:00')
  await resetDB()
  localStorage.clear()
})
afterEach(() => vi.useRealTimers())

describe('分頁導覽', () => {
  it('預設顯示總覽', async () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: '主要分頁' })
    expect(within(nav).getByRole('button', { name: '總覽' })).toHaveAttribute('aria-current', 'page')
    expect(await screen.findByRole('heading', { name: '總覽' })).toBeInTheDocument()
  })

  it('切換分頁', async () => {
    const user = userEvent.setup()
    render(<App />)
    const nav = screen.getByRole('navigation')
    await user.click(within(nav).getByRole('button', { name: '項目' }))
    expect(within(nav).getByRole('button', { name: '項目' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('button', { name: '總覽' })).not.toHaveAttribute('aria-current')
    expect(await screen.findByRole('heading', { name: '收支項目' })).toBeInTheDocument()
    await user.click(within(nav).getByRole('button', { name: '設定' }))
    expect(await screen.findByRole('heading', { name: '設定' })).toBeInTheDocument()
  })

  it('空狀態點選新增項目時切換到項目頁並開啟表單', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '新增項目' }))
    expect(await screen.findByRole('dialog', { name: '新增項目' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation')).getByRole('button', { name: '項目' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('持久化儲存', () => {
  it('首次啟動時請求一次', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true })
    const first = render(<App />)
    first.unmount()
    render(<App />)
    await screen.findByRole('heading', { name: '總覽' })
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('不支援時正常啟動', async () => {
    Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true })
    render(<App />)
    expect(await screen.findByRole('heading', { name: '總覽' })).toBeInTheDocument()
  })
})
