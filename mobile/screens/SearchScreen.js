import React, { useState, useRef } from "react";
import { View, TextInput, FlatList, Text, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import axios from "axios";
import { Audio } from "expo-av";

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const soundRef = useRef(null);

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

  return (
    <View className="flex-1 bg-white p-4">
      <TextInput
        className="border border-gray-300 rounded-full px-4 py-2 mb-4"
        placeholder="Search for tracks or artists..."
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => searchTracks(query)}
        returnKeyType="search"
      />
      {loading && <ActivityIndicator size="large" color="#facc15" className="mt-4" />}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="flex-row items-center mb-4 bg-gray-100 rounded-lg p-2">
            {item.artwork && (
              <Image source={{ uri: item.artwork }} className="w-16 h-16 rounded-lg mr-3" />
            )}
            <View className="flex-1">
              <Text className="font-bold text-lg text-black">{item.title}</Text>
              <Text className="text-gray-700">{item.artist}</Text>
              <Text className="text-gray-500 text-xs">Album: {item.album}</Text>
              <Text className="text-gray-500 text-xs">Duration: {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}</Text>
            </View>
            {item.preview_url && (
              <TouchableOpacity
                className="bg-yellow-400 px-3 py-2 rounded-full mr-2"
                onPress={() => handlePlayPreview(item)}
              >
                <Text className="text-black font-bold text-xs">
                  {playingId === item.id ? "Pause" : "Preview"}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              className="bg-black px-3 py-2 rounded-full"
              onPress={() => navigation.navigate("Mix", { track: item })}
            >
              <Text className="text-yellow-400 font-bold text-xs">Add to Mix</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={!loading && (
          <Text className="text-center text-gray-400 mt-8">No results found.</Text>
        )}
      />
    </View>
  );
} 