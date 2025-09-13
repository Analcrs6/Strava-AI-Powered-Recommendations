# Capstone-project
Capstone Project Report: AI-Powered Personalized Activity Recommendations for Strava Users

Project Lead: Anais Lacreuse and Mrudula Dama

Date: September 13, 2025

1. Problem Statement
Strava, a leading social fitness network, offers basic route and training plan suggestions to its users. However, these recommendations are often generic and fail to leverage the rich, user-specific data available. They do not sufficiently account for an individual’s historical performance, unique training goals, or personal preferences regarding distance, elevation, and terrain. This lack of deep personalization can lead to a suboptimal user experience, potentially hindering training motivation and overall efficiency for both competitive and recreational athletes.

This project aims to address this gap by developing a sophisticated machine learning-based recommendation system. This system will dynamically adapt to a user's behavior and fitness progress, providing personalized and highly relevant route and workout suggestions.

2. Objectives
Primary Objective: To build, train, and rigorously evaluate a machine learning model capable of generating personalized route and workout recommendations tailored to the unique profile of each Strava user.

Secondary Objectives:

To design and implement a robust recommendation engine using either a content-based filtering approach, a collaborative filtering approach, or a hybrid model.

To enhance the recommendation quality by incorporating relevant contextual features, such as real-time weather data, time of day, and detailed terrain attributes.

To establish a performance baseline by quantitatively comparing the model's recommendations against Strava's existing default suggestions.

To create a functional, interactive dashboard or web application prototype to visualize the model's output and demonstrate the personalized recommendations.

3. Data Sources
The project will rely on a multi-source data strategy to build a comprehensive user and route profile.

Strava API: This will be the primary data source, providing access to anonymized user activity logs. Key data points include distance, pace, elevation gain, heart rate, and GPS traces for each run or ride. Sample or synthetic user profiles will be used to ensure a sufficient volume of data for model training.

OpenStreetMap (OSM): For detailed route and segment attributes, OSM data will be leveraged. This will allow for the extraction of features like surface type (e.g., trail, road, track), elevation data, and local points of interest.

External APIs (Optional): Weather history APIs can be used to enrich the dataset with contextual features, allowing the model to recommend activities suitable for specific weather conditions (e.g., suggesting a shaded route on a hot day).

Synthetic User Data: If collaborative filtering is pursued, synthetic data will be generated to simulate a diverse range of user profiles and activity histories, which is crucial for identifying patterns and similar user groups.

4. Methodology
The project will be executed in a phased approach, ensuring a systematic and reproducible workflow.
Sprint

Phase

Tasks

Techniques / Tools

1. Data Collection & Cleaning

Access data via Strava API, collect activities and route data, handle missing values.

Python requests, Pandas, GeoPandas

2. Exploratory Data Analysis (EDA)

Visualize key trends such as distance/pace distributions, route popularity, and elevation profiles.

Matplotlib, Plotly, Folium

3. Feature Engineering

Create new features from raw data, including calculated pace, average elevation, surface type, and time-of-day categories.

Pandas, scikit-learn

4. Model Development

Build the recommendation engine. The core will be a Content-Based Filtering model (recommending routes similar to past favorites). A Collaborative Filtering model (using matrix factorization to find similar users) may also be explored.

scikit-learn, Surprise library, PyTorch (for deep learning)

5. Evaluation

Compare the model's recommendations against a simple baseline (e.g., a random route or the most popular one) to measure effectiveness.

Precision@k, Recall@k, NDCG (Normalized Discounted Cumulative Gain)

6. Deployment

Develop a prototype dashboard or web application to serve as a user interface for the recommendations.

Streamlit or Flask

5. Expected Deliverables
Technical Deliverables
Cleaned Dataset: A well-structured dataset of user activity logs and route attributes, ready for model training and analysis.

Trained Recommendation Model: A finalized and trained machine learning model, capable of generating personalized recommendations.

Model Evaluation Report: A detailed report containing the results of model performance tests, including all evaluation metrics and supporting data visualizations.

Interactive Web App Prototype: A functional prototype showcasing the personalized route and workout recommendations in a user-friendly interface.

Documentation Deliverables
Final Written Report: A comprehensive report detailing the project's methodology, results, discussion of findings, and future work.

Presentation Slide Deck: A professional slide deck for a project showcase or final presentation.

GitHub Repository: A public repository containing all project code, documentation, and a reproducible workflow.

6. Evaluation Metrics
The success of the project will be measured using a combination of quantitative and qualitative metrics.

Precision@k, Recall@k, NDCG: These standard ranking metrics will assess the quality and relevance of the top-k recommendations.

RMSE / MAE: Root Mean Square Error and Mean Absolute Error will be used if the model is also tasked with predicting quantitative values, such as a user’s expected pace or time for a given route.

User Simulation Feedback: A qualitative evaluation will be performed by simulating different user profiles and analyzing the generated recommendations for their logical fit and perceived satisfaction.

7. Expected Outcome
The successful completion of this project will result in a functional proof-of-concept AI recommender. This tool will demonstrate its ability to provide activity suggestions that are more accurately aligned with a user’s training habits and preferences than the current generic solutions. The project will also offer valuable insights into the impact of personalization on user engagement and training adherence in a fitness context. The web-based visualization will serve as a powerful demonstration of the model's capabilities.

8. Stretch Goals (Optional)
Graph Neural Networks (GNNs): Explore the use of GNNs to model the geographic network of routes, enabling more sophisticated route similarity analysis.

Reinforcement Learning: Investigate the implementation of a reinforcement learning system to dynamically adjust training plans based on real-time user progress and feedback.

Explainable AI (XAI): Incorporate XAI techniques, such as SHAP values, to provide transparency into how the model arrives at its recommendations, giving users confidence in the suggestions.
