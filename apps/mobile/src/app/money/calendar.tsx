import { Redirect } from "expo-router";

/** The spending calendar is Transactions' month view now; old links still land there. */
export default function Route() {
  return <Redirect href="/money/transactions?view=month" />;
}
