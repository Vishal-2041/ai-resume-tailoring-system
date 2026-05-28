import google.generativeai as genai
import os
import json
from dotenv import load_dotenv

# Load environment variables (API Key)
load_dotenv()

def configure_gemini(api_key=None):
    """
    Configures the Gemini API client safely.
    """
    key = api_key or os.getenv("GEMINI_API_KEY") or "KEEP_YOUR_KEY_HERE"
    if not key:
        return False
    
    genai.configure(api_key=key)
    return True

def tailor_resume(resume_text, jd_text, missing_skills):
    """
    Uses Gemini API to tailor the resume to the Job Description.
    """
    if not configure_gemini():
        return "Error: Gemini API Key not configured. Please add it to a .env file or the application sidebar."

    model = genai.GenerativeModel('gemini-2.5-flash')

    prompt = f"""
    You are an expert ATS Optimization Specialist and Executive Resume Writer.
    I will provide you with a candidate's current resume, a target job description, and a list of missing skills.
    
    Your task is to tailor the candidate's resume so that it better matches the job description, 
    incorporating the missing skills naturally where applicable. Do not invent false experience, 
    but rephrase existing bullet points to highlight relevant aspects that align with the JD.

    Here are the Missing Skills:
    {', '.join(missing_skills)}

    Here is the Job Description:
    {jd_text}

    Here is the Original Resume:
    {resume_text}

    Please provide the tailored version of the resume. Structure it professionally using markdown formatting.
    Ensure that the generated resume focuses on high-impact achievements and integrates the missing keywords smoothly.
    """

    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"An error occurred while generating the tailored resume: {e}"

def build_resume_from_details(details):
    """
    Uses Gemini API to build a resume from scratch based on user details,
    returning 3 different standard markdown layouts in a JSON structure.
    """
    if not configure_gemini():
        return {"error": "Gemini API Key not configured. Please add it to the application sidebar."}

    model = genai.GenerativeModel(
        'gemini-2.5-flash', 
        generation_config={"response_mime_type": "application/json"}
    )

    prompt = f"""
    You are an expert Executive Resume Writer.
    I will provide you with a candidate's details.
    
    Your task is to build a highly professional, ATS-friendly resume from these details.
    You must return EXACTLY 3 different variations of the resume in Markdown format.
    
    The 3 variations should represent 3 standard industry formats:
    1. 'professional': A classic, highly structured, ATS-optimized layout.
    2. 'modern': A clean, minimalist, contemporary layout with clear section dividers.
    3. 'executive': A leadership-focused layout prioritizing career summary, core competencies, and high-level achievements.

    Do not invent false experience, but use professional resume phrasing and action verbs.
    
    Candidate Details:
    Full Name: {details.get('fullName', '')}
    Contact Info: {details.get('contactInfo', '')}
    Summary: {details.get('summary', '')}
    Experience: {details.get('experience', '')}
    Education: {details.get('education', '')}
    Skills: {details.get('skills', '')}

    Return a JSON object with exactly these 3 keys ('professional', 'modern', 'executive'), where the value for each key is the Markdown string for that resume variation.
    """

    try:
        response = model.generate_content(prompt)
        result = json.loads(response.text)
        return result
    except Exception as e:
        return {"error": f"An error occurred while generating the resumes: {e}"}

def tailor_builder_details(details, jd_text):
    """
    Uses Gemini API to tailor specific granular builder fields (summary, experience desc, projects desc, skills)
    based on the job description, keeping ATS-friendly formatting.
    """
    if not configure_gemini():
        return {"error": "Gemini API Key not configured."}

    model = genai.GenerativeModel(
        'gemini-2.5-flash', 
        generation_config={"response_mime_type": "application/json"}
    )

    prompt = f"""
    You are an expert ATS Optimization Specialist and Executive Resume Writer.
    I will provide you with a candidate's resume sections and a target job description.
    
    Your task is to tailor the 'summary', 'experience' descriptions, 'projects' descriptions, and 'skills' 
    to be highly ATS-friendly and aligned with the provided Job Description.
    Use strong action verbs, quantifiable metrics, and integrate relevant keywords naturally.
    Do NOT invent false experience, but rephrase to highlight relevance.
    
    Job Description:
    {jd_text}
    
    Resume Sections (JSON format):
    {details}
    
    Return a JSON object with the exact same structure and IDs for experience/projects arrays, 
    but with the text fields ('summary', 'skills', and 'desc' inside arrays) enhanced. 
    Keep the other fields (company, title, dates, name) unchanged.
    """

    try:
        response = model.generate_content(prompt)
        result = json.loads(response.text)
        return result
    except Exception as e:
        return {"error": f"An error occurred during tailoring: {e}"}