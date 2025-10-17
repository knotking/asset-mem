// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/

import { Home, Settings } from "lucide-react-native";
import { type ComponentProps } from "react";

interface TabBarIconProps {
  name: string;
  color: string;
  style?: ComponentProps<typeof Home>["style"];
}

export function TabBarIcon({
  name,
  color,
  style,
  ...rest
}: TabBarIconProps) {
  const IconComponent = {
    home: Home,
    "home-outline": Home, // Using Home for both for simplicity
    settings: Settings,
    "settings-outline": Settings, // Using Settings for both for simplicity
  }[name];

  if (!IconComponent) {
    return null; // Or a fallback icon
  }

  return <IconComponent size={28} color={color} style={[{ marginBottom: -3 }, style]} {...rest} />;
}
