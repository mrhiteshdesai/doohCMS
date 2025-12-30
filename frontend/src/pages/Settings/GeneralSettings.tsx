import React, { useState, useRef } from 'react';
import { TenantSettings, uploadLogo } from '../../services/tenant';
import ImageCropper from '../../components/ImageCropper';
import ColorPicker from '../../components/ColorPicker';
import { getResizedImg, getContainedImg } from '../../utils/cropImage';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { applyTheme } from '../../utils/colors';

interface Props {
  settings: TenantSettings;
  onChange: (key: string, value: any) => void;
}

const updateFavicon = (url: string) => {
  let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.getElementsByTagName('head')[0].appendChild(link);
  }
  link.href = url;
};

const GeneralSettings: React.FC<Props> = ({ settings, onChange }) => {
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => setCroppingImage(reader.result as string));
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    try {
      setIsUploading(true);
      // 1. Upload Logo
      const logoUrl = await uploadLogo(croppedBlob, 'logo.png');
      onChange('logoUrl', logoUrl);

      // 2. Generate Favicon (32x32)
      const blobUrl = URL.createObjectURL(croppedBlob);
      const faviconBlob = await getContainedImg(blobUrl, 32, 32);
      
      if (faviconBlob) {
          const faviconUrl = await uploadLogo(faviconBlob, 'favicon.png');
          onChange('faviconUrl', faviconUrl);
          updateFavicon(faviconUrl);
      }
      
      setCroppingImage(null);
    } catch (error: any) {
      console.error('Failed to upload logo', error);
      const msg = error.response?.data?.message || error.message || 'Unknown error';
      alert(`Failed to upload logo: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = () => {
     onChange('logoUrl', '');
     onChange('faviconUrl', '');
     // Optional: reset favicon to default?
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">General & Branding</h3>
        <p className="mt-1 text-sm text-gray-500">
          Personalize your CMS instance with your organization details.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
        <div className="sm:col-span-4">
          <label htmlFor="orgName" className="block text-sm font-medium text-gray-700">
            Organization Name
          </label>
          <div className="mt-1">
            <input
              type="text"
              name="orgName"
              id="orgName"
              value={settings.name || ''}
              onChange={(e) => onChange('name', e.target.value)}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="sm:col-span-6">
          <label className="block text-sm font-medium text-gray-700">CMS Logo</label>
          <div className="mt-1 flex items-center space-x-4">
            {settings.config.logoUrl ? (
              <div className="relative h-20 w-20 bg-gray-100 rounded-md border border-gray-200 flex items-center justify-center overflow-hidden group">
                <img 
                  src={settings.config.logoUrl} 
                  alt="Logo" 
                  className="h-full w-full object-contain"
                />
                <button
                  onClick={handleRemoveLogo}
                  className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={20} />
                </button>
              </div>
            ) : (
              <div className="h-20 w-20 bg-gray-100 rounded-md border border-gray-200 flex items-center justify-center text-gray-400">
                <ImageIcon size={32} />
              </div>
            )}
            
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {isUploading ? 'Uploading...' : 'Upload Logo'}
              </button>
              <p className="mt-1 text-xs text-gray-500">
                Upload a square image for best results. Used for CMS header and Favicon.
              </p>
            </div>
          </div>
        </div>

        <div className="sm:col-span-6">
          <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700">
            Primary Color
          </label>
          <div className="mt-1">
             <ColorPicker
              value={settings.config.primaryColor || '#2563eb'}
              onChange={(color) => {
                onChange('primaryColor', color);
                applyTheme(color);
              }}
            />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            This color applies to buttons, menu items, links, tabs, etc.
          </p>
        </div>

        <div className="sm:col-span-6">
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="playerBranding"
                name="playerBranding"
                type="checkbox"
                checked={settings.config.playerBranding || false}
                onChange={(e) => onChange('playerBranding', e.target.checked)}
                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="playerBranding" className="font-medium text-gray-700">
                Show Player Branding
              </label>
              <p className="text-gray-500">Show your logo on screen during boot-up or when idle.</p>
            </div>
          </div>
        </div>

        {/* --- Login Page Customization --- */}
        <div className="sm:col-span-6 border-t pt-6">
            <h3 className="text-md font-medium text-gray-900 mb-4">Login Page Customization</h3>
            
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                
                {/* Login Image */}
                <div className="sm:col-span-6">
                    <label className="block text-sm font-medium text-gray-700">Login Cover Image (Left Side)</label>
                    <div className="mt-1 flex items-center space-x-4">
                        {settings.config.loginPage?.imageUrl ? (
                            <div className="relative h-32 w-48 bg-gray-100 rounded-md border border-gray-200 overflow-hidden group">
                                <img 
                                    src={settings.config.loginPage.imageUrl} 
                                    alt="Login Cover" 
                                    className="h-full w-full object-cover"
                                />
                                <button
                                    onClick={() => {
                                        const newConfig = { ...settings.config, loginPage: { ...settings.config.loginPage, imageUrl: '' } };
                                        onChange('loginPage', newConfig.loginPage);
                                    }}
                                    className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        ) : (
                            <div className="h-32 w-48 bg-gray-100 rounded-md border border-gray-200 flex items-center justify-center text-gray-400">
                                <ImageIcon size={32} />
                            </div>
                        )}
                        
                        <div>
                            <input
                                type="file"
                                id="login-image-upload"
                                onChange={async (e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        try {
                                            setIsUploading(true);
                                            const url = await uploadLogo(e.target.files[0], `login-cover-${Date.now()}.png`);
                                            const newConfig = { 
                                                ...settings.config, 
                                                loginPage: { 
                                                    ...settings.config.loginPage, 
                                                    imageUrl: url 
                                                } 
                                            };
                                            onChange('loginPage', newConfig.loginPage);
                                        } catch (err) {
                                            console.error(err);
                                            alert('Failed to upload image');
                                        } finally {
                                            setIsUploading(false);
                                        }
                                    }
                                }}
                                accept="image/*"
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={() => document.getElementById('login-image-upload')?.click()}
                                disabled={isUploading}
                                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                {isUploading ? 'Uploading...' : 'Upload Cover Image'}
                            </button>
                            <p className="mt-1 text-xs text-gray-500">
                                Recommended size: 1000x1000px or larger.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Welcome Title */}
                <div className="sm:col-span-4">
                    <label className="block text-sm font-medium text-gray-700">Welcome Title</label>
                    <input
                        type="text"
                        value={settings.config.loginPage?.welcomeTitle || ''}
                        onChange={(e) => {
                            const newConfig = { 
                                ...settings.config, 
                                loginPage: { 
                                    ...settings.config.loginPage, 
                                    welcomeTitle: e.target.value 
                                } 
                            };
                            onChange('loginPage', newConfig.loginPage);
                        }}
                        placeholder="Welcome to Smart CMS"
                        className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                </div>

                {/* Welcome Text */}
                <div className="sm:col-span-6">
                    <label className="block text-sm font-medium text-gray-700">Welcome Text</label>
                    <textarea
                        rows={3}
                        value={settings.config.loginPage?.welcomeText || ''}
                        onChange={(e) => {
                            const newConfig = { 
                                ...settings.config, 
                                loginPage: { 
                                    ...settings.config.loginPage, 
                                    welcomeText: e.target.value 
                                } 
                            };
                            onChange('loginPage', newConfig.loginPage);
                        }}
                        placeholder="Manage your digital signage screens with ease..."
                        className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                </div>

                {/* Show Brand Logo */}
                <div className="sm:col-span-6">
                    <div className="flex items-start">
                        <div className="flex items-center h-5">
                            <input
                                id="showBrandLogo"
                                type="checkbox"
                                checked={settings.config.loginPage?.showBrandLogo ?? true}
                                onChange={(e) => {
                                    const newConfig = { 
                                        ...settings.config, 
                                        loginPage: { 
                                            ...settings.config.loginPage, 
                                            showBrandLogo: e.target.checked 
                                        } 
                                    };
                                    onChange('loginPage', newConfig.loginPage);
                                }}
                                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                        </div>
                        <div className="ml-3 text-sm">
                            <label htmlFor="showBrandLogo" className="font-medium text-gray-700">
                                Show CMS Logo on Login Form
                            </label>
                            <p className="text-gray-500">Display your organization's logo above the login fields.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="sm:col-span-4">
          <label htmlFor="supportContact" className="block text-sm font-medium text-gray-700">
            Support Contact
          </label>
          <div className="mt-1">
            <input
              type="text"
              name="supportContact"
              id="supportContact"
              value={settings.config.supportContact || ''}
              onChange={(e) => onChange('supportContact', e.target.value)}
              placeholder="support@example.com"
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>

      {croppingImage && (
        <ImageCropper
          imageSrc={croppingImage}
          aspect={undefined}
          onCancel={() => setCroppingImage(null)}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
};

export default GeneralSettings;
