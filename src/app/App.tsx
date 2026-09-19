import { useCallback, useEffect, useState } from 'react'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { ItemsPage } from '../features/items/ItemsPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { requestPersistentStorage } from './persist'
import { TabBar, type Tab } from './TabBar'

export function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [startNewItem, setStartNewItem] = useState(false)

  useEffect(() => {
    void requestPersistentStorage()
  }, [])

  const goToNewItem = useCallback(() => {
    setStartNewItem(true)
    setTab('items')
  }, [])

  const changeTab = useCallback((next: Tab) => {
    setStartNewItem(false)
    setTab(next)
  }, [])

  return (
    <>
      <main>
        {tab === 'dashboard' && <DashboardPage onAddItem={goToNewItem} />}
        {tab === 'items' && <ItemsPage startWithNewItem={startNewItem} />}
        {tab === 'settings' && <SettingsPage />}
      </main>
      <TabBar current={tab} onChange={changeTab} />
    </>
  )
}
