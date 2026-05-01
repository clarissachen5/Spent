import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useAuth } from "../../context/AuthContext";
import { Image as ExpoImage } from "expo-image";
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get("window");
const isExpoGo = Constants.appOwnership === "expo";
const PIG = require("../../assets/images/pig.png");

export default function SignUp() {
  const router = useRouter();
  const { setToken } = useAuth();
  const { bottom } = useSafeAreaInsets();
  const [signingIn, setSigningIn] = useState(false);

  const redirectUri = isExpoGo
    ? AuthSession.makeRedirectUri({})
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
    if (response?.type === "success") {
      const accessToken = response.authentication?.accessToken;
      if (accessToken) {
        setToken(accessToken);
        router.replace("/(tabs)/onboarding");
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
      {/* Figma gradient: white holds until 36.5%, then fades to rgba(205,245,69,0.2) */}
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          <SvgGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"       stopColor="#ffffff" stopOpacity="1" />
            <Stop offset="0.365"   stopColor="#ffffff" stopOpacity="1" />
            <Stop offset="1"       stopColor="#cdf545" stopOpacity="0.2" />
          </SvgGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#bg)" />
      </Svg>

      {/* Centered content — 20px horizontal padding per Figma */}
      <View style={styles.content}>
        {/* Pig: 150×136 container, image at natural ~160×145 with slight overflow */}
        <View style={styles.pigContainer}>
          <ExpoImage source={PIG} style={styles.pig} contentFit="contain" />
        </View>
        <Text style={styles.title}>Welcome to Spent</Text>
      </View>

      <View style={[styles.buttonContainer, { paddingBottom: bottom + 40 }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  pigContainer: {
    width: 150,
    height: 136,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  pig: {
    width: 160,
    height: 145,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#4f090b",
    textAlign: "center",
  },
  buttonContainer: {
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: "#cdf545",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontWeight: "600",
    fontSize: 16,
    color: "#1e1d19",
  },
});
