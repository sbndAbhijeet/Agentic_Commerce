import apiClient from './client'
import type { AuditLog } from '../types/auditLog'

export const auditLogsApi = {
  listAuditLogs: async (sessionId?: string, limit = 20): Promise<AuditLog[]> => {
    const response = await apiClient.get<AuditLog[]>('/audit-logs', {
      params: {
        limit,
        ...(sessionId ? { session_id: sessionId } : {}),
      },
    })
    return response.data
  },

  getAuditLog: async (auditId: string): Promise<AuditLog> => {
    const response = await apiClient.get<AuditLog>(`/audit-logs/${auditId}`)
    return response.data
  },
}
