import React from 'react';
import { TenantSettings } from '../../services/tenant';
import { SystemSettings as ISystemSettings } from '../../services/systemSettings';

interface Props {
  settings: TenantSettings;
  systemSettings?: ISystemSettings;
  retentionPolicies?: Record<string, number>;
  onChange: (key: string, value: any) => void;
  onSystemChange?: (key: string, value: any) => void;
  onRetentionChange?: (table: string, days: number) => void;
}

const StorageSettings: React.FC<Props> = ({ settings, systemSettings, retentionPolicies, onChange, onSystemChange, onRetentionChange }) => {
  const isS3 = systemSettings?.storage.provider === 's3';

  return (
    <div className="space-y-8">
      {/* System Storage Configuration (Admin Only usually, but we expose it here if systemSettings is passed) */}
      {systemSettings && onSystemChange && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Storage Provider Configuration</h3>
          
          <div className="space-y-4">
             <div>
                <label htmlFor="provider" className="block text-sm font-medium text-gray-700">Storage Provider</label>
                <select
                    id="provider"
                    value={systemSettings.storage.provider}
                    onChange={(e) => onSystemChange('provider', e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                    <option value="local">Local Filesystem</option>
                    <option value="s3">AWS S3 / Compatible</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                    {isS3 ? 'Files will be stored in the configured S3 bucket.' : 'Files will be stored in the local server "uploads" directory.'}
                </p>
             </div>

             {isS3 && (
                 <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium text-gray-700">Bucket Name</label>
                        <input
                            type="text"
                            value={systemSettings.storage.bucket || ''}
                            onChange={(e) => onSystemChange('bucket', e.target.value)}
                            className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium text-gray-700">Region</label>
                        <input
                            type="text"
                            value={systemSettings.storage.region || ''}
                            onChange={(e) => onSystemChange('region', e.target.value)}
                            placeholder="us-east-1"
                            className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Endpoint (Optional)</label>
                        <input
                            type="text"
                            value={systemSettings.storage.endpoint || ''}
                            onChange={(e) => onSystemChange('endpoint', e.target.value)}
                            placeholder="https://s3.amazonaws.com"
                            className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                        <p className="mt-1 text-xs text-gray-500">Required for MinIO, Supabase Storage, DigitalOcean Spaces, etc.</p>
                    </div>
                     <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium text-gray-700">Access Key ID</label>
                        <input
                            type="password"
                            value={systemSettings.storage.accessKeyId || ''}
                            onChange={(e) => onSystemChange('accessKeyId', e.target.value)}
                            placeholder={systemSettings.storage.hasAccessKeyId ? '********' : ''}
                            className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                    </div>
                     <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium text-gray-700">Secret Access Key</label>
                        <input
                            type="password"
                            value={systemSettings.storage.secretAccessKey || ''}
                            onChange={(e) => onSystemChange('secretAccessKey', e.target.value)}
                            placeholder={systemSettings.storage.hasSecretAccessKey ? '********' : ''}
                            className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                    </div>
                 </div>
             )}
             {/* CDN Settings */}
             <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-md font-medium text-gray-900 mb-4">Content Delivery Network (CDN)</h4>
                <div className="flex items-start">
                    <div className="flex items-center h-5">
                        <input
                            id="cdnEnabled"
                            type="checkbox"
                            checked={systemSettings.cdn?.enabled || false}
                            onChange={(e) => onSystemChange('cdn', { ...systemSettings.cdn, enabled: e.target.checked })}
                            className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                        />
                    </div>
                    <div className="ml-3 text-sm">
                        <label htmlFor="cdnEnabled" className="font-medium text-gray-700">Enable CDN</label>
                        <p className="text-gray-500">Serve media files via a CDN for better performance.</p>
                    </div>
                </div>
                
                {systemSettings.cdn?.enabled && (
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700">CDN Base URL</label>
                        <input
                            type="text"
                            value={systemSettings.cdn?.baseUrl || ''}
                            onChange={(e) => onSystemChange('cdn', { ...systemSettings.cdn, baseUrl: e.target.value })}
                            className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            placeholder="https://cdn.example.com"
                        />
                    </div>
                )}
             </div>

             {/* Traffic Shaping */}
             <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-md font-medium text-gray-900 mb-4">Traffic Shaping</h4>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Download Jitter (Seconds)</label>
                    <input
                        type="number"
                        min="0"
                        value={systemSettings.traffic?.downloadJitter || 0}
                        onChange={(e) => onSystemChange('traffic', { ...systemSettings.traffic, downloadJitter: parseInt(e.target.value) || 0 })}
                        className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Random delay added to media downloads to prevent "Thundering Herd" issues when many screens update simultaneously.
                    </p>
                </div>
             </div>

            {/* Data Retention Policies */}
            {retentionPolicies && onRetentionChange && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-md font-medium text-gray-900 mb-4">Data Retention Policies (Automation)</h4>
                    <p className="text-sm text-gray-500 mb-4">
                        Configure how long the system keeps historical data. Older data will be automatically deleted.
                    </p>
                    
                    <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">Screen Logs Retention (Days)</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <input
                                    type="number"
                                    min="1"
                                    value={retentionPolicies['ScreenLog'] || 30}
                                    onChange={(e) => onRetentionChange('ScreenLog', parseInt(e.target.value) || 0)}
                                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md"
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-sm">days</span>
                                </div>
                            </div>
                            <p className="mt-1 text-xs text-gray-500">Default: 30 days</p>
                        </div>

                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">Proof of Play Retention (Days)</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <input
                                    type="number"
                                    min="1"
                                    value={retentionPolicies['ProofOfPlay'] || 90}
                                    onChange={(e) => onRetentionChange('ProofOfPlay', parseInt(e.target.value) || 0)}
                                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md"
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-sm">days</span>
                                </div>
                            </div>
                            <p className="mt-1 text-xs text-gray-500">Default: 90 days</p>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </div>
      )}

      {/* Tenant S3 Configuration (Legacy/Fallback or Bring Your Own Storage) */}
      {!systemSettings && (
         <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
           <h3 className="text-lg font-medium text-gray-900 mb-4">Tenant Storage Settings</h3>
           <p className="text-sm text-gray-500 mb-4">
             Configure your storage preferences. If System Settings are available, those will take precedence.
           </p>
           
           <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
             <div className="sm:col-span-3">
               <label htmlFor="awsAccessKeyId" className="block text-sm font-medium text-gray-700">
                 AWS Access Key ID
               </label>
               <div className="mt-1">
                 <input
                   type="password"
                   name="awsAccessKeyId"
                   id="awsAccessKeyId"
                   value={settings.config.awsAccessKeyId || ''}
                   onChange={(e) => onChange('awsAccessKeyId', e.target.value)}
                   className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                 />
               </div>
             </div>

             <div className="sm:col-span-3">
               <label htmlFor="awsSecretAccessKey" className="block text-sm font-medium text-gray-700">
                 AWS Secret Access Key
               </label>
               <div className="mt-1">
                 <input
                   type="password"
                   name="awsSecretAccessKey"
                   id="awsSecretAccessKey"
                   value={settings.config.awsSecretAccessKey || ''}
                   onChange={(e) => onChange('awsSecretAccessKey', e.target.value)}
                   className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                 />
               </div>
             </div>

             <div className="sm:col-span-3">
               <label htmlFor="awsRegion" className="block text-sm font-medium text-gray-700">
                 AWS Region
               </label>
               <div className="mt-1">
                 <input
                   type="text"
                   name="awsRegion"
                   id="awsRegion"
                   value={settings.config.awsRegion || ''}
                   onChange={(e) => onChange('awsRegion', e.target.value)}
                   placeholder="us-east-1"
                   className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                 />
               </div>
             </div>

             <div className="sm:col-span-3">
               <label htmlFor="awsBucket" className="block text-sm font-medium text-gray-700">
                 S3 Bucket Name
               </label>
               <div className="mt-1">
                 <input
                   type="text"
                   name="awsBucket"
                   id="awsBucket"
                   value={settings.config.awsBucket || ''}
                   onChange={(e) => onChange('awsBucket', e.target.value)}
                   className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                 />
               </div>
             </div>
             
              <div className="sm:col-span-6">
               <label htmlFor="awsFolderPrefix" className="block text-sm font-medium text-gray-700">
                 Folder Prefix (Optional)
               </label>
               <div className="mt-1">
                 <input
                   type="text"
                   name="awsFolderPrefix"
                   id="awsFolderPrefix"
                   value={settings.config.awsFolderPrefix || ''}
                   onChange={(e) => onChange('awsFolderPrefix', e.target.value)}
                   placeholder="media/"
                   className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                 />
               </div>
               <p className="mt-2 text-sm text-gray-500">
                 Optional prefix for all uploaded files (e.g. "tenant-1/").
               </p>
             </div>
           </div>
         </div>
      )}

      {/* Existing Tenant Cleanup Settings */}
      <div>
        <h3 className="text-lg font-medium text-gray-900">Maintenance Policy</h3>
        <p className="mt-1 text-sm text-gray-500">
          Manage system health and auto-cleanup rules.
        </p>
      </div>

      <div className="bg-gray-50 p-4 rounded-md">
         <h4 className="text-sm font-medium text-gray-900">Storage Usage (Estimated)</h4>
         <div className="mt-2 relative pt-1">
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
                <div style={{ width: "30%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"></div>
            </div>
             <div className="flex justify-between text-xs text-gray-600">
                <span>Used: 1.2 GB</span>
                <span>Total: 5.0 GB</span>
             </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
        <div className="sm:col-span-6">
           <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="autoCleanup"
                name="autoCleanup"
                type="checkbox"
                checked={settings.config.autoCleanup || false}
                onChange={(e) => onChange('autoCleanup', e.target.checked)}
                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="autoCleanup" className="font-medium text-gray-700">
                Auto-Cleanup
              </label>
              <p className="text-gray-500">Automatically delete media not used in any playlist.</p>
            </div>
          </div>
        </div>

        {settings.config.autoCleanup && (
           <div className="sm:col-span-3">
            <label htmlFor="cleanupDays" className="block text-sm font-medium text-gray-700">
              Delete after (days)
            </label>
            <div className="mt-1">
              <input
                type="number"
                name="cleanupDays"
                id="cleanupDays"
                min="1"
                value={settings.config.cleanupDays || 30}
                onChange={(e) => onChange('cleanupDays', parseInt(e.target.value))}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>
        )}
      </div>
      
      <div className="border-t border-gray-200 pt-6">
         <h4 className="text-sm font-medium text-red-800">Danger Zone</h4>
         <div className="mt-4">
            <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                onClick={() => alert('Clear cache trigger not implemented yet')}
            >
                Clear Screen Caches
            </button>
            <p className="mt-1 text-xs text-gray-500">Force all screens to re-download content on next check-in.</p>
         </div>
      </div>
    </div>
  );
};

export default StorageSettings;
