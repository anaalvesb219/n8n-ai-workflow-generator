// content/page-analyzer.js
// Funções para análise de páginas web

/**
 * Analisa a página atual e retorna informações detalhadas
 */
export function analyzePage() {
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
export function extractJavaScriptAPIs() {
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
  
  // Tentar extrair de variáveis window globais que contêm configurações
  try {
    const pageSource = document.documentElement.outerHTML;
    extractURLs(pageSource);
    
    // Procurar também por padrões comuns de definição de API em objetos JS
    const configRegex = /(?:apiUrl|apiEndpoint|apiBase|baseUrl|baseAPI|apiPath)\s*[:=]\s*(["'])([^"']+)\1/g;
    let configMatch;
    while ((configMatch = configRegex.exec(pageSource)) !== null) {
      const url = configMatch[2];
      if (url.includes('/api/') || url.includes('api.') || url.endsWith('/api')) {
        if (!result.endpoints.some(e => e.url === url)) {
          result.endpoints.push({
            url: url,
            method: 'GET',  // método padrão para configurações base
            type: 'config'
          });
        }
      }
    }
  } catch (e) {
    console.error('Erro ao analisar código-fonte:', e);
  }
  
  // Remover duplicatas
  result.endpoints = [...new Map(result.endpoints.map(item => 
    [item.url, item])).values()];
  result.webhooks = [...new Map(result.webhooks.map(item => 
    [item.url, item])).values()];
    
  return result;
}

/**
 * Tenta adivinhar o método HTTP com base no contexto
 */
function guessAPIMethod(text, position) {
  // Verificar 50 caracteres antes da URL
  const prevText = text.substring(Math.max(0, position - 50), position);
  
  if (prevText.includes('POST') || prevText.includes('post') || 
      prevText.includes('create') || prevText.includes('save') || 
      prevText.includes('update') || prevText.includes('add')) {
    return 'POST';
  } else if (prevText.includes('PUT') || prevText.includes('put') || 
           prevText.includes('update')) {
    return 'PUT';
  } else if (prevText.includes('DELETE') || prevText.includes('delete') || 
           prevText.includes('remove')) {
    return 'DELETE';
  } else if (prevText.includes('PATCH') || prevText.includes('patch')) {
    return 'PATCH';
  }
  
  return 'GET';  // método padrão
}

/**
 * Obter posição do elemento na página
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
 * Função auxiliar para gerar seletor CSS
 */
function getSelector(element) {
  if (element.id) return `#${element.id}`;
  if (element.className) {
    const classes = element.className.split(' ').filter(c => c.trim());
    if (classes.length) return `.${classes[0]}`;
  }
  return element.tagName.toLowerCase();
} 