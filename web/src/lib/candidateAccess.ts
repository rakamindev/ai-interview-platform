export type CandidateLanguage = "en" | "id";

export type CandidateAccessError =
  | "not_found"
  | "expired"
  | "revoked"
  | "completed"
  | "in_progress"
  | "network"
  | "unknown";

interface AccessCopy {
  title: string;
  body: string;
  hint?: string;
  retry?: boolean;
}

/**
 * Maps an API response to the candidate-facing access state.
 *
 * The backend is the source of truth: it sends a stable `code` for every
 * rejected invite. Falling back to HTTP status keeps older responses working.
 */
export function resolveCandidateAccessError(
  status?: number,
  code?: string | null
): CandidateAccessError {
  switch (code) {
    case "invite_not_found":
      return "not_found";
    case "invite_expired":
      return "expired";
    case "invite_revoked":
      return "revoked";
    case "invite_completed":
      return "completed";
    case "invite_in_progress":
      return "in_progress";
  }

  if (status === 404) return "not_found";
  if (status === 410) return "expired";
  if (!status || status === 0 || status >= 500) return "network";
  return "unknown";
}

/**
 * Reads the API error envelope (`{ errors: [{ code }] }`) without importing
 * axios, so the mapping can be unit tested in isolation.
 */
export function resolveCandidateAccessFromError(error: unknown): CandidateAccessError {
  const response = (
    error as {
      response?: { status?: number; data?: { errors?: Array<{ code?: string }> } };
    }
  )?.response;

  return resolveCandidateAccessError(
    response?.status,
    response?.data?.errors?.[0]?.code ?? null
  );
}

const COPY: Record<CandidateLanguage, Record<CandidateAccessError, AccessCopy>> = {
  en: {
    not_found: {
      title: "This interview link is not valid",
      body: "Check that you copied the full link from your invitation. Links are unique to each candidate and cannot be guessed.",
      hint: "If you are stuck, contact the hiring team and ask them to resend your invitation.",
    },
    expired: {
      title: "This interview link has expired",
      body: "Interview links stay active for a limited time so candidate data is not exposed indefinitely.",
      hint: "Ask the hiring team to reissue your link — it only takes them a moment.",
    },
    revoked: {
      title: "This interview link was cancelled",
      body: "The hiring team has withdrawn this link. This can happen when a role is paused or an invitation was sent by mistake.",
      hint: "Contact the hiring team if you believe this is a mistake.",
    },
    completed: {
      title: "You have already completed this interview",
      body: "There is nothing else you need to do. The hiring team will review your interview and follow up with you.",
      hint: "You cannot retake the interview from the same link.",
    },
    in_progress: {
      title: "This interview is already in progress",
      body: "For privacy, the link cannot start a second interview while the first one is open.",
      hint: "If you were disconnected, contact the hiring team so they can help you rejoin safely.",
    },
    network: {
      title: "We could not reach the interview service",
      body: "Your link may still be fine — this looks like a connection problem on our side.",
      hint: "Check your internet connection and try again.",
      retry: true,
    },
    unknown: {
      title: "Something went wrong",
      body: "We could not open this interview. Please try again.",
      hint: "If the problem continues, contact the hiring team.",
      retry: true,
    },
  },
  id: {
    not_found: {
      title: "Tautan wawancara ini tidak valid",
      body: "Pastikan Anda menyalin tautan lengkap dari undangan. Setiap kandidat memiliki tautan unik yang tidak bisa ditebak.",
      hint: "Jika masih bermasalah, hubungi tim rekrutmen untuk mengirim ulang undangan.",
    },
    expired: {
      title: "Tautan wawancara ini sudah kedaluwarsa",
      body: "Tautan wawancara hanya aktif dalam batas waktu tertentu agar data kandidat tidak terekspos tanpa batas.",
      hint: "Minta tim rekrutmen menerbitkan tautan baru — prosesnya cepat.",
    },
    revoked: {
      title: "Tautan wawancara ini dibatalkan",
      body: "Tim rekrutmen telah menarik tautan ini. Hal ini bisa terjadi jika posisi ditunda atau undangan dikirim keliru.",
      hint: "Hubungi tim rekrutmen jika Anda merasa ini sebuah kesalahan.",
    },
    completed: {
      title: "Anda sudah menyelesaikan wawancara ini",
      body: "Tidak ada lagi yang perlu Anda lakukan. Tim rekrutmen akan meninjau hasil wawancara dan menghubungi Anda.",
      hint: "Anda tidak dapat mengulang wawancara melalui tautan yang sama.",
    },
    in_progress: {
      title: "Wawancara ini sedang berlangsung",
      body: "Demi privasi, tautan ini tidak dapat memulai wawancara kedua selama sesi pertama masih terbuka.",
      hint: "Jika koneksi Anda terputus, hubungi tim rekrutmen agar dapat membantu Anda bergabung kembali.",
    },
    network: {
      title: "Tidak dapat terhubung ke layanan wawancara",
      body: "Tautan Anda kemungkinan masih valid — ini terlihat seperti masalah koneksi.",
      hint: "Periksa koneksi internet Anda lalu coba lagi.",
      retry: true,
    },
    unknown: {
      title: "Terjadi kesalahan",
      body: "Kami tidak dapat membuka wawancara ini. Silakan coba lagi.",
      hint: "Jika masalah berlanjut, hubungi tim rekrutmen.",
      retry: true,
    },
  },
};

export function getCandidateAccessCopy(
  error: CandidateAccessError,
  language: CandidateLanguage = "en"
): AccessCopy {
  return COPY[language][error];
}

export const CONSENT_COPY: Record<
  CandidateLanguage,
  { heading: string; body: string; checkbox: string; continue: string; back: string }
> = {
  en: {
    heading: "Before you begin",
    body:
      "This is a recorded voice interview. Your voice and transcript are processed to assess the skills required for this role and are shared only with the hiring team.",
    checkbox:
      "I agree to the recording and processing of my voice and transcript for this assessment.",
    continue: "Continue to device check",
    back: "Go back",
  },
  id: {
    heading: "Sebelum memulai",
    body:
      "Ini adalah wawancara suara yang direkam. Suara dan transkrip Anda diproses untuk menilai keterampilan yang dibutuhkan posisi ini dan hanya dibagikan kepada tim rekrutmen.",
    checkbox:
      "Saya setuju atas perekaman dan pemrosesan suara serta transkrip saya untuk penilaian ini.",
    continue: "Lanjut ke pemeriksaan perangkat",
    back: "Kembali",
  },
};
