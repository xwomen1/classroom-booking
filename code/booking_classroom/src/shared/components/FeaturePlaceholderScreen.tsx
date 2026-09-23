import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type FeaturePlaceholderScreenProps = {
  title: string;
  onBack: () => void;
};

export function FeaturePlaceholderScreen({
  title,
  onBack,
}: FeaturePlaceholderScreenProps) {
  return (
    <View style={styles.page} testID="feature-placeholder-screen">
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          testID="feature-back-button"
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.emptyContent} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4F7FB' },
  header: {
    alignItems: 'center',
    borderBottomColor: '#E1E6EE',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 60,
    paddingHorizontal: 16,
  },
  backButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  backText: { color: '#B01432', fontSize: 36, lineHeight: 38 },
  title: {
    color: '#172033',
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerSpacer: { width: 42 },
  emptyContent: { flex: 1 },
  pressed: { opacity: 0.65 },
});
