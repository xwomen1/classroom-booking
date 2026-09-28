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

export function subscribePriorityBanners(listener: BannerListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
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
    | { show?: (title: string, message: string) => Promise<boolean> }
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
  await nativeModule.show(title, message);
}
