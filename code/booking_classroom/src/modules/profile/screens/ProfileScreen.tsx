import React, { useEffect, useState } from 'react';
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
import type { UserProfile } from '../model/userProfile';
import { getProfile, saveProfile } from '../services/profileRepository';

type ProfileScreenProps = {
  username: string;
  onBack: () => void;
};

const EMPTY_PROFILE: UserProfile = {
  username: '',
  fullName: '',
  email: '',
  phone: '',
  department: '',
};

export function ProfileScreen({ username, onBack }: ProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile>({
    ...EMPTY_PROFILE,
    username,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getProfile(username)
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [username]);

  const update = (field: keyof UserProfile, value: string) => {
    setProfile(current => ({ ...current, [field]: value }));
  };

  const submit = async () => {
    if (!profile.fullName.trim()) {
      setMessage('Họ và tên không được để trống.');
      return;
    }
    if (profile.email && !profile.email.includes('@')) {
      setMessage('Email chưa đúng định dạng.');
      return;
    }

    setSaving(true);
    await saveProfile({
      ...profile,
      fullName: profile.fullName.trim(),
      email: profile.email.trim(),
      phone: profile.phone.trim(),
      department: profile.department.trim(),
    });
    await addNotification(
      username,
      'Hồ sơ đã được cập nhật',
      'Thông tin cá nhân của bạn đã được lưu trên thiết bị.',
    );
    setMessage('Đã lưu thông tin cá nhân.');
    setSaving(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <ScreenHeader title="Thông tin cá nhân" onBack={onBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile.fullName || username).charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.username}>@{username}</Text>
        {loading ? <Text style={styles.loading}>Đang tải...</Text> : null}
        <ProfileField
          label="Họ và tên *"
          onChangeText={value => update('fullName', value)}
          testID="profile-full-name"
          value={profile.fullName}
        />
        <ProfileField
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          onChangeText={value => update('email', value)}
          testID="profile-email"
          value={profile.email}
        />
        <ProfileField
          keyboardType="phone-pad"
          label="Số điện thoại"
          onChangeText={value => update('phone', value)}
          testID="profile-phone"
          value={profile.phone}
        />
        <ProfileField
          label="Đơn vị / Khoa"
          onChangeText={value => update('department', value)}
          testID="profile-department"
          value={profile.department}
        />
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={saving || loading}
          onPress={submit}
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || saving || loading) && styles.pressed,
          ]}
          testID="profile-save"
        >
          <Text style={styles.primaryButtonText}>
            {saving ? 'Đang lưu...' : 'Lưu thông tin'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type ProfileFieldProps = React.ComponentProps<typeof TextInput> & {
  label: string;
};

function ProfileField({ label, ...props }: ProfileFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} placeholderTextColor="#7D8795" style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F4F7FB', flex: 1 },
  content: { padding: 22, paddingBottom: 36 },
  avatar: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#B01432',
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  avatarText: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
  username: {
    color: '#657084',
    fontSize: 14,
    marginBottom: 24,
    marginTop: 8,
    textAlign: 'center',
  },
  loading: { color: '#657084', marginBottom: 12, textAlign: 'center' },
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
  message: { color: '#18713D', marginBottom: 14 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#B01432',
    borderRadius: 10,
    paddingVertical: 14,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
