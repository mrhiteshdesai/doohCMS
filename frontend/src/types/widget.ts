export interface WidgetConfig {
  // --- SHARED / BASE CONFIG (FROZEN) ---
  backgroundColor?: string;
  backgroundImage?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  aspectRatioWidth?: number;
  aspectRatioHeight?: number;
  template?: 'modern' | 'classic' | 'minimal' | 'bold' | 'glass' | 'flip' | 'plain' | 'card' | 'label' | 'border';

  // --- TIME & DATE WIDGET (FROZEN) ---
  timeFormat?: string;
  dateFormat?: string;
  showDate?: boolean;
  showTime?: boolean;

  // --- ANALOG CLOCK WIDGET (FROZEN) ---
  analogTickColor?: string;
  analogHandHourColor?: string;
  analogHandMinuteColor?: string;
  analogHandSecondColor?: string;
  analogShowSecondHand?: boolean;
  analogShape?: 'circle' | 'square';
  analogShowNumbers?: boolean;
  analogBezelColor?: string;
  analogBezelWidth?: number;

  // --- COUNTDOWN / TIMER WIDGET (FROZEN) ---
  timerTargetDate?: string;
  timerMode?: 'COUNT_UP' | 'COUNT_DOWN';
  timerLabel?: string;
  timerShowLabel?: boolean;
  timerFinishMessage?: string;

  // --- QR CODE WIDGET (FROZEN) ---
  qrMode?: 'LINK' | 'VCARD';
  qrContent?: string;
  qrErrorCorrection?: 'L' | 'M' | 'Q' | 'H';
  qrForegroundColor?: string;
  qrBackgroundColor?: string;
  qrMargin?: number;
  // vCard fields
  vcardFullName?: string;
  vcardOrganization?: string;
  vcardTitle?: string;
  vcardPhone?: string;
  vcardEmail?: string;
  vcardWebsite?: string;
  vcardAddress?: string;

  // --- YOUTUBE WIDGET ---
  youtubeUrl?: string;
  youtubeShowControls?: boolean;
  youtubeMuted?: boolean;
  youtubeLoop?: boolean;
}

export interface Widget {
  id: string;
  name: string;
  type: 'TIME_DATE' | 'ANALOG_CLOCK' | 'WEATHER' | 'NEWS' | 'QR_CODE' | 'COUNT_DOWN' | 'YOUTUBE';
  config: WidgetConfig;
  createdAt?: string;
  updatedAt?: string;
}

export interface WidgetTemplate {
  id: string;
  name: string;
  type: 'TIME_DATE' | 'ANALOG_CLOCK' | 'WEATHER' | 'NEWS' | 'QR_CODE' | 'COUNT_DOWN' | 'YOUTUBE';
  description: string;
  defaultConfig: WidgetConfig;
  previewImage?: string;
}
