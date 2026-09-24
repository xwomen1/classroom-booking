import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AuthenticatedUser } from '../../../core/types/authenticatedUser';
import { authenticate } from '../services/accountRepository';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { RegistrationScreen } from './RegistrationScreen';

type LoginScreenProps = {
  onLogin: (user: AuthenticatedUser) => void;
};

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
      return;
    }

    setSubmitting(true);
    const user = await authenticate(username, password);
    setSubmitting(false);
    if (!user) {
      setError('Sai tài khoản hoặc mật khẩu.');
      return;
    }

    setError('');
    onLogin(user);
  };

  if (selectedFeature === 'Đăng ký') {
    return <RegistrationScreen onBack={() => setSelectedFeature(null)} />;
  }

  if (selectedFeature === 'Quên mật khẩu') {
    return <ForgotPasswordScreen onBack={() => setSelectedFeature(null)} />;
  }

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
            disabled={submitting}
            onPress={submit}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || submitting) && styles.buttonPressed,
            ]}
            testID="login-button"
          >
            <Text style={styles.primaryButtonText}>
              {submitting ? 'Đang kiểm tra...' : 'Đăng nhập'}
            </Text>
          </Pressable>

          <View style={styles.secondaryActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedFeature('Đăng ký')}
            >
              <Text style={styles.secondaryActionText}>Đăng ký</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedFeature('Quên mật khẩu')}
            >
              <Text style={styles.secondaryActionText}>Quên mật khẩu?</Text>
            </Pressable>
          </View>
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  secondaryActionText: { color: '#B01432', fontSize: 14, fontWeight: '700' },
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
});
