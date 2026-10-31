import type { AssistantRating } from "@tick-taka/shared/schemas/ai";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { IconButton } from "@/components/ui/icon-button";
import { inputClass } from "@/components/ui/text-field";

/**
 * Thumbs up or down under a reply kept on the server. Down asks, once, what went
 * wrong in one optional line; sending it (or not) is the user's choice.
 */
export function ReplyFeedback({
  rating,
  onRate,
}: {
  rating: AssistantRating | null;
  onRate: (rating: AssistantRating, comment?: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [comment, setComment] = useState("");
  const close = () => {
    setAsking(false);
    setComment("");
  };
  const send = () => {
    if (comment.trim()) onRate("down", comment.trim().slice(0, 500));
    close();
  };
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="-ml-1.5 flex items-center gap-0.5">
        <IconButton
          icon={ThumbsUp}
          size="sm"
          label="Good reply"
          pressed={rating === "up"}
          onClick={() => {
            close();
            if (rating !== "up") onRate("up");
          }}
        />
        <IconButton
          icon={ThumbsDown}
          size="sm"
          label="Not a good reply"
          pressed={rating === "down"}
          onClick={() => {
            if (rating !== "down") onRate("down");
            setAsking(true);
          }}
        />
        {rating && !asking ? (
          <span className="px-1.5 text-caption font-normal text-muted">Thanks for saying</span>
        ) : null}
      </div>
      {asking ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <input
            // biome-ignore lint/a11y/noAutofocus: opened by the click just made, to type into.
            autoFocus
            value={comment}
            maxLength={500}
            onChange={(event) => setComment(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
            }}
            placeholder="What went wrong? (optional)"
            aria-label="What went wrong? (optional)"
            className={cx(inputClass, "h-8 min-w-0 flex-1 text-callout")}
          />
          <Button size="sm" type="submit" disabled={!comment.trim()}>
            Send
          </Button>
          <Button size="sm" variant="ghost" onClick={close}>
            Skip
          </Button>
        </form>
      ) : null}
    </div>
  );
}
