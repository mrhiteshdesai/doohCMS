/**
 * FROZEN COMPONENT
 * This component is considered stable and frozen.
 * Further development should not modify this file unless absolutely necessary.
 */
import React, { useEffect, useState } from 'react';
import { WidgetConfig } from '../../types/widget';

interface AnalogClockWidgetProps {
  config: WidgetConfig;
  className?: string;
}

const AnalogClockWidget: React.FC<AnalogClockWidgetProps> = ({ config, className = '' }) => {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const {
    backgroundColor = '#ffffff',
    backgroundImage,
    textColor = '#000000',
    fontFamily,
    aspectRatioWidth = 1,
    aspectRatioHeight = 1,
    analogTickColor = '#888888',
    analogHandHourColor = textColor,
    analogHandMinuteColor = textColor,
    analogHandSecondColor = '#ff4d4f',
    analogShowSecondHand = true,
    analogShape = 'circle',
    analogShowNumbers = true,
    analogBezelColor = '#e0e0e0',
    analogBezelWidth = 0,
  } = config;

  const containerStyle: React.CSSProperties = {
    backgroundColor: 'transparent', // Handled inside SVG for shape support
    backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: textColor,
    aspectRatio: `${aspectRatioWidth} / ${aspectRatioHeight}`,
    fontFamily,
  };

  const size = 300; // Increased resolution
  const center = size / 2;
  // Radius needs to account for bezel width to avoid clipping
  const maxRadius = center - (analogBezelWidth || 0) / 2 - 2;
  const radius = maxRadius;

  const hours = dateTime.getHours() % 12;
  const minutes = dateTime.getMinutes();
  const seconds = dateTime.getSeconds();

  const hourAngle = (Math.PI / 6) * (hours + minutes / 60);
  const minuteAngle = (Math.PI / 30) * minutes;
  const secondAngle = (Math.PI / 30) * seconds;

  const polarToCartesian = (angle: number, r: number) => ({
    x: center + r * Math.sin(angle),
    y: center - r * Math.cos(angle),
  });

  const hourHand = polarToCartesian(hourAngle, radius * 0.5);
  const minuteHand = polarToCartesian(minuteAngle, radius * 0.75);
  const secondHand = polarToCartesian(secondAngle, radius * 0.8);

  const tickMarks = Array.from({ length: 60 }, (_, i) => {
    const isHour = i % 5 === 0;
    const a = (Math.PI / 30) * i;
    // Adjust tick start/end based on numbers presence
    const outerR = radius * 0.95;
    const innerR = radius * (isHour ? (analogShowNumbers ? 0.9 : 0.85) : 0.92);
    const outer = polarToCartesian(a, outerR);
    const inner = polarToCartesian(a, innerR);
    return { i, isHour, outer, inner };
  });

  const numberElements = analogShowNumbers
    ? Array.from({ length: 12 }, (_, i) => {
        const num = i === 0 ? 12 : i;
        const angle = (Math.PI / 6) * num;
        const r = radius * 0.75; // Place numbers inside ticks
        const pos = polarToCartesian(angle, r);
        return { num, pos };
      })
    : [];

  return (
    <div
      className={`w-full h-full min-h-[200px] flex items-center justify-center overflow-hidden rounded-lg shadow-sm ${className}`}
      style={{ ...containerStyle, backgroundColor: 'transparent' }} // Container transparent, SVG has fill
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: '100%', maxHeight: '100%' }}>
        {/* Clock Face Background & Bezel */}
        {analogShape === 'square' ? (
          <rect
            x={(analogBezelWidth || 0) / 2}
            y={(analogBezelWidth || 0) / 2}
            width={size - (analogBezelWidth || 0)}
            height={size - (analogBezelWidth || 0)}
            rx={40}
            fill={backgroundColor}
            stroke={analogBezelColor}
            strokeWidth={analogBezelWidth}
          />
        ) : (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill={backgroundColor}
            stroke={analogBezelColor}
            strokeWidth={analogBezelWidth}
          />
        )}

        {/* Numbers */}
        {numberElements.map(({ num, pos }) => (
          <text
            key={num}
            x={pos.x}
            y={pos.y}
            fill={textColor}
            fontSize={size * 0.12}
            fontFamily={fontFamily}
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {num}
          </text>
        ))}

        {/* Ticks */}
        {tickMarks.map(({ i, isHour, outer, inner }) => (
          <line
            key={i}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            stroke={analogTickColor}
            strokeWidth={isHour ? size * 0.015 : size * 0.005}
            strokeLinecap="round"
          />
        ))}

        {/* Hour Hand */}
        <line
          x1={center}
          y1={center}
          x2={hourHand.x}
          y2={hourHand.y}
          stroke={analogHandHourColor}
          strokeWidth={size * 0.025}
          strokeLinecap="round"
        />
        
        {/* Minute Hand */}
        <line
          x1={center}
          y1={center}
          x2={minuteHand.x}
          y2={minuteHand.y}
          stroke={analogHandMinuteColor}
          strokeWidth={size * 0.015}
          strokeLinecap="round"
        />
        
        {/* Second Hand */}
        {analogShowSecondHand && (
          <line
            x1={center}
            y1={center}
            x2={secondHand.x}
            y2={secondHand.y}
            stroke={analogHandSecondColor}
            strokeWidth={size * 0.008}
            strokeLinecap="round"
          />
        )}

        {/* Center Pivot */}
        <circle cx={center} cy={center} r={size * 0.02} fill={analogHandMinuteColor} />
        {analogShowSecondHand && (
           <circle cx={center} cy={center} r={size * 0.01} fill={analogHandSecondColor} />
        )}
      </svg>
    </div>
  );
};

export default AnalogClockWidget;
