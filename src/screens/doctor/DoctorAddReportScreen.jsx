// screens/doctor/DoctorAddReportScreen.js

import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, Image, Modal, TouchableOpacity,
  FlatList, Alert, Platform,
  ActivityIndicator, TextInput, SafeAreaView,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import { useAuth } from "../../hooks/useAuth";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import { launchImageLibrary } from 'react-native-image-picker';

// ✅ CHANGED: Added 'navigation' prop to handle errors
const DoctorAddReportScreen = ({ route, navigation }) => {
  // ✅ CHANGED: Safely destructure params with a fallback to prevent crashing
  const { patientId, patientName } = route.params || {};
  const { user: doctor } = useAuth();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);
  const [reportTitle, setReportTitle] = useState('');
  const [reportImage, setReportImage] = useState(null);

  // ✅ NEW: Effect to check if patientId was passed correctly
  useEffect(() => {
    if (!patientId) {
      Alert.alert(
        "Error",
        "Could not load patient data. Please go back and try again.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
      setLoading(false);
    }
  }, [patientId, navigation]);


  // --- Data Fetching ---
  useEffect(() => {
    // Don't run the query if patientId is missing
    if (!patientId) return;

    const subscriber = firestore()
      .collection('users')
      .doc(patientId)
      .collection('reports')
      .orderBy('createdAt', 'desc')
      .onSnapshot(querySnapshot => {
        const reportsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setReports(reportsList);
        setLoading(false);
      }, error => {
        console.error("Firestore Error:", error);
        setLoading(false);
        // This alert is crucial for debugging Firestore issues like missing indexes
        Alert.alert(
            "Error Loading Reports",
            "Could not fetch reports. Please check your connection or contact support."
        );
        navigation.goBack();
      });

    return () => subscriber();
  }, [patientId]);

  // --- (The rest of the functions remain the same) ---
  const handleChooseReportImage = async () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
      if (response.didCancel || response.errorCode) return;
      const asset = response.assets?.[0];
      if (asset) {
        setReportImage({ uri: asset.uri, fileName: asset.fileName });
      }
    });
  };

  const openNewReportModal = () => {
    setCurrentReport(null);
    setReportTitle('');
    setReportImage(null);
    setModalVisible(true);
  };

  const openEditReportModal = (report) => {
    setCurrentReport(report);
    setReportTitle(report.title);
    setReportImage({ uri: report.imageUrl });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setIsUploading(false);
  };

  const handleSaveReport = async () => {
    if (!reportTitle.trim()) {
      Alert.alert("Missing Title", "Please provide a title for the report.");
      return;
    }

    if (currentReport) {
      if (reportTitle !== currentReport.title) {
        setIsUploading(true);
        try {
          await firestore()
            .collection('users').doc(patientId)
            .collection('reports').doc(currentReport.id)
            .update({ title: reportTitle });
          Alert.alert("Success", "Report title updated!");
        } catch (error) {
          console.error("Update error:", error);
          Alert.alert("Update Failed", "Could not update the report title.");
        } finally {
          setIsUploading(false);
          closeModal();
        }
      } else {
        closeModal();
      }
      return;
    }
    
    if (!reportImage) {
      Alert.alert("Missing Image", "Please select an image for the new report.");
      return;
    }

    setIsUploading(true);
    try {
      const uploadUri = reportImage.uri;
      const fileName = `${Date.now()}_${reportImage.fileName || 'report.jpg'}`;
      const storageRef = storage().ref(`users/${patientId}/reports/${fileName}`);
      
      await storageRef.putFile(uploadUri);
      const imageUrl = await storageRef.getDownloadURL();

      await firestore()
        .collection('users').doc(patientId)
        .collection('reports').add({
          title: reportTitle,
          imageUrl: imageUrl,
          createdAt: firestore.FieldValue.serverTimestamp(),
          uploadedBy: doctor.uid,
        });
      
      Alert.alert("Success", "Report uploaded successfully!");
      closeModal();
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Upload Failed", "An error occurred during the upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteReport = (report) => {
    Alert.alert(
      "Delete Report",
      `Are you sure you want to delete the report "${report.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              const storageRef = storage().refFromURL(report.imageUrl);
              await storageRef.delete();

              await firestore()
                .collection('users').doc(patientId)
                .collection('reports').doc(report.id)
                .delete();
              
              Alert.alert("Deleted", "The report has been successfully deleted.");
            } catch (error) {
              console.error("Delete error:", error);
              Alert.alert("Error", "Could not delete the report.");
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.imageUrl }} style={styles.reportImg} />
            <View style={styles.cardFooter}>
              <View style={styles.titleContainer}>
                <Text style={styles.reportTitle}>{item.title}</Text>
                <Text style={styles.dateText}>
                  {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString() : 'No date'}
                </Text>
              </View>
              <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openEditReportModal(item)}>
                  <Icon name="edit-2" size={20} color="#3b82f6" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteReport(item)}>
                  <Icon name="trash-2" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListHeaderComponent={
            <Text style={styles.title}>
                {/* ✅ CHANGED: Added fallback for patientName */}
                Reports for <Text style={{color: '#2563eb'}}>{patientName || 'Patient'}</Text>
            </Text>
        }
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No reports have been uploaded for this patient.</Text>
            <Text style={styles.emptySubText}>Tap the '+' button to add the first report.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}
      />

      <TouchableOpacity style={styles.fab} onPress={openNewReportModal}>
        <Icon name="plus" size={28} color="#fff" />
      </TouchableOpacity>
        {/* --- (The Modal JSX remains the same) --- */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{currentReport ? 'Edit Report' : 'Upload New Report'}</Text>
            <TextInput
              style={styles.input}
              placeholder="Report Title"
              value={reportTitle}
              onChangeText={setReportTitle}
            />
            {!currentReport && (
                <TouchableOpacity style={styles.imagePicker} onPress={handleChooseReportImage}>
                  {reportImage ? (
                    <Image source={{ uri: reportImage.uri }} style={styles.previewImage} />
                  ) : (
                    <>
                      <Icon name="image" size={24} color="#4b5563" />
                      <Text style={styles.imagePickerText}>Select Report Image</Text>
                    </>
                  )}
                </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.uploadBtn} onPress={handleSaveReport} disabled={isUploading}>
              {isUploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadBtnText}>{currentReport ? 'Save Changes' : 'Upload'}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={closeModal} disabled={isUploading}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default DoctorAddReportScreen;

// --- (Styles remain the same) ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: "700", color: "#1e293b", marginVertical: 20 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#475569', textAlign: 'center' },
  emptySubText: { fontSize: 14, color: '#64748b', marginTop: 8, textAlign: 'center' },
  card: { backgroundColor: "#fff", borderRadius: 12, marginBottom: 16, elevation: 3, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 6 },
  reportImg: { width: "100%", height: 220, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  titleContainer: { flex: 1, marginRight: 8 },
  reportTitle: { fontSize: 16, fontWeight: "600", color: "#333" },
  dateText: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  actionsContainer: { flexDirection: 'row' },
  actionBtn: { padding: 8, marginLeft: 8 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', padding: 24, borderRadius: 12, width: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
  imagePicker: { height: 150, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  imagePickerText: { marginTop: 8, color: '#4b5563' },
  previewImage: { width: '100%', height: '100%', borderRadius: 6, resizeMode: 'cover' },
  uploadBtn: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center' },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { marginTop: 10, padding: 14, alignItems: 'center' },
  cancelBtnText: { color: '#475569', fontWeight: '600' }
});