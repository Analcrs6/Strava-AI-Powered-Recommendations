import faiss, os, numpy as np, threading, pickle, json, pandas as pd
from typing import List, Tuple, Literal, Dict, Optional
from pathlib import Path
from sklearn.preprocessing import StandardScaler
from .feature_store import load_csv_features, FEATURE_COLUMNS
from .mmr_reranker import mmr_rerank, calculate_diversity_score
from ..config import settings
from ..cache import cache, collab_cache_key, recommendation_cache_key
import time

INDEX_PATH = os.path.join(settings.recsys_index_dir, "index_latest.faiss")
SCALER_PATH = os.path.join(settings.recsys_index_dir, "scaler.npy")
IDMAP_PATH = os.path.join(settings.recsys_index_dir, "idmap.npy")
TRAINED_MODEL_DIR = "app/resources/trained_models"

RecommenderStrategy = Literal["content", "content_mmr", "ensemble", "ensemble_mmr", "popularity"]

class Recommender:
    """
    Multi-strategy recommender system supporting:
    - content: Pure similarity (baseline)
    - content_mmr: Content + diversity (MMR reranking)
    - ensemble: Content + collaborative filtering
    - ensemble_mmr: Ensemble + diversity
    """
    def __init__(self):
        self._lock = threading.RLock()
        self.df = None
        self.index = None
        self.scaler = None
        self.idmap = None  # numpy array mapping row -> activity_id
        self.feature_vectors = None  # Store normalized feature vectors for MMR
        self.modelcard: Dict = {}  # Metadata from trained model
        self.inference_config: Dict = {}  # Inference configuration
        self.popularity_scores: Dict[str, float] = {}  # Route popularity scores
        self.route_metadata: Optional[pd.DataFrame] = None  # Route metadata (surface, distance, etc.)
        self.user_seen: Optional[Dict[str, set]] = None  # User interaction data for collaborative filtering
        self.user_route_matrix: Optional[np.ndarray] = None  # User-route interaction matrix
        self.route_to_matrix_idx: Optional[Dict[str, int]] = None  # Route ID to matrix index
        self.user_to_matrix_idx: Optional[Dict[str, int]] = None  # User ID to matrix index

    def _save(self, X: np.ndarray):
        os.makedirs(settings.recsys_index_dir, exist_ok=True)
        faiss.write_index(self.index, INDEX_PATH)
        np.save(SCALER_PATH, self.scaler.mean_), np.save(IDMAP_PATH, self.idmap)

    def _load(self) -> bool:
        if not os.path.exists(INDEX_PATH) or not os.path.exists(IDMAP_PATH):
            return False
        self.index = faiss.read_index(INDEX_PATH)
        self.idmap = np.load(IDMAP_PATH, allow_pickle=True)
        # scaler: we persist only mean_/scale_ minimally; for demo, rebuild via CSV
        return True

    def rebuild_from_csv(self, csv_path: str):
        with self._lock:
            df, X, scaler = load_csv_features(csv_path)
            self.df = df
            self.scaler = scaler
            # Ensure array is C-contiguous for FAISS
            X = np.ascontiguousarray(X)
            # Store original vectors for MMR (before normalization)
            self.feature_vectors = X.copy()
            # cosine ≈ L2 on normalized vectors
            if settings.recsys_metric == "cosine":
                faiss.normalize_L2(X)
            dim = X.shape[1]
            self.index = faiss.IndexFlatIP(dim) if settings.recsys_metric=="cosine" \
                        else faiss.IndexFlatL2(dim)
            self.index.add(X)
            self.idmap = df["id"].astype(str).to_numpy()
            self._save(X)

    def load_trained_model(self) -> bool:
        """Load pre-trained model artifacts from notebook training."""
        model_dir = Path(TRAINED_MODEL_DIR)
        
        if not model_dir.exists():
            return False
        
        try:
            print(f"📦 Loading trained model from {model_dir}...")
            
            # Load scaler (critical for preprocessing)
            scaler_path = model_dir / "retrieval" / "scaler.pkl"
            if not scaler_path.exists():
                print(f"  ❌ Scaler not found at {scaler_path}")
                return False
            with open(scaler_path, 'rb') as f:
                self.scaler = pickle.load(f)
            print(f"  ✅ Scaler loaded")
            
            # Load embeddings (pre-computed feature vectors)
            embeddings_path = model_dir / "retrieval" / "route_embeddings.npy"
            if not embeddings_path.exists():
                print(f"  ❌ Embeddings not found at {embeddings_path}")
                return False
            embeddings = np.load(embeddings_path)
            print(f"  ✅ Embeddings loaded: {embeddings.shape}")
            
            # Load ID mapping (route_id -> index)
            id_map_path = model_dir / "retrieval" / "route_id_to_idx.json"
            if not id_map_path.exists():
                print(f"  ❌ ID mapping not found at {id_map_path}")
                return False
            with open(id_map_path, 'r') as f:
                id_to_idx = json.load(f)
            
            # Convert to idmap array (index -> route_id)
            self.idmap = np.array([None] * len(id_to_idx), dtype=object)
            for route_id, idx in id_to_idx.items():
                self.idmap[idx] = str(route_id)
            print(f"  ✅ ID mapping loaded: {len(self.idmap)} routes")
            
            # Load modelcard (training metrics & info)
            modelcard_path = model_dir / "modelcard.json"
            if modelcard_path.exists():
                with open(modelcard_path, 'r') as f:
                    self.modelcard = json.load(f)
                print(f"  ✅ Model: {self.modelcard.get('model_name', 'Unknown')} v{self.modelcard.get('version', '?')}")
                print(f"      Strategy: {self.modelcard.get('best_strategy', 'content_mmr')}")
                metrics = self.modelcard.get('evaluation_metrics', {})
                if metrics:
                    recall = metrics.get('recall_at_10', 0)
                    map_score = metrics.get('map_at_10', 0)
                    ndcg = metrics.get('ndcg_at_10', 0)
                    print(f"      Recall@10: {recall:.4f}, MAP@10: {map_score:.4f}, NDCG@10: {ndcg:.4f}")
            else:
                print(f"  ⚠️  Modelcard not found (optional)")
            
            # Load inference config
            inference_config_path = model_dir / "inference_config.json"
            if inference_config_path.exists():
                with open(inference_config_path, 'r') as f:
                    self.inference_config = json.load(f)
                print(f"  ✅ Inference config loaded")
                print(f"      Default strategy: {self.inference_config.get('default_strategy', 'content_mmr')}")
                print(f"      Default lambda: {self.inference_config.get('default_lambda', 0.3)}")
            
            # Load popularity scores (for cold-start/fallback)
            popularity_path = model_dir / "heuristics" / "popularity.csv"
            if popularity_path.exists():
                pop_df = pd.read_csv(popularity_path)
                self.popularity_scores = dict(zip(pop_df['route_id'], pop_df['popularity_score']))
                print(f"  ✅ Popularity scores loaded: {len(self.popularity_scores)} routes")
            
            # Load route metadata (for enhanced recommendations)
            route_meta_path = model_dir / "meta" / "route_meta.csv"
            if route_meta_path.exists():
                self.route_metadata = pd.read_csv(route_meta_path)
                print(f"  ✅ Route metadata loaded: {len(self.route_metadata)} routes")
                print(f"      Features: surface_type, distance, elevation, difficulty, etc.")
            
            # Load user interaction data (for collaborative filtering)
            user_seen_path = model_dir / "meta" / "user_seen.csv"
            if user_seen_path.exists():
                user_seen_df = pd.read_csv(user_seen_path)
                self.user_seen = {}
                for user_id in user_seen_df['user_id'].unique():
                    user_routes = user_seen_df[user_seen_df['user_id'] == user_id]['route_id'].tolist()
                    self.user_seen[user_id] = set(str(r) for r in user_routes)
                
                print(f"  ✅ User interaction data loaded: {len(self.user_seen)} users")
                
                # Build user-route interaction matrix for collaborative filtering
                all_users = sorted(self.user_seen.keys())
                all_routes = sorted(self.idmap)
                
                self.user_to_matrix_idx = {user: idx for idx, user in enumerate(all_users)}
                self.route_to_matrix_idx = {route: idx for idx, route in enumerate(all_routes)}
                
                # Create binary interaction matrix
                self.user_route_matrix = np.zeros((len(all_users), len(all_routes)), dtype=np.float32)
                
                for user_id, seen_routes in self.user_seen.items():
                    if user_id in self.user_to_matrix_idx:
                        user_idx = self.user_to_matrix_idx[user_id]
                        for route_id in seen_routes:
                            if route_id in self.route_to_matrix_idx:
                                route_idx = self.route_to_matrix_idx[route_id]
                                self.user_route_matrix[user_idx, route_idx] = 1.0
                
                print(f"      Interaction matrix: {self.user_route_matrix.shape} (users × routes)")
                print(f"      Total interactions: {int(self.user_route_matrix.sum())}")
            else:
                print(f"  ⚠️  User interaction data not found (collaborative filtering disabled)")
            
            # Load feature columns
            feature_cols_path = model_dir / "retrieval" / "feature_columns.json"
            if feature_cols_path.exists():
                with open(feature_cols_path, 'r') as f:
                    feature_columns = json.load(f)
                print(f"  ✅ Feature columns: {feature_columns}")
            
            # Build FAISS index from pre-trained embeddings
            # IMPORTANT: FAISS requires float32 dtype
            X = np.ascontiguousarray(embeddings.astype('float32'))
            self.feature_vectors = X.copy()  # Store original for MMR
            
            # Normalize for cosine similarity
            if settings.recsys_metric == "cosine":
                faiss.normalize_L2(X)
            
            # Create index
            dim = X.shape[1]
            self.index = faiss.IndexFlatIP(dim) if settings.recsys_metric == "cosine" else faiss.IndexFlatL2(dim)
            self.index.add(X)
            
            print(f"  ✅ FAISS index built: {self.index.ntotal} vectors, {dim} dimensions")
            
            # Cache to disk for faster subsequent loads
            os.makedirs(settings.recsys_index_dir, exist_ok=True)
            faiss.write_index(self.index, INDEX_PATH)
            np.save(IDMAP_PATH, self.idmap)
            print(f"  ✅ Cached index to {settings.recsys_index_dir}")
            
            return True
            
        except Exception as e:
            print(f"❌ Failed to load trained model: {e}")
            import traceback
            traceback.print_exc()
            return False

    def ensure_ready(self):
        with self._lock:
            if self.index is None:
                # Try loading from trained model first
                if self.load_trained_model():
                    print("✅ Using pre-trained model from notebook")
                    return
                
                # Fallback: try loading cached index
                if self._load():
                    print("✅ Using cached index")
                    return
                
                # Last resort: rebuild from CSV
                print("📊 Building index from CSV...")
                self.rebuild_from_csv(settings.csv_seed_path)
    
    def get_collaborative_scores(self, query_route_id: str, user_id: Optional[str] = None, k: int = 100) -> Dict[str, float]:
        """
        Compute collaborative filtering scores based on user-item interactions.
        Uses item-item collaborative filtering (routes that are done together).
        WITH CACHING for performance.
        
        Args:
            query_route_id: The route to find similar routes for
            user_id: Optional user ID for personalized recommendations
            k: Number of top routes to return
            
        Returns:
            Dictionary mapping route_id -> collaborative score
        """
        if self.user_route_matrix is None or self.route_to_matrix_idx is None:
            return {}
        
        # Check cache first
        cache_key = collab_cache_key(query_route_id)
        cached_scores = cache.get(cache_key)
        if cached_scores is not None:
            print(f"   📦 Cache HIT for collaborative scores: {query_route_id}")
            return cached_scores
        
        print(f"   ⏱️  Cache MISS, computing collaborative scores...")
        start_time = time.time()
        
        # Get the query route index
        if query_route_id not in self.route_to_matrix_idx:
            return {}
        
        query_idx = self.route_to_matrix_idx[query_route_id]
        
        # Compute item-item similarity (which routes are done by similar users)
        # Get users who did this route
        query_vector = self.user_route_matrix[:, query_idx]
        
        if query_vector.sum() == 0:
            # No users have done this route
            return {}
        
        # Find similar routes using cosine similarity
        # Routes are similar if they're done by the same users
        from sklearn.metrics.pairwise import cosine_similarity
        
        # Transpose to get route-user matrix
        route_user_matrix = self.user_route_matrix.T
        
        # Compute similarity between query route and all other routes
        similarities = cosine_similarity(
            query_vector.reshape(1, -1),
            route_user_matrix
        )[0]
        
        # Convert to scores dictionary
        scores = {}
        for route_id, route_idx in self.route_to_matrix_idx.items():
            if route_id != query_route_id:
                scores[route_id] = float(similarities[route_idx])
        
        # Cache for 30 minutes (collaborative scores don't change often)
        cache.set(cache_key, scores, ttl=1800)
        
        elapsed = time.time() - start_time
        print(f"   ✅ Collaborative scores computed in {elapsed:.3f}s (cached for 30min)")
        
        return scores

    def search_by_activity(
        self, 
        activity_id: str, 
        k: int,
        strategy: RecommenderStrategy = "content",
        lambda_diversity: float = 0.3
    ) -> List[Tuple[str, float]]:
        """
        Get recommendations for an activity using specified strategy.
        
        Args:
            activity_id: The activity to find similar items for
            k: Number of recommendations to return
            strategy: Recommendation strategy
                - "content": Pure similarity (baseline)
                - "content_mmr": Content + diversity via MMR
                - "ensemble": Content + collaborative (future)
                - "ensemble_mmr": Ensemble + diversity (future)
            lambda_diversity: MMR diversity parameter (0-1)
                - 0.0: Pure relevance/similarity
                - 0.3: Balanced (recommended for content_mmr)
                - 0.6: High diversity
                - 1.0: Maximum diversity
                
        Returns:
            List of (activity_id, similarity_score) tuples
        """
        self.ensure_ready()
        with self._lock:
            # lookup row
            try:
                row = int(np.where(self.idmap == activity_id)[0][0])
            except IndexError:
                return []
            
            # Get base candidates (more than k for MMR strategies)
            pool_size = k * 10 if "mmr" in strategy else k + 1
            x = np.ascontiguousarray(self.index.reconstruct(row).reshape(1,-1))
            scores, idx = self.index.search(x, pool_size)
            
            # Filter out the query itself and invalid indices
            candidates = []
            candidate_indices = []
            candidate_scores = []
            
            for j, sc in zip(idx[0], scores[0]):
                if j < 0: continue
                aid = self.idmap[j]
                if aid == activity_id: continue
                candidates.append(str(aid))
                candidate_indices.append(int(j))
                candidate_scores.append(float(sc))
            
            # Apply strategy
            print(f"🎯 Applying strategy: {strategy} (lambda={lambda_diversity})")
            print(f"   Candidate pool size: {len(candidates)} from {pool_size} requested")
            
            if strategy == "content":
                # Pure similarity - just return top-k
                print(f"   → Using pure similarity (no MMR)")
                result = list(zip(candidates[:k], candidate_scores[:k]))
                print(f"   → Returning {len(result)} results")
                return result
            
            elif strategy == "content_mmr":
                # MMR reranking for diversity
                print(f"   → Applying MMR reranking (lambda={lambda_diversity})")
                candidate_vectors = self.feature_vectors[candidate_indices]
                candidate_scores_array = np.array(candidate_scores)
                result = mmr_rerank(
                    candidate_vectors,
                    candidates,
                    candidate_scores_array,
                    top_m=k,
                    lambda_diversity=lambda_diversity
                )
                print(f"   → MMR returned {len(result)} results")
                if len(result) > 0:
                    print(f"   → Score range: {result[0][1]:.4f} to {result[-1][1]:.4f}")
                return result
            
            elif strategy in ["ensemble", "ensemble_mmr"]:
                # Ensemble: Combine content-based + collaborative filtering
                print(f"   → Using ensemble strategy (content + collaborative)")
                
                # Get collaborative filtering scores
                collab_scores_dict = self.get_collaborative_scores(activity_id)
                
                if not collab_scores_dict:
                    # No collaborative data available, fall back to content-based
                    print(f"   ⚠️  No collaborative data available, falling back to content-based")
                    if strategy == "ensemble":
                        return list(zip(candidates[:k], candidate_scores[:k]))
                    else:
                        candidate_vectors = self.feature_vectors[candidate_indices]
                        candidate_scores_array = np.array(candidate_scores)
                        return mmr_rerank(
                            candidate_vectors,
                            candidates,
                            candidate_scores_array,
                            top_m=k,
                            lambda_diversity=lambda_diversity
                        )
                
                # Combine content-based and collaborative scores
                # Normalize both to 0-1 range
                content_scores = np.array(candidate_scores)
                content_min, content_max = content_scores.min(), content_scores.max()
                content_range = content_max - content_min if content_max > content_min else 1.0
                content_normalized = (content_scores - content_min) / content_range
                
                # Get collaborative scores for candidates
                collab_scores = []
                for cid in candidates:
                    collab_scores.append(collab_scores_dict.get(cid, 0.0))
                collab_scores = np.array(collab_scores)
                
                # Normalize collaborative scores
                if collab_scores.max() > 0:
                    collab_min, collab_max = collab_scores.min(), collab_scores.max()
                    collab_range = collab_max - collab_min if collab_max > collab_min else 1.0
                    collab_normalized = (collab_scores - collab_min) / collab_range
                else:
                    collab_normalized = collab_scores
                
                # Weighted combination (60% content, 40% collaborative)
                # Research shows content-based should have slightly more weight
                ensemble_scores = 0.6 * content_normalized + 0.4 * collab_normalized
                
                # Sort by ensemble scores
                sorted_indices = np.argsort(-ensemble_scores)
                ensemble_candidates = [candidates[i] for i in sorted_indices]
                ensemble_scores_sorted = [ensemble_scores[i] for i in sorted_indices]
                
                print(f"   → Combined {len(ensemble_candidates)} candidates (content + collaborative)")
                print(f"   → Score range: {ensemble_scores_sorted[0]:.4f} to {ensemble_scores_sorted[-1]:.4f}")
                
                if strategy == "ensemble":
                    # Return top-k ensemble results
                    result = list(zip(ensemble_candidates[:k], ensemble_scores_sorted[:k]))
                    print(f"   → Returning {len(result)} ensemble results")
                    return result
                else:
                    # Apply MMR reranking on ensemble results
                    print(f"   → Applying MMR reranking on ensemble (lambda={lambda_diversity})")
                    # Get feature vectors for reranking
                    rerank_indices = [candidate_indices[i] for i in sorted_indices]
                    rerank_vectors = self.feature_vectors[rerank_indices]
                    rerank_scores = np.array(ensemble_scores_sorted)
                    
                    result = mmr_rerank(
                        rerank_vectors,
                        ensemble_candidates,
                        rerank_scores,
                        top_m=k,
                        lambda_diversity=lambda_diversity
                    )
                    print(f"   → MMR returned {len(result)} results")
                    return result
            
            elif strategy == "popularity":
                # Popularity-based recommendations (for cold-start)
                print(f"   → Using popularity-based recommendations")
                if self.popularity_scores:
                    # Sort candidates by popularity
                    pop_candidates = [(cid, self.popularity_scores.get(cid, 0)) for cid in candidates]
                    pop_candidates.sort(key=lambda x: x[1], reverse=True)
                    
                    # Normalize popularity scores to 0-1 range for consistency
                    if pop_candidates:
                        max_pop = max(score for _, score in pop_candidates)
                        min_pop = min(score for _, score in pop_candidates) if len(pop_candidates) > 1 else 0
                        pop_range = max_pop - min_pop if max_pop > min_pop else 1.0
                        
                        # Normalize to 0-1 range (higher popularity = higher score)
                        normalized = [
                            (cid, (score - min_pop) / pop_range) 
                            for cid, score in pop_candidates[:k]
                        ]
                        print(f"   → Normalized {len(normalized)} popularity scores to 0-1 range")
                        return normalized
                    return pop_candidates[:k]
                else:
                    print(f"   ⚠️  No popularity scores available, falling back to similarity")
                    return list(zip(candidates[:k], candidate_scores[:k]))
            
            # Fallback
            print(f"   ⚠️  Fell through to fallback strategy")
            return list(zip(candidates[:k], candidate_scores[:k]))

    def search_by_vector(self, vec: np.ndarray, k: int) -> List[Tuple[str, float]]:
        self.ensure_ready()
        with self._lock:
            vv = np.ascontiguousarray(vec.astype("float32").reshape(1,-1))
            if settings.recsys_metric=="cosine":
                faiss.normalize_L2(vv)
            scores, idx = self.index.search(vv, k)
            out=[]
            for j, sc in zip(idx[0], scores[0]):
                if j < 0: continue
                out.append((str(self.idmap[j]), float(sc)))
            return out
    
    def get_route_metadata(self, route_id: str) -> Optional[Dict]:
        """Get metadata for a specific route (distance, elevation, surface, etc.)."""
        if self.route_metadata is None:
            return None
        
        route_info = self.route_metadata[self.route_metadata['route_id'] == route_id]
        if len(route_info) == 0:
            return None
        
        row = route_info.iloc[0]
        return {
            'route_id': route_id,
            'surface_type': row.get('surface_type_route', 'Unknown'),
            'distance_km': float(row.get('distance_km_route', 0)),
            'elevation_m': float(row.get('elevation_meters_route', 0)),
            'difficulty_score': float(row.get('difficulty_score', 0)),
            'grade_percent': float(row.get('grade_percent', 0)),
            'is_loop': bool(row.get('is_likely_loop', False)),
            'popularity': self.popularity_scores.get(route_id, 0)
        }
    
    def get_config(self) -> Dict:
        """Get current configuration and model info."""
        return {
            'modelcard': self.modelcard,
            'inference_config': self.inference_config,
            'has_popularity': len(self.popularity_scores) > 0,
            'has_metadata': self.route_metadata is not None,
            'total_routes': len(self.idmap) if self.idmap is not None else 0
        }

recsys = Recommender()

