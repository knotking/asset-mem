import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface PropertyCardProps {
  property: {
    id: string;
    address: string;
    cityStateZip: string;
    docs: number;
    services: number;
    clouds: number;
  };
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property }) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons
          name="home"
          size={24}
          color="black"
          style={styles.homeIcon}
        />
        <View>
          <Text style={styles.address}>{property.address}</Text>
          <Text style={styles.cityStateZip}>{property.cityStateZip}</Text>
        </View>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.infoItem}>
          <MaterialCommunityIcons
            name="file-document-outline"
            size={24}
            color="#007AFF"
          />
          <Text style={styles.infoCount}>{property.docs}</Text>
          <Text style={styles.infoLabel}>Docs</Text>
        </View>
        <View style={styles.infoItem}>
          <MaterialCommunityIcons
            name="briefcase-outline"
            size={24}
            color="#4CAF50"
          />
          <Text style={styles.infoCount}>{property.services}</Text>
          <Text style={styles.infoLabel}>Services</Text>
        </View>
        <View style={styles.infoItem}>
          <MaterialCommunityIcons
            name="cloud-outline"
            size={24}
            color="#9C27B0"
          />
          <Text style={styles.infoCount}>{property.clouds}</Text>
          <Text style={styles.infoLabel}>Clouds</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
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
    color: "#666",
  },
  cardContent: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
  infoItem: {
    alignItems: "center",
  },
  infoCount: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 5,
  },
  infoLabel: {
    fontSize: 12,
    color: "#888",
  },
});

export default PropertyCard;
