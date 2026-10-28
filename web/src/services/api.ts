import axios from "axios";
import { getStoredToken, clearToken } from "@/stores/authAtom";
import {
  MOCK_SKILL_TAXONOMIES,
  MOCK_ASSESSMENTS,
  MOCK_VACANCIES,
  MOCK_FIT_GAP_REPORT,
  MOCK_SESSIONS
} from "./mockData";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:3000";

export const WS_URL = WS_BASE_URL;

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor fallback ketika API server belum aktif di lokal
api.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === "object" && "data" in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    const url = error.config?.url || "";
    const method = error.config?.method?.toLowerCase() || "";

    // Tangani kondisi network error / endpoint belum running
    if (error.code === "ERR_NETWORK" || error.message?.includes("Network Error") || error.response?.status === 404) {
      // 1. Skill Taxonomies
      if (url.includes("/skill_taxonomies")) {
        return { data: { skill_taxonomies: MOCK_SKILL_TAXONOMIES } };
      }

      // 2. Assessments
      if (url.includes("/assessments") && method === "get") {
        if (url.includes("/sessions")) {
          // Ambil daftar sesi kandidat yang up to date
          return { data: { sessions: [...MOCK_SESSIONS] } };
        }
        const idMatch = url.match(/\/assessments\/(\d+)/);
        if (idMatch) {
          const a = MOCK_ASSESSMENTS.find((item) => item.id === Number(idMatch[1])) || MOCK_ASSESSMENTS[0];
          return { data: { assessment: a } };
        }
        return { data: { assessments: MOCK_ASSESSMENTS } };
      }
      if (url.includes("/assessments") && (method === "post" || method === "patch" || method === "put")) {
        if (url.includes("/sessions")) {
          const body = JSON.parse(error.config.data || "{}");
          const payload = body.session || body;
          const candidateName = payload.candidate_name?.trim() || "Kandidat Baru";
          const newSessionId = Date.now();
          const createdSession = {
            id: newSessionId,
            assessment_id: 1,
            candidate_name: candidateName,
            invite_token: `token-${newSessionId}`,
            invite_url: `http://localhost:5173/interview/token-${newSessionId}`,
            status: "ended" as const, // langsung berstatus ended agar tombol Results aktif
            end_reason: "completed",
            started_at: new Date().toISOString(),
            duration_seconds: 1800
          };
          MOCK_SESSIONS.unshift(createdSession);
          return { data: { session: createdSession } };
        }
        const body = JSON.parse(error.config.data || "{}");
        const idMatch = url.match(/\/assessments\/(\d+)/);
        if (idMatch) {
          const idx = MOCK_ASSESSMENTS.findIndex((item) => item.id === Number(idMatch[1]));
          if (idx !== -1) {
            MOCK_ASSESSMENTS[idx] = { ...MOCK_ASSESSMENTS[idx], ...body };
            return { data: { assessment: MOCK_ASSESSMENTS[idx] } };
          }
        }
        const newAssessment = { id: Date.now(), ...body, latest_session: { status: "pending" } };
        MOCK_ASSESSMENTS.push(newAssessment);
        return { data: { assessment: newAssessment } };
      }

      // 3. Vacancies
      if (url.includes("/vacancies") && method === "get") {
        const idMatch = url.match(/\/vacancies\/(\d+)/);
        if (idMatch) {
          const v = MOCK_VACANCIES.find((item) => item.id === Number(idMatch[1])) || MOCK_VACANCIES[0];
          return { data: { vacancy: v } };
        }
        return { data: { vacancies: MOCK_VACANCIES } };
      }
      if (url.includes("/vacancies") && (method === "post" || method === "patch" || method === "put")) {
        const body = JSON.parse(error.config.data || "{}");
        const vacancyPayload = body.vacancy || body;
        const idMatch = url.match(/\/vacancies\/(\d+)/);
        if (idMatch) {
          const idx = MOCK_VACANCIES.findIndex((item) => item.id === Number(idMatch[1]));
          if (idx !== -1) {
            MOCK_VACANCIES[idx] = {
              ...MOCK_VACANCIES[idx],
              ...vacancyPayload,
              role_title: vacancyPayload.role_title || MOCK_VACANCIES[idx].role_title,
              skills: vacancyPayload.vacancy_skills_attributes || MOCK_VACANCIES[idx].skills
            };
            return { data: { vacancy: MOCK_VACANCIES[idx] } };
          }
        }
        const newVacancy = {
          id: Date.now(),
          ...vacancyPayload,
          role_title: vacancyPayload.role_title || "Untitled Vacancy",
          skills: vacancyPayload.vacancy_skills_attributes || []
        };
        MOCK_VACANCIES.push(newVacancy);
        return { data: { vacancy: newVacancy } };
      }

      // 4. Fit Gap Report
      if (url.includes("/fit_gap") || url.includes("/fitgap")) {
        const vacIdMatch = url.match(/\/fitgap\/(\d+)/);
        const targetVacId = vacIdMatch ? Number(vacIdMatch[1]) : 1;
        const vacancy = MOCK_VACANCIES.find((v) => v.id === targetVacId) || MOCK_VACANCIES[0];

        // Ekstrak session ID untuk menyesuaikan skor kandidat
        const sessMatch = url.match(/\/sessions\/(\d+)\//);
        const currentSessionId = sessMatch ? Number(sessMatch[1]) : 1;
        const currentSession = MOCK_SESSIONS.find((s) => s.id === currentSessionId);
        const sessionStatus = currentSession?.end_reason || "completed";

        let candidatePortfolioSkills = [
          { skill_label: "React / Frontend Development Core", level: 4 },
          { skill_label: "UI/UX & Design Systems", level: 3 },
          { skill_label: "System Design & Architecture", level: null }
        ];

        if (sessionStatus === "error" || currentSessionId === 3) {
          // Fadhil Farhan: skor frontend dasar L1
          candidatePortfolioSkills = [
            { skill_label: "React / Frontend Development Core", level: 1 },
            { skill_label: "UI/UX & Design Systems", level: 1 },
            { skill_label: "System Design & Architecture", level: null }
          ];
        } else if (sessionStatus === "needs_review" || currentSessionId === 2) {
          // Ahmad Fauzi: skor borderline L2
          candidatePortfolioSkills = [
            { skill_label: "React / Frontend Development Core", level: 2 },
            { skill_label: "UI/UX & Design Systems", level: 3 },
            { skill_label: "System Design & Architecture", level: null }
          ];
        }

        const comparisons = vacancy.skills.map((vs) => {
          const match = candidatePortfolioSkills.find(
            (cs) => cs.skill_label.toLowerCase() === vs.skill_label.toLowerCase()
          );
          const reqLevel = vs.expected_level;
          const candLevel = match && match.level !== null ? match.level : null;
          let result: "match" | "gap" | "exceed" | "not_assessed" = "not_assessed";
          let delta: number | null = null;

          if (candLevel != null) {
            delta = candLevel - reqLevel;
            if (delta === 0) result = "match";
            else if (delta > 0) result = "exceed";
            else result = "gap";
          } else {
            result = "not_assessed";
          }

          return {
            skill_label: vs.skill_label,
            skill_id: vs.skill_id,
            expected_level: reqLevel,
            required_level: reqLevel, // Kontrak ganda agar aman di semua consumer
            candidate_level: candLevel,
            result,
            delta,
            is_override: false
          };
        });

        // Rekomendasi peran alternatif (Talent Redeployment / Cross-matching)
        let recommendation = null;
        if (targetVacId === 2 && (currentSessionId === 1 || sessionStatus === "completed")) {
          // Budi Santoso diuji Fullstack tapi hebat di React L4
          recommendation = {
            status: "alternative_match",
            recommended_role: "Frontend Engineer Intern",
            recommended_vacancy_id: 1,
            reason: "Kandidat memiliki penguasaan React L4 yang melampaui target frontend, namun belum teruji pada komponen backend (Node.js & Database). Sangat direkomendasikan dialihkan ke posisi Frontend Engineer Intern."
          };
        } else if (currentSessionId === 3) {
          // Fadhil Farhan gagal di level Engineer
          recommendation = {
            status: "entry_level_track",
            recommended_role: "Frontend Bootcamp / Apprenticeship Track",
            reason: "Kompetensi saat ini berada pada tahap foundational (L1). Belum memenuhi standar junior engineer independen, disarankan mengikuti jalur pelatihan (apprenticeship)."
          };
        } else if (currentSessionId === 2) {
          recommendation = {
            status: "human_review",
            recommended_role: "Frontend Engineer (Junior) - Under Mentorship",
            reason: "Kandidat memiliki pemahaman UI/UX L3 yang solid dengan dasar React L2. Membutuhkan review manual asesor atau sesi pendampingan awal."
          };
        }

        return {
          data: {
            report: {
              id: targetVacId,
              portfolio_id: 10,
              vacancy_id: targetVacId,
              generated_at: new Date().toISOString(),
              culture_narrative: `Kandidat menunjukkan kecocokan budaya kerja yang positif dengan nilai-nilai untuk posisi ${vacancy.role_title}. Sikap proaktif dan komunikatif sangat menonjol.`,
              overall_narrative: `Analisis perbandingan untuk posisi ${vacancy.role_title}: Kandidat memiliki profil kompetensi yang spesifik. Tinjau rekomendasi penempatan peran alternatif di bawah.`,
              skill_comparisons: comparisons,
              recommendation
            }
          }
        };
      }

      // 5. Portfolio lookup & actions
      if (url.match(/\/sessions\/\d+$/) && method === "get") {
        const sMatch = url.match(/\/sessions\/(\d+)$/);
        const sId = sMatch ? Number(sMatch[1]) : 1;
        const targetSession = MOCK_SESSIONS.find((s) => s.id === sId) || MOCK_SESSIONS[0];
        return {
          data: {
            session: targetSession,
            assessment: { id: 1, name: "Frontend Engineer Screening", time_limit_min: 45 }
          }
        };
      }
      if (url.includes("/portfolio_skills/") && url.includes("/override")) {
        const body = JSON.parse(error.config.data || "{}");
        const payload = body.override || body;
        const skillId = Number(url.match(/\/portfolio_skills\/(\d+)\/override/)?.[1] || 1);
        return {
          data: {
            override: {
              id: Date.now(),
              portfolio_skill_id: skillId,
              override_level: payload.override_level,
              assessor_notes: payload.assessor_notes,
              created_at: new Date().toISOString()
            }
          }
        };
      }
      if (url.includes("/portfolios/") && url.includes("/export")) {
        // Return dummy text file blob so Unduh PDF succeeds immediately
        const dummyPdf = new Blob(["%PDF-1.4 Mock Candidate Portfolio Report"], { type: "application/pdf" });
        return { data: dummyPdf };
      }
      if (url.includes("/portfolios/skills/") && url.includes("/override")) {
        const body = JSON.parse(error.config.data || "{}");
        const skillId = Number(url.match(/\/skills\/(\d+)\/override/)?.[1] || 1);
        return {
          data: {
            override: {
              id: Date.now(),
              portfolio_skill_id: skillId,
              override_level: body.override_level,
              assessor_notes: body.assessor_notes,
              created_at: new Date().toISOString()
            }
          }
        };
      }
      if (url.includes("/sessions/") && url.includes("/transcript")) {
        const sMatch = url.match(/\/sessions\/(\d+)\/transcript/);
        const sId = sMatch ? Number(sMatch[1]) : 1;
        const targetSession = MOCK_SESSIONS.find((s) => s.id === sId);
        const candidateDisplayName = targetSession?.candidate_name || "Budi Santoso";

        // Dialog transkrip berbeda sesuai performa masing-masing kandidat
        if (sId === 3) {
          // Fadhil Farhan (Failed)
          return {
            data: {
              turns: [
                {
                  id: 1,
                  session_id: sId,
                  turn_number: 1,
                  speaker: "ai",
                  text: `Halo ${candidateDisplayName}, selamat datang. Boleh jelaskan bagaimana React menangani component lifecycle dan kapan waktu yang tepat menggunakan useEffect?`,
                  audio_start_ms: 0,
                  audio_end_ms: 6000,
                  created_at: "2026-10-27T14:15:10Z"
                },
                {
                  id: 2,
                  session_id: sId,
                  turn_number: 2,
                  speaker: "candidate",
                  text: `Halo... untuk useEffect saya biasanya pakai untuk panggil API saja. Kalau lifecycle saya kurang mendalami detail mounting atau unmounting-nya.`,
                  audio_start_ms: 7000,
                  audio_end_ms: 15000,
                  created_at: "2026-10-27T14:15:25Z"
                },
                {
                  id: 3,
                  session_id: sId,
                  turn_number: 3,
                  speaker: "ai",
                  text: `Baik. Lalu bagaimana pendekatan Anda dalam mengatur responsivitas layout menggunakan media queries atau CSS framework?`,
                  audio_start_ms: 16000,
                  audio_end_ms: 22000,
                  created_at: "2026-10-27T14:15:45Z"
                },
                {
                  id: 4,
                  session_id: sId,
                  turn_number: 4,
                  speaker: "candidate",
                  text: `Saya biasanya pakai pixel fixed width, belum terbiasa mengatur grid atau breakpoint yang dinamis untuk perangkat mobile.`,
                  audio_start_ms: 23000,
                  audio_end_ms: 31000,
                  created_at: "2026-10-27T14:16:05Z"
                }
              ]
            }
          };
        }

        if (sId === 2) {
          // Ahmad Fauzi (Needs Review)
          return {
            data: {
              turns: [
                {
                  id: 1,
                  session_id: sId,
                  turn_number: 1,
                  speaker: "ai",
                  text: `Halo ${candidateDisplayName}. Boleh ceritakan bagaimana pengalaman Anda mengelola state asynchronous di React?`,
                  audio_start_ms: 0,
                  audio_end_ms: 5000,
                  created_at: "2026-10-27T11:30:10Z"
                },
                {
                  id: 2,
                  session_id: sId,
                  turn_number: 2,
                  speaker: "candidate",
                  text: `Halo. Saya sering memakai useState digabung useEffect. Hanya saja terkadang masih ada kendala race condition saat user berpindah tab dengan cepat.`,
                  audio_start_ms: 6000,
                  audio_end_ms: 16000,
                  created_at: "2026-10-27T11:30:25Z"
                },
                {
                  id: 3,
                  session_id: sId,
                  turn_number: 3,
                  speaker: "ai",
                  text: `Apakah Anda sudah pernah menggunakan cleanup function di useEffect atau AbortController untuk membatalkannya?`,
                  audio_start_ms: 17000,
                  audio_end_ms: 23000,
                  created_at: "2026-10-27T11:30:45Z"
                },
                {
                  id: 4,
                  session_id: sId,
                  turn_number: 4,
                  speaker: "candidate",
                  text: `Pernah dengar tentang AbortController tapi belum sempat mengimplementasikannya secara langsung di proyek produksi.`,
                  audio_start_ms: 24000,
                  audio_end_ms: 32000,
                  created_at: "2026-10-27T11:31:05Z"
                }
              ]
            }
          };
        }

        // Budi Santoso (Completed / Strong Pass)
        return {
          data: {
            turns: [
              {
                id: 1,
                session_id: sId,
                turn_number: 1,
                speaker: "ai",
                text: `Halo ${candidateDisplayName}! Boleh ceritakan bagaimana strategi Anda membangun arsitektur antarmuka React yang scalable dan maintainable?`,
                audio_start_ms: 0,
                audio_end_ms: 6000,
                created_at: "2026-10-27T10:00:10Z"
              },
              {
                id: 2,
                session_id: sId,
                turn_number: 2,
                speaker: "candidate",
                text: `Halo! Saya menerapkan prinsip modular component dan atomic design. Logic bisnis saya pisahkan ke dalam custom hooks, sedangkan styling menggunakan design tokens Tailwind CSS agar konsisten dan ramah aksesibilitas.`,
                audio_start_ms: 7000,
                audio_end_ms: 19000,
                created_at: "2026-10-27T10:00:25Z"
              },
              {
                id: 3,
                session_id: sId,
                turn_number: 3,
                speaker: "ai",
                text: `Bagaimana Anda menangani race condition pada asynchronous API fetching?`,
                audio_start_ms: 20000,
                audio_end_ms: 25000,
                created_at: "2026-10-27T10:00:45Z"
              },
              {
                id: 4,
                session_id: sId,
                turn_number: 4,
                speaker: "candidate",
                text: `Saya memanfaatkan AbortController di dalam useEffect cleanup serta mengisolasi server state memakai TanStack Query atau atom state untuk menjamin UI selalu mencerminkan data paling mutakhir.`,
                audio_start_ms: 26000,
                audio_end_ms: 40000,
                created_at: "2026-10-27T10:01:10Z"
              }
            ]
          }
        };
      }
      if (url.includes("/sessions/") && url.includes("/portfolio")) {
        const sMatch = url.match(/\/sessions\/(\d+)\/portfolio/);
        const sId = sMatch ? Number(sMatch[1]) : 1;
        const targetSession = MOCK_SESSIONS.find((s) => s.id === sId);
        const candidateDisplayName = targetSession?.candidate_name || "Budi Santoso";
        const sessionStatus = targetSession?.end_reason || "completed";

        // Variasi profil hasil evaluasi berdasarkan tipe status sesi
        let skillsPayload = [
          {
            id: 1,
            skill_label: "React / Frontend Development Core",
            is_discovered: false,
            ai_level: "L4",
            ai_confidence: "high",
            evidence: [
              "Candidate clearly explained component lifecycle and hooks (useState, useEffect, useMemo).",
              "Demonstrated practical knowledge in isolating UI logic into reusable custom hooks."
            ],
            competency_summary: "Strong hands-on competency in modern React and modular state architecture."
          },
          {
            id: 2,
            skill_label: "UI/UX & Design Systems",
            is_discovered: false,
            ai_level: "L3",
            ai_confidence: "high",
            evidence: [
              "Discussed responsive layout design and color contrast accessibility (WCAG a11y standards)."
            ],
            competency_summary: "Consistently designs clean interfaces and implements appropriate interaction states."
          },
          {
            id: 3,
            skill_label: "System Design & Architecture",
            is_discovered: false,
            ai_level: null, // Unassessed skill: intentionally null to prevent false L1 penalty
            ai_confidence: "low",
            evidence: [],
            competency_summary: "No evidence observed during the interview session."
          }
        ];

        if (sessionStatus === "error") {
          // Hasil untuk sesi yang gagal (Failed): confidence low agar konsisten dengan evaluasi yang tidak memadai
          skillsPayload = [
            {
              id: 1,
              skill_label: "React / Frontend Development Core",
              is_discovered: false,
              ai_level: "L1",
              ai_confidence: "low",
              evidence: [
                "Candidate struggled to explain state lifting and basic prop drilling resolution.",
                "Unable to identify causes of component re-render loops."
              ],
              competency_summary: "Limited foundational understanding of frontend component lifecycle."
            },
            {
              id: 2,
              skill_label: "UI/UX & Design Systems",
              is_discovered: false,
              ai_level: "L1",
              ai_confidence: "low",
              evidence: [
                "Demonstrated minimal awareness of responsive grid layouts and accessibility guidelines."
              ],
              competency_summary: "Fails to meet basic interface styling and responsive design expectations."
            },
            {
              id: 3,
              skill_label: "System Design & Architecture",
              is_discovered: false,
              ai_level: null,
              ai_confidence: "low",
              evidence: [],
              competency_summary: "No evaluation recorded."
            }
          ];
        } else if (sessionStatus === "needs_review") {
          // Hasil untuk sesi yang butuh tinjauan ulang asesor (Needs Review)
          skillsPayload = [
            {
              id: 1,
              skill_label: "React / Frontend Development Core",
              is_discovered: false,
              ai_level: "L2",
              ai_confidence: "medium",
              evidence: [
                "Candidate understood basic React syntax but gave contradictory explanations regarding useEffect cleanup.",
                "Audio transcription had borderline confidence scores during the async data handling question."
              ],
              competency_summary: "Demonstrates emerging familiarity; manual assessor verification is recommended."
            },
            {
              id: 2,
              skill_label: "UI/UX & Design Systems",
              is_discovered: false,
              ai_level: "L3",
              ai_confidence: "high",
              evidence: [
                "Good grasp of responsive design using modern CSS and Tailwind utility classes."
              ],
              competency_summary: "Meets expected competency level for frontend interface implementation."
            },
            {
              id: 3,
              skill_label: "System Design & Architecture",
              is_discovered: false,
              ai_level: null,
              ai_confidence: "low",
              evidence: [],
              competency_summary: "Skill was not addressed during the session."
            }
          ];
        }

        return {
          data: {
            portfolio: {
              id: sId,
              session_id: sId,
              candidate_name: candidateDisplayName,
              generation_status: "complete",
              overrides: [],
              skills: skillsPayload
            }
          }
        };
      }
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      clearToken();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
