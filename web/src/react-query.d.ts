import type { ApiError, ResponseApiError } from "./lib/api-client";

declare module "@tanstack/react-query" {
  interface Register {
    defaultError: ApiError<ResponseApiError>;
  }
}
