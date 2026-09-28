import {
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';

export type PriorityBanner = {
  id: string;
  title: string;
  message: string;
};

type BannerListener = (banner: PriorityBanner) => void;

const listeners = new Set<BannerListener>();
const openListeners = new Set<BannerListener>();

export function subscribePriorityBanners(listener: BannerListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribePriorityBannerOpen(listener: BannerListener) {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}

export function openPriorityBanner(banner: PriorityBanner) {
  openListeners.forEach(listener => listener(banner));
}

export async function requestPriorityNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
    return;
  }
  const alreadyGranted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  if (alreadyGranted) {
    return;
  }
  await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
}

export async function consumeNotificationDestination(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    return null;
  }
  const nativeModule = NativeModules.PriorityNotification as
    | { consumeOpenScreen?: () => Promise<string | null> }
    | undefined;
  if (!nativeModule?.consumeOpenScreen) {
    return null;
  }
  const destination = await nativeModule.consumeOpenScreen();
  return destination || null;
}
export async function presentPriorityNotification(
  title: string,
  message: string,
): Promise<void> {
  const banner: PriorityBanner = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    message,
  };
  listeners.forEach(listener => listener(banner));

  if (Platform.OS !== 'android') {
    return;
  }
  const nativeModule = NativeModules.PriorityNotification as
    | { show?: (title: string, message: string, destination: string) => Promise<boolean> }
    | undefined;
  if (!nativeModule?.show) {
    return;
  }
  if (Number(Platform.Version) >= 33) {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (!granted) {
      return;
    }
  }
  const destination = title === 'Có yêu cầu đặt phòng mới' ? 'approval' : '';
  await nativeModule.show(title, message, destination);
}
