console.log('n8n AI Content Script Bundle carregado em:', window.location.href);

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

  // --------------------------
  // Código do page-analyzer.js
  // --------------------------
  
  /**
   * Analisa a página atual e retorna informações detalhadas
   */
  function analyzePage() {
    const analysis = {
      url: window.location.href,
      title: document.title,
      elementCount: 0,
      forms: 0,
      inputs: 0,
      buttons: 0,
      links: 0,
      tables: 0,
      visualElements: {
        charts: [],
        dashboards: [],
        dataVisualizations: []
      },
      apis: {
        endpoints: [],
        webhooks: []
      },
      details: {
        forms: [],
        importantElements: []
      }
    };
  
    // Analisar formulários
    const forms = document.querySelectorAll('form');
    analysis.forms = forms.length;
    analysis.elementCount += forms.length;
    
    forms.forEach((form, index) => {
      const formData = {
        index: index,
        action: form.action || 'no-action',
        method: form.method || 'GET',
        fields: []
      };
      
      // Coletar campos do formulário
      const fields = form.querySelectorAll('input, textarea, select');
      fields.forEach(field => {
        if (field.type !== 'hidden') {
          formData.fields.push({
            type: field.type || field.tagName.toLowerCase(),
            name: field.name || field.id || 'unnamed',
            placeholder: field.placeholder || '',
            required: field.required
          });
        }
      });
      
      if (formData.fields.length > 0) {
        analysis.details.forms.push(formData);
      }
    });
    
    // Contar botões
    const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"], .btn, .button');
    analysis.buttons = buttons.length;
    analysis.elementCount += buttons.length;
    
    // Contar inputs (fora de formulários)
    const standaloneInputs = document.querySelectorAll('input:not(form input), textarea:not(form textarea), select:not(form select)');
    const visibleInputs = Array.from(standaloneInputs).filter(input => input.type !== 'hidden');
    analysis.inputs = visibleInputs.length;
    analysis.elementCount += visibleInputs.length;
    
    // Contar links importantes
    const importantLinks = document.querySelectorAll('a[href*="api"], a[href*="download"], a[href*="export"], a[href*="csv"], a[href*="json"], a[href*="xlsx"]');
    analysis.links = importantLinks.length;
    analysis.elementCount += importantLinks.length;
    
    // Adicionar alguns links importantes aos detalhes
    importantLinks.forEach((link, index) => {
      if (index < 5) { // Limitar a 5 links
        analysis.details.importantElements.push({
          type: 'link',
          text: link.textContent.trim().substring(0, 50),
          href: link.href
        });
      }
    });
    
    // Contar tabelas
    const tables = document.querySelectorAll('table');
    analysis.tables = tables.length;
    analysis.elementCount += tables.length;
    
    // Adicionar informações de tabelas
    tables.forEach((table, index) => {
      if (index < 3) { // Limitar a 3 tabelas
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
        const rowCount = table.querySelectorAll('tr').length;
        
        if (headers.length > 0 || rowCount > 1) {
          analysis.details.importantElements.push({
            type: 'table',
            headers: headers.slice(0, 5), // Primeiros 5 headers
            rowCount: rowCount
          });
        }
      }
    });
    
    // Detectar se é uma página de login
    const passwordFields = document.querySelectorAll('input[type="password"]');
    if (passwordFields.length > 0) {
      analysis.details.pageType = 'login';
    }
    
    // Detectar se é e-commerce
    const priceElements = document.querySelectorAll('[class*="price"], [class*="cost"], [class*="valor"]');
    const addToCartButtons = document.querySelectorAll('[class*="cart"], [class*="comprar"], [class*="buy"]');
    if (priceElements.length > 3 || addToCartButtons.length > 0) {
      analysis.details.pageType = 'ecommerce';
    }
    
    // Detectar APIs sendo chamadas (via performance)
    if (window.performance && window.performance.getEntriesByType) {
      const resources = window.performance.getEntriesByType('resource');
      const apiCalls = resources.filter(r => 
        r.name.includes('/api/') || 
        r.name.includes('.json') || 
        r.initiatorType === 'xmlhttprequest' ||
        r.initiatorType === 'fetch'
      );
      
      if (apiCalls.length > 0) {
        analysis.details.detectedAPIs = apiCalls.slice(0, 5).map(call => ({
          url: call.name,
          type: call.initiatorType
        }));
      }
    }
  
    // Detectar elementos visuais (gráficos, dashboards)
    detectVisualElements(analysis);
    
    // Extrair APIs do JavaScript da página
    const jsAPIs = extractJavaScriptAPIs();
    analysis.apis = jsAPIs;
  
    return analysis;
  }
  
  /**
   * Detecta elementos visuais como gráficos e dashboards
   */
  function detectVisualElements(analysis) {
    // Detectar canvas que podem ser gráficos
    const canvasElements = document.querySelectorAll('canvas');
    canvasElements.forEach(canvas => {
      // Verificar se é um gráfico (Chart.js, D3, etc)
      const parentElement = canvas.parentElement;
      const isChart = 
        parentElement.className.toLowerCase().includes('chart') ||
        parentElement.className.toLowerCase().includes('graph') ||
        parentElement.className.toLowerCase().includes('plot') ||
        canvas.getAttribute('data-chart-type');
      
      if (isChart) {
        analysis.visualElements.charts.push({
          id: canvas.id || getSelector(canvas),
          width: canvas.width,
          height: canvas.height,
          position: getElementPosition(canvas)
        });
      }
    });
    
    // Detectar divs que podem ser dashboards
    const potentialDashboards = document.querySelectorAll('[class*="dashboard"], [class*="widget"], [id*="dashboard"], [id*="widget"]');
    potentialDashboards.forEach(element => {
      if (element.querySelectorAll('*').length > 10) {  // Dashboards geralmente têm muitos elementos
        analysis.visualElements.dashboards.push({
          id: element.id || getSelector(element),
          children: element.querySelectorAll('*').length,
          position: getElementPosition(element)
        });
      }
    });
    
    // Detectar gráficos SVG (D3.js e similares)
    const svgElements = document.querySelectorAll('svg');
    svgElements.forEach(svg => {
      const hasDataVis = 
        svg.querySelectorAll('path, rect, circle').length > 5 ||
        svg.parentElement.className.toLowerCase().includes('chart') ||
        svg.parentElement.className.toLowerCase().includes('graph');
        
      if (hasDataVis) {
        analysis.visualElements.dataVisualizations.push({
          id: svg.id || getSelector(svg),
          type: 'svg',
          children: svg.querySelectorAll('*').length,
          position: getElementPosition(svg)
        });
      }
    });
  }
  
  /**
   * Extrai APIs e Webhooks do código JavaScript da página
   */
  function extractJavaScriptAPIs() {
    const result = {
      endpoints: [],
      webhooks: []
    };
    
    // Função para extrair strings que parecem URLs de API
    function extractURLs(text) {
      // Regex para detectar URLs de API
      const apiRegex = /(["'])((https?:\/\/[^"']+\/api\/[^"']+)|(\/api\/[^"']+))\1/g;
      const webhookRegex = /(["'])((https?:\/\/[^"']+\/webhook[s]?\/[^"']+)|(\/webhook[s]?\/[^"']+))\1/g;
      
      let match;
      // Extrair endpoints de API
      while ((match = apiRegex.exec(text)) !== null) {
        const url = match[2];
        if (!result.endpoints.some(e => e.url === url)) {
          result.endpoints.push({
            url: url,
            method: guessAPIMethod(text, match.index)
          });
        }
      }
      
      // Extrair webhooks
      while ((match = webhookRegex.exec(text)) !== null) {
        const url = match[2];
        if (!result.webhooks.some(w => w.url === url)) {
          result.webhooks.push({
            url: url,
            method: guessAPIMethod(text, match.index)
          });
        }
      }
    }
    
    // Tentar extrair de todos os scripts inline
    const scripts = document.querySelectorAll('script:not([src])');
    scripts.forEach(script => {
      if (script.textContent) {
        extractURLs(script.textContent);
      }
    });
    
    // Procurar por fetchs e ajax calls
    const fetchRegex = /fetch\s*\(\s*(["'])(.*?)\1/g;
    const xhrRegex = /XMLHttpRequest\(\).*?\.open\s*\(\s*["'](\w+)["']\s*,\s*["'](.*?)["']/g;
    const ajaxRegex = /\.ajax\s*\(\s*{[^}]*url\s*:\s*(["'])(.*?)\1/g;
    
    // Procurar nos scripts inline
    scripts.forEach(script => {
      if (script.textContent) {
        let match;
        
        // Encontrar chamadas fetch
        while ((match = fetchRegex.exec(script.textContent)) !== null) {
          const url = match[2];
          if (url.includes('api') && !result.endpoints.some(e => e.url === url)) {
            result.endpoints.push({
              url: url,
              method: guessAPIMethod(script.textContent, match.index)
            });
          }
        }
        
        // Encontrar chamadas XMLHttpRequest
        while ((match = xhrRegex.exec(script.textContent)) !== null) {
          const method = match[1];
          const url = match[2];
          if (url.includes('api') && !result.endpoints.some(e => e.url === url)) {
            result.endpoints.push({
              url: url,
              method: method
            });
          }
        }
        
        // Encontrar chamadas jQuery ajax
        while ((match = ajaxRegex.exec(script.textContent)) !== null) {
          const url = match[2];
          if (url.includes('api') && !result.endpoints.some(e => e.url === url)) {
            result.endpoints.push({
              url: url,
              method: guessAPIMethod(script.textContent, match.index)
            });
          }
        }
      }
    });
    
    return result;
  }
  
  /**
   * Tenta adivinhar o método HTTP com base no contexto
   */
  function guessAPIMethod(text, position) {
    // Olhar 50 caracteres antes da URL
    const preContext = text.substring(Math.max(0, position - 50), position);
    
    if (preContext.includes('POST') || preContext.includes('post') || 
        preContext.includes('create') || preContext.includes('save') || preContext.includes('add')) {
      return 'POST';
    }
    if (preContext.includes('PUT') || preContext.includes('put') || 
        preContext.includes('update') || preContext.includes('edit')) {
      return 'PUT';
    }
    if (preContext.includes('DELETE') || preContext.includes('delete') || 
        preContext.includes('remove')) {
      return 'DELETE';
    }
    if (preContext.includes('PATCH') || preContext.includes('patch')) {
      return 'PATCH';
    }
    
    // Método padrão se não conseguir determinar
    return 'GET';
  }
  
  /**
   * Obtém a posição de um elemento na página
   */
  function getElementPosition(element) {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height
    };
  }
  
  /**
   * Retorna um seletor CSS para o elemento
   */
  function getSelector(element) {
    if (element.id) {
      return '#' + element.id;
    }
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim().length > 0);
      if (classes.length > 0) {
        return '.' + classes.join('.');
      }
    }
    // Último recurso: tipo de elemento e índice
    const siblings = element.parentNode ? Array.from(element.parentNode.children) : [];
    const index = siblings.indexOf(element);
    return element.tagName.toLowerCase() + (index >= 0 ? ':nth-child(' + (index + 1) + ')' : '');
  }

  // -----------------------
  // Código do content.js
  // -----------------------
  
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