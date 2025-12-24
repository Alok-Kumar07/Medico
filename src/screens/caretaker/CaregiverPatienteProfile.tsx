import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    FlatList,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
    Pressable,
    Alert, // Import Alert for the remove button logic
} from "react-native";
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native'; // Import useNavigation
import Icon from 'react-native-vector-icons/Feather'; // Import Icon

// --- Helper Functions (keep these) ---
const getLogDateString = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};

const fmtTime = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
};

const dayShort = (date) => new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
const monthDay = (date) => new Date(date).getDate();

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

// --- Main Component ---
export default function CaregiverPatienteProfile({ route }) {
    const { patientId } = route.params;
    const navigation = useNavigation(); // Initialize navigation

    // --- State Management ---
    const [patient, setPatient] = useState(null);
    const [allMeds, setAllMeds] = useState([]);
    const [adherenceLog, setAdherenceLog] = useState({});
    const [loading, setLoading] = useState(true);

    // --- NEW: State for Doctor/Caretaker Names ---
    const [doctorName, setDoctorName] = useState("Not Assigned");
    const [peerCaretakerName, setPeerCaretakerName] = useState("Not Assigned");

    const [logDetailModal, setLogDetailModal] = useState({ visible: false, data: null });

    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    const [displayDate, setDisplayDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(today);
    const calendarListRef = useRef(null);

    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [pickerDate, setPickerDate] = useState(new Date());

    // --- Data Fetching Effects (Profile, Meds, Logs) ---
    useEffect(() => {
        if (!patientId) return;

        const profileSub = firestore().collection('users').doc(patientId).onSnapshot(doc => {
            if (doc.exists) setPatient({ id: doc.id, ...doc.data() });
            setLoading(false);
        });
        const medsSub = firestore().collection('users').doc(patientId).collection('medicines').onSnapshot(snap => {
            setAllMeds(snap.docs.map(doc => ({ docId: doc.id, ...doc.data() })));
        });
        const logSub = firestore().collection('users').doc(patientId).collection('adherenceLog').onSnapshot(snap => {
            const logs = {};
            snap.forEach(doc => { logs[doc.id] = doc.data().doses || []; });
            setAdherenceLog(logs);
        });

        return () => { profileSub(); medsSub(); logSub(); };
    }, [patientId]);

    // --- NEW: Effect to Fetch Doctor and Peer Caretaker Names ---
    useEffect(() => {
        const fetchProviders = async () => {
            if (!patient) return;
            
            // Fetch Doctor Name
            if (patient.approvedDoctor) {
                const doc = await firestore().collection('users').doc(patient.approvedDoctor).get();
                setDoctorName(doc.exists ? doc.data().name || "Unnamed Doctor" : "Doctor not found");
            } else { setDoctorName("Not Assigned"); }

            // Fetch Caretaker Name (For simplicity, we show the first Caregiver other than the current user, but since we don't have the current user's ID, we just display the first approved caregiver's name for now.)
            if (patient.approvedCaregivers && patient.approvedCaregivers.length > 0) {
                // Using the first caregiver ID found for display purposes
                const caretakerDoc = await firestore().collection('users').doc(patient.approvedCaregivers[0]).get();
                setPeerCaretakerName(caretakerDoc.exists ? caretakerDoc.data().name || "Unnamed Caregiver" : "Caregiver not found");
            } else { setPeerCaretakerName("Not Assigned"); }
        };
        fetchProviders();
    }, [patient]);

    // --- NEW: Remove Patient Handler (Caregiver perspective) ---
    const handleRemovePatient = () => {
        Alert.alert(
            "Removal Blocked 🛑",
            `Only ${patient?.name} (the patient) has the authority to remove you as their approved caregiver.`,
            [
                { 
                    text: "OK", 
                    style: "cancel" 
                },
            ]
        );
    };


    // --- Memoized Calculations (keep these) ---
    const medsForSelectedDate = useMemo(() => {
        const selectedDayStart = new Date(selectedDate);
        selectedDayStart.setHours(0, 0, 0, 0);
        const logDateStr = getLogDateString(selectedDate);
        const dailyLog = adherenceLog[logDateStr] || [];

        let baseSchedule = [];
        allMeds.forEach(med => {
            const startDate = med.startDate?.toDate();
            const endDate = med.endDate?.toDate();
            if (!startDate || !endDate || startDate > selectedDayStart || endDate < selectedDayStart) return;
            (med.times || []).forEach(time => baseSchedule.push({
                id: `${med.docId}_${time}`, docId: med.docId, name: med.name, scheduledTime: time,
                status: 'Pending', takenAt: null, confirmationPhotoUrl: null
            }));
        });

        return baseSchedule.map(scheduledDose => {
            const loggedDose = dailyLog.find(log => log.medicineId === scheduledDose.docId && log.scheduledTime === scheduledDose.scheduledTime);
            return loggedDose ? { ...scheduledDose, ...loggedDose, takenAt: loggedDose.takenAt?.toDate() } : scheduledDose;
        }).sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
    }, [selectedDate, allMeds, adherenceLog]);

    const medsWithStock = useMemo(() => {
        const uniqueMeds = allMeds.reduce((acc, current) => {
            if (!acc.find(item => item.docId === current.docId)) acc.push(current);
            return acc;
        }, []);
        return uniqueMeds.map(m => ({
            ...m,
            daysLeft: (m.times?.length > 0) ? Math.floor((m.stock || 0) / m.times.length) : 0,
            dailyUsage: m.times?.length || 0
        }));
    }, [allMeds]);

    const calendarDays = useMemo(() => {
        const days = [];
        const start = new Date(displayDate.getFullYear(), displayDate.getMonth(), 1);
        const end = new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 0);
        for (let d = start; d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d));
        return days;
    }, [displayDate]);

    // --- Calendar Scroll Effect (keep this) ---
    useEffect(() => {
        const isCurrentView = displayDate.getMonth() === today.getMonth() && displayDate.getFullYear() === today.getFullYear();
        if (isCurrentView && calendarListRef.current) {
            const todayIndex = calendarDays.findIndex(d => d.toDateString() === today.toDateString());
            if (todayIndex !== -1) setTimeout(() => calendarListRef.current.scrollToIndex({ index: todayIndex, animated: true, viewPosition: 0.5 }), 500);
        }
    }, [calendarDays, today, displayDate]);

    const handleConfirmMonthYear = () => {
        setDisplayDate(pickerDate);
        setSelectedDate(new Date(pickerDate.getFullYear(), pickerDate.getMonth(), 1));
        setShowMonthPicker(false);
    };

    // --- Render Functions (keep this) ---
    const renderCalendarDay = ({ item }) => {
        const isToday = item.toDateString() === today.toDateString();
        const isSelected = item.toDateString() === selectedDate.toDateString();
        return (
            <TouchableOpacity onPress={() => setSelectedDate(item)} style={[styles.dayPill, isSelected && styles.dayPillSelected, isToday && styles.dayPillToday]}>
                <Text style={[styles.dayName, isSelected && styles.dayNameActive]}>{dayShort(item)}</Text>
                <View style={[styles.dayNumWrap, isSelected && styles.dayNumWrapActive]}>
                    <Text style={[styles.dayNum, isSelected && styles.dayNumActive]}>{monthDay(item)}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading || !patient) {
        return <SafeAreaView style={styles.safe}><ActivityIndicator size="large" color="#2563eb" /></SafeAreaView>;
    }

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                <View style={styles.container}>
                    {/* Header/Profile Box */}
                    <View style={styles.profileBox}>
                        <Image source={{ uri: patient.profileImg || 'https://i.pravatar.cc/150?img=5' }} style={styles.profileImg} />
                        <Text style={styles.name}>{patient.name}</Text>
                        
                        {/* --- NEW: Action Buttons (Reports only) --- */}
                        <View style={styles.actionButtonsContainer}>
                            {/* Schedule button REMOVED as requested */}
                            
                            {/* Reports Button */}
                            <TouchableOpacity style={styles.manageBtn} onPress={() => navigation.navigate('CaregiverReportsScreen', { patientId: patient.id, patientName: patient.name })}>
                                <Icon name="file-text" size={16} color="#312e81" />
                                <Text style={styles.manageBtnText}>Reports</Text>
                            </TouchableOpacity>
                        </View>
                        
                        {/* --- NEW: Remove Patient Button (Caregiver Logic) --- */}
                        <TouchableOpacity style={styles.removeBtn} onPress={handleRemovePatient}>
                            <Text style={styles.removeBtnText}>Remove Patient</Text>
                        </TouchableOpacity>

                    </View>
                    
                    {/* --- NEW: Patient Demographics (Age, Gender, Blood Group) --- */}
                    <View style={styles.infoRow}>
                        <Text style={styles.infoText}>Age: {patient.age || "--"}</Text>
                        <Text style={styles.infoText}>Gender: {patient.gender || "--"}</Text>
                        <Text style={styles.infoText}>Blood: {patient.bloodGroup || "--"}</Text>
                    </View>

                    {/* --- NEW: Assigned Doctor and Caretaker Names --- */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Assigned Doctor</Text>
                        <Text style={styles.sectionValue}>Dr. {doctorName}</Text>
                        
                        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Caretaker</Text>
                        <Text style={styles.sectionValue}>{peerCaretakerName}</Text>
                    </View>

                    {/* Calendar */}
                    <View style={styles.calendarWrap}>
                        <View style={styles.calendarHeader}>
                            <Text style={styles.sectionTitle}>Adherence Calendar</Text>
                            <TouchableOpacity onPress={() => { setPickerDate(displayDate); setShowMonthPicker(true); }} style={styles.datePickerButton}>
                                <Text style={styles.sectionTitle}>{`${displayDate.toLocaleString('default', { month: 'long' })} ${displayDate.getFullYear()}`}</Text>
                                <Text style={styles.datePickerIcon}> ▼</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList ref={calendarListRef} data={calendarDays} renderItem={renderCalendarDay} horizontal showsHorizontalScrollIndicator={false} keyExtractor={(item) => item.toISOString()} getItemLayout={(data, index) => ({ length: 80, offset: 80 * index, index })} />
                    </View>

                    {/* Medicine Log (keep this) */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Medicine Log</Text>
                        {medsForSelectedDate.length > 0 ? medsForSelectedDate.map(item => {
                            const statusColor = item.status === 'Taken' ? '#10b981' : item.status === 'Missed' ? '#ef4444' : '#f59e0b';
                            return (
                                <TouchableOpacity key={item.id} style={[styles.medicineCard, { borderLeftColor: statusColor }]} onPress={() => setLogDetailModal({ visible: true, data: item })}>
                                    <View style={{ flex: 1 }}><Text style={styles.medicineName}>{item.name}</Text><Text style={styles.medicineSchedule}>Scheduled: {item.scheduledTime}</Text></View>
                                    <Text style={[styles.medicineStatus, { color: statusColor }]}>{item.status}</Text>
                                </TouchableOpacity>
                            )
                        }) : <Text style={styles.emptyText}>No medicines scheduled for this date.</Text>}
                    </View>

                    {/* Medicine Stocks (keep this) */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Medicine Stocks</Text>
                        {medsWithStock.length > 0 ? (
                            medsWithStock.map(item => {
                                let stockStyle = styles.stockRowGreen;
                                if (item.daysLeft < 4) stockStyle = styles.stockRowRed;
                                else if (item.daysLeft < 8) stockStyle = styles.stockRowYellow;
                                return (
                                    <View key={item.docId} style={[styles.stockRow, stockStyle]}>
                                        <View style={{ flex: 2 }}><Text style={styles.cellTitle}>{item.name}</Text><Text style={styles.cellSub}>Stock: {item.stock} • Daily: {item.dailyUsage}</Text></View>
                                        <View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={{ fontWeight: '700', color: '#111' }}>{item.daysLeft} days left</Text></View>
                                    </View>
                                );
                            })
                        ) : (
                            <Text style={styles.emptyText}>No medicines found for this patient.</Text>
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Log Detail Modal (keep this) */}
            <Modal visible={logDetailModal.visible} transparent animationType="fade" onRequestClose={() => setLogDetailModal({ visible: false, data: null })}>
                <Pressable style={styles.modalOverlay} onPress={() => setLogDetailModal({ visible: false, data: null })}>
                    <Pressable style={styles.modalCard}>
                        {logDetailModal.data && (
                            <>
                                <Text style={styles.modalTitle}>{logDetailModal.data.name}</Text>
                                <View style={styles.modalDetailRow}><Text style={styles.modalDetailLabel}>Status:</Text><Text style={[styles.modalDetailValue, { color: logDetailModal.data.status === 'Taken' ? '#16a34a' : '#ef4444' }]}>{logDetailModal.data.status}</Text></View>
                                <View style={styles.modalDetailRow}><Text style={styles.modalDetailLabel}>Taken At:</Text><Text style={styles.modalDetailValue}>{logDetailModal.data.takenAt ? fmtTime(logDetailModal.data.takenAt) : 'N/A'}</Text></View>
                                <Text style={[styles.modalDetailLabel, { marginTop: 16, marginBottom: 8 }]}>Confirmation Photo:</Text>
                                {logDetailModal.data.confirmationPhotoUrl ? <Image source={{ uri: logDetailModal.data.confirmationPhotoUrl }} style={styles.confirmationImage} /> : <View style={styles.noPhotoContainer}><Text style={styles.noPhotoText}>No photo was uploaded.</Text></View>}
                                <TouchableOpacity style={styles.closeButton} onPress={() => setLogDetailModal({ visible: false, data: null })}><Text style={styles.closeButtonText}>Close</Text></TouchableOpacity>
                            </>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Month/Year Picker Modal (keep this) */}
            <Modal visible={showMonthPicker} transparent animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => setShowMonthPicker(false)}>
                    <Pressable style={styles.pickerModalCard}>
                        <Text style={styles.modalTitle}>Select Month & Year</Text>
                        <View style={styles.pickerContainer}>
                            <FlatList data={YEARS} keyExtractor={item => item.toString()} renderItem={({ item }) => (<TouchableOpacity style={[styles.pickerItem, pickerDate.getFullYear() === item && styles.pickerItemSelected]} onPress={() => setPickerDate(new Date(item, pickerDate.getMonth(), 1))}><Text style={[styles.pickerItemText, pickerDate.getFullYear() === item && styles.pickerItemTextSelected]}>{item}</Text></TouchableOpacity>)} showsVerticalScrollIndicator={false} style={styles.pickerList} initialScrollIndex={YEARS.indexOf(pickerDate.getFullYear())} getItemLayout={(data, index) => ({ length: 45, offset: 45 * index, index })} />
                            <FlatList data={MONTHS} keyExtractor={item => item} renderItem={({ item, index }) => (<TouchableOpacity style={[styles.pickerItem, pickerDate.getMonth() === index && styles.pickerItemSelected]} onPress={() => setPickerDate(new Date(pickerDate.getFullYear(), index, 1))}><Text style={[styles.pickerItemText, pickerDate.getMonth() === index && styles.pickerItemTextSelected]}>{item}</Text></TouchableOpacity>)} showsVerticalScrollIndicator={false} style={styles.pickerList} initialScrollIndex={pickerDate.getMonth()} getItemLayout={(data, index) => ({ length: 45, offset: 45 * index, index })} />
                        </View>
                        <View style={styles.pickerActions}>
                            <Pressable style={[styles.modalBtn, { flex: 1, marginRight: 8 }]} onPress={() => setShowMonthPicker(false)}><Text style={[styles.modalBtnText, { color: '#111' }]}>Cancel</Text></Pressable>
                            <Pressable style={[styles.modalBtn, { flex: 1, marginLeft: 8, backgroundColor: '#2563eb' }]} onPress={handleConfirmMonthYear}><Text style={[styles.modalBtnText, { color: '#fff' }]}>Confirm</Text></Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#f8fafc' },
    container: { flex: 1, paddingHorizontal: 16 },
    profileBox: { alignItems: 'center', paddingTop: 16, paddingBottom: 10 },
    profileImg: { width: 100, height: 100, borderRadius: 50, marginBottom: 10, borderWidth: 2, borderColor: '#e5e7eb' },
    name: { fontSize: 22, fontWeight: '700', color: '#111' },
    details: { fontSize: 14, color: '#555', marginTop: 2 }, // Added for Doctor detail (if needed)

    // --- NEW: Action Buttons Container (Copied from DoctorProfile) ---
    actionButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 16,
    },
    manageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eef2ff',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#c7d2fe',
        marginHorizontal: 8,
    },
    manageBtnText: {
        color: '#312e81',
        fontWeight: '700',
        marginLeft: 8,
    },

    // --- NEW: Remove Patient Button Styles (Copied from DoctorProfile) ---
    removeBtn: {
        marginTop: 12,
        paddingVertical: 6,
        paddingHorizontal: 16,
        backgroundColor: '#fee2e2',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#fca5a5'
    },
    removeBtnText: {
        color: '#b91c1c',
        fontWeight: '600'
    },

    // --- NEW: Demographics Row (Copied from DoctorProfile) ---
    infoRow: { flexDirection: "row", justifyContent: "space-around", marginVertical: 16, paddingVertical: 12, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    infoText: { fontSize: 14, fontWeight: "600", color: "#333" },

    // --- General Section Styles (Copied from DoctorProfile) ---
    section: { marginTop: 8, marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    sectionValue: { fontSize: 14, color: "#444", marginTop: 4 },
    
    calendarWrap: { marginTop: 16, marginBottom: 10, paddingBottom: 10 },
    calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    datePickerButton: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 8, backgroundColor: '#eef2ff' },
    datePickerIcon: { fontSize: 16, fontWeight: '700', color: '#374151' },
    dayPill: { width: 70, alignItems: 'center', marginHorizontal: 5, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
    dayPillSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    dayPillToday: { borderColor: '#22c55e', borderWidth: 2 },
    dayName: { fontSize: 12, color: '#475569', marginBottom: 4 },
    dayNameActive: { color: '#fff', fontWeight: '600' },
    dayNumWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    dayNumWrapActive: { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
    dayNum: { fontSize: 14, color: '#334155', fontWeight: '500' },
    dayNumActive: { color: '#fff', fontWeight: '700' },
    medicineCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: '#e5e7eb', borderLeftWidth: 5, borderRadius: 10, marginBottom: 10, backgroundColor: '#fff' },
    medicineName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
    medicineSchedule: { fontSize: 13, color: '#555' },
    medicineStatus: { fontSize: 14, fontWeight: '700' },
    emptyText: { textAlign: 'center', marginTop: 20, color: '#64748b', fontStyle: 'italic' },
    stockRow: { flexDirection: 'row', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 6 },
    stockRowRed: { backgroundColor: '#fee2e2' },
    stockRowYellow: { backgroundColor: '#fef3c7' },
    stockRowGreen: { backgroundColor: '#dcfce7' },
    cellTitle: { fontSize: 15, fontWeight: '600' },
    cellSub: { fontSize: 12, color: '#64748b', marginTop: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    modalCard: { width: '90%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 12, padding: 20, elevation: 5 },
    modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
    modalDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    modalDetailLabel: { fontSize: 16, color: '#6b7280' },
    modalDetailValue: { fontSize: 16, fontWeight: '600' },
    confirmationImage: { width: '100%', height: 300, borderRadius: 8, backgroundColor: '#f1f5f9' },
    noPhotoContainer: { width: '100%', height: 200, borderRadius: 8, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
    noPhotoText: { color: '#6b7280', fontStyle: 'italic' },
    closeButton: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },
    closeButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    pickerModalCard: { backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '90%', maxWidth: 400, alignSelf: 'center', elevation: 5 },
    pickerContainer: { flexDirection: 'row', justifyContent: 'space-between', height: 220, marginVertical: 16 },
    pickerList: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginHorizontal: 5 },
    pickerItem: { paddingVertical: 12, alignItems: 'center', height: 45 },
    pickerItemSelected: { backgroundColor: '#dbeafe', borderRadius: 6 },
    pickerItemText: { color: '#334155', fontSize: 16 },
    pickerItemTextSelected: { color: '#1e40af', fontWeight: '700' },
    pickerActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    modalBtn: { padding: 12, borderRadius: 10, backgroundColor: '#eef2ff', alignItems: 'center' },
    modalBtnText: { fontWeight: '700' },
});