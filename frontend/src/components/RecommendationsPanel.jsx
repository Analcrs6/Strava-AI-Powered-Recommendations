import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { recommendAPI } from '../services/api';
import { TrendingUp, AlertCircle, Settings, Sliders, Zap } from 'lucide-react';
import { formatDistance, formatDuration, getSportIcon } from '../utils/format';

function RecommendationsPanel({ selectedActivity }) {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [strategy, setStrategy] = useState('content_mmr');
  const [lambdaDiversity, setLambdaDiversity] = useState(0.3);
  const [metadata, setMetadata] = useState(null);
  const [recommendMode, setRecommendMode] = useState('similar'); // 'similar' or 'next'

  useEffect(() => {
    if (selectedActivity) {
      if (recommendMode === 'similar') {
        loadRecommendations(selectedActivity.id);
      } else {
        loadNextActivity();
      }
    } else if (recommendMode === 'next' && user) {
      loadNextActivity();
    } else {
      setRecommendations([]);
      setMetadata(null);
    }
  }, [selectedActivity, strategy, lambdaDiversity, recommendMode]);

  const loadRecommendations = async (activityId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await recommendAPI.getRecommendations(
        activityId, 
        10, 
        strategy,
        lambdaDiversity
      );
      setRecommendations(response.data.items);
      setMetadata(response.data.metadata);
    } catch (err) {
      console.error('Error loading recommendations:', err);
      setError('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const loadNextActivity = async () => {
    if (!user?.id) {
      setError('Please sign in to get personalized predictions');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const response = await recommendAPI.getNextActivity(
        user.id,
        10,
        strategy,
        lambdaDiversity
      );
      setRecommendations(response.data.items);
      setMetadata(response.data.metadata);
    } catch (err) {
      console.error('Error loading next activity:', err);
      setError('Failed to load next activity predictions');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedActivity && recommendMode === 'similar') {
    return (
      <div className="bg-white rounded-xl p-8 text-center sticky top-8">
        <TrendingUp className="h-16 w-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Route Recommendations</h3>
        <p className="text-slate-600 text-sm mb-4">
          • Select an activity to find similar workouts<br/>
          • Or create/record a new activity to get next-route predictions
        </p>
        {user && (
          <button
            onClick={() => setRecommendMode('next')}
            className="mt-2 bg-slate-800 text-white px-4 py-2 rounded-md text-sm hover:bg-slate-900 transition flex items-center space-x-2 mx-auto"
          >
            <Zap className="h-4 w-4" />
            <span>What to Do Next?</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm sticky top-8">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          {recommendMode === 'similar' ? (
            <TrendingUp className="h-6 w-6 text-strava-orange" />
          ) : (
            <Zap className="h-6 w-6 text-green-600" />
          )}
          <h3 className="text-xl font-bold text-gray-900">
            {recommendMode === 'similar' ? 'Similar Routes' : 'What to Do Next'}
          </h3>
        </div>
        <button
          onClick={() => setRecommendMode(recommendMode === 'similar' ? 'next' : 'similar')}
          className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-md hover:bg-slate-200 transition"
        >
          {recommendMode === 'similar' ? '→ Next Activity' : '← Find Similar'}
        </button>
      </div>

      {/* Strategy Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Settings className="h-4 w-4 inline mr-1" />
          Strategy
        </label>
        <select
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-strava-orange focus:border-transparent"
        >
          <option value="content">Pure Similarity (Fast)</option>
          <option value="content_mmr">⭐ Content + Diversity (Recommended)</option>
          <option value="ensemble">Ensemble (Future)</option>
          <option value="ensemble_mmr">Ensemble + Diversity (Future)</option>
        </select>
      </div>

      {/* Diversity Slider (only for MMR strategies) */}
      {strategy.includes('mmr') && (
        <div className="mb-4">
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
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-strava-orange"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Relevance</span>
            <span>Balanced</span>
            <span>Variety</span>
          </div>
        </div>
      )}

      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800 font-medium">
          {metadata?.description || 'Loading...'}
        </p>
        {metadata?.evaluation_notes && (
          <p className="text-xs text-blue-600 mt-1">{metadata.evaluation_notes}</p>
        )}
      </div>

      <div className="mb-4 p-4 bg-strava-gray-light rounded-lg">
        <p className="text-sm text-gray-600">
          Based on: <span className="font-medium text-gray-900 capitalize">{selectedActivity.sport}</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {formatDistance(selectedActivity.distance_m)} · {formatDuration(selectedActivity.duration_s)}
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-strava-orange"></div>
        </div>
      )}

      {error && (
        <div className="flex items-start space-x-2 p-4 bg-red-50 rounded-lg text-red-600">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">{error}</div>
        </div>
      )}

      {!loading && !error && recommendations.length === 0 && (
        <div className="text-center py-8">
          <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-600">No recommendations found</p>
        </div>
      )}

      {!loading && !error && recommendations.length > 0 && (
        <div className="space-y-3">
          {recommendations.map((rec, index) => (
            <RecommendationCard key={rec.activity_id} recommendation={rec} rank={index + 1} />
          ))}
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-100">
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <TrendingUp className="h-4 w-4" />
          <span>FAISS {strategy.includes('mmr') ? '+ MMR reranking' : 'similarity search'}</span>
        </div>
        {metadata?.uses_mmr && (
          <p className="text-xs text-gray-400 mt-1">
            λ={lambdaDiversity} balances relevance & diversity
          </p>
        )}
      </div>
    </div>
  );
}

function RecommendationCard({ recommendation, rank }) {
  const score = (recommendation.score * 100).toFixed(1);
  
  return (
    <div className="p-4 border border-gray-200 rounded-lg hover:border-strava-orange transition">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="flex items-center justify-center w-6 h-6 bg-strava-orange text-white text-xs font-bold rounded-full">
            {rank}
          </span>
          <span className="text-sm font-medium text-gray-900">{recommendation.activity_id}</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="text-right">
            <div className="text-sm font-semibold text-strava-orange">{score}%</div>
            <div className="text-xs text-gray-500">match</div>
          </div>
        </div>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
        <div 
          className="bg-gradient-to-r from-strava-orange to-orange-400 h-2 rounded-full transition-all duration-300"
          style={{ width: `${score}%` }}
        ></div>
      </div>
    </div>
  );
}

export default RecommendationsPanel;

