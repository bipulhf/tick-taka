import { Pencil, Trash2 } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { Row, RowMark } from "@/components/ui/group";
import { ProgressBar } from "@/components/ui/progress";
import { type LineLike, lineLimit, lineProgress } from "./budget-lines";
import { RowMenu } from "./money-ui";

export interface BudgetLineView extends LineLike {
  name: string;
  emoji: string;
  pace: string | null;
}

/**
 * One category's month: spent of its limit (with what rolled over), a bar, and a
 * calm word when it runs ahead or goes over, so colour is never the only cue.
 */
export function BudgetLineRow({
  line,
  onEdit,
  onRemove,
}: {
  line: BudgetLineView;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const over = line.hasBudget && line.availableMinor < 0;
  return (
    <Row
      dataKey={`budget:${line.categoryId}`}
      keyActions={line.hasBudget ? { remove: onRemove } : undefined}
      onClick={onEdit}
      leading={<RowMark emoji={line.emoji} />}
      title={line.name}
      subtitle={
        <span className="flex flex-col gap-1.5 pt-1 whitespace-normal">
          {line.hasBudget ? (
            <ProgressBar
              value={lineProgress(line)}
              // Mango is for the primary action; running ahead is said in words.
              tone={over ? "coral" : "mint"}
              label={`${line.name} spent of its budget`}
            />
          ) : null}
          {over || line.pace === "ahead" || line.carriedMinor > 0 ? (
            <span className="flex flex-wrap gap-x-3 text-caption">
              {over ? (
                <span className="text-coral-text">
                  Over by <Amount minor={-line.availableMinor} animate={false} />
                </span>
              ) : line.pace === "ahead" ? (
                <span className="text-coral-text">Running ahead</span>
              ) : null}
              {line.carriedMinor > 0 ? (
                <span className="text-mint-text">
                  + <Amount minor={line.carriedMinor} animate={false} /> rolled over
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      }
      trailing={
        <>
          {/* One width for every line's figures, so the bars line up. */}
          <span className="min-w-28 text-right text-callout text-muted sm:min-w-40">
            <Amount minor={line.spentMinor} animate={false} className="font-bold text-ink" />
            {line.hasBudget ? (
              <>
                {" / "}
                <Amount minor={lineLimit(line)} animate={false} />
              </>
            ) : null}
          </span>
          <RowMenu
            label={`More for ${line.name}`}
            items={[
              { label: "Edit", icon: Pencil, onSelect: onEdit },
              ...(line.hasBudget
                ? [
                    {
                      label: "Delete",
                      icon: Trash2,
                      onSelect: onRemove,
                      danger: true,
                      shortcut: "Del",
                    },
                  ]
                : []),
            ]}
          />
        </>
      }
    />
  );
}
