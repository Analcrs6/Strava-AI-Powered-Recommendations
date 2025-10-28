import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoAPI, activitiesAPI, recommendAPI } from '../services/api';
import { Sparkles, Trash2, Users, AlertCircle, CheckCircle, Play, ArrowLeft, TrendingUp, Settings, Sliders, Filter, Activity as ActivityIcon } from 'lucide-react';
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
    if (selectedActivity) {
      loadRecommendations();
    }
  }, [strategy, lambdaDiversity, excludeSeen]);

  const newRoutes = recommendations.filter(r => !previousRecs.includes(r.activity_id));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 transition"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Dashboard</span>
          </button>
          
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-slate-800 rounded-lg p-2">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Demo Lab</h1>
              <p className="text-sm text-slate-600">Test recommendation algorithms with synthetic data</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Controls */}
          <div className="lg:col-span-1 space-y-4">
            {/* User Selection */}
            <div className="bg-white rounded-lg shadow-sm p-5 border border-slate-200">
              <div className="flex items-center space-x-2 mb-4">
                <Users className="h-5 w-5 text-slate-700" />
                <h2 className="text-base font-semibold text-slate-900">Load Demo User</h2>
              </div>

              {stats && stats.total_activities > 0 && (
                <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Current Session</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Users:</span>
                      <span className="font-semibold text-slate-900">{stats.total_users}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Activities:</span>
                      <span className="font-semibold text-slate-900">{stats.total_activities}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select User ({users.length} available)
                  </label>
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm bg-white"
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
                    className={`p-3 rounded-md flex items-start space-x-2 text-sm ${
                      message.type === 'success'
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
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
                  className="w-full flex items-center justify-center space-x-2 bg-slate-800 text-white px-4 py-2.5 rounded-md hover:bg-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                >
                  <Play className="h-4 w-4" />
                  <span>{loading ? 'Loading...' : 'Load Demo Data'}</span>
                </button>

                {stats && stats.total_activities > 0 && (
                  <button
                    onClick={handleClear}
                    disabled={clearing}
                    className="w-full flex items-center justify-center space-x-2 bg-red-50 text-red-700 px-4 py-2 rounded-md hover:bg-red-100 transition disabled:opacity-50 disabled:cursor-not-allowed border border-red-200 text-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{clearing ? 'Clearing...' : 'Clear Session'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-slate-100 border border-slate-300 rounded-lg p-4">
              <p className="text-sm text-slate-900 font-semibold mb-2">How it works:</p>
              <ul className="text-xs text-slate-700 space-y-1.5 leading-relaxed">
                <li>• Load synthetic user activities</li>
                <li>• Select for similar route recommendations</li>
                <li>• Or predict next activities from history</li>
                <li>• Test strategies & diversity levels</li>
              </ul>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Activities Grid */}
            {activities.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="p-5 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ActivityIcon className="h-5 w-5 text-slate-700" />
                      <h2 className="text-lg font-semibold text-slate-900">
                        Loaded Activities
                      </h2>
                    </div>
                    <span className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-md text-sm font-semibold">
                      {activities.length}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    Click any activity to generate recommendations
                  </p>
                </div>
                
                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
                    {activities.map((activity, index) => {
                      const routeId = activity.id.split('_')[1] || `#${index + 1}`;
                      const isSelected = selectedActivity?.id === activity.id;
                      const avgSpeed = activity.duration_s > 0 ? (activity.distance_m / 1000) / (activity.duration_s / 3600) : 0;
                      const gradePercent = activity.distance_m > 0 ? (activity.elevation_gain_m / (activity.distance_m / 100)) : 0;
                      
                      return (
                        <button
                          key={activity.id}
                          onClick={() => handleSelectActivity(activity)}
                          className={`text-left p-4 rounded-lg border transition-all ${
                            isSelected
                              ? 'border-slate-900 bg-slate-50 shadow-sm'
                              : 'border-slate-200 hover:border-slate-400 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                              activity.sport === 'running' ? 'bg-orange-100 text-orange-800' :
                              activity.sport === 'cycling' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {activity.sport}
                            </span>
                            {isSelected && (
                              <span className="text-xs bg-slate-900 text-white px-2 py-0.5 rounded font-semibold">
                                SELECTED
                              </span>
                            )}
                          </div>
                          
                          <div className="font-mono font-bold text-slate-900 mb-3 text-lg">
                            {routeId}
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between text-slate-700">
                              <span className="font-semibold">{formatDistance(activity.distance_m)}</span>
                              <span className="text-slate-500">{formatDuration(activity.duration_s)}</span>
                            </div>
                            {activity.elevation_gain_m > 0 && (
                              <div className="flex items-center justify-between text-xs text-slate-600">
                                <span>Elevation: {Math.round(activity.elevation_gain_m)}m</span>
                                <span>Grade: {gradePercent.toFixed(1)}%</span>
                              </div>
                            )}
                            {avgSpeed > 0 && (
                              <div className="text-xs text-slate-500">
                                Avg Speed: {avgSpeed.toFixed(1)} km/h
                              </div>
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
            {selectedActivity && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="p-5 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5 text-slate-700" />
                      <h2 className="text-lg font-semibold text-slate-900">FAISS Vector Recommendations</h2>
                    </div>
                  </div>
                  
                  <div className="bg-slate-900 text-white rounded-lg p-4">
                    <div className="text-xs text-slate-400 mb-1">Finding similar routes to:</div>
                    <div className="font-semibold capitalize">{selectedActivity.sport} Activity</div>
                    <div className="text-sm text-slate-300 mt-1">
                      {formatDistance(selectedActivity.distance_m)} • {formatDuration(selectedActivity.duration_s)}
                      {selectedActivity.elevation_gain_m > 0 && ` • ${Math.round(selectedActivity.elevation_gain_m)}m elevation`}
                    </div>
                  </div>
                  
                  {newRoutes.length > 0 && (
                    <div className="mt-3 bg-emerald-50 border border-emerald-300 rounded-lg px-3 py-2">
                      <span className="text-sm text-emerald-800 font-semibold">
                        {newRoutes.length} new {newRoutes.length === 1 ? 'route' : 'routes'} discovered
                      </span>
                    </div>
                  )}
                </div>

                {/* Strategy Controls */}
                <div className="p-5 bg-white border-b border-slate-200">
                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center space-x-2 text-sm font-semibold text-slate-700 mb-2">
                        <Settings className="h-4 w-4" />
                        <span>Algorithm Strategy</span>
                      </label>
                      <select
                        value={strategy}
                        onChange={(e) => setStrategy(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-sm"
                      >
                        <option value="content">Pure Similarity (Fast Baseline)</option>
                        <option value="content_mmr">Content + Diversity (Recommended)</option>
                        <option value="popularity">Popularity-Based</option>
                        <option value="ensemble">Ensemble (Future)</option>
                        <option value="ensemble_mmr">Ensemble + Diversity (Future)</option>
                      </select>
                      <div className="mt-1.5 text-xs text-slate-500">
                        {strategy === 'content' && 'Fast cosine similarity matching'}
                        {strategy === 'content_mmr' && 'Best quality: Balances relevance with diversity using MMR'}
                        {strategy === 'popularity' && 'Shows most popular routes from historical data'}
                        {strategy === 'ensemble' && 'Combines content + collaborative filtering'}
                        {strategy === 'ensemble_mmr' && 'Best coverage: Ensemble with diversity reranking'}
                      </div>
                    </div>

                    {strategy.includes('mmr') && (
                      <div>
                        <label className="flex items-center space-x-2 text-sm font-semibold text-slate-700 mb-2">
                          <Sliders className="h-4 w-4" />
                          <span>Diversity Level: {lambdaDiversity.toFixed(1)}</span>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={lambdaDiversity}
                          onChange={(e) => setLambdaDiversity(parseFloat(e.target.value))}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
                        />
                        <div className="flex justify-between text-xs text-slate-600 mt-1.5">
                          <span className="font-medium">Comfort</span>
                          <span className="font-medium">Balanced</span>
                          <span className="font-medium">Explore</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1.5">
                          {lambdaDiversity <= 0.3 && 'Similar to your usual routes'}
                          {lambdaDiversity > 0.3 && lambdaDiversity < 0.7 && 'Mix of familiar and new routes'}
                          {lambdaDiversity >= 0.7 && 'Discover different route types'}
                        </p>
                      </div>
                    )}

                    {selectedActivity?.user_id && (
                      <div className="pt-2">
                        <label className="flex items-center space-x-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={excludeSeen}
                            onChange={(e) => setExcludeSeen(e.target.checked)}
                            className="rounded text-slate-700 focus:ring-2 focus:ring-slate-500"
                          />
                          <Filter className="h-4 w-4 text-slate-500 group-hover:text-slate-700 transition" />
                          <span className="text-sm text-slate-700 font-medium">
                            Hide routes I've already completed
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recommendations List */}
                <div className="p-5">
                  {recLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mb-4"></div>
                      <p className="text-slate-600">Searching vector space...</p>
                    </div>
                  ) : recommendations.length === 0 ? (
                    <div className="text-center py-12">
                      <TrendingUp className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 font-medium">No recommendations found</p>
                      <p className="text-slate-400 text-sm mt-1">Try adjusting your filters</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {recommendations.map((rec, index) => {
                        const isNew = !previousRecs.includes(rec.activity_id);
                        const scorePercent = (rec.score * 100).toFixed(1);
                        const meta = rec.metadata;
                        
                        return (
                          <div
                            key={`${rec.activity_id}-${index}`}
                            className={`p-4 rounded-lg border transition-all ${
                              isNew 
                                ? 'border-emerald-400 bg-emerald-50' 
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-3 flex-1 min-w-0">
                                <span className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
                                  isNew ? 'bg-emerald-600 text-white' :
                                  index === 0 ? 'bg-slate-900 text-white' :
                                  'bg-slate-200 text-slate-700'
                                }`}>
                                  {index + 1}
                                </span>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <span className="font-mono font-bold text-slate-900 text-sm">
                                      {rec.activity_id}
                                    </span>
                                    {isNew && (
                                      <span className="text-xs bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold">
                                        NEW
                                      </span>
                                    )}
                                  </div>
                                  
                                  {meta && (
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                                      {meta.distance_km && (
                                        <div><span className="text-slate-500">Distance:</span> <span className="font-medium">{meta.distance_km.toFixed(1)}km</span></div>
                                      )}
                                      {meta.surface_type && (
                                        <div><span className="text-slate-500">Surface:</span> <span className="font-medium capitalize">{meta.surface_type}</span></div>
                                      )}
                                      {meta.elevation_m > 0 && (
                                        <div><span className="text-slate-500">Elevation:</span> <span className="font-medium">{Math.round(meta.elevation_m)}m</span></div>
                                      )}
                                      {meta.grade_percent !== undefined && (
                                        <div><span className="text-slate-500">Grade:</span> <span className="font-medium">{meta.grade_percent.toFixed(1)}%</span></div>
                                      )}
                                      {meta.difficulty_score !== undefined && (
                                        <div><span className="text-slate-500">Difficulty:</span> <span className="font-medium">{meta.difficulty_score.toFixed(2)}/10</span></div>
                                      )}
                                      {meta.is_loop !== undefined && (
                                        <div>
                                          <span className={`font-medium ${meta.is_loop ? 'text-blue-700' : 'text-slate-600'}`}>
                                            {meta.is_loop ? '↻ Loop' : '↔ Out & Back'}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="text-right ml-4 flex-shrink-0">
                                <div className="text-sm font-bold text-slate-900 mb-1">
                                  {scorePercent}%
                                </div>
                                <div className="w-16 bg-slate-200 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${
                                      isNew ? 'bg-emerald-600' : 'bg-slate-700'
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
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 rounded-b-lg">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-mono">
                      FAISS Vector Search {strategy.includes('mmr') && `+ MMR (λ=${lambdaDiversity})`}
                    </span>
                    <span className="bg-white px-2 py-1 rounded border border-slate-200 font-mono text-slate-700">
                      {strategy}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {activities.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-slate-200">
                <div className="max-w-md mx-auto">
                  <div className="bg-slate-100 rounded-lg p-6 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <Users className="h-10 w-10 text-slate-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    Ready to Test
                  </h3>
                  <p className="text-slate-600 text-sm">
                    Select a demo user and load their activities to start testing the recommendation algorithms.
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
