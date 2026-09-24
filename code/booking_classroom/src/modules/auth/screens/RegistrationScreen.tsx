import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenHeader } from '../../../shared';
import { addNotification } from '../../notifications';
import { saveProfile } from '../../profile';
import { registerAccount } from '../services/accountRepository';

type RegistrationScreenProps = { onBack: () => void };

export function RegistrationScreen({ onBack }: RegistrationScreenProps) {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedUsername || !fullName.trim() || !email.trim() || !password || !recoveryCode) {
      setIsError(true);
      setMessage('Vui lòng nhập đầy đủ các trường bắt buộc.');
      return;
    }
    if (!email.includes('@')) {
      setIsError(true);
      setMessage('Email chưa đúng định dạng.');
      return;
    }
    if (password.length < 4) {
      setIsError(true);
      setMessage('Mật khẩu cần có ít nhất 4 ký tự.');
      return;
    }
    if (recoveryCode.length < 4) {
      setIsError(true);
      setMessage('Mã khôi phục cần có ít nhất 4 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setIsError(true);
      setMessage('Hai mật khẩu chưa trùng nhau.');
      return;
    }

    setSaving(true);
    try {
      const account = await registerAccount({
        username: normalizedUsername,
        password,
        recoveryCode,
      });
      await saveProfile({
        username: account.username,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: '',
        department: '',
      });
      await addNotification(
        account.username,
        'Đăng ký thành công',
        'Bạn có thể đăng nhập và hoàn thiện thông tin cá nhân.',
      );
      setIsError(false);
      setMessage('Đăng ký thành công. Hãy quay lại để đăng nhập.');
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Không thể đăng ký.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <ScreenHeader title="Đăng ký tài khoản" onBack={onBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.note}>
          Tài khoản đăng ký mới được tạo với vai trò người dùng.
        </Text>
        <FormField
          label="Tên đăng nhập *"
          onChangeText={setUsername}
          value={username}
          autoCapitalize="none"
          testID="register-username"
        />
        <FormField
          label="Họ và tên *"
          onChangeText={setFullName}
          value={fullName}
          testID="register-full-name"
        />
        <FormField
          label="Email *"
          onChangeText={setEmail}
          value={email}
          autoCapitalize="none"
          keyboardType="email-address"
          testID="register-email"
        />
        <FormField
          label="Mã khôi phục *"
          onChangeText={setRecoveryCode}
          value={recoveryCode}
          secureTextEntry
          testID="register-recovery-code"
        />
        <FormField
          label="Mật khẩu *"
          onChangeText={setPassword}
          value={password}
          secureTextEntry
          testID="register-password"
        />
        <FormField
          label="Nhập lại mật khẩu *"
          onChangeText={setConfirmPassword}
          value={confirmPassword}
          secureTextEntry
          testID="register-confirm-password"
        />
        {message ? (
          <Text style={isError ? styles.error : styles.success}>{message}</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={submit}
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || saving) && styles.pressed,
          ]}
          testID="register-submit"
        >
          <Text style={styles.primaryButtonText}>
            {saving ? 'Đang tạo...' : 'Tạo tài khoản'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FormFieldProps = React.ComponentProps<typeof TextInput> & {
  label: string;
};

function FormField({ label, ...props }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#7D8795"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F4F7FB', flex: 1 },
  content: { padding: 22, paddingBottom: 36 },
  note: {
    backgroundColor: '#EDF5FF',
    borderRadius: 10,
    color: '#24598F',
    fontSize: 14,
    marginBottom: 18,
    padding: 13,
  },
  field: { marginBottom: 15 },
  label: { color: '#253047', fontSize: 14, fontWeight: '700', marginBottom: 7 },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C9D2E0',
    borderRadius: 10,
    borderWidth: 1,
    color: '#172033',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: { color: '#B42318', marginBottom: 14 },
  success: { color: '#18713D', marginBottom: 14 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#B01432',
    borderRadius: 10,
    paddingVertical: 14,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
