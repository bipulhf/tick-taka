import { registerWidgetTaskHandler } from "react-native-android-widget";
import { widgetTaskHandler } from "./src/features/widget/widget-task-handler";

// The home-screen widget runs headless JS, so its handler registers before the app.
registerWidgetTaskHandler(widgetTaskHandler);

// Android can start the bundle just to refresh reminders; the task must exist by then.
import "./src/features/notifications/background-reminders";

import "expo-router/entry";
