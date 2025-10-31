import * as React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "./src/screens/LoginScreen";
import EventsScreen from "./src/screens/EventsScreen";
import EventDetailScreen from "./src/screens/EventDetailScreen";
import EditEventScreen from "./src/screens/EditEventScreen";
import ResetPasswordScreen from "./src/screens/ResetPasswordScreen";

type RootStackParamList = {
  Login: undefined;
  Events: { role?: 'admin' | 'volunteer' } | undefined;
  EventDetail: { event: any; role?: 'admin' | 'volunteer' } | undefined;
  EditEvent: undefined;
  ResetPassword: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" options={{ headerShown: false }}>
          {({ navigation }) => (
            <LoginScreen
              onValidLogin={() => navigation.replace("Events")}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Events" component={EventsScreen} options={{ title: 'Events' }} />
        <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event Details' }} />
        <Stack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{ title: "Reset Password" }}
        />
        <Stack.Screen
          name="EditEvent"
          component={EditEventScreen}
          options={{ title: "Edit Event" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
