import { FrameData } from '../types';

/**
 * Extracts frames from a video file.
 * Increased target count to 120 to catch fleeting food shots.
 */
export const extractFramesFromVideo = async (
  videoFile: File,
  targetFrameCount: number = 120
): Promise<FrameData[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const frames: FrameData[] = [];
    const url = URL.createObjectURL(videoFile);

    if (!context) {
      reject(new Error("无法创建Canvas上下文"));
      return;
    }

    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    
    // Performance optimization: Scale down huge videos
    const MAX_WIDTH = 960; 

    let interval = 1; // Default interval

    const captureFrame = async () => {
      if (video.currentTime >= video.duration || frames.length >= targetFrameCount) {
        URL.revokeObjectURL(url);
        resolve(frames);
        return;
      }

      // Capture
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      
      canvas.toBlob((blob) => {
        if (blob) {
            frames.push({
                timeOffset: video.currentTime,
                base64: base64,
                blob: blob
            });
        }
        
        // Seek next
        video.currentTime += interval;
      }, 'image/jpeg', 0.6);
    };

    video.addEventListener('loadedmetadata', () => {
        const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;
        
        // Calculate interval to spread frames across the whole video
        // e.g. 120s video / 120 frames = 1s interval
        interval = Math.max(0.5, video.duration / targetFrameCount);
        
        video.currentTime = 0; // Start
    });

    video.addEventListener('seeked', () => {
      captureFrame();
    });

    video.addEventListener('error', (e) => {
      reject(new Error("视频加载失败，请检查文件格式"));
    });
  });
};

export const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};
