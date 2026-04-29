import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

const LIME_GREEN = '#cdf545';
const DARK_OUTLINE = '#0a542f';
const ACTIVE_GREEN = '#4a7a1e';
const GRAY_INACTIVE = '#a5a5a5';

type IconName = React.ComponentProps<typeof IconSymbol>['name'];

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  if (!focused) {
    return <IconSymbol size={24} name={name} color={GRAY_INACTIVE} />;
  }
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <IconSymbol size={28} name={name} color={DARK_OUTLINE} style={{ position: 'absolute' }} />
      <IconSymbol size={22} name={name} color={LIME_GREEN} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="signup"
      screenOptions={{
        tabBarActiveTintColor: ACTIVE_GREEN,
        tabBarInactiveTintColor: GRAY_INACTIVE,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Platform.OS === 'ios' ? 24 : 16,
          height: 72,
          borderRadius: 36,
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 10 : 12,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="signup"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="onboarding"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon name="chart.bar.fill" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ focused }) => <TabIcon name="calendar" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: 'Summary',
          tabBarIcon: ({ focused }) => <TabIcon name="chart.pie.fill" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="person.fill" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="explore"
        options={{ href: null }}
      />
    </Tabs>
  );
}
