import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type TouchableOpacityProps } from 'react-native';
import { colors, radii } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export default function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      disabled={isDisabled}
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        isDisabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'destructive' ? colors.white : colors.brand[600]}
        />
      ) : (
        <Text style={[styles.label, styles[`label_${variant}`], styles[`labelSize_${size}`]]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 44,
  },

  // Variants
  primary: {
    backgroundColor: colors.brand[600],
    shadowColor: colors.brand[600],
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  destructive: {
    backgroundColor: colors.error,
    shadowColor: colors.error,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  ghost: {
    backgroundColor: 'transparent',
  },

  disabled: { opacity: 0.5 },

  // Sizes
  size_sm: { paddingHorizontal: 14, paddingVertical: 8,  minHeight: 36 },
  size_md: { paddingHorizontal: 20, paddingVertical: 14 },
  size_lg: { paddingHorizontal: 24, paddingVertical: 18 },

  // Labels
  label: { fontWeight: '700' },
  label_primary:     { color: colors.white },
  label_secondary:   { color: colors.slate[800] },
  label_destructive: { color: colors.white },
  label_ghost:       { color: colors.brand[600] },

  labelSize_sm: { fontSize: 13 },
  labelSize_md: { fontSize: 15 },
  labelSize_lg: { fontSize: 16 },
});
