import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pytest
from models.requestmodel import JobRequest, JobSearchRequest

def test_job_request_model():
    req = JobRequest(cv_text="Software Engineer with Python skills", job_description="Looking for Python developer")
    assert req.cv_text == "Software Engineer with Python skills"
    assert "Python developer" in req.job_description

def test_job_search_request_model():
    req = JobSearchRequest(cv_text="QA Automation Engineer", query="Playwright", location="Sofia")
    assert req.query == "Playwright"
    assert req.location == "Sofia"
