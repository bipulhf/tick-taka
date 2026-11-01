import {
  registerWidgetConfigurationScreen,
  registerWidgetTaskHandler,
} from "react-native-android-widget";
import { WidgetConfigScreen } from "./src/features/widget/widget-config-screen";
import { widgetTaskHandler } from "./src/features/widget/widget-task-handler";

// The home-screen widgets run headless JS, so their handler registers before the app,
// with the screen that picks a widget's look when it is added or reconfigured.
registerWidgetTaskHandler(widgetTaskHandler);
registerWidgetConfigurationScreen(WidgetConfigScreen);

// Android can start the bundle just to refresh reminders; the task must exist by then.
import "./src/features/notifications/background-reminders";

import "expo-router/entry";
