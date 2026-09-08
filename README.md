# 💼 AI Job Assistant | Automated Job Hunter, Skill Gap Analyzer & Resume Tailor

<div align="center">

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-AI-8E75C2?style=for-the-badge&logo=google&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)

**An intelligent, autonomous career acceleration assistant built with FastAPI, SQLite, and Google Gemini LLMs to discover matching tech jobs, analyze resume skill gaps, and auto-generate tailored cover letters.**

[Overview](#-overview) • [Key Features](#-key-features) • [Architecture](#-architecture) • [Quick Start](#-quick-start) • [API Endpoints](#-api-endpoints) • [Docker Support](#-docker-support) • [License](#-license)

</div>

---

## 📌 Overview

Searching for the right software engineering or QA position is often repetitive and tedious. **AI Job Assistant** automates the entire job application lifecycle:
1. Aggregates live job postings across target regions (Sofia, Bulgaria, Remote EU).
2. Parses your CV and scores job listings using semantic matching.
3. Highlights missing technical competencies and suggests learning pathways.
4. Drafts personalized, high-converting cover letters using Gemini LLMs.
5. Sends instant alerts for newly discovered high-match positions via Telegram and Email.

---

## 🚀 Key Features

- 🔍 **Automated Multi-Source Job Scraper:** Fetches fresh job postings across tech boards with automated deduplication.
- 🎯 **Semantic Fit & Match Scoring:** Compares your CV skills against requirements and generates a 0–100% compatibility rating.
- 📊 **Skill Gap & Keyword Optimizer:** Detects missing keywords required by Applicant Tracking Systems (ATS).
- ✍️ **AI Cover Letter Synthesizer:** Produces custom, context-aware motivation letters highlighting relevant project experiences.
- 🔔 **Instant Alerts:** Dispatches real-time notifications for roles with >80% match score.
- 🖥️ **Full-Featured Modern Web UI:** Responsive single-page dashboard for browsing opportunities, previewing letters, and tracking application statuses.

---

## 🏗️ Architecture

```text
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│ Job Market API  │ ───►  │  FastAPI Controller  │ ───►  │ Responsive Web  │
│ & Live Scrapers │       │   (Job Engine)       │       │    Dashboard    │
└─────────────────┘       └──────────┬───────────┘       └─────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
      ┌─────────────────────┐                 ┌─────────────────────┐
      │  Google Gemini AI   │                 │   SQLite Database   │
      │  (Resume & NLP)     │                 │   (Jobs & Matches)  │
      └─────────────────────┘                 └─────────────────────┘
```

---

## ⚡ Quick Start

### Prerequisites
- Python 3.10+
- Google Gemini API Key

### Installation

```bash
# 1. Clone repository
git clone https://github.com/amirthn6533/ai-job-assistant.git
cd ai-job-assistant

# 2. Set up virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.template .env
# Add your GEMINI_API_KEY to .env

# 5. Run the FastAPI application
python main.py
```
Open your browser at `http://localhost:8000` to access the interactive web dashboard.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/jobs` | Retrieve all scraped and indexed job opportunities. |
| `POST` | `/api/jobs/search` | Trigger live search and scrape job postings. |
| `POST` | `/api/cv/analyze` | Parse uploaded CV and calculate match scores. |
| `POST` | `/api/ai/cover-letter` | Generate AI-tailored cover letter for specific job. |
| `GET` | `/api/stats` | Overview of applications, match rates, and saved jobs. |

---

## 🐳 Docker Support

Run the entire application in a self-contained container:

```bash
# Build the Docker image
docker build -t ai-job-assistant .

# Run container on port 8000
docker run -p 8000:8000 -e GEMINI_API_KEY="your_api_key_here" ai-job-assistant
```

---

## 📄 License

This project is open-source and licensed under the [MIT License](LICENSE).
