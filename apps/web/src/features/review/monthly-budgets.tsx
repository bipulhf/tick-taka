import { Amount } from "@/components/ui/amount";
import { EmptyState } from "@/components/ui/empty-state";
import { Group, Row, RowMark } from "@/components/ui/group";
import { ListSection } from "@/components/ui/list-section";
import { ProgressBar } from "@/components/ui/progress";
import { StatusPill } from "@/components/ui/status-pill";
import { byCloseness, type LineLike, lineLimit } from "@/features/money/budget-lines";
import { useOpenPanel } from "@/lib/panel";

interface Line extends LineLike {
  name: string;
  emoji: string;
}

/**
 * Each budgeted category's month as a bar on one shared scale, so categories compare
 * at a glance: the fill is what was spent, the mark is the limit. Over the limit, the
 * fill runs past the mark in coral and a pill says by how much. Closest to the limit
 * first; a row opens the month's budgets.
 */
export function BudgetsVsActual({ lines, month }: { lines: Line[]; month: string }) {
  const openPanel = useOpenPanel();
  const budgeted = byCloseness(lines.filter((l) => l.hasBudget));
  const edit = () => openPanel(`budget:${month}`);
  const scale = Math.max(1, ...budgeted.map((l) => Math.max(l.spentMinor, lineLimit(l))));
  const spent = budgeted.reduce((sum, l) => sum + l.spentMinor, 0);
  const limit = budgeted.reduce((sum, l) => sum + lineLimit(l), 0);

  return (
    <ListSection
      id="monthly-budgets"
      variant="heading"
      align="edge"
      title="Budgets vs actual"
      caption={budgeted.length ? "The mark on each bar is the limit." : undefined}
      total={
        budgeted.length ? (
          <span className="text-muted">
            <Amount minor={spent} animate={false} className="text-ink" /> of{" "}
            <Amount minor={limit} animate={false} />
          </span>
        ) : undefined
      }
    >
      {budgeted.length === 0 ? (
        <EmptyState
          title="No budgets this month"
          message="Set a few limits and this shows how the month went."
          actionLabel="Set budgets"
          onAction={edit}
        />
      ) : (
        <Group>
          {budgeted.map((line) => {
            const cap = lineLimit(line);
            const over = line.spentMinor > cap;
            return (
              <Row
                key={line.categoryId}
                dataKey={`budget:${line.categoryId}`}
                onClick={edit}
                leading={<RowMark emoji={line.emoji} />}
                title={line.name}
                subtitle={
                  <span className="flex flex-col gap-1.5 pt-1 whitespace-normal">
                    <ProgressBar
                      value={line.spentMinor / scale}
                      marker={cap / scale}
                      tone={over ? "coral" : "mint"}
                      label={`${line.name} spent against its limit`}
                    />
                    {over ? (
                      <span className="flex text-caption">
                        <StatusPill status="over">
                          Over by <Amount minor={line.spentMinor - cap} animate={false} />
                        </StatusPill>
                      </span>
                    ) : null}
                  </span>
                }
                trailing={
                  <span className="min-w-28 text-right text-callout text-muted sm:min-w-40">
                    <Amount
                      minor={line.spentMinor}
                      animate={false}
                      className="font-bold text-ink"
                    />
                    {" / "}
                    <Amount minor={cap} animate={false} />
                  </span>
                }
              />
            );
          })}
        </Group>
      )}
    </ListSection>
  );
}
