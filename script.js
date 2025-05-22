// JavaScript for FineBadminton Dataset Website

// FineBadminton Dataset Showcase Script
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');

    const langZhBtn = document.getElementById('lang-zh-btn');
    const langEnBtn = document.getElementById('lang-en-btn');
    const roundSelectButtonsContainer = document.getElementById('round-select-buttons-container');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const currentFrameImg = document.getElementById('current-frame-img');
    const timelineBarContainer = document.getElementById('timeline-bar-container');
    const hittingDetailsDiv = document.getElementById('hitting-details');
    const evaluationDetailsDiv = document.getElementById('evaluation-details');
    const loadingSpinner = document.getElementById('loading-spinner'); // Get spinner element

    const videoFilenameSpan = document.getElementById('video-filename');
    const videoResolutionSpan = document.getElementById('video-resolution');
    const videoFpsSpan = document.getElementById('video-fps');
    const videoDurationFramesSpan = document.getElementById('video-duration-frames');
    const currentTimeSpan = document.getElementById('current-time');
    const totalDurationSpan = document.getElementById('total-duration');
    const currentFrameDisplaySpan = document.getElementById('current-frame-display');


    let currentLanguage = 'en';
    let datasets = {
        zh: null,
        en: null
    };
    let currentRoundData = null;
    let currentHittingSegment = null;
    let frames = [];
    let currentFrameIndex = 0;
    let animationFrameId = null;
    let isPlaying = false;
    let fpsInterval = 1000 / 25; // Default FPS, will be updated
    let then = Date.now();
    let currentSelectedRoundIndex = -1; 
    // Store identifier for current hitting segment to restore after lang switch
    let currentHittingSegmentIdentifier = null; // e.g., start_frame of the segment

    const DATA_PATHS = {
        zh: 'dataset/transformed_combined_rounds_zh.json',
        en: 'dataset/transformed_combined_rounds_output_en_evals_translated.json'
    };
    const IMAGE_BASE_PATH = 'dataset/image/';

    async function loadDataset(lang) {
        if (datasets[lang]) {
            return datasets[lang];
        }
        try {
            const response = await fetch(DATA_PATHS[lang]);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${DATA_PATHS[lang]}`);
            }
            datasets[lang] = await response.json();
            console.log(`Dataset for ${lang} loaded successfully.`);
            return datasets[lang];
        } catch (error) {
            console.error(`Error loading dataset for ${lang}:`, error);
            hittingDetailsDiv.innerHTML = `<p class="text-red-500">Error loading dataset: ${error.message}. Please check file path and ensure it's served correctly.</p>`;
            return null;
        }
    }

    // New function for preloading frames
    async function preloadFrames(frameUrls) {
        console.log(`Preloading ${frameUrls.length} frames...`);
        const imagePromises = frameUrls.map(src => {
            return new Promise((resolve) => { // Resolve even on error for individual images
                const img = new Image();
                img.onload = () => resolve({ src, status: 'loaded' });
                img.onerror = () => {
                    console.warn(`Failed to preload image: ${src}`);
                    resolve({ src, status: 'error' }); 
                };
                img.src = src;
            });
        });

        try {
            const results = await Promise.all(imagePromises); // Wait for all to attempt loading
            const failedCount = results.filter(r => r.status === 'error').length;
            if (failedCount > 0) {
                console.warn(`${failedCount} out of ${frameUrls.length} frames failed to preload.`);
            } else {
                console.log("All frames preloaded successfully.");
            }
        } catch (error) {
            // This catch is for Promise.all itself, unlikely with current setup unless an unhandled exception in new Promise callback
            console.error("A critical error occurred during the preloading process:", error);
        }
    }

    function populateRoundSelect(data, retainSelection) {
        roundSelectButtonsContainer.innerHTML = '';

        if (!data || data.length === 0) {
            roundSelectButtonsContainer.innerHTML = '<p class="text-gray-500 text-sm">No rounds available</p>';
            currentSelectedRoundIndex = -1; // Reset if no data
            return;
        }

        const totalRounds = data.length;
        const maxVisibleButtons = 24; // Adjust this based on typical screen width and button size
                                      // Or, ideally, calculate based on container width. For now, a fixed number.
        let buttonsToShow = [];

        if (totalRounds <= maxVisibleButtons) {
            for (let i = 0; i < totalRounds; i++) {
                buttonsToShow.push(i);
            }
        } else {
            buttonsToShow.push(0); // Always show the first button

            const current = currentSelectedRoundIndex !== -1 ? currentSelectedRoundIndex : 0;
            let start = Math.max(1, current - Math.floor((maxVisibleButtons - 3) / 2));
            let end = Math.min(totalRounds - 2, current + Math.floor((maxVisibleButtons - 3) / 2));

            // Adjust window if it's too small due to being near the edges
            const visibleRange = end - start + 1;
            const needed = maxVisibleButtons - 3; // -3 for first, last, and one ellipsis

            if (visibleRange < needed) {
                if (start === 1) {
                    end = Math.min(totalRounds - 2, start + needed -1);
                } else if (end === totalRounds - 2) {
                    start = Math.max(1, end - needed + 1);
                }
            }
            
            // Ensure start and end are reasonable after adjustments
            start = Math.max(1, start);
            end = Math.min(totalRounds - 2, end);


            if (start > 1) {
                buttonsToShow.push('...');
            }

            for (let i = start; i <= end; i++) {
                buttonsToShow.push(i);
            }

            if (end < totalRounds - 2) {
                buttonsToShow.push('...');
            }
            buttonsToShow.push(totalRounds - 1); // Always show the last button
        }
        
        buttonsToShow.forEach(item => {
            if (typeof item === 'number') {
                const index = item;
                const button = document.createElement('button');
                button.classList.add('round-select-btn');
                button.textContent = `${index + 1}`; // Changed from \`Round ${index + 1}\`
                button.dataset.roundIndex = index;
                button.addEventListener('click', async () => { // Make event listener async
                    await loadRoundData(index); // Await the async loadRoundData
                });
                roundSelectButtonsContainer.appendChild(button);
            } else { // Ellipsis
                const ellipsisSpan = document.createElement('span');
                ellipsisSpan.textContent = '...';
                ellipsisSpan.classList.add('round-select-ellipsis', 'px-2', 'py-1', 'text-gray-500', 'self-center');
                roundSelectButtonsContainer.appendChild(ellipsisSpan);
            }
        });


        if (!retainSelection && data.length > 0 && (currentSelectedRoundIndex === -1 || currentSelectedRoundIndex >= data.length)) {
            // loadRoundData(0); // This is often handled by initializeApp or switchLanguage
        } else if (currentSelectedRoundIndex !== -1 && currentSelectedRoundIndex < data.length) {
            updateRoundButtonStyles(currentSelectedRoundIndex);
        }
    }

    async function loadRoundData(roundIndex, targetFrameIndex = 0, targetSegmentIdentifier = null) {
        stopVideo(); // Pauses video, sets isPlaying to false, resets currentFrameIndex
        currentSelectedRoundIndex = roundIndex;
        
        // Show loading state
        playPauseBtn.disabled = true;
        playPauseBtn.textContent = 'Loading...';
        
        if (loadingSpinner) loadingSpinner.style.display = 'block';
        currentFrameImg.style.display = 'none'; // Hide the image element
        currentFrameImg.src = ''; // Clear src to prevent broken icon attempts
        currentFrameImg.alt = ''; // Clear alt

        // currentFrameDisplaySpan.textContent = "Loading..."; // Keep these tied to actual frame display
        // currentTimeSpan.textContent = "...";                 // Keep these tied to actual frame display
        if (hittingDetailsDiv) hittingDetailsDiv.innerHTML = '<p class="text-xl text-center py-8 text-gray-500">🚀 Loading round data and images...</p>';
        if (evaluationDetailsDiv) evaluationDetailsDiv.innerHTML = ''; // Clear evaluation details
        if (timelineBarContainer) timelineBarContainer.innerHTML = ''; // Clear timeline
        // Ensure the video info spans are also cleared or show loading
        if(videoFilenameSpan) videoFilenameSpan.textContent = "Loading...";
        if(videoResolutionSpan) videoResolutionSpan.textContent = "-";
        if(videoFpsSpan) videoFpsSpan.textContent = "-";
        if(videoDurationFramesSpan) videoDurationFramesSpan.textContent = "-";
        if(totalDurationSpan) totalDurationSpan.textContent = "...";


        currentRoundData = datasets[currentLanguage][roundIndex];

        if (!currentRoundData) {
            console.error('No data for selected round index:', roundIndex);
            clearAllUIData(); // This also handles UI for no data
            playPauseBtn.disabled = false; // Re-enable play button even if loading failed
            playPauseBtn.textContent = 'Play';
            if (hittingDetailsDiv) hittingDetailsDiv.innerHTML = '<p class="text-red-500">Error: Could not load round data.</p>';
            return;
        }

        populateRoundSelect(datasets[currentLanguage], true);
        updateRoundButtonStyles(roundIndex);
        console.log('Loading round:', currentRoundData.video, 'target frame:', targetFrameIndex);

        videoFilenameSpan.textContent = currentRoundData.video;
        videoResolutionSpan.textContent = `${currentRoundData.resolution.width}x${currentRoundData.resolution.height}`;
        videoFpsSpan.textContent = currentRoundData.fps.toFixed(1);
        videoDurationFramesSpan.textContent = currentRoundData.duration_frames;
        fpsInterval = 1000 / currentRoundData.fps;
        totalDurationSpan.textContent = (currentRoundData.duration_frames / currentRoundData.fps).toFixed(2) + 's';

        frames = [];
        const videoPrefix = currentRoundData.video.split('.')[0];
        for (let i = 0; i < currentRoundData.duration_frames; i++) {
            const actualFrameNumber = currentRoundData.start_frame + i;
            frames.push(`${IMAGE_BASE_PATH}${videoPrefix}_${actualFrameNumber}.jpg`);
        }
        
        // Preload frames
        if (frames.length > 0) {
            await preloadFrames(frames);
        }

        // Hide loading state / re-enable controls
        playPauseBtn.disabled = false;
        playPauseBtn.textContent = 'Play'; // Reset to 'Play' as video is stopped
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        currentFrameImg.style.display = 'block'; // Show the image element again

        currentFrameIndex = targetFrameIndex >= 0 && targetFrameIndex < frames.length ? targetFrameIndex : 0;
        
        // Attempt to find and set the target hitting segment from the new language data
        currentHittingSegment = null; // Reset before trying to find new one
        if (targetSegmentIdentifier !== null && currentRoundData.hitting) {
            for (const hit of currentRoundData.hitting) {
                if (hit.start_frame === targetSegmentIdentifier) {
                    currentHittingSegment = hit;
                    break;
                }
            }
        }
        // If currentHittingSegment is still null after trying to match identifier,
        // displayFrame will try to determine it based on currentFrameIndex.
        // This is important because even if we target a frame, the segment data (text) needs to come from new lang.

        displayFrame(currentFrameIndex); // This will also update hitting info based on the new currentHittingSegment or frame
        updateTimeline(); // Timeline display is language-agnostic, but depends on currentRoundData
        updateEvaluationDetails(); // Update with new language

        // isPlaying state will be restored by switchLanguage if needed
    }

    function displayFrame(index) {
        if (index >= 0 && index < frames.length) {
            if (loadingSpinner && loadingSpinner.style.display !== 'none') { // Ensure spinner is hidden if somehow still visible
                loadingSpinner.style.display = 'none';
            }
            currentFrameImg.style.display = 'block'; // Ensure image is visible
            currentFrameImg.src = frames[index];
            currentFrameImg.alt = `Frame ${currentRoundData.start_frame + index}`;
            currentFrameDisplaySpan.textContent = `Frame: ${currentRoundData.start_frame + index}`;
            currentTimeSpan.textContent = (index / currentRoundData.fps).toFixed(2) + 's';

            const currentFrameAbsolute = currentRoundData.start_frame + index;
            let determinedSegment = null;

            // If a currentHittingSegment was set by loadRoundData (from targetSegmentIdentifier)
            // and it matches the current frame, prefer it.
            if (currentHittingSegment && currentFrameAbsolute >= currentHittingSegment.start_frame && currentFrameAbsolute <= currentHittingSegment.end_frame) {
                determinedSegment = currentHittingSegment;
            } else if (currentRoundData && currentRoundData.hitting) {
                // Fallback: Prioritize segments where the current frame is the start_frame
                for (const hit of currentRoundData.hitting) {
                    if (currentFrameAbsolute === hit.start_frame) {
                        determinedSegment = hit;
                        break;
                    }
                }
                if (!determinedSegment) {
                    for (const hit of currentRoundData.hitting) {
                        if (currentFrameAbsolute >= hit.start_frame && currentFrameAbsolute <= hit.end_frame) {
                            determinedSegment = hit;
                            break;
                        }
                    }
                }
            }

            if (determinedSegment !== currentHittingSegment) {
                 //This internal update is fine if the segment truly changes during playback
                currentHittingSegment = determinedSegment;
                updateHittingInfo(currentHittingSegment); // Uses new language data from currentRoundData
                highlightTimelineSegment(currentHittingSegment);
            } else if (determinedSegment && currentHittingSegment && determinedSegment.start_frame === currentHittingSegment.start_frame) {
                 // If the segment is the same (identified by start_frame) but we switched lang,
                 // we still need to refresh its displayed info with the new language.
                 updateHittingInfo(determinedSegment); // Ensure info reflects new language.
                 highlightTimelineSegment(determinedSegment); // Re-highlight if needed.
            }
            currentHittingSegmentIdentifier = currentHittingSegment ? currentHittingSegment.start_frame : null;

        } else {
            console.warn("Frame index out of bounds:", index);
        }
    }

    function playVideo() {
        if (isPlaying || !currentRoundData) return;
        isPlaying = true;
        playPauseBtn.textContent = 'Pause';
        then = Date.now(); // Reset 'then' right before starting animation loop
        animate();
    }

    function pauseVideo() {
        if (!isPlaying) return;
        isPlaying = false;
        playPauseBtn.textContent = 'Play';
        cancelAnimationFrame(animationFrameId);
    }

    function stopVideo() {
        pauseVideo();
        currentFrameIndex = 0;
        if (frames.length > 0) {
             displayFrame(0);
        } else {
            if (loadingSpinner) loadingSpinner.style.display = 'none'; // Ensure spinner is hidden
            currentFrameImg.style.display = 'block'; // Ensure image element is visible for alt text
            currentFrameImg.src = ""; // Clear image
            currentFrameImg.alt = "No video loaded";
            currentFrameDisplaySpan.textContent = "Frame: -";
            currentTimeSpan.textContent = "0.00s";
        }
    }

    function animate() {
        if (!isPlaying) return;

        animationFrameId = requestAnimationFrame(animate);
        const now = Date.now();
        const elapsed = now - then;

        if (elapsed > fpsInterval) {
            then = now - (elapsed % fpsInterval);
            currentFrameIndex++;
            if (currentFrameIndex >= frames.length) {
                // currentFrameIndex = 0; // Loop behavior, or stop:
                pauseVideo(); // Stop at the end
                currentFrameIndex = frames.length - 1; // Stay on last frame
            }
            displayFrame(currentFrameIndex);
        }
    }

    function updateTimeline() {
        timelineBarContainer.innerHTML = ''; // Clear previous timeline
        if (!currentRoundData || !currentRoundData.hitting) return;

        const totalDuration = currentRoundData.duration_frames;

        currentRoundData.hitting.forEach((hit, index) => {
            const segmentDiv = document.createElement('div');
            segmentDiv.classList.add('timeline-segment', 'absolute', 'h-full', 'border-r', 'border-gray-500');
            // Assign colors based on player or hit type, for example
            segmentDiv.style.backgroundColor = hit.hitter === 'top' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(239, 68, 68, 0.5)'; // blue-500 or red-500 with opacity
            
            // Calculate start and width based on absolute frame numbers relative to round start
            const relativeStartFrame = hit.start_frame - currentRoundData.start_frame;
            const relativeEndFrame = hit.end_frame - currentRoundData.start_frame;
            const segmentDuration = relativeEndFrame - relativeStartFrame + 1;

            segmentDiv.style.left = `${(relativeStartFrame / totalDuration) * 100}%`;
            segmentDiv.style.width = `${(segmentDuration / totalDuration) * 100}%`;
            
            segmentDiv.title = `Hit ${index + 1}: ${hit.hit_type} (${hit.player})`;
            segmentDiv.dataset.hitIndex = index; // Store index for easy retrieval

            segmentDiv.addEventListener('click', () => {
                currentHittingSegment = hit;
                updateHittingInfo(hit);
                highlightTimelineSegment(hit);
                // Jump video to the start of this segment
                currentFrameIndex = relativeStartFrame;
                displayFrame(currentFrameIndex);
                pauseVideo(); // Pause when user clicks a segment
            });
            timelineBarContainer.appendChild(segmentDiv);
        });
    }
    
    function highlightTimelineSegment(activeHit) {
        const segments = timelineBarContainer.querySelectorAll('.timeline-segment');
        segments.forEach(seg => {
            const hitIndex = parseInt(seg.dataset.hitIndex, 10);
            const isCurrent = currentRoundData && currentRoundData.hitting[hitIndex] === activeHit;
            if (isCurrent) {
                seg.classList.add('active-segment');
                 seg.style.zIndex = '10';
            } else {
                seg.classList.remove('active-segment');
                 seg.style.zIndex = '1';
            }
        });
    }

    function renderQualityStars(quality) {
        const maxStars = 7;
        let starsHtml = '<div class="quality-stars flex items-center">';
        const qValue = parseInt(quality, 10);

        if (isNaN(qValue) || qValue < 1) {
            starsHtml += '<span class="text-gray-400 text-sm">N/A</span>';
        } else {
            for (let i = 1; i <= maxStars; i++) {
                if (i <= qValue) {
                    starsHtml += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-yellow-400"><path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clip-rule="evenodd" /></svg>`;
                } else {
                    starsHtml += `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-300"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.31h5.518a.563.563 0 0 1 .329.958l-4.48 3.261a.565.565 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-3.355a.563.563 0 0 0-.652 0l-4.725 3.355a.562.562 0 0 1-.84-.61l1.285-5.385a.562.562 0 0 0-.182-.557l-4.48-3.261a.562.562 0 0 1 .329-.958h5.518a.563.563 0 0 0 .475-.31L11.48 3.5Z" /></svg>`;
                }
            }
        }
        starsHtml += '</div>';
        return starsHtml;
    }

    function updateHittingInfo(hit) {
        currentHittingSegmentIdentifier = hit ? hit.start_frame : null;
        if (!hit) {
            hittingDetailsDiv.innerHTML = '<p class="text-gray-500">No hitting segment selected or video not at a hitting point.</p>';
            currentHittingSegment = null;
            highlightTimelineSegment(null);
            return;
        }

        let content = `<h3 class="text-xl font-semibold mb-3">${hit.player} - ${hit.hit_type}</h3>`;

        // Layer 1: Action Primitives
        content += `<div class="mb-3 layer-container action-primitives-layer">`;
        content += `<p class="layer-title text-sky-600">Action Primitives Layer</p>`;
        content += `<div class="layer-content">`;
        content += `<p class="info-item"><span class="info-label">Hit Type:</span> ${hit.hit_type || 'N/A'}</p>`;
        content += `<p class="info-item"><span class="info-label">Subtype:</span> ${hit.subtype ? hit.subtype.join(', ') : 'N/A'}</p>`;
        content += `<p class="info-item"><span class="info-label">Hitter:</span> ${hit.hitter || 'N/A'}</p>`;
        content += `<p class="info-item"><span class="info-label">Ball Area:</span> ${hit.ball_area || 'N/A'}</p>`;
        content += `</div></div>`;

        // Layer 2: Semantics
        content += `<div class="mb-3 layer-container semantics-layer">`;
        content += `<p class="layer-title text-teal-600">Tactical Semantics Layer</p>`;
        content += `<div class="layer-content">`;
        content += `<p class="info-item"><span class="info-label">Player Actions:</span> ${hit.player_actions ? hit.player_actions.join(', ') : 'N/A'}</p>`;
        content += `<p class="info-item"><span class="info-label">Shot Characteristics:</span> ${hit.shot_characteristics ? hit.shot_characteristics.join(', ') : 'N/A'}</p>`;
        if (hit.strategies && hit.strategies.length > 0) {
            content += `<p class="info-item"><span class="info-label">Strategies:</span> ${hit.strategies.join(', ')}</p>`;
        }
        if (hit.hit_outcomes && hit.hit_outcomes.length > 0) {
             content += `<p class="info-item"><span class="info-label">Hit Outcomes:</span> ${hit.hit_outcomes.join(', ')}</p>`;
        }
        content += `</div></div>`;
        
        // Layer 3: Decision Evaluation
        content += `<div class="layer-container decision-evaluation-layer">`;
        content += `<p class="layer-title text-amber-600">Decision Evaluation Layer</p>`;
        content += `<div class="layer-content">`;
        content += `<p class="info-item"><span class="info-label">Comment:</span> ${hit.comment || 'N/A'}</p>`;
        content += `<div class="info-item flex items-center"><span class="info-label mr-2">Quality:</span> ${renderQualityStars(hit.quality)}</div>`;
        content += `</div></div>`;

        hittingDetailsDiv.innerHTML = content;
    }

    function updateEvaluationDetails() {
        if (!currentRoundData || !currentRoundData.evaluations_new) {
            evaluationDetailsDiv.innerHTML = '<p class="text-gray-500">Evaluation details will appear here once a round is selected.</p>';
            return;
        }
        const evalData = currentRoundData.evaluations_new;
        evaluationDetailsDiv.innerHTML = `
            <div class="mb-2">
                <h4 class="font-semibold text-md text-gray-700">Scoring Reason:</h4>
                <p class="text-sm">${evalData.score_reason || 'N/A'}</p>
            </div>
            <div class="mb-2">
                <h4 class="font-semibold text-md text-gray-700">Losing Reason:</h4>
                <p class="text-sm">${evalData.lose_reason || 'N/A'}</p>
            </div>
            <div>
                <h4 class="font-semibold text-md text-gray-700">Overall Evaluation:</h4>
                <p class="text-sm">${evalData.total_eva || 'N/A'}</p>
            </div>
        `;
    }

    function updateLanguageButtonStyles() {
        if (currentLanguage === 'zh') {
            langZhBtn.classList.add('lang-btn-active');
            langZhBtn.classList.remove('lang-btn-inactive');
            langEnBtn.classList.add('lang-btn-inactive');
            langEnBtn.classList.remove('lang-btn-active');
        } else {
            langEnBtn.classList.add('lang-btn-active');
            langEnBtn.classList.remove('lang-btn-inactive');
            langZhBtn.classList.add('lang-btn-inactive');
            langZhBtn.classList.remove('lang-btn-active');
        }
    }

    async function switchLanguage(newLang) {
        // Store current state
        const previouslyPlaying = isPlaying;
        const previousFrameIndex = currentFrameIndex;
        const previousRoundIndex = currentSelectedRoundIndex;
        const previousHittingSegmentId = currentHittingSegment ? currentHittingSegment.start_frame : null;

        if (previouslyPlaying) {
            pauseVideo(); // Pause before making changes
        }

        currentLanguage = newLang;
        updateLanguageButtonStyles();
        console.log('Language changed to:', currentLanguage, 'target round:', previousRoundIndex, 'target frame:', previousFrameIndex);

        const data = await loadDataset(currentLanguage); // This fetches and sets datasets[currentLanguage]
        
        if (data) {
            // Repopulate round select buttons, trying to maintain selection UI but not auto-loading
            populateRoundSelect(data, true); // Pass true to retain selection if possible

            if (previousRoundIndex !== -1 && previousRoundIndex < data.length) {
                // Load the same round, with the specific frame and segment identifier
                await loadRoundData(previousRoundIndex, previousFrameIndex, previousHittingSegmentId);
            } else if (data.length > 0) {
                // Fallback: load the first round if previous was invalid
                await loadRoundData(0);
            } else {
                clearAllUIData(); // No rounds available for this language
            }

            if (previouslyPlaying && currentRoundData) {
                playVideo(); // Resume playback if it was playing
            }
        } else {
            clearAllUIData();
            roundSelectButtonsContainer.innerHTML = '<p class="text-red-500">Failed to load data for new language</p>';
        }
    }

    function clearAllUIData() {
        stopVideo();
        updateHittingInfo(null);
        updateEvaluationDetails();
        if (timelineBarContainer) timelineBarContainer.innerHTML = '';
        if (roundSelectButtonsContainer) {
             roundSelectButtonsContainer.innerHTML = '<p class="text-gray-500 text-sm">No data</p>';
        }
        
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        currentFrameImg.style.display = 'block'; // Show image element for placeholder/alt text
        currentFrameImg.src = ""; 
        currentFrameImg.alt = "No video loaded";

        currentSelectedRoundIndex = -1;
        videoFilenameSpan.textContent = '-';
        videoResolutionSpan.textContent = '-';
        videoFpsSpan.textContent = '-';
        videoDurationFramesSpan.textContent = '-';
        currentTimeSpan.textContent = '0.00s';
        totalDurationSpan.textContent = '0.00s';
        currentFrameDisplaySpan.textContent = 'Frame: 0';

        if (videoContainer && !videoContainer.querySelector('video#benchmark-video')) {
            videoContainer.innerHTML = ''; // Clear error message
            videoContainer.appendChild(benchmarkVideo); // Re-add video element
            // Ensure benchmark video container does not interfere with main player spinner
            if (loadingSpinner && currentFrameImg.id !== 'benchmark-video') { // basic check it's not the benchmark image
                 // This logic might be complex if benchmark also needs a spinner
            }
        }
    }

    function updateRoundButtonStyles(activeIndex) {
        const buttons = roundSelectButtonsContainer.querySelectorAll('.round-select-btn');
        buttons.forEach(btn => {
            if (parseInt(btn.dataset.roundIndex) === activeIndex) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    async function initializeApp() {
        updateLanguageButtonStyles();
        const data = await loadDataset(currentLanguage);
        if (data) {
            populateRoundSelect(data, false); // Initial population, don't try to retain selection
            if (data.length > 0) {
                await loadRoundData(0); // Load the first round on initial load
            }
        } else {
            roundSelectButtonsContainer.innerHTML = '<p class="text-red-500">Failed to load data</p>';
            clearAllUIData();
        }
    }

    // Event Listeners
        langZhBtn.addEventListener('click', () => switchLanguage('zh'));
        langEnBtn.addEventListener('click', () => switchLanguage('en'));

    playPauseBtn.addEventListener('click', () => {
        if (isPlaying) {
            pauseVideo();
        } else {
            playVideo();
        }
    });
    
    // Add keyboard controls for play/pause (e.g., Space bar)
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && currentRoundData) {
            e.preventDefault(); // Prevent page scroll
            if (isPlaying) {
                pauseVideo();
            } else {
                playVideo();
                }
            }
        });

    // Initialize the application
    initializeApp();

    // --- BENCHMARK SECTION ---
    const benchmarkSection = document.getElementById('benchmark-section');
    if (benchmarkSection) { 
        const benchmarkTableContainer = document.getElementById('benchmark-table-container');
        const benchmarkLangZhBtn = document.getElementById('benchmark-lang-zh-btn');
        const benchmarkLangEnBtn = document.getElementById('benchmark-lang-en-btn');
        const d3Container = document.getElementById('benchmark-d3-container');
        const d3BackBtn = document.getElementById('benchmark-d3-back-btn');
        const questionDisplayArea = document.getElementById('benchmark-question-display-area');
        const questionCategoryTitle = document.getElementById('benchmark-question-category-title');
        const backToTemporalBtn = document.getElementById('benchmark-back-to-temporal-btn');
        const benchmarkVideo = document.getElementById('benchmark-video');
        const benchmarkQuestionText = document.getElementById('benchmark-question-text');
        const benchmarkOptionsContainer = document.getElementById('benchmark-options-container');
        const benchmarkAnswerRevealContainer = document.getElementById('benchmark-answer-reveal-container');
        const benchmarkCorrectAnswer = document.getElementById('benchmark-correct-answer');
        const prevQuestionBtn = document.getElementById('benchmark-prev-question-btn');
        const nextQuestionBtn = document.getElementById('benchmark-next-question-btn');
        const questionProgressText = document.getElementById('benchmark-question-progress-text');

        const BENCHMARK_DATA_PATH = 'benchmark/combined_random_questions.json';
        const BENCHMARK_VIDEO_BASE_PATH = 'benchmark/video/';

        let allBenchmarkQuestions = null;
        let structuredBenchmarkData = null;
        let benchmarkCurrentLanguage = 'en'; 
        let selectedSpatialKey = null;
        let selectedTemporalKey = null;
        let currentQuestionList = [];
        let currentQuestionIndex = 0;
        let currentD3Level = 0; // 0 for spatial, 1 for temporal
        window.d3ResizeListenerAttached = false; // Flag for resize listener

        // English names based on the provided table (excluding "Example" column)
        const BENCHMARK_TABLE_DATA = {
            headers: ["Spatial Dimension", "Temporal Dimension", "Duration", "Quantity"],
            rows: [
                ["Count", "Hitting Count", "Short-Long", "200"],
                ["Count", "Round Count", "Long", "83"],
                ["Count", "Detailed Hitting Count", "Short-Long", "130"],
                ["Action", "Action Prediction", "Short", "250"],
                ["Action", "Action Grounding", "Short-Long", "200"],
                ["Action", "Action Classification", "Short", "200"],
                ["Position", "Moving Recognition", "Medium", "200"],
                ["Position", "Hitting Localization", "Short", "200"],
                ["Position", "Landing Prediction", "Short", "200"],
                ["Cognition", "Hitting Comment", "Short", "250+50"],
                ["Cognition", "Round Comment", "Long", "250+50"],
                ["Cognition", "Pointer Recognition", "Long", "250+50"]
            ]
        };

        // For UI display and data mapping. Keys should be lowercase to match JSON.
        const SPATIAL_DIMENSION_NAMES = {
            "count": { en: "Count", zh: "数量" },
            "action": { en: "Action", zh: "动作" },
            "position": { en: "Position", zh: "位置" },
            "cognition": { en: "Cognition", zh: "感知" }
        };
        
        const TEMPORAL_DIMENSION_NAMES = {
            "hitting count": { en: "Hitting Count", zh: "击球计数" },
            "round count": { en: "Round Count", zh: "回合计数" },
            "detailed hitting count": { en: "Detailed Hitting Count", zh: "详细击球计数" },
            "action prediction": { en: "Action Prediction", zh: "动作预测" },
            "action localization": { en: "Action Grounding", zh: "动作定位" },
            "action classification": { en: "Action Classification", zh: "动作分类" },
            "moving recognition": { en: "Moving Recognition", zh: "移动识别" }, // Corrected typo from recognization
            "hitting localization": { en: "Hitting Localization", zh: "击球位置定位" },
            "hitting prediction": { en: "Landing Prediction", zh: "落点预测" },
            "hitting comment": { en: "Hitting Comment", zh: "击球评价" },
            "round comment": { en: "Round Comment", zh: "回合评价" },
            "pointer recognition": { en: "Pointer Recognition", zh: "得分者判断" } // Corrected typo
        };

        const SPATIAL_TO_TEMPORAL_MAP = {
            "count": ["hitting count", "round count", "detailed hitting count"],
            "action": ["action prediction", "action localization", "action classification"],
            "position": ["moving recognition", "hitting localization", "hitting prediction"],
            "cognition": ["hitting comment", "round comment", "pointer recognition"]
        };
        
        const SPATIAL_COLORS = {
            "count": { border: "border-sky-500", text: "text-sky-700", bg: "bg-sky-50" },
            "action": { border: "border-teal-500", text: "text-teal-700", bg: "bg-teal-50" },
            "position": { border: "border-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
            "cognition": { border: "border-purple-500", text: "text-purple-700", bg: "bg-purple-50" },
        };

        // Adjust SPATIAL_COLORS for D3 if needed (e.g., just the hex color value)
        const D3_SPATIAL_COLORS = {
            "count": "#38bdf8",    // sky-400
            "action": "#2dd4bf",   // teal-400
            "position": "#fbbf24", // amber-400
            "cognition": "#a78bfa" // purple-400
        };

        function displayBenchmarkTable() {
            if (!benchmarkTableContainer) return;
            let tableHTML = '<table class="min-w-full divide-y divide-gray-200">';
            tableHTML += '<thead class="bg-gray-50"><tr>';
            BENCHMARK_TABLE_DATA.headers.forEach(header => {
                tableHTML += `<th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">${header}</th>`;
            });
            tableHTML += '</tr></thead><tbody class="bg-white divide-y divide-gray-200">';
            let currentSpatialDim = "";
            BENCHMARK_TABLE_DATA.rows.forEach((row, rowIndex) => {
                tableHTML += '<tr>';
                row.forEach((cell, cellIndex) => {
                    if (cellIndex === 0) { // Spatial Dimension
                        if (cell !== currentSpatialDim) {
                            currentSpatialDim = cell;
                            let rowSpan = 0;
                            for (let i = rowIndex; i < BENCHMARK_TABLE_DATA.rows.length; i++) {
                                if (BENCHMARK_TABLE_DATA.rows[i][0] === currentSpatialDim) rowSpan++;
                                else break;
                            }
                            tableHTML += `<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-top text-center" rowspan="${rowSpan}">${cell}</td>`;
                        } 
                    } else {
                        tableHTML += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">${cell}</td>`;
                    }
                });
                tableHTML += '</tr>';
            });
            tableHTML += '</tbody></table>';
            benchmarkTableContainer.innerHTML += tableHTML; // Append to existing title
        }
        
        async function loadBenchmarkData() {
            if (allBenchmarkQuestions) return allBenchmarkQuestions;
            try {
                const response = await fetch(BENCHMARK_DATA_PATH);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                allBenchmarkQuestions = await response.json();
                structureData();
                console.log("Benchmark data loaded and structured.");
                return allBenchmarkQuestions;
            } catch (error) {
                console.error("Error loading benchmark data:", error);
                if(d3Container) d3Container.innerHTML = '<p class="text-red-500 text-center p-4">Failed to load benchmark tasks data. Please check console.</p>';
                return null;
            }
        }

        function structureData() {
            structuredBenchmarkData = {};
            if (!allBenchmarkQuestions) {
                console.error("Cannot structure data: allBenchmarkQuestions is null or undefined.");
                return;
            }
            console.log("Starting to structure benchmark data. Total items:", allBenchmarkQuestions.length);

            // Initialize structure based on SPATIAL_TO_TEMPORAL_MAP
            for (const sKeyMap in SPATIAL_TO_TEMPORAL_MAP) {
                structuredBenchmarkData[sKeyMap] = {};
                SPATIAL_TO_TEMPORAL_MAP[sKeyMap].forEach(tKeyMap => {
                    structuredBenchmarkData[sKeyMap][tKeyMap] = [];
                });
            }
            console.log("Initialized structuredBenchmarkData with empty arrays based on MAPs.");

            let processedCount = 0;
            allBenchmarkQuestions.forEach((item, index) => {
                const rawSpatial = item.spatial;
                const rawTemporal = item.temporal;
                const sKey = rawSpatial?.toLowerCase().trim();
                const tKey = rawTemporal?.toLowerCase().trim();

                // Specific logging for items that should be problematic
                if (rawTemporal && (rawTemporal.toLowerCase().includes('pointer recognition') || rawTemporal.toLowerCase().includes('moving recognition'))) {
                    console.log(`Processing item index ${index}: rawTemporal='${rawTemporal}', tKey='${tKey}', rawSpatial='${rawSpatial}', sKey='${sKey}'`);
                    if (sKey && tKey && structuredBenchmarkData[sKey] && structuredBenchmarkData[sKey].hasOwnProperty(tKey)) {
                        console.log(`  Target bucket exists: structuredBenchmarkData["${sKey}"]["${tKey}"]. Current length: ${structuredBenchmarkData[sKey][tKey].length}`);
                    } else if (sKey && tKey && structuredBenchmarkData[sKey]) {
                        console.warn(`  Target sKey bucket structuredBenchmarkData["${sKey}"] exists, but tKey '${tKey}' is NOT a predefined property. Actual properties:`, Object.keys(structuredBenchmarkData[sKey]));
                        
                        // New detailed comparison logging
                        const problematicKeys = ["pointer recognition", "moving recognition"];
                        if (problematicKeys.some(pk => tKey.includes(pk.substring(0, 5)))) { // Basic check if it's one of them
                            problematicKeys.forEach(expectedKey => {
                                if (tKey.length === expectedKey.length || tKey.includes(expectedKey.substring(0,5))) { // Compare if lengths are same or if it seems to be the key
                                    console.log(`    Detailed comparison for tKey='${tKey}' vs expectedKey='${expectedKey}':`);
                                    let differenceFound = false;
                                    for (let i = 0; i < Math.max(tKey.length, expectedKey.length); i++) {
                                        const charTKey = i < tKey.length ? tKey[i] : "[MISSING]";
                                        const charExpectedKey = i < expectedKey.length ? expectedKey[i] : "[MISSING]";
                                        const asciiTKey = i < tKey.length ? tKey.charCodeAt(i) : "N/A";
                                        const asciiExpectedKey = i < expectedKey.length ? expectedKey.charCodeAt(i) : "N/A";
                                        if (charTKey !== charExpectedKey) {
                                            differenceFound = true;
                                            console.log(`      Mismatch at index ${i}: tKey has '${charTKey}' (ASCII: ${asciiTKey}), expectedKey has '${charExpectedKey}' (ASCII: ${asciiExpectedKey})`);
                                        }
                                    }
                                    if (!differenceFound && tKey.length === expectedKey.length) {
                                        console.log(`    No character difference found for '${tKey}' and '${expectedKey}', but hasOwnProperty check failed. This is unusual.`);
                                    } else if (!differenceFound && tKey.length !== expectedKey.length) {
                                        console.log(`    No character difference in common part, but lengths differ: tKey (${tKey.length}), expectedKey (${expectedKey.length})`);
                                    }
                                }
                            });
                        }
                    } else if (sKey) {
                        console.warn(`  Target sKey '${sKey}' does NOT exist as a primary key in structuredBenchmarkData.`);
                    }
                }

                if (sKey && tKey) {
                    // Ensure the target array exists before pushing, based on our pre-initialization
                    if (structuredBenchmarkData[sKey] && structuredBenchmarkData[sKey].hasOwnProperty(tKey)) {
                        structuredBenchmarkData[sKey][tKey].push(item);
                        processedCount++;
                        if (tKey === "pointer recognition" || tKey === "moving recognition") {
                             console.log(`  SUCCESSFULLY ADDED item ${item.question_id} to [${sKey}][${tKey}]. New length: ${structuredBenchmarkData[sKey][tKey].length}`);
                        }
                    } else {
                        // This warning should ideally not be hit often if pre-initialization is correct and JSON keys match map keys after processing
                        console.warn(`Skipping item (target category not found in pre-initialized map or structure): ${item.question_id}, Parsed spatial: '${sKey}', Parsed temporal: '${tKey}'`);
                    }
                } else {
                    console.warn(`Skipping item (missing/empty spatial or temporal key in JSON after processing): ${item.question_id}, Raw spatial: '${rawSpatial}', Raw temporal: '${rawTemporal}'`);
                }
            });
            console.log("Finished structuring data. Total items processed into structure:", processedCount);

            // Final check on counts for specific categories
            logCategoryCounts();
        }

        function logCategoryCounts() {
            console.log("--- Final Category Counts in structuredBenchmarkData ---");
            for (const sKey in SPATIAL_TO_TEMPORAL_MAP) {
                if (structuredBenchmarkData[sKey]) {
                    SPATIAL_TO_TEMPORAL_MAP[sKey].forEach(tKey => {
                        if (structuredBenchmarkData[sKey].hasOwnProperty(tKey)) {
                            const count = structuredBenchmarkData[sKey][tKey].length;
                            console.log(`Count for [${sKey}][${tKey}]: ${count}`);
                            if ((tKey === "pointer recognition" || tKey === "moving recognition") && count === 0) {
                                console.warn(`  WARNING: Category [${sKey}][${tKey}] ended up with 0 items.`);
                            }
                        } else {
                            console.warn(`  MISSING tKey [${sKey}][${tKey}] in structuredBenchmarkData after processing.`);
                        }
                    });
                } else {
                    console.warn(`  MISSING sKey [${sKey}] in structuredBenchmarkData after processing.`);
                }
            }
            console.log("---------------------------------------------------");
        }

        // --- D3 Visualization Functions ---
        let svg, width, height, radius;

        function setupD3Canvas() {
            if (!d3Container) {
                console.error("D3 container not found in setupD3Canvas!");
                return false; 
            }
            // d3Container.classList.remove('hidden'); // This should be handled by tab logic before calling render function
            
            const currentBackButton = d3Container.querySelector('#benchmark-d3-back-btn');
            d3Container.innerHTML = ''; 
            if (currentBackButton) {
                 d3Container.appendChild(currentBackButton);
            } else {
                // Fallback if button somehow lost - this might not be strictly necessary if HTML is stable
                const newBackButton = document.createElement('button');
                newBackButton.id = 'benchmark-d3-back-btn';
                newBackButton.className = 'absolute top-4 left-4 px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 transition-colors text-sm hidden'; // Initially hidden
                newBackButton.innerHTML = '&larr; Back';
                newBackButton.addEventListener('click', () => {
                    if (currentD3Level === 1) { // If on temporal view
                        drawSpatialView(); 
                        selectedSpatialKey = null; 
                    }
                });
                d3Container.appendChild(newBackButton);
                // d3BackBtn = newBackButton; // This would rebind the global, careful if used elsewhere
            }


            const containerRect = d3Container.getBoundingClientRect();
            console.log("D3 container rect:", containerRect);
            width = containerRect.width;
            height = Math.min(containerRect.height, width); 

            if (width <= 0 || height <= 0) {
                console.error("D3 container has zero width or height. Cannot draw.", {width, height});
                // Ensure the error message is visible if d3Container itself was hidden by other means
                d3Container.classList.remove('hidden'); 
                d3Container.innerHTML = '<p class="text-red-500 text-center p-4">Error: Benchmark visualization area has no dimensions. Cannot draw. Try resizing or ensure the tab is fully loaded.</p>';
                return false; 
            }
            radius = Math.min(width, height) / 2 * 0.9;

            svg = d3.select(d3Container).append("svg")
                .attr("width", width)
                .attr("height", height)
                .append("g")
                .attr("transform", `translate(${width / 2},${height / 2})`);
            
            // Re-attach the d3BackBtn to the one in the container if it was recreated
            // This ensures the global d3BackBtn variable points to the button currently in the DOM within d3Container.
            // globalThis.d3BackBtn = d3Container.querySelector('#benchmark-d3-back-btn'); // Assign to a truly global or a shared scope variable

            return true; 
        }

        function drawSpatialView() {
            if (!svg || !structuredBenchmarkData) {
                console.error("SVG or structuredBenchmarkData not ready for drawSpatialView");
                return;
            }
            svg.selectAll("*").remove(); // Clear previous drawing
            currentD3Level = 0;
            if (d3BackBtn) d3BackBtn.classList.add('hidden');
            if(questionDisplayArea) questionDisplayArea.classList.add('hidden');
            if(d3Container) d3Container.classList.remove('hidden');

            const spatialKeys = Object.keys(SPATIAL_TO_TEMPORAL_MAP);
            const arc = d3.arc()
                .innerRadius(radius * 0.4)
                .outerRadius(radius);

            const pie = d3.pie().value(() => 1);
            const data_ready = pie(spatialKeys);

            svg.selectAll('g.spatial-arc')
                .data(data_ready)
                .join('g')
                .attr('class', 'spatial-arc cursor-pointer')
                .append('path')
                .attr('d', arc)
                .attr('fill', d => D3_SPATIAL_COLORS[d.data] || '#ccc')
                .on('click', (event, d) => {
                    selectedSpatialKey = d.data;
                    drawTemporalView(selectedSpatialKey);
                });

            svg.selectAll('g.spatial-arc')
                .append('text')
                .attr('transform', d => `translate(${arc.centroid(d)})`)
                .attr('dy', '0.35em')
                .attr('class', 'spatial-text')
                .text(d => SPATIAL_DIMENSION_NAMES[d.data]?.[benchmarkCurrentLanguage] || d.data);
                
            // RE-ADD TSPAN LOGIC FOR CENTER TEXT
            const centerText = svg.append("text")
                .attr("class", "center-text")
                .attr("text-anchor", "middle");

            if (benchmarkCurrentLanguage === 'zh') {
                centerText.append("tspan")
                    .attr("x", 0)
                    .attr("dy", "-0.1em") 
                    .text("选择");
                centerText.append("tspan")
                    .attr("x", 0)
                    .attr("dy", "1.1em") 
                    .text("空间维度");
            } else {
                centerText.append("tspan")
                    .attr("x", 0)
                    .attr("dy", "-0.1em") 
                    .text("Select Spatial");
                centerText.append("tspan")
                    .attr("x", 0)
                    .attr("dy", "1.1em") 
                    .text("Dimension");
            }
        }

        function drawTemporalView(sKey) {
            if (!svg || !structuredBenchmarkData || !structuredBenchmarkData[sKey]) {
                console.error(`drawTemporalView: Pre-conditions not met. sKey: ${sKey}, svg: ${!!svg}, structuredData: ${!!structuredBenchmarkData}, sKey in structuredData: ${!!structuredBenchmarkData?.[sKey]}`);
                // Also log the actual keys present for the given sKey in structuredBenchmarkData
                if (structuredBenchmarkData && structuredBenchmarkData[sKey]) {
                    console.log(`Actual temporal keys found in structuredBenchmarkData["${sKey}"]:`, Object.keys(structuredBenchmarkData[sKey]));
                } else if (structuredBenchmarkData) {
                    console.warn(`sKey "${sKey}" not found as a primary key in structuredBenchmarkData. Available sKeys:`, Object.keys(structuredBenchmarkData));
                }
                return;
            }
            svg.selectAll("*").remove();
            currentD3Level = 1;
            if (d3BackBtn) d3BackBtn.classList.remove('hidden');

            const temporalKeysFromMap = SPATIAL_TO_TEMPORAL_MAP[sKey] || [];
            console.log(`Drawing temporal view for sKey (from map key): '${sKey}'.`);
            console.log(`Temporal keys defined in SPATIAL_TO_TEMPORAL_MAP["${sKey}"]:`, temporalKeysFromMap);
            console.log(`Actual temporal keys found in structuredBenchmarkData["${sKey}"]:`, Object.keys(structuredBenchmarkData[sKey]));
            
            const numTemporal = temporalKeysFromMap.length;
            const angleStep = (2 * Math.PI) / numTemporal;
            const temporalRadius = radius * 0.3;
            const orbitRadius = radius * 0.65;

            svg.append('circle') // Center visual anchor (e.g., selected spatial category)
                .attr('r', radius * 0.35)
                .attr('fill', D3_SPATIAL_COLORS[sKey] || '#ccc')
                .attr('opacity', 0.2);
            svg.append('text')
                .attr('class', 'center-text')
                .attr('dy', '-0.5em')
                .style('font-size', '18px')
                .style('fill', D3_SPATIAL_COLORS[sKey] || '#333')
                .text(SPATIAL_DIMENSION_NAMES[sKey]?.[benchmarkCurrentLanguage] || sKey);
            svg.append('text')
                .attr('class', 'center-text')
                .attr('dy', '1em')
                .style('font-size', '12px')
                .text(benchmarkCurrentLanguage === 'zh' ? "选择时间任务" : "Select Temporal Task");

            temporalKeysFromMap.forEach((tKeyFromMap, i) => {
                const angle = i * angleStep - (Math.PI / 2); 
                const cx = orbitRadius * Math.cos(angle);
                const cy = orbitRadius * Math.sin(angle);
                
                // Use tKeyFromMap for consistency, but log if it differs or if data is missing
                const questions = structuredBenchmarkData[sKey]?.[tKeyFromMap] || [];
                console.log(`For sKey '${sKey}', processing tKeyFromMap '${tKeyFromMap}'. Questions found: ${questions.length}`);
                
                if (tKeyFromMap === "pointer recognition" || tKeyFromMap === "moving recognition") {
                    console.log(`Detailed check for problematic tKeyFromMap '${tKeyFromMap}'. Data:`, questions);
                    // Check if the key exists with slight variations in structuredData, if it's empty
                    if (questions.length === 0) {
                        for (const actualTKey in structuredBenchmarkData[sKey]) {
                            if (actualTKey.includes(tKeyFromMap.substring(0,5))) { // crude check for partial match
                                console.warn(`Suspicious: For tKeyFromMap '${tKeyFromMap}', found 0 questions. Found similar actual key in data: '${actualTKey}' with ${structuredBenchmarkData[sKey][actualTKey].length} items.`);
                            }
                        }
                    }
                }

                const g = svg.append('g')
                    .attr('transform', `translate(${cx},${cy})`)
                    .attr('class', 'temporal-group cursor-pointer')
                    .on('click', () => {
                        console.log(`Clicked temporal item. sKey: '${sKey}', tKey from map (used for lookup): '${tKeyFromMap}'. Questions count at click: ${questions.length}`); 
                        if (questions.length > 0) {
                            selectedTemporalKey = tKeyFromMap; 
                            currentQuestionList = questions;
                            currentQuestionIndex = 0;
                            displayQuestion(); 
                            if(d3Container) d3Container.classList.add('hidden');
                            if(questionDisplayArea) questionDisplayArea.classList.remove('hidden');
                        } else {
                            alert("No questions available for this category.");
                        }
                    });

                g.append('circle')
                    .attr('class', 'temporal-circle')
                    .attr('r', temporalRadius)
                    .attr('fill', D3_SPATIAL_COLORS[sKey] || '#ccc')
                    .attr('stroke', d3.color(D3_SPATIAL_COLORS[sKey] || '#ccc').darker(0.5));
                
                // Wrap text
                const textElement = g.append('text').attr('class', 'temporal-text');
                const textContent = TEMPORAL_DIMENSION_NAMES[tKeyFromMap]?.[benchmarkCurrentLanguage] || tKeyFromMap;
                const words = textContent.split(/\s+/).reverse();
                let word, line = [], lineNumber = 0;
                const lineHeight = 1.1, // ems
                      y = 0, // Center text vertically for now
                      dy = 0.35; // ems
                let tspan = textElement.append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
                
                while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if (tspan.node().getComputedTextLength() > temporalRadius * 1.8 && line.length > 1) { // Check width
                        line.pop();
                        tspan.text(line.join(" "));
                        line = [word];
                        tspan = textElement.append("tspan").attr("x", 0).attr("y", y).attr("dy", (++lineNumber * lineHeight) + dy + "em").text(word);
                    }
                }
                // Adjust vertical alignment of all tspans
                const numLines = textElement.selectAll('tspan').size();
                textElement.selectAll('tspan').attr("dy", function(d,i) { 
                    return (i - (numLines-1)/2) * lineHeight + dy + "em"; 
                });
            });
        }
        
        // Modify displayQuestion to hide D3 container
        function displayQuestion() {
            if (!currentQuestionList || currentQuestionList.length === 0 || !benchmarkVideo) {
                if(questionDisplayArea) questionDisplayArea.innerHTML = "<p>No question to display.</p>";
                return;
            }
            const question = currentQuestionList[currentQuestionIndex];
            if (!question) {
                if(questionDisplayArea) questionDisplayArea.innerHTML = "<p>Selected question data is invalid.</p>";
                return;
            }
            const spatialName = SPATIAL_DIMENSION_NAMES[selectedSpatialKey]?.[benchmarkCurrentLanguage] || selectedSpatialKey;
            const temporalName = TEMPORAL_DIMENSION_NAMES[selectedTemporalKey]?.[benchmarkCurrentLanguage] || selectedTemporalKey;
            if (questionCategoryTitle) questionCategoryTitle.textContent = `${spatialName} / ${temporalName}`;
            
            const videoFileName = question.question_id.replace(/ /g, "_") + ".mp4";
            benchmarkVideo.src = `${BENCHMARK_VIDEO_BASE_PATH}${videoFileName}`;
            benchmarkVideo.load();
            benchmarkVideo.onerror = (event) => { 
                console.error(`Error loading video: ${benchmarkVideo.src}`);
                console.error("Video error event:", event);
                if (benchmarkVideo.error) {
                    console.error("MediaError code:", benchmarkVideo.error.code);
                    console.error("MediaError message:", benchmarkVideo.error.message);
                }
                const videoContainer = document.getElementById('benchmark-video-container');
                if (videoContainer) {
                    videoContainer.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-black text-white p-4">
                                                <p class="text-red-500 text-center">Video error (code: ${benchmarkVideo.error?.code || 'N/A'}). Check console for details. <br/>File: ${videoFileName}</p>
                                             </div>`;
                }
            };
            // Ensure the video element is back if it was replaced by error message previously
            const videoContainer = document.getElementById('benchmark-video-container');
            if (videoContainer && !videoContainer.querySelector('video#benchmark-video')) {
                videoContainer.innerHTML = ''; // Clear error message
                videoContainer.appendChild(benchmarkVideo); // Re-add video element
            }

            const questionText = question.question?.[`question_${benchmarkCurrentLanguage}`] || question.question?.question_en || "Question text not available.";
            benchmarkQuestionText.innerHTML = `<i class="fas fa-question-circle mr-2 text-indigo-500"></i>${questionText}`;
            
            benchmarkOptionsContainer.innerHTML = '';
            const options = question[`options_${benchmarkCurrentLanguage}`] || question.options_en || [];
            options.forEach((optText, index) => {
                const optLetter = String.fromCharCode(65 + index); 
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                // Ensure optText is a string before calling substring
                const optDisplay = typeof optText === 'string' ? (optText.startsWith(optLetter + '.') ? optText.substring(optText.indexOf('.') + 1).trim() : optText) : 'Invalid option';
                btn.innerHTML = `<span class="font-semibold mr-2">${optLetter}.</span><span class="option-text-content">${optDisplay}</span>`;
                btn.dataset.optionId = optLetter;
                btn.addEventListener('click', () => {
                    benchmarkCorrectAnswer.textContent = question.answer;
                    const allOptionBtns = benchmarkOptionsContainer.querySelectorAll('.option-btn');
                    allOptionBtns.forEach(ob => ob.classList.remove('selected', 'correct', 'incorrect'));
                    btn.classList.add('selected');
                    if (optLetter === question.answer) {
                        btn.classList.add('correct');
                    } else {
                        btn.classList.add('incorrect');
                        const correctBtn = benchmarkOptionsContainer.querySelector(`.option-btn[data-option-id="${question.answer}"]`);
                        if(correctBtn) correctBtn.classList.add('correct');
                    }
                    benchmarkAnswerRevealContainer.classList.remove('hidden');
                });
                benchmarkOptionsContainer.appendChild(btn);
            });
            benchmarkAnswerRevealContainer.classList.add('hidden');

            if(prevQuestionBtn) prevQuestionBtn.disabled = currentQuestionIndex === 0;
            if(nextQuestionBtn) nextQuestionBtn.disabled = currentQuestionIndex === currentQuestionList.length - 1;
            if(questionProgressText) questionProgressText.textContent = `Question ${currentQuestionIndex + 1} / ${currentQuestionList.length}`;

            if(d3Container) d3Container.classList.add('hidden');
            if(questionDisplayArea) questionDisplayArea.classList.remove('hidden');
        }
        
        function updateBenchmarkLanguageButtonStyles() {
            if (!benchmarkLangZhBtn || !benchmarkLangEnBtn) return;
            const activeClass = 'lang-btn-active';
            const inactiveClass = 'lang-btn-inactive';
            if (benchmarkCurrentLanguage === 'zh') {
                benchmarkLangZhBtn.classList.add(activeClass); benchmarkLangZhBtn.classList.remove(inactiveClass);
                benchmarkLangEnBtn.classList.add(inactiveClass); benchmarkLangEnBtn.classList.remove(activeClass);
            } else {
                benchmarkLangEnBtn.classList.add(activeClass); benchmarkLangEnBtn.classList.remove(inactiveClass);
                benchmarkLangZhBtn.classList.add(inactiveClass); benchmarkLangZhBtn.classList.remove(activeClass);
            }
        }

        function switchBenchmarkLanguage(newLang) {
            benchmarkCurrentLanguage = newLang;
            updateBenchmarkLanguageButtonStyles();
            if (questionDisplayArea && !questionDisplayArea.classList.contains('hidden')) {
                displayQuestion(); // Refreshes question, options text
            } else if (currentD3Level === 1 && selectedSpatialKey) {
                drawTemporalView(selectedSpatialKey); // Redraw temporal view
            } else {
                drawSpatialView(); // Redraw spatial view (level 0)
            }
        }
        
        // Update Back Button Logic
        if(d3BackBtn) {
            d3BackBtn.addEventListener('click', () => {
                if (currentD3Level === 1) {
                    drawSpatialView(); // Go from temporal (level 1) to spatial (level 0)
                    selectedSpatialKey = null;
                }
            });
        }

        if(backToTemporalBtn) { 
            backToTemporalBtn.addEventListener('click', () => {
                if(questionDisplayArea) questionDisplayArea.classList.add('hidden');
                if(d3Container) d3Container.classList.remove('hidden');
                if (selectedSpatialKey) {
                    setupD3Canvas(); 
                    drawTemporalView(selectedSpatialKey); 
                } else {
                    setupD3Canvas(); 
                    drawSpatialView(); 
                }
                selectedTemporalKey = null;
            });
        }

        // RE-ADD EVENT LISTENERS FOR LANGUAGE SWITCH AND QUESTION NAVIGATION
        if (benchmarkLangZhBtn) {
            benchmarkLangZhBtn.addEventListener('click', () => switchBenchmarkLanguage('zh'));
        }
        if (benchmarkLangEnBtn) {
            benchmarkLangEnBtn.addEventListener('click', () => switchBenchmarkLanguage('en'));
        }

        if (nextQuestionBtn) {
            nextQuestionBtn.addEventListener('click', () => {
                if (currentQuestionList && currentQuestionIndex < currentQuestionList.length - 1) {
                    currentQuestionIndex++;
                    displayQuestion();
                }
            });
        }

        if (prevQuestionBtn) {
            prevQuestionBtn.addEventListener('click', () => {
                if (currentQuestionList && currentQuestionIndex > 0) {
                    currentQuestionIndex--;
                    displayQuestion();
                }
            });
        }

        async function initBenchmark() {
            console.log("Initializing Benchmark Section (Data and Table)...");
            if (!benchmarkSection) { // Check benchmarkSection, as d3Container might be inside it
                console.error("Benchmark section not found! Aborting benchmark init.");
                return;
            }
            // If d3Container itself is the primary check for errors:
            if (!d3Container && benchmarkSection) {
                 benchmarkSection.innerHTML = '<p class="text-red-500 text-center p-4">Critical error: Benchmark D3 display area is missing in HTML.</p>';
                 return;
            }


            displayBenchmarkTable();
            updateBenchmarkLanguageButtonStyles();
            
            try {
                await loadBenchmarkData(); // This populates structuredBenchmarkData
                console.log("Benchmark data loaded in initBenchmark.");
                // Data is loaded. D3 rendering will be triggered by tab visibility.
            } catch (error) {
                console.error("Failed to load benchmark data during init:", error);
                if(d3Container) {
                    d3Container.innerHTML = '<p class="text-red-500 text-center p-4">Failed to load benchmark data. Please check console.</p>';
                } else if (benchmarkSection) {
                    benchmarkSection.innerHTML = '<p class="text-red-500 text-center p-4">Failed to load benchmark data and D3 container is missing. Please check console.</p>';
                }
                return;
            }

            // D3 setup and drawing are now deferred to renderBenchmarkD3IfNeeded
            // console.log("Benchmark init complete. D3 will render when tab is shown.");
        }

        window.renderBenchmarkD3IfNeeded = function() {
            console.log("renderBenchmarkD3IfNeeded called.");
            if (!d3Container || d3Container.classList.contains('hidden')) {
                // This check is for d3Container itself. The parent benchmarkContent's visibility
                // will be handled by the tab switching logic before this function is called.
                // However, if d3Container can be hidden independently, this is a safeguard.
                console.log("D3 container is not visible or not found. Skipping D3 render.");
                return;
            }

            if (!structuredBenchmarkData) {
                console.error("Structured benchmark data is not available. Cannot render D3.");
                if(d3Container) d3Container.innerHTML = '<p class="text-red-500 text-center p-4">Benchmark data is not ready for visualization. Please wait or try refreshing.</p>';
                return;
            }

            console.log("Attempting to setup D3 canvas and draw spatial view.");
            if (!setupD3Canvas()) { 
                console.error("Failed to setup D3 canvas in renderBenchmarkD3IfNeeded.");
                // Error message is already set by setupD3Canvas if it failed
                return;
            }
            drawSpatialView(); // Draw the initial view

            // Setup resize listener only once
            if (!window.d3ResizeListenerAttached) {
                window.addEventListener('resize', () => {
                    // Check if the benchmark content area (parent of d3Container) is visible
                    const benchmarkContentArea = document.getElementById('benchmark-content'); // From index.html
                    if (benchmarkContentArea && !benchmarkContentArea.classList.contains('hidden') && structuredBenchmarkData) {
                        console.log("Resize detected, redrawing D3.");
                        if (!setupD3Canvas()) return; // Re-setup canvas (gets new dimensions)
                        // redraw based on current D3 level
                        if (currentD3Level === 1 && selectedSpatialKey) {
                            drawTemporalView(selectedSpatialKey);
                        } else {
                            drawSpatialView();
                        }
                    } else {
                        // console.log("Resize detected, but benchmark tab not visible or data not ready. Skipping D3 redraw.");
                    }
                });
                window.d3ResizeListenerAttached = true;
                console.log("D3 resize listener attached.");
            }
        };
        
        initBenchmark(); // Call initBenchmark to load data and table on script load
    }
});

// Framer Motion example (can be expanded later)
// Note: Framer Motion is included via CDN. The `motion` object is globally available.
// Example: Animate the header
if (typeof motion !== 'undefined') {
    const header = document.querySelector('header h1');
    if (header) {
        // This is a simple example. For more complex animations,
        // you might want to integrate Framer Motion more deeply
        // with your component rendering logic if you were using a framework like React/Vue.
        // For now, we can directly apply some initial animation.
        // motion.div() would typically wrap an element you want to animate.
        // Since we are not using React, we'd manipulate styles or use the animate function.
        
        // Simple initial animation using the animate function provided by Framer Motion
        // This is just a placeholder to show it's available.
        // motion.animate(header, { opacity: [0, 1], y: [-20, 0] }, { duration: 0.8, ease: "easeOut" });
        // console.log("Framer motion available and header animation attempted.");

        // For direct DOM manipulation without React components,
        // you often use `motion.domAnimation` features or `motion.animate`.
        // The above `motion.animate` is a direct way.
    }
} else {
    console.warn('Framer Motion (motion object) not detected. Animations will not run.');
} 