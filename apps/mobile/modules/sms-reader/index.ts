import { type EventSubscription, requireOptionalNativeModule } from "expo-modules-core";

export interface RawSms {
  id: string;
  sender: string;
  body: string;
  receivedAt: number;
}

interface SmsReaderNative {
  hasPermission(): boolean;
  setAllowedSenders(senders: string[]): void;
  getMessagesSince(timestamp: number, senders: string[]): Promise<RawSms[]>;
  addListener(
    event: "onSmsReceived",
    listener: (sms: Omit<RawSms, "id">) => void,
  ): EventSubscription;
}

/** Null in Expo Go or a build without the module; SMS capture then stays off. */
const native = requireOptionalNativeModule<SmsReaderNative>("SmsReader");

export const isSmsReaderAvailable = native !== null;

export function hasSmsPermission(): boolean {
  return native?.hasPermission() ?? false;
}

export function setAllowedSenders(senders: string[]): void {
  native?.setAllowedSenders(senders);
}

/** Reads content://sms/inbox for allowed senders after `timestamp`. OTP messages never come back. */
export async function getMessagesSince(timestamp: number, senders: string[]): Promise<RawSms[]> {
  if (!native || senders.length === 0) return [];
  return native.getMessagesSince(timestamp, senders);
}

export function onSmsReceived(
  listener: (sms: Omit<RawSms, "id">) => void,
): EventSubscription | null {
  return native?.addListener("onSmsReceived", listener) ?? null;
}
