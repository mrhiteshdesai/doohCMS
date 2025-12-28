/**
 * FROZEN COMPONENT
 * This component is considered stable and frozen.
 * Further development should not modify this file unless absolutely necessary.
 */
import React, { useMemo } from 'react';
import { WidgetConfig } from '../../types/widget';
 
interface QRCodeWidgetProps {
  config: WidgetConfig;
  className?: string;
}
 
const buildVCard = (cfg: WidgetConfig) => {
  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
  ];
  if (cfg.vcardFullName) lines.push(`FN:${cfg.vcardFullName}`);
  if (cfg.vcardOrganization) lines.push(`ORG:${cfg.vcardOrganization}`);
  if (cfg.vcardTitle) lines.push(`TITLE:${cfg.vcardTitle}`);
  if (cfg.vcardPhone) lines.push(`TEL;TYPE=CELL:${cfg.vcardPhone}`);
  if (cfg.vcardEmail) lines.push(`EMAIL:${cfg.vcardEmail}`);
  if (cfg.vcardWebsite) lines.push(`URL:${cfg.vcardWebsite}`);
  if (cfg.vcardAddress) lines.push(`ADR;TYPE=WORK:;;${cfg.vcardAddress.replace(/\n/g, ' ')}`);
  lines.push('END:VCARD');
  return lines.join('\n');
};
 
const QRCodeWidget: React.FC<QRCodeWidgetProps> = ({ config, className = '' }) => {
  const {
    backgroundColor = '#ffffff',
    backgroundImage,
    textColor = '#000000',
    fontSize = 1,
    aspectRatioWidth = 1,
    aspectRatioHeight = 1,
    fontFamily,
    textAlign = 'center',
    template = 'modern',
    qrMode = 'LINK',
    qrContent = 'https://example.com',
    qrErrorCorrection = 'M',
    qrForegroundColor = '#000000',
    qrBackgroundColor = '#ffffff',
    qrMargin = 2,
  } = config;
 
  const containerStyle: React.CSSProperties = {
    backgroundColor: backgroundImage ? 'transparent' : backgroundColor,
    backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: textColor,
    aspectRatio: `${aspectRatioWidth} / ${aspectRatioHeight}`,
    fontFamily: fontFamily,
    textAlign: textAlign,
  };
 
  const alignClass = textAlign === 'left' ? 'items-start text-left' : textAlign === 'right' ? 'items-end text-right' : 'items-center text-center';
 
  const data = useMemo(() => {
    if (qrMode === 'VCARD') {
      return buildVCard(config);
    }
    return qrContent || '';
  }, [qrMode, qrContent, config]);
 
  const eccMap: Record<string, string> = { L: 'L', M: 'M', Q: 'Q', H: 'H' };
  const sizePx = Math.round(256 * (config.fontSize || 1));
  const apiUrl = useMemo(() => {
    const base = 'https://api.qrserver.com/v1/create-qr-code/';
    const params = new URLSearchParams();
    params.set('data', data);
    params.set('size', `${sizePx}x${sizePx}`);
    params.set('margin', String(qrMargin ?? 2));
    params.set('ecc', eccMap[qrErrorCorrection || 'M'] || 'M');
    // qrserver uses color as R,G,B, can accept hex without '#'? It supports hex without '#'
    const fg = (qrForegroundColor || '#000000').replace('#', '');
    const bg = (qrBackgroundColor || '#ffffff').replace('#', '');
    params.set('color', fg);
    params.set('bgcolor', bg);
    return `${base}?${params.toString()}`;
  }, [data, sizePx, qrMargin, qrErrorCorrection, qrForegroundColor, qrBackgroundColor]);
 
  const renderFrame = (inner: React.ReactNode) => {
    switch (template) {
      case 'card':
        return (
          <div className={`flex ${alignClass} justify-center h-full p-6`}>
            <div className="bg-white p-4 rounded-xl shadow-xl flex flex-col items-center">
              {inner}
              {qrMode === 'VCARD' && config.vcardFullName && (
                <div className="mt-3 text-center">
                  <div className="font-bold text-gray-800 text-lg">{config.vcardFullName}</div>
                  {config.vcardOrganization && <div className="text-gray-500 text-sm">{config.vcardOrganization}</div>}
                </div>
              )}
              {qrMode === 'LINK' && (
                <div className="mt-3 text-center max-w-[200px]">
                  <div className="text-gray-500 text-xs truncate w-full">{qrContent}</div>
                </div>
              )}
            </div>
          </div>
        );
      case 'label':
        return (
          <div className={`flex flex-col items-center justify-center h-full p-4`}>
            {inner}
            <div className="mt-4 bg-black text-white px-4 py-2 rounded-full font-bold shadow-lg">
              {qrMode === 'VCARD' ? 'Scan to Save Contact' : 'Scan Me'}
            </div>
          </div>
        );
      case 'border':
        return (
          <div className={`flex ${alignClass} justify-center h-full p-6`}>
            <div className="p-4 border-4 border-black rounded-xl bg-white">
              {inner}
            </div>
          </div>
        );
      case 'plain':
      default:
        return (
          <div className={`flex ${alignClass} justify-center h-full`}>
            {inner}
          </div>
        );
    }
  };
 
  return (
    <div className={`w-full h-full flex flex-col justify-center p-4 ${className}`} style={containerStyle}>
      {renderFrame(
        <img
          src={apiUrl}
          alt="QR Code"
          style={{ width: `${sizePx}px`, height: `${sizePx}px` }}
        />
      )}
    </div>
  );
};
 
export default QRCodeWidget;
