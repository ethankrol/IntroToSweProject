import React, { useMemo, useState } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
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
import { signup, login } from "../services/auth";
import { setCookie } from "../services/cookie";
import { useNavigation } from '@react-navigation/native';

type Props = {
  onValidLogin?: () => void;
};

// Very simple, front-end email pattern, im assuming real validation will happen on backend
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ onValidLogin }: Props) {
  const navigation = useNavigation();
  /**
   * FORM STATE
   * - email/password: controlled inputs
   * - touched flags: show errors only after user interacts
   * - loading: disables UI & shows spinner during submit
   */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPwd, setTouchedPwd] = useState(false);
  const [touchedFirst, setTouchedFirst] = useState(false);
  const [touchedLast, setTouchedLast] = useState(false);
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

  // Simple required validation for signup-only fields
  const firstError = useMemo(() => {
    if (!firstName.trim()) return "First name is required";
    return "";
  }, [firstName]);

  const lastError = useMemo(() => {
    if (!lastName.trim()) return "Last name is required";
    return "";
  }, [lastName]);

  // Only allow submit if both fields are valid and nothing is loading.
  const canSubmitLogin = !emailError && !pwdError && !loading;
  const canSubmitSignup = !emailError && !pwdError && !firstError && !lastError && !loading;

  /**
   * SUBMIT HANDLER
   * - Marks fields as touched so errors appear if invalid
   * - If valid, shows a demo success alert (replace with real API call later)
   */
  const onSubmit = async () => {
    // Ensure errors show if inputs are still untouched
    setTouchedEmail(true);
    setTouchedPwd(true);

    if (!canSubmitLogin) return;

    try {
      setLoading(true);
      // Call login API
      const result = await login(email.trim(), password);
      // Store token as a cookie-like value on device
      await setCookie('auth_token', result.access_token);
      // Notify parent (App.tsx) to navigate to Home
      onValidLogin?.();
    } catch (e: any) {
      Alert.alert('Login failed', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onSignUp = () => {
    setTouchedEmail(true);
    setTouchedPwd(true);
    setTouchedFirst(true);
    setTouchedLast(true);

    if (!canSubmitSignup) return;

    (async () => {
      try {
        setLoading(true);
        await signup({
          email,
          password,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        });
        Alert.alert("Success", "Account created.");
        onValidLogin?.();
      } catch (e: any) {
        Alert.alert("Sign up failed", e?.message ?? "Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#003d31" />
      <KeyboardAwareScrollView
        style={{ backgroundColor: "#003d31" }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={40}   // nudge field above keyboard
      >
        <View style={styles.container}>
          {/* Logo image */}
          <Image
            source={require("../../assets/adaptive-icon.png")}
            style={styles.logo}
            resizeMode="contain"
            accessible
            accessibilityLabel="GatorGather logo"
          />

          {/* First / Last name side-by-side under logo */}
          <View style={styles.nameRow}>
            <View style={styles.nameCol}>
              <Text style={[styles.label, styles.nameLabel]}>First name</Text>
              <TextInput
                style={[styles.input, touchedFirst && !!firstError && styles.inputError]}
                value={firstName}
                onChangeText={setFirstName}
                onBlur={() => setTouchedFirst(true)}
                placeholder="Albert"
                placeholderTextColor="#666"
                returnKeyType="next"
                keyboardAppearance="dark"
              />
              {touchedFirst && !!firstError && (
                <Text style={styles.errorText}>{firstError}</Text>
              )}
            </View>

            <View style={styles.nameCol}>
              <Text style={[styles.label, styles.nameLabel]}>Last name</Text>
              <TextInput
                style={[styles.input, touchedLast && !!lastError && styles.inputError]}
                value={lastName}
                onChangeText={setLastName}
                onBlur={() => setTouchedLast(true)}
                placeholder="Gator"
                placeholderTextColor="#666"
                returnKeyType="next"
                keyboardAppearance="dark"
              />
              {touchedLast && !!lastError && (
                <Text style={styles.errorText}>{lastError}</Text>
              )}
            </View>
          </View>

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

          <TouchableOpacity
            style={[styles.btn, !canSubmitLogin && styles.btnDisabled]}
            onPress={onSubmit}
            disabled={!canSubmitLogin}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.btnText}>Log in</Text>
            )}
          </TouchableOpacity>

          {/* Sign up button (same style as Log in) */}
          <TouchableOpacity
            style={[styles.btn, !canSubmitSignup && styles.btnDisabled]}
            onPress={onSignUp}
            disabled={!canSubmitSignup}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>Sign up</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('ResetPassword' as never)}
            style={{ marginTop: 12 }}
          >
            <Text style={{ color: '#fff', textAlign: 'center', textDecorationLine: 'underline' }}>Forgot password?</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </>
  );
}

// InputError applies a red border when invalid
const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,               // allow centering + scroll when needed
    justifyContent: "center",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 8,
    backgroundColor: "#003d31",
  },
  logo: {
    width: 500,
    height: 500,
    aspectRatio: 1,
    alignSelf: "center",
    marginBottom: 0,
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },
  nameCol: {
    flex: 1,
  },
  nameLabel: {
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    opacity: 0.95,
    color: "#FDF7F2",
    marginTop: 0,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    color: "#000000",
    borderColor: "#00000022",
    backgroundColor: "#FFFFFF",
  },
  inputError: {
    borderColor: "#d33",
  },
  errorText: {
    color: "#FFB5B5",
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
