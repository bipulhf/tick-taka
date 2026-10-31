import { Redirect } from "expo-router";

/** The payday plan moved into Budgets ("Split my pay"); old links still land there. */
export default function Route() {
  return <Redirect href="/money/budgets?split=1" />;
}
