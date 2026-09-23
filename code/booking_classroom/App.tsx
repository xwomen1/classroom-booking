import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { authenticate, type UserRole } from './src/auth';

type LoginScreenProps = {
  onLogin: (role: UserRole) => void;
};

function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (!username.trim() || !password) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
      return;
    }

    const role = authenticate(username, password);
    if (!role) {
      setError('Sai tài khoản hoặc mật khẩu.');
      return;
    }

    setError('');
    onLogin(role);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <View style={styles.loginPage}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>BC</Text>
        </View>
        <Text style={styles.appName}>booking_classroom</Text>
        <Text style={styles.subtitle}>Đăng nhập để sử dụng đúng chế độ</Text>

        <View style={styles.formCard}>
          <Text style={styles.label}>Tài khoản</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setUsername}
            placeholder="Nhập tài khoản"
            placeholderTextColor="#7D8795"
            returnKeyType="next"
            style={styles.input}
            testID="username-input"
            value={username}
          />

          <Text style={styles.label}>Mật khẩu</Text>
          <TextInput
            onChangeText={setPassword}
            onSubmitEditing={submit}
            placeholder="Nhập mật khẩu"
            placeholderTextColor="#7D8795"
            returnKeyType="done"
            secureTextEntry
            style={styles.input}
            testID="password-input"
            value={password}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            onPress={submit}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
            testID="login-button"
          >
            <Text style={styles.primaryButtonText}>Đăng nhập</Text>
          </Pressable>
        </View>

        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>Tài khoản demo cục bộ</Text>
          <Text style={styles.demoText}>Quản trị viên: admin / 1</Text>
          <Text style={styles.demoText}>Người dùng: user / 2</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

type DashboardProps = {
  role: UserRole;
  onLogout: () => void;
};

function Dashboard({ role, onLogout }: DashboardProps) {
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

function App() {
  const [role, setRole] = useState<UserRole | null>(null);

  return (
    <SafeAreaProvider>
      <StatusBar backgroundColor="#F4F7FB" barStyle="dark-content" />
      <SafeAreaView
        style={styles.safeArea}
        edges={['top', 'right', 'bottom', 'left']}
      >
        {role ? (
          <Dashboard role={role} onLogout={() => setRole(null)} />
        ) : (
          <LoginScreen onLogin={setRole} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F4F7FB' },
  loginPage: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  brandMark: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#B01432',
    borderRadius: 18,
    height: 64,
    justifyContent: 'center',
    marginBottom: 14,
    width: 64,
  },
  brandMarkText: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  appName: {
    color: '#172033',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#5B6678',
    fontSize: 15,
    marginBottom: 24,
    marginTop: 6,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E6EE',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  label: {
    color: '#253047',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 7,
  },
  input: {
    backgroundColor: '#F7F9FC',
    borderColor: '#C9D2E0',
    borderRadius: 10,
    borderWidth: 1,
    color: '#172033',
    fontSize: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: { color: '#B42318', marginBottom: 12 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#B01432',
    borderRadius: 10,
    paddingVertical: 14,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  buttonPressed: { opacity: 0.78 },
  demoBox: {
    alignSelf: 'center',
    backgroundColor: '#FFF5E6',
    borderColor: '#F0C98A',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    width: '100%',
  },
  demoTitle: { color: '#704C12', fontSize: 13, fontWeight: '800' },
  demoText: { color: '#704C12', fontSize: 13, marginTop: 3 },
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
});

export default App;
