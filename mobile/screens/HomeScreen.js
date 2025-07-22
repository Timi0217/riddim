import React, { useState, useEffect } from "react";
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, StatusBar } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

export default function HomeScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user data from AsyncStorage on component mount and focus
  const loadUser = async () => {
    try {
      console.log('Loading user data from AsyncStorage...');
      const userData = await AsyncStorage.getItem('user');
      console.log('Raw user data from AsyncStorage:', userData);
      if (userData) {
        const parsedUser = JSON.parse(userData);
        console.log('Parsed user data:', parsedUser);
        setUser(parsedUser);
      } else {
        console.log('No user data found in AsyncStorage');
        setUser(null);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, []);

  // Reload user when screen comes into focus (e.g., after navigation)
  useFocusEffect(
    React.useCallback(() => {
      console.log('HomeScreen focused, reloading user data...');
      loadUser();
    }, [])
  );

  // Handle logout
  const handleLogout = async () => {
    try {
      console.log('Logging out user...');
      await AsyncStorage.removeItem('user');
      console.log('User data removed from AsyncStorage');
      setUser(null);
      console.log('User state reset to null');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Helper to check login and navigate
  const handleStartMixing = () => {
    console.log('handleStartMixing called, user state:', user);
    if (user) {
      console.log('User is logged in, navigating to AddSongs');
      navigation.navigate('AddSongs');
    } else {
      console.log('User is not logged in, navigating to PhoneLogin');
      navigation.navigate('PhoneLogin', { next: 'AddSongs' });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      {/* Header with profile icon and logout */}
      <View style={styles.header}>
        <View style={styles.profileIcon}>
          <Text style={styles.profileText}>🎵</Text>
        </View>
        {user ? (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#eab308" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.menuIcon}>
            <View style={styles.menuDot} />
            <View style={styles.menuDot} />
            <View style={styles.menuDot} />
          </View>
        )}
      </View>
      <View style={styles.container}>
        {/* Main Title */}
        <Text style={styles.mainTitle}>RIDDIM</Text>
        <Text style={styles.bigYellowText}>MIX • CREATE • VIBE</Text>
        {/* Description */}
        <Text style={styles.description}>
          Combine beats and vocals from your favorite Afrobeats songs with AI to create dope mixes
        </Text>
        {/* Ready to Mix Button with stems count */}
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStartMixing}
        >
          <View style={styles.stackIcon}>
            <View style={styles.stackLayer} />
            <View style={[styles.stackLayer, styles.stackLayer2]} />
            <View style={[styles.stackLayer, styles.stackLayer3]} />
          </View>
          <View style={styles.buttonTextContainer}>
            <Text style={styles.startButtonText}>Ready to Mix</Text>
            <Text style={styles.stemsCount}>1,000+ stems available</Text>
          </View>
        </TouchableOpacity>
        {/* Start Mixing Button */}
        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={handleStartMixing}
        >
          <Text style={styles.secondaryButtonText}>Start Mixing</Text>
        </TouchableOpacity>
      </View>
      {/* Powered by text */}
      <Text style={styles.poweredBy}>Powered by Gidi Studios</Text>
      {/* Bottom Navigation Dots removed */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  profileIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eab308',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: {
    fontSize: 24,
  },
  menuIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
    marginHorizontal: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eab308',
  },
  logoutText: {
    color: '#eab308',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  container: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 56,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: 4,
    textAlign: 'center',
  },
  bigYellowText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#eab308',
    marginBottom: 40,
    letterSpacing: 1,
  },
  description: {
    color: '#999999',
    textAlign: 'center',
    marginBottom: 60,
    lineHeight: 24,
    fontSize: 16,
    paddingHorizontal: 10,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 16,
    marginBottom: 20,
    width: '100%',
    maxWidth: 320,
  },
  stackIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    position: 'relative',
  },
  stackLayer: {
    position: 'absolute',
    width: 24,
    height: 3,
    backgroundColor: '#eab308',
    borderRadius: 2,
  },
  stackLayer2: {
    top: 6,
    width: 20,
  },
  stackLayer3: {
    top: 12,
    width: 16,
  },
  buttonTextContainer: {
    flex: 1,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  stemsCount: {
    color: '#999999',
    fontSize: 14,
    fontWeight: '400',
  },
  secondaryButton: {
    backgroundColor: '#eab308',
    paddingHorizontal: 50,
    paddingVertical: 18,
    borderRadius: 25,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 18,
  },
  poweredBy: {
    color: '#666666',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
}); 