import React, { useEffect, useRef, useState } from 'react';
import { getFullUrl } from '../utils/url';
import { ZoneItem } from '../types/playlist';
import TimeDateWidget from './widgets/TimeDateWidget';
import AnalogClockWidget from './widgets/AnalogClockWidget';
import CountDownWidget from './widgets/CountDownWidget';
import QRCodeWidget from './widgets/QRCodeWidget';
import YoutubeWidget from './widgets/YoutubeWidget';
import { expandVastMacros, fetchVastFill, fireTrackingUrls } from '../lib/vast';
import api from '../services/api';

interface ZonePlayerProps {
  items: ZoneItem[];
  zoneWidth: number;
  zoneHeight: number;
  screenId?: string;
  playlistId?: string;
  reportAdImpressions?: boolean;
}

const ZonePlayer: React.FC<ZonePlayerProps> = ({
  items,
  zoneWidth,
  zoneHeight,
  screenId,
  playlistId,
  reportAdImpressions = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [isVast, setIsVast] = useState(false);
  const advanceTimer = useRef<number | null>(null);

  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;

    const run = async () => {
      const item = items[currentIndex % items.length];
      const slotMs = (item.duration || 5) * 1000;
      setIsVast(false);
      setActiveUrl(null);

      const report = async (payload: Record<string, unknown>) => {
        if (!reportAdImpressions) return;
        try {
          await api.post('/player/ad-impression', { logs: [payload] });
        } catch {
          // ignore — web preview may lack screen token
        }
      };

      const playFallback = () => {
        if (item.media?.url) {
          setActiveUrl(getFullUrl(item.media.url));
          setIsVast(false);
        }
      };

      if ((item.type === 'AD_SLOT' || item.vastUrl) && item.vastUrl) {
        const url = expandVastMacros(item.vastUrl, {
          screenId,
          width: zoneWidth,
          height: zoneHeight,
        });
        const fill = await fetchVastFill(url, item.vastTimeoutMs || 3000);
        if (cancelled) return;
        if (fill) {
          fireTrackingUrls(fill.impressionUrls);
          fireTrackingUrls(fill.tracking.start || []);
          setActiveUrl(fill.mediaUrl);
          setIsVast(true);
          await report({
            playlistId,
            playlistItemId: item.id,
            vastAdId: fill.adId,
            creativeId: fill.creativeId,
            mediaFileUrl: fill.mediaUrl,
            fallbackMediaId: item.mediaId,
            filled: true,
            completed: true,
            durationSec: item.duration || 5,
            startedAt: new Date().toISOString(),
          });
        } else {
          await report({
            playlistId,
            playlistItemId: item.id,
            fallbackMediaId: item.mediaId,
            filled: false,
            completed: false,
            durationSec: item.duration || 5,
            error: 'VAST empty or timeout',
            startedAt: new Date().toISOString(),
          });
          playFallback();
        }
      } else if (item.media?.url) {
        playFallback();
      }

      advanceTimer.current = window.setTimeout(() => {
        if (!cancelled) setCurrentIndex((prev) => (prev + 1) % items.length);
      }, slotMs);
    };

    run();
    return () => {
      cancelled = true;
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    };
  }, [currentIndex, items, zoneWidth, zoneHeight, screenId, playlistId, reportAdImpressions]);

  if (items.length === 0) {
    return <div className="w-full h-full bg-black flex items-center justify-center text-white/20">Empty Zone</div>;
  }

  const currentItem = items[currentIndex % items.length];

  if (activeUrl || currentItem?.media) {
    const url = activeUrl || (currentItem.media ? getFullUrl(currentItem.media.url) : '');
    const isImage = !isVast && currentItem.media?.type === 'IMAGE';
    return (
      <div className="w-full h-full bg-black relative overflow-hidden">
        {isImage ? (
          <img src={url} alt="" className="w-full h-full object-fill" />
        ) : (
          <video src={url} className="w-full h-full object-fill" autoPlay muted playsInline />
        )}
      </div>
    );
  }

  if (currentItem?.widget) {
    const adjustedConfig = {
      ...currentItem.widget.config,
      aspectRatioWidth: zoneWidth,
      aspectRatioHeight: zoneHeight,
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
    }
    return <div className="w-full h-full flex items-center justify-center text-gray-400">Preview Unavailable</div>;
  }

  return <div className="w-full h-full bg-black flex items-center justify-center text-white/20">Empty Zone</div>;
};

export default ZonePlayer;
