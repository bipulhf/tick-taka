import { Tabs } from "expo-router/js-tabs";
import { TabBar } from "@/components/navigation/tab-bar";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="plan" />
      <Tabs.Screen name="money" />
      <Tabs.Screen name="review" />
    </Tabs>
  );
}
