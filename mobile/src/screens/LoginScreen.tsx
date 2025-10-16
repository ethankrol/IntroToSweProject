import React, { useMemo, useState } from "react";

import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from "react-native";

type Props = {
  onValidLogin?: () => void;
};

// Very simple, front-end email pattern, im assuming real validation will happen on backend
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ onValidLogin }: Props) {
  /**
   * FORM STATE
   * - email/password: controlled inputs
   * - touched flags: show errors only after user interacts
   * - loading: disables UI & shows spinner during submit
   */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPwd, setTouchedPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const emailError = useMemo(() => {
    if (!email) return "Email is required";
    if (!emailRegex.test(email.trim())) return "Enter a valid email";
    return "";
  }, [email]);

  const pwdError = useMemo(() => {
    if (!password) return "Password is required";
    if (password.length < 6) return "Minimum 6 characters";
    return "";
  }, [password]);

  // Only allow submit if both fields are valid and nothing is loading.
  const canSubmit = !emailError && !pwdError && !loading;

  /**
   * SUBMIT HANDLER
   * - Marks fields as touched so errors appear if invalid
   * - If valid, shows a demo success alert (replace with real API call later)
   */
  const onSubmit = async () => {
    // Ensure errors show if inputs are still untouched
    setTouchedEmail(true);
    setTouchedPwd(true);

    if (!canSubmit) return;

    try {
      setLoading(true);
      onValidLogin?.(); // When this is called App.tsx sets screen to EditEventScreen.tsx
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#003d31" />

      {/* Logo image */}
      <Image
        source={require("../../assets/adaptive-icon.png")}
        style={styles.logo}
        resizeMode="contain"
        accessible
        accessibilityLabel="GatorGather logo"
      />

      {/* Email label + input */}
      <Text style={styles.label}>Email</Text>
      <TextInput
        // Base input style + conditional red border when invalid after touch
        style={[styles.input, touchedEmail && !!emailError && styles.inputError]}
        value={email} // Controlled value
        onChangeText={setEmail} // Update state on type
        onBlur={() => setTouchedEmail(true)} // Mark as touched on focus leave
        autoCapitalize="none" // Emails aren’t capitalized
        autoCorrect={false} // Disable autocorrect for emails
        keyboardType="email-address" // Email keyboard on mobile
        placeholder="gator@email.edu" // Hint text
        placeholderTextColor="#666" // Dim hint color
        returnKeyType="next" // Keyboard action
        keyboardAppearance="dark"
      />
      {/* Inline error (only after user has interacted) */}
      {touchedEmail && !!emailError && (
        <Text style={styles.errorText}>{emailError}</Text>
      )}

      {/* Password label + input */}
      <Text style={styles.label}>Password</Text>
      <TextInput
        style={[styles.input, touchedPwd && !!pwdError && styles.inputError]}
        value={password}
        onChangeText={setPassword}
        onBlur={() => setTouchedPwd(true)}
        secureTextEntry // Mask characters for privacy
        placeholder="••••••"
        placeholderTextColor="#666"
        returnKeyType="done"
        onSubmitEditing={onSubmit} // Enter key submits if valid
        keyboardAppearance="dark"
      />
      {touchedPwd && !!pwdError && (
        <Text style={styles.errorText}>{pwdError}</Text>
      )}

      {/* Submit button: disabled until form is valid; shows spinner while loading */}
      <TouchableOpacity
        style={[styles.btn, !canSubmit && styles.btnDisabled]}
        onPress={onSubmit}
        disabled={!canSubmit}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.btnText}>Log in</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// InputError applies a red border when invalid
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 8,
    backgroundColor: "#003d31", // dark green background
  },
  logo: {
    width: 500,
    height: 500,
    aspectRatio: 1,
    alignSelf: "center",
    marginBottom: 0,
  },
  label: {
    fontSize: 14,
    opacity: 0.95,
    color: "#FDF7F2", // light label for contrast on dark bg
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    color: "#000000", // black text on white input for readability
    borderColor: "#00000022",
    backgroundColor: "#FFFFFF",
  },
  inputError: {
    borderColor: "#d33",
  },
  errorText: {
    color: "#FFB5B5", // slightly lighter red for dark bg
    marginTop: 4,
  },
  btn: {
    marginTop: 12,
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDisabled: {
    opacity: 0.6, // Lower opacity for when login is not available
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

