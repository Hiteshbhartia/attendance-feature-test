import * as React from "react";
import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import type { TouchableOpacityProps } from "react-native";

export interface ButtonProps extends TouchableOpacityProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<React.ElementRef<typeof TouchableOpacity>, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, children, disabled, ...props }, ref) => {
    // Basic NativeWind equivalents to Radix UI button variants
    const baseStyles = "flex-row items-center justify-center rounded-md";
    const variants = {
      default: "bg-black", // Update to theme primary color
      destructive: "bg-red-500",
      outline: "border border-gray-200 bg-transparent",
      secondary: "bg-gray-100",
      ghost: "bg-transparent",
      link: "bg-transparent",
    };
    const textVariants = {
      default: "text-white font-medium",
      destructive: "text-white font-medium",
      outline: "text-black font-medium",
      secondary: "text-black font-medium",
      ghost: "text-black font-medium",
      link: "text-blue-600 underline",
    };
    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-9 px-3",
      lg: "h-11 px-8",
      icon: "h-10 w-10",
    };

    const containerStyle = `${baseStyles} ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50' : ''} ${className || ''}`;

    return (
      <TouchableOpacity
        ref={ref}
        className={containerStyle}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <ActivityIndicator color={variant === "default" ? "#fff" : "#000"} />
        ) : (
          <Text className={textVariants[variant]}>{children}</Text>
        )}
      </TouchableOpacity>
    );
  }
);
Button.displayName = "Button";
