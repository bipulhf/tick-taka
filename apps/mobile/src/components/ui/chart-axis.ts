import { useColors } from "@/theme/colors";

/** DESIGN.md: Caption (13) is the smallest text, and chart axes are text too. */
export const CHART_LABEL_SIZE = 13;

/**
 * Axis props shared by every chart: muted Caption-size labels in the app's font,
 * a hairline x axis and no y axis line. Spread into a gifted-charts chart.
 */
export function useChartAxis() {
  const colors = useColors();
  const label = {
    color: colors.muted,
    fontSize: CHART_LABEL_SIZE,
    fontFamily: "Nunito_600SemiBold",
  };
  return {
    yAxisThickness: 0,
    xAxisColor: colors.line,
    rulesColor: colors.line,
    yAxisTextStyle: label,
    xAxisLabelTextStyle: label,
  };
}
