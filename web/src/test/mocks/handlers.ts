import { http, HttpResponse } from 'msw'

const API_BASE = 'http://localhost:3001/api/v1'

export const handlers = [
  // Health check
  http.get(`${API_BASE}/health`, () => {
    return HttpResponse.json({ status: 'ok' })
  }),
]
