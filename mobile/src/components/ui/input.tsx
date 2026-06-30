import * as React from "react";
import { TextInput, View, Text } from "react-native";
import type { TextInputProps } from "react-native";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<React.ElementRef<typeof TextInput>, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <View className="mb-4">
        {label && <Text className="mb-1 text-sm font-medium text-gray-700">{label}</Text>}
        <TextInput
          ref={ref}
          className={`flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${error ? 'border-red-500' : ''} ${className || ''}`}
          placeholderTextColor="#9ca3af"
          {...props}
        />
        {error && <Text className="mt-1 text-xs text-red-500">{error}</Text>}
      </View>
    );
  }
);
Input.displayName = "Input";
