import { useState, useEffect } from 'react';
import { demoAPI, activitiesAPI } from '../services/api';
import { Beaker, User, Activity, TrendingUp, X, Zap } from 'lucide-react';
import { formatDistance, formatDuration } from '../utils/format';
import RecommendationEngine from '../components/RecommendationEngine';

/**
 * Demo Page - Modern, vibrant UI for testing recommendations
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
      console.log('Loaded users:', userList.length);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                <Beaker className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Demo Lab</h1>
                <p className="text-blue-100 mt-1">Test AI recommendations with synthetic data</p>
              </div>
            </div>
            {sessionId && (
              <button
                onClick={handleClearSession}
                className="flex items-center space-x-2 px-4 py-2 bg-white/20 backdrop-blur-sm text-white border border-white/30 rounded-lg hover:bg-white/30 transition-all"
              >
                <X className="h-4 w-4" />
                <span>Clear Session</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Selection Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-100">
          <div className="flex items-center space-x-2 mb-4">
            <div className="bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg p-2">
              <User className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Select Demo User</h2>
          </div>
          
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Choose from <span className="text-blue-600">{users.length}</span> available users
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                size="1"
                style={{ maxHeight: 'none' }}
              >
                <option value="">-- Select a user --</option>
                {users.map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.user_id} • {user.activity_count} activities
                  </option>
                ))}
              </select>
            </div>
            
            <button
              onClick={handleLoadUser}
              disabled={!selectedUserId || loading}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  <span>Load User</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        {activities.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Activities List */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-pink-500 p-5">
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center space-x-3">
                      <Activity className="h-6 w-6" />
                      <div>
                        <h2 className="text-xl font-bold">
                          User Activities
                        </h2>
                        <p className="text-orange-100 text-sm">{activities.length} routes loaded</p>
                      </div>
                    </div>
                    <span className="text-xs bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full font-semibold">
                      Click for AI recommendations →
                    </span>
                  </div>
                </div>
                
                <div className="p-5 max-h-[600px] overflow-y-auto bg-gray-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activities.map((activity) => {
                      const isSelected = selectedActivity?.id === activity.id;
                      const routeId = activity.id.split('_')[1];
                      
                      return (
                        <button
                          key={activity.id}
                          onClick={() => setSelectedActivity(activity)}
                          className={`text-left p-5 rounded-xl border-2 transition-all transform ${
                            isSelected
                              ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 shadow-xl scale-105'
                              : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-lg hover:scale-102'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <span className={`text-xs font-bold px-3 py-1.5 rounded-full capitalize ${
                              activity.sport === 'cycling' ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white' :
                              activity.sport === 'running' ? 'bg-gradient-to-r from-orange-400 to-red-500 text-white' :
                              'bg-gradient-to-r from-purple-400 to-pink-500 text-white'
                            }`}>
                              {activity.sport}
                            </span>
                            {isSelected && (
                              <span className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full font-bold animate-pulse">
                                ✓ SELECTED
                              </span>
                            )}
                          </div>
                          
                          <div className="font-mono font-bold text-lg text-gray-900 mb-3 flex items-center space-x-2">
                            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                              {routeId}
                            </span>
                          </div>
                          
                          <div className="space-y-2 text-sm text-gray-700">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">📏</span>
                              <span className="font-semibold">{formatDistance(activity.distance_m)}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">⏱️</span>
                              <span className="font-semibold">{formatDuration(activity.duration_s)}</span>
                            </div>
                            {activity.elevation_gain_m > 0 && (
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">⛰️</span>
                                <span className="font-semibold">{Math.round(activity.elevation_gain_m)}m gain</span>
                              </div>
                            )}
                            {activity.hr_avg > 0 && (
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">❤️</span>
                                <span className="font-semibold">{Math.round(activity.hr_avg)} bpm</span>
                              </div>
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
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-gray-100">
            <div className="max-w-lg mx-auto">
              <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <Beaker className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Ready to Test AI Recommendations?
              </h3>
              <p className="text-gray-600 mb-6 text-lg">
                Select a demo user above and click "Load User" to start exploring personalized route recommendations.
              </p>
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6 text-left">
                <div className="flex items-center space-x-2 mb-4">
                  <Zap className="h-5 w-5 text-blue-600" />
                  <strong className="text-blue-900 text-lg">How it works:</strong>
                </div>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-600 font-bold mt-0.5">1.</span>
                    <span><strong>Choose a user</strong> with multiple activities from the dropdown</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-purple-600 font-bold mt-0.5">2.</span>
                    <span><strong>Click any activity</strong> to trigger AI-powered recommendations</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-pink-600 font-bold mt-0.5">3.</span>
                    <span><strong>Try different strategies</strong> (Content, MMR, Popularity)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-orange-600 font-bold mt-0.5">4.</span>
                    <span><strong>Adjust diversity slider</strong> to balance relevance vs variety</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-600 font-bold mt-0.5">5.</span>
                    <span><strong>Toggle "Hide routes I've done"</strong> for fresh discoveries</span>
                  </li>
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
