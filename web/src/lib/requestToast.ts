import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/httpError";

export function showRequestError(error: unknown, fallback: string) {
  toast.error(apiErrorMessage(error, fallback));
}

export function showRequestSuccess(message: string) {
  toast.success(message);
}
