import { Link } from "expo-router";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useEffect } from "react";
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";

export default function SignUp() {
  const router = useRouter();

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: "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", // Replace with your client ID
    iosClientId: "YOUR_IOS_CLIENT_ID",
    androidClientId: "YOUR_ANDROID_CLIENT_ID",
    webClientId: "YOUR_WEB_CLIENT_ID",
  });

  useEffect(() => {
    if (response?.type === "success") {
      // After Google sign-in, go to name input page
      router.replace("/name");
    }
  }, [response]);

  return (
    <View style={styles.container}>
      {/* Lime Top Section */}
      <View style={styles.topSection}>
        <Text style={styles.title}>Welcome to Spent</Text>
      </View>

      {/* White Form Section */}
      <View style={styles.formSection}>
        <Pressable style={styles.button} onPress={() => promptAsync()}>
          <Text style={styles.buttonText}>Sign in with Google</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },

  /* Lime Header */
  topSection: {
    flex: 1,
    backgroundColor: "#C7F36B",
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    fontSize: 28,
    fontWeight: "600",
    color: "#333",
  },

  /* Form Area */
  formSection: {
    flex: 2,
    padding: 30,
    justifyContent: "center",
  },

  button: {
    backgroundColor: "#C7F36B",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  buttonText: {
    fontWeight: "600",
    fontSize: 16,
    color: "#333",
  },
});