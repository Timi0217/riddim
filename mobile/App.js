import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import AddSongsScreen from './screens/AddSongsScreen';
import YourMixScreen from './screens/YourMixScreen';
import PhoneLoginScreen from './screens/PhoneLoginScreen';
import EditMixScreen from './screens/EditMixScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home" 
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="AddSongs" component={AddSongsScreen} />
        <Stack.Screen name="YourMix" component={YourMixScreen} />
        <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="EditMix" component={EditMixScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
 