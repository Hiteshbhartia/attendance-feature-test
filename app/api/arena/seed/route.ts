/**
 * POST /api/arena/seed
 *
 * Seeds default Arena data using the correct architecture:
 *   teamName  = KPI owner (HR Team, Recruitment Team, etc.)
 *   hierarchyRole = authority only (Manager, Employee, etc.)
 *
 * Safe to run multiple times — uses upsert.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { ArenaKPIDefinition, ArenaSprintPlan, ArenaDailyState } from '@/models/ArenaState';
import User from '@/models/User';

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    // 1. Seed KPIs — owned by teamName
    const kpiSeeds = [
      { teamName: 'Recruitment Team', kpiName: 'leads_contacted',      label: 'Leads Contacted',        type: 'NUMBER',  target: 50,   orderIndex: 0 },
      { teamName: 'Recruitment Team', kpiName: 'interviews_scheduled', label: 'Interviews Scheduled',   type: 'NUMBER',  target: 12,   orderIndex: 1 },
      { teamName: 'Recruitment Team', kpiName: 'eod_report',           label: 'EOD Report Submitted',   type: 'BOOLEAN', target: true, orderIndex: 2 },
      { teamName: 'Coach Team',       kpiName: 'team_reviews',         label: 'Team Reviews Completed', type: 'NUMBER',  target: 5,    orderIndex: 0 },
      { teamName: 'Coach Team',       kpiName: 'escalations_resolved', label: 'Escalations Resolved',   type: 'BOOLEAN', target: true, orderIndex: 1 },
      { teamName: 'Operations Team',  kpiName: 'tours_completed',      label: 'Tours Completed',        type: 'NUMBER',  target: 10,   orderIndex: 0 },
      { teamName: 'Operations Team',  kpiName: 'shift_briefing',       label: 'Shift Briefing Done',    type: 'BOOLEAN', target: true, orderIndex: 1 },
      { teamName: 'Software Team',    kpiName: 'tickets_resolved',     label: 'Tickets Resolved',       type: 'NUMBER',  target: 30,   orderIndex: 0 },
      { teamName: 'Software Team',    kpiName: 'sla_maintained',       label: 'SLA Maintained',         type: 'BOOLEAN', target: true, orderIndex: 1 },
      { teamName: 'HR Team',          kpiName: 'onboarding_done',      label: 'Onboardings Completed',  type: 'NUMBER',  target: 3,    orderIndex: 0 },
      { teamName: 'HR Team',          kpiName: 'policy_updates',       label: 'Policy Updates Sent',    type: 'BOOLEAN', target: true, orderIndex: 1 },
    ];

    for (const seed of kpiSeeds) {
      await ArenaKPIDefinition.findOneAndUpdate(
        { teamName: seed.teamName, kpiName: seed.kpiName },
        { $set: seed },
        { upsert: true }
      );
    }

    // 2. Seed Sprint Plans — owned by teamName
    const sprintSeeds = [
      { teamName: 'Recruitment Team', sprintName: 'Morning Sourcing Blitz', startTime: '10:00', endTime: '12:00', orderIndex: 0 },
      { teamName: 'Recruitment Team', sprintName: 'Candidate Outreach',     startTime: '14:00', endTime: '16:00', orderIndex: 1 },
      { teamName: 'Coach Team',       sprintName: 'Team Calibration',       startTime: '11:00', endTime: '12:30', orderIndex: 0 },
      { teamName: 'Operations Team',  sprintName: 'Morning Floor Briefing', startTime: '09:30', endTime: '10:00', orderIndex: 0 },
      { teamName: 'Software Team',    sprintName: 'Daily Standup',          startTime: '10:00', endTime: '10:30', orderIndex: 0 },
    ];

    for (const seed of sprintSeeds) {
      await ArenaSprintPlan.findOneAndUpdate(
        { teamName: seed.teamName, sprintName: seed.sprintName },
        { $set: seed },
        { upsert: true }
      );
    }

    // 3. Seed demo daily state for first approved employee
    const demoEmp = await User.findOne({ role: 'employee', isApproved: true });
    if (demoEmp) {
      const today = new Date().toISOString().split('T')[0];
      await ArenaDailyState.findOneAndUpdate(
        { userId: demoEmp._id, date: today },
        {
          $set: {
            userId: demoEmp._id,
            date: today,
            kpis: {
              'leads_contacted':      { value: 32, isDone: false },
              'interviews_scheduled': { value: 5,  isDone: false },
              'eod_report':           { value: 0,  isDone: false },
            },
            sprints:   { 0: { isDone: true, updatedAt: new Date() } },
            decisions: [{ text: 'Prioritized hot leads over cold calling due to end-of-month target.', timestamp: new Date() }],
            shieldMode: false,
          },
        },
        { upsert: true }
      );

      // Set jobTitle if missing — separate from hierarchy role
      if (!(demoEmp as any).jobTitle) {
        await User.findByIdAndUpdate(demoEmp._id, { $set: { jobTitle: 'Team Member' } });
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Arena seeded. teamName owns KPIs/sprints. hierarchyRole controls permissions only.',
      seeded: { kpis: kpiSeeds.length, sprints: sprintSeeds.length },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
