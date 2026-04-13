import { RingtoneOption } from '../types';

// Built-in alarm ringtones (free CDN audio)
export const BUILT_IN_RINGTONES: RingtoneOption[] = [
  {
    id: 'classic_alarm',
    label: 'Classic Alarm',
    uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869.mp3',
    isBuiltIn: true,
  },
  {
    id: 'digital_beep',
    label: 'Digital Beep',
    uri: 'https://assets.mixkit.co/active_storage/sfx/209/209.mp3',
    isBuiltIn: true,
  },
  {
    id: 'gentle_chime',
    label: 'Gentle Chime',
    uri: 'https://assets.mixkit.co/active_storage/sfx/2872/2872.mp3',
    isBuiltIn: true,
  },
  {
    id: 'urgent_alert',
    label: 'Urgent Alert',
    uri: 'https://assets.mixkit.co/active_storage/sfx/1/1.mp3',
    isBuiltIn: true,
  },
];

export const DEFAULT_RINGTONE_ID = 'classic_alarm';

export function getRingtoneById(
  id: string,
  customRingtones: RingtoneOption[] = []
): RingtoneOption {
  const all = [...BUILT_IN_RINGTONES, ...customRingtones];
  return all.find(r => r.id === id) ?? BUILT_IN_RINGTONES[0];
}

export function getAllRingtones(customRingtones: RingtoneOption[] = []): RingtoneOption[] {
  return [...BUILT_IN_RINGTONES, ...customRingtones];
}
