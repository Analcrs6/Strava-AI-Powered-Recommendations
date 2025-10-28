import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, Mail, User, Lock, MapPin } from 'lucide-react';

// Social provider icons
const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

function Signup() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    location: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(null);
  };

  const handleSocialSignup = async (provider) => {
    setLoading(true);
    setError(null);
    
    try {
      // Create user in database first
      const userId = `user_${Date.now()}`;
      const userName = `${provider.charAt(0).toUpperCase()}${provider.slice(1)} User`;
      
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          name: userName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create user');
      }

      const userData = await response.json();
      
      const newUser = {
        id: userData.id,
        name: userData.name,
        email: `user@${provider}.com`,
        profile_image_url: null,
        provider: provider
      };
      
      login(newUser);
      console.log('✅ User created via', provider, ':', userId);
      navigate('/');
    } catch (err) {
      console.error('Social signup error:', err);
      setError(err.message || `Failed to sign up with ${provider}`);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      setError('All fields are required');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    
    try {
      // Create user in database first
      const userId = `user_${Date.now()}`;
      
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          name: formData.name
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create user');
      }

      const userData = await response.json();
      
      const newUser = {
        id: userData.id,
        name: userData.name,
        email: formData.email,
        location: formData.location,
        profile_image_url: null,
        provider: 'email'
      };
      
      login(newUser);
      console.log('✅ User created with email signup:', userId);
      navigate('/');
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-600 rounded-xl mb-4">
            <TrendingUp className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Create Your Account</h1>
          <p className="text-slate-600">Join Strava Recommender and discover new routes</p>
        </div>

        {/* Signup Card */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          {/* Social Signup */}
          <button
            onClick={() => handleSocialSignup('google')}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-3 px-4 py-3 border-2 border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            <GoogleIcon />
            <span className="font-medium text-slate-700">Sign up with Google</span>
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-slate-500">Or sign up with email</span>
            </div>
          </div>

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <User className="h-4 w-4 inline mr-1" />
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Mail className="h-4 w-4 inline mr-1" />
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <MapPin className="h-4 w-4 inline mr-1" />
                Location (Optional)
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="San Francisco, CA"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Lock className="h-4 w-4 inline mr-1" />
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Lock className="h-4 w-4 inline mr-1" />
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Re-enter password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 text-white px-4 py-3 rounded-lg hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {loading && (
            <div className="mt-4 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-slate-500 mb-2">
            By creating an account, you agree to our Terms of Service and Privacy Policy
          </p>
          <Link to="/login" className="text-sm text-orange-600 hover:text-orange-700 font-medium transition">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Signup;

