import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from '@/state/AppProvider';
import { useTheme } from '@/state/useTheme';
import { Loading } from '@/ui/components';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <RootNavigator />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const theme = useTheme();
  const { ready, error } = useApp();

  if (!ready) return <Loading label="データベースを準備しています…" />;

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing(6),
          gap: theme.spacing(2),
          backgroundColor: theme.colors.background,
        }}
      >
        <Text style={{ color: theme.colors.danger, fontSize: 16, fontWeight: '700' }}>
          データの読み込みに失敗しました
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 13, textAlign: 'center' }}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { color: theme.colors.text },
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="filament/[id]" options={{ title: 'フィラメント詳細' }} />
        <Stack.Screen name="filament/edit" options={{ title: 'フィラメント', presentation: 'modal' }} />
        <Stack.Screen
          name="print-log/new"
          options={{ title: '印刷を記録', presentation: 'modal' }}
        />
        <Stack.Screen name="storage-locations" options={{ title: '保管場所' }} />
        <Stack.Screen name="shopping-list" options={{ title: '買い直しリスト' }} />
      </Stack>
    </>
  );
}
