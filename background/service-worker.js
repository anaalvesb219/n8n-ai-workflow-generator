// background/service-worker.js
// Service Worker para a extensão n8n AI Workflow Generator

import { createValidWorkflowStructure } from "../generators/workflow-generator.js";
import { VERSION } from "../utils/constants.js";

// Quando a extensão é instalada
chrome.runtime.onInstalled.addListener(() => {
  console.log(`n8n AI Workflow Generator v${VERSION.current} instalado`);

  // Configurar side panel
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

  // Inicializar configurações de API
  chrome.storage.local.get(["visionApiKey"], function (result) {
    if (!result.visionApiKey) {
      // Configurar chave de API padrão (substitua com sua chave real)
      chrome.storage.local.set({
        visionApiKey: "", // Deixado em branco intencionalmente - deve ser configurado pelo usuário
        visionApiEndpoint: "https://api.openai.com/v1/chat/completions",
      });
    }
  });

  // Salvar versão atual
  chrome.storage.local.set({ version: VERSION });

  // Iniciar keep-alive para manter o service worker ativo
  startKeepAlive();
});

// Keep-alive para manter o service worker ativo
function startKeepAlive() {
  console.log("Iniciando keep-alive do service worker");

  // Executar a cada 20 segundos para evitar que o service worker seja descarregado
  setInterval(() => {
    chrome.runtime.getPlatformInfo((info) => {
      console.log("Keep-alive ativo, plataforma:", info.os);
    });
  }, 20000);
}

// Verificar se o content script está injetado e injetar se necessário
async function ensureContentScriptInjected(tabId) {
  console.log("Verificando se o content script está injetado na aba", tabId);

  try {
    // Verificar se o content script está respondendo
    const response = await chrome.tabs.sendMessage(tabId, { action: "ping" });

    if (response && response.status === "pong") {
      console.log("Content script já está injetado e respondendo");
      return true;
    }
  } catch (error) {
    console.log(
      "Content script não está injetado ou não está respondendo:",
      error,
    );
  }

  try {
    // Obter informações da aba
    const tab = await chrome.tabs.get(tabId);
    const url = tab.url;

    // Verificar se a URL é válida para injeção
    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
      console.warn(
        "Não é possível injetar em URLs chrome:// ou chrome-extension://",
      );
      return false;
    }

    console.log("Injetando content script na aba", tabId);

    // Injetar o content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/content.js"],
    });

    // Esperar um pouco para que o script seja carregado
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log("Content script injetado com sucesso");
    return true;
  } catch (error) {
    console.error("Erro ao injetar content script:", error);
    return false;
  }
}

// Lidar com clique no ícone da extensão
chrome.action.onClicked.addListener(async (tab) => {
  // Garantir que o content script esteja injetado antes de abrir o side panel
  await ensureContentScriptInjected(tab.id);

  // Abrir side panel
  chrome.sidePanel.open({ tabId: tab.id });
});

// Capturar screenshot da aba ativa
async function captureActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) throw new Error("Nenhuma aba ativa encontrada");

    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: "png",
    });
    return dataUrl;
  } catch (error) {
    console.error("Erro ao capturar screenshot:", error);
    return null;
  }
}

// Analisa o screenshot usando a Vision API
async function analyzeScreenshotWithVisionAPI(screenshotDataUrl) {
  try {
    // Obter configurações da API
    const { visionApiKey, visionApiEndpoint } = await chrome.storage.local.get([
      "visionApiKey",
      "visionApiEndpoint",
    ]);

    if (!visionApiKey) {
      throw new Error(
        "Chave da API Vision não configurada. Configure nas opções da extensão.",
      );
    }

    // Converter data URL para base64 (removendo o prefixo data:image/png;base64,)
    const base64Image = screenshotDataUrl.replace(
      /^data:image\/\w+;base64,/,
      "",
    );

    // Preparar a solicitação para a Vision API
    const requestBody = {
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analise esta captura de tela e identifique elementos importantes como formulários, tabelas, gráficos, dashboards, elementos de visualização de dados, e áreas interativas. Forneça uma descrição estruturada no formato JSON que inclua: 1) Tipo de página (dashboard, e-commerce, login, etc); 2) Elementos visuais principais e suas localizações aproximadas; 3) Gráficos ou visualizações de dados detectados; 4) Formulários ou áreas de entrada; 5) Potenciais pontos de interação para automação.",
            },
            {
              type: "image_url",
              image_url: {
                url: screenshotDataUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    };

    // Fazer a chamada para a API
    const response = await fetch(visionApiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${visionApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Erro na API Vision: ${errorData.error?.message || "Erro desconhecido"}`,
      );
    }

    const data = await response.json();

    // Extrair a resposta da API
    const analysis = data.choices[0]?.message?.content;

    // Tentar analisar o JSON da resposta
    try {
      // Se a resposta já estiver em formato JSON, retorne-a diretamente
      if (typeof analysis === "object") return analysis;

      // Tente extrair o bloco JSON da resposta
      const jsonMatch =
        analysis.match(/```json\n([\s\S]*?)\n```/) ||
        analysis.match(/```\n([\s\S]*?)\n```/) ||
        analysis.match(/{[\s\S]*?}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      }

      // Se não conseguir extrair JSON, retorne a resposta como texto
      return { rawAnalysis: analysis };
    } catch (parseError) {
      console.error("Erro ao analisar resposta JSON:", parseError);
      return { rawAnalysis: analysis };
    }
  } catch (error) {
    console.error("Erro na análise com Vision API:", error);
    throw error;
  }
}

// Repassar mensagens entre content script e side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Registrar mensagens recebidas para depuração
  console.log("Service Worker recebeu mensagem:", request.action);

  if (request.action === "apiDetected") {
    // Repassar para o side panel da aba ativa
    chrome.runtime.sendMessage(request);
  } else if (request.action === "captureVisibleTab") {
    captureActiveTab().then((dataUrl) => {
      sendResponse({ screenshot: dataUrl });
    });
    return true;
  } else if (request.action === "analyzeScreenshot") {
    // Capturar screenshot e analisar com a Vision API
    captureActiveTab().then((dataUrl) => {
      if (dataUrl) {
        analyzeScreenshotWithVisionAPI(dataUrl)
          .then((analysis) => {
            sendResponse({ success: true, analysis });
          })
          .catch((error) => {
            console.error("Erro na análise com Vision API:", error);
            sendResponse({ success: false, error: error.message });
          });
      } else {
        sendResponse({ success: false, error: "Falha ao capturar screenshot" });
      }
    });
    return true;
  } else if (request.action === "getExtensionInfo") {
    // Retorna informações sobre a extensão (versão, etc.)
    sendResponse({
      version: VERSION.current,
      lastUpdated: VERSION.lastUpdated,
    });
    return true;
  } else if (request.action === "ensureContentScriptInjected") {
    const tabId = request.tabId;
    if (tabId) {
      ensureContentScriptInjected(tabId)
        .then((result) => sendResponse({ success: result }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message }),
        );
      return true;
    }
    sendResponse({ success: false, error: "ID da aba não fornecido" });
    return true;
  }
});
