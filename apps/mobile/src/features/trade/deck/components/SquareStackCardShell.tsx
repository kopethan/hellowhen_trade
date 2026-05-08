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
      <View pointerEvents="none" style={[styles.innerFrame, { borderRadius: Math.max(0, radius - 2) }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.86)',
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? ({ willChange: 'transform' } as any) : null),
  },
  innerFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.1)',
  },
});
