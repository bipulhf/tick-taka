import * as Haptics from "expo-haptics";

export const haptic = {
  tap: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  success: () =>
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  select: () => void Haptics.selectionAsync().catch(() => {}),
};
