import KudoModel from '@/models/Kudo';
import { connectDB } from '@/lib/db';
import { startOfDay, endOfDay } from 'date-fns';

export interface Kudo {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  tag: string;
  message: string;
  timestamp: string;
}

export const kudosStore = {
  getKudos: async () => {
    await connectDB();
    const docs = await KudoModel.find().sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({
      id: d._id.toString(),
      fromId: d.fromId,
      fromName: d.fromName,
      toId: d.toId,
      toName: d.toName,
      tag: d.tag,
      message: d.message,
      timestamp: d.createdAt.toISOString()
    }));
  },
  
  getRemainingKudos: async (userId: string) => {
    await connectDB();
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());
    const count = await KudoModel.countDocuments({
      fromId: userId,
      createdAt: { $gte: start, $lte: end }
    });
    return Math.max(0, 3 - count);
  },
  
  giveKudo: async (fromId: string, fromName: string, toId: string, toName: string, tag: string, message: string) => {
    await connectDB();
    
    // Anti-spam: Max 3 kudos per day
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());
    const count = await KudoModel.countDocuments({
      fromId,
      createdAt: { $gte: start, $lte: end }
    });
    
    if (count >= 3) {
      throw new Error('Daily limit reached');
    }
    
    const newDoc = await KudoModel.create({
      fromId,
      fromName,
      toId,
      toName,
      tag,
      message
    });
    
    return {
      id: newDoc._id.toString(),
      fromId: newDoc.fromId,
      fromName: newDoc.fromName,
      toId: newDoc.toId,
      toName: newDoc.toName,
      tag: newDoc.tag,
      message: newDoc.message,
      timestamp: newDoc.createdAt.toISOString()
    };
  }
};
