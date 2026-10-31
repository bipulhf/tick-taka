import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Group, Row, RowMark } from "@/components/ui/group";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { formatWhen } from "@/lib/format";
import { useUserTime } from "@/lib/use-today";
import { useAdminFeedback } from "./queries";
import { Stat } from "./stat";

/** Thumbs up and down on Tiki's replies this month, and the latest comments with who wrote them. */
export function FeedbackSection({ month }: { month: string }) {
  const { data, isError } = useAdminFeedback(month);
  const { timeZone } = useUserTime();
  return (
    <Section title="Feedback on Tiki's replies">
      {!data ? (
        isError ? (
          <p className="text-callout text-muted">Couldn't load the feedback.</p>
        ) : (
          <Skeleton className="h-24 rounded-2xl" />
        )
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Thumbs up" value={data.up} />
            <Stat label="Thumbs down" value={data.down} />
          </div>
          {data.comments.length ? (
            <Group as="ul" label="Latest comments">
              {data.comments.map((comment) => (
                <Row
                  key={`${comment.email}-${comment.createdAt}`}
                  as="li"
                  leading={
                    <RowMark icon={comment.rating === "up" ? ThumbsUp : ThumbsDown} size="sm" />
                  }
                  title={
                    <span className="whitespace-normal font-normal">
                      <span className="sr-only">
                        {comment.rating === "up" ? "Thumbs up: " : "Thumbs down: "}
                      </span>
                      {comment.comment}
                    </span>
                  }
                  subtitle={`${comment.email ?? "A deleted account"} · ${formatWhen(comment.createdAt, true, Date.now(), timeZone)}`}
                />
              ))}
            </Group>
          ) : (
            <p className="text-callout text-muted">No comments this month.</p>
          )}
        </div>
      )}
    </Section>
  );
}
