import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import type {
  ChatFilterCriterion,
  ChatSearchDateOperator,
} from "@/features/chat/model/search";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { DatePickerPopover } from "../date-picker-popover";

interface DateFilterFieldProps {
  criteria: Extract<ChatFilterCriterion, { kind: "date" }>[];
  onChange: (criteria: Extract<ChatFilterCriterion, { kind: "date" }>[]) => void;
}

export function DateFilterField({ criteria, onChange }: DateFilterFieldProps) {
  const update = (
    id: string,
    values: Partial<Extract<ChatFilterCriterion, { kind: "date" }>>
  ) => onChange(criteria.map((criterion) =>
    criterion.id === id ? { ...criterion, ...values } : criterion
  ));

  return (
    <section aria-labelledby="date-filter-label" className="flex flex-col gap-sm">
      <div>
        <h3 id="date-filter-label" className="font-sans text-ui font-semibold text-foreground">Date</h3>
        <p className="text-ui-sm text-muted">When the message was sent</p>
      </div>
      {criteria.map((criterion, index) => (
        <div key={criterion.id} className="flex flex-wrap items-center gap-sm sm:flex-nowrap">
          <label className="sr-only" htmlFor={`${criterion.id}-operator`}>
            Date operator {index + 1}
          </label>
          <select
            id={`${criterion.id}-operator`}
            value={criterion.operator}
            onChange={(event) =>
              update(criterion.id, {
                operator: event.target.value as ChatSearchDateOperator,
                id: `${event.target.value}:${criterion.date}`,
              })
            }
            className="min-h-control w-full rounded-control bg-surface-2 px-sm text-ui-md text-foreground sm:w-filter-operator md:text-ui"
          >
            <option value="before">Before</option>
            <option value="after">After</option>
            <option value="during">During</option>
          </select>
          <DatePickerPopover
            label={`Date ${index + 1}`}
            value={criterion.date}
            onChange={(date) => update(criterion.id, { date, id: `${criterion.operator}:${date}` })}
          />
          <IconButton
            label={`Remove date ${index + 1}`}
            appearance="ghost"
            onClick={() => onChange(criteria.filter((item) => item.id !== criterion.id))}
            icon={<IconTrash size={20} stroke={1.75} aria-hidden="true" />}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        fullWidth
        onClick={() => {
          const date = new Date().toISOString().slice(0, 10);
          onChange([...criteria, { id: `before:${date}:${criteria.length}`, kind: "date", operator: "before", date }]);
        }}
      >
        <span className="flex items-center gap-xs">
          <IconPlus size={20} stroke={1.75} aria-hidden="true" />
          Add date
        </span>
      </Button>
    </section>
  );
}
