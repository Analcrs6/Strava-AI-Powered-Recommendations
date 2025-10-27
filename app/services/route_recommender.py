"""
RouteRecommender - Trainable recommendation model from the notebook.
Supports content-based, collaborative filtering, and MMR reranking.
"""
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity
from typing import Dict, List, Tuple, Optional
import pickle
import os


class RouteRecommender:
    """
    Activity/Route recommender with multiple strategies.
    Based on the RouteRecommender from Strave_recommender_final.ipynb
    """
    
    def __init__(
        self,
        filter_seen: bool = True,
        min_interactions: int = 1,
        temporal_decay: float = 0.1,
        use_mf: bool = False,
        mf_factors: int = 32
    ):
        self.filter_seen = filter_seen
        self.min_interactions = min_interactions
        self.temporal_decay = temporal_decay
        self.use_mf = use_mf
        self.mf_factors = mf_factors
        
        # Trained components
        self.scaler = None
        self.route_index = None  # route_id -> index mapping
        self.feature_columns = None
        self.route_features = None  # Scaled feature matrix
        self.user_seen = None  # Dict[user_id, Set[route_id]]
        self.route_meta = None  # Metadata for routes
        self.popularity_scores = None
        self.user_profiles = None  # User feature profiles
        
        self.is_trained = False
    
    def fit(self, df: pd.DataFrame) -> 'RouteRecommender':
        """
        Train the recommender on activity data.
        
        Args:
            df: DataFrame with columns: user_id, route_id, distance_km_user,
                elevation_meters_user, surface_type_user, etc.
        
        Returns:
            self (for chaining)
        """
        print("Training RouteRecommender...")
        
        # Feature columns to use
        self.feature_columns = [
            'distance_km_route', 
            'elevation_meters_route', 
            'difficulty_score'
        ]
        
        # Get unique routes with their features
        route_data = df[['route_id'] + self.feature_columns].drop_duplicates('route_id')
        route_data = route_data.dropna(subset=self.feature_columns)
        
        # Build route index
        self.route_index = {route_id: idx for idx, route_id in enumerate(route_data['route_id'])}
        
        # Extract and scale features
        features = route_data[self.feature_columns].values.astype(float)
        self.scaler = StandardScaler()
        self.route_features = self.scaler.fit_transform(features)
        
        # Store route metadata
        self.route_meta = route_data.set_index('route_id').to_dict('index')
        
        # Track user interactions
        self.user_seen = {}
        for user_id in df['user_id'].unique():
            user_activities = df[df['user_id'] == user_id]
            self.user_seen[user_id] = set(user_activities['route_id'].unique())
        
        # Calculate popularity scores (number of times each route is used)
        route_counts = df['route_id'].value_counts()
        self.popularity_scores = route_counts.to_dict()
        
        # Build user profiles (average of routes they've done)
        self.user_profiles = {}
        for user_id, seen_routes in self.user_seen.items():
            route_indices = [self.route_index[rid] for rid in seen_routes if rid in self.route_index]
            if route_indices:
                user_vectors = self.route_features[route_indices]
                self.user_profiles[user_id] = np.mean(user_vectors, axis=0)
        
        self.is_trained = True
        print(f"✓ Training complete: {len(self.route_index)} routes, {len(self.user_seen)} users")
        return self
    
    def recommend(
        self,
        df: pd.DataFrame,
        user_id: str,
        top_n: int = 10,
        exclude_seen: bool = True
    ) -> pd.DataFrame:
        """
        Get recommendations for a user.
        
        Args:
            df: Original dataframe (not used after training, kept for compatibility)
            user_id: User to recommend for
            top_n: Number of recommendations
            exclude_seen: Filter out routes user has already done
        
        Returns:
            DataFrame with columns: route_id, similarity, rank
        """
        if not self.is_trained:
            raise ValueError("Model not trained. Call fit() first.")
        
        if user_id not in self.user_profiles:
            # New user - return popular routes
            return self._recommend_popular(top_n)
        
        # Get user profile
        user_profile = self.user_profiles[user_id].reshape(1, -1)
        
        # Calculate similarities to all routes
        similarities = cosine_similarity(user_profile, self.route_features)[0]
        
        # Create results
        results = []
        for route_id, idx in self.route_index.items():
            # Filter seen routes if requested
            if exclude_seen and route_id in self.user_seen.get(user_id, set()):
                continue
            
            results.append({
                'route_id': route_id,
                'similarity': similarities[idx],
                'popularity': self.popularity_scores.get(route_id, 0)
            })
        
        # Sort by similarity
        results_df = pd.DataFrame(results)
        if len(results_df) == 0:
            return pd.DataFrame(columns=['route_id', 'similarity', 'rank'])
        
        results_df = results_df.sort_values('similarity', ascending=False).head(top_n)
        results_df['rank'] = range(1, len(results_df) + 1)
        
        return results_df[['route_id', 'similarity', 'rank']]
    
    def recommend_by_activity(
        self,
        activity_id: str,
        top_n: int = 10
    ) -> pd.DataFrame:
        """
        Get recommendations based on a specific activity (route).
        
        Args:
            activity_id: The route_id to find similar routes for
            top_n: Number of recommendations
        
        Returns:
            DataFrame with route recommendations
        """
        if not self.is_trained:
            raise ValueError("Model not trained. Call fit() first.")
        
        if activity_id not in self.route_index:
            return pd.DataFrame(columns=['route_id', 'similarity', 'rank'])
        
        # Get the activity's feature vector
        activity_idx = self.route_index[activity_id]
        activity_vector = self.route_features[activity_idx:activity_idx+1]
        
        # Calculate similarities
        similarities = cosine_similarity(activity_vector, self.route_features)[0]
        
        # Create results
        results = []
        for route_id, idx in self.route_index.items():
            if route_id == activity_id:  # Skip self
                continue
            
            results.append({
                'route_id': route_id,
                'similarity': similarities[idx]
            })
        
        results_df = pd.DataFrame(results)
        if len(results_df) == 0:
            return pd.DataFrame(columns=['route_id', 'similarity', 'rank'])
        
        results_df = results_df.sort_values('similarity', ascending=False).head(top_n)
        results_df['rank'] = range(1, len(results_df) + 1)
        
        return results_df
    
    def _recommend_popular(self, top_n: int) -> pd.DataFrame:
        """Recommend popular routes for new users."""
        popular = sorted(
            self.popularity_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )[:top_n]
        
        return pd.DataFrame([
            {'route_id': route_id, 'similarity': 1.0, 'rank': i+1}
            for i, (route_id, _) in enumerate(popular)
        ])
    
    def save(self, path: str):
        """Save trained model to disk."""
        if not self.is_trained:
            raise ValueError("Cannot save untrained model")
        
        model_data = {
            'scaler': self.scaler,
            'route_index': self.route_index,
            'feature_columns': self.feature_columns,
            'route_features': self.route_features,
            'user_seen': self.user_seen,
            'route_meta': self.route_meta,
            'popularity_scores': self.popularity_scores,
            'user_profiles': self.user_profiles,
            'config': {
                'filter_seen': self.filter_seen,
                'min_interactions': self.min_interactions,
                'temporal_decay': self.temporal_decay,
                'use_mf': self.use_mf,
                'mf_factors': self.mf_factors
            }
        }
        
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            pickle.dump(model_data, f)
        print(f"✓ Model saved to {path}")
    
    @classmethod
    def load(cls, path: str) -> 'RouteRecommender':
        """Load trained model from disk."""
        with open(path, 'rb') as f:
            model_data = pickle.load(f)
        
        config = model_data['config']
        model = cls(
            filter_seen=config['filter_seen'],
            min_interactions=config['min_interactions'],
            temporal_decay=config['temporal_decay'],
            use_mf=config['use_mf'],
            mf_factors=config['mf_factors']
        )
        
        model.scaler = model_data['scaler']
        model.route_index = model_data['route_index']
        model.feature_columns = model_data['feature_columns']
        model.route_features = model_data['route_features']
        model.user_seen = model_data['user_seen']
        model.route_meta = model_data['route_meta']
        model.popularity_scores = model_data['popularity_scores']
        model.user_profiles = model_data['user_profiles']
        model.is_trained = True
        
        print(f"✓ Model loaded from {path}")
        return model

