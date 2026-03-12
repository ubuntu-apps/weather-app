import type { FC, ReactNode } from 'react'

export interface BottomNavItem {
  id: string
  label: string
  icon: ReactNode
}

interface BottomNavProps {
  items: BottomNavItem[]
  activeId: string
  onSelect: (id: string) => void
}

export const BottomNav: FC<BottomNavProps> = ({ items, activeId, onSelect }) => {
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item ${activeId === item.id ? 'active' : ''}`}
            onClick={() => onSelect(item.id)}
          >
            <span className="nav-item-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

