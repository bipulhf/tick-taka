import { Redirect } from "expo-router";

/** Each area's summary is on its own page now, and Plan's Projects lists the areas. */
export default function Route() {
  return <Redirect href="/plan?tab=projects" />;
}
