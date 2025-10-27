import faiss, os, numpy as np, threading
from typing import List, Tuple
from sklearn.preprocessing import StandardScaler
from .feature_store import load_csv_features, FEATURE_COLUMNS
from ..config import settings

INDEX_PATH = os.path.join(settings.recsys_index_dir, "index_latest.faiss")
SCALER_PATH = os.path.join(settings.recsys_index_dir, "scaler.npy")
IDMAP_PATH = os.path.join(settings.recsys_index_dir, "idmap.npy")

class Recommender:
    def __init__(self):
        self._lock = threading.RLock()
        self.df = None
        self.index = None
        self.scaler = None
        self.idmap = None  # numpy array mapping row -> activity_id

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
            # cosine ≈ L2 on normalized vectors
            if settings.recsys_metric == "cosine":
                faiss.normalize_L2(X)
            dim = X.shape[1]
            self.index = faiss.IndexFlatIP(dim) if settings.recsys_metric=="cosine" \
                        else faiss.IndexFlatL2(dim)
            self.index.add(X)
            self.idmap = df["id"].astype(str).to_numpy()
            self._save(X)

    def ensure_ready(self):
        with self._lock:
            if self.index is None:
                if not self._load():
                    self.rebuild_from_csv(settings.csv_seed_path)

    def search_by_activity(self, activity_id: str, k: int) -> List[Tuple[str, float]]:
        self.ensure_ready()
        with self._lock:
            # lookup row
            try:
                row = int(np.where(self.idmap == activity_id)[0][0])
            except IndexError:
                return []
            x = self.index.reconstruct(row).reshape(1,-1)
            scores, idx = self.index.search(x, k+1)  # +1 to skip self
            ids = []
            for j, sc in zip(idx[0], scores[0]):
                if j < 0: continue
                aid = self.idmap[j]
                if aid == activity_id: continue
                ids.append((str(aid), float(sc)))
                if len(ids) == k: break
            return ids

    def search_by_vector(self, vec: np.ndarray, k: int) -> List[Tuple[str, float]]:
        self.ensure_ready()
        with self._lock:
            vv = vec.astype("float32").reshape(1,-1)
            if settings.recsys_metric=="cosine":
                faiss.normalize_L2(vv)
            scores, idx = self.index.search(vv, k)
            out=[]
            for j, sc in zip(idx[0], scores[0]):
                if j < 0: continue
                out.append((str(self.idmap[j]), float(sc)))
            return out

recsys = Recommender()

