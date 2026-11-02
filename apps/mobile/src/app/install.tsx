import { ScrollView, Text, View } from 'react-native';
import { Caption } from '../components/caption';
import { Section } from '../components/card';
import { useTheme } from '../theme';

const PLATFORMS = [
  {
    title: 'iPhone or iPad',
    steps: [
      'Open this site in Safari.',
      'Tap Share (the square with an arrow).',
      'Tap Add to Home Screen, then Add.',
    ],
  },
  {
    title: 'Android',
    steps: [
      'Open this site in Chrome.',
      'Tap ⋮ at the top right.',
      'Tap Add to home screen or Install app.',
    ],
  },
  {
    title: 'Computer',
    steps: [
      'In Chrome or Edge, click the install icon at the right of the address bar, or bookmark the page.',
    ],
  },
];

export default function Install() {
  const t = useTheme();
  return (
    <ScrollView style={{ backgroundColor: t.colors.background }}>
      <View style={[t.column, { padding: t.space.lg, gap: t.space.xl }]}>
        <Text accessibilityRole="header" style={{ color: t.colors.text, ...t.type.title }}>
          Add to Home Screen
        </Text>
        {PLATFORMS.map((p) => (
          <Section key={p.title} title={p.title}>
            {p.steps.map((s, i) => (
              <View key={s} style={{ flexDirection: 'row', gap: t.space.sm }}>
                {/* A single step is no sequence, so it goes unnumbered. */}
                {p.steps.length > 1 ? (
                  // A min width lines the steps' texts up; a wrapped line hangs under its text, not the number.
                  <Text
                    style={{ color: t.colors.accent, ...t.type.bodyStrong, minWidth: t.space.lg }}
                  >
                    {`${i + 1}.`}
                  </Text>
                ) : null}
                <Text style={{ flex: 1, color: t.colors.text, ...t.type.body }}>{s}</Text>
              </View>
            ))}
          </Section>
        ))}
        <Caption>
          Your countries, favorites and hidden players are saved in this browser only. An app added
          to the home screen may start with the defaults: set them again there.
        </Caption>
      </View>
    </ScrollView>
  );
}
