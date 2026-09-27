import { CircleX, X } from "lucide-react";

interface FormErrorAlertProps {
    message: string | null;
    onDismiss: () => void;
}

export function FormErrorAlert({ message, onDismiss }: FormErrorAlertProps) {
    if (!message) return null;

    return (
        <div className="fixed inset-x-4 bottom-4 z-50 flex justify-end pointer-events-none sm:inset-x-auto sm:bottom-6 sm:right-6">
            <div
                role="alert"
                className="pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-red-200 border-l-4 border-l-red-600 bg-red-50 p-4 shadow-lg sm:w-96 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200"
            >
                <CircleX className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-800">Couldn't save</p>
                    <p className="mt-0.5 break-words text-sm text-red-700">{message}</p>
                </div>
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dismiss"
                    className="shrink-0 rounded-md p-0.5 text-red-700 transition-colors hover:bg-red-100 hover:text-red-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-600"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}
