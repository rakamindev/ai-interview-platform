import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useInView } from "@/hooks/useInView";

function Probe() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return <div ref={ref} data-testid="probe" data-in-view={String(inView)} />;
}

describe("useInView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats content as visible when IntersectionObserver is unavailable", () => {
    render(<Probe />);

    expect(screen.getByTestId("probe")).toHaveAttribute("data-in-view", "true");
  });

  it("flips to visible once the element intersects, then stops observing", () => {
    let notify: IntersectionObserverCallback = () => {};
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          notify = callback;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
    const intersect = (isIntersecting: boolean) =>
      act(() => {
        notify([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
      });

    render(<Probe />);
    const probe = screen.getByTestId("probe");
    expect(observe).toHaveBeenCalledWith(probe);
    expect(probe).toHaveAttribute("data-in-view", "false");

    intersect(false);
    expect(probe).toHaveAttribute("data-in-view", "false");

    intersect(true);
    expect(probe).toHaveAttribute("data-in-view", "true");
    expect(disconnect).toHaveBeenCalled();
  });
});
