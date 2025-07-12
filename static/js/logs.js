// logs.js - Handles detection logs display and filtering

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const logsContainer = document.getElementById('logsContainer');
    const sourceFilter = document.getElementById('sourceFilter');
    const dateFilter = document.getElementById('dateFilter');
    const objectFilter = document.getElementById('objectFilter');
    const clearFiltersBtn = document.getElementById('clearFilters');
    const exportLogsBtn = document.getElementById('exportLogs');
    const alertContainer = document.getElementById('alertContainer');
    
    // Initialize log data
    let allLogs = [];
    let filteredLogs = [];
    
    // Load logs from server
    loadLogs();
    
    // Set up event listeners
    sourceFilter.addEventListener('change', applyFilters);
    dateFilter.addEventListener('change', applyFilters);
    objectFilter.addEventListener('input', applyFilters);
    clearFiltersBtn.addEventListener('click', clearFilters);
    exportLogsBtn.addEventListener('click', exportLogs);
    
    // Load logs from server
    function loadLogs() {
        // Show loading indicator
        logsContainer.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div><p class="mt-2">Loading logs...</p></div>';
        
        // Fetch logs from server
        fetch('/api/logs')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Store logs
                    allLogs = data.logs;
                    filteredLogs = [...allLogs];
                    
                    // Display logs
                    displayLogs(filteredLogs);
                    
                    // Populate filter options
                    populateFilters(allLogs);
                } else {
                    // Handle error
                    logsContainer.innerHTML = `<div class="alert alert-danger">Error loading logs: ${data.error}</div>`;
                }
            })
            .catch(error => {
                console.error('Error loading logs:', error);
                logsContainer.innerHTML = '<div class="alert alert-danger">Error loading logs. Please try again later.</div>';
            });
    }
    
    // Display logs
    function displayLogs(logs) {
        if (!logs || logs.length === 0) {
            logsContainer.innerHTML = '<div class="alert alert-info">No detection logs found</div>';
            return;
        }
        
        // Sort logs by timestamp (newest first)
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Build HTML for logs table
        let logsHTML = `
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead>
                        <tr>
                            <th>Date & Time</th>
                            <th>Source</th>
                            <th>File Name</th>
                            <th>Objects Detected</th>
                            <th>Classes</th>
                            <th>Process Time</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add each log entry to the table
        logs.forEach(log => {
            // Format timestamp
            const timestamp = new Date(log.timestamp).toLocaleString();
            
            // Get detection count
            const detectionCount = log.detection_count || log.total_detections || 0;
            
            // Get detected classes
            const detectedClasses = log.detected_classes || [];
            const uniqueClasses = [...new Set(detectedClasses)];
            const classesStr = uniqueClasses.join(', ');
            
            // Build the table row
            logsHTML += `
                <tr>
                    <td>${timestamp}</td>
                    <td><span class="badge bg-secondary">${log.source_type}</span></td>
                    <td>${log.source_name}</td>
                    <td>${detectionCount}</td>
                    <td>${classesStr}</td>
                    <td>${log.process_time ? log.process_time.toFixed(3) + 's' : 'N/A'}</td>
                    <td>
                        <button class="btn btn-sm btn-primary view-details" data-log-id="${log.id}" data-bs-toggle="modal" data-bs-target="#logDetailsModal">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                </tr>
            `;
        });
        
        logsHTML += `
                    </tbody>
                </table>
            </div>
        `;
        
        // Update container with logs table
        logsContainer.innerHTML = logsHTML;
        
        // Add event listeners to view details buttons
        document.querySelectorAll('.view-details').forEach(button => {
            button.addEventListener('click', function() {
                const logId = parseInt(this.getAttribute('data-log-id'));
                showLogDetails(logId);
            });
        });
    }
    
    // Populate filter options
    function populateFilters(logs) {
        // Get unique source types
        const sourceTypes = [...new Set(logs.map(log => log.source_type))];
        
        // Clear current options (except "All")
        while (sourceFilter.options.length > 1) {
            sourceFilter.remove(1);
        }
        
        // Add source type options
        sourceTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
            sourceFilter.appendChild(option);
        });
        
        // Set up date filter max value to current date
        const today = new Date().toISOString().split('T')[0];
        dateFilter.setAttribute('max', today);
    }
    
    // Apply filters to logs
    function applyFilters() {
        const sourceType = sourceFilter.value;
        const date = dateFilter.value;
        const objectClass = objectFilter.value.toLowerCase();
        
        // Filter logs based on selected criteria
        filteredLogs = allLogs.filter(log => {
            // Source type filter
            if (sourceType && sourceType !== 'all' && log.source_type !== sourceType) {
                return false;
            }
            
            // Date filter
            if (date) {
                const logDate = new Date(log.timestamp).toISOString().split('T')[0];
                if (logDate !== date) {
                    return false;
                }
            }
            
            // Object class filter
            if (objectClass) {
                const detectedClasses = log.detected_classes || [];
                const hasClass = detectedClasses.some(cls => 
                    cls.toLowerCase().includes(objectClass)
                );
                if (!hasClass) {
                    return false;
                }
            }
            
            return true;
        });
        
        // Update displayed logs
        displayLogs(filteredLogs);
        
        // Show filter summary
        const filterCount = filteredLogs.length;
        const totalCount = allLogs.length;
        
        document.getElementById('filterSummary').textContent = 
            `Showing ${filterCount} of ${totalCount} logs`;
    }
    
    // Clear all filters
    function clearFilters() {
        sourceFilter.value = 'all';
        dateFilter.value = '';
        objectFilter.value = '';
        
        // Reset filtered logs to all logs
        filteredLogs = [...allLogs];
        
        // Update displayed logs
        displayLogs(filteredLogs);
        
        // Reset filter summary
        document.getElementById('filterSummary').textContent = 
            `Showing all ${allLogs.length} logs`;
    }
    
    // Show log details in modal
    function showLogDetails(logId) {
        // Find the log entry
        const log = allLogs.find(entry => entry.id === logId);
        
        if (!log) {
            showAlert('error', 'Log entry not found');
            return;
        }
        
        // Get modal elements
        const modalTitle = document.getElementById('logDetailsModalLabel');
        const modalBody = document.getElementById('logDetailsModalBody');
        
        // Set modal title
        modalTitle.textContent = `Log #${log.id} - ${log.source_type} Detection`;
        
        // Format timestamp
        const timestamp = new Date(log.timestamp).toLocaleString();
        
        // Prepare modal content based on log type
        let detailsHTML = `
            <div class="mb-3">
                <strong>Date & Time:</strong> ${timestamp}<br>
                <strong>Source Type:</strong> ${log.source_type}<br>
                <strong>Source Name:</strong> ${log.source_name}<br>
        `;
        
        // Add source-specific details
        if (log.source_type === 'video') {
            detailsHTML += `
                <strong>Frames Analyzed:</strong> ${log.frame_count || 'N/A'}<br>
                <strong>Total Detections:</strong> ${log.total_detections || 0}<br>
            `;
        } else {
            detailsHTML += `
                <strong>Objects Detected:</strong> ${log.detection_count || 0}<br>
                <strong>Process Time:</strong> ${log.process_time ? log.process_time.toFixed(3) + 's' : 'N/A'}<br>
            `;
        }
        
        detailsHTML += '</div>';
        
        // Add detections table
        if (log.source_type === 'video') {
            // Video detections timeline
            detailsHTML += `
                <h5>Detection Timeline</h5>
                <div class="table-responsive">
                    <table class="table table-sm table-striped">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Objects</th>
                                <th>Classes</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            const frameDetections = log.frame_detections || [];
            frameDetections.forEach(frame => {
                const frameTime = formatTime(frame.timestamp);
                const objCount = frame.detections.length;
                const classes = [...new Set(frame.detections.map(d => d.class))].join(', ');
                
                detailsHTML += `
                    <tr>
                        <td>${frameTime}</td>
                        <td>${objCount}</td>
                        <td>${classes}</td>
                    </tr>
                `;
            });
            
            detailsHTML += '</tbody></table></div>';
        } else {
            // Image/webcam detections table
            detailsHTML += `
                <h5>Detected Objects</h5>
                <div class="table-responsive">
                    <table class="table table-sm table-striped">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Class</th>
                                <th>Confidence</th>
                                <th>Bounding Box</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            const detections = log.detections || [];
            detections.forEach((detection, index) => {
                const bbox = detection.bbox || [0, 0, 0, 0];
                
                detailsHTML += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${detection.class}</td>
                        <td>${Math.round(detection.confidence * 100)}%</td>
                        <td>[${bbox.join(', ')}]</td>
                    </tr>
                `;
            });
            
            detailsHTML += '</tbody></table></div>';
        }
        
        // Set modal content
        modalBody.innerHTML = detailsHTML;
    }
    
    // Export logs to JSON file
    function exportLogs() {
        // Prepare data to export (use filtered logs if any filters are applied)
        const dataToExport = filteredLogs.length < allLogs.length ? filteredLogs : allLogs;
        
        // Convert to JSON string
        const jsonStr = JSON.stringify(dataToExport, null, 2);
        
        // Create blob and download link
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `detection_logs_${new Date().toISOString().split('T')[0]}.json`;
        
        // Trigger download
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        // Show success message
        showAlert('success', `Exported ${dataToExport.length} log entries`);
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
