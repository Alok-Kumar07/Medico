// screens/caregiver/CaregiverReportsScreen.js

import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, Image, Modal, TouchableOpacity,
    FlatList, Alert, Platform,
    ActivityIndicator, SafeAreaView, Pressable,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import firestore from "@react-native-firebase/firestore";

// --- Helper for Date Formatting ---
const formatDate = (timestamp) => {
    if (!timestamp) return 'No date';
    // Handle Firestore Timestamp object
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
};

const CaregiverReportsScreen = ({ route, navigation }) => {
    const { patientId, patientName } = route.params || {};

    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- NEW: State for the Image Viewer Modal ---
    const [isViewerVisible, setIsViewerVisible] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);

    // --- Initial Check for Patient Data ---
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


    // --- Data Fetching Effect ---
    useEffect(() => {
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
                Alert.alert("Error Loading Reports", "Could not fetch reports.");
            });

        return () => subscriber();
    }, [patientId]);

    // --- Viewer Handlers ---
    const handleViewReport = (report) => {
        setSelectedReport(report);
        setIsViewerVisible(true);
    };

    const closeViewerModal = () => {
        setIsViewerVisible(false);
        setSelectedReport(null);
    };

    // --- UI Logic ---
    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>Loading reports...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                data={reports}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => handleViewReport(item)} // Tapping the card opens the viewer
                    >
                        <Image source={{ uri: item.imageUrl }} style={styles.reportImg} />
                        <View style={styles.cardFooter}>
                            <View style={styles.titleContainer}>
                                <Text style={styles.reportTitle}>{item.title}</Text>
                                <Text style={styles.dateText}>
                                    {formatDate(item.createdAt)}
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
                ListHeaderComponent={
                    <Text style={styles.title}>
                        Reports for <Text style={{ color: '#2563eb' }}>{patientName || 'Patient'}</Text>
                    </Text>
                }
                ListEmptyComponent={
                    <View style={styles.centerContainer}>
                        <Text style={styles.emptyText}>No reports have been uploaded for this patient.</Text>
                    </View>
                }
                contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 16 }}
            />

            {/* --- Image Viewer Modal (Popup) --- */}
            <Modal
                visible={isViewerVisible}
                transparent
                animationType="fade"
                onRequestClose={closeViewerModal}
            >
                <Pressable style={viewerStyles.viewerOverlay} onPress={closeViewerModal}>
                    <Pressable style={viewerStyles.viewerContent}>
                        <View style={viewerStyles.viewerHeader}>
                            <Text style={viewerStyles.viewerTitle}>{selectedReport?.title || "Report"}</Text>
                            <TouchableOpacity onPress={closeViewerModal} style={viewerStyles.closeViewerBtn}>
                                <Icon name="x" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        {selectedReport && (
                            <Image
                                source={{ uri: selectedReport.imageUrl }}
                                style={viewerStyles.fullReportImage}
                                resizeMode="contain"
                            />
                        )}
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
};

export default CaregiverReportsScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f8fafc" },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    loadingText: { marginTop: 10, color: '#475569' },
    title: { fontSize: 24, fontWeight: "700", color: "#1e293b", marginVertical: 20 },
    emptyText: { fontSize: 16, fontWeight: '600', color: '#475569', textAlign: 'center' },
    card: {
        backgroundColor: "#fff",
        borderRadius: 12,
        marginBottom: 16,
        elevation: 3,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 6
    },
    reportImg: {
        width: "100%",
        height: 220,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        backgroundColor: '#e2e8f0' // Placeholder color
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12
    },
    titleContainer: { flex: 1, marginRight: 8 },
    reportTitle: { fontSize: 16, fontWeight: "600", color: "#333" },
    dateText: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});

// --- Viewer Modal Styles (similar to the Doctor screen's viewer) ---
const viewerStyles = StyleSheet.create({
    viewerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    viewerContent: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
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