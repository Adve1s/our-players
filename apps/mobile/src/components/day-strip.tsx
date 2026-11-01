import { useEffect, useRef, useState } from 'react';
import {
  type LayoutRectangle,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  Text,
  View,
} from 'react-native';
import { dayLabel, stripDays } from '../lib/format';
import { useTheme } from '../theme';

type Props = { date: string; disabled: boolean; onGo: (date: string) => void };

// Calendar days around the shown one; the window and its centre move with `date`.
export function DayStrip({ date, disabled, onGo }: Props) {
  const t = useTheme();
  const days = stripDays(date);
  const scroller = useRef<ScrollViewInstance>(null);
  const [width, setWidth] = useState(0);
  const [mid, setMid] = useState<LayoutRectangle | null>(null);
  // Also on a new date with the same layout: a strip the user scrolled re-centres on the new day.
  // biome-ignore lint/correctness/useExhaustiveDependencies: date is the trigger, not an input.
  useEffect(() => {
    if (width > 0 && mid)
      scroller.current?.scrollTo({ x: mid.x + mid.width / 2 - width / 2, animated: false });
  }, [date, width, mid]);
  return (
    <View
      style={{
        backgroundColor: t.colors.background,
        borderBottomWidth: t.layout.hairline,
        borderBottomColor: t.colors.border,
      }}
    >
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={t.column}
      >
        {days.map((d, i) => {
          const selected = d === date;
          const color = selected ? t.colors.accent : t.colors.text;
          return (
            <Pressable
              // biome-ignore lint/suspicious/noArrayIndexKey: by position, the shown day stays the middle item, so a new date keeps its measured layout.
              key={i}
              accessibilityRole="button"
              accessibilityLabel={dayLabel(d)}
              aria-selected={selected}
              aria-disabled={disabled}
              disabled={disabled}
              onPress={() => onGo(d)}
              onLayout={selected ? (e) => setMid(e.nativeEvent.layout) : undefined}
              style={({ pressed }) => ({
                minWidth: t.layout.target + t.space.sm,
                alignItems: 'center',
                paddingTop: t.space.sm,
                opacity: pressed ? t.opacity.pressed : 1,
              })}
            >
              <Text style={{ color: selected ? color : t.colors.textMuted, ...t.type.label }}>
                {dayLabel(d).slice(0, 3)}
              </Text>
              <Text
                style={{
                  color,
                  fontVariant: ['tabular-nums'],
                  paddingBottom: t.space.sm,
                  ...t.type.heading,
                }}
              >
                {Number(d.slice(8))}
              </Text>
              <View
                style={{
                  alignSelf: 'stretch',
                  height: t.layout.markBar,
                  backgroundColor: selected ? t.colors.accent : undefined,
                }}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
