'use client';
import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, Activity, Zap, Clock, MessageSquare, 
  ChevronLeft, Calendar, Shield, TrendingUp,
  Target, CheckCircle2, AlertCircle, ArrowUpRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PerformanceDashboardProps {
  operatorId: string;
}

export default function PerformanceDashboard({ operatorId }: PerformanceDashboardProps) {
  const router = useRouter();
  const [operator, setOperator] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [comms, setComms] = useState<any[]>([]);
  const [teamData, setTeamData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const date = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/arena/state?userId=${operatorId}&date=${date}`).then(r => r.json());
        if (res.ok) {
          setOperator(res.user);
          setState(res.state);
          setDefinitions(res.definitions.kpis);
          setSprints(res.definitions.sprints);
          setComms(res.definitions.comms || []);
          setTeamData(res.teamData);
        }
      } catch (err) {
        console.error("Error loading performance intelligence:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [operatorId, date]);

  const stats = useMemo(() => {
    if (!state || definitions.length === 0) return { score: 0, kpiProgress: 0, sprintProgress: 0, commProgress: 0 };
    
    const kpiCount = definitions.length;
    const kpisDone = definitions.filter(d => {
      const k = state.kpis?.[d.kpiName] || state.kpis?.get?.(d.kpiName);
      return k?.isDone;
    }).length;

    const sprintCount = sprints.length;
    const sprintsDone = sprints.filter((_, idx) => {
      const s = state.sprints?.[idx] || state.sprints?.get?.(idx);
      return s?.isDone;
    }).length;

    const commCount = comms.length;
    const commsDone = comms.filter((_, idx) => {
      const c = state.comms?.[idx] || state.comms?.get?.(idx);
      return c?.status === 'SENT';
    }).length;

    return {
      score: Math.round((kpisDone / kpiCount) * 100) || 0,
      kpiProgress: Math.round((kpisDone / kpiCount) * 100) || 0,
      sprintProgress: Math.round((sprintsDone / Math.max(sprintCount, 1)) * 100) || 0,
      commProgress: Math.round((commsDone / Math.max(commCount, 1)) * 100) || 0
    };
  }, [state, definitions, sprints, comms]);

  const handleDownloadArchive = async () => {
    try {
      if (!state) throw new Error("No state available to export.");

      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();
      
      // Branding Header
      doc.setFontSize(22);
      doc.setTextColor(249, 115, 22); // Orange
      doc.text('Arena OS Performance Intelligence Report', 14, 22);
      
      doc.setDrawColor(249, 115, 22);
      doc.setLineWidth(0.5);
      doc.line(14, 26, 196, 26);

      // Meta Info
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 32);

      let currentY = 40;

      // 1. OPERATOR INFORMATION
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.text('1. TEAM MEMBER INFORMATION', 14, currentY);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const metaData = [
        ['Employee Name:', operator?.fullName || 'N/A'],
        ['KPI Team:', teamData?.teamName || operator?.teamName || 'N/A'],
        ['Date:', date],
        ['Overall Execution Score:', `${stats.score}%`]
      ];
      
      autoTable(doc, {
        startY: currentY + 4,
        body: metaData,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2, textColor: [71, 85, 105] },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50, textColor: [17, 24, 39] } },
        margin: { left: 14 }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 15;

      // 2. KPI PERFORMANCE
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.text('2. MISSION CRITICAL KPIs', 14, currentY);

      const kpiData = definitions.map(def => {
        const kpi = state?.kpis?.[def.kpiName] || state?.kpis?.get?.(def.kpiName) || { value: 0, isDone: false };
        const isTargetHit = def.type === 'BOOLEAN' ? kpi.isDone === def.target : kpi.value >= def.target;
        return [
          def.label,
          def.type === 'BOOLEAN' ? (def.target ? 'Yes' : 'No') : def.target.toString(),
          def.type === 'BOOLEAN' ? (kpi.isDone ? 'Yes' : 'No') : kpi.value.toString(),
          isTargetHit ? 'ACHIEVED' : 'PENDING'
        ];
      });

      autoTable(doc, {
        startY: currentY + 4,
        head: [['KPI Name', 'Target', 'Achieved', 'Status']],
        body: kpiData,
        theme: 'grid',
        headStyles: { fillColor: [243, 244, 246], textColor: [71, 85, 105], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 3) {
            if (data.cell.raw === 'ACHIEVED') {
              data.cell.styles.textColor = [22, 101, 52];
              data.cell.styles.fillColor = [220, 252, 231];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [75, 85, 99];
              data.cell.styles.fillColor = [243, 244, 246];
            }
          }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // 3. SPRINT EXECUTION
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.text('3. SPRINT EXECUTION TIMELINE', 14, currentY);

      const sprintData = sprints.map((sprint, idx) => {
        const sState = state?.sprints?.[idx] || state?.sprints?.get?.(idx) || { isDone: false };
        return [
          `${sprint.startTime} - ${sprint.endTime}`,
          sprint.sprintName,
          sState.isDone ? 'SUCCESSFUL' : 'INCOMPLETE'
        ];
      });

      autoTable(doc, {
        startY: currentY + 4,
        head: [['Time', 'Sprint Plan', 'Status']],
        body: sprintData,
        theme: 'grid',
        headStyles: { fillColor: [243, 244, 246], textColor: [71, 85, 105], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 2) {
            if (data.cell.raw === 'SUCCESSFUL') {
              data.cell.styles.textColor = [22, 101, 52];
              data.cell.styles.fillColor = [220, 252, 231];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [75, 85, 99];
              data.cell.styles.fillColor = [243, 244, 246];
            }
          }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // 4. COMMUNICATION WINDOWS
      if (comms.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(17, 24, 39);
        doc.setFont('helvetica', 'bold');
        doc.text('4. COMMUNICATION WINDOWS', 14, currentY);

        const commData = comms.map((comm, idx) => {
          const cState = state?.comms?.[idx] || state?.comms?.get?.(idx) || {};
          return [
            comm.scheduledTime,
            comm.windowName,
            cState.status || 'PENDING'
          ];
        });

        autoTable(doc, {
          startY: currentY + 4,
          head: [['Time', 'Window', 'Status']],
          body: commData,
          theme: 'grid',
          headStyles: { fillColor: [243, 244, 246], textColor: [71, 85, 105], fontStyle: 'bold' },
          styles: { fontSize: 9, cellPadding: 4 },
          didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 2) {
              if (data.cell.raw === 'SENT') {
                data.cell.styles.textColor = [22, 101, 52];
                data.cell.styles.fillColor = [220, 252, 231];
                data.cell.styles.fontStyle = 'bold';
              } else if (data.cell.raw === 'MISSED') {
                data.cell.styles.textColor = [153, 27, 27];
                data.cell.styles.fillColor = [254, 226, 226];
                data.cell.styles.fontStyle = 'bold';
              } else {
                data.cell.styles.textColor = [75, 85, 99];
                data.cell.styles.fillColor = [243, 244, 246];
              }
            }
          }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }

      // Check page break
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      // 5. STRATEGIC DECISIONS
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.text('5. STRATEGIC DECISIONS', 14, currentY);
      
      const decisions = state?.decisions || [];
      const decisionRows = decisions.length > 0 
        ? decisions.map((d: any) => [`${new Date(d.timestamp).toLocaleTimeString()} - "${d.text}"`])
        : [['No strategic decisions logged.']];

      autoTable(doc, {
        startY: currentY + 4,
        body: decisionRows,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 3, textColor: [71, 85, 105], fontStyle: 'italic' },
        margin: { left: 14 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;
      
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      // 6. EOD REPORT
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.text('6. EOD INTELLIGENCE REPORT', 14, currentY);

      if (state?.eodReport?.submittedAt) {
        const eodData = [
          ['Submitted At:', new Date(state.eodReport.submittedAt).toLocaleString()],
          ['Goal Achieved:', state.eodReport.goalAchieved || 'N/A'],
          ['What Was Done:', state.eodReport.whatWasDone || state.eodReport.summary || 'No details provided.']
        ];
        
        autoTable(doc, {
          startY: currentY + 4,
          body: eodData,
          theme: 'plain',
          styles: { fontSize: 9, cellPadding: 3, textColor: [71, 85, 105] },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35, textColor: [17, 24, 39] } },
          margin: { left: 14 }
        });
        
        currentY = (doc as any).lastAutoTable.finalY + 5;
        
        const validLinks = state.eodReport.liveLinks?.filter((l: any) => l.label && l.url) || [];
        if (validLinks.length > 0) {
          const linksData = validLinks.map((l: any) => [l.label, l.url]);
          autoTable(doc, {
            startY: currentY,
            head: [['Live Links', 'URL']],
            body: linksData,
            theme: 'grid',
            headStyles: { fillColor: [243, 244, 246], textColor: [71, 85, 105], fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: { 1: { textColor: [234, 88, 12] } }
          });
          currentY = (doc as any).lastAutoTable.finalY + 15;
        }
      } else {
        autoTable(doc, {
          startY: currentY + 4,
          body: [['EOD Report not yet submitted.']],
          theme: 'plain',
          styles: { fontSize: 9, cellPadding: 3, textColor: [71, 85, 105], fontStyle: 'italic' },
          margin: { left: 14 }
        });
      }

      const filename = `${operator?.fullName?.replace(/\s+/g, '_') || 'Member'}_${(teamData?.teamName || operator?.teamName || 'Team').replace(/\s+/g, '')}_Arena_Report_${date}.pdf`;
      doc.save(filename);
      
    } catch (err) {
      alert("Failed to generate archive: " + (err as Error).message);
    }
  };


  if (loading) return (
    <div className="p-12 text-center">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent mb-4"></div>
      <p className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest">Compiling Execution Intelligence...</p>
    </div>
  );

  if (!operator) return (
    <div className="p-12 text-center">
      <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
      <h2 className="text-xl font-black text-gray-900">Member Not Found</h2>
      <button onClick={() => router.back()} className="mt-4 text-orange-500 font-bold flex items-center gap-2 mx-auto">
        <ChevronLeft className="h-4 w-4" /> Go Back
      </button>
    </div>
  );

  const cardStyle = { 
    background: '#ffffff', 
    border: '1px solid #e5e7eb', 
    borderRadius: '24px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Intelligence */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => router.back()}
            className="h-12 w-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-all shadow-sm"
          >
            <ChevronLeft className="h-5 w-5 text-gray-400" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-black tracking-tight text-gray-900">{operator.fullName}</h1>
              <Badge 
                className="border-none font-black text-[10px] tracking-widest px-3"
                style={{ backgroundColor: 'rgba(99,102,241,0.12)', color: '#6366f1' }}
              >
                {(teamData?.teamName || operator?.teamName || 'UNASSIGNED TEAM').toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold text-gray-400 font-mono uppercase tracking-widest">
              <span>{operator.email}</span>
              <span className="h-1 w-1 rounded-full bg-gray-200" />
              <span>Shift: {operator.workSchedule?.startTime || '09:00'} - {operator.workSchedule?.endTime || '18:00'}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
           <div className="px-6 py-3 bg-gray-900 text-white rounded-2xl flex items-center gap-4 shadow-xl">
              <div className="text-right">
                <div className="text-[9px] font-mono font-black text-orange-500 uppercase tracking-widest">Live Performance</div>
                <div className="text-xl font-black">{stats.score}%</div>
              </div>
              <div className="h-8 w-px bg-gray-800" />
              <Activity className="h-6 w-6 text-orange-500" />
           </div>
        </div>
      </header>

      {/* Intelligence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Execution Health */}
        <Card className="lg:col-span-1 rounded-[32px] border-none shadow-sm overflow-hidden bg-gray-900 text-white">
          <CardHeader className="p-8 pb-0">
             <CardTitle className="text-xs font-mono font-black text-orange-500 uppercase tracking-widest flex items-center gap-2">
                <Activity className="h-3 w-3" /> Execution Health
             </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
             <div>
                <div className="flex justify-between items-end mb-2">
                   <div className="text-xs font-bold text-gray-400">KPI Mastery</div>
                   <div className="text-xl font-black text-white">{stats.kpiProgress}%</div>
                </div>
                <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                   <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${stats.kpiProgress}%` }} />
                </div>
             </div>
             <div>
                <div className="flex justify-between items-end mb-2">
                   <div className="text-xs font-bold text-gray-400">Sprint Consistency</div>
                   <div className="text-xl font-black text-white">{stats.sprintProgress}%</div>
                </div>
                <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                   <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${stats.sprintProgress}%` }} />
                </div>
             </div>
             {comms.length > 0 && (
               <div>
                  <div className="flex justify-between items-end mb-2">
                     <div className="text-xs font-bold text-gray-400">Communication Outreach</div>
                     <div className="text-xl font-black text-white">{stats.commProgress}%</div>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                     <div className="h-full bg-purple-500 transition-all duration-1000" style={{ width: `${stats.commProgress}%` }} />
                  </div>
               </div>
             )}
             <div className="pt-4 border-t border-gray-800">
                <div className="flex items-center gap-3 text-xs font-bold text-gray-400">
                   <Shield className={`h-4 w-4 ${state?.shieldMode ? 'text-orange-500' : 'text-gray-600'}`} />
                   <span>SHIELD MODE: {state?.shieldMode ? 'ACTIVE' : 'OFFLINE'}</span>
                </div>
             </div>
          </CardContent>
        </Card>

        {/* KPI Performance Matrix */}
        <div className="lg:col-span-3 space-y-6">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <Target className="h-4 w-4 text-orange-500" />
                 <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Performance Matrix</h3>
              </div>
              <Badge variant="outline" className="font-mono text-[9px] font-black uppercase tracking-widest">Real-time Data</Badge>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {definitions.map((def) => {
                const kpi = state?.kpis?.[def.kpiName] || state?.kpis?.get?.(def.kpiName) || { value: 0, isDone: false };
                const isBoolean = def.type === 'BOOLEAN';

                return (
                  <div key={def._id} style={cardStyle} className="p-6 relative overflow-hidden group">
                    <div className={`absolute top-0 right-0 h-1 w-full ${kpi.isDone ? 'bg-green-500' : 'bg-orange-500/20'}`} />
                    <div className="mb-4">
                       <h4 className="font-black text-gray-900 text-sm leading-tight mb-1">{def.label}</h4>
                       <div className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">
                          {def.kpiName}
                       </div>
                    </div>
                    
                    <div className="flex items-end justify-between">
                       <div className="text-2xl font-black text-gray-900">
                          {isBoolean ? (kpi.isDone ? 'YES' : 'NO') : kpi.value}
                          {!isBoolean && <span className="text-xs text-gray-300 ml-1">/ {def.target}</span>}
                       </div>
                       <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${kpi.isDone ? 'bg-green-50 text-green-500' : 'bg-orange-50 text-orange-500'}`}>
                          {kpi.isDone ? <CheckCircle2 className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                       </div>
                    </div>
                  </div>
                );
              })}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Sprint Intelligence */}
         <section className="space-y-4">
            <div className="flex items-center gap-2">
               <Clock className="h-4 w-4 text-orange-500" />
               <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Execution Timeline</h3>
            </div>
            <div style={cardStyle} className="overflow-hidden">
               <div className="divide-y divide-gray-50">
                  {sprints.map((sprint, idx) => {
                    const sprintState = state?.sprints?.[idx] || state?.sprints?.get?.(idx) || { isDone: false };
                    return (
                      <div key={sprint._id} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition-all">
                         <div className="flex gap-4 items-center">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-mono font-black text-xs ${sprintState.isDone ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                               {idx + 1}
                            </div>
                            <div>
                               <div className="font-bold text-gray-900 text-sm">{sprint.sprintName}</div>
                               <div className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">{sprint.startTime} – {sprint.endTime}</div>
                            </div>
                         </div>
                         <Badge className={`font-black text-[9px] ${sprintState.isDone ? 'bg-green-500' : 'bg-gray-100 text-gray-400'}`}>
                            {sprintState.isDone ? 'SUCCESSFUL' : 'INCOMPLETE'}
                         </Badge>
                      </div>
                    );
                  })}
               </div>
            </div>
         </section>

         {/* Communication Analytics */}
         {comms.length > 0 && (
            <section className="space-y-4">
               <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-orange-500" />
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Communication Analytics</h3>
               </div>
               <div style={cardStyle} className="overflow-hidden">
                  <div className="divide-y divide-gray-50">
                     {comms.map((comm, idx) => {
                       const commState = state?.comms?.[idx] || state?.comms?.get?.(idx) || null;
                       return (
                         <div key={comm._id} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition-all">
                            <div className="flex gap-4 items-center">
                               <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-mono font-black text-xs ${commState?.status === 'SENT' ? 'bg-green-500 text-white' : commState?.status === 'MISSED' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                  {commState?.status === 'SENT' ? <CheckCircle2 className="h-4 w-4" /> : commState?.status === 'MISSED' ? <AlertCircle className="h-4 w-4" /> : (idx + 1)}
                               </div>
                               <div>
                                  <div className="font-bold text-gray-900 text-sm">{comm.windowName}</div>
                                  <div className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">{comm.scheduledTime}</div>
                               </div>
                            </div>
                            <Badge className={`font-black text-[9px] ${commState?.status === 'SENT' ? 'bg-green-500' : commState?.status === 'MISSED' ? 'bg-red-500' : 'bg-gray-100 text-gray-400'}`}>
                               {commState?.status || 'PENDING'}
                            </Badge>
                         </div>
                       );
                     })}
                  </div>
               </div>
            </section>
          )}

         {/* Decision & Sentiment Analysis */}
         <div className="space-y-8">
            <section className="space-y-4">
               <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-orange-500" />
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Decision Intelligence</h3>
               </div>
               <div style={cardStyle} className="p-6 space-y-4">
                  {state?.decisions?.length > 0 ? (
                    state.decisions.map((d: any, i: number) => (
                      <div key={i} className="p-5 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
                         <div className="flex justify-between items-start">
                            <div className="text-xs font-bold text-gray-900 leading-relaxed italic">"{d.text}"</div>
                            <div className="text-[9px] font-mono font-black text-gray-300 uppercase shrink-0">
                               {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                         </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10">
                       <AlertCircle className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                       <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">No strategic decisions logged today.</p>
                    </div>
                  )}
               </div>
            </section>

             {/* EOD Intelligence */}
             <section className="space-y-4">
                <div className="flex items-center gap-2">
                   <ArrowUpRight className="h-4 w-4 text-orange-500" />
                   <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">EOD Intelligence</h3>
                </div>
                <div style={cardStyle} className="p-8 bg-gray-50/50">
                   {state?.eodReport?.submittedAt ? (
                     <div className="space-y-6">
                        <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                           <div className="text-[10px] font-mono font-black text-green-600 uppercase tracking-widest">Report Received</div>
                           <Badge variant="outline" className="text-[9px] font-black uppercase border-gray-200 text-gray-500">
                              {new Date(state.eodReport.submittedAt).toLocaleTimeString()}
                           </Badge>
                        </div>
                        
                        <div className="space-y-5">
                          {/* Goal Achieved */}
                          <div>
                            <div className="text-[9px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1.5">Goal Achieved</div>
                            <Badge className={`${
                              state.eodReport.goalAchieved === 'Yes' ? 'bg-green-500 text-white' : 
                              state.eodReport.goalAchieved === 'Partially' ? 'bg-yellow-500 text-white' : 
                              state.eodReport.goalAchieved === 'No' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {state.eodReport.goalAchieved || 'N/A'}
                            </Badge>
                          </div>

                          {/* What Was Done */}
                          <div>
                            <div className="text-[9px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1.5">What Was Done</div>
                            <div className="text-sm font-medium text-gray-900 leading-relaxed whitespace-pre-wrap bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                              {state.eodReport.whatWasDone || state.eodReport.summary || 'No details provided.'}
                            </div>
                          </div>

                          {/* Live Links */}
                          {state.eodReport.liveLinks?.filter((l: any) => l.label && l.url).length > 0 && (
                            <div>
                              <div className="text-[9px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1.5">Live Links</div>
                              <div className="space-y-2">
                                {state.eodReport.liveLinks.filter((l: any) => l.label && l.url).map((link: any, idx: number) => (
                                  <a 
                                    key={idx} 
                                    href={link.url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 text-xs font-bold text-orange-500 hover:border-orange-300 hover:shadow-sm transition-all group"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-900 group-hover:text-orange-600 transition-colors">{link.label}</span>
                                      <span className="text-gray-400 font-mono font-normal">→ {link.url}</span>
                                    </div>
                                    <ArrowUpRight className="h-3 w-3 text-gray-300 group-hover:text-orange-500 transition-colors" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="pt-4 border-t border-gray-200">
                           <button 
                             onClick={handleDownloadArchive}
                             className="w-full py-3 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-md flex items-center justify-center gap-2"
                           >
                              Download full archive
                           </button>
                        </div>
                     </div>
                   ) : (
                     <div className="text-center py-6">
                        <Activity className="h-10 w-10 text-gray-200 mx-auto mb-4" />
                        <div className="text-sm font-black text-gray-900 mb-1">Final Operational Report</div>
                        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-tight">
                           Awaiting daily summary from team member...
                        </p>
                     </div>
                   )}
                </div>
             </section>
         </div>
      </div>
    </div>
  );
}
