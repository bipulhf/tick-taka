import type { ReactNode } from "react";
import { ErrorState } from "./empty-state";

interface QueryLike<T> {
  data: T | undefined;
  isError: boolean;
  refetch: () => unknown;
}

/**
 * The one way screens show data: a skeleton shaped like the content while it
 * first loads, a retry if it failed with nothing cached, the empty state when
 * there is nothing yet, and the content otherwise.
 */
export function AsyncContent<T>({
  query,
  skeleton,
  isEmpty,
  empty,
  children,
}: {
  query: QueryLike<T>;
  skeleton: ReactNode;
  isEmpty?: (data: NonNullable<T>) => boolean;
  empty?: ReactNode;
  children: (data: NonNullable<T>) => ReactNode;
}) {
  const { data } = query;
  if (data === undefined || data === null) {
    return query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : skeleton;
  }
  if (empty !== undefined && isEmpty?.(data as NonNullable<T>)) return empty;
  return children(data as NonNullable<T>);
}
