export type VideoPlatform = 'youtube' | 'vimeo' | 'direct' | null;

export interface VideoInfo {
  platform: VideoPlatform;
  id?: string;
  embedUrl?: string;
  directUrl?: string;
}

const YOUTUBE_REGEX = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
const VIMEO_REGEX = /^(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^/\n\s]+\/)?videos\/|video\/|)(\d+)(?:$|\/|\?)/;
const DIRECT_VIDEO_REGEX = /\.(mp4|webm|ogg)(?:\?.*)?$/i;

export function getVideoInfo(url: string): VideoInfo | null {
  if (!url) return null;

  // YouTube check
  const ytMatch = url.match(YOUTUBE_REGEX);
  if (ytMatch && ytMatch[1]) {
    return {
      platform: 'youtube',
      id: ytMatch[1],
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`
    };
  }

  // Vimeo check
  const vimeoMatch = url.match(VIMEO_REGEX);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      platform: 'vimeo',
      id: vimeoMatch[1],
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`
    };
  }

  // Direct video check
  const directMatch = url.match(DIRECT_VIDEO_REGEX);
  if (directMatch) {
    return {
      platform: 'direct',
      directUrl: url
    };
  }

  return null;
}
