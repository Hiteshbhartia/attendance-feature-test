'use client';
/**
 * components/org-entity-manager.tsx
 *
 * Reusable admin UI for managing Teams or Departments.
 * Used in admin settings under the "Organization" tab.
 *
 * Props:
 *   entityType: 'team' | 'department'
 *   apiPath:    '/api/teams' | '/api/departments'
 *   label:      'Team' | 'Department'
 *   examples:   string[]  — shown as placeholder hints
 */

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X, AlertCircle, Users } from 'lucide-react';

interface OrgEntity {
  _id: string;
  name: string;
  description?: string;
  color: string;
  memberCount: number;
}

const PRESET_COLORS = [
  '#6366f1', '#f97316', '#10b981', '#a855f7',
  '#f59e0b', '#ef4444', '#3b82f6', '#ec4899',
  '#14b8a6', '#6b7280',
];

interface Props {
  entityType: 'team' | 'department';
  apiPath: string;
  label: string;
  examples?: string[];
}

export default function OrgEntityManager({ entityType, apiPath, label, examples = [] }: Props) {
  const [items, setItems]     = useState<OrgEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]         = useState<{ text: string; ok: boolean } | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState('');
  const [newDesc, setNewDesc]       = useState('');
  const [newColor, setNewColor]     = useState(PRESET_COLORS[0]);
  const [creating, setCreating]     = useState(false);

  // Inline edit
  const [editId, setEditId]     = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving]     = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  const fetchItems = useCallback(() => {
    setLoading(true);
    fetch(apiPath)
      .then(r => r.json())
      .then(d => {
        const key = entityType === 'team' ? 'teams' : 'departments';
        if (d[key]) setItems(d[key]);
        else if (d.error) flash(d.error, false);
      })
      .catch(() => flash(`Failed to load ${label.toLowerCase()}s`, false))
      .finally(() => setLoading(false));
  }, [apiPath, entityType, label]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), color: newColor }),
      });
      const d = await r.json();
      if (d.ok) {
        flash(`${label} "${newName.trim()}" created`, true);
        setNewName(''); setNewDesc(''); setNewColor(PRESET_COLORS[0]);
        setShowCreate(false);
        fetchItems();
      } else {
        flash(d.error || `Failed to create ${label.toLowerCase()}`, false);
      }
    } catch { flash('Network error', false); }
    setCreating(false);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`${apiPath}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() }),
      });
      const d = await r.json();
      if (d.ok) {
        flash('Saved', true);
        setEditId(null);
        fetchItems();
      } else {
        flash(d.error || 'Failed to save', false);
      }
    } catch { flash('Network error', false); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const r = await fetch(`${apiPath}/${id}`, { method: 'DELETE' });
      const d = await r.json();
      if (d.ok) {
        flash(d.message || 'Archived', true);
        setDeleteId(null);
        fetchItems();
      } else {
        flash(d.error || 'Failed to archive', false);
        setDeleteId(null);
      }
    } catch { flash('Network error', false); }
    setDeleting(false);
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-200 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900">{label}s</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {items.length} active · used in hierarchy assignment
          </p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white transition"
          style={{ background: '#f97316' }}
        >
          <Plus className="w-3.5 h-3.5" />
          New {label}
        </button>
      </div>

      {/* Flash */}
      {msg && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
          style={{
            background: msg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            color: msg.ok ? '#10b981' : '#ef4444',
          }}
        >
          {msg.ok ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {msg.text}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-2xl border border-indigo-200 p-4 space-y-3"
          style={{ background: 'rgba(99,102,241,0.03)' }}>
          <p className="text-xs font-semibold text-indigo-600">New {label}</p>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder={examples.length ? `e.g. ${examples[0]}` : `${label} name`}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            autoFocus
          />
          <input
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {/* Color picker */}
          <div>
            <p className="text-[10px] text-gray-400 mb-1.5 uppercase tracking-wide font-semibold">Color</p>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className="w-6 h-6 rounded-full transition ring-offset-1"
                  style={{
                    background: c,
                    outline: newColor === c ? `2px solid ${c}` : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>
          {/* Examples hint */}
          {examples.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {examples.map(ex => (
                <button
                  key={ex}
                  onClick={() => setNewName(ex)}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50 transition"
              style={{ background: '#6366f1' }}
            >
              {creating ? 'Creating…' : `Create ${label}`}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); }}
              className="px-4 py-2 rounded-xl text-xs text-gray-500 border border-gray-200 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-gray-100" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No {label.toLowerCase()}s yet — create one above
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div
              key={item._id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 hover:border-gray-200 transition"
            >
              {/* Color dot */}
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.color }} />

              {/* Name / edit */}
              {editId === item._id ? (
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(item._id); if (e.key === 'Escape') setEditId(null); }}
                  className="flex-1 border border-indigo-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  autoFocus
                />
              ) : (
                <span className="flex-1 text-sm font-medium text-gray-800">{item.name}</span>
              )}

              {/* Member count */}
              <span className="flex items-center gap-1 text-[10px] text-gray-400 flex-shrink-0">
                <Users className="w-3 h-3" />
                {item.memberCount}
              </span>

              {/* Actions */}
              {editId === item._id ? (
                <div className="flex gap-1">
                  <button
                    onClick={() => handleSaveEdit(item._id)}
                    disabled={saving}
                    className="w-6 h-6 flex items-center justify-center rounded-lg"
                    style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100"
                    style={{ color: '#6b7280' }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : deleteId === item._id ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-red-500">Archive?</span>
                  <button
                    onClick={() => handleDelete(item._id)}
                    disabled={deleting}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                  >
                    {deleting ? '…' : 'Yes'}
                  </button>
                  <button
                    onClick={() => setDeleteId(null)}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                  >
                    No
                  </button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditId(item._id); setEditName(item.name); setEditDesc(item.description || ''); }}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 transition"
                    style={{ color: '#9ca3af' }}
                    title="Rename"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setDeleteId(item._id)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 transition"
                    style={{ color: '#fca5a5' }}
                    title={item.memberCount > 0 ? `${item.memberCount} members assigned` : 'Archive'}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
