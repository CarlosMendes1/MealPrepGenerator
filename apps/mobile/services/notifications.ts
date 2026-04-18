import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Show notification even when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface MealReminder {
  id: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  label: string;
  emoji: string;
  enabled: boolean;
  hour: number;
  minute: number;
}

const DEFAULTS: MealReminder[] = [
  { id: 'breakfast', label: 'Pequeno-almoço', emoji: '🌅', enabled: false, hour: 8,  minute: 0  },
  { id: 'lunch',     label: 'Almoço',         emoji: '☀️', enabled: false, hour: 13, minute: 0  },
  { id: 'snack',     label: 'Lanche',          emoji: '🍎', enabled: false, hour: 16, minute: 30 },
  { id: 'dinner',    label: 'Jantar',          emoji: '🌙', enabled: false, hour: 19, minute: 30 },
];

const STORAGE_KEY = 'meal_reminders_v1';

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('meal-reminders', {
    name: 'Lembretes de refeições',
    description: 'Lembretes diários para registar as tuas refeições',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4f46e5',
  });
}

export async function requestPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function hasPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

export async function loadReminders(): Promise<MealReminder[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const saved = JSON.parse(raw) as MealReminder[];
    return DEFAULTS.map((d) => saved.find((s) => s.id === d.id) ?? d);
  } catch {
    return DEFAULTS;
  }
}

export async function saveAndSchedule(reminders: MealReminder[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  await ensureAndroidChannel();

  for (const r of reminders) {
    const identifier = `meal-reminder-${r.id}`;
    await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});

    if (r.enabled) {
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: `${r.emoji} ${r.label}`,
          body: 'Hora de registar a tua refeição!',
          sound: true,
          data: { type: 'meal_reminder', mealId: r.id },
          ...(Platform.OS === 'android' ? { channelId: 'meal-reminders' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: r.hour,
          minute: r.minute,
        },
      });
    }
  }
}

export async function cancelAllReminders(): Promise<void> {
  for (const r of DEFAULTS) {
    await Notifications.cancelScheduledNotificationAsync(`meal-reminder-${r.id}`).catch(() => {});
  }
}

export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
