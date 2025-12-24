// src/screens/VerifyScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  FlatList,
} from "react-native";

// Example patients with current medicine (replace with Firestore data later)
const assignedPatients = [
  {
    id: "1",
    name: "Alice Johnson",
    age: 70,
    doctor: "Dr. Smith",
    currentMedicine: {
      name: "Aspirin 75mg",
      relation: "After Meal",
      photo: "https://i.pinimg.com/736x/5f/2a/27/5f2a2756630109eff806d9d0016c8753.jpg",
    },
  },
  {
    id: "2",
    name: "Bob Brown",
    age: 65,
    doctor: "Dr. Adams",
    currentMedicine: {
      name: "Metformin 500mg",
      relation: "With Meal",
      photo: "https://i.pinimg.com/736x/5f/2a/27/5f2a2756630109eff806d9d0016c8753.jpg",
    },
  },
  {
    id: "3",
    name: "Sophia Miller",
    age: 58,
    doctor: "Dr. Adams",
    currentMedicine: {
      name: "Atorvastatin 20mg",
      relation: "Before Bed",
      photo: "https://i.pinimg.com/736x/5f/2a/27/5f2a2756630109eff806d9d0016c8753.jpg",
    },
  },
];

export default function DoctorVerifyScreen() {
  const handleVerify = (patient, med) => {
    Alert.alert("Verified ✅", `${patient.name} has taken ${med.name}`);
  };

  const handleDecline = (patient, med) => {
    Alert.alert(
      "Declined ❌",
      `Declined verification for ${patient.name}'s ${med.name}`
    );
  };

  const renderPatient = ({ item }) => (
    <View style={styles.patientCard}>
      {/* Patient Info */}
      <Text style={styles.patientName}>{item.name}</Text>
      <Text style={styles.patientDetails}>
        Age: {item.age} | Doctor: {item.doctor}
      </Text>

      {/* Medicine Info */}
      <View style={styles.medicineCard}>
        <Image
          source={{ uri: item.currentMedicine.photo }}
          style={styles.medicineImg}
        />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.medicineName}>
            {item.currentMedicine.name}
          </Text>
          <Text style={styles.medicineRelation}>
            {item.currentMedicine.relation}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.verifyBtn]}
          onPress={() => handleVerify(item, item.currentMedicine)}
        >
          <Text style={styles.btnText}>Verify</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.declineBtn]}
          onPress={() => handleDecline(item, item.currentMedicine)}
        >
          <Text style={styles.btnText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Verification Requests</Text>
        <FlatList
          data={assignedPatients}
          keyExtractor={(item) => item.id}
          renderItem={renderPatient}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </View>
    </SafeAreaView>
  );
}

// ------------------- Styles -------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, padding: 16 },

  // Section
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
    color: "#111",
  },

  // Patient Card
  patientCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  patientName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
    color: "#1e293b",
  },
  patientDetails: { fontSize: 14, color: "#475569" },

  // Medicine
  medicineCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 14,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 10,
  },
  medicineImg: { width: 70, height: 70, borderRadius: 10 },
  medicineName: { fontSize: 16, fontWeight: "600", color: "#111" },
  medicineRelation: { fontSize: 13, color: "#475569", marginTop: 4 },

  // Actions
  actionRow: { flexDirection: "row", justifyContent: "space-between" },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 6,
  },
  verifyBtn: { backgroundColor: "#10b981" },
  declineBtn: { backgroundColor: "#ef4444" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
