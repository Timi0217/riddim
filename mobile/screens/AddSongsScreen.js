import React, { useState, useRef } from "react";
import { SafeAreaView, View, Text, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator, StyleSheet, ScrollView } from "react-native";
import axios from "axios";
import { Audio } from "expo-av";
import { Ionicons } from '@expo/vector-icons';

// Debounce utility
function debounce(func, delay) {
  let timeout;
  return (...args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

export default function AddSongsScreen({ navigation }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [playingId, setPlayingId] = useState(null);
  const soundRef = useRef(null);

  const debouncedSearch = useRef(debounce((q) => {
    searchTracks(q);
  }, 400)).current;

  const searchTracks = async (q) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://192.168.0.242:8000/search?q=${encodeURIComponent(q)}`);
      setResults(res.data.results || []);
    } catch (e) {
      setResults([]);
    }
    setLoading(false);
  };

  const handlePlayPreview = async (item) => {
    if (playingId === item.id) {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setPlayingId(null);
      return;
    }
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    if (item.preview_url) {
      // Force audio output to speaker
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      console.log('Attempting to play audio from URL:', item.preview_url);
      try {
        const { sound } = await Audio.Sound.createAsync({ uri: item.preview_url });
        soundRef.current = sound;
        setPlayingId(item.id);
        await sound.playAsync();
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            setPlayingId(null);
            sound.unloadAsync();
          }
        });
      } catch (audioErr) {
        console.log('Audio playback error:', audioErr);
        alert('Audio playback failed: ' + (audioErr.message || audioErr));
      }
    }
  };

  const handleSelect = (item) => {
    if (selected.some((t) => t.id === item.id)) {
      setSelected(selected.filter((t) => t.id !== item.id));
    } else if (selected.length < 2) {
      setSelected([...selected, item]);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Back Button */}
      <TouchableOpacity
        style={{ position: 'absolute', top: 40, left: 20, zIndex: 10 }}
        onPress={() => navigation.navigate('Home')}
      >
        <Ionicons name="chevron-back" size={32} color="#eab308" />
      </TouchableOpacity>
      <View style={styles.container}>
        <Text style={styles.header}>Add Songs</Text>
        {/* Selected Songs Bar */}
        {selected.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.selectedBar}
            contentContainerStyle={[styles.selectedBarContent]}
          >
            {selected.map((item) => (
              <View key={item.id} style={styles.selectedSong}>
                {item.artwork && (
                  <Image source={{ uri: item.artwork }} style={styles.selectedArtwork} />
                )}
                <Text style={styles.selectedTitle} numberOfLines={1}>{item.title}</Text>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => setSelected(selected.filter((t) => t.id !== item.id))}
                >
                  <Ionicons name="close" size={16} color="#000" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
        <TextInput
          style={styles.input}
          placeholder="Search songs, artists"
          value={query}
          onChangeText={text => {
            setQuery(text);
            debouncedSearch(text);
          }}
          returnKeyType="search"
          placeholderTextColor="#888"
        />
        {loading && <ActivityIndicator size="large" color="#eab308" style={{ marginTop: 16 }} />}
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isChecked = selected.some((t) => t.id === item.id);
            return (
              <TouchableOpacity
                style={[styles.songRow, isChecked && styles.songRowSelected]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.85}
              >
                {item.artwork && (
                  <Image source={{ uri: item.artwork }} style={styles.artwork} />
                )}
                <View style={styles.songInfo}>
                  <Text style={styles.songTitle}>{item.title}</Text>
                  <Text style={styles.songArtist}>{item.artist}</Text>
                </View>
                {item.preview_url && (
                  <TouchableOpacity
                    style={styles.previewButton}
                    onPress={() => handlePlayPreview(item)}
                  >
                    <Ionicons name={playingId === item.id ? "pause" : "play"} size={18} color="#000" />
                  </TouchableOpacity>
                )}
                <View style={[styles.checkbox, isChecked ? styles.checkboxChecked : styles.checkboxUnchecked]}>
                  {isChecked && <Ionicons name="checkmark" size={16} color="#000" style={{ alignSelf: 'center', marginTop: 2 }} />}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={!loading && (
            <Text style={styles.emptyText}>No results found.</Text>
          )}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
        />
        <View style={styles.bottomArea}>
          <View style={styles.pageIndicatorContainer}>
            <View style={[styles.pageDot, styles.pageDotActive]} />
            <View style={styles.pageDot} />
            <View style={styles.pageDot} />
          </View>
          <TouchableOpacity
            style={[styles.nextButton, selected.length !== 2 && styles.nextButtonDisabled]}
            disabled={selected.length !== 2}
            onPress={() => navigation.navigate("YourMix", { tracks: selected })}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 18,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginBottom: 18,
    fontSize: 17,
    color: '#000',
    backgroundColor: '#fafafa',
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    padding: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  songRowSelected: {
    backgroundColor: '#fffbe6',
    borderColor: '#eab308',
  },
  artwork: {
    width: 54,
    height: 54,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#eee',
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#000',
  },
  songArtist: {
    color: '#374151',
    fontSize: 14,
    marginTop: 2,
  },
  previewButton: {
    backgroundColor: '#eab308',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#eab308',
    borderColor: '#eab308',
  },
  checkboxUnchecked: {
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 32,
    fontSize: 16,
  },
  bottomArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: 24,
    backgroundColor: 'transparent',
  },
  nextButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 32,
    marginTop: 12,
    width: '90%',
    alignSelf: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButtonText: {
    color: '#eab308',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 18,
  },
  pageIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d4d4d4',
    marginHorizontal: 3,
  },
  pageDotActive: {
    backgroundColor: '#eab308',
  },
  selectedBar: {
    flexDirection: 'row',
    marginBottom: 10,
    minHeight: 64,
    maxHeight: 72,
    alignSelf: 'center',
    width: '100%',
  },
  selectedBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  selectedSong: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbe6',
    borderColor: '#eab308',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 6,
    minWidth: 170,
    maxWidth: 260,
    height: 52,
  },
  selectedArtwork: {
    width: 38,
    height: 38,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#eee',
  },
  selectedTitle: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    fontWeight: 'bold',
    marginRight: 8,
  },
  removeButton: {
    marginLeft: 2,
    padding: 2,
    borderRadius: 10,
    backgroundColor: '#eab308',
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 