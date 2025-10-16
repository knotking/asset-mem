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
import TopNavBar from "./TopNavBar";

interface Property {
  id: string;
  address: string;
  cityStateZip: string;
  docs: number;
  services: number;
  clouds: number;
}

const HomeScreen: React.FC = () => {
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

  return (
    <View style={styles.fullContainer}>
      <TopNavBar />
      <ScrollView style={styles.scrollViewContent}>
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
    paddingHorizontal: 20,
    paddingTop: 20,
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
