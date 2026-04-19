import { del, get, post, put } from './request'

export type AssistantChatMode = 'standard' | 'fast' | 'plan'

export interface AssistantArtifact {
  id: string
  path: string
  name?: string
  desc?: string
  type?: string
  direction?: 'input' | 'output' | 'intermediate'
  mimeType?: string
  size?: number
  createdAt: number
}

export interface AssistantSessionSummary {
  content: string
  updatedAt: number
  messageCount: number
}

export interface AssistantStoredMessage {
  id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  timestamp: number
  tool_calls?: any[]
  tool_call_id?: string
  name?: string
  artifacts?: AssistantArtifact[]
  meta?: Record<string, any>
}

export interface AssistantSessionRecord {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface AssistantSessionListItem {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  messageCount: number
  preview: string
  summaryUpdatedAt?: number
}

export interface AssistantSessionContextPayload {
  session: AssistantSessionRecord
  summary: AssistantSessionSummary | null
  messageCount: number
  recentArtifacts: AssistantArtifact[]
}

export interface AssistantChatPayload {
  message: string
  sessionId?: string
  files?: AssistantArtifact[]
  mode?: AssistantChatMode
}

export type AssistantStreamEvent =
  | { type: 'progress'; stage: string; message: string; sessionId?: string }
  | { type: 'content'; content: string; sessionId?: string }
  | { type: 'tool'; id?: string; name: string; status: 'running' | 'done' | 'error'; args?: any; result?: string; sessionId?: string }
  | { type: 'done'; content: string; sessionId?: string }
  | { type: 'error'; message: string; sessionId?: string }

export function getAssistantAuthHeaders() {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {}

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

export async function consumeSSE(
  response: Response,
  onEvent: (event: AssistantStreamEvent) => void
) {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('流式响应不可用')
  }

  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const segments = buffer.split('\n\n')
    buffer = segments.pop() || ''

    for (const segment of segments) {
      const dataLines = segment
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())

      if (dataLines.length === 0) {
        continue
      }

      const payload = dataLines.join('\n')
      if (!payload) {
        continue
      }

      try {
        onEvent(JSON.parse(payload))
      } catch {
        // 忽略单条异常事件，避免整条流被中断
      }
    }
  }
}

export async function fetchAssistantSessions(): Promise<AssistantSessionListItem[]> {
  const response = await get<any>('/assistant/sessions')
  return Array.isArray(response?.data) ? response.data : []
}

export async function createAssistantSession(name?: string): Promise<AssistantSessionRecord> {
  const response = await post<any>('/assistant/sessions', { name })
  return response?.data
}

export async function renameAssistantSession(sessionId: string, name: string): Promise<AssistantSessionRecord> {
  const response = await put<any>(`/assistant/sessions/${sessionId}`, { name })
  return response?.data
}

export async function deleteAssistantSession(sessionId: string): Promise<void> {
  await del(`/assistant/sessions/${sessionId}`)
}

export async function switchAssistantSession(sessionId: string): Promise<AssistantSessionContextPayload> {
  const response = await post<any>(`/assistant/sessions/${sessionId}/switch`)
  return response?.data?.context
}

export async function fetchAssistantSessionMessages(sessionId: string): Promise<{
  session: AssistantSessionRecord
  messages: AssistantStoredMessage[]
}> {
  const response = await get<any>(`/assistant/sessions/${sessionId}/messages`)
  return {
    session: response?.data?.session,
    messages: Array.isArray(response?.data?.messages) ? response.data.messages : []
  }
}

export async function fetchAssistantSessionContext(sessionId: string): Promise<AssistantSessionContextPayload> {
  const response = await get<any>(`/assistant/sessions/${sessionId}/context`)
  return response?.data
}

export async function summarizeAssistantSession(sessionId: string, maxMessages = 60): Promise<AssistantSessionSummary> {
  const response = await post<any>(`/assistant/sessions/${sessionId}/summarize`, {
    max_messages: maxMessages
  })
  return response?.data
}

export async function deleteAssistantSessionMessages(sessionId: string, startIndex: number, endIndex: number) {
  const response = await del<any>(`/assistant/sessions/${sessionId}/messages`, {
    data: {
      start_index: startIndex,
      end_index: endIndex
    }
  })

  return {
    session: response?.data?.session,
    messages: Array.isArray(response?.data?.messages) ? response.data.messages : []
  }
}

export async function uploadAssistantFiles(files: File[]): Promise<AssistantArtifact[]> {
  const formData = new FormData()
  files.forEach((file) => formData.append('file', file))

  const response = await fetch('/api/assistant/upload', {
    method: 'POST',
    headers: getAssistantAuthHeaders(),
    body: formData
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.error || `HTTP ${response.status}`)
  }

  const payload = await response.json()
  return Array.isArray(payload?.data) ? payload.data : []
}

export async function streamAssistantChat(
  payload: AssistantChatPayload,
  onEvent: (event: AssistantStreamEvent) => void
) {
  const response = await fetch('/api/assistant/chat', {
    method: 'POST',
    headers: {
      ...getAssistantAuthHeaders(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: payload.message,
      sessionId: payload.sessionId,
      files: payload.files,
      mode: payload.mode || 'standard'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error?.error || `HTTP ${response.status}`)
  }

  await consumeSSE(response, onEvent)
}

export function buildAssistantArtifactUrl(filePath: string, download = false) {
  const query = new URLSearchParams({
    path: filePath
  })

  if (download) {
    query.set('download', '1')
  }

  return `/api/assistant/artifact?${query.toString()}`
}
