import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';

const DARK_GREEN = '#0a542f';
const LIME_GREEN = '#cdf545';

export default function Settings() {
  const { logout } = useAuth();
  const router    = useRouter();
  const { top }   = useSafeAreaInsets();

  const handleLogout = () => {
    logout();
    router.replace('/(tabs)/signup');
  };

  return (
    <View style={[styles.container, { paddingTop: top + 20 }]}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: DARK_GREEN,
    marginBottom: 32,
  },
  section: {
    gap: 12,
  },
  logoutBtn: {
    backgroundColor: DARK_GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: LIME_GREEN,
  },
});
