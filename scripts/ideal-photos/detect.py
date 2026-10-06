import json, sys, os
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions
# Detects pose landmarks on the raw PNGs with MediaPipe (pip install mediapipe==0.10.14; newer versions
# crash on macOS). Model: pose_landmarker_heavy.task from storage.googleapis.com/mediapipe-models.
#   IDEAL_OUT=/tmp/ideal-photos python detect.py front right back shoulderExtRight forwardFold butterfly
IN = os.environ.get("IDEAL_OUT", "/tmp/ideal-photos")
opts = vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=f"{IN}/pose_heavy.task"), running_mode=vision.RunningMode.IMAGE, min_pose_detection_confidence=0.1, min_pose_presence_confidence=0.1)
det = vision.PoseLandmarker.create_from_options(opts)
out = {}
for name in sys.argv[1:]:
    img = mp.Image.create_from_file(f"{IN}/{name}.png")
    r = det.detect(img)
    if not r.pose_landmarks: out[name] = None; continue
    out[name] = {"width": img.width, "height": img.height,
                 "landmarks": [{"x": l.x, "y": l.y, "visibility": l.visibility} for l in r.pose_landmarks[0]]}
json.dump(out, open(f"{IN}/detected.json", "w"))  # then resize/mirror into public/ideal + landmarks.json (README)
print({k: (v is not None) for k, v in out.items()})
