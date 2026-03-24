import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface NewsItem {
  title: string;
  summary: string;
  category: string;
  prelimsPoints: string[];
  mainsPoints: string[];
  tags: string[];
  date: string;
  source: string;
  mcqs: {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  }[];
}

export async function fetchDailyNews(): Promise<NewsItem[]> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Fetch and summarize the most important current affairs for UPSC, SSC, and other government exams for today (${new Date().toLocaleDateString()}).
    Sources to consider: PIB, The Hindu, Indian Express, PRS, Down To Earth.
    
    INCLUDE ONLY:
    - Government schemes, policies, and initiatives
    - Supreme Court and constitutional developments
    - Environment & Ecology (National Parks, Ramsar Sites, Climate Change, Biodiversity)
    - Economy (reports, indices, RBI updates, budget-related news)
    - International Relations (treaties, global events, organizations)
    - Science & Technology (ISRO, AI, space missions, innovations)
    - Important sports events (awards, rankings, major tournaments)
    - Committees, reports, rankings, and indices
    - Editorials with analytical value for UPSC Mains

    EXCLUDE:
    - Entertainment or celebrity news
    - Local crime or irrelevant regional news
    - Political speeches without analytical importance
    - Viral or social media trends

    For each news item, provide:
    1. Title
    2. Short summary (exam-oriented)
    3. 3-5 Key Points for Prelims
    4. 2-3 Key Points for Mains (analytical)
    5. Tags (GS Paper classification like GS1, GS2, GS3)
    6. Category (Important Editorials, Environment, Economy, International Relations, Science & Technology, Sports)
    7. 2 MCQs (Prelims level) with 4 options, correct answer, and short explanation.

    Return the data as a JSON array of objects.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            category: { type: Type.STRING },
            prelimsPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            mainsPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            date: { type: Type.STRING },
            source: { type: Type.STRING },
            mcqs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                }
              }
            }
          },
          required: ["title", "summary", "category", "mcqs"]
        }
      }
    }
  });

  try {
    const news = JSON.parse(response.text || "[]");
    return news.map((item: any) => ({
      ...item,
      date: item.date || new Date().toISOString(),
      source: item.source || "Multiple Sources"
    }));
  } catch (error) {
    console.error("Error parsing Gemini response:", error);
    return [];
  }
}
