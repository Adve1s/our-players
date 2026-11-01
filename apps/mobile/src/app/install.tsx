import { ScrollView, Text } from 'react-native';
import { Caption } from '../components/caption';
import { Card } from '../components/card';
import { useTheme } from '../theme';

const PLATFORMS = [
  {
    title: 'iPhone or iPad',
    steps: [
      '1. Open this site in Safari.',
      '2. Tap Share (the square with an arrow).',
      '3. Tap Add to Home Screen, then Add.',
    ],
  },
  {
    title: 'Android',
    steps: [
      '1. Open this site in Chrome.',
      '2. Tap ⋮ at the top right.',
      '3. Tap Add to home screen or Install app.',
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
    <ScrollView
      style={{ backgroundColor: t.colors.background }}
      contentContainerStyle={{ padding: t.space.lg, gap: t.space.lg }}
    >
      {PLATFORMS.map((p) => (
        <Card key={p.title} large title={p.title}>
          {p.steps.map((s) => (
            <Text key={s} style={{ color: t.colors.text, ...t.type.body }}>
              {s}
            </Text>
          ))}
        </Card>
      ))}
      <Caption>
        Your countries, favorites and hidden players are saved in this browser only. An app added to
        the home screen may start with the defaults: set them again there.
      </Caption>
    </ScrollView>
  );
}
