import { type RefObject, useEffect, useRef } from "react";
import type { ScrollView, View } from "react-native";

/** Room left above a field brought into view, for its label and the line before it. */
const ABOVE = 72;

/** Keeps a form field in view: `hold` on touching it, `reveal` to scroll to it now. */
export interface FieldScroll {
  hold: (node: View | null) => void;
  reveal: (node: View | null) => void;
}

/**
 * The chat's scrolling: new messages and streamed text keep it at the end, unless
 * the user is filling in one of Tiki's forms. Then the field they touched stays in
 * view as a list or the keypad opens under it, and a text field moves up above the
 * keyboard. The next message lets go of it.
 */
export function useChatScroll(messageCount: number) {
  const scroll = useRef<ScrollView>(null);
  // ScrollView's types want a ref that is never empty; it is set once mounted.
  const inner = useRef<View>(null) as RefObject<View>;
  const held = useRef<View | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new message is the trigger.
  useEffect(() => {
    held.current = null;
  }, [messageCount]);

  const show = (node: View) => {
    const content = inner.current;
    if (!content) return;
    node.measureLayout(
      content,
      (_x, y) => scroll.current?.scrollTo({ y: Math.max(0, y - ABOVE), animated: true }),
      () => {},
    );
  };

  const field: FieldScroll = {
    hold: (node) => {
      held.current = node;
    },
    reveal: (node) => {
      held.current = node;
      if (node) show(node);
    },
  };

  return {
    scroll,
    inner,
    field,
    onContentSizeChange: () => {
      if (held.current) show(held.current);
      else scroll.current?.scrollToEnd({ animated: true });
    },
  };
}
