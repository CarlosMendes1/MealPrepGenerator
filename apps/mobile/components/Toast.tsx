import { useEffect, useRef } from 'react';
import { Animated, Text } from 'react-native';
import { CheckCircle, AlertCircle, Info } from 'lucide-react-native';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
  onHide: () => void;
}

const STYLES: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', icon: '#16a34a' },
  error:   { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', icon: '#ef4444' },
  info:    { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: '#3b82f6' },
};

const ICON_MAP = { success: CheckCircle, error: AlertCircle, info: Info };

export default function Toast({ message, type = 'info', visible, onHide }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -16, duration: 180, useNativeDriver: true }),
      ]).start(onHide);
    }, 3000);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  const s = STYLES[type];
  const Icon = ICON_MAP[type];

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 56,
        left: 16,
        right: 16,
        zIndex: 999,
        opacity,
        transform: [{ translateY }],
        backgroundColor: s.bg,
        borderWidth: 1,
        borderColor: s.border,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      <Icon size={18} color={s.icon} />
      <Text style={{ flex: 1, color: s.text, fontSize: 14, fontWeight: '500', lineHeight: 20 }}>
        {message}
      </Text>
    </Animated.View>
  );
}
