document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM References
    const cvText = document.getElementById('cv-text');
    const jobDescription = document.getElementById('job-description');
    const analyzeBtn = document.getElementById('analyze-btn');
    const clearBtn = document.getElementById('clear-btn');
    const resultsContainer = document.getElementById('results-container');
    const loadingOverlay = document.getElementById('loading-overlay');
    const matchScoreCircle = document.getElementById('match-score-circle');
    const matchScoreText = document.getElementById('match-score-text');
    const keyStrengthsList = document.getElementById('key-strengths-list');
    const skillGapsList = document.getElementById('skill-gaps-list');
    const recommendationsList = document.getElementById('recommendations-list');
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const toastContainer = document.getElementById('toast-container');

    // 2. Tab Switching
    function switchTab(tabId) {
        tabs.forEach(tab => {
            if (tab.dataset.tab === tabId) {
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
            } else {
                tab.classList.remove('active');
                tab.setAttribute('aria-selected', 'false');
            }
        });

        tabContents.forEach(content => {
            if (content.id === `${tabId}-tab`) {
                content.classList.remove('hidden');
                content.classList.add('slide-up');
            } else {
                content.classList.add('hidden');
                content.classList.remove('slide-up');
            }
        });
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            switchTab(tabId);
            if (tabId === 'history') {
                loadHistory();
            }
        });
    });

    // 3. Analyze Function
    async function analyzeCV() {
        const cv = cvText?.value?.trim();
        const jd = jobDescription?.value?.trim();

        if (!cv || !jd) {
            showToast('Please provide both CV text and Job Description.', 'error');
            return;
        }

        if (loadingOverlay) loadingOverlay.classList.remove('hidden');
        if (resultsContainer) resultsContainer.classList.add('hidden');

        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cv_text: cv, job_description: jd })
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            parseResults(data.result || data.message || data);
            
            if (resultsContainer) {
                resultsContainer.classList.remove('hidden');
                resultsContainer.classList.add('slide-up');
            }
            
            showToast('Analysis complete!', 'success');
            
            // Automatically fetch and load matching jobs for this CV in the background
            loadAnalysisRecommendations(cv);
        } catch (error) {
            console.error('Analysis error:', error);
            showToast('Failed to analyze. Please try again.', 'error');
        } finally {
            if (loadingOverlay) loadingOverlay.classList.add('hidden');
        }
    }

    // 4. Parse Results
    function parseResults(resultText) {
        if (typeof resultText !== 'string') {
            resultText = JSON.stringify(resultText);
        }

        // Parse Match Percentage - look for various patterns
        const matchRegex = /(\d{1,3})\s*%/;
        const matchResult = resultText.match(matchRegex);
        const percentage = matchResult ? parseInt(matchResult[1], 10) : 0;

        // Clear previous content
        if (keyStrengthsList) keyStrengthsList.innerHTML = '';
        if (skillGapsList) skillGapsList.innerHTML = '';
        if (recommendationsList) recommendationsList.innerHTML = '';

        // Split by sections using markdown headers
        const sections = resultText.split(/###\s*/);
        
        let strengths = [];
        let gaps = [];
        let recommendations = [];

        sections.forEach(section => {
            const lowerSection = section.toLowerCase();
            let items = [];
            
            // Extract bullet points from this section
            const lines = section.split('\n');
            lines.forEach(line => {
                const trimmed = line.trim();
                // Match lines starting with -, *, •, or numbered lists like 1. 2.
                if (/^[-*•]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
                    const cleanText = trimmed
                        .replace(/^[-*•]\s+/, '')
                        .replace(/^\d+\.\s+/, '')
                        .replace(/\*\*/g, '')
                        .trim();
                    if (cleanText.length > 5) {
                        items.push(cleanText);
                    }
                }
            });

            if (lowerSection.includes('strength') || lowerSection.includes('key strength') || lowerSection.includes('✅')) {
                strengths = items;
            } else if (lowerSection.includes('gap') || lowerSection.includes('missing') || lowerSection.includes('🔍')) {
                gaps = items;
            } else if (lowerSection.includes('recommendation') || lowerSection.includes('actionable') || lowerSection.includes('💡')) {
                recommendations = items;
            }
        });

        // Populate lists
        const createListItem = (text) => `<li class="result-item">${text}</li>`;
        
        if (keyStrengthsList) {
            keyStrengthsList.innerHTML = strengths.length 
                ? strengths.map(createListItem).join('') 
                : '<li class="result-item">No specific strengths identified.</li>';
        }
        
        if (skillGapsList) {
            skillGapsList.innerHTML = gaps.length 
                ? gaps.map(createListItem).join('') 
                : '<li class="result-item">No significant skill gaps found.</li>';
        }
        
        if (recommendationsList) {
            recommendationsList.innerHTML = recommendations.length 
                ? recommendations.map(createListItem).join('') 
                : '<li class="result-item">No specific recommendations.</li>';
        }

        // Animate Match Score
        animateMatchScore(percentage);
    }

    // 5. Recommended Jobs for Analysis Results
    async function loadAnalysisRecommendations(cvTextVal) {
        const recomContainer = document.getElementById('analysis-recommended-jobs-list');
        if (!recomContainer) return;

        recomContainer.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; justify-content:center; padding:1rem;">
                <div class="spinner" style="width:20px; height:20px; border-width:2px; margin:0;"></div>
                <span style="color:var(--text-secondary); font-size:0.9rem;">Finding matching job openings...</span>
            </div>
        `;

        try {
            // Get location from the search location field if it has a value, otherwise default to "Sofia, Bulgaria"
            const location = document.getElementById('search-location')?.value?.trim() || "Sofia, Bulgaria";

            const response = await fetch('/search-jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cv_text: cvTextVal, query: "", location: location })
            });

            if (!response.ok) throw new Error('Failed to fetch recommendations');
            const data = await response.json();
            const jobs = data.jobs || [];

            // Take top 3 jobs
            const top3 = jobs.slice(0, 3);
            renderAnalysisRecommendations(top3, recomContainer);
        } catch (error) {
            console.error('Recommendations load failed:', error);
            recomContainer.innerHTML = `
                <p style="color:var(--text-muted); font-size:0.85rem; text-align:center;">
                    Could not fetch matching jobs at this moment. You can try searching manually in the "Search Jobs" tab.
                </p>
            `;
        }
    }

    function renderAnalysisRecommendations(jobs, container) {
        container.innerHTML = '';

        if (jobs.length === 0) {
            container.innerHTML = `
                <p style="color:var(--text-secondary); font-size:0.9rem; text-align:center; padding:0.5rem;">
                    No direct matching jobs found in Sofia/Bulgaria currently. Try checking the "Search Jobs" tab for global/remote options.
                </p>
            `;
            return;
        }

        jobs.forEach(job => {
            const score = job.match_score || 0;
            let scoreColor = '#ef4444'; // Red
            if (score >= 70) scoreColor = '#10b981'; // Green
            else if (score >= 40) scoreColor = '#f59e0b'; // Amber

            const item = document.createElement('div');
            item.className = 'fade-in';
            item.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid var(--glass-border);
                border-radius: 8px;
                padding: 12px 16px;
                gap: 15px;
                flex-wrap: wrap;
                transition: var(--transition);
            `;
            
            item.innerHTML = `
                <div style="flex:1; min-width:200px;">
                    <h4 style="margin:0; font-size:1rem; color:var(--text-primary);">${job.title}</h4>
                    <p style="margin:4px 0 0 0; font-size:0.85rem; color:var(--text-secondary);">
                        🏢 ${job.company} • 📍 ${job.location} ${job.remote ? '• 🌐 Remote' : ''}
                    </p>
                    <p style="margin:8px 0 0 0; font-size:0.8rem; color:var(--text-muted); font-style:italic;">
                        💡 ${job.match_reason}
                    </p>
                </div>
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <span style="font-weight:bold; color:${scoreColor}; font-size:0.95rem; background:rgba(0,0,0,0.15); padding:4px 8px; border-radius:12px; border:1px solid ${scoreColor}30;">
                        ${score}% Match
                    </span>
                    <button class="btn-cover-letter btn-secondary" style="font-size:0.8rem; padding:6px 12px; border-radius:6px; font-weight:bold; display:inline-flex; align-items:center; gap:4px;">
                        📝 Cover Letter
                    </button>
                    <a href="${job.url}" target="_blank" class="btn-primary" style="text-decoration:none; font-size:0.8rem; padding:6px 12px; border-radius:6px; font-weight:bold;">
                        Apply ↗
                    </a>
                </div>
            `;
            
            // Hook up cover letter button
            const coverLetterBtn = item.querySelector('.btn-cover-letter');
            coverLetterBtn.addEventListener('click', () => {
                const cv = cvText?.value?.trim();
                if (!cv) {
                    showToast('Please upload or paste your CV/Resume first.', 'error');
                    switchTab('analyze');
                    return;
                }
                generateCoverLetter(cv, job);
            });

            container.appendChild(item);
        });
    }

    // 6. Cover Letter Modal & API logic
    const coverLetterModal = document.getElementById('cover-letter-modal');
    const coverLetterTextarea = document.getElementById('cover-letter-text');
    const modalLoading = document.getElementById('modal-loading');
    const copyLetterBtn = document.getElementById('copy-letter-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const closeModalBtnBottom = document.getElementById('close-modal-btn-bottom');

    async function generateCoverLetter(cv, job) {
        if (!coverLetterModal) return;
        
        // Show modal and loading state
        coverLetterModal.style.display = 'flex';
        if (modalLoading) modalLoading.style.display = 'flex';
        if (coverLetterTextarea) {
            coverLetterTextarea.style.display = 'none';
            coverLetterTextarea.value = '';
        }
        if (copyLetterBtn) copyLetterBtn.disabled = true;

        try {
            const response = await fetch('/generate-cover-letter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cv_text: cv,
                    job_description: job.description,
                    job_title: job.title,
                    company: job.company
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Cover Letter generation failed');
            }

            const data = await response.json();
            
            if (coverLetterTextarea) {
                coverLetterTextarea.value = data.cover_letter || '';
                coverLetterTextarea.style.display = 'block';
            }
            if (copyLetterBtn) copyLetterBtn.disabled = false;
            showToast('Cover letter generated!', 'success');
        } catch (error) {
            console.error('Cover letter error:', error);
            showToast(error.message || 'Failed to generate cover letter.', 'error');
            closeModal();
        } finally {
            if (modalLoading) modalLoading.style.display = 'none';
        }
    }

    function closeModal() {
        if (coverLetterModal) coverLetterModal.style.display = 'none';
    }

    function copyCoverLetter() {
        if (!coverLetterTextarea) return;
        coverLetterTextarea.select();
        navigator.clipboard.writeText(coverLetterTextarea.value)
            .then(() => {
                showToast('Cover letter copied to clipboard!', 'success');
            })
            .catch(err => {
                console.error('Copy failed:', err);
                showToast('Failed to copy text automatically.', 'error');
            });
    }

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (closeModalBtnBottom) closeModalBtnBottom.addEventListener('click', closeModal);
    if (copyLetterBtn) copyLetterBtn.addEventListener('click', copyCoverLetter);

    if (coverLetterModal) {
        coverLetterModal.addEventListener('click', (e) => {
            if (e.target === coverLetterModal) {
                closeModal();
            }
        });
    }




    function animateMatchScore(targetPercentage) {
        if (!matchScoreCircle || !matchScoreText) return;

        let current = 0;
        const duration = 1500; // ms
        const increment = targetPercentage / (duration / 16); // roughly 60fps

        // Color coding
        matchScoreCircle.classList.remove('score-high', 'score-medium', 'score-low');
        if (targetPercentage >= 70) {
            matchScoreCircle.classList.add('score-high');
            matchScoreCircle.style.borderColor = '#10b981'; // Green
        } else if (targetPercentage >= 40) {
            matchScoreCircle.classList.add('score-medium');
            matchScoreCircle.style.borderColor = '#f59e0b'; // Amber
        } else {
            matchScoreCircle.classList.add('score-low');
            matchScoreCircle.style.borderColor = '#ef4444'; // Red
        }

        const animate = () => {
            current += increment;
            if (current >= targetPercentage) {
                current = targetPercentage;
                matchScoreText.textContent = `${Math.round(current)}%`;
                return;
            }
            matchScoreText.textContent = `${Math.round(current)}%`;
            requestAnimationFrame(animate);
        };
        
        if (targetPercentage > 0) {
            requestAnimationFrame(animate);
        } else {
            matchScoreText.textContent = '0%';
        }
    }

    // 6. Clear Function
    function clearForm() {
        if (cvText) cvText.value = '';
        if (jobDescription) jobDescription.value = '';
        if (resultsContainer) resultsContainer.classList.add('hidden');
        showToast('Form cleared', 'info');
    }

    // 7. Upload Zone
    if (uploadZone) {
        uploadZone.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });

        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('drag-over');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            handleFileUpload(e.dataTransfer.files);
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            handleFileUpload(e.target.files);
        });
    }

    async function handleFileUpload(files) {
        if (!files || files.length === 0) return;

        const file = files[0];
        const allowedTypes = ['.pdf', '.docx'];
        const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        
        if (!allowedTypes.includes(ext)) {
            showToast('Please upload a PDF or DOCX file.', 'error');
            return;
        }

        // Show upload feedback
        if (uploadZone) {
            uploadZone.classList.add('uploading');
            uploadZone.innerHTML = '<div class="spinner" style="width:30px;height:30px;border-width:2px;"></div><p>Extracting text from ' + file.name + '...</p>';
        }

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/upload-cv', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Upload failed');
            }

            const data = await response.json();
            
            // Populate CV textarea with extracted text
            if (cvText) {
                cvText.value = data.text;
                cvText.focus();
            }

            showToast(`✅ Text extracted from ${data.filename}`, 'success');
        } catch (error) {
            console.error('Upload error:', error);
            showToast(error.message || 'Failed to process file.', 'error');
        } finally {
            // Reset upload zone
            if (uploadZone) {
                uploadZone.classList.remove('uploading');
                uploadZone.innerHTML = '<span class="upload-icon">📄</span><p>Drag & drop your resume (PDF/DOCX) or click to browse</p>';
            }
            // Reset file input
            if (fileInput) fileInput.value = '';
        }
    }

    // 8. Toast Notifications
    function showToast(message, type = 'info') {
        let container = toastContainer;
        
        // If toastContainer isn't in DOM, create it temporarily
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let bgColor, icon;
        switch(type) {
            case 'success': bgColor = '#10b981'; icon = '✓'; break;
            case 'error': bgColor = '#ef4444'; icon = '✕'; break;
            default: bgColor = '#3b82f6'; icon = 'ℹ'; break;
        }

        toast.style.cssText = `
            background-color: ${bgColor};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            animation: slideInRight 0.3s ease forwards;
            opacity: 0;
            transform: translateX(100%);
            font-family: 'Inter', sans-serif;
            font-size: 14px;
        `;

        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }

    // Dynamic style injection for toast animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideOutRight {
            to { opacity: 0; transform: translateX(100%); }
        }
    `;
    document.head.appendChild(style);

    // 9. Job Search Function
    const searchJobsBtn = document.getElementById('search-jobs-btn');
    const searchQueryInput = document.getElementById('search-query');
    const searchLocationInput = document.getElementById('search-location');
    const searchResultsContainer = document.getElementById('search-results-container');
    const jobsList = document.getElementById('jobs-list');

    async function searchJobs() {
        const cv = cvText?.value?.trim();
        const query = searchQueryInput?.value?.trim() || "";
        const location = searchLocationInput?.value?.trim() || "";

        if (!cv) {
            showToast('Please upload or paste your CV/Resume first.', 'error');
            switchTab('analyze');
            return;
        }

        // Show loading state
        if (loadingOverlay) {
            const overlayText = loadingOverlay.querySelector('p');
            if (overlayText) overlayText.textContent = 'Searching & AI ranking jobs for you...';
            loadingOverlay.classList.remove('hidden');
        }
        if (searchResultsContainer) searchResultsContainer.classList.add('hidden');

        try {
            const response = await fetch('/search-jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cv_text: cv, query: query, location: location })
            });

            if (!response.ok) {
                throw new Error('Search request failed');
            }

            const data = await response.json();
            renderJobs(data.jobs || []);
            
            if (searchResultsContainer) {
                searchResultsContainer.classList.remove('hidden');
                searchResultsContainer.classList.add('slide-up');
            }
            showToast('Found matches matching your skills!', 'success');
        } catch (error) {
            console.error('Job search error:', error);
            showToast('Failed to find jobs. Please try again.', 'error');
        } finally {
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
                // Reset loading text
                const overlayText = loadingOverlay.querySelector('p');
                if (overlayText) overlayText.textContent = 'Analyzing your profile...';
            }
        }
    }

    function renderJobs(jobs) {
        if (!jobsList) return;
        jobsList.innerHTML = '';

        if (jobs.length === 0) {
            jobsList.innerHTML = `
                <div class="result-card" style="text-align: center; padding: 2rem;">
                    <p style="color: var(--text-secondary);">No matching job openings found for your query. Try a different keyword!</p>
                </div>
            `;
            return;
        }

        jobs.forEach(job => {
            const score = job.match_score || 0;
            let scoreColor = '#ef4444'; // Red
            if (score >= 70) scoreColor = '#10b981'; // Green
            else if (score >= 40) scoreColor = '#f59e0b'; // Amber

            const card = document.createElement('div');
            card.className = 'result-card job-card fade-in';
            card.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 1rem;
                background: var(--glass-bg);
                border: 1px solid var(--glass-border);
                border-radius: var(--border-radius);
                padding: 1.5rem;
                position: relative;
                transition: var(--transition);
            `;

            // Parse description snippet
            const descSnippet = job.description
                .replace(/<[^>]*>/g, '') // strip html
                .substring(0, 220) + '...';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.25rem; color: var(--text-primary);">${job.title}</h3>
                        <p style="margin: 5px 0 0 0; color: var(--accent-1); font-weight: 500; font-size: 0.95rem;">
                            🏢 ${job.company} • 📍 ${job.location} ${job.remote ? '• 🌐 Remote' : ''}
                        </p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.2); padding: 8px 14px; border-radius: 20px; border: 1px solid ${scoreColor}40;">
                        <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Match:</span>
                        <strong style="color: ${scoreColor}; font-size: 1.1rem;">${score}%</strong>
                    </div>
                </div>
                
                <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5;">
                    ${descSnippet}
                </p>

                <div style="background: rgba(255,255,255,0.02); padding: 12px 16px; border-radius: 8px; border-left: 3px solid var(--accent-1); font-size: 0.9rem; color: var(--text-primary); line-height: 1.4;">
                    <strong>💡 AI Evaluation:</strong> ${job.match_reason}
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 5px;">
                    <button class="btn-cover-letter btn-secondary" style="font-size: 0.85rem; padding: 8px 16px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
                        📝 Cover Letter
                    </button>
                    <a href="${job.url}" target="_blank" class="btn-primary" style="text-decoration: none; font-size: 0.85rem; padding: 8px 16px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
                        Apply Now ↗
                    </a>
                </div>
            `;

            // Hook up cover letter button
            const coverLetterBtn = card.querySelector('.btn-cover-letter');
            coverLetterBtn.addEventListener('click', () => {
                const cv = cvText?.value?.trim();
                if (!cv) {
                    showToast('Please upload or paste your CV/Resume first.', 'error');
                    switchTab('analyze');
                    return;
                }
                generateCoverLetter(cv, job);
            });

            jobsList.appendChild(card);
        });
    }

    // 10. History Functions
    const refreshHistoryBtn = document.getElementById('refresh-history-btn');

    async function loadHistory() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;
        
        historyList.innerHTML = `
            <div style="text-align:center; padding:2rem;">
                <div class="spinner" style="width:30px; height:30px; border-width:2px; margin:0 auto;"></div>
                <p style="color:var(--text-secondary); margin-top:10px;">Loading history...</p>
            </div>
        `;

        try {
            const response = await fetch('/history');
            if (!response.ok) throw new Error('Failed to fetch history');
            const data = await response.json();
            renderHistory(data.history || []);
        } catch (error) {
            console.error('History load error:', error);
            showToast('Failed to load history.', 'error');
            historyList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding:2rem;">Failed to load history items.</p>';
        }
    }

    function renderHistory(items) {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;
        historyList.innerHTML = '';

        if (items.length === 0) {
            historyList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding:2rem;">No analysis history yet. Analyze a resume to see it here!</p>';
            return;
        }

        items.forEach(item => {
            const score = item.match_score;
            let scoreColor = '#ef4444'; // Red
            if (score >= 70) scoreColor = '#10b981'; // Green
            else if (score >= 40) scoreColor = '#f59e0b'; // Amber

            const card = document.createElement('div');
            card.className = 'result-card history-card fade-in';
            card.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 1rem;
                background: var(--glass-bg);
                border: 1px solid var(--glass-border);
                border-radius: var(--border-radius);
                padding: 1.5rem;
                margin-bottom: 1rem;
                transition: var(--transition);
            `;

            const cvPreview = item.cv_text.substring(0, 100) + '...';
            const jdPreview = item.job_description.substring(0, 100) + '...';

            // Convert Markdown tags to simple HTML tags for display
            const formattedResult = item.result
                .replace(/###\s*(.*?)\n/g, '<h4 style="margin:15px 0 8px 0; color:var(--accent-1);">$1</h4>')
                .replace(/\*\*Match Percentage:\*\*\s*(.*?)\n/g, '<strong>Match Percentage:</strong> $1<br>')
                .replace(/[-*•]\s+(.*?)\n/g, '<li style="margin-left:15px; color:var(--text-secondary); font-size:0.9rem;">$1</li>')
                .replace(/\n/g, '<br>');

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <div style="background:rgba(0,0,0,0.2); padding:6px 12px; border-radius:15px; border:1px solid ${scoreColor}40; color:${scoreColor}; font-weight:bold;">
                            ${score}% Match
                        </div>
                        <span style="color:var(--text-muted); font-size:0.85rem;">📅 ${item.created_at}</span>
                    </div>
                    <button class="btn-delete" style="background:transparent; border:none; color:var(--error); cursor:pointer; font-size:0.9rem; padding:4px 8px; border-radius:4px; transition:var(--transition);" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='transparent'">
                        🗑 Delete
                    </button>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; font-size:0.85rem; color:var(--text-secondary); background:rgba(0,0,0,0.15); padding:10px; border-radius:8px;">
                    <div>
                        <strong>CV Preview:</strong><br>
                        <span style="color:var(--text-muted); font-style:italic;">${cvPreview}</span>
                    </div>
                    <div>
                        <strong>Job Preview:</strong><br>
                        <span style="color:var(--text-muted); font-style:italic;">${jdPreview}</span>
                    </div>
                </div>

                <div id="details-${item.id}" class="hidden" style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--glass-border); max-height:400px; overflow-y:auto; padding-right:5px;">
                    <h3 style="font-size:1.1rem; color:var(--text-primary); margin-bottom:10px;">Full Analysis Report</h3>
                    <div style="line-height:1.6; font-size:0.9rem; color:var(--text-secondary);">
                        ${formattedResult}
                    </div>
                </div>

                <div style="display:flex; justify-content:flex-end;">
                    <button class="btn-toggle-details btn-secondary" style="font-size:0.8rem; padding:6px 12px; border-radius:6px;">
                        👀 View Full Report
                    </button>
                </div>
            `;

            // Hook up details toggle
            const toggleBtn = card.querySelector('.btn-toggle-details');
            const detailsDiv = card.querySelector(`#details-${item.id}`);
            toggleBtn.addEventListener('click', () => {
                if (detailsDiv.classList.contains('hidden')) {
                    detailsDiv.classList.remove('hidden');
                    toggleBtn.textContent = '🙈 Hide Report';
                } else {
                    detailsDiv.classList.add('hidden');
                    toggleBtn.textContent = '👀 View Full Report';
                }
            });

            // Hook up delete
            const deleteBtn = card.querySelector('.btn-delete');
            deleteBtn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete this analysis record?')) {
                    await deleteHistoryRecord(item.id, card);
                }
            });

            historyList.appendChild(card);
        });
    }

    async function deleteHistoryRecord(id, cardElement) {
        try {
            const response = await fetch(`/history/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Delete failed');
            
            // Fade out and remove element
            cardElement.style.transition = 'all 0.3s ease';
            cardElement.style.opacity = '0';
            cardElement.style.transform = 'translateY(10px)';
            setTimeout(() => {
                cardElement.remove();
                // Check if history is now empty
                const historyList = document.getElementById('history-list');
                if (historyList && historyList.children.length === 0) {
                    historyList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding:2rem;">No analysis history yet. Analyze a resume to see it here!</p>';
                }
            }, 300);

            showToast('Record deleted successfully.', 'success');
        } catch (error) {
            console.error('Delete history error:', error);
            showToast('Failed to delete history record.', 'error');
        }
    }

    // 11. Subscription Functions
    const subscribeBtn = document.getElementById('subscribe-btn');
    const unsubscribeBtn = document.getElementById('unsubscribe-btn');
    const alertEmailInput = document.getElementById('alert-email');

    // Load saved email if exists
    if (alertEmailInput) {
        const savedEmail = localStorage.getItem('alert_email');
        if (savedEmail) alertEmailInput.value = savedEmail;
    }

    async function subscribeUser() {
        const email = alertEmailInput?.value?.trim();
        const cv = cvText?.value?.trim();
        const query = searchQueryInput?.value?.trim() || "";
        const location = searchLocationInput?.value?.trim() || "";

        if (!cv) {
            showToast('Please upload or paste your CV/Resume first to subscribe.', 'error');
            switchTab('analyze');
            return;
        }

        if (!email || !validateEmail(email)) {
            showToast('Please enter a valid email address.', 'error');
            return;
        }

        try {
            const response = await fetch('/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    cv_text: cv,
                    query: query,
                    location: location
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Subscription failed');
            }

            const data = await response.json();
            localStorage.setItem('alert_email', email);
            showToast(`🔔 Alerts set: checks every 10 mins for matching jobs. Check debug_emails.log!`, 'success');
        } catch (error) {
            console.error('Subscription error:', error);
            showToast(error.message || 'Failed to subscribe.', 'error');
        }
    }

    async function unsubscribeUser() {
        const email = alertEmailInput?.value?.trim();

        if (!email || !validateEmail(email)) {
            showToast('Please enter a valid email address to unsubscribe.', 'error');
            return;
        }

        try {
            const response = await fetch('/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Unsubscription failed');
            }

            localStorage.removeItem('alert_email');
            alertEmailInput.value = '';
            showToast('Unsubscribed from email alerts.', 'info');
        } catch (error) {
            console.error('Unsubscription error:', error);
            showToast(error.message || 'Failed to unsubscribe.', 'error');
        }
    }

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // 12. ATS Optimizer Functions
    const optimizeResumeBtn = document.getElementById('optimize-resume-btn');
    const optimizerModal = document.getElementById('optimizer-modal');
    const optimizedResumeTextarea = document.getElementById('optimized-resume-text');
    const optimizerLoading = document.getElementById('optimizer-loading');
    const copyOptimizedBtn = document.getElementById('copy-optimized-btn');
    const closeOptimizerBtn = document.getElementById('close-optimizer-btn');
    const closeOptimizerBtnBottom = document.getElementById('close-optimizer-btn-bottom');

    async function optimizeResume() {
        const cv = cvText?.value?.trim();
        const jd = jobDescription?.value?.trim();

        if (!cv || !jd) {
            showToast('Please analyze your CV against a job description first.', 'error');
            return;
        }

        if (!optimizerModal) return;

        // Show modal and loading state
        optimizerModal.style.display = 'flex';
        if (optimizerLoading) optimizerLoading.style.display = 'flex';
        if (optimizedResumeTextarea) {
            optimizedResumeTextarea.style.display = 'none';
            optimizedResumeTextarea.value = '';
        }
        if (copyOptimizedBtn) copyOptimizedBtn.disabled = true;

        try {
            const response = await fetch('/optimize-resume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cv_text: cv, job_description: jd })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Optimization failed');
            }

            const data = await response.json();

            if (optimizedResumeTextarea) {
                optimizedResumeTextarea.value = data.optimized_cv || '';
                optimizedResumeTextarea.style.display = 'block';
            }
            if (copyOptimizedBtn) copyOptimizedBtn.disabled = false;
            showToast('Resume keywords optimized for ATS!', 'success');
        } catch (error) {
            console.error('Optimizer error:', error);
            showToast(error.message || 'Failed to optimize resume.', 'error');
            closeOptimizerModal();
        } finally {
            if (optimizerLoading) optimizerLoading.style.display = 'none';
        }
    }

    function closeOptimizerModal() {
        if (optimizerModal) optimizerModal.style.display = 'none';
    }

    function copyOptimizedCV() {
        if (!optimizedResumeTextarea) return;
        optimizedResumeTextarea.select();
        navigator.clipboard.writeText(optimizedResumeTextarea.value)
            .then(() => {
                showToast('Optimized CV copied to clipboard!', 'success');
            })
            .catch(err => {
                console.error('Copy failed:', err);
                showToast('Failed to copy text automatically.', 'error');
            });
    }

    if (optimizeResumeBtn) optimizeResumeBtn.addEventListener('click', optimizeResume);
    if (closeOptimizerBtn) closeOptimizerBtn.addEventListener('click', closeOptimizerModal);
    if (closeOptimizerBtnBottom) closeOptimizerBtnBottom.addEventListener('click', closeOptimizerModal);
    if (copyOptimizedBtn) copyOptimizedBtn.addEventListener('click', copyOptimizedCV);

    if (optimizerModal) {
        optimizerModal.addEventListener('click', (e) => {
            if (e.target === optimizerModal) {
                closeOptimizerModal();
            }
        });
    }

    // 13. Event Listeners
    if (analyzeBtn) analyzeBtn.addEventListener('click', analyzeCV);
    if (clearBtn) clearBtn.addEventListener('click', clearForm);
    if (searchJobsBtn) searchJobsBtn.addEventListener('click', searchJobs);
    if (refreshHistoryBtn) refreshHistoryBtn.addEventListener('click', loadHistory);
    if (subscribeBtn) subscribeBtn.addEventListener('click', subscribeUser);
    if (unsubscribeBtn) unsubscribeBtn.addEventListener('click', unsubscribeUser);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            const activeTab = document.querySelector('.tab.active');
            if (activeTab && activeTab.dataset.tab === 'search') {
                searchJobs();
            } else if (activeTab && activeTab.dataset.tab === 'history') {
                loadHistory();
            } else {
                analyzeCV();
            }
        }
    });
});
