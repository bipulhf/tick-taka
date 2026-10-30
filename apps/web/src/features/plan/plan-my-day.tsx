import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { useAiStatus } from "@/lib/queries";
import { notify, notifyError } from "@/lib/toast";
import { fire } from "@/lib/write";

const requestPlan = (date: string) => unwrap(api.ai["plan-day"].$post({ json: { date } }));
type Plan = Awaited<ReturnType<typeof requestPlan>>;

/** Why "Plan my day" can't run here, in one calm line; null when it can. */
function unavailableReason(ai: ReturnType<typeof useAiStatus>["data"]): string | null {
  if (!ai) return null;
  if (!ai.configured)
    return "Plan my day uses AI, which isn't set up yet. Drag tasks onto the hours instead.";
  if (!ai.features.planDay) return "Plan my day is switched off in Settings › AI.";
  if (ai.capReached) return "This month's AI limit is used up. It resets on the 1st.";
  return null;
}

/** "Plan my day": AI proposes time blocks for the day's tasks; nothing changes until Apply. */
export function PlanMyDay({ date }: { date: string }) {
  const ai = useAiStatus();
  const [proposal, setProposal] = useState<Plan | null>(null);
  const plan = useMutation({
    mutationFn: () => requestPlan(date),
    onSuccess: setProposal,
    onError: (error) => notifyError(friendlyError(error)),
  });
  if (!ai.data) return null;
  const reason = unavailableReason(ai.data);
  if (reason)
    return (
      <p className="flex items-center gap-2 px-1 text-callout text-muted">
        <Sparkles aria-hidden className="size-4 shrink-0" />
        {reason}
      </p>
    );

  const apply = () => {
    if (!proposal) return;
    for (const block of proposal.blocks) {
      if (!block.taskId) continue;
      fire({
        method: "PATCH",
        path: `/tasks/${block.taskId}`,
        body: {
          doAt: block.startAt,
          hasTime: true,
          reminderAt: block.startAt,
          estimateMin: Math.round((block.endAt - block.startAt) / 60_000),
          status: "open",
        },
        label: "Couldn't apply the plan",
      });
    }
    setProposal(null);
    notify("Plan applied. Drag anything around.");
  };

  if (!proposal)
    return (
      <Button
        icon={Sparkles}
        loading={plan.isPending}
        onClick={() => plan.mutate()}
        className="self-start"
      >
        Plan my day
      </Button>
    );
  return (
    <section aria-label="Proposed plan" className="flex flex-col gap-3 rounded-2xl bg-card p-4">
      <p className="text-body font-bold">✨ {proposal.note}</p>
      <ul className="flex flex-col gap-1">
        {proposal.blocks.map((block) => (
          <li key={`${block.start}-${block.title}`} className="text-callout tabular">
            <span className="text-sky-text">
              {block.start}–{block.end}
            </span>{" "}
            · {block.title}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>
          Not now
        </Button>
        <Button size="sm" variant="primary" onClick={apply}>
          Apply
        </Button>
      </div>
    </section>
  );
}
