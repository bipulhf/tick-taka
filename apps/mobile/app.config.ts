import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * app.json holds the config; this only decides what depends on the build.
 * Cleartext HTTP (for http://10.0.2.2:3000) is allowed in local development and
 * the `development` EAS profile; preview and production APKs speak HTTPS only,
 * and refuse to build without an https:// API address.
 */
const profile = process.env.EAS_BUILD_PROFILE || undefined;
const isRelease = profile !== undefined && profile !== "development";

type PluginEntry = NonNullable<ExpoConfig["plugins"]>[number];

const withCleartext = (plugin: PluginEntry): PluginEntry => {
  if (!Array.isArray(plugin) || plugin[0] !== "expo-build-properties") return plugin;
  const options = (plugin[1] ?? {}) as { android?: Record<string, unknown> };
  return [
    "expo-build-properties",
    { ...options, android: { ...options.android, usesCleartextTraffic: !isRelease } },
  ];
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (isRelease && !apiUrl?.startsWith("https://"))
    throw new Error(`EXPO_PUBLIC_API_URL must be an https:// address for the ${profile} build`);
  return {
    ...config,
    name: config.name ?? "Tick & Taka",
    slug: config.slug ?? "tick-taka",
    plugins: (config.plugins ?? []).map(withCleartext),
  };
};
