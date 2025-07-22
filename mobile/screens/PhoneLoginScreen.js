import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = 'http://192.168.0.242:8000'; // Update if needed

// Configure axios with better timeout and retry settings
const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 10000, // 10 second timeout
  headers: { 'Content-Type': 'application/json' }
});

export default function PhoneLoginScreen({ navigation, route }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1: enter phone, 2: enter OTP
  const [loading, setLoading] = useState(false);

  // Use libphonenumber-js for robust E.164 formatting
  const formatPhoneNumber = (input) => {
    try {
      // Default to US if no country code
      const phoneNumber = parsePhoneNumberFromString(input, 'US');
      if (phoneNumber && phoneNumber.isValid()) {
        return phoneNumber.number; // E.164
      }
    } catch (e) {
      // Fallback to manual logic below
    }
    // Fallback: previous logic
    let cleaned = input.replace(/\D/g, '');
    if (cleaned.startsWith('00')) {
      cleaned = cleaned.slice(2);
    }
    if (input.trim().startsWith('+')) {
      return input.trim();
    }
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    if (!input.startsWith('+') && cleaned.length > 10) {
      return `+${cleaned}`;
    }
    return `+${cleaned}`;
  };

  const sendOtp = async () => {
    setLoading(true);
    try {
      const formattedPhone = formatPhoneNumber(phone);
      console.log('Sending phone_number:', formattedPhone);
      const res = await api.post('/auth/send-otp', { phone_number: formattedPhone });
      console.log('Response:', res.data);
      if (!res.data.success) throw new Error(res.data.error || 'Failed to send OTP');
      setStep(2);
      Alert.alert('Code sent', 'Check your phone for the verification code.');
    } catch (error) {
      console.error('Send OTP Error:', error);
      let errorMessage = 'Unknown error';
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Failed to send OTP', errorMessage);
    }
    setLoading(false);
  };

  const verifyOtp = async () => {
    setLoading(true);
    try {
      const formattedPhone = formatPhoneNumber(phone);
      console.log('Verifying phone_number:', formattedPhone, 'otp:', otp);
      const res = await api.post('/auth/verify-otp', { phone_number: formattedPhone, otp });
      console.log('Verify response:', res.data);
      if (res.data.success) {
        // Save user data to AsyncStorage
        const userData = { phone: formattedPhone, loggedInAt: new Date().toISOString() };
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        console.log('User data saved to AsyncStorage');
        
        if (route.params?.next) {
          navigation.replace(route.params.next);
        } else {
          navigation.goBack();
        }
      } else {
        Alert.alert('Error', res.data.error || 'Invalid code');
      }
    } catch (error) {
      console.error('Verify OTP Error:', error);
      let errorMessage = 'Unknown error';
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    }
    setLoading(false);
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: '',
      headerLeft: () => (
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Home');
            }
          }}
          style={{ marginLeft: 16 }}
        >
          <Ionicons name="arrow-back" size={28} color="#eab308" />
        </Pressable>
      ),
    });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Back Button */}
      <TouchableOpacity
        style={{ position: 'absolute', top: 40, left: 20, zIndex: 10 }}
        onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Home');
          }
        }}
      >
        <Ionicons name="chevron-back" size={32} color="#eab308" />
      </TouchableOpacity>
      <View style={styles.container}>
        <Text style={styles.title}>{step === 1 ? 'Sign in with phone number' : 'Enter verification code'}</Text>
        {step === 1 ? (
          <>
            <View style={{ height: 12 }} />
            <TextInput
              style={styles.input}
              placeholder="Enter phone number"
              placeholderTextColor="#aaa"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoFocus={true}
              editable={true}
              onFocus={() => {}}
              accessible={true}
              accessibilityLabel="Phone number input"
              onKeyPress={({ nativeEvent }) => {
                if (Platform.OS === 'web' && nativeEvent.key === 'Enter' && phone.replace(/\D/g, '').length >= 10) {
                  sendOtp();
                }
              }}
            />
            <Pressable
              style={[styles.button, { opacity: phone.replace(/\D/g, '').length >= 10 ? 1 : 0.5 }]}
              onPress={sendOtp}
              disabled={loading || phone.replace(/\D/g, '').length < 10}
              accessibilityRole="button"
              accessibilityLabel="Submit phone number"
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Submit</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <View style={{ height: 12 }} />
            <TextInput
              style={styles.input}
              placeholder="Enter code"
              placeholderTextColor="#aaa"
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              autoFocus={true}
              editable={true}
              onFocus={() => {}}
              accessible={true}
              accessibilityLabel="OTP input"
              onKeyPress={({ nativeEvent }) => {
                if (Platform.OS === 'web' && nativeEvent.key === 'Enter' && otp.length >= 4) {
                  verifyOtp();
                }
              }}
            />
            <Pressable
              style={[styles.button, { opacity: otp.length >= 4 ? 1 : 0.5 }]}
              onPress={verifyOtp}
              disabled={loading || otp.length < 4}
              accessibilityRole="button"
              accessibilityLabel="Submit OTP"
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Submit</Text>}
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 24,
    paddingTop: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#eab308',
    marginBottom: 12,
    marginTop: 12,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    marginBottom: 16,
    backgroundColor: '#111',
    color: '#fff',
  },
  button: {
    width: '100%',
    backgroundColor: '#eab308',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 18,
  },
}); 