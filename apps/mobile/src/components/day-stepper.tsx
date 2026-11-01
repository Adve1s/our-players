import { Pressable, Text, View } from 'react-native';
import { dayLabel } from '../lib/format';
import { useTheme } from '../theme';

type Props = {
  date: string;
  prev: string | null;
  next: string | null;
  onLatest: boolean;
  onGo: (date: string) => void;
  onLatestPress: () => void;
};

function StepButton({
  text,
  label,
  disabled,
  onPress,
}: {
  text: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={{
        minWidth: t.space.xl * 2,
        minHeight: t.space.xl * 2,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: t.space.sm,
      }}
    >
      <Text
        style={{
          color: disabled ? t.colors.textDisabled : t.colors.accent,
          ...(text.length === 1 ? t.type.heading : t.type.bodyStrong),
        }}
      >
        {text}
      </Text>
    </Pressable>
  );
}

export function DayStepper({ date, prev, next, onLatest, onGo, onLatestPress }: Props) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.space.sm }}>
      <StepButton
        text="‹"
        label="Previous game day"
        disabled={prev === null}
        onPress={() => prev && onGo(prev)}
      />
      <Text
        accessibilityRole="header"
        style={{
          flex: 1,
          textAlign: 'center',
          color: t.colors.text,
          ...t.type.heading,
        }}
      >
        {dayLabel(date)}
      </Text>
      <StepButton
        text="›"
        label="Next game day"
        disabled={next === null}
        onPress={() => next && onGo(next)}
      />
      <StepButton
        text="Latest"
        label="Latest game day"
        disabled={onLatest}
        onPress={onLatestPress}
      />
    </View>
  );
}
