import { createFileRoute, Link } from "@tanstack/react-router";
import { useTasks, hydrateTasks } from "@/lib/task-store";
import { useRosterState } from "@/hooks/useRoster";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RoleGate } from "@/components/RoleGate";
import { useEffect } from "react";
import { Avatar } from "@/components/Avatar";

export const Route = createFileRoute("/task-throughput")({
  component: () => (
    <RoleGate allow={["leadership", "hr"]}>
      <TaskThroughputPage />
    </RoleGate>
  ),
});

function TaskThroughputPage() {
  const tasks = useTasks();
  const { roster } = useRosterState();

  useEffect(() => {
    hydrateTasks();
    const interval = setInterval(hydrateTasks, 15000); // Polling for live updates
    return () => clearInterval(interval);
  }, []);

  const filteredTasks = tasks.filter(task => {
    const assignee = roster.find(e => e.id === task.assigneeId);
    if (assignee && assignee.role.toLowerCase().includes("admin")) return false;
    return true;
  });

  const getEmpName = (id?: string) => {
    if (!id) return "—";
    const emp = roster.find((e) => e.id === id);
    return emp ? emp.name : id;
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "done":
        return "Done";
      case "doing":
        return "Pending";
      case "todo":
        return "Yet To Start";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "done":
        return "bg-success/10 text-success border-success/20";
      case "doing":
        return "bg-warning/15 text-warning border-warning/20";
      case "todo":
        return "bg-muted text-muted-foreground border-border";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1200px] mx-auto">
      <header className="mb-5">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-4 transition-colors">
          &larr; Back to Dashboard
        </Link>
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
          Org · Pillar 02
        </div>
        <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">Task Throughput</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Live overview of all organizational tasks and their current statuses.
        </p>
      </header>

      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Assigned By</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No tasks found in the organization.
                </TableCell>
              </TableRow>
            ) : (
              filteredTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div className="font-medium">{task.title}</div>
                    {task.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {task.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar id={task.assignedById!} size={24} />
                      <span className="text-sm">{getEmpName(task.assignedById)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar id={task.assigneeId} size={24} />
                      <span className="text-sm">{getEmpName(task.assigneeId)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] uppercase font-mono tracking-widest border ${getStatusColor(
                        task.status,
                      )}`}
                    >
                      {getStatusText(task.status)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
