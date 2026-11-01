import { useEffect, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import {
  type Colors,
  dark as darkColors,
  icon,
  layout,
  light as lightColors,
  motion,
  opacity,
  radius,
  shadow,
  space,
  type,
} from './tokens';

export type Theme = {
  colors: Colors;
  space: typeof space;
  radius: typeof radius;
  type: typeof type;
  motion: typeof motion;
  icon: typeof icon;
  layout: typeof layout;
  shadow: typeof shadow;
  opacity: typeof opacity;
  dark: boolean;
};

const shared = { space, radius, type, motion, icon, layout, shadow, opacity };
const light: Theme = { colors: lightColors, ...shared, dark: false };
const dark: Theme = { colors: darkColors, ...shared, dark: true };

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

// false until the system answers, so the first frame may animate; with reduce motion on, show end states.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (live) setReduced(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
