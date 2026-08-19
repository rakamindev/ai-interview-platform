import api from "./api";
import type {
  CvScreening,
  CvScreeningBatch,
  CvScreeningEntry,
  PaginationMeta,
} from "@/types";

export interface CvScreeningPayload {
  name: string;
  vacancy_id: number;
  assessment_id: number;
  threshold?: number | null;
}

export const cvScreeningsApi = {
  list: (page = 1) =>
    api.get<{ cv_screenings: CvScreening[]; meta: PaginationMeta }>("/cv_screenings", {
      params: { page },
    }),

  get: (id: number) =>
    api.get<{ cv_screening: CvScreening }>(`/cv_screenings/${id}`),

  create: (data: CvScreeningPayload) =>
    api.post<{ cv_screening: CvScreening }>("/cv_screenings", { cv_screening: data }),

  update: (id: number, data: Partial<CvScreeningPayload>) =>
    api.patch<{ cv_screening: CvScreening }>(`/cv_screenings/${id}`, { cv_screening: data }),

  batches: (id: number) =>
    api.get<{ batches: CvScreeningBatch[] }>(`/cv_screenings/${id}/batches`),

  confirmBatch: (cvScreeningId: number, batchId: number) =>
    api.post<{ batch: CvScreeningBatch }>(
      `/cv_screenings/${cvScreeningId}/batches/${batchId}/confirm`
    ),

  entries: (id: number, decision?: string, page?: number, perPage?: number) =>
    api.get<{ entries: CvScreeningEntry[]; meta: PaginationMeta }>(
      `/cv_screenings/${id}/entries`,
      { params: { decision, page, per_page: perPage } }
    ),

  // FormData upload — src/services/api.ts sets a global Content-Type:
  // application/json on every request, which a multipart upload must override
  // (set to undefined here) so the browser can set its own boundary parameter.
  // A Content-Type explicitly set to "multipart/form-data" without that boundary
  // would be silently wrong and the server couldn't parse the body.
  uploadBatch: (id: number, files: File[], onProgress?: (percent: number) => void) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files[]", file));

    return api.post<{ batch: CvScreeningBatch; entries: CvScreeningEntry[] }>(
      `/cv_screenings/${id}/batches`,
      formData,
      {
        headers: { "Content-Type": undefined },
        onUploadProgress: (event) => {
          if (onProgress && event.total) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
      }
    );
  },

  // email is only required when the entry has no detected_email yet — the API
  // ignores it otherwise. Omitted, it's dropped from the JSON body entirely.
  reviewEntry: (entryId: number, action: "invite" | "reject", email?: string) =>
    api.post<{ entry: CvScreeningEntry }>(`/cv_screening_entries/${entryId}/review`, {
      action,
      email,
    }),

  // Only valid for an entry that failed because the pipeline itself broke
  // (decision_reason: "model_failed") — resets it to pending and re-enqueues
  // the same worker, so the existing polling in CvScreeningDetailPage picks up
  // the eventual re-decision the normal way.
  reanalyzeEntry: (entryId: number) =>
    api.post<{ entry: CvScreeningEntry }>(`/cv_screening_entries/${entryId}/reanalyze`),

  // Only valid while an entry is still "pending" — moves it to needs_review
  // (never a rejection) so a recruiter isn't stuck waiting forever on an entry
  // whose worker never ran (e.g. a Sidekiq outage). Also unblocks the batch's
  // FR5 notification gate for any other entries already decided in the same
  // batch, which a permanently-pending entry would otherwise hold up forever.
  cancelEntry: (entryId: number) =>
    api.post<{ entry: CvScreeningEntry }>(`/cv_screening_entries/${entryId}/cancel`),

  // The file endpoint requires the same Bearer auth as everything else, so it
  // can't be a plain <a href> / window.open — those don't carry the header.
  // Fetch it through the authenticated axios instance instead, and hand back a
  // Blob explicitly typed application/pdf so a blob: URL built from this opens
  // as a rendered PDF (in a new tab, see EntryRow's Preview button) rather than
  // triggering a download or showing blank — axios's responseType: "blob"
  // already returns a correctly-typed Blob, but re-wrapping it as
  // `new Blob([res.data])` with no type argument does not reliably preserve it.
  fetchFileBlob: async (entryId: number) => {
    const res = await api.get(`/cv_screening_entries/${entryId}/file`, {
      responseType: "blob",
    });
    return new Blob([res.data as BlobPart], { type: "application/pdf" });
  },
};
