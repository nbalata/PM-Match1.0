
import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, GroundingSource } from "../types";

export const analyzeJobMatch = async (resume: string, jobDescription: string, jobUrl?: string): Promise<AnalysisResult> => {
  try {
    // Always create a new instance inside the call to ensure the latest API key is used
    // Check multiple possible env var names (Vite injects process.env at build time)
    const apiKey = (process.env as any).API_KEY || (process.env as any).GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error("API Key check failed. process.env contents:", {
        hasAPI_KEY: !!(process.env as any).API_KEY,
        hasGEMINI_API_KEY: !!(process.env as any).GEMINI_API_KEY,
      });
      throw new Error("API key is not configured. Please set GEMINI_API_KEY environment variable in Vercel project settings and redeploy.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelName = "gemini-2.0-flash-exp";
  
  let prompt = `
    Analyze this Product Manager application and return the analysis in a strictly formatted JSON block.
    
    RESUME/EXPERIENCE DATA:
    ${resume}
    
    JOB DESCRIPTION DATA:
    ${jobDescription || "Text not provided; refer to URL below."}
  `;

  if (jobUrl) {
    prompt += `\n\nCRITICAL: A direct Job URL was provided: ${jobUrl}. 
    Use the Google Search tool to:
    1. Specifically identify the hiring company name (e.g., "PagerDuty", "Stripe", "CrowdStrike") from this URL.
    2. Confirm the specific role requirements if the JD text is missing.
    3. Research the company's current product strategy, culture, and recent news.`;
  }

    const systemInstruction = `You are an elite PM Career Coach and Hiring Manager.
      Analyze the match between a candidate's resume and a job description.
      
      CORE REQUIREMENT:
      Identify the official "Company Name" exactly. If a URL is provided, use Google Search to find the official brand name. 
      Use the clean brand name (e.g. "PagerDuty" instead of "pagerduty.com").
      
      OUTPUT FORMAT:
      You MUST return a JSON object. Do not add any text before or after the JSON.
      The JSON must follow this structure:
      {
        "companyName": "String",
        "score": number (0-100),
        "missingSkills": ["String", ...],
        "strengths": ["String", ...],
        "quickTake": ["Exactly 3 high-impact bullets summarizing the fit"],
        "pitchHighlights": ["Exactly 3 ultra-concise bullets explaining the match"],
        "sampleEmail": "A professional outreach email to a Hiring Manager. The email MUST include a section exactly titled 'Why I'm a Strong Fit' followed by 3 bulleted points using the '•' character. CRITICAL: Do NOT use markdown bolding (like **bold**) anywhere in the email. Bullets should be plain text like '• Skill Title: Description'. Keep the total email professional and under 160 words."
      }`;

    // Use the original API structure: ai.models.generateContent()
    let result: any;
    try {
      if (!ai.models || typeof ai.models.generateContent !== 'function') {
        throw new Error("API structure not supported. ai.models.generateContent is not available.");
      }
      
      result = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction,
          tools: jobUrl ? [{ googleSearch: {} }] : undefined
        }
      });
    } catch (apiError: any) {
      console.error("API call error:", apiError);
      console.error("API error details:", {
        message: apiError.message,
        code: apiError.code,
        status: apiError.status,
        stack: apiError.stack
      });
      throw new Error(`API call failed: ${apiError.message || apiError.toString()}`);
    }
    
    // Extract text from response - handle different response structures
    let text = '';
    let response: any = result;
    
    console.log("Raw API response structure:", {
      hasResponse: !!result.response,
      hasText: !!result.text,
      hasCandidates: !!result.candidates,
      keys: Object.keys(result)
    });
    
    // Try different ways to access the response
    if (result.response) {
      response = result.response;
    } else if (result.candidates) {
      response = result;
    }
    
    // Extract text - try multiple methods in order of likelihood
    // Method 1: Direct text property (function or string)
    if (result.text !== undefined) {
      text = typeof result.text === 'function' ? result.text() : result.text;
    }
    // Method 2: Response.text property
    else if (response.text !== undefined) {
      text = typeof response.text === 'function' ? response.text() : response.text;
    }
    // Method 3: From candidates array
    else if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts) {
        text = candidate.content.parts
          .map((part: any) => part.text || '')
          .join('');
      } else if (candidate.text !== undefined) {
        text = typeof candidate.text === 'function' ? candidate.text() : candidate.text;
      }
    }
    // Method 4: Try result.response.text if it exists
    else if (result.response && result.response.text !== undefined) {
      text = typeof result.response.text === 'function' ? result.response.text() : result.response.text;
    }
    
    if (!text || text.trim().length === 0) {
      console.error("Failed to extract text. Response structure:", JSON.stringify(result, null, 2).substring(0, 2000));
      throw new Error("Empty response from AI model. Response structure doesn't match expected format. Check API key and model availability.");
    }
    
    console.log("Extracted text length:", text.length);
    console.log("Extracted text preview:", text.substring(0, 500));
  
  // Robust JSON extraction
    let jsonStr = text.trim();
    
    // Try to extract JSON from markdown code blocks
    const jsonBlockMatch = jsonStr.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1].trim();
    } else {
      // Try to find JSON object in the text
      const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        jsonStr = jsonObjectMatch[0];
      }
    }

    // Parse JSON
    let parsedResult: AnalysisResult;
    try {
      parsedResult = JSON.parse(jsonStr) as AnalysisResult;
    } catch (parseError: any) {
      console.error("JSON Parse Error:", parseError.message);
      console.error("Attempted to parse:", jsonStr.substring(0, 1000));
      throw new Error(`Failed to parse JSON response: ${parseError.message}. Response preview: ${jsonStr.substring(0, 200)}...`);
    }

    // Validate required fields
    const requiredFields = ['companyName', 'score', 'missingSkills', 'strengths', 'quickTake', 'pitchHighlights', 'sampleEmail'];
    const missingFields = requiredFields.filter(field => !(field in parsedResult));
    if (missingFields.length > 0) {
      throw new Error(`Response missing required fields: ${missingFields.join(', ')}`);
    }

    // Extract grounding sources if available
    const candidates = response.candidates || result.candidates || result.response?.candidates;
    if (candidates && candidates[0]?.groundingMetadata?.groundingChunks) {
      const groundingChunks = candidates[0].groundingMetadata.groundingChunks;
      const sources: GroundingSource[] = groundingChunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          title: chunk.web.title || "External Source",
          uri: chunk.web.uri
        }));
      if (sources.length > 0) {
        parsedResult.groundingSources = sources;
      }
    }
    
    return parsedResult;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // Provide more specific error messages
    if (error.message?.includes("API key")) {
      throw new Error("API key is not configured. Please set GEMINI_API_KEY environment variable.");
    }
    if (error.message?.includes("quota") || error.message?.includes("429")) {
      throw new Error("API quota exceeded. Please try again later.");
    }
    if (error.message?.includes("timeout") || error.message?.includes("504")) {
      throw new Error("Request timed out. The analysis is taking too long. Please try again.");
    }
    
    // Re-throw with original message if it's already descriptive
    throw error;
  }
};