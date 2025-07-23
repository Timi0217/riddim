import librosa
import pyrubberband as pyrb
import soundfile as sf
import numpy as np
import os
from typing import Dict, Tuple, Optional
import logging
from pydub import AudioSegment

logger = logging.getLogger(__name__)

class RiddimAudioProcessor:
    def __init__(self, sample_rate: int = 44100):
        self.sr = sample_rate
        self.temp_dir = "temp_audio"
        os.makedirs(self.temp_dir, exist_ok=True)
    
    def analyze_audio(self, audio_file: str) -> Dict:
        """Use librosa for comprehensive audio analysis"""
        try:
            logger.info(f"Analyzing audio file: {audio_file}")
            y, sr = librosa.load(audio_file, sr=self.sr)
            
            # Beat detection and tempo analysis
            tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
            
            # Key detection and tuning
            key = librosa.estimate_tuning(y=y, sr=sr)
            
            # Energy and loudness
            rms = librosa.feature.rms(y=y)[0]
            energy = np.mean(rms)
            
            # Duration
            duration = librosa.get_duration(y=y, sr=sr)
            
            analysis = {
                "tempo": float(tempo),
                "key": float(key),
                "energy": float(energy),
                "duration": float(duration),
                "beats_count": len(beats)
            }
            
            logger.info(f"Analysis complete: {analysis}")
            return analysis
            
        except Exception as e:
            logger.error(f"Audio analysis failed: {e}")
            raise
    
    def professional_process(self, audio_file: str, 
                           tempo_factor: float = 1.0,
                           pitch_semitones: float = 0.0,
                           effects: Optional[Dict] = None) -> str:
        """Use pyrubberband for professional-quality audio processing"""
        try:
            logger.info(f"Processing audio with tempo_factor={tempo_factor}, pitch_semitones={pitch_semitones}")
            
            # Load audio
            y, sr = librosa.load(audio_file, sr=self.sr)
            
            # Apply tempo stretching
            if tempo_factor != 1.0:
                y = pyrb.time_stretch(y, sr, tempo_factor)
            
            # Apply pitch shifting
            if pitch_semitones != 0.0:
                y = pyrb.pitch_shift(y, sr, pitch_semitones)
            
            # Apply effects if specified
            if effects:
                y = self._apply_effects(y, sr, effects)
            
            # Generate unique output filename
            base_name = os.path.splitext(os.path.basename(audio_file))[0]
            timestamp = str(int(np.random.random() * 1000000))
            output_path = os.path.join(self.temp_dir, f"processed_{base_name}_{timestamp}.wav")
            sf.write(output_path, y, sr)
            
            logger.info(f"Processing complete: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Audio processing failed: {e}")
            raise
    
    def _apply_effects(self, y: np.ndarray, sr: int, effects: Dict) -> np.ndarray:
        """Apply various audio effects using librosa"""
        # Reverb effect
        if effects.get("reverb"):
            reverb_amount = effects["reverb"]
            reverb_impulse = np.exp(-np.linspace(0, 5, int(sr * 0.1)))
            y = np.convolve(y, reverb_impulse, mode='same') * (1 - reverb_amount) + y * reverb_amount
        
        # Delay effect
        if effects.get("delay"):
            delay_samples = int(sr * effects["delay"])
            delay_signal = np.zeros_like(y)
            delay_signal[delay_samples:] = y[:-delay_samples] * 0.5
            y = y + delay_signal
        
        return y
    
    def beat_match_tracks(self, track1_file: str, track2_file: str) -> Tuple[str, str]:
        """Automatically match BPMs between two tracks"""
        try:
            logger.info("Beat matching tracks...")
            
            # Analyze both tracks
            analysis1 = self.analyze_audio(track1_file)
            analysis2 = self.analyze_audio(track2_file)
            
            # Calculate tempo adjustment factors
            tempo1, tempo2 = analysis1["tempo"], analysis2["tempo"]
            
            # Find the target tempo (average of both tempos for smoother mixing)
            target_tempo = (tempo1 + tempo2) / 2
            
            # Calculate adjustment factors for both tracks
            track1_factor = target_tempo / tempo1
            track2_factor = target_tempo / tempo2
            
            logger.info(f"Track 1 tempo: {tempo1} -> {target_tempo} (factor: {track1_factor})")
            logger.info(f"Track 2 tempo: {tempo2} -> {target_tempo} (factor: {track2_factor})")
            
            # Process both tracks to match target tempo
            matched_track1 = self.professional_process(track1_file, tempo_factor=track1_factor)
            matched_track2 = self.professional_process(track2_file, tempo_factor=track2_factor)
            
            return matched_track1, matched_track2
            
        except Exception as e:
            logger.error(f"Beat matching failed: {e}")
            raise
    
    def harmonic_mix_suggestions(self, track1_file: str, track2_file: str) -> Dict:
        """Analyze harmonic compatibility and suggest optimal mixing parameters"""
        try:
            logger.info("Analyzing harmonic compatibility...")
            
            # Analyze both tracks
            analysis1 = self.analyze_audio(track1_file)
            analysis2 = self.analyze_audio(track2_file)
            
            # Calculate key compatibility
            key1, key2 = analysis1["key"], analysis2["key"]
            key_diff = abs(key1 - key2)
            
            suggestions = {
                "compatible_keys": key_diff < 0.5,
                "suggested_pitch_shift": -key_diff if key1 > key2 else key_diff,
                "tempo_compatibility": abs(analysis1["tempo"] - analysis2["tempo"]) < 5,
                "energy_balance": analysis1["energy"] / analysis2["energy"] if analysis2["energy"] > 0 else 1.0
            }
            
            logger.info(f"Harmonic analysis complete: {suggestions}")
            return suggestions
            
        except Exception as e:
            logger.error(f"Harmonic analysis failed: {e}")
            raise
    
    def create_professional_mix(self, track1_file: str, track2_file: str, 
                              mix_params: Optional[Dict] = None) -> str:
        """Create a professional mix with automatic optimization"""
        try:
            logger.info("Creating professional mix...")
            
            # Get harmonic suggestions
            suggestions = self.harmonic_mix_suggestions(track1_file, track2_file)
            
            # Apply suggested optimizations
            if not suggestions["compatible_keys"] and mix_params is None:
                pitch_shift = suggestions["suggested_pitch_shift"]
                track2_file = self.professional_process(track2_file, pitch_semitones=pitch_shift)
            
            # Beat match if needed
            if not suggestions["tempo_compatibility"]:
                track1_file, track2_file = self.beat_match_tracks(track1_file, track2_file)
            
            # Load both tracks
            y1, sr1 = librosa.load(track1_file, sr=self.sr)
            y2, sr2 = librosa.load(track2_file, sr=self.sr)
            
            # Ensure same length
            min_length = min(len(y1), len(y2))
            y1 = y1[:min_length]
            y2 = y2[:min_length]
            
            # Apply volume balance if suggested
            if suggestions["energy_balance"] != 1.0:
                y2 = y2 * suggestions["energy_balance"]
            
            # Mix tracks
            mixed = y1 + y2
            
            # Normalize
            mixed = mixed / np.max(np.abs(mixed)) * 0.9
            
            # Save mixed track
            output_path = os.path.join(self.temp_dir, "professional_mix.wav")
            sf.write(output_path, mixed, self.sr)
            
            logger.info(f"Professional mix created: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Professional mixing failed: {e}")
            raise

    def create_mix_from_stems(self, track1_stems: list, track2_stems: list, 
                             mix_params: Optional[Dict] = None) -> str:
        """Create a professional mix from multiple stems with time windows and advanced parameters"""
        try:
            logger.info(f"Creating mix from {len(track1_stems)} track1 stems and {len(track2_stems)} track2 stems")
            
            # Load and combine all stems for track 1
            track1_mixed = None
            for stem_file in track1_stems:
                y, sr = librosa.load(stem_file, sr=self.sr)
                
                # Apply time window if specified
                if mix_params and "track1_time_window" in mix_params:
                    time_window = mix_params["track1_time_window"]
                    start_sample = int(time_window.get("start", 0) * sr)
                    end_sample = int(time_window.get("end", len(y) / sr) * sr)
                    y = y[start_sample:end_sample]
                
                # Apply tempo and pitch adjustments
                if mix_params:
                    if mix_params.get("tempo_factor", 1.0) != 1.0:
                        y = pyrb.time_stretch(y, sr, mix_params["tempo_factor"])
                    if mix_params.get("pitch_semitones", 0.0) != 0.0:
                        y = pyrb.pitch_shift(y, sr, mix_params["pitch_semitones"])
                
                # Combine stems
                if track1_mixed is None:
                    track1_mixed = y
                else:
                    # Ensure same length
                    min_length = min(len(track1_mixed), len(y))
                    track1_mixed = track1_mixed[:min_length] + y[:min_length]
            
            # Load and combine all stems for track 2
            track2_mixed = None
            for stem_file in track2_stems:
                y, sr = librosa.load(stem_file, sr=self.sr)
                
                # Apply time window if specified
                if mix_params and "track2_time_window" in mix_params:
                    time_window = mix_params["track2_time_window"]
                    start_sample = int(time_window.get("start", 0) * sr)
                    end_sample = int(time_window.get("end", len(y) / sr) * sr)
                    y = y[start_sample:end_sample]
                
                # Apply tempo and pitch adjustments
                if mix_params:
                    if mix_params.get("tempo_factor", 1.0) != 1.0:
                        y = pyrb.time_stretch(y, sr, mix_params["tempo_factor"])
                    if mix_params.get("pitch_semitones", 0.0) != 0.0:
                        y = pyrb.pitch_shift(y, sr, mix_params["pitch_semitones"])
                
                # Combine stems
                if track2_mixed is None:
                    track2_mixed = y
                else:
                    # Ensure same length
                    min_length = min(len(track2_mixed), len(y))
                    track2_mixed = track2_mixed[:min_length] + y[:min_length]
            
            # Ensure both tracks have the same length
            if track1_mixed is not None and track2_mixed is not None:
                min_length = min(len(track1_mixed), len(track2_mixed))
                track1_mixed = track1_mixed[:min_length]
                track2_mixed = track2_mixed[:min_length]
                
                # Mix the two tracks
                final_mix = track1_mixed + track2_mixed
                
                # Normalize to prevent clipping
                max_val = np.max(np.abs(final_mix))
                if max_val > 0:
                    final_mix = final_mix / max_val * 0.9
                
                # Save the final mix
                output_path = os.path.join(self.temp_dir, "your_mix.mp3")
                sf.write(output_path, final_mix, self.sr)
                
                logger.info(f"Mix created successfully: {output_path}")
                return output_path
            else:
                raise ValueError("No valid stems provided for mixing")
                
        except Exception as e:
            logger.error(f"Stem mixing failed: {e}")
            raise
    
    def create_mix_with_offset_and_crossfade(self, track1_urls, track2_urls, track1_delay=0, track2_delay=0, crossfade_duration=3, crossfade_style='linear'):
        # Import requests for URL downloading
        import requests
        import tempfile
        
        # 1. Load all stems for each track and mix down to stereo
        def mix_stems(stem_urls):
            stems = []
            temp_files = []
            
            try:
                for url in stem_urls:
                    if url.startswith('http'):
                        # Download URL to temporary file
                        logger.info(f"Downloading stem from URL: {url}")
                        response = requests.get(url, stream=True)
                        response.raise_for_status()
                        
                        # Create temporary file
                        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
                        for chunk in response.iter_content(chunk_size=8192):
                            temp_file.write(chunk)
                        temp_file.close()
                        temp_files.append(temp_file.name)
                        
                        # Load from temporary file
                        stem = AudioSegment.from_file(temp_file.name)
                        stems.append(stem)
                    else:
                        # Assume it's a local file path
                        stem = AudioSegment.from_file(url)
                        stems.append(stem)
                
                if not stems:
                    return None
                    
                # Mix all stems together
                mix = stems[0]
                for s in stems[1:]:
                    mix = mix.overlay(s)
                return mix
                
            finally:
                # Clean up temporary files
                for temp_file in temp_files:
                    try:
                        os.remove(temp_file)
                    except:
                        pass

        track1 = mix_stems(track1_urls)
        track2 = mix_stems(track2_urls)
        if track1 is None or track2 is None:
            raise Exception('Could not load stems for one or both tracks')

        logger.info(f"Original track lengths: track1={len(track1)}ms, track2={len(track2)}ms")
        logger.info(f"Delays: track1={track1_delay}s, track2={track2_delay}s")
        logger.info(f"Crossfade: {crossfade_duration}s, style={crossfade_style}")

        # 2. Calculate total length with delays
        track1_delay_ms = int(track1_delay * 1000)
        track2_delay_ms = int(track2_delay * 1000)
        crossfade_ms = int(crossfade_duration * 1000)
        
        # Total length of each track when positioned with delay
        track1_end_time = track1_delay_ms + len(track1)
        track2_end_time = track2_delay_ms + len(track2)
        
        # Final mix length is the latest end time
        final_length = max(track1_end_time, track2_end_time)
        
        # 3. Create positioned tracks with proper delays
        logger.info(f"Creating mix with final length: {final_length}ms")
        logger.info(f"Track1 will start at: {track1_delay_ms}ms ({track1_delay}s)")
        logger.info(f"Track2 will start at: {track2_delay_ms}ms ({track2_delay}s)")
        
        # Start with silence for the full length
        positioned_track1 = AudioSegment.silent(duration=final_length)
        positioned_track2 = AudioSegment.silent(duration=final_length)
        
        # Overlay tracks at their delayed positions
        positioned_track1 = positioned_track1.overlay(track1, position=track1_delay_ms)
        positioned_track2 = positioned_track2.overlay(track2, position=track2_delay_ms)
        
        logger.info(f"Track1 positioned: starts at {track1_delay_ms}ms, ends at {track1_delay_ms + len(track1)}ms")
        logger.info(f"Track2 positioned: starts at {track2_delay_ms}ms, ends at {track2_delay_ms + len(track2)}ms")
        
        # 4. Apply crossfade if tracks overlap
        overlap_start = max(track1_delay_ms, track2_delay_ms)
        overlap_end = min(track1_end_time, track2_end_time)
        
        if crossfade_ms > 0 and overlap_end > overlap_start:
            # Calculate crossfade region within the overlap
            overlap_duration = overlap_end - overlap_start
            actual_crossfade_ms = min(crossfade_ms, overlap_duration)
            
            if actual_crossfade_ms > 0:
                # Create crossfade in the middle of overlap region
                crossfade_start = overlap_start + (overlap_duration - actual_crossfade_ms) // 2
                crossfade_end = crossfade_start + actual_crossfade_ms
                
                logger.info(f"Crossfade region: {crossfade_start}ms to {crossfade_end}ms")
                
                # Apply crossfade style
                if crossfade_style == 'ease-in':
                    # Track1 fades out with ease-in curve, track2 comes in linearly
                    fade_curve = 'logarithmic'
                elif crossfade_style == 'ease-out': 
                    # Track1 fades out linearly, track2 comes in with ease-out curve
                    fade_curve = 'exponential'
                elif crossfade_style == 's-curve':
                    # Both tracks use smooth S-curve
                    fade_curve = 'logarithmic'
                else:  # linear
                    fade_curve = 'linear'
                
                # Extract crossfade segments
                track1_segment = positioned_track1[crossfade_start:crossfade_end]
                track2_segment = positioned_track2[crossfade_start:crossfade_end]
                
                # Apply fades to segments
                track1_faded = track1_segment.fade_out(actual_crossfade_ms)
                track2_faded = track2_segment.fade_in(actual_crossfade_ms)
                
                # Create crossfaded segment
                crossfaded_segment = track1_faded.overlay(track2_faded)
                
                # Rebuild final mix with crossfaded section
                mix = AudioSegment.silent(duration=final_length)
                
                # Add track1 before crossfade
                if crossfade_start > 0:
                    mix = mix.overlay(positioned_track1[:crossfade_start], position=0)
                
                # Add crossfaded section
                mix = mix.overlay(crossfaded_segment, position=crossfade_start)
                
                # Add track1 after crossfade (if any)
                if crossfade_end < len(positioned_track1):
                    mix = mix.overlay(positioned_track1[crossfade_end:], position=crossfade_end)
                
                # Add track2 before crossfade (if any)  
                if crossfade_start > track2_delay_ms:
                    track2_before = positioned_track2[track2_delay_ms:crossfade_start]
                    mix = mix.overlay(track2_before, position=track2_delay_ms)
                
                # Add track2 after crossfade
                if crossfade_end < len(positioned_track2):
                    mix = mix.overlay(positioned_track2[crossfade_end:], position=crossfade_end)
            else:
                # No crossfade, just overlay
                mix = positioned_track1.overlay(positioned_track2)
        else:
            # No overlap or crossfade, just overlay
            mix = positioned_track1.overlay(positioned_track2)

        # 5. Export final mix with unique filename to prevent caching
        import time
        timestamp = int(time.time() * 1000)  # millisecond timestamp
        output_filename = f'your_mix_{timestamp}.mp3'
        output_path = os.path.join(self.temp_dir, output_filename)
        mix.export(output_path, format='mp3')
        logger.info(f"Mix exported to: {output_path}")
        return output_path
    
    def cleanup_temp_files(self):
        """Clean up temporary audio files"""
        try:
            for file in os.listdir(self.temp_dir):
                file_path = os.path.join(self.temp_dir, file)
                if os.path.isfile(file_path):
                    os.remove(file_path)
            logger.info("Temporary files cleaned up")
        except Exception as e:
            logger.error(f"Cleanup failed: {e}") 