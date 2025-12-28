import React, { useEffect, useState } from 'react';
import { ZoneItem } from '../types/playlist';
import TimeDateWidget from './widgets/TimeDateWidget';
import AnalogClockWidget from './widgets/AnalogClockWidget';
import CountDownWidget from './widgets/CountDownWidget';
import QRCodeWidget from './widgets/QRCodeWidget';
import YoutubeWidget from './widgets/YoutubeWidget';

interface ZonePlayerProps {
  items: ZoneItem[];
  zoneWidth: number;
  zoneHeight: number;
}

const getFullUrl = (url: string) => {
  if (url.startsWith('http')) return url;
  return `http://localhost:5000${url}`;
};

const ZonePlayer: React.FC<ZonePlayerProps> = ({ items, zoneWidth, zoneHeight }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (items.length === 0) return;

    const currentItem = items[currentIndex];
    // Default to 5 seconds if duration is missing or 0
    const duration = (currentItem.duration || 5) * 1000;

    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, duration);

    return () => clearTimeout(timer);
  }, [currentIndex, items]);

  if (items.length === 0) {
    return <div className="w-full h-full bg-black flex items-center justify-center text-white/20">Empty Zone</div>;
  }

  const currentItem = items[currentIndex];

  if (currentItem?.media) {
    return (
      <div className="w-full h-full bg-black relative overflow-hidden">
        {currentItem.media.type === 'IMAGE' ? (
          <img
            src={getFullUrl(currentItem.media.url)}
            alt={currentItem.media.originalName}
            className="w-full h-full object-fill"
            style={{ 
              imageRendering: 'auto',
              backfaceVisibility: 'hidden',
              transform: 'translateZ(0)'
            }}
          />
        ) : (
          <video
            src={getFullUrl(currentItem.media.url)}
            className="w-full h-full object-fill"
            autoPlay
            muted
            loop={false}
          />
        )}
      </div>
    );
  }

  if (currentItem?.widget) {
    const adjustedConfig = {
      ...currentItem.widget.config,
      aspectRatioWidth: zoneWidth,
      aspectRatioHeight: zoneHeight
    };
    if (currentItem.widget.type === 'TIME_DATE') {
      return <TimeDateWidget config={adjustedConfig} className="w-full h-full" />;
    } else if (currentItem.widget.type === 'ANALOG_CLOCK') {
      return <AnalogClockWidget config={adjustedConfig} className="w-full h-full" />;
    } else if (currentItem.widget.type === 'COUNT_DOWN') {
      return <CountDownWidget config={adjustedConfig} className="w-full h-full" />;
    } else if (currentItem.widget.type === 'QR_CODE') {
      return <QRCodeWidget config={adjustedConfig} className="w-full h-full" />;
    } else if (currentItem.widget.type === 'YOUTUBE') {
      return <YoutubeWidget config={adjustedConfig} className="w-full h-full" />;
    } else {
      return <div className="w-full h-full flex items-center justify-center text-gray-400">Preview Unavailable</div>;
    }
  }

  return <div className="w-full h-full bg-black flex items-center justify-center text-white/20">Empty Zone</div>;
};

export default ZonePlayer;
