import WaveformSignature from "@/shared/components/WaveformSignature";
import { brand } from "@/shared/theme/colors";
import { AUTH_COPY } from "@/utils/constants";

interface AuthBrandPanelProps {
  tenant?: string;
}

/** Desktop-only brand panel (left side of AuthLayout, ≥lg). */
export default function AuthBrandPanel({ tenant }: AuthBrandPanelProps) {
  return (
    <div
      className="hidden lg:flex lg:w-[42%] flex-col justify-between px-12 py-14 text-white"
      style={{ backgroundColor: brand.tealDark }}
    >
      <span className="font-display text-2xl font-semibold tracking-tight">AI Interview</span>

      <div className="space-y-8">
        <p className="font-display max-w-sm text-3xl font-medium leading-snug">
          {AUTH_COPY.brandTagline}
        </p>
        <WaveformSignature />
      </div>

      <div className="font-data text-xs tracking-wide text-white/60">
        {tenant ? `tenant: ${tenant}` : " "}
      </div>
    </div>
  );
}
