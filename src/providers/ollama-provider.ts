import * as vscode from "vscode";
import { BaseWebViewProvider } from "./base-web-view-provider";
import { COMMON, GROQ_CONFIG } from "../constant";
import { MemoryCache } from "../services/memory";
import ollama from 'ollama';

type Role = "user" | "system";
export interface IHistory {
  role: Role;
  content: string;
}

export class OllamaWebViewProvider extends BaseWebViewProvider {
  chatHistory: IHistory[] = [];
  constructor(
    extensionUri: vscode.Uri,
    apiKey: string,
    generativeAiModel: string,
    context: vscode.ExtensionContext,
  ) {
    super(extensionUri, apiKey, generativeAiModel, context);
  }

  public async sendResponse(
    response: string,
    currentChat: string,
  ): Promise<boolean | undefined> {
    try {
      const type = currentChat === "bot" ? "bot-response" : "user-input";
      if (currentChat === "bot") {
        this.chatHistory.push({
          role: "system",
          content: response,
        });
      } else {
        this.chatHistory.push({
          role: "user",
          content: response,
        });
      }
      if (this.chatHistory.length === 2) {
        const chatHistory = MemoryCache.has(COMMON.OLLAMA_CHAT_HISTORY)
          ? MemoryCache.get(COMMON.OLLAMA_CHAT_HISTORY)
          : [];
        MemoryCache.set(COMMON.OLLAMA_CHAT_HISTORY, [
          ...chatHistory,
          ...this.chatHistory,
        ]);
      }

      return await this.currentWebView?.webview.postMessage({
        type,
        message: response,
      });
    } catch (error) {
      console.error(error);
    }
  }

  async generateResponse(message: string): Promise<string | undefined> {
    try {

      let chatHistory = MemoryCache.has(COMMON.OLLAMA_CHAT_HISTORY)
        ? MemoryCache.get(COMMON.OLLAMA_CHAT_HISTORY)
        : [];

      if (chatHistory?.length) {
        chatHistory = [...chatHistory, { role: "user", content: message }];
      }

      if (!chatHistory?.length) {
        chatHistory = [{ role: "user", content: message }];
      }

      if (chatHistory?.length > 3) {
        chatHistory = chatHistory.slice(-3);
      }

      const response = await ollama.chat({model: 'llama3.2',
      messages: [{ role: 'user', content: message}]})
      return Promise.resolve(response.message.content);
    } catch (error) {
      console.error(error);
      MemoryCache.set(COMMON.OLLAMA_CHAT_HISTORY, []);
      vscode.window.showErrorMessage(
        "Model not responding, please resend your question",
      );
      return;
    }
  }
}
