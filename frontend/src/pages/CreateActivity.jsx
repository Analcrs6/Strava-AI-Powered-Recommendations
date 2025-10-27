import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { activitiesAPI } from '../services/api';
import { Save, X, Activity } from 'lucide-react';

function CreateActivity() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    id: '',
    user_id: '',
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
        id: formData.id,
        user_id: formData.user_id,
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
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center space-x-3 mb-8">
          <Activity className="h-8 w-8 text-strava-orange" />
          <h1 className="text-3xl font-bold text-gray-900">Create New Activity</h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Activity ID *
              </label>
              <input
                type="text"
                name="id"
                required
                value={formData.id}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-strava-orange focus:border-transparent"
                placeholder="e.g., run_001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User ID *
              </label>
              <input
                type="text"
                name="user_id"
                required
                value={formData.user_id}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-strava-orange focus:border-transparent"
                placeholder="e.g., user_123"
              />
            </div>
          </div>

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
          <li>• Use unique activity IDs to avoid conflicts</li>
          <li>• Distance should be in meters (1 km = 1000 m)</li>
          <li>• Duration should be in seconds (30 min = 1800 s)</li>
          <li>• AI recommendations work better with similar distance/duration activities</li>
        </ul>
      </div>
    </div>
  );
}

export default CreateActivity;

