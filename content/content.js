// content/content.js
// Script de conteúdo principal que é injetado nas páginas

console.log('n8n AI Content Script CARREGADO em:', window.location.href);

if (typeof chrome !== 'undefined' && chrome.runtime) {
  console.log('Chrome runtime disponível');
} else {
  console.error('Chrome runtime NÃO disponível');
}

// Verificar se o script já foi injetado para evitar duplicação
if (window.__n8nAIContentScriptInjected) {
  console.log("n8n AI Content Script já injetado. Ignorando.");
} else {
  window.__n8nAIContentScriptInjected = true;

  import { analyzePage, extractJavaScriptAPIs } from "./page-analyzer.js";

  // Responder às mensagens do background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script recebeu mensagem:", request.action);

    // Responder ao ping para verificar se o content script está ativo
    if (request.action === "ping") {
      console.log("Recebido ping, respondendo com pong");
      sendResponse({ status: "pong" });
      return true; // Mantém o canal aberto para resposta assíncrona
    } else if (request.action === "analyzePage") {
      console.log("Analisando página...");
      try {
        const analysis = analyzePage();
        console.log("Análise concluída com sucesso");
        sendResponse({ analysis });
      } catch (error) {
        console.error("Erro ao analisar página:", error);
        sendResponse({ error: error.message });
      }
      return true; // Mantém o canal aberto para resposta assíncrona
    } else if (request.action === "captureScreenshot") {
      console.log("Capturando screenshot...");
      captureVisibleTab()
        .then((dataUrl) => {
          console.log("Screenshot capturado com sucesso");
          sendResponse({ screenshot: dataUrl });
        })
        .catch((error) => {
          console.error("Erro ao capturar screenshot:", error);
          sendResponse({ error: error.message });
        });
      return true; // Mantém o canal aberto para resposta assíncrona
    } else if (request.action === "extractJavaScriptAPIs") {
      console.log("Extraindo APIs JavaScript...");
      try {
        const apis = extractJavaScriptAPIs();
        console.log("APIs extraídas com sucesso:", apis.length);
        sendResponse({ apis });
      } catch (error) {
        console.error("Erro ao extrair APIs:", error);
        sendResponse({ error: error.message });
      }
      return true; // Mantém o canal aberto para resposta assíncrona
    }

    // Para qualquer outra ação não reconhecida
    console.warn("Ação não reconhecida:", request.action);
    return false; // Resposta síncrona para ações não reconhecidas
  });

  // Capturar screenshot da página visível
  function captureVisibleTab() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "captureVisibleTab" },
        (response) => {
          if (response && response.screenshot) {
            resolve(response.screenshot);
          } else {
            reject(new Error("Falha ao capturar screenshot"));
          }
        },
      );
    });
  }

  console.log("n8n AI Content Script carregado e pronto para análise!");
}
