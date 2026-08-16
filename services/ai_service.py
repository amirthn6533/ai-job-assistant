import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure the Gemini API client
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

def generate_match(cv_text: str, job_description: str) -> str:
    """
    Compares the provided CV text with the Job Description using Gemini.
    Returns a detailed matching report.
    """
    if not api_key:
        # Re-check API key in case it was set after module import
        current_api_key = os.getenv("GEMINI_API_KEY")
        if not current_api_key:
            return "Error: GEMINI_API_KEY is not set. Please check your .env file."
        genai.configure(api_key=current_api_key)

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        prompt = f"""
        You are an expert recruiter and AI career assistant. Your task is to analyze the candidate's CV/Resume and compare it with the Job Description.

        Please structure your response in English with the following clear sections:
        
        ### 📊 Match Percentage: [Score]%
        Provide a brief summary explaining the match score.

        ### ✅ Key Strengths
        List the skills, experience, or qualifications in the CV that align well with the job.

        ### 🔍 Skill Gaps & Missing Requirements
        Highlight the requirements from the job description that are missing or weak in the CV.

        ### 💡 Actionable Recommendations
        Provide advice on how to improve the CV or what skills/certifications to acquire to become a stronger candidate.

        ---
        **CV Text:**
        {cv_text}

        ---
        **Job Description:**
        {job_description}
        """
        
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error communicating with Gemini API: {str(e)}"


def generate_cover_letter_ai(cv_text: str, job_description: str, job_title: str, company: str) -> str:
    """
    Generates a tailored cover letter based on the candidate's CV and the job description.
    """
    if not api_key:
        current_api_key = os.getenv("GEMINI_API_KEY")
        if not current_api_key:
            return "Error: GEMINI_API_KEY is not set. Please check your .env file."
        genai.configure(api_key=current_api_key)

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        prompt = f"""
        You are an expert career consultant. Write a professional, persuasive, and customized Cover Letter in English for a candidate applying to the following position:
        
        Job Title: {job_title}
        Company Name: {company}
        
        Instructions:
        1. Keep the cover letter professional, engaging, and to the point (around 250-350 words).
        2. Highlight relevant skills and experiences from the Candidate's CV that directly match the Job Description.
        3. Do not invent any false details or experience. Use only facts from the CV.
        4. Leave placeholders like [Your Name], [Contact Info], [Date], and [Company Address] in brackets so the candidate can fill them in later.
        5. Structure:
           - Salutation (Dear Hiring Team / Dear Hiring Manager)
           - Opening Paragraph: State the role applied for and convey excitement.
           - Body Paragraph 1: Connect CV strengths/achievements to job requirements.
           - Body Paragraph 2: Express genuine interest in joining {company}.
           - Closing Paragraph: Thank them for their time and request an interview.
        
        ---
        **Candidate CV:**
        {cv_text}
        
        ---
        **Job Description:**
        {job_description}
        """
        
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error generating cover letter: {str(e)}"


def optimize_resume_ai(cv_text: str, job_description: str) -> str:
    """
    Rewrites sections of the candidate's CV to optimize keywords for the Job Description.
    """
    if not api_key:
        current_api_key = os.getenv("GEMINI_API_KEY")
        if not current_api_key:
            return "Error: GEMINI_API_KEY is not set. Please check your .env file."
        genai.configure(api_key=current_api_key)

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        prompt = f"""
        You are an ATS (Applicant Tracking System) expert and CV writer. 
        Your task is to optimize the Candidate's CV to match the Job Description. 
        
        Instructions:
        1. Rewrite and improve the candidate's Professional Summary to explicitly highlight alignment with the core requirements of the job description.
        2. Format a "Core Skills & Keywords" section at the top, grouping technical and soft skills that are highly relevant to the job description (using keywords from the job description where appropriate).
        3. Optimize the Work Experience descriptions. For each role, rephrase 2-4 bullet points to use strong action verbs and match job description keywords, while retaining the original meaning and scope.
        4. CRITICAL: Do NOT fabricate or make up any new titles, companies, years of experience, or skills. Only rephrase, emphasize, and prioritize the existing experience and skills from the candidate's CV.
        5. Output the optimized CV in a clean, professional plain text layout (use Markdown headers like ### and bullet points).
        
        ---
        **Candidate CV:**
        {cv_text}
        
        ---
        **Job Description:**
        {job_description}
        """
        
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error optimizing resume: {str(e)}"


