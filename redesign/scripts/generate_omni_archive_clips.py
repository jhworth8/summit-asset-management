"""Generate short, photo-constrained archival clips with Gemini Omni Flash.

The API key is read only from GEMINI_API_KEY. Generated assets are resumable:
existing non-empty clips are never overwritten.
"""

from __future__ import annotations

import base64
import os
import time
from pathlib import Path

from google import genai


ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "public" / "img"
OUTPUT_DIR = ROOT / "output" / "video" / "omni-extended-clips"
MODEL = "gemini-omni-flash-preview"

COMMON_CONSTRAINTS = """
Create an eight-second, 16:9, single continuous photorealistic shot. Use the
provided photograph as the exact first frame and visual ground truth. Begin
with that composition, then let the camera gently pull wider beyond the
original crop, revealing only a conservative, physically plausible
continuation of the same real location. Preserve every visible person's
identity, facial structure, age, hairstyle, clothing, body proportions and
position. Preserve the architecture, furniture, objects, colors, period and
lighting. People may make only the small natural movements explicitly stated.
Do not add people, props, signage, screens, documents, decorative objects or
events. Do not alter, replace or hallucinate any visible logo or readable text.
No cuts, no montage, no time jump, no stylization, no dramatic action, no
dialogue and no music. Maintain the source photograph's understated corporate
documentary character and modest early-digital photographic texture.
""".strip()

CLIPS = [
    {
        "name": "01-logo-wall",
        "image": "SAM_MG_8110_FPO-thumb620x260.jpg",
        "motion": (
            "The camera makes a very slow lateral slide and subtle pull-back, "
            "revealing a little more of the same plain office wall and ceiling. "
            "The metal Summit Asset Management wall letters remain perfectly "
            "unchanged and readable. Only soft existing light changes naturally."
        ),
    },
    {
        "name": "02-office-exterior",
        "image": "SAM_MG_8752_FPO-thumb620x260.jpg",
        "motion": (
            "The camera slowly pulls back to show slightly more of the same office "
            "building and landscaping. The fountain water flows naturally and the "
            "tree leaves move almost imperceptibly in a light breeze. No cars or "
            "people enter. The building remains exactly the same."
        ),
    },
    {
        "name": "03-advisor-table",
        "image": "SAM_MG_8429_FPO-thumb938x406.jpg",
        "motion": (
            "The camera gently widens from the meeting table. The seated woman keeps "
            "looking at the existing papers and makes one small natural hand gesture; "
            "the standing man shifts his attention slightly toward the same papers. "
            "Their identities, clothing, hands, papers, cup and painting remain unchanged."
        ),
    },
    {
        "name": "04-lobby-walk",
        "image": "SAM_MG_8636_FPO-thumb938x406.jpg",
        "motion": (
            "The camera slowly tracks backward and widens. The two existing men "
            "continue one or two small, natural walking steps toward the bright doors, "
            "maintaining their current pose and relationship. Preserve the lobby, "
            "windows, plants, sofas and outdoor view exactly."
        ),
    },
    {
        "name": "05-team-meeting",
        "image": "_MG_9114b_1-thumb620x260.jpg",
        "motion": (
            "The camera performs a slow, restrained pull-back that reveals a little "
            "more of the same office. The three existing colleagues remain focused on "
            "the open binder; one seated colleague makes a minimal page-pointing "
            "gesture. Preserve faces, clothing, binder, table, chairs, telephone, "
            "windows and blinds exactly."
        ),
    },
    {
        "name": "06-advisor-detail",
        "image": "SAM_MG_8222_FPO-thumb938x406.jpg",
        "motion": (
            "The camera makes a slow, shallow arc and widens slightly around the same "
            "folded hands on the polished table. The hands make only a subtle natural "
            "resting adjustment. Preserve the suit, tie, watch, anatomy, table and "
            "reflection exactly. Do not reveal a face or add anything."
        ),
    },
]


def save_video(client: genai.Client, interaction, destination: Path) -> None:
    video = interaction.output_video
    if not video:
        raise RuntimeError("The interaction completed without video output")

    if getattr(video, "data", None):
        destination.write_bytes(base64.b64decode(video.data))
        return

    uri = getattr(video, "uri", None)
    if not uri:
        raise RuntimeError("The video output has neither inline data nor a URI")

    file_id = uri.split("/files/")[-1].split(":")[0].split("?")[0]
    file_name = f"files/{file_id}"
    for _ in range(120):
        info = client.files.get(name=file_name)
        state = getattr(getattr(info, "state", None), "name", str(getattr(info, "state", "")))
        if state == "ACTIVE":
            destination.write_bytes(client.files.download(file=uri))
            return
        if state == "FAILED":
            raise RuntimeError(f"Generated video file failed processing: {file_name}")
        time.sleep(5)
    raise TimeoutError(f"Timed out waiting for generated video: {file_name}")


def main() -> None:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Set GEMINI_API_KEY in the process environment")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    client = genai.Client(api_key=api_key)

    for index, clip in enumerate(CLIPS, start=1):
        destination = OUTPUT_DIR / f"{clip['name']}.mp4"
        if destination.exists() and destination.stat().st_size > 100_000:
            print(f"[{index}/{len(CLIPS)}] keeping existing {destination.name}", flush=True)
            continue

        source = IMAGE_DIR / clip["image"]
        image_data = base64.b64encode(source.read_bytes()).decode("ascii")
        prompt = f"<FIRST_FRAME> {clip['motion']}\n\n{COMMON_CONSTRAINTS}\n\nUse this image as the starting frame."
        print(f"[{index}/{len(CLIPS)}] generating {destination.name} from {source.name}", flush=True)

        interaction = client.interactions.create(
            model=MODEL,
            input=[
                {"type": "image", "data": image_data, "mime_type": "image/jpeg"},
                {"type": "text", "text": prompt},
            ],
            response_format={"type": "video", "aspect_ratio": "16:9", "delivery": "uri"},
            generation_config={"video_config": {"task": "image_to_video"}},
            background=False,
            # URI delivery requires temporary server-side interaction storage.
            store=True,
            stream=False,
        )
        save_video(client, interaction, destination)
        print(f"[{index}/{len(CLIPS)}] saved {destination.name} ({destination.stat().st_size:,} bytes)", flush=True)


if __name__ == "__main__":
    main()
