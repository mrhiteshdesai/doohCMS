import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Screens from './pages/Screens';
import ScreenDetails from './pages/ScreenDetails';
import Library from './pages/Library';
import Groups from './pages/Groups';
import GroupSettings from './pages/GroupSettings';
import Schedules from './pages/Schedules';
import Playlists from './pages/Playlists';
import Player from './pages/Player';
import PlaylistEditor from './pages/PlaylistEditor';
import Layouts from './pages/Layouts';
import LayoutEditor from './pages/LayoutEditor';
import Widgets from './pages/Widgets';
import DashboardLayout from './layouts/DashboardLayout';
import Settings from './pages/Settings/index';
import TeamManagement from './pages/TeamManagement';
import Profile from './pages/Profile';
import UptimeReport from './pages/Reports/UptimeReport';
import HeartbeatReport from './pages/Reports/HeartbeatReport';
import ProofOfPlayReport from './pages/Reports/ProofOfPlayReport';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import BrandingManager from './components/BrandingManager';

function App() {
  return (
    <AuthProvider>
      <BrandingManager />
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/player" element={<Player />} />
          
          <Route element={<ProtectedRoute />}>
            {/* Full Screen Editor Route (Outside DashboardLayout) */}
            <Route path="/playlists/:id/editor" element={<PlaylistEditor />} />
            <Route path="/layouts/:id/editor" element={<LayoutEditor />} />

            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/screens" element={<Screens />} />
              <Route path="/screens/:id" element={<ScreenDetails />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/groups/:id" element={<GroupSettings />} />
              <Route path="/media" element={<Library />} />
              <Route path="/playlists" element={<Playlists />} />
              <Route path="/layouts" element={<Layouts />} />
              <Route path="/schedules" element={<Schedules />} />
              <Route path="/widgets" element={<Widgets />} />
              <Route path="/team" element={<TeamManagement />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/reports/uptime" element={<UptimeReport />} />
              <Route path="/reports/heartbeat" element={<HeartbeatReport />} />
              <Route path="/reports/proof-of-play" element={<ProofOfPlayReport />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
