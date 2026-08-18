import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";
import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "jotai";

import { useLoginViewModel } from "./useLoginViewModel";
import { authApi } from "@/services/auth";
import { saveToken } from "@/stores/authAtom";

const mockedNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );

  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

vi.mock("@/services/auth", () => ({
  authApi: {
    login: vi.fn(),
  },
}));

vi.mock("@/stores/authAtom", async () => {
  const actual = await vi.importActual<typeof import("@/stores/authAtom")>(
    "@/stores/authAtom"
  );

  return {
    ...actual,
    saveToken: vi.fn(),
  };
});

const mockedLogin = vi.mocked(authApi.login);
const mockedSaveToken = vi.mocked(saveToken);

const createAxiosError = (status?: number) => {
  const error = AxiosError.from(new Error("Request failed"));

  if (status !== undefined) {
    error.response = {
      status,
      statusText: "",
      headers: {},
      config: {} as never,
      data: {},
    };
  }

  return error;
};

const createWrapper = () => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider>
        <MemoryRouter>{children}</MemoryRouter>
      </Provider>
    );
  };
};

const renderLoginViewModel = () =>
  renderHook(() => {
    const viewModel = useLoginViewModel();

    // Subscribe to formState.errors so React Hook Form
    // triggers a re-render when setError() is called.
    const { errors } = viewModel.form.formState;

    return {
      ...viewModel,
      errors,
    };
  }, {
    wrapper: createWrapper(),
  });

describe("useLoginViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with empty form values", () => {
    const { result } = renderLoginViewModel();

    expect(result.current.form.getValues()).toEqual({
      email: "",
      password: "",
    });
  });

  it("logs in successfully", async () => {
    mockedLogin.mockResolvedValue({
      data: {
        token: "test-token",
      },
    } as never);

    const { result } = renderLoginViewModel();

    await act(async () => {
      await result.current.onSubmit({
        email: "user@example.com",
        password: "password123",
      });
    });

    expect(mockedLogin).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
    });

    expect(mockedSaveToken).toHaveBeenCalledWith("test-token");
    expect(mockedNavigate).toHaveBeenCalledWith("/assessments");
  });

  it("sets invalid credentials error when API returns 401", async () => {
    mockedLogin.mockRejectedValue(createAxiosError(401));

    const { result } = renderLoginViewModel();

    await act(async () => {
      await result.current.onSubmit({
        email: "wrong@example.com",
        password: "wrong-password",
      });
    });

    await waitFor(() => {
      expect(result.current.errors.root?.serverError?.message).toBe(
        "Invalid email or password."
      );
    });

    expect(mockedNavigate).not.toHaveBeenCalled();
    expect(mockedSaveToken).not.toHaveBeenCalled();
  });

  it("sets connection error when API request fails without a response", async () => {
    mockedLogin.mockRejectedValue(createAxiosError());

    const { result } = renderLoginViewModel();

    await act(async () => {
      await result.current.onSubmit({
        email: "user@example.com",
        password: "password123",
      });
    });

    await waitFor(() => {
      expect(result.current.errors.root?.serverError?.message).toBe(
        "Unable to connect to the server. Please try again."
      );
    });

    expect(mockedNavigate).not.toHaveBeenCalled();
    expect(mockedSaveToken).not.toHaveBeenCalled();
  });

  it("sets generic error for unexpected API errors", async () => {
    mockedLogin.mockRejectedValue(createAxiosError(500));

    const { result } = renderLoginViewModel();

    await act(async () => {
      await result.current.onSubmit({
        email: "user@example.com",
        password: "password123",
      });
    });

    await waitFor(() => {
      expect(result.current.errors.root?.serverError?.message).toBe(
        "Something went wrong. Please try again later."
      );
    });

    expect(mockedNavigate).not.toHaveBeenCalled();
    expect(mockedSaveToken).not.toHaveBeenCalled();
  });
});