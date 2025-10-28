import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, User, Camera, Save } from 'lucide-react';

function Settings() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    bio: user?.bio || '',
    location: user?.location || ''
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
    setMessage(null);

    try {
      // Simulate API call (replace with actual API call)
      setTimeout(() => {
        const updatedUser = {
          ...user,
          ...formData
        };
        updateUser(updatedUser);
        setLoading(false);
        setMessage({
          type: 'success',
          text: 'Profile updated successfully!'
        });
      }, 1000);
    } catch (error) {
      setLoading(false);
      setMessage({
        type: 'error',
        text: 'Failed to update profile'
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-6 transition"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          {/* Header */}
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <User className="h-6 w-6 text-slate-700" />
              <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Profile Picture */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Profile Picture
              </label>
              <div className="flex items-center space-x-4">
                <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center">
                  <span className="text-white text-2xl font-semibold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <button
                  type="button"
                  className="flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-50 transition text-sm"
                >
                  <Camera className="h-4 w-4" />
                  <span>Change Photo</span>
                </button>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                placeholder="John Doe"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                placeholder="you@example.com"
                disabled
              />
              <p className="mt-1 text-xs text-slate-500">Email cannot be changed</p>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Bio
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                placeholder="Tell us about yourself..."
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                placeholder="San Francisco, CA"
              />
            </div>

            {/* Message */}
            {message && (
              <div
                className={`p-4 rounded-md ${
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 bg-slate-800 text-white px-6 py-2 rounded-md hover:bg-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                <span>{loading ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Settings;

