/**
 * What stays in the widget's offline list after the app handed some of it to the
 * outbox: everything it didn't send, including taps that landed on the widget while
 * the hand-over ran. Pure, so it can be tested.
 */
export function afterHandOver<T>(stored: T[], sent: T[], key: (item: T) => string): T[] {
  const gone = new Set(sent.map(key));
  return stored.filter((item) => !gone.has(key(item)));
}
