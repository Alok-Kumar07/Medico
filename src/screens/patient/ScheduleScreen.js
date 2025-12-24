// src/screens/patient/ScheduleScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Icon from "react-native-vector-icons/FontAwesome";
import { launchImageLibrary } from "react-native-image-picker";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";

// --- FIREBASE IMPORTS ---
import { auth, storage } from "../../firebase";
import firestore from "@react-native-firebase/firestore";

// For Android content:// handling
import RNFS from "react-native-fs";

export default function ScheduleScreen() {
  const [currentUser, setCurrentUser] = useState(null);
  const [meds, setMeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedMed, setSelectedMed] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // Form fields
  const [name, setName] = useState("");
  const [meal, setMeal] = useState("After Meal");
  const [times, setTimes] = useState(["08:00"]);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [photoUri, setPhotoUri] = useState("");
  const [stock, setStock] = useState("");

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerIndex, setTimePickerIndex] = useState(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- AUTH LISTENER ---
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- FETCH DATA ---
  useEffect(() => {
    if (!currentUser) return setMeds([]);

    const unsubscribe = firestore()
      .collection("users")
      .doc(currentUser.uid)
      .collection("medicines")
      .orderBy("name", "asc")
      .onSnapshot(
        (snapshot) => {
          const fetchedMeds = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              startDate: data.startDate?.toDate?.() || new Date(),
              endDate: data.endDate?.toDate?.() || new Date(),
            };
          });
          setMeds(fetchedMeds);
        },
        (error) => {
          console.error("Error fetching medicines:", error);
          Toast.show({ type: "error", text1: "Could not fetch data." });
        }
      );

    return () => unsubscribe();
  }, [currentUser]);

  const formatTime = (date) => {
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  };

  const humanDate = (d) =>
    d
      ? new Date(d).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
      : "N/A";

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setMeal("After Meal");
    setTimes(["08:00"]);
    setStartDate(new Date());
    setEndDate(new Date());
    setPhotoUri("");
    setStock("");
  };

  const openAdd = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEdit = (med) => {
    setEditingId(med.id);
    setName(med.name);
    setMeal(med.meal);
    setTimes([...med.times]);
    setStartDate(med.startDate ? new Date(med.startDate) : new Date());
    setEndDate(med.endDate ? new Date(med.endDate) : new Date());
    setPhotoUri(med.photoUri || "");
    setStock(med.stock?.toString() || "");
    setModalVisible(true);
  };

  const openDetails = (med) => {
    setSelectedMed(med);
    setDetailsVisible(true);
  };

  const pickImage = async () => {
    const result = await launchImageLibrary({ mediaType: "photo" });
    if (!result.didCancel && result.assets?.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  // --- Upload image to Firebase Storage ---
  const uploadImage = async (uri) => {
    if (!currentUser) throw new Error("User not logged in");
    if (!uri) return "";

    try {
      let uploadUri = uri;

      if (Platform.OS === "ios") {
        uploadUri = uri.replace("file://", "");
      }

      // Android content:// handling
      if (Platform.OS === "android" && uploadUri.startsWith("content://")) {
        const destPath = `${RNFS.TemporaryDirectoryPath}/temp.jpg`;
        await RNFS.copyFile(uploadUri, destPath);
        uploadUri = destPath;
      }

      const fileName = `med_${Date.now()}.jpg`;
      const storageRef = storage().ref(`users/${currentUser.uid}/medicines/${fileName}`);

      await storageRef.putFile(uploadUri); // Upload file to Firebase Storage
      const downloadURL = await storageRef.getDownloadURL(); // Get URL
      return downloadURL;
    } catch (err) {
      console.error("Firebase Storage upload error: ", err);
      return "";
    }
  };

  // --- Add or update medicine ---
  // --- Add or update medicine (with improvements) ---
const upsertMed = async () => {
  if (!currentUser) {
    Toast.show({ type: "error", text1: "You must be logged in." });
    return;
  }
  if (!name.trim()) {
    Toast.show({ type: "error", text1: "Please enter a medicine name." });
    return;
  }
  
  // --- SUGGESTION 1: Validate dates ---
  if (endDate < startDate) {
    Alert.alert("Invalid Date", "End date cannot be before the start date.");
    return;
  }

  // --- SUGGESTION 2: Set saving state to true ---
  setIsSaving(true);

  try {
    let finalPhotoUri = photoUri;

    // Only upload if it's a new local file
    if (photoUri && (photoUri.startsWith("file://") || photoUri.startsWith("content://"))) {
      finalPhotoUri = await uploadImage(photoUri);
      if (!finalPhotoUri) { // Handle potential upload failure
         throw new Error("Image upload failed.");
      }
    }

    const payload = {
      name,
      meal,
      times,
      startDate: firestore.Timestamp.fromDate(startDate),
      endDate: firestore.Timestamp.fromDate(endDate),
      photoUri: finalPhotoUri,
      stock: parseInt(stock) || 0,
    };

    const medRef = firestore()
      .collection("users")
      .doc(currentUser.uid)
      .collection("medicines");

    if (editingId) {
      await medRef.doc(editingId).update(payload);
      Toast.show({ type: "success", text1: "Medicine updated ✅" });
    } else {
      await medRef.add(payload);
      Toast.show({ type: "success", text1: "Medicine added ✅" });
    }

    setModalVisible(false);
    resetForm();
  } catch (error) {
    console.error("Error saving medicine: ", error);
    Toast.show({ type: "error", text1: "Failed to save medicine." });
  } finally {
    // --- SUGGESTION 2: Set saving state back to false ---
    setIsSaving(false);
  }
};


  const addTime = () => {
    setTimes((prev) => [...prev, "08:00"]);
    setTimePickerIndex(times.length);
    setShowTimePicker(true);
  };

  const confirmDelete = (id, name) => {
    Alert.alert("Delete Medicine", `Are you sure you want to delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeMed(id) },
    ]);
  };

  const removeMed = async (id) => {
    if (!currentUser) return;
    try {
      await firestore()
        .collection("users")
        .doc(currentUser.uid)
        .collection("medicines")
        .doc(id)
        .delete();
      Toast.show({ type: "error", text1: "Medicine deleted ❌" });
    } catch (error) {
      console.error("Error deleting medicine: ", error);
      Toast.show({ type: "error", text1: "Failed to delete." });
    }
  };

  const TimeChip = ({ value, index }) => (
    <View style={styles.chip}>
      <TouchableOpacity
        onPress={() => {
          setTimePickerIndex(index);
          setShowTimePicker(true);
        }}
        style={{ flexDirection: "row", alignItems: "center" }}
      >
        <Icon name="clock-o" size={12} color="#2563eb" />
        <Text style={styles.chipText}> {value}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          if (times.length === 1) return;
          setTimes((prev) => prev.filter((_, i) => i !== index));
        }}
      >
        <Icon name="times" size={14} color="#ef4444" style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    </View>
  );

  const renderRightActions = (item) => (
    <TouchableOpacity
      style={styles.deleteSwipe}
      onPress={() => confirmDelete(item.id, item.name)}
    >
      <Icon name="trash" size={20} color="#fff" />
    </TouchableOpacity>
  );

  const renderMed = ({ item }) => (
    <Swipeable renderRightActions={() => renderRightActions(item)}>
      <TouchableOpacity style={styles.card} onPress={() => openDetails(item)}>
        <Image
          source={{
            uri: item.photoUri || "https://via.placeholder.com/80x80.png?text=Pill",
          }}
          style={styles.photo}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.medName}>{item.name}</Text>
          <Text style={styles.meta}>
            {item.meal} • {humanDate(item.startDate)} → {humanDate(item.endDate)}
          </Text>
          <View style={styles.timeRow}>
            {item.times.map((t, i) => (
              <Text key={i} style={styles.timeText}>
                ⏰ {t}
              </Text>
            ))}
          </View>
          <Text style={[styles.meta, { marginTop: 4 }]}>📦 Stock: {item.stock}</Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Medicine Schedule</Text>
        </View>

        {/* List */}
        <FlatList
          data={meds}
          keyExtractor={(item) => item.id}
          renderItem={renderMed}
          contentContainerStyle={{ paddingBottom: 80 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 40 }}>
              <Text>No medicines yet. Tap + to add one!</Text>
            </View>
          }
        />

        {/* Floating Add Button */}
        <TouchableOpacity style={styles.fab} onPress={openAdd}>
          <Icon name="plus" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Add/Edit Modal */}
        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editingId ? "Edit Medicine" : "Add Medicine"}
                  </Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Icon name="close" size={20} color="#111" />
                  </TouchableOpacity>
                </View>

                {/* Photo */}
                <TouchableOpacity style={styles.photoPicker} onPress={pickImage}>
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                  ) : (
                    <Text style={{ color: "#666" }}>+ Add Photo</Text>
                  )}
                </TouchableOpacity>

                {/* Name */}
                <TextInput
                  placeholder="Medicine name"
                  placeholderTextColor="#888"
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                />

                {/* Stock */}
                <TextInput
                  placeholder="Stock (number of pills)"
                  placeholderTextColor="#888"
                  value={stock}
                  onChangeText={setStock}
                  keyboardType="numeric"
                  style={styles.input}
                />

                {/* Meal selector */}
                <View style={styles.segment}>
                  {["Before Meal", "After Meal"].map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setMeal(opt)}
                      style={[styles.segBtn, meal === opt && styles.segActive]}
                    >
                      <Text
                        style={[styles.segText, meal === opt && styles.segTextActive]}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Times */}
                <Text style={styles.sectionLabel}>Daily Times</Text>
                <View style={styles.chipsRow}>
                  {times.map((t, i) => (
                    <TimeChip key={i} value={t} index={i} />
                  ))}
                  <TouchableOpacity style={styles.addChip} onPress={addTime}>
                    <Icon name="plus" size={12} color="#2563eb" />
                    <Text style={styles.addChipText}> Add Time</Text>
                  </TouchableOpacity>
                </View>

                {/* Dates */}
                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() => setShowStartPicker(true)}
                >
                  <Text>Start: {humanDate(startDate)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Text>End: {humanDate(endDate)}</Text>
                </TouchableOpacity>

                {/* Save */}
                <TouchableOpacity
                  style={[styles.primaryBtn, isSaving && { backgroundColor: '#999' }]} // Style when disabled
                  onPress={upsertMed}
                  disabled={isSaving} // Disable button while saving
                >
                  <Text style={styles.primaryText}>
                    {isSaving
                      ? (editingId ? "Saving..." : "Adding...")
                      : (editingId ? "Save Changes" : "Add Medicine")
                    }
                    
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Details Modal */}
        <Modal visible={detailsVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: "80%" }]}>
              {selectedMed && (
                <ScrollView>
                  <Image
                    source={{
                      uri:
                        selectedMed.photoUri || "https://via.placeholder.com/300.png?text=Pill",
                    }}
                    style={{ width: "100%", height: 200, borderRadius: 12, marginBottom: 12 }}
                  />
                  <Text style={{ fontSize: 20, fontWeight: "700", marginBottom: 6 }}>
                    {selectedMed.name}
                  </Text>
                  <Text style={{ color: "#555", marginBottom: 6 }}>{selectedMed.meal}</Text>
                  <Text style={{ marginBottom: 6 }}>
                    {humanDate(selectedMed.startDate)} → {humanDate(selectedMed.endDate)}
                  </Text>
                  <Text style={styles.sectionLabel}>Times</Text>
                  {selectedMed.times.map((t, i) => (
                    <Text key={i} style={styles.timeText}>
                      ⏰ {t}
                    </Text>
                  ))}
                  <Text style={[styles.sectionLabel, { marginTop: 12 }]}>
                    📦 Stock: {selectedMed.stock}
                  </Text>

                  <TouchableOpacity
                    style={[styles.primaryBtn, { marginTop: 20 }]}
                    onPress={() => {
                      setDetailsVisible(false);
                      openEdit(selectedMed);
                    }}
                  >
                    <Text style={styles.primaryText}>Edit Medicine</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}

              <TouchableOpacity
                onPress={() => setDetailsVisible(false)}
                style={{ marginTop: 10, alignSelf: "center" }}
              >
                <Text style={{ color: "#ef4444" }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Pickers */}
        {showTimePicker && (
          <DateTimePicker
            value={new Date()}
            mode="time"
            is24Hour
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(e, date) => {
              setShowTimePicker(false);
              if (!date) return;
              const hhmm = formatTime(date);
              setTimes((prev) => prev.map((v, i) => (i === timePickerIndex ? hhmm : v)));
            }}
          />
        )}
        {showStartPicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            onChange={(e, date) => {
              setShowStartPicker(false);
              if (date) setStartDate(date);
            }}
          />
        )}
        {showEndPicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            onChange={(e, date) => {
              setShowEndPicker(false);
              if (date) setEndDate(date);
            }}
          />
        )}
        <Toast />
      </View>
    </GestureHandlerRootView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  title: { fontSize: 22, fontWeight: "700", textAlign: 'center' },

  // Floating button
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#2563eb",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
  },

  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 5,
    borderRadius: 12,
    padding: 12,
    elevation: 3,
    alignItems: "center",
    marginBottom: 1,
  },
  photo: { width: 70, height: 70, borderRadius: 12, marginRight: 12 },
  medName: { fontSize: 16, fontWeight: "700" },
  meta: { fontSize: 12, color: "#666", marginTop: 2 },
  timeRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  timeText: { marginRight: 10, fontSize: 12, color: "#333" },

  // Swipe delete
  deleteSwipe: {
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    width: 70,
    borderRadius: 12,
    marginVertical: 12,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "#fff",
    margin: 20,
    borderRadius: 12,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  photoPicker: {
    height: 60,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  photoPreview: { width: "100%", height: "100%" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    marginBottom: 12,
  },
  segBtn: { flex: 1, alignItems: "center", padding: 8 },
  segActive: { backgroundColor: "#2563eb" },
  segText: { color: "#111" },
  segTextActive: { color: "#fff" },
  sectionLabel: { fontWeight: "700", marginBottom: 6 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e0e7ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 6,
    marginBottom: 6,
  },
  chipText: { color: "#1d4ed8", fontWeight: "600", fontSize: 12 },
  addChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  addChipText: { color: "#2563eb", fontWeight: "700", fontSize: 12 },
  dateBtn: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginTop: 10,
  },
  primaryText: { color: "#fff", fontWeight: "700" },
});
