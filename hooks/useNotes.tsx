import { useContext } from 'react';
import { NotesContext } from '../contexts/NotesContext';

export function useNotes() {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within NotesProvider');
  }
  return context;
}
