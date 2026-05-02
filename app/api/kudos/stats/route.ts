import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { kudosStore } from '@/lib/kudos-store';
import { getWeeklyLeaderboard, getKudosScore } from '@/lib/kudos-score';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const remaining = await kudosStore.getRemainingKudos(user.id);
    const leaderboard = await getWeeklyLeaderboard(3);
    const score = await getKudosScore(user.id, 'weekly');
    
    return NextResponse.json({ remaining, leaderboard, score });
  } catch (e: unknown) {
    console.error('API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
