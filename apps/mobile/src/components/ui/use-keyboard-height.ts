import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

/**
 * Height of the on-screen keyboard. With Android edge-to-edge the window doesn't
 * resize for it, so screens and sheets pad for it themselves.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
