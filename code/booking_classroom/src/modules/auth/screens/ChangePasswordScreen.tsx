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
import { ScreenHeader } from '../../../shared';
import { addNotification } from '../../notifications';
import { changePassword } from '../services/accountRepository';

type ChangePasswordScreenProps = {
  username: string;
  onBack: () => void;
};

export function ChangePasswordScreen({
  username,
  onBack,
}: ChangePasswordScreenProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setIsError(true);
      setMessage('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    if (newPassword.length < 4) {
      setIsError(true);
      setMessage('Mật khẩu mới cần có ít nhất 4 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setIsError(true);
      setMessage('Hai mật khẩu mới chưa trùng nhau.');
      return;
    }

    setSaving(true);
    try {
      await changePassword(username, currentPassword, newPassword);
      await addNotification(
        username,
        'Mật khẩu đã được thay đổi',
        'Mật khẩu tài khoản của bạn vừa được cập nhật trên thiết bị này.',
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsError(false);
      setMessage('Đổi mật khẩu thành công.');
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : 'Không thể đổi mật khẩu.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <ScreenHeader title="Đổi mật khẩu" onBack={onBack} />
      <View style={styles.content}>
        <Text style={styles.account}>Tài khoản: {username}</Text>
        <PasswordField
          label="Mật khẩu hiện tại"
          onChangeText={setCurrentPassword}
          testID="current-password"
          value={currentPassword}
        />
        <PasswordField
          label="Mật khẩu mới"
          onChangeText={setNewPassword}
          testID="new-password"
          value={newPassword}
        />
        <PasswordField
          label="Nhập lại mật khẩu mới"
          onChangeText={setConfirmPassword}
          testID="confirm-new-password"
          value={confirmPassword}
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
          testID="change-password-submit"
        >
          <Text style={styles.primaryButtonText}>
            {saving ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

type PasswordFieldProps = React.ComponentProps<typeof TextInput> & {
  label: string;
};

function PasswordField({ label, ...props }: PasswordFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#7D8795"
        secureTextEntry
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F4F7FB', flex: 1 },
  content: { padding: 22 },
  account: { color: '#657084', fontSize: 14, marginBottom: 20 },
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
