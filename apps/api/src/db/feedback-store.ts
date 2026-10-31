import type { Database } from "bun:sqlite";

export type FeedbackRating = "up" | "down";

export type FeedbackStore = ReturnType<typeof createFeedbackStore>;

/**
 * Thumbs up or down on Tiki's replies, in users.db so the owner sees them across
 * every user without opening anyone's database. Only the rating and the user's
 * optional comment; never the reply or the question. One row per reply: rating
 * it again replaces the earlier rating.
 */
export function createFeedbackStore(registry: Database, now: () => number) {
  registry.exec(`CREATE TABLE IF NOT EXISTS ai_feedback (
    user_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
    comment TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, message_id)
  )`);
  registry.exec(
    "CREATE INDEX IF NOT EXISTS ai_feedback_created_at_idx ON ai_feedback (created_at)",
  );
  const put = registry.query(
    `INSERT INTO ai_feedback (user_id, message_id, rating, comment, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT (user_id, message_id) DO UPDATE SET rating = ?3, comment = ?4, created_at = ?5`,
  );
  const counts = registry.query<{ rating: FeedbackRating; n: number }, [number, number]>(
    `SELECT rating, count(*) AS n FROM ai_feedback
     WHERE created_at >= ? AND created_at < ? GROUP BY rating`,
  );
  const comments = registry.query<
    { user_id: string; rating: FeedbackRating; comment: string; created_at: number },
    [number, number, number]
  >(
    `SELECT user_id, rating, comment, created_at FROM ai_feedback
     WHERE created_at >= ? AND created_at < ? AND comment IS NOT NULL AND comment != ''
     ORDER BY created_at DESC LIMIT ?`,
  );
  const removeForUser = registry.query("DELETE FROM ai_feedback WHERE user_id = ?");

  return {
    add(userId: string, messageId: string, rating: FeedbackRating, comment: string | null): void {
      put.run(userId, messageId, rating, comment, now());
    },
    /** Ups, downs and the latest comments between two instants. */
    between(from: number, to: number, limit = 50) {
      const tally = { up: 0, down: 0 };
      for (const row of counts.all(from, to)) tally[row.rating] = row.n;
      return {
        ...tally,
        comments: comments.all(from, to, limit).map((row) => ({
          userId: row.user_id,
          rating: row.rating,
          comment: row.comment,
          createdAt: row.created_at,
        })),
      };
    },
    removeForUser(userId: string): void {
      removeForUser.run(userId);
    },
  };
}
