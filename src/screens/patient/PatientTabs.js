import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
// import { Ionicons } from '@expo/vector-icons';
import Icon from 'react-native-vector-icons/FontAwesome';

import PatientHome from '../../screens/patient/PatientHome';
import ScheduleScreen from '../../screens/patient/ScheduleScreen';
import ReportsScreen from '../../screens/patient/ReportsScreen';
import NotificationsScreen from '../../screens/patient/NotificationsScreen';


const Tab = createBottomTabNavigator();

export default function PatientTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let icon = 'home';
          if (route.name === 'PatientHome') icon = 'home';
          if (route.name === 'ScheduleScreen') icon = 'calendar';
          if (route.name === 'ReportsScreen') icon = 'file-text';
          if (route.name === 'NotificationsScreen') icon = 'bell';
          return <Icon name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="PatientHome" component={PatientHome} />
      <Tab.Screen name="ScheduleScreen" component={ScheduleScreen} />
      <Tab.Screen name="ReportsScreen" component={ReportsScreen} initialParams={{ reports: dummyReports }} />
      <Tab.Screen name="NotificationsScreen" component={NotificationsScreen} />
    </Tab.Navigator>
  );
}
