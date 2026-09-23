import React, { useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { RoleDashboardScreen } from './src/app';
import type { UserRole } from './src/core/types/userRole';
import { LoginScreen } from './src/modules/auth';

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
          <RoleDashboardScreen role={role} onLogout={() => setRole(null)} />
        ) : (
          <LoginScreen onLogin={setRole} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7FB' },
});

export default App;
