import { Redirect } from "expo-router";

/** Subscription suggestions moved onto Bills; old links still land there. */
export default function Route() {
  return <Redirect href="/money/bills" />;
}
