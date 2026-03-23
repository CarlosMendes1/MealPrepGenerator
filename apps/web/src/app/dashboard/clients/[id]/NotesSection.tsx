'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';

interface Note {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface NotesSectionProps {
  clientId: string;
  initialNotes: Note[];
  token: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function NotesSection({ clientId, initialNotes, token }: NotesSectionProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [newContent, setNewContent] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  async function addNote() {
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/clients/${clientId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: newContent.trim() }),
      });
      if (!res.ok) throw new Error();
      const note: Note = await res.json();
      setNotes([note, ...notes]);
      setNewContent('');
      setAdding(false);
    } catch {
      alert('Erro ao guardar nota.');
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(noteId: string) {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/clients/${clientId}/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      if (!res.ok) throw new Error();
      const updated: Note = await res.json();
      setNotes(notes.map((n) => (n.id === noteId ? updated : n)));
      setEditingId(null);
    } catch {
      alert('Erro ao atualizar nota.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    if (!confirm('Eliminar esta nota?')) return;
    try {
      await fetch(`${API_URL}/api/clients/${clientId}/notes/${noteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotes(notes.filter((n) => n.id !== noteId));
    } catch {
      alert('Erro ao eliminar nota.');
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">Notas internas</h2>
          <p className="text-xs text-gray-400 mt-0.5">Visíveis apenas por si</p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            <Plus size={15} /> Adicionar nota
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-4">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Escreve a tua nota aqui..."
            rows={3}
            maxLength={2000}
            className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300"
            autoFocus
          />
          <div className="flex gap-2 mt-2 justify-end">
            <button
              onClick={() => { setAdding(false); setNewContent(''); }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
            >
              <X size={14} /> Cancelar
            </button>
            <button
              onClick={addNote}
              disabled={saving || !newContent.trim()}
              className="flex items-center gap-1 text-sm bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              <Check size={14} /> Guardar
            </button>
          </div>
        </div>
      )}

      {notes.length === 0 && !adding ? (
        <p className="text-sm text-gray-400 py-4 text-center">Sem notas ainda.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="bg-gray-50 rounded-lg p-4">
              {editingId === note.id ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2 justify-end">
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
                    >
                      <X size={14} /> Cancelar
                    </button>
                    <button
                      onClick={() => saveEdit(note.id)}
                      disabled={saving || !editContent.trim()}
                      className="flex items-center gap-1 text-sm bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                    >
                      <Check size={14} /> Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <p className="flex-1 text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {new Date(note.updated_at !== note.created_at ? note.updated_at : note.created_at).toLocaleString('pt-PT')}
                {note.updated_at !== note.created_at && ' (editado)'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
