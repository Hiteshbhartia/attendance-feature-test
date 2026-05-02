import KudoModel from '@/models/Kudo';
import { connectDB } from '@/lib/db';
import { startOfWeek, endOfWeek } from 'date-fns';

export const KUDO_POINTS: Record<string, number> = {
  'Hustle': 5,
  'Team Player': 4,
  'Ownership': 6,
  'Customer Love': 5,
  'Above & Beyond': 7,
  'Bug Fixer': 4,
  'Streak Hero': 5
};

export async function getKudosScore(userId: string, timeframe: 'weekly' | 'all' = 'weekly') {
  await connectDB();
  
  let query: any = { toId: userId };
  
  if (timeframe === 'weekly') {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });
    query.createdAt = { $gte: start, $lte: end };
  }
  
  const kudos = await KudoModel.find(query).lean();
  
  const totalScore = kudos.reduce((sum: number, kudo: any) => {
    const points = KUDO_POINTS[kudo.tag] || 0;
    return sum + points;
  }, 0);
  
  return totalScore;
}

export async function getWeeklyLeaderboard(limit = 3) {
  await connectDB();
  
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = endOfWeek(new Date(), { weekStartsOn: 1 });
  
  const weeklyKudos = await KudoModel.find({
    createdAt: { $gte: start, $lte: end }
  }).lean();
  
  // Group by recipient
  const userScores: Record<string, { id: string, name: string, score: number }> = {};
  
  weeklyKudos.forEach((kudo: any) => {
    if (!userScores[kudo.toId]) {
      userScores[kudo.toId] = { id: kudo.toId, name: kudo.toName, score: 0 };
    }
    userScores[kudo.toId].score += (KUDO_POINTS[kudo.tag] || 0);
  });
  
  // Sort and take top N
  return Object.values(userScores)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
