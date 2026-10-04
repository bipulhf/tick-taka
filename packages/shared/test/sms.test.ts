import { describe, expect, test } from "bun:test";
import {
  buildTemplate,
  buildTemplates,
  detectDirection,
  genericParse,
  isAllowedSender,
  isBlockedMessage,
  maskSms,
  parseWithTemplates,
  smsFingerprint,
} from "../src/sms";

const BKASH_RECEIVED =
  "You have received Tk 500.00 from 01712345678. Fee Tk 0.00. Balance Tk 1,234.50. TrxID 9JK3L2M1N0 at 04/10/2026 14:22";
const BKASH_PAYMENT =
  "Payment Tk 250.00 to Chaldal Limited successful. Fee Tk 0.00. Balance Tk 984.50. TrxID AB12CD34EF at 04/10/2026 15:01";
const BKASH_CASHOUT =
  "Cash Out Tk 1,000.00 to 01812345678 successful. Fee Tk 18.50. Balance Tk 216.00. TrxID ZX98YU76TR at 05/10/2026 10:15";
const BANK_DEBIT =
  "Your A/C ***1234 has been debited by BDT 2,500.00 on 04-Oct-2026. Avl Bal BDT 10,000.00";

describe("filters", () => {
  test("blocks OTP, code and PIN messages", () => {
    expect(isBlockedMessage("Your bKash verification code is 123456")).toBe(true);
    expect(isBlockedMessage("Use OTP 4455 to login")).toBe(true);
    expect(isBlockedMessage("Never share your PIN")).toBe(true);
    expect(isBlockedMessage(BKASH_RECEIVED)).toBe(false);
  });
  test("allowed senders are matched loosely", () => {
    expect(isAllowedSender("bKash", ["BKASH"])).toBe(true);
    expect(isAllowedSender("NAGAD", ["bKash"])).toBe(false);
  });
  test("direction from wording", () => {
    expect(detectDirection(BKASH_RECEIVED)).toBe("in");
    expect(detectDirection(BKASH_PAYMENT)).toBe("out");
    expect(detectDirection(BKASH_CASHOUT)).toBe("cash_out");
    expect(detectDirection(BANK_DEBIT)).toBe("out");
  });
});

describe("generic parse", () => {
  test("extracts amount, fee, balance, ref and party", () => {
    expect(genericParse(BKASH_CASHOUT)).toEqual({
      amountMinor: 100_000,
      direction: "cash_out",
      feeMinor: 1_850,
      balanceAfterMinor: 21_600,
      transactionRef: "ZX98YU76TR",
      counterparty: "01812345678",
    });
    expect(genericParse(BANK_DEBIT)).toMatchObject({
      amountMinor: 250_000,
      balanceAfterMinor: 1_000_000,
    });
  });
});

describe("templates", () => {
  test("a template built from one sample parses a new message of the same shape", () => {
    const template = buildTemplate(BKASH_PAYMENT);
    expect(template).not.toBeNull();
    const parsed = parseWithTemplates(
      "Payment Tk 1,120.00 to Shwapno Outlet successful. Fee Tk 0.00. Balance Tk 3,870.00. TrxID QQ11WW22EE at 06/10/2026 19:45",
      [template!],
    );
    expect(parsed).toEqual({
      amountMinor: 112_000,
      direction: "out",
      feeMinor: 0,
      balanceAfterMinor: 387_000,
      transactionRef: "QQ11WW22EE",
      counterparty: "Shwapno Outlet",
    });
  });

  test("templates per message type", () => {
    const templates = buildTemplates([BKASH_RECEIVED, BKASH_PAYMENT, BKASH_CASHOUT, BKASH_PAYMENT]);
    expect(templates).toHaveLength(3);
    const received = parseWithTemplates(
      "You have received Tk 2,000.00 from 01911111111. Fee Tk 0.00. Balance Tk 5,000.00. TrxID LL22MM33NN at 07/10/2026 08:00",
      templates,
    );
    expect(received).toMatchObject({
      direction: "in",
      amountMinor: 200_000,
      counterparty: "01911111111",
    });
  });

  test("unmatched messages return null so they can go to the AI fallback", () => {
    const templates = buildTemplates([BKASH_PAYMENT]);
    expect(parseWithTemplates("Totally different message Tk 50", templates)).toBeNull();
  });
});

describe("privacy and dedupe", () => {
  test("masks phones, accounts and names", () => {
    const masked = maskSms(`${BKASH_RECEIVED} from Rahim Uddin`);
    expect(masked).not.toContain("01712345678");
    expect(masked).not.toContain("Rahim");
    expect(masked).toContain("Tk 500.00");
    expect(maskSms(BANK_DEBIT)).not.toContain("1234 ");
  });

  test("fingerprints by transaction ID, else sender + minute + amount", () => {
    const a = smsFingerprint({
      sender: "bKash",
      receivedAt: 1_000_000,
      amountMinor: 500,
      transactionRef: "abc123",
    });
    expect(a).toBe("bkash:ref:ABC123");
    const b = smsFingerprint({
      sender: "City Bank",
      receivedAt: 120_000,
      amountMinor: 500,
      transactionRef: null,
    });
    const c = smsFingerprint({
      sender: "City Bank",
      receivedAt: 150_000,
      amountMinor: 500,
      transactionRef: null,
    });
    expect(b).toBe(c);
    expect(b).not.toBe(
      smsFingerprint({
        sender: "City Bank",
        receivedAt: 120_000,
        amountMinor: 600,
        transactionRef: null,
      }),
    );
  });
});
