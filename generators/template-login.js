// generators/template-login.js
// Template para workflow de automação de login

import { generateValidUUID, createValidWorkflowStructure } from './workflow-generator.js';

/**
 * Modelo de workflow para formulário de login
 * @param {Object} options - Opções para personalizar o workflow
 * @returns {Object} Workflow para automação de login
 */
export function createLoginWorkflowTemplate(options = {}) {
  const {
    name = "Automação de Login",
    url = "https://exemplo.com/login",
    username = "usuario@exemplo.com",
    password = "senhaSegura123",
    successUrl = "https://exemplo.com/dashboard",
    userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  } = options;
  
  // Nós do workflow
  const nodes = [
    // Nó HTTP Request para verificar se o site está acessível
    {
      parameters: {
        url: url,
        method: "GET",
        authentication: "none",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: "User-Agent",
              value: userAgent
            },
            {
              name: "Accept",
              value: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
            }
          ]
        },
        options: {
          redirect: {
            redirect: {
              followRedirects: true,
              maxRedirects: 5
            }
          },
          timeout: 10000,
          response: {
            response: {
              fullResponse: true,
              responseFormat: "json"
            }
          }
        }
      },
      id: generateValidUUID(),
      name: "Verificar Site",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 3,
      position: [450, 300]
    },
    
    // Nó para extrair tokens CSRF ou outros dados do formulário, se existirem
    {
      parameters: {
        functionCode: `
          // Obter resposta do request anterior
          const response = $input.all()[0];
          
          // Verificar se obtivemos uma resposta HTML
          if (!response.body || typeof response.body !== 'string') {
            throw new Error('Não foi possível obter o conteúdo HTML da página');
          }
          
          // Extrair possíveis tokens ou campos ocultos do formulário
          const html = response.body;
          
          // Buscar por token CSRF, comum em formulários de login
          let csrfToken = null;
          
          // Procurar no meta tag
          const csrfMetaMatch = html.match(/<meta\\s+name=["']csrf-token["']\\s+content=["']([^"']+)["']\\s*\\/?>/i);
          if (csrfMetaMatch && csrfMetaMatch[1]) {
            csrfToken = csrfMetaMatch[1];
          }
          
          // Ou procurar em campos de formulário ocultos
          if (!csrfToken) {
            const csrfInputMatch = html.match(/<input\\s+[^>]*name=["'](_csrf|csrf|csrf_token|token)[^"']*["'][^>]*value=["']([^"']+)["'][^>]*>/i);
            if (csrfInputMatch && csrfInputMatch[2]) {
              csrfToken = csrfInputMatch[2];
            }
          }
          
          // Extrair cookies que podem ser necessários para a sessão
          const cookies = response.headers['set-cookie'] || [];
          
          // Preparar objeto de resultado
          return {
            csrfToken,
            cookies: cookies.join('; '),
            formUrl: response.headers.location || url,
            allHeaders: response.headers,
            statusCode: response.statusCode
          };
        `
      },
      id: generateValidUUID(),
      name: "Extrair Dados do Formulário",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [650, 300]
    },
    
    // Nó HTTP Request para enviar dados de login
    {
      parameters: {
        url: "={{ $json.formUrl || '" + url + "' }}",
        method: "POST",
        authentication: "none",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: "Content-Type",
              value: "application/x-www-form-urlencoded"
            },
            {
              name: "User-Agent",
              value: userAgent
            },
            {
              name: "Accept",
              value: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
            },
            {
              name: "Cookie",
              value: "={{ $json.cookies }}"
            },
            {
              name: "X-Requested-With",
              value: "XMLHttpRequest"
            },
            {
              name: "Referer",
              value: url
            }
          ]
        },
        sendBody: true,
        contentType: "form-urlencoded",
        bodyParameters: {
          parameters: [
            {
              name: "username",
              value: username
            },
            {
              name: "email",
              value: username
            },
            {
              name: "password",
              value: password
            },
            {
              name: "csrf_token",
              value: "={{ $json.csrfToken || '' }}"
            },
            {
              name: "remember",
              value: "true"
            }
          ]
        },
        options: {
          redirect: {
            redirect: {
              followRedirects: true,
              maxRedirects: 5
            }
          },
          timeout: 15000,
          response: {
            response: {
              fullResponse: true,
              responseFormat: "json"
            }
          }
        }
      },
      id: generateValidUUID(),
      name: "Enviar Login",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 3,
      position: [850, 300]
    },
    
    // Nó para verificar sucesso do login
    {
      parameters: {
        functionCode: `
          // Obter resposta do request anterior
          const response = $input.all()[0];
          
          // Armazenar cookies da sessão
          const cookies = response.headers['set-cookie'] || [];
          const sessionCookies = cookies.join('; ');
          
          // Verificar código de status da resposta
          const statusCode = response.statusCode;
          
          // Verificar se redirecionou para URL de sucesso ou para dashboard
          const location = response.headers.location || '';
          const responseUrl = response.url || '';
          
          // Verificar redirecionamento ou elementos na página que indicam sucesso
          const redirectSuccess = location.includes('${successUrl}') || 
                                responseUrl.includes('${successUrl}') || 
                                responseUrl.includes('dashboard') || 
                                responseUrl.includes('account');
          
          // Verificar se o corpo da resposta contém indicação de erro
          const loginError = typeof response.body === 'string' && 
                          (response.body.includes('senha incorreta') || 
                           response.body.includes('credenciais inválidas') ||
                           response.body.includes('incorrect password') ||
                           response.body.includes('invalid credentials') ||
                           response.body.includes('login failed') ||
                           response.body.includes('falha no login') ||
                           response.body.includes('error') ||
                           response.body.includes('erro'));
          
          // Determinar se o login foi bem-sucedido
          const loginSuccess = (statusCode >= 200 && statusCode < 300 && !loginError) || 
                             redirectSuccess;
          
          return {
            success: loginSuccess,
            statusCode,
            responseUrl,
            location,
            sessionCookies,
            loginError: loginError ? 'Erro de autenticação detectado na resposta' : null,
            redirectSuccess
          };
        `
      },
      id: generateValidUUID(),
      name: "Verificar Resultado",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [1050, 300]
    },
    
    // Nó para verificar decisão
    {
      parameters: {
        conditions: {
          string: [
            {
              value1: "={{ $json.success }}",
              operation: "equal",
              value2: true
            }
          ]
        }
      },
      id: generateValidUUID(),
      name: "Check Login Success",
      type: "n8n-nodes-base.if",
      typeVersion: 1,
      position: [1250, 300]
    },
    
    // Nó para acessar área protegida (apenas em caso de sucesso)
    {
      parameters: {
        url: successUrl,
        method: "GET",
        authentication: "none",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: "User-Agent",
              value: userAgent
            },
            {
              name: "Cookie",
              value: "={{ $json.sessionCookies }}"
            },
            {
              name: "Accept",
              value: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
            }
          ]
        },
        options: {
          redirect: {
            redirect: {
              followRedirects: true,
              maxRedirects: 5
            }
          },
          timeout: 10000
        }
      },
      id: generateValidUUID(),
      name: "Acessar Área Protegida",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 3,
      position: [1450, 200]
    },
    
    // Nó para registrar sucesso do login
    {
      parameters: {
        functionCode: `
          // Registrar sucesso do login
          const protectedPageData = $input.all()[0];
          
          return {
            success: true,
            message: "Login realizado com sucesso!",
            url: protectedPageData.url || $input.responseUrl,
            statusCode: protectedPageData.statusCode,
            sessionCookies: $input.sessionCookies,
            timestamp: new Date().toISOString(),
            pageTitle: protectedPageData.body?.slice(0, 1000) || "Conteúdo da página protegida"
          };
        `
      },
      id: generateValidUUID(),
      name: "Login Success",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [1650, 200]
    },
    
    // Nó para registrar falha no login
    {
      parameters: {
        functionCode: `
          // Registrar falha no login
          return {
            success: false,
            message: "Falha no login. Verifique suas credenciais.",
            statusCode: $input.statusCode,
            url: $input.responseUrl,
            error: "Credenciais inválidas ou conta bloqueada",
            timestamp: new Date().toISOString()
          };
        `
      },
      id: generateValidUUID(),
      name: "Login Failed",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [1450, 400]
    }
  ];
  
  // Conexões entre os nós
  const connections = {
    "Verificar Site": {
      main: [
        [
          {
            node: "Extrair Dados do Formulário",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Extrair Dados do Formulário": {
      main: [
        [
          {
            node: "Enviar Login",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Enviar Login": {
      main: [
        [
          {
            node: "Verificar Resultado",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Verificar Resultado": {
      main: [
        [
          {
            node: "Check Login Success",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Check Login Success": {
      main: [
        [
          {
            node: "Acessar Área Protegida",
            type: "main",
            index: 0
          }
        ],
        [
          {
            node: "Login Failed",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Acessar Área Protegida": {
      main: [
        [
          {
            node: "Login Success",
            type: "main",
            index: 0
          }
        ]
      ]
    }
  };
  
  return createValidWorkflowStructure(name, nodes, connections);
} 