import { describe, it, expect } from 'vitest';
import { getVideoInfo } from '../lib/videoUtils';

describe('getVideoInfo', () => {
  it('should identify YouTube videos', () => {
    const urls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/50vL76V7S-c',
    ];
    urls.forEach(url => {
      const info = getVideoInfo(url);
      expect(info?.platform).toBe('youtube');
      expect(info?.id).toBeDefined();
      expect(info?.embedUrl).toContain('youtube.com/embed/');
    });
  });

  it('should identify Vimeo videos', () => {
    const url = 'https://vimeo.com/123456789';
    const info = getVideoInfo(url);
    expect(info?.platform).toBe('vimeo');
    expect(info?.id).toBe('123456789');
    expect(info?.embedUrl).toContain('player.vimeo.com/video/123456789');
  });

  it('should identify direct video files', () => {
    const urls = [
      'https://example.com/video.mp4',
      'https://example.com/video.webm?token=123',
    ];
    urls.forEach(url => {
      const info = getVideoInfo(url);
      expect(info?.platform).toBe('direct');
      expect(info?.directUrl).toBe(url);
    });
  });

  it('should return null for non-video URLs', () => {
    const url = 'https://google.com';
    const info = getVideoInfo(url);
    expect(info).toBeNull();
  });
});
