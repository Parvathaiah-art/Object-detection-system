import os
import logging
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import cv2
import numpy as np
import base64
import time
import json
from datetime import datetime
from werkzeug.utils import secure_filename
from detector import ObjectDetector
from logger import DetectionLogger

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "border_security_secret")
app.config["UPLOAD_FOLDER"] = "uploads"
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB max upload size

# Create upload folder if it doesn't exist
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

# Initialize object detector and logger
detector = ObjectDetector()
detection_logger = DetectionLogger()

# Allowed file extensions
ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg"}
ALLOWED_VIDEO_EXTENSIONS = {"mp4", "avi", "mov", "mkv"}

def allowed_file(filename, allowed_extensions):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed_extensions

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/image-upload")
def image_upload():
    return render_template("image_upload.html")

@app.route("/video-upload")
def video_upload():
    return render_template("video_upload.html")

@app.route("/webcam")
def webcam():
    return render_template("webcam.html")

@app.route("/logs")
def logs():
    all_logs = detection_logger.get_all_logs()
    return render_template("logs.html", logs=all_logs)

@app.route("/analysis")
def analysis():
    analysis_data = detection_logger.get_analysis_data()
    return render_template("analysis.html", analysis_data=analysis_data)

@app.route("/api/detect/image", methods=["POST"])
def detect_image():
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files["file"]
    
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400
    
    if file and allowed_file(file.filename, ALLOWED_IMAGE_EXTENSIONS):
        try:
            # Read image file
            img_bytes = file.read()
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Run detection
            start_time = time.time()
            results = detector.detect(img)
            process_time = time.time() - start_time
            
            # Log detection
            source_type = "image"
            source_name = secure_filename(file.filename)
            detection_logger.log_detection(source_type, source_name, results, process_time)
            
            # Draw detections
            img_with_detections = detector.draw_detections(img, results)
            
            # Encode result as base64 string
            _, buffer = cv2.imencode(".jpg", img_with_detections)
            img_str = base64.b64encode(buffer).decode("utf-8")
            
            return jsonify({
                "success": True,
                "image": f"data:image/jpeg;base64,{img_str}",
                "detections": results,
                "process_time": process_time
            })
            
        except Exception as e:
            logger.error(f"Error processing image: {str(e)}")
            return jsonify({"error": f"Error processing image: {str(e)}"}), 500
    
    return jsonify({"error": "File type not allowed"}), 400

@app.route("/api/detect/video", methods=["POST"])
def detect_video():
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files["file"]
    
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400
    
    if file and allowed_file(file.filename, ALLOWED_VIDEO_EXTENSIONS):
        try:
            # Save the file temporarily
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            file.save(filepath)
            
            # Process video (frame by frame)
            cap = cv2.VideoCapture(filepath)
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            
            # Process only a subset of frames for efficiency (1 frame per second)
            sample_frames = max(1, int(fps))
            current_frame = 0
            all_detections = []
            
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Process only selected frames
                if current_frame % sample_frames == 0:
                    # Detect objects in the frame
                    results = detector.detect(frame)
                    timestamp = current_frame / fps
                    all_detections.append({
                        "timestamp": timestamp,
                        "detections": results
                    })
                
                current_frame += 1
            
            cap.release()
            
            # Remove the temporary file
            if os.path.exists(filepath):
                os.remove(filepath)
            
            # Log detection
            source_type = "video"
            source_name = filename
            detection_logger.log_video_detection(source_type, source_name, all_detections)
            
            return jsonify({
                "success": True,
                "message": f"Video processed. {len(all_detections)} frames analyzed.",
                "detections": all_detections
            })
            
        except Exception as e:
            logger.error(f"Error processing video: {str(e)}")
            return jsonify({"error": f"Error processing video: {str(e)}"}), 500
    
    return jsonify({"error": "File type not allowed"}), 400

@app.route("/api/detect/webcam", methods=["POST"])
def detect_webcam():
    try:
        # Get image data from request
        content = request.json
        if not content or "image" not in content:
            return jsonify({"error": "No image data provided"}), 400
        
        # Decode base64 image
        img_data = content["image"].split(",")[1]
        img_bytes = base64.b64decode(img_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Run detection
        start_time = time.time()
        results = detector.detect(img)
        process_time = time.time() - start_time
        
        # Log detection
        source_type = "webcam"
        source_name = "live-feed"
        detection_logger.log_detection(source_type, source_name, results, process_time)
        
        # Draw detections
        img_with_detections = detector.draw_detections(img, results)
        
        # Encode result as base64 string
        _, buffer = cv2.imencode(".jpg", img_with_detections)
        img_str = base64.b64encode(buffer).decode("utf-8")
        
        return jsonify({
            "success": True,
            "image": f"data:image/jpeg;base64,{img_str}",
            "detections": results,
            "process_time": process_time
        })
        
    except Exception as e:
        logger.error(f"Error processing webcam image: {str(e)}")
        return jsonify({"error": f"Error processing webcam image: {str(e)}"}), 500

@app.route("/api/logs", methods=["GET"])
def get_logs():
    try:
        logs = detection_logger.get_all_logs()
        return jsonify({"success": True, "logs": logs})
    except Exception as e:
        logger.error(f"Error retrieving logs: {str(e)}")
        return jsonify({"error": f"Error retrieving logs: {str(e)}"}), 500

@app.route("/api/logs/webcam", methods=["GET"])
def get_webcam_logs():
    try:
        webcam_logs = detection_logger.get_logs_by_source_type("webcam")
        return jsonify({"success": True, "logs": webcam_logs})
    except Exception as e:
        logger.error(f"Error retrieving webcam logs: {str(e)}")
        return jsonify({"error": f"Error retrieving webcam logs: {str(e)}"}), 500

@app.route("/api/analysis", methods=["GET"])
def get_analysis():
    try:
        analysis_data = detection_logger.get_analysis_data()
        return jsonify({"success": True, "data": analysis_data})
    except Exception as e:
        logger.error(f"Error retrieving analysis data: {str(e)}")
        return jsonify({"error": f"Error retrieving analysis data: {str(e)}"}), 500
