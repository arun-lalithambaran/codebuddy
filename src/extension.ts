import * as vscode from "vscode";
import {
  appConfig,
  generativeModel,
  OLA_ACTIONS,
  USER_MESSAGE,
} from "./constant";
import { Comments } from "./events/comment";
import { ExplainCode } from "./events/explain";
import { FixError } from "./events/fixError";
import { OptimizeCode } from "./events/optimize";
import { RefactorCode } from "./events/refactor";
import { ReviewCode } from "./events/review";
import { CodeActionsProvider } from "./providers/code-actions-provider";
import { GeminiWebViewProvider } from "./providers/gemini-web-view-provider";
import { GroqWebViewProvider } from "./providers/groq-web-view-provider";
import { ChatManager } from "./services/chat-manager";
import { getConfigValue } from "./utils";
import { PatternUploader } from "./events/pattern-uploader";
import { ReadFromKnowledgeBase } from "./events/knowledge-base";
import { GenerateCommitMessage } from "./events/generate-commit-message";
import { InterviewMe } from "./events/interview-me";

const { geminiKey, geminiModel, groqKey, groqModel } = appConfig;

export async function activate(context: vscode.ExtensionContext) {
  try {
    const {
      comment,
      review,
      refactor,
      optimize,
      fix,
      explain,
      pattern,
      knowledge,
      commitMessage,
      interviewMe,
    } = OLA_ACTIONS;
    const getComment = new Comments(
      `${USER_MESSAGE} generates the code comments...`,
      context
    );
    const generateOptimizeCode = new OptimizeCode(
      `${USER_MESSAGE} optimizes the code...`,
      context
    );
    const generateRefactoredCode = new RefactorCode(
      `${USER_MESSAGE} refactors the code...`,
      context
    );
    const explainCode = new ExplainCode(
      `${USER_MESSAGE} explains the code...`,
      context
    );
    const generateReview = new ReviewCode(
      `${USER_MESSAGE} reviews the code...`,
      context
    );
    const codePattern = new PatternUploader(context);
    const knowledgeBase = new ReadFromKnowledgeBase(
      `${USER_MESSAGE} generate your code pattern...`,
      context
    );
    const generateCommitMessage = new GenerateCommitMessage(
      `${USER_MESSAGE} generates a commit message...`,
      context
    );
    const generateInterviewQuestions = new InterviewMe(
      `${USER_MESSAGE} generates interview questions...`,
      context
    );

    const actionMap = {
      [comment]: () => getComment.execute(),
      [review]: () => generateReview.execute(),
      [refactor]: () => generateRefactoredCode.execute(),
      [optimize]: () => generateOptimizeCode.execute(),
      [interviewMe]: () => generateInterviewQuestions.execute(),
      [fix]: (errorMessage: string) =>
        new FixError(
          `${USER_MESSAGE} finds a solution to the error...`,
          context,
          errorMessage
        ).execute(errorMessage),
      [explain]: () => explainCode.execute(),
      [pattern]: () => codePattern.uploadPatternHandler(),
      [knowledge]: () => knowledgeBase.execute(),
      [commitMessage]: () => generateCommitMessage.execute("hello"),
    };

    const subscriptions = Object.entries(actionMap).map(([action, handler]) =>
      vscode.commands.registerCommand(action, handler)
    );

    const selectedGenerativeAiModel = getConfigValue("generativeAi.option");

    const quickFix = new CodeActionsProvider();
    const quickFixCodeAction = vscode.languages.registerCodeActionsProvider(
      { scheme: "file", language: "*" },
      quickFix
    );

    // Todo: move each generative Ai view providers to different files
    if (selectedGenerativeAiModel === generativeModel.GEMINI) {
      const key = getConfigValue(geminiKey);
      const model = getConfigValue(geminiModel);
      const geminiWebViewProvider = new GeminiWebViewProvider(
        context.extensionUri,
        key,
        model,
        context
      );

      const registerGeminiWebViewProvider =
        vscode.window.registerWebviewViewProvider(
          GeminiWebViewProvider.viewId,
          geminiWebViewProvider
        );

      const chatManager = new ChatManager(context);
      const chatWithOla = chatManager.registerChatCommand();

      context.subscriptions.push(
        ...subscriptions,
        quickFixCodeAction,
        registerGeminiWebViewProvider,
        chatWithOla
      );
    }

    if (selectedGenerativeAiModel === generativeModel.GROQ) {
      const key = getConfigValue(groqKey);
      const model = getConfigValue(groqModel);
      const groqWebViewProvider = new GroqWebViewProvider(
        context.extensionUri,
        key,
        model,
        context
      );
      const registerGroqWebViewProvider =
        vscode.window.registerWebviewViewProvider(
          GroqWebViewProvider.viewId,
          groqWebViewProvider
        );

      const chatManager = new ChatManager(context);
      const chatWithOla = chatManager.registerChatCommand();

      context.subscriptions.push(
        ...subscriptions,
        quickFixCodeAction,
        registerGroqWebViewProvider,
        chatWithOla
      );
    }
  } catch (error) {
    console.log(error);
  }
}
