import * as ImagePicker from "expo-image-picker";
import { Linking } from "react-native";
import { apiUrl, authHeaders, request } from "./http";
import { notify } from "./notify";

export interface PickedImage {
  uri: string;
  base64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

/** Takes a receipt photo (or picks one) as a compressed JPEG with base64 for the AI scan. */
export async function pickReceipt(source: "camera" | "library"): Promise<PickedImage | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: 0.5,
    base64: true,
    allowsEditing: false,
  };
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      // Say so, with a way to fix it, instead of a button that silently does nothing.
      notify("Camera access is off for Tick & Taka.", {
        label: "Open settings",
        onPress: () => void Linking.openSettings(),
      });
      return null;
    }
  }
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset?.base64) return null;
  const mimeType =
    asset.mimeType === "image/png" || asset.mimeType === "image/webp"
      ? asset.mimeType
      : "image/jpeg";
  return { uri: asset.uri, base64: asset.base64, mimeType };
}

/** Uploads to the server's uploads folder; returns the stored file name. */
export async function uploadReceipt(image: PickedImage): Promise<string> {
  const form = new FormData();
  form.append("file", {
    uri: image.uri,
    name: `receipt.${image.mimeType.split("/")[1]}`,
    type: image.mimeType,
  } as unknown as Blob);
  const response = await request(apiUrl("/uploads"), {
    method: "POST",
    body: form,
    timeout: 60_000,
  });
  if (!response.ok) throw new Error("Couldn't upload the receipt");
  return ((await response.json()) as { path: string }).path;
}

/**
 * Receipt images are served only to signed-in requests. The token goes in a header:
 * in the URL it would land in server access logs and in the image cache's keys.
 */
export function receiptSource(path: string): { uri: string; headers: Record<string, string> } {
  return { uri: apiUrl(`/uploads/${path}`), headers: authHeaders() };
}
