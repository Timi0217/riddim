import { Audio } from 'expo-av';

class AudioManager {
  constructor() {
    this.currentSound = null;
    this.currentPlayingId = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    
    this.isInitialized = true;
  }

  async stopCurrentAudio() {
    if (this.currentSound) {
      try {
        await this.currentSound.stopAsync();
        await this.currentSound.unloadAsync();
      } catch (e) {
        console.log('Error stopping current audio:', e);
      }
      this.currentSound = null;
      this.currentPlayingId = null;
    }
  }

  async playAudio(uri, playingId, options = {}) {
    // Stop any currently playing audio first
    await this.stopCurrentAudio();
    
    try {
      await this.initialize();
      
      const { sound } = await Audio.Sound.createAsync({ uri });
      this.currentSound = sound;
      this.currentPlayingId = playingId;
      
      // Apply options
      if (options.volume !== undefined) {
        await sound.setVolumeAsync(options.volume);
      }
      
      if (options.position !== undefined) {
        await sound.setPositionAsync(options.position);
      }
      
      await sound.playAsync();
      
      // Set up status update callback
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          this.currentSound = null;
          this.currentPlayingId = null;
        }
        
        if (options.onStatusUpdate) {
          options.onStatusUpdate(status);
        }
      });
      
      return sound;
    } catch (error) {
      console.log('Audio playback error:', error);
      this.currentSound = null;
      this.currentPlayingId = null;
      throw error;
    }
  }

  isPlaying(playingId) {
    return this.currentPlayingId === playingId;
  }

  getCurrentPlayingId() {
    return this.currentPlayingId;
  }

  async cleanup() {
    await this.stopCurrentAudio();
  }
}

// Export a singleton instance
export default new AudioManager(); 