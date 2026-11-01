import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { WandSparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { Tiki } from "@/components/tiki/tiki";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { api, unwrap } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { formatLocalDate } from "@/lib/format";
import { useAiStatus, useAreas, useCategories } from "@/lib/queries";
import { notify } from "@/lib/toast";
import { fire } from "@/lib/write";
import { useWeeklyReview } from "./queries";
import { StepButtons, Stepper } from "./stepper";
import { HabitsStep, HoursStep, SpendingStep, WinsStep } from "./weekly-steps";

const STEPS = ["Hours", "Spending", "Habits", "Wins", "Next week"] as const;

/** A 5-minute guided Sunday flow. The coach explains numbers; it never calculates them. */
export function WeeklyReview() {
  const navigate = useNavigate();
  const review = useWeeklyReview();
  const ai = useAiStatus();
  const { data: areas = [] } = useAreas();
  const { data: categories = [] } = useCategories();
  const [step, setStep] = useState(0);
  const onStep = useCallback((next: number) => setStep(next), []);
  const [focus, setFocus] = useState("");
  const coach = useMutation({
    mutationFn: () => unwrap(api.ai["weekly-review"].$post({ json: {} })),
    onError: (e) => notify(friendlyError(e)),
  });
  const data = review.data;
  if (!data)
    return (
      <div className="flex flex-col gap-7">
        <PageHeader title="Weekly review" />
        {review.isError ? (
          <ErrorState onRetry={() => void review.refetch()} />
        ) : (
          <div role="status" aria-label="Loading" className="flex flex-col gap-4">
            <Skeleton className="h-7 w-40" />
            <SkeletonRows rows={4} />
          </div>
        )}
      </div>
    );

  const coachOn = Boolean(ai.data?.configured && ai.data.features.weeklyReview);
  const finish = () => {
    if (focus.trim())
      fire({
        method: "PATCH",
        path: "/settings",
        body: { weeklyFocus: focus.trim() },
        label: "Couldn't save next week's focus",
      });
    notify("Week closed. See you next Sunday.");
    void navigate({ to: "/review" });
  };

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Weekly review" subtitle={`Week of ${formatLocalDate(data.weekStart)}`} />
      <Stepper
        steps={STEPS.map((label) => ({ label }))}
        step={step}
        onStep={onStep}
        label="Weekly review steps"
        footer={
          <StepButtons
            step={step}
            count={STEPS.length}
            onStep={onStep}
            finish={
              <Button variant="primary" onClick={finish}>
                Finish
              </Button>
            }
          />
        }
      >
        {step === 0 ? <HoursStep data={data} areas={areas} /> : null}
        {step === 1 ? <SpendingStep data={data} categories={categories} /> : null}
        {step === 2 ? <HabitsStep data={data} /> : null}
        {step === 3 ? <WinsStep data={data} /> : null}
        {step === 4 ? (
          <div className="flex flex-col gap-5">
            <TextField
              label="Next week's focus"
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") finish();
              }}
              placeholder={data.focus ?? "Finish the paper draft"}
              className="max-w-xl"
            />
            {coachOn ? (
              <Button
                icon={WandSparkles}
                className="self-start"
                loading={coach.isPending}
                onClick={() => coach.mutate()}
              >
                Ask the coach
              </Button>
            ) : ai.data ? (
              <p className="max-w-xl text-callout text-muted">
                The AI coach isn't set up on this server, so this week's review is your own numbers,
                step by step.
              </p>
            ) : null}
            {coach.data ? (
              <div className="flex max-w-xl flex-col gap-2 rounded-2xl bg-card p-5">
                <ul className="flex flex-col gap-1">
                  {coach.data.observations.map((line) => (
                    <li key={line} className="text-body">
                      • {line}
                    </li>
                  ))}
                </ul>
                <p className="text-body font-bold">{coach.data.suggestion}</p>
              </div>
            ) : null}
            <Tiki mood="proud" size={64} />
          </div>
        ) : null}
      </Stepper>
    </div>
  );
}
