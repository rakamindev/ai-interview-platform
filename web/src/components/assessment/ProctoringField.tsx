import { forwardRef, type InputHTMLAttributes } from "react";

/** The assessment's proctoring switch, for react-hook-form's register(). */
const ProctoringField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  <div className="flex items-start gap-3 rounded-lg border p-4">
    <input
      ref={ref}
      id="proctoring_required"
      type="checkbox"
      className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
      {...props}
    />
    <label htmlFor="proctoring_required" className="space-y-1">
      <span className="block text-sm font-medium">Require camera and full-screen sharing</span>
      <span className="block text-xs text-muted-foreground">
        The candidate keeps their camera on and shares their entire screen for the whole interview. The interview
        checks both stay on; nothing is recorded. Candidates need Chrome on a computer, so phones can't take it.
      </span>
    </label>
  </div>
));
ProctoringField.displayName = "ProctoringField";

export default ProctoringField;
