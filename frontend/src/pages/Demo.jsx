import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoAPI, activitiesAPI, recommendAPI } from '../services/api';
import { Sparkles, Trash2, Users, AlertCircle, CheckCircle, Play, ArrowLeft, TrendingUp, Settings, Sliders } from 'lucide-react';
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
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [strategy, setStrategy] = useState('content_mmr');
  const [lambdaDiversity, setLambdaDiversity] = useState(0.3);
  const [showRecommender, setShowRecommender] = useState(false);

  useEffect(() => {
    loadDemoUsers();
    loadStats();
  }, []);

  const loadDemoUsers = async () => {
    try {
      const response = await demoAPI.getUsers();
      const sortedUsers = response.data.users.sort((a, b) => b.activity_count - a.activity_count);
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
      
      // Also load activities to display (include demo data)
      if (response.data.total_activities > 0) {
        const activitiesResponse = await activitiesAPI.list(0, 50, true); // include_demo = true
        setActivities(activitiesResponse.data);
      } else {
        setActivities([]);
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
      const response = await demoAPI.loadData(selectedUser);
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
      const response = await demoAPI.clearSession(stats?.session_id || 'all');
      setMessage({
        type: 'success',
        text: 'Demo data cleared successfully'
      });
      
      // Refresh stats and activities
      await loadStats();
      setActivities([]);
      setSelectedActivity(null);
      setRecommendations([]);
      setShowRecommender(false);
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to clear demo data'
      });
    } finally {
      setClearing(false);
    }
  };

  const handleSelectActivity = async (activity) => {
    setSelectedActivity(activity);
    setShowRecommender(true);
    setRecLoading(true);
    setRecommendations([]);
    
    try {
      const response = await recommendAPI.getRecommendations(
        activity.id,
        10,
        strategy,
        lambdaDiversity
      );
      setRecommendations(response.data.items || []);
    } catch (error) {
      console.error('Error loading recommendations:', error);
      setRecommendations([]);
    } finally {
      setRecLoading(false);
    }
  };

  // Reload recommendations when strategy or diversity changes
  useEffect(() => {
    const loadRecommendations = async () => {
      if (!selectedActivity || !showRecommender) return;
      
      setRecLoading(true);
      setRecommendations([]);
      
      try {
        const response = await recommendAPI.getRecommendations(
          selectedActivity.id,
          10,
          strategy,
          lambdaDiversity
        );
        setRecommendations(response.data.items || []);
      } catch (error) {
        console.error('Error loading recommendations:', error);
        setRecommendations([]);
      } finally {
        setRecLoading(false);
      }
    };
    
    loadRecommendations();
  }, [selectedActivity, showRecommender, strategy, lambdaDiversity]);

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
          <p className="text-lg text-gray-600 mb-2">
            Load real activity data from CSV to test the recommender system
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900 font-medium mb-1">🎯 How it works:</p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• <strong>FAISS Index</strong> contains ALL routes from the entire dataset (~638 km of routes)</li>
              <li>• <strong>Demo Load</strong> adds ONE user's activities to test with (e.g., 50 activities)</li>
              <li>• <strong>Recommendations</strong> search the ENTIRE index, not just the loaded user's routes</li>
              <li>• This simulates real-world usage where users see all available routes, not just their own</li>
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Controls */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Load Demo Data</h2>

              {/* Current Stats */}
              {stats && stats.total_activities > 0 && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-medium text-gray-900 mb-2 flex items-center justify-between">
                    <span>Current Data</span>
                    <span className="text-xs text-blue-600 font-normal">(Demo Session)</span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex justify-between items-center">
                      <span>Demo Users:</span>
                      <span className="font-semibold">{stats.total_users}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Activities Loaded:</span>
                      <span className="font-semibold">{stats.total_activities}</span>
                    </div>
                    <div className="text-xs text-blue-700 mt-2 pt-2 border-t border-blue-300">
                      These are activities loaded from the selected demo user for testing
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
                {users.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Showing top {users.length} users by activity count
                  </p>
                )}
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
                  <li>• Select users with many activities (10+) for better testing</li>
                  <li>• Click any activity to see similar routes from the ENTIRE dataset</li>
                  <li>• Try different strategies (content vs content_mmr) to compare results</li>
                  <li>• Adjust diversity slider to see how MMR reranking works</li>
                  <li>• Clear data to test with a different user profile</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right Column: Activities & Recommender */}
          <div className="lg:col-span-2 space-y-6">
            {/* Activities List */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Loaded Activities
                </h2>
                {activities.length > 0 && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                    {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
                  </span>
                )}
              </div>

              {activities.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No activities loaded yet</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Select a user and click "Load Demo Data" to begin
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900 font-medium">💡 Click any activity to test recommendations!</p>
                    <p className="text-xs text-blue-700 mt-1">
                      The recommender system will find similar activities using FAISS + MMR
                    </p>
                    {stats && stats.total_activities > activities.length && (
                      <p className="text-xs text-blue-600 mt-2 pt-2 border-t border-blue-300">
                        📋 Showing {activities.length} of {stats.total_activities} total activities (limited for display)
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
                    {activities.map((activity, index) => {
                      // Extract meaningful ID parts for display
                      const activityNum = index + 1;
                      const idParts = activity.id.split('_');
                      const routeId = idParts[1] || activityNum;
                      
                      return (
                        <div
                          key={activity.id}
                          onClick={() => handleSelectActivity(activity)}
                          className={`p-4 border-2 rounded-lg transition cursor-pointer hover:shadow-md ${
                            selectedActivity?.id === activity.id
                              ? 'border-blue-500 bg-blue-50 shadow-md'
                              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                activity.sport === 'running' ? 'bg-orange-100 text-orange-700' :
                                activity.sport === 'hiking' ? 'bg-green-100 text-green-700' :
                                activity.sport === 'cycling' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {activity.sport?.toUpperCase() || 'ACTIVITY'}
                              </span>
                              <span className="text-xs font-mono text-gray-500">
                                #{routeId}
                              </span>
                            </div>
                            {selectedActivity?.id === activity.id && (
                              <span className="text-blue-600 text-xs font-bold">✓ SELECTED</span>
                            )}
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2 text-sm">
                              <span className="font-semibold text-gray-900">
                                {formatDistance(activity.distance_m)}
                              </span>
                              <span className="text-gray-400">•</span>
                              <span className="text-gray-600">
                                {formatDuration(activity.duration_s)}
                              </span>
                            </div>
                            
                            <div className="flex items-center space-x-3 text-xs text-gray-500">
                              {activity.elevation_gain_m > 0 && (
                                <span className="flex items-center">
                                  <span className="mr-1">↗</span>
                                  {Math.round(activity.elevation_gain_m)}m
                                </span>
                              )}
                            </div>
                            
                            {/* Activity ID tooltip */}
                            <div className="text-xs text-gray-400 truncate mt-2 pt-2 border-t border-gray-100" title={activity.id}>
                              ID: {activity.id.substring(0, 30)}...
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Recommender System Panel */}
            {showRecommender && selectedActivity && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                    <h2 className="text-xl font-bold text-gray-900">Recommendations</h2>
                  </div>
                  <button
                    onClick={() => setShowRecommender(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                {/* Selected Activity Info */}
                <div className="mb-4 p-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg">
                  <div className="text-sm opacity-90 mb-1">Finding similar activities to:</div>
                  <div className="font-bold capitalize text-lg">{selectedActivity.sport}</div>
                  <div className="text-sm opacity-90 mt-1">
                    {formatDistance(selectedActivity.distance_m)} • {formatDuration(selectedActivity.duration_s)}
                    {selectedActivity.elevation_gain_m > 0 && ` • ↗ ${Math.round(selectedActivity.elevation_gain_m)}m`}
                  </div>
                </div>

                {/* Strategy & Diversity Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Settings className="h-4 w-4 inline mr-1" />
                      Strategy
                    </label>
                    <select
                      value={strategy}
                      onChange={(e) => setStrategy(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="content">Pure Similarity (Fast)</option>
                      <option value="content_mmr">⭐ Content + Diversity (Recommended)</option>
                      <option value="popularity">Popularity</option>
                    </select>
                  </div>

                  {strategy.includes('mmr') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Sliders className="h-4 w-4 inline mr-1" />
                        Diversity: {lambdaDiversity.toFixed(1)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={lambdaDiversity}
                        onChange={(e) => setLambdaDiversity(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Relevance</span>
                        <span>Balanced</span>
                        <span>Variety</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Recommendations List */}
                {recLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : recommendations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p>No recommendations found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-xs text-green-800">
                        ✨ <strong>Searching entire route database:</strong> These recommendations come from ALL routes in the system, 
                        not just the loaded user's activities. This demonstrates how FAISS searches across the full dataset.
                      </p>
                    </div>
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Top {recommendations.length} Similar Routes from Entire Dataset:
                    </div>
                    {recommendations.map((rec, index) => (
                      <div
                        key={rec.activity_id}
                        className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="flex items-center justify-center w-7 h-7 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-bold rounded-full">
                              {index + 1}
                            </span>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {rec.activity_id}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                Match Score: {(rec.score * 100).toFixed(1)}%
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all"
                                style={{ width: `${rec.score * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer Info */}
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <TrendingUp className="h-4 w-4" />
                    <span>
                      Using FAISS vector search
                      {strategy.includes('mmr') && ` + MMR reranking (λ=${lambdaDiversity})`}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Demo;
