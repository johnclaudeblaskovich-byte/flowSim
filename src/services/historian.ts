// ─── Historian Service (IndexedDB) ────────────────────────────────────────────
// Persists trend data across page reloads using the browser's native IndexedDB.
// Boxcar compression: only records a new point when value changes by > delta %.

const DB_NAME = 'flowsim-historian'
const DB_VERSION = 1
const STORE_DATA = 'historian_data'
const STORE_TAGS = 'historian_tags'

export interface DataPoint {
  simTime: number
  value: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbTransaction(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
): IDBTransaction {
  return db.transaction(stores, mode)
}

// ─── Service class ────────────────────────────────────────────────────────────

class HistorianService {
  private db: IDBDatabase | null = null
  private lastStoredValues = new Map<string, number>()
  private boxcarDeltas = new Map<string, number>()

  // ── init ────────────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.db) return
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)

      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(STORE_DATA)) {
          const dataStore = db.createObjectStore(STORE_DATA, {
            keyPath: ['tagPath', 'simTime'],
          })
          dataStore.createIndex('by-tag', 'tagPath', { unique: false })
        }

        if (!db.objectStoreNames.contains(STORE_TAGS)) {
          db.createObjectStore(STORE_TAGS, { keyPath: 'tagPath' })
        }
      }

      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    // Load existing tag deltas into memory
    const tx = idbTransaction(this.db, [STORE_TAGS], 'readonly')
    const store = tx.objectStore(STORE_TAGS)
    const rows = await idbRequest<{ tagPath: string; boxcarDelta: number }[]>(
      store.getAll(),
    )
    for (const row of rows) {
      this.boxcarDeltas.set(row.tagPath, row.boxcarDelta)
    }
  }

  // ── ensureTagTracked ────────────────────────────────────────────────────────

  async ensureTagTracked(tagPath: string, boxcarDelta = 0.01): Promise<void> {
    if (!this.db) return
    if (this.boxcarDeltas.has(tagPath)) return

    this.boxcarDeltas.set(tagPath, boxcarDelta)
    const tx = idbTransaction(this.db, [STORE_TAGS], 'readwrite')
    const store = tx.objectStore(STORE_TAGS)
    await idbRequest(
      store.put({ tagPath, boxcarDelta, addedAt: Date.now() }),
    )
  }

  // ── record ──────────────────────────────────────────────────────────────────

  async record(tagPath: string, simTime: number, value: number): Promise<void> {
    if (!this.db) return
    if (!this.shouldRecord(tagPath, value)) return

    this.lastStoredValues.set(tagPath, value)
    const tx = idbTransaction(this.db, [STORE_DATA], 'readwrite')
    const store = tx.objectStore(STORE_DATA)
    await idbRequest(store.put({ tagPath, simTime, value }))
  }

  // ── getHistory ──────────────────────────────────────────────────────────────

  async getHistory(tagPath: string, fromTime: number, toTime: number): Promise<DataPoint[]> {
    if (!this.db) return []
    const tx = idbTransaction(this.db, [STORE_DATA], 'readonly')
    const index = tx.objectStore(STORE_DATA).index('by-tag')
    const all = await idbRequest<{ tagPath: string; simTime: number; value: number }[]>(
      index.getAll(IDBKeyRange.only(tagPath)),
    )
    return all
      .filter((r) => r.simTime >= fromTime && r.simTime <= toTime)
      .map((r) => ({ simTime: r.simTime, value: r.value }))
      .sort((a, b) => a.simTime - b.simTime)
  }

  // ── getTrackedTags ──────────────────────────────────────────────────────────

  async getTrackedTags(): Promise<string[]> {
    if (!this.db) return []
    const tx = idbTransaction(this.db, [STORE_TAGS], 'readonly')
    const rows = await idbRequest<{ tagPath: string }[]>(
      tx.objectStore(STORE_TAGS).getAll(),
    )
    return rows.map((r) => r.tagPath)
  }

  // ── clearTag ────────────────────────────────────────────────────────────────

  async clearTag(tagPath: string): Promise<void> {
    if (!this.db) return

    // Delete all data points for this tag
    const tx = idbTransaction(this.db, [STORE_DATA, STORE_TAGS], 'readwrite')
    const dataStore = tx.objectStore(STORE_DATA)
    const index = dataStore.index('by-tag')

    const keys = await idbRequest<IDBValidKey[]>(
      index.getAllKeys(IDBKeyRange.only(tagPath)),
    )
    for (const key of keys) {
      dataStore.delete(key)
    }
    tx.objectStore(STORE_TAGS).delete(tagPath)

    this.lastStoredValues.delete(tagPath)
    this.boxcarDeltas.delete(tagPath)
  }

  // ── clearAll ────────────────────────────────────────────────────────────────

  async clearAll(): Promise<void> {
    if (!this.db) return
    const tx = idbTransaction(this.db, [STORE_DATA, STORE_TAGS], 'readwrite')
    await Promise.all([
      idbRequest(tx.objectStore(STORE_DATA).clear()),
      idbRequest(tx.objectStore(STORE_TAGS).clear()),
    ])
    this.lastStoredValues.clear()
    this.boxcarDeltas.clear()
  }

  // ── exportCSV ───────────────────────────────────────────────────────────────

  async exportCSV(tagPaths: string[]): Promise<string> {
    if (!this.db || tagPaths.length === 0) return ''

    // Fetch all histories
    const histories = await Promise.all(
      tagPaths.map((tp) => this.getHistory(tp, 0, Number.MAX_SAFE_INTEGER)),
    )

    // Collect all unique simTimes, sorted
    const timeSet = new Set<number>()
    for (const pts of histories) {
      for (const pt of pts) timeSet.add(pt.simTime)
    }
    const times = Array.from(timeSet).sort((a, b) => a - b)

    // Build lookup maps per tag
    const lookup: Map<string, Map<number, number>> = new Map()
    for (let i = 0; i < tagPaths.length; i++) {
      const m = new Map<number, number>()
      for (const pt of histories[i]) m.set(pt.simTime, pt.value)
      lookup.set(tagPaths[i], m)
    }

    // Build CSV
    const header = ['simTime', ...tagPaths].join(',')
    const rows = times.map((t) => {
      const cols = tagPaths.map((tp) => {
        const v = lookup.get(tp)?.get(t)
        return v !== undefined ? String(v) : ''
      })
      return [String(t), ...cols].join(',')
    })

    return [header, ...rows].join('\n')
  }

  // ── shouldRecord (boxcar compression) ───────────────────────────────────────

  private shouldRecord(tagPath: string, newValue: number): boolean {
    const lastVal = this.lastStoredValues.get(tagPath)
    if (lastVal === undefined) return true

    const delta = this.boxcarDeltas.get(tagPath) ?? 0.01
    const relChange = Math.abs(newValue - lastVal) / Math.max(Math.abs(lastVal), 1e-10)
    return relChange > delta
  }
}

export const historian = new HistorianService()
