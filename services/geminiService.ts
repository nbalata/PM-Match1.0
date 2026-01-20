
import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, GroundingSource } from "../types";

export const analyzeJobMatch = async (resume: string, jobDescription: string, jobUrl?: string): Promise<AnalysisResult> => {
  // Always create a new instance inside the call to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const model = "gemini-3-pro-preview";
  
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

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
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
        "sampleEmail": "A professional outreach email to a Hiring Manager. The email MUST include a section exactly titled 'Why I’m a Strong Fit' followed by 3 bulleted points using the '•' character. CRITICAL: Do NOT use markdown bolding (like **bold**) anywhere in the email. Bullets should be plain text like '• Skill Title: Description'. Keep the total email professional and under 160 words."
      }`,
      tools: [{ googleSearch: {} }]
    }
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from AI");
  
  // Robust JSON extraction
  let jsonStr = text;
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/{[\s\S]*}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1] || jsonMatch[0];
  }

  try {
    const result = JSON.parse(jsonStr) as AnalysisResult;

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      const sources: GroundingSource[] = groundingChunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          title: chunk.web.title || "External Source",
          uri: chunk.web.uri
        }));
      if (sources.length > 0) {
        result.groundingSources = sources;
      }
    }
    
    return result;
  } catch (e) {
    console.error("Failed to parse AI response as JSON:", text);
    throw new Error("The AI returned an invalid format. Please try again.");
  }
};