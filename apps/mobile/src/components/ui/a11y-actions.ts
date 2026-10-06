/** A gesture's outcome offered in the screen reader's actions menu. */
export interface A11yAction {
  label: string;
  run: () => void;
}

/**
 * Props for a focusable element that exposes gesture-only actions (swipe, drag) to
 * screen readers: the action list and a handler that runs the one picked.
 */
export function a11yActionProps(actions: A11yAction[]) {
  return {
    accessibilityActions: actions.map(({ label }) => ({ name: label, label })),
    onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) =>
      actions.find((action) => action.label === event.nativeEvent.actionName)?.run(),
  };
}

/** A swipe row's actions for screen readers: the right swipe first, then the tray. */
export function swipeRowActions(
  right: { label: string; onTrigger: () => void } | undefined,
  tray: { label: string; onPress: () => void }[],
): A11yAction[] {
  return [
    ...(right ? [{ label: right.label, run: right.onTrigger }] : []),
    ...tray.map((action) => ({ label: action.label, run: action.onPress })),
  ];
}

/**
 * How a selectable option is announced. A one-off action is a button; one choice of
 * several is a radio and multi-select a checkbox, both read as checked or not; a tab
 * that switches the view below is read as selected.
 */
export function choiceA11y(kind: "action" | "single" | "multi" | "tab", on: boolean) {
  switch (kind) {
    case "single":
      return { accessibilityRole: "radio" as const, accessibilityState: { checked: on } };
    case "multi":
      return { accessibilityRole: "checkbox" as const, accessibilityState: { checked: on } };
    case "tab":
      return { accessibilityRole: "tab" as const, accessibilityState: { selected: on } };
    default:
      return { accessibilityRole: "button" as const, accessibilityState: { selected: on } };
  }
}
