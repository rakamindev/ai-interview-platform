import { setupServer } from "msw/node";

// Tests talk to the real axios client and services; only the network is fake.
// Handlers are added per test with server.use(...).
export const API = "http://api.test/api/v1";

export const server = setupServer();
