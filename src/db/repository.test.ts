import { createDB } from './db'
import { createRepository, type NewItem } from './repository'

let dbName = ''
let counter = 0

function newRepo() {
  counter += 1
  dbName = `test-db-${counter}`
  return createRepository(createDB(dbName))
}

const input: NewItem = {
  name: ' 房租 ',
  type: 'expense',
  amount: 15000,
  frequency: 'monthly',
  anchorMonth: null,
  dayOfMonth: 5,
  startMonth: '2026-09',
  endMonth: null,
  category: '居住',
  amountChanges: [
    { effectiveMonth: '2028-01', amount: 16000 },
    { effectiveMonth: '2027-01', amount: 15500 },
  ],
}

describe('repository', () => {
  it('新增、讀取、更新、刪除項目', async () => {
    const repo = newRepo()
    const created = await repo.addItem(input)
    expect(created.id).toBeTruthy()
    expect(created.name).toBe('房租')
    expect(created.amountChanges.map((c) => c.effectiveMonth)).toEqual(['2027-01', '2028-01'])

    await repo.updateItem({ ...created, amount: 16000 })
    expect((await repo.getItem(created.id))?.amount).toBe(16000)

    await repo.deleteItem(created.id)
    expect(await repo.listItems()).toEqual([])
  })

  it('設定預設值為初始預留金 0、推演 5 年', async () => {
    const repo = newRepo()
    expect(await repo.getSettings()).toEqual({ initialReserve: 0, horizonYears: 5 })
    await repo.saveSettings({ initialReserve: 8000, horizonYears: 1 })
    expect(await repo.getSettings()).toEqual({ initialReserve: 8000, horizonYears: 1 })
  })

  it('重新開啟資料庫後資料仍在', async () => {
    const repo = newRepo()
    const created = await repo.addItem(input)
    await repo.saveSettings({ initialReserve: 300, horizonYears: 3 })
    repo.db.close()

    const reopened = createRepository(createDB(dbName))
    expect(await reopened.listItems()).toEqual([created])
    expect(await reopened.getSettings()).toEqual({ initialReserve: 300, horizonYears: 3 })
  })

  it('replaceAll 完全取代資料', async () => {
    const repo = newRepo()
    await repo.addItem(input)
    const other = await repo.addItem({ ...input, name: '保險' })
    await repo.replaceAll({ initialReserve: 1, horizonYears: 10 }, [{ ...other, id: 'new-1' }])
    const items = await repo.listItems()
    expect(items.map((i) => i.id)).toEqual(['new-1'])
    expect(await repo.getSettings()).toEqual({ initialReserve: 1, horizonYears: 10 })
  })

  it('replaceAll 寫入失敗時回復原資料', async () => {
    const repo = newRepo()
    const created = await repo.addItem(input)
    await repo.saveSettings({ initialReserve: 500, horizonYears: 3 })
    const dup = { ...created, id: 'dup' }
    // 重複主鍵會讓 bulkAdd 失敗
    await expect(repo.replaceAll({ initialReserve: 0, horizonYears: 5 }, [dup, dup])).rejects.toThrow()
    expect(await repo.listItems()).toEqual([created])
    expect(await repo.getSettings()).toEqual({ initialReserve: 500, horizonYears: 3 })
  })
})
