import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { API, server } from "@/test/server";
import { saveToken, getStoredToken } from "@/stores/authAtom";
import api from "./api";

describe("api client", () => {
  it("sends the stored token as a bearer token", async () => {
    let auth: string | null = null;
    server.use(
      http.get(`${API}/whoami`, ({ request }) => {
        auth = request.headers.get("Authorization");
        return HttpResponse.json({ ok: true });
      })
    );
    saveToken("abc.def.ghi");

    await api.get("/whoami");

    expect(auth).toBe("Bearer abc.def.ghi");
  });

  it("sends no Authorization header when nobody is signed in", async () => {
    let auth: string | null = "unset";
    server.use(
      http.get(`${API}/whoami`, ({ request }) => {
        auth = request.headers.get("Authorization");
        return HttpResponse.json({ ok: true });
      })
    );

    await api.get("/whoami");

    expect(auth).toBeNull();
  });

  it("unwraps a { data } envelope and leaves flat responses as they are", async () => {
    server.use(
      http.get(`${API}/wrapped`, () => HttpResponse.json({ data: { items: [1, 2] }, meta: { page: 1 } })),
      http.get(`${API}/flat`, () => HttpResponse.json({ items: [3] }))
    );

    expect((await api.get("/wrapped")).data).toEqual({ items: [1, 2] });
    expect((await api.get("/flat")).data).toEqual({ items: [3] });
  });

  it("signs the user out on 401", async () => {
    server.use(http.get(`${API}/private`, () => HttpResponse.json({}, { status: 401 })));
    saveToken("expired");

    await expect(api.get("/private")).rejects.toMatchObject({ response: { status: 401 } });
    expect(getStoredToken()).toBeNull();
  });

  it("keeps the user signed in on a server error", async () => {
    server.use(http.get(`${API}/broken`, () => HttpResponse.json({}, { status: 500 })));
    saveToken("still-valid");

    await expect(api.get("/broken")).rejects.toMatchObject({ response: { status: 500 } });
    expect(getStoredToken()).toBe("still-valid");
  });
});
