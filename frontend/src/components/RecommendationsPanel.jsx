import { useState, useEffect } from 'react';
import { recommendAPI } from '../services/api';
import { Sparkles, TrendingUp, AlertCircle } from 'lucide-react';
import { formatDistance, formatDuration, getSportIcon } from '../utils/format';

function RecommendationsPanel({ selectedActivity }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (selectedActivity) {
      loadRecommendations(selectedActivity.id);
    } else {
      setRecommendations([]);
    }
  }, [selectedActivity]);

  const loadRecommendations = async (activityId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await recommendAPI.getRecommendations(activityId, 5);
      setRecommendations(response.data.items);
    } catch (err) {
      console.error('Error loading recommendations:', err);
      setError('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedActivity) {
    return (
      <div className="bg-white rounded-xl p-8 text-center sticky top-8">
        <Sparkles className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Recommendations</h3>
        <p className="text-gray-600 text-sm">
          Select an activity to see similar workouts recommended by our AI
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm sticky top-8">
      <div className="flex items-center space-x-2 mb-6">
        <Sparkles className="h-6 w-6 text-strava-orange" />
        <h3 className="text-xl font-bold text-gray-900">Similar Activities</h3>
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
          <Sparkles className="h-4 w-4" />
          <span>Powered by FAISS similarity search</span>
        </div>
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

