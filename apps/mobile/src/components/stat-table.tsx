import { type ReactNode, useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  Text,
  type TextStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import { type Column, columnWidth } from '../lib/stat-table';
import { useTheme } from '../theme';

export type StatTableRow = {
  key: string;
  lead: ReactNode;
  values: string[] | null;
  text?: string;
  label: string;
  onPress: () => void;
  marked?: boolean;
};

// Side by side, the name keeps at least this share of the width (it wraps); past that the table
// switches to the box score's layout: names fixed, stats scrolling.
const NAME_SHARE = 0.3;
// The fixed name column of a scrolling table takes at most this share, so a stat column always shows.
const LEAD_SHARE = 0.45;

// One header row over the rows of one stat kind; each row is a single button for the screen reader.
// `scroll` (the box score) keeps the names fixed and scrolls every stat column; it runs edge to edge
// in its box and insets the names itself, so the mark bar sits on the box edge and never scrolls away.
// Without `scroll` the table sits in a box padded `lg`; when its columns crowd the names it takes the
// same layout, stretched over that padding.
export function StatTable({
  columns,
  rows,
  scroll = false,
}: {
  columns: Column[] | null;
  rows: StatTableRow[];
  scroll?: boolean;
}) {
  const t = useTheme();
  const { fontScale } = useWindowDimensions();
  // null until the first layout: side by side until then.
  const [width, setWidth] = useState<number | null>(null);
  // Scrolling, a name lives outside its stat row, so each stat row takes its name's measured height.
  const [heights, setHeights] = useState<Record<string, number>>({});
  const measure = (key: string) => (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setHeights((hs) => (hs[key] === h ? hs : { ...hs, [key]: h }));
  };
  const widths = columns?.map((c) => columnWidth(c.wide, fontScale)) ?? [];
  const total = widths.reduce((sum, w) => sum + w, 0);
  const crowded = !scroll && width !== null && width * NAME_SHARE + t.space.md + total > width;
  // The fixed layout runs edge to edge; a crowded table measures inside its box's padding.
  const edge = width === null ? null : crowded ? width + 2 * t.space.lg : width;
  const cell = (i: number, value: string, color: string, type: TextStyle) => (
    <Text
      key={i}
      style={{
        width: widths[i],
        textAlign: 'right',
        color,
        fontVariant: ['tabular-nums'],
        ...type,
      }}
    >
      {value}
    </Text>
  );
  let content: ReactNode;
  if (scroll || crowded) {
    const lines = rows.filter((row) => row.values !== null);
    const lead = Math.min(
      t.layout.statLead * Math.max(1, fontScale),
      (edge ?? Number.POSITIVE_INFINITY) * LEAD_SHARE,
    );
    const rule = { borderTopWidth: t.layout.hairline, borderTopColor: t.colors.border };
    const inset = (marked?: boolean) =>
      marked
        ? {
            borderLeftWidth: t.layout.markBar,
            borderLeftColor: t.colors.accent,
            paddingLeft: t.space.lg - t.layout.markBar,
          }
        : { paddingLeft: t.space.lg };
    // The padding sits inside each row, so its rule meets the name's rule.
    const statRow = {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingRight: t.space.lg,
    } as const;
    content = (
      <View style={crowded ? { marginHorizontal: -t.space.lg } : undefined}>
        {lines.length > 0 ? (
          <View style={{ flexDirection: 'row' }}>
            <View
              style={{
                width: lead,
                borderRightWidth: t.layout.hairline,
                borderRightColor: t.colors.border,
              }}
            >
              <View style={{ height: heights[''] }} />
              {lines.map((row) => (
                <Pressable
                  key={row.key}
                  accessibilityRole="button"
                  accessibilityLabel={row.label}
                  onPress={row.onPress}
                  onLayout={measure(row.key)}
                  style={({ pressed }) => [
                    rule,
                    inset(row.marked),
                    {
                      minHeight: t.layout.target,
                      justifyContent: 'center',
                      paddingVertical: t.space.xs,
                      paddingRight: t.space.sm,
                    },
                    pressed && { opacity: t.opacity.pressed },
                  ]}
                >
                  {row.lead}
                </Pressable>
              ))}
            </View>
            {/* Header and values scroll together; on a wide screen the columns sit right, as on Today. */}
            <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
              <View style={{ flexGrow: 1 }}>
                {columns ? (
                  <View onLayout={measure('')} style={[statRow, { paddingVertical: t.space.xs }]}>
                    {columns.map((c, i) => cell(i, c.label, t.colors.textMuted, t.type.label))}
                  </View>
                ) : null}
                {lines.map((row) => (
                  <View
                    key={row.key}
                    style={[
                      rule,
                      statRow,
                      { height: heights[row.key], minHeight: t.layout.target },
                    ]}
                  >
                    {row.values?.map((v, i) =>
                      cell(
                        i,
                        v,
                        t.colors.text,
                        columns?.[i]?.strong ? t.type.bodyStrong : t.type.body,
                      ),
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}
        {/* A text row has no stat cells: its name sits in the same fixed column, its text spans the rest. */}
        {rows
          .filter((row) => row.values === null)
          .map((row) => (
            <Pressable
              key={row.key}
              accessibilityRole="button"
              accessibilityLabel={row.label}
              onPress={row.onPress}
              style={({ pressed }) => [
                rule,
                { flexDirection: 'row', minHeight: t.layout.target },
                pressed && { opacity: t.opacity.pressed },
              ]}
            >
              <View
                style={[
                  inset(row.marked),
                  {
                    width: lead,
                    justifyContent: 'center',
                    paddingVertical: t.space.xs,
                    paddingRight: t.space.sm,
                    borderRightWidth: t.layout.hairline,
                    borderRightColor: t.colors.border,
                  },
                ]}
              >
                {row.lead}
              </View>
              <Text
                style={{
                  flex: 1,
                  alignSelf: 'center',
                  paddingHorizontal: t.space.md,
                  color: t.colors.textMuted,
                  ...t.type.body,
                }}
              >
                {row.text}
              </Text>
            </Pressable>
          ))}
      </View>
    );
  } else {
    content = (
      <>
        {columns ? (
          <View style={{ flexDirection: 'row', paddingTop: t.space.xs }}>
            <View style={{ flex: 1 }} />
            {columns.map((c, i) => cell(i, c.label, t.colors.textMuted, t.type.label))}
          </View>
        ) : null}
        {rows.map((row) => (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            accessibilityLabel={row.label}
            onPress={row.onPress}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.space.md,
                // A name wrapped onto two lines keeps some air above and below.
                paddingVertical: t.space.xs,
                minHeight: t.layout.target,
              },
              row.marked && {
                borderLeftWidth: t.layout.markBar,
                borderLeftColor: t.colors.accent,
                paddingLeft: t.space.sm,
                marginLeft: -(t.space.sm + t.layout.markBar),
              },
              pressed && { opacity: t.opacity.pressed },
            ]}
          >
            {/* A text row lets name and text share the width; a stat row gives the name what the columns leave. */}
            <View style={row.values ? { flex: 1 } : { flexShrink: 1 }}>{row.lead}</View>
            {row.values ? (
              <View style={{ flexDirection: 'row' }}>
                {row.values.map((v, i) =>
                  cell(i, v, t.colors.text, columns?.[i]?.strong ? t.type.bodyStrong : t.type.body),
                )}
              </View>
            ) : (
              <Text
                style={{
                  flexGrow: 1,
                  flexShrink: 1,
                  textAlign: 'right',
                  color: t.colors.textMuted,
                  ...t.type.body,
                }}
              >
                {row.text}
              </Text>
            )}
          </Pressable>
        ))}
      </>
    );
  }
  return <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>{content}</View>;
}
