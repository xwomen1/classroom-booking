import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { UserRole } from '../../core/types/userRole';

type RoleDashboardScreenProps = {
  role: UserRole;
  onLogout: () => void;
};

export function RoleDashboardScreen({
  role,
  onLogout,
}: RoleDashboardScreenProps) {
  const isAdmin = role === 'admin';
  const items = isAdmin
    ? [
        ['Quản lý phòng', 'Cập nhật phòng và trang thiết bị'],
        ['Quản lý tài khoản', 'Quản lý người dùng và phân quyền'],
        ['Theo dõi hệ thống', 'Xem booking và nhật ký thao tác'],
      ]
    : [
        ['Tìm phòng', 'Tra cứu phòng theo thời gian và nhu cầu'],
        ['Booking của tôi', 'Theo dõi các yêu cầu đặt phòng'],
        ['Check-in / Check-out', 'Ghi nhận thời điểm sử dụng phòng'],
      ];

  return (
    <View style={styles.dashboardPage}>
      <View style={styles.dashboardHeader}>
        <View>
          <Text style={styles.welcome}>Xin chào, {role}</Text>
          <Text style={styles.dashboardTitle}>
            {isAdmin ? 'Chế độ quản trị viên' : 'Chế độ người dùng'}
          </Text>
        </View>
        <View
          style={[
            styles.roleBadge,
            isAdmin ? styles.adminBadge : styles.userBadge,
          ]}
        >
          <Text style={styles.roleBadgeText}>{isAdmin ? 'ADMIN' : 'USER'}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Chức năng theo vai trò</Text>
      {items.map(([title, description]) => (
        <View key={title} style={styles.featureCard}>
          <Text style={styles.featureTitle}>{title}</Text>
          <Text style={styles.featureDescription}>{description}</Text>
        </View>
      ))}

      <Text style={styles.scopeNote}>
        Bản hiện tại mới hoàn thành đăng nhập cục bộ và điều hướng theo vai trò.
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={onLogout}
        style={({ pressed }) => [
          styles.logoutButton,
          pressed && styles.buttonPressed,
        ]}
        testID="logout-button"
      >
        <Text style={styles.logoutButtonText}>Đăng xuất</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dashboardPage: { flex: 1, padding: 22 },
  dashboardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  welcome: { color: '#657084', fontSize: 14 },
  dashboardTitle: {
    color: '#172033',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 3,
  },
  roleBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  adminBadge: { backgroundColor: '#B01432' },
  userBadge: { backgroundColor: '#2563A8' },
  roleBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  sectionTitle: {
    color: '#253047',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  featureCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E6EE',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    padding: 16,
  },
  featureTitle: { color: '#172033', fontSize: 16, fontWeight: '800' },
  featureDescription: { color: '#657084', fontSize: 14, marginTop: 4 },
  scopeNote: {
    color: '#657084',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  logoutButton: {
    alignItems: 'center',
    borderColor: '#B01432',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 'auto',
    paddingVertical: 13,
  },
  logoutButtonText: { color: '#B01432', fontSize: 15, fontWeight: '800' },
  buttonPressed: { opacity: 0.78 },
});
