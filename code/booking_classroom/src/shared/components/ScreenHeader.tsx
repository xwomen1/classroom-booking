import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type ScreenHeaderProps = {
  title: string;
  onBack: () => void;
  actionLabel?: string;
  onAction?: () => void;
};

export function ScreenHeader({
  title,
  onBack,
  actionLabel,
  onAction,
}: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Quay lại"
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.side, pressed && styles.pressed]}
      >
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <Pressable
        accessibilityRole={onAction ? 'button' : undefined}
        disabled={!onAction}
        onPress={onAction}
        style={({ pressed }) => [styles.side, pressed && styles.pressed]}
      >
        <Text style={styles.actionText}>{actionLabel ?? ''}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E1E6EE',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 60,
    paddingHorizontal: 10,
  },
  side: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 54,
  },
  backText: { color: '#B01432', fontSize: 36, lineHeight: 38 },
  title: {
    color: '#172033',
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  actionText: { color: '#B01432', fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.6 },
});
