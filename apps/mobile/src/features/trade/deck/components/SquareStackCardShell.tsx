import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

type Props = {
  size: number;
  children: React.ReactNode;
};

export function SquareStackCardShell({ size, children }: Props) {
  const radius = Math.max(24, Math.round(size * 0.075));

  return (
    <View style={[styles.card, { width: size, height: size, borderRadius: radius }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? ({ willChange: 'transform' } as any) : null),
  },
});
