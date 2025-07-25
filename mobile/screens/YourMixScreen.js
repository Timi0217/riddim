import React, { useState, useRef, useEffect } from "react";
import { SafeAreaView, View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, ScrollView, Modal, Switch } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { Audio } from "expo-av";
import Slider from '@react-native-community/slider';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';

export default function YourMixScreen({ route, navigation }) {
  const { tracks, splitResults } = route.params;
  
  // If we don't have splitResults, we need to process the tracks first
  const [localSplitResults, setLocalSplitResults] = useState(splitResults || []);
  const [processingTracks, setProcessingTracks] = useState(!splitResults);
  
  // Stems available for selection
  const STEMS = [
    { key: 'vocals', label: 'Vocals', icon: 'mic' },
    { key: 'bass', label: 'Bass', icon: 'musical-notes' },
    { key: 'drums', label: 'Drums', icon: 'musical-notes' },
    { key: 'other', label: 'Melody', icon: 'musical-note' },
  ];

  // Multi-select stems per song
  const [selectedStems, setSelectedStems] = useState([
    ['vocals'], // default for song 1
    ['vocals'], // default for song 2
  ]);

  // Time selection state
  const [snippetSelections, setSnippetSelections] = useState([
    { start: 0, length: 60 }, // default for song 1
    { start: 0, length: 60 }, // default for song 2
  ]);

  // Duration presets

  // UI State
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [activeSongIndex, setActiveSongIndex] = useState(0);
  const [loadingIdx, setLoadingIdx] = useState([false, false]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [individualPlaying, setIndividualPlaying] = useState([false, false]);
  const [volumes, setVolumes] = useState([0.7, 0.7]);
  const [analysis, setAnalysis] = useState(null);
  
  // Advanced Settings State
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [bpmMatching, setBpmMatching] = useState(false);
  const [analyzingBpm, setAnalyzingBpm] = useState(false);
  const [bpmTargetTrack, setBpmTargetTrack] = useState(0); // 0 for track 1, 1 for track 2

  // Sound refs
  const soundRefs = [useRef(null), useRef(null)];
  const individualSoundRefs = [useRef(null), useRef(null)];
  // 1. Replace previewSoundRef with previewSoundRefs
  const previewSoundRefs = [useRef(null), useRef(null)];

  // Track all sounds for each track (for volume control)
  const [allSounds, setAllSounds] = useState([[], []]);

  // Add state for delays and crossfade
  const [delays, setDelays] = useState([0, 5]);
  const [crossfadeDuration, setCrossfadeDuration] = useState(3);
  const [crossfadeStyle, setCrossfadeStyle] = useState('linear');

  // Update state if coming back from EditMixScreen
  useEffect(() => {
    console.log('=== ROUTE PARAMS UPDATE ===');
    console.log('route.params:', route.params);
    console.log('updatedDelays:', route.params?.updatedDelays);
    
    if (route.params?.updatedDelays) {
      console.log('Setting delays to:', route.params.updatedDelays);
      setDelays(route.params.updatedDelays);
    }
    if (route.params?.updatedCrossfadeDuration !== undefined) {
      console.log('Setting crossfade duration to:', route.params.updatedCrossfadeDuration);
      setCrossfadeDuration(route.params.updatedCrossfadeDuration);
    }
    if (route.params?.updatedCrossfadeStyle) {
      console.log('Setting crossfade style to:', route.params.updatedCrossfadeStyle);
      setCrossfadeStyle(route.params.updatedCrossfadeStyle);
    }
    console.log('==========================');
  }, [route.params]);

  // Helper functions
  const getStemUrl = (songIdx, stem) => localSplitResults[songIdx]?.[`${stem}_url`];

  const getLocalPath = (url) => {
    if (!url) return null;
    return url.startsWith('/file/') ? url.replace('/file/', '') : null;
  };

  const getSelectedStemUrls = (songIdx) => {
    if (!localSplitResults[songIdx]) {
      return [];
    }
    
    const urls = selectedStems[songIdx]
      .map((stem) => {
        const url = localSplitResults[songIdx]?.[`${stem}_url`];
        return url;
      })
      .filter((url) => {
        const isValid = url && typeof url === 'string' && url.trim() !== '';
        return isValid;
      });
    return urls;
  };

  const getTimeWindow = (songIdx) => {
    const snippet = snippetSelections[songIdx];
    return {
      start: snippet.start,
      end: snippet.start + snippet.length,
      trackId: tracks[songIdx].id
    };
  };

  // Time selection functions
  const setSnippet = (songIdx, newSnippet) => {
    setSnippetSelections(prev => {
      const next = [...prev];
      next[songIdx] = newSnippet;
      return next;
    });
  };

  const formatMillis = (ms) => {
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // Advanced Settings Functions
  const analyzeBpm = async () => {
    if (!localSplitResults[0] || !localSplitResults[1]) {
      alert('Please process tracks first before analyzing BPM');
      return;
    }

    setAnalyzingBpm(true);
    try {
      const results = [];
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const splitResult = localSplitResults[i];
        if (splitResult && splitResult.full_song_url) {
          console.log(`Analyzing BPM for track ${i}: ${track.title}`);
          const response = await axios.post(API_ENDPOINTS.analyzeAudio, null, {
            params: {
              audio_url: splitResult.full_song_url
            }
          });
          console.log(`BPM analysis for ${track.title}:`, response.data);
          results.push({
            trackId: track.id,
            title: track.title,
            bpm: response.data.tempo,
            key: response.data.key,
            energy: response.data.energy
          });
        }
      }
      setAnalysis(results);
      console.log('BPM analysis completed:', results);
      // Auto-adjust tempo if BPM matching is enabled
      if (bpmMatching && results.length === 2) {
        const bpm1 = results[0].bpm;
        const bpm2 = results[1].bpm;
        const targetBpm = bpmTargetTrack === 0 ? bpm1 : bpm2; // Use selected track's BPM as target
        const tempo1 = targetBpm / bpm1;
        const tempo2 = targetBpm / bpm2;
        console.log(`BPM matching to Track ${bpmTargetTrack + 1} (${targetBpm} BPM)`);
        console.log(`Tempo adjustments: Track 1: ${tempo1}x, Track 2: ${tempo2}x`);
        setTempoAdjustments([tempo1, tempo2]);
      } else if (!bpmMatching) {
        setTempoAdjustments([1.0, 1.0]);
      }
    } catch (error) {
      console.error('Error analyzing BPM:', error);
      alert('Failed to analyze BPM. Please try again.');
    } finally {
      setAnalyzingBpm(false);
    }
  };

  // Tempo adjustments for each track
  const [tempoAdjustments, setTempoAdjustments] = useState([1.0, 1.0]);

  // Handle BPM matching toggle
  const handleBpmMatchingToggle = () => {
    const newBpmMatching = !bpmMatching;
    console.log(`BPM matching toggle: ${bpmMatching} -> ${newBpmMatching}`);
    setBpmMatching(newBpmMatching);
    
    if (newBpmMatching && analysis && analysis.length === 2) {
      // Re-apply BPM matching if we have analysis data
      const bpm1 = analysis[0].bpm;
      const bpm2 = analysis[1].bpm;
      const targetBpm = bpmTargetTrack === 0 ? bpm1 : bpm2; // Use selected track's BPM
      
      const tempo1 = targetBpm / bpm1;
      const tempo2 = targetBpm / bpm2;
      
      console.log(`Re-applying BPM matching to Track ${bpmTargetTrack + 1} (${targetBpm} BPM)`);
      console.log(`Track 1 (${bpm1} BPM) -> ${tempo1.toFixed(2)}x, Track 2 (${bpm2} BPM) -> ${tempo2.toFixed(2)}x`);
      setTempoAdjustments([tempo1, tempo2]);
    } else if (!newBpmMatching) {
      // Reset tempo adjustments when disabled
      console.log('BPM matching disabled, resetting tempo adjustments');
      setTempoAdjustments([1.0, 1.0]);
    }
  };

  // Handle BPM target track change
  const handleBpmTargetChange = (trackIndex) => {
    setBpmTargetTrack(trackIndex);
    
    // Recalculate tempo adjustments if BPM matching is enabled and we have analysis data
    if (bpmMatching && analysis && analysis.length === 2) {
      const bpm1 = analysis[0].bpm;
      const bpm2 = analysis[1].bpm;
      const targetBpm = trackIndex === 0 ? bpm1 : bpm2;
      
      const tempo1 = targetBpm / bpm1;
      const tempo2 = targetBpm / bpm2;
      
      console.log(`BPM target changed to Track ${trackIndex + 1} (${targetBpm} BPM)`);
      console.log(`New tempo adjustments: Track 1: ${tempo1.toFixed(2)}x, Track 2: ${tempo2.toFixed(2)}x`);
      setTempoAdjustments([tempo1, tempo2]);
    }
  };

  // Process tracks if needed
  React.useEffect(() => {
    const processTracks = async () => {
      if (!splitResults && tracks) {
        setProcessingTracks(true);
        try {
          const results = [];
          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            
            const response = await axios.post(API_ENDPOINTS.splitSnippets, {
              songs: [{
                id: track.id,
                start: 0,
                end: track.duration || 180
              }]
            });
            
            if (response.data.results && response.data.results.length > 0) {
              const result = response.data.results[0];
              results.push(result);
            } else {
              results.push(null);
            }
          }
          
          setLocalSplitResults(results);
          setProcessingTracks(false);
    } catch (error) {
          setProcessingTracks(false);
          
          // Show more helpful error message
          let errorMessage = 'Failed to process tracks. Please try again.';
          if (error.response && error.response.status === 404) {
            if (error.response.data && error.response.data.message) {
              errorMessage = error.response.data.message;
            } else {
              errorMessage = 'One or more tracks are not available for mixing. Only tracks that have been processed and added to the database can be used.';
            }
          }
          alert(errorMessage);
        }
      }
    };

    processTracks();
  }, [splitResults, tracks]);

  // Dual Handle Slider Component
  const DualHandleSlider = ({ songIdx }) => {
    const snippet = snippetSelections[songIdx];
    const duration = tracks[songIdx].duration || 180; // Default 3 minutes
    const totalSec = duration;
    const [localStart, setLocalStart] = useState(snippet.start / totalSec);
    const [localEnd, setLocalEnd] = useState((snippet.start + snippet.length) / totalSec);
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const [containerWidth, setContainerWidth] = useState(300);
    
    const handleStartChange = (value) => {
      const newStart = Math.max(0, Math.min(value, 1 - (localEnd - localStart)));
      setLocalStart(newStart);
    };

    const handleStartComplete = () => {
      updateSnippetSelection(localStart * totalSec, (localEnd - localStart) * totalSec);
    };

    const handleQuickStartAdjust = (adjustment) => {
      const adjustmentRatio = adjustment / totalSec;
      const newStart = Math.max(0, Math.min(localStart + adjustmentRatio, 1 - (localEnd - localStart)));
      setLocalStart(newStart);
      updateSnippetSelection(newStart * totalSec, (localEnd - localStart) * totalSec);
    };

    const handleDurationSelect = (durationSeconds) => {
      const durationRatio = durationSeconds / totalSec;
      const maxPossibleDuration = Math.min(durationRatio, 1 - localStart);
      const newEnd = localStart + maxPossibleDuration;
      setLocalEnd(newEnd);
      updateSnippetSelection(localStart * totalSec, maxPossibleDuration * totalSec);
    };

    const updateSnippetSelection = (startSec, durationSec) => {
      setSnippet(songIdx, { start: startSec, length: durationSec });
    };

    const formatTime = (seconds) => {
      const mins = Math.floor(Math.abs(seconds) / 60);
      const secs = Math.abs(seconds) % 60;
      return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
    };

    const handlePreviewPlay = async () => {
      if (isPreviewPlaying) {
        // Stop preview for THIS specific song
        if (previewSoundRefs[songIdx].current) {
          await previewSoundRefs[songIdx].current.stopAsync();
          await previewSoundRefs[songIdx].current.unloadAsync();
          previewSoundRefs[songIdx].current = null;
        }
        setIsPreviewPlaying(false);
        return;
      }

      try {
        // Stop any existing preview for THIS song
        if (previewSoundRefs[songIdx].current) {
          await previewSoundRefs[songIdx].current.stopAsync();
          await previewSoundRefs[songIdx].current.unloadAsync();
        }

        // Get the full song URL
        const fullSongUrl = localSplitResults[songIdx]?.full_song_url;
        if (!fullSongUrl) {
          alert('Please process tracks first before previewing');
          return;
        }

        // Create sound for preview
        const { sound } = await Audio.Sound.createAsync({ uri: fullSongUrl });
        previewSoundRefs[songIdx].current = sound;

        // Set position to start of selected range
        const startPosition = localStart * totalSec * 1000;
        await sound.setPositionAsync(startPosition);

        // Set up completion handler
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            setIsPreviewPlaying(false);
            previewSoundRefs[songIdx].current = null;
          }
        });

        setIsPreviewPlaying(true);
        await sound.playAsync();

        // Stop after the selected duration
        const previewDuration = (localEnd - localStart) * totalSec * 1000;
        setTimeout(async () => {
          if (previewSoundRefs[songIdx].current) {
            await previewSoundRefs[songIdx].current.stopAsync();
            await previewSoundRefs[songIdx].current.unloadAsync();
            previewSoundRefs[songIdx].current = null;
            setIsPreviewPlaying(false);
          }
        }, previewDuration);
      
    } catch (error) {
        console.error('Error playing preview:', error);
        alert('Failed to play preview. Please try again.');
        setIsPreviewPlaying(false);
      }
    };

    return (
      <View style={styles.dualSliderContainer}>
        <View style={styles.timeLabelsContainer}>
          <Text style={styles.timeLabel}>0:00</Text>
          <Text style={styles.currentTimeLabel}>
            {formatMillis(localStart * totalSec * 1000)} - {formatMillis(localEnd * totalSec * 1000)}
          </Text>
          <Text style={styles.timeLabel}>{formatMillis(duration * 1000)}</Text>
        </View>

        {/* Start Time Selection */}
        <View style={styles.timeSliderCard}>
          <Text style={styles.timeSliderLabel}>Start Time</Text>
          <Text style={styles.timeSliderValue}>{formatTime(localStart * totalSec)}</Text>
          <View style={styles.sliderWrapper}>
            <Text style={styles.sliderMin}>0s</Text>
            <Slider
              style={styles.timeSlider}
              minimumValue={0}
              maximumValue={1}
              step={0.001}
              value={localStart}
              onValueChange={handleStartChange}
              onSlidingComplete={handleStartComplete}
              minimumTrackTintColor="#eab308"
              maximumTrackTintColor="#d1d5db"
              thumbTintColor="#eab308"
            />
            <Text style={styles.sliderMax}>{formatTime(totalSec)}</Text>
          </View>
          
          {/* Quick Start Time Buttons */}
          <View style={styles.quickButtonContainer}>
            <Text style={styles.quickButtonLabel}>Quick Adjustments:</Text>
            <View style={styles.quickRow}>
              {[2, 5, 10, 15].map(adjustment => (
                <TouchableOpacity 
                  key={adjustment} 
                  style={styles.quickButton} 
                  onPress={() => handleQuickStartAdjust(adjustment)}
                >
                  <Text style={styles.quickButtonText}>+{adjustment}s</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Duration Selection */}
        <View style={styles.timeSliderCard}>
          <Text style={styles.timeSliderLabel}>Duration</Text>
          <Text style={styles.timeSliderValue}>{formatTime((localEnd - localStart) * totalSec)}</Text>
          
          {/* Duration Preset Buttons */}
          <View style={styles.durationButtonContainer}>
            <Text style={styles.quickButtonLabel}>Select Duration:</Text>
            <View style={styles.durationButtonRow}>
              {[15, 30, 60].map(duration => {
                const currentDuration = (localEnd - localStart) * totalSec;
                const isActive = Math.abs(currentDuration - duration) < 2; // Increased tolerance for 60s
                
                return (
                  <TouchableOpacity 
                    key={duration} 
                    style={[
                      styles.durationButton,
                      isActive && styles.durationButtonActive
                    ]} 
                    onPress={() => handleDurationSelect(duration)}
                  >
                    <Text style={[
                      styles.durationButtonText,
                      isActive && styles.durationButtonTextActive
                    ]}>
                      {duration}s
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Preview Play Button */}
        <TouchableOpacity
          style={[styles.previewButton, isPreviewPlaying && styles.previewButtonPlaying]}
          onPress={handlePreviewPlay}
          disabled={!localSplitResults[songIdx]?.full_song_url}
        >
          <Ionicons 
            name={isPreviewPlaying ? "pause" : "play"} 
            size={20} 
            color="#fff" 
          />
          <Text style={styles.previewButtonText}>
            {isPreviewPlaying ? 'Pause' : 'Play'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Stem selection functions
  const handleToggleStem = (songIdx, stem) => {
    setSelectedStems((prev) => {
      const next = [...prev];
      if (next[songIdx].includes(stem)) {
        next[songIdx] = next[songIdx].filter((s) => s !== stem);
      } else {
        next[songIdx] = [...next[songIdx], stem];
      }
      if (next[songIdx].length === 0) next[songIdx] = [stem];
      return next;
    });
  };

  // Playback functions
  const handlePlayIndividualStem = async (songIdx) => {
    // Stop mix if it's playing
    if (isPlaying) {
      await handlePlay();
    }
    // Stop other individual stems
    for (let i = 0; i < 2; i++) {
      if (i !== songIdx && individualPlaying[i]) {
        await stopIndividualStem(i);
      }
    }
    // If this stem is already playing, stop it
    if (individualPlaying[songIdx]) {
      await stopIndividualStem(songIdx);
      return;
    }
    setLoadingIdx((prev) => { const next = [...prev]; next[songIdx] = true; return next; });
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const urls = getSelectedStemUrls(songIdx);
      if (urls.length === 0) {
        alert('No valid stems could be loaded for playback.');
        setLoadingIdx((prev) => { const next = [...prev]; next[songIdx] = false; return next; });
        return;
      }
      const timeWindow = getTimeWindow(songIdx);
      // Create ALL sounds first
      console.log(`Creating ${urls.length} sounds for individual playback...`);
      const soundCreationPromises = urls.map(url => Audio.Sound.createAsync({ uri: url }));
      const soundResults = await Promise.all(soundCreationPromises);
      const sounds = soundResults.map(s => s.sound);
      if (sounds.length === 0) {
        alert('No valid stems could be loaded for playback.');
        setLoadingIdx((prev) => { const next = [...prev]; next[songIdx] = false; return next; });
        return;
      }
      // Configure ALL sounds before playing
      const configPromises = [
        ...sounds.map(sound => sound.setVolumeAsync(volumes[songIdx])),
        ...sounds.map(sound => sound.setPositionAsync(timeWindow.start * 1000))
      ];
      await Promise.all(configPromises);
      // Store sounds and update state
      individualSoundRefs[songIdx].current = sounds;
      setLoadingIdx((prev) => { const next = [...prev]; next[songIdx] = false; return next; });
      setIndividualPlaying((prev) => { const next = [...prev]; next[songIdx] = true; return next; });
      // Play ALL sounds simultaneously
      console.log('Starting synchronized individual playback...');
      await Promise.all(sounds.map(s => s.playAsync()));
      // Set up completion handler (only need one)
      sounds[0].setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIndividualPlaying((prev) => { const next = [...prev]; next[songIdx] = false; return next; });
          if (individualSoundRefs[songIdx].current) {
            individualSoundRefs[songIdx].current.forEach(async (snd) => {
              try {
                await snd.stopAsync();
                await snd.unloadAsync();
              } catch (e) {
                console.log('Error cleaning up individual sound:', e);
              }
            });
            individualSoundRefs[songIdx].current = null;
          }
        }
      });
    } catch (e) {
      setLoadingIdx((prev) => { const next = [...prev]; next[songIdx] = false; return next; });
      console.error('Individual stem playback failed:', e);
      alert('Audio playback failed: ' + (e.message || e));
    }
  };

  const stopIndividualStem = async (songIdx) => {
    if (individualSoundRefs[songIdx].current) {
      for (const snd of individualSoundRefs[songIdx].current) {
        await snd.stopAsync();
        await snd.unloadAsync();
      }
      individualSoundRefs[songIdx].current = null;
    }
    setIndividualPlaying((prev) => { const next = [...prev]; next[songIdx] = false; return next; });
  };

  const stopAllIndividualStems = async () => {
    for (let i = 0; i < 2; i++) {
        await stopIndividualStem(i);
      }
  };

  const handlePlay = async () => {
    // If currently playing, stop everything
    if (isPlaying) {
      console.log('Stopping mix playback...');
      setIsPlaying(false);
      // Stop all sounds in the mix
      for (let i = 0; i < 2; i++) {
        if (allSounds[i] && allSounds[i].length > 0) {
          for (const sound of allSounds[i]) {
            try {
              await sound.stopAsync();
              await sound.unloadAsync();
            } catch (e) {
              console.log('Error stopping mix sound:', e);
            }
          }
        }
        if (soundRefs[i].current) {
          try {
            await soundRefs[i].current.stopAsync();
            await soundRefs[i].current.unloadAsync();
            soundRefs[i].current = null;
          } catch (e) {
            console.log('Error stopping sound ref:', e);
          }
        }
      }
      setAllSounds([[], []]);
      return;
    }
    // Stop any individual stems first
    await stopAllIndividualStems();
    // Clean up any existing sounds
    for (let i = 0; i < 2; i++) {
      if (allSounds[i] && allSounds[i].length > 0) {
        for (const sound of allSounds[i]) {
          try {
            await sound.stopAsync();
            await sound.unloadAsync();
          } catch (e) {
            console.log('Error cleaning up existing sound:', e);
          }
        }
      }
      if (soundRefs[i].current) {
        try {
        await soundRefs[i].current.stopAsync();
        await soundRefs[i].current.unloadAsync();
        soundRefs[i].current = null;
        } catch (e) {
          console.log('Error cleaning up sound ref:', e);
        }
      }
    }
    setLoadingIdx([true, true]);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const timeWindow0 = getTimeWindow(0);
      const timeWindow1 = getTimeWindow(1);
      // Get all selected stems for each track
      const stems0 = selectedStems[0];
      const stems1 = selectedStems[1];
      // Get URLs for all selected stems
      const urls0 = stems0.map(stem => getStemUrl(0, stem)).filter(url => url);
      const urls1 = stems1.map(stem => getStemUrl(1, stem)).filter(url => url);
      if (urls0.length === 0 || urls1.length === 0) {
        throw new Error('No valid stems selected for mixing');
      }
      // Create ALL sounds first before doing anything else
      console.log('Creating sounds...');
      const allUrls = [...urls0, ...urls1];
      const soundCreationPromises = allUrls.map(url => Audio.Sound.createAsync({ uri: url }));
      const allSoundResults = await Promise.all(soundCreationPromises);
      // Separate sounds back into tracks
      const allSounds0 = allSoundResults.slice(0, urls0.length).map(s => s.sound);
      const allSounds1 = allSoundResults.slice(urls0.length).map(s => s.sound);
      console.log(`Created ${allSounds0.length} sounds for track 0, ${allSounds1.length} sounds for track 1`);
      // Store references
      soundRefs[0].current = allSounds0[0];
      soundRefs[1].current = allSounds1[0];
      setAllSounds([allSounds0, allSounds1]);
      // Configure ALL sounds before playing ANY of them
      console.log('Configuring sounds...');
      const configPromises = [
        ...allSounds0.map(sound => sound.setVolumeAsync(volumes[0])),
        ...allSounds1.map(sound => sound.setVolumeAsync(volumes[1])),
        ...allSounds0.map(sound => sound.setPositionAsync(timeWindow0.start * 1000)),
        ...allSounds1.map(sound => sound.setPositionAsync(timeWindow1.start * 1000)),
        // Apply BPM adjustments if enabled
        ...allSounds0.map(sound => applyAdvancedSettings(sound, 0)),
        ...allSounds1.map(sound => applyAdvancedSettings(sound, 1)),
      ];
      await Promise.all(configPromises);
      setLoadingIdx([false, false]);
      setIsPlaying(true);
      // Apply delays during playback
      console.log('Starting playback with delays...');
      console.log('Track 1 delay:', delays[0], 'seconds');
      console.log('Track 2 delay:', delays[1], 'seconds');
      
      const safeDelays = delays || [0, 0];
      const track1DelayMs = (safeDelays[0] || 0) * 1000;
      const track2DelayMs = (safeDelays[1] || 0) * 1000;
      
      // Start track 1 immediately or after its delay
      setTimeout(async () => {
        if (allSounds0.length > 0) {
          const track1PlayPromises = allSounds0.map(sound => sound.playAsync());
          await Promise.all(track1PlayPromises);
          console.log('Track 1 started');
        }
      }, track1DelayMs);
      
      // Start track 2 immediately or after its delay  
      setTimeout(async () => {
        if (allSounds1.length > 0) {
          const track2PlayPromises = allSounds1.map(sound => sound.playAsync());
          await Promise.all(track2PlayPromises);
          console.log('Track 2 started');
        }
      }, track2DelayMs);
      
      console.log('Playback scheduled with delays');
      // Set up completion handlers (only need one per track)
      allSounds0[0].setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            setIsPlaying(false);
          setAllSounds([[], []]);
          // Clean up all sounds
          [...allSounds0, ...allSounds1].forEach(async (s) => {
            try {
              await s.stopAsync();
              await s.unloadAsync();
            } catch (e) {
              console.log('Error in completion handler:', e);
            }
          });
          soundRefs.forEach(async (ref) => {
            if (ref.current) {
              try {
                await ref.current.stopAsync();
                await ref.current.unloadAsync();
                ref.current = null;
              } catch (e) {
                console.log('Error in completion handler:', e);
              }
            }
          });
        }
      });
    } catch (e) {
      setLoadingIdx([false, false]);
      setIsPlaying(false);
      setAllSounds([[], []]);
      console.error('Audio playback failed:', e);
      alert('Audio playback failed: ' + (e.message || e));
    }
  };

  // Debounced volume change to prevent rapid updates
  const [volumeUpdateTimeout, setVolumeUpdateTimeout] = useState(null);

  // 3. Update handleVolumeChange to set actual volume and apply immediately
  const handleVolumeChange = async (songIdx, newVolume) => {
    // Clear any pending timeout
    if (volumeUpdateTimeout) {
      clearTimeout(volumeUpdateTimeout);
    }
    
    // Update the UI immediately
    setVolumes(prev => {
      const next = [...prev];
      next[songIdx] = newVolume;
      return next;
    });
    
    // Debounce the actual volume update
    const timeout = setTimeout(async () => {
      try {
        // Update volume for mix playback - set all stems to full volume
        if (isPlaying && allSounds[songIdx] && allSounds[songIdx].length > 0) {
          await Promise.all(
            allSounds[songIdx].map(sound => sound.setVolumeAsync(newVolume))
          );
          
        }
        
        // Update volume for individual stem playback - set all stems to full volume
      if (individualPlaying[songIdx] && individualSoundRefs[songIdx].current) {
          await Promise.all(
            individualSoundRefs[songIdx].current.map(sound => sound.setVolumeAsync(newVolume))
          );
        }
      } catch (error) {
        console.error(`Error updating volume for track ${songIdx}:`, error);
      }
    }, 100); // 100ms debounce
    
    setVolumeUpdateTimeout(timeout);
  };

  // Cleanup preview audio specifically
  const cleanupPreviewAudio = async () => {
    try {
      console.log('Cleaning up preview audio...');
      for (let i = 0; i < 2; i++) {
        if (previewSoundRefs[i].current) {
          try {
            await previewSoundRefs[i].current.stopAsync();
            await previewSoundRefs[i].current.unloadAsync();
          } catch (error) {
            console.log(`Error cleaning up preview sound ${i}:`, error.message);
          }
          previewSoundRefs[i].current = null;
        }
      }
    } catch (error) {
      console.error('Error in cleanupPreviewAudio:', error);
    }
  };

  // Apply advanced settings to audio
  const applyAdvancedSettings = async (sound, songIdx) => {
    try {
      // Apply tempo adjustment (rate) from BPM matching
      const tempoMultiplier = tempoAdjustments[songIdx] || 1.0;
      if (tempoMultiplier !== 1.0) {
        console.log(`Applying BPM adjustment to track ${songIdx}: ${tempoMultiplier}x`);
        await sound.setRateAsync(tempoMultiplier, true); // true = shouldCorrectPitch
      }
      
    } catch (error) {
      console.error(`Error applying advanced settings to track ${songIdx}:`, error);
    }
  };

  // Handle download mix
  const handleDownloadMix = async () => {
    if (!localSplitResults[0] || !localSplitResults[1]) {
      alert('Please process tracks first before downloading');
      return;
    }

    try {
      const stems0 = selectedStems[0];
      const stems1 = selectedStems[1];
      const urls0 = stems0.map(stem => getStemUrl(0, stem)).filter(url => url);
      const urls1 = stems1.map(stem => getStemUrl(1, stem)).filter(url => url);
      
      if (urls0.length === 0 || urls1.length === 0) {
        alert('No valid stems selected for mixing');
        return;
      }

      console.log('Starting mix download...');
      
      // Prepare safe values
      const safeDelays = delays || [0, 0];
      const safeTrack1Delay = safeDelays[0] !== undefined ? safeDelays[0] : 0;
      const safeTrack2Delay = safeDelays[1] !== undefined ? safeDelays[1] : 0;
      const safeCrossfadeDuration = crossfadeDuration !== undefined ? crossfadeDuration : 3;
      const safeCrossfadeStyle = crossfadeStyle || 'linear';

      console.log('Mix parameters:', {
        track1_delay: safeTrack1Delay,
        track2_delay: safeTrack2Delay,
        crossfade_duration: safeCrossfadeDuration,
        crossfade_style: safeCrossfadeStyle,
        track1_stems: urls0.length,
        track2_stems: urls1.length
      });

      // Import required modules
      const FileSystem = await import('expo-file-system');
      const { shareAsync } = await import('expo-sharing');

      // Create unique filename
      const timestamp = Date.now();
      const fileName = `riddim_mix_${timestamp}.mp3`;
      const fileUri = FileSystem.documentDirectory + fileName;

      console.log('Downloading to:', fileUri);

      // Make POST request to get mix data, then write to file
      const response = await fetch(API_ENDPOINTS.createMix, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          track1_urls: urls0,
          track2_urls: urls1,
          track1_delay: safeTrack1Delay,
          track2_delay: safeTrack2Delay,
          crossfade_duration: safeCrossfadeDuration,
          crossfade_style: safeCrossfadeStyle,
        })
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      // Get the audio data as ArrayBuffer
      const audioBuffer = await response.arrayBuffer();
      console.log('Received audio buffer, size:', audioBuffer.byteLength);

      if (audioBuffer.byteLength === 0) {
        throw new Error('Received empty audio file');
      }

      // Convert ArrayBuffer to base64 string for React Native (chunk by chunk to avoid stack overflow)
      const uint8Array = new Uint8Array(audioBuffer);
      let binaryString = '';
      const chunkSize = 8192; // Process in chunks to avoid stack overflow
      
      console.log('Converting to base64 in chunks...');
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, chunk);
      }
      
      const base64Audio = btoa(binaryString);
      console.log('Base64 conversion completed, length:', base64Audio.length);
      
      // Write base64 data to file
      await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });


      // Check if file was created
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      console.log('File info:', fileInfo);

      if (!fileInfo.exists || fileInfo.size === 0) {
        throw new Error('Downloaded file appears to be empty or corrupted');
      }

      console.log(`File successfully downloaded: ${fileInfo.size} bytes`);

      // Share the file
      const shareResult = await shareAsync(fileUri, {
        mimeType: 'audio/mpeg',
        dialogTitle: 'Save Your Riddim Mix',
        UTI: 'public.audio'
      });

      console.log('Share result:', shareResult);
      alert('🎵 Mix downloaded successfully!');

    } catch (error) {
      console.error('Download error:', error);
      
      // More specific error messages
      let errorMessage = 'Failed to download mix';
      if (error.message.includes('Network')) {
        errorMessage = 'Network error - check your connection';
      } else if (error.message.includes('404') || error.message.includes('500')) {
        errorMessage = 'Server error - please try again';
      } else if (error.message.includes('empty')) {
        errorMessage = 'No audio data received - check your stems';
      } else {
        errorMessage = `Download failed: ${error.message}`;
      }
      
      alert(errorMessage);
    }
  };

  // Cleanup function for all audio
  const cleanupAllAudio = async () => {
    // Stop mix playback
    if (isPlaying) {
      setIsPlaying(false);
      for (let i = 0; i < 2; i++) {
        if (allSounds[i] && allSounds[i].length > 0) {
          for (const sound of allSounds[i]) {
            try {
              await sound.stopAsync();
              await sound.unloadAsync();
            } catch (e) {
              console.log('Error cleaning up mix sound:', e);
            }
          }
        }
        if (soundRefs[i].current) {
          try {
            await soundRefs[i].current.stopAsync();
            await soundRefs[i].current.unloadAsync();
            soundRefs[i].current = null;
          } catch (e) {
            console.log('Error cleaning up sound ref:', e);
          }
        }
      }
      setAllSounds([[], []]);
    }

    // Stop individual stem playback
    for (let i = 0; i < 2; i++) {
      if (individualPlaying[i]) {
      await stopIndividualStem(i);
    }
    }

    // Stop any preview audio for both songs
    for (let i = 0; i < 2; i++) {
      if (previewSoundRefs[i]?.current) {
        try {
          await previewSoundRefs[i].current.stopAsync();
          await previewSoundRefs[i].current.unloadAsync();
          previewSoundRefs[i].current = null;
        } catch (e) {
          console.log('Error cleaning up preview sound:', e);
        }
      }
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      cleanupAllAudio();
    };
  }, []);

  // Stop audio when navigating away
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Prevent default behavior
      e.preventDefault();
      
      // Clean up audio
      cleanupAllAudio();
      
      // Then navigate away
      navigation.dispatch(e.data.action);
    });

    return unsubscribe;
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={async () => {
              await cleanupAllAudio();
              navigation.goBack();
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.header}>Create Your Mix</Text>
        </View>

        {/* Advanced Settings Dropdown */}
        <View style={styles.advancedSettingsContainer}>
          <TouchableOpacity 
            style={styles.advancedSettingsHeader}
            onPress={() => setShowAdvancedSettings(!showAdvancedSettings)}
          >
            <View style={styles.advancedSettingsTitleRow}>
              <Ionicons name="settings" size={20} color="#000" />
              <Text style={styles.advancedSettingsTitle}>Advanced Settings</Text>
            </View>
                <Ionicons 
              name={showAdvancedSettings ? "chevron-up" : "chevron-down"} 
                  size={20} 
              color="#666" 
            />
          </TouchableOpacity>

          {showAdvancedSettings && (
            <View style={styles.advancedSettingsContent}>
              {/* BPM Analysis Section */}
              <View style={styles.advancedSection}>
                <View style={styles.advancedSectionHeader}>
                  <Text style={styles.advancedSectionTitle}>BPM Analysis</Text>
                  <TouchableOpacity
                    style={[styles.analyzeButton, analyzingBpm && styles.analyzeButtonDisabled]}
                    onPress={analyzeBpm}
                    disabled={analyzingBpm}
                  >
                    {analyzingBpm ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.analyzeButtonText}>Analyze</Text>
                    )}
                  </TouchableOpacity>
          </View>
                
                {analysis && (
                  <View style={styles.bpmResults}>
                    {analysis.map((result, idx) => (
                      <View key={result.trackId} style={styles.bpmResult}>
                        <Text style={styles.bpmTrackTitle}>{result.title}</Text>
                        <Text style={styles.bpmInfo}>
                          BPM: {result.bpm.toFixed(1)} | Key: {result.key.toFixed(1)} | Energy: {(result.energy * 100).toFixed(0)}%
                        </Text>
                      </View>
            ))}
          </View>
                )}

                {/* BPM Target Selection */}
                {analysis && analysis.length === 2 && (
                  <View style={styles.bpmTargetSelection}>
                    <Text style={styles.sectionLabel}>Match BPM to:</Text>
                    {analysis.map((result, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.radioOption}
                        onPress={() => handleBpmTargetChange(idx)}
                      >
                        <View style={styles.radioButton}>
                          <View style={[
                            styles.radioCircle,
                            bpmTargetTrack === idx && styles.radioCircleSelected
                          ]} />
                        </View>
                        <Text style={styles.radioText}>
                          {result.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
          
              {/* BPM Matching Toggle */}
              <View style={styles.advancedSection}>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Auto BPM Matching</Text>
                  <Switch
                    value={bpmMatching}
                    onValueChange={() => {
                      if (!analysis || analysis.length < 2) return;
                      setBpmMatching((prev) => {
                        const newBpmMatching = !prev;
                        if (newBpmMatching) {
                          // Apply BPM matching
                          const bpm1 = analysis[0].bpm;
                          const bpm2 = analysis[1].bpm;
                          const targetBpm = Math.max(bpm1, bpm2);
                          setTempoAdjustments([targetBpm / bpm1, targetBpm / bpm2]);
                        } else {
                          setTempoAdjustments([1.0, 1.0]);
                        }
                        return newBpmMatching;
                      });
                    }}
                    disabled={!analysis || analysis.length < 2}
                    trackColor={{ false: '#e5e7eb', true: '#eab308' }}
                    thumbColor={bpmMatching ? '#fffbe6' : '#fff'}
              />
            </View>
              </View>
            </View>
          )}
            </View>

        {/* Processing State */}
        {processingTracks && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#eab308" />
            <Text style={styles.processingText}>Processing tracks for stem separation...</Text>
            <Text style={styles.processingSubtext}>This may take a few moments</Text>
              </View>
        )}

        {/* Song Cards */}
        {!processingTracks && tracks.map((track, songIdx) => (
          <View key={track.id} style={styles.songCard}>
            {/* Song Header */}
            <View style={styles.songHeader}>
              <Image source={{ uri: track.artwork }} style={styles.songArtwork} />
              <View style={styles.songInfo}>
                <Text style={styles.songTitle}>{track.title}</Text>
                <Text style={styles.songArtist}>{track.artist}</Text>
                <Text style={styles.songDuration}>Duration: {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}</Text>
              </View>
            </View>

            {/* Stem Selection */}
            <View style={styles.stemSection}>
              <Text style={styles.sectionTitle}>Select Stems</Text>
              <View style={styles.stemButtons}>
                {STEMS.filter(stem => localSplitResults[songIdx]?.[`${stem.key}_url`]).map((stem) => (
                  <TouchableOpacity
                    key={stem.key}
                    style={[
                      styles.stemButton,
                      selectedStems[songIdx].includes(stem.key) && styles.stemButtonActive,
                      processingTracks && styles.stemButtonDisabled
                    ]}
                    onPress={() => handleToggleStem(songIdx, stem.key)}
                    disabled={processingTracks}
                  >
                <Ionicons 
                      name={stem.icon} 
                  size={20} 
                      color={selectedStems[songIdx].includes(stem.key) ? "#000" : "#666"} 
                    />
                    <Text style={[
                      styles.stemButtonText,
                      selectedStems[songIdx].includes(stem.key) && styles.stemButtonTextActive
                    ]}>
                      {stem.label}
                </Text>
                  </TouchableOpacity>
            ))}
          </View>
            </View>

            {/* Time Selection */}
            <View style={styles.timeSection}>
              <View style={styles.timeHeader}>
                <Text style={styles.sectionTitle}>Time Selection</Text>
            <TouchableOpacity
                  style={[styles.timeButton, processingTracks && styles.timeButtonDisabled]}
                  onPress={() => {
                    setActiveSongIndex(songIdx);
                    setShowTimeModal(true);
                  }}
                  disabled={processingTracks}
                >
                  <Text style={styles.timeButtonText}>
                    {formatMillis(snippetSelections[songIdx].start * 1000)} - {formatMillis((snippetSelections[songIdx].start + snippetSelections[songIdx].length) * 1000)}
              </Text>
                  <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>
          </View>

            </View>

            {/* Playback Controls */}
            <View style={styles.playbackSection}>
                  <TouchableOpacity
                style={[
                  styles.playButton,
                  individualPlaying[songIdx] && styles.playButtonActive
                ]}
                onPress={() => handlePlayIndividualStem(songIdx)}
                disabled={loadingIdx[songIdx] || processingTracks}
              >
                {loadingIdx[songIdx] ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                      <Ionicons 
                      name={individualPlaying[songIdx] ? "pause" : "play"} 
                      size={20} 
                        color="#fff" 
                      />
                    <Text style={styles.playButtonText}>
                      {individualPlaying[songIdx] ? "Pause" : "Play"}
                    </Text>
                  </>
                )}
                  </TouchableOpacity>
                  
              {/* Volume Control */}
              <View style={styles.volumeSection}>
                <Text style={styles.volumeLabel}>Volume</Text>
                    <Slider
                  style={styles.volumeSlider}
                      minimumValue={0}
                      maximumValue={1}
                  value={volumes[songIdx]}
                  onValueChange={(value) => handleVolumeChange(songIdx, value)}
                      minimumTrackTintColor="#eab308"
                      maximumTrackTintColor="#d1d5db"
                  thumbTintColor="#eab308"
                    />
                <Text style={styles.volumeValue}>{Math.round(volumes[songIdx] * 100)}%</Text>
                  </View>
                </View>
            </View>
        ))}

                {/* Mix Controls */}
        {!processingTracks && (
          <View style={styles.mixSection}>
          <TouchableOpacity
              style={[styles.mixButton, isPlaying && styles.mixButtonActive]}
            onPress={handlePlay}
              disabled={loadingIdx[0] || loadingIdx[1] || processingTracks}
            >
              {loadingIdx[0] || loadingIdx[1] ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons 
                    name={isPlaying ? "pause" : "play"} 
                    size={24} 
                    color="#000" 
                  />
                  <Text style={styles.mixButtonText}>
                    {isPlaying ? "Pause Mix" : "Play Mix"}
                  </Text>
                </>
              )}
          </TouchableOpacity>

          {/* NEW: Edit Mix Button */}
          <TouchableOpacity
            style={styles.editMixButton}
            onPress={() => navigation.navigate('EditMix', {
              selectedStems,
              snippetSelections,
              delays,
              crossfadeDuration,
              crossfadeStyle,
              tracks,
            })}
          >
            <Text style={styles.editMixButtonText}>Edit Mix</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadMix}>
          <Text style={styles.downloadButtonText}>Download Mix</Text>
          </TouchableOpacity>
        </View>
        )}
      </ScrollView>

      {/* Time Selection Modal */}
      <Modal
        visible={showTimeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={async () => {
          await cleanupPreviewAudio();
          setShowTimeModal(false);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={async () => {
                await cleanupPreviewAudio();
                setShowTimeModal(false);
              }}
            >
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              Time Selection - {tracks[activeSongIndex].title}
            </Text>
          </View>
          
          <View style={styles.modalContent}>
            <DualHandleSlider songIdx={activeSongIndex} />
          </View>
        </SafeAreaView>
      </Modal>
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
    padding: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  
  // Song Card Styles
  songCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  songHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  songArtwork: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 16,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  songDuration: {
    fontSize: 12,
    color: '#999',
  },
  
  // Section Styles
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  
  // Stem Selection Styles
  stemSection: {
    marginBottom: 20,
  },
  stemButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stemButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  stemButtonActive: {
    backgroundColor: '#eab308',
    borderColor: '#eab308',
  },
  stemButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    marginTop: 4,
  },
  stemButtonTextActive: {
    color: '#000',
  },
  stemButtonDisabled: {
    opacity: 0.5,
  },
  
  // Time Selection Styles
  timeSection: {
    marginBottom: 20,
  },
  timeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  timeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginRight: 8,
  },
  timeButtonDisabled: {
    opacity: 0.5,
  },
  
  // Playback Styles
  playbackSection: {
    marginBottom: 16,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  playButtonActive: {
    backgroundColor: '#ef4444',
  },
  playButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  volumeSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  volumeLabel: {
    fontSize: 14,
    color: '#666',
    width: 60,
  },
  volumeSlider: {
    flex: 1,
    marginHorizontal: 12,
  },
  volumeValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    width: 40,
    textAlign: 'right',
  },
  
  // Mix Section Styles
  mixSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  mixButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eab308',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 12,
    minWidth: 200,
  },
  mixButtonActive: {
    backgroundColor: '#f59e0b',
  },
  mixButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginLeft: 8,
  },
  editMixButton: {
    backgroundColor: '#000',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 200,
    marginBottom: 12,
  },
  editMixButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#eab308',
    textAlign: 'center',
  },
  downloadButton: {
    backgroundColor: '#000',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 200,
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#eab308',
    textAlign: 'center',
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalCloseButton: {
    padding: 8,
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  
  // Processing State Styles
  processingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    marginVertical: 20,
  },
  processingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    textAlign: 'center',
  },
  processingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  
  // Dual Slider Styles
  dualSliderContainer: {
    marginVertical: 16,
  },
  timeLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  timeLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  currentTimeLabel: {
    fontSize: 14,
    color: '#eab308',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  singleSliderContainer: {
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  sliderTrack: {
    height: 40,
    backgroundColor: '#e5e7eb',
    borderRadius: 16,
    position: 'relative',
    marginBottom: 8,
    justifyContent: 'center',
  },
  sliderBackground: {
    position: 'absolute',
    top: 6,
    left: 16,
    right: 16,
    bottom: 6,
    backgroundColor: '#d1d5db',
    borderRadius: 14,
  },
  selectedRange: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    backgroundColor: '#eab308',
    borderRadius: 14,
    zIndex: 1,
  },
  slider: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    left: 0,
    right: 0,
    height: 48,
    zIndex: 2,
  },
  startSlider: {
    left: 0,
    zIndex: 3,
  },
  endSlider: {
    right: 0,
    zIndex: 3,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  previewButtonPlaying: {
    backgroundColor: '#ef4444',
  },
  previewButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },

  // Advanced Settings Styles
  advancedSettingsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  advancedSettingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  advancedSettingsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  advancedSettingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  advancedSettingsContent: {
    paddingTop: 12,
  },
  advancedSection: {
    marginBottom: 20,
  },
  advancedSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  advancedSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  analyzeButton: {
    backgroundColor: '#eab308',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  analyzeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  analyzeButtonDisabled: {
    opacity: 0.5,
  },
  bpmResults: {
    marginTop: 8,
  },
  bpmResult: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bpmTrackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  bpmInfo: {
    fontSize: 12,
    color: '#666',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 14,
    color: '#666',
    width: 120,
  },
  toggleButton: {
    width: 40,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButtonDisabled: {
    opacity: 0.5,
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#eab308',
  },
  toggleThumbActive: {
    backgroundColor: '#eab308',
  },
  advancedSlider: {
    height: 32,
    marginTop: 8,
  },
  bpmTargetSelection: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  radioButton: {
    marginRight: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: 'transparent',
  },
  radioCircleSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f6',
  },
  radioText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  timeSliderCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  timeSliderLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  timeSliderValue: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  sliderWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  timeSlider: {
    flex: 1,
    height: 40,
  },
  sliderMin: {
    fontSize: 12,
    color: '#6b7280',
    marginRight: 10,
  },
  sliderMax: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 10,
  },
  quickButtonContainer: {
    marginTop: 12,
  },
  quickButtonLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickButton: {
    backgroundColor: '#eab308',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  durationButtonContainer: {
    marginTop: 12,
  },
  durationButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  durationButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#d1d5db',
    minWidth: 70,
  },
  durationButtonActive: {
    backgroundColor: '#eab308',
    borderColor: '#eab308',
  },
  durationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  durationButtonTextActive: {
    color: '#000',
  },
}); 