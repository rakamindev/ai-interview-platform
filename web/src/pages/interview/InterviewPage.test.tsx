import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import InterviewPage from "@/pages/interview/InterviewPage";
import type { InterviewState } from "@/types";

/**
 * Cacat #7 — `InterviewPage.tsx:51`.
 *
 *   .catch(() => setInterviewState("complete"));
 *
 * Satu `.catch` terminal meruntuhkan SEMUA kelas kegagalan ke satu state yang
 * layarnya (:230-242) menampilkan tanda centang, judul "Interview Complete",
 * dan kalimat "Thank you. The interview has been recorded."
 *
 * Token kedaluwarsa, token salah ketik, assessment terhapus, API mati, DNS
 * gagal — kandidat menerima ucapan terima kasih atas wawancara yang tidak
 * pernah dimulai. Lalu ia menutup tab dan menunggu kabar yang tidak akan
 * datang, karena di sisi assessor tidak ada sesi apa pun untuk ditinjau.
 * Tidak ada yang error di log, tidak ada yang komplain: kandidat merasa sudah
 * selesai. Ini kegagalan senyap yang paling mahal di repo ini, dan yang
 * menanggungnya adalah orang yang paling tidak punya kuasa atas sistemnya.
 *
 * Nuansa yang wajib dijaga (dan yang saya temukan setelah membaca sendiri,
 * bukan dari kesimpulan awal): halaman ini BUKAN tanpa resiliensi. Ada timer
 * 60 detik `connectionLostTimerRef` (:74-76), timer aman 10 detik untuk
 * `draining_audio` (:65-67), penanganan state `reconnecting`, dan guard
 * idempoten `audioCompleteCalledRef` (:101-109) dengan retry backoff.
 * Jadi cacatnya sempit dan spesifik: bukan "tidak ada penanganan error",
 * melainkan "jalur error awal salah diklasifikasikan sebagai sukses".
 *
 * Backend sudah membedakan kelas kegagalannya dan sudah mengirim pesan yang
 * layak dibaca manusia — `sessions_controller.rb:136` mengembalikan
 * `json_error("Invalid or expired invite token", :not_found)` dalam envelope
 * `{ errors: [{ status, message }] }` (`concerns/response.rb:11-15`). Jadi
 * frontend bukan kekurangan informasi; ia membuang informasi yang sudah ada.
 *
 * Tes ini mengunci satu invarian: TIDAK ADA kegagalan yang boleh dirender
 * sebagai keberhasilan — sekaligus menjaga agar satu-satunya jalur sukses
 * yang sah (`session_status === "ended"`) tetap hidup.
 */
const { getCandidateInfoMock, audioCompleteMock, wsOptions } = vi.hoisted(() => ({
  getCandidateInfoMock: vi.fn(),
  audioCompleteMock: vi.fn(),
  wsOptions: { current: null as null | { onStateChange: (state: InterviewState) => void } },
}));

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getCandidateInfo: getCandidateInfoMock, audioComplete: audioCompleteMock },
}));

/**
 * Ketiga hook audio menyentuh `AudioContext`, `WebSocket`, dan
 * `getUserMedia` — tidak ada satu pun di jsdom. Yang diuji di sini adalah
 * klasifikasi state, bukan pipeline audionya, jadi ketiganya diganti stub.
 * `wsOptions` menyimpan opsi terakhir supaya tes bisa mendorong perubahan
 * state dari sisi hook, persis seperti yang dilakukan hook aslinya.
 */
vi.mock("@/hooks/useAudioPlayback", () => ({
  useAudioPlayback: () => ({
    playChunk: vi.fn(),
    stop: vi.fn(),
    scheduleAfterPlayback: (cb: () => void) => cb(),
    waitForDrain: vi.fn(),
    cancelDrain: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAudioCapture", () => ({
  useAudioCapture: () => ({ start: vi.fn(), stop: vi.fn(), mute: vi.fn(), unmute: vi.fn() }),
}));

vi.mock("@/hooks/useAudioWebSocket", () => ({
  useAudioWebSocket: (options: { onStateChange: (state: InterviewState) => void }) => {
    wsOptions.current = options;
    return {
      connect: vi.fn(),
      send: vi.fn(),
      sendJson: vi.fn(),
      disconnect: vi.fn(),
      connectionState: "connected" as const,
    };
  },
}));

vi.mock("@/components/HardwareCheck", () => ({
  default: ({ onStart }: { onStart: () => void }) => (
    <button onClick={onStart}>Run hardware check</button>
  ),
}));

function renderAt(token = "nilai-token-palsu-untuk-test") {
  return render(
    <MemoryRouter initialEntries={[`/interview/${token}`]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

/** Bentuk error yang benar-benar dikirim `concerns/response.rb:11-15`. */
function backendError(status: number, message: string) {
  return { response: { status, data: { errors: [{ status, message }] } } };
}

function candidate(session_status: string) {
  return {
    data: {
      session_id: 42,
      role_title: "Backend Engineer",
      time_limit_min: 30,
      session_status,
    },
  };
}

/** Tiga penanda layar sukses. Tidak satu pun boleh muncul saat gagal. */
function expectTidakMengucapkanSelamat() {
  expect(screen.queryByText(/interview complete/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/has been recorded/i)).not.toBeInTheDocument();
  expect(screen.queryByText("✅")).not.toBeInTheDocument();
}

describe("InterviewPage — kegagalan tidak boleh tampil sebagai sukses", () => {
  beforeEach(() => {
    getCandidateInfoMock.mockReset();
    audioCompleteMock.mockReset().mockResolvedValue({ data: { ended: true, message: "ok" } });
    wsOptions.current = null;
  });

  it("token kedaluwarsa: tidak mengucapkan selamat, dan menyebut alasannya", async () => {
    getCandidateInfoMock.mockRejectedValue(
      backendError(404, "Invalid or expired invite token")
    );
    renderAt("token-palsu-kedaluwarsa");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expectTidakMengucapkanSelamat();
    /**
     * Pesannya diambil dari backend, bukan dikarang di frontend. Kandidat yang
     * tahu tokennya kedaluwarsa bisa meminta undangan baru; kandidat yang
     * membaca "Something went wrong" hanya bisa menebak.
     */
    expect(screen.getByRole("alert")).toHaveTextContent(/invalid or expired invite token/i);
  });

  it("API mati tanpa response: tetap layar error, bukan layar sukses", async () => {
    getCandidateInfoMock.mockRejectedValue(new Error("Network Error"));
    renderAt();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expectTidakMengucapkanSelamat();
    /**
     * Tidak ada `error.response` sama sekali di sini, jadi tidak ada pesan dari
     * server. Yang penting: klasifikasinya tetap "gagal", dan kandidat diberi
     * satu tindakan yang masuk akal alih-alih jalan buntu.
     */
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("tombol coba lagi memanggil ulang API, dan layar pulih saat berhasil", async () => {
    getCandidateInfoMock
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValueOnce(candidate("pending"));
    renderAt();

    const retry = await waitFor(() => screen.getByRole("button", { name: /try again/i }));
    await act(async () => {
      retry.click();
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /backend engineer/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(getCandidateInfoMock).toHaveBeenCalledTimes(2);
  });

  it("sesi yang benar-benar sudah selesai TETAP menampilkan layar sukses", async () => {
    getCandidateInfoMock.mockResolvedValue(candidate("ended"));
    renderAt();

    /**
     * Penjaga arah sebaliknya. Perbaikan yang membuat semua hal jadi error
     * sama salahnya dengan cacat aslinya: `session_status === "ended"` adalah
     * satu-satunya jalur sukses yang sah sebelum wawancara dimulai, dan itu
     * harus tetap hidup.
     */
    await waitFor(() => {
      expect(screen.getByText(/interview complete/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/has been recorded/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reconnect habis di tengah wawancara: koneksi hilang, bukan wawancara selesai", async () => {
    getCandidateInfoMock.mockResolvedValue(candidate("pending"));
    renderAt();
    await waitFor(() => expect(wsOptions.current).not.toBeNull());

    /**
     * Jalur kedua ke layar sukses palsu, dan yang lebih berbahaya karena
     * terjadi di tengah wawancara: `useAudioWebSocket.ts:130` memanggil
     * `onStateChange("complete")` setelah RECONNECT_DELAYS = [1000, 2000, 4000]
     * habis. Total ~7 detik. WiFi rumah yang putus 10 detik menghasilkan
     * layar "Interview Complete" — padahal jawaban kandidat berhenti di
     * tengah kalimat.
     *
     * Hook-nya di-stub, jadi yang diuji di sini adalah kontraknya: state apa
     * yang boleh dikirim hook untuk menyatakan "koneksi habis". `complete`
     * bukan jawabannya; itu klaim tentang wawancara, bukan tentang jaringan.
     */
    await act(async () => {
      const ws = wsOptions.current;
      if (ws === null) throw new Error("useAudioWebSocket belum dipanggil — mock tidak terpasang");
      ws.onStateChange("connection_lost");
    });

    expectTidakMengucapkanSelamat();
    expect(screen.getByRole("alert")).toHaveTextContent(/connection/i);
  });
});
