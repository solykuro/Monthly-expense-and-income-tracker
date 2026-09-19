import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { repository } from '../../db/repository'
import { makeItem } from '../../test/fixtures/item'
import { freezeDate, resetDB, seed } from '../../test/helpers'
import { SettingsPage } from './SettingsPage'

beforeEach(async () => {
  freezeDate('2026-09-17T10:00:00+08:00')
  await resetDB()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function backupFile(items = [makeItem(), makeItem(), makeItem(), makeItem(), makeItem()], extra: Record<string, unknown> = {}) {
  const content = JSON.stringify({
    app: 'fixed-cashflow-planner',
    schemaVersion: 1,
    exportedAt: '2026-09-01T02:00:00.000Z',
    settings: { initialReserve: 3000, horizonYears: 10 },
    items,
    ...extra,
  })
  return new File([content], 'backup.json', { type: 'application/json' })
}

describe('設定頁', () => {
  it('顯示兩則提醒文字', async () => {
    render(<SettingsPage />)
    expect(await screen.findByText('預留金不會自動追蹤實際帳戶，請定期把初始預留金更新為目前實際預留的金額。')).toBeInTheDocument()
    expect(screen.getByText('資料只存在這台裝置，請定期匯出備份。')).toBeInTheDocument()
  })

  it('初始預留金驗證', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    const input = await screen.findByLabelText('初始預留金（元）')
    await user.clear(input)
    await user.type(input, '-5')
    expect(screen.getByText('預留金必須是 0 以上的整數')).toBeInTheDocument()
    expect((await repository.getSettings()).initialReserve).toBe(0)
  })

  it('設定變更立即保存', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    const input = await screen.findByLabelText('初始預留金（元）')
    await user.clear(input)
    await user.type(input, '8000')
    await waitFor(async () => expect((await repository.getSettings()).initialReserve).toBe(8000))
    await user.click(screen.getByRole('radio', { name: '1 年' }))
    await waitFor(async () => expect(await repository.getSettings()).toEqual({ initialReserve: 8000, horizonYears: 1 }))
    expect(screen.getByRole('radio', { name: '1 年' })).toBeChecked()
  })
})

describe('匯出', () => {
  it('下載當天日期的備份檔', async () => {
    await seed([makeItem(), makeItem(), makeItem()])
    const blobs: Blob[] = []
    URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b)
      return 'blob:test'
    })
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('fixed-cashflow-20260917.json')
    })
    const user = userEvent.setup()
    render(<SettingsPage />)
    await user.click(await screen.findByRole('button', { name: '匯出備份' }))
    expect(await screen.findByText('已匯出 fixed-cashflow-20260917.json')).toBeInTheDocument()
    expect(click).toHaveBeenCalledTimes(1)
    const json = JSON.parse(await blobs[0].text())
    expect(json.items).toHaveLength(3)
  })
})

describe('匯入', () => {
  async function upload(file: File) {
    const user = userEvent.setup()
    render(<SettingsPage />)
    await screen.findByRole('button', { name: '匯入備份' })
    await user.upload(screen.getByLabelText('選擇備份檔'), file)
    return user
  }

  it('確認對話框顯示摘要，確認後完全取代', async () => {
    await seed([makeItem({ name: '舊項目' })])
    const user = await upload(backupFile())
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('備份檔包含 5 個項目（匯出於 2026-09-01）')
    expect(dialog).toHaveTextContent('目前所有項目與設定都會被取代')
    await user.click(within(dialog).getByRole('button', { name: '匯入並取代' }))
    expect(await screen.findByText('已匯入 5 個項目')).toBeInTheDocument()
    const items = await repository.listItems()
    expect(items).toHaveLength(5)
    expect(items.some((i) => i.name === '舊項目')).toBe(false)
    expect(await repository.getSettings()).toEqual({ initialReserve: 3000, horizonYears: 10 })
    expect(screen.getByLabelText('初始預留金（元）')).toHaveValue('3000')
  })

  it('取消匯入', async () => {
    await seed([makeItem({ name: '舊項目' })])
    const user = await upload(backupFile())
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect((await repository.listItems()).map((i) => i.name)).toEqual(['舊項目'])
  })

  it('檔案錯誤時顯示訊息且不變更', async () => {
    await seed([makeItem({ name: '舊項目' })])
    await upload(new File(['oops'], 'x.json'))
    expect(await screen.findByText('檔案格式錯誤，無法讀取')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(await repository.listItems()).toHaveLength(1)
  })

  it('項目資料有誤時指出第幾個', async () => {
    await upload(backupFile([makeItem(), makeItem({ amount: -100 })]))
    expect(await screen.findByText('第 2 個項目資料有誤：金額必須是大於 0 的整數')).toBeInTheDocument()
  })

  it('寫入失敗時資料未變更', async () => {
    await seed([makeItem({ name: '舊項目' })])
    const user = await upload(backupFile())
    vi.spyOn(repository, 'replaceAll').mockRejectedValueOnce(new Error('fail'))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '匯入並取代' }))
    expect(await screen.findByText('匯入失敗，資料未變更')).toBeInTheDocument()
    expect((await repository.listItems()).map((i) => i.name)).toEqual(['舊項目'])
  })
})
