    import { View, Text, StyleSheet, Pressable } from "react-native";
    import { useEffect } from "react";
    import * as WebBrowser from "expo-web-browser";
    import * as Google from "expo-auth-session/providers/google";
    import { makeRedirectUri } from "expo-auth-session";
    import { useRouter } from "expo-router";

    WebBrowser.maybeCompleteAuthSession();

    export default function SignUp() {
    const router = useRouter();

    // ✅ Force HTTPS redirect via Expo proxy (valid for Google)
    const redirectUri = makeRedirectUri({ useProxy: true } as any);

    const [request, response, promptAsync] = Google.useAuthRequest({
        // ✅ MUST be the Web Client ID (ends with .apps.googleusercontent.com)
        clientId:
        "820527515652-glssibulbtjnq7vqur6hfg517k6lqbf1.apps.googleusercontent.com",
        iosClientId:
        "820527515652-glssibulbtjnq7vqqur6hfg517k6lqbf1.apps.googleusercontent.com",

        scopes: ["profile", "email"],

        // ✅ Important for validity in Expo Go
        redirectUri,
    });

    useEffect(() => {
        //pass token to dashboard on successful login to navigation page
    if (response?.type === "success") {
        const token = response.authentication?.accessToken;
        console.log("Access Token:", token);

        router.push({
        pathname: "/(tabs)",
        params: { token }, // pass token to dashboard
        });
    }
    }, [response]);

    const handleGoogleSignIn = async () => {
        // ✅ Must use proxy in Expo Go
        await (promptAsync as any)({ useProxy: true });
    };

    return (
        <View style={styles.container}>
        <View style={styles.topSection}>
            <Text style={styles.title}>Welcome to Spent</Text>
        </View>

        <View style={styles.formSection}>
            <Pressable
            style={[styles.button, !request && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={!request}
            >
            <Text style={styles.buttonText}>Sign in with Google</Text>
            </Pressable>

            {/* Helpful debug */}
            <Text style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
            Redirect URI: {redirectUri}
            </Text>
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