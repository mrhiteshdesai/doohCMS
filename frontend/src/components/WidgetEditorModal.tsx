import React, { useState, useEffect } from 'react';
import { X, Save, Type, Image as ImageIcon, Palette, Layout, Clock, Calendar, Timer, Youtube } from 'lucide-react';
import { Widget, WidgetConfig } from '../types/widget';
import TimeDateWidget from './widgets/TimeDateWidget';
import AnalogClockWidget from './widgets/AnalogClockWidget';
import CountDownWidget from './widgets/CountDownWidget';
import QRCodeWidget from './widgets/QRCodeWidget';
import YoutubeWidget from './widgets/YoutubeWidget';
import * as widgetService from '../services/widget';
import SearchableSelect from './SearchableSelect';
import ColorPicker from './ColorPicker';

interface WidgetEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialWidget?: Widget | null;
  initialType?: 'TIME_DATE' | 'ANALOG_CLOCK' | 'WEATHER' | 'NEWS' | 'QR_CODE' | 'COUNT_DOWN' | 'YOUTUBE';
}

const DEFAULT_CONFIG: WidgetConfig = {
  backgroundColor: '#ffffff',
  textColor: '#000000',
  timeFormat: '24h',
  dateFormat: 'long',
  showDate: true,
  showTime: true,
  template: 'modern',
  fontSize: 1,
  aspectRatioWidth: 16,
  aspectRatioHeight: 9,
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif',
  textAlign: 'center',
  analogTickColor: '#888888',
  analogHandHourColor: '#000000',
  analogHandMinuteColor: '#000000',
  analogHandSecondColor: '#ff4d4f',
  analogShowSecondHand: true,
  analogShape: 'circle',
  analogShowNumbers: true,
  analogBezelColor: '#e0e0e0',
  analogBezelWidth: 0,
  timerMode: 'COUNT_DOWN',
  timerShowLabel: true,
  timerLabel: 'Time Remaining',
  qrMode: 'LINK',
  qrContent: 'https://example.com',
  qrErrorCorrection: 'M',
  qrForegroundColor: '#000000',
  qrBackgroundColor: '#ffffff',
  qrMargin: 2,
  youtubeUrl: '',
  youtubeShowControls: true,
  youtubeMuted: false,
  youtubeLoop: true,
};

const TEMPLATES = [
  { id: 'modern', name: 'Modern', description: 'Clean and simple' },
  { id: 'classic', name: 'Classic', description: 'Traditional serif style' },
  { id: 'minimal', name: 'Minimal', description: 'Bare essentials' },
  { id: 'bold', name: 'Bold', description: 'Large and impactful' },
  { id: 'glass', name: 'Glassmorphic', description: 'Translucent, blurred glass panel' },
  { id: 'flip', name: 'Flip Clock', description: 'Digital flip clock style' },
];

const QR_TEMPLATES = [
  { id: 'plain', name: 'Plain', description: 'Simple QR code' },
  { id: 'card', name: 'Card', description: 'White card with shadow' },
  { id: 'label', name: 'Label', description: 'With descriptive label' },
  { id: 'border', name: 'Border', description: 'Outlined frame' },
];

const WidgetEditorModal: React.FC<WidgetEditorModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  initialWidget,
  initialType = 'TIME_DATE'
}) => {
  const [name, setName] = useState('');
  const [config, setConfig] = useState<WidgetConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialWidget) {
        setName(initialWidget.name);
        setConfig(initialWidget.config);
      } else {
        setName(`My ${initialType === 'TIME_DATE' ? 'Time & Date' : initialType.replace(/_/g, ' ')} Widget`);
        setConfig({
          ...DEFAULT_CONFIG,
          template: initialType === 'QR_CODE' ? 'plain' : 'modern'
        });
      }
    }
  }, [isOpen, initialWidget, initialType]);

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      setLoading(true);
      const widgetData = {
        name,
        type: initialWidget?.type || initialType,
        config
      };

      if (initialWidget) {
        await widgetService.updateWidget(initialWidget.id, widgetData);
      } else {
        await widgetService.createWidget(widgetData);
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to save widget:', error);
      alert(`Failed to save widget: ${error.response?.data?.message || error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (updates: Partial<WidgetConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex overflow-hidden">
        
        {/* Left Panel - Controls */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col bg-gray-50">
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {initialWidget ? 'Edit Widget' : 'Create Widget'}
              </h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Widget Name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* --- FROZEN SECTION: TIME_DATE --- */}
            {/* Content Settings (Time/Date) */}
            {initialType === 'TIME_DATE' && (
              <>
                <section>
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                    <Clock size={16} className="mr-2" /> Time Settings
                  </label>
                  <div className="space-y-3 bg-white p-3 rounded-lg border border-gray-200">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={config.showTime}
                        onChange={(e) => updateConfig({ showTime: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span className="text-sm">Show Time</span>
                    </label>
                    
                    {config.showTime && (
                       <div className="pl-6 space-y-2">
                          <label className="block text-xs text-gray-500">Format</label>
                          <SearchableSelect
                            value={config.timeFormat || ''}
                            onChange={(val) => updateConfig({ timeFormat: val as string })}
                            options={[
                              { value: 'HH:mm', label: '24 Hour (13:00)' },
                              { value: 'hh:mm A', label: '12 Hour (01:00 PM)' },
                              { value: 'HH:mm:ss', label: '24 Hour with Seconds' },
                              { value: 'hh:mm:ss A', label: '12 Hour with Seconds' }
                            ]}
                            triggerClassName="w-full px-2 py-1.5 border rounded text-sm bg-white"
                          />
                       </div>
                    )}
                  </div>
                </section>

                <section>
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                    <Calendar size={16} className="mr-2" /> Date Settings
                  </label>
                  <div className="space-y-3 bg-white p-3 rounded-lg border border-gray-200">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={config.showDate}
                        onChange={(e) => updateConfig({ showDate: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span className="text-sm">Show Date</span>
                    </label>

                    {config.showDate && (
                      <div className="pl-6 space-y-2">
                        <label className="block text-xs text-gray-500">Format</label>
                        <SearchableSelect
                          value={config.dateFormat || ''}
                          onChange={(val) => updateConfig({ dateFormat: val as string })}
                          options={[
                            { value: "short", label: "Short (23/12/2025)" },
                            { value: "medium", label: "Medium (23 Dec 2025)" },
                            { value: "long", label: "Long (23 December 2025)" },
                            { value: "full", label: "Full (Tuesday, 23 December 2025)" }
                          ]}
                          triggerClassName="w-full px-2 py-1.5 border rounded text-sm bg-white"
                        />
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

            {/* --- FROZEN SECTION: ANALOG_CLOCK --- */}
            {/* Analog Clock Options */}
            {initialType === 'ANALOG_CLOCK' && (
              <>
                <section>
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                    <Clock size={16} className="mr-2" /> Analog Clock Options
                  </label>
                  <div className="space-y-4">
                    {/* Shape & Face */}
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                       <label className="text-xs font-semibold text-gray-500 uppercase">Clock Face</label>
                       
                       {/* Shape Selection */}
                       <div className="flex items-center space-x-4">
                         <span className="text-sm text-gray-600">Shape:</span>
                         <label className="flex items-center space-x-1 cursor-pointer">
                           <input
                             type="radio"
                             name="analogShape"
                             checked={config.analogShape !== 'square'}
                             onChange={() => updateConfig({ analogShape: 'circle' })}
                           />
                           <span className="text-sm">Circle</span>
                         </label>
                         <label className="flex items-center space-x-1 cursor-pointer">
                           <input
                             type="radio"
                             name="analogShape"
                             checked={config.analogShape === 'square'}
                             onChange={() => updateConfig({ analogShape: 'square' })}
                           />
                           <span className="text-sm">Square</span>
                         </label>
                       </div>

                       {/* Show Numbers */}
                       <div className="flex items-center space-x-2">
                         <input
                           type="checkbox"
                           checked={config.analogShowNumbers ?? true}
                           onChange={(e) => updateConfig({ analogShowNumbers: e.target.checked })}
                           id="showNumbers"
                           className="rounded text-blue-600"
                         />
                         <label htmlFor="showNumbers" className="text-sm text-gray-700">Show Numbers (1-12)</label>
                       </div>
                    </div>

                    {/* Bezel Settings */}
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <label className="text-xs font-semibold text-gray-500 uppercase">Bezel / Frame</label>
                      <div className="flex items-center space-x-4">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">Color</label>
                          <ColorPicker
                            value={config.analogBezelColor || '#e0e0e0'}
                            onChange={(val) => updateConfig({ analogBezelColor: val })}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">Width (px)</label>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={config.analogBezelWidth || 0}
                            onChange={(e) => updateConfig({ analogBezelWidth: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1.5 border rounded text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Colors & Hands */}
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <label className="text-xs font-semibold text-gray-500 uppercase">Hands & Ticks</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Tick Color</label>
                          <ColorPicker
                            value={config.analogTickColor || '#888888'}
                            onChange={(val) => updateConfig({ analogTickColor: val })}
                          />
                        </div>
                        <div>
                           <label className="block text-xs text-gray-500 mb-1">Show Second Hand</label>
                           <input
                            type="checkbox"
                            checked={config.analogShowSecondHand ?? true}
                            onChange={(e) => updateConfig({ analogShowSecondHand: e.target.checked })}
                            className="h-5 w-5 rounded text-blue-600 mt-1"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Hour Hand</label>
                          <ColorPicker
                            value={config.analogHandHourColor || '#000000'}
                            onChange={(val) => updateConfig({ analogHandHourColor: val })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Minute Hand</label>
                          <ColorPicker
                            value={config.analogHandMinuteColor || '#000000'}
                            onChange={(val) => updateConfig({ analogHandMinuteColor: val })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Second Hand</label>
                          <ColorPicker
                            value={config.analogHandSecondColor || '#ff4d4f'}
                            onChange={(val) => updateConfig({ analogHandSecondColor: val })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* --- FROZEN SECTION: COUNT_DOWN --- */}
            {/* Timer Settings */}
            {initialType === 'COUNT_DOWN' && (
              <section>
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <Timer size={16} className="mr-2" /> Timer Settings
                </label>
                <div className="space-y-4 bg-white p-3 rounded-lg border border-gray-200">
                  
                  {/* Target Date/Time */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Target Date & Time</label>
                    <input
                      type="datetime-local"
                      value={config.timerTargetDate ? new Date(config.timerTargetDate).toISOString().slice(0, 16) : ''}
                      onChange={(e) => updateConfig({ timerTargetDate: new Date(e.target.value).toISOString() })}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                    />
                  </div>

                  {/* Mode */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Mode</label>
                    <div className="flex space-x-4">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="timerMode"
                                checked={config.timerMode === 'COUNT_DOWN' || !config.timerMode} 
                                onChange={() => updateConfig({ timerMode: 'COUNT_DOWN', timerLabel: 'Time Remaining' })}
                            />
                            <span className="text-sm">Count Down</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="timerMode"
                                checked={config.timerMode === 'COUNT_UP'} 
                                onChange={() => updateConfig({ timerMode: 'COUNT_UP', timerLabel: 'Time Elapsed' })}
                            />
                            <span className="text-sm">Count Up</span>
                        </label>
                    </div>
                  </div>

                  {/* Label */}
                  <div>
                     <label className="flex items-center space-x-2 mb-2">
                        <input
                          type="checkbox"
                          checked={config.timerShowLabel ?? true}
                          onChange={(e) => updateConfig({ timerShowLabel: e.target.checked })}
                          className="rounded text-blue-600"
                        />
                        <span className="text-sm text-gray-700">Show Label</span>
                     </label>
                     {config.timerShowLabel && (
                         <input
                            type="text"
                            value={config.timerLabel || ''}
                            onChange={(e) => updateConfig({ timerLabel: e.target.value })}
                            placeholder="e.g. Time Remaining"
                            className="w-full px-2 py-1.5 border rounded text-sm"
                         />
                     )}
                  </div>

                  {/* Finish Message */}
                  {config.timerMode === 'COUNT_DOWN' && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Finish Message</label>
                        <input
                            type="text"
                            value={config.timerFinishMessage || ''}
                            onChange={(e) => updateConfig({ timerFinishMessage: e.target.value })}
                            placeholder="e.g. Time is up!"
                            className="w-full px-2 py-1.5 border rounded text-sm"
                         />
                      </div>
                  )}
                </div>
              </section>
            )}

            {/* --- FROZEN SECTION: QR_CODE --- */}
            {/* QR Code Settings */}
            {initialType === 'QR_CODE' && (
              <section>
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <Layout size={16} className="mr-2" /> QR Code Settings
                </label>
                <div className="space-y-4 bg-white p-3 rounded-lg border border-gray-200">
                  {/* Mode */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Mode</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="qrMode"
                          checked={(config.qrMode || 'LINK') === 'LINK'}
                          onChange={() => updateConfig({ qrMode: 'LINK' })}
                        />
                        <span className="text-sm">Link</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="qrMode"
                          checked={config.qrMode === 'VCARD'}
                          onChange={() => updateConfig({ qrMode: 'VCARD' })}
                        />
                        <span className="text-sm">vCard</span>
                      </label>
                    </div>
                  </div>

                  {/* Link Input */}
                  {(config.qrMode || 'LINK') === 'LINK' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">URL</label>
                      <input
                        type="text"
                        placeholder="https://your-link.com"
                        value={config.qrContent || ''}
                        onChange={(e) => updateConfig({ qrContent: e.target.value })}
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter the link to encode.</p>
                    </div>
                  )}

                  {/* vCard Inputs */}
                  {config.qrMode === 'VCARD' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Full Name</label>
                          <input
                            type="text"
                            value={config.vcardFullName || ''}
                            onChange={(e) => updateConfig({ vcardFullName: e.target.value })}
                            className="w-full px-2 py-1.5 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Organization</label>
                          <input
                            type="text"
                            value={config.vcardOrganization || ''}
                            onChange={(e) => updateConfig({ vcardOrganization: e.target.value })}
                            className="w-full px-2 py-1.5 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Title</label>
                          <input
                            type="text"
                            value={config.vcardTitle || ''}
                            onChange={(e) => updateConfig({ vcardTitle: e.target.value })}
                            className="w-full px-2 py-1.5 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Phone</label>
                          <input
                            type="text"
                            value={config.vcardPhone || ''}
                            onChange={(e) => updateConfig({ vcardPhone: e.target.value })}
                            className="w-full px-2 py-1.5 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Email</label>
                          <input
                            type="email"
                            value={config.vcardEmail || ''}
                            onChange={(e) => updateConfig({ vcardEmail: e.target.value })}
                            className="w-full px-2 py-1.5 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Website</label>
                          <input
                            type="text"
                            value={config.vcardWebsite || ''}
                            onChange={(e) => updateConfig({ vcardWebsite: e.target.value })}
                            className="w-full px-2 py-1.5 border rounded text-sm"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Address</label>
                          <input
                            type="text"
                            value={config.vcardAddress || ''}
                            onChange={(e) => updateConfig({ vcardAddress: e.target.value })}
                            className="w-full px-2 py-1.5 border rounded text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* QR Appearance */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Error Correction</label>
                      <SearchableSelect
                        value={config.qrErrorCorrection || 'M'}
                        onChange={(val) => updateConfig({ qrErrorCorrection: val as any })}
                        options={[
                          { value: "L", label: "L (Low)" },
                          { value: "M", label: "M (Medium)" },
                          { value: "Q", label: "Q (Quartile)" },
                          { value: "H", label: "H (High)" }
                        ]}
                        triggerClassName="w-full px-2 py-1.5 border rounded text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Margin</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={config.qrMargin ?? 2}
                        onChange={(e) => updateConfig({ qrMargin: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">QR Color</label>
                      <ColorPicker
                        value={config.qrForegroundColor || '#000000'}
                        onChange={(val) => updateConfig({ qrForegroundColor: val })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Background Color</label>
                      <ColorPicker
                        value={config.qrBackgroundColor || '#ffffff'}
                        onChange={(val) => updateConfig({ qrBackgroundColor: val })}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* YouTube Settings */}
            {initialType === 'YOUTUBE' && (
              <section>
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <Youtube size={16} className="mr-2" /> YouTube Settings
                </label>
                <div className="space-y-4 bg-white p-3 rounded-lg border border-gray-200">
                  {/* URL Input */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Video URL</label>
                    <input
                      type="text"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={config.youtubeUrl || ''}
                      onChange={(e) => updateConfig({ youtubeUrl: e.target.value })}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">Supports standard, embed, and short URLs.</p>
                  </div>

                  {/* Options */}
                  <div className="space-y-3">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.youtubeShowControls ?? true}
                        onChange={(e) => updateConfig({ youtubeShowControls: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span className="text-sm">Show Player Controls</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.youtubeMuted ?? false}
                        onChange={(e) => updateConfig({ youtubeMuted: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span className="text-sm">Mute Audio</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.youtubeLoop ?? true}
                        onChange={(e) => updateConfig({ youtubeLoop: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span className="text-sm">Loop Video</span>
                    </label>
                  </div>
                </div>
              </section>
            )}

            {/* Design Settings */}
            <>
                {/* Templates */}
                {(initialType === 'TIME_DATE' || initialType === 'COUNT_DOWN' || initialType === 'QR_CODE') && (
                  <section>
                    <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                      <Layout size={16} className="mr-2" /> Template
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {(initialType === 'QR_CODE' ? QR_TEMPLATES : TEMPLATES).map(template => (
                        <button
            key={template.id}
            onClick={() => updateConfig({ template: template.id as any })}
            className={`p-3 text-left border rounded-lg transition-all ${
              config.template === template.id 
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                : 'border-gray-200 hover:border-gray-300 hover:bg-white'
            }`}
          >
                          <div className="font-medium text-sm text-gray-900">{template.name}</div>
                          <div className="text-xs text-gray-500">{template.description}</div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {initialType !== 'QR_CODE' && (
                  <>
                    {/* Colors */}
                    <section>
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                    <Palette size={16} className="mr-2" /> Colors
                  </label>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Background Color</label>
                      <ColorPicker
                        value={config.backgroundColor || ''}
                        onChange={(val) => updateConfig({ backgroundColor: val, backgroundImage: undefined })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Text Color</label>
                      <ColorPicker
                        value={config.textColor || ''}
                        onChange={(val) => updateConfig({ textColor: val })}
                      />
                    </div>
                  </div>
                </section>

                {/* Typography */}
                <section>
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                    <Type size={16} className="mr-2" /> Typography
                  </label>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Font Family</label>
                      <SearchableSelect
                        value={config.fontFamily || ''}
                        onChange={(val) => updateConfig({ fontFamily: val as string })}
                        options={[
                          { value: "system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif", label: "System Sans" },
                          { value: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace", label: "Monospace" },
                          { value: "Georgia, Cambria, Times New Roman, Times, serif", label: "Serif" },
                          { value: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif", label: "Inter" },
                          { value: "Lato, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif", label: "Lato" },
                          { value: "Montserrat, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif", label: "Montserrat" },
                          { value: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif", label: "Poppins" },
                          { value: "Merriweather, Georgia, Cambria, Times New Roman, Times, serif", label: "Merriweather" },
                          { value: "Roboto Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace", label: "Roboto Mono" }
                        ]}
                        triggerClassName="w-full px-2 py-1.5 border rounded text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Text Alignment</label>
                      <div className="flex items-center space-x-2">
                        <label className="flex items-center space-x-1">
                          <input
                            type="radio"
                            name="textAlign"
                            checked={(config.textAlign || 'center') === 'left'}
                            onChange={() => updateConfig({ textAlign: 'left' })}
                          />
                          <span className="text-sm">Left</span>
                        </label>
                        <label className="flex items-center space-x-1">
                          <input
                            type="radio"
                            name="textAlign"
                            checked={(config.textAlign || 'center') === 'center'}
                            onChange={() => updateConfig({ textAlign: 'center' })}
                          />
                          <span className="text-sm">Center</span>
                        </label>
                        <label className="flex items-center space-x-1">
                          <input
                            type="radio"
                            name="textAlign"
                            checked={(config.textAlign || 'center') === 'right'}
                            onChange={() => updateConfig({ textAlign: 'right' })}
                          />
                          <span className="text-sm">Right</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </section>
                  </>
                )}

                {/* Aspect Ratio */}
                <section>
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                    <Layout size={16} className="mr-2" /> Aspect Ratio
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min={1}
                      value={config.aspectRatioWidth || 16}
                      onChange={(e) => updateConfig({ aspectRatioWidth: parseInt(e.target.value || '16', 10) })}
                      className="w-20 px-2 py-1 border rounded text-sm"
                    />
                    <span className="text-gray-500">:</span>
                    <input
                      type="number"
                      min={1}
                      value={config.aspectRatioHeight || 9}
                      onChange={(e) => updateConfig({ aspectRatioHeight: parseInt(e.target.value || '9', 10) })}
                      className="w-20 px-2 py-1 border rounded text-sm"
                    />
                  </div>
                </section>

                {initialType !== 'QR_CODE' && (
                  <>
                    {/* Background Image */}
                    <section>
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                    <ImageIcon size={16} className="mr-2" /> Background Image
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Image URL"
                      value={config.backgroundImage || ''}
                      onChange={(e) => updateConfig({ backgroundImage: e.target.value || undefined })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                    <p className="text-xs text-gray-500">Enter a URL for a background image.</p>
                  </div>
                </section>
                
                {/* Font Size */}
                <section>
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                    <Type size={16} className="mr-2" /> Font Scale
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={config.fontSize || 1}
                    onChange={(e) => updateConfig({ fontSize: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Small</span>
                    <span>Normal</span>
                    <span>Large</span>
                  </div>
                </section>
                  </>
                )}

            {/* End of Design Settings */}
            </>
          </div>

          <div className="p-4 border-t border-gray-200 bg-white">
            <button
              onClick={handleSave}
              disabled={loading || !name}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} className="mr-2" />
              {loading ? 'Saving...' : 'Save Widget'}
            </button>
          </div>
        </div>

        {/* Right Panel - Preview */}
        <div className="w-2/3 bg-gray-100 p-8 flex flex-col">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-lg font-semibold text-gray-700">Live Preview</h3>
             <div className="text-sm text-gray-500">
                Aspect Ratio: {config.aspectRatioWidth || 16}:{config.aspectRatioHeight || 9}
             </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center bg-gray-200/50 rounded-xl border-2 border-dashed border-gray-300 p-8 overflow-hidden">
            <div 
              className="shadow-2xl rounded-lg overflow-hidden bg-white relative"
              style={{
                 aspectRatio: `${config.aspectRatioWidth || 16} / ${config.aspectRatioHeight || 9}`,
                 width: '100%',
                 maxHeight: '100%',
                 maxWidth: '100%'
              }}
            >
               <div className="absolute inset-0 w-full h-full">
               {initialType === 'TIME_DATE' ? (
                  <TimeDateWidget config={config} />
               ) : initialType === 'ANALOG_CLOCK' ? (
                  <AnalogClockWidget config={config} />
               ) : initialType === 'COUNT_DOWN' ? (
                  <CountDownWidget config={config} />
               ) : initialType === 'QR_CODE' ? (
                  <QRCodeWidget config={config} />
               ) : initialType === 'YOUTUBE' ? (
                  <YoutubeWidget config={config} />
               ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    Preview not available for this widget type yet.
                  </div>
               )}
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WidgetEditorModal;
