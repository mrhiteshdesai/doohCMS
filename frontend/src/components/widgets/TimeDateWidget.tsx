/**
 * FROZEN COMPONENT
 * This component is considered stable and frozen.
 * Further development should not modify this file unless absolutely necessary.
 */
import React, { useState, useEffect } from 'react';
import { WidgetConfig } from '../../types/widget';

interface TimeDateWidgetProps {
  config: WidgetConfig;
  className?: string;
}

const TimeDateWidget: React.FC<TimeDateWidgetProps> = ({ config, className = '' }) => {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const {
    backgroundColor = '#ffffff',
    backgroundImage,
    textColor = '#000000',
    timeFormat = '24h',
    dateFormat = 'long',
    showDate = true,
    showTime = true,
    template = 'modern',
    fontSize = 1,
    aspectRatioWidth = 16,
    aspectRatioHeight = 9,
    fontFamily,
    textAlign = 'center',
  } = config;

  const alignClass = textAlign === 'left' ? 'items-start text-left' : textAlign === 'right' ? 'items-end text-right' : 'items-center text-center';
  const tileH = 3.4 * fontSize;
  const tileW = 2.4 * fontSize;
  const digitFontSize = 1.8 * fontSize;

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

  const getDateFormatOptions = (): Intl.DateTimeFormatOptions => {
    switch (dateFormat) {
      case 'short': return { dateStyle: 'short' };
      case 'medium': return { dateStyle: 'medium' };
      case 'long': return { dateStyle: 'long' };
      case 'full': return { dateStyle: 'full' };
      default: return { dateStyle: 'long' };
    }
  };

  const getTimeFormatOptions = (): Intl.DateTimeFormatOptions => {
    return {
      hour: 'numeric',
      minute: '2-digit',
      hour12: timeFormat === '12h',
      second: '2-digit'
    };
  };

  const renderContent = () => {
    const timeStr = dateTime.toLocaleTimeString('en-GB', getTimeFormatOptions());
    const dateStr = dateTime.toLocaleDateString('en-GB', getDateFormatOptions());
    const hours = timeFormat === '12h' ? (((dateTime.getHours() + 11) % 12) + 1) : dateTime.getHours();
    const minutes = dateTime.getMinutes();
    const seconds = dateTime.getSeconds();
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');

    switch (template) {
      case 'minimal':
        return (
          <div className={`flex flex-col ${alignClass} justify-center h-full space-y-2`}>
            {showTime && <div className="font-thin tracking-tighter" style={{ fontSize: `${4 * fontSize}rem` }}>{timeStr}</div>}
            {showDate && <div className="font-light uppercase tracking-widest opacity-80" style={{ fontSize: `${1.2 * fontSize}rem` }}>{dateStr}</div>}
          </div>
        );
      case 'bold':
        return (
          <div className={`flex flex-col ${alignClass} justify-center h-full px-8`}>
            {showTime && <div className="text-7xl font-black leading-none" style={{ fontSize: `${5 * fontSize}rem` }}>{timeStr}</div>}
            {showDate && <div className="text-2xl font-bold mt-2 opacity-90" style={{ fontSize: `${1.5 * fontSize}rem` }}>{dateStr}</div>}
          </div>
        );
      case 'classic':
        return (
          <div className={`flex flex-col ${alignClass} justify-center h-full border-4 border-current m-4 rounded-xl`}>
             {showDate && <div className="text-xl font-serif italic mb-2" style={{ fontSize: `${1.5 * fontSize}rem` }}>{dateStr}</div>}
             {showTime && <div className="text-5xl font-serif font-bold" style={{ fontSize: `${4 * fontSize}rem` }}>{timeStr}</div>}
          </div>
        );
      case 'glass':
        return (
          <div className={`flex ${alignClass} justify-center h-full p-6`}>
            <div
              className="w-full h-full rounded-2xl border"
              style={{
                background: 'rgba(255,255,255,0.15)',
                borderColor: 'rgba(255,255,255,0.3)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              <div className={`w-full h-full flex flex-col ${alignClass} justify-center`}>
                {showTime && <div className="font-semibold tracking-tight" style={{ fontSize: `${4 * fontSize}rem` }}>{timeStr}</div>}
                {showDate && <div className="mt-2 opacity-80" style={{ fontSize: `${1.2 * fontSize}rem` }}>{dateStr}</div>}
              </div>
            </div>
          </div>
        );
      case 'flip':
        return (
          <div className={`flex flex-col ${alignClass} justify-center h-full`}>
            {showTime && (
              <div className="flex items-center" style={{ gap: `${0.4 * fontSize}rem` }}>
                {([hh, mm] as string[]).map((part, idx) => (
                  <div key={idx} className="flex" style={{ gap: `${0.2 * fontSize}rem` }}>
                    {part.split('').map((d, i) => (
                      <div
                        key={i}
                        className="rounded-md overflow-hidden"
                        style={{
                          width: `${tileW}rem`,
                          height: `${tileH}rem`,
                          background: '#000',
                          color: '#fff',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                        }}
                      >
                        <div className="w-full h-1/2 border-b" style={{ borderColor: '#333', background: '#111', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflow: 'hidden' }}>
                          <span className="font-mono" style={{ fontSize: `${digitFontSize}rem`, lineHeight: `${tileH}rem` }}>{d}</span>
                        </div>
                        <div className="w-full h-1/2" style={{ background: '#000', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', overflow: 'hidden' }}>
                          <span className="font-mono" style={{ fontSize: `${digitFontSize}rem`, lineHeight: `${tileH}rem` }}>{d}</span>
                        </div>
                      </div>
                    ))}
                    {idx === 0 && (
                      <div
                        className="flex flex-col items-center justify-center"
                        style={{
                          width: `${0.6 * fontSize}rem`,
                          height: `${tileH}rem`,
                        }}
                      >
                        <span
                          style={{
                            width: `${0.25 * fontSize}rem`,
                            height: `${0.25 * fontSize}rem`,
                            borderRadius: '9999px',
                            background: '#000',
                            display: 'block',
                          }}
                        />
                        <span
                          style={{
                            width: `${0.25 * fontSize}rem`,
                            height: `${0.25 * fontSize}rem`,
                            borderRadius: '9999px',
                            background: '#000',
                            display: 'block',
                            marginTop: `${0.6 * fontSize}rem`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                {timeFormat === '12h' && (
                  <span className="ml-2 font-mono" style={{ fontSize: `${1.1 * fontSize}rem`, color: 'inherit' }}>
                    {dateTime.getHours() >= 12 ? 'PM' : 'AM'}
                  </span>
                )}
              </div>
            )}
            {showDate && (
              <div className="mt-4 opacity-80" style={{ fontSize: `${1.2 * fontSize}rem` }}>
                {dateStr}
              </div>
            )}
          </div>
        );
      case 'modern':
      default:
        return (
          <div className={`flex flex-col ${alignClass} justify-center h-full`}>
            {showTime && <div className="text-6xl font-bold tracking-tight" style={{ fontSize: `${4 * fontSize}rem` }}>{timeStr}</div>}
            {showDate && <div className="text-xl mt-2 font-medium opacity-80" style={{ fontSize: `${1.2 * fontSize}rem` }}>{dateStr}</div>}
          </div>
        );
    }
  };

  return (
    <div 
      className={`w-full h-full min-h-[200px] overflow-hidden rounded-lg shadow-sm ${className}`}
      style={containerStyle}
    >
      {renderContent()}
    </div>
  );
};

export default TimeDateWidget;
