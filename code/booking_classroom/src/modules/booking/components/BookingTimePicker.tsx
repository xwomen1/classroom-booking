import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export const TIME_OPTIONS = Array.from({ length: 29 }, (_, index) => {
  const totalMinutes = 7 * 60 + index * 30;
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
});

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function buildDateOptions(minDays: number, maxDays: number): string[] {
  return Array.from({ length: maxDays - minDays + 1 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + minDays + index);
    return formatLocalDate(date);
  });
}

type Props = {
  dateOptions: readonly string[];
  date: string;
  startTime: string;
  endTime: string;
  onDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
};

export function BookingTimePicker({
  dateOptions,
  date,
  startTime,
  endTime,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
}: Props) {
  const selectStart = (value: string) => {
    onStartTimeChange(value);
    if (value >= endTime) {
      const index = TIME_OPTIONS.indexOf(value);
      onEndTimeChange(TIME_OPTIONS[Math.min(index + 1, TIME_OPTIONS.length - 1)]);
    }
  };
  const endOptions = TIME_OPTIONS.filter(value => value > startTime);
  return (
    <View>
      <Text style={styles.hint}>Vuốt dọc từng cột rồi chạm để chọn</Text>
      <View style={styles.row}>
        <Wheel label="Ngày" options={dateOptions} value={date} onChange={onDateChange} render={value => `${value.slice(8, 10)}/${value.slice(5, 7)}`} />
        <Wheel label="Bắt đầu" options={TIME_OPTIONS.slice(0, -1)} value={startTime} onChange={selectStart} />
        <Wheel label="Kết thúc" options={endOptions} value={endTime} onChange={onEndTimeChange} />
      </View>
      <Text style={styles.summary}>{date} · {startTime}–{endTime}</Text>
    </View>
  );
}

function Wheel({ label, options, value, onChange, render }: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  render?: (value: string) => string;
}) {
  return (
    <View style={styles.column}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={styles.wheel} contentContainerStyle={styles.wheelContent}>
        {options.map(option => (
          <Pressable key={option} onPress={() => onChange(option)} style={[styles.option, option === value && styles.optionOn]}>
            <Text style={[styles.optionText, option === value && styles.optionTextOn]}>{render ? render(option) : option}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: '#697386', fontSize: 11, marginBottom: 7 }, row: { flexDirection: 'row' }, column: { flex: 1, marginRight: 7 },
  label: { color: '#344057', fontSize: 12, fontWeight: '800', marginBottom: 5, textAlign: 'center' },
  wheel: { backgroundColor: '#FFF', borderColor: '#CBD4E1', borderRadius: 9, borderWidth: 1, height: 112 }, wheelContent: { padding: 4 },
  option: { alignItems: 'center', borderRadius: 6, minHeight: 34, paddingVertical: 8 }, optionOn: { backgroundColor: '#B01432' },
  optionText: { color: '#445066', fontSize: 12, fontWeight: '700' }, optionTextOn: { color: '#FFF' },
  summary: { color: '#253047', fontSize: 13, fontWeight: '800', marginBottom: 13, marginTop: 8, textAlign: 'center' },
});
