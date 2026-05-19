import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
}

export const compressImage = async (
  file: File,
  options?: CompressionOptions
): Promise<File> => {
  // If it's not an image or it's a GIF (gifs lose animation if compressed this way), return original
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }

  const defaultOptions = {
    maxSizeMB: 0.5, // 500KB default max
    maxWidthOrHeight: 1080,
    useWebWorker: true,
  };

  const mergedOptions = { ...defaultOptions, ...options };

  try {
    const compressedFile = await imageCompression(file, mergedOptions);
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    // Fallback to original file if compression fails
    return file;
  }
};
