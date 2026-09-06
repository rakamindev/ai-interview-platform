export interface ApiError {
  message: string;
  status?: number;
  retryable: boolean;
}

export function parseApiError(err: unknown): ApiError {
  // Axios error dengan response (server returned an error)
  if (err && typeof err === 'object' && 'response' in err) {
    const e = err as { response: { status: number; data: Record<string, unknown> } };
    const status = e.response?.status;
    const msg =
      (e.response?.data?.error as string) ||
      (e.response?.data?.message as string) ||
      defaultMessage(status);
    return {
      message: msg,
      status,
      retryable: !status || status >= 500 || status === 429,
    };
  }

  // Network error (no response — timeout, offline, CORS)
  if (err instanceof Error && err.message.toLowerCase().includes('network')) {
    return {
      message: 'Tidak dapat terhubung ke server. Periksa koneksi internet kamu.',
      retryable: true,
    };
  }

  // Fallback
  return {
    message: 'Terjadi kesalahan tidak terduga. Coba muat ulang halaman.',
    retryable: false,
  };
}

function defaultMessage(status?: number): string {
  const map: Record<number, string> = {
    401: 'Sesi kamu sudah berakhir. Silakan login ulang.',
    403: 'Kamu tidak punya izin untuk mengakses resource ini.',
    404: 'Data yang kamu cari tidak ditemukan.',
    422: 'Data yang dikirim tidak valid. Cek form kamu.',
    429: 'Terlalu banyak permintaan. Coba lagi sebentar.',
  };
  return map[status ?? 0] ?? 'Server sedang mengalami gangguan. Coba lagi nanti.';
}
