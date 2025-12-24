import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Image, Platform, Alert, ScrollView, ActivityIndicator
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Icon from "react-native-vector-icons/FontAwesome";
import { launchImageLibrary } from "react-native-image-picker";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import firestore from "@react-native-firebase/firestore";
import storage from '@react-native-firebase/storage';
import RNFS from "react-native-fs";

export default function DoctorEditScheduleScreen({ route }) {
    const { patientId } = route.params;
    
    const [meds, setMeds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
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

    // Fetch patient's medicines
    useEffect(() => {
        if (!patientId) return;

        const unsubscribe = firestore().collection("users").doc(patientId).collection("medicines")
            .orderBy("name", "asc")
            .onSnapshot(
                (snapshot) => {
                    const fetchedMeds = snapshot.docs.map(doc => ({
                        id: doc.id, ...doc.data(),
                        startDate: doc.data().startDate?.toDate() || new Date(),
                        endDate: doc.data().endDate?.toDate() || new Date(),
                    }));
                    setMeds(fetchedMeds);
                    setLoading(false);
                },
                (error) => {
                    console.error("Error fetching patient medicines:", error);
                    Toast.show({ type: "error", text1: "Could not fetch patient's data." });
                    setLoading(false);
                }
            );
        return () => unsubscribe();
    }, [patientId]);

    const formatTime = (date) => `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    const humanDate = (d) => new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

    const resetForm = () => {
        setEditingId(null); setName(""); setMeal("After Meal"); setTimes(["08:00"]);
        setStartDate(new Date()); setEndDate(new Date()); setPhotoUri(""); setStock("");
    };

    const openAdd = () => { resetForm(); setModalVisible(true); };

    const openEdit = (med) => {
        setEditingId(med.id); setName(med.name); setMeal(med.meal); setTimes([...med.times]);
        setStartDate(new Date(med.startDate)); setEndDate(new Date(med.endDate));
        setPhotoUri(med.photoUri || ""); setStock(med.stock?.toString() || "");
        setModalVisible(true);
    };

    const pickImage = async () => {
        const result = await launchImageLibrary({ mediaType: "photo" });
        if (!result.didCancel && result.assets?.length > 0) setPhotoUri(result.assets[0].uri);
    };

    const uploadImage = async (uri) => {
        if (!uri) return "";
        try {
            let uploadUri = Platform.OS === "ios" ? uri.replace("file://", "") : uri;
            if (uploadUri.startsWith("content://")) {
                const destPath = `${RNFS.TemporaryDirectoryPath}/temp_${Date.now()}.jpg`;
                await RNFS.copyFile(uploadUri, destPath);
                uploadUri = `file://${destPath}`;
            }
            const fileName = `med_${Date.now()}.jpg`;
            const storageRef = storage().ref(`users/${patientId}/medicines/${fileName}`); // Upload to patient's folder
            await storageRef.putFile(uploadUri);
            return await storageRef.getDownloadURL();
        } catch (err) { console.error("Upload error: ", err); return ""; }
    };
    
    const upsertMed = async () => {
        if (!name.trim()) { Alert.alert("Validation Error", "Please enter a medicine name."); return; }
        if (endDate < startDate) { Alert.alert("Invalid Date", "End date cannot be before start date."); return; }

        setIsSaving(true);
        try {
            let finalPhotoUri = photoUri;
            if (photoUri && (photoUri.startsWith("file://") || photoUri.startsWith("content://"))) {
                finalPhotoUri = await uploadImage(photoUri);
                if (!finalPhotoUri) throw new Error("Image upload failed.");
            }

            const payload = {
                name, meal, times,
                startDate: firestore.Timestamp.fromDate(startDate),
                endDate: firestore.Timestamp.fromDate(endDate),
                photoUri: finalPhotoUri,
                stock: parseInt(stock, 10) || 0,
            };

            const medCollectionRef = firestore().collection("users").doc(patientId).collection("medicines");
            if (editingId) {
                await medCollectionRef.doc(editingId).update(payload);
                Toast.show({ type: "success", text1: "Medicine updated!" });
            } else {
                await medCollectionRef.add(payload);
                Toast.show({ type: "success", text1: "Medicine added!" });
            }
            setModalVisible(false); resetForm();
        } catch (error) {
            console.error("Error saving medicine: ", error);
            Toast.show({ type: "error", text1: "Failed to save medicine." });
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = (id, name) => {
        Alert.alert("Delete Medicine", `Are you sure you want to delete "${name}"?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => removeMed(id) },
        ]);
    };

    const removeMed = async (id) => {
        try {
            await firestore().collection("users").doc(patientId).collection("medicines").doc(id).delete();
            Toast.show({ type: "info", text1: "Medicine deleted." });
        } catch (error) { Toast.show({ type: "error", text1: "Failed to delete." }); }
    };

    // UPDATED addTime function to immediately open the time picker
    const addTime = () => {
        // Get the index for the new time before updating state
        const newIndex = times.length; 
        // Add a default time
        setTimes((prev) => [...prev, "08:00"]);
        // Open the time picker for the new slot
        setTimePickerIndex(newIndex);
        setShowTimePicker(true);
    };

    if (loading) { return <View style={styles.loadingView}><ActivityIndicator size="large" color="#2563eb" /></View>; }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.screen}>
                <View style={styles.header}><Text style={styles.title}>Manage Patient's Schedule</Text></View>
                <FlatList
                    data={meds}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <Swipeable renderRightActions={() => (
                            <TouchableOpacity style={styles.deleteSwipe} onPress={() => confirmDelete(item.id, item.name)}>
                                <Icon name="trash" size={20} color="#fff" />
                            </TouchableOpacity>
                        )}>
                            <TouchableOpacity style={styles.card} onPress={() => openEdit(item)}>
                                <Image source={{ uri: item.photoUri || "https://via.placeholder.com/80x80.png?text=Pill" }} style={styles.photo} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.medName}>{item.name}</Text>
                                    <Text style={styles.meta}>{item.meal} • {humanDate(item.startDate)} → {humanDate(item.endDate)}</Text>
                                    <View style={styles.timeRow}>{item.times.map((t, i) => <Text key={i} style={styles.timeText}>⏰ {t}</Text>)}</View>
                                    <Text style={[styles.meta, { marginTop: 4 }]}>📦 Stock: {item.stock}</Text>
                                </View>
                                <Icon name="pencil" size={16} color="#9ca3af" />
                            </TouchableOpacity>
                        </Swipeable>
                    )}
                    ListEmptyComponent={<View style={styles.emptyList}><Text>No medicines scheduled. Tap + to add one.</Text></View>}
                    contentContainerStyle={{ paddingBottom: 80 }}
                />
                <TouchableOpacity style={styles.fab} onPress={openAdd}><Icon name="plus" size={22} color="#fff" /></TouchableOpacity>
                
                {/* --- FULL MODAL AND PICKERS IMPLEMENTATION --- */}
                <Modal visible={modalVisible} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <ScrollView keyboardShouldPersistTaps="handled">
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>{editingId ? "Edit Medicine" : "Add Medicine"}</Text>
                                    <TouchableOpacity onPress={() => setModalVisible(false)}><Icon name="close" size={20} color="#111" /></TouchableOpacity>
                                </View>

                                <TouchableOpacity style={styles.photoPicker} onPress={pickImage}>
                                    {photoUri ? <Image source={{ uri: photoUri }} style={styles.photoPreview} /> : <Text style={{ color: "#666" }}>+ Add Photo</Text>}
                                </TouchableOpacity>

                                <TextInput placeholder="Medicine name" placeholderTextColor="#888" value={name} onChangeText={setName} style={styles.input} />
                                <TextInput placeholder="Stock (number of pills)" placeholderTextColor="#888" value={stock} onChangeText={setStock} keyboardType="numeric" style={styles.input} />

                                <View style={styles.segment}>
                                    {["Before Meal", "After Meal"].map(opt => (
                                        <TouchableOpacity key={opt} onPress={() => setMeal(opt)} style={[styles.segBtn, meal === opt && styles.segActive]}>
                                            <Text style={[styles.segText, meal === opt && styles.segTextActive]}>{opt}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.sectionLabel}>Daily Times</Text>
                                <View style={styles.chipsRow}>
                                    {times.map((t, i) => (
                                        <View key={i} style={styles.chip}>
                                            <TouchableOpacity onPress={() => { setTimePickerIndex(i); setShowTimePicker(true); }} style={{ flexDirection: "row", alignItems: "center" }}>
                                                <Icon name="clock-o" size={12} color="#2563eb" />
                                                <Text style={styles.chipText}> {t}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => { if (times.length > 1) setTimes(prev => prev.filter((_, idx) => idx !== i)); }}>
                                                <Icon name="times" size={14} color="#ef4444" style={{ marginLeft: 6 }} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                    <TouchableOpacity style={styles.addChip} onPress={addTime}><Icon name="plus" size={12} color="#2563eb" /><Text style={styles.addChipText}> Add Time</Text></TouchableOpacity>
                                </View>

                                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowStartPicker(true)}><Text>Start: {humanDate(startDate)}</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEndPicker(true)}><Text>End: {humanDate(endDate)}</Text></TouchableOpacity>

                                <TouchableOpacity style={[styles.primaryBtn, isSaving && { backgroundColor: '#999' }]} onPress={upsertMed} disabled={isSaving}>
                                    <Text style={styles.primaryText}>{isSaving ? "Saving..." : (editingId ? "Save Changes" : "Add Medicine")}</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                {showTimePicker && <DateTimePicker value={new Date()} mode="time" is24Hour onChange={(e, date) => { setShowTimePicker(false); if (date) setTimes(prev => prev.map((v, i) => i === timePickerIndex ? formatTime(date) : v)); }} />}
                {showStartPicker && <DateTimePicker value={startDate} mode="date" onChange={(e, date) => { setShowStartPicker(false); if (date) setStartDate(date); }} />}
                {showEndPicker && <DateTimePicker value={endDate} mode="date" onChange={(e, date) => { setShowEndPicker(false); if (date) setEndDate(date); }} />}
                
                <Toast />
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#f8fafc" },
    loadingView: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { padding: 16, borderBottomWidth: 1, borderColor: "#eee", backgroundColor: '#fff' },
    title: { fontSize: 22, fontWeight: "700", textAlign: 'center', color: '#111' },
    fab: { position: "absolute", bottom: 20, right: 20, backgroundColor: "#2563eb", width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", elevation: 6 },
    card: { flexDirection: "row", backgroundColor: "#fff", marginHorizontal: 16, marginTop: 12, borderRadius: 12, padding: 12, elevation: 2, alignItems: "center" },
    photo: { width: 70, height: 70, borderRadius: 12, marginRight: 12, backgroundColor: '#f1f5f9' },
    medName: { fontSize: 16, fontWeight: "700", color: '#1e293b' },
    meta: { fontSize: 12, color: "#64748b", marginTop: 2 },
    timeRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
    timeText: { marginRight: 10, fontSize: 12, color: "#334155", fontWeight: '500' },
    deleteSwipe: { backgroundColor: "#ef4444", justifyContent: "center", alignItems: "center", width: 70, borderRadius: 12, marginHorizontal: 16, marginTop: 12 },
    emptyList: { alignItems: "center", marginTop: 40, paddingHorizontal: 20 },
    
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: 'center' },
    modalCard: { width: '90%', maxHeight: '85%', backgroundColor: "#fff", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: "700", color: '#111' },
    photoPicker: { height: 100, backgroundColor: "#f1f5f9", borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 12, overflow: 'hidden' },
    photoPreview: { width: "100%", height: "100%" },
    input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, color: '#111' },
    segment: { flexDirection: "row", backgroundColor: "#f1f5f9", borderRadius: 8, marginBottom: 16, overflow: 'hidden' },
    segBtn: { flex: 1, alignItems: "center", paddingVertical: 10 },
    segActive: { backgroundColor: "#3b82f6" },
    segText: { color: "#334155", fontWeight: '600' },
    segTextActive: { color: "#fff" },
    sectionLabel: { fontWeight: "700", marginBottom: 8, color: '#334155' },
    chipsRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12, alignItems: 'center' },
    chip: { flexDirection: "row", alignItems: "center", backgroundColor: "#e0e7ff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, marginRight: 6, marginBottom: 6 },
    chipText: { color: "#1d4ed8", fontWeight: "600", fontSize: 12 },
    addChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#eff6ff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#dbeafe' },
    addChipText: { color: "#2563eb", fontWeight: "700", fontSize: 12 },
    dateBtn: { padding: 12, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, marginBottom: 10, alignItems: 'center' },
    primaryBtn: { backgroundColor: "#2563eb", borderRadius: 8, padding: 14, alignItems: "center", marginTop: 16 },
    primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});