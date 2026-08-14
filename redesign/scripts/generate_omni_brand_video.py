"""Generate Summit's short brand film with Gemini Omni Flash.

Requires google-genai >= 2.0 (preferably in an isolated virtual environment).
The API key is read from GEMINI_API_KEY and is never written to disk.
"""

from __future__ import annotations

import base64
import json
import os
import time
from pathlib import Path

from google import genai


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "video"
OUTPUT_PATH = OUTPUT_DIR / "summit-brand-film-omni-flash.mp4"

REFERENCE_IMAGES = [
    ROOT / "public" / "img" / "SAM_MG_8110_enhanced.webp",
    ROOT / "public" / "img" / "SAM_MG_8429_enhanced.webp",
    ROOT / "public" / "img" / "SAM_MG_8222_enhanced.webp",
    ROOT / "public" / "img" / "SAM_MG_9054_enhanced.webp",
    ROOT / "public" / "img" / "SAM_MG_8636_enhanced.webp",
]

PROMPT = """Create a polished 10-second, 16:9 institutional brand film for an established independent financial advisory firm. Use all five supplied photographs as visual references, not as a literal slideshow.

[# References <IMAGE_REF_0>@Image1 <IMAGE_REF_1>@Image2 <IMAGE_REF_2>@Image3 <IMAGE_REF_3>@Image4 <IMAGE_REF_4>@Image5]
[0-2s] Begin with <IMAGE_REF_0>, the Summit office sign. A very slow, stable camera drift reveals the dimensional metal lettering under soft architectural light. If the sign is visible, it must read exactly “SUMMIT ASSET MANAGEMENT.”
[2-5s] Transition naturally into <IMAGE_REF_1>: the advisor and client review planning materials together. Add only subtle, realistic human movement—small hand gestures, breathing, and attentive posture. Preserve their identities, clothing, room and professional relationship.
[5-7s] Use <IMAGE_REF_2> and <IMAGE_REF_3> for elegant close details: crossed hands and watch, then eyeglasses resting above the polished table. Use shallow but realistic focus and restrained camera movement.
[7-10s] Finish in <IMAGE_REF_4>: the two colleagues walk through the lobby toward the daylight, with natural fabric movement and a slow, confident camera push.

Visual direction: premium editorial documentary photography, established and trustworthy, natural skin tones, neutral warm color, controlled highlights, realistic physics, understated and timeless. No startup aesthetic, no flashy transitions, no exaggerated smiles, no new people, no altered identities, no extra fingers, no warped hands, no invented architecture, no charts, no text overlays, no captions, no slogans, no dialogue, no watermark. Preserve the supplied environments and subjects. Audio: subtle calm instrumental bed with quiet natural office ambience, no voices. Use the given images as references for video generation; they should not be used as frozen literal frames."""


def image_part(path: Path) -> dict[str, str]:
    return {
        "type": "image",
        "data": base64.b64encode(path.read_bytes()).decode("ascii"),
        "mime_type": "image/webp",
    }


def main() -> None:
    if not os.environ.get("GEMINI_API_KEY"):
        raise RuntimeError("GEMINI_API_KEY is not set.")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    client = genai.Client()
    interaction = client.interactions.create(
        model="gemini-omni-flash-preview",
        input=[*[image_part(path) for path in REFERENCE_IMAGES], {"type": "text", "text": PROMPT}],
        response_format={"type": "video", "delivery": "uri", "aspect_ratio": "16:9"},
        generation_config={"video_config": {"task": "reference_to_video"}},
        timeout=900,
    )

    video = interaction.output_video
    if video is None:
        raise RuntimeError("Gemini completed without a video output.")

    if video.data:
        OUTPUT_PATH.write_bytes(base64.b64decode(video.data))
    elif video.uri:
        file_id = video.uri.split("/files/", 1)[-1].split(":", 1)[0].split("?", 1)[0]
        for _ in range(120):
            file_info = client.files.get(name=f"files/{file_id}")
            state = getattr(file_info.state, "name", str(file_info.state))
            if state == "ACTIVE":
                break
            if state == "FAILED":
                raise RuntimeError("Gemini returned a failed video file.")
            time.sleep(5)
        else:
            raise TimeoutError("Timed out waiting for the generated video file.")
        OUTPUT_PATH.write_bytes(client.files.download(file=video.uri))
    else:
        raise RuntimeError("Gemini returned neither inline video data nor a delivery URI.")

    metadata = {
        "interaction_id": interaction.id,
        "model": interaction.model,
        "status": str(interaction.status),
        "output": str(OUTPUT_PATH),
        "bytes": OUTPUT_PATH.stat().st_size,
        "references": [str(path) for path in REFERENCE_IMAGES],
        "prompt": PROMPT,
    }
    (OUTPUT_DIR / "summit-brand-film-omni-flash.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )
    print(f"Generated: {OUTPUT_PATH}")
    print(f"Size: {OUTPUT_PATH.stat().st_size} bytes")
    print(f"Interaction: {interaction.id}")


if __name__ == "__main__":
    main()
