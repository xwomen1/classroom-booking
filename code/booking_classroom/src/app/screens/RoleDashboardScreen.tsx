import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AuthenticatedUser } from '../../core/types/authenticatedUser';
import { ChangePasswordScreen } from '../../modules/auth';
import {
  getUnreadCount,
  NotificationScreen,
} from '../../modules/notifications';
import { ProfileScreen } from '../../modules/profile';
import { FeaturePlaceholderScreen } from '../../shared';

type RoleDashboardScreenProps = {
  session: AuthenticatedUser;
  onLogout: () => void;
};

type FeatureItem = { title: string; description: string };
type ActiveScreen = 'profile' | 'password' | 'notifications' | string | null;

const ADMIN_FEATURES: readonly FeatureItem[] = [
  { title: 'Quản lý user', description: 'Tài khoản, tìm kiếm và phân quyền' },
  {
    title: 'Quản lý phòng',
    description: 'Phòng, sức chứa, thiết bị và trạng thái',
  },
  {
    title: 'Quản lý mượn phòng',
    description: 'Duyệt, từ chối, đổi phòng và cấp quyền vào phòng',
  },
  {
    title: 'Quản lý lịch',
    description: 'Lịch sử dụng phòng và lịch bảo trì',
  },
  {
    title: 'Cấu hình',
    description: 'Thời gian đặt, quy định hủy và thông báo',
  },
];

const USER_FEATURES: readonly FeatureItem[] = [
  {
    title: 'Tìm kiếm phòng',
    description: 'Theo vị trí, ngày, giờ, sức chứa và thiết bị',
  },
  {
    title: 'Đặt phòng',
    description: 'Chọn phòng, ngày giờ và mục đích sử dụng',
  },
  {
    title: 'Lịch đặt phòng',
    description: 'Sắp tới, đã sử dụng và đã hủy',
  },
  {
    title: 'Quản lý đặt phòng',
    description: 'Xem trạng thái, hủy và ủy quyền nhận khóa',
  },
];

export function RoleDashboardScreen({
  session,
  onLogout,
}: RoleDashboardScreenProps) {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isAdmin = session.role === 'admin';
  const roleFeatures = isAdmin ? ADMIN_FEATURES : USER_FEATURES;

  const refreshUnreadCount = useCallback(() => {
    getUnreadCount(session.username).then(setUnreadCount);
  }, [session.username]);

  useEffect(refreshUnreadCount, [refreshUnreadCount]);

  const closeChildScreen = () => {
    setActiveScreen(null);
    refreshUnreadCount();
  };

  if (activeScreen === 'profile') {
    return (
      <ProfileScreen username={session.username} onBack={closeChildScreen} />
    );
  }
  if (activeScreen === 'password') {
    return (
      <ChangePasswordScreen
        username={session.username}
        onBack={closeChildScreen}
      />
    );
  }
  if (activeScreen === 'notifications') {
    return (
      <NotificationScreen
        username={session.username}
        onBack={closeChildScreen}
      />
    );
  }
  if (activeScreen) {
    return (
      <FeaturePlaceholderScreen
        title={activeScreen}
        onBack={() => setActiveScreen(null)}
      />
    );
  }

  const openMenuScreen = (screen: ActiveScreen) => {
    setMenuVisible(false);
    setActiveScreen(screen);
  };

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.dashboardPage}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={styles.headerText}>
            <Text style={styles.welcome}>Xin chào, {session.username}</Text>
            <Text style={styles.dashboardTitle}>
              {isAdmin ? 'Chế độ quản trị viên' : 'Chế độ người dùng'}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Thông báo"
            accessibilityRole="button"
            onPress={() => setActiveScreen('notifications')}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.buttonPressed,
            ]}
            testID="notification-button"
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityLabel="Mở menu tài khoản"
            accessibilityRole="button"
            onPress={() => setMenuVisible(true)}
            style={({ pressed }) => [
              styles.avatar,
              pressed && styles.buttonPressed,
            ]}
            testID="avatar-menu-button"
          >
            <Text style={styles.avatarText}>
              {session.username.charAt(0).toUpperCase()}
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.roleBadge,
            isAdmin ? styles.adminBadge : styles.userBadge,
          ]}
        >
          <Text style={styles.roleBadgeText}>{isAdmin ? 'ADMIN' : 'USER'}</Text>
        </View>

        <Text style={styles.sectionTitle}>Chức năng theo vai trò</Text>
        {roleFeatures.map(item => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            onPress={() => setActiveScreen(item.title)}
            style={({ pressed }) => [
              styles.featureCard,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{item.title}</Text>
              <Text style={styles.featureDescription}>{item.description}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
        transparent
        visible={menuVisible}
      >
        <Pressable
          onPress={() => setMenuVisible(false)}
          style={styles.modalOverlay}
          testID="account-menu-overlay"
        >
          <View style={styles.accountMenu}>
            <View style={styles.accountSummary}>
              <View style={styles.menuAvatar}>
                <Text style={styles.menuAvatarText}>
                  {session.username.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.accountName}>{session.username}</Text>
                <Text style={styles.accountRole}>
                  {isAdmin ? 'Quản trị viên' : 'Người dùng'}
                </Text>
              </View>
            </View>
            <MenuItem
              label="Thông tin cá nhân"
              onPress={() => openMenuScreen('profile')}
              testID="menu-profile"
            />
            <MenuItem
              label="Đổi mật khẩu"
              onPress={() => openMenuScreen('password')}
              testID="menu-change-password"
            />
            <MenuItem
              danger
              label="Đăng xuất"
              onPress={() => {
                setMenuVisible(false);
                onLogout();
              }}
              testID="logout-button"
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

type MenuItemProps = {
  label: string;
  onPress: () => void;
  testID: string;
  danger?: boolean;
};

function MenuItem({ label, onPress, testID, danger }: MenuItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        pressed && styles.buttonPressed,
      ]}
      testID={testID}
    >
      <Text style={[styles.menuItemText, danger && styles.dangerText]}>
        {label}
      </Text>
      <Text style={styles.menuChevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F4F7FB', flex: 1 },
  dashboardPage: { padding: 22, paddingBottom: 30 },
  topBar: { alignItems: 'center', flexDirection: 'row', marginBottom: 10 },
  headerText: { flex: 1, paddingRight: 8 },
  welcome: { color: '#657084', fontSize: 14 },
  dashboardTitle: {
    color: '#172033',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 3,
  },
  iconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    marginRight: 9,
    position: 'relative',
    width: 44,
  },
  bellIcon: {
    fontSize: 24,
    lineHeight: 30,
  },
  notificationBadge: {
    alignItems: 'center',
    backgroundColor: '#D12242',
    borderColor: '#F4F7FB',
    borderRadius: 10,
    borderWidth: 2,
    minHeight: 19,
    minWidth: 19,
    paddingHorizontal: 3,
    position: 'absolute',
    right: 1,
    top: 0,
  },
  notificationBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#B01432',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  roleBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginBottom: 24,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  adminBadge: { backgroundColor: '#B01432' },
  userBadge: { backgroundColor: '#2563A8' },
  roleBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  sectionTitle: {
    color: '#253047',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  featureCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E6EE',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    minHeight: 88,
    padding: 16,
  },
  featureText: { flex: 1 },
  featureTitle: { color: '#172033', fontSize: 16, fontWeight: '800' },
  featureDescription: { color: '#657084', fontSize: 14, marginTop: 4 },
  chevron: { color: '#9AA4B2', fontSize: 30, marginLeft: 12 },
  modalOverlay: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(18, 27, 43, 0.28)',
    flex: 1,
    paddingRight: 16,
    paddingTop: 72,
  },
  accountMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    elevation: 8,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    width: 270,
  },
  accountSummary: {
    alignItems: 'center',
    backgroundColor: '#F7F9FC',
    borderBottomColor: '#E6EBF2',
    borderBottomWidth: 1,
    flexDirection: 'row',
    padding: 15,
  },
  menuAvatar: {
    alignItems: 'center',
    backgroundColor: '#B01432',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    marginRight: 11,
    width: 40,
  },
  menuAvatarText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  accountName: { color: '#172033', fontSize: 15, fontWeight: '800' },
  accountRole: { color: '#657084', fontSize: 12, marginTop: 2 },
  menuItem: {
    alignItems: 'center',
    borderBottomColor: '#EDF0F4',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 51,
    paddingHorizontal: 17,
  },
  menuItemText: { color: '#253047', flex: 1, fontSize: 15, fontWeight: '600' },
  dangerText: { color: '#B01432' },
  menuChevron: { color: '#9AA4B2', fontSize: 24 },
  buttonPressed: { opacity: 0.65 },
});
