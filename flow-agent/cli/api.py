#!/usr/bin/env python3
"""OpenAI-Compatible API Server for Flow Agent.

Implements standard OpenAI API specs (e.g. /v1/images/generations) 
for seamless integration with OpenAI clients and external tools (n8n, Dify, etc.).
"""

import os
import sys
import uuid
import time
import json
import base64
import logging
import asyncio
import urllib.request
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Security, Depends, Query
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

# Add parent dir to sys.path so omniflash can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from omniflash import ExtensionBridge, DEFAULT_PROJECT
from omniflash.generators.t2i import generate_image, download_image

# Setup logging
log = logging.getLogger("omniflash.openai_api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")

# Directories
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(ROOT_DIR, "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ExtensionBridge lifecycle
bridge: Optional[ExtensionBridge] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global bridge
    log.info("🚀 Starting Flow Agent Extension Bridge (OpenAI Interface)...")
    bridge = ExtensionBridge()
    await bridge.start()
    
    # Run extension connection in background
    asyncio.create_task(bridge.wait_for_extension(timeout=30))
    
    yield
    
    log.info("🔌 Closing Flow Agent Extension Bridge...")
    if bridge:
        await bridge.close()

app = FastAPI(
    title="Flow Agent OpenAI API Wrapper",
    description="OpenAI-compatible endpoints for Google Flow AI image generation",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication Dependency
security = HTTPBearer(auto_error=False)

async def verify_api_key(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    server_key = os.environ.get("SERVER_API_KEY")
    if not server_key:
        # If no key is defined in .env, auth is skipped (disabled)
        return
    if not credentials or credentials.credentials != server_key:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key. Please pass 'Authorization: Bearer <key>'"
        )

# Helper to check bridge health
async def get_active_bridge() -> ExtensionBridge:
    global bridge
    if not bridge:
        raise HTTPException(status_code=503, detail="Extension bridge is not initialized")
    
    is_healthy = await bridge.health_check()
    if not is_healthy:
        log.info("🔄 Bridge health check failed. Re-waiting for extension connection...")
        connected = await bridge.wait_for_extension(timeout=10, max_retries=1)
        if not connected:
            raise HTTPException(
                status_code=503,
                detail="Google Flow extension is not connected. Open Google Flow in Chrome."
            )
    return bridge

# Map OpenAI image size to Flow aspect ratio
def map_size_to_aspect(size_str: Optional[str]) -> str:
    if not size_str:
        return "square"
    
    parts = size_str.lower().split("x")
    if len(parts) == 2:
        try:
            w, h = int(parts[0]), int(parts[1])
            ratio = w / h
            if 0.9 <= ratio <= 1.1:
                return "square"
            elif ratio > 1.4:
                return "landscape"
            elif ratio < 0.7:
                return "portrait"
            elif ratio > 1.0:
                return "4x3"
            else:
                return "3x4"
        except ValueError:
            pass
    return "square"


# OpenAI Request/Response Models
class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., description="The prompt to generate images from")
    model: str = Field("narwhal", description="Image model name (e.g. narwhal, gem_pix_2, imagen_4)")
    n: int = Field(1, ge=1, le=4, description="Number of images to generate (1-4)")
    size: str = Field("1024x1024", description="Image dimensions (e.g. 1024x1024, 1024x1792, etc.)")
    response_format: str = Field("url", description="The format in which the generated images are returned (url or b64_json)")
    user: Optional[str] = None
    image_base64: Optional[str] = Field(None, description="Optional base64 reference image for image-to-image")
    ref_media_ids: Optional[List[str]] = Field(None, description="Optional reference image media IDs (up to 10)")


class VideoGenerationRequest(BaseModel):
    prompt: str = Field(..., description="The prompt to generate videos from")
    aspect: str = Field("portrait", description="Video aspect ratio (portrait or landscape)")
    n: int = Field(1, ge=1, le=4, description="Number of videos to generate (1-4)")
    duration: int = Field(8, description="Duration in seconds (e.g. 4, 6, 8, 10)")
    image_base64: Optional[str] = Field(None, description="Optional base64 start image for image-to-video")
    ref_media_ids: Optional[List[str]] = Field(None, description="Optional reference image media IDs (up to 10)")
    start_media_id: Optional[str] = Field(None, description="Optional pre-uploaded start image or video media ID")
    is_video: Optional[bool] = Field(False, description="True if the pre-uploaded reference is a video")


# OpenAI Endpoints

@app.get("/v1/models", dependencies=[Depends(verify_api_key)])
async def list_models():
    """List available Google Flow models (OpenAI format)."""
    return {
        "object": "list",
        "data": [
            {"id": "narwhal", "object": "model", "created": int(time.time()), "owned_by": "google"},
            {"id": "imagen-4", "object": "model", "created": int(time.time()), "owned_by": "google"},
            {"id": "gem_pix_2", "object": "model", "created": int(time.time()), "owned_by": "google"}
        ]
    }


@app.post("/v1/images/generations", dependencies=[Depends(verify_api_key)])
async def openai_generate_image(req: ImageGenerationRequest):
    """Generate images from a prompt (OpenAI Spec)."""
    active_bridge = await get_active_bridge()
    aspect = map_size_to_aspect(req.size)
    project_id = os.environ.get("DEFAULT_PROJECT", DEFAULT_PROJECT)

    ref_media_ids = req.ref_media_ids or None
    temp_img_path = None

    if req.image_base64 and not ref_media_ids:
        from omniflash.generators.i2v import upload_image
        b64_data = req.image_base64
        if "," in b64_data:
            b64_data = b64_data.split(",")[1]

        timestamp = int(time.time())
        temp_img_name = f"i2i_upload_{timestamp}_{uuid.uuid4().hex[:6]}.png"
        temp_img_path = os.path.join(OUTPUT_DIR, temp_img_name)

        try:
            with open(temp_img_path, "wb") as f:
                f.write(base64.b64decode(b64_data))

            media_id = await upload_image(active_bridge, temp_img_path, project_id)
            if media_id:
                ref_media_ids = [media_id]
            else:
                raise HTTPException(status_code=500, detail="Failed to upload I2I reference image to Google Flow.")
        except Exception as e:
            log.exception("Error uploading I2I reference image")
            if temp_img_path and os.path.exists(temp_img_path):
                os.remove(temp_img_path)
            raise HTTPException(status_code=500, detail=f"Image upload error: {str(e)}")

    # Trigger Flow generation
    try:
        results = await generate_image(
            active_bridge, 
            prompt=req.prompt, 
            aspect=aspect, 
            project_id=project_id, 
            count=req.n,
            ref_media_ids=ref_media_ids
        )
    except Exception as e:
        if temp_img_path and os.path.exists(temp_img_path):
            try:
                os.remove(temp_img_path)
            except Exception:
                pass
        raise HTTPException(status_code=400, detail=str(e))

    if temp_img_path and os.path.exists(temp_img_path):
        try:
            os.remove(temp_img_path)
        except Exception:
            pass

    if not results:
        raise HTTPException(status_code=400, detail="Flow failed to generate images.")

    data_outputs = []
    timestamp = int(time.time())

    for i, r in enumerate(results):
        url = r.get("image_url")
        if not url:
            continue

        unique_id = uuid.uuid4().hex[:6]
        filename = f"flowagent_img_{timestamp}_{unique_id}_{i+1}.png"
        out_path = os.path.join(OUTPUT_DIR, filename)

        download_success = await download_image(active_bridge, url, out_path)
        if not download_success:
            continue

        if req.response_format == "b64_json":
            with open(out_path, "rb") as image_file:
                b64_data = base64.b64encode(image_file.read()).decode("utf-8")
                data_outputs.append({"b64_json": b64_data})
        else:
            host = os.environ.get("OPENAI_API_HOST", "127.0.0.1")
            port = os.environ.get("OPENAI_API_PORT", "8001")
            download_url = f"http://{host}:{port}/download/{filename}"
            data_outputs.append({
                "url": download_url,
                "media_id": r.get("media_id")
            })
            append_to_history("image", download_url, req.prompt, r.get("media_id"))

    return {
        "created": timestamp,
        "data": data_outputs
    }


@app.post("/v1/videos/generations", dependencies=[Depends(verify_api_key)])
async def openai_generate_video(req: VideoGenerationRequest):
    """Generate videos from a prompt (and optional start image)."""
    active_bridge = await get_active_bridge()
    project_id = os.environ.get("DEFAULT_PROJECT", DEFAULT_PROJECT)

    # Map aspect ratio to Flow's ASPECT string
    from omniflash import ASPECTS
    aspect_key = ASPECTS.get(req.aspect, "VIDEO_ASPECT_RATIO_PORTRAIT")

    from omniflash.generators.common import poll_status, download_video
    image_media_id = req.start_media_id
    temp_img_path = None
    is_video_input = bool(req.is_video)

    # If image_base64 is provided and we don't have start_media_id, upload it first
    if req.image_base64 and not image_media_id:
        b64_data = req.image_base64
        is_video_input = b64_data.startswith("data:video/")
        
        if "," in b64_data:
            b64_data = b64_data.split(",")[1]

        timestamp = int(time.time())
        if is_video_input:
            temp_img_name = f"i2v_upload_{timestamp}_{uuid.uuid4().hex[:6]}.mp4"
        else:
            temp_img_name = f"i2v_upload_{timestamp}_{uuid.uuid4().hex[:6]}.png"
        temp_img_path = os.path.join(OUTPUT_DIR, temp_img_name)

        try:
            with open(temp_img_path, "wb") as f:
                f.write(base64.b64decode(b64_data))

            if is_video_input:
                from omniflash.upload import upload_video
                upload_res = await upload_video(temp_img_path, project_id, active_bridge)
                image_media_id = upload_res.get("mediaId") or upload_res.get("name") or upload_res.get("id")
                if not image_media_id and isinstance(upload_res.get("media"), dict):
                    image_media_id = upload_res["media"].get("name") or upload_res["media"].get("mediaId")
                if not image_media_id:
                    raise HTTPException(status_code=500, detail="Failed to upload start video reference to Google Flow.")
            else:
                from omniflash.generators.i2v import upload_image
                image_media_id = await upload_image(active_bridge, temp_img_path, project_id)
                if not image_media_id:
                    raise HTTPException(status_code=500, detail="Failed to upload start image to Google Flow.")
        except Exception as e:
            log.exception("Error uploading start asset")
            if temp_img_path and os.path.exists(temp_img_path):
                os.remove(temp_img_path)
            raise HTTPException(status_code=500, detail=f"Asset upload error: {str(e)}")

    try:
        # Submit generation
        if is_video_input and image_media_id:
            from omniflash.generators.v2v import edit_video
            media_ids = await edit_video(active_bridge, req.prompt, aspect_key, project_id, image_media_id, duration=req.duration, ref_media_ids=req.ref_media_ids)
        elif req.ref_media_ids:
            from omniflash.generators.i2v import generate_video_r2v
            media_ids = await generate_video_r2v(active_bridge, req.prompt, aspect_key, project_id, req.ref_media_ids, duration=req.duration, count=req.n)
        elif image_media_id:
            from omniflash.generators.i2v import generate_video_i2v
            media_ids = await generate_video_i2v(active_bridge, req.prompt, aspect_key, project_id, image_media_id, duration=req.duration, count=req.n)
        else:
            from omniflash.generators.t2v import generate_video
            media_ids = await generate_video(active_bridge, req.prompt, aspect_key, project_id, duration=req.duration, count=req.n)
    except Exception as e:
        if temp_img_path and os.path.exists(temp_img_path):
            try:
                os.remove(temp_img_path)
            except Exception:
                pass
        raise HTTPException(status_code=400, detail=str(e))

    # Clean up temp upload image immediately since it's uploaded to Google Flow
    if temp_img_path and os.path.exists(temp_img_path):
        try:
            os.remove(temp_img_path)
        except Exception:
            pass

    if not media_ids:
        raise HTTPException(status_code=400, detail="Video generation failed to submit.")

    # Poll for status of all videos and download them in parallel
    data_outputs = []
    timestamp = int(time.time())

    async def poll_and_download(media_id: str, index: int):
        success = await poll_status(active_bridge, media_id, project_id)
        if not success:
            log.error(f"Polling failed for media_id: {media_id}")
            return None

        filename = f"flow_vid_{timestamp}_{uuid.uuid4().hex[:6]}_{index+1}.mp4"
        out_path = os.path.join(OUTPUT_DIR, filename)

        dl_success = await download_video(active_bridge, media_id, out_path)
        if not dl_success:
            log.error(f"Download failed for media_id: {media_id}")
            return None

        host = os.environ.get("OPENAI_API_HOST", "127.0.0.1")
        port = os.environ.get("OPENAI_API_PORT", "8001")
        download_url = f"http://{host}:{port}/download/{filename}"
        return {"url": download_url, "media_id": media_id}

    tasks = [poll_and_download(mid, i) for i, mid in enumerate(media_ids)]
    results = await asyncio.gather(*tasks)

    for r in results:
        if r:
            data_outputs.append(r)
            append_to_history("video", r["url"], req.prompt, r.get("media_id"))

    if not data_outputs:
        raise HTTPException(status_code=500, detail="Failed to complete video generations or downloads.")

    return {
        "created": timestamp,
        "data": data_outputs
    }



# Chat completions spec support for custom IDE models
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: str = "flow-agent"
    messages: List[ChatMessage]
    temperature: Optional[float] = 1.0
    stream: Optional[bool] = False


async def stream_chat_completion(req: ChatCompletionRequest, content: str):
    chunk_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    timestamp = int(time.time())
    
    # Send assistant role chunk
    yield f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'created': timestamp, 'model': req.model, 'choices': [{'index': 0, 'delta': {'role': 'assistant', 'content': ''}, 'finish_reason': None}]})}\n\n"
    await asyncio.sleep(0.02)
    
    # Send generated response chunk
    yield f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'created': timestamp, 'model': req.model, 'choices': [{'index': 0, 'delta': {'content': content}, 'finish_reason': None}]})}\n\n"
    await asyncio.sleep(0.02)
    
    # Send stop signal
    yield f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'created': timestamp, 'model': req.model, 'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'stop'}]})}\n\n"
    yield "data: [DONE]\n\n"


@app.post("/v1/chat/completions", dependencies=[Depends(verify_api_key)])
async def chat_completions(req: ChatCompletionRequest):
    """Expose image & video generation through standard chat endpoint for editors."""
    # Find last user prompt
    prompt = ""
    for msg in reversed(req.messages):
        if msg.role == "user":
            prompt = msg.content
            break

    if not prompt:
        raise HTTPException(status_code=400, detail="No user message found in the chat history.")

    # Check for short test/connection check prompts from IDEs (like 'hi', 'hello', 'test')
    is_test_prompt = len(prompt.strip()) < 5 or prompt.strip().lower() in ("hello", "test", "ping", "say hi", "hey", "hi there", "testing")

    if is_test_prompt:
        log.info(f"⚡ Test/Greeting prompt detected -> '{prompt}'. Returning mock response for verification.")
        markdown_response = "Hello! I am Flow-Agent. I am successfully connected and ready to generate images or videos for you."
    else:
        active_bridge = await get_active_bridge()
        project_id = os.environ.get("DEFAULT_PROJECT", DEFAULT_PROJECT)
        
        # Detect video keywords in prompt
        is_video = any(kw in prompt.lower() for kw in ["video", "animate", "generate video", "make video", "mp4"])

        if is_video:
            # Import video generator on demand
            from omniflash.generators.t2v import generate_video
            from omniflash.generators.common import poll_status, download_video
            from omniflash import ASPECTS
            
            log.info(f"🎥 Custom Chat Prompt: Video Generation -> '{prompt}'")
            aspect_key = ASPECTS.get("portrait", "VIDEO_ASPECT_RATIO_PORTRAIT")
            media_ids = await generate_video(active_bridge, prompt, aspect_key, project_id)
            if not media_ids:
                raise HTTPException(status_code=500, detail="Failed to initiate video generation.")
                
            media_id = media_ids[0]
            if not await poll_status(active_bridge, media_id, project_id):
                raise HTTPException(status_code=500, detail="Video generation failed during polling.")
                
            timestamp = int(time.time())
            filename = f"openai_chat_vid_{timestamp}_{uuid.uuid4().hex[:6]}_1.mp4"
            out_path = os.path.join(OUTPUT_DIR, filename)
            
            if not await download_video(active_bridge, media_id, out_path):
                raise HTTPException(status_code=500, detail="Failed to download video file.")
                
            download_url = f"http://{req.model if req.model != 'flow-agent' else '127.0.0.1'}:8001/download/{filename}"
            markdown_response = f"🎬 **Video Generated successfully!**\n\n[Download / Play Video]({download_url})\n\n"
        else:
            log.info(f"🖼️ Custom Chat Prompt: Image Generation -> '{prompt}'")
            results = await generate_image(active_bridge, prompt=prompt, aspect="square", project_id=project_id, count=1)
            if not results or not results[0].get("image_url"):
                raise HTTPException(status_code=500, detail="Flow failed to generate image.")
                
            url = results[0]["image_url"]
            timestamp = int(time.time())
            filename = f"openai_chat_img_{timestamp}_{uuid.uuid4().hex[:6]}_1.png"
            out_path = os.path.join(OUTPUT_DIR, filename)
            
            if not await download_image(active_bridge, url, out_path):
                raise HTTPException(status_code=500, detail="Failed to download image file.")
                
            download_url = f"http://127.0.0.1:8001/download/{filename}"
            markdown_response = f"🖼️ **Image Generated successfully!**\n\n![Generated Image]({download_url})\n\n"

    # Support streaming mode
    if req.stream:
        return StreamingResponse(
            stream_chat_completion(req, markdown_response), 
            media_type="text/event-stream"
        )

    # Return standard non-streaming response
    return {
        "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": req.model,
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": markdown_response
            },
            "finish_reason": "stop"
        }],
        "usage": {
            "prompt_tokens": len(prompt) // 4,
            "completion_tokens": len(markdown_response) // 4,
            "total_tokens": (len(prompt) + len(markdown_response)) // 4
        }
    }


class UploadRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image or video data")

@app.post("/v1/upload", dependencies=[Depends(verify_api_key)])
async def upload_file_endpoint(req: UploadRequest):
    """Upload a file (image or video) to Google Flow and return its media ID and local URL."""
    active_bridge = await get_active_bridge()
    project_id = os.environ.get("DEFAULT_PROJECT", DEFAULT_PROJECT)
    
    b64_data = req.image_base64
    is_video_input = b64_data.startswith("data:video/")
    
    if "," in b64_data:
        b64_data = b64_data.split(",")[1]

    timestamp = int(time.time())
    if is_video_input:
        temp_name = f"upload_{timestamp}_{uuid.uuid4().hex[:6]}.mp4"
    else:
        temp_name = f"upload_{timestamp}_{uuid.uuid4().hex[:6]}.png"
    temp_path = os.path.join(OUTPUT_DIR, temp_name)

    try:
        with open(temp_path, "wb") as f:
            f.write(base64.b64decode(b64_data))

        if is_video_input:
            from omniflash.upload import upload_video
            upload_res = await upload_video(temp_path, project_id, active_bridge)
            media_id = upload_res.get("mediaId") or upload_res.get("name") or upload_res.get("id")
            if not media_id and isinstance(upload_res.get("media"), dict):
                media_id = upload_res["media"].get("name") or upload_res["media"].get("mediaId")
            if not media_id:
                raise HTTPException(status_code=500, detail="Failed to upload video reference to Google Flow.")
        else:
            from omniflash.generators.i2v import upload_image
            media_id = await upload_image(active_bridge, temp_path, project_id)
            if not media_id:
                raise HTTPException(status_code=500, detail="Failed to upload image reference to Google Flow.")
        
        # Save file to history/output so we can serve its local URL
        host = os.environ.get("OPENAI_API_HOST", "127.0.0.1")
        port = os.environ.get("OPENAI_API_PORT", "8001")
        download_url = f"http://{host}:{port}/download/{temp_name}"
        
        # Add to history
        append_to_history("video" if is_video_input else "image", download_url, "Uploaded reference file", media_id)
        
        return {
            "media_id": media_id,
            "url": download_url
        }
    except Exception as e:
        log.exception("Error in /v1/upload")
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=str(e))


# History Management Helper
def append_to_history(type_str: str, url: str, prompt: str, media_id: str = None):
    history_file = os.path.join(OUTPUT_DIR, "history.json")
    data = {"history": []}
    if os.path.exists(history_file):
        try:
            with open(history_file, "r") as f:
                data = json.load(f)
        except Exception:
            pass
    data["history"].insert(0, {
        "type": type_str,
        "url": url,
        "prompt": prompt,
        "timestamp": int(time.time()),
        "media_id": media_id
    })
    # Cap history at 100 entries to avoid massive files
    data["history"] = data["history"][:100]
    try:
        with open(history_file, "w") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass


@app.get("/v1/history")
async def get_history():
    """Get previously generated images and videos."""
    history_file = os.path.join(OUTPUT_DIR, "history.json")
    if not os.path.exists(history_file):
        # Auto-detect existing generated files to populate initial history
        history_list = []
        try:
            files = sorted(
                [f for f in os.listdir(OUTPUT_DIR) if f.startswith(("openai_img_", "flowagent_img_", "flow_vid_", "openai_chat_vid_"))],
                key=lambda f: os.path.getmtime(os.path.join(OUTPUT_DIR, f)),
                reverse=True
            )
            host = os.environ.get("OPENAI_API_HOST", "127.0.0.1")
            port = os.environ.get("OPENAI_API_PORT", "8001")
            for filename in files[:100]:
                file_path = os.path.join(OUTPUT_DIR, filename)
                t = int(os.path.getmtime(file_path))
                is_vid = filename.endswith(".mp4")
                download_url = f"http://{host}:{port}/download/{filename}"
                history_list.append({
                    "type": "video" if is_vid else "image",
                    "url": download_url,
                    "prompt": "Pre-existing generation" if not filename.startswith("openai_chat_") else "Chat video prompt",
                    "timestamp": t,
                    "media_id": None
                })
            # Save it
            with open(history_file, "w") as f:
                json.dump({"history": history_list}, f, indent=2)
            return {"history": history_list}
        except Exception:
            return {"history": []}
            
    try:
        with open(history_file, "r") as f:
            return json.load(f)
    except Exception:
        return {"history": []}


@app.delete("/v1/history")
async def delete_all_history():
    """Clear all generation history and delete files."""
    history_file = os.path.join(OUTPUT_DIR, "history.json")
    try:
        if os.path.exists(history_file):
            os.remove(history_file)
        
        # Remove all generated and uploaded output files
        for filename in os.listdir(OUTPUT_DIR):
            if filename.startswith(("openai_img_", "flowagent_img_", "flow_vid_", "openai_chat_vid_", "openai_chat_img_", "upload_", "i2i_upload_", "i2v_upload_")):
                file_path = os.path.join(OUTPUT_DIR, filename)
                if os.path.exists(file_path):
                    os.remove(file_path)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear output folder: {str(e)}")


@app.delete("/v1/history/{filename}")
async def delete_history_item(filename: str):
    """Delete a single history item and its corresponding file."""
    history_file = os.path.join(OUTPUT_DIR, "history.json")
    
    # Delete from disk
    file_path = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            log.error(f"Failed to delete file {file_path}: {e}")
            
    # Delete from history.json metadata
    if os.path.exists(history_file):
        try:
            with open(history_file, "r") as f:
                data = json.load(f)
            
            initial_len = len(data.get("history", []))
            # Filter out items whose URL contains this filename
            data["history"] = [
                item for item in data.get("history", [])
                if filename not in item["url"]
            ]
            
            with open(history_file, "w") as f:
                json.dump(data, f, indent=2)
                
            return {"status": "success", "deleted": initial_len - len(data["history"])}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to update history data: {str(e)}")
            
    return {"status": "success", "info": "metadata file not found"}


@app.get("/download/{filename}")
async def download_file(filename: str):
    """Serve the generated assets."""
    file_path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    media_type = "image/png"
    if filename.endswith(".mp4"):
        media_type = "video/mp4"
    return FileResponse(path=file_path, filename=filename, media_type=media_type)


@app.get("/v1/credits", dependencies=[Depends(verify_api_key)])
async def get_flow_credits():
    active_bridge = await get_active_bridge()
    try:
        res = await active_bridge.api_request("/v1/credits", body=None, captcha_action=None, method="GET")
        if isinstance(res, dict):
            if res.get("status", 200) != 200:
                raise HTTPException(status_code=res.get("status", 500), detail=str(res.get("error", "API error")))
            if "data" in res:
                return res["data"]
        return res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Health Check
@app.get("/health")
async def health():
    global bridge
    if not bridge:
        return {"status": "starting", "connected": False}
    return {
        "status": "healthy" if await bridge.health_check() else "unauthorized_or_disconnected",
        "extension_connected": bridge._ws is not None,
        "has_flow_key": bridge._flow_key is not None
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Flow Agent OpenAI API Server")
    parser.add_argument("--host", default=os.environ.get("OPENAI_API_HOST", "127.0.0.1"), help="Host address")
    parser.add_argument("--port", type=int, default=int(os.environ.get("OPENAI_API_PORT", "8001")), help="Port to run on")
    args = parser.parse_args()

    import uvicorn
    uvicorn.run("cli.api:app", host=args.host, port=args.port)
