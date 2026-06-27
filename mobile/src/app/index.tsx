import { useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export default function HomeScreen() {
  const { user, status, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-6 pt-12">
        <Text className="text-3xl font-bold text-gray-900 mb-2">Welcome to Arena</Text>
        <Text className="text-gray-600 mb-8">
          Logged in as {user?.email} ({user?.role})
        </Text>

        <View className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-2">Your Dashboard</Text>
          <Text className="text-gray-600 mb-4">
            This is the first native screen built with React Native and NativeWind. The backend logic, state management, and Supabase integration are exactly the same as the web app!
          </Text>
        </View>

        <Button variant="outline" onPress={logout} className="mt-4">
          Sign out
        </Button>
      </View>
    </ScrollView>
  );
}
