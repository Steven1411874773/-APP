export interface FrameData {
  timeOffset: number;
  base64: string;
  blob: Blob;
}

export interface TimelineItem {
  timestamp: string; // "00:15"
  timeOffset: number; // Seconds
  content: string; // Description of the scene
  location: string; // Specific location or shop name
  foodItems: string[]; // List of food items visible
  bestFrameIndex: number; // Index of the frame
  highlightType: 'food' | 'scenery' | 'transport' | 'other';
}

export interface AnalysisResult {
  title: string;
  summary: string;
  timeline: TimelineItem[];
  vibe: string[]; // e.g. ["Chill", "City Walk", "Street Food"]
}

export type ProjectStatus = 'idle' | 'extracting' | 'analyzing' | 'done' | 'error';

export interface Project {
  id: string;
  customName?: string; // User defined name
  file: File;
  status: ProjectStatus;
  frames: FrameData[];
  result: AnalysisResult | null;
  error?: string;
  createdAt: number;
}
