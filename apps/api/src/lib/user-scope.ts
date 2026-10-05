import { AsyncLocalStorage } from "node:async_hooks";
import type { User, UserData } from "../db/user-registry";

export interface UserScope {
  user: User;
  data: UserData;
}

const storage = new AsyncLocalStorage<UserScope>();

/** Runs `fn` (and everything it awaits) as this user: `deps.db` becomes their database. */
export function runAsUser<T>(scope: UserScope, fn: () => T): T {
  return storage.run(scope, fn);
}

export function currentScope(): UserScope | undefined {
  return storage.getStore();
}
