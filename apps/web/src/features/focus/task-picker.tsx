import { useQuery } from "@tanstack/react-query";
import { NONE, Select } from "@/components/ui/select";
import { api, unwrap } from "@/lib/api";

/** Open tasks to link the session to; none is "Deep work". */
export function TaskPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (taskId: string | null) => void;
}) {
  const tasks = useQuery({
    queryKey: ["tasks", "focus-picker"],
    queryFn: () => unwrap(api.tasks.$get({ query: { status: "open,inbox", limit: "200" } })),
  });
  const options = [
    { value: NONE, label: "Deep work" },
    ...(tasks.data ?? []).map((task) => ({ value: task.id, label: task.title })),
  ];
  return (
    <Select
      label="Working on"
      value={value ?? NONE}
      options={options}
      disabled={tasks.isPending && !value}
      placeholder="Deep work"
      onChange={(id) => onChange(id === NONE ? null : id)}
      className="w-full sm:w-64"
    />
  );
}
