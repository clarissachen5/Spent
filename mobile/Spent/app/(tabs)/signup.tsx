import { View, Text, StyleSheet, Pressable } from "react-native";
import { useEffect } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import { useRouter } from "expo-router";

WebBrowser.maybeCompleteAuthSession();

export default function SignUp() {
  const router = useRouter();

  // ✅ Force Expo Auth proxy URL (HTTPS) for Expo Go
  // IMPORTANT: this is the correct format: https://auth.expo.io/@username/slug
  const redirectUri = "https://auth.expo.io/clchen5/spent-actual";

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId:
      "820527515652-glssibulbtjnq7vqur6hfg517k6lqbf1.apps.googleusercontent.com",
    // iosClientId:
      // "820527515652-3ap73pd55flp82elvtsbpct1rjk23n3o.apps.googleusercontent.com",
    redirectUri, // ✅ DO NOT comment out
    scopes: ["profile", "email"],
  });

  console.log("---- GOOGLE AUTH DEBUG ----");
  console.log("request?.url:", request?.url);
  console.log("request?.redirectUri:", request?.redirectUri);
  console.log("request?.clientId:", request?.clientId);
  console.log("---------------------------");

  useEffect(() => {
    console.log("request.redirectUri:", request?.redirectUri);
  }, [request]);

  useEffect(() => {
    if (response?.type === "success") {
      router.replace("/(tabs)");
    } else if (response?.type === "error") {
      console.log("Google Sign-In error:", response.error);
    }
    console.log("Google response:", response);
  }, [response, router]);

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Text style={styles.title}>Welcome to Spent</Text>
      </View>

      <View style={styles.formSection}>
        <Pressable
          style={[
            styles.button,
            (!request || !request.url) && styles.buttonDisabled,
          ]}
          onPress={() => promptAsync()}
          disabled={!request || !request.url}
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