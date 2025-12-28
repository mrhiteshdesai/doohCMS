import React, { useMemo } from 'react';
import { WidgetConfig } from '../../types/widget';

interface YoutubeWidgetProps {
  config: WidgetConfig;
  className?: string;
}

const YoutubeWidget: React.FC<YoutubeWidgetProps> = ({ config, className = '' }) => {
  const embedUrl = useMemo(() => {
    try {
      if (!config.youtubeUrl) return '';

      // Extract Video ID
      let videoId = '';
      const url = config.youtubeUrl;
      
      // Regular expressions for different YouTube URL formats
      const regexPatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
        /youtube\.com\/embed\/([^&\n?#]+)/,
        /youtube\.com\/v\/([^&\n?#]+)/
      ];

      for (const regex of regexPatterns) {
        const match = url.match(regex);
        if (match && match[1]) {
          videoId = match[1];
          break;
        }
      }

      if (!videoId) return '';

      // Construct Embed URL with parameters
      const params = new URLSearchParams();
      
      // Auto-play is often desired for widgets
      params.append('autoplay', '1');
      
      // Controls
      params.append('controls', config.youtubeShowControls ? '1' : '0');
      
      // Mute
      if (config.youtubeMuted) {
        params.append('mute', '1');
      }
      
      // Loop
      // Note: loop=1 also requires playlist parameter with the same video ID for single video looping
      if (config.youtubeLoop !== false) { // Default to true if undefined
        params.append('loop', '1');
        params.append('playlist', videoId);
      }
      
      // Rel=0 to not show related videos from other channels
      params.append('rel', '0');

      return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
    } catch (e) {
      console.error('Error parsing YouTube URL:', e);
      return '';
    }
  }, [config.youtubeUrl, config.youtubeShowControls, config.youtubeMuted, config.youtubeLoop]);

  if (!config.youtubeUrl) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-900 text-white p-4 ${className}`}>
        <div className="text-center">
          <p className="font-semibold">YouTube Widget</p>
          <p className="text-sm text-gray-400">Please configure a video URL</p>
        </div>
      </div>
    );
  }

  if (!embedUrl) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-100 text-gray-500 p-4 ${className}`}>
        <p>Invalid YouTube URL</p>
      </div>
    );
  }

  return (
    <div className={`w-full h-full bg-black ${className}`}>
      <iframe
        src={embedUrl}
        className="w-full h-full border-0"
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};

export default YoutubeWidget;
