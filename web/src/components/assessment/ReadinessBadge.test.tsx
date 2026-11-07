import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReadinessBadge, describeReadiness } from "./ReadinessBadge";
import type { ReadinessCheckRecord } from "@/types";

const base: ReadinessCheckRecord = {
    verdict: "pass",
    download_mbps: 78.5,
    upload_mbps: 31.7,
    latency_ms: 11,
    checks: { browser: "passed", network: "passed", microphone: "passed", audio_output: "passed" },
    browser: "Chrome 142",
    os: "Windows",
    attempts: 1,
    checked_at: "2026-11-07T04:20:00Z",
};

describe("ReadinessBadge", () => {
    it("renders nothing for sessions recorded before readiness checks existed", () => {
        const { container } = render(<ReadinessBadge readiness={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("flags a weak connection with its numbers and the number of attempts", () => {
        render(<ReadinessBadge readiness={{ ...base, verdict: "warn", download_mbps: 12.22, upload_mbps: 0.4, latency_ms: 393, attempts: 3 }} />);

        expect(screen.getByText("Weak connection")).toBeInTheDocument();
        expect(screen.getByText("↓12.2 ↑0.40 Mbps · 393 ms · 3 attempts")).toBeInTheDocument();
    });

    it("names the checks that blocked the candidate", () => {
        const blocked = { ...base, verdict: "fail" as const, checks: { ...base.checks, network: "failed" as const, microphone: "failed" as const } };
        expect(describeReadiness(blocked).label).toBe("Blocked at device check: internet, microphone");
    });

    it("shows unmeasured values as unknown rather than zero", () => {
        const { detail } = describeReadiness({ ...base, verdict: "warn", upload_mbps: null, latency_ms: null });
        expect(detail).toBe("↓78.5 ↑? Mbps");
    });
});
