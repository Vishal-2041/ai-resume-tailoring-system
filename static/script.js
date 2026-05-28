document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('resume-upload');
    const fileNameDisplay = document.getElementById('file-name');
    const jobDescriptionInput = document.getElementById('job-description');
    const analyzeBtn = document.getElementById('analyze-btn');

    const loadingState = document.getElementById('loading-state');
    const resultsSection = document.getElementById('results-section');

    const scoreValue = document.getElementById('score-value');
    const scorePath = document.getElementById('score-path');
    const skillsList = document.getElementById('skills-list');

    // Builder Elements
    const builderWorkspace = document.getElementById('builder-workspace');
    const markdownEditor = document.getElementById('markdown-editor');
    const tailoredPreview = document.getElementById('tailored-preview');
    const downloadBtn = document.getElementById('download-btn');
    const previewToggleBtn = document.getElementById('preview-toggle-btn');
    const editorPane = document.getElementById('editor-pane');
    const previewPane = document.getElementById('preview-pane');

    // Navigation Elements
    const navHome = document.getElementById('nav-home');
    const navOptimizer = document.getElementById('nav-optimizer');
    const navBuilder = document.getElementById('nav-builder');
    const homeSection = document.getElementById('home-section');
    const optimizerSection = document.getElementById('optimizer-section');
    const buildSection = document.getElementById('build-section');
    const mainHeader = document.getElementById('main-header');

    let selectedFile = null;

    // --- Navigation Logic ---
    function switchTab(tab) {
        if (navHome) navHome.classList.remove('active');
        if (navOptimizer) navOptimizer.classList.remove('active');
        if (navBuilder) navBuilder.classList.remove('active');

        if (homeSection) homeSection.classList.add('hidden');
        if (optimizerSection) optimizerSection.classList.add('hidden');
        if (buildSection) buildSection.classList.add('hidden');
        if (mainHeader) mainHeader.classList.add('hidden');

        if (tab === 'home') {
            if (navHome) navHome.classList.add('active');
            if (homeSection) homeSection.classList.remove('hidden');
        } else if (tab === 'optimizer') {
            if (navOptimizer) navOptimizer.classList.add('active');
            if (optimizerSection) optimizerSection.classList.remove('hidden');
            if (mainHeader) mainHeader.classList.remove('hidden');
        } else if (tab === 'builder') {
            if (navBuilder) navBuilder.classList.add('active');
            if (buildSection) buildSection.classList.remove('hidden');
            if (mainHeader) mainHeader.classList.remove('hidden');
        }
    }

    if (navHome) navHome.addEventListener('click', () => switchTab('home'));
    if (navOptimizer) navOptimizer.addEventListener('click', () => switchTab('optimizer'));
    if (navBuilder) navBuilder.addEventListener('click', () => switchTab('builder'));

    const heroCtaCheck = document.getElementById('hero-cta-check');
    if (heroCtaCheck) {
        heroCtaCheck.addEventListener('click', () => {
            switchTab('optimizer');
        });
    }

    // --- Original Optimizer Logic ---
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    function handleFileSelect(file) {
        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file.');
            return;
        }
        selectedFile = file;
        fileNameDisplay.innerHTML = `<i class="fa-solid fa-check"></i> ${file.name}`;
    }

    // --- Client-Side Helpers ---
    const GEMINI_API_KEY = 'AIzaSyBmmbKnOWyebCl2jRHjKJUkFbYVm-k7s7M';

    async function extractTextFromPDF(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const strings = content.items.map(item => item.str);
            text += strings.join(' ') + '\n';
        }
        return text;
    }

    function simpleHash(str) {
        let hash = 0;
        for (let i = 0, len = str.length; i < len; i++) {
            let chr = str.charCodeAt(i);
            hash = (hash << 5) - hash + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }

    async function callGemini(prompt, isJSON = false, retries = 5) {
        const cacheKey = 'gemini_cache_' + simpleHash(prompt + (isJSON ? '_json' : ''));
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            console.log("Using cached Gemini response to save API quota.");
            return cached;
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const requestBody = { contents: [{ parts: [{ text: prompt }] }] };
        if (isJSON) requestBody.generationConfig = { responseMimeType: "application/json" };

        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (response.ok) {
                    const data = await response.json();
                    const resultText = data.candidates[0].content.parts[0].text;
                    try {
                        localStorage.setItem(cacheKey, resultText);
                    } catch (e) {
                        console.warn("Could not save to localStorage.");
                    }
                    return resultText;
                }

                const errText = await response.text();

                // If Rate Limited (HTTP 429)
                if (response.status === 429) {
                    let retryDelayMs = (i + 1) * 5000;

                    try {
                        const errObj = JSON.parse(errText);
                        const retryInfo = errObj.error?.details?.find(d => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
                        if (retryInfo && retryInfo.retryDelay) {
                            const match = retryInfo.retryDelay.match(/([0-9.]+)/);
                            if (match) retryDelayMs = (parseFloat(match[1]) * 1000) + 2000; // Add 2s buffer
                        }
                    } catch (e) { }

                    if (i < retries - 1) {
                        const countdownSeconds = Math.ceil(retryDelayMs / 1000);
                        console.warn(`Gemini API Quota Exceeded. Retrying in ${countdownSeconds}s... (Attempt ${i + 1} of ${retries})`);

                        let loadingElement = null;
                        let originalContent = '';

                        if (loadingState && !loadingState.classList.contains('hidden')) {
                            loadingElement = loadingState;
                            originalContent = loadingState.innerHTML;
                            loadingState.innerHTML = `<span><i class="fa-solid fa-spinner fa-spin"></i> Rate Limit Reached. Waiting ${countdownSeconds}s...</span>`;
                        } else if (document.getElementById('btn-check-ats')?.disabled) {
                            loadingElement = document.getElementById('btn-check-ats');
                            originalContent = loadingElement.innerHTML;
                            loadingElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Wait ${countdownSeconds}s...`;
                        } else if (document.getElementById('btn-auto-tailor')?.disabled) {
                            loadingElement = document.getElementById('btn-auto-tailor');
                            originalContent = loadingElement.innerHTML;
                            loadingElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Wait ${countdownSeconds}s...`;
                        }

                        await new Promise(resolve => setTimeout(resolve, retryDelayMs));

                        if (loadingElement) {
                            loadingElement.innerHTML = originalContent;
                        }
                        continue;
                    }
                    alert("Google Gemini API Limit Reached! Google allows 15 requests per minute on the free tier. Please wait 1 minute before trying again.");
                    throw new Error(`Gemini API Quota Exceeded. Please try again in 1-2 minutes or check your API key limits.`);
                }
                throw new Error(errText);
            } catch (err) {
                if (i === retries - 1) throw err;
                await new Promise(resolve => setTimeout(resolve, 4000 * (i + 1)));
            }
        }
    }

    async function processResumeAnalysis(pdfBlob, jdText) {
        const resumeText = await extractTextFromPDF(pdfBlob);

        const analysisPrompt = `
        You are an expert ATS Optimization Specialist and Executive Resume Writer. Analyze the provided Resume against the Job Description and tailor it.
        Return a JSON object with exactly these fields:
        - "ats_score": An integer from 0 to 100 representing the match percentage.
        - "missing_skills": A list of up to 15 strings. CRITICAL: Include ONLY specific technical skills, software tools, or hard requirements from the JD that are missing. DO NOT include soft skills, action verbs, or generic terms like 'role', 'team', 'work', 'motivated', 'intern'.
        - "suggestions": A list of up to 3 strings containing short, highly actionable advice on how to improve this resume to get this specific job.
        - "tailored_resume": A string containing the tailored resume naturally incorporating missing skills. Do not invent false experience. Return this string professionally structured using standard markdown formatting (e.g., "# Name", "## Professional Summary"). Do NOT use plain unformatted text.
        
        Resume:
        ${resumeText}
        
        Job Description:
        ${jdText}
        `;
        const analysisDataStr = await callGemini(analysisPrompt, true);
        const analysisData = JSON.parse(analysisDataStr);

        return {
            ats_score: analysisData.ats_score || 0,
            missing_skills: analysisData.missing_skills || [],
            suggestions: analysisData.suggestions || [],
            tailored_resume: analysisData.tailored_resume || "Error generating tailored resume."
        };
    }

    // Analyze Button Click
    analyzeBtn.addEventListener('click', async () => {
        if (!selectedFile) {
            alert('Please upload your Resume (PDF) first.');
            return;
        }
        const jd = jobDescriptionInput.value.trim();
        if (!jd) {
            alert('Please paste a Job Description.');
            return;
        }

        analyzeBtn.disabled = true;
        resultsSection.classList.add('hidden');
        loadingState.classList.remove('hidden');

        try {
            const data = await processResumeAnalysis(selectedFile, jd);
            displayResults(data);
        } catch (error) {
            console.error('Error during analysis:', error);
            alert(error.message);
            loadingState.classList.add('hidden');
            analyzeBtn.disabled = false;
        }
    });

    function displayResults(data) {
        loadingState.classList.add('hidden');
        resultsSection.classList.remove('hidden');
        analyzeBtn.disabled = false;

        const score = data.ats_score;
        scoreValue.textContent = `${score}%`;
        setTimeout(() => {
            scorePath.setAttribute('stroke-dasharray', `${score}, 100`);
            if (score >= 80) scorePath.style.stroke = 'var(--success)';
            else if (score >= 60) scorePath.style.stroke = 'var(--warning)';
            else scorePath.style.stroke = 'var(--danger)';
        }, 100);

        skillsList.innerHTML = '';
        if (data.missing_skills && data.missing_skills.length > 0) {
            const skillsToShow = data.missing_skills.slice(0, 15);
            skillsToShow.forEach(skill => {
                const span = document.createElement('span');
                span.className = 'skill-tag';
                span.textContent = skill;
                skillsList.appendChild(span);
            });
        } else {
            skillsList.innerHTML = '<span style="color: var(--success);"><i class="fa-solid fa-check"></i> Great match! No major missing skills found.</span>';
        }

        const suggestionsList = document.getElementById('suggestions-list');
        if (suggestionsList) {
            suggestionsList.innerHTML = '';
            if (data.suggestions && data.suggestions.length > 0) {
                data.suggestions.forEach(suggestion => {
                    const div = document.createElement('div');
                    div.style.display = 'flex';
                    div.style.alignItems = 'start';
                    div.innerHTML = `<i class="fa-solid fa-arrow-right" style="color: var(--primary); margin-right: 0.5rem; margin-top: 0.3rem;"></i> <span>${suggestion}</span>`;
                    suggestionsList.appendChild(div);
                });
            } else {
                suggestionsList.innerHTML = '<span>No specific suggestions at this time.</span>';
            }
        }

        if (data.tailored_resume) {
            builderWorkspace.classList.remove('hidden');
            markdownEditor.value = data.tailored_resume;
            renderMarkdown();
        } else {
            builderWorkspace.classList.remove('hidden');
            markdownEditor.value = "# Error\nAPI Key error or limits hit. Tailored resume not generated.";
            renderMarkdown();
        }
    }

    // --- Shared Optimizer Builder Logic ---
    function safeParseMarkdown(markdownText) {
        if (window.marked) {
            if (typeof window.marked.parse === 'function') return window.marked.parse(markdownText);
            if (typeof window.marked === 'function') return window.marked(markdownText);
        }

        const escapeHtml = (text) => text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        let text = escapeHtml(markdownText || '');
        text = text.replace(/\r\n/g, '\n');

        text = text.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>');
        text = text.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>');
        text = text.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
        text = text.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
        text = text.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
        text = text.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');
        text = text.replace(/^\s*[-*+]\s+(.*)$/gm, '<li>$1</li>');
        text = text.replace(/(?:<li>.*?<\/li>\n?)+/gms, function (group) { return '<ul>' + group.trim() + '</ul>'; });

        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        const blocks = text.split(/\n{2,}/g).map((block) => {
            block = block.trim();
            if (!block) return '';
            if (block.startsWith('<h') || block.startsWith('<ul>') || block.startsWith('<li>')) return block;
            return `<p>${block}</p>`;
        });

        return blocks.join('\n');
    }

    function renderMarkdown() {
        if (!markdownEditor || !tailoredPreview) return;
        const markdownText = markdownEditor.value;
        tailoredPreview.innerHTML = safeParseMarkdown(markdownText);
    }

    if (markdownEditor) {
        markdownEditor.addEventListener('input', renderMarkdown);
    }

    async function exportResumeElementToPdf(elementOrId, filename) {
        const element = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
        if (!element) return;
        document.body.classList.add('print-mode');
        element.classList.add('print-target');
        const originalTitle = document.title;
        document.title = filename.replace('.pdf', '');
        window.print();
        document.title = originalTitle;
        document.body.classList.remove('print-mode');
        element.classList.remove('print-target');
    }

    let isPreviewing = true;
    if (previewToggleBtn) {
        previewToggleBtn.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                if (isPreviewing) {
                    editorPane.style.display = 'flex';
                    previewPane.style.display = 'none';
                    previewToggleBtn.innerHTML = '<i class="fa-solid fa-eye"></i> View Preview';
                } else {
                    editorPane.style.display = 'none';
                    previewPane.style.display = 'flex';
                    previewToggleBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Text';
                }
                isPreviewing = !isPreviewing;
            } else {
                if (isPreviewing) {
                    editorPane.style.display = 'none';
                    previewToggleBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Show Editor';
                } else {
                    editorPane.style.display = 'flex';
                    previewToggleBtn.innerHTML = '<i class="fa-solid fa-eye"></i> Hide Editor';
                }
                isPreviewing = !isPreviewing;
            }
        });
    }

    window.addEventListener('resize', () => {
        if (editorPane && previewPane) {
            editorPane.style.display = 'flex';
            previewPane.style.display = 'flex';
            isPreviewing = true;
            if (previewToggleBtn) previewToggleBtn.innerHTML = '<i class="fa-solid fa-eye"></i> Toggle View';
        }
    });

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const element = document.querySelector('#tailored-preview')?.closest('.resume-document-wrapper') || document.getElementById('tailored-preview');
            downloadBtn.disabled = true;
            downloadBtn.innerText = 'Exporting...';
            exportResumeElementToPdf(element, 'Tailored_Resume.pdf').then(() => {
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Download PDF';
            }).catch((err) => {
                console.error('PDF export failed:', err);
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Download PDF';
                alert('Unable to generate the PDF. Please refresh and try again.');
            });
        });
    }

    // --- Live Resume Builder Logic ---
    const liveTemplateBtns = document.querySelectorAll('#live-template-selector .template-btn');
    const livePreviewContainer = document.getElementById('live-preview-container');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.form-tab-content');

    const liveInputs = {
        firstName: document.getElementById('live-first-name'),
        lastName: document.getElementById('live-last-name'),
        jobTitle: document.getElementById('live-job-title'),
        email: document.getElementById('live-email'),
        phone: document.getElementById('live-phone'),
        location: document.getElementById('live-location'),
        linkedin: document.getElementById('live-linkedin'),
        portfolio: document.getElementById('live-portfolio'),
        summary: document.getElementById('live-summary'),
        skills: document.getElementById('live-skills'),
        certs: document.getElementById('live-certs')
    };

    let liveTemplate = 'classic';
    let liveExperience = [];
    let liveEducation = [];
    let liveProjects = [];

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.remove('hidden');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    liveTemplateBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            liveTemplateBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            liveTemplate = btn.dataset.template;
            livePreviewContainer.className = `resume-document template-${liveTemplate}`;
            renderLivePreview();
        });
    });

    function addDynamicItem(listId, type) {
        const container = document.getElementById(listId);
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'dynamic-item glass-panel';
        div.style.marginBottom = '1rem';
        div.style.padding = '1rem';
        div.style.position = 'relative';

        let innerHTML = '';
        const id = Date.now();

        if (type === 'experience') {
            innerHTML = `
                <input type="text" class="exp-company" placeholder="Company Name" style="margin-bottom:0.5rem; width:100%;">
                <input type="text" class="exp-title" placeholder="Job Title" style="margin-bottom:0.5rem; width:100%;">
                <input type="text" class="exp-dates" placeholder="e.g. Jan 2020 - Present" style="margin-bottom:0.5rem; width:100%;">
                <textarea class="exp-desc" placeholder="Responsibilities and achievements..." rows="3" style="width:100%;"></textarea>
            `;
            liveExperience.push({ id, company: '', title: '', dates: '', desc: '' });
        } else if (type === 'education') {
            innerHTML = `
                <input type="text" class="edu-school" placeholder="School/University" style="margin-bottom:0.5rem; width:100%;">
                <input type="text" class="edu-degree" placeholder="Degree" style="margin-bottom:0.5rem; width:100%;">
                <input type="text" class="edu-year" placeholder="Year / Expected Year" style="margin-bottom:0.5rem; width:100%;">
            `;
            liveEducation.push({ id, school: '', degree: '', year: '' });
        } else if (type === 'projects') {
            innerHTML = `
                <input type="text" class="proj-name" placeholder="Project Name" style="margin-bottom:0.5rem; width:100%;">
                <textarea class="proj-desc" placeholder="Project description and technologies used..." rows="3" style="width:100%;"></textarea>
            `;
            liveProjects.push({ id, name: '', desc: '' });
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.top = '10px';
        deleteBtn.style.right = '10px';
        deleteBtn.style.background = 'transparent';
        deleteBtn.style.border = 'none';
        deleteBtn.style.color = 'var(--danger)';
        deleteBtn.style.cursor = 'pointer';

        deleteBtn.onclick = () => {
            div.remove();
            if (type === 'experience') liveExperience = liveExperience.filter(i => i.id !== id);
            if (type === 'education') liveEducation = liveEducation.filter(i => i.id !== id);
            if (type === 'projects') liveProjects = liveProjects.filter(i => i.id !== id);
            renderLivePreview();
        };

        div.innerHTML = innerHTML;
        div.appendChild(deleteBtn);
        container.appendChild(div);

        div.querySelectorAll('input, textarea').forEach(input => {
            input.addEventListener('input', () => {
                const itemObj = type === 'experience' ? liveExperience.find(i => i.id === id) :
                    type === 'education' ? liveEducation.find(i => i.id === id) :
                        liveProjects.find(i => i.id === id);

                if (type === 'experience') {
                    if (input.classList.contains('exp-company')) itemObj.company = input.value;
                    if (input.classList.contains('exp-title')) itemObj.title = input.value;
                    if (input.classList.contains('exp-dates')) itemObj.dates = input.value;
                    if (input.classList.contains('exp-desc')) itemObj.desc = input.value;
                } else if (type === 'education') {
                    if (input.classList.contains('edu-school')) itemObj.school = input.value;
                    if (input.classList.contains('edu-degree')) itemObj.degree = input.value;
                    if (input.classList.contains('edu-year')) itemObj.year = input.value;
                } else if (type === 'projects') {
                    if (input.classList.contains('proj-name')) itemObj.name = input.value;
                    if (input.classList.contains('proj-desc')) itemObj.desc = input.value;
                }
                renderLivePreview();
            });
        });
    }

    document.getElementById('add-experience-btn')?.addEventListener('click', () => addDynamicItem('experience-list', 'experience'));
    document.getElementById('add-education-btn')?.addEventListener('click', () => addDynamicItem('education-list', 'education'));
    document.getElementById('add-project-btn')?.addEventListener('click', () => addDynamicItem('projects-list', 'projects'));

    Object.values(liveInputs).forEach(input => {
        if (input) input.addEventListener('input', renderLivePreview);
    });

    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }

    function formatTextToHTML(text) {
        if (!text) return '';
        return escapeHTML(text).split('\\n').map(line => {
            if (line.trim().startsWith('-')) return `<li>${line.substring(1).trim()}</li>`;
            return `<p>${line}</p>`;
        }).join('');
    }

    function renderLivePreview() {
        if (!livePreviewContainer) return;
        const d = {
            firstName: escapeHTML(liveInputs.firstName?.value),
            lastName: escapeHTML(liveInputs.lastName?.value),
            jobTitle: escapeHTML(liveInputs.jobTitle?.value),
            email: escapeHTML(liveInputs.email?.value),
            phone: escapeHTML(liveInputs.phone?.value),
            location: escapeHTML(liveInputs.location?.value),
            linkedin: escapeHTML(liveInputs.linkedin?.value),
            portfolio: escapeHTML(liveInputs.portfolio?.value),
            summary: escapeHTML(liveInputs.summary?.value),
            skills: escapeHTML(liveInputs.skills?.value),
            certs: escapeHTML(liveInputs.certs?.value)
        };

        let html = `<div class="resume-header">
            <h1 class="resume-name">${d.firstName} ${d.lastName}</h1>
            ${d.jobTitle ? `<div style="text-align:center; font-size: 1.1em; margin-bottom:0.5rem; font-weight:bold;">${d.jobTitle}</div>` : ''}
            <div class="resume-contact">
                ${[d.email, d.phone, d.location, d.linkedin, d.portfolio].filter(Boolean).join(' | ')}
            </div>
        </div>`;

        if (d.summary) html += `<h2 class="resume-section-title">Summary</h2><div>${formatTextToHTML(d.summary)}</div>`;

        if (liveExperience.length > 0) {
            html += `<h2 class="resume-section-title">Experience</h2>`;
            liveExperience.forEach(exp => {
                html += `<div style="margin-bottom: 1rem;">
                    <div class="resume-item-header">
                        <span><strong>${escapeHTML(exp.company)}</strong></span>
                        <span>${escapeHTML(exp.dates)}</span>
                    </div>
                    <div class="resume-item-subheader">${escapeHTML(exp.title)}</div>
                    <div>${formatTextToHTML(exp.desc)}</div>
                </div>`;
            });
        }

        if (liveEducation.length > 0) {
            html += `<h2 class="resume-section-title">Education</h2>`;
            liveEducation.forEach(edu => {
                html += `<div style="margin-bottom: 1rem;">
                    <div class="resume-item-header">
                        <span><strong>${escapeHTML(edu.school)}</strong></span>
                        <span>${escapeHTML(edu.year)}</span>
                    </div>
                    <div class="resume-item-subheader">${escapeHTML(edu.degree)}</div>
                </div>`;
            });
        }

        if (liveProjects.length > 0) {
            html += `<h2 class="resume-section-title">Projects</h2>`;
            liveProjects.forEach(proj => {
                html += `<div style="margin-bottom: 1rem;">
                    <div style="font-weight:bold; margin-bottom:0.25rem;">${escapeHTML(proj.name)}</div>
                    <div>${formatTextToHTML(proj.desc)}</div>
                </div>`;
            });
        }

        if (d.skills) html += `<h2 class="resume-section-title">Skills</h2><div>${d.skills}</div>`;
        if (d.certs) html += `<h2 class="resume-section-title">Certifications</h2><div>${formatTextToHTML(d.certs)}</div>`;

        livePreviewContainer.innerHTML = html;
    }

    renderLivePreview();

    // Check ATS functionality
    const btnCheckATS = document.getElementById('btn-check-ats');
    if (btnCheckATS) {
        btnCheckATS.addEventListener('click', async () => {
            const jd = prompt("Please paste the Target Job Description to check ATS Score:");
            if (!jd) return;

            btnCheckATS.disabled = true;
            btnCheckATS.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';

            let builderText = `
            ${liveInputs.firstName?.value || ''} ${liveInputs.lastName?.value || ''}
            ${liveInputs.jobTitle?.value || ''}
            ${liveInputs.summary?.value || ''}
            ${liveInputs.skills?.value || ''}
            `;
            liveExperience.forEach(exp => { builderText += `\n${exp.title} ${exp.company} ${exp.desc}`; });
            liveEducation.forEach(edu => { builderText += `\n${edu.degree} ${edu.school}`; });
            liveProjects.forEach(proj => { builderText += `\n${proj.name} ${proj.desc}`; });

            try {
                const analysisPrompt = `
                You are an expert ATS Optimization Specialist and Executive Resume Writer. Analyze the provided Resume against the Job Description and tailor it.
                Return a JSON object with exactly these fields:
                - "ats_score": An integer from 0 to 100 representing the match percentage.
                - "missing_skills": A list of up to 15 strings. CRITICAL: Include ONLY specific technical skills, software tools, or hard requirements from the JD that are missing. DO NOT include soft skills, action verbs, or generic terms like 'role', 'team', 'work', 'motivated', 'intern'.
                - "suggestions": A list of up to 3 strings containing short, highly actionable advice on how to improve this resume to get this specific job.
                - "tailored_resume": A string containing the tailored resume naturally incorporating missing skills. Do not invent false experience. Return this string professionally structured using standard markdown formatting (e.g., "# Name", "## Professional Summary"). Do NOT use plain unformatted text.
                
                Resume:
                ${builderText}
                
                Job Description:
                ${jd}
                `;
                const analysisDataStr = await callGemini(analysisPrompt, true);
                const analysisData = JSON.parse(analysisDataStr);

                const data = {
                    ats_score: analysisData.ats_score || 0,
                    missing_skills: analysisData.missing_skills || [],
                    suggestions: analysisData.suggestions || [],
                    tailored_resume: analysisData.tailored_resume || "Error generating tailored resume."
                };

                navOptimizer.click();
                displayResults(data);
            } catch (e) {
                console.error(e);
                alert(e.message);
            }

            btnCheckATS.disabled = false;
            btnCheckATS.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i> Check ATS Score';
        });
    }

    // AI Tailor Button
    const btnAutoTailor = document.getElementById('btn-auto-tailor');
    if (btnAutoTailor) {
        btnAutoTailor.addEventListener('click', async () => {
            const jd = prompt("Please paste the Target Job Description for the AI to tailor your resume against:");
            if (!jd) return;

            btnAutoTailor.disabled = true;
            btnAutoTailor.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Tailoring...';

            const payload = {
                job_description: jd,
                details: {
                    summary: liveInputs.summary?.value || "",
                    skills: liveInputs.skills?.value || "",
                    experience: liveExperience,
                    projects: liveProjects
                }
            };

            try {
                const promptText = `
                You are an expert ATS Optimization Specialist and Executive Resume Writer.
                Task: Tailor the 'summary', 'experience' descriptions, 'projects' descriptions, and 'skills' to be highly ATS-friendly and aligned with the provided Job Description. Use strong action verbs. Do NOT invent false experience.
                
                Job Description: ${jd}
                
                Resume Sections (JSON format):
                ${JSON.stringify(payload.details)}
                
                Return a JSON object with the exact same structure and IDs for experience/projects arrays, but with the text fields ('summary', 'skills', and 'desc' inside arrays) enhanced. Keep the other fields unchanged.
                `;

                const tailoredResponseText = await callGemini(promptText, true);
                const data = JSON.parse(tailoredResponseText);

                if (data.summary && liveInputs.summary) liveInputs.summary.value = data.summary;
                if (data.skills && liveInputs.skills) liveInputs.skills.value = data.skills;

                if (data.experience && Array.isArray(data.experience)) {
                    data.experience.forEach(tailoredExp => {
                        const match = liveExperience.find(e => e.id === tailoredExp.id);
                        if (match) match.desc = tailoredExp.desc;
                    });
                }

                if (data.projects && Array.isArray(data.projects)) {
                    data.projects.forEach(tailoredProj => {
                        const match = liveProjects.find(p => p.id === tailoredProj.id);
                        if (match) match.desc = tailoredProj.desc;
                    });
                }

                const expTextareas = document.querySelectorAll('.exp-desc');
                expTextareas.forEach((textarea, idx) => {
                    if (liveExperience[idx]) textarea.value = liveExperience[idx].desc;
                });
                const projTextareas = document.querySelectorAll('.proj-desc');
                projTextareas.forEach((textarea, idx) => {
                    if (liveProjects[idx]) textarea.value = liveProjects[idx].desc;
                });

                renderLivePreview();
            } catch (e) {
                console.error(e);
                alert(e.message);
            }

            btnAutoTailor.disabled = false;
            btnAutoTailor.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI Tailor';
        });
    }

    // Download PDF Button
    const btnDownloadPdf = document.getElementById('btn-download-pdf');
    if (btnDownloadPdf) {
        btnDownloadPdf.addEventListener('click', () => {
            const element = document.querySelector('#live-preview-container')?.closest('.resume-document-wrapper') || livePreviewContainer;
            btnDownloadPdf.disabled = true;
            btnDownloadPdf.innerText = 'Exporting...';
            exportResumeElementToPdf(element, 'My_Resume.pdf').then(() => {
                btnDownloadPdf.disabled = false;
                btnDownloadPdf.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Download PDF';
            }).catch((err) => {
                console.error('PDF export failed:', err);
                btnDownloadPdf.disabled = false;
                btnDownloadPdf.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Download PDF';
                alert('Unable to generate the PDF. Please refresh and try again.');
            });
        });
    }

    // --- Interactive FAQ Logic ---
    const faqButtons = document.querySelectorAll('.faq-question');
    const faqCatBtns = document.querySelectorAll('.faq-cat-btn');
    const faqItems = document.querySelectorAll('.faq-item');

    if (faqButtons.length > 0) {
        faqButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const item = btn.parentElement;
                const answer = item.querySelector('.faq-answer');
                const isActive = item.classList.contains('active');

                document.querySelectorAll('.faq-item.active').forEach(activeItem => {
                    activeItem.classList.remove('active');
                    activeItem.querySelector('.faq-answer').style.maxHeight = null;
                });

                if (!isActive) {
                    item.classList.add('active');
                    answer.style.maxHeight = answer.scrollHeight + "px";
                }
            });
        });

        faqCatBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                faqCatBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const category = btn.dataset.category;

                faqItems.forEach(item => {
                    item.classList.remove('active');
                    item.querySelector('.faq-answer').style.maxHeight = null;

                    if (category === 'all' || item.dataset.category === category) {
                        item.style.display = 'block';
                    } else {
                        item.style.display = 'none';
                    }
                });
            });
        });
    }
});