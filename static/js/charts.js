// charts.js - Handles visualization of detection analytics

document.addEventListener('DOMContentLoaded', function() {
    // Canvas elements for charts
    const objectsByClassChart = document.getElementById('objectsByClassChart');
    const detectionsOverTimeChart = document.getElementById('detectionsOverTimeChart');
    const detectionsBySourceChart = document.getElementById('detectionsBySourceChart');
    
    // Statistics elements
    const totalDetectionsEl = document.getElementById('totalDetections');
    const avgDetectionsPerRunEl = document.getElementById('avgDetectionsPerRun');
    const topDetectedObjectEl = document.getElementById('topDetectedObject');
    const mostActiveSourceEl = document.getElementById('mostActiveSource');
    
    // Chart instances
    let objectsByClassChartInstance = null;
    let detectionsOverTimeChartInstance = null;
    let detectionsBySourceChartInstance = null;
    
    // Load analysis data and create charts
    loadAnalysisData();
    
    // Load analysis data from server
    function loadAnalysisData() {
        fetch('/api/analysis')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Create charts with data
                    createCharts(data.data);
                    
                    // Update statistics
                    updateStats(data.data);
                } else {
                    showError('Error loading analysis data: ' + data.error);
                }
            })
            .catch(error => {
                console.error('Error fetching analysis data:', error);
                showError('Error loading analysis data');
            });
    }
    
    // Create all charts
    function createCharts(data) {
        createObjectsByClassChart(data.detection_by_class);
        createDetectionsOverTimeChart(data.detection_over_time);
        createDetectionsBySourceChart(data.detection_by_source);
    }
    
    // Create objects by class chart
    function createObjectsByClassChart(classData) {
        // Destroy previous chart if it exists
        if (objectsByClassChartInstance) {
            objectsByClassChartInstance.destroy();
        }
        
        if (!classData || Object.keys(classData).length === 0) {
            document.getElementById('objectsByClassContainer').innerHTML = 
                '<div class="alert alert-info">No class data available</div>';
            return;
        }
        
        // Sort data by count (descending) and take top 10
        const sortedData = Object.entries(classData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        const labels = sortedData.map(item => item[0]);
        const counts = sortedData.map(item => item[1]);
        
        // Create chart
        objectsByClassChartInstance = new Chart(objectsByClassChart, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Objects Detected',
                    data: counts,
                    backgroundColor: 'rgba(54, 162, 235, 0.8)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                plugins: {
                    title: {
                        display: true,
                        text: 'Top 10 Detected Object Classes',
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Count'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Object Class'
                        }
                    }
                },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    // Create detections over time chart
    function createDetectionsOverTimeChart(timeData) {
        // Destroy previous chart if it exists
        if (detectionsOverTimeChartInstance) {
            detectionsOverTimeChartInstance.destroy();
        }
        
        if (!timeData || Object.keys(timeData).length === 0) {
            document.getElementById('detectionsOverTimeContainer').innerHTML = 
                '<div class="alert alert-info">No time-based data available</div>';
            return;
        }
        
        // Sort dates chronologically
        const sortedDates = Object.keys(timeData).sort();
        const counts = sortedDates.map(date => timeData[date]);
        
        // Format dates for display
        const formattedDates = sortedDates.map(date => {
            const dateObj = new Date(date);
            return dateObj.toLocaleDateString();
        });
        
        // Create chart
        detectionsOverTimeChartInstance = new Chart(detectionsOverTimeChart, {
            type: 'line',
            data: {
                labels: formattedDates,
                datasets: [{
                    label: 'Detections',
                    data: counts,
                    fill: false,
                    backgroundColor: 'rgba(75, 192, 192, 0.8)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    tension: 0.1,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                plugins: {
                    title: {
                        display: true,
                        text: 'Detections Over Time',
                        font: {
                            size: 16
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Detections'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    }
                },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    // Create detections by source chart
    function createDetectionsBySourceChart(sourceData) {
        // Destroy previous chart if it exists
        if (detectionsBySourceChartInstance) {
            detectionsBySourceChartInstance.destroy();
        }
        
        if (!sourceData || Object.keys(sourceData).length === 0) {
            document.getElementById('detectionsBySourceContainer').innerHTML = 
                '<div class="alert alert-info">No source data available</div>';
            return;
        }
        
        const labels = Object.keys(sourceData).map(source => 
            source.charAt(0).toUpperCase() + source.slice(1)
        );
        const counts = Object.values(sourceData);
        
        // Colors for each source type
        const backgroundColors = [
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 206, 86, 0.8)'
        ];
        
        // Create chart
        detectionsBySourceChartInstance = new Chart(detectionsBySourceChart, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color.replace('0.8', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                plugins: {
                    title: {
                        display: true,
                        text: 'Detections by Source Type',
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        position: 'bottom'
                    }
                },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    // Update statistics panel
    function updateStats(data) {
        // Total detections
        totalDetectionsEl.textContent = data.total_detections.toLocaleString();
        
        // Source data
        const sourceData = data.detection_by_source;
        const sourceCount = Object.keys(sourceData).length;
        const totalDetections = data.total_detections;
        
        // Calculate average detections per run (if we had runs)
        const avgDetections = sourceCount > 0 ? (totalDetections / sourceCount).toFixed(1) : 0;
        avgDetectionsPerRunEl.textContent = avgDetections;
        
        // Get top detected object class
        const classData = data.detection_by_class;
        if (Object.keys(classData).length > 0) {
            const topClass = Object.entries(classData)
                .sort((a, b) => b[1] - a[1])[0];
            
            topDetectedObjectEl.textContent = `${topClass[0]} (${topClass[1]} detections)`;
        } else {
            topDetectedObjectEl.textContent = 'None';
        }
        
        // Get most active source
        if (Object.keys(sourceData).length > 0) {
            const topSource = Object.entries(sourceData)
                .sort((a, b) => b[1] - a[1])[0];
            
            const sourceName = topSource[0].charAt(0).toUpperCase() + topSource[0].slice(1);
            mostActiveSourceEl.textContent = `${sourceName} (${topSource[1]} detections)`;
        } else {
            mostActiveSourceEl.textContent = 'None';
        }
    }
    
    // Show error message
    function showError(message) {
        const chartContainers = [
            'objectsByClassContainer',
            'detectionsOverTimeContainer',
            'detectionsBySourceContainer'
        ];
        
        chartContainers.forEach(container => {
            document.getElementById(container).innerHTML = 
                `<div class="alert alert-danger">${message}</div>`;
        });
    }
});
