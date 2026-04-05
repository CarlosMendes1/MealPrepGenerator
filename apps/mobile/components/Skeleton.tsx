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

// ── Meal card skeleton — mirrors MealCard layout ──────────────────────────────

function MealCardSkeleton({ showFoodTags = true }: { showFoodTags?: boolean }) {
  return (
    <View style={mealCardSk.card}>
      {/* Photo + info row */}
      <View style={mealCardSk.row}>
        {/* Photo placeholder */}
        <SkeletonPulse width={112} height={112} radius={12} />

        {/* Right side */}
        <View style={mealCardSk.info}>
          {/* Time + status badge */}
          <View style={mealCardSk.topRow}>
            <SkeletonPulse width={60} height={11} radius={4} />
            <SkeletonPulse width={90} height={18} radius={10} />
          </View>

          {/* Meal type label */}
          <SkeletonPulse width={100} height={14} radius={5} style={{ marginBottom: 10 }} />

          {/* Macro badges row */}
          <View style={mealCardSk.macroRow}>
            <SkeletonPulse width={46} height={36} radius={8} />
            <SkeletonPulse width={46} height={36} radius={8} />
            <SkeletonPulse width={46} height={36} radius={8} />
          </View>
        </View>
      </View>

      {/* Food tags row */}
      {showFoodTags && (
        <View style={mealCardSk.tagsRow}>
          <SkeletonPulse width={64}  height={20} radius={10} />
          <SkeletonPulse width={80}  height={20} radius={10} />
          <SkeletonPulse width={56}  height={20} radius={10} />
          <SkeletonPulse width={72}  height={20} radius={10} />
        </View>
      )}
    </View>
  );
}

const mealCardSk = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  info: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
});

// ── Meals screen skeleton ─────────────────────────────────────────────────────

export function MealsSkeleton() {
  return (
    <View style={styles.container}>
      {/* Screen header */}
      <SkeletonPulse height={28} width={200} radius={7} style={styles.mb4} />

      {/* Day 1 — Hoje */}
      <View style={styles.dayLabelRow}>
        <SkeletonPulse width={90} height={11} radius={4} />
        <View style={styles.dayLine} />
      </View>

      {/* Meal type label row */}
      <View style={styles.typeLabelRow}>
        <SkeletonPulse width={16} height={16} radius={8} />
        <SkeletonPulse width={80} height={11} radius={4} />
      </View>
      <MealCardSkeleton showFoodTags />

      <View style={styles.typeLabelRow}>
        <SkeletonPulse width={16} height={16} radius={8} />
        <SkeletonPulse width={60} height={11} radius={4} />
      </View>
      <MealCardSkeleton showFoodTags={false} />

      {/* Spacer */}
      <View style={{ height: 16 }} />

      {/* Day 2 — Ontem */}
      <View style={styles.dayLabelRow}>
        <SkeletonPulse width={70} height={11} radius={4} />
        <View style={styles.dayLine} />
      </View>

      <View style={styles.typeLabelRow}>
        <SkeletonPulse width={16} height={16} radius={8} />
        <SkeletonPulse width={100} height={11} radius={4} />
      </View>
      <MealCardSkeleton showFoodTags />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
  row:          { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard:     { flex: 1, width: undefined },
  mb3:          { marginBottom: 12 },
  mb4:          { marginBottom: 20 },
  dayLabelRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  dayLine:      { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  typeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
});
