'use client';
import { useEffect, useState } from 'react';
import { redirect } from 'next/navigation';

const CURRENT_YEAR = new Date().getFullYear();

export default function EmployeeTrackerPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [weekNumber, setWeekNumber] = useState(getCurrentWeek());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [form, setForm] = useState({
    g1: { target: 0, actual: 0, notes: '' },
    g2: { target: 0, actual: 0, notes: '' },
    g3: { target: 0, actual: 0, notes: '' },
    g4: { target: 0, actual: 0, notes: '' },
    glTours: { target: 0, actual: 0, locations: '' },
    selfRating: 0,
    selfNotes: '',
  });

  useEffect(() => { fetchData(); }, [year, weekNumber]);

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch(`/api/tracker?year=${year}&week=${weekNumber}`);
    const d = await res.json();
    if (d.success && d.data && d.data[0]) {
      const rec = d.data[0];
      setData(rec);
      setForm({
        g1: rec.g1 || { target: 0, actual: 0, notes: '' },
        g2: rec.g2 || { target: 0, actual: 0, notes: '' },
        g3: rec.g3 || { target: 0, actual: 0, notes: '' },
        g4: rec.g4 || { target: 0, actual: 0, notes: '' },
        glTours: rec.glTours || { target: 0, actual: 0, locations: '' },
        selfRating: rec.selfRating || 0,
        selfNotes: rec.selfNotes || '',
      });
    } else {
      setData(null);
    }
    setLoading(false);
  };

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async (status: 'draft' | 'submitted') => {
    setSaving(true);
    const res = await fetch('/api/tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, weekNumber, ...form, status }),
    });
    const d = await res.json();
    if (d.success) {
      showToast(status === 'submitted' ? 'Week submitted for review' : 'Saved as draft');
      fetchData();
    } else {
      showToast(d.error || 'Failed to save', false);
    }
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto bg-gray-50 min-h-screen">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-white text-sm ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>{toast.msg}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Weekly Performance Tracker</h1>
        <p className="text-sm text-gray-500 mb-4">Track G1-G4 goals, site visits, and self-assessment</p>

        <div className="flex gap-3 mb-4">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 border rounded-lg">
            {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={weekNumber} onChange={e => setWeekNumber(Number(e.target.value))} className="px-3 py-2 border rounded-lg">
            {Array.from({ length: 44 }, (_, i) => i + 1).map(w => <option key={w} value={w}>Week {w}</option>)}
          </select>
        </div>

        {data?.status && (
          <div className={`text-xs px-3 py-1.5 rounded-full inline-block ${
            data.status === 'reviewed' ? 'bg-green-100 text-green-700' :
            data.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          }`}>{data.status}</div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-4">
          {(['g1', 'g2', 'g3', 'g4'] as const).map((g, i) => (
            <div key={g} className="bg-white rounded-xl border p-4">
              <div className="font-semibold text-gray-800 mb-3">Goal {i + 1} (G{i + 1})</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Target</label>
                  <input type="number" value={form[g].target} onChange={e => setForm(f => ({ ...f, [g]: { ...f[g], target: Number(e.target.value) } }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Actual</label>
                  <input type="number" value={form[g].actual} onChange={e => setForm(f => ({ ...f, [g]: { ...f[g], actual: Number(e.target.value) } }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Notes</label>
                  <input type="text" value={form[g].notes} onChange={e => setForm(f => ({ ...f, [g]: { ...f[g], notes: e.target.value } }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Optional" />
                </div>
              </div>
            </div>
          ))}

          <div className="bg-white rounded-xl border p-4">
            <div className="font-semibold text-gray-800 mb-3">GL Tours (Site Visits)</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Target Visits</label>
                <input type="number" value={form.glTours.target} onChange={e => setForm(f => ({ ...f, glTours: { ...f.glTours, target: Number(e.target.value) } }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Actual Visits</label>
                <input type="number" value={form.glTours.actual} onChange={e => setForm(f => ({ ...f, glTours: { ...f.glTours, actual: Number(e.target.value) } }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Locations</label>
                <input type="text" value={form.glTours.locations} onChange={e => setForm(f => ({ ...f, glTours: { ...f.glTours, locations: e.target.value } }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Kora, MWB" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-4">
            <div className="font-semibold text-gray-800 mb-3">Self-Assessment</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Rating (1-5)</label>
                <input type="number" min="0" max="5" value={form.selfRating} onChange={e => setForm(f => ({ ...f, selfRating: Number(e.target.value) }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Notes</label>
                <input type="text" value={form.selfNotes} onChange={e => setForm(f => ({ ...f, selfNotes: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Your comments" />
              </div>
            </div>
          </div>

          {data?.isGoodWeek !== undefined && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="text-sm font-semibold text-gray-800 mb-2">Admin Review</div>
              <div className="text-xs text-gray-700">
                <div>Good Week: {data.isGoodWeek ? '✅ Yes' : '❌ No'}</div>
                {data.adminNotes && <div className="mt-1">Notes: {data.adminNotes}</div>}
                {data.impact && <div className="mt-1">Impact: {data.impact}</div>}
                {data.issues && <div className="mt-1">Issues: {data.issues}</div>}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => handleSave('draft')} disabled={saving} className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium">Save Draft</button>
            <button onClick={() => handleSave('submitted')} disabled={saving} className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-medium">Submit Week</button>
          </div>
        </div>
      )}
    </div>
  );
}

function getCurrentWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.ceil(diff / oneWeek);
}
