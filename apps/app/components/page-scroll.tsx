import { createContext, useContext } from 'react';
import type { ViewInstance } from 'react-native';

export const PageScrollContext = createContext<(target?: ViewInstance | null) => void>(() => {});
export const usePageScroll = () => useContext(PageScrollContext);
