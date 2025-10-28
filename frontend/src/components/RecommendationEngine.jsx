import { useState, useEffect } from 'react';
import { recommendAPI } from '../services/api';
import { TrendingUp, Settings, Sliders, Sparkles } from 'lucide-react';
import { formatDistance, formatDuration } from '../utils/format';

/**
 * Unified Recommendation Engine Component
 * Clean, minimal UI showing recommendations with strategy controls
 */
function RecommendationEngine({ selectedActivity, userId = null, compact = false }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [strategy, setStrategy] = useState('content_mmr');
  const [lambdaDiversity, setLambdaDiversity] = useState(0.3);
  const [excludeSeen, setExcludeSeen] = useState(false);
  const [previousRecs, setPreviousRecs] = useState([]);

  useEffect(() => {
    if (selectedActivity) {
      loadRecommendations();
    }
  }, [selectedActivity, strategy, lambdaDiversity, excludeSeen]);

  const loadRecommendations = async () => {
    if (!selectedActivity) return;
    
    setLoading(true);
    
    try {
      const response = await recommendAPI.getRecommendations(
        selectedActivity.id,
        10,
        strategy,
        lambdaDiversity,
        excludeSeen,
        userId
      );
      
      const newRecs = response.data.items || [];
      
      if (recommendations.length > 0) {
        setPreviousRecs(recommendations.map(r => r.activity_id));
      }
      
      setRecommendations(newRecs);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedActivity) {
    return (
      <div className="bg-white rounded-lg p-6 text-center">
        <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600 text-sm">Select an activity to see recommendations</p>
      </div>
    );
  }

  const newRoutes = recommendations.filter(r => !previousRecs.includes(r.activity_id));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-gray-900">Recommendations</h3>
          </div>
          <span className="text-xs text-gray-500">
            {recommendations.length} routes
          </span>
        </div>

        {/* Selected Activity Info */}
        <div className="text-xs text-gray-600">
          Finding similar to: <span className="font-semibold capitalize">{selectedActivity.sport}</span>
          {' • '}
          {selectedActivity.distance_m && formatDistance(selectedActivity.distance_m)}
        </div>

        {/* Change Indicator */}
        {newRoutes.length > 0 && (
          <div className="mt-2 bg-green-50 border border-green-200 rounded px-3 py-1.5 text-xs text-green-800 font-semibold">
            {newRoutes.length} new {newRoutes.length === 1 ? 'route' : 'routes'}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 bg-white border-b border-gray-200 space-y-3">
        {/* Strategy */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            <Settings className="h-3 w-3 inline mr-1" />
            Strategy
          </label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="content">Pure Similarity</option>
            <option value="content_mmr">⭐ Content + Diversity (Best)</option>
            <option value="popularity">Popularity</option>
          </select>
        </div>

        {/* Diversity Slider (MMR only) */}
        {strategy.includes('mmr') && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              <Sliders className="h-3 w-3 inline mr-1" />
              Diversity: {lambdaDiversity.toFixed(1)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={lambdaDiversity}
              onChange={(e) => setLambdaDiversity(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-0.5">
              <span>Relevance</span>
              <span>Variety</span>
            </div>
          </div>
        )}

        {/* Exclude Seen Toggle */}
        {userId && (
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={excludeSeen}
              onChange={(e) => setExcludeSeen(e.target.checked)}
              className="rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-700">Hide routes I've done</span>
          </label>
        )}
      </div>

      {/* Recommendations List */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No recommendations found
          </div>
        ) : (
          <div className="space-y-2">
            {recommendations.map((rec, index) => {
              const isNew = !previousRecs.includes(rec.activity_id);
              const scorePercent = (rec.score * 100).toFixed(1);
              
              return (
                <div
                  key={`${rec.activity_id}-${index}`}
                  className={`p-3 rounded-lg border transition-all ${
                    isNew ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
                  } hover:shadow-sm`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2 flex-1">
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        isNew ? 'bg-green-500' : 
                        index === 0 ? 'bg-yellow-500' : 
                        'bg-blue-500'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-sm text-gray-900">
                            {rec.activity_id}
                          </span>
                          {isNew && (
                            <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded font-semibold">
                              NEW
                            </span>
                          )}
                        </div>
                        
                        {rec.metadata && (
                          <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                            {rec.metadata.distance_km && (
                              <div>📏 {rec.metadata.distance_km.toFixed(1)}km</div>
                            )}
                            {rec.metadata.surface_type && (
                              <div className="inline-block mr-2">🛤️ {rec.metadata.surface_type}</div>
                            )}
                            {rec.metadata.elevation_m > 0 && (
                              <div className="inline-block">⛰️ {Math.round(rec.metadata.elevation_m)}m</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right ml-2">
                      <div className="text-xs font-semibold text-gray-700">
                        {scorePercent}%
                      </div>
                      <div className="w-16 bg-gray-200 rounded-full h-1.5 mt-1">
                        <div
                          className={`h-1.5 rounded-full ${
                            isNew ? 'bg-green-500' : 'bg-blue-500'
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
      <div className="p-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
        <div className="flex items-center justify-between">
          <span>FAISS {strategy.includes('mmr') && '+ MMR'}</span>
          <span className="font-mono">{strategy}</span>
        </div>
      </div>
    </div>
  );
}

export default RecommendationEngine;

