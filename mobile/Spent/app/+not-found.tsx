import { useEffect } from 'react';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

// Handles unmatched routes — most importantly the Google OAuth redirect URI.
// Only redirects to home if this is NOT an OAuth session completion.
export default function NotFound() {
  useEffect(() => {
    const result = WebBrowser.maybeCompleteAuthSession();
    // maybeCompleteAuthSession returns { type: 'success' } when it handled
    // an OAuth redirect — in that case the WebBrowser closes itself, no nav needed.
    if ((result as any)?.type !== 'success') {
      router.replace('/(tabs)/home');
    }
  }, []);

  return null;
}
