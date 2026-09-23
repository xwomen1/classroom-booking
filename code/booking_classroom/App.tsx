import React, { useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { RoleDashboardScreen } from './src/app';
import type { AuthenticatedUser } from './src/core/types/authenticatedUser';
import { LoginScreen } from './src/modules/auth';

function App() {
  const [session, setSession] = useState<AuthenticatedUser | null>(null);

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
            onLogout={() => setSession(null)}
          />
        ) : (
          <LoginScreen onLogin={setSession} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7FB' },
});

export default App;
