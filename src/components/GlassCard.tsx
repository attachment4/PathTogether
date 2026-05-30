import React from 'react';
import { View } from 'react-native';
import { Theme } from '../theme';

interface Props {
  children: React.ReactNode;
  style?: any;
  intensity?: number;
  tk: Theme;
  theme: 'dark' | 'light';
  borderRadius?: number;
  padding?: number;
}

export function GlassCard({ children, style, tk, theme, borderRadius = 18, padding }: Props) {
  const inner = padding !== undefined ? { padding } : {};
  return (
    <View style={[{
      borderRadius,
      backgroundColor: tk.bg2,
      borderWidth: 1,
      borderColor: tk.cardBorder,
      overflow: 'hidden',
      // iOS shadow только — без elevation чтобы не было артефактов при скролле
      shadowColor: tk.cardShadowColor,
      shadowOpacity: tk.cardShadowOpacity,
      shadowRadius: tk.cardShadowRadius,
      shadowOffset: { width: 0, height: 2 },
      ...inner,
    }, style]}>
      {children}
    </View>
  );
}
