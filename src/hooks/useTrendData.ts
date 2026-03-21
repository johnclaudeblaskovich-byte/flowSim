import { useState, useEffect, useRef } from 'react'
import { useSolverStore } from '@/store'
import { useProjectStore } from '@/store'
import { useTrendStore } from '@/store'
import { tagRegistry } from '@/services/tagRegistry'
import { historian } from '@/services/historian'

export interface TrendDataPoint {
  simTime: number
  value: number
}

export function useTrendData() {
  const iteration = useSolverStore((s) => s.solverState.iteration)
  const status = useSolverStore((s) => s.solverState.status)
  // Use a ref for project to avoid re-subscribing the effect on every render
  const projectRef = useRef(useProjectStore.getState().project)
  const trackedTagsRef = useRef(useTrendStore.getState().trackedTags)

  const [buffer, setBuffer] = useState<Record<string, TrendDataPoint[]>>({})

  // Keep refs in sync
  useEffect(
    () => useProjectStore.subscribe((s) => { projectRef.current = s.project }),
    [],
  )
  useEffect(
    () => useTrendStore.subscribe((s) => { trackedTagsRef.current = s.trackedTags }),
    [],
  )

  useEffect(() => {
    if (status !== 'solving') return
    const tags = trackedTagsRef.current
    if (tags.length === 0) return

    const project = projectRef.current

    setBuffer((prev) => {
      const next = { ...prev }
      for (const tag of tags) {
        const value = tagRegistry.resolveTagValue(tag.tagPath, project)
        if (typeof value !== 'number') continue

        const existing = next[tag.tagPath] ?? []
        const updated = [...existing, { simTime: iteration, value }]
        next[tag.tagPath] = updated.length > 1000 ? updated.slice(-1000) : updated

        // Persist to historian (fire-and-forget)
        void historian.record(tag.tagPath, iteration, value)
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iteration, status])

  return {
    buffer,
    clearBuffer: () => setBuffer({}),
  }
}
