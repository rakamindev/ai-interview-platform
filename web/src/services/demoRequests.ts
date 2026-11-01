import api from "./api";

export interface DemoRequestPayload {
  name: string;
  email: string;
  company: string;
  message: string;
}

export const demoRequestsApi = {
  create: (data: DemoRequestPayload) =>
    api.post<{ demo_request: { id: number } }>("/demo_requests", { demo_request: data }),
};
