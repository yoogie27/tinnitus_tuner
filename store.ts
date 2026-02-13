import { UserSettings, TherapyId } from './types';

const KEY = 'tinnitus_therapy_v2';

const DEFAULTS: UserSettings = {
  tinnitusFrequency: null,
  disclaimerAccepted: false,
  wizardCompleted: false,
  volume: 0.12,
  lastTherapy: null,
  therapyParams: {},
};

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch: Partial<UserSettings>): UserSettings {
  const current = loadSettings();
  const merged = { ...current, ...patch };
  localStorage.setItem(KEY, JSON.stringify(merged));
  return merged;
}

export function saveTherapyParam(
  therapyId: TherapyId,
  key: string,
  value: number | string | boolean,
): void {
  const s = loadSettings();
  const existing = s.therapyParams[therapyId] ?? {};
  s.therapyParams = { ...s.therapyParams, [therapyId]: { ...existing, [key]: value } };
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function getTherapyParam<T extends number | string | boolean>(
  therapyId: TherapyId,
  key: string,
  fallback: T,
): T {
  const s = loadSettings();
  const v = s.therapyParams[therapyId]?.[key];
  return (v !== undefined ? v : fallback) as T;
}

export function resetSettings(): void {
  localStorage.removeItem(KEY);
}
