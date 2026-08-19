import { describe, it, expect, vi } from "vite-plus/test";
import { renderHook, act } from "@testing-library/react";
import { useCapsLock } from "./useCapsLock";

function keyEvent(modifierState: boolean) {
  return { getModifierState: () => modifierState } as unknown as React.KeyboardEvent<HTMLElement>;
}

describe("useCapsLock", () => {
  it("tracks CapsLock on key down and up", () => {
    const { result } = renderHook(() => useCapsLock());
    expect(result.current.capsLock).toBe(false);
    act(() => result.current.onKeyDown(keyEvent(true)));
    expect(result.current.capsLock).toBe(true);
    act(() => result.current.onKeyUp(keyEvent(false)));
    expect(result.current.capsLock).toBe(false);
  });

  it("does not call setState when the state is unchanged", () => {
    const { result } = renderHook(() => useCapsLock());
    const spy = vi.spyOn(result.current, "onKeyDown");
    act(() => result.current.onKeyDown(keyEvent(false)));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.capsLock).toBe(false);
  });
});
