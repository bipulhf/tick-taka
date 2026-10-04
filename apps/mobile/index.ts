import { registerWidgetTaskHandler } from "react-native-android-widget";
import { widgetTaskHandler } from "./src/features/widget/widget-task-handler";

// The home-screen widget runs headless JS, so its handler registers before the app.
registerWidgetTaskHandler(widgetTaskHandler);

import "expo-router/entry";
