import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTenantSettings } from '../services/tenant';
import { applyTheme } from '../utils/colors';
import { 
  LayoutDashboard, 
  Monitor, 
  Image, 
  Settings, 
  LogOut, 
  Layers, 
  PlaySquare, 
  Calendar, 
  AppWindow, 
  LayoutTemplate,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Users,
  FileText,
  Activity,
  HeartPulse,
  FileCheck,
  Tag,
  Package
} from 'lucide-react';
import { getFullUrl } from '../utils/url';

interface NavItem {
  name: string;
  path?: string;
  icon: React.ReactNode;
  children?: NavItem[];
  module?: string;
}

const DashboardLayout = () => {
  const { user, logout, checkPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    'Content Manager': false // Default closed
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const getFullUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const base = import.meta.env.VITE_API_URL || '';
    return `${base}${url}`;
  };

  useEffect(() => {
    const applyBranding = async () => {
      try {
        const settings = await getTenantSettings();
        if (settings.config.logoUrl) {
          setLogoUrl(settings.config.logoUrl);
        }
        // Favicon and theme are now handled by global BrandingManager
      } catch (e) {
        console.error('Failed to load branding', e);
      }
    };
    applyBranding();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems: NavItem[] = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} />, module: 'dashboard' },
    { name: 'Screens', path: '/screens', icon: <Monitor size={20} />, module: 'screen' },
    { name: 'Groups', path: '/groups', icon: <Layers size={20} />, module: 'groups' },
    { 
      name: 'Content Manager', 
      icon: <Clapperboard size={20} />,
      children: [
        { name: 'Playlists', path: '/playlists', icon: <PlaySquare size={20} />, module: 'playlist' },
        { name: 'Media Library', path: '/media', icon: <Image size={20} />, module: 'library' },
        { name: 'Layouts', path: '/layouts', icon: <LayoutTemplate size={20} />, module: 'layouts' },
      ]
    },
    { name: 'Schedules', path: '/schedules', icon: <Calendar size={20} />, module: 'schedules' },
    { name: 'Widgets', path: '/widgets', icon: <AppWindow size={20} />, module: 'widgets' },
    { name: 'Team Management', path: '/team', icon: <Users size={20} />, module: 'team_management' },
    { 
      name: 'Reports', 
      icon: <FileText size={20} />,
      children: [
        { name: 'Uptime Report', path: '/reports/uptime', icon: <Activity size={20} /> },
        { name: 'Heartbeat Report', path: '/reports/heartbeat', icon: <HeartPulse size={20} /> },
        { name: 'Proof of Play', path: '/reports/proof-of-play', icon: <FileCheck size={20} /> },
      ]
    },
    { name: 'App Releases', path: '/app-releases', icon: <Package size={20} />, module: 'screen' },
    { name: 'Settings', path: '/settings', icon: <Settings size={20} />, module: 'settings' },
  ];

  // Filter items based on permissions
  const getVisibleNavItems = () => {
    // Reverted: Always return all items regardless of permissions
    return navItems;
  };

  const visibleNavItems = getVisibleNavItems();

  const toggleMenu = (name: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // Helper to find active item name for header
  const getActivePageName = () => {
    for (const item of visibleNavItems) {
      if (item.path === location.pathname) return item.name;
      if (item.children) {
        const child = item.children.find(c => c.path === location.pathname);
        if (child) return child.name;
      }
    }
    
    // Handle dynamic routes
    if (location.pathname.match(/^\/screens\/[^/]+$/)) {
      return 'Screen Settings';
    }
    
    return 'Dashboard';
  };

  const renderNavItem = (item: NavItem) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus[item.name];
    
    // Check if any child is active to highlight parent
    const isChildActive = item.children?.some(child => child.path === location.pathname);
    const isActive = item.path === location.pathname;

    if (hasChildren) {
      return (
        <div key={item.name}>
          <button
            onClick={() => toggleMenu(item.name)}
            className={`w-full flex items-center justify-between px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors ${
              isChildActive ? 'text-blue-600' : ''
            }`}
          >
            <div className="flex items-center">
              <span className="mr-3">{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </div>
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          
          {isExpanded && (
            <div className="bg-gray-50/50">
              {item.children!.map(child => (
                <Link
                  key={child.path}
                  to={child.path!}
                  className={`flex items-center pl-14 pr-6 py-2 text-sm text-gray-600 hover:text-blue-600 transition-colors ${
                    location.pathname === child.path ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600' : ''
                  }`}
                >
                  <span className="mr-3">{child.icon}</span>
                  <span className="font-medium">{child.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.path}
        to={item.path!}
        className={`flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors ${
          isActive ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600' : ''
        }`}
      >
        <span className="mr-3">{item.icon}</span>
        <span className="font-medium">{item.name}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md flex flex-col">
        <div className="p-6 border-b shrink-0 flex flex-col items-center justify-center text-center">
          {logoUrl ? (
            <img 
              src={getFullUrl(logoUrl)} 
              alt="Logo" 
              className="h-32 w-auto object-contain" 
              onError={() => setLogoUrl(null)}
            />
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <div className="bg-blue-600 p-2 rounded-lg shadow-md transform -rotate-6">
                <Tag className="text-white" size={24} />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
                Smar<span className="text-blue-600">tags</span>
              </h1>
            </div>
          )}
        </div>
        <nav className="mt-6 flex-1 overflow-y-auto">
          {visibleNavItems.map(renderNavItem)}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 py-4 bg-white shadow-sm shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">
            {getActivePageName()}
          </h2>
          <div className="flex items-center space-x-4">
            <Link to="/profile" className="text-gray-600 hover:text-blue-600 transition-colors">
              Welcome, {user?.name || 'User'}
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center text-red-500 hover:text-red-700 transition-colors"
            >
              <LogOut size={20} className="mr-1" />
              Logout
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
