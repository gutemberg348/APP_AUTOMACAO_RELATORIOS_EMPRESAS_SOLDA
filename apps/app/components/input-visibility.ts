import { createContext } from 'react';
import type { View } from 'react-native';

// A field can ask its containing scroll panel to reveal it after keyboard/layout changes.
export const InputVisibilityContext = createContext<((target: View | null) => void) | undefined>(
  undefined,
);
