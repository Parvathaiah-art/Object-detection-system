// image_upload.js - Handles image upload and object detection

// Initialize the image upload functionality
document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('imageUploadForm');
    const fileInput = document.getElementById('imageFile');
    const preview = document.getElementById('imagePreview');
    const resultImage = document.getElementById('resultImage');
    const detectionList = document.getElementById('detectionList');
    const uploadBtn = document.getElementById('uploadBtn');
    const spinner = document.getElementById('spinner');
    const alertContainer = document.getElementById('alertContainer');
    const statsContainer = document.getElementById('detectionStats');
    
    // Initialize Bootstrap tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Show image preview when a file is selected
    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            // Check if file is an image
            if (!file.type.match('image.*')) {
                showAlert('error', 'Please select an image file (JPEG, PNG)');
                fileInput.value = '';
                preview.src = '';
                return;
            }
            
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showAlert('error', 'Image size should be less than 5MB');
                fileInput.value = '';
                preview.src = '';
                return;
            }
            
            // Display preview
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.src = e.target.result;
                // Reset results
                resultImage.src = '';
                detectionList.innerHTML = '';
                statsContainer.innerHTML = '';
            };
            reader.readAsDataURL(file);
            
            // Enable upload button
            uploadBtn.disabled = false;
        } else {
            preview.src = '';
            uploadBtn.disabled = true;
        }
    });
    
    // Handle form submission
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const file = fileInput.files[0];
        if (!file) {
            showAlert('error', 'Please select an image file');
            return;
        }
        
        // Show loading spinner
        spinner.classList.remove('d-none');
        uploadBtn.disabled = true;
        
        // Create form data
        const formData = new FormData();
        formData.append('file', file);
        
        // Send image to server
        fetch('/api/detect/image', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            // Hide spinner
            spinner.classList.add('d-none');
            uploadBtn.disabled = false;
            
            if (data.success) {
                // Show result image
                resultImage.src = data.image;
                resultImage.classList.remove('d-none');
                
                // Display detections
                displayDetections(data.detections);
                
                // Display stats
                displayStats(data.detections, data.process_time);
                
                // Show success message
                showAlert('success', `Detection completed! Found ${data.detections.length} objects.`);
            } else {
                // Show error
                showAlert('error', data.error || 'Error processing image');
            }
        })
        .catch(error => {
            // Hide spinner
            spinner.classList.add('d-none');
            uploadBtn.disabled = false;
            
            // Show error
            console.error('Error:', error);
            showAlert('error', 'Error processing image. Please try again.');
        });
    });
    
    // Display detection results
    function displayDetections(detections) {
        // Clear previous results
        detectionList.innerHTML = '';
        
        if (detections.length === 0) {
            detectionList.innerHTML = '<li class="list-group-item">No objects detected</li>';
            return;
        }
        
        // Sort detections by confidence (highest first)
        detections.sort((a, b) => b.confidence - a.confidence);
        
        // Add each detection to the list
        detections.forEach((detection, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            
            // Create object name element
            const objectName = document.createElement('span');
            objectName.textContent = `${index + 1}. ${detection.class}`;
            
            // Create confidence badge
            const confidenceBadge = document.createElement('span');
            confidenceBadge.className = 'badge bg-primary rounded-pill';
            confidenceBadge.textContent = `${Math.round(detection.confidence * 100)}%`;
            
            // Add elements to list item
            listItem.appendChild(objectName);
            listItem.appendChild(confidenceBadge);
            detectionList.appendChild(listItem);
        });
    }
    
    // Display detection statistics
    function displayStats(detections, processTime) {
        // Count objects by class
        const objectCounts = {};
        detections.forEach(detection => {
            if (objectCounts[detection.class]) {
                objectCounts[detection.class]++;
            } else {
                objectCounts[detection.class] = 1;
            }
        });
        
        // Generate stats HTML
        let statsHTML = `
            <div class="card">
                <div class="card-header">
                    <h5>Detection Statistics</h5>
                </div>
                <div class="card-body">
                    <p><strong>Objects detected:</strong> ${detections.length}</p>
                    <p><strong>Process time:</strong> ${processTime.toFixed(3)}s</p>
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
    
    // Show alert message
    function showAlert(type, message) {
        const alertEl = document.createElement('div');
        
        alertEl.className = `alert alert-${type === 'error' ? 'danger' : 'success'} alert-dismissible fade show`;
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
