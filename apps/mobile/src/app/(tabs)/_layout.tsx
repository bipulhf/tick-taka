import { Tabs } from "expo-router/js-tabs";
import { View } from "react-native";
import { TabBar } from "@/components/navigation/tab-bar";
import { AssistantButton } from "@/features/assistant/assistant-button";

export default function TabsLayout() {
  return (
    <View className="flex-1">
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="plan" />
        <Tabs.Screen name="money" />
        <Tabs.Screen name="review" />
      </Tabs>
      <AssistantButton />
    </View>
  );
}
