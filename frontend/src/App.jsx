import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Activity, TrendingUp, Plus, Home, Sparkles, Navigation } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Dashboard from './pages/Dashboard';
import CreateActivity from './pages/CreateActivity';
import ActivityDetail from './pages/ActivityDetail';
import Demo from './pages/Demo';
import RecordActivity from './pages/RecordActivity';
import UserProfile from './pages/UserProfile';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Settings from './pages/Settings';
import Following from './pages/Following';
import Notifications from './pages/Notifications';
import Messages from './pages/Messages';
import NearbyFollowers from './pages/NearbyFollowers';
import UserProfileDropdown from './components/UserProfileDropdown';

function AppContent() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <div className="bg-orange-600 rounded-lg p-1.5">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">
                Strava<span className="text-orange-600">Recommender</span>
              </span>
            </Link>
            
            <nav className="flex items-center space-x-6">
              <Link 
                to="/" 
                className="flex items-center space-x-1 text-slate-700 hover:text-slate-900 transition"
              >
                <Home className="h-5 w-5" />
                <span>Dashboard</span>
              </Link>
              <Link 
                to="/create" 
                className="flex items-center space-x-1 text-slate-700 hover:text-slate-900 transition"
              >
                <Plus className="h-5 w-5" />
                <span>New Activity</span>
              </Link>
              <Link 
                to="/record" 
                className="flex items-center space-x-1 bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 transition"
              >
                <Navigation className="h-5 w-5" />
                <span>Record</span>
              </Link>
              <Link 
                to="/demo" 
                className="flex items-center space-x-1 bg-slate-800 text-white px-4 py-2 rounded-md hover:bg-slate-900 transition"
              >
                <Sparkles className="h-5 w-5" />
                <span>Demo</span>
              </Link>
              
              {user ? (
                <UserProfileDropdown />
              ) : (
                <Link
                  to="/login"
                  className="flex items-center space-x-1 border-2 border-slate-300 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-50 transition font-medium"
                >
                  <span>Sign In</span>
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/create" element={<CreateActivity />} />
          <Route path="/record" element={<RecordActivity />} />
          <Route path="/activity/:id" element={<ActivityDetail />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/profile/:userId" element={<UserProfile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/following" element={<Following />} />
          <Route path="/my-activities" element={<Dashboard />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/nearby" element={<NearbyFollowers />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center text-sm text-slate-600">
            <p>Strava Recommender System © 2025</p>
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-orange-600" />
              <span className="font-mono text-xs">FAISS Vector Search</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;

