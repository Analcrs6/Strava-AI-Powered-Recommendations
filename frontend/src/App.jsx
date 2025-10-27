import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Activity, TrendingUp, Plus, Home } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import CreateActivity from './pages/CreateActivity';
import ActivityDetail from './pages/ActivityDetail';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link to="/" className="flex items-center space-x-2">
                <Activity className="h-8 w-8 text-strava-orange" />
                <span className="text-2xl font-bold text-gray-900">
                  Strava<span className="text-strava-orange">Recommender</span>
                </span>
              </Link>
              
              <nav className="flex items-center space-x-6">
                <Link 
                  to="/" 
                  className="flex items-center space-x-1 text-gray-700 hover:text-strava-orange transition"
                >
                  <Home className="h-5 w-5" />
                  <span>Dashboard</span>
                </Link>
                <Link 
                  to="/create" 
                  className="flex items-center space-x-1 bg-strava-orange text-white px-4 py-2 rounded-lg hover:bg-strava-orange-dark transition"
                >
                  <Plus className="h-5 w-5" />
                  <span>New Activity</span>
                </Link>
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create" element={<CreateActivity />} />
            <Route path="/activity/:id" element={<ActivityDetail />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <p>Strava Recommender System © 2025</p>
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-strava-orange" />
                <span>FAISS + MMR</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;

