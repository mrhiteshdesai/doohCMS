import { createContext, useState, useEffect, useContext, ReactNode, FC } from 'react';
import { login as apiLogin, registerTenant as apiRegister } from '../services/auth';

interface AuthContextType {
  user: any;
  token: string | null;
  login: (data: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  updateUser: (userData: any) => void;
  isAuthenticated: boolean;
  checkPermission: (module: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
  }, [token]);

  const updateUser = (userData: any) => {
    const updatedUser = { ...user, ...userData };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const checkPermission = (module: string, action: string): boolean => {
    if (!user) return false;

    // Permissions are now an array of strings in format "resource:action"
    // e.g. "playlist:read", "screen:publish"
    // Wildcard "*" means full access
    
    const userPermissions = user.permissions || [];
    
    if (userPermissions.includes('*')) return true;

    // Normalize module and action
    let resource = module.toLowerCase();
    if (resource === 'team management') resource = 'team';
    
    // Map UI actions to backend permissions
    // create/update/edit -> write
    // view -> read
    // delete -> delete
    // publish -> publish
    
    let backendAction = action.toLowerCase();
    if (backendAction === 'create' || backendAction === 'update' || backendAction === 'edit') {
        backendAction = 'write';
    } else if (backendAction === 'view') {
        backendAction = 'read';
    }
    
    const permissionString = `${resource}:${backendAction}`;
    
    // Check for exact permission or resource-level wildcard (e.g. "team:*")
    return userPermissions.includes(permissionString) || userPermissions.includes(`${resource}:*`);
  };

  const login = async (data: any) => {
    const response = await apiLogin(data);
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem('user', JSON.stringify(response.user));
    localStorage.setItem('token', response.token);
  };

  const register = async (data: any) => {
    await apiRegister(data);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, updateUser, isAuthenticated: !!token, checkPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
