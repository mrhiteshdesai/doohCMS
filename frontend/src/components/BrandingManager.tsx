import React, { useEffect } from 'react';
import { getPublicBranding } from '../services/tenant';
import { applyTheme } from '../utils/colors';

const BrandingManager: React.FC = () => {
  useEffect(() => {
    // Ensure default favicon exists immediately
    let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.href = '/vite.svg'; // Default
      document.head.appendChild(link);
    }

    const applyBranding = async () => {
      try {
        const branding = await getPublicBranding();
        
        // Apply Theme
        if (branding.primaryColor) {
          applyTheme(branding.primaryColor);
        }

        // Apply Favicon
        const faviconTarget = branding.faviconUrl || branding.logoUrl;
        
        if (faviconTarget) {
           // Update existing link
           link.href = faviconTarget;
           
           // Attempt to determine type
           if (faviconTarget.endsWith('.png')) {
             link.type = 'image/png';
           } else if (faviconTarget.endsWith('.jpg') || faviconTarget.endsWith('.jpeg')) {
             link.type = 'image/jpeg';
           } else if (faviconTarget.endsWith('.svg')) {
             link.type = 'image/svg+xml';
           } else if (faviconTarget.endsWith('.ico')) {
             link.type = 'image/x-icon';
           } else {
             // Default fallback
             link.removeAttribute('type'); 
           }
        }
      } catch (e) {
        console.error('Failed to load branding', e);
      }
    };

    applyBranding();
  }, []);

  return null;
};

export default BrandingManager;
