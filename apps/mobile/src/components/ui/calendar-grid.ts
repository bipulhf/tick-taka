import type { ViewStyle } from "react-native";

/**
 * Style for the Card that holds a 7-column month grid. Seven days at 48 dp need
 * 336 dp; inside the 20 dp screen padding and a card's own padding a 360 dp phone
 * leaves about 43. The grid bleeds 12 dp into the screen padding on each side and
 * has no side padding of its own, so each day is 49 dp wide. A style (not classes)
 * so it reliably wins over the Card's p-5.
 */
export const CALENDAR_GRID: ViewStyle = {
  marginHorizontal: -12,
  paddingLeft: 0,
  paddingRight: 0,
  paddingTop: 8,
  paddingBottom: 8,
};
