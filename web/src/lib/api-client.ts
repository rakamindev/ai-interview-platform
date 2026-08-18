import ky, { type HTTPError, isHTTPError, type KyInstance, type Options } from "ky";
import { getStoredToken } from "@/stores/auth-atom";

export interface ResponseApiError {
  errors: Array<{
    status: number;
    message: string;
  }>;
}

export class ApiError<TData = ResponseApiError> extends Error {
  readonly status: number;
  readonly data: TData | null;
  readonly response: Response;
  readonly request: Request;

  constructor(message: string, opts: { status: number; data: TData | null; response: Response; request: Request }) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.data = opts.data;
    this.response = opts.response;
    this.request = opts.request;
  }
}

class ApiClient {
  private client: KyInstance;

  constructor(config: Options) {
    this.client = ky.create({
      baseUrl: config.baseUrl,
      prefix: config.prefix,
      timeout: config.timeout || 30000,
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
      hooks: {
        ...config.hooks,
        beforeError: [
          async ({ error }) => {
            const { response, request } = error as HTTPError;

            if (isHTTPError(error)) {
              const errorData = error.data as ResponseApiError;

              if (typeof error.data === "object" && error.data !== null) {
                return new ApiError<ResponseApiError>(error.message, {
                  status: response.status,
                  data: errorData,
                  response,
                  request,
                });
              }
            } else {
              return new ApiError<ResponseApiError>(error.message, {
                status: response.status,
                data: null,
                response,
                request,
              });
            }

            return error;
          },
          ...(config.hooks?.beforeError ?? []),
        ],
      },
      ...config,
    });
  }

  async get<T>(path: string, options?: Options): Promise<T> {
    const response = await this.client.get(path, options);
    return response.json<T>();
  }

  /** GET raw response as Blob (file downloads / export endpoints). */
  async download(path: string, options?: Options): Promise<Blob> {
    const response = await this.client.get(path, options);
    return response.blob();
  }

  async post<T>(path: string, data?: unknown, options?: Options): Promise<T> {
    const response = await this.client.post(path, {
      json: data,
      ...options,
    });
    return response.json<T>();
  }

  async put<T>(path: string, data?: unknown, options?: Options): Promise<T> {
    const response = await this.client.put(path, {
      json: data,
      ...options,
    });
    return response.json<T>();
  }

  async patch<T>(path: string, data?: unknown, options?: Options): Promise<T> {
    const response = await this.client.patch(path, {
      json: data,
      ...options,
    });
    return response.json<T>();
  }

  async delete<T>(path: string, options?: Options): Promise<T> {
    const response = await this.client.delete(path, options);
    return response.json<T>();
  }
}

export { isHTTPError } from "ky";

export const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
  prefix: "/api/v1",
  hooks: {
    beforeRequest: [
      ({ request }) => {
        const token = getStoredToken();

        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],
  },
});
