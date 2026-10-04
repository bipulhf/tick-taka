import * as ImagePicker from "expo-image-picker";
import { apiUrl } from "./api";
import { tokenStore } from "./auth";

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
    if (!permission.granted) return null;
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
  const response = await fetch(apiUrl("/uploads"), {
    method: "POST",
    headers: { authorization: `Bearer ${tokenStore.get() ?? ""}` },
    body: form,
  });
  if (!response.ok) throw new Error("Couldn't upload the receipt");
  return ((await response.json()) as { path: string }).path;
}

/** Receipt images are served only to signed-in requests. */
export function receiptUrl(path: string): string {
  return `${apiUrl(`/uploads/${path}`)}?token=${encodeURIComponent(tokenStore.get() ?? "")}`;
}
