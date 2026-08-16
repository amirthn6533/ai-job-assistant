import os
import requests
import re
import json
import google.generativeai as genai
from typing import List, Dict, Any

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)


def fetch_raw_jobs(location: str = "") -> List[Dict[str, Any]]:
    """
    Fetch jobs from public APIs (Arbeitnow and The Muse) and filter by location.
    """
    jobs = []
    location_lower = location.lower().strip() if location else ""
    
    # 1. Fetch from The Muse (supports query-level location filtering)
    try:
        muse_url = "https://www.themuse.com/api/public/jobs?page=1"
        if location:
            # The Muse API expects URL encoded location parameter
            import urllib.parse
            muse_url += f"&location={urllib.parse.quote(location)}"
            
        r = requests.get(muse_url, timeout=10)
        if r.status_code == 200:
            data = r.json()
            for job in data.get("results", []):
                locs = ", ".join(l.get("name") for l in job.get("locations", []) if l.get("name"))
                jobs.append({
                    "title": job.get("name"),
                    "company": job.get("company", {}).get("name"),
                    "location": locs or "Remote",
                    "url": job.get("refs", {}).get("landing_page"),
                    "description": job.get("contents", ""),
                    "source": "The Muse",
                    "remote": "remote" in locs.lower() or not locs
                })
    except Exception as e:
        print(f"[Job Search] The Muse fetch failed: {e}")

    # 2. Fetch from Arbeitnow (filter in-memory by location)
    try:
        r = requests.get("https://www.arbeitnow.com/api/job-board-api", timeout=10)
        if r.status_code == 200:
            data = r.json()
            for job in data.get("data", []):
                job_loc = job.get("location", "").lower()
                is_remote = job.get("remote", False)
                
                # If location is specified, filter by location name or remote status
                if location_lower:
                    matches_loc = location_lower in job_loc
                    matches_remote = "remote" in location_lower and is_remote
                    if not (matches_loc or matches_remote):
                        continue # Skip if location doesn't match
                        
                jobs.append({
                    "title": job.get("title"),
                    "company": job.get("company_name"),
                    "location": job.get("location"),
                    "url": job.get("url"),
                    "description": job.get("description", ""),
                    "source": "Arbeitnow",
                    "remote": is_remote
                })
    except Exception as e:
        print(f"[Job Search] Arbeitnow fetch failed: {e}")

    return jobs


def extract_skills_from_cv(cv_text: str) -> List[str]:
    """
    Fast extraction of common programming/industry keywords from CV.
    """
    common_skills = [
        "python", "javascript", "java", "typescript", "c++", "c#", "php", "go", "rust", "ruby", "swift", "kotlin",
        "django", "fastapi", "flask", "express", "nest", "spring", "laravel", "rails",
        "react", "angular", "vue", "next.js", "nuxt", "svelte", "html", "css", "tailwind",
        "postgresql", "mysql", "sqlite", "mongodb", "redis", "elasticsearch", "sql",
        "docker", "kubernetes", "aws", "gcp", "azure", "devops", "ci/cd", "git",
        "machine learning", "deep learning", "nlp", "computer vision", "tensorflow", "pytorch", "keras",
        "pandas", "numpy", "scikit-learn", "data science", "data analysis", "spark", "hadoop",
        "rest api", "graphql", "microservices", "agile", "scrum", "qa", "testing"
    ]
    
    cv_lower = cv_text.lower()
    found_skills = []
    for skill in common_skills:
        # Match as whole word/phrase to avoid false positives (like 'go' matching in 'good')
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, cv_lower):
            found_skills.append(skill)
            
    return found_skills


def rank_jobs_locally(jobs: List[Dict[str, Any]], cv_text: str, query: str = "", location: str = "") -> List[Dict[str, Any]]:
    """
    Perform text-based similarity matching to filter down to the top matches.
    """
    skills = extract_skills_from_cv(cv_text)
    query_terms = [q.lower().strip() for q in query.split() if q.strip()] if query else []
    location_lower = location.lower().strip() if location else ""
    
    ranked_jobs = []
    for job in jobs:
        score = 0
        title_lower = job["title"].lower()
        desc_lower = job["description"].lower()
        job_loc_lower = job["location"].lower()
        
        # 1. Match query terms (highest weight)
        if query_terms:
            query_match = False
            for term in query_terms:
                if term in title_lower:
                    score += 20
                    query_match = True
                elif term in desc_lower:
                    score += 5
                    query_match = True
            if not query_match:
                continue
                
        # 2. Match Location (extra score if matches user preference)
        if location_lower:
            if location_lower in job_loc_lower:
                score += 30
            elif "remote" in location_lower and job["remote"]:
                score += 15

        # 3. Match CV skills
        for skill in skills:
            if skill in title_lower:
                score += 10
            elif skill in desc_lower:
                score += 2
                
        # Add basic score if remote matches remote interest
        if "remote" in cv_text.lower() and job["remote"]:
            score += 5
            
        job["local_score"] = score
        ranked_jobs.append(job)
        
    # Sort by local score descending
    ranked_jobs.sort(key=lambda x: x["local_score"], reverse=True)
    return ranked_jobs[:6]  # Return top 6 candidates for Gemini evaluation


def ai_evaluate_jobs(top_jobs: List[Dict[str, Any]], cv_text: str) -> List[Dict[str, Any]]:
    """
    Use Gemini to analyze matching percentage and reasoning for top job candidates.
    """
    if not top_jobs:
        return []
        
    global api_key
    if not api_key:
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
        else:
            # If no API key, return top jobs with local score as match percentage
            for job in top_jobs:
                job["match_score"] = min(100, int(job["local_score"] * 1.5))
                job["match_reason"] = "Matched based on keywords overlap (Local ranking fallback)."
            return top_jobs

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        # Build prompt listing top jobs
        jobs_list_str = ""
        for i, job in enumerate(top_jobs):
            # Clean description for prompt context limit
            clean_desc = re.sub('<[^<]+?>', '', job["description"])[:500]  # strip html and truncate
            jobs_list_str += f"""
            ---
            Job ID: {i}
            Title: {job["title"]}
            Company: {job["company"]}
            Description Snippet: {clean_desc}...
            """
            
        prompt = f"""
        You are an expert recruitment assistant.
        Compare the candidate's CV with the following job listings.
        For each job, determine:
        1. A match percentage (0-100%) based on skills, experience, and role alignment.
        2. A brief 1-sentence reasoning (in Persian) explaining the match or key gaps.

        Your output MUST be a valid JSON array of objects with keys: "job_id", "match_score", "match_reason".
        Do not wrap the JSON in markdown blocks other than standard json code block.

        Example Output format:
        [
          {{"job_id": 0, "match_score": 85, "match_reason": "مهارت‌های فنی شما در پایتون و جنگو کاملاً با نیازهای این شغل مطابقت دارد."}},
          ...
        ]

        Candidate CV:
        {cv_text}

        Jobs list:
        {jobs_list_str}
        """
        
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        # Clean potential markdown wrapping
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        evaluations = json.loads(response_text)
        
        # Merge evaluations back to job list
        for eval_item in evaluations:
            idx = int(eval_item.get("job_id", -1))
            if 0 <= idx < len(top_jobs):
                top_jobs[idx]["match_score"] = eval_item.get("match_score", 0)
                top_jobs[idx]["match_reason"] = eval_item.get("match_reason", "")
                
        # Sort by match score
        top_jobs.sort(key=lambda x: x.get("match_score", 0), reverse=True)
        return top_jobs
    except Exception as e:
        print(f"[Job Search AI] AI rank failed: {e}")
        # Fallback to local scoring
        for job in top_jobs:
            job["match_score"] = min(100, int(job["local_score"] * 1.5))
            job["match_reason"] = "شغل منطبق با کلیدواژه‌های رزومه شما (رتبه‌بندی محلی)."
        return top_jobs


def search_and_match_jobs(cv_text: str, query: str = "", location: str = "") -> List[Dict[str, Any]]:
    """
    Main job search entry point: fetches, filters, ranks locally, and evaluates via AI.
    """
    raw_jobs = fetch_raw_jobs(location)
    top_jobs = rank_jobs_locally(raw_jobs, cv_text, query, location)
    ranked_jobs = ai_evaluate_jobs(top_jobs, cv_text)
    return ranked_jobs
