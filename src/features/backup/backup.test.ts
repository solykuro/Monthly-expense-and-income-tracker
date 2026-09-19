import { createDB } from '../../db/db'
import { createRepository } from '../../db/repository'
import { project } from '../../domain/projection'
import { makeItem } from '../../test/fixtures/item'
import { backupFileName, buildBackup } from './export'
import { IMPORT_MESSAGES, parseBackup } from './import'

let n = 0
const newRepo = () => createRepository(createDB(`backup-test-${++n}`))

function validFile(overrides: Record<string, unknown> = {}) {
  return {
    app: 'fixed-cashflow-planner',
    schemaVersion: 1,
    exportedAt: '2026-09-01T02:00:00.000Z',
    settings: { initialReserve: 0, horizonYears: 5 },
    items: [makeItem(), makeItem()],
    ...overrides,
  }
}

describe('匯出備份', () => {
  it('檔名使用匯出當天日期', () => {
    expect(backupFileName(new Date(2026, 8, 17, 23, 0))).toBe('fixed-cashflow-20260917.json')
  })

  it('匯出所有欄位與異動紀錄', async () => {
    const repo = newRepo()
    const items = [
      makeItem({ name: '薪水', type: 'income' }),
      makeItem({ name: '房租' }),
      makeItem({ name: '保費', frequency: 'yearly', anchorMonth: 1, amountChanges: [{ effectiveMonth: '2028-01', amount: 3200 }] }),
    ]
    await repo.replaceAll({ initialReserve: 8000, horizonYears: 3 }, items)
    const now = new Date('2026-09-17T10:00:00.000Z')
    const backup = await buildBackup(repo, now)
    expect(backup).toMatchObject({
      app: 'fixed-cashflow-planner',
      schemaVersion: 1,
      exportedAt: '2026-09-17T10:00:00.000Z',
      settings: { initialReserve: 8000, horizonYears: 3 },
    })
    expect(backup.items).toHaveLength(3)
    expect(backup.items).toEqual(expect.arrayContaining(items))
  })

  it('沒有項目時仍可匯出', async () => {
    const repo = newRepo()
    const backup = await buildBackup(repo)
    expect(backup.items).toEqual([])
    expect(backup.settings).toEqual({ initialReserve: 0, horizonYears: 5 })
  })
})

describe('匯入驗證', () => {
  it('有效的備份檔', () => {
    const file = validFile()
    const result = parseBackup(JSON.stringify(file))
    expect(result).toEqual({ ok: true, settings: file.settings, items: file.items, exportedAt: file.exportedAt })
  })

  it('非 JSON 檔案', () => {
    expect(parseBackup('not json {')).toEqual({ ok: false, error: IMPORT_MESSAGES.notJson })
  })

  it('不是本工具的備份', () => {
    expect(parseBackup(JSON.stringify(validFile({ app: 'other' })))).toEqual({ ok: false, error: IMPORT_MESSAGES.wrongApp })
    expect(parseBackup('[]')).toEqual({ ok: false, error: IMPORT_MESSAGES.wrongApp })
  })

  it('不支援的版本', () => {
    expect(parseBackup(JSON.stringify(validFile({ schemaVersion: 2 })))).toEqual({
      ok: false,
      error: '備份檔版本較新，請更新 App 後再匯入',
    })
  })

  it('項目資料不合法', () => {
    const file = validFile({ items: [makeItem(), makeItem({ amount: -100 })] })
    expect(parseBackup(JSON.stringify(file))).toEqual({
      ok: false,
      error: '第 2 個項目資料有誤：金額必須是大於 0 的整數',
    })
  })

  it('缺少欄位、設定錯誤、重複識別碼', () => {
    const missing = makeItem() as Partial<ReturnType<typeof makeItem>>
    delete missing.category
    expect(parseBackup(JSON.stringify(validFile({ items: [missing] }))).ok).toBe(false)
    expect(parseBackup(JSON.stringify(validFile({ settings: { initialReserve: -1, horizonYears: 5 } })))).toEqual({
      ok: false,
      error: IMPORT_MESSAGES.invalidSettings,
    })
    const item = makeItem()
    expect(parseBackup(JSON.stringify(validFile({ items: [item, item] })))).toEqual({
      ok: false,
      error: IMPORT_MESSAGES.duplicateId(2),
    })
  })
})

describe('備份還原一致性', () => {
  it('換裝置還原後推演結果相同', async () => {
    const a = newRepo()
    await a.replaceAll({ initialReserve: 5000, horizonYears: 5 }, [
      makeItem({ name: '薪水', type: 'income', amount: 60000 }),
      makeItem({ name: '房租', amount: 15000, amountChanges: [{ effectiveMonth: '2027-06', amount: 16000 }] }),
      makeItem({ name: '車險', frequency: 'yearly', anchorMonth: 10, amount: 12000 }),
    ])
    const text = JSON.stringify(await buildBackup(a))

    const parsed = parseBackup(text)
    if (!parsed.ok) throw new Error(parsed.error)
    const b = newRepo()
    await b.addItem({ ...makeItem(), name: '舊資料' })
    await b.replaceAll(parsed.settings, parsed.items)

    const sortById = (x: { id: string }, y: { id: string }) => x.id.localeCompare(y.id)
    expect((await b.listItems()).sort(sortById)).toEqual((await a.listItems()).sort(sortById))
    expect(await b.getSettings()).toEqual(await a.getSettings())
    const pa = project(await a.listItems(), await a.getSettings(), '2026-09')
    const pb = project(await b.listItems(), await b.getSettings(), '2026-09')
    expect(pb.months).toEqual(pa.months)
  })
})
