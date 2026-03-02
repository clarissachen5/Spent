import { View, Text, StyleSheet, Pressable } from "react-native";
import { useEffect } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";

WebBrowser.maybeCompleteAuthSession();

export default function SignUp() {
  const router = useRouter();

  // ✅ Force Expo proxy redirect (HTTPS) for Expo Go
  // This should look like: https://auth.expo.io/@<username>/<slug>
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "spent",     // must match app.json "scheme"
    path: "redirect",    // any path, just needs to be consistent
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    // ✅ Web OAuth Client ID
    clientId:
      "820527515652-glssibulbtjnq7vqur6hfg517k6lqbf1.apps.googleusercontent.com",

    scopes: ["profile", "email"],

    // ✅ IMPORTANT: actually use the proxy redirect
    redirectUri,
  });

  useEffect(() => {
    console.log("redirectUri (computed):", redirectUri);
    console.log("redirectUri from request:", request?.redirectUri);
  }, [request, redirectUri]);

  useEffect(() => {
    if (response?.type === "success") {
      console.log("Google Sign-In success!", response.authentication);
      router.replace("/(tabs)"); // Change this to your dashboard route
    } else if (response?.type === "error") {
      console.log("Google Sign-In error:", response.error);
    } else {
      console.log("Google Sign-In response:", response?.type);
    }
  }, [response, router]);

  const handleGoogleSignIn = async () => {
    // ✅ No useProxy option needed here (we forced redirectUri above)
    await promptAsync();
  };

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Text style={styles.title}>Welcome to Spent</Text>
      </View>

      <View style={styles.formSection}>
        <Pressable
          style={[styles.button, (!request || request?.url == null) && styles.buttonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={!request || request?.url == null}
        >
          <Text style={styles.buttonText}>Sign in with Google</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  topSection: {
    flex: 1,
    backgroundColor: "#C7F36B",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 28, fontWeight: "600", color: "#333" },
  formSection: { flex: 2, padding: 30, justifyContent: "center" },
  button: {
    backgroundColor: "#C7F36B",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontWeight: "600", fontSize: 16, color: "#333" },
});