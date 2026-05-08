import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export function TradeExchangeIcon({ color = '#0F172A', size = 24, strokeWidth = 2.2 }: { color?: string; size?: number; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth * 0.72} opacity={0.16} />
      <Path d="M7 9h9.25m0 0-2.6-2.6M16.25 9l-2.6 2.6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M17 15H7.75m0 0 2.6-2.6M7.75 15l2.6 2.6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
