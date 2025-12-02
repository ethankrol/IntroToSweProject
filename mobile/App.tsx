import * as React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "./src/screens/LoginScreen";
import EventsScreen from "./src/screens/EventsScreen";
import EventDetailScreen from "./src/screens/EventDetailScreen";
import EditEventScreen from "./src/screens/EditEventScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ResetPasswordScreen from "./src/screens/ResetPasswordScreen";
import LocationPickerScreen from "./src/screens/LocationPickerScreen";
import SetPasswordScreen from './src/screens/SetPasswordScreen';
import PasswordResetConfirmationScreen from "./src/screens/PasswordResetConfirmationScreen";

type Role = "admin" | "volunteer";

export type RootStackParamList = {
  Login: undefined;
  HomeScreen: undefined;
  Events:
    | {
        role?: Role;
      }
    | undefined;

  EventDetail:
    | {
        event: any;
        role?: Role;
      }
    | undefined;

  EditEvent:
    | {
        event?: any;
        pickedLocation?: {
          lat: number;
          lng: number;
          address: string;
        };
      }
    | undefined;

  LocationPicker:
    | {
        lat?: number;
        lng?: number;
        address?: string;
      }
    | undefined;

  ResetPassword: undefined;
  SetPasswordScreen: { token: string } | undefined;
  PasswordResetConfirmationScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        {/* LOGIN */}
        <Stack.Screen name="Login" options={{ headerShown: false }}>
          {({ navigation }) => (
            <LoginScreen
              onValidLogin={() => navigation.replace("HomeScreen")}
              //onValidLogin={() => navigation.replace("Events")}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="HomeScreen" component = {HomeScreen} />
        <Stack.Screen name="Events" component={EventsScreen} options={{ title: 'Events' }} />
        <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event Details' }} />
        <Stack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{ title: "Reset Password" }}
        />

        {/* EDIT / CREATE EVENT */}
        <Stack.Screen
          name="EditEvent"
          component={EditEventScreen}
          options={{ title: "Edit Event" }}
        />
        {/* LOCATION PICKER WITH MAP */}
        <Stack.Screen
          name="LocationPicker"
          component={LocationPickerScreen}
          options={{ title: "Choose Location" }}
        />
        <Stack.Screen
          name="SetPasswordScreen"
          component={SetPasswordScreen}
          options={{ title: "Set New Password" }}
        />
        <Stack.Screen
          name="PasswordResetConfirmationScreen"
          component={PasswordResetConfirmationScreen}
          options={{ title: "Password Reset Confirmation" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
