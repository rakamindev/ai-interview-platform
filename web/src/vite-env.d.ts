/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WS_BASE_URL: string;
  readonly VITE_SPEED_TEST_PING_URL?: string;
  readonly VITE_SPEED_TEST_UPLOAD_URL?: string;
  readonly VITE_DEV_TENANT_ID: string;
  readonly VITE_DEV_TENANT_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
