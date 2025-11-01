import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { activitiesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Save, X, Activity, Navigation, Edit } from 'lucide-react';

function CreateActivity() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Redirect to login if not authenticated
  if (!authLoading && !user) {
    navigate('/login');
    return null;
  }

  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-strava-orange"></div>
          <span className="ml-2">Loading...</span>
        </div>
      </div>
    );
  }
  
  const [formData, setFormData] = useState({
    sport: 'running',
    distance_m: '',
    duration_s: '',
    elevation_gain_m: '',
    hr_avg: '',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        sport: formData.sport,
        distance_m: parseFloat(formData.distance_m),
        duration_s: parseFloat(formData.duration_s),
        elevation_gain_m: formData.elevation_gain_m ? parseFloat(formData.elevation_gain_m) : 0,
        hr_avg: formData.hr_avg ? parseFloat(formData.hr_avg) : 0,
        features: {}
      };

      await activitiesAPI.create(payload);
      navigate('/');
    } catch (err) {
      console.error('Error creating activity:', err);
      setError(err.response?.data?.detail || 'Failed to create activity');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Method Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <button
          onClick={() => navigate('/record')}
          className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-8 text-left shadow-lg hover:shadow-xl hover:scale-105 transition-all group"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 group-hover:bg-white/30 transition">
              <Navigation className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Record Activity</h2>
          </div>
          <p className="text-orange-100 mb-4">
            Track your workout in real-time with GPS mapping, live stats, and automatic distance calculation.
          </p>
          <span className="inline-block bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg font-semibold">
            🎯 Recommended
          </span>
        </button>

        <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 shadow-lg">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-gray-100 rounded-xl p-3">
              <Edit className="h-8 w-8 text-gray-700" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Manual Entry</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Enter activity details manually if you already have the data or prefer not to use GPS tracking.
          </p>
          <span className="inline-block bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-semibold">
            ⌨️ Fill form below
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
        <div className="flex items-center space-x-3 mb-8">
          <Activity className="h-8 w-8 text-strava-orange" />
          <h1 className="text-3xl font-bold text-gray-900">Manual Activity Entry</h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sport *
            </label>
            <select
              name="sport"
              required
              value={formData.sport}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-strava-orange focus:border-transparent"
            >
              <option value="running">🏃 Running</option>
              <option value="cycling">🚴 Cycling</option>
              <option value="swimming">🏊 Swimming</option>
              <option value="hiking">🥾 Hiking</option>
              <option value="walking">🚶 Walking</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Distance (meters) *
              </label>
              <input
                type="number"
                name="distance_m"
                required
                step="0.01"
                value={formData.distance_m}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-strava-orange focus:border-transparent"
                placeholder="e.g., 5000"
              />
              <p className="mt-1 text-xs text-gray-500">
                {formData.distance_m && `${(formData.distance_m / 1000).toFixed(2)} km`}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (seconds) *
              </label>
              <input
                type="number"
                name="duration_s"
                required
                step="0.01"
                value={formData.duration_s}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-strava-orange focus:border-transparent"
                placeholder="e.g., 1800"
              />
              <p className="mt-1 text-xs text-gray-500">
                {formData.duration_s && `${Math.floor(formData.duration_s / 60)} minutes`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Elevation Gain (meters)
              </label>
              <input
                type="number"
                name="elevation_gain_m"
                step="0.01"
                value={formData.elevation_gain_m}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-strava-orange focus:border-transparent"
                placeholder="e.g., 250"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Average Heart Rate (bpm)
              </label>
              <input
                type="number"
                name="hr_avg"
                step="0.01"
                value={formData.hr_avg}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-strava-orange focus:border-transparent"
                placeholder="e.g., 145"
              />
            </div>
          </div>

          <div className="flex space-x-4 pt-6">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center space-x-2 bg-strava-orange text-white px-6 py-3 rounded-lg hover:bg-strava-orange-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-5 w-5" />
              <span>{loading ? 'Creating...' : 'Create Activity'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition"
            >
              <X className="h-5 w-5" />
              <span>Cancel</span>
            </button>
          </div>
        </form>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Tips</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Activity ID and User ID are automatically generated</li>
          <li>• Distance should be in meters (1 km = 1000 m)</li>
          <li>• Duration should be in seconds (30 min = 1800 s)</li>
          <li>• Recommendations work better with similar distance/duration activities</li>
        </ul>
      </div>
    </div>
  );
}

export default CreateActivity;

