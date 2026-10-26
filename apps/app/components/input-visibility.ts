import { createContext } from 'react';
import type { ViewInstance } from 'react-native';

// A field can ask its containing scroll panel to reveal it after keyboard/layout changes.
export const InputVisibilityContext = createContext<
  ((target: ViewInstance | null) => void) | undefined
>(undefined);
