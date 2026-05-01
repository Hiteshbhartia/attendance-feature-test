import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import Attendance from '@/models/Attendance';
import { saveBase64Image } from '@/lib/image-storage';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { selfie, type } = await req.json();
    if (!selfie) return NextResponse.json({ error: 'No selfie provided' }, { status: 400 });

    await connectDB();

    const imageUrl = await saveBase64Image(selfie, `attendance/${user.id}`);

    const today = new Date();
    today.setHours(today.getHours() + 5);
    today.setMinutes(today.getMinutes() + 30);
    const dateStr = today.toISOString().split('T')[0];

    const att = await Attendance.findOne({ employeeId: user.id, date: dateStr });

    if (att) {
      if (type === 'checkin') {
        att.sessions.push({
          type: 'work',
          checkIn: new Date(),
          selfieUrl: imageUrl,
          status: 'active'
        });
        att.isCheckedIn = true;
      }
      await att.save();
    }

    return NextResponse.json({ ok: true, url: imageUrl });
  } catch (err: any) {
    console.error('Selfie upload error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
