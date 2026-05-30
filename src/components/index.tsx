import React from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../theme';

//  ThemeBtn 
export const ThemeBtn = ({ theme, onToggle, tk }: { theme: 'dark'|'light'; onToggle: ()=>void; tk: Theme }) => (
  <TouchableOpacity onPress={onToggle} style={[styles.themeBtn, { backgroundColor: tk.bg3, borderColor: tk.border }]}>
    <Text style={{ fontSize: 16 }}>{theme === 'dark' ? '' : ''}</Text>
  </TouchableOpacity>
);

//  AppButton 
export const AppButton = ({
  label, onPress, gradient, disabled, style = {}
}: { label: string; onPress: ()=>void; gradient: [string,string]; disabled?: boolean; style?: object }) => (
  <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85} style={[{ borderRadius: 16, overflow: 'hidden' }, style]}>
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ padding: 16, alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', fontFamily: 'Nunito_800ExtraBold' }}>
        {label}
      </Text>
    </LinearGradient>
  </TouchableOpacity>
);

//  AppInput 
export const AppInput = ({
  value, onChangeText, placeholder, tk, center = false, style = {}, ...rest
}: { value: string; onChangeText: (t:string)=>void; placeholder: string; tk: Theme; center?: boolean; style?: object; [k:string]: any }) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor={tk.ph}
    style={[styles.input, {
      backgroundColor: tk.inp,
      borderColor: tk.border,
      color: tk.text,
      textAlign: center ? 'center' : 'left',
    }, style]}
    {...rest}
  />
);

//  Toast 
export const Toast = ({ msg, type, tk }: { msg: string; type: 'ok'|'err'; tk: Theme }) => (
  <View style={[styles.toast, {
    backgroundColor: tk.bg3,
    borderColor: type === 'err' ? '#FF6B6B88' : tk.border,
  }]}>
    <Text style={{ color: tk.text, fontSize: 14, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>{msg}</Text>
  </View>
);

//  Loader 
export const Loader = ({ accent, bg }: { accent: string; bg: string }) => (
  <View style={[styles.loaderBg, { backgroundColor: bg + 'CC' }]}>
    <View style={[styles.loaderBox, { backgroundColor: accent }]}>
      <Text style={{ fontSize: 26 }}></Text>
    </View>
  </View>
);

//  CheckButton 
export const CheckBtn = ({
  done, color, onPress
}: { done: boolean; color: string; onPress: ()=>void }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    style={[styles.checkBtn, {
      backgroundColor: done ? color : 'transparent',
      borderColor: color,
      shadowColor: done ? color : 'transparent',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: done ? 0.4 : 0,
      shadowRadius: 8,
      elevation: done ? 6 : 0,
    }]}>
    {done && <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}></Text>}
  </TouchableOpacity>
);

//  ProgressBar 
export const ProgressBar = ({
  label, done, total, c1, c2, tk
}: { label: string; done: number; total: number; c1: string; c2: string; tk: Theme }) => {
  const pct = total ? Math.round(done / total * 100) : 0;
  return (
    <View style={[styles.progCard, { backgroundColor: tk.bg2, borderColor: tk.border }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: tk.text, fontFamily: 'Nunito_800ExtraBold' }}>{label}</Text>
        <Text style={{ fontSize: 13, fontWeight: '900', color: c1 }}>{done}/{total}</Text>
      </View>
      <View style={[styles.progTrack, { backgroundColor: tk.bg3 }]}>
        <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[styles.progFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
};

//  SectionLabel 
export const SectionLabel = ({ text, tk }: { text: string; tk: Theme }) => (
  <Text style={[styles.secLabel, { color: tk.text3, borderTopColor: tk.border }]}>{text.toUpperCase()}</Text>
);

//  MemberAvatar 
export const MemberAvatar = ({ name, color, size = 44 }: { name: string; color: string; size?: number }) => (
  <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
    <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.4 }}>{name[0]?.toUpperCase()}</Text>
  </View>
);

//  Styles 
const styles = StyleSheet.create({
  themeBtn: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    width: '100%', borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, fontWeight: '700',
  },
  toast: {
    position: 'absolute', top: 56, alignSelf: 'center',
    paddingHorizontal: 22, paddingVertical: 11,
    borderRadius: 28, borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 12, zIndex: 9999,
  },
  loaderBg: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', zIndex: 9998,
  },
  loaderBox: {
    width: 56, height: 56, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  checkBtn: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
  },
  progCard: {
    borderRadius: 14, borderWidth: 1.5,
    padding: 12, marginBottom: 10,
  },
  progTrack: {
    height: 7, borderRadius: 10, overflow: 'hidden',
  },
  progFill: {
    height: '100%', borderRadius: 10,
  },
  secLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.9,
    marginVertical: 10, paddingTop: 16, borderTopWidth: 1,
  },
  avatar: {
    alignItems: 'center', justifyContent: 'center',
  },
});
