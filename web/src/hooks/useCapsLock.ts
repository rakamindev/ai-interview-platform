import { useState } from "react";

export function useCapsLock() {
  const [capsLock, setCapsLock] = useState(false);

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    setCapsLock(e.getModifierState("CapsLock"));
  };

  const onKeyUp = (e: React.KeyboardEvent<HTMLElement>) => {
    setCapsLock(e.getModifierState("CapsLock"));
  };

  return { capsLock, onKeyDown, onKeyUp };
}
