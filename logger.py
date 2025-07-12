import json
import os
import logging
from datetime import datetime
from collections import Counter, defaultdict

logger = logging.getLogger(__name__)

class DetectionLogger:
    def __init__(self):
        """
        Initialize the detection logger.
        """
        self.logs = []
        self.log_file = "detection_logs.json"
        
        # Load existing logs if available
        self._load_logs()
    
    def _load_logs(self):
        """Load existing logs from file if it exists."""
        try:
            if os.path.exists(self.log_file):
                with open(self.log_file, 'r') as f:
                    self.logs = json.load(f)
                logger.info(f"Loaded {len(self.logs)} logs from file.")
            else:
                logger.info("No existing log file found. Starting with empty logs.")
        except Exception as e:
            logger.error(f"Error loading logs: {str(e)}")
            # Start with empty logs if there's an error
            self.logs = []
    
    def _save_logs(self):
        """Save logs to file."""
        try:
            with open(self.log_file, 'w') as f:
                json.dump(self.logs, f, indent=2)
            logger.debug(f"Saved {len(self.logs)} logs to file.")
        except Exception as e:
            logger.error(f"Error saving logs: {str(e)}")
    
    def log_detection(self, source_type, source_name, detections, process_time=0):
        """
        Log a detection event.
        
        Args:
            source_type: Type of source (image, video, webcam)
            source_name: Name of the source (filename, etc.)
            detections: List of detection results
            process_time: Time taken to process the detection (seconds)
        """
        # Create detection log entry
        log_entry = {
            "id": len(self.logs) + 1,
            "timestamp": datetime.now().isoformat(),
            "source_type": source_type,
            "source_name": source_name,
            "detections": detections,
            "detection_count": len(detections),
            "process_time": process_time,
            "detected_classes": [det["class"] for det in detections]
        }
        
        # Add log entry
        self.logs.append(log_entry)
        
        # Save logs to file
        self._save_logs()
        
        logger.debug(f"Logged detection: {source_type} - {len(detections)} objects")
        return log_entry
    
    def log_video_detection(self, source_type, source_name, frame_detections):
        """
        Log a video detection event.
        
        Args:
            source_type: Type of source (video)
            source_name: Name of the video file
            frame_detections: List of detection results per frame
        """
        # Count total detections across all frames
        all_detections = []
        for frame in frame_detections:
            all_detections.extend(frame["detections"])
        
        # Create detection log entry
        log_entry = {
            "id": len(self.logs) + 1,
            "timestamp": datetime.now().isoformat(),
            "source_type": source_type,
            "source_name": source_name,
            "frame_count": len(frame_detections),
            "total_detections": len(all_detections),
            "detected_classes": [det["class"] for det in all_detections],
            "frame_detections": frame_detections
        }
        
        # Add log entry
        self.logs.append(log_entry)
        
        # Save logs to file
        self._save_logs()
        
        logger.debug(f"Logged video detection: {source_name} - {len(all_detections)} objects in {len(frame_detections)} frames")
        return log_entry
    
    def get_all_logs(self):
        """Get all detection logs."""
        return self.logs
    
    def get_logs_by_source_type(self, source_type):
        """
        Get logs filtered by source type.
        
        Args:
            source_type: Type of source to filter logs (image, video, webcam)
            
        Returns:
            List of logs matching the source type
        """
        return [log for log in self.logs if log["source_type"] == source_type]
    
    def get_analysis_data(self):
        """
        Generate analysis data from logs.
        
        Returns:
            Dictionary containing various analysis metrics
        """
        if not self.logs:
            return {
                "total_detections": 0,
                "detection_by_source": {},
                "detection_by_class": {},
                "detection_over_time": {}
            }
        
        # Count total detections
        total_detections = sum(log.get("detection_count", log.get("total_detections", 0)) for log in self.logs)
        
        # Count detections by source type
        detection_by_source = defaultdict(int)
        for log in self.logs:
            detection_by_source[log["source_type"]] += log.get("detection_count", log.get("total_detections", 0))
        
        # Count detections by class
        detection_by_class = Counter()
        for log in self.logs:
            detection_by_class.update(log.get("detected_classes", []))
        
        # Group detections by day
        detection_over_time = defaultdict(int)
        for log in self.logs:
            date = log["timestamp"].split("T")[0]  # Get date part only
            detection_over_time[date] += log.get("detection_count", log.get("total_detections", 0))
        
        return {
            "total_detections": total_detections,
            "detection_by_source": dict(detection_by_source),
            "detection_by_class": dict(detection_by_class),
            "detection_over_time": dict(detection_over_time)
        }
