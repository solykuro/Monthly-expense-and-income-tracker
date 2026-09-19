export const PERSIST_FLAG = 'fcp-persist-requested'

interface StorageLike {
  persist?: () => Promise<boolean>
}

interface FlagStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** 首次啟動時請求持久化儲存；不支援或失敗時靜默略過 */
export async function requestPersistentStorage(
  storage: StorageLike | undefined = typeof navigator !== 'undefined' ? navigator.storage : undefined,
  flags: FlagStore | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined,
): Promise<void> {
  try {
    if (flags?.getItem(PERSIST_FLAG)) return
    if (!storage || typeof storage.persist !== 'function') return
    flags?.setItem(PERSIST_FLAG, '1')
    await storage.persist()
  } catch {
    // 不影響 App 使用
  }
}
