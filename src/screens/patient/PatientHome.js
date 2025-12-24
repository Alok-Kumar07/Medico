// src/screens/PatientHome.js
import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Alert,
    Modal,
    ScrollView,
    SafeAreaView,
    ActivityIndicator,
    PermissionsAndroid,
    Platform,
    Image,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { launchCamera } from 'react-native-image-picker';
import Toast from 'react-native-toast-message';

// --- FIREBASE IMPORTS ---
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

// ---------- Helpers ----------
const getLogDateString = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
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

const dayShort = (date) =>
    new Date(date).toLocaleDateString('en-US', { weekday: 'short' });

const monthDay = (date) => new Date(date).getDate();

// NEW: Constants for the month/year picker
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
const currentYear = new Date().getFullYear();
// Creates an array of years, from 10 years ago to 10 years in the future
const YEARS = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);


// ---------- Main Component ----------
export default function PatientHome({ navigation }) {
    const { user, profile } = useAuth();
    const displayName = profile?.name ?? profile?.email?.split('@')[0] ?? 'User';

    // --- STATE MANAGEMENT ---
    const [allMeds, setAllMeds] = useState([]);
    const [dailySchedule, setDailySchedule] = useState([]);
    const [loadingMeds, setLoadingMeds] = useState(true);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [now, setNow] = useState(new Date());

    const [showUploadModal, setShowUploadModal] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [selectedMedForPhoto, setSelectedMedForPhoto] = useState(null);

    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    const [displayDate, setDisplayDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(today);
    const calendarListRef = useRef(null);

    // NEW: States for the month/year picker modal
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [pickerDate, setPickerDate] = useState(new Date());


    // --- EFFECT 1: Fetch all medicine definitions for the user ---
    useEffect(() => {
        if (!user || !profile) {
            setAllMeds([]);
            setLoadingMeds(false);
            return;
        }

        const unsubscribe = firestore()
            .collection('users')
            .doc(user.uid)
            .collection('medicines')
            .onSnapshot(
                (querySnapshot) => {
                    const fetchedMeds = querySnapshot.docs.map((doc) => ({
                        docId: doc.id,
                        ...doc.data(),
                    }));
                    setAllMeds(fetchedMeds);
                    setLoadingMeds(false);
                },
                (error) => {
                    console.error("Firebase fetch error: ", error);
                    Toast.show({ type: "error", text1: "Failed to fetch medicines." });
                    setLoadingMeds(false);
                }
            );

        return () => unsubscribe();
    }, [user, profile]);

    // --- EFFECT 2: Build daily schedule and fetch the daily log ---
    useEffect(() => {
        if (!user || !profile || allMeds.length === 0) {
            setDailySchedule([]);
            return;
        }

        setLoadingSchedule(true);

        const todayStart = new Date(selectedDate);
        todayStart.setHours(0, 0, 0, 0);

        let baseSchedule = [];
        allMeds.forEach((med) => {
            const startDate = med.startDate?.toDate();
            const endDate = med.endDate?.toDate();
            if (!startDate || !endDate || startDate > todayStart || endDate < todayStart) {
                return;
            }
            if (med.times && Array.isArray(med.times)) {
                med.times.forEach((time) => {
                    const [hour] = time.split(':');
                    baseSchedule.push({
                        id: `${med.docId}_${time}`,
                        docId: med.docId,
                        name: med.name,
                        mealRelation: med.meal,
                        stock: med.stock || 0,
                        scheduledAtHour: parseInt(hour, 10),
                        scheduledTime: time,
                        takenAt: null,
                        status: 'Pending',
                    });
                });
            }
        });

        const fetchLog = async () => {
            try {
                const logDate = getLogDateString(selectedDate);
                const logDoc = await firestore()
                    .collection('users').doc(user.uid)
                    .collection('adherenceLog').doc(logDate)
                    .get();

                let finalSchedule = baseSchedule;
                const statusMap = new Map();

                if (logDoc.exists) {
                    const loggedDoses = logDoc.data()?.doses || [];
                    loggedDoses.forEach(dose => {
                        const key = `${dose.medicineId}_${dose.scheduledTime}`;
                        statusMap.set(key, {
                            status: dose.status,
                            takenAt: dose.takenAt?.toDate() || null,
                        });
                    });
                }

                const now = new Date();
                let missedDosesToLog = [];

                finalSchedule.forEach(med => {
                    const key = med.id;
                    if (statusMap.has(key)) return;

                    const [hours, minutes] = med.scheduledTime.split(':');
                    const scheduledDateTime = new Date(selectedDate);
                    scheduledDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

                    if (scheduledDateTime < now) {
                        statusMap.set(key, { status: 'Missed', takenAt: null });

                        missedDosesToLog.push({
                            medicineId: med.docId,
                            scheduledTime: med.scheduledTime,
                            status: 'Missed',
                        });
                    }
                });

                if (missedDosesToLog.length > 0) {
                    const logRef = firestore()
                        .collection('users').doc(user.uid)
                        .collection('adherenceLog').doc(logDate);

                    logRef.set({
                        doses: firestore.FieldValue.arrayUnion(...missedDosesToLog)
                    }, { merge: true }).catch(err => {
                        console.error("Failed to log missed doses:", err);
                        Toast.show({ type: "error", text1: "Error updating missed doses." });
                    });
                }

                finalSchedule = baseSchedule.map(med => {
                    const logStatus = statusMap.get(med.id);
                    return logStatus ? { ...med, ...logStatus } : med;
                });

                setDailySchedule(finalSchedule);

            } catch (error) {
                console.error("Error fetching daily log: ", error);
                Toast.show({ type: "error", text1: "Could not load daily status." });
            } finally {
                setLoadingSchedule(false);
            }
        };

        if (baseSchedule.length > 0) {
            fetchLog();
        } else {
            setDailySchedule([]);
            setLoadingSchedule(false);
        }
    }, [allMeds, selectedDate, user, profile]);

    // ---------- Camera Flow ----------
    async function requestCameraPermission() {
        if (Platform.OS === 'android') {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.CAMERA,
                    {
                        title: 'Camera Permission',
                        message: 'This app needs camera access for medicine confirmation.',
                        buttonPositive: 'OK',
                        buttonNegative: 'Cancel',
                    }
                );
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            } catch (err) {
                console.warn(err);
                return false;
            }
        }
        return true;
    }

    const openCamera = async (med) => {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
            Alert.alert('Permission denied', 'Camera permission is required.');
            return;
        }

        const options = { mediaType: 'photo', saveToPhotos: false, cameraType: 'back', quality: 0.8 };

        launchCamera(options, (res) => {
            if (res.didCancel) return;
            if (res.errorCode) {
                return Alert.alert('Camera Error', res.errorMessage || 'Unable to open camera');
            }
            const asset = res.assets?.[0];
            if (asset?.uri) {
                setCapturedPhoto(asset);
                setSelectedMedForPhoto(med);
                setShowUploadModal(true);
            }
        });
    };

    const handleUpload = async () => {
        if (!user || !capturedPhoto || !selectedMedForPhoto) {
            Toast.show({ type: 'error', text1: 'Missing required data.' });
            return;
        }
        setUploading(true);
        try {
            const photoUri = capturedPhoto.uri;
            const logDate = getLogDateString(selectedDate);
            const fileName = `${selectedMedForPhoto.docId}_${Date.now()}.jpg`;
            const storagePath = `users/${user.uid}/adherence_photos/${logDate}/${fileName}`;
            const storageRef = storage().ref(storagePath);

            await storageRef.putFile(Platform.OS === 'android' ? photoUri : photoUri.replace('file://', ''));
            const downloadURL = await storageRef.getDownloadURL();

            const batch = firestore().batch();
            const logRef = firestore()
                .collection('users').doc(user.uid)
                .collection('adherenceLog').doc(logDate);
            const medRef = firestore()
                .collection('users').doc(user.uid)
                .collection('medicines').doc(selectedMedForPhoto.docId);

            const newDose = {
                medicineId: selectedMedForPhoto.docId,
                scheduledTime: selectedMedForPhoto.scheduledTime,
                status: 'Taken',
                takenAt: firestore.Timestamp.now(),
                confirmationPhotoUrl: downloadURL,
            };

            batch.set(logRef, {
                doses: firestore.FieldValue.arrayUnion(newDose)
            }, { merge: true });

            batch.update(medRef, {
                stock: firestore.FieldValue.increment(-1),
            });

            await batch.commit();

            Toast.show({ type: 'success', text1: `${selectedMedForPhoto.name} confirmed!` });
            setShowUploadModal(false);

        } catch (error) {
            console.error("Failed to mark as taken:", error);
            Toast.show({ type: 'error', text1: 'Upload failed. Please try again.' });
        } finally {
            setUploading(false);
            setCapturedPhoto(null);
            setSelectedMedForPhoto(null);
        }
    };

    // ---------- Calculations & Memos ----------
    const medsWithStock = useMemo(() => {
        const uniqueMeds = allMeds.reduce((acc, current) => {
            if (!acc.find(item => item.docId === current.docId)) {
                acc.push(current);
            }
            return acc;
        }, []);
        return uniqueMeds.map(m => ({
            ...m,
            daysLeft: (m.times?.length > 0) ? Math.floor((m.stock || 0) / m.times.length) : 0,
            dailyUsage: m.times?.length || 0
        }));
    }, [allMeds]);

    const medsForSelectedDate = useMemo(() => {
        return dailySchedule
            .map((m) => {
                const scheduled = new Date(selectedDate);
                const [hours, minutes] = m.scheduledTime.split(':');
                scheduled.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
                return { ...m, scheduledAt: scheduled };
            })
            .sort((a, b) => a.scheduledAt - b.scheduledAt);
    }, [dailySchedule, selectedDate]);

    const nextMed = useMemo(() => {
        if (selectedDate.toDateString() !== today.toDateString()) return null;
        return medsForSelectedDate.find(
            (m) => new Date(m.scheduledAt) > now && m.status !== 'Taken'
        );
    }, [medsForSelectedDate, now, selectedDate, today]);

    const [countdown, setCountdown] = useState('');
    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
            if (!nextMed) {
                setCountdown('No upcoming meds');
                return;
            }
            const diffMs = new Date(nextMed.scheduledAt) - new Date();
            if (diffMs <= 0) {
                setCountdown('Due now');
                return;
            }
            const totalSec = Math.floor(diffMs / 1000);
            const hrs = Math.floor(totalSec / 3600);
            const mins = Math.floor((totalSec % 3600) / 60);
            const secs = totalSec % 60;
            setCountdown(`${hrs}h ${mins}m ${secs}s`);
        }, 1000);
        return () => clearInterval(timer);
    }, [nextMed]);

    // ---------- Calendar Logic ----------
    const calendarDays = useMemo(() => {
        const days = [];
        const year = displayDate.getFullYear();
        const month = displayDate.getMonth();
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            days.push(new Date(d));
        }
        return days;
    }, [displayDate]);

    useEffect(() => {
        const isCurrentMonthView =
            displayDate.getMonth() === today.getMonth() &&
            displayDate.getFullYear() === today.getFullYear();

        if (isCurrentMonthView) {
            const todayIndex = calendarDays.findIndex(d => d.toDateString() === today.toDateString());
            if (todayIndex !== -1 && calendarListRef.current) {
                setTimeout(() => {
                    calendarListRef.current.scrollToIndex({
                        index: todayIndex,
                        animated: true,
                        viewPosition: 0.5,
                    });
                }, 500);
            }
        }
    }, [calendarDays, today, displayDate]);

    // NEW: Handler for confirming month/year selection
    const handleConfirmMonthYear = () => {
        setDisplayDate(pickerDate);
        // Optional: set selectedDate to the first of the new month
        setSelectedDate(new Date(pickerDate.getFullYear(), pickerDate.getMonth(), 1));
        setShowMonthPicker(false);
    };


    // ---------- Render Functions ----------
    const renderCalendarDay = ({ item }) => {
        const isToday = item.toDateString() === today.toDateString();
        const isSelected = item.toDateString() === selectedDate.toDateString();
        return (
            <TouchableOpacity
                onPress={() => setSelectedDate(item)}
                style={[styles.dayPill, isSelected && styles.dayPillSelected, isToday && styles.dayPillToday]}
            >
                <Text style={[styles.dayName, isSelected && styles.dayNameActive]}>{dayShort(item)}</Text>
                <View style={[styles.dayNumWrap, isSelected && styles.dayNumWrapActive]}>
                    <Text style={[styles.dayNum, isSelected && styles.dayNumActive]}>{monthDay(item)}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const renderMedRow = ({ item }) => {
        const statusColor = item.status === 'Taken' ? styles.statusTaken : item.status === 'Missed' ? styles.statusMissed : styles.statusPending;
        return (
            <View style={styles.tableRow}>
                <View style={[styles.cell, { flex: 1 }]}>
                    <Text style={styles.cellTime}>{item.scheduledTime}</Text>
                    <Text style={styles.cellSub}>{item.takenAt ? fmtTime(item.takenAt) : '-'}</Text>
                </View>
                <View style={[styles.cell, { flex: 2 }]}>
                    <Text style={styles.cellTitle}>{item.name}</Text>
                    <Text style={styles.cellSub}>{item.mealRelation}</Text>
                </View>
                <View style={[styles.cell, { flex: 1, alignItems: 'center' }]}>
                    <View style={[styles.statusPill, statusColor]}>
                        <Text style={styles.statusText}>{item.status || 'Pending'}</Text>
                    </View>
                </View>
            </View>
        );
    };

    const handleSignOut = async () => {
        try {
            await auth().signOut();
        } catch (err) {
            Alert.alert('Error', 'Failed to sign out: ' + err.message);
        }
    };

    if (loadingMeds) {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#2563eb" />
                    <Text style={{ marginTop: 10, color: '#666' }}>Loading Schedule...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.greet}>Hi, <Text style={styles.name}>{displayName}</Text></Text>
                    <TouchableOpacity onPress={() => setShowProfileMenu(true)} style={styles.profileIcon}>
                        {profile?.profileImg ? (
                            <Image
                                source={{ uri: profile.profileImg }}
                                style={styles.profileImage}
                            />
                        ) : (
                            <Text style={styles.profileInitial}>
                                {(displayName || 'U').charAt(0).toUpperCase()}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Calendar */}
                <View style={styles.calendarWrap}>
                    {/* MODIFIED: Calendar Header is now a button to open the picker */}
                    <View style={styles.calendarHeader}>
                        <Text style={styles.sectionTitle}>Calendar</Text>
                        <TouchableOpacity
                            onPress={() => {
                                setPickerDate(displayDate); // Sync picker with current view
                                setShowMonthPicker(true);
                            }}
                            style={styles.datePickerButton}
                        >
                            <Text style={styles.sectionTitle}>
                                {`${displayDate.toLocaleString('default', { month: 'long' })} ${displayDate.getFullYear()}`}
                            </Text>
                            <Text style={styles.datePickerIcon}> ▼</Text>
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        ref={calendarListRef}
                        data={calendarDays}
                        renderItem={renderCalendarDay}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(item) => item.toISOString()}
                        getItemLayout={(data, index) => ({ length: 80, offset: 80 * index, index })}
                    />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={styles.sectionTitle}>Medicine Log</Text>
                            {loadingSchedule && <ActivityIndicator size="small" color="#2563eb" />}
                        </View>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.headerCell, { flex: 1 }]}>Time / Taken</Text>
                            <Text style={[styles.headerCell, { flex: 2 }]}>Medicine</Text>
                            <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>Status</Text>
                        </View>
                        {medsForSelectedDate.length > 0 ? medsForSelectedDate.map((item, index) => (
                            <View key={item.id}>
                                {renderMedRow({ item })}
                                {index < medsForSelectedDate.length - 1 && <View style={styles.separator} />}
                            </View>
                        )) : (
                            <Text style={styles.emptyText}>No medicines scheduled for {selectedDate.toDateString()}.</Text>
                        )}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Medicine Stocks</Text>
                        {medsWithStock.map((item) => {
                            let stockStyle = styles.stockRowGreen;
                            if (item.daysLeft < 4) stockStyle = styles.stockRowRed;
                            else if (item.daysLeft < 8) stockStyle = styles.stockRowYellow;
                            return (
                                <View key={item.docId} style={[styles.stockRow, stockStyle]}>
                                    <View style={{ flex: 2 }}>
                                        <Text style={styles.cellTitle}>{item.name}</Text>
                                        <Text style={styles.cellSub}>Stock: {item.stock} • Daily: {item.dailyUsage}</Text>
                                    </View>
                                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                        <Text style={{ fontWeight: '700', color: '#111' }}>{item.daysLeft} days left</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>

                {/* Countdown */}
                <View style={styles.countdownWrap}>
                    <Text style={styles.countdownTitle}>Next Medicine</Text>
                    {nextMed ? (
                        <View style={styles.nextMedCard}>
                            <View>
                                <Text style={styles.nextMedName}>{nextMed.name}</Text>
                                <Text style={styles.nextMedTime}>{nextMed.scheduledTime} • {nextMed.mealRelation}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.countdownText}>{countdown}</Text>
                                <Pressable style={styles.takeBtn} onPress={() => openCamera(nextMed)}>
                                    <Text style={styles.takeBtnText}>Mark as Taken</Text>
                                </Pressable>
                            </View>
                        </View>
                    ) : (
                        <Text style={{ color: '#666', textAlign: 'center', paddingVertical: 10 }}>All medicines for today are accounted for.</Text>
                    )}
                </View>

                {/* Upload Modal */}
                <Modal visible={showUploadModal} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <Text style={styles.modalName}>Confirm Dose</Text>
                            {capturedPhoto && <Image source={{ uri: capturedPhoto.uri }} style={styles.previewImage} resizeMode="cover" />}
                            <Pressable style={[styles.modalBtn, { backgroundColor: '#2563eb' }]} onPress={handleUpload} disabled={uploading}>
                                <Text style={[styles.modalBtnText, { color: '#fff' }]}>{uploading ? 'Uploading...' : 'Confirm & Upload'}</Text>
                            </Pressable>
                            <Pressable style={[styles.modalBtn, { backgroundColor: '#e2e8f0' }]} onPress={() => setShowUploadModal(false)} disabled={uploading}>
                                <Text style={[styles.modalBtnText, { color: '#111' }]}>Cancel</Text>
                            </Pressable>
                        </View>
                    </View>
                </Modal>

                {/* Profile Modal - THIS IS THE CORRECTED LINE */}
                <Modal visible={showProfileMenu} animationType="slide" transparent>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <Text style={styles.modalName}>{displayName}</Text>
                            <Pressable style={styles.modalBtn} onPress={() => { setShowProfileMenu(false); navigation.navigate('PatientProfile'); }}>
                                <Text style={styles.modalBtnText}>View Profile</Text>
                            </Pressable>
                            <Pressable style={[styles.modalBtn, { backgroundColor: '#ef4444' }]} onPress={async () => { setShowProfileMenu(false); await handleSignOut(); }}>
                                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Sign Out</Text>
                            </Pressable>
                            <Pressable style={styles.modalClose} onPress={() => setShowProfileMenu(false)}>
                                <Text style={{ color: '#666' }}>Close</Text>
                            </Pressable>
                        </View>
                    </View>
                </Modal>

                {/* NEW: Month Year Picker Modal */}
                <Modal visible={showMonthPicker} transparent animationType="fade">
                    <Pressable style={styles.modalOverlay} onPress={() => setShowMonthPicker(false)}>
                        <Pressable style={styles.pickerModalCard}>
                            <Text style={styles.modalName}>Select Month & Year</Text>
                            <View style={styles.pickerContainer}>
                                {/* Year Picker */}
                                <FlatList
                                    data={YEARS}
                                    keyExtractor={(item) => item.toString()}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={[styles.pickerItem, pickerDate.getFullYear() === item && styles.pickerItemSelected]}
                                            onPress={() => setPickerDate(new Date(item, pickerDate.getMonth(), 1))}
                                        >
                                            <Text style={[styles.pickerItemText, pickerDate.getFullYear() === item && styles.pickerItemTextSelected]}>{item}</Text>
                                        </TouchableOpacity>
                                    )}
                                    showsVerticalScrollIndicator={false}
                                    style={styles.pickerList}
                                    initialScrollIndex={YEARS.indexOf(pickerDate.getFullYear())}
                                    getItemLayout={(data, index) => ({ length: 45, offset: 45 * index, index })}
                                />
                                {/* Month Picker */}
                                <FlatList
                                    data={MONTHS}
                                    keyExtractor={(item) => item}
                                    renderItem={({ item, index }) => (
                                        <TouchableOpacity
                                            style={[styles.pickerItem, pickerDate.getMonth() === index && styles.pickerItemSelected]}
                                            onPress={() => setPickerDate(new Date(pickerDate.getFullYear(), index, 1))}
                                        >
                                            <Text style={[styles.pickerItemText, pickerDate.getMonth() === index && styles.pickerItemTextSelected]}>{item}</Text>
                                        </TouchableOpacity>
                                    )}
                                    showsVerticalScrollIndicator={false}
                                    style={styles.pickerList}
                                    initialScrollIndex={pickerDate.getMonth()}
                                    getItemLayout={(data, index) => ({ length: 45, offset: 45 * index, index })}
                                />
                            </View>
                            <View style={styles.pickerActions}>
                                <Pressable style={[styles.modalBtn, { flex: 1, marginRight: 8, backgroundColor: '#e2e8f0' }]} onPress={() => setShowMonthPicker(false)}>
                                    <Text style={[styles.modalBtnText, { color: '#111' }]}>Cancel</Text>
                                </Pressable>
                                <Pressable style={[styles.modalBtn, { flex: 1, marginLeft: 8, backgroundColor: '#2563eb' }]} onPress={handleConfirmMonthYear}>
                                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>Confirm</Text>
                                </Pressable>
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>

            </View>
            <Toast />
        </SafeAreaView>
    );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#f8fafc' },
    container: { flex: 1, paddingHorizontal: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingTop: 16 },
    greet: { fontSize: 18, color: '#333' },
    name: { fontWeight: '700', color: '#111' },
    profileIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
    profileInitial: { color: '#fff', fontWeight: '700', fontSize: 16 },
    calendarWrap: { marginTop: 6, marginBottom: 10, paddingBottom: 10 },
    calendarHeader: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    datePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#eef2ff',
    },
    datePickerIcon: {
        fontSize: 16,
        fontWeight: '700',
        color: '#374151',
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    dayPill: { width: 70, alignItems: 'center', marginHorizontal: 5, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
    dayPillSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    dayPillToday: { borderColor: '#22c55e', borderWidth: 2 },
    dayName: { fontSize: 12, color: '#475569', marginBottom: 4 },
    dayNameActive: { color: '#fff', fontWeight: '600' },
    dayNumWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    dayNumWrapActive: { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
    dayNum: { fontSize: 14, color: '#334155', fontWeight: '500' },
    dayNumActive: { color: '#fff', fontWeight: '700' },
    section: { marginTop: 8, flex: 1, marginBottom: 16 },
    tableHeader: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    headerCell: { fontWeight: '700', color: '#0f172a' },
    tableRow: { flexDirection: 'row', paddingVertical: 12, alignItems: 'center' },
    cell: { paddingHorizontal: 6 },
    cellTime: { fontWeight: '700', color: '#0f172a' },
    cellSub: { fontSize: 12, color: '#64748b', marginTop: 4 },
    cellTitle: { fontSize: 15, fontWeight: '600' },
    separator: { height: 1, backgroundColor: '#f1f5f9' },
    statusPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
    statusText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    statusTaken: { backgroundColor: '#10b981' },
    statusMissed: { backgroundColor: '#ef4444' },
    statusPending: { backgroundColor: '#f59e0b' },
    countdownWrap: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12, paddingBottom: 8 },
    countdownTitle: { fontWeight: '700', marginBottom: 8 },
    nextMedCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    nextMedName: { fontWeight: '700' },
    nextMedTime: { color: '#64748b', marginTop: 4 },
    countdownText: { fontWeight: '700', marginBottom: 8, fontSize: 16 },
    takeBtn: { backgroundColor: '#2563eb', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
    takeBtnText: { color: '#fff', fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
    modalName: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
    modalBtn: { padding: 12, borderRadius: 10, backgroundColor: '#eef2ff', marginBottom: 8, alignItems: 'center' },
    modalBtnText: { color: '#2563eb', fontWeight: '700' },
    modalClose: { marginTop: 8, alignItems: 'center' },
    previewImage: { width: '100%', height: 200, marginBottom: 12, borderRadius: 12, backgroundColor: '#f1f5f9' },
    stockRow: { flexDirection: 'row', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 6 },
    stockRowRed: { backgroundColor: '#fee2e2' },
    stockRowYellow: { backgroundColor: '#fef3c7' },
    stockRowGreen: { backgroundColor: '#dcfce7' },
    emptyText: { textAlign: 'center', marginTop: 20, color: '#64748b' },
    // NEW styles for the picker modal
    pickerModalCard: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 12,
        width: '90%',
        maxWidth: 400,
        alignSelf: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    pickerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        height: 220,
        marginVertical: 16,
    },
    pickerList: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        marginHorizontal: 5,
    },
    pickerItem: {
        paddingVertical: 12,
        alignItems: 'center',
        height: 45,
    },
    pickerItemSelected: {
        backgroundColor: '#dbeafe',
        borderRadius: 6,
    },
    pickerItemText: {
        color: '#334155',
        fontSize: 16,
    },
    pickerItemTextSelected: {
        color: '#1e40af',
        fontWeight: '700',
    },
    pickerActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    profileIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2563eb',
        alignItems: 'center',
        justifyContent: 'center',
        // Add overflow hidden to clip the image to the border radius
        overflow: 'hidden',
    },
    // New style for the Image component
    profileImage: {
        width: '100%',
        height: '100%',
    },
    profileInitial: { color: '#fff', fontWeight: '700', fontSize: 16 },
});