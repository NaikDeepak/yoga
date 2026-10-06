# Generates the reference photos with Gemini (see README.md). Reads GEMINI_API_KEY from .env.
#   python3 scripts/ideal-photos/generate.py [front right back shoulderExtRight forwardFold butterfly]
import base64, json, os, sys, urllib.request
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
key = next(l.split("=",1)[1].strip().strip('"\'') for l in open(f"{ROOT}/.env") if l.startswith("GEMINI_API_KEY="))
# Raw PNGs go to a scratch folder (not the repo); pick finals into public/ideal/ by hand.
OUT = os.environ.get("IDEAL_OUT", "/tmp/ideal-photos")
os.makedirs(OUT, exist_ok=True)
MODEL = "gemini-3-pro-image"

STYLE = ("Photorealistic professional studio photograph for a physiotherapy posture guide. "
  "One Indian woman in her early thirties, slim athletic build, dark hair tied in a neat low bun so the ears and neck are visible, "
  "wearing a plain fitted dark green sports top and plain fitted black ankle-length leggings, barefoot. "
  "Plain seamless light warm-grey studio background and floor, no props, no mat, no text, no logos. "
  "Soft even lighting. Camera at waist height, perfectly level, straight-on. Whole body visible head to feet with a small margin. "
  "Anatomically correct hands, feet and joints.")
POSES = {
  "front": ("9:16", "She stands tall facing the camera with ideal posture: head level, shoulders level and relaxed, arms hanging naturally at her sides, feet hip-width apart, weight even."),
  "right": ("9:16", "Exact side profile: her right side faces the camera and she faces the right edge of the frame. Ideal posture: ear, shoulder, hip, knee and ankle in one vertical line, arms relaxed at her sides."),
  "back": ("9:16", "She stands tall with her back to the camera, ideal posture: head level, shoulders level, arms hanging at her sides, feet hip-width apart."),
  "shoulderExtRight": ("9:16", "Exact side profile: her right side faces the camera and she faces the right edge of the frame. She stands tall and sweeps both straight arms backwards behind her body to about 60 degrees from vertical, palms facing in, chest open, shoulders down."),
  "forwardFold": ("9:16", "Exact side profile: her right side faces the camera and she faces the right edge of the frame. Deep standing forward fold (uttanasana) of a very flexible yogini: legs completely straight and vertical, folding fully from the hip joints so her chest and belly rest against her thighs and her face is near her shins, palms flat on the floor right beside her feet, head hanging down. The torso hangs almost vertically downward along the front of the legs."),
  "butterfly": ("4:5", "She sits on the floor facing the camera in butterfly pose (baddha konasana): soles of the feet pressed together, heels drawn in close to the pelvis, both knees dropped wide towards the floor, hands holding her feet, spine tall, looking at the camera."),
}

def generate(name, ref=None):
    aspect, pose = POSES[name]
    parts = []
    if ref:
        parts.append({"inline_data": {"mime_type": "image/png", "data": base64.b64encode(open(ref,"rb").read()).decode()}})
        parts.append({"text": "Use exactly the same woman, outfit, hairstyle, background and lighting as in this reference photo. "})
    parts.append({"text": STYLE + " " + pose})
    body = {"contents": [{"parts": parts}], "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": aspect}}}
    req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
        data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": key})
    try:
        d = json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e:
        print(name, "HTTP", e.code, json.load(e).get("error", {}).get("message", "")[:200]); return None
    for p in d["candidates"][0]["content"]["parts"]:
        inline = p.get("inlineData") or p.get("inline_data")
        if inline:
            path = f"{OUT}/{name}.png"; open(path,"wb").write(base64.b64decode(inline["data"])); print(name, "ok"); return path
    print(name, "no image", str(d)[:200]); return None

names = sys.argv[1:] or list(POSES)
anchor = f"{OUT}/front.png"
for n in names:
    generate(n, None if n == "front" else (anchor if os.path.exists(anchor) else None))
