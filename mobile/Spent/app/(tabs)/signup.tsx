import { View, Text, StyleSheet, Pressable } from "react-native";
import { useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";

WebBrowser.maybeCompleteAuthSession();

export default function SignUp() {
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId:
      "820527515652-3ap73pd55flp82elvtsbpct1rjk23n3o.apps.googleusercontent.com",
    // include these later if you want Android/Web too:
    // androidClientId: "...",
    // webClientId: "...",
    scopes: ["openid", "profile", "email"],
  });

  useEffect(() => {
    console.log("request.url:", request?.url);
    console.log("response:", response);
    if (response?.type === "success") {
      router.replace("/(tabs)");
    }
  }, [response]);

  const handleGoogleSignIn = async () => {
    if (!request || signingIn) return;
    setSigningIn(true);
    try {
      await promptAsync(); // ✅ no proxy
    } finally {
      setSigningIn(false);
    }
  };


  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.button, (!request || signingIn) && styles.buttonDisabled]}
        disabled={!request || signingIn}
        onPress={async () => {
          setSigningIn(true);
          try {
            await promptAsync(); // NO proxy
          } finally {
            setSigningIn(false);
          }
        }}
      >
        <Text style={styles.buttonText}>
          {signingIn ? "Signing in..." : "Sign in with Google"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "white" },
  button: { backgroundColor: "#C7F36B", padding: 15, borderRadius: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontWeight: "600", fontSize: 16, color: "#333" },
});