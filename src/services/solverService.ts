// ─── Solver Service ───────────────────────────────────────────────────────────
// WebSocket client that connects to the Python backend solver.
// Receives streaming iteration messages and updates the solver store.

import type { Project } from '@/types'
import { useSolverStore } from '@/store'
import { toast } from '@/hooks/useToastStore'

// ─── Message types from backend ───────────────────────────────────────────────

interface IterationMessage {
  type: 'iteration'
  iteration: number
  maxError: number
  unitStatuses?: Record<string, string>
}

interface CompleteMessage {
  type: 'complete'
  converged: boolean
  iterations: number
  elapsedMs: number
}

interface SolverErrorMessage {
  type: 'error'
  message: string
  unitTag?: string
  detail?: string
}

type SolverMessage = IterationMessage | CompleteMessage | SolverErrorMessage

// ─── SolverService class ──────────────────────────────────────────────────────

class SolverService {
  private ws: WebSocket | null = null
  private lastUpdateAt = 0
  private readonly UPDATE_INTERVAL_MS = 100 // 10 FPS max
  private readonly WS_BASE = 'ws://localhost:8000/ws/solve'

  solve(project: Project): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    const jobId = crypto.randomUUID()
    const url = `${this.WS_BASE}/${jobId}`

    try {
      this.ws = new WebSocket(url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Solver connection failed', `Could not connect to backend: ${msg}`, msg)
      useSolverStore.getState().stopSolve()
      return
    }

    this.ws.onopen = () => {
      // Send the serialised project to the backend
      this.ws?.send(JSON.stringify({ project }))
      console.info('[SolverService] Connected — job:', jobId)
    }

    this.ws.onmessage = (event: MessageEvent) => {
      let msg: SolverMessage
      try {
        msg = JSON.parse(event.data as string) as SolverMessage
      } catch {
        console.warn('[SolverService] Malformed message:', event.data)
        return
      }
      this.handleMessage(msg)
    }

    this.ws.onerror = () => {
      toast.error('Solver error', 'WebSocket connection to backend failed.')
      useSolverStore.getState().stopSolve()
    }

    this.ws.onclose = () => {
      console.info('[SolverService] Connection closed')
      this.ws = null
    }
  }

  stop(): void {
    this.ws?.close()
    this.ws = null
  }

  // ── Message handler ────────────────────────────────────────────────────────

  private handleMessage(msg: SolverMessage): void {
    switch (msg.type) {
      case 'iteration': {
        const now = Date.now()
        if (now - this.lastUpdateAt < this.UPDATE_INTERVAL_MS) return
        this.lastUpdateAt = now

        // Batch update solver store in a single setState call
        useSolverStore.setState((state) => ({
          solverState: {
            ...state.solverState,
            iteration: msg.iteration,
            maxError: msg.maxError,
          },
        }))

        // Update unit statuses if provided
        if (msg.unitStatuses) {
          const store = useSolverStore.getState()
          for (const [tag, status] of Object.entries(msg.unitStatuses)) {
            store.setUnitStatus(
              tag,
              status as 'idle' | 'solving' | 'converged' | 'warning' | 'error' | 'disabled',
            )
          }
        }
        break
      }

      case 'complete': {
        const store = useSolverStore.getState()
        if (msg.converged) {
          store.setSolverStatus('converged')
          toast.success('Solve complete', `Converged in ${msg.iterations} iterations (${msg.elapsedMs}ms)`)
        } else {
          store.setSolverStatus('error')
          store.addAuditEntry({
            id: crypto.randomUUID(),
            unitTag: '',
            message: 'Did not converge within iteration limit',
            severity: 'error',
          })
          toast.warning('Solve did not converge', `Stopped after ${msg.iterations} iterations`)
        }
        this.ws?.close()
        break
      }

      case 'error': {
        const detail = msg.detail ?? msg.message
        toast.error('Solver error', msg.message, detail)

        const store = useSolverStore.getState()
        store.setSolverStatus('error')
        store.addAuditEntry({
          id: crypto.randomUUID(),
          unitTag: msg.unitTag ?? '',
          message: msg.message,
          severity: 'error',
        })

        if (msg.unitTag) {
          store.setUnitStatus(msg.unitTag, 'error')
        }
        this.ws?.close()
        break
      }
    }
  }
}

export const solverService = new SolverService()
