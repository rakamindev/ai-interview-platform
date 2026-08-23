import type { ReactNode } from "react";
import AuthBrandPanel from "./AuthBrandPanel";
import WaveformSignature from "@/shared/components/WaveformSignature";
import { brand } from "@/shared/theme/colors";

interface AuthLayoutProps {
  children: ReactNode;
  tenant?: string;
}

/** Split-screen shell for the login page. Desktop: brand panel +
 *  centered card. Mobile: compact brand strip + full-width card. */
export default function AuthLayout({ children, tenant }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background font-body lg:flex-row">
      <div
        className="flex items-center justify-between px-6 py-4 text-white lg:hidden"
        style={{ backgroundColor: brand.tealDark }}
      >
        <span className="font-display font-semibold">AI Interview</span>
        <WaveformSignature barCount={10} className="h-4" />
      </div>

      <AuthBrandPanel tenant={tenant} />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">{children}</div>
    </div>
  );
}
