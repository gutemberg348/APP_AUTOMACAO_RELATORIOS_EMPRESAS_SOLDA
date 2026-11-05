import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../stores/auth';
import { api, apiUrl } from '../services/api';
import { offlineScope } from '../services/offline-cache';
import { useConnectivity, offlineStorageFailure } from '../stores/connectivity';
import {
  hydrateOfflineReports,
  persistPhotoQueue,
  useOfflineReports,
} from '../features/reports/offline-report-store';
import { syncWaitingReports } from '../features/reports/offline-report-sync';

export function OfflineRuntime() {
  const userId = useAuth((state) => state.session?.user.id);
  const online = useConnectivity((state) => state.online);
  const drafts = useOfflineReports((state) => state.drafts);
  const client = useQueryClient();
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    if (!userId) {
      useOfflineReports.setState({ ready: false, scope: undefined, userId: undefined, drafts: {} });
      return;
    }
    const scope = offlineScope(apiUrl, userId);
    void hydrateOfflineReports(scope, userId)
      .then(() => {
        if (!cancelled) unsubscribe = persistPhotoQueue(scope, userId);
      })
      .catch((cause) => {
        offlineStorageFailure(cause);
        if (!cancelled) useOfflineReports.setState({ ready: true });
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [userId]);
  useEffect(() => {
    let probing = false;
    const probe = async () => {
      if (probing || AppState.currentState !== 'active') return;
      probing = true;
      try {
        const state = await Network.getNetworkStateAsync();
        if (state.isConnected === false || state.isInternetReachable === false) {
          useConnectivity.setState({ online: false });
          return;
        }
        await api('/health', {}, false);
        useConnectivity.setState({ online: true });
      } catch {
        useConnectivity.setState({ online: false });
      } finally {
        probing = false;
      }
    };
    void probe();
    const network = Network.addNetworkStateListener((state) => {
      if (state.isConnected === false || state.isInternetReachable === false)
        useConnectivity.setState({ online: false });
      else void probe();
    });
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') void probe();
    });
    const timer = setInterval(() => {
      if (!useConnectivity.getState().online) void probe();
    }, 15000);
    return () => {
      network.remove();
      app.remove();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!online || !userId) return;
    const timer = setTimeout(
      () =>
        void syncWaitingReports().then(() => client.invalidateQueries({ queryKey: ['reports'] })),
      2500,
    );
    return () => clearTimeout(timer);
  }, [online, userId, drafts, client]);
  return null;
}
