// video_upload.js - Handles video upload and object detection

// Initialize the video upload functionality
document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('videoUploadForm');
    const fileInput = document.getElementById('videoFile');
    const uploadBtn = document.getElementById('uploadBtn');
    const spinner = document.getElementById('spinner');
    const alertContainer = document.getElementById('alertContainer');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const resultContainer = document.getElementById('resultContainer');
    const detectionList = document.getElementById('detectionList');
    const statsContainer = document.getElementById('detectionStats');
    
    // Initialize Bootstrap tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Validate video file when selected
    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            // Check if file is a video
            if (!file.type.match('video.*')) {
                showAlert('error', 'Please select a video file (MP4, AVI, MOV)');
                fileInput.value = '';
                return;
            }
            
            // Check file size (max 25MB)
            if (file.size > 25 * 1024 * 1024) {
                showAlert('error', 'Video size should be less than 25MB');
                fileInput.value = '';
                return;
            }
            
            // Enable upload button
            uploadBtn.disabled = false;
            
            // Show file info
            const fileInfo = document.getElementById('fileInfo');
            fileInfo.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
            fileInfo.classList.remove('d-none');
            
            // Reset results
            resultContainer.classList.add('d-none');
            detectionList.innerHTML = '';
            statsContainer.innerHTML = '';
        } else {
            uploadBtn.disabled = true;
            document.getElementById('fileInfo').classList.add('d-none');
        }
    });
    
    // Handle form submission
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const file = fileInput.files[0];
        if (!file) {
            showAlert('error', 'Please select a video file');
            return;
        }
        
        // Show loading spinner and progress
        spinner.classList.remove('d-none');
        progressContainer.classList.remove('d-none');
        uploadBtn.disabled = true;
        
        // Reset progress bar
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', 0);
        progressBar.textContent = '0%';
        
        // Create form data
        const formData = new FormData();
        formData.append('file', file);
        
        // Send video to server with progress tracking
        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                progressBar.style.width = percentComplete + '%';
                progressBar.setAttribute('aria-valuenow', percentComplete);
                progressBar.textContent = percentComplete + '%';
            }
        });
        
        // Handle response
        xhr.addEventListener('load', function() {
            // Hide spinner and update progress
            spinner.classList.add('d-none');
            progressBar.style.width = '100%';
            progressBar.setAttribute('aria-valuenow', 100);
            progressBar.textContent = 'Processing complete';
            progressBar.classList.remove('progress-bar-striped', 'progress-bar-animated');
            
            // Re-enable upload button
            uploadBtn.disabled = false;
            
            if (xhr.status === 200) {
                // Parse response
                const response = JSON.parse(xhr.responseText);
                
                if (response.success) {
                    // Show results
                    resultContainer.classList.remove('d-none');
                    
                    // Display detections
                    displayDetections(response.detections);
                    
                    // Display stats
                    displayStats(response.detections);
                    
                    // Show success message
                    showAlert('success', `Video processing completed! Analyzed ${response.detections.length} frames.`);
                } else {
                    // Show error
                    showAlert('error', response.error || 'Error processing video');
                }
            } else {
                // Show error
                showAlert('error', 'Error processing video. Server returned status: ' + xhr.status);
            }
        });
        
        // Handle errors
        xhr.addEventListener('error', function() {
            // Hide spinner
            spinner.classList.add('d-none');
            uploadBtn.disabled = false;
            
            // Show error
            showAlert('error', 'Network error occurred while uploading video');
        });
        
        // Handle abort
        xhr.addEventListener('abort', function() {
            // Hide spinner
            spinner.classList.add('d-none');
            uploadBtn.disabled = false;
            
            // Show message
            showAlert('info', 'Video upload was aborted');
        });
        
        // Open and send request
        xhr.open('POST', '/api/detect/video', true);
        xhr.send(formData);
    });
    
    // Display detection results
    function displayDetections(detections) {
        // Clear previous results
        detectionList.innerHTML = '';
        
        if (detections.length === 0) {
            detectionList.innerHTML = '<li class="list-group-item">No frames analyzed</li>';
            return;
        }
        
        // Create timeline of detections
        const timelineHTML = `
            <div class="detection-timeline my-3">
                <h5>Detection Timeline</h5>
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Objects Detected</th>
                                <th>Classes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${detections.map(frame => {
                                const timestamp = formatTime(frame.timestamp);
                                const objectCount = frame.detections.length;
                                const classes = [...new Set(frame.detections.map(d => d.class))].join(', ');
                                
                                return `
                                    <tr>
                                        <td>${timestamp}</td>
                                        <td>${objectCount}</td>
                                        <td>${classes}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        detectionList.innerHTML = timelineHTML;
    }
    
    // Display detection statistics
    function displayStats(frameDetections) {
        // Collect all detections
        const allDetections = [];
        frameDetections.forEach(frame => {
            frame.detections.forEach(detection => {
                allDetections.push(detection);
            });
        });
        
        // Count objects by class
        const objectCounts = {};
        allDetections.forEach(detection => {
            if (objectCounts[detection.class]) {
                objectCounts[detection.class]++;
            } else {
                objectCounts[detection.class] = 1;
            }
        });
        
        // Count frames with detections
        const framesWithDetections = frameDetections.filter(frame => frame.detections.length > 0).length;
        
        // Calculate average objects per frame
        const avgObjectsPerFrame = allDetections.length / frameDetections.length;
        
        // Generate stats HTML
        let statsHTML = `
            <div class="card">
                <div class="card-header">
                    <h5>Video Analysis Statistics</h5>
                </div>
                <div class="card-body">
                    <p><strong>Total frames analyzed:</strong> ${frameDetections.length}</p>
                    <p><strong>Frames with detections:</strong> ${framesWithDetections} (${Math.round(framesWithDetections / frameDetections.length * 100)}%)</p>
                    <p><strong>Total objects detected:</strong> ${allDetections.length}</p>
                    <p><strong>Average objects per frame:</strong> ${avgObjectsPerFrame.toFixed(2)}</p>
        `;
        
        // Add object counts
        if (Object.keys(objectCounts).length > 0) {
            statsHTML += '<div class="mt-3"><h6>Objects by class:</h6><ul class="list-group">';
            
            // Sort by count (highest first)
            const sortedCounts = Object.entries(objectCounts)
                .sort((a, b) => b[1] - a[1]);
            
            sortedCounts.forEach(([className, count]) => {
                statsHTML += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        ${className}
                        <span class="badge bg-primary rounded-pill">${count}</span>
                    </li>
                `;
            });
            
            statsHTML += '</ul></div>';
        }
        
        statsHTML += '</div></div>';
        statsContainer.innerHTML = statsHTML;
    }
    
    // Format file size
    function formatFileSize(bytes) {
        if (bytes < 1024) {
            return bytes + ' B';
        } else if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(1) + ' KB';
        } else {
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }
    }
    
    // Format time (seconds to MM:SS)
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Show alert message
    function showAlert(type, message) {
        const alertEl = document.createElement('div');
        
        alertEl.className = `alert alert-${type === 'error' ? 'danger' : (type === 'info' ? 'info' : 'success')} alert-dismissible fade show`;
        alertEl.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Add alert to container
        alertContainer.appendChild(alertEl);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            alertEl.classList.remove('show');
            setTimeout(() => alertEl.remove(), 300);
        }, 5000);
    }
});
