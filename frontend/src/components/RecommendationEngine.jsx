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
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2 text-white">
            <TrendingUp className="h-5 w-5" />
            <h3 className="font-bold text-lg">AI Recommendations</h3>
          </div>
          <span className="text-xs bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full text-white font-semibold">
            {recommendations.length} routes
          </span>
        </div>

        {/* Selected Activity Info */}
        <div className="text-sm text-purple-100">
          Finding similar to: <span className="font-bold capitalize text-white">{selectedActivity.sport}</span>
          {' • '}
          {selectedActivity.distance_m && <span className="text-white font-semibold">{formatDistance(selectedActivity.distance_m)}</span>}
        </div>

        {/* Change Indicator */}
        {newRoutes.length > 0 && (
          <div className="mt-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg px-3 py-2 text-sm text-white font-semibold">
            ✨ {newRoutes.length} new {newRoutes.length === 1 ? 'route' : 'routes'} discovered!
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 bg-gradient-to-br from-gray-50 to-blue-50 border-b border-gray-200 space-y-3">
        {/* Strategy */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            <Settings className="h-3 w-3 inline mr-1" />
            Strategy
          </label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className="w-full text-sm px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
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
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
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
              className="rounded text-purple-600 focus:ring-2 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-700 font-medium">🚫 Hide routes I've done</span>
          </label>
        )}
      </div>

      {/* Recommendations List */}
      <div className="p-4 max-h-96 overflow-y-auto bg-gray-50">
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
                  className={`p-3 rounded-xl border-2 transition-all transform ${
                    isNew ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md' : 'border-gray-200 bg-white'
                  } hover:shadow-lg hover:scale-102`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2 flex-1">
                      <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md ${
                        isNew ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : 
                        'bg-gradient-to-br from-blue-500 to-purple-500'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-sm text-gray-900">
                            {rec.activity_id}
                          </span>
                          {isNew && (
                            <span className="text-xs bg-gradient-to-r from-green-500 to-emerald-500 text-white px-2 py-1 rounded-full font-bold shadow-sm">
                              ✨ NEW
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
                      <div className="w-16 bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className={`h-2 rounded-full ${
                            isNew ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-blue-500 to-purple-500'
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
      <div className="p-3 bg-gradient-to-r from-gray-100 to-blue-100 border-t border-gray-200 text-xs text-gray-700">
        <div className="flex items-center justify-between">
          <span className="font-semibold">⚡ FAISS {strategy.includes('mmr') && '+ MMR Reranking'}</span>
          <span className="font-mono bg-white px-2 py-1 rounded">{strategy}</span>
        </div>
      </div>
    </div>
  );
}

export default RecommendationEngine;

