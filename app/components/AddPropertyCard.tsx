import React from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from "react-native";
import { PlusCircle } from "lucide-react-native";
import { Colors } from "../constants/theme";
import { useTheme } from "../hooks/use-theme";

interface AddPropertyCardProps {
  onPress: () => void;
  style?: ViewStyle;
}

const createDynamicStyles = (themeColors: typeof Colors.light) =>
  StyleSheet.create({
    card: {
      backgroundColor: themeColors.cardBackground,
      borderColor: themeColors.cardBorder,
    },
    cardText: {
      color: themeColors.text,
    },
    cardDescription: {
      color: themeColors.icon,
    },
  });

const AddPropertyCard: React.FC<AddPropertyCardProps> = ({
  onPress,
  style,
}) => {
  const { colorScheme } = useTheme();
  const themeColors = Colors[colorScheme ?? "light"];
  const dynamicStyles = createDynamicStyles(themeColors);

  return (
    <TouchableOpacity
      style={[styles.card, dynamicStyles.card, style]}
      onPress={onPress}
    >
      <PlusCircle size={50} color={themeColors.text} />
      <Text style={[styles.cardText, dynamicStyles.cardText]}>
        Add New Property
      </Text>
      <Text style={[styles.cardDescription, dynamicStyles.cardDescription]}>
        Upload documents for a new property
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
    marginBottom: 15,
    width: "100%",
  },
  cardText: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
  },
  cardDescription: {
    fontSize: 14,
    marginTop: 5,
  },
});

export default AddPropertyCard;
