import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Lock, Sparkles, Zap, ArrowRight, X } from 'lucide-react-native';
import { router } from 'expo-router';

interface Props {
  visible: boolean;
  onClose: () => void;
  mealsToday: number;
  limit: number;
}

const FEATURES = [
  { icon: '∞', label: 'Refeições ilimitadas por dia' },
  { icon: '🤖', label: 'Coach AI 24/7 com respostas em tempo real' },
  { icon: '📊', label: 'Análise detalhada de macros e calorias' },
  { icon: '🎯', label: 'Sugestões personalizadas ao teu objetivo' },
  { icon: '📈', label: 'Relatórios de progresso semanais' },
];

export function PaywallModal({ visible, onClose, mealsToday, limit }: Props) {
  function handleActivate() {
    onClose();
    router.push('/(tabs)/coach');
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={18} color="#94a3b8" />
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.iconCircle}>
            <Lock size={28} color="#fff" />
          </View>

          {/* Title */}
          <Text style={styles.title}>Limite diário atingido</Text>
          <Text style={styles.subtitle}>
            Usaste as tuas {limit} refeições gratuitas de hoje.{'\n'}
            Ativa o NutriCoach Premium para registares sem limites.
          </Text>

          {/* Counter pill */}
          <View style={styles.counterPill}>
            <Text style={styles.counterText}>{mealsToday}/{limit} refeições hoje</Text>
          </View>

          {/* Features */}
          <View style={styles.featuresBox}>
            <View style={styles.featuresHeader}>
              <Sparkles size={14} color="#4f46e5" />
              <Text style={styles.featuresTitle}>NutriCoach Premium inclui</Text>
            </View>
            {FEATURES.map((f) => (
              <View key={f.label} style={styles.featureRow}>
                <View style={styles.featureCheck}>
                  <Text style={styles.featureCheckIcon}>✓</Text>
                </View>
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={styles.priceMain}>7 dias grátis</Text>
            <Text style={styles.priceSub}> · depois €9/mês</Text>
          </View>

          {/* CTA */}
          <TouchableOpacity style={styles.cta} onPress={handleActivate} activeOpacity={0.85}>
            <Zap size={16} color="#fff" />
            <Text style={styles.ctaText}>Ativar NutriCoach Premium</Text>
            <ArrowRight size={16} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.skipBtn}>
            <Text style={styles.skipText}>Continuar grátis</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    alignItems: 'center',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#e2e8f0', marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 20,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#4f46e5',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#4f46e5', shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  title: {
    fontSize: 22, fontWeight: '800', color: '#0f172a',
    marginBottom: 8, textAlign: 'center',
  },
  subtitle: {
    fontSize: 14, color: '#64748b', textAlign: 'center',
    lineHeight: 22, marginBottom: 16,
  },
  counterPill: {
    backgroundColor: '#fef2f2', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, marginBottom: 20,
  },
  counterText: {
    fontSize: 13, fontWeight: '700', color: '#ef4444',
  },
  featuresBox: {
    width: '100%', backgroundColor: '#f8fafc',
    borderRadius: 16, padding: 16, marginBottom: 20,
  },
  featuresHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12,
  },
  featuresTitle: {
    fontSize: 12, fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8,
  },
  featureCheck: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center',
  },
  featureCheckIcon: {
    fontSize: 11, fontWeight: '800', color: '#16a34a',
  },
  featureLabel: {
    fontSize: 14, color: '#334155', flex: 1,
  },
  priceRow: {
    flexDirection: 'row', alignItems: 'baseline', marginBottom: 16,
  },
  priceMain: {
    fontSize: 18, fontWeight: '800', color: '#0f172a',
  },
  priceSub: {
    fontSize: 14, color: '#94a3b8',
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#4f46e5', borderRadius: 16,
    paddingHorizontal: 24, paddingVertical: 16,
    width: '100%', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#4f46e5', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  skipBtn: { paddingVertical: 8 },
  skipText: { fontSize: 14, color: '#94a3b8' },
});
