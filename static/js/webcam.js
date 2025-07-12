// webcam.js - Handles webcam capture and object detection

let video = null;
let canvas = null;
let captureCanvas = null;
let isStreaming = false;
let detectionInterval = null;
let lastDetectionTime = 0;
let detections = [];

// Initialize webcam functionality
function initWebcam() {
    video = document.getElementById('webcam');
    canvas = document.getElementById('canvas');
    captureCanvas = document.getElementById('captureCanvas');
    
    // Get user's webcam
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(function(stream) {
                video.srcObject = stream;
                video.play();
                isStreaming = true;
                
                // Update UI
                document.getElementById('startButton').disabled = true;
                document.getElementById('stopButton').disabled = false;
                
                // Start detection
                startDetection();
            })
            .catch(function(error) {
                console.error('Error accessing webcam:', error);
                showAlert('error', 'Error accessing webcam: ' + error.message);
            });
    } else {
        showAlert('error', 'Your browser does not support webcam access');
    }
}

// Stop webcam and detection
function stopWebcam() {
    if (isStreaming) {
        // Stop the video stream
        const stream = video.srcObject;
        if (stream) {
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
            video.srcObject = null;
        }
        
        // Clear the detection interval
        if (detectionInterval) {
            clearInterval(detectionInterval);
            detectionInterval = null;
        }
        
        // Update state and UI
        isStreaming = false;
        document.getElementById('startButton').disabled = false;
        document.getElementById('stopButton').disabled = true;
        
        // Display logs when webcam is stopped
        displayWebcamLogs();
    }
}

// Start object detection at intervals
function startDetection() {
    // Set up detection at regular intervals (e.g., every 1 second)
    detectionInterval = setInterval(detectObjects, 1000);
}

// Capture frame from webcam and send for detection
function detectObjects() {
    if (!isStreaming) return;
    
    // Get the canvas context
    const context = captureCanvas.getContext('2d');
    
    // Set canvas size to match video dimensions
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    
    // Draw the current video frame to the canvas
    context.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
    
    // Convert canvas to data URL
    const dataURL = captureCanvas.toDataURL('image/jpeg');
    
    // Send the image data to the server for object detection
    fetch('/api/detect/webcam', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            image: dataURL
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Display the processed image with detections
            displayProcessedImage(data.image);
            
            // Update detections list
            detections = data.detections;
            updateDetectionList(detections);
            
            // Update stats
            lastDetectionTime = new Date();
            updateStats(detections, data.process_time);
        } else {
            console.error('Detection error:', data.error);
            showAlert('error', 'Detection error: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error sending image for detection:', error);
        showAlert('error', 'Error sending image for detection');
    });
}

// Display the processed image on the canvas
function displayProcessedImage(imageData) {
    const context = canvas.getContext('2d');
    
    // Create a new image from the data URL
    const img = new Image();
    img.onload = function() {
        // Resize canvas to match image
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw the image on the canvas
        context.drawImage(img, 0, 0);
    };
    img.src = imageData;
}

// Update detection list UI
function updateDetectionList(detections) {
    const detectionListEl = document.getElementById('detectionList');
    
    // Clear previous entries
    detectionListEl.innerHTML = '';
    
    if (detections.length === 0) {
        detectionListEl.innerHTML = '<li class="list-group-item">No objects detected</li>';
        return;
    }
    
    // Add new entries
    detections.forEach(detection => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
        
        // Create object name element
        const objectName = document.createElement('span');
        objectName.textContent = detection.class;
        
        // Create confidence badge
        const confidenceBadge = document.createElement('span');
        confidenceBadge.className = 'badge bg-primary rounded-pill';
        confidenceBadge.textContent = `${Math.round(detection.confidence * 100)}%`;
        
        // Add elements to list item
        listItem.appendChild(objectName);
        listItem.appendChild(confidenceBadge);
        detectionListEl.appendChild(listItem);
    });
}

// Update stats UI
function updateStats(detections, processTime) {
    const statsEl = document.getElementById('detectionStats');
    
    // Count objects by class
    const objectCounts = {};
    detections.forEach(detection => {
        if (objectCounts[detection.class]) {
            objectCounts[detection.class]++;
        } else {
            objectCounts[detection.class] = 1;
        }
    });
    
    // Update stats
    let statsHTML = `
        <p><strong>Objects detected:</strong> ${detections.length}</p>
        <p><strong>Process time:</strong> ${processTime.toFixed(3)}s</p>
        <p><strong>Last detection:</strong> ${lastDetectionTime.toLocaleTimeString()}</p>
    `;
    
    // Add object counts
    if (Object.keys(objectCounts).length > 0) {
        statsHTML += '<p><strong>Objects by class:</strong></p><ul>';
        for (const [className, count] of Object.entries(objectCounts)) {
            statsHTML += `<li>${className}: ${count}</li>`;
        }
        statsHTML += '</ul>';
    }
    
    statsEl.innerHTML = statsHTML;
}

// Display webcam detection logs
function displayWebcamLogs() {
    // Show the logs section
    document.getElementById('logsSection').classList.remove('d-none');
    
    // Get webcam logs from server
    fetch('/api/logs/webcam')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Display logs
                const logsContainer = document.getElementById('webcamLogs');
                const logs = data.logs;
                
                if (logs.length === 0) {
                    logsContainer.innerHTML = '<div class="alert alert-info">No webcam logs available</div>';
                    return;
                }
                
                // Build logs HTML
                let logsHTML = '<div class="table-responsive"><table class="table table-striped">';
                logsHTML += `
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Objects Detected</th>
                            <th>Classes</th>
                            <th>Process Time</th>
                        </tr>
                    </thead>
                    <tbody>
                `;
                
                // Sort logs by timestamp (newest first)
                logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                
                // Add log entries
                logs.forEach(log => {
                    // Format timestamp
                    const timestamp = new Date(log.timestamp).toLocaleString();
                    
                    // Get unique detected classes
                    const classes = [...new Set(log.detected_classes)].join(', ');
                    
                    logsHTML += `
                        <tr>
                            <td>${timestamp}</td>
                            <td>${log.detection_count}</td>
                            <td>${classes}</td>
                            <td>${log.process_time.toFixed(3)}s</td>
                        </tr>
                    `;
                });
                
                logsHTML += '</tbody></table></div>';
                logsContainer.innerHTML = logsHTML;
                
                // Generate summary stats
                generateLogsSummary(logs);
            } else {
                console.error('Error retrieving logs:', data.error);
                showAlert('error', 'Error retrieving logs: ' + data.error);
            }
        })
        .catch(error => {
            console.error('Error fetching webcam logs:', error);
            showAlert('error', 'Error fetching webcam logs');
        });
}

// Generate summary statistics from logs
function generateLogsSummary(logs) {
    const summaryEl = document.getElementById('logsSummary');
    
    if (logs.length === 0) {
        summaryEl.innerHTML = '';
        return;
    }
    
    // Calculate total detections
    const totalDetections = logs.reduce((sum, log) => sum + log.detection_count, 0);
    
    // Count detections by class
    const classCounts = {};
    logs.forEach(log => {
        log.detected_classes.forEach(className => {
            if (classCounts[className]) {
                classCounts[className]++;
            } else {
                classCounts[className] = 1;
            }
        });
    });
    
    // Get top 5 detected classes
    const topClasses = Object.entries(classCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    // Calculate average processing time
    const avgProcessTime = logs.reduce((sum, log) => sum + log.process_time, 0) / logs.length;
    
    // Build summary HTML
    let summaryHTML = `
        <div class="card">
            <div class="card-header">
                <h5>Detection Summary</h5>
            </div>
            <div class="card-body">
                <p><strong>Total detection runs:</strong> ${logs.length}</p>
                <p><strong>Total objects detected:</strong> ${totalDetections}</p>
                <p><strong>Average objects per detection:</strong> ${(totalDetections / logs.length).toFixed(2)}</p>
                <p><strong>Average processing time:</strong> ${avgProcessTime.toFixed(3)}s</p>
            </div>
        </div>
        
        <div class="card mt-3">
            <div class="card-header">
                <h5>Top Detected Classes</h5>
            </div>
            <div class="card-body">
                <ul class="list-group">
    `;
    
    topClasses.forEach(([className, count]) => {
        summaryHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                ${className}
                <span class="badge bg-primary rounded-pill">${count}</span>
            </li>
        `;
    });
    
    summaryHTML += '</ul></div></div>';
    summaryEl.innerHTML = summaryHTML;
}

// Show alerts
function showAlert(type, message) {
    const alertContainer = document.getElementById('alertContainer');
    const alertEl = document.createElement('div');
    
    alertEl.className = `alert alert-${type === 'error' ? 'danger' : 'info'} alert-dismissible fade show`;
    alertEl.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    alertContainer.appendChild(alertEl);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        alertEl.classList.remove('show');
        setTimeout(() => alertEl.remove(), 300);
    }, 5000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Set up event listeners
    document.getElementById('startButton').addEventListener('click', initWebcam);
    document.getElementById('stopButton').addEventListener('click', stopWebcam);
    
    // Initialize canvas
    canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');
    context.fillStyle = '#212529';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Set up capture canvas (hidden)
    captureCanvas = document.getElementById('captureCanvas');
    captureCanvas.style.display = 'none';
    
    // Disable stop button initially
    document.getElementById('stopButton').disabled = true;
});
