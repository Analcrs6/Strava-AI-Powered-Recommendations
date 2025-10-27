import faiss, os, numpy as np, threading, pickle, json
from typing import List, Tuple, Literal, Dict
from pathlib import Path
from sklearn.preprocessing import StandardScaler
from .feature_store import load_csv_features, FEATURE_COLUMNS
from .mmr_reranker import mmr_rerank, calculate_diversity_score
from ..config import settings

INDEX_PATH = os.path.join(settings.recsys_index_dir, "index_latest.faiss")
SCALER_PATH = os.path.join(settings.recsys_index_dir, "scaler.npy")
IDMAP_PATH = os.path.join(settings.recsys_index_dir, "idmap.npy")
TRAINED_MODEL_DIR = "app/resources/trained_models"

RecommenderStrategy = Literal["content", "content_mmr", "ensemble", "ensemble_mmr"]

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
            
            # Load feature columns
            feature_cols_path = model_dir / "retrieval" / "feature_columns.json"
            if feature_cols_path.exists():
                with open(feature_cols_path, 'r') as f:
                    feature_columns = json.load(f)
                print(f"  ✅ Feature columns: {feature_columns}")
            
            # Build FAISS index from pre-trained embeddings
            X = np.ascontiguousarray(embeddings)
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
            if strategy == "content":
                # Pure similarity - just return top-k
                return list(zip(candidates[:k], candidate_scores[:k]))
            
            elif strategy == "content_mmr":
                # MMR reranking for diversity
                candidate_vectors = self.feature_vectors[candidate_indices]
                candidate_scores_array = np.array(candidate_scores)
                return mmr_rerank(
                    candidate_vectors,
                    candidates,
                    candidate_scores_array,
                    top_m=k,
                    lambda_diversity=lambda_diversity
                )
            
            elif strategy in ["ensemble", "ensemble_mmr"]:
                # TODO: Implement collaborative filtering component
                # For now, fall back to content-based
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

recsys = Recommender()

