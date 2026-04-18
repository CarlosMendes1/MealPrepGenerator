import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Switch, TouchableOpacity, Modal, Platform,
  Alert, StyleSheet, ActivityIndicator,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Bell, BellOff } from 'lucide-react-native';
import {
  loadReminders, saveAndSchedule, requestPermission, hasPermission,
  formatTime, type MealReminder,
} from '@/services/notifications';

export function RemindersSection() {
  const [reminders, setReminders]   = useState<MealReminder[]>([]);
  const [saving, setSaving]         = useState(false);
  const [permitted, setPermitted]   = useState<boolean | null>(null);
  // Time picker state
  const [pickerTarget, setPickerTarget] = useState<MealReminder['id'] | null>(null);
  const [pickerDate, setPickerDate]     = useState(new Date());

  useEffect(() => {
    loadReminders().then(setReminders);
    hasPermission().then(setPermitted);
  }, []);

  async function persist(updated: MealReminder[]) {
    setSaving(true);
    try {
      await saveAndSchedule(updated);
      setReminders(updated);
    } finally {
      setSaving(false);
    }
  }

  async function toggleReminder(id: MealReminder['id'], value: boolean) {
    if (value && !permitted) {
      const granted = await requestPermission();
      setPermitted(granted);
      if (!granted) {
        Alert.alert(
          'Notificações bloqueadas',
          'Ativa as notificações nas definições do dispositivo para receber lembretes.',
        );
        return;
      }
    }
    const updated = reminders.map((r) => r.id === id ? { ...r, enabled: value } : r);
    await persist(updated);
  }

  function openPicker(r: MealReminder) {
    const d = new Date();
    d.setHours(r.hour, r.minute, 0, 0);
    setPickerDate(d);
    setPickerTarget(r.id);
  }

  async function onTimeChange(event: DateTimePickerEvent, date?: Date) {
    // Android: picker dismisses after selection (event type 'set' or 'dismissed')
    if (Platform.OS === 'android') {
      setPickerTarget(null);
      if (event.type !== 'set' || !date || !pickerTarget) return;
      await applyTime(pickerTarget, date);
    } else {
      // iOS: picker stays open, only update local state
      if (date) setPickerDate(date);
    }
  }

  async function applyTime(id: MealReminder['id'], date: Date) {
    const updated = reminders.map((r) =>
      r.id === id ? { ...r, hour: date.getHours(), minute: date.getMinutes() } : r
    );
    await persist(updated);
  }

  async function confirmIOSPicker() {
    if (!pickerTarget) return;
    setPickerTarget(null);
    await applyTime(pickerTarget, pickerDate);
  }

  const anyEnabled = reminders.some((r) => r.enabled);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          {anyEnabled
            ? <Bell size={14} color="#4f46e5" />
            : <BellOff size={14} color="#94a3b8" />
          }
        </View>
        <Text style={styles.headerLabel}>Lembretes de refeições</Text>
        {saving && <ActivityIndicator size={12} color="#4f46e5" style={{ marginLeft: 'auto' }} />}
      </View>
      <Text style={styles.subtitle}>
        Recebe uma notificação diária para registares cada refeição.
      </Text>

      {/* Reminder rows */}
      {reminders.map((r, i) => (
        <View key={r.id} style={[styles.row, i < reminders.length - 1 && styles.rowBorder]}>
          <Text style={styles.emoji}>{r.emoji}</Text>
          <Text style={styles.label}>{r.label}</Text>

          {/* Time button — only shown when enabled */}
          {r.enabled && (
            <TouchableOpacity
              style={styles.timePill}
              onPress={() => openPicker(r)}
              activeOpacity={0.7}
            >
              <Text style={styles.timeText}>{formatTime(r.hour, r.minute)}</Text>
            </TouchableOpacity>
          )}

          <Switch
            value={r.enabled}
            onValueChange={(v) => toggleReminder(r.id, v)}
            trackColor={{ false: '#e2e8f0', true: '#c7d2fe' }}
            thumbColor={r.enabled ? '#4f46e5' : '#f1f5f9'}
            ios_backgroundColor="#e2e8f0"
          />
        </View>
      ))}

      {/* iOS time picker modal */}
      {Platform.OS === 'ios' && pickerTarget && (
        <Modal transparent animationType="fade">
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setPickerTarget(null)} />
          <View style={styles.iosSheet}>
            <View style={styles.iosSheetHandle} />
            <Text style={styles.iosSheetTitle}>
              {reminders.find((r) => r.id === pickerTarget)?.label}
            </Text>
            <DateTimePicker
              value={pickerDate}
              mode="time"
              display="spinner"
              locale="pt-PT"
              onChange={onTimeChange}
              style={{ width: '100%' }}
            />
            <TouchableOpacity style={styles.iosConfirm} onPress={confirmIOSPicker} activeOpacity={0.85}>
              <Text style={styles.iosConfirmText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      {/* Android time picker — renders inline as dialog when target is set */}
      {Platform.OS === 'android' && pickerTarget && (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          is24Hour
          display="default"
          onChange={onTimeChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  headerIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 17,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  emoji: { fontSize: 20, width: 26, textAlign: 'center' },
  label: { flex: 1, fontSize: 14, fontWeight: '500', color: '#334155' },
  timePill: {
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4f46e5',
    fontVariant: ['tabular-nums'],
  },
  // iOS modal
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  iosSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    alignItems: 'center',
  },
  iosSheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#e2e8f0', marginBottom: 16,
  },
  iosSheetTitle: {
    fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 8,
  },
  iosConfirm: {
    marginTop: 12,
    backgroundColor: '#4f46e5',
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  iosConfirmText: {
    color: '#fff', fontWeight: '700', fontSize: 15,
  },
});
