// API Configuration
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Determine if we're in development or production
const isDevelopment = __DEV__ || Constants.appOwnership === 'expo';

// API Base URLs
const DEVELOPMENT_API_URL = 'http://192.168.0.242:8000';
const PRODUCTION_API_URL = 'https://riddim-app-deploy-production.up.railway.app';

// Export the appropriate API URL
export const API_BASE_URL = isDevelopment ? DEVELOPMENT_API_URL : PRODUCTION_API_URL;

// API Endpoints
export const API_ENDPOINTS = {
  search: `${API_BASE_URL}/search`,
  analyzeAudio: `${API_BASE_URL}/analyze_audio`,
  splitSnippets: `${API_BASE_URL}/split_snippets`,
  createMix: `${API_BASE_URL}/create_mix_with_offset_and_crossfade`,
  download: `${API_BASE_URL}/download`,
  progress: `${API_BASE_URL}/progress`,
  // Twilio endpoints
  sendVerification: `${API_BASE_URL}/send-verification`,
  verifyCode: `${API_BASE_URL}/verify-code`,
};

console.log(`Using API URL: ${API_BASE_URL} (Development: ${isDevelopment})`);