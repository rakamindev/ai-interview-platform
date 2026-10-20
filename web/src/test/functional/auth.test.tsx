import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { API, server } from "../server";
import { renderApp } from "../render";
import { assessmentList } from "../fixtures";

describe("Signing in", () => {
  it("sends a signed-out visitor to the login page", async () => {
    renderApp("/assessments", { token: null });

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("signs the assessor in and lands on their assessments", async () => {
    let sent: unknown;
    server.use(
      http.post(`${API}/auth/login`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ token: "fresh-token", user: { id: 1, email: "dimas@example.test", role: "admin" } });
      }),
      http.get(`${API}/assessments`, ({ request }) =>
        request.headers.get("Authorization") === "Bearer fresh-token"
          ? HttpResponse.json(assessmentList([{ name: "Senior Frontend Engineer" }]))
          : HttpResponse.json({ errors: [{ status: 401 }] }, { status: 401 })
      )
    );
    const { user } = renderApp("/login", { token: null });

    await user.type(screen.getByLabelText("Email"), "dimas@example.test");
    await user.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Senior Frontend Engineer")).toBeInTheDocument();
    expect(sent).toEqual({ email: "dimas@example.test", password: "correct-horse-battery" });
    expect(localStorage.getItem("auth_token")).toBe("fresh-token");
  });

  it("keeps the assessor on the form with a message when the credentials are wrong", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ errors: [{ status: 401, message: "Invalid email or password" }] }, { status: 401 })
      )
    );
    const { user } = renderApp("/login", { token: null });

    await user.type(screen.getByLabelText("Email"), "dimas@example.test");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("lets the assessor reveal and hide the password they typed", async () => {
    const { user } = renderApp("/login", { token: null });
    const password = screen.getByLabelText("Password");

    await user.type(password, "correct-horse-battery");
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("correct-horse-battery");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });
});
