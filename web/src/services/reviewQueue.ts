import api from "./api";
import type { ReviewGroup, ReviewQueue } from "@/types";

export const reviewQueueApi = {
  list: (params: { reason?: ReviewGroup; page?: number } = {}) =>
    api.get<ReviewQueue>("/review_queue", { params }),
};
