import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoAPI, activitiesAPI, recommendAPI } from '../services/api';
import { Sparkles, Trash2, Users, AlertCircle, CheckCircle, Play, ArrowLeft, TrendingUp, Settings, Sliders, Filter, Zap, BarChart3, Activity as ActivityIcon } from 'lucide-react';
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
  const [excludeSeen, setExcludeSeen] = useState(false);
  const [showRecommender, setShowRecommender] = useState(false);
  const [previousRecs, setPreviousRecs] = useState([]);

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
      
      if (response.data.total_activities > 0) {
        const activitiesResponse = await activitiesAPI.list(0, 50, true);
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
      
      await loadStats();
      setActivities([]);
      setSelectedActivity(null);
      setRecommendations([]);
      setShowRecommender(false);
      setPreviousRecs([]);
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
    loadRecommendations(activity);
  };

  const loadRecommendations = async (activity = selectedActivity) => {
    if (!activity) return;
    
    setRecLoading(true);
    
    try {
      const response = await recommendAPI.getRecommendations(
        activity.id,
        10,
        strategy,
        lambdaDiversity,
        excludeSeen,
        activity.user_id
      );
      
      if (recommendations.length > 0) {
        setPreviousRecs(recommendations.map(r => r.activity_id));
      }
      
      setRecommendations(response.data.items || []);
    } catch (error) {
      console.error('Error loading recommendations:', error);
      setRecommendations([]);
    } finally {
      setRecLoading(false);
    }
  };

  // Reload recommendations when strategy or settings change
  useEffect(() => {
    if (selectedActivity && showRecommender) {
      loadRecommendations();
    }
  }, [strategy, lambdaDiversity, excludeSeen]);

  const getStrategyInfo = (strat) => {
    const info = {
      content: {
        name: 'Pure Similarity',
        icon: <TrendingUp className="h-4 w-4" />,
        desc: 'Fast baseline using cosine similarity',
        color: 'blue'
      },
      content_mmr: {
        name: 'Content + Diversity',
        icon: <Sparkles className="h-4 w-4" />,
        desc: 'Best ranking quality (MAP & NDCG)',
        color: 'purple',
        badge: '⭐ RECOMMENDED'
      },
      popularity: {
        name: 'Popularity-Based',
        icon: <BarChart3 className="h-4 w-4" />,
        desc: 'Most popular routes first',
        color: 'orange'
      },
      ensemble: {
        name: 'Ensemble',
        icon: <Zap className="h-4 w-4" />,
        desc: 'Content + Collaborative (future)',
        color: 'green'
      },
      ensemble_mmr: {
        name: 'Ensemble + Diversity',
        icon: <Sparkles className="h-4 w-4" />,
        desc: 'Best coverage/recall (future)',
        color: 'indigo',
        badge: 'BEST RECALL'
      }
    };
    return info[strat] || info.content;
  };

  const newRoutes = recommendations.filter(r => !previousRecs.includes(r.activity_id));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4 transition"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Dashboard</span>
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-2">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-gray-900">Demo Lab</h1>
              </div>
              <p className="text-lg text-gray-600">
                Test the AI recommender system with real synthetic data
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* User Selection */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center space-x-2 mb-4">
                <Users className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold text-gray-900">Load Demo User</h2>
              </div>

              {stats && stats.total_activities > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-xs font-semibold text-blue-900 mb-2">Current Session</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Users:</span>
                      <span className="font-semibold text-gray-900">{stats.total_users}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Activities:</span>
                      <span className="font-semibold text-gray-900">{stats.total_activities}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select User ({users.length} available)
                  </label>
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    disabled={loading}
                  >
                    {users.length === 0 ? (
                      <option>No users available</option>
                    ) : (
                      users.map((user) => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.user_id} ({user.activity_count} activities)
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {message && (
                  <div
                    className={`p-3 rounded-lg flex items-start space-x-2 text-sm ${
                      message.type === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                    }`}
                  >
                    {message.type === 'success' ? (
                      <CheckCircle className="h-5 w-5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    )}
                    <p>{message.text}</p>
                  </div>
                )}

                <button
                  onClick={handleLoadDemo}
                  disabled={loading || !selectedUser}
                  className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  <Play className="h-5 w-5" />
                  <span>{loading ? 'Loading...' : 'Load Demo Data'}</span>
                </button>

                {stats && stats.total_activities > 0 && (
                  <button
                    onClick={handleClear}
                    disabled={clearing}
                    className="w-full flex items-center justify-center space-x-2 bg-red-50 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 transition disabled:opacity-50 disabled:cursor-not-allowed border border-red-200"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{clearing ? 'Clearing...' : 'Clear Session'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-900 font-semibold mb-2">💡 How it works:</p>
              <ul className="text-xs text-blue-800 space-y-1.5">
                <li>• Load a user's activities to test with</li>
                <li>• Click any activity to see AI recommendations</li>
                <li>• Try different strategies & diversity levels</li>
                <li>• Toggle "Hide done routes" for discovery</li>
              </ul>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Activities Grid */}
            {activities.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-100">
                <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ActivityIcon className="h-6 w-6 text-blue-600" />
                      <h2 className="text-xl font-bold text-gray-900">
                        Loaded Activities
                      </h2>
                    </div>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold">
                      {activities.length} routes
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Click any activity to get AI-powered recommendations
                  </p>
                </div>
                
                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
                    {activities.map((activity, index) => {
                      const routeId = activity.id.split('_')[1] || `#${index + 1}`;
                      const isSelected = selectedActivity?.id === activity.id;
                      
                      return (
                        <button
                          key={activity.id}
                          onClick={() => handleSelectActivity(activity)}
                          className={`text-left p-4 rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                              : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                              activity.sport === 'running' ? 'bg-orange-100 text-orange-700' :
                              activity.sport === 'cycling' ? 'bg-blue-100 text-blue-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {activity.sport}
                            </span>
                            {isSelected && (
                              <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-bold">
                                ✓ SELECTED
                              </span>
                            )}
                          </div>
                          
                          <div className="font-mono font-bold text-gray-900 mb-2">
                            Route {routeId}
                          </div>
                          
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">📏 {formatDistance(activity.distance_m)}</span>
                              <span>⏱️ {formatDuration(activity.duration_s)}</span>
                            </div>
                            {activity.elevation_gain_m > 0 && (
                              <div>⛰️ {Math.round(activity.elevation_gain_m)}m elevation</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Recommender Panel */}
            {showRecommender && selectedActivity && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-100">
                <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-6 w-6 text-purple-600" />
                      <h2 className="text-xl font-bold text-gray-900">AI Recommendations</h2>
                    </div>
                    <button
                      onClick={() => setShowRecommender(false)}
                      className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg p-3">
                    <div className="text-xs opacity-90 mb-1">Finding similar routes to:</div>
                    <div className="font-bold capitalize text-lg">{selectedActivity.sport} Activity</div>
                    <div className="text-sm opacity-90 mt-1">
                      {formatDistance(selectedActivity.distance_m)} • {formatDuration(selectedActivity.duration_s)}
                    </div>
                  </div>
                  
                  {newRoutes.length > 0 && (
                    <div className="mt-3 bg-green-50 border border-green-300 rounded-lg px-3 py-2">
                      <span className="text-sm text-green-800 font-semibold">
                        ✨ {newRoutes.length} new {newRoutes.length === 1 ? 'route' : 'routes'} discovered!
                      </span>
                    </div>
                  )}
                </div>

                {/* Strategy Controls */}
                <div className="p-5 bg-gray-50 border-b border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-2">
                        <Settings className="h-4 w-4" />
                        <span>Recommendation Strategy</span>
                      </label>
                      <select
                        value={strategy}
                        onChange={(e) => setStrategy(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="content">🎯 Pure Similarity (Fast)</option>
                        <option value="content_mmr">⭐ Content + Diversity (Best Quality)</option>
                        <option value="popularity">📊 Popularity-Based</option>
                        <option value="ensemble">⚡ Ensemble (Coming Soon)</option>
                        <option value="ensemble_mmr">🔥 Ensemble + Diversity (Coming Soon)</option>
                      </select>
                      <div className="mt-1 text-xs text-gray-500">
                        {getStrategyInfo(strategy).desc}
                      </div>
                    </div>

                    {strategy.includes('mmr') && (
                      <div>
                        <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-2">
                          <Sliders className="h-4 w-4" />
                          <span>Diversity: {lambdaDiversity.toFixed(1)}</span>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={lambdaDiversity}
                          onChange={(e) => setLambdaDiversity(parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Relevance</span>
                          <span>Balanced</span>
                          <span>Variety</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedActivity?.user_id && (
                    <div className="mt-4">
                      <label className="flex items-center space-x-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={excludeSeen}
                          onChange={(e) => setExcludeSeen(e.target.checked)}
                          className="rounded text-purple-600 focus:ring-2 focus:ring-purple-500"
                        />
                        <Filter className="h-4 w-4 text-gray-500 group-hover:text-purple-600 transition" />
                        <span className="text-sm text-gray-700 font-medium">
                          Hide routes I've already done
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Recommendations List */}
                <div className="p-5">
                  {recLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                      <p className="text-gray-600">Finding best matches...</p>
                    </div>
                  ) : recommendations.length === 0 ? (
                    <div className="text-center py-12">
                      <TrendingUp className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 font-medium">No recommendations found</p>
                      <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-gray-700 mb-3">
                        Top {recommendations.length} Similar Routes:
                      </div>
                      {recommendations.map((rec, index) => {
                        const isNew = !previousRecs.includes(rec.activity_id);
                        const scorePercent = (rec.score * 100).toFixed(1);
                        
                        return (
                          <div
                            key={`${rec.activity_id}-${index}`}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              isNew 
                                ? 'border-green-400 bg-gradient-to-r from-green-50 to-emerald-50' 
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3 flex-1">
                                <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                                  isNew ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
                                  index === 0 ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                                  'bg-gradient-to-br from-blue-500 to-purple-500'
                                }`}>
                                  {index + 1}
                                </span>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <span className="font-mono font-bold text-gray-900">
                                      {rec.activity_id}
                                    </span>
                                    {isNew && (
                                      <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-bold">
                                        NEW
                                      </span>
                                    )}
                                  </div>
                                  
                                  {rec.metadata && (
                                    <div className="flex items-center space-x-3 text-xs text-gray-600">
                                      {rec.metadata.distance_km && (
                                        <span>📏 {rec.metadata.distance_km.toFixed(1)}km</span>
                                      )}
                                      {rec.metadata.surface_type && (
                                        <span>🛤️ {rec.metadata.surface_type}</span>
                                      )}
                                      {rec.metadata.elevation_m > 0 && (
                                        <span>⛰️ {Math.round(rec.metadata.elevation_m)}m</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="text-right ml-4">
                                <div className="text-sm font-bold text-gray-900">
                                  {scorePercent}%
                                </div>
                                <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                                  <div
                                    className={`h-2 rounded-full transition-all ${
                                      isNew ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 
                                      'bg-gradient-to-r from-blue-500 to-purple-500'
                                    }`}
                                    style={{ width: `${Math.min(100, rec.score * 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="font-semibold">
                      ⚡ FAISS Vector Search {strategy.includes('mmr') && `+ MMR (λ=${lambdaDiversity})`}
                    </span>
                    <span className="font-mono bg-white px-2 py-1 rounded border border-gray-200">
                      {strategy}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {activities.length === 0 && (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-gray-100">
                <div className="max-w-md mx-auto">
                  <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                    <Users className="h-12 w-12 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    Ready to Test?
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Select a demo user and click "Load Demo Data" to start exploring AI-powered route recommendations.
                  </p>
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
