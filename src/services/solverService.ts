// ─── Solver Service ───────────────────────────────────────────────────────────
// WebSocket client that connects to the Python backend solver.
// Receives streaming iteration messages and updates the solver store.

import type { Project, SolveHistoryEntry, StreamData, UnitSolveStatus } from '@/types'
import { useProjectStore, useSolverStore } from '@/store'
import { toast } from '@/hooks/useToastStore'
import {
  buildFeederStream,
  mapStreamsToOutgoingEdges,
  serializeFlowsheetForSolve,
  validateSerializedSolveFlowsheet,
  validateSolverMessage,
} from '@/services/solveProtocol'
import { buildUnitSummaries } from '@/services/solveDiagnostics'

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
  solveId?: string
  timestamp?: string
  message: string
  unitTag?: string
  detail?: string
}

interface ResultMessage {
  type: 'result'
  solveId?: string
  timestamp?: string
  unitTag: string
  streams: Record<string, StreamData>
}

interface DoneMessage {
  type: 'done'
  solveId?: string
  timestamp?: string
  iteration: number
  maxError: number
  solvedUnits: number
}

type SolverMessage =
  | IterationMessage
  | CompleteMessage
  | SolverErrorMessage
  | ResultMessage
  | DoneMessage
  | { type: 'status'; solveId?: string; timestamp?: string; message: string }

// ─── SolverService class ──────────────────────────────────────────────────────

class SolverService {
  private ws: WebSocket | null = null
  private lastUpdateAt = 0
  private readonly UPDATE_INTERVAL_MS = 100 // 10 FPS max
  private solveStartedAt = 0
  private solveId: string | null = null
  private solveStartedAtIso: string | null = null
  private connectionOpened = false
  private connectionFailureNotified = false
  private terminalReportWritten = false
  private get WS_BASE(): string {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${window.location.host}/ws/solve`
  }

  solve(project: Project): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    const jobId = crypto.randomUUID()
    const url = `${this.WS_BASE}/${jobId}`
    this.solveId = jobId
    this.solveStartedAt = Date.now()
    this.solveStartedAtIso = new Date(this.solveStartedAt).toISOString()
    this.connectionOpened = false
    this.connectionFailureNotified = false
    this.terminalReportWritten = false
    this.resetProjectResults()
    this.seedFeederStreams(project)
    useSolverStore.getState().setActiveSolveId(jobId)
    this.addDiagnosticEvent('client', 'Opened solve session.', undefined, jobId)

    try {
      this.ws = new WebSocket(url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Solver connection failed', `Could not connect to backend: ${msg}`, msg)
      useSolverStore.getState().stopSolve()
      return
    }

    this.ws.onopen = () => {
      this.connectionOpened = true
      // Extract the active flowsheet and build the correct payload for the backend.
      // Backend expects: { type: 'solve', flowsheet: { nodes: [...], edges: [...] } }
      const serializedFlowsheet = serializeFlowsheetForSolve(project)
      if (!serializedFlowsheet) {
        toast.error('Solver error', 'No flowsheet found in project.')
        useSolverStore.getState().stopSolve()
        this.ws?.close()
        return
      }
      const protocolErrors = validateSerializedSolveFlowsheet(serializedFlowsheet)
      if (protocolErrors.length > 0) {
        const detail = protocolErrors.join(' ')
        this.addDiagnosticEvent('error', protocolErrors[0] ?? 'Invalid solver payload.', detail, jobId)
        toast.error('Solver payload invalid', protocolErrors[0] ?? 'Unknown protocol error', detail)
        useSolverStore.getState().stopSolve()
        this.ws?.close()
        return
      }
      const payload = {
        type: 'solve',
        flowsheet: serializedFlowsheet,
      }
      this.ws?.send(JSON.stringify(payload))
      this.addDiagnosticEvent('client', 'Sent solve payload to backend.', undefined, jobId)
      console.info('[SolverService] Connected — job:', jobId)
    }

    this.ws.onmessage = (event: MessageEvent) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(event.data as string) as unknown
      } catch {
        console.warn('[SolverService] Malformed message:', event.data)
        this.addDiagnosticEvent('error', 'Received malformed JSON from backend.', undefined, this.solveId)
        toast.error('Solver protocol error', 'Received malformed JSON from backend.')
        useSolverStore.getState().stopSolve()
        return
      }
      const msg = validateSolverMessage(parsed)
      if (!msg) {
        console.warn('[SolverService] Invalid message shape:', parsed)
        this.addDiagnosticEvent('error', 'Received invalid message shape from backend.', JSON.stringify(parsed), this.solveId)
        toast.error('Solver protocol error', 'Received invalid message shape from backend.')
        useSolverStore.getState().stopSolve()
        this.ws?.close()
        return
      }
      this.handleMessage(msg)
    }

    this.ws.onerror = () => {
      if (!this.connectionFailureNotified) {
        const detail = 'Make sure the Python solver backend is running on http://localhost:8000.'
        this.addDiagnosticEvent('error', 'WebSocket connection to backend failed.', detail, this.solveId)
        this.persistSolveHistoryEntry('error', {
          summary: 'Backend connection failed before solve completed.',
        })
        toast.error('Solver error', 'WebSocket connection to backend failed.', detail)
        this.connectionFailureNotified = true
      }
      useSolverStore.getState().stopSolve()
    }

    this.ws.onclose = (event: CloseEvent) => {
      if (!this.connectionOpened && !this.connectionFailureNotified) {
        toast.error(
          'Solver backend unavailable',
          'Could not connect to the solver backend on localhost:8000.',
          `WebSocket closed before opening (code ${event.code}). Start the FastAPI backend and try again.`,
        )
        this.addDiagnosticEvent(
          'error',
          'Backend connection closed before opening.',
          `Close code ${event.code}`,
          this.solveId,
        )
        this.persistSolveHistoryEntry('error', {
          summary: `Backend connection closed before opening (code ${event.code}).`,
        })
        this.connectionFailureNotified = true
        useSolverStore.getState().stopSolve()
      }
      console.info('[SolverService] Connection closed')
      this.ws = null
      this.solveId = null
      this.solveStartedAtIso = null
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
            this.updateProjectUnitStatus(
              tag,
              status as UnitSolveStatus,
            )
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
          this.persistSolveHistoryEntry('converged', {
            iteration: msg.iterations,
            elapsedMs: msg.elapsedMs,
            summary: `Solve converged in ${msg.iterations} iteration(s).`,
          })
          toast.success('Solve complete', `Converged in ${msg.iterations} iterations (${msg.elapsedMs}ms)`)
        } else {
          store.setSolverStatus('error')
          store.addAuditEntry({
            id: crypto.randomUUID(),
            unitTag: '',
            message: 'Did not converge within iteration limit',
            severity: 'error',
          })
          this.persistSolveHistoryEntry('error', {
            iteration: msg.iterations,
            elapsedMs: msg.elapsedMs,
            summary: `Solve stopped after ${msg.iterations} iteration(s) without convergence.`,
          })
          toast.warning('Solve did not converge', `Stopped after ${msg.iterations} iterations`)
        }
        this.ws?.close()
        break
      }

      case 'error': {
        const detail = msg.detail ?? msg.message
        this.addDiagnosticEvent('error', msg.message, detail, msg.solveId, msg.timestamp, msg.unitTag)
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
          this.updateProjectUnitStatus(msg.unitTag, 'error', [msg.message])
        }
        this.persistSolveHistoryEntry('error', {
          summary: msg.unitTag ? `${msg.unitTag}: ${msg.message}` : msg.message,
        })
        this.ws?.close()
        break
      }

      case 'status': {
        this.addDiagnosticEvent('status', msg.message, undefined, msg.solveId, msg.timestamp)
        const store = useSolverStore.getState()
        store.addAuditEntry({
          id: crypto.randomUUID(),
          unitTag: '',
          message: msg.message,
          severity: 'info',
        })
        break
      }

      case 'result': {
        this.addDiagnosticEvent(
          'result',
          `Received ${Object.keys(msg.streams).length} stream result(s).`,
          undefined,
          msg.solveId,
          msg.timestamp,
          msg.unitTag,
        )
        const store = useSolverStore.getState()
        store.setUnitStatus(msg.unitTag, 'converged')
        this.applyUnitResult(msg.unitTag, msg.streams)
        store.addAuditEntry({
          id: crypto.randomUUID(),
          unitTag: msg.unitTag,
          message: `Solved unit with ${Object.keys(msg.streams).length} output stream(s).`,
          severity: 'info',
        })
        break
      }

      case 'done': {
        this.addDiagnosticEvent(
          'done',
          `Solve completed with ${msg.solvedUnits} solved unit(s).`,
          `Iteration ${msg.iteration}, max error ${msg.maxError}`,
          msg.solveId,
          msg.timestamp,
        )
        const elapsedMs = Date.now() - this.solveStartedAt
        const store = useSolverStore.getState()
        store.updateSolverProgress(msg.iteration, msg.maxError, elapsedMs)
        store.setSolverStatus('converged')
        const currentProject = useProjectStore.getState().project
        const unitSummaries = buildUnitSummaries(currentProject, msg.solveId ?? this.solveId ?? 'unknown')
        store.setUnitSummaries(unitSummaries)
        this.persistSolveHistoryEntry('converged', {
          iteration: msg.iteration,
          maxError: msg.maxError,
          elapsedMs,
          solvedUnits: msg.solvedUnits,
          unitSummaries,
          summary: `Solved ${msg.solvedUnits} unit(s) in ${elapsedMs} ms.`,
        })
        toast.success('Solve complete', `${msg.solvedUnits} unit(s) solved in ${elapsedMs}ms`)
        this.ws?.close()
        break
      }
    }
  }

  private resetProjectResults(): void {
    useProjectStore.setState((state) => {
      for (const flowsheet of state.project.flowsheets) {
        for (const node of flowsheet.nodes) {
          node.solveStatus = node.enabled ? 'idle' : 'disabled'
          node.errorMessages = []
        }
        for (const edge of flowsheet.edges) {
          edge.stream = undefined
        }
      }
    })
  }

  private seedFeederStreams(project: Project): void {
    useProjectStore.setState((state) => {
      for (const flowsheet of state.project.flowsheets) {
        const sourceFlowsheet = project.flowsheets.find((candidate) => candidate.id === flowsheet.id)
        if (!sourceFlowsheet) continue

        const sourceNodeById = Object.fromEntries(sourceFlowsheet.nodes.map((node) => [node.id, node]))
        const sourceTagById = Object.fromEntries(sourceFlowsheet.nodes.map((node) => [node.id, node.tag]))

        for (const edge of flowsheet.edges) {
          const sourceNode = sourceNodeById[edge.source]
          if (!sourceNode || sourceNode.type !== 'Feeder') continue

          edge.stream = buildFeederStream(
            sourceNode,
            sourceTagById[edge.target] ?? edge.stream?.destUnitTag ?? '',
          )
        }

        for (const node of flowsheet.nodes) {
          const sourceNode = sourceFlowsheet.nodes.find((candidate) => candidate.id == node.id)
          if (sourceNode?.type === 'Feeder' && node.enabled) {
            node.solveStatus = 'converged'
          }
        }
      }
    })
  }

  private updateProjectUnitStatus(unitTag: string, status: UnitSolveStatus, errorMessages: string[] = []): void {
    useProjectStore.setState((state) => {
      for (const flowsheet of state.project.flowsheets) {
        const node = flowsheet.nodes.find((candidate) => candidate.tag === unitTag)
        if (!node) continue
        node.solveStatus = status
        node.errorMessages = errorMessages
      }
    })
  }

  private applyUnitResult(unitTag: string, streams: Record<string, StreamData>): void {
    useProjectStore.setState((state) => {
      for (const flowsheet of state.project.flowsheets) {
        const node = flowsheet.nodes.find((candidate) => candidate.tag === unitTag)
        if (!node) continue

        node.solveStatus = 'converged'
        node.errorMessages = []

        const mappedStreams = mapStreamsToOutgoingEdges(streams, flowsheet.edges, flowsheet.nodes, unitTag)
        for (const mapped of mappedStreams) {
          const edge = flowsheet.edges.find((candidate) => candidate.id === mapped.edgeId)
          if (edge) edge.stream = mapped.stream
        }
      }
    })
  }

  private addDiagnosticEvent(
    type: 'status' | 'result' | 'done' | 'error' | 'client',
    message: string,
    detail?: string,
    solveId?: string | null,
    timestamp?: string,
    unitTag?: string,
  ): void {
    useSolverStore.getState().addDiagnosticEvent({
      id: crypto.randomUUID(),
      solveId: solveId ?? this.solveId ?? 'unknown',
      timestamp: timestamp ?? new Date().toISOString(),
      type,
      unitTag,
      message,
      detail,
    })
  }

  private persistSolveHistoryEntry(
    status: 'converged' | 'error',
    options: {
      iteration?: number
      maxError?: number
      elapsedMs?: number
      solvedUnits?: number
      unitSummaries?: ReturnType<typeof buildUnitSummaries>
      summary: string
    },
  ): void {
    if (this.terminalReportWritten) return

    const solverState = useSolverStore.getState().solverState
    const completedAt = new Date().toISOString()
    const entry: SolveHistoryEntry = {
      id: crypto.randomUUID(),
      solveId: this.solveId ?? solverState.activeSolveId ?? 'unknown',
      startedAt: this.solveStartedAtIso ?? completedAt,
      completedAt,
      status,
      iteration: options.iteration ?? solverState.iteration,
      maxError: options.maxError ?? solverState.maxError,
      elapsedMs: options.elapsedMs ?? Math.max(Date.now() - this.solveStartedAt, 0),
      solvedUnits: options.solvedUnits ?? 0,
      diagnosticsCount: solverState.diagnostics.length,
      unitSummaryCount: options.unitSummaries?.length ?? solverState.unitSummaries.length,
      summary: options.summary,
    }

    useProjectStore.getState().addSolveHistoryEntry(entry)
    this.terminalReportWritten = true
  }
}

export const solverService = new SolverService()
