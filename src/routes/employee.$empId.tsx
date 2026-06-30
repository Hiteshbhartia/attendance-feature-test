import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ArrowLeft, DownloadIcon, Upload, Camera } from "lucide-react";
import { employeeById, employeeName, getRoster } from "@/lib/roster";
import { type RosterEvent, summaryFromEvents } from "@/lib/attendance-store";
import { useTasks, hydrateTasks, totalSpentMs, formatDuration } from "@/lib/task-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageTour } from "@/hooks/usePageTour";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/employee/$empId")({
  component: EmployeeProfilePage,
});

function CircularProgress({ percentage, color, label }: { percentage: number; color: string; label: string }) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const validPct = Math.max(0, Math.min(100, percentage || 0));
  const strokeDashoffset = circumference - (validPct / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-14 h-14 mb-2">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="28"
            cy="28"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            className="text-gray-100"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            stroke={color}
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[12px] font-bold text-gray-900">{validPct}%</span>
        </div>
      </div>
      <span className="text-[11px] text-gray-500 font-medium whitespace-nowrap">{label}</span>
    </div>
  );
}

function EmployeeProfilePage() {
  const { empId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [attEvents, setAttEvents] = useState<RosterEvent[]>([]);
  const [attFilter, setAttFilter] = useState<"All Status" | "On Time" | "Late" | "Early" | "Absent">("All Status");

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "",
    team: "",
    zone: "",
    managerId: "",
    birthday: "",
    avatarSeed: "",
  });

  // Basic date range states (defaults to last 30 days)
  const [attStartDate, setAttStartDate] = useState(() => format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [attEndDate, setAttEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("File size exceeds 2MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") {
        setEditForm(prev => ({ ...prev, avatarSeed: event.target!.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  // We can track the visually applied filters, so changes only happen when "Apply" is clicked
  const [appliedStartDate, setAppliedStartDate] = useState(attStartDate);
  const [appliedEndDate, setAppliedEndDate] = useState(attEndDate);
  const [appliedFilter, setAppliedFilter] = useState(attFilter);

  // Task filters
  const [taskFilter, setTaskFilter] = useState<"All Status" | "Completed" | "Pending" | "In Progress" | "Late" | "Early/On Time">("All Status");
  const [taskStartDate, setTaskStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [taskEndDate, setTaskEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const [appliedTaskStartDate, setAppliedTaskStartDate] = useState(taskStartDate);
  const [appliedTaskEndDate, setAppliedTaskEndDate] = useState(taskEndDate);
  const [appliedTaskFilter, setAppliedTaskFilter] = useState(taskFilter);

  usePageTour("employee_profile_tour", [
    {
      popover: {
        title: "Employee Profile",
        description: "Welcome to the 360-degree employee profile view. Here you can see a complete history of an employee's performance.",
        side: "over",
        align: "center",
      }
    },
    {
      element: "#tour-emp-profile",
      popover: { title: "Profile Details", description: "View and edit employee details, such as their role, team, and reporting manager.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-emp-attendance",
      popover: { title: "Attendance Overview", description: "See a quick snapshot of their punctuality and attendance health.", side: "top", align: "start" }
    },
    {
      element: "#tour-emp-attendance-history",
      popover: { title: "Attendance History", description: "Review their daily attendance history, apply date filters, and download reports to Excel.", side: "top", align: "start" }
    },
    {
      element: "#tour-emp-tasks",
      popover: { title: "Task Overview", description: "Check their overall task completion rates and late deliveries.", side: "top", align: "start" }
    },
    {
      element: "#tour-emp-task-history",
      popover: { title: "Task History", description: "View every single task assigned to them, including proof of work and completion status.", side: "top", align: "start" }
    }
  ]);

  useEffect(() => {
    if (!empId) return;

    async function loadData() {
      try {
        const { api } = await import("@/lib/api-client");
        const res = await api.get<{ items: RosterEvent[] }>(`/attendance-events?employeeId=${empId}`);
        setAttEvents(res.items || []);
        await hydrateTasks();
      } catch (err) {
        console.warn("Failed to load data", err);
      }
    }
    loadData();
  }, [empId]);

  const allTasks = useTasks();

  if (!empId) return null;

  const emp = employeeById(empId);
  if (!emp) {
    return (
      <div className="p-6 text-center text-gray-500">
        Employee not found.
        <Button variant="link" onClick={() => navigate({ to: "/roster" })}>Go back to roster</Button>
      </div>
    );
  }

  const managerStr = emp.managerId ? employeeName(emp.managerId) : "Not assigned";

  // Date of Birth logic
  const dobStr = emp.birthday ? emp.birthday : (emp.birthdayMMDD || "Not provided");

  // Joining Date logic
  let joinStr = "Not provided";
  if (emp.joinedAt) {
    joinStr = format(new Date(emp.joinedAt), "dd MMM yyyy");
  } else if (emp.joinedYearsAgo) {
    const d = new Date();
    d.setFullYear(d.getFullYear() - emp.joinedYearsAgo);
    joinStr = format(d, "dd MMM yyyy");
  }

  const emailStr = emp.email || "Not provided";

  const handleApply = () => {
    setAppliedStartDate(attStartDate);
    setAppliedEndDate(attEndDate);
    setAppliedFilter(attFilter);
  };

  const handleTaskApply = () => {
    setAppliedTaskStartDate(taskStartDate);
    setAppliedTaskEndDate(taskEndDate);
    setAppliedTaskFilter(taskFilter);
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      const { api } = await import("@/lib/api-client");
      await api.patch(`/admin/workforce/employees/${empId}`, {
        name: editForm.name,
        operationalRole: editForm.role,
        team: editForm.team,
        zone: editForm.zone,
        managerId: editForm.managerId || null,
        birthday: editForm.birthday,
        avatarSeed: editForm.avatarSeed,
      });
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Failed to save profile. Please check your network or permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  // Process Attendance Data into daily rows
  const groupedByDate = new Map<string, RosterEvent[]>();
  for (const ev of attEvents) {
    const evDate = new Date(ev.ts).toISOString().split("T")[0];
    if (!groupedByDate.has(evDate)) {
      groupedByDate.set(evDate, []);
    }
    groupedByDate.get(evDate)!.push(ev);
  }

  let dailySummaries: any[] = [];
  let totalValidDays = 0;
  let lateDays = 0;
  let onTimeDays = 0;
  let earlyDays = 0;
  let absentDays = 0;

  for (const [dateStr, dayEvents] of Array.from(groupedByDate.entries())) {
    if (dateStr < appliedStartDate || dateStr > appliedEndDate) continue;

    dayEvents.sort((a, b) => a.ts - b.ts);
    const summary = summaryFromEvents(dayEvents);

    const firstClockIn = summary.firstClockIn ? new Date(summary.firstClockIn) : null;
    let lateMs = 0;
    let earlyMs = 0;
    let statusLabel = "On Time";

    if (firstClockIn) {
      const shiftStartMs = new Date(firstClockIn).setHours(9, 0, 0, 0);

      if (firstClockIn.getTime() > shiftStartMs + (15 * 60000)) {
        statusLabel = "Late";
        lateMs = firstClockIn.getTime() - shiftStartMs;
      } else if (firstClockIn.getTime() < shiftStartMs - (15 * 60000)) {
        statusLabel = "Early";
        earlyMs = shiftStartMs - firstClockIn.getTime();
      }
    } else {
      statusLabel = "Absent";
    }

    totalValidDays++;
    if (statusLabel === "Late") lateDays++;
    else if (statusLabel === "On Time") onTimeDays++;
    else if (statusLabel === "Early") earlyDays++;
    else if (statusLabel === "Absent") absentDays++;

    if (appliedFilter !== "All Status" && statusLabel !== appliedFilter) continue;

    dailySummaries.push({
      dateStr,
      statusLabel,
      workMs: summary.workMs,
      breakMs: summary.breakMs,
      lateMs,
      earlyMs,
    });
  }

  dailySummaries.sort((a, b) => b.dateStr.localeCompare(a.dateStr));

  // Calculate Tasks Stats
  const rawEmpTasks = allTasks.filter(t => t.assigneeId === empId && t.relatedTo !== "Admin Check-In");
  
  const empTasks = rawEmpTasks.filter(task => {
    const taskDate = new Date(task.createdAt).toISOString().split("T")[0];
    if (taskDate < appliedTaskStartDate || taskDate > appliedTaskEndDate) return false;

    const isLate = task.status === "done" && !!task.completedAt && !!task.dueAt && task.completedAt > task.dueAt;
    const isDone = task.status === "done";
    
    let statusBadge = "Pending";
    if (isDone) {
      if (isLate) {
        statusBadge = "Late";
      } else {
        statusBadge = "Early/On Time";
      }
    } else if (task.status === "doing") {
      statusBadge = "In Progress";
    }

    if (appliedTaskFilter !== "All Status" && appliedTaskFilter !== "Completed" && statusBadge !== appliedTaskFilter) return false;
    if (appliedTaskFilter === "Completed" && !isDone) return false;
    
    return true;
  });

  const totalTasksCount = empTasks.length;
  let tasksCompletedCount = 0;
  let tasksPendingCount = 0;
  let tasksEarlyCount = 0;
  let tasksLateCount = 0;

  for (const t of empTasks) {
    if (t.status === "done") {
      tasksCompletedCount++;
      if (t.completedAt && t.dueAt && t.completedAt > t.dueAt) {
        tasksLateCount++;
      } else {
        tasksEarlyCount++;
      }
    } else {
      tasksPendingCount++;
    }
  }

  const formatHm = (ms: number, isMinutesOnly = false) => {
    if (!ms || ms < 0) return "0m";
    const totalMins = Math.floor(ms / 60000);
    if (isMinutesOnly) return `${totalMins}m`;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col w-full">
      
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => ["admin", "hr", "manager", "leadership", "zone_leader"].includes(user?.role || "") ? navigate({ to: "/roster" }) : navigate({ to: "/" })} 
            className="text-gray-500 hover:text-gray-900 transition-colors p-1.5 -ml-1.5 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-[16px] font-bold text-gray-900">Employee Profile</h1>
        </div>

        {["admin", "hr", "manager"].includes(user?.role || "") && (
          <div className="relative">
            <select
              className="appearance-none border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 text-[13px] bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              value={empId}
              onChange={(e) => navigate({ to: `/employee/${e.target.value}`, replace: true })}
            >
              {getRoster().sort((a, b) => a.name.localeCompare(b.name)).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 md:p-6 overflow-y-auto overflow-x-hidden max-w-6xl mx-auto w-full">
        {/* Profile Card */}
        <div id="tour-emp-profile" className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4 relative">
          {!isEditingProfile && (user?.role === "admin" || user?.employeeId === emp.id) && (
            <button
              onClick={() => {
                setEditForm({
                  name: emp.name,
                  role: emp.role,
                  team: emp.team || "",
                  zone: emp.zone || "",
                  managerId: emp.managerId || "",
                  birthday: emp.birthday || emp.birthdayMMDD || "",
                  avatarSeed: emp.avatarSeed || emp.name,
                });
                setIsEditingProfile(true);
              }}
              className="absolute top-5 right-5 text-[12px] font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              Edit Profile
            </button>
          )}

          {isEditingProfile ? (
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="flex flex-col items-center gap-2">
                <div 
                  className="h-24 w-24 rounded-2xl overflow-hidden shrink-0 border border-gray-200 shadow-sm relative group cursor-pointer" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  <img 
                    src={editForm.avatarSeed?.startsWith("data:image/") ? editForm.avatarSeed : `https://api.dicebear.com/9.x/notionists/svg?seed=${editForm.avatarSeed || emp.name}`} 
                    alt="Avatar" 
                    className="w-full h-full object-cover bg-gray-50 group-hover:opacity-50 transition-opacity" 
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
                <span className="text-[11px] text-gray-500 font-medium">Click to upload</span>
              </div>
              
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div>
                  <label className="text-[11px] text-gray-400 mb-1.5 uppercase tracking-wide font-semibold block">Full Name</label>
                  <Input 
                    type="text" 
                    value={editForm.name} 
                    onChange={e => setEditForm(prev => ({...prev, name: e.target.value}))}
                    className="text-[14px] font-medium"
                    placeholder="Name"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 mb-1.5 uppercase tracking-wide font-semibold block flex items-center gap-2">
                    Email Address <span className="lowercase text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">Non-editable</span>
                  </label>
                  <div className="flex h-9 w-full rounded-md border border-transparent bg-muted px-3 py-1 text-sm shadow-sm opacity-70">
                    {emailStr}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 mb-1.5 uppercase tracking-wide font-semibold block">Job Role</label>
                  <Input 
                    type="text" 
                    value={editForm.role} 
                    onChange={e => setEditForm(prev => ({...prev, role: e.target.value}))}
                    className="text-[14px] font-medium"
                    placeholder="Role (e.g. Operator)"
                    disabled={user?.role !== "admin"}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 mb-1.5 uppercase tracking-wide font-semibold block">Avatar Seed / Initials</label>
                  <Input 
                    type="text" 
                    value={editForm.avatarSeed?.startsWith("data:image/") ? "" : editForm.avatarSeed} 
                    onChange={e => setEditForm(prev => ({...prev, avatarSeed: e.target.value}))}
                    className="text-[14px] font-medium"
                    placeholder={editForm.avatarSeed?.startsWith("data:image/") ? "Custom Image Uploaded" : "Initials or Seed"}
                    disabled={editForm.avatarSeed?.startsWith("data:image/")}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl overflow-hidden shrink-0 border border-gray-200">
                {emp.avatarSeed || emp.name ? (
                  <img src={emp.avatarSeed?.startsWith("data:image/") ? emp.avatarSeed : `https://api.dicebear.com/9.x/notionists/svg?seed=${emp.avatarSeed || emp.name}`} alt="Avatar" className="w-full h-full object-cover bg-gray-50" />
                ) : (
                  <div className="w-full h-full bg-[#FFCD29] flex items-center justify-center">
                    <span className="font-bold text-[8px] tracking-widest bg-white px-1.5 py-0.5 rounded text-black border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                      GHARPAYY
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <h2 className="text-[20px] font-bold text-gray-900 leading-tight">{emp.name}</h2>
                <div className="text-[13px] text-gray-500 mt-0.5">{emailStr}</div>
                <div className="text-[12px] text-gray-400 mt-0.5">{emp.role}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6 mt-5 border-t border-gray-100 pt-5">
            <div>
              <div className="text-[11px] text-gray-400 mb-1 uppercase tracking-wide">Team</div>
              {isEditingProfile ? (
                <Input 
                  type="text" 
                  value={editForm.team} 
                  onChange={e => setEditForm(prev => ({...prev, team: e.target.value}))}
                  className="text-[13px] font-medium"
                  placeholder="Team"
                  disabled={user?.role !== "admin"}
                />
              ) : (
                <div className="text-[13px] font-medium text-gray-800">{emp.team || "Not provided"}</div>
              )}
            </div>
            <div>
              <div className="text-[11px] text-gray-400 mb-1 uppercase tracking-wide">Office Zone</div>
              {isEditingProfile ? (
                <Input 
                  type="text" 
                  value={editForm.zone} 
                  onChange={e => setEditForm(prev => ({...prev, zone: e.target.value}))}
                  className="text-[13px] font-medium"
                  placeholder="Zone"
                  disabled={user?.role !== "admin"}
                />
              ) : (
                <div className="text-[13px] font-medium text-gray-800">{emp.zone || "Not provided"}</div>
              )}
            </div>
            <div>
              <div className="text-[11px] text-gray-400 mb-1 uppercase tracking-wide">Reporting Manager</div>
              {isEditingProfile ? (
                <select 
                  value={editForm.managerId} 
                  onChange={e => setEditForm(prev => ({...prev, managerId: e.target.value}))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm font-medium"
                  disabled={user?.role !== "admin"}
                >
                  <option value="">None</option>
                  {getRoster().filter(r => r.id !== emp.id).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              ) : (
                <div className="text-[13px] font-medium text-gray-800">{managerStr}</div>
              )}
            </div>
            <div>
              <div className="text-[11px] text-gray-400 mb-1 uppercase tracking-wide">Date of Birth</div>
              {isEditingProfile ? (
                <Input 
                  type="text" 
                  value={editForm.birthday} 
                  onChange={e => setEditForm(prev => ({...prev, birthday: e.target.value}))}
                  className="text-[13px] font-medium"
                  placeholder="DD MMM (e.g. 15 Aug)"
                />
              ) : (
                <div className="text-[13px] font-medium text-gray-800">{dobStr}</div>
              )}
            </div>
            <div>
              <div className="text-[11px] text-gray-400 mb-1 uppercase tracking-wide">Joining Date</div>
              <div className="text-[13px] font-medium text-gray-800">{joinStr}</div>
            </div>
          </div>
          
          {isEditingProfile && (
            <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                onClick={() => setIsEditingProfile(false)}
                className="px-4 py-1.5 text-[13px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                className="px-4 py-1.5 text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>

        {/* Circular Progress Accuracy Card */}
        <div id="tour-emp-attendance" className="bg-white rounded-2xl px-6 py-5 shadow-sm border border-gray-100 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-bold text-gray-900">Attendance Overview</h3>
            <span className="text-[12px] text-gray-400 font-medium">{totalValidDays} day{totalValidDays !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex flex-wrap md:flex-nowrap items-center justify-around gap-4 md:gap-0">
            <CircularProgress percentage={totalValidDays > 0 ? Math.round((onTimeDays / totalValidDays) * 100) : 0} color="#10B981" label="On Time" />
            <CircularProgress percentage={totalValidDays > 0 ? Math.round((lateDays / totalValidDays) * 100) : 0} color="#F59E0B" label="Late" />
            <CircularProgress percentage={totalValidDays > 0 ? Math.round((earlyDays / totalValidDays) * 100) : 0} color="#3B82F6" label="Early" />
            <CircularProgress percentage={totalValidDays > 0 ? Math.round((absentDays / totalValidDays) * 100) : 0} color="#EF4444" label="Absent" />
          </div>
        </div>

        {/* Attendance History Card */}
        <div id="tour-emp-attendance-history" className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h3 className="text-[15px] font-bold text-gray-900">Attendance History</h3>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <select 
                  className="appearance-none border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 text-[12px] bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  value={attFilter}
                  onChange={(e) => setAttFilter(e.target.value as any)}
                >
                  <option value="All Status">All Status</option>
                  <option value="On Time">On Time</option>
                  <option value="Late">Late</option>
                  <option value="Early">Early</option>
                  <option value="Absent">Absent</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white flex items-center">
                  <input 
                    type="date" 
                    value={attStartDate} 
                    onChange={e => setAttStartDate(e.target.value)} 
                    className="bg-transparent outline-none text-[12px] text-gray-600 w-[100px]" 
                  />
                </div>
                <div className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white flex items-center">
                  <input 
                    type="date" 
                    value={attEndDate} 
                    onChange={e => setAttEndDate(e.target.value)} 
                    className="bg-transparent outline-none text-[12px] text-gray-600 w-[100px]" 
                  />
                </div>
              </div>

              <button 
                onClick={handleApply}
                className="bg-[#F97316] hover:bg-[#EA580C] text-white px-4 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
              >
                Apply
              </button>

              <button 
                onClick={() => {
                  const header = "Date,Status,Work Duration,Break Duration,Late Duration,Early Duration\n";
                  const csv = dailySummaries.map(d => `${d.dateStr},${d.statusLabel},${formatHm(d.workMs)},${formatHm(d.breakMs)},${formatHm(d.lateMs, true)},${formatHm(d.earlyMs, true)}`).join("\n");
                  const blob = new Blob([header + csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `attendance_${emp.name.replace(/\s+/g, '_')}_${appliedStartDate}_to_${appliedEndDate}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
                title="Download CSV"
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            {dailySummaries.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-[13px]">No attendance records found for this period.</div>
            ) : (
              dailySummaries.map((day, idx) => (
                <div 
                  key={day.dateStr} 
                  className={`flex flex-col md:flex-row md:items-center rounded-lg px-4 py-3 gap-2 md:gap-0 ${idx % 2 === 0 ? 'bg-[#F9FAFB]' : 'bg-white border border-gray-100'}`}
                >
                  <div className="flex justify-between md:justify-start w-full md:w-auto md:gap-4 items-center">
                    <div className="w-auto md:w-[110px] font-semibold text-gray-900 text-[12px]">{day.dateStr}</div>
                    <div className="w-auto md:w-[80px] text-[12px] font-medium text-gray-500 text-right md:text-left">
                      {day.statusLabel}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:flex md:flex-1 md:justify-between text-[11px] md:text-[12px] text-gray-500 md:ml-4 gap-1 md:gap-0 mt-1 md:mt-0 w-full">
                    <div className="w-full md:w-1/4">Work: {formatHm(day.workMs)}</div>
                    <div className="w-full md:w-1/4">Break: {formatHm(day.breakMs)}</div>
                    <div className="w-full md:w-1/4">Late: {formatHm(day.lateMs, true)}</div>
                    <div className="w-full md:w-1/4">Early: {formatHm(day.earlyMs, true)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Task Circular Progress Card */}
        <div id="tour-emp-tasks" className="bg-white rounded-2xl px-6 py-5 shadow-sm border border-gray-100 mt-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-bold text-gray-900">Task Overview</h3>
            <span className="text-[12px] text-gray-400 font-medium">{totalTasksCount} task{totalTasksCount !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex flex-wrap md:flex-nowrap items-center justify-around gap-4 md:gap-0">
            <CircularProgress percentage={totalTasksCount > 0 ? Math.round((tasksCompletedCount / totalTasksCount) * 100) : 0} color="#10B981" label="Completed" />
            <CircularProgress percentage={totalTasksCount > 0 ? Math.round((tasksPendingCount / totalTasksCount) * 100) : 0} color="#6B7280" label="Pending" />
            <CircularProgress percentage={totalTasksCount > 0 ? Math.round((tasksEarlyCount / totalTasksCount) * 100) : 0} color="#3B82F6" label="Early" />
            <CircularProgress percentage={totalTasksCount > 0 ? Math.round((tasksLateCount / totalTasksCount) * 100) : 0} color="#EF4444" label="Late" />
          </div>
        </div>

        {/* Task History Card */}
        <div id="tour-emp-task-history" className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h3 className="text-[15px] font-bold text-gray-900">Task History</h3>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <select 
                  className="appearance-none border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 text-[12px] bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  value={taskFilter}
                  onChange={(e) => setTaskFilter(e.target.value as any)}
                >
                  <option value="All Status">All Status</option>
                  <option value="Completed">Completed</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Late">Late</option>
                  <option value="Early/On Time">Early/On Time</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white flex items-center">
                  <input 
                    type="date" 
                    value={taskStartDate} 
                    onChange={e => setTaskStartDate(e.target.value)} 
                    className="bg-transparent outline-none text-[12px] text-gray-600 w-[100px]" 
                  />
                </div>
                <div className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white flex items-center">
                  <input 
                    type="date" 
                    value={taskEndDate} 
                    onChange={e => setTaskEndDate(e.target.value)} 
                    className="bg-transparent outline-none text-[12px] text-gray-600 w-[100px]" 
                  />
                </div>
              </div>

              <button 
                onClick={handleTaskApply}
                className="bg-[#F97316] hover:bg-[#EA580C] text-white px-4 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
              >
                Apply
              </button>

              <button 
                onClick={() => {
                  const header = "Task Name,Assigned By,Date,Duration,Proof,Status\n";
                  const csv = empTasks.map(t => {
                    const assignedByName = employeeName(t.assignedById) || "Unknown";
                    const isLate = t.status === "done" && !!t.completedAt && !!t.dueAt && t.completedAt > t.dueAt;
                    let stat = "Pending";
                    if (t.status === "done") stat = isLate ? "Late" : "Early/On Time";
                    else if (t.status === "doing") stat = "In Progress";
                    const dur = formatDuration(totalSpentMs(t));
                    const proof = t.links && t.links.length > 0 ? t.links.map(l => l.label).join("; ") : "None";
                    const cDate = format(new Date(t.createdAt), "dd MMM yyyy");
                    return `"${t.title.replace(/"/g, '""')}","${assignedByName}",${cDate},${dur},"${proof}",${stat}`;
                  }).join("\n");
                  
                  const blob = new Blob([header + csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `tasks_${emp.name.replace(/\s+/g, '_')}_${appliedTaskStartDate}_to_${appliedTaskEndDate}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
                title="Download CSV"
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            {empTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-[13px]">No tasks found for this employee.</div>
            ) : (
              empTasks.map((task, idx) => {
                const assignedByName = employeeName(task.assignedById) || "Unknown";
                const isLate = task.status === "done" && !!task.completedAt && !!task.dueAt && task.completedAt > task.dueAt;
                const isDone = task.status === "done";
                
                let statusBadge = "Pending";
                let statusColor = "bg-gray-100 text-gray-600";
                
                if (isDone) {
                  if (isLate) {
                    statusBadge = "Late";
                    statusColor = "bg-red-50 text-red-600";
                  } else {
                    statusBadge = "Early/On Time";
                    statusColor = "bg-green-50 text-green-600";
                  }
                } else if (task.status === "doing") {
                  statusBadge = "In Progress";
                  statusColor = "bg-blue-50 text-blue-600";
                }

                const durationStr = formatDuration(totalSpentMs(task));
                const proofOfWork = task.links && task.links.length > 0 
                  ? task.links.map(l => l.label).join(", ") 
                  : "None";

                return (
                  <div 
                    key={task.id} 
                    className={`flex flex-col md:flex-row md:items-center rounded-lg px-4 py-3 gap-2 md:gap-0 ${idx % 2 === 0 ? 'bg-[#F9FAFB]' : 'bg-white border border-gray-100'}`}
                  >
                    <div className="flex justify-between items-start w-full md:hidden mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusColor}`}>
                        {statusBadge}
                      </span>
                      <div className="text-[11px] text-gray-500">{format(new Date(task.createdAt), "dd MMM yy")}</div>
                    </div>

                    <div className="flex-1 min-w-0 md:min-w-[180px]">
                      <div className="font-semibold text-gray-900 text-[13px] truncate">{task.title}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">Assigned by: {assignedByName}</div>
                    </div>
                    
                    <div className="hidden md:block w-[90px] text-[12px] text-gray-500">
                      {format(new Date(task.createdAt), "dd MMM yy")}
                    </div>
                    
                    <div className="w-full md:w-[80px] text-[12px] text-gray-500 mt-1 md:mt-0">
                      Dur: {durationStr}
                    </div>
                    
                    <div className="w-full md:w-[120px] text-[12px] text-gray-500 truncate mt-0.5 md:mt-0" title={proofOfWork}>
                      Proof: {proofOfWork}
                    </div>

                    <div className="hidden md:flex w-[110px] justify-end">
                      <span className={`px-2 py-1 rounded text-[11px] font-medium ${statusColor}`}>
                        {statusBadge}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
