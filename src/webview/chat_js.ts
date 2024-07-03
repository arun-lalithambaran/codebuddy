import * as vscode from "vscode";
export const chatJs = () => `
const chatContainer = document.getElementById("chat-container");
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatSendButton = document.getElementById("chat-send");
const KnowledgeBaseDropDown = document.getElementById("chat-options");

const textArea = document.getElementById("chat-input-container");
textArea.setAttribute("disabled", "true");

chatSendButton.disabled = true;

let chatVisible = false;

chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    const userInput = chatInput.value.trim();
    if (userInput) {
      addChatMessage("You", userInput);
      sendChatMessage(userInput);
      chatInput.value = "";
    }
  }
});

chatSendButton.addEventListener("click", () => {
  const userInput = chatInput.value.trim();
  if (userInput) {
    addChatMessage("You", userInput);
    sendChatMessage(userInput);
    chatInput.value = "";
  }
});

function addChatMessage(sender, message) {
  const messageContainer = document.createElement("div");
  messageContainer.classList.add("chat-message-container");
  const messageHeader = document.createElement("div");
  messageHeader.classList.add("chat-message-header");
  messageHeader.textContent = sender + ":";
  const messageBody = document.createElement("div");
  messageBody.classList.add("chat-message-body");
  messageBody.innerHTML = message;
  messageContainer.appendChild(messageHeader);
  messageContainer.appendChild(messageBody);
  chatMessages.appendChild(messageContainer);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function sendChatMessage(message) {
  const vscode = acquireVsCodeApi();
  vscode.postMessage({ type: "user-input", message: message });
}

window.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "bot-response") {
    addChatMessage("bot", message.message);
  } else if (message.type === "user-input") {
    addChatMessage("You", message.message);
  }

  //call code higlighter function here
  hljs.highlightAll();
});

KnowledgeBaseDropDown.addEventListener("change", (event) => {
  const selectedDoc = event.target.value;
  if (selectedDoc) {
    vscode.postMessage({
      command: "knowledge-base",
      doc: selectedDoc,
    });
  }
});

`;
