import { apiErrorFrom } from "@/lib/api";
import { apiUrl, request } from "@/lib/http";

export type ReceiptType = "image/jpeg" | "image/png" | "image/webp";
const TYPES: ReceiptType[] = ["image/jpeg", "image/png", "image/webp"];

/** Large photos are shrunk before upload, as the phone does (quality 0.5 there). */
const SHRINK_OVER_BYTES = 1_500_000;
const MAX_SIDE = 2000;

export interface ReceiptImage {
  blob: Blob;
  mimeType: ReceiptType;
}

export const isReceiptType = (type: string): type is ReceiptType =>
  TYPES.includes(type as ReceiptType);

/** The first image among pasted or dropped files, if any. */
export function firstImage(files: FileList | null | undefined): File | null {
  for (const file of files ?? []) if (file.type.startsWith("image/")) return file;
  return null;
}

/** A receipt ready to send: big photos become a smaller JPEG; others go as they are. */
export async function prepareReceipt(file: File): Promise<ReceiptImage> {
  const mimeType = file.type as ReceiptType;
  if (file.size <= SHRINK_OVER_BYTES) return { blob: file, mimeType };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.7),
    );
    return blob ? { blob, mimeType: "image/jpeg" } : { blob: file, mimeType };
  } catch {
    return { blob: file, mimeType };
  }
}

/** Uploads to the server's uploads folder; returns the stored file name. */
export async function uploadReceipt(image: ReceiptImage): Promise<string> {
  const form = new FormData();
  form.append("file", image.blob, `receipt.${image.mimeType.split("/")[1]}`);
  const response = await request(apiUrl("/uploads"), {
    method: "POST",
    body: form,
    timeout: 60_000,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw apiErrorFrom(response.status, body);
  return (body as { path: string }).path;
}

/** The image as base64 (no data: prefix), for the AI receipt read. */
export async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
