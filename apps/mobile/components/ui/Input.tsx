import { useState } from 'react';
import {
  StyleSheet, Text, TextInput, TouchableOpacity, View,
  type TextInputProps,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors, radii } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export default function Input({ label, error, secureTextEntry, style, ...rest }: InputProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = secureTextEntry === true;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={styles.label}>{label}</Text>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          placeholderTextColor={colors.slate[400]}
          style={[
            styles.input,
            isPassword && styles.inputWithEye,
            error ? styles.inputError : null,
            style,
          ]}
          secureTextEntry={isPassword && !visible}
          {...rest}
        />
        {isPassword && (
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setVisible((v) => !v)}
            accessibilityLabel={visible ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
            accessibilityRole="button"
          >
            {visible
              ? <EyeOff size={18} color={colors.slate[400]} />
              : <Eye    size={18} color={colors.slate[400]} />
            }
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: { position: 'relative' },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.slate[900],
    minHeight: 50,
  },
  inputWithEye: { paddingRight: 48 },
  inputError:   { borderColor: colors.error },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
    minHeight: 44,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 2,
  },
});
