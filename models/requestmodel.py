from pydantic import BaseModel

class JobRequest(BaseModel):
    cv_text: str
    job_description: str

class JobSearchRequest(BaseModel):
    cv_text: str
    query: str = ""
    location: str = ""

class SubscriptionRequest(BaseModel):
    email: str
    cv_text: str
    query: str = ""
    location: str = ""

class UnsubscriptionRequest(BaseModel):
    email: str

class CoverLetterRequest(BaseModel):
    cv_text: str
    job_description: str
    job_title: str
    company: str
