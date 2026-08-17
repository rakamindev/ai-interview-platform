import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { createStore } from "jotai";

async function freshTenantModule() {
  vi.resetModules();
  return import("./tenantAtom");
}

describe("tenantAtom", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to a null id and the Demo Tenant name", async () => {
    vi.stubEnv("VITE_DEV_TENANT_ID", undefined);
    vi.stubEnv("VITE_DEV_TENANT_NAME", undefined);
    const { tenantAtom: freshTenantAtom } = await freshTenantModule();
    expect(createStore().get(freshTenantAtom)).toEqual({ id: null, name: "Demo Tenant" });
  });

  it("seeds from the dev tenant environment variables", async () => {
    vi.stubEnv("VITE_DEV_TENANT_ID", "42");
    vi.stubEnv("VITE_DEV_TENANT_NAME", "Acme Corp");
    const { tenantAtom: freshTenantAtom } = await freshTenantModule();
    expect(createStore().get(freshTenantAtom)).toEqual({ id: "42", name: "Acme Corp" });
  });

  it("keeps the default name when only the id is configured", async () => {
    vi.stubEnv("VITE_DEV_TENANT_ID", "7");
    vi.stubEnv("VITE_DEV_TENANT_NAME", undefined);
    const { tenantAtom: freshTenantAtom } = await freshTenantModule();
    expect(createStore().get(freshTenantAtom)).toEqual({ id: "7", name: "Demo Tenant" });
  });
});
