import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoAPI, activitiesAPI } from '../services/api';
import { Sparkles, Trash2, Users, AlertCircle, CheckCircle, Play, ArrowLeft } from 'lucide-react';
import { formatDistance, formatDuration } from '../utils/format';

function Demo() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState(null);
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    loadDemoUsers();
    loadStats();
  }, []);

  const loadDemoUsers = async () => {
    try {
      const response = await demoAPI.getUsers();
      const sortedUsers = response.data.sort((a, b) => b.activity_count - a.activity_count);
      setUsers(sortedUsers);
      if (sortedUsers.length > 0) {
        setSelectedUser(sortedUsers[0].user_id);
      }
    } catch (error) {
      console.error('Error loading demo users:', error);
      setMessage({
        type: 'error',
        text: 'Failed to load demo users. Please check if the CSV file exists.'
      });
    }
  };

  const loadStats = async () => {
    try {
      const response = await demoAPI.getStats();
      setStats(response.data);
      
      // Also load activities to display
      if (response.data.total_activities > 0) {
        const activitiesResponse = await activitiesAPI.list(0, 20);
        setActivities(activitiesResponse.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
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
      
      // Refresh stats and activities
      await loadStats();
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
      
      // Refresh stats and activities
      await loadStats();
      setActivities([]);
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to clear demo data'
      });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Dashboard</span>
          </button>
          
          <div className="flex items-center space-x-3 mb-2">
            <Sparkles className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">Demo Mode</h1>
          </div>
          <p className="text-lg text-gray-600">
            Load real activity data from CSV to test the recommender system
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Controls */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Load Demo Data</h2>

              {/* Current Stats */}
              {stats && stats.total_activities > 0 && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-medium text-gray-900 mb-2">
                    Current Data
                  </div>
                  <div className="space-y-1 text-sm text-gray-700">
                    <div className="flex justify-between">
                      <span>Users:</span>
                      <span className="font-semibold">{stats.total_users}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Activities:</span>
                      <span className="font-semibold">{stats.total_activities}</span>
                    </div>
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
                  disabled={loading || users.length === 0}
                >
                  {users.length === 0 ? (
                    <option>No users available</option>
                  ) : (
                    users.map((user) => (
                      <option key={user.user_id} value={user.user_id}>
                        {user.user_id} ({user.activity_count} activities, {formatDistance(user.total_distance)})
                      </option>
                    ))
                  )}
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
              <div className="space-y-3">
                <button
                  onClick={handleLoadDemo}
                  disabled={loading || !selectedUser || users.length === 0}
                  className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <Play className="h-5 w-5" />
                  <span>{loading ? 'Loading...' : 'Load Demo Data'}</span>
                </button>

                <button
                  onClick={handleClear}
                  disabled={clearing || !stats || stats.total_activities === 0}
                  className="w-full flex items-center justify-center space-x-2 bg-red-100 text-red-700 px-4 py-3 rounded-lg hover:bg-red-200 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <Trash2 className="h-5 w-5" />
                  <span>{clearing ? 'Clearing...' : 'Clear All Data'}</span>
                </button>
              </div>

              {/* Tips */}
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900 font-medium mb-2">💡 Tips:</p>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Select users with many activities (10+)</li>
                  <li>• After loading, click activities to see recommendations</li>
                  <li>• Try different strategies and diversity settings</li>
                  <li>• Clear data to test with a different user</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right Column: Activities Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Loaded Activities {activities.length > 0 && `(${activities.length})`}
              </h2>

              {activities.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No activities loaded yet</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Select a user and click "Load Demo Data" to begin
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      onClick={() => navigate(`/activities/${activity.id}`)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-gray-900 capitalize">
                            {activity.sport || 'Activity'}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {formatDistance(activity.distance_m)} • {formatDuration(activity.duration_s)}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">
                          {activity.user_id}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Demo;

