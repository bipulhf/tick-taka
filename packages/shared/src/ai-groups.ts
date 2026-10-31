import type { AiFeature, Settings } from "./schemas/settings";

/**
 * Settings shows three AI switches; the server still checks one flag per feature.
 * Each group switch reads and writes the flags of the features in it.
 */
export const AI_GROUPS = [
  {
    id: "chat",
    label: "Chat and voice",
    hint: "Talk or type to Tiki",
    features: ["assistant"],
  },
  {
    id: "capture",
    label: "Smart capture",
    hint: "Quick-add that reads your words, and receipt scan",
    features: ["parse", "receipt"],
  },
  {
    id: "planning",
    label: "Planning and coaching",
    hint: "Plan my day, break it down, weekly coach, budget ideas",
    features: ["planDay", "breakdown", "weeklyReview", "budgetSuggestions"],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  hint: string;
  features: readonly AiFeature[];
}[];
export type AiGroup = (typeof AI_GROUPS)[number]["id"];

type FeatureSwitches = Settings["ai"]["features"];

function featuresOf(group: AiGroup): readonly AiFeature[] {
  return AI_GROUPS.find((g) => g.id === group)?.features ?? [];
}

/** A group is on only when every feature in it is on (a missing flag counts as on). */
export function isAiGroupOn(features: FeatureSwitches, group: AiGroup): boolean {
  return featuresOf(group).every((feature) => features[feature] !== false);
}

/** The feature flags with every feature in `group` set to `on`; other flags are kept. */
export function setAiGroup(
  features: FeatureSwitches,
  group: AiGroup,
  on: boolean,
): FeatureSwitches {
  const next: FeatureSwitches = { ...features };
  for (const feature of featuresOf(group)) next[feature] = on;
  return next;
}
