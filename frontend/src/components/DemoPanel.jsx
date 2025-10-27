import { useState, useEffect } from 'react';
import { demoAPI } from '../services/api';
import { Play, Trash2, Users, AlertCircle, CheckCircle, Sparkles, X } from 'lucide-react';
import { formatDistance, formatDuration } from '../utils/format';

function DemoPanel({ onDataLoaded, isExpanded, onToggle }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (isExpanded && users.length === 0) {
      loadDemoUsers();
    }
    if (isExpanded) {
      loadStats();
    }
  }, [isExpanded]);

  // Auto-load first user when demo mode is activated
  useEffect(() => {
    if (isExpanded && users.length > 0 && !selectedUser) {
      setSelectedUser(users[0].user_id);
      // Auto-load after a brief delay
      setTimeout(() => {
        handleAutoLoad();
      }, 500);
    }
  }, [isExpanded, users]);

  const loadDemoUsers = async () => {
    try {
      const response = await demoAPI.getUsers();
      const sortedUsers = response.data.sort((a, b) => b.activity_count - a.activity_count);
      setUsers(sortedUsers);
    } catch (error) {
      console.error('Error loading demo users:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await demoAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleAutoLoad = async () => {
    if (!users.length || stats?.total_activities > 0) return;
    
    // Auto-select user with most activities
    const bestUser = users[0];
    setSelectedUser(bestUser.user_id);
    
    setAutoLoading(true);
    setMessage(null);

    try {
      const response = await demoAPI.loadUser(bestUser.user_id);
      setMessage({
        type: 'success',
        text: `Demo activated! Loaded ${response.data.activities_loaded} activities for ${bestUser.user_id}`
      });
      
      await loadStats();
      if (onDataLoaded) {
        onDataLoaded();
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to load demo data'
      });
    } finally {
      setAutoLoading(false);
    }
  };

  const handleLoadDemo = async () => {
    if (!selectedUser) {
      setMessage({ type: 'error', text: 'Please select a user' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await demoAPI.loadUser(selectedUser);
      setMessage({
        type: 'success',
        text: response.data.message
      });
      
      await loadStats();
      if (onDataLoaded) {
        onDataLoaded();
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to load demo data'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all demo data?')) {
      return;
    }

    setClearing(true);
    setMessage(null);

    try {
      await demoAPI.clearData();
      setMessage({
        type: 'success',
        text: 'Demo data cleared successfully'
      });
      
      // Refresh stats and notify parent
      await loadStats();
      if (onDataLoaded) {
        onDataLoaded();
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to clear demo data'
      });
    } finally {
      setClearing(false);
    }
  };

  if (!isExpanded) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Sparkles className="h-7 w-7" />
              <h2 className="text-2xl font-bold">Demo Mode</h2>
            </div>
            <button
              onClick={onToggle}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <p className="text-blue-100 mt-2">
            Load real activity data from CSV to test the recommender system
          </p>
        </div>

        <div className="p-6">{autoLoading && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-sm text-blue-800 font-medium">
                Auto-loading demo data...
              </span>
            </div>
          )}

      {/* Current Stats */}
      {stats && stats.total_activities > 0 && (
        <div className="mb-4 p-3 bg-white rounded-lg border border-blue-200">
          <div className="text-sm font-medium text-gray-900 mb-2">
            Current Data
          </div>
          <div className="flex items-center space-x-4 text-xs text-gray-600">
            <span>{stats.total_users} users</span>
            <span>•</span>
            <span>{stats.total_activities} activities</span>
          </div>
        </div>
      )}

      {/* User Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Users className="h-4 w-4 inline mr-1" />
          Select Demo User
        </label>
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        >
          {users.map((user) => (
            <option key={user.user_id} value={user.user_id}>
              {user.user_id} ({user.activity_count} activities, {formatDistance(user.total_distance)})
            </option>
          ))}
        </select>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-start space-x-2 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-3">
        <button
          onClick={handleLoadDemo}
          disabled={loading || !selectedUser}
          className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          <Play className="h-5 w-5" />
          <span>{loading ? 'Loading...' : 'Load Demo Data'}</span>
        </button>

        <button
          onClick={handleClear}
          disabled={clearing || !stats || stats.total_activities === 0}
          className="flex items-center space-x-2 bg-red-100 text-red-700 px-4 py-3 rounded-lg hover:bg-red-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="h-5 w-5" />
          <span>{clearing ? 'Clearing...' : 'Clear'}</span>
        </button>
      </div>

          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 font-medium mb-2">💡 Tips:</p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Demo auto-loads the user with most activities</li>
              <li>• Select different users to test various scenarios</li>
              <li>• Click activities to see recommendations with different strategies</li>
              <li>• Clear data to start fresh with a different user</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DemoPanel;

