import React, { useEffect, useState } from 'react';

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, className = '' }) => {
  const [textValue, setTextValue] = useState(value || '#000000');

  useEffect(() => {
    setTextValue(value || '#000000');
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setTextValue(newVal);
    
    // If valid hex or rgb, trigger change
    if (isValidColor(newVal)) {
      onChange(newVal);
    }
  };

  const isValidColor = (str: string) => {
    // Hex
    if (/^#[0-9A-F]{6}$/i.test(str)) return true;
    // RGB (comma or space separated)
    if (/^rgb\(\s*\d+\s*[,\s]\s*\d+\s*[,\s]\s*\d+\s*\)$/i.test(str)) return true;
    return false;
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  };

  // Helper to get hex for the color input, regardless of what's in textValue
  const getDisplayColor = (str: string) => {
    if (!str) return '#000000';
    
    // If it's already hex
    if (/^#[0-9A-F]{6}$/i.test(str)) return str;
    
    // Try parsing rgb(r, g, b) or rgb(r g b)
    const rgbMatch = str.match(/^rgb\(\s*(\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)\s*\)$/i);
    if (rgbMatch) {
      return rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]));
    }
    
    return '#000000'; // Fallback
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex items-center">
        <input
          type="color"
          value={getDisplayColor(textValue)}
          onChange={(e) => {
              const hex = e.target.value;
              setTextValue(hex);
              onChange(hex);
          }}
          className="h-9 w-12 p-0.5 border border-gray-300 rounded shadow-sm cursor-pointer bg-white"
        />
      </div>
      <input
        type="text"
        value={textValue}
        onChange={handleTextChange}
        placeholder="#RRGGBB or rgb(r,g,b)"
        className="h-9 w-40 font-mono text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 uppercase"
      />
    </div>
  );
};

export default ColorPicker;
