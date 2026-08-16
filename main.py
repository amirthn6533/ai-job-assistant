from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from models.requestmodel import JobRequest, JobSearchRequest, SubscriptionRequest, UnsubscriptionRequest, CoverLetterRequest
from services.ai_service import generate_match, generate_cover_letter_ai, optimize_resume_ai
from services.job_search_service import search_and_match_jobs
from services.database import init_db, save_analysis, get_all_history, delete_history_item, subscribe_user, unsubscribe_user
from services.notification_service import check_alerts_loop
from utils.parser import extract_text
import os
import re
import asyncio

# Load environment variables
load_dotenv()

app = FastAPI(title="AI Job Assistant API", version="1.0.0")

@app.on_event("startup")
def on_startup():
    """Run database initialization and start background email alerts"""
    init_db()
    asyncio.create_task(check_alerts_loop())

# Serve static files (CSS, JS, images)
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def serve_frontend():
    """Serve the main frontend page"""
    return FileResponse(os.path.join(static_dir, "index.html"))

@app.post("/analyze")
def analyze_job(data: JobRequest):
    result = generate_match(data.cv_text, data.job_description)
    
    # Extract match percentage score (e.g. 85% or Match Percentage: 85%)
    score = 0
    if result and "Error" not in result:
        match_result = re.search(r'(\d{1,3})\s*%', result)
        if match_result:
            score = int(match_result.group(1))
            
        # Save to database history
        try:
            save_analysis(data.cv_text, data.job_description, score, result)
        except Exception as e:
            print(f"[Database Error] Could not save analysis to history: {e}")
            
    return {"result": result}

@app.post("/search-jobs")
def search_jobs(data: JobSearchRequest):
    """Search for relevant jobs and evaluate them against user CV"""
    try:
        ranked_jobs = search_and_match_jobs(data.cv_text, data.query, data.location)
        return {"jobs": ranked_jobs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Job search failed: {str(e)}")

@app.get("/history")
def get_history():
    """Retrieve all analysis history"""
    try:
        return {"history": get_all_history()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")

@app.delete("/history/{item_id}")
def delete_history(item_id: int):
    """Delete a history record by ID"""
    try:
        success = delete_history_item(item_id)
        if not success:
            raise HTTPException(status_code=404, detail="Item not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete history item: {str(e)}")

@app.post("/upload-cv")
async def upload_cv(file: UploadFile = File(...)):
    """Upload a PDF or DOCX resume and extract text from it"""
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    allowed_extensions = ('.pdf', '.docx')
    if not file.filename.lower().endswith(allowed_extensions):
        raise HTTPException(
            status_code=400, 
            detail="Unsupported file type. Please upload a PDF or DOCX file."
        )
    
    # Read file content
    try:
        file_bytes = await file.read()
        print(f"[Upload CV] Received file: {file.filename}, size: {len(file_bytes)} bytes")
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="File is empty")
        
        # Extract text
        text = extract_text(file.filename, file_bytes)
        print(f"[Upload CV] Extracted text length: {len(text) if text else 0} characters")
        
        if not text or not text.strip():
            raise HTTPException(
                status_code=400, 
                detail="Could not extract text from the file. The file may be scanned/image-based, or the Gemini API free quota limit (20 req/min) was temporarily exceeded. Please try uploading again in 30 seconds or paste your CV text manually."
            )
        
        return {"text": text, "filename": file.filename}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.post("/subscribe")
def subscribe(data: SubscriptionRequest):
    """Subscribe user to periodic job match email alerts"""
    success = subscribe_user(data.email, data.cv_text, data.query, data.location)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save subscription")
    return {"success": True, "message": "Subscribed successfully!"}

@app.post("/unsubscribe")
def unsubscribe(data: UnsubscriptionRequest):
    """Unsubscribe user from job alerts"""
    success = unsubscribe_user(data.email)
    if not success:
        raise HTTPException(status_code=404, detail="Email subscription not found")
    return {"success": True, "message": "Unsubscribed successfully!"}

@app.post("/generate-cover-letter")
def generate_cover_letter(data: CoverLetterRequest):
    """Generate a customized cover letter for a job using the candidate's CV"""
    try:
        result = generate_cover_letter_ai(data.cv_text, data.job_description, data.job_title, data.company)
        return {"cover_letter": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate cover letter: {str(e)}")

@app.post("/optimize-resume")
def optimize_resume(data: JobRequest):
    """Rewrite CV highlights to optimize for the job description"""
    try:
        result = optimize_resume_ai(data.cv_text, data.job_description)
        return {"optimized_cv": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to optimize CV: {str(e)}")
