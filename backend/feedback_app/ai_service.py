# Import modules
import os
import json
import re
import base64
from PIL import Image

# Optional: Groq SDK for alternative AI provider
try:
    from groq import Groq
except ImportError:
    Groq = None

# Google Gemini SDK (optional)
try:
    import google.genai as genai
except ImportError:
    try:
        import google.generativeai as genai
    except ImportError:
        genai = None

import logging
logger = logging.getLogger(__name__)

from django.conf import settings

# --- CONTENT / TOKEN HELPERS ---

def _truncate_content(content: str, max_chars: int) -> str:
    """Keep start and end of large files so AI still sees structure and closing tags."""
    if len(content) <= max_chars:
        return content
    half = max_chars // 2 - 60
    return (
        content[:half]
        + "\n\n...[middle of file truncated for analysis]...\n\n"
        + content[-half:]
    )


def _parse_json_response(response_text: str):
    """Parse AI JSON output, stripping optional markdown fences and locating the outer JSON object."""
    if not response_text:
        raise ValueError("Empty response text")
    
    text = response_text.strip()
    
    # Try parsing directly
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try extracting JSON object substring
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        candidate = text[start:end+1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            # Escape literal newlines inside double-quoted string values
            try:
                fixed_candidate = re.sub(
                    r'("(?:[^"\\]|\\.)*")', 
                    lambda m: m.group(1).replace('\n', '\\n').replace('\r', '\\r'), 
                    candidate
                )
                return json.loads(fixed_candidate)
            except json.JSONDecodeError:
                pass

    # Strip code fences and surrounding text
    cleaned = re.sub(r"```json\n|\n```|```", "", text).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    raise ValueError("Failed to parse JSON response from AI")


# --- GROQ MODEL RESOLVERS ---
GROQ_MODEL = os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile')

def _resolve_groq_model():
    """Return a valid Groq model name by querying the list of available models."""
    if not Groq:
        return GROQ_MODEL
        
    try:
        api_key = getattr(settings, 'GROQ_API_KEY', None)
        if not api_key:
            return GROQ_MODEL
        client = Groq(api_key=api_key)
        available_models = [m.id for m in client.models.list().data]
        
        if GROQ_MODEL in available_models:
            logger.info(f"Using configured Groq model: {GROQ_MODEL}")
            return GROQ_MODEL
            
        # Preferred fallback list
        preferred_fallbacks = [
            'llama-3.3-70b-versatile',
            'openai/gpt-oss-120b',
            'llama-3.1-8b-instant',
            'groq/compound',
        ]
        for fallback in preferred_fallbacks:
            if fallback in available_models:
                logger.warning(f"Configured Groq model not found. Falling back to: {fallback}")
                return fallback
                
        if available_models:
            logger.warning(f"Configured Groq model not found. Falling back to first available: {available_models[0]}")
            return available_models[0]
    except Exception as e:
        logger.error(f"Error querying Groq models: {e}")
        
    return GROQ_MODEL

GROQ_MODEL = _resolve_groq_model()


def _resolve_groq_vision_model():
    """Return a valid Groq vision model name by querying the list of available models."""
    if not Groq:
        return 'meta-llama/llama-4-scout-17b-16e-instruct'
        
    try:
        api_key = getattr(settings, 'GROQ_API_KEY', None)
        if not api_key:
            return 'meta-llama/llama-4-scout-17b-16e-instruct'
        client = Groq(api_key=api_key)
        available_models = [m.id for m in client.models.list().data]
        
        # Preferred vision models in order
        preferred_vision = [
            'meta-llama/llama-4-scout-17b-16e-instruct',
            'llama-3.2-11b-vision-preview',
            'llama-3.2-90b-vision-preview',
        ]
        for model in preferred_vision:
            if model in available_models:
                return model
                
        # Look for any model containing 'vision' or 'scout' in its name
        for model in available_models:
            if 'vision' in model.lower() or 'scout' in model.lower():
                return model
                
    except Exception as e:
        logger.error(f"Error resolving Groq vision model: {e}")
        
    return 'meta-llama/llama-4-scout-17b-16e-instruct'

RESOLVED_GROQ_VISION_MODEL = _resolve_groq_vision_model()


# --- GEMINI MODEL RESOLVERS ---
if genai:
    genai.configure(api_key=settings.GEMINI_API_KEY)

MODEL_NAME = os.getenv('MODEL_NAME', 'gemini-2.5-flash')

def _resolve_gemini_model():
    """Return a valid Gemini model name by querying the list of available models."""
    if not genai:
        return 'gemini-2.5-flash'
        
    try:
        available_models = []
        for m in genai.list_models():
            if "generateContent" in m.supported_generation_methods:
                available_models.append(m.name)
        
        # Check if configured model matches any available model name
        target_names = {MODEL_NAME, f"models/{MODEL_NAME}"}
        for name in available_models:
            if name in target_names:
                logger.info(f"Using configured Gemini model: {name}")
                return name
        
        # Look for preferred fallback models in order
        preferred_fallbacks = [
            'models/gemini-2.5-flash',
            'models/gemini-2.0-flash',
            'models/gemini-1.5-flash',
            'models/gemini-2.5-pro',
            'models/gemini-2.0-pro',
            'models/gemini-1.5-pro',
        ]
        for fallback in preferred_fallbacks:
            if fallback in available_models:
                logger.warning(f"Configured Gemini model '{MODEL_NAME}' not found. Falling back to: {fallback}")
                return fallback
                
        # If no preferred fallback found, use the first model that supports generateContent
        for name in available_models:
            if "gemini-" in name.lower():
                logger.warning(f"Configured Gemini model '{MODEL_NAME}' not found. Falling back to: {name}")
                return name
                
        if available_models:
            logger.warning(f"Configured Gemini model '{MODEL_NAME}' not found. Falling back to first available: {available_models[0]}")
            return available_models[0]
            
    except Exception as e:
        logger.error(f"Error querying Gemini models: {e}")
        
    # If list_models fails or is empty, use the configured name
    logger.warning(f"Failed to query available models. Defaulting to: {MODEL_NAME}")
    return MODEL_NAME

RESOLVED_MODEL_NAME = _resolve_gemini_model()


# --- ANALYSIS IMPLEMENTATIONS ---

def _groq_analysis_text(content: str, name: str):
    """Analyze a text file using Groq if available."""
    if not Groq:
        return {"raw_analysis": f"## Analysis of {name}\n\n*Groq SDK not installed.*", "ui_score": 0, "ux_score": 0}
    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        system_prompt = "You are a senior UI/UX designer and developer reviewer. Analyze the provided project file and provide constructive feedback on its impact on UI/UX, code quality, and suggestions for improvement. Return response exactly in JSON format with keys raw_analysis, ui_score (1-10), ux_score (1-10)."
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"File name: {name}\n\nContent:\n{content}"},
        ]
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.2,
            max_tokens=getattr(settings, 'AI_SUMMARY_MAX_TOKENS', 4096),
            response_format={"type": "json_object"}
        )
        response_text = response.choices[0].message.content
        try:
            result = _parse_json_response(response_text)
        except Exception:
            return {"raw_analysis": response_text, "ui_score": None, "ux_score": None}
        return {
            "raw_analysis": result.get("raw_analysis", ""),
            "ui_score": result.get("ui_score", 0),
            "ux_score": result.get("ux_score", 0),
        }
    except Exception as e:
        return {"raw_analysis": f"Error during Groq analysis of {name}: {str(e)}", "ui_score": None, "ux_score": None}


def _groq_analysis_image(image_path: str):
    """Analyze a design screenshot using Groq's vision model."""
    if not Groq:
        return {"raw_analysis": "Groq SDK not installed.", "ui_score": 0, "ux_score": 0}
        
    try:
        # Base64 encode the image
        with open(image_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            
        ext = image_path.lower().split('.')[-1]
        mime_type = f"image/{ext}" if ext in ("png", "gif") else "image/jpeg"
        
        client = Groq(api_key=settings.GROQ_API_KEY)
        system_prompt = "You are a senior UI/UX designer and frontend reviewer. Analyze the provided image and give constructive feedback on UI/UX, code suggestions, and layout. Return response EXACTLY in JSON format with keys: raw_analysis, ui_score (1-10), ux_score (1-10)."
        
        prompt = """
        You are a highly experienced Senior UI/UX Designer and Frontend Architect.
        I am providing you with a screenshot of a user interface design.

        Please analyze this design critically and provide constructive feedback on:
        1. Visual Design (UI): Layout, colors, typography, spacing, and visual hierarchy.
        2. Usability (UX): Intuitive navigation, clear call-to-actions, accessibility, and user flow.

        Provide your response exactly in the following JSON format so I can parse it cleanly:
        {
            "raw_analysis": "Your detailed markdown-formatted feedback...",
            "ui_score": <number 1-10>,
            "ux_score": <number 1-10>
        }
        Ensure your response is valid JSON and nothing else.
        """
        
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{encoded_string}"
                        }
                    }
                ]
            }
        ]
        
        response = client.chat.completions.create(
            model=RESOLVED_GROQ_VISION_MODEL,
            messages=messages,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        
        response_text = response.choices[0].message.content
        try:
            result = _parse_json_response(response_text)
        except Exception:
            return {"raw_analysis": response_text, "ui_score": None, "ux_score": None}
                
        return {
            "raw_analysis": result.get("raw_analysis", ""),
            "ui_score": result.get("ui_score", 0),
            "ux_score": result.get("ux_score", 0),
        }
        
    except Exception as e:
        logger.error(f"Error during Groq vision analysis: {e}")
        return {"raw_analysis": f"Error during Groq vision analysis: {str(e)}", "ui_score": None, "ux_score": None}


def _gemini_analysis(image_path: str):
    """Real Gemini implementation – assumes `genai` is available."""
    model = genai.GenerativeModel(
        RESOLVED_MODEL_NAME,
        generation_config=genai.GenerationConfig(response_mime_type="application/json"),
    )
    img = Image.open(image_path)
    prompt = """
    You are a highly experienced Senior UI/UX Designer and Frontend Architect.
    I am providing you with a screenshot of a user interface design.

    Please analyze this design critically and provide constructive feedback on:
    1. Visual Design (UI): Layout, colors, typography, spacing, and visual hierarchy.
    2. Usability (UX): Intuitive navigation, clear call‑to‑actions, accessibility, and user flow.

    Provide your response exactly in the following JSON format so I can parse it cleanly:
    {
        "raw_analysis": "Your detailed markdown‑formatted feedback...",
        "ui_score": <number 1‑10>,
        "ux_score": <number 1‑10>
    }
    Ensure your response is valid JSON and nothing else.
    """
    response = model.generate_content([prompt, img])
    response_text = response.text

    try:
        result = _parse_json_response(response_text)
    except Exception:
        # Return raw text if still unparsable
        return {"raw_analysis": response_text, "ui_score": None, "ux_score": None}

    return {
        "raw_analysis": result.get("raw_analysis", "No detailed analysis provided."),
        "ui_score": result.get("ui_score", 0),
        "ux_score": result.get("ux_score", 0),
    }


def analyze_design(image_path: str):
    """Entry point for image/screenshot analysis."""
    provider = getattr(settings, 'AI_PROVIDER', 'groq')
    if provider == 'groq' and Groq:
        return _groq_analysis_image(image_path)
    elif genai:
        try:
            return _gemini_analysis(image_path)
        except Exception as e:
            return {"raw_analysis": f"Error during Gemini AI analysis: {str(e)}", "ui_score": None, "ux_score": None}
    else:
        return {"raw_analysis": "No AI service available.", "ui_score": 0, "ux_score": 0}


def analyze_project_file(file_path: str, file_name: str = None):
    """Analyze a non‑image file using selected AI provider (Gemini or Groq)."""
    name = file_name or os.path.basename(file_path)
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read(200_000)
    except Exception as e:
        return {"raw_analysis": f"Failed to read file {name}: {e}", "ui_score": None, "ux_score": None}

    provider = getattr(settings, 'AI_PROVIDER', 'groq')
    if provider == 'groq' and Groq:
        return _groq_analysis_text(content, name)
    elif provider == 'gemini' and genai:
        prompt = f"""
You are a senior UI/UX designer and developer reviewer.
Analyze the following project file "{name}" and provide constructive feedback on its impact on the UI/UX, code quality, and any suggestions for improvement.
Return your response exactly in the following JSON format (no extra text):
{{
    "raw_analysis": "Your detailed markdown‑formatted feedback...",
    "ui_score": <number 1‑10>,
    "ux_score": <number 1‑10>
}}
Only output valid JSON.
"""
        model = genai.GenerativeModel(
            RESOLVED_MODEL_NAME,
            generation_config=genai.GenerationConfig(response_mime_type="application/json"),
        )
        try:
            response = model.generate_content([prompt, content])
            response_text = response.text
            try:
                result = _parse_json_response(response_text)
            except Exception:
                return {"raw_analysis": response_text, "ui_score": None, "ux_score": None}
            return {
                "raw_analysis": result.get("raw_analysis", "No detailed analysis provided."),
                "ui_score": result.get("ui_score", 0),
                "ux_score": result.get("ux_score", 0),
            }
        except Exception as e:
            return {"raw_analysis": f"Error during Gemini file analysis: {str(e)}", "ui_score": None, "ux_score": None}
    else:
        raw = f"## Analysis of {name}\n\n*No AI service available. Placeholder analysis.*"
        return {"raw_analysis": raw, "ui_score": 0, "ux_score": 0}


def _groq_summarize_project(file_analyses: list):
    """Combine individual file analyses using Groq."""
    if not Groq:
        return {"raw_analysis": "Groq SDK not installed.", "ui_score": 0, "ux_score": 0}
    combined_text = "\n".join(
        f"File: {item.get('file_name')}\n{item['analysis'].get('raw_analysis', '')}"
        for item in file_analyses
    )
    prompt = """
You are a senior UI/UX designer tasked with providing a concise overall feedback for an entire project.
Given the per-file analyses below, produce a single JSON response with:
- A comprehensive UI summary.
- A comprehensive UX summary.
- Overall UI score (1-10) and UX score (1-10).
Return ONLY JSON in this exact format:
{
    "raw_analysis": "Your combined markdown feedback...",
    "ui_score": <number>,
    "ux_score": <number>
}
Do NOT add any extra text.
"""
    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": "You are a senior UI/UX reviewer. Return JSON only."},
                {"role": "user", "content": f"{prompt}\n\nAnalyses:\n{combined_text}"}
            ],
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        response_text = response.choices[0].message.content
        try:
            result = _parse_json_response(response_text)
        except Exception:
            return {"raw_analysis": response_text, "ui_score": None, "ux_score": None}
        return {
            "raw_analysis": result.get("raw_analysis", ""),
            "ui_score": result.get("ui_score", 0),
            "ux_score": result.get("ux_score", 0),
        }
    except Exception as e:
        logger.error(f"Error in Groq summarize_project: {e}")
        return {"raw_analysis": f"Error during Groq project summary: {str(e)}", "ui_score": None, "ux_score": None}


def summarize_project(file_analyses: list):
    """Combine individual file analyses into a single project‑level feedback."""
    provider = getattr(settings, 'AI_PROVIDER', 'groq')
    if provider == 'groq' and Groq:
        return _groq_summarize_project(file_analyses)
    elif genai:
        combined_text = "\n".join(
            f"File: {item.get('file_name')}\n{item['analysis'].get('raw_analysis', '')}"
            for item in file_analyses
        )

        prompt = """
You are a senior UI/UX designer tasked with providing a concise overall feedback for an entire project.
Given the per‑file analyses below, produce a single JSON response with:
- A comprehensive UI summary.
- A comprehensive UX summary.
- Overall UI score (1‑10) and UX score (1‑10).
Return ONLY JSON in this exact format:
{
    "raw_analysis": "Your combined markdown feedback...",
    "ui_score": <number>,
    "ux_score": <number>
}
Do NOT add any extra text.
"""
        model = genai.GenerativeModel(
            RESOLVED_MODEL_NAME,
            generation_config=genai.GenerationConfig(response_mime_type="application/json"),
        )
        try:
            response = model.generate_content([prompt, combined_text])
            response_text = response.text
            try:
                result = _parse_json_response(response_text)
            except Exception:
                return {"raw_analysis": response_text, "ui_score": None, "ux_score": None}
            return {
                "raw_analysis": result.get("raw_analysis", ""),
                "ui_score": result.get("ui_score", 0),
                "ux_score": result.get("ux_score", 0),
            }
        except Exception as e:
            logger.error(f"Error in Gemini summarize_project: {e}")
            
    # Fallback if no AI service succeeds
    raw = "## Project‑wide analysis\n\n"
    for item in file_analyses:
        name = item.get('file_name') or os.path.basename(item.get('file_path', ''))
        raw += f"### {name}\n{item['analysis'].get('raw_analysis', '')}\n\n"
    return {"raw_analysis": raw, "ui_score": 0, "ux_score": 0}


def _safe_parse_bundled_result(result):
    """Safely parses the JSON result from the AI model to prevent any dict/string attribute errors."""
    default_report_details = {
        "detailed_description": "No detailed project description available in this archive.",
        "abstract": "No abstract/summary available.",
        "languages_frameworks": []
    }
    
    if not isinstance(result, dict):
        return {
            "files_analyses": [],
            "project_feedback": {
                "raw_analysis": str(result) if result else "No feedback returned.",
                "ui_score": 0,
                "ux_score": 0,
                "report_details": default_report_details
            }
        }
    
    formatted_analyses = []
    files_analyses = result.get("files_analyses", [])
    if isinstance(files_analyses, list):
        for fa in files_analyses:
            if isinstance(fa, dict):
                formatted_analyses.append({
                    "file_name": fa.get("file_name", "Unknown File"),
                    "analysis": {
                        "raw_analysis": fa.get("raw_analysis", "No detailed analysis provided."),
                        "ui_score": fa.get("ui_score", 0),
                        "ux_score": fa.get("ux_score", 0)
                    }
                })
            else:
                formatted_analyses.append({
                    "file_name": "Unknown File",
                    "analysis": {
                        "raw_analysis": str(fa),
                        "ui_score": 0,
                        "ux_score": 0
                    }
                })

    pf = result.get("project_feedback")
    if isinstance(pf, dict):
        report_details = pf.get("report_details", {})
        if not isinstance(report_details, dict):
            report_details = {}
        
        languages_frameworks = report_details.get("languages_frameworks", [])
        if not isinstance(languages_frameworks, list):
            languages_frameworks = [str(languages_frameworks)] if languages_frameworks else []

        project_feedback = {
            "raw_analysis": pf.get("raw_analysis", "No overall project feedback provided."),
            "ui_score": pf.get("ui_score", 0),
            "ux_score": pf.get("ux_score", 0),
            "report_details": {
                "detailed_description": report_details.get("detailed_description", "No detailed description provided."),
                "abstract": report_details.get("abstract", "No abstract summary provided."),
                "languages_frameworks": languages_frameworks
            }
        }
    elif isinstance(pf, str):
        project_feedback = {
            "raw_analysis": pf,
            "ui_score": 0,
            "ux_score": 0,
            "report_details": default_report_details
        }
    else:
        project_feedback = {
            "raw_analysis": "No overall project feedback provided.",
            "ui_score": 0,
            "ux_score": 0,
            "report_details": default_report_details
        }
        
    return {
        "files_analyses": formatted_analyses,
        "project_feedback": project_feedback
    }


def _groq_chat_json(system_prompt: str, user_content: str, max_tokens: int = None):
    """Send a Groq chat request and return parsed JSON."""
    if not Groq:
        raise RuntimeError("Groq SDK not installed.")
    client = Groq(
        api_key=settings.GROQ_API_KEY,
        timeout=getattr(settings, 'AI_REQUEST_TIMEOUT', 180.0),
    )
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=0.2,
        max_tokens=max_tokens or getattr(settings, 'AI_BUNDLED_MAX_TOKENS', 8192),
        response_format={"type": "json_object"},
    )
    return _parse_json_response(response.choices[0].message.content)


def _gemini_chat_json(prompt: str, user_content: str):
    """Send a Gemini request and return parsed JSON."""
    if not genai:
        raise RuntimeError("Gemini SDK not installed.")
    model = genai.GenerativeModel(
        RESOLVED_MODEL_NAME,
        generation_config=genai.GenerationConfig(response_mime_type="application/json"),
    )
    response = model.generate_content([prompt, user_content])
    return _parse_json_response(response.text)


def _analyze_batch_files_only(files_list: list):
    """Analyze a batch of files and return per-file analyses (no project summary)."""
    prompt = """
You are a senior UI/UX designer and frontend reviewer.
Analyze each provided project file for UI/UX impact, visual presentation, and front-end quality.
Return ONLY valid JSON in this exact format:
{
    "files_analyses": [
        {
            "file_name": "exact file name as provided",
            "raw_analysis": "markdown feedback for this file",
            "ui_score": <number 1-10>,
            "ux_score": <number 1-10>
        }
    ]
}
"""
    bundled_content = ""
    for item in files_list:
        bundled_content += f"=== FILE: {item['file_name']} ===\n{item['content']}\n\n"

    provider = getattr(settings, 'AI_PROVIDER', 'groq')
    try:
        if provider == 'groq' and Groq:
            result = _groq_chat_json(prompt, bundled_content)
        elif genai:
            result = _gemini_chat_json(prompt, bundled_content)
        else:
            raise RuntimeError("No AI service available.")

        formatted = []
        for fa in result.get("files_analyses", []):
            if isinstance(fa, dict):
                formatted.append({
                    "file_name": fa.get("file_name", "Unknown File"),
                    "analysis": {
                        "raw_analysis": fa.get("raw_analysis", "No analysis provided."),
                        "ui_score": fa.get("ui_score", 0),
                        "ux_score": fa.get("ux_score", 0),
                    },
                })
        return formatted
    except Exception as e:
        logger.error(f"Batch file analysis failed: {e}")
        return [
            {
                "file_name": item.get("file_name", "Unknown"),
                "analysis": {
                    "raw_analysis": f"Batch analysis error: {e}",
                    "ui_score": 0,
                    "ux_score": 0,
                },
            }
            for item in files_list
        ]


def _generate_project_summary_from_analyses(file_analyses: list, file_manifest: list):
    """Build overall project feedback from per-file analyses."""
    default_report_details = {
        "detailed_description": "No detailed project description available in this archive.",
        "abstract": "No abstract/summary available.",
        "languages_frameworks": [],
    }
    if not file_analyses:
        return {
            "raw_analysis": "No files were analyzed.",
            "ui_score": 0,
            "ux_score": 0,
            "report_details": default_report_details,
        }

    manifest = ", ".join(item.get("file_name", "") for item in file_manifest[:30])
    if len(file_manifest) > 30:
        manifest += f", ... (+{len(file_manifest) - 30} more files)"

    condensed = []
    for item in file_analyses:
        name = item.get("file_name", "Unknown")
        analysis = item.get("analysis", {})
        raw = analysis.get("raw_analysis", "")
        if len(raw) > 1500:
            raw = raw[:1500] + "..."
        condensed.append(
            f"File: {name}\nUI: {analysis.get('ui_score', 0)}/10, UX: {analysis.get('ux_score', 0)}/10\n{raw}"
        )
    combined_text = "\n\n---\n\n".join(condensed)

    prompt = f"""
You are a senior UI/UX architect reviewing an entire project.
Based on the per-file analyses below, produce a single JSON response with:
- Comprehensive overall UI/UX feedback (markdown) for a dashboard
- Overall UI and UX scores (1-10)
- A professional technical report for a downloadable PDF

Project contained {len(file_manifest)} analyzed files including: {manifest}

Return ONLY valid JSON:
{{
    "raw_analysis": "Overall UI/UX feedback in markdown...",
    "ui_score": <number 1-10>,
    "ux_score": <number 1-10>,
    "report_details": {{
        "detailed_description": "Technical project description, architecture, components...",
        "abstract": "Executive summary of goals and structure...",
        "languages_frameworks": ["React", "HTML5", "etc."]
    }}
}}
"""
    provider = getattr(settings, 'AI_PROVIDER', 'groq')
    try:
        if provider == 'groq' and Groq:
            result = _groq_chat_json(
                prompt,
                f"Per-file analyses:\n\n{combined_text}",
                max_tokens=getattr(settings, 'AI_SUMMARY_MAX_TOKENS', 4096),
            )
        elif genai:
            result = _gemini_chat_json(prompt, f"Per-file analyses:\n\n{combined_text}")
        else:
            raise RuntimeError("No AI service available.")

        report_details = result.get("report_details", {})
        if not isinstance(report_details, dict):
            report_details = {}

        languages = report_details.get("languages_frameworks", [])
        if not isinstance(languages, list):
            languages = [str(languages)] if languages else []

        return {
            "raw_analysis": result.get("raw_analysis", "No overall feedback provided."),
            "ui_score": result.get("ui_score", 0),
            "ux_score": result.get("ux_score", 0),
            "report_details": {
                "detailed_description": report_details.get(
                    "detailed_description", default_report_details["detailed_description"]
                ),
                "abstract": report_details.get("abstract", default_report_details["abstract"]),
                "languages_frameworks": languages,
            },
        }
    except Exception as e:
        logger.error(f"Project summary generation failed: {e}")
        return summarize_project(file_analyses)


def _emit_progress(on_progress, payload: dict):
    if on_progress:
        on_progress(payload)


def analyze_project_files_batched(files_list: list, on_progress=None):
    """
    Analyze large projects in batches, then synthesize a single project-level report.
    Small archives still use a single bundled API call for speed.
    """
    if not files_list:
        return analyze_project_files_bundled(files_list, on_progress=on_progress)

    total_chars = sum(len(item.get("content", "")) for item in files_list)
    single_call_max_files = getattr(settings, 'ZIP_SINGLE_CALL_MAX_FILES', 20)
    single_call_max_chars = getattr(settings, 'ZIP_SINGLE_CALL_MAX_CHARS', 200000)

    if len(files_list) <= single_call_max_files and total_chars <= single_call_max_chars:
        return analyze_project_files_bundled(files_list, on_progress=on_progress)

    batch_size = getattr(settings, 'ZIP_BATCH_SIZE', 10)
    batches = [files_list[i:i + batch_size] for i in range(0, len(files_list), batch_size)]
    total_batches = len(batches)
    all_analyses = []

    for batch_index, batch in enumerate(batches, start=1):
        _emit_progress(on_progress, {
            "stage": "analyzing",
            "current_batch": batch_index,
            "total_batches": total_batches,
            "message": f"Analyzing batch {batch_index} of {total_batches}",
            "percent": min(88, 10 + int((batch_index / (total_batches + 1)) * 78)),
            "files_selected": len(files_list),
        })
        all_analyses.extend(_analyze_batch_files_only(batch))

    _emit_progress(on_progress, {
        "stage": "summarizing",
        "current_batch": total_batches,
        "total_batches": total_batches,
        "message": "Generating overall project summary...",
        "percent": 92,
        "files_selected": len(files_list),
    })
    project_feedback = _generate_project_summary_from_analyses(all_analyses, files_list)
    _emit_progress(on_progress, {
        "stage": "complete",
        "current_batch": total_batches,
        "total_batches": total_batches,
        "message": "Analysis complete",
        "percent": 100,
        "files_selected": len(files_list),
    })
    return {
        "files_analyses": all_analyses,
        "project_feedback": project_feedback,
    }


def analyze_project_files_bundled(files_list: list, on_progress=None):
    """Analyze multiple project files using selected AI provider (Gemini or Groq) in a single API call."""
    default_report_details = {
        "detailed_description": "No detailed project description available in this archive.",
        "abstract": "No abstract/summary available.",
        "languages_frameworks": []
    }
    if not files_list:
        return {
            "files_analyses": [],
            "project_feedback": {
                "raw_analysis": "No files found to analyze.",
                "ui_score": 0,
                "ux_score": 0,
                "report_details": default_report_details
            }
        }

    _emit_progress(on_progress, {
        "stage": "analyzing",
        "current_batch": 1,
        "total_batches": 1,
        "message": "Analyzing all project files...",
        "percent": 40,
        "files_selected": len(files_list),
    })

    prompt = """
You are a highly experienced Senior UI/UX Designer and Frontend Architect Reviewer.
I am providing you with multiple code/text files from a project archive.
Please analyze each file's impact on UI/UX, visual presentation, and front-end code quality.
Additionally, provide:
1. A single combined, comprehensive project-wide feedback summarizing the overall UI/UX quality (for the UI page).
2. A separate, professional technical project report (for the downloadable PDF report) detailing the project description, abstract, and languages/frameworks used.

You MUST respond exactly in the following JSON format:
{
    "files_analyses": [
        {
            "file_name": "Name of the file exactly as provided",
            "raw_analysis": "Your detailed markdown-formatted feedback for this specific file...",
            "ui_score": <number 1-10>,
            "ux_score": <number 1-10>
        }
    ],
    "project_feedback": {
        "raw_analysis": "Your overall UI/UX feedback in markdown format for the dashboard UI...",
        "ui_score": <number 1-10>,
        "ux_score": <number 1-10>,
        "report_details": {
            "detailed_description": "A comprehensive, technical description of the project, architecture, components, and design system...",
            "abstract": "An executive summary/abstract of the project, detailing the project goals and high-level structure...",
            "languages_frameworks": [
                "List of programming languages, libraries, and frameworks detected (e.g. React, HTML5, CSS3, JavaScript, etc.)"
            ]
        }
    }
}
Ensure your response is valid JSON and nothing else.
"""

    provider = getattr(settings, 'AI_PROVIDER', 'groq')
    if provider == 'groq' and Groq:
        bundled_content = ""
        for item in files_list:
            bundled_content += f"=== FILE: {item['file_name']} ===\n{item['content']}\n\n"
        try:
            result = _groq_chat_json(prompt, bundled_content)
            parsed = _safe_parse_bundled_result(result)
            _emit_progress(on_progress, {
                "stage": "complete",
                "current_batch": 1,
                "total_batches": 1,
                "message": "Analysis complete",
                "percent": 100,
                "files_selected": len(files_list),
            })
            return parsed
        except Exception as e:
            return {
                "files_analyses": [],
                "project_feedback": {
                    "raw_analysis": f"Error during Groq bundled analysis: {str(e)}",
                    "ui_score": 0,
                    "ux_score": 0,
                    "report_details": default_report_details
                }
            }
            
    bundled_content = ""
    for item in files_list:
        bundled_content += f"=== FILE: {item['file_name']} ===\n{item['content']}\n\n"
    try:
        model = genai.GenerativeModel(
            RESOLVED_MODEL_NAME,
            generation_config=genai.GenerationConfig(response_mime_type="application/json"),
        )
        response = model.generate_content([prompt, bundled_content])
        response_text = response.text
        try:
            result = _parse_json_response(response_text)
        except Exception:
            return {
                "files_analyses": [],
                "project_feedback": {
                    "raw_analysis": response_text,
                    "ui_score": 0,
                    "ux_score": 0,
                    "report_details": default_report_details
                }
            }
        
        parsed = _safe_parse_bundled_result(result)
        _emit_progress(on_progress, {
            "stage": "complete",
            "current_batch": 1,
            "total_batches": 1,
            "message": "Analysis complete",
            "percent": 100,
            "files_selected": len(files_list),
        })
        return parsed
    except Exception as e:
        return {
            "files_analyses": [],
            "project_feedback": {
                "raw_analysis": f"Error during bundled AI analysis: {str(e)}",
                "ui_score": 0,
                "ux_score": 0,
                "report_details": default_report_details
            }
        }
