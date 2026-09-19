import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { repository } from '../db/repository'
import { currentMonth } from '../domain/month'
import { project } from '../domain/projection'
import type { BudgetItem, Month, Settings } from '../domain/types'

export function useItems(): BudgetItem[] | undefined {
  return useLiveQuery(() => repository.listItems(), [])
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => repository.getSettings(), [])
}

/** 目前月份；App 回到前景時重新確認，跨月時會更新 */
export function useCurrentMonth(): Month {
  const [month, setMonth] = useState(() => currentMonth())
  useEffect(() => {
    const refresh = () => setMonth(currentMonth())
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  return month
}

export function useProjection() {
  const items = useItems()
  const settings = useSettings()
  const month = useCurrentMonth()
  const projection = useMemo(
    () => (items && settings ? project(items, settings, month) : undefined),
    [items, settings, month],
  )
  return { items, settings, month, projection }
}
