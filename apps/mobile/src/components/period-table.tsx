import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { type PeriodTable, periodTableLabel } from '../lib/game-page';
import { useTheme } from '../theme';

// Fixed widths line the columns up across rows; the horizontal scroll takes a 4OT playoff game.
export function PeriodTableView({ table }: { table: PeriodTable }) {
  const t = useTheme();
  // Widths grow with the system font scale, so "137" and "DAL" still fit their columns.
  const { fontScale } = useWindowDimensions();
  const first = t.space.xl * 2 * fontScale;
  const cell = (t.space.xl + t.space.md) * fontScale;
  const last = table.labels.length - 1;
  const label = periodTableLabel(table);
  const line = (head: string, cells: string[], muted: boolean) => {
    // The header row (muted) is a size smaller; the head and totals columns are bold.
    const [plain, bold] = muted ? [t.type.meta, t.type.label] : [t.type.body, t.type.bodyStrong];
    return (
      <View key={head} style={{ flexDirection: 'row' }}>
        <Text
          style={{
            width: first,
            color: muted ? t.colors.textMuted : t.colors.text,
            ...bold,
          }}
        >
          {head}
        </Text>
        {cells.map((c, i) => (
          <Text
            // biome-ignore lint/suspicious/noArrayIndexKey: a column's place is its identity.
            key={i}
            style={{
              width: cell,
              textAlign: 'center',
              color: muted ? t.colors.textMuted : t.colors.text,
              ...(i === last ? bold : plain),
            }}
          >
            {c}
          </Text>
        ))}
      </View>
    );
  };
  return (
    <ScrollView horizontal>
      <View accessible accessibilityLabel={label} style={{ gap: t.space.sm }}>
        {line('', table.labels, true)}
        {table.rows.map((r) => line(r.abbrev, r.cells, false))}
      </View>
    </ScrollView>
  );
}
