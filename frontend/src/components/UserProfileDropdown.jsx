import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Settings, LogOut, Activity, Users, Bell, MessageSquare } from 'lucide-react';

function UserProfileDropdown() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRandomColor = (userId) => {
    const colors = [
      'bg-blue-600',
      'bg-purple-600',
      'bg-pink-600',
      'bg-red-600',
      'bg-orange-600',
      'bg-yellow-600',
      'bg-green-600',
      'bg-teal-600',
      'bg-cyan-600',
      'bg-indigo-600',
    ];
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 focus:outline-none hover:opacity-80 transition"
      >
        {user.profile_image_url ? (
          <img
            src={user.profile_image_url}
            alt={user.name}
            className="h-9 w-9 rounded-full border-2 border-slate-200"
          />
        ) : (
          <div className={`h-9 w-9 rounded-full ${getRandomColor(user.id)} flex items-center justify-center border-2 border-slate-200`}>
            <span className="text-white text-sm font-semibold">{getInitials(user.name)}</span>
          </div>
        )}
        <span className="text-sm font-medium text-slate-900 hidden md:block">{user.name}</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              {user.profile_image_url ? (
                <img
                  src={user.profile_image_url}
                  alt={user.name}
                  className="h-12 w-12 rounded-full"
                />
              ) : (
                <div className={`h-12 w-12 rounded-full ${getRandomColor(user.id)} flex items-center justify-center`}>
                  <span className="text-white font-semibold text-lg">{getInitials(user.name)}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 truncate">{user.name}</div>
                <div className="text-xs text-slate-500 truncate">{user.email}</div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={() => {
                navigate(`/profile/${user.id}`);
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              <User className="h-4 w-4" />
              <span>My Profile</span>
            </button>

            <button
              onClick={() => {
                navigate('/my-activities');
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              <Activity className="h-4 w-4" />
              <span>My Activities</span>
            </button>

            <button
              onClick={() => {
                navigate('/following');
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              <Users className="h-4 w-4" />
              <span>Following</span>
            </button>

            <button
              onClick={() => {
                navigate('/notifications');
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              <Bell className="h-4 w-4" />
              <span>Notifications</span>
            </button>

            <button
              onClick={() => {
                navigate('/messages');
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Messages</span>
            </button>

            <button
              onClick={() => {
                navigate('/settings');
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>
          </div>

          {/* Logout */}
          <div className="border-t border-slate-200 pt-1 mt-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserProfileDropdown;

