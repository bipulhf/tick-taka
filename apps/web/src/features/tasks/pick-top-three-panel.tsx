import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { Panel } from "@/components/ui/panel";
import { SkeletonRows } from "@/components/ui/skeleton";
import { formatLocalDate } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { notify } from "@/lib/toast";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import type { PanelComponentProps } from "../panel-types";
import { useOpenTasks, useTopThreeCandidates } from "./queries";
import { useTaskActions } from "./use-task-actions";

/**
 * `?panel=top-three:<date>` (or `top-three` for today): pick the three tasks that
 * matter most for a day. Three is small enough to say no to the rest.
 */
export function PickTopThreePanel({ id, onClose }: PanelComponentProps) {
  const today = useTodayDate();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(id) ? id : today;
  const { timeZone } = useUserTime();
  const open = useOpenPanel();
  const actions = useTaskActions();
  const candidates = useTopThreeCandidates(date, timeZone);
  const inbox = useOpenTasks();
  const all = [
    ...new Map([...(candidates.data ?? []), ...(inbox.data ?? [])].map((t) => [t.id, t])).values(),
  ];
  const picked = all.filter((t) => t.top3Date === date);
  const loading = !candidates.data || !inbox.data;
  const failed = candidates.isError || inbox.isError;

  return (
    <Panel
      open
      onClose={onClose}
      title={`Top three for ${formatLocalDate(date)}`}
      footer={
        <Button variant="primary" block onClick={onClose}>
          Done
        </Button>
      }
    >
      {failed && loading ? (
        <ErrorState
          onRetry={() => {
            void candidates.refetch();
            void inbox.refetch();
          }}
        />
      ) : loading ? (
        <div role="status" aria-label="Loading">
          <SkeletonRows rows={4} />
        </div>
      ) : all.length === 0 ? (
        <EmptyState
          title="No open tasks yet"
          message="Your top three come from open tasks. Capture one to get started."
          actionLabel="Add a task"
          onAction={() => open("task:new")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-callout text-muted" aria-live="polite">
            {picked.length}/3 picked
          </p>
          <Group as="ul" label="Open tasks" className="border border-line">
            {all.map((task) => {
              const selected = task.top3Date === date;
              return (
                <li key={task.id}>
                  {/* The whole row is the target: a label passes its clicks to the check. */}
                  {/* biome-ignore lint/a11y/noLabelWithoutControl: the control is the Checkbox button inside */}
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 hover:bg-line/30">
                    <Checkbox
                      checked={selected}
                      label={task.title}
                      onChange={(next) => {
                        if (next && picked.length >= 3) {
                          notify("Top three is full. Swap one out first.");
                          return;
                        }
                        actions.setTopThree(task, next ? date : null);
                      }}
                    />
                    <span className="line-clamp-2 flex-1 text-body">{task.title}</span>
                  </label>
                </li>
              );
            })}
          </Group>
        </div>
      )}
    </Panel>
  );
}
