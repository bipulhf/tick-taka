import { useQuery } from "@tanstack/react-query";
import { apiErrorFrom } from "@/lib/api";
import { apiUrl, request } from "@/lib/http";

export type ReceiptMime = "image/jpeg" | "image/png" | "image/webp";

const MIME_TYPES: ReceiptMime[] = ["image/jpeg", "image/png", "image/webp"];

/** Whether a picked, dropped or pasted file can be a receipt (the server takes these three). */
export function isReceiptFile(file: File): file is File & { type: ReceiptMime } {
  return (MIME_TYPES as string[]).includes(file.type);
}

/** Uploads to the server's uploads folder; returns the stored file name. */
export async function uploadReceipt(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name || `receipt.${file.type.split("/")[1]}`);
  const response = await request(apiUrl("/uploads"), {
    method: "POST",
    body: form,
    timeout: 60_000,
  });
  if (!response.ok) throw apiErrorFrom(response.status, await response.json().catch(() => null));
  return ((await response.json()) as { path: string }).path;
}

/** The file's bytes as base64, for the AI receipt reader. */
export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * Receipt images are served only to signed-in requests, with the token in a header
 * (in the URL it would land in access logs), so an <img> can't fetch one itself: this
 * loads it once and hands back a blob URL. The query key is outside every write's
 * refresh list, since a stored receipt never changes.
 */
export function useReceiptUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["receipt", path],
    enabled: Boolean(path),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      const response = await request(apiUrl(`/uploads/${path}`));
      if (!response.ok) throw apiErrorFrom(response.status, null);
      return URL.createObjectURL(await response.blob());
    },
  });
}
