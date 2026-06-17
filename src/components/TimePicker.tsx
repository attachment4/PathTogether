import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, PanResponder } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Барабанный столбик (бесконечная прокрутка)
function DrumColumn({ items, selected, onSelect, itemH, tk }: {
  items: string[]; selected: number; onSelect: (i: number) => void;
  itemH: number; tk: any;
}) {
  const VISIBLE = 5;
  const N = items.length;

  const OFFSET = (sel: number) => -(N + sel - 2) * itemH;
  const offsetY   = useRef(new Animated.Value(OFFSET(selected))).current;
  const lastY     = useRef(OFFSET(selected));
  const [curSel, setCurSel] = useState(selected);

  useEffect(() => {
    const v = OFFSET(selected);
    offsetY.setValue(v);
    lastY.current = v;
    setCurSel(selected);
  }, []);

  const normalize = (y: number): number => {
    const total = N * itemH;
    let v = y;
    while (v > -(itemH * 0.5))       v -= total;
    while (v < -(2 * N - 0.5) * itemH) v += total;
    return v;
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => {
      offsetY.stopAnimation(v => { lastY.current = v; });
    },
    onPanResponderMove: (_, gs) => {
      const raw = lastY.current + gs.dy;
      offsetY.setValue(raw);
      const normed  = normalize(raw);
      const absIdx  = Math.round((-normed + itemH * 2) / itemH);
      const realIdx = ((absIdx % N) + N) % N;
      setCurSel(realIdx);
    },
    onPanResponderRelease: (_, gs) => {
      const raw     = lastY.current + gs.dy;
      const normed  = normalize(raw);
      const absIdx  = Math.round((-normed + itemH * 2) / itemH);
      const realIdx = ((absIdx % N) + N) % N;
      const snapped = normalize(-(absIdx - 2) * itemH);
      offsetY.setValue(normalize(raw));
      lastY.current = snapped;
      setCurSel(realIdx);
      Animated.spring(offsetY, {
        toValue: snapped, useNativeDriver: true,
        friction: 7, tension: 55,
      }).start();
      onSelect(realIdx);
    },
  })).current;

  const tripled = [...items, ...items, ...items];

  return (
    <View style={{ height: itemH * VISIBLE, overflow: 'hidden', width: 80, backgroundColor: tk.bg2 }}
      {...pan.panHandlers}>
      <View pointerEvents="none" style={{
        position:'absolute', top: itemH * 2, height: itemH,
        left:0, right:0, zIndex:2,
        borderTopWidth:1, borderBottomWidth:1,
        borderColor: tk.border,
      }}/>
      <View pointerEvents="none" style={{
        position:'absolute',top:0,left:0,right:0,height:itemH*2,zIndex:1,
        backgroundColor:tk.bg2, opacity:1.0,
      }}/>
      <View pointerEvents="none" style={{
        position:'absolute',bottom:0,left:0,right:0,height:itemH*2,zIndex:1,
        backgroundColor:tk.bg2, opacity:1.0,
      }}/>
      <Animated.View style={{ transform:[{ translateY: offsetY }] }}>
        {tripled.map((item, i) => {
          const isSel = (i % N) === curSel;
          return (
            <View key={i} style={{ height:itemH, alignItems:'center', justifyContent:'center' }}>
              <Text style={{
                fontSize:   isSel ? 28 : 18,
                fontWeight: isSel ? '700' : '400',
                color:      isSel ? tk.text : tk.text3,
              }}>{item}</Text>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

// Барабанный выбор времени (bottom-sheet). value 'HH:MM' | '', onChange('' = очистить)
export function TimePicker({ value, onChange, onClose, tk }: {
  value: string; onChange: (t: string) => void; onClose: () => void; tk: any;
}) {
  const ITEM_H = 52;
  const hours   = Array.from({length:24}, (_,i) => String(i).padStart(2,'0'));
  const minutes = Array.from({length:60}, (_,i) => String(i).padStart(2,'0'));

  const [h, m] = value && /^\d{1,2}:\d{2}$/.test(value)
    ? value.split(':').map(Number) : [8, 0];

  const [selH, setSelH] = useState(h);
  const [selM, setSelM] = useState(m);

  const confirm = () => {
    onChange(`${String(selH).padStart(2,'0')}:${String(selM).padStart(2,'0')}`);
    onClose();
  };
  const clear = () => { onChange(''); onClose(); };

  const IconClose = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18M6 6l12 12"
        stroke={tk.text3} strokeWidth="1.8" strokeLinecap="round"/>
    </Svg>
  );
  const IconCheck = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M5 13l4 4L19 7"
        stroke={tk.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'flex-end'}}>
        <View style={{
          backgroundColor:tk.bg2,
          borderTopLeftRadius:24, borderTopRightRadius:24,
          paddingBottom:44,
          borderTopWidth:1, borderColor:tk.border,
          width:'100%', maxWidth:480, alignSelf:'center',
        }}>
          <View style={{alignItems:'center', paddingTop:12, paddingBottom:4}}>
            <View style={{width:36, height:3, borderRadius:2, backgroundColor: tk.border}}/>
          </View>
          <View style={{flexDirection:'row', justifyContent:'space-between',
            alignItems:'center', paddingHorizontal:24, paddingTop:8, paddingBottom:16}}>
            <TouchableOpacity onPress={clear}
              hitSlop={{top:14,bottom:14,left:14,right:14}}
              style={{width:36,height:36,borderRadius:18,
                backgroundColor: tk.bg3, borderWidth: 1, borderColor: tk.border,
                alignItems:'center',justifyContent:'center'}}>
              <IconClose/>
            </TouchableOpacity>
            <Text style={{fontSize:28, fontWeight:'700', color:tk.text, letterSpacing:2}}>
              {String(selH).padStart(2,'0')}:{String(selM).padStart(2,'0')}
            </Text>
            <TouchableOpacity onPress={confirm}
              hitSlop={{top:14,bottom:14,left:14,right:14}}
              style={{width:36,height:36,borderRadius:18,
                backgroundColor: tk.bg3, borderWidth: 1, borderColor: tk.border,
                alignItems:'center',justifyContent:'center'}}>
              <IconCheck/>
            </TouchableOpacity>
          </View>
          <View style={{flexDirection:'row', alignItems:'center',
            justifyContent:'center', gap:0, paddingHorizontal:40}}>
            <DrumColumn items={hours}   selected={selH}
              onSelect={i=>{setSelH(i);}} itemH={ITEM_H} tk={tk}/>
            <Text style={{fontSize:28, fontWeight:'300', color:tk.text2,
              width:24, textAlign:'center', marginBottom:4}}>:</Text>
            <DrumColumn items={minutes} selected={selM}
              onSelect={i=>{setSelM(i);}} itemH={ITEM_H} tk={tk}/>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default TimePicker;
