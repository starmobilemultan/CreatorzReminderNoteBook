import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Note } from '../types';
import { loadNotes, saveNotes } from '../services/storage';

interface NotesContextType {
  notes: Note[];
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  togglePin: (id: string) => void;
  toggleArchive: (id: string) => void;
  toggleFavorite: (id: string) => void;
  moveToTrash: (id: string) => void;
  restoreFromTrash: (id: string) => void;
  permanentDelete: (id: string) => void;
  emptyTrash: () => void;
  searchNotes: (query: string) => Note[];
  getNoteById: (id: string) => Note | undefined;
  isLoading: boolean;
}

export const NotesContext = createContext<NotesContextType | undefined>(undefined);

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInitialNotes();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      saveNotes(notes);
    }
  }, [notes, isLoading]);

  const loadInitialNotes = async () => {
    try {
      const loadedNotes = await loadNotes();
      // Migrate old notes that don't have isFavorite
      const migrated = loadedNotes.map((n: any) => ({
        isFavorite: false,
        ...n,
      }));
      setNotes(migrated);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addNote = (noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newNote: Note = {
      ...noteData,
      isFavorite: false,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotes(prev => [newNote, ...prev]);
  };

  const updateNote = (id: string, updates: Partial<Note>) => {
    setNotes(prev =>
      prev.map(note =>
        note.id === id
          ? { ...note, ...updates, updatedAt: new Date().toISOString() }
          : note
      )
    );
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(note => note.id !== id));
  };

  const togglePin = (id: string) => {
    setNotes(prev =>
      prev.map(note =>
        note.id === id
          ? { ...note, isPinned: !note.isPinned, updatedAt: new Date().toISOString() }
          : note
      )
    );
  };

  const toggleArchive = (id: string) => {
    setNotes(prev =>
      prev.map(note =>
        note.id === id
          ? {
              ...note,
              isArchived: !note.isArchived,
              isPinned: false,
              updatedAt: new Date().toISOString(),
            }
          : note
      )
    );
  };

  const toggleFavorite = (id: string) => {
    setNotes(prev =>
      prev.map(note =>
        note.id === id
          ? { ...note, isFavorite: !note.isFavorite, updatedAt: new Date().toISOString() }
          : note
      )
    );
  };

  const moveToTrash = (id: string) => {
    setNotes(prev =>
      prev.map(note =>
        note.id === id
          ? {
              ...note,
              isTrashed: true,
              isPinned: false,
              isArchived: false,
              updatedAt: new Date().toISOString(),
            }
          : note
      )
    );
  };

  const restoreFromTrash = (id: string) => {
    setNotes(prev =>
      prev.map(note =>
        note.id === id
          ? { ...note, isTrashed: false, updatedAt: new Date().toISOString() }
          : note
      )
    );
  };

  const permanentDelete = (id: string) => {
    deleteNote(id);
  };

  const emptyTrash = () => {
    setNotes(prev => prev.filter(note => !note.isTrashed));
  };

  const searchNotes = (query: string): Note[] => {
    if (!query.trim()) return notes.filter(n => !n.isTrashed);
    const lowerQuery = query.toLowerCase();
    return notes.filter(
      note =>
        !note.isTrashed &&
        (note.title.toLowerCase().includes(lowerQuery) ||
          note.content.toLowerCase().includes(lowerQuery) ||
          note.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
    );
  };

  const getNoteById = (id: string): Note | undefined => {
    return notes.find(note => note.id === id);
  };

  return (
    <NotesContext.Provider
      value={{
        notes,
        addNote,
        updateNote,
        deleteNote,
        togglePin,
        toggleArchive,
        toggleFavorite,
        moveToTrash,
        restoreFromTrash,
        permanentDelete,
        emptyTrash,
        searchNotes,
        getNoteById,
        isLoading,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}
