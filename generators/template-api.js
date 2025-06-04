// generators/template-api.js
// Template para workflow de scraping de API

import { generateValidUUID, createValidWorkflowStructure } from './workflow-generator.js';

/**
 * Modelo de workflow para scraping de API
 * @param {Object} options - Opções para personalizar o workflow
 * @returns {Object} Workflow para scraping de API
 */
export function createApiScrapingWorkflowTemplate(options = {}) {
  const {
    name = "Scraping de API",
    apiUrl = "https://api.exemplo.com/dados",
    method = "GET",
    headers = {},
    schedule = "*/30 * * * *", // A cada 30 minutos
    outputDestination = "planilha", // ou "database", "webhook", etc.
    paginationType = "offset", // ou "page", "cursor", "link"
    maxPages = 5,
    rateLimitDelay = 2, // segundos entre requisições
    dataPath = "data", // caminho para os dados na resposta da API
    filterCondition = "{{ true }}" // condição para filtrar resultados
  } = options;
  
  // Nós do workflow
  const nodes = [
    // Nó de agendamento (Schedule)
    {
      parameters: {
        triggerTimes: {
          item: [
            {
              mode: "everyX",
              value: 30,
              unit: "minutes"
            }
          ]
        }
      },
      id: generateValidUUID(),
      name: "Schedule Trigger",
      type: "n8n-nodes-base.cron",
      typeVersion: 1,
      position: [250, 300]
    },
    
    // Nó para inicializar variáveis de paginação
    {
      parameters: {
        functionCode: `
          // Configurar variáveis iniciais para paginação e rate limiting
          return {
            currentPage: 1,
            offset: 0,
            limit: 100,
            hasMoreData: true,
            totalResults: [],
            cursor: null,
            nextLink: null,
            apiUrl: "${apiUrl}",
            startTime: new Date().toISOString(),
            iterationCount: 0,
            paginationType: "${paginationType}",
            maxPages: ${maxPages},
            dataPath: "${dataPath}"
          };
        `
      },
      id: generateValidUUID(),
      name: "Initialize Variables",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [400, 300]
    },
    
    // Nó para loop de paginação
    {
      parameters: {
        mode: "runOnceForEachItem",
        options: {}
      },
      id: generateValidUUID(),
      name: "Pagination Loop",
      type: "n8n-nodes-base.splitInBatches",
      typeVersion: 1,
      position: [550, 300]
    },
    
    // Nó para construir URL da API com parâmetros de paginação
    {
      parameters: {
        functionCode: `
          // Obter estado atual da paginação
          const data = $input;
          
          // Verificar se ainda temos mais páginas para buscar e se não excedemos o limite
          if (!data.hasMoreData || data.iterationCount >= data.maxPages) {
            // Finalizar loop
            return [];
          }
          
          // Incrementar contador de iterações
          data.iterationCount += 1;
          
          // Construir URL com base no tipo de paginação
          let url = data.apiUrl;
          let queryParams = {};
          
          // Aplicar paginação conforme o tipo
          switch (data.paginationType) {
            case 'offset':
              queryParams = {
                offset: data.offset,
                limit: data.limit
              };
              break;
              
            case 'page':
              queryParams = {
                page: data.currentPage,
                per_page: data.limit
              };
              break;
              
            case 'cursor':
              if (data.cursor) {
                queryParams = {
                  cursor: data.cursor
                };
              }
              break;
              
            case 'link':
              // Se temos um próximo link, usar ele diretamente
              if (data.nextLink) {
                url = data.nextLink;
              }
              break;
          }
          
          // Adicionar query params à URL (exceto no caso de link direto)
          if (data.paginationType !== 'link') {
            url = new URL(url);
            
            // Adicionar parâmetros existentes
            Object.entries(queryParams).forEach(([key, value]) => {
              url.searchParams.set(key, value);
            });
            
            url = url.toString();
          }
          
          return {
            ...data,
            currentRequestUrl: url
          };
        `
      },
      id: generateValidUUID(),
      name: "Build API Request",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [700, 300]
    },
    
    // Nó de delay para rate limiting
    {
      parameters: {
        amount: rateLimitDelay,
        unit: "seconds"
      },
      id: generateValidUUID(),
      name: "Rate Limit Delay",
      type: "n8n-nodes-base.wait",
      typeVersion: 1,
      position: [850, 300]
    },
    
    // Nó para fazer a requisição à API
    {
      parameters: {
        url: "={{ $json.currentRequestUrl }}",
        method: method,
        authentication: "none",
        sendHeaders: true,
        headerParameters: {
          parameters: Object.entries(headers).map(([name, value]) => ({
            name,
            value
          }))
        },
        options: {
          redirect: {
            redirect: {
              followRedirects: true,
              maxRedirects: 5
            }
          },
          response: {
            response: {
              fullResponse: true,
              responseFormat: "json"
            }
          }
        }
      },
      id: generateValidUUID(),
      name: "HTTP Request",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 3,
      position: [1000, 300]
    },
    
    // Nó para processar a resposta e atualizar os parâmetros de paginação
    {
      parameters: {
        functionCode: `
          // Obter dados da resposta
          const response = $input.all()[0];
          const state = { ...$input };
          
          // Verificar se temos uma resposta válida
          if (!response || response.statusCode >= 400) {
            throw new Error(\`Erro na requisição: \${response?.statusCode} \${response?.statusMessage || ''}\`);
          }
          
          // Extrair dados conforme o caminho configurado
          let newResults = [];
          if (state.dataPath) {
            // Navegar pelo caminho de dados (e.g., "data.results")
            const pathParts = state.dataPath.split('.');
            let currentData = response.body;
            
            for (const part of pathParts) {
              if (currentData && currentData[part] !== undefined) {
                currentData = currentData[part];
              } else {
                currentData = null;
                break;
              }
            }
            
            if (Array.isArray(currentData)) {
              newResults = currentData;
            } else if (currentData) {
              // Se não for array mas tiver dados, converter para array
              newResults = [currentData];
            }
          } else if (Array.isArray(response.body)) {
            // Se o corpo já for um array
            newResults = response.body;
          } else if (response.body) {
            // Se o corpo não for array mas tiver dados
            newResults = [response.body];
          }
          
          // Filtrar resultados, se necessário
          if (${filterCondition !== "{{ true }}"}) {
            const filterFunction = (item) => ${filterCondition};
            newResults = newResults.filter(filterFunction);
          }
          
          // Adicionar aos resultados totais
          state.totalResults = [...state.totalResults, ...newResults];
          
          // Atualizar parâmetros de paginação conforme o tipo
          switch (state.paginationType) {
            case 'offset':
              state.offset += state.limit;
              state.hasMoreData = newResults.length === state.limit;
              break;
              
            case 'page':
              state.currentPage += 1;
              state.hasMoreData = newResults.length === state.limit;
              break;
              
            case 'cursor':
              // Buscar cursor na resposta (padrão comum)
              if (response.body.next_cursor) {
                state.cursor = response.body.next_cursor;
              } else if (response.body.pagination?.cursor) {
                state.cursor = response.body.pagination.cursor;
              } else if (response.body.meta?.cursor) {
                state.cursor = response.body.meta.cursor;
              } else {
                state.cursor = null;
              }
              
              state.hasMoreData = !!state.cursor;
              break;
              
            case 'link':
              // Buscar próximo link nos headers ou na resposta
              if (response.headers.link) {
                // Formato comum: <https://api.ex.com/v1/path?page=2>; rel="next"
                const linkHeader = response.headers.link;
                const nextLinkMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
                
                state.nextLink = nextLinkMatch ? nextLinkMatch[1] : null;
              } else if (response.body._links?.next) {
                state.nextLink = response.body._links.next;
              } else if (response.body.links?.next) {
                state.nextLink = response.body.links.next;
              } else {
                state.nextLink = null;
              }
              
              state.hasMoreData = !!state.nextLink;
              break;
          }
          
          // Verificar se chegamos ao limite de páginas
          if (state.iterationCount >= state.maxPages) {
            state.hasMoreData = false;
          }
          
          return state;
        `
      },
      id: generateValidUUID(),
      name: "Process Response",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [1150, 300]
    },
    
    // Nó final para processar todos os resultados coletados
    {
      parameters: {
        functionCode: `
          // Obter o último estado com todos os resultados
          const lastState = $input;
          
          return {
            results: lastState.totalResults,
            count: lastState.totalResults.length,
            pagesProcessed: lastState.iterationCount,
            startTime: lastState.startTime,
            endTime: new Date().toISOString(),
            source: lastState.apiUrl
          };
        `
      },
      id: generateValidUUID(),
      name: "Prepare Results",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [1300, 300]
    }
  ];
  
  // Adicionar nós específicos para o destino de saída
  if (outputDestination === 'planilha') {
    // Nó para exportar para Google Sheets
    nodes.push({
      parameters: {
        documentId: "={{ $json.googleSheetId || '' }}",
        sheetName: "{{ $json.sheetName || 'API Data' }}",
        columns: "={{ Object.keys($json.results[0] || {}) }}",
        options: {
          handlingExistingData: "append"
        }
      },
      id: generateValidUUID(),
      name: "Export to Google Sheets",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 2,
      position: [1450, 200]
    });
  } else if (outputDestination === 'database') {
    // Nó para exportar para banco de dados
    nodes.push({
      parameters: {
        operation: "insert",
        table: "{{ $json.tableName || 'api_data' }}",
        columns: "={{ Object.keys($json.results[0] || {}) }}",
        additionalFields: {}
      },
      id: generateValidUUID(),
      name: "Export to Database",
      type: "n8n-nodes-base.postgres",
      typeVersion: 1,
      position: [1450, 200]
    });
  } else if (outputDestination === 'webhook') {
    // Nó para enviar para webhook
    nodes.push({
      parameters: {
        url: "={{ $json.webhookUrl }}",
        method: "POST",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: "Content-Type",
              value: "application/json"
            }
          ]
        },
        sendBody: true,
        bodyParameters: {
          parameters: [
            {
              name: "data",
              value: "={{ $json.results }}"
            },
            {
              name: "meta",
              value: "={{ { count: $json.count, endTime: $json.endTime, startTime: $json.startTime } }}"
            }
          ]
        }
      },
      id: generateValidUUID(),
      name: "Send to Webhook",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 3,
      position: [1450, 200]
    });
  }
  
  // Conexões entre os nós
  const connections = {
    "Schedule Trigger": {
      main: [
        [
          {
            node: "Initialize Variables",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Initialize Variables": {
      main: [
        [
          {
            node: "Pagination Loop",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Pagination Loop": {
      main: [
        [
          {
            node: "Build API Request",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Build API Request": {
      main: [
        [
          {
            node: "Rate Limit Delay",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Rate Limit Delay": {
      main: [
        [
          {
            node: "HTTP Request",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "HTTP Request": {
      main: [
        [
          {
            node: "Process Response",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Process Response": {
      main: [
        [
          {
            node: "Pagination Loop",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Pagination Loop": {
      main: [
        [
          {
            node: "Prepare Results",
            type: "main",
            index: 1
          }
        ]
      ]
    }
  };
  
  // Adicionar conexões para o nó de saída específico
  if (outputDestination === 'planilha') {
    connections["Prepare Results"] = {
      main: [
        [
          {
            node: "Export to Google Sheets",
            type: "main",
            index: 0
          }
        ]
      ]
    };
  } else if (outputDestination === 'database') {
    connections["Prepare Results"] = {
      main: [
        [
          {
            node: "Export to Database",
            type: "main",
            index: 0
          }
        ]
      ]
    };
  } else if (outputDestination === 'webhook') {
    connections["Prepare Results"] = {
      main: [
        [
          {
            node: "Send to Webhook",
            type: "main",
            index: 0
          }
        ]
      ]
    };
  }
  
  return createValidWorkflowStructure(name, nodes, connections);
} 