import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { RoleDashboardScreen } from './src/app';
import type { AuthenticatedUser } from './src/core/types/authenticatedUser';
import { clearApiSession } from './src/core/api/client';
import { LoginScreen } from './src/modules/auth';
import {
  PriorityBannerHost,
  requestPriorityNotificationPermission,
} from './src/modules/notifications';

function App() {
  const [session, setSession] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    requestPriorityNotificationPermission().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar backgroundColor="#F4F7FB" barStyle="dark-content" />
      <SafeAreaView
        style={styles.safeArea}
        edges={['top', 'right', 'bottom', 'left']}
      >
        {session ? (
          <RoleDashboardScreen
            session={session}
            onLogout={() => {
              clearApiSession();
              setSession(null);
            }}
          />
        ) : (
          <LoginScreen onLogin={setSession} />
        )}
      </SafeAreaView>
      <PriorityBannerHost />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7FB' },
});

export default App;
