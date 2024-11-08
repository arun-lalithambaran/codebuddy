/* eslint-disable @typescript-eslint/no-unused-vars */
import Anthropic from "@anthropic-ai/sdk";
import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import * as vscode from "vscode";
import { APP_CONFIG, COMMON, generativeAiModel } from "../constant";
import { AnthropicWebViewProvider } from "../providers/anthropic-web-view-provider";
import { GeminiWebViewProvider } from "../providers/gemini-web-view-provider";
import {
  GroqWebViewProvider,
  IHistory,
} from "../providers/groq-web-view-provider";
import {
  getConfigValue,
  getLatestChatHistory,
  vscodeErrorMessage,
} from "../utils";
import { MemoryCache } from "../services/memory";
import { OllamaWebViewProvider } from "../providers/ollama-provider";
import { Ollama } from 'ollama';
interface IEventGenerator {
  getApplicationConfig(configKey: string): string | undefined;
  showInformationMessage(): Thenable<string | undefined>;
  getSelectedWindowArea(): string | undefined;
}

export abstract class EventGenerator implements IEventGenerator {
  context: vscode.ExtensionContext;
  protected error?: string;
  private readonly generativeAi: string;
  private readonly geminiApiKey: string;
  private readonly geminiModel: string;
  private readonly grokApiKey: string;
  private readonly grokModel: string;
  private readonly ollamaApiKey: string;
  private readonly ollamaModel: string;
  private readonly anthropicModel: string;
  private readonly anthropicApiKey: string;
  // Todo Need to refactor. Only one instance of a model can be created at a time. Therefore no need to retrieve all model information, only retrieve the required model within the application
  constructor(
    private readonly action: string,
    _context: vscode.ExtensionContext,
    errorMessage?: string,
  ) {
    this.context = _context;
    this.error = errorMessage;
    const {
      generativeAi,
      geminiKey,
      geminiModel,
      groqKey,
      groqModel,
      ollamaKey,
      ollamaModel,
      anthropicModel,
      anthropicApiKey,
    } = APP_CONFIG;
    this.generativeAi = getConfigValue(generativeAi);
    this.geminiApiKey = getConfigValue(geminiKey);
    this.geminiModel = getConfigValue(geminiModel);
    this.grokApiKey = getConfigValue(groqKey);
    this.grokModel = getConfigValue(groqModel);
    this.ollamaApiKey = getConfigValue(ollamaKey);
    this.ollamaModel = getConfigValue(ollamaModel);
    this.anthropicModel = getConfigValue(anthropicModel);
    this.anthropicApiKey = getConfigValue(anthropicApiKey);
  }

  getApplicationConfig(configKey: string): string | undefined {
    return getConfigValue(configKey);
  }

  protected createModel():
    | { generativeAi: string; model: any; modelName: string }
    | undefined {
    try {
      let model;
      let modelName = "";
      if (!this.generativeAi) {
        vscodeErrorMessage(
          "Configuration not found. Go to settings, search for Your coding buddy. Fill up the model and model name",
        );
      }
      if (this.generativeAi === generativeAiModel.GROQ) {
        const apiKey = this.grokApiKey;
        modelName = this.grokModel;
        if (!apiKey || !modelName) {
          vscodeErrorMessage(
            "Configuration not found. Go to settings, search for Your coding buddy. Fill up the model and model name",
          );
        }
        model = this.createGroqModel(apiKey);
      }

      if (this.generativeAi === generativeAiModel.OLLAMA) {
        const apiKey = this.ollamaApiKey;
        modelName = this.ollamaModel;
        if (!apiKey || !modelName) {
          vscodeErrorMessage(
            "Configuration not found. Go to settings, search for Your coding buddy. Fill up the model and model name",
          );
        }
        model = this.createOllamaModel(apiKey);
      }

      if (this.generativeAi === generativeAiModel.GEMINI) {
        const apiKey = this.geminiApiKey;
        modelName = this.geminiModel;
        model = this.createGeminiModel(apiKey, modelName);
      }

      if (this.generativeAi === generativeAiModel.ANTHROPIC) {
        const apiKey: string = this.anthropicApiKey;
        modelName = this.anthropicModel;
        model = this.createAnthropicModel(apiKey);
      }
      return { generativeAi: this.generativeAi, model, modelName };
    } catch (error) {
      console.error("Error creating model:", error);
      vscode.window.showErrorMessage(
        "An error occurred while creating the model. Please try again.",
      );
    }
  }

  showInformationMessage(): Thenable<string | undefined> {
    return vscode.window.showInformationMessage(this.action);
  }

  getSelectedWindowArea(): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage("No active text editor.");
      return;
    }
    const selection: vscode.Selection | undefined = editor.selection;
    const selectedArea: string | undefined = editor.document.getText(selection);
    return selectedArea;
  }

  private createGeminiModel(apiKey: string, name: string): GenerativeModel {
    const genAi = new GoogleGenerativeAI(apiKey);
    const model = genAi.getGenerativeModel({ model: name });
    return model;
  }

  private createAnthropicModel(apiKey: string): Anthropic {
    return new Anthropic({
      apiKey,
    });
  }

  private createGroqModel(apiKey: string): Groq {
    return new Groq({ apiKey });
  }

  private createOllamaModel(apiKey: string): any {
    return new Ollama({ host: 'http://127.0.0.1:11434' });
  }

  protected async generateModelResponse(
    text: string,
  ): Promise<string | Anthropic.Messages.Message | undefined> {
    try {
      const activeModel = this.createModel();
      if (!activeModel) {
        throw new Error("Model not found. Check your settings.");
      }

      const { generativeAi, model, modelName } = activeModel;
      if (!generativeAi || !generativeAiModel) {
        throw new Error("Model not found. Check your settings.");
      }
      let response;
      switch (generativeAi) {
        case "Gemini":
          response = await this.generateGeminiResponse(model, text);
          break;
        case "Anthropic":
          if (modelName) {
            response = await this.anthropicResponse(model, modelName, text);
          }
          break;
        case "Groq":
          if (modelName) {
            response = await this.groqResponse(model, text, modelName);
          }
          break;
        case "Ollama":
          if (modelName) {
            response = await this.ollamaResponse(model, text, modelName);
          }
          break;
        default:
          throw new Error("Unsupported model name.");
      }

      if (!response) {
        throw new Error(
          "Could not generate response. Check your settings, ensure the API keys and Model Name is added properly.",
        );
      }
      if (this.action.includes("chart")) {
        response = this.cleanGraphString(response as string);
      }
      return response;
    } catch (error) {
      console.error("Error generating response:", error);
      vscode.window.showErrorMessage(
        "An error occurred while generating the response. Please try again.",
      );
    }
  }

  cleanGraphString(inputString: string) {
    if (inputString.includes("|>")) {
      return inputString.replace(/\|>/g, "|");
    }
    return inputString;
  }

  async generateGeminiResponse(
    model: any,
    text: string,
  ): Promise<string | undefined> {
    const result = await model.generateContent(text);
    return result ? await result.response.text() : undefined;
  }

  private async anthropicResponse(
    model: Anthropic,
    generativeAiModel: string,
    userPrompt: string,
  ) {
    try {
      const response = await model.messages.create({
        model: generativeAiModel,
        system: "",
        max_tokens: 3024,
        messages: [{ role: "user", content: userPrompt }],
      });
      return response.content[0].text;
    } catch (error) {
      console.error("Error generating response:", error);
      vscode.window.showErrorMessage(
        "An error occurred while generating the response. Please try again.",
      );
      return;
    }
  }

  private async groqResponse(
    model: Groq,
    prompt: string,
    generativeAiModel: string,
  ): Promise<string | undefined> {
    try {
      const chatHistory = MemoryCache.has(COMMON.ANTHROPIC_CHAT_HISTORY)
        ? MemoryCache.get(COMMON.GROQ_CHAT_HISTORY)
        : [];
      const params = {
        messages: [
          ...chatHistory,
          {
            role: "user",
            content: prompt,
          },
        ],
        model: generativeAiModel,
      };

      const completion: Groq.Chat.ChatCompletion =
        await model.chat.completions.create(params);
      return completion.choices[0]?.message?.content ?? undefined;
    } catch (error) {
      console.error("Error generating response:", error);
      vscode.window.showErrorMessage(
        "An error occurred while generating the response. Please try again.",
      );
      return;
    }
  }

  private async ollamaResponse(
    model: Ollama,
    prompt: string,
    generativeAiModel: string,
  ): Promise<string | undefined> {
    try {
      const chatHistory = MemoryCache.has(COMMON.OLLAMA_CHAT_HISTORY)
        ? MemoryCache.get(COMMON.OLLAMA_CHAT_HISTORY)
        : [];
      const params = {
        messages: [
          ...chatHistory,
          {
            role: "user",
            content: prompt,
          },
        ],
        stream: true,
        model: generativeAiModel,
      };
      // return `In the comments, I have tried to be concise while still conveying the intent behind each section of code. The comments describe what a developer would need to know in order to write this code from scratch, without providing unnecessary information that's already apparent from the code itself.;`
      console.log("Prompt initiated");
      const response: any = await model.chat(params as  any);
      console.log("prompt completed");
      // return response.message.content ?? undefined;
      let output = "";
      for await (const part of response) {
        output += part.message.content;
        process.stdout.write(part.message.content);
      }
      return output ?? undefined;
    } catch (error) {
      console.error("Error generating response:", error);
      vscode.window.showErrorMessage(
        "An error occurred while generating the response. Please try again.",
      );
      return;
    }
  }

  abstract formatResponse(comment: string): string;

  abstract createPrompt(text?: string): any;

  async generateResponse(
    errorMessage?: string,
  ): Promise<string | Anthropic.Messages.Message | undefined> {
    this.showInformationMessage();
    let prompt;
    const selectedCode = this.getSelectedWindowArea();
    if (!errorMessage && !selectedCode) {
      vscode.window.showErrorMessage("select a piece of code.");
      return;
    }

    errorMessage
      ? (prompt = await this.createPrompt(errorMessage))
      : (prompt = await this.createPrompt(selectedCode));

    if (!prompt) {
      vscode.window.showErrorMessage("model not reponding, try again later");
      return;
    }

    const response = await this.generateModelResponse(prompt);
    const model = getConfigValue("generativeAi.option");

    if (prompt && response) {
      let chatHistory;
      switch (model) {
        case generativeAiModel.GEMINI:
          chatHistory = getLatestChatHistory(COMMON.GEMINI_CHAT_HISTORY);
          MemoryCache.set(COMMON.GEMINI_CHAT_HISTORY, [
            ...chatHistory,
            {
              role: "user",
              parts: [{ text: prompt }],
            },
            {
              role: "model",
              parts: [{ text: response }],
            },
          ]);
          break;
        case generativeAiModel.GROQ:
          chatHistory = getLatestChatHistory(COMMON.GROQ_CHAT_HISTORY);
          MemoryCache.set(COMMON.GROQ_CHAT_HISTORY, [
            ...chatHistory,
            {
              role: "user",
              content: prompt,
            },
            {
              role: "system",
              content: response,
            },
          ]);
          break;
        case generativeAiModel.OLLAMA:
          chatHistory = getLatestChatHistory(COMMON.OLLAMA_CHAT_HISTORY);
          MemoryCache.set(COMMON.OLLAMA_CHAT_HISTORY, [
            ...chatHistory,
            {
              role: "user",
              content: prompt,
            },
            {
              role: "system",
              content: response,
            },
          ]);
          break;
        case generativeAiModel.ANTHROPIC:
          chatHistory = getLatestChatHistory(COMMON.ANTHROPIC_CHAT_HISTORY);
          MemoryCache.set(COMMON.ANTHROPIC_CHAT_HISTORY, [
            ...chatHistory,
            {
              role: "user",
              content: prompt,
            },
            {
              role: "assistant",
              content: response,
            },
          ]);
          break;
        default:
          break;
      }
    }
    return response;
  }

  async execute(errorMessage?: string): Promise<void> {
    const response = (await this.generateResponse(errorMessage)) as string;
    if (!response) {
      vscode.window.showErrorMessage("model not reponding, try again later");
      return;
    }
    const formattedResponse = this.formatResponse(response);
    if (!formattedResponse) {
      vscode.window.showErrorMessage("model not reponding, try again later");
      return;
    }
    if (this.generativeAi === generativeAiModel.GROQ) {
      await GroqWebViewProvider.webView?.webview.postMessage({
        type: "user-input",
        message: formattedResponse,
      });
    }

    if (this.generativeAi === generativeAiModel.OLLAMA) {
      await OllamaWebViewProvider.webView?.webview.postMessage({
        type: "user-input",
        message: formattedResponse,
      });
    }

    if (this.generativeAi === generativeAiModel.GEMINI) {
      await GeminiWebViewProvider.webView?.webview.postMessage({
        type: "user-input",
        message: formattedResponse,
      });
    }

    if (this.generativeAi === generativeAiModel.ANTHROPIC) {
      await AnthropicWebViewProvider.webView?.webview.postMessage({
        type: "user-input",
        message: formattedResponse,
      });
    }
  }
}
