// DoctorTabs.js
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Icon from "react-native-vector-icons/Feather";

import DoctorHome from "../../screens/doctor/DoctorHome";
import DoctorVerifyScreen from "../../screens/doctor/DoctorVerifyScreen";
import DoctorAddPatientScreen from "../../screens/doctor/DoctorAddPatientScreen";

const Tab = createBottomTabNavigator();

export default function DoctorTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let icon = "home";
          if (route.name === "DoctorHome") icon = "home";
          if (route.name === "DoctorVerifyScreen") icon = "check-circle";
          if (route.name === "DoctorAddPatientScreen") icon = "user-plus";
          return <Icon name={icon} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "gray",
      })}
    >
      <Tab.Screen
        name="DoctorHome"
        component={DoctorHome}
        options={{ title: "Home" }}
      />
      <Tab.Screen
        name="DoctorVerifyScreen"
        component={DoctorVerifyScreen}
        options={{ title: "Verify" }}
      />
      <Tab.Screen
        name="DoctorAddPatientScreen"
        component={DoctorAddPatientScreen}
        options={{ title: "Add Patient" }}
      />
    </Tab.Navigator>
  );
}
