import { View, Text, StyleSheet, Pressable } from "react-native";
import { useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useAuth } from "../../context/AuthContext";

WebBrowser.maybeCompleteAuthSession();

const isExpoGo = Constants.appOwnership === "expo";

export default function SignUp() {
  const router = useRouter();
  const { setToken } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  const redirectUri = isExpoGo
    ? AuthSession.makeRedirectUri({}) // Defaults to Expo Go proxy URI
    : AuthSession.makeRedirectUri({
        native: "com.googleusercontent.apps.820527515652-3ap73pd55flp82elvtsbpct1rjk23n3o:/oauthredirect",
      });

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: "820527515652-3ap73pd55flp82elvtsbpct1rjk23n3o.apps.googleusercontent.com",
    webClientId: "820527515652-glssibulbtjnq7vqur6hfg517k6lqbf1.apps.googleusercontent.com",
    scopes: ["openid", "profile", "email", "https://www.googleapis.com/auth/calendar.readonly"],
    redirectUri,
  });

  useEffect(() => {
    console.log("request.url:", request?.url);
    console.log("response:", response);
    if (response?.type === "success") {
      const accessToken = response.authentication?.accessToken;
      console.log("Google access token:", accessToken); // <-- Print the token
      if (accessToken) {
        setToken(accessToken);
        router.replace({ pathname: '/(tabs)/home', params: { checkIn: Date.now().toString() } });
      } else {
        console.warn("Authentication object is missing accessToken.");
      }
    }
  }, [response]);

  const handleGoogleSignIn = async () => {
    if (!request || signingIn) return;
    setSigningIn(true);
    try {
      await promptAsync();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.button, (!request || signingIn) && styles.buttonDisabled]}
        disabled={!request || signingIn}
        onPress={handleGoogleSignIn}
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
