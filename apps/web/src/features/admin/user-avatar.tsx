import { cx } from "@/components/ui/cx";

/** A user's Google picture, or their initial on a soft circle. */
export function UserAvatar({
  user,
  size = "md",
}: {
  user: { email: string; name: string | null; pictureUrl: string | null };
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "size-14 text-heading" : "size-9 text-callout";
  return user.pictureUrl ? (
    <img
      src={user.pictureUrl}
      alt=""
      referrerPolicy="no-referrer"
      className={cx("shrink-0 rounded-full", box)}
    />
  ) : (
    <span
      aria-hidden
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full bg-sky/15 font-extrabold text-sky-text",
        box,
      )}
    >
      {(user.name ?? user.email).slice(0, 1).toUpperCase()}
    </span>
  );
}
