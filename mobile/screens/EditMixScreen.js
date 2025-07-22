import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  SafeAreaView,
  Modal 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

export default function EditMixScreen({ route, navigation }) {
  const { 
    selectedStems, 
    snippetSelections, 
    delays: initialDelays = [0, 5], 
    crossfadeDuration: initialCrossfade = 3, 
    crossfadeStyle: initialStyle = 'linear', 
    tracks 
  } = route.params;

  const [delays, setDelays] = useState(initialDelays);
  const [crossfadeDuration, setCrossfadeDuration] = useState(initialCrossfade);
  const [crossfadeStyle, setCrossfadeStyle] = useState(initialStyle);
  const [showStylePicker, setShowStylePicker] = useState(false);

  const quickDelayButtons = [2, 5, 10, 15];
  const crossfadePresets = [1, 3, 5, 10];
  const crossfadeStyles = [
    { value: 'linear', label: 'Linear' },
    { value: 'ease-in', label: 'Ease In' },
    { value: 'ease-out', label: 'Ease Out' },
    { value: 's-curve', label: 'S-Curve' }
  ];

  const handleDelayChange = (trackIndex, newDelay) => {
    setDelays(prev => {
      const next = [...prev];
      next[trackIndex] = Math.round(newDelay * 10) / 10; // Round to 1 decimal place
      return next;
    });
  };

  const handleQuickDelay = (trackIndex, adjustment) => {
    setDelays(prev => {
      const next = [...prev];
      next[trackIndex] = Math.round((next[trackIndex] + adjustment) * 10) / 10;
      // Clamp values between 0 and 30
      next[trackIndex] = Math.max(0, Math.min(30, next[trackIndex]));
      return next;
    });
  };

  const calculateTotalDuration = () => {
    const track1Duration = snippetSelections[0].length + Math.max(0, delays[0]) + crossfadeDuration;
    const track2Duration = snippetSelections[1].length + Math.max(0, delays[1]) + crossfadeDuration;
    return Math.max(track1Duration, track2Duration);
  };

  const generateTimelineVisualization = () => {
    const totalDuration = calculateTotalDuration();
    const segments = 20; // Number of visual segments
    const segmentDuration = totalDuration / segments;
    
    let track1Timeline = '';
    let track2Timeline = '';
    
    for (let i = 0; i < segments; i++) {
      const currentTime = i * segmentDuration;
      
      // Track 1 logic
      const track1StartTime = Math.max(0, delays[0]);
      const track1EndTime = track1StartTime + snippetSelections[0].length;
      const track1CrossfadeStart = track1EndTime;
      const track1CrossfadeEnd = track1CrossfadeStart + crossfadeDuration;
      
      if (currentTime < track1StartTime) {
        track1Timeline += '░';
      } else if (currentTime < track1CrossfadeStart) {
        track1Timeline += '█';
      } else if (currentTime < track1CrossfadeEnd) {
        track1Timeline += '▓';
      } else {
        track1Timeline += '░';
      }
      
      // Track 2 logic
      const track2StartTime = Math.max(0, delays[1]);
      const track2CrossfadeStart = track2StartTime;
      const track2CrossfadeEnd = track2CrossfadeStart + crossfadeDuration;
      const track2EndTime = track2CrossfadeEnd + snippetSelections[1].length - crossfadeDuration;
      
      if (currentTime < track2CrossfadeStart) {
        track2Timeline += '░';
      } else if (currentTime < track2CrossfadeEnd) {
        track2Timeline += '▓';
      } else if (currentTime < track2EndTime) {
        track2Timeline += '█';
      } else {
        track2Timeline += '░';
      }
    }
    
    return { track1Timeline, track2Timeline };
  };

  const handleSave = () => {
    navigation.navigate('YourMix', {
      ...route.params, // Pass through all original params
      updatedDelays: delays,
      updatedCrossfadeDuration: crossfadeDuration,
      updatedCrossfadeStyle: crossfadeStyle,
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${mins}:${secs.toFixed(1).padStart(4, '0')}`;
  };

  const { track1Timeline, track2Timeline } = generateTimelineVisualization();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.header}>Edit Mix Timing</Text>
        </View>

        {/* Track Delay Controls */}
        {tracks.map((track, trackIndex) => (
          <View key={trackIndex} style={styles.trackCard}>
            <View style={styles.trackHeader}>
              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle}>{track.title}</Text>
                <Text style={styles.trackArtist}>{track.artist}</Text>
              </View>
              <View style={styles.delayDisplay}>
                <Text style={styles.delayLabel}>Delay</Text>
                <Text style={styles.delayValue}>{formatTime(delays[trackIndex])}</Text>
              </View>
            </View>

            {/* Delay Slider */}
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>Start Time Adjustment</Text>
              <View style={styles.sliderWrapper}>
                <Text style={styles.sliderMin}>0s</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={30}
                  step={0.1}
                  value={delays[trackIndex]}
                  onValueChange={(value) => handleDelayChange(trackIndex, value)}
                  minimumTrackTintColor="#eab308"
                  maximumTrackTintColor="#d1d5db"
                  thumbTintColor="#eab308"
                />
                <Text style={styles.sliderMax}>+30s</Text>
              </View>
            </View>

            {/* Quick Delay Buttons */}
            <View style={styles.quickButtonContainer}>
              <Text style={styles.quickButtonLabel}>Quick Adjustments:</Text>
              <View style={styles.quickRow}>
                {quickDelayButtons.map(adjustment => (
                  <TouchableOpacity 
                    key={adjustment} 
                    style={styles.quickButton} 
                    onPress={() => handleQuickDelay(trackIndex, adjustment)}
                  >
                    <Text style={styles.quickButtonText}>
                      {adjustment > 0 ? `+${adjustment}s` : `${adjustment}s`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ))}

        {/* Crossfade Controls */}
        <View style={styles.crossfadeCard}>
          <View style={styles.crossfadeHeader}>
            <Ionicons name="swap-horizontal" size={24} color="#6366f1" />
            <Text style={styles.crossfadeTitle}>Crossfade</Text>
          </View>
          
          <View style={styles.crossfadeInfo}>
            <Text style={styles.crossfadeDuration}>Duration: {crossfadeDuration.toFixed(1)}s</Text>
            <Text style={styles.crossfadeStyleText}>Style: {crossfadeStyles.find(s => s.value === crossfadeStyle)?.label}</Text>
          </View>

          {/* Crossfade Duration Slider */}
          <View style={styles.sliderContainer}>
            <View style={styles.sliderWrapper}>
              <Text style={styles.sliderMin}>0s</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={15}
                step={0.1}
                value={crossfadeDuration}
                onValueChange={setCrossfadeDuration}
                minimumTrackTintColor="#6366f1"
                maximumTrackTintColor="#d1d5db"
                thumbTintColor="#6366f1"
              />
              <Text style={styles.sliderMax}>15s</Text>
            </View>
          </View>

          {/* Crossfade Preset Buttons */}
          <View style={styles.quickButtonContainer}>
            <Text style={styles.quickButtonLabel}>Presets:</Text>
            <View style={styles.quickRow}>
              {crossfadePresets.map(preset => (
                <TouchableOpacity 
                  key={preset} 
                  style={[
                    styles.crossfadePresetButton,
                    crossfadeDuration === preset && styles.crossfadePresetButtonActive
                  ]} 
                  onPress={() => setCrossfadeDuration(preset)}
                >
                  <Text style={[
                    styles.crossfadePresetText,
                    crossfadeDuration === preset && styles.crossfadePresetTextActive
                  ]}>
                    {preset}s
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Crossfade Style Selector */}
          <TouchableOpacity 
            style={styles.styleSelector}
            onPress={() => setShowStylePicker(true)}
          >
            <Text style={styles.styleSelectorLabel}>Crossfade Style</Text>
            <View style={styles.styleSelectorValue}>
              <Text style={styles.styleSelectorText}>
                {crossfadeStyles.find(s => s.value === crossfadeStyle)?.label}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Ionicons name="checkmark" size={24} color="#fff" />
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Crossfade Style Picker Modal */}
      <Modal
        visible={showStylePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStylePicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowStylePicker(false)}
            >
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Crossfade Style</Text>
          </View>
          
          <View style={styles.modalContent}>
            {crossfadeStyles.map(style => (
              <TouchableOpacity
                key={style.value}
                style={[
                  styles.styleOption,
                  crossfadeStyle === style.value && styles.styleOptionActive
                ]}
                onPress={() => {
                  setCrossfadeStyle(style.value);
                  setShowStylePicker(false);
                }}
              >
                <Text style={[
                  styles.styleOptionText,
                  crossfadeStyle === style.value && styles.styleOptionTextActive
                ]}>
                  {style.label}
                </Text>
                {crossfadeStyle === style.value && (
                  <Ionicons name="checkmark" size={20} color="#eab308" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 10, // Adjust for safe area
  },
  backButton: {
    padding: 10,
    marginRight: 10,
  },
  header: { fontSize: 22, fontWeight: 'bold', marginLeft: 10 },
  trackCard: { backgroundColor: '#f8f9fa', borderRadius: 16, padding: 16, marginBottom: 16 },
  trackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  trackArtist: { fontSize: 14, color: '#666' },
  delayDisplay: {
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  delayLabel: { fontSize: 12, color: '#666' },
  delayValue: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  sliderContainer: { marginTop: 12, marginBottom: 12 },
  sliderLabel: { fontSize: 14, color: '#666', marginBottom: 8 },
  sliderWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderMin: { fontSize: 14, color: '#666' },
  sliderMax: { fontSize: 14, color: '#666' },
  quickButtonContainer: { marginTop: 12, marginBottom: 12 },
  quickButtonLabel: { fontSize: 14, color: '#666', marginBottom: 8 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-around' },
  quickButton: {
    backgroundColor: '#eab308',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  crossfadeCard: { backgroundColor: '#f3f4f6', borderRadius: 16, padding: 16, marginBottom: 16 },
  crossfadeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  crossfadeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  crossfadeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  crossfadeDuration: { fontSize: 14, color: '#666' },
  crossfadeStyleText: { fontSize: 14, color: '#666' },
  crossfadePresetButton: {
    backgroundColor: '#eab308',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  crossfadePresetButtonActive: {
    backgroundColor: '#d1d5db',
  },
  crossfadePresetText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  crossfadePresetTextActive: { color: '#000' },
  styleSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    marginBottom: 12,
  },
  styleSelectorLabel: { fontSize: 14, color: '#666' },
  styleSelectorValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  styleSelectorText: { fontSize: 14, color: '#000', marginRight: 5 },
  styleOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  styleOptionActive: {
    backgroundColor: '#f0f9eb',
    borderRadius: 8,
  },
  styleOptionText: { fontSize: 14, color: '#000' },
  styleOptionTextActive: {
    fontWeight: 'bold',
    color: '#eab308',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    alignSelf: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalCloseButton: {
    padding: 10,
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  modalContent: {
    padding: 16,
  },
  styleOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  styleOptionActive: {
    backgroundColor: '#f0f9eb',
    borderRadius: 8,
  },
  styleOptionText: { fontSize: 14, color: '#000' },
  styleOptionTextActive: {
    fontWeight: 'bold',
    color: '#eab308',
  },
}); 