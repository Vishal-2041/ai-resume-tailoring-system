from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
import io

from utils.extraction import extract_text_from_pdf
from utils.nlp_engine import calculate_ats_score, get_missing_skills
from utils.gemini_engine import tailor_resume, configure_gemini, build_resume_from_details, tailor_builder_details

app = FastAPI(title="AI Resume ATS Optimizer API")

# Enable CORS (if needed later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure the static directory exists
os.makedirs("static", exist_ok=True)

# API Endpoint for analysis
@app.post("/api/analyze")
async def analyze_resume(
    resume: UploadFile = File(...),
    job_description: str = Form(...)
):
    try:
        # Check if file is PDF
        if not resume.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported.")

        # Read the file
        file_contents = await resume.read()
        pdf_file = io.BytesIO(file_contents)
        
        # Extract Text
        resume_text = extract_text_from_pdf(pdf_file)
        if not resume_text:
            raise HTTPException(status_code=400, detail="Failed to extract text from the PDF.")

        # NLP Processing
        ats_score = calculate_ats_score(resume_text, job_description)
        missing_skills = get_missing_skills(resume_text, job_description)

        # Tailoring
        tailored_resume = tailor_resume(resume_text, job_description, missing_skills)

        return JSONResponse({
            "status": "success",
            "data": {
                "ats_score": ats_score,
                "missing_skills": missing_skills,
                "tailored_resume": tailored_resume
            }
        })

    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)


@app.post("/api/build")
async def build_resume(
    full_name: str = Form(""),
    contact_info: str = Form(""),
    summary: str = Form(""),
    experience: str = Form(""),
    education: str = Form(""),
    skills: str = Form("")
):
    try:
        details = {
            "fullName": full_name,
            "contactInfo": contact_info,
            "summary": summary,
            "experience": experience,
            "education": education,
            "skills": skills
        }

        resumes = build_resume_from_details(details)
        
        if "error" in resumes:
            return JSONResponse({"status": "error", "message": resumes["error"]}, status_code=500)

        return JSONResponse({
            "status": "success",
            "data": resumes
        })

    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@app.post("/api/tailor_builder")
async def api_tailor_builder(request: Request):
    try:
        data = await request.json()
        jd_text = data.get("job_description", "")
        details = data.get("details", {})
        
        result = tailor_builder_details(details, jd_text)
        
        if "error" in result:
            return JSONResponse({"status": "error", "message": result["error"]}, status_code=500)
            
        return JSONResponse({"status": "success", "data": result})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

# Mount the frontend directory to serve the index.html on the root path
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
