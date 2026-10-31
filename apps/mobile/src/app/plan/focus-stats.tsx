import { Redirect } from "expo-router";

/** Focus statistics is Time's Focus only view now; old links still land there. */
export default function Route() {
  return <Redirect href="/plan/time?view=focus" />;
}
