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
import { db, auth } from "../firebaseConfig";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { signOut } from "firebase/auth";
import {
  MaterialCommunityIcons,
  Ionicons,
  FontAwesome,
} from "@expo/vector-icons";
import PropertyCard from "./PropertyCard";

interface Property {
  id: string;
  address: string;
  cityStateZip: string;
  docs: number;
  services: number;
  clouds: number;
}

interface HomeScreenProps {
  onLogout: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onLogout }) => {
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    const q = query(collection(db, "properties"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedProperties: Property[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          address: doc.data().address,
          cityStateZip: doc.data().cityStateZip,
          docs: doc.data().docs || 0,
          services: doc.data().services || 0,
          clouds: doc.data().clouds || 0,
        }));
        setProperties(fetchedProperties);
      },
      (error) => {
        console.error("Failed to fetch properties: ", error);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      onLogout();
    } catch (error: any) {
      console.error("Failed to log out: ", error);
    }
  };

  return (
    <View style={styles.fullContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />
      <ScrollView style={styles.scrollViewContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="home" size={28} color="black" />
            <Text style={styles.headerTitle}>HomeGeek AI</Text>
          </View>
          <View style={styles.headerRight}>
            <Ionicons
              name="notifications-outline"
              size={24}
              color="black"
              style={styles.notificationIcon}
            />
            <TouchableOpacity
              style={styles.profileButton}
              onPress={handleLogout}
            >
              <Text style={styles.profileButtonText}>PR</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Property AI Agent Section */}
        <View style={styles.aiAgentSection}>
          <Text style={styles.aiAgentTitle}>Property AI Agent</Text>
          <Text style={styles.aiAgentDescription}>
            Upload property documents and chat with AI to get insights or
            diagnostics of your properties and assets
          </Text>
          <TouchableOpacity
            style={styles.addNewPropertyCard}
            onPress={() =>
              Alert.alert(
                "Add New Property",
                "This functionality will be implemented soon!"
              )
            }
          >
            <MaterialCommunityIcons
              name="plus-circle-outline"
              size={40}
              color="#999"
            />
            <Text style={styles.addNewPropertyText}>Add New Property</Text>
            <Text style={styles.addNewPropertySubText}>
              Upload documents for a new property
            </Text>
          </TouchableOpacity>
        </View>

        {/* Property List */}
        <View style={styles.propertyList}>
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
          {/* Placeholder cards if no properties fetched */}
          {properties.length === 0 && (
            <>
              <PropertyCard
                property={{
                  id: "1",
                  address: "9182 Helena Way",
                  cityStateZip: "Brentwood, CA 94513",
                  docs: 2,
                  services: 0,
                  clouds: 0,
                }}
              />
              <PropertyCard
                property={{
                  id: "2",
                  address: "5816 El Dorado Lane",
                  cityStateZip: "Dublin, CA 94568-4782",
                  docs: 1,
                  services: 0,
                  clouds: 0,
                }}
              />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  scrollViewContent: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginLeft: 10,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  notificationIcon: {
    marginRight: 15,
  },
  profileButton: {
    backgroundColor: "#e0e0e0",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  profileButtonText: {
    fontWeight: "bold",
  },
  aiAgentSection: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  aiAgentTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  aiAgentDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  addNewPropertyCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderStyle: "dashed",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
  },
  addNewPropertyText: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 10,
  },
  addNewPropertySubText: {
    fontSize: 12,
    color: "#888",
    marginTop: 5,
  },
  propertyList: {
    // Styles for the list of property cards
  },
});

export default HomeScreen;
