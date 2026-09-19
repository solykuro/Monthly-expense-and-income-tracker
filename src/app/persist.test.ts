import { PERSIST_FLAG, requestPersistentStorage } from './persist'

function memoryFlags() {
  const map = new Map<string, string>()
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }
}

describe('請求持久化儲存', () => {
  it('支援時只在第一次啟動呼叫一次', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    const flags = memoryFlags()
    await requestPersistentStorage({ persist }, flags)
    await requestPersistentStorage({ persist }, flags)
    expect(persist).toHaveBeenCalledTimes(1)
    expect(flags.getItem(PERSIST_FLAG)).toBe('1')
  })

  it('不支援時正常略過', async () => {
    await expect(requestPersistentStorage({}, memoryFlags())).resolves.toBeUndefined()
    await expect(requestPersistentStorage(undefined, memoryFlags())).resolves.toBeUndefined()
  })

  it('請求失敗不拋出錯誤', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('denied'))
    await expect(requestPersistentStorage({ persist }, memoryFlags())).resolves.toBeUndefined()
  })
})
