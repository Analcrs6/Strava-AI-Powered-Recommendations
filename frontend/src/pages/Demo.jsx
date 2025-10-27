import { useState, useEffect } from 'react';
import { demoAPI, activitiesAPI } from '../services/api';
import { Beaker, User, Activity, TrendingUp } from 'lucide-react';
import { formatDistance, formatDuration } from '../utils/format';
import RecommendationEngine from '../components/RecommendationEngine';

/**
 * Demo Page - Simplified and Clean
 * Test the recommendation system with synthetic user data
 */
function Demo() {
  // State
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await demoAPI.getUsers();
      const userList = response.data.users || [];
      setUsers(userList);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleLoadUser = async () => {
    if (!selectedUserId) return;
    
    setLoading(true);
    setActivities([]);
    setSelectedActivity(null);
    
    try {
      // Load demo data for user
      const loadResponse = await demoAPI.loadData(selectedUserId);
      setSessionId(loadResponse.data.session_id);
      
      // Fetch activities
      const actResponse = await activitiesAPI.list(0, 50, true);
      const userActivities = actResponse.data.filter(
        act => act.id.includes(loadResponse.data.session_id)
      );
      
      setActivities(userActivities);
    } catch (error) {
      console.error('Error loading demo data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSession = async () => {
    if (!sessionId) return;
    
    try {
      await demoAPI.clearSession(sessionId);
      setActivities([]);
      setSelectedActivity(null);
      setSessionId(null);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Beaker className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Demo Mode</h1>
                <p className="text-sm text-gray-600">Test recommendations with synthetic data</p>
              </div>
            </div>
            {sessionId && (
              <button
                onClick={handleClearSession}
                className="px-4 py-2 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100"
              >
                Clear Session
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Selection */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <User className="h-5 w-5 text-gray-700" />
            <h2 className="text-lg font-bold text-gray-900">Select Demo User</h2>
          </div>
          
          <div className="flex items-end space-x-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose from {users.length} users
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                size="1"
                style={{ maxHeight: 'none' }}
              >
                <option value="">-- Select a user --</option>
                {users.map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.user_id} ({user.activity_count} activities)
                  </option>
                ))}
              </select>
            </div>
            
            <button
              onClick={handleLoadUser}
              disabled={!selectedUserId || loading}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Load User'}
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        {activities.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Activities List */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Activity className="h-5 w-5 text-gray-700" />
                      <h2 className="text-lg font-bold text-gray-900">
                        Activities ({activities.length})
                      </h2>
                    </div>
                    <span className="text-xs text-gray-500">Click to get recommendations</span>
                  </div>
                </div>
                
                <div className="p-4 max-h-[600px] overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activities.map((activity) => {
                      const isSelected = selectedActivity?.id === activity.id;
                      const routeId = activity.id.split('_')[1];
                      
                      return (
                        <button
                          key={activity.id}
                          onClick={() => setSelectedActivity(activity)}
                          className={`text-left p-4 rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 shadow-md'
                              : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className={`text-xs font-semibold px-2 py-1 rounded capitalize ${
                              activity.sport === 'cycling' ? 'bg-green-100 text-green-700' :
                              activity.sport === 'running' ? 'bg-orange-100 text-orange-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              {activity.sport}
                            </span>
                            {isSelected && (
                              <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded font-bold">
                                SELECTED
                              </span>
                            )}
                          </div>
                          
                          <div className="font-mono font-bold text-gray-900 mb-2">
                            {routeId}
                          </div>
                          
                          <div className="space-y-1 text-sm text-gray-600">
                            <div>📏 {formatDistance(activity.distance_m)}</div>
                            <div>⏱️ {formatDuration(activity.duration_s)}</div>
                            {activity.elevation_gain_m > 0 && (
                              <div>⛰️ {Math.round(activity.elevation_gain_m)}m gain</div>
                            )}
                            {activity.hr_avg > 0 && (
                              <div>❤️ {Math.round(activity.hr_avg)} bpm</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations Panel */}
            <div className="lg:col-span-1">
              <div className="sticky top-8">
                <RecommendationEngine 
                  selectedActivity={selectedActivity}
                  userId={selectedUserId}
                />
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && activities.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="max-w-md mx-auto">
              <Beaker className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Data Loaded
              </h3>
              <p className="text-gray-600 mb-4">
                Select a demo user above and click "Load User" to start testing the recommendation system.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-left text-blue-800">
                <strong>💡 How it works:</strong>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>Choose a user with multiple activities</li>
                  <li>Click on any activity to see similar routes</li>
                  <li>Try different recommendation strategies</li>
                  <li>Adjust diversity to see variety vs relevance</li>
                  <li>Toggle "Hide routes I've done" for new discoveries</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Demo;
