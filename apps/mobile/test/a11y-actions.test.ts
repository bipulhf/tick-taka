import { describe, expect, mock, test } from "bun:test";
import { a11yActionProps, choiceA11y, swipeRowActions } from "../src/components/ui/a11y-actions";

const pick = (props: ReturnType<typeof a11yActionProps>, actionName: string) =>
  props.onAccessibilityAction({ nativeEvent: { actionName } });

describe("gesture actions for screen readers", () => {
  test("a swipe row offers the right swipe first, then the tray", () => {
    const complete = mock();
    const snooze = mock();
    const remove = mock();
    const props = a11yActionProps(
      swipeRowActions({ label: "Complete", onTrigger: complete }, [
        { label: "Snooze", onPress: snooze },
        { label: "Delete", onPress: remove },
      ]),
    );
    expect(props.accessibilityActions).toEqual([
      { name: "Complete", label: "Complete" },
      { name: "Snooze", label: "Snooze" },
      { name: "Delete", label: "Delete" },
    ]);
    pick(props, "Complete");
    pick(props, "Delete");
    expect(complete).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(snooze).not.toHaveBeenCalled();
  });

  test("a row without a right swipe offers only its tray", () => {
    const edit = mock();
    const props = a11yActionProps(swipeRowActions(undefined, [{ label: "Edit", onPress: edit }]));
    expect(props.accessibilityActions.map((a) => a.name)).toEqual(["Edit"]);
    pick(props, "Edit");
    expect(edit).toHaveBeenCalled();
  });

  test("an unknown action does nothing", () => {
    const run = mock();
    expect(() =>
      pick(a11yActionProps([{ label: "Schedule for today", run }]), "activate"),
    ).not.toThrow();
    expect(run).not.toHaveBeenCalled();
  });
});

describe("single-choice controls are read as radios with a checked state", () => {
  test("one of several: radio, checked", () => {
    expect(choiceA11y("single", true)).toEqual({
      accessibilityRole: "radio",
      accessibilityState: { checked: true },
    });
    expect(choiceA11y("single", false).accessibilityState).toEqual({ checked: false });
  });

  test("several at once: checkbox; a view switch: tab; anything else: button", () => {
    expect(choiceA11y("multi", true)).toEqual({
      accessibilityRole: "checkbox",
      accessibilityState: { checked: true },
    });
    expect(choiceA11y("tab", true)).toEqual({
      accessibilityRole: "tab",
      accessibilityState: { selected: true },
    });
    expect(choiceA11y("action", false).accessibilityRole).toBe("button");
  });
});
