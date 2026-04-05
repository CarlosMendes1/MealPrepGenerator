import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';

interface Props {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: object;
}

export function SkeletonPulse({ width, height = 16, radius = 10, style }: Props) {
  const anim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.75, duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        { backgroundColor: '#e2e8f0', borderRadius: radius, height, opacity: anim },
        width !== undefined ? { width } : { flex: 1 },
        style,
      ]}
    />
  );
}

// ── Home skeleton ─────────────────────────────────────────────────────────────

export function HomeSkeleton() {
  return (
    <View style={styles.container}>
      {/* Hero card */}
      <SkeletonPulse height={88} radius={24} style={styles.mb4} />

      {/* Row 1: refeições + kcal */}
      <View style={styles.row}>
        <SkeletonPulse height={84} radius={16} style={styles.statCard} />
        <SkeletonPulse height={84} radius={16} style={styles.statCard} />
      </View>

      {/* Row 2: macros */}
      <View style={styles.row}>
        <SkeletonPulse height={76} radius={16} style={styles.statCard} />
        <SkeletonPulse height={76} radius={16} style={styles.statCard} />
        <SkeletonPulse height={76} radius={16} style={styles.statCard} />
      </View>

      {/* CTA button */}
      <SkeletonPulse height={76} radius={20} style={styles.mb4} />

      {/* Section label */}
      <SkeletonPulse height={16} width={140} radius={6} style={styles.mb3} />

      {/* Meal cards */}
      <SkeletonPulse height={96} radius={20} style={styles.mb3} />
      <SkeletonPulse height={96} radius={20} style={styles.mb3} />
    </View>
  );
}

// ── Meals skeleton ────────────────────────────────────────────────────────────

export function MealsSkeleton() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <SkeletonPulse height={28} width={140} radius={8} style={styles.mb3} />
      <SkeletonPulse height={14} width={200} radius={6} style={styles.mb4} />

      {/* Day group */}
      <SkeletonPulse height={12} width={100} radius={4} style={styles.mb3} />
      <SkeletonPulse height={96} radius={20} style={styles.mb3} />
      <SkeletonPulse height={96} radius={20} style={styles.mb3} />

      {/* Day group 2 */}
      <SkeletonPulse height={12} width={80} radius={4} style={styles.mb3} />
      <SkeletonPulse height={96} radius={20} style={styles.mb3} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 20 },
  row:       { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard:  { flex: 1, width: undefined },
  mb3:       { marginBottom: 12 },
  mb4:       { marginBottom: 16 },
});
