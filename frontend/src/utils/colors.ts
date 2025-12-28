
// Helper functions to generate color shades

export const parseColor = (color: string): { r: number; g: number; b: number } | null => {
  if (!color) return null;
  
  color = color.trim();

  // Hex
  if (color.startsWith('#')) {
    const hex = color.substring(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
      };
    }
  }
  
  // RGB
  if (color.toLowerCase().startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      return {
        r: parseInt(match[0]),
        g: parseInt(match[1]),
        b: parseInt(match[2]),
      };
    }
  }
  
  return null;
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => {
    const hex = Math.min(255, Math.max(0, x)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

export const normalizeColor = (color: string): string => {
    const rgb = parseColor(color);
    if (rgb) {
        return rgbToHex(rgb.r, rgb.g, rgb.b);
    }
    // Fallback for color picker
    return '#000000';
};

// Simple lighten/darken function
// percent is -1.0 to 1.0 (negative = darker, positive = lighter)
export const adjustColor = (color: string, percent: number): string => {
  const rgb = parseColor(color);
  if (!rgb) return color;

  let { r, g, b } = rgb;

  if (percent > 0) {
    // Lighten (tint) - mix with white
    r = Math.round(r + (255 - r) * percent);
    g = Math.round(g + (255 - g) * percent);
    b = Math.round(b + (255 - b) * percent);
  } else {
    // Darken (shade) - mix with black
    const p = 1 + percent; // e.g. -0.2 => 0.8
    r = Math.round(r * p);
    g = Math.round(g * p);
    b = Math.round(b * p);
  }

  return rgbToHex(Math.min(255, Math.max(0, r)), Math.min(255, Math.max(0, g)), Math.min(255, Math.max(0, b)));
};

export const generatePalette = (baseColor: string) => {
  // Normalize baseColor to ensure consistency if it works
  const normalized = normalizeColor(baseColor);
  
  // If normalization returns black but input wasn't black (parse failed), we might just use input
  // But generatePalette relies on adjustColor which relies on parseColor.
  // So if parseColor fails, we can't generate a palette effectively.
  // We'll proceed assuming valid color or fallback.
  
  const actualBase = parseColor(baseColor) ? normalized : baseColor;

  return {
    50: adjustColor(baseColor, 0.95),
    100: adjustColor(baseColor, 0.9),
    200: adjustColor(baseColor, 0.75),
    300: adjustColor(baseColor, 0.6),
    400: adjustColor(baseColor, 0.3),
    500: adjustColor(baseColor, 0.1), // Slightly lighter than base
    600: actualBase, // Base color
    700: adjustColor(baseColor, -0.1), // Slightly darker
    800: adjustColor(baseColor, -0.3),
    900: adjustColor(baseColor, -0.5),
  };
};

export const applyTheme = (primaryColor: string) => {
  const palette = generatePalette(primaryColor);
  const root = document.documentElement;

  Object.entries(palette).forEach(([key, value]) => {
    root.style.setProperty(`--color-primary-${key}`, value);
  });
};
