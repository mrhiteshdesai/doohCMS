/**
 * FROZEN COMPONENT
 * This component is considered stable and frozen.
 * Further development should not modify this file unless absolutely necessary.
 */
import React, { useState, useEffect } from 'react';
import { WidgetConfig } from '../../types/widget';

interface CountDownWidgetProps {
  config: WidgetConfig;
  className?: string;
}

const CountDownWidget: React.FC<CountDownWidgetProps> = ({ config, className = '' }) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isFinished: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isFinished: false });

  const {
    backgroundColor = '#ffffff',
    backgroundImage,
    textColor = '#000000',
    fontSize = 1,
    aspectRatioWidth = 16,
    aspectRatioHeight = 9,
    fontFamily,
    textAlign = 'center',
    timerTargetDate,
    timerMode = 'COUNT_DOWN',
    timerLabel = timerMode === 'COUNT_DOWN' ? 'Time Remaining' : 'Time Elapsed',
    timerShowLabel = true,
    timerFinishMessage = 'Time is up!',
    template = 'modern',
  } = config;

  useEffect(() => {
    const calculateTimeLeft = () => {
      const targetDate = timerTargetDate ? new Date(timerTargetDate).getTime() : new Date().getTime() + 86400000; // Default to 24h from now if not set
      const now = new Date().getTime();
      
      let difference: number;
      if (timerMode === 'COUNT_DOWN') {
        difference = targetDate - now;
      } else {
        difference = now - targetDate;
      }

      if (difference < 0 && timerMode === 'COUNT_DOWN') {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isFinished: true };
      }
      
      // If counting up and target is in future, we might want to show 0 or negative. 
      // Typically count up is from a past event. If target is future, difference is negative.
      // Let's assume absolute difference for count up if negative.
      if (difference < 0 && timerMode === 'COUNT_UP') {
          difference = Math.abs(difference);
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isFinished: false,
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [timerTargetDate, timerMode]);

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

  if (timeLeft.isFinished && timerMode === 'COUNT_DOWN') {
    return (
      <div 
        className={`w-full h-full flex flex-col justify-center p-4 ${className}`}
        style={containerStyle}
      >
        <div className={`flex flex-col ${alignClass} w-full`}>
           <h2 className="font-bold" style={{ fontSize: `${3 * fontSize}rem` }}>{timerFinishMessage}</h2>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    // Shared timer display logic
    const dayPart = timeLeft.days > 0 ? (
      <div className="flex flex-col items-center">
        <span className="font-bold leading-none" style={{ fontSize: `${4 * fontSize}rem` }}>{timeLeft.days}</span>
        <span className="text-sm uppercase opacity-70" style={{ fontSize: `${0.8 * fontSize}rem` }}>Days</span>
      </div>
    ) : null;

    const hourPart = (
      <div className="flex flex-col items-center">
        <span className="font-bold leading-none" style={{ fontSize: `${4 * fontSize}rem` }}>
          {String(timeLeft.hours).padStart(2, '0')}
        </span>
        <span className="text-sm uppercase opacity-70" style={{ fontSize: `${0.8 * fontSize}rem` }}>Hours</span>
      </div>
    );

    const minPart = (
       <div className="flex flex-col items-center">
          <span className="font-bold leading-none" style={{ fontSize: `${4 * fontSize}rem` }}>
             {String(timeLeft.minutes).padStart(2, '0')}
          </span>
          <span className="text-sm uppercase opacity-70" style={{ fontSize: `${0.8 * fontSize}rem` }}>Mins</span>
       </div>
    );

    const secPart = (
       <div className="flex flex-col items-center">
          <span className="font-bold leading-none" style={{ fontSize: `${4 * fontSize}rem` }}>
             {String(timeLeft.seconds).padStart(2, '0')}
          </span>
          <span className="text-sm uppercase opacity-70" style={{ fontSize: `${0.8 * fontSize}rem` }}>Secs</span>
       </div>
    );

    const separator = <span className="font-bold leading-none self-start mt-2" style={{ fontSize: `${3 * fontSize}rem`, opacity: 0.5 }}>:</span>;

    const standardLayout = (
        <div className="flex items-baseline space-x-4">
          {dayPart}
          {dayPart && separator}
          {hourPart}
          {separator}
          {minPart}
          {separator}
          {secPart}
        </div>
    );

    switch (template) {
        case 'minimal':
            return (
              <div className={`flex flex-col ${alignClass} justify-center h-full space-y-2`}>
                 {timerShowLabel && <div className="font-light uppercase tracking-widest opacity-80" style={{ fontSize: `${1.2 * fontSize}rem` }}>{timerLabel}</div>}
                 <div className="font-thin tracking-tighter" style={{ fontSize: `${4 * fontSize}rem` }}>
                    {timeLeft.days > 0 ? `${timeLeft.days}d ` : ''}
                    {String(timeLeft.hours).padStart(2, '0')}:
                    {String(timeLeft.minutes).padStart(2, '0')}:
                    {String(timeLeft.seconds).padStart(2, '0')}
                 </div>
              </div>
            );
        case 'bold':
            return (
              <div className={`flex flex-col ${alignClass} justify-center h-full px-8`}>
                 {timerShowLabel && <div className="text-2xl font-bold mb-2 opacity-90" style={{ fontSize: `${1.5 * fontSize}rem` }}>{timerLabel}</div>}
                 <div className="text-7xl font-black leading-none" style={{ fontSize: `${5 * fontSize}rem` }}>
                    {timeLeft.days > 0 ? `${timeLeft.days}:` : ''}
                    {String(timeLeft.hours).padStart(2, '0')}:
                    {String(timeLeft.minutes).padStart(2, '0')}:
                    {String(timeLeft.seconds).padStart(2, '0')}
                 </div>
              </div>
            );
        case 'classic':
            return (
              <div className={`flex flex-col ${alignClass} justify-center h-full border-4 border-current m-4 rounded-xl p-6`}>
                 {timerShowLabel && <div className="text-xl font-serif italic mb-4" style={{ fontSize: `${1.5 * fontSize}rem` }}>{timerLabel}</div>}
                 <div className="text-5xl font-serif font-bold" style={{ fontSize: `${4 * fontSize}rem` }}>
                    {timeLeft.days > 0 ? `${timeLeft.days}d ` : ''}
                    {String(timeLeft.hours).padStart(2, '0')}:
                    {String(timeLeft.minutes).padStart(2, '0')}:
                    {String(timeLeft.seconds).padStart(2, '0')}
                 </div>
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
                    {timerShowLabel && <div className="mb-4 opacity-80" style={{ fontSize: `${1.2 * fontSize}rem` }}>{timerLabel}</div>}
                    <div className="font-semibold tracking-tight" style={{ fontSize: `${4 * fontSize}rem` }}>
                        {timeLeft.days > 0 ? `${timeLeft.days}:` : ''}
                        {String(timeLeft.hours).padStart(2, '0')}:
                        {String(timeLeft.minutes).padStart(2, '0')}:
                        {String(timeLeft.seconds).padStart(2, '0')}
                    </div>
                  </div>
                </div>
              </div>
            );
        case 'flip':
             // Reusing a simplified flip style
             const tileH = 3.4 * fontSize;
             const digitFontSize = 1.8 * fontSize;
             const timeString = `${timeLeft.days > 0 ? String(timeLeft.days).padStart(2, '0') : ''}${String(timeLeft.hours).padStart(2, '0')}${String(timeLeft.minutes).padStart(2, '0')}${String(timeLeft.seconds).padStart(2, '0')}`;
             
             // Simple render for flip - separating groups would be better but keeping it simple for now
             // Let's actually use the standard layout but styled like flip tiles for each number group
             
             const FlipGroup = ({ value, label }: { value: number, label: string }) => (
                <div className="flex flex-col items-center mx-2">
                    <div className="flex bg-black text-white rounded p-2 mb-1" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                        <span className="font-mono font-bold leading-none" style={{ fontSize: `${3 * fontSize}rem` }}>
                            {String(value).padStart(2, '0')}
                        </span>
                    </div>
                    <span className="text-xs uppercase font-bold opacity-60" style={{ fontSize: `${0.7 * fontSize}rem` }}>{label}</span>
                </div>
             );

             return (
                <div className={`flex flex-col ${alignClass} justify-center h-full`}>
                    {timerShowLabel && <div className="mb-6 font-bold uppercase tracking-wider opacity-80" style={{ fontSize: `${1.2 * fontSize}rem` }}>{timerLabel}</div>}
                    <div className="flex items-center justify-center">
                        {timeLeft.days > 0 && <FlipGroup value={timeLeft.days} label="DAYS" />}
                        <FlipGroup value={timeLeft.hours} label="HOURS" />
                        <FlipGroup value={timeLeft.minutes} label="MINS" />
                        <FlipGroup value={timeLeft.seconds} label="SECS" />
                    </div>
                </div>
             );

        case 'modern':
        default:
            return (
                <div className={`flex flex-col ${alignClass} w-full`}>
                    {timerShowLabel && (
                    <div className="mb-4 font-medium opacity-80" style={{ fontSize: `${1.5 * fontSize}rem` }}>
                        {timerLabel}
                    </div>
                    )}
                    {standardLayout}
                </div>
            );
    }
  };

  return (
    <div 
      className={`w-full h-full flex flex-col justify-center p-4 ${className}`}
      style={containerStyle}
    >
      {renderContent()}
    </div>
  );
};

export default CountDownWidget;
