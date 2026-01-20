
import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, GroundingSource } from "../types";

export const analyzeJobMatch = async (resume: string, jobDescription: string, jobUrl?: string): Promise<AnalysisResult> => {
  try {
    // Always create a new instance inside the call to ensure the latest API key is used
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("API key is not configured. Please set GEMINI_API_KEY environment variable.");
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

    // Get the generative model
    const model = ai.getGenerativeModel({ 
      model: modelName,
      systemInstruction: `You are an elite PM Career Coach and Hiring Manager.
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
      }`,
      tools: jobUrl ? [{ googleSearch: {} }] : undefined
    });

    // Generate content
    const result = await model.generateContent(prompt);
    
    // Extract text from response - handle different response structures
    let text = '';
    let response: any = result;
    
    // Try different ways to access the response
    if (result.response) {
      response = result.response;
    } else if (result.candidates) {
      response = result;
    }
    
    // Extract text - try multiple methods
    if (typeof response.text === 'function') {
      text = response.text();
    } else if (typeof response.text === 'string') {
      text = response.text;
    } else if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts) {
        text = candidate.content.parts
          .map((part: any) => part.text || '')
          .join('');
      } else if (candidate.text) {
        text = typeof candidate.text === 'function' ? candidate.text() : candidate.text;
      }
    } else if (result.text) {
      text = typeof result.text === 'function' ? result.text() : result.text;
    }
    
    if (!text || text.trim().length === 0) {
      console.error("Response structure:", JSON.stringify(response, null, 2).substring(0, 1000));
      throw new Error("Empty response from AI model. Check API key and model availability.");
    }
    
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