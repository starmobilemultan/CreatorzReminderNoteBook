import { useContext } from 'react';
import { RemindersContext } from '../contexts/RemindersContext';

export function useReminders() {
  const context = useContext(RemindersContext);
  if (!context) {
    throw new Error('useReminders must be used within RemindersProvider');
  }
  return context;
}
