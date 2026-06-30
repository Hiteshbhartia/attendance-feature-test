import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const { login, isLoading, error, clearError, apiEnabled } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit() {
    clearError();
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch {
      // error surfaced via context
    }
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <View className="mb-8 items-center">
          <Text className="text-3xl font-bold text-gray-900 mb-2">Sign in</Text>
          <Text className="text-gray-500 text-center">Use your Arena account. Sessions persist across app restarts.</Text>
        </View>

        {!apiEnabled && (
          <View className="mb-4 rounded-md border border-red-300 bg-red-100 px-3 py-2">
            <Text className="text-sm text-red-600">
              API is not configured properly. Check your .env file.
            </Text>
          </View>
        )}

        <View className="space-y-4">
          <Input
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@gharpayy.com"
          />
          <Input
            label="Password"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
          />

          {error ? (
            <View className="rounded-md border border-red-300 bg-red-100 px-3 py-2 mt-2">
              <Text className="text-sm text-red-600">{error}</Text>
            </View>
          ) : null}

          <View className="mt-6">
            <Button 
              onPress={onSubmit} 
              disabled={isLoading || !apiEnabled}
              isLoading={isLoading}
            >
              Sign in
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
