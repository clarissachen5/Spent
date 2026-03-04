import { View, Text, StyleSheet, Pressable } from "react-native";
import { useEffect, useMemo, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

export default function SignUp() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Expo Go proxy redirect (must match Google Cloud redirect URI)
  const redirectUri = "https://auth.expo.io/@clchen5/spent-actual";

  const clientId =
    "820527515652-glssibulbtjnq7vqur6hfg517k6lqbf1.apps.googleusercontent.com"; // WEB client

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: ["openid", "profile", "email"],
      extraParams: {
        access_type: "offline",
      },
    },
    discovery
  );

  useEffect(() => {
    console.log("redirectUri:", redirectUri);
    console.log("auth url:", request?.url);
  }, [request]);

  useEffect(() => {
    if (response?.type === "success") {
      // If you want tokens, exchange the code on your backend (recommended).
      console.log("Auth success:", response.params);
      router.replace("/(tabs)");
    } else if (response?.type === "error") {
      console.log("Auth error:", response.error);
    }
  }, [response, router]);

  // const handleGoogleSignIn = async () => {
  //   if (!request || loading) return;
  //   setLoading(true);
  //   try {
  //     await promptAsync();
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const [signingIn, setSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    if (!request || signingIn) return;
    setSigningIn(true);
    try {
      await promptAsync();
    } finally {
      setSigningIn(false);
    }
  };

  useEffect(() => {
  console.log("AUTH RESPONSE:", response);
}, [response]);
  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Text style={styles.title}>Welcome to Spent</Text>
      </View>

      <View style={styles.formSection}>
        <Pressable
          style={[styles.button, (!request || loading) && styles.buttonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={!request || loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Signing in..." : "Sign in with Google"}
          </Text>
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