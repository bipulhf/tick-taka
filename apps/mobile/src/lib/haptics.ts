import * as Haptics from "expo-haptics";
import { feedbackPrefsStore } from "./feedback-prefs";

const on = () => feedbackPrefsStore.get().haptics;

export const haptic = {
  tap: () => {
    if (on()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  success: () => {
    if (on())
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  select: () => {
    if (on()) void Haptics.selectionAsync().catch(() => {});
  },
  /** A big win: a firm thump, then the success pattern. */
  celebrate: () => {
    if (!on()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setTimeout(
      () =>
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
      180,
    );
  },
};
