import './TabBar.css'

export type Tab = 'dashboard' | 'items' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: '總覽', icon: 'M4 19V11M10 19V5M16 19v-6M22 19H2' },
  { id: 'items', label: '項目', icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
  { id: 'settings', label: '設定', icon: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4' },
]

interface Props {
  current: Tab
  onChange: (tab: Tab) => void
}

export function TabBar({ current, onChange }: Props) {
  return (
    <nav className="tabbar" aria-label="主要分頁">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className="tabbar-tab"
          aria-current={tab.id === current ? 'page' : undefined}
          onClick={() => onChange(tab.id)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d={tab.icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
