import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Home, FileText, Briefcase, Cloud } from "lucide-react-native";
import { Colors } from "../constants/theme";
import { useTheme } from "../hooks/use-theme";
import { Property } from "../contexts/PropertyContext";

interface PropertyCardProps {
  property: Property;
}

const createDynamicStyles = (themeColors: typeof Colors.light) =>
  StyleSheet.create({
    card: {
      backgroundColor: themeColors.cardBackground,
      borderRadius: 10,
      padding: 20,
      marginBottom: 15,
      shadowColor: themeColors.cardShadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
      elevation: 2,
      width: "100%",
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 15,
    },
    homeIcon: {
      marginRight: 15,
    },
    address: {
      fontSize: 18,
      fontWeight: "bold",
    },
    cityStateZip: {
      fontSize: 14,
      color: themeColors.placeholderText,
    },
    cardContent: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginTop: 10,
    },
    separator: {
      height: 1,
      backgroundColor: themeColors.separator,
      marginVertical: 10,
    },
    infoItem: {
      alignItems: "center",
      // color: themeColors.text,
    },
    infoCount: {
      fontSize: 18,
      fontWeight: "bold",
      marginTop: 5,
      color: themeColors.text,
    },
    infoLabel: {
      fontSize: 12,
      color: themeColors.inactiveText,
    },
  });

const PropertyCard: React.FC<PropertyCardProps> = ({ property }) => {
  const { colorScheme } = useTheme();
  const themeColors = Colors[colorScheme ?? "light"];
  const styles = createDynamicStyles(themeColors);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Home size={24} color={themeColors.text} style={styles.homeIcon} />
        <View>
          <Text style={[styles.address, { color: themeColors.text }]}>
            {property.name}
          </Text>
          <Text style={[styles.cityStateZip, { color: themeColors.icon }]}>
            {property.address}
          </Text>
        </View>
      </View>
      <View style={styles.separator} />
      <View style={styles.cardContent}>
        <View style={styles.infoItem}>
          <FileText size={24} color={Colors.common.blue} />
          <Text style={styles.infoCount}>{property.docs}</Text>
          <Text style={styles.infoLabel}>Docs</Text>
        </View>
        <View style={styles.infoItem}>
          <Briefcase size={24} color={Colors.common.green} />
          <Text style={styles.infoCount}>{property.services}</Text>
          <Text style={styles.infoLabel}>Services</Text>
        </View>
        <View style={styles.infoItem}>
          <Cloud size={24} color={Colors.common.purple} />
          <Text style={styles.infoCount}>{property.checks}</Text>
          <Text style={styles.infoLabel}>Checks</Text>
        </View>
      </View>
    </View>
  );
};

export default PropertyCard;
