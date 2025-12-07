export enum AppMode {
  THUMBNAIL = 'YouTube Thumbnail',
  LOGO = 'Logo Design',
  BG_REMOVER = 'Background Remover',
  BANNER = 'Social Media Banner',
  POSTER = 'Poster Design',
  AVATAR = 'Profile Avatar',
  GENERAL = 'General Generation'
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[]; // Array of Base64 strings
  timestamp: number;
  metadata?: {
    originalPrompt?: string;
    finalPrompt?: string;
    liked?: boolean;
  };
}

export interface GenerationConfig {
  aspectRatio: '1:1' | '16:9' | '9:16' | '3:4' | '4:3';
  style?: string;
  highQuality: boolean; // Toggles between flash-image and pro-image-preview
}

export interface GeneratedImage {
  url: string;
  prompt: string;
  timestamp: number;
}