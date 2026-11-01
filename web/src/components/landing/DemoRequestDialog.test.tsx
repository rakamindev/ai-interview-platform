import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DemoRequestDialog from "@/components/landing/DemoRequestDialog";
import { demoRequestsApi } from "@/services/demoRequests";

vi.mock("@/services/demoRequests", () => ({ demoRequestsApi: { create: vi.fn() } }));

function httpError(status: number, message?: string) {
  const error = new AxiosError("Request failed");
  error.response = {
    status,
    data: message ? { errors: [{ message }] } : {},
  } as AxiosError["response"];
  return error;
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Full name/), "Sari Wijaya");
  await user.type(screen.getByLabelText(/Work email/), "sari@example.test");
  await user.type(screen.getByLabelText(/Company/), "Example Corp");
}

async function openDialog() {
  const user = userEvent.setup();
  render(<DemoRequestDialog trigger={<button type="button">Request a demo</button>} />);
  await user.click(screen.getByRole("button", { name: "Request a demo" }));
  return user;
}

describe("DemoRequestDialog", () => {
  beforeEach(() => {
    vi.mocked(demoRequestsApi.create).mockReset();
    vi.mocked(demoRequestsApi.create).mockResolvedValue({
      data: { demo_request: { id: 1 } },
    } as Awaited<ReturnType<typeof demoRequestsApi.create>>);
  });

  it("requires name, a valid work email, and company before accepting the request", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText(/Full name/), "   ");
    await user.type(screen.getByLabelText(/Work email/), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(screen.getByText("Enter your name")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Enter your company")).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Request recorded")).toBeNull();
    expect(demoRequestsApi.create).not.toHaveBeenCalled();
  });

  it("sends the request to the API, then starts from a blank form when reopened", async () => {
    const user = await openDialog();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(demoRequestsApi.create).toHaveBeenCalledWith({
      name: "Sari Wijaya",
      email: "sari@example.test",
      company: "Example Corp",
      message: "",
    });
    expect(await screen.findByRole("heading", { name: "Request recorded" })).toBeInTheDocument();
    expect(
      screen.getByText(/Your demo request for Example Corp has been saved/),
    ).toBeInTheDocument();
    expect(screen.getByText(/No confirmation email or follow-up schedule/)).toBeInTheDocument();
    expect(screen.queryByText(/reach out|contact you/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Request a demo" }));
    expect(screen.getByLabelText(/Full name/)).toHaveValue("");
  });

  it("keeps the form and explains the failure when the request is not delivered", async () => {
    vi.mocked(demoRequestsApi.create).mockRejectedValue(httpError(500));
    const user = await openDialog();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(
      await screen.findByText("We couldn't send your request. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Request recorded")).toBeNull();
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Sari Wijaya");
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
  });

  it("shows the server's validation message and the throttle message", async () => {
    vi.mocked(demoRequestsApi.create)
      .mockRejectedValueOnce(httpError(422, "Email is invalid"))
      .mockRejectedValueOnce(httpError(429));
    const user = await openDialog();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText("Email is invalid")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(
      await screen.findByText("Too many requests from this device. Please try again later."),
    ).toBeInTheDocument();
  });
});
