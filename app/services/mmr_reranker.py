"""
MMR (Maximal Marginal Relevance) Re-ranking for diversity in recommendations.
"""
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Tuple


def mmr_rerank(
    candidate_vectors: np.ndarray,
    candidate_ids: List[str],
    similarity_scores: np.ndarray,
    top_m: int = 5,
    lambda_diversity: float = 0.3
) -> List[Tuple[str, float]]:
    """
    Re-rank candidates using MMR to balance relevance and diversity.
    
    Args:
        candidate_vectors: Feature vectors of candidate items (N x D)
        candidate_ids: IDs corresponding to each candidate
        similarity_scores: Initial similarity scores to query (N,)
        top_m: Number of items to return
        lambda_diversity: Trade-off parameter (0 = pure relevance, 1 = pure diversity)
        
    Returns:
        List of (id, MMR_score) tuples in MMR order
    """
    if len(candidate_ids) == 0:
        return []
    
    if len(candidate_ids) <= top_m:
        # Not enough candidates to rerank
        return [(cid, float(score)) for cid, score in zip(candidate_ids, similarity_scores)]
    
    print(f"  [MMR] Starting reranking: {len(candidate_ids)} candidates, lambda={lambda_diversity}")
    print(f"  [MMR] Original top 3: {candidate_ids[:3]}")
    
    # Normalize vectors for cosine similarity
    norms = np.linalg.norm(candidate_vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1  # Avoid division by zero
    normalized_vectors = candidate_vectors / norms
    
    # Normalize similarity scores to 0-1 range for MMR
    if len(similarity_scores) > 0:
        max_sim = np.max(similarity_scores)
        min_sim = np.min(similarity_scores)
        sim_range = max_sim - min_sim if max_sim > min_sim else 1.0
        norm_similarity = (similarity_scores - min_sim) / sim_range
    else:
        norm_similarity = similarity_scores
    
    # Track selected and remaining indices
    selected_indices = []
    remaining_indices = list(range(len(candidate_ids)))
    
    # MMR selection loop
    for iteration in range(min(top_m, len(candidate_ids))):
        if not remaining_indices:
            break
            
        mmr_scores = []
        
        for idx in remaining_indices:
            # Relevance score (normalized)
            relevance = norm_similarity[idx]
            
            # Diversity penalty (max similarity to already selected items)
            if selected_indices:
                selected_vectors = normalized_vectors[selected_indices]
                candidate_vector = normalized_vectors[idx:idx+1]
                similarities = cosine_similarity(candidate_vector, selected_vectors)[0]
                max_sim_to_selected = np.max(similarities)
            else:
                max_sim_to_selected = 0
            
            # MMR formula: λ * relevance - (1-λ) * max_similarity_to_selected
            # Higher lambda = more relevance, lower lambda = more diversity
            mmr_score = lambda_diversity * relevance - (1 - lambda_diversity) * max_sim_to_selected
            mmr_scores.append((idx, mmr_score, relevance, max_sim_to_selected))
        
        # Select item with highest MMR score
        best_idx, best_mmr, best_rel, best_div = max(mmr_scores, key=lambda x: x[1])
        
        if iteration < 3:  # Log first 3 selections
            print(f"  [MMR] #{iteration+1}: {candidate_ids[best_idx]} - mmr={best_mmr:.4f}, rel={best_rel:.4f}, div_penalty={best_div:.4f}")
        
        selected_indices.append(best_idx)
        remaining_indices.remove(best_idx)
    
    # Return results with MMR-computed scores (normalized similarity scores)
    results = []
    for rank, idx in enumerate(selected_indices):
        # Use normalized similarity as the score for consistency
        results.append((candidate_ids[idx], float(norm_similarity[idx])))
    
    print(f"  [MMR] Final top 3: {[r[0] for r in results[:3]]}")
    
    return results


def calculate_diversity_score(vectors: np.ndarray) -> float:
    """
    Calculate intra-list diversity as average pairwise dissimilarity.
    
    Args:
        vectors: Feature vectors of recommended items (N x D)
        
    Returns:
        Average dissimilarity score (0-1, higher is more diverse)
    """
    if len(vectors) < 2:
        return 0.0
    
    # Normalize vectors
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1
    normalized = vectors / norms
    
    # Calculate pairwise similarities
    similarities = cosine_similarity(normalized)
    
    # Get upper triangle (excluding diagonal)
    n = len(vectors)
    dissimilarities = []
    
    for i in range(n):
        for j in range(i + 1, n):
            dissimilarities.append(1.0 - similarities[i, j])
    
    return float(np.mean(dissimilarities)) if dissimilarities else 0.0

