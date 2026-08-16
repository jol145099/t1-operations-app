import { PropsWithChildren } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle
} from 'react-native'

export const colors = {
  bg: '#07111d',
  panel: '#0d1a2a',
  panel2: '#11243a',
  text: '#f3f7fb',
  muted: '#9fb0c2',
  accent: '#56d6e8',
  danger: '#ff7b87',
  success: '#67d391',
  border: '#1e3853'
}

export function Screen({ children }: PropsWithChildren) {
  return <View style={styles.screen}>{children}</View>
}

export function Card({
  children,
  style
}: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[styles.input, props.style]}
    />
  )
}

export function Button({
  title,
  onPress,
  disabled,
  tone = 'accent'
}: {
  title: string
  onPress: () => void
  disabled?: boolean
  tone?: 'accent' | 'danger' | 'neutral'
}) {
  const backgroundColor =
    tone === 'danger' ? colors.danger : tone === 'neutral' ? colors.panel2 : colors.accent

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, { backgroundColor }, disabled && { opacity: 0.5 }]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  )
}

export function H1({ children }: PropsWithChildren) {
  return <Text style={styles.h1}>{children}</Text>
}

export function H2({ children }: PropsWithChildren) {
  return <Text style={styles.h2}>{children}</Text>
}

export function Muted({ children }: PropsWithChildren) {
  return <Text style={styles.muted}>{children}</Text>
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 20,
    gap: 16
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10
  },
  input: {
    backgroundColor: colors.panel2,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18
  },
  buttonText: {
    color: '#051018',
    fontWeight: '800',
    fontSize: 16
  },
  h1: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800'
  },
  h2: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700'
  },
  muted: {
    color: colors.muted,
    lineHeight: 20
  }
})
