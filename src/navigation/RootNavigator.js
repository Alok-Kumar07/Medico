import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/LoginScreen';
import RoleGate from '../screens/RoleGate';
import DoctorTabs from '../screens/doctor/DoctorTabs';
import PatientProfile from '../screens/patient/PatientProfile';
import ReportsScreen from '../screens/patient/ReportsScreen';
import CaregiverTabs from '../screens/caretaker/CaregiverTabs';
import PatientTabs from '../screens/patient/PatientTabs';
import { useAuth } from '../hooks/useAuth';
import CaregiverProfile from '../screens/caretaker/CaregiverProfile';
import CaregiverPatienteProfile from '../screens/caretaker/CaregiverPatienteProfile';
import DoctorProfile from '../screens/doctor/DoctorProfile';
import DoctorPatientProfile from '../screens/doctor/DoctorPatientProfile';
import DoctorEditSchedule from '../screens/doctor/DoctorEditSchedule';
import DoctorAddReportScreen from '../screens/doctor/DoctorAddReportScreen';
import CaregiverReportsScreen from '../screens/caretaker/CaregiverReportsScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="RoleGate" component={RoleGate} />
            <Stack.Screen name="CaregiverTabs" component={CaregiverTabs} />
            <Stack.Screen name="PatientTabs" component={PatientTabs} />
            <Stack.Screen name="DoctorTabs" component={DoctorTabs} />
            <Stack.Screen name="PatientProfile" component={PatientProfile} />
            <Stack.Screen name="ReportsScreen" component={ReportsScreen} />
            <Stack.Screen name="DoctorProfile" component={DoctorProfile} />
            <Stack.Screen name="CaregiverProfile" component={CaregiverProfile} />
            <Stack.Screen name="CaregiverPatienteProfile" component={CaregiverPatienteProfile} />
            <Stack.Screen name="DoctorPatientProfile" component={DoctorPatientProfile} />
            <Stack.Screen name="DoctorEditSchedule" component={DoctorEditSchedule} />
            <Stack.Screen name="DoctorAddReportScreen" component={DoctorAddReportScreen} />
            <Stack.Screen name="CaregiverReportsScreen" component={CaregiverReportsScreen}/>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
