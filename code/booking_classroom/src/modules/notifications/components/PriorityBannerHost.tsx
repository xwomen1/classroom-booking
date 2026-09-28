import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  openPriorityBanner,
  subscribePriorityBanners,
  type PriorityBanner,
} from '../services/priorityBanner';

export function PriorityBannerHost() {
  const insets = useSafeAreaInsets();
  const [banner, setBanner] = useState<PriorityBanner | null>(null);
  const queue = useRef<PriorityBanner[]>([]);
  const showing = useRef(false);
  const translateY = useRef(new Animated.Value(-180)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<() => void>(() => {});

  useEffect(() => {
    const show = (item: PriorityBanner) => {
      setBanner(item);
      translateY.setValue(-180);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 18,
        bounciness: 4,
      }).start();
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => hideRef.current(), 4200);
    };

    hideRef.current = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      Animated.timing(translateY, {
        toValue: -180,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          return;
        }
        const next = queue.current.shift() ?? null;
        if (!next) {
          showing.current = false;
          setBanner(null);
          return;
        }
        show(next);
      });
    };

    const present = (item: PriorityBanner) => {
      if (showing.current) {
        queue.current.push(item);
        return;
      }
      showing.current = true;
      show(item);
    };

    const unsubscribe = subscribePriorityBanners(present);
    return () => {
      unsubscribe();
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [translateY]);

  if (!banner) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Animated.View
        style={[
          styles.slide,
          { marginTop: insets.top + 8, transform: [{ translateY }] },
        ]}
      >
        <Pressable
          accessibilityRole="alert"
          onPress={() => {
            openPriorityBanner(banner);
            hideRef.current();
          }}
          style={styles.card}
        >
          <View style={styles.mark}>
            <Text style={styles.markText}>!</Text>
          </View>
          <View style={styles.copy}>
            <Text style={styles.kicker}>
              {banner.title === 'Có yêu cầu đặt phòng mới'
                ? 'Chạm để phê duyệt'
                : 'Thông báo ưu tiên'}
            </Text>
            <Text numberOfLines={1} style={styles.title}>
              {banner.title}
            </Text>
            <Text numberOfLines={2} style={styles.message}>
              {banner.message}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    elevation: 24,
    zIndex: 24,
  },
  slide: {
    marginHorizontal: 12,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderLeftColor: '#2F6FED',
    borderLeftWidth: 4,
    borderRadius: 16,
    elevation: 8,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#172033',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
  },
  mark: {
    alignItems: 'center',
    backgroundColor: '#2F6FED',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginRight: 12,
    width: 36,
  },
  markText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  copy: { flex: 1 },
  kicker: {
    color: '#2F6FED',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: '#172033',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  message: {
    color: '#657084',
    fontSize: 13,
    marginTop: 2,
  },
});
