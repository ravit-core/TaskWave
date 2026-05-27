import { api } from "@/lib/api";

export type TaskStatus = "pending" | "done" | "cancelled";

export type TaskRange =
  | "today"
  | "tomorrow"
  | "today_morning"
  | "today_afternoon"
  | "today_evening"
  | "tomorrow_morning"
  | "tomorrow_afternoon"
  | "tomorrow_evening"
  | "this_week"
  | "next_week"
  | "upcoming"
  | "overdue"
  | "unscheduled"
  | "all";

export type Task = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  scheduled_at: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
};

export type ListTasksOptions = {
  range?: TaskRange;
  include_done?: boolean;
  include_cancelled?: boolean;
};

export async function listTasks(opts: ListTasksOptions = {}): Promise<Task[]> {
  const params = new URLSearchParams();
  if (opts.range) params.set("range", opts.range);
  if (opts.include_done !== undefined) params.set("include_done", String(opts.include_done));
  if (opts.include_cancelled !== undefined) params.set("include_cancelled", String(opts.include_cancelled));
  const qs = params.toString();
  return api<Task[]>(`/api/tasks${qs ? `?${qs}` : ""}`);
}
