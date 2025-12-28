import axios from 'axios';
import { playerCache } from './playerCache';

const API_URL = '/api';

export const playerSync = {
  async downloadPlaylist(playlist: any, onProgress: (pct: number) => void, onStatus?: (fileId: string, status: 'SUCCESS' | 'FAILED', message?: string) => void) {
    // Collect all media items
    const mediaItems: any[] = [];
    playlist.zones.forEach((zone: any) => {
      zone.items.forEach((item: any) => {
        if (item.media) {
            mediaItems.push(item.media);
        }
      });
    });

    const uniqueItems = Array.from(new Map(mediaItems.map(m => [m.id, m])).values());
    const uniqueIds = uniqueItems.map(m => m.id);
    
    // Batch check cache efficiently
    const missingIds = await playerCache.getMissingFiles(uniqueIds);
    
    // If nothing missing, we are done
    if (missingIds.length === 0) {
        // Cleanup old media
        playerCache.clearUnusedMedia(uniqueIds).catch(console.error);
        return;
    }

    const totalToDownload = missingIds.length;
    let completed = 0;

    // Report start
    onProgress(0);
    
    // Helper to update progress
    const updateProgress = () => {
        completed++;
        onProgress(Math.round((completed / totalToDownload) * 100));
    };

    // Download missing files
    const missingItems = uniqueItems.filter(m => missingIds.includes(m.id));
    const CONCURRENCY_LIMIT = 3;

    // Process in chunks to prevent network congestion
    for (let i = 0; i < missingItems.length; i += CONCURRENCY_LIMIT) {
        const chunk = missingItems.slice(i, i + CONCURRENCY_LIMIT);
        
        await Promise.all(chunk.map(async (media: any) => {
            try {
                const url = media.url.startsWith('http') ? media.url : `${API_URL.replace('/api', '')}${media.url}`;
                
                await playerCache.saveFile(url, media.id, media.mimeType, media.filename);
                if (onStatus) onStatus(media.id, 'SUCCESS');
            } catch (e: any) {
                console.error(`Failed to download media ${media.id}`, e);
                if (onStatus) onStatus(media.id, 'FAILED', e.message);
                // We continue even if one fails
            } finally {
                updateProgress();
            }
        }));
    }
    
    // Cleanup old media
    playerCache.clearUnusedMedia(uniqueIds).catch(console.error);
  },

  async syncPoP(token: string) {
    try {
      const logs = await playerCache.getLogs();
      if (logs.length === 0) return;

      console.debug(`[PlayerSync] Syncing ${logs.length} PoP logs...`);

      // Send to server
      await axios.post(
        `${API_URL}/player/pop`, 
        { logs },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Remove sent logs
      await playerCache.removeLogs(logs.map(l => l.id));
      console.log(`[PlayerSync] Synced ${logs.length} PoP logs`);
    } catch (e) {
      console.error('[PlayerSync] Failed to sync PoP logs', e);
      throw e; // Re-throw to allow caller to handle auth errors
    }
  }
};
