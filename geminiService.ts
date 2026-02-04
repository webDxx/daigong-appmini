
import { GoogleGenAI, Type } from "@google/genai";

// 务必使用 gemini-3-flash-preview 以保证识别速度和准确性
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToPart = async (file: File) => {
  return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const parseMultimodalChat = async (files: File[], chatText: string) => {
  try {
    const parts: any[] = [{ text: `你是一个生产助手。请从微信聊天内容中提取订单信息。
      必须包含: quantity(数量, 整数)。
      可选包含: unit_price(单价, 数字), expected_delivery(交货日期, YYYY-MM-DD), worker_name(工人名字), remarks(备注)。
      如果是多张图或长文字，请综合判断。返回 JSON。` }];
    
    if (chatText) parts.push({ text: `聊天文本: ${chatText}` });
    
    for (const file of files) {
      const part = await fileToPart(file);
      parts.push(part);
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            quantity: { type: Type.INTEGER },
            unit_price: { type: Type.NUMBER },
            expected_delivery: { type: Type.STRING },
            worker_name: { type: Type.STRING },
            remarks: { type: Type.STRING }
          },
          required: ["quantity"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI 识别订单失败:", error);
    return null;
  }
};

export const parseMultimodalTransfer = async (files: File[], transferText: string) => {
  try {
    const parts: any[] = [{ text: `提取微信/支付宝转账信息。
      必须包含: amount(金额, 数字)。
      可选包含: receiver_name(收款人名字), date(日期), remark(备注)。返回 JSON。` }];
    
    if (transferText) parts.push({ text: `补充文本: ${transferText}` });
    
    for (const file of files) {
      const part = await fileToPart(file);
      parts.push(part);
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            receiver_name: { type: Type.STRING },
            date: { type: Type.STRING },
            remark: { type: Type.STRING }
          },
          required: ["amount"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI 识别转账失败:", error);
    return null;
  }
};
