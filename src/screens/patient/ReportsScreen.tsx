// screens/Reports/ReportsScreen.js

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Modal,
  TouchableOpacity,
  FlatList,
  Alert,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  TextInput,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import RNFS from "react-native-fs"; // Already imported
import { useAuth } from "../../hooks/useAuth";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import { launchImageLibrary } from 'react-native-image-picker';

const ReportsScreen = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // --- NEW: State for the Image Viewer Modal ---
  const [isImageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  const [newReportData, setNewReportData] = useState({
    title: '',
    image: null, // Will hold the image picker response asset
  });

  // --- Data Fetching Effect ---
  useEffect(() => {
    if (!user) return;
    const subscriber = firestore()
      .collection('users')
      .doc(user.uid)
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
        console.error("Failed to fetch reports:", error);
        setLoading(false);
        Alert.alert("Error", "Could not load reports.");
      });

    return () => subscriber();
  }, [user]);

  // --- Permission & Image Picking ---
  const handleChooseReportImage = async () => {
    if (Platform.OS === 'android') {
      // Using a broader permission check for Android 13+ compatibility
      const permission = Platform.Version >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

      const granted = await PermissionsAndroid.request(permission);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert("Permission Denied", "Cannot select a photo without permission.");
        return;
      }
    }
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
      if (response.didCancel || response.errorCode) {
        return;
      }
      const asset = response.assets?.[0];
      if (asset) {
        setNewReportData({ ...newReportData, image: asset });
      }
    });
  };

  // --- Upload Logic ---
  const handleUploadReport = async () => {
    if (!newReportData.title.trim() || !newReportData.image) {
      Alert.alert("Missing Information", "Please provide a title and select an image.");
      return;
    }
    setIsUploading(true);

    try {
      const uploadUri = newReportData.image.uri;
      const fileName = `${Date.now()}_${newReportData.image.fileName}`;
      const storageRef = storage().ref(`users/${user.uid}/reports/${fileName}`);

      await storageRef.putFile(uploadUri);
      const imageUrl = await storageRef.getDownloadURL();

      await firestore()
        .collection('users')
        .doc(user.uid)
        .collection('reports')
        .add({
          title: newReportData.title,
          imageUrl: imageUrl,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      Alert.alert("Success", "Report uploaded successfully!");
      closeUploadModal();
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Upload Failed", "An error occurred during the upload.");
    } finally {
      setIsUploading(false);
    }
  };

  // --- Modal Controls ---
  const openUploadModal = () => {
    setNewReportData({ title: '', image: null }); // Reset form
    setModalVisible(true);
  };

  const closeUploadModal = () => {
    setModalVisible(false);
    setIsUploading(false);
  };

  // --- NEW: View Report Handler ---
  const handleViewReport = (report) => {
    setSelectedReport(report);
    setImageViewerVisible(true);
  };

  // ----------------------------------------------------------------------
  // --- UPDATED: Download Function ---
  const downloadReport = async (uri, title) => {
    try {
      // 1. Request Permission (Crucial for Android)
      if (Platform.OS === 'android') {
        const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
        const granted = await PermissionsAndroid.request(permission, {
          title: "Storage Permission",
          message: "The app needs access to your storage to save the report.",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK"
        });

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert("Permission Denied", "Cannot save the report without storage permission.");
          return;
        }
      }

      // 2. Define File Path and Name
      const fileExtension = uri.split('.').pop().split('?')[0] || 'jpg';
      // Sanitize the title for use as a filename and append a timestamp
      const fileName = `${title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.${fileExtension}`;
      
      // Use the appropriate directory for public downloads
      const directory = Platform.select({
        ios: RNFS.DocumentDirectoryPath, // For iOS, typically in the app's documents
        android: RNFS.DownloadDirectoryPath, // For Android, use the public Download folder
      });
      
      const path = `${directory}/${fileName}`;

      // 3. Initiate Download
      const options = {
        fromUrl: uri,
        toFile: path,
        // Optionally add headers if your download link is protected and requires authentication
        // headers: {
        //   'Authorization': `Bearer ${yourAuthToken}` 
        // },
        // On Android, use the system's Download Manager
        ...(Platform.OS === 'android' && {
          addAndroidDownloads: {
            useDownloadManager: true, // Enable the download manager
            notification: true, // Show notification bar while downloading
            title: `Downloading ${title}`,
            description: 'Medical Report Download',
            mime: `image/${fileExtension}`,
            mediaScannable: true, // Make the file appear in the gallery/files app
          }
        })
      };

      const result = RNFS.downloadFile(options);

      result.promise.then(async (res) => {
        if (res.statusCode === 200) {
            let message = `Report saved to your device's Download folder.`;
            // On iOS, the path is typically within the app's sandbox.
            // If you want to save to the Photos/Camera Roll on iOS, you would need a different library like CameraRoll.
            if (Platform.OS === 'ios') {
                 message = `Report saved successfully within the app documents (path: ${path}).`;
            }
          Alert.alert("Download Complete", message);
        } else {
          Alert.alert("Download Failed", `Server returned status code ${res.statusCode}.`);
        }
      }).catch((err) => {
        console.error("RNFS download error:", err);
        Alert.alert("Download Error", "Could not complete the download.");
      });

    } catch (error) {
      console.error("Download setup error:", error);
      Alert.alert("Error", "An error occurred during the download process.");
    }
  };
  // ----------------------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text>Loading Reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleViewReport(item)}>
            <View style={styles.card}>
              <Image source={{ uri: item.imageUrl }} style={styles.reportImg} />
              <View style={styles.cardFooter}>
                <Text style={styles.reportTitle}>{item.title}</Text>
                <TouchableOpacity
                  style={styles.downloadBtn}
                  onPress={() => downloadReport(item.imageUrl, item.title)}
                >
                  <Icon name="download" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListHeaderComponent={<Text style={styles.title}>My Reports</Text>}
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>You haven't uploaded any reports yet.</Text>
            <Text style={styles.emptySubText}>Tap the '+' button to add your first report.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16 }}
      />

      {/* Upload FAB */}
      <TouchableOpacity style={styles.fab} onPress={openUploadModal}>
        <Icon name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Upload Modal */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Upload New Report</Text>
            <TextInput
              style={styles.input}
              placeholder="Report Title (e.g., Blood Test)"
              value={newReportData.title}
              onChangeText={(text) => setNewReportData({ ...newReportData, title: text })}
            />
            <TouchableOpacity style={styles.imagePicker} onPress={handleChooseReportImage}>
              {newReportData.image ? (
                <Image source={{ uri: newReportData.image.uri }} style={styles.previewImage} />
              ) : (
                <>
                  <Icon name="image" size={24} color="#4b5563" />
                  <Text style={styles.imagePickerText}>Select Report Image</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadReport} disabled={isUploading}>
              {isUploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadBtnText}>Upload</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={closeUploadModal} disabled={isUploading}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- NEW: Image Viewer Modal (Full Screen Popup) --- */}
      <Modal
        visible={isImageViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <View style={styles.viewerOverlay}>
          <View style={styles.viewerHeader}>
            <Text style={styles.viewerTitle}>{selectedReport?.title || "Report"}</Text>
            <TouchableOpacity style={styles.closeViewerBtn} onPress={() => setImageViewerVisible(false)}>
              <Icon name="x" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          {selectedReport && (
            <Image
              source={{ uri: selectedReport.imageUrl }}
              style={styles.fullReportImage}
              resizeMode="contain" // Use 'contain' to ensure the full image is visible
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

export default ReportsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: "700", color: "#1e293b", marginVertical: 20 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#475569', textAlign: 'center' },
  emptySubText: { fontSize: 14, color: '#64748b', marginTop: 8, textAlign: 'center' },
  // Report Card Styles
  card: { backgroundColor: "#fff", borderRadius: 12, marginBottom: 16, elevation: 3, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 6 },
  reportImg: { width: "100%", height: 220, borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: '#e2e8f0' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  reportTitle: { fontSize: 16, fontWeight: "600", color: "#333", flex: 1 },
  downloadBtn: { backgroundColor: "#2563eb", padding: 8, borderRadius: 20 },
  // FAB Styles
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', elevation: 8 },
  // Upload Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', padding: 24, borderRadius: 12, width: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, marginBottom: 16 },
  imagePicker: { height: 150, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  imagePickerText: { marginTop: 8, color: '#4b5563' },
  previewImage: { width: '100%', height: '100%', borderRadius: 6, resizeMode: 'cover' },
  uploadBtn: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center' },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { marginTop: 10, padding: 14, alignItems: 'center' },
  cancelBtnText: { color: '#475569', fontWeight: '600' },

  // --- NEW: Image Viewer Modal Styles ---
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  viewerHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 1,
  },
  viewerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    maxWidth: '80%',
  },
  closeViewerBtn: {
    padding: 8,
  },
  fullReportImage: {
    width: '100%',
    height: '100%',
  },
});