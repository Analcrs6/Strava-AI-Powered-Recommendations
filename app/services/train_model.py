"""
Model training script - runs before app starts.
Trains the RouteRecommender and saves it to disk.
"""
import pandas as pd
import os
from pathlib import Path
from route_recommender import RouteRecommender


def train_and_save_model(
    csv_path: str,
    model_path: str,
    force_retrain: bool = False
):
    """
    Train the RouteRecommender model and save it.
    
    Args:
        csv_path: Path to training data CSV
        model_path: Where to save the trained model
        force_retrain: Retrain even if model exists
    """
    # Check if model already exists
    if os.path.exists(model_path) and not force_retrain:
        print(f"✓ Model already exists at {model_path}")
        print("  Use force_retrain=True to retrain")
        return
    
    print("=" * 60)
    print("TRAINING ROUTE RECOMMENDER MODEL")
    print("=" * 60)
    
    # Load data
    print(f"\n1. Loading data from {csv_path}...")
    df = pd.read_csv(csv_path)
    print(f"   Loaded {len(df)} activities")
    print(f"   Users: {df['user_id'].nunique()}")
    print(f"   Routes: {df['route_id'].nunique()}")
    
    # Train model
    print("\n2. Training model...")
    model = RouteRecommender(
        filter_seen=True,
        temporal_decay=0.1,
        use_mf=False  # Can enable collaborative filtering later
    )
    model.fit(df)
    
    # Test the model
    print("\n3. Testing model...")
    test_user = df['user_id'].iloc[0]
    recs = model.recommend(df, test_user, top_n=5)
    print(f"   Test recommendations for user '{test_user}':")
    if not recs.empty:
        for _, row in recs.iterrows():
            print(f"     {row['rank']}. Route {row['route_id']} (similarity: {row['similarity']:.3f})")
    else:
        print("     (No recommendations)")
    
    # Save model
    print(f"\n4. Saving model to {model_path}...")
    model.save(model_path)
    
    print("\n" + "=" * 60)
    print("✓ MODEL TRAINING COMPLETE")
    print("=" * 60)
    print(f"\nModel saved to: {model_path}")
    print(f"Routes indexed: {len(model.route_index)}")
    print(f"Users profiled: {len(model.user_profiles)}")
    print("\nThe model is ready to use in the application!")


if __name__ == "__main__":
    # Default paths
    CSV_PATH = os.getenv(
        "CSV_SEED_PATH",
        "/workspace/app/resources/synthetic_strava_data.csv"
    )
    MODEL_PATH = os.getenv(
        "TRAINED_MODEL_PATH",
        "/data/recsys/trained_model.pkl"
    )
    
    train_and_save_model(CSV_PATH, MODEL_PATH, force_retrain=True)

