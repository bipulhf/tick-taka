import type { User } from "../db/user-registry";
import type { Env } from "../env";

/**
 * The owner (OWNER_EMAIL) runs the service: pays the AI bill, sees the admin
 * dashboard and its account facts (never anyone's records), and can't be blocked,
 * limited or deleted from it.
 */
export function isOwner(env: Pick<Env, "OWNER_EMAIL">, user: Pick<User, "email">): boolean {
  return !!env.OWNER_EMAIL && user.email.toLowerCase() === env.OWNER_EMAIL;
}
