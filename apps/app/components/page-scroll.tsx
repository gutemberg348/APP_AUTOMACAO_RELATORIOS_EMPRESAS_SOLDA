import { createContext, useContext } from 'react';
import type { View } from 'react-native';

export const PageScrollContext = createContext<(target?: View | null) => void>(() => {});
export const usePageScroll = () => useContext(PageScrollContext);
