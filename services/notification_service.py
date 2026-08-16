import asyncio
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from services.database import get_all_subscriptions
from services.job_search_service import search_and_match_jobs

# Paths
WORKSPACE_DIR = os.path.dirname(os.path.dirname(__file__))
LOG_FILE_PATH = os.path.join(WORKSPACE_DIR, "debug_emails.log")


async def check_alerts_loop():
    """
    Background loop that runs periodically to search for new jobs
    and notify subscribed users.
    """
    # Wait for app startup
    await asyncio.sleep(5)
    print("[Job Alerts] Background alert checker started.")
    
    while True:
        try:
            print(f"[Job Alerts] Running periodic check at {datetime.now()}")
            subs = get_all_subscriptions()
            
            for sub in subs:
                email = sub["email"]
                cv_text = sub["cv_text"]
                query = sub["query"]
                location = sub["location"]
                
                print(f"[Job Alerts] Checking jobs for subscriber: {email} (Keywords: '{query}', Location: '{location}')")
                
                # Search and evaluate jobs
                matched_jobs = search_and_match_jobs(cv_text, query, location)
                
                # Filter jobs with high match scores (e.g. >= 70%)
                high_matches = [j for j in matched_jobs if j.get("match_score", 0) >= 70]
                
                if high_matches:
                    print(f"[Job Alerts] Found {len(high_matches)} high matches for {email}.")
                    send_job_alert_email(email, high_matches)
                else:
                    print(f"[Job Alerts] No new high matches found for {email} this cycle.")
                    
        except Exception as e:
            print(f"[Job Alerts Error] Error in alert loop: {e}")
            
        # Run every 10 minutes for testing/demo purposes.
        # In production, this would be daily (e.g. sleep 86400 seconds)
        print("[Job Alerts] Sleep for 10 minutes until next check...")
        await asyncio.sleep(600)


def send_job_alert_email(to_email: str, jobs: list):
    """
    Send job alert email. If SMTP is not configured, it writes the email content
    to a debug log file (debug_emails.log) for verification.
    """
    subject = "🚀 AI Job Assistant: New Job Matches Found!"
    
    # Construct Email Content (HTML)
    job_rows_html = ""
    job_rows_text = ""
    for job in jobs:
        score = job.get("match_score", 0)
        score_color = "#ef4444"
        if score >= 70:
            score_color = "#10b981"
        elif score >= 40:
            score_color = "#f59e0b"
            
        job_rows_html += f"""
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; background-color: #f8fafc;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="margin: 0; color: #1e293b;">{job['title']}</h3>
                <span style="font-weight: bold; color: {score_color}; padding: 4px 10px; border-radius: 12px; background-color: #f1f5f9; font-size: 0.85rem;">
                    {score}% Match
                </span>
            </div>
            <p style="margin: 0 0 8px 0; color: #6366f1; font-weight: 500;">🏢 {job['company']} • 📍 {job['location']}</p>
            <p style="margin: 0 0 10px 0; color: #475569; font-size: 0.9rem; line-height: 1.5;">{job['description'][:200]}...</p>
            <p style="margin: 10px 0; font-style: italic; background-color: #f1f5f9; padding: 8px 12px; border-radius: 4px; border-left: 3px solid #6366f1; font-size: 0.85rem; color: #334155;">
                <strong>💡 AI Comment:</strong> {job['match_reason']}
            </p>
            <a href="{job['url']}" target="_blank" style="display: inline-block; background-color: #6366f1; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 0.85rem; font-weight: bold; margin-top: 5px;">
                Apply Now ↗
            </a>
        </div>
        """
        job_rows_text += f"""
        - {job['title']} at {job['company']} ({score}% Match)
          Apply: {job['url']}
          AI Reason: {job['match_reason']}
          
        """

    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
            <h1 style="color: #6366f1; margin: 0;">🤖 AI Job Assistant</h1>
            <p style="color: #64748b; margin: 5px 0 0 0;">New ranked jobs matching your CV/Resume skills</p>
        </div>
        
        <p>Hi Candidate,</p>
        <p>We found some exciting new job openings that match your skills. Here are the top matches ranked by AI:</p>
        
        {job_rows_html}
        
        <div style="border-top: 2px solid #e2e8f0; margin-top: 30px; padding-top: 20px; text-align: center; color: #94a3b8; font-size: 0.8rem;">
            <p>You received this email because you subscribed to AI Job Assistant alerts.</p>
            <p>To unsubscribe, go to the application portal.</p>
        </div>
    </body>
    </html>
    """

    # Check for SMTP Configuration
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = os.getenv("SMTP_USERNAME")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    
    if smtp_server and smtp_port and smtp_user and smtp_pass:
        # Send via SMTP
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = smtp_user
            msg["To"] = to_email
            
            part1 = MIMEText(job_rows_text, "plain")
            part2 = MIMEText(html_content, "html")
            msg.attach(part1)
            msg.attach(part2)
            
            server = smtplib.SMTP(smtp_server, int(smtp_port))
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, to_email, msg.as_string())
            server.quit()
            print(f"[SMTP Mail] Sent successful job alert email to: {to_email}")
            return
        except Exception as e:
            print(f"[SMTP Error] Failed to send email to {to_email} via SMTP: {e}. Falling back to debug log...")
            
    # Write to local debug file (Fallback/Demo Mode)
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(LOG_FILE_PATH, "a", encoding="utf-8") as f:
            f.write("=" * 70 + "\n")
            f.write(f"📧 DEBUG JOB ALERT EMAIL\n")
            f.write(f"TIMESTAMP: {timestamp}\n")
            f.write(f"RECIPIENT: {to_email}\n")
            f.write(f"SUBJECT: {subject}\n")
            f.write("-" * 70 + "\n")
            f.write(job_rows_text)
            f.write("=" * 70 + "\n\n")
        print(f"[Debug Mail Log] Success: Written alert email for {to_email} to {LOG_FILE_PATH}")
    except Exception as e:
        print(f"[Log Error] Failed to write to {LOG_FILE_PATH}: {e}")
