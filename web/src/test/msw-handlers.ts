import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE_URL = "http://localhost:3001/api/v1";

const handlers = [
  http.get(`${BASE_URL}/api/v1/health`, () => HttpResponse.json({ data: { status: "ok" } }))
];

export const server = setupServer(...handlers);
