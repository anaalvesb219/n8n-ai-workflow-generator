// generators/template-form.js
// Template para workflow de processamento de formulário de contato

import { generateValidUUID, createValidWorkflowStructure } from './workflow-generator.js';

/**
 * Modelo de workflow para processamento de formulário de contato
 * @param {Object} options - Opções para personalizar o workflow
 * @returns {Object} Workflow para processamento de formulário de contato
 */
export function createContactFormWorkflowTemplate(options = {}) {
  const {
    name = "Processamento de Formulário de Contato",
    emailTo = "contato@exemplo.com",
    sendConfirmation = true,
    saveToDatabase = true,
    requiredFields = ["name", "email", "message"],
    formFieldMapping = {
      name: ["name", "nome", "fullname", "full_name", "first_name", "firstName"],
      email: ["email", "mail", "e-mail", "emailaddress", "email_address"],
      message: ["message", "mensagem", "comments", "comentario", "body", "content", "text"],
      subject: ["subject", "assunto", "title", "titulo"],
      phone: ["phone", "telefone", "phonenumber", "phone_number", "celular", "mobile"]
    },
    formSpamProtection = true,
    maxAttachmentSizeMB = 10
  } = options;
  
  // Nós do workflow
  const nodes = [
    // Nó Webhook para receber dados do formulário
    {
      parameters: {
        path: "contact-form",
        responseMode: "onReceived",
        options: {
          allowedMethods: ["POST"],
          responseCode: 200,
          responseData: "responseNode",
          responseContentType: "application/json",
          responsePropertyName: "data",
          responseHeaders: {
            entries: [
              {
                name: "Access-Control-Allow-Origin",
                value: "*"
              }
            ]
          }
        }
      },
      id: generateValidUUID(),
      name: "Form Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 1,
      position: [250, 300],
      webhookId: generateValidUUID()
    },
    
    // Nó para extrair e mapear campos do formulário
    {
      parameters: {
        functionCode: `
          // Obter dados do formulário (pode vir em formatos diferentes)
          const formData = $input.body || $input.json || $input.query || $input.form || {};
          const files = $input.files || [];
          
          // Função para encontrar o valor de um campo com base no mapeamento
          function findFieldValue(mappings) {
            for (const fieldName of mappings) {
              if (formData[fieldName] !== undefined) {
                return formData[fieldName];
              }
            }
            return null;
          }
          
          // Mapear campos do formulário com base nos mapeamentos de nomes de campo
          const mappedFields = {
            name: findFieldValue(${JSON.stringify(formFieldMapping.name)}),
            email: findFieldValue(${JSON.stringify(formFieldMapping.email)}),
            message: findFieldValue(${JSON.stringify(formFieldMapping.message)}),
            subject: findFieldValue(${JSON.stringify(formFieldMapping.subject)}) || "Novo formulário de contato",
            phone: findFieldValue(${JSON.stringify(formFieldMapping.phone)}) || ""
          };
          
          // Adicionar metadados
          const metadata = {
            receivedAt: new Date().toISOString(),
            ipAddress: $input.headers['x-forwarded-for'] || $input.ip || 'unknown',
            userAgent: $input.headers['user-agent'] || 'unknown',
            origin: $input.headers['origin'] || $input.headers['referer'] || 'unknown',
            formData: formData
          };
          
          // Processar anexos, se houver
          const attachments = [];
          if (files && files.length > 0) {
            for (const file of files) {
              // Verificar tamanho do arquivo (em bytes, convertendo de MB)
              const maxSizeBytes = ${maxAttachmentSizeMB} * 1024 * 1024;
              
              if (file.size > maxSizeBytes) {
                attachments.push({
                  name: file.name,
                  error: \`Arquivo excede o tamanho máximo de ${maxAttachmentSizeMB}MB\`,
                  size: file.size
                });
              } else {
                attachments.push({
                  name: file.name,
                  type: file.mimetype,
                  size: file.size,
                  content: file.content || file.data || null
                });
              }
            }
          }
          
          return {
            ...mappedFields,
            originalData: formData,
            metadata,
            attachments,
            hasAttachments: attachments.length > 0
          };
        `
      },
      id: generateValidUUID(),
      name: "Extract Form Fields",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [450, 300]
    },
    
    // Nó para validar dados do formulário
    {
      parameters: {
        functionCode: `
          // Obter dados mapeados
          const data = $input;
          const requiredFields = ${JSON.stringify(requiredFields)};
          const errors = [];
          
          // Validar campos obrigatórios
          for (const field of requiredFields) {
            if (!data[field] || data[field].trim() === '') {
              errors.push(\`O campo \${field} é obrigatório\`);
            }
          }
          
          // Validar formato de email
          if (data.email) {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(data.email)) {
              errors.push('Email em formato inválido');
            }
          }
          
          // Validar tamanho mínimo da mensagem
          if (data.message && data.message.length < 10) {
            errors.push('A mensagem deve ter pelo menos 10 caracteres');
          }
          
          // Verificar por spam
          const isSpam = ${formSpamProtection} && checkForSpam(data);
          if (isSpam) {
            errors.push('Mensagem detectada como spam');
          }
          
          // Função para verificar spam
          function checkForSpam(data) {
            // Lista de padrões de spam comuns
            const spamPatterns = [
              /viagra/i,
              /\\bcasino\\b/i,
              /\\bloans\\b/i,
              /\\bmedication\\b/i,
              /\\bpharmacy\\b/i,
              /\\bdiscount\\b.*\\bviagra\\b/i,
              /\\bdiscount\\b.*\\bcialis\\b/i,
              /\\breplica\\b.*\\bwatches\\b/i,
              /\\breplica\\b.*\\bhandbags\\b/i,
              /\\blouis\\b.*\\bvuitton\\b/i,
              /\\bcialis\\b/i,
              /\\bcryptocurrenc(y|ies)\\b/i,
              /\\bbitcoin\\b/i,
              /\\btorrent\\b/i
            ];
            
            // Verificar padrões de spam na mensagem
            if (data.message) {
              for (const pattern of spamPatterns) {
                if (pattern.test(data.message)) {
                  return true;
                }
              }
            }
            
            // Verificar links excessivos (possível spam)
            const linkCount = (data.message.match(/https?:\\/\\//g) || []).length;
            if (linkCount > 5) {
              return true;
            }
            
            return false;
          }
          
          // Retornar resultado da validação
          return {
            ...data,
            isValid: errors.length === 0,
            isSpam,
            validationErrors: errors,
            validationTimestamp: new Date().toISOString()
          };
        `
      },
      id: generateValidUUID(),
      name: "Validate Form Data",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [650, 300]
    },
    
    // Nó de decisão para validação
    {
      parameters: {
        conditions: {
          boolean: [
            {
              value1: "={{ $json.isValid }}",
              value2: true
            }
          ]
        }
      },
      id: generateValidUUID(),
      name: "Check Validation",
      type: "n8n-nodes-base.if",
      typeVersion: 1,
      position: [850, 300]
    },
    
    // Nó para preparar resposta de erro
    {
      parameters: {
        functionCode: `
          // Preparar resposta de erro para o cliente
          return {
            success: false,
            errors: $input.validationErrors,
            message: "Falha na validação do formulário. Por favor, verifique os campos e tente novamente.",
            timestamp: new Date().toISOString()
          };
        `
      },
      id: generateValidUUID(),
      name: "Prepare Error Response",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [1050, 450]
    },
    
    // Nó para enviar email de notificação
    {
      parameters: {
        fromEmail: "noreply@example.com",
        toEmail: emailTo,
        subject: "={{ 'Novo formulário de contato: ' + $json.subject }}",
        text: `
          Nova mensagem recebida pelo formulário de contato:
          
          Nome: {{ $json.name }}
          Email: {{ $json.email }}
          Telefone: {{ $json.phone }}
          
          Mensagem:
          {{ $json.message }}
          
          Recebido em: {{ $json.metadata.receivedAt }}
          IP: {{ $json.metadata.ipAddress }}
          Navegador: {{ $json.metadata.userAgent }}
        `,
        options: {
          attachments: "={{ $json.hasAttachments ? $json.attachments.map(a => ({ name: a.name, data: a.content })) : [] }}"
        }
      },
      id: generateValidUUID(),
      name: "Send Notification Email",
      type: "n8n-nodes-base.emailSend",
      typeVersion: 1,
      position: [1050, 200]
    }
  ];
  
  // Adicionar nós condicionais com base nas opções
  
  // Nó para salvar no banco de dados (opcional)
  if (saveToDatabase) {
    nodes.push({
      parameters: {
        operation: "insert",
        table: "contact_forms",
        columns: {
          name: "={{ $json.name }}",
          email: "={{ $json.email }}",
          subject: "={{ $json.subject }}",
          message: "={{ $json.message }}",
          phone: "={{ $json.phone }}",
          created_at: "={{ $json.metadata.receivedAt }}",
          user_agent: "={{ $json.metadata.userAgent }}",
          ip_address: "={{ $json.metadata.ipAddress }}",
          has_attachments: "={{ $json.hasAttachments }}",
          is_spam: "={{ $json.isSpam }}"
        },
        additionalFields: {}
      },
      id: generateValidUUID(),
      name: "Save To Database",
      type: "n8n-nodes-base.postgres",
      typeVersion: 1,
      position: [1250, 200]
    });
  }
  
  // Nó para enviar email de confirmação para o usuário (opcional)
  if (sendConfirmation) {
    nodes.push({
      parameters: {
        fromEmail: "noreply@example.com",
        toEmail: "={{ $json.email }}",
        subject: "Recebemos sua mensagem",
        text: `
          Olá {{ $json.name }},
          
          Recebemos sua mensagem e agradecemos o contato.
          
          Este é um email automático para confirmar que sua mensagem foi recebida com sucesso.
          Responderemos o mais breve possível.
          
          Abaixo está uma cópia da sua mensagem:
          
          Assunto: {{ $json.subject }}
          
          {{ $json.message }}
          
          Atenciosamente,
          Equipe de Suporte
        `
      },
      id: generateValidUUID(),
      name: "Send Confirmation Email",
      type: "n8n-nodes-base.emailSend",
      typeVersion: 1,
      position: [1450, 200]
    });
  }
  
  // Nó para preparar resposta de sucesso
  nodes.push({
    parameters: {
      functionCode: `
        // Preparar resposta de sucesso para o cliente
        return {
          success: true,
          message: "Formulário enviado com sucesso. Obrigado pelo contato!",
          timestamp: new Date().toISOString(),
          reference: $input.metadata?.receivedAt || ''
        };
      `
    },
    id: generateValidUUID(),
    name: "Prepare Success Response",
    type: "n8n-nodes-base.function",
    typeVersion: 1,
    position: [1650, 200]
  });
  
  // Nó de resposta para o Webhook
  nodes.push({
    parameters: {
      respondWith: "json",
      responseData: "={{ $json }}",
      options: {}
    },
    id: generateValidUUID(),
    name: "Webhook Response",
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1,
    position: [1850, 300]
  });
  
  // Conexões entre os nós
  const connections = {
    "Form Webhook": {
      main: [
        [
          {
            node: "Extract Form Fields",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Extract Form Fields": {
      main: [
        [
          {
            node: "Validate Form Data",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Validate Form Data": {
      main: [
        [
          {
            node: "Check Validation",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Check Validation": {
      main: [
        [
          {
            node: "Send Notification Email",
            type: "main",
            index: 0
          }
        ],
        [
          {
            node: "Prepare Error Response",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Prepare Error Response": {
      main: [
        [
          {
            node: "Webhook Response",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Send Notification Email": {
      main: [
        [
          {
            node: saveToDatabase ? "Save To Database" : (sendConfirmation ? "Send Confirmation Email" : "Prepare Success Response"),
            type: "main",
            index: 0
          }
        ]
      ]
    }
  };
  
  // Adicionar conexões condicionais
  if (saveToDatabase && sendConfirmation) {
    connections["Save To Database"] = {
      main: [
        [
          {
            node: "Send Confirmation Email",
            type: "main",
            index: 0
          }
        ]
      ]
    };
    
    connections["Send Confirmation Email"] = {
      main: [
        [
          {
            node: "Prepare Success Response",
            type: "main",
            index: 0
          }
        ]
      ]
    };
  } else if (saveToDatabase) {
    connections["Save To Database"] = {
      main: [
        [
          {
            node: "Prepare Success Response",
            type: "main",
            index: 0
          }
        ]
      ]
    };
  } else if (sendConfirmation) {
    connections["Send Confirmation Email"] = {
      main: [
        [
          {
            node: "Prepare Success Response",
            type: "main",
            index: 0
          }
        ]
      ]
    };
  }
  
  // Adicionar conexão para a resposta final
  connections["Prepare Success Response"] = {
    main: [
      [
        {
          node: "Webhook Response",
          type: "main",
          index: 0
        }
      ]
    ]
  };
  
  return createValidWorkflowStructure(name, nodes, connections);
} 