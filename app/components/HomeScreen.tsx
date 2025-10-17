import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from "react-native";
import PropertyCard from "./PropertyCard";
import AddPropertyCard from "./AddPropertyCard";
import TopNavBar from "./TopNavBar";
import { useTheme } from "../hooks/use-theme";
import { Colors } from "../constants/theme";
import { useProperties } from "../contexts/PropertyContext";

const createDynamicStyles = (themeColors: typeof Colors.light) =>
  StyleSheet.create({
    fullContainer: {
      backgroundColor: themeColors.background,
    },
    aiAgentTitle: {
      color: themeColors.text,
    },
    aiAgentDescription: {
      color: themeColors.text,
    },
    addPropertyCardStyle: {
      backgroundColor: themeColors.cardBackground,
      borderRadius: 10,
      padding: 20,
      marginBottom: 20,
      shadowColor: themeColors.cardShadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
      elevation: 2,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: themeColors.background,
    },
    loadingText: {
      fontSize: 18,
      color: themeColors.text,
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: themeColors.background,
    },
    errorText: {
      fontSize: 18,
      color: "red", // Error text should always be red
    },
  });

const HomeScreen: React.FC = () => {
  const { properties, loading, error } = useProperties();
  const { colorScheme } = useTheme();
  const themeColors = Colors[colorScheme ?? "light"];
  const dynamicStyles = createDynamicStyles(themeColors);

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <Text style={dynamicStyles.loadingText}>Loading properties...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={dynamicStyles.errorContainer}>
        <Text style={dynamicStyles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.fullContainer, dynamicStyles.fullContainer]}>
      <TopNavBar />
      <ScrollView style={styles.scrollViewContent}>
        <Text style={[styles.aiAgentTitle, dynamicStyles.aiAgentTitle]}>
          Property AI Agent
        </Text>
        <Text
          style={[styles.aiAgentDescription, dynamicStyles.aiAgentDescription]}
        >
          Upload property documents and chat with AI to get insights or
          diagnostics of your properties and assets
        </Text>
        <AddPropertyCard
          onPress={() =>
            Alert.alert(
              "Add New Property",
              "This functionality will be implemented soon!"
            )
          }
          style={dynamicStyles.addPropertyCardStyle}
        />

        {/* Property List */}
        <View style={styles.propertyList}>
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    // backgroundColor: Colors.common.lightGrey, // Removed hardcoded lightGrey
  },
  scrollViewContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  aiAgentTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  aiAgentDescription: {
    fontSize: 14,
    marginBottom: 20,
  },
  propertyList: {
    // Styles for the list of property cards
  },
});

export default HomeScreen;
