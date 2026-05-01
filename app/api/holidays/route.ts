import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Holiday from '@/models/Holiday';
import { getAuthUser } from '@/lib/auth';

// GET /api/holidays?year=2026&orgId=xxx
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear();
    const orgId = searchParams.get('orgId');
    const type = searchParams.get('type');

    const filter: Record<string, unknown> = { year, isActive: true };
    if (orgId) filter.orgId = orgId;
    if (type) filter.type = type;

    const holidays = await Holiday.find(filter).sort({ date: 1 }).lean();
    return NextResponse.json({ success: true, data: holidays });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Failed to fetch holidays' }, { status: 500 });
  }
}

// POST /api/holidays — admin only
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'sub_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const body = await req.json();
    const { name, date, year, type, description, orgId } = body;

    if (!name || !date || !year || !orgId) {
      return NextResponse.json({ success: false, error: 'name, date, year, orgId are required' }, { status: 400 });
    }

    const holiday = await Holiday.create({
      orgId,
      name,
      date,
      year,
      type: type || 'national',
      description,
      createdBy: user.id,
      isActive: true,
    });

    return NextResponse.json({ success: true, data: holiday }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create holiday';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/holidays?id=xxx — admin only (soft delete)
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'sub_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    await Holiday.findByIdAndUpdate(id, { isActive: false });
    return NextResponse.json({ success: true, message: 'Holiday removed' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete holiday' }, { status: 500 });
  }
}
