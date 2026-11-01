import { useEffect, useRef, useState } from "react";

// Reports once an element has scrolled into view, then stops observing.
// Without IntersectionObserver (old browsers, jsdom) content counts as visible so it is never hidden.
export function useInView<T extends Element>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(() => !("IntersectionObserver" in globalThis));

  useEffect(() => {
    const node = ref.current;
    if (inView || !node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, threshold]);

  return { ref, inView };
}
