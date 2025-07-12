import cv2
import numpy as np
import logging
import time
import os

logger = logging.getLogger(__name__)

class ObjectDetector:
    def __init__(self):
        """
        Initialize the object detector with a pre-trained model.
        Using the COCO classes and YOLOv3 model for object detection.
        """
        self.classes = self._load_coco_classes()
        self.colors = np.random.uniform(0, 255, size=(len(self.classes), 3))
        
        # Load YOLOv3 model
        # For demonstration purposes, we'll use the mock detector
        # since downloading the model files requires additional setup
        logger.info("Using mock detector for demonstration purposes")
        self.net = None
        self.backend = "mock"
    
    def _load_coco_classes(self):
        """Load COCO class names"""
        return [
            'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
            'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
            'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
            'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
            'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
            'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
            'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
            'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
            'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
            'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
        ]
    
    def detect(self, image):
        """
        Detect objects in the input image using the loaded model
        
        Args:
            image: numpy array of image (BGR format)
            
        Returns:
            List of dictionaries containing detection info
        """
        if self.backend == "mock":
            # Mock detector for demonstration if model doesn't load
            return self._mock_detection(image)
        
        # Get image dimensions
        height, width = image.shape[:2]
        
        if self.backend == "yolov3":
            # Create blob from image for YOLOv3
            blob = cv2.dnn.blobFromImage(image, 1/255.0, (416, 416), swapRB=True, crop=False)
            self.net.setInput(blob)
            
            # Get outputs from YOLO's output layers
            output_layers = self.net.getUnconnectedOutLayersNames()
            outputs = self.net.forward(output_layers)
            
            # Initialize lists
            boxes = []
            confidences = []
            class_ids = []
            
            # Process each output
            for output in outputs:
                for detection in output:
                    scores = detection[5:]
                    class_id = np.argmax(scores)
                    confidence = scores[class_id]
                    
                    # Filter weak detections
                    if confidence > 0.5:
                        # YOLO returns normalized coordinates
                        center_x = int(detection[0] * width)
                        center_y = int(detection[1] * height)
                        w = int(detection[2] * width)
                        h = int(detection[3] * height)
                        
                        # Rectangle coordinates
                        x = int(center_x - w / 2)
                        y = int(center_y - h / 2)
                        
                        boxes.append([x, y, w, h])
                        confidences.append(float(confidence))
                        class_ids.append(class_id)
        
        elif self.backend == "mobilenet_ssd":
            # Prepare blob for MobileNet SSD
            blob = cv2.dnn.blobFromImage(image, 0.007843, (300, 300), 127.5)
            self.net.setInput(blob)
            
            # Get detections
            detections = self.net.forward()
            
            # Initialize lists
            boxes = []
            confidences = []
            class_ids = []
            
            # Process each detection
            for i in range(detections.shape[2]):
                confidence = detections[0, 0, i, 2]
                
                if confidence > 0.5:
                    class_id = int(detections[0, 0, i, 1])
                    
                    # SSD returns normalized coordinates
                    box = detections[0, 0, i, 3:7] * np.array([width, height, width, height])
                    (startX, startY, endX, endY) = box.astype("int")
                    
                    # Convert to YOLO format [x, y, w, h]
                    w = endX - startX
                    h = endY - startY
                    
                    boxes.append([startX, startY, w, h])
                    confidences.append(float(confidence))
                    class_ids.append(class_id)
        
        # Apply non-maximum suppression to remove redundant overlapping boxes
        indices = cv2.dnn.NMSBoxes(boxes, confidences, 0.5, 0.4)
        
        detections = []
        if len(indices) > 0:
            for i in indices.flatten():
                # Get detection details
                x, y, w, h = boxes[i]
                class_id = class_ids[i]
                confidence = confidences[i]
                
                # Ensure class_id is within range
                if class_id < len(self.classes):
                    label = self.classes[class_id]
                else:
                    label = f"Unknown-{class_id}"
                
                # Add detection to results
                detections.append({
                    "class": label,
                    "confidence": round(confidence, 3),
                    "bbox": [x, y, w, h]
                })
        
        return detections
    
    def _mock_detection(self, image):
        """
        Create mock detections for demonstration purposes when model can't be loaded
        
        Args:
            image: Input image
            
        Returns:
            List of mock detections
        """
        height, width = image.shape[:2]
        
        # Create random detections
        num_detections = np.random.randint(1, 5)
        mock_detections = []
        
        for _ in range(num_detections):
            # Random class
            class_id = np.random.randint(0, len(self.classes))
            label = self.classes[class_id]
            
            # Random box
            w = np.random.randint(width // 10, width // 3)
            h = np.random.randint(height // 10, height // 3)
            x = np.random.randint(0, width - w)
            y = np.random.randint(0, height - h)
            
            # Random confidence
            confidence = np.random.uniform(0.6, 0.95)
            
            mock_detections.append({
                "class": label,
                "confidence": round(confidence, 3),
                "bbox": [x, y, w, h]
            })
        
        return mock_detections
    
    def draw_detections(self, image, detections):
        """
        Draw detection boxes and labels on the image
        
        Args:
            image: Input image
            detections: List of detection dictionaries
            
        Returns:
            Image with drawn detections
        """
        # Make a copy of the image to avoid modifying original
        output_img = image.copy()
        
        for detection in detections:
            # Get detection info
            x, y, w, h = detection["bbox"]
            label = detection["class"]
            confidence = detection["confidence"]
            
            # Get color for this class
            class_id = self.classes.index(label) if label in self.classes else 0
            color = self.colors[class_id].tolist()
            
            # Draw bounding box
            cv2.rectangle(output_img, (x, y), (x + w, y + h), color, 2)
            
            # Prepare label text
            text = f"{label}: {confidence:.2f}"
            
            # Draw label background
            text_size, _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
            cv2.rectangle(output_img, (x, y - 25), (x + text_size[0], y), color, -1)
            
            # Draw label text
            cv2.putText(output_img, text, (x, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)
        
        return output_img
