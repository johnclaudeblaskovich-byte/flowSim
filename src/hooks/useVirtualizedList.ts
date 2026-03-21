import { useState, useCallback } from 'react'

// ─── useVirtualizedList ───────────────────────────────────────────────────────
// Simple window-based virtualisation for large lists.
// Renders only the visible rows + 2 rows of overscan on each side.
//
// Usage:
//   const { visibleItems, startIndex, totalHeight, offsetY, onScroll } =
//     useVirtualizedList(items, 32, 400)
//
//   return (
//     <div style={{ height: 400, overflow: 'auto' }} onScroll={onScroll}>
//       <div style={{ height: totalHeight, position: 'relative' }}>
//         <div style={{ transform: `translateY(${offsetY}px)` }}>
//           {visibleItems.map((item, i) => <Row key={startIndex + i} item={item} />)}
//         </div>
//       </div>
//     </div>
//   )

export function useVirtualizedList<T>(
  items: T[],
  rowHeight: number,
  containerHeight: number,
) {
  const [scrollTop, setScrollTop] = useState(0)

  const OVERSCAN = 2
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN)
  const visibleCount = Math.ceil(containerHeight / rowHeight) + OVERSCAN * 2
  const endIndex = Math.min(startIndex + visibleCount, items.length)

  const visibleItems = items.slice(startIndex, endIndex)
  const totalHeight = items.length * rowHeight
  const offsetY = startIndex * rowHeight

  const onScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  function scrollToIndex(index: number) {
    setScrollTop(index * rowHeight)
  }

  return {
    visibleItems,
    startIndex,
    endIndex,
    totalHeight,
    offsetY,
    onScroll,
    scrollToIndex,
  }
}
