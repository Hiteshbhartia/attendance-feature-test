import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAttendanceState } from "@/hooks/useAttendance";
import { useThreads, useMessages, sendMessage, findOrCreateThread } from "@/lib/message-store";
import { useNotifications, markRead } from "@/lib/notification-store";
import { getRoster, employeeName } from "@/lib/roster";
import { tierOf } from "@/lib/permissions";
import { Avatar } from "@/components/Avatar";
import { Send, CheckCircle2, XCircle, MessageSquare, ArrowLeft, Search, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageTour } from "@/hooks/usePageTour";

export const Route = createFileRoute("/inbox")({
  component: InboxPage,
});

function timeAgo(ts: number) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function InboxPage() {
  const { actor } = useAttendanceState();
  const threads = useThreads(actor.id);
  
  usePageTour("inbox_tour", [
    {
      popover: {
        title: "Inbox",
        description: "Welcome to your inbox. This is where you can securely message your colleagues, managers, and HR team.",
        side: "over",
        align: "center",
      }
    },
    {
      element: "#tour-inbox-filters",
      popover: { title: "Find Messages", description: "Filter by unread messages or quickly search for a specific colleague.", side: "bottom", align: "start" }
    },
    {
      element: "#tour-inbox-colleagues",
      popover: { title: "Colleagues", description: "Select a colleague to open the chat window.", side: "right", align: "start" }
    },
    {
      element: "#tour-inbox-chat",
      popover: { title: "Chat Window", description: "Type your message or leave requests here. If you're messaging HR, they can approve or reject leave requests directly from this chat.", side: "left", align: "start" }
    }
  ]);

  // Default active tab: first active thread or empty
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [search, setSearch] = useState("");

  const [readFilter, setReadFilter] = useState<"all" | "unread">("all");
  const notifications = useNotifications(actor.id);
  const unreadFrom = notifications.filter(n => !n.read && n.actionTo === "/inbox").map(n => n.fromId);

  const actorRoster = getRoster().find(e => e.id === actor.id);
  
  // Define if the current user is HR or Admin by casting strings
  const myRoleStr = String(actorRoster?.role || "").toUpperCase().trim();
  const myAppRoleStr = String(actorRoster?.appRole || "").toUpperCase().trim();
  const isHRorAdmin = 
    myRoleStr === "ADMIN" || myAppRoleStr === "ADMIN" || 
    myRoleStr === "HR" || myAppRoleStr === "HR" || 
    myRoleStr === "ZONE LEADER" || myRoleStr === "LEADERSHIP";
  
  const colleagues = getRoster().filter(e => {
    if (e.id === actor.id) return false;
    
    // Always show the user in the inbox if there's an active conversation with them
    const hasThread = threads.some(t => t.participantIds.includes(e.id));
    if (hasThread) return true;

    const eRoleStr = String(e.role || "").toUpperCase().trim();
    const eAppRoleStr = String(e.appRole || "").toUpperCase().trim();
    
    // Explicitly filter out pure Admin users (but keep HR even if they have admin appRole)
    if (eRoleStr !== "HR" && (eRoleStr === "ADMIN" || eAppRoleStr === "ADMIN" || eRoleStr === "SYSTEM ADMIN")) {
      return false;
    }
    
    if (!isHRorAdmin) {
      // If employee, ONLY return users whose role is HR
      return eRoleStr === "HR" || eAppRoleStr === "HR" || eRoleStr.includes("HR");
    }
    
    return true;
  });

  // Filter colleagues by search and read state
  const filteredColleagues = colleagues.filter(c => {
    if (readFilter === "unread" && !unreadFrom.includes(c.id)) return false;
    return c.name.toLowerCase().includes(search.toLowerCase()) || 
      (c.role && c.role.toLowerCase().includes(search.toLowerCase()));
  });

  // Sort colleagues: those with active threads first, then alphabetical
  filteredColleagues.sort((a, b) => {
    const tA = threads.find(t => t.participantIds.includes(a.id));
    const tB = threads.find(t => t.participantIds.includes(b.id));
    if (tA && tB) return tB.updatedAt - tA.updatedAt;
    if (tA) return -1;
    if (tB) return 1;
    return a.name.localeCompare(b.name);
  });

  const selectedColleague = colleagues.find(c => c.id === activeTabId);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
      
      <div className={`w-full md:w-80 border-r border-border bg-card flex flex-col ${activeTabId && window.innerWidth < 768 ? 'hidden md:flex' : 'flex'}`}>
        <div id="tour-inbox-filters" className="p-4 border-b border-border shrink-0">
          <h1 className="font-display text-xl font-semibold mb-3">Messages</h1>
          <div className="flex gap-2 items-center">
            <div className="w-[140px] shrink-0">
              <Select value={readFilter} onValueChange={(val) => setReadFilter(val as any)}>
                <SelectTrigger className="h-9 text-xs bg-card">
                  <SelectValue placeholder="All messages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All messages</SelectItem>
                  <SelectItem value="unread">Unread only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search colleagues..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-9 bg-secondary border-none rounded-lg pl-9 pr-3 text-sm focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </div>
        
        <div id="tour-inbox-colleagues" className="flex-1 overflow-y-auto p-2 space-y-1">

          {/* Colleague List */}
          {filteredColleagues.map(c => {
            const thread = threads.find(t => t.participantIds.includes(c.id));
            return (
              <button
                key={c.id}
                onClick={() => setActiveTabId(c.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${activeTabId === c.id ? "bg-secondary" : "hover:bg-secondary/50"}`}
              >
                <Avatar id={c.id} size={40} />
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm truncate">{c.name}</div>
                    {thread && <div className="text-[10px] text-muted-foreground shrink-0">{timeAgo(thread.updatedAt)}</div>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {thread ? thread.lastMessage : c.role}
                  </div>
                </div>
              </button>
            );
          })}
          {filteredColleagues.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground break-words whitespace-pre-wrap text-left">
              No colleagues found.
            </div>
          )}
        </div>
      </div>

      {/* Right Pane (Chat View) */}
      <div id="tour-inbox-chat" className={`flex-1 flex flex-col bg-background relative ${!activeTabId ? 'hidden md:flex' : 'flex'}`}>
        {selectedColleague ? (
          <ChatView 
            actorId={actor.id} 
            colleagueId={selectedColleague.id} 
            isHRorAdmin={isHRorAdmin} 
            onBack={() => setActiveTabId("")}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <MessageSquare className="h-12 w-12 opacity-20" />
            <div className="text-sm">Select a colleague to start chatting</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Removed NotificationsView

function ChatView({ actorId, colleagueId, isHRorAdmin, onBack }: { actorId: string, colleagueId: string, isHRorAdmin: boolean, onBack: () => void }) {
  const thread = findOrCreateThread(actorId, colleagueId);
  const messages = useMessages(thread.id);
  const notifications = useNotifications(actorId);
  const [text, setText] = useState("");
  
  useEffect(() => {
    notifications.forEach((n) => {
      if (!n.read && n.actionTo === "/inbox" && n.fromId === colleagueId) {
        markRead(n.id);
      }
    });
  }, [notifications, colleagueId]);

  const handleSend = (decision?: string | any) => {
    // protect against event objects
    const actualDecision = (decision === "approved" || decision === "rejected") ? decision : undefined;
    
    let msgText = text.trim();
    if (!msgText && actualDecision) {
      msgText = actualDecision === "approved" ? "Approved." : "Rejected.";
    }
    if (!msgText) return;

    const actionType = actualDecision ? (actualDecision === "approved" ? "leave_approved" : "leave_rejected") : undefined;
    sendMessage(actorId, thread.id, msgText, actionType);
    setText("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 border-b border-border bg-card/50 flex items-center px-4 shrink-0 gap-3 z-10">
        <button onClick={onBack} className="md:hidden h-8 w-8 -ml-2 rounded-full flex items-center justify-center hover:bg-secondary">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Avatar id={colleagueId} size={32} />
        <div className="font-semibold text-sm">{employeeName(colleagueId)}</div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col justify-end">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <MessageSquare className="h-10 w-10 opacity-20" />
            <div className="text-sm">Say hello to {employeeName(colleagueId)}!</div>
          </div>
        )}
        
        {messages.map(m => {
          const isMe = m.fromId === actorId;
          const isSystemAction = m.actionType === "leave_approved" || m.actionType === "leave_rejected";
          
          if (isSystemAction) {
             return (
               <div key={m.id} className="flex justify-center my-4">
                 <div className={`px-4 py-2 flex items-center gap-2 rounded-full text-xs font-medium shadow-sm border ${m.actionType === "leave_approved" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                   {m.actionType === "leave_approved" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                   {m.body}
                 </div>
               </div>
             );
          }

          return (
            <div key={m.id} className={`flex gap-3 ${isMe ? "justify-end" : ""}`}>
              {!isMe && <Avatar id={m.fromId} size={32} className="mt-1 shrink-0" />}
              <div className={`flex flex-col gap-1 max-w-[85%] ${isMe ? "items-end" : "items-start"}`}>
                <div 
                  className={`px-4 py-2.5 rounded-2xl text-sm ${isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-secondary text-foreground rounded-tl-sm"}`}
                >
                  {m.body}
                </div>
                <div className="text-[10px] text-muted-foreground font-medium px-1">
                  {new Date(m.ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-border bg-card">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input 
            type="text" 
            placeholder="Type a message or leave request..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            className="flex-1 h-12 min-w-0 bg-secondary border-none rounded-xl px-4 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
          />
          
          <div className="flex items-center justify-end gap-2 shrink-0">
            {isHRorAdmin && (
              <div className="hidden md:flex gap-2">
                <button 
                  onClick={() => handleSend("approved")}
                  title="Approve Leave"
                  className="h-12 px-4 bg-success/15 hover:bg-success/25 text-success rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Approve</span>
                </button>
                <button 
                  onClick={() => handleSend("rejected")}
                  title="Reject Leave"
                  className="h-12 px-4 bg-destructive/15 hover:bg-destructive/25 text-destructive rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Reject</span>
                </button>
              </div>
            )}
            <button 
              onClick={() => handleSend()}
              disabled={!text.trim()}
              className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              <Send className="h-5 w-5 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
