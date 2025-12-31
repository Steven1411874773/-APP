import { GoogleGenAI, Type, Schema } from "@google/genai";
import { FrameData, AnalysisResult } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("环境变量中未找到 API Key");
  }
  return new GoogleGenAI({ apiKey });
};

// Define the Chinese schema
const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "基于视频内容生成的吸引人的中文标题，适合小红书或Vlog风格。",
    },
    summary: {
      type: Type.STRING,
      description: "2-3句话的中文总结，概括视频的整体氛围和核心亮点。",
    },
    vibe: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5个关键词标签，描述视频风格（如：#探店 #街头美食 #治愈）。"
    },
    timeline: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          timestamp: { type: Type.STRING, description: "时间戳格式 MM:SS" },
          content: { type: Type.STRING, description: "这一帧画面的详细中文描述，包括人物动作或场景细节。" },
          location: { type: Type.STRING, description: "识别到的具体店铺名称或地标。如果画面中有招牌，必须提取招牌上的文字作为店名。" },
          foodItems: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "极其详细地列出画面中出现的所有美食/饮料名称。不要遗漏桌子角落的食物。" 
          },
          bestFrameIndex: { 
            type: Type.INTEGER, 
            description: "数组中与此事件最匹配的那一张截图的索引（0-based index）。" 
          },
          highlightType: {
            type: Type.STRING,
            enum: ['food', 'scenery', 'transport', 'other'],
            description: "该片段的主要类型。"
          }
        },
        required: ["timestamp", "content", "bestFrameIndex", "highlightType"]
      }
    }
  },
  required: ["title", "timeline", "summary", "vibe"]
};

export const analyzeVideoFrames = async (frames: FrameData[]): Promise<AnalysisResult> => {
  const ai = getClient();
  
  const contentParts = [];
  
  contentParts.push({
    text: `你是一位拥有显微镜般观察力的顶级美食侦探和旅游编辑。
    
    你的任务是将这组视频帧拆解成一份极其详尽的旅游攻略。
    
    请遵循以下核心原则：
    1. **极度细节（Deep Detail）**：不要放过任何一帧。注意桌上的每一道菜，墙上的每一张菜单，甚至路边一闪而过的小吃摊。
    2. **精准店名**：尽全力识别招牌（Signboard）上的文字。如果文字模糊，请结合上下文推断最可能的店名。
    3. **美食优先**：如果画面中有食物，必须列出具体菜名（例如：不要只写"面条"，要写"重庆小面"或"海鲜意面"）。
    4. **路线逻辑**：试图理清拍摄者的行走路线。
    
    请使用 Thinking (推理) 模式来仔细辨认模糊的文字和食物细节。
    输出必须是严格的 JSON 格式。`
  });

  // Attach images
  frames.forEach((frame) => {
    contentParts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: frame.base64
      }
    });
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: {
        parts: contentParts
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        // Use thinking to improve detail extraction from images
        thinkingConfig: { thinkingBudget: 2048 }, 
        temperature: 0.2, 
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI 未返回结果");
    
    const result = JSON.parse(text) as AnalysisResult;
    
    // Correction: Ensure bestFrameIndex is within bounds and map local timestamp if needed
    const processedTimeline = result.timeline.map(item => {
        let safeIndex = Math.min(Math.max(0, item.bestFrameIndex), frames.length - 1);
        const realTime = frames[safeIndex].timeOffset;
        
        return {
            ...item,
            bestFrameIndex: safeIndex,
            timeOffset: realTime
        };
    });

    return {
        ...result,
        timeline: processedTimeline
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
