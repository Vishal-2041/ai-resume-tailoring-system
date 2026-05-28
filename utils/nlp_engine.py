import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize

# Setup NLTK (We assume these are downloaded or we catch the error)
try:
    nltk.data.find('corpora/stopwords')
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('stopwords', quiet=True)
    nltk.download('punkt', quiet=True)

def preprocess_text(text):
    """
    Cleans text by removing special characters, lowercasing, and removing stopwords.
    """
    if not text:
        return ""
    
    # Lowercase
    text = text.lower()
    # Remove special characters
    text = re.sub(r'[^a-zA-Z0-9\s]', '', text)
    
    # Tokenize and remove stopwords
    stop_words = set(stopwords.words('english'))
    tokens = word_tokenize(text)
    filtered_text = [word for word in tokens if word not in stop_words]
    
    return " ".join(filtered_text)

def calculate_ats_score(resume_text, job_description):
    """
    Calculates the ATS match score using TF-IDF and Cosine Similarity.
    """
    clean_resume = preprocess_text(resume_text)
    clean_jd = preprocess_text(job_description)
    
    if not clean_resume or not clean_jd:
        return 0.0

    documents = [clean_resume, clean_jd]
    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(documents)
    
    # Calculate cosine similarity between the two documents
    match_percentage = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
    
    # Convert to percentage
    return round(match_percentage * 100, 2)

def extract_keywords(text, top_n=20):
    """
    Extracts top keywords using basic frequency and TF-IDF.
    """
    clean_text = preprocess_text(text)
    vectorizer = TfidfVectorizer(max_features=top_n)
    try:
        vectorizer.fit([clean_text])
        return list(vectorizer.vocabulary_.keys())
    except:
        return []

def get_missing_skills(resume_text, jd_text):
    """
    A basic function to find keywords in JD that are missing in Resume.
    """
    jd_keywords = extract_keywords(jd_text, top_n=30)
    clean_resume = preprocess_text(resume_text)
    
    missing = []
    for keyword in jd_keywords:
        if keyword not in clean_resume:
            missing.append(keyword)
            
    return missing
