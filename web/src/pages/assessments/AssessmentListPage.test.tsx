import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AssessmentListPage from "./AssessmentListPage";

const { listMock } = vi.hoisted(() => ({ listMock: vi.fn() }));

vi.mock("@/services/assessments", () => ({
  assessmentsApi: { list: listMock },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AssessmentListPage />
    </MemoryRouter>
  );
}

const assessment = {
  id: 1,
  name: "Backend Engineer Screening",
  time_limit_min: 45,
  latest_session: null,
};

describe("AssessmentListPage", () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("menampilkan daftar assessment saat data berhasil dimuat", async () => {
    listMock.mockResolvedValue({ data: { assessments: [assessment] } });
    renderPage();

    expect(await screen.findByText("Backend Engineer Screening")).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/No assessments yet/i)).toBeNull();
  });

  it("menampilkan keadaan kosong saat berhasil dimuat tetapi tidak ada data", async () => {
    listMock.mockResolvedValue({ data: { assessments: [] } });
    renderPage();

    expect(await screen.findByText(/No assessments yet/i)).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("saat gagal memuat, hanya menampilkan pesan error dan tidak menampilkan 'No assessments yet'", async () => {
    listMock.mockRejectedValue(new Error("network"));
    renderPage();

    expect(await screen.findByRole("alert")).not.toBeNull();
    expect(screen.queryByText(/No assessments yet/i)).toBeNull();
    expect(screen.queryByText(/Create your first assessment/i)).toBeNull();
  });

  it("saat gagal memuat, tombol 'Try again' memuat ulang dan menampilkan daftar", async () => {
    listMock.mockRejectedValueOnce(new Error("network"));
    listMock.mockResolvedValueOnce({ data: { assessments: [assessment] } });
    renderPage();

    const retry = await screen.findByRole("button", { name: /try again/i });
    fireEvent.click(retry);

    expect(await screen.findByText("Backend Engineer Screening")).not.toBeNull();
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(listMock).toHaveBeenCalledTimes(2);
  });
});
