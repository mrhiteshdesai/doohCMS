import { useState, useEffect, useRef, memo, useMemo } from 'react';
import axios from 'axios';
import html2canvas from 'html2canvas';
import { useLocation } from 'react-router-dom';
import { Monitor, Cpu, HardDrive, Hash, AlertCircle, Info, Image as ImageIcon } from 'lucide-react';
import { getTenantSettings } from '../services/tenant';
import { applyTheme } from '../utils/colors';
import { playerCache } from '../lib/playerCache';
import { playerSync } from '../lib/playerSync';
import { getFullUrl } from '../utils/url';

const API_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

interface Media {
  id: string;
  mimeType: string;
  url: string;
  filename: string;
  duration: number;
}

interface PlaylistItem {
  id: string;
  order: number;
  duration: number;
  media?: Media;
  widget?: any;
}

interface Zone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  items: PlaylistItem[];
}

interface Playlist {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  zones: Zone[];
}

interface ScreenContent {
  screenId: string;
  name: string;
  orientation: string;
  config?: any;
  playlist: Playlist | null;
}

const getMediaType = (mimeType: string): 'IMAGE' | 'VIDEO' => {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  return 'IMAGE';
};

const ZonePlayer = memo(({ zone, mediaUrls, playlistId }: { zone: Zone; mediaUrls: Map<string, string>; playlistId: string }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentItem, setCurrentItem] = useState<PlaylistItem | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Memoize sortedItems to ensure stability across renders if content hasn't changed
  // We use JSON.stringify to compare content deep equality instead of reference
  const sortedItems = useMemo(() => {
    return zone.items ? [...zone.items].sort((a, b) => a.order - b.order) : [];
  }, [JSON.stringify(zone.items)]);

  useEffect(() => {
    if (sortedItems.length > 0) {
      // Reset index if out of bounds (e.g. playlist changed)
      if (currentIndex >= sortedItems.length) {
        setCurrentIndex(0);
        const newItem = sortedItems[0];
        if (newItem.id !== currentItem?.id) setCurrentItem(newItem);
      } else {
        const newItem = sortedItems[currentIndex];
        // Only update if ID changed to prevent unnecessary re-renders/effect triggers
        if (newItem.id !== currentItem?.id) {
          setCurrentItem(newItem);
        }
      }
    } else {
      setCurrentItem(null);
    }
  }, [sortedItems, currentIndex]); // sortedItems is now stable based on content

  useEffect(() => {
    if (!currentItem) return;

    // Log Start
    const startTime = Date.now();

    let timer: ReturnType<typeof setTimeout>;

    if (!currentItem.media) {
       const duration = (currentItem.duration || 10) * 1000;
       timer = setTimeout(() => {
          nextItem();
       }, duration);
       return () => { if (timer) clearTimeout(timer); };
    }

    const type = getMediaType(currentItem.media.mimeType);

    if (type === 'IMAGE') {
      const duration = (currentItem.duration || 10) * 1000;
      timer = setTimeout(() => {
        logPoP(startTime, duration / 1000);
        nextItem();
      }, duration);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [currentItem]);

  const logPoP = (startedAt: number, duration: number) => {
    if (!currentItem || !currentItem.media) {
        console.warn('[Player] logPoP skipped: No current item or media');
        return;
    }
    console.debug(`[Player] Logging PoP: ${currentItem.media.id} (${duration}s)`);
    playerCache.addLog({
      mediaId: currentItem.media.id,
      playlistId: playlistId,
      startedAt: new Date(startedAt).toISOString(),
      duration: duration
    });
  };

  const nextItem = () => {
    if (sortedItems.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % sortedItems.length);
  };

  // RETRY LOGIC for Media Loading
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const handleMediaError = (e: any) => {
      console.error(`[Player] Media error for item ${currentItem?.id} (Attempt ${retryCount + 1}/${maxRetries + 1})`, e);
      
      if (retryCount < maxRetries) {
          const backoffDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          console.log(`[Player] Retrying in ${backoffDelay}ms...`);
          setTimeout(() => {
              setRetryCount(prev => prev + 1);
              // Force re-render of media element by appending a timestamp or just relying on state update?
              // The simplest way to retry a source load is often just re-rendering the component or updating src.
              // Here, we just increment retryCount, which doesn't directly change src.
              // Ideally, we should invalidate the URL or force reload.
              // For now, simply triggering a re-render might not be enough if the browser cached the failure.
              // Let's force next item for now as a fallback if retries fail?
              // Or better:
          }, backoffDelay);
      } else {
          console.warn('[Player] Max retries reached, skipping item.');
          // Log error to backend?
           if (currentItem?.media?.id) {
               // We don't have direct access to socket here easily without context, but we can try axios
               // axios.post('/api/player/log', { ... })
           }
          setRetryCount(0);
          nextItem();
      }
  };
  // Reset retry count on item change
  useEffect(() => {
      setRetryCount(0);
  }, [currentItem]);


  if (!currentItem) {
    return <div className="w-full h-full bg-black" />;
  }

  if (!currentItem.media) {
     return (
        <div className="w-full h-full bg-black flex items-center justify-center text-white">
            {currentItem.widget ? `Widget: ${currentItem.widget.type}` : ''}
        </div>
     );
  }

  const type = getMediaType(currentItem.media.mimeType);
  // Prefer cached URL, fallback to server URL (only if online, but we should force cache usage if possible)
  // Actually fallback is good for immediate testing if cache fails
  const src = mediaUrls.get(currentItem.media.id) || getFullUrl(currentItem.media.url);

  return (
    <div className="w-full h-full relative overflow-hidden bg-black">
      {type === 'IMAGE' ? (
        <img 
          key={currentItem.id}
          src={src} 
          className="w-full h-full object-fill"
          alt="Content"
          onError={(e) => {
            console.error('Image load failed', src);
            // Force next immediately to avoid stuck screen
            setTimeout(nextItem, 100); 
          }}
        />
      ) : (
        <>
        <style>{`
            video::-webkit-media-controls { display: none !important; }
            video::-webkit-media-controls-enclosure { display: none !important; }
        `}</style>
        <video 
          key={currentItem.id}
          ref={videoRef}
          src={src} 
          className="w-full h-full object-fill pointer-events-none"
          style={{ pointerEvents: 'none' }}
          autoPlay
          muted
          playsInline
          disablePictureInPicture
          controls={false}
          crossOrigin="anonymous"
          controlsList="nodownload nofullscreen noremoteplayback"
          onEnded={() => {
            if (videoRef.current) {
                logPoP(Date.now() - (videoRef.current.duration * 1000), videoRef.current.duration);
            }
            nextItem();
          }}
          onError={(e) => {
            console.error('Video error, skipping', e);
            nextItem();
          }}
        />
        {/* Transparent Overlay to block all browser interactions and extensions */}
        <div 
            className="absolute inset-0 z-50 w-full h-full"
            style={{ background: 'transparent', pointerEvents: 'none' }} 
        />
        </>
      )}
    </div>
  );
});

const Player = () => {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'UNPAIRED' | 'PAIRED' | 'LOADING' | 'ERROR'>('LOADING');
  const [error, setError] = useState<string | null>(null);
  const [screenData, setScreenData] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  const [systemInfo, setSystemInfo] = useState<any>({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    cores: navigator.hardwareConcurrency || 'N/A',
    memory: (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB` : 'N/A'
  });

  // Branding Config Helpers
  const playerConfig = branding?.player || {};
  const bgColor = playerConfig.backgroundColor || '#f9fafb';
  const codeBlockBg = playerConfig.codeBlock?.backgroundColor || '#ffffff';
  const codeBlockBorder = playerConfig.codeBlock?.borderColor || '#f3f4f6';
  const codeBlockWidth = playerConfig.codeBlock?.borderWidth ?? 1;
  const sysInfoBg = playerConfig.systemInfo?.backgroundColor || '#ffffff';
  const sysInfoText = playerConfig.systemInfo?.textColor || '#374151';
  const rightTitle = playerConfig.rightSide?.title || 'Smart Digital Signage';
  const rightTitleColor = playerConfig.rightSide?.titleColor || '#ffffff';
  const rightSubtitle = playerConfig.rightSide?.subtitle || 'Deliver engaging content to your audience in seconds. Powering displays worldwide.';
  const rightSubtitleColor = playerConfig.rightSide?.subtitleColor || '#dbeafe';

  // Fetch branding settings
  useEffect(() => {
    const loadBranding = async () => {
        try {
            const res = await axios.get(`${API_URL}/player/branding`);
            setBranding(res.data);
            if (res.data.primaryColor) {
                applyTheme(res.data.primaryColor);
            }
        } catch (e) {
            console.error('Failed to load branding', e);
        }
    };
    loadBranding();
  }, []);

  // --- Browser Remote Settings Implementation ---
  useEffect(() => {
      const root = document.getElementById('root');
      if (!root) return;

      const settings = screenData?.config?.browserSettings || {};

      // 1. Display & Appearance
      let transform = '';
      if (settings.rotation) {
         transform += `rotate(${settings.rotation}deg) `;
         // Center origin for rotation
         root.style.transformOrigin = 'center center';
         
         // Adjust dimensions if rotated 90/270 to prevent cropping if window is landscape
         if (settings.rotation === 90 || settings.rotation === 270) {
             const aspect = window.innerWidth / window.innerHeight;
             if (aspect > 1) { // Landscape window
                // Scale down to fit? Or just let it overflow?
                // User request: "Applies a CSS transform rotate(...) on the root container."
                // We'll stick to simple transform.
             }
         }
      }
      if (settings.zoom && settings.zoom !== 100) {
         transform += `scale(${settings.zoom / 100}) `;
      }
      
      // Apply transform
      root.style.transform = transform;
      
      // Background Color
      if (settings.backgroundColor) {
          root.style.backgroundColor = settings.backgroundColor;
          document.body.style.backgroundColor = settings.backgroundColor;
      } else {
          root.style.backgroundColor = '';
          document.body.style.backgroundColor = '';
      }

      // 3. Debug Mode
      if (settings.debugMode) {
          if (!(window as any)._debugModeEnabled) {
              console.log('[Player] Debug Mode Enabled');
              (window as any)._debugModeEnabled = true;
          }
      }

      return () => {
          if (root) {
              root.style.transform = '';
              root.style.transformOrigin = '';
              root.style.backgroundColor = '';
              document.body.style.backgroundColor = '';
          }
      };
  }, [screenData?.config?.browserSettings]);

  // 2. Audio Control (Volume Observer)
  useEffect(() => {
      const settings = screenData?.config?.browserSettings;
      if (!settings || settings.volume === undefined) return;
      
      const vol = settings.volume / 100;
      
      // Initial apply
      document.querySelectorAll('video, audio').forEach((el: any) => {
          el.volume = vol;
      });

      const observer = new MutationObserver((mutations) => {
          if (!mutations) return;
          mutations.forEach((mutation) => {
              if (!mutation.addedNodes) return;
              mutation.addedNodes.forEach((node: any) => {
                  if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
                      node.volume = vol;
                  } else if (node.querySelectorAll) {
                      node.querySelectorAll('video, audio').forEach((el: any) => el.volume = vol);
                  }
              });
          });
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
  }, [screenData?.config?.browserSettings?.volume]);

  // 3. Power & Maintenance (Sleep & Reload)
  useEffect(() => {
      const settings = screenData?.config?.browserSettings;
      if (!settings) return;

      const checkMaintenance = () => {
          const now = new Date();
          
          // Sleep Schedule
          if (settings.sleepStart && settings.sleepEnd) {
             const [sH, sM] = settings.sleepStart.split(':').map(Number);
             const [eH, eM] = settings.sleepEnd.split(':').map(Number);
             const cur = now.getHours() * 60 + now.getMinutes();
             const start = sH * 60 + sM;
             const end = eH * 60 + eM;
             
             let isSleep = false;
             if (start < end) {
                 isSleep = cur >= start && cur < end;
             } else {
                 isSleep = cur >= start || cur < end; // Crosses midnight
             }
             
             let overlay = document.getElementById('sleep-overlay');
             if (isSleep) {
                 if (!overlay) {
                     console.log('[Player] Entering Sleep Mode');
                     overlay = document.createElement('div');
                     overlay.id = 'sleep-overlay';
                     overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:black;z-index:999999;cursor:none;';
                     document.body.appendChild(overlay);
                     // Pause media
                     document.querySelectorAll('video, audio').forEach((el: any) => el.pause());
                 }
             } else {
                 if (overlay) {
                     console.log('[Player] Waking up');
                     overlay.remove();
                     // Optional: Reload to ensure clean state
                     // window.location.reload();
                 }
             }
          }
          
          // Auto Reload (Daily)
          if (settings.reloadPolicy === 'DAILY' && settings.reloadTime) {
               const [rH, rM] = settings.reloadTime.split(':').map(Number);
               if (now.getHours() === rH && now.getMinutes() === rM && now.getSeconds() < 10) {
                   console.log('[Player] Daily Auto-reload...');
                   window.location.reload();
               }
          }
      };
      
      const interval = setInterval(checkMaintenance, 5000);
      return () => clearInterval(interval);
  }, [screenData?.config?.browserSettings]);

  // Auto Reload (Interval)
  useEffect(() => {
      const settings = screenData?.config?.browserSettings;
      if (settings?.reloadPolicy === 'INTERVAL' && settings?.reloadInterval) {
          const ms = settings.reloadInterval * 60 * 60 * 1000;
          console.log(`[Player] Interval reload scheduled in ${settings.reloadInterval} hours`);
          const timer = setTimeout(() => {
              console.log('[Player] Interval reload executing...');
              window.location.reload();
          }, ms);
          return () => clearTimeout(timer);
      }
  }, [screenData?.config?.browserSettings?.reloadPolicy, screenData?.config?.browserSettings?.reloadInterval]);
  // ---------------------------------------------

  
  // Content State
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const currentPlaylistRef = useRef<Playlist | null>(null);
  const screenDataRef = useRef<any>(null);
  const pairingCodeRef = useRef<string | null>(null);

  useEffect(() => {
    currentPlaylistRef.current = currentPlaylist;
  }, [currentPlaylist]);

  useEffect(() => {
    screenDataRef.current = screenData;
  }, [screenData]);

  useEffect(() => {
    pairingCodeRef.current = pairingCode;
  }, [pairingCode]);

  const [mediaUrls, setMediaUrls] = useState<Map<string, string>>(new Map());
  
  // Downloading State
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  
  const [scale, setScale] = useState(1);
  
  const pollIntervalRef = useRef<any>(null);
  const heartbeatIntervalRef = useRef<any>(null);
  const contentIntervalRef = useRef<any>(null);
  const popSyncIntervalRef = useRef<any>(null);

  // Load or Register Player
  useEffect(() => {
    const initializePlayer = async () => {
      const storedCode = localStorage.getItem('pairingCode');
      const storedToken = localStorage.getItem('screenToken');
      
      if (storedCode) {
        setPairingCode(storedCode);
        if (storedToken) {
           try {
             await axios.post(
               `${API_URL}/player/heartbeat`, 
               { }, 
               { headers: { Authorization: `Bearer ${storedToken}` } }
             );
             setStatus('PAIRED');
             handlePairedInit(storedToken);
           } catch (e) {
             checkStatus(storedCode);
           }
        } else {
          checkStatus(storedCode);
        }
      } else {
        registerDevice();
      }
    };

    initializePlayer();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (contentIntervalRef.current) clearInterval(contentIntervalRef.current);
      if (popSyncIntervalRef.current) clearInterval(popSyncIntervalRef.current);
    };
  }, []);

  // Auto-fit logic
  useEffect(() => {
    const handleResize = () => {
      if (currentPlaylist) {
        const { innerWidth, innerHeight } = window;
        const scaleX = innerWidth / currentPlaylist.canvasWidth;
        const scaleY = innerHeight / currentPlaylist.canvasHeight;
        setScale(Math.min(scaleX, scaleY));
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [currentPlaylist]);

  const registerDevice = async () => {
    try {
      const res = await axios.post(`${API_URL}/player/register`);
      const { code } = res.data;
      localStorage.setItem('pairingCode', code);
      setPairingCode(code);
      startPolling(code);
      setStatus('UNPAIRED');
    } catch (err) {
      console.error('Failed to register device', err);
      setError('Failed to connect to server. Retrying in 5s...');
      setStatus('ERROR');
      setTimeout(() => window.location.reload(), 5000);
    }
  };

  const checkStatus = async (code: string) => {
    try {
      const res = await axios.get(`${API_URL}/player/status/${code}`);
      if (res.data.status === 'PAIRED') {
        handlePaired(res.data);
      } else {
        setStatus('UNPAIRED');
        startPolling(code);
      }
    } catch (err) {
      console.error('Failed to check status', err);
    }
  };

  const startPolling = (code: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/player/status/${code}`);
        if (res.data.status === 'PAIRED') {
          handlePaired(res.data);
        }
      } catch (err) {
        console.error('Polling error', err);
      }
    }, 5000);
  };

  const handlePaired = (data: any) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setStatus('PAIRED');
    setScreenData(data.screen);
    localStorage.setItem('screenToken', data.token);
    handlePairedInit(data.token);
  };

  const handlePairedInit = (token: string) => {
    startHeartbeat(token);
    checkForUpdates(token); // Initial check
    startContentPolling(token);
    startPoPSync(token);
  };

  const resetPlayer = () => {
    localStorage.removeItem('screenToken');
    localStorage.removeItem('pairingCode');
    window.location.reload();
  };

  const downloadProgressRef = useRef<number | null>(null);
  const commandUpdatesRef = useRef<any[]>([]);
  const downloadReportsRef = useRef<any[]>([]);

  const updateCommandStatus = (id: string, status: string, message?: string) => {
      commandUpdatesRef.current.push({ id, status, message });
  };

  const handleCommand = async (cmd: any, token: string) => {
    console.log('Received command:', cmd);
    updateCommandStatus(cmd.id, 'PROCESSING', `Starting ${cmd.type}...`);

    try {
        if (cmd.type === 'SNAPSHOT') {
            await captureSnapshot(token, cmd);
        } else if (cmd.type === 'REBOOT') {
            updateCommandStatus(cmd.id, 'COMPLETED', 'Rebooting now...');
            setTimeout(() => window.location.reload(), 2000);
        } else if (cmd.type === 'RELOAD') {
            updateCommandStatus(cmd.id, 'PROCESSING', 'Checking for updates...');
            await checkForUpdates(token);
            updateCommandStatus(cmd.id, 'COMPLETED', 'Content reloaded');
        } else if (cmd.type === 'CLEAR_CACHE') {
            updateCommandStatus(cmd.id, 'PROCESSING', 'Clearing cache...');
            await playerCache.clearAll();
            updateCommandStatus(cmd.id, 'COMPLETED', 'Cache cleared. Rebooting...');
            setTimeout(() => window.location.reload(), 2000);
        } else {
             updateCommandStatus(cmd.id, 'FAILED', `Unknown command type: ${cmd.type}`);
        }
    } catch (e: any) {
        console.error(`Command ${cmd.type} error`, e);
        updateCommandStatus(cmd.id, 'FAILED', e.message || 'Execution failed');
    }
  };

  const captureSnapshot = async (token: string, cmd: any) => {
    try {
        updateCommandStatus(cmd.id, 'PROCESSING', 'Capturing screen...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Capture video frames manually before html2canvas
        const videoElements = document.querySelectorAll('video');
        const videoCaptures: ({ canvas: HTMLCanvasElement, style: string, className: string } | null)[] = [];
        
        videoElements.forEach((video) => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 1280;
                canvas.height = video.videoHeight || 720;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    videoCaptures.push({
                        canvas,
                        style: video.getAttribute('style') || '',
                        className: video.className
                    });
                } else {
                    videoCaptures.push(null);
                }
            } catch (e) {
                console.error('Failed to capture video frame', e);
                videoCaptures.push(null);
            }
        });

        const element = document.getElementById('player-container') || document.body;
        
        // Ensure scroll to top
        window.scrollTo(0, 0);

        const canvas = await html2canvas(element, {
            useCORS: true,
            allowTaint: false,
            logging: false,
            scale: 0.75, // Increased quality
            width: element.scrollWidth, // Use scrollWidth to capture full content even if overflowing
            height: element.scrollHeight,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
            backgroundColor: '#000000', // Ensure black background instead of white
            onclone: (clonedDoc: Document) => {
                // 1. Video Replacement Logic
                const clonedVideos = clonedDoc.querySelectorAll('video');
                clonedVideos.forEach((video: any, i: number) => {
                    const capture = videoCaptures[i];
                    if (capture) {
                        // Replace video with the captured canvas
                        const canvas = capture.canvas;
                        
                        // Apply styles to match original video
                        // We set width/height to 100% to fill the container like the video did
                        canvas.style.width = '100%';
                        canvas.style.height = '100%';
                        canvas.style.objectFit = 'fill'; // Simulate object-fill
                        canvas.className = capture.className;
                        
                        // We need to explicitly set the style attribute if it was inline
                        if (capture.style) {
                            canvas.setAttribute('style', capture.style);
                            // Re-apply critical sizing overrides
                            canvas.style.width = '100%';
                            canvas.style.height = '100%';
                        }

                        if (video.parentNode) {
                            video.parentNode.replaceChild(canvas, video);
                        }
                    }
                });

                // 2. Add Overlay with Details
                const overlay = clonedDoc.createElement('div');
                overlay.style.position = 'absolute';
                overlay.style.bottom = '20px';
                overlay.style.right = '20px';
                overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
                overlay.style.color = 'white';
                overlay.style.padding = '16px';
                overlay.style.borderRadius = '12px';
                overlay.style.fontFamily = 'system-ui, -apple-system, sans-serif';
                overlay.style.zIndex = '999999';
                overlay.style.display = 'flex';
                overlay.style.flexDirection = 'column';
                overlay.style.gap = '6px';
                overlay.style.backdropFilter = 'blur(4px)';
                overlay.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
                overlay.style.minWidth = '200px';

                // Data Preparation
                const currentScreenData = screenDataRef.current;
                const currentPairingCode = pairingCodeRef.current;

                const screenName = currentScreenData?.name || 'Unknown Screen';
                const screenId = currentPairingCode || 'N/A';
                // Try to find location in screenData if exists, otherwise placeholder or remove
                const location = currentScreenData?.location ? 
                    (typeof currentScreenData.location === 'string' ? currentScreenData.location : 
                    (currentScreenData.location.city ? `${currentScreenData.location.city}, ${currentScreenData.location.country || ''}` : 'Unknown Location')) 
                    : 'Unknown Location';
                const timestamp = new Date().toLocaleString();

                overlay.innerHTML = `
                    <div style="font-weight: 700; font-size: 18px; margin-bottom: 2px;">${screenName}</div>
                    <div style="font-size: 14px; opacity: 0.9;">ID: <span style="font-family: monospace;">${screenId}</span></div>
                    <div style="font-size: 14px; opacity: 0.9;">📍 ${location}</div>
                    <div style="font-size: 12px; opacity: 0.7; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px;">
                        ${timestamp}
                    </div>
                `;

                // Append to container or body
                const clonedContainer = clonedDoc.getElementById('player-container');
                if (clonedContainer) {
                    clonedContainer.style.position = 'relative'; // Ensure positioning context
                    clonedContainer.appendChild(overlay);
                } else {
                    clonedDoc.body.appendChild(overlay);
                }
            }
        } as any);
        
        canvas.toBlob(async (blob) => {
            if (!blob) {
                updateCommandStatus(cmd.id, 'FAILED', 'Failed to generate image blob');
                return;
            }
            const formData = new FormData();
            formData.append('snapshot', blob, 'snapshot.png');
            
            try {
                updateCommandStatus(cmd.id, 'PROCESSING', 'Uploading snapshot...');
                await axios.post(`${API_URL}/player/snapshot`, formData, {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
                console.log('Snapshot uploaded');
                updateCommandStatus(cmd.id, 'COMPLETED', 'Snapshot uploaded successfully');
            } catch (err: any) {
                console.error('Snapshot upload failed', err);
                updateCommandStatus(cmd.id, 'FAILED', 'Upload failed: ' + (err.message || 'Unknown error'));
            }
        }, 'image/jpeg', 0.7);
    } catch (e: any) {
        console.error('Snapshot failed', e);
        updateCommandStatus(cmd.id, 'FAILED', 'Capture failed: ' + (e.message || 'Unknown error'));
    }
  };

  const startHeartbeat = (token: string) => {
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    
    let beatCount = 0;

    const beat = async () => {
        try {
            beatCount++;
            const telemetry: any = {};
            
            // Add cached files count - Lightweight check
            const hasNewDownloads = downloadReportsRef.current.length > 0;
            if (beatCount === 1 || beatCount % 10 === 0 || hasNewDownloads) {
                try {
                    const count = await playerCache.getFileCount();
                    telemetry.cachedFilesCount = count;
                    telemetry.cachedFiles = await playerCache.getAllFiles(); 
                } catch (err) {
                    console.warn('Failed to get cached files count', err);
                }
            }

            if (downloadProgressRef.current !== null) {
                telemetry.downloadProgress = {
                    status: 'DOWNLOADING',
                    completed: downloadProgressRef.current,
                    total: 100,
                    currentFile: 'Playlist Content'
                };
            } else {
                telemetry.downloadProgress = null;
            }

            // Add command updates
            if (commandUpdatesRef.current.length > 0) {
                telemetry.commandUpdates = [...commandUpdatesRef.current];
            }

            // Add download reports
            if (downloadReportsRef.current.length > 0) {
                telemetry.downloadReports = [...downloadReportsRef.current];
            }

            console.debug('[Player] Sending Heartbeat...', new Date().toLocaleTimeString());
            const res = await axios.post(`${API_URL}/player/heartbeat`, telemetry, { headers: { Authorization: `Bearer ${token}` } });
            console.debug('[Player] Heartbeat OK');
            
            // Clear sent updates if successful
            if (telemetry.commandUpdates) {
                const sentIds = telemetry.commandUpdates.map((u:any) => u.id);
                commandUpdatesRef.current = commandUpdatesRef.current.filter(u => !sentIds.includes(u.id));
            }
            if (telemetry.downloadReports) {
                const sentReports = telemetry.downloadReports;
                downloadReportsRef.current = downloadReportsRef.current.filter(r => !sentReports.includes(r));
            }

            // Handle Commands
            if (res.data.commands && Array.isArray(res.data.commands)) {
                for (const cmd of res.data.commands) {
                    handleCommand(cmd, token);
                }
            }
        } catch (err: any) {
            console.error('Heartbeat failed', err);
            // Only reset if authentication fails (401/403)
            // This prevents unpairing on network errors or server restarts
            if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                console.warn('Authentication failed, resetting player');
                resetPlayer();
            }
        }
    };

    // Initial beat
    beat();

    // Loop
    heartbeatIntervalRef.current = setInterval(beat, 30000);

    // Handle visibility change to force heartbeat when waking up
    const handleVisibilityChange = () => {
        if (!document.hidden) {
            console.log('[Player] Tab visible, forcing heartbeat check');
            // If it's been a while, beat() might be called by interval soon, but we force it to ensure we are ONLINE
            beat();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup listener on unmount (or when startHeartbeat called again, though imperfect)
    // Ideally we store this listener ref to remove it, but for now this is okay as startHeartbeat usually called once per session
  };

  const startContentPolling = (token: string) => {
    if (contentIntervalRef.current) clearInterval(contentIntervalRef.current);
    contentIntervalRef.current = setInterval(() => {
      checkForUpdates(token);
    }, 5000); // Check every 5s
  };

  const startPoPSync = (token: string) => {
      if (popSyncIntervalRef.current) clearInterval(popSyncIntervalRef.current);
      
      // Initial sync immediately
      playerSync.syncPoP(token).catch(e => console.warn('Initial PoP sync failed', e));

      popSyncIntervalRef.current = setInterval(async () => {
          try {
            await playerSync.syncPoP(token);
          } catch (e: any) {
             if (e.response && (e.response.status === 401 || e.response.status === 403)) {
                resetPlayer();
             }
          }
      }, 30000); // Sync every 30 seconds (increased frequency)
  };

  const isUpdatingRef = useRef(false);

  const checkForUpdates = async (token: string) => {
    if (isUpdatingRef.current) {
        console.log('[Player] Update already in progress, skipping...');
        return;
    }
    
    try {
      console.log('Checking for updates...');
      const res = await axios.get(`${API_URL}/player/content`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const newContent: ScreenContent = res.data;

      // Update Screen Data (Name, Config, etc.)
      const prevConfigStr = JSON.stringify(screenData?.config);
      const newConfigStr = JSON.stringify(newContent.config);
      
      if (screenData?.name !== newContent.name || prevConfigStr !== newConfigStr) {
          console.log('[Player] Screen config or name updated');
          setScreenData((prev: any) => ({
              ...prev,
              name: newContent.name,
              config: newContent.config
          }));
      }

      if (!newContent.playlist) {
          // No playlist assigned
          if (currentPlaylistRef.current) setCurrentPlaylist(null);
          return;
      }

      // Check if playlist changed or version changed
      // If we already have the playlist loaded in memory (currentPlaylistRef), we skip
      // If it's a refresh, currentPlaylistRef is null initially, so we enter here.
      // BUT we should check if we already have the media in cache to avoid re-downloading/reporting.
      
      const isNewPlaylist = !currentPlaylistRef.current || currentPlaylistRef.current.id !== newContent.playlist.id;
      
      if (isNewPlaylist) {
          console.log('Loading playlist content...');
          isUpdatingRef.current = true;
          
          try {
            // Start Download Process (will only download missing files)
            // We don't set progress to 0 initially to avoid flickering if everything is cached
            // setDownloadProgress(0);
            // downloadProgressRef.current = 0;
            
            await playerSync.downloadPlaylist(newContent.playlist, (pct) => {
                setDownloadProgress(pct);
                downloadProgressRef.current = pct;
            }, (fileId, status, message) => {
                // Only report if it was actually a new download or error
                // We'll rely on playerSync to tell us if it downloaded or skipped
                if (message !== 'Skipped (Cached)') {
                    downloadReportsRef.current.push({ fileId, status, message, timestamp: new Date().toISOString() });
                }
            });
            
            // Load Blob URLs
            const urls = new Map<string, string>();
            // Helper to recursively find media items
            const loadUrls = async () => {
                for (const zone of newContent.playlist!.zones) {
                    for (const item of zone.items) {
                        if (item.media) {
                            const blobUrl = await playerCache.getFileBlobUrl(item.media.id);
                            if (blobUrl) {
                                urls.set(item.media.id, blobUrl);
                            }
                        }
                    }
                }
            };
            
            await loadUrls();
            setMediaUrls(urls);
            setCurrentPlaylist(newContent.playlist);
            setDownloadProgress(null);
            downloadProgressRef.current = null;
            console.log('Playlist updated and playing.');
          } finally {
            isUpdatingRef.current = false;
          }
      } else {
          console.log('Playlist unchanged.');
      }

    } catch (err: any) {
      isUpdatingRef.current = false;
      console.error('Failed to check for updates', err);
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        resetPlayer();
      }
    }
  };

  if (status === 'LOADING') {
    return (
      <div id="player-container" className="flex items-center justify-center h-screen bg-black text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (status === 'ERROR') {
    return (
      <div id="player-container" className="flex flex-col items-center justify-center h-screen bg-black text-white">
        <div className="text-red-500 mb-4 text-xl">{error}</div>
        <button 
          onClick={() => window.location.reload()} 
          className="bg-blue-600 px-6 py-2 rounded hover:bg-blue-700 transition"
        >
          Retry Now
        </button>
      </div>
    );
  }

  if (status === 'PAIRED') {
    if (!currentPlaylist) {
        return (
            <div id="player-container" className="flex h-screen w-screen bg-white overflow-hidden">
                {/* Left Side - Info & Status */}
                <div 
                    className="w-1/2 h-full flex flex-col justify-center items-center p-12 relative shadow-2xl z-10"
                    style={{ backgroundColor: bgColor }}
                >
                    {/* Logo */}
                    <div className="mb-12 w-full flex justify-center">
                        <div className="flex flex-col items-center gap-6">
                            {branding?.logoUrl ? (
                                <img src={getFullUrl(branding.logoUrl)} alt="Logo" className="h-56 w-auto object-contain" />
                            ) : (
                                <Monitor className="h-40 w-40 text-blue-600" />
                            )}
                            <span className="text-3xl font-bold tracking-tight text-gray-900 text-center">
                                {branding?.name || 'CMS Player'}
                            </span>
                        </div>
                    </div>

                    {/* Status Block */}
                    <div 
                        className="p-8 rounded-2xl shadow-xl text-center w-full max-w-md"
                        style={{ 
                            backgroundColor: codeBlockBg,
                            borderColor: codeBlockBorder,
                            borderWidth: `${codeBlockWidth}px`,
                            borderStyle: 'solid'
                        }}
                    >
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Screen Paired</h2>
                        <p className="text-lg text-gray-600 mb-6">
                            {screenData?.name || 'Unknown Screen'}
                        </p>
                        
                        <div className="flex flex-col items-center justify-center py-4">
                            {downloadProgress !== null ? (
                                <div className="w-full">
                                    <div className="flex justify-between text-sm text-gray-500 mb-1">
                                        <span>Downloading Content...</span>
                                        <span>{Math.round(downloadProgress)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div 
                                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                                            style={{ width: `${downloadProgress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-gray-500 animate-pulse">
                                    <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                                    <span className="text-sm font-medium">Waiting for content to be published...</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* System Info Footer */}
                    <div 
                        className="absolute bottom-0 left-0 w-full border-t border-gray-200 p-6"
                        style={{ 
                            backgroundColor: sysInfoBg,
                            color: sysInfoText
                        }}
                    >
                        <div className="grid grid-cols-2 gap-4 text-xs max-w-xl mx-auto" style={{ color: sysInfoText }}>
                            <div className="flex items-center gap-2">
                                <Monitor size={14} style={{ opacity: 0.6 }} />
                                <span className="font-medium" style={{ opacity: 0.8 }}>Res:</span> {systemInfo.screenResolution}
                            </div>
                            <div className="flex items-center gap-2">
                                <Cpu size={14} style={{ opacity: 0.6 }} />
                                <span className="font-medium" style={{ opacity: 0.8 }}>Cores:</span> {systemInfo.cores}
                            </div>
                            <div className="flex items-center gap-2">
                                <HardDrive size={14} style={{ opacity: 0.6 }} />
                                <span className="font-medium" style={{ opacity: 0.8 }}>Memory:</span> {systemInfo.memory}
                            </div>
                            <div className="flex items-center gap-2">
                                <Info size={14} style={{ opacity: 0.6 }} />
                                <span className="font-medium" style={{ opacity: 0.8 }}>Platform:</span> {systemInfo.platform}
                            </div>
                        </div>
                         <div className="text-center mt-3 text-[10px] font-mono" style={{ color: sysInfoText, opacity: 0.6 }}>
                            UA: {systemInfo.userAgent.substring(0, 50)}...
                        </div>
                    </div>
                </div>

                {/* Right Side - Visual Placeholder */}
                <div className="w-1/2 h-full bg-blue-600 relative overflow-hidden flex items-center justify-center">
                     <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-900 opacity-90 z-10"></div>
                     <img 
                        src="https://images.unsplash.com/photo-1542751371-adc38448a05e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80" 
                        alt="Digital Signage" 
                        className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50"
                     />
                     
                     <div className="relative z-20 text-center text-white p-10 max-w-lg">
                        <ImageIcon className="h-20 w-20 mx-auto mb-6 text-blue-200 opacity-80" />
                        <h1 className="text-4xl font-bold mb-4 tracking-tight" style={{ color: rightTitleColor }}>{rightTitle}</h1>
                        <p className="text-lg" style={{ color: rightSubtitleColor }}>
                            {rightSubtitle}
                        </p>
                     </div>
                </div>
            </div>
        );
    }

    return (
        <div 
            id="player-container"
            className="relative w-full h-full bg-black overflow-hidden"
            style={{ 
                width: '100vw', 
                height: '100vh',
                cursor: 'none' // Hide cursor in playback
            }}
        >
            {/* Render Playlist Content */}
            {currentPlaylist.zones.map((zone: Zone) => (
                <div
                    key={zone.id}
                    className="absolute overflow-hidden bg-black"
                    style={{
                        left: `${(zone.x / currentPlaylist.canvasWidth) * 100}%`,
                        top: `${(zone.y / currentPlaylist.canvasHeight) * 100}%`,
                        width: `${(zone.width / currentPlaylist.canvasWidth) * 100}%`,
                        height: `${(zone.height / currentPlaylist.canvasHeight) * 100}%`,
                        zIndex: zone.zIndex,
                    }}
                >
                    <ZonePlayer zone={zone} mediaUrls={mediaUrls} playlistId={currentPlaylist.id} />
                </div>
            ))}
            
            {/* Update Overlay */}
            {downloadProgress !== null && (
                <div className="absolute bottom-0 left-0 w-full bg-black bg-opacity-70 p-4 flex flex-col items-center justify-center z-50">
                    <p className="text-white text-sm mb-2">Updating Content...</p>
                    <div className="w-1/2 bg-gray-700 rounded-full h-1.5">
                        <div 
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
                            style={{ width: `${downloadProgress}%` }}
                        ></div>
                    </div>
                </div>
            )}
        </div>
    );
  }

  // Unpaired Screen Layout
  return (
    <div id="player-container" className="flex h-screen w-screen bg-white overflow-hidden">
      {/* Left Side - Info & Pairing */}
      <div 
        className="w-1/2 h-full flex flex-col justify-center items-center p-12 relative shadow-2xl z-10"
        style={{ backgroundColor: bgColor }}
      >
        
        {/* Logo */}
        <div className="mb-12 w-full flex justify-center">
            <div className="flex flex-col items-center gap-6">
                {branding?.logoUrl ? (
                    <img src={getFullUrl(branding.logoUrl)} alt="Logo" className="h-56 w-auto object-contain" />
                ) : (
                    <Monitor className="h-40 w-40 text-blue-600" />
                )}
                <span className="text-3xl font-bold tracking-tight text-gray-900 text-center">
                    {branding?.name || 'CMS Player'}
                </span>
            </div>
        </div>

        {/* Pairing Code Block */}
        <div 
            className="p-8 rounded-2xl shadow-xl text-center w-full max-w-md transform hover:scale-105 transition-transform duration-300"
            style={{ 
                backgroundColor: codeBlockBg,
                borderColor: codeBlockBorder,
                borderWidth: `${codeBlockWidth}px`,
                borderStyle: 'solid'
            }}
        >
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Pairing Code</h2>
            <div className="text-7xl font-mono font-bold tracking-widest text-blue-600 mb-2 select-all">
            {pairingCode}
            </div>
            <div className="h-1 w-24 bg-blue-100 mx-auto rounded-full mt-4"></div>
        </div>

        {/* Instructions */}
        <div className="mt-12 text-center max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">How to Pair</h3>
            <p className="text-gray-600 leading-relaxed">
                Log in to your CMS dashboard, navigate to <span className="font-medium text-blue-600">Screens</span>, 
                click <span className="font-medium text-blue-600">Add Screen</span>, and enter the code above.
            </p>
        </div>

        {/* System Info Footer */}
        <div 
            className="absolute bottom-0 left-0 w-full border-t border-gray-200 p-6"
            style={{ 
                backgroundColor: sysInfoBg,
                color: sysInfoText
            }}
        >
            <div className="grid grid-cols-2 gap-4 text-xs max-w-xl mx-auto" style={{ color: sysInfoText }}>
                <div className="flex items-center gap-2">
                    <Monitor size={14} style={{ opacity: 0.6 }} />
                    <span className="font-medium" style={{ opacity: 0.8 }}>Res:</span> {systemInfo.screenResolution}
                </div>
                <div className="flex items-center gap-2">
                    <Cpu size={14} style={{ opacity: 0.6 }} />
                    <span className="font-medium" style={{ opacity: 0.8 }}>Cores:</span> {systemInfo.cores}
                </div>
                <div className="flex items-center gap-2">
                    <HardDrive size={14} style={{ opacity: 0.6 }} />
                    <span className="font-medium" style={{ opacity: 0.8 }}>Memory:</span> {systemInfo.memory}
                </div>
                <div className="flex items-center gap-2">
                    <Info size={14} style={{ opacity: 0.6 }} />
                    <span className="font-medium" style={{ opacity: 0.8 }}>Platform:</span> {systemInfo.platform}
                </div>
            </div>
             <div className="text-center mt-3 text-[10px] font-mono" style={{ color: sysInfoText, opacity: 0.6 }}>
                UA: {systemInfo.userAgent.substring(0, 50)}...
            </div>
        </div>
      </div>

      {/* Right Side - Visual Placeholder */}
      <div className="w-1/2 h-full bg-blue-600 relative overflow-hidden flex items-center justify-center">
         <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-900 opacity-90 z-10"></div>
         {/* Placeholder Image Pattern */}
         <img 
            src="https://images.unsplash.com/photo-1542751371-adc38448a05e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80" 
            alt="Digital Signage" 
            className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50"
         />
         
         <div className="relative z-20 text-center text-white p-10 max-w-lg">
            <ImageIcon className="h-20 w-20 mx-auto mb-6 text-blue-200 opacity-80" />
            <h1 className="text-4xl font-bold mb-4 tracking-tight" style={{ color: rightTitleColor }}>{rightTitle}</h1>
            <p className="text-lg" style={{ color: rightSubtitleColor }}>
                {rightSubtitle}
            </p>
         </div>
      </div>
    </div>
  );
};

export default Player;
