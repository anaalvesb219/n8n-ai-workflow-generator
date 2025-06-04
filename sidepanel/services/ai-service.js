// sidepanel/services/ai-service.js
// Serviço para interação com APIs de IA

import { storageService } from './storage-service.js';

/**
 * Classe para gerenciar interações com APIs de IA
 */
export class AIService {
  constructor() {
    this.isInitialized = false;
    this.config = null;
  }

  /**
   * Inicializa o serviço, carregando as configurações necessárias
   */
  async initialize() {
    if (this.isInitialized) return;
    
    // Carregar configurações de API
    this.config = await storageService.getConfig([
      'chatGptApiKey',
      'chatGptModel',
      'visionApiKey',
      'visionApiEndpoint'
    ]);
    
    this.isInitialized = true;
  }

  /**
   * Verifica se as chaves de API estão configuradas
   */
  async validateApiKeys() {
    await this.initialize();
    
    const missingKeys = [];
    
    if (!this.config.chatGptApiKey) {
      missingKeys.push('API GPT');
    }
    
    if (!this.config.visionApiKey) {
      missingKeys.push('API Vision');
    }
    
    return {
      valid: missingKeys.length === 0,
      missingKeys
    };
  }

  /**
   * Envia uma mensagem para a API do ChatGPT
   * @param {Array} messages - Array de mensagens para enviar
   */
  async sendChatMessage(messages) {
    await this.initialize();
    
    const validation = await this.validateApiKeys();
    if (!validation.valid) {
      throw new Error(`Chaves de API ausentes: ${validation.missingKeys.join(', ')}`);
    }
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.chatGptApiKey}`
        },
        body: JSON.stringify({
          model: this.config.chatGptModel || 'gpt-4-1106-preview',
          messages,
          temperature: 0.7,
          max_tokens: 1500
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Erro na API: ${errorData.error?.message || 'Erro desconhecido'}`);
      }
      
      const data = await response.json();
      return data.choices[0].message;
    } catch (error) {
      console.error('Erro ao enviar mensagem para ChatGPT:', error);
      throw error;
    }
  }

  /**
   * Analisa uma página com base nos dados fornecidos
   * @param {Object} pageData - Dados da página para análise
   */
  async analyzePage(pageData) {
    const systemPrompt = `
      Você é um assistente especializado em automação e workflows n8n. Sua tarefa é analisar os dados da página 
      e sugerir workflows de automação adequados. Concentre-se em:
      
      1. Identificar padrões comuns como formulários, APIs, tabelas, dashboards
      2. Sugerir automações relevantes para o contexto da página
      3. Explicar como essas automações poderiam ser implementadas usando n8n
      
      Seja específico e forneça exemplos práticos baseados nos dados observados.
    `;
    
    const pageDescription = JSON.stringify(pageData, null, 2);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analise esta página web:\n\n${pageDescription}` }
    ];
    
    return this.sendChatMessage(messages);
  }

  /**
   * Gera um workflow com base nos dados da página e nas instruções do usuário
   * @param {Object} pageData - Dados da página
   * @param {string} userInstructions - Instruções específicas do usuário
   */
  async generateWorkflow(pageData, userInstructions) {
    const pageDescription = JSON.stringify(pageData, null, 2);

    const systemPrompt = `
<persona>
Você é um arquiteto de automação especialista em n8n com 10 anos de experiência em:
- Criação de workflows de web scraping e integração
- Otimização de processos de extração de dados
- Design de automações robustas com tratamento de erros
- Padrões de arquitetura para workflows escaláveis
</persona>

<contexto>
Você está analisando uma página web para criar um workflow n8n que automatize tarefas baseadas nos elementos detectados. O usuário fornecerá dados estruturados sobre a página e instruções específicas do que deseja automatizar.
</contexto>

<dados_entrada>
${pageDescription}
</dados_entrada>

<instrucoes_usuario>
${userInstructions}
</instrucoes_usuario>

<objetivo>
Criar um workflow n8n completo, válido e importável que:
1. Atenda exatamente às necessidades do usuário
2. Seja 85% funcional (necessitando apenas ajustes de credenciais/URLs)
3. Siga as melhores práticas de design de workflows
4. Inclua tratamento básico de erros
5. Use entre 3-10 nós para manter simplicidade
</objetivo>

<regras_criticas>
## ⚠️ REGRAS OBRIGATÓRIAS

### Estrutura do Workflow
- **SEMPRE** incluir campos obrigatórios: id, name, nodes, connections, active, settings
- **SEMPRE** gerar UUIDs válidos no formato: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
- **SEMPRE** usar typeVersion correto para cada tipo de nó
- **SEMPRE** incluir position [x,y] para cada nó com espaçamento de 250px

### Nós Prioritários (usar sempre que possível)
1. **HTTP Request** (typeVersion: 3) - para requisições web
2. **Set** (typeVersion: 1) - para manipular dados
3. **IF** (typeVersion: 1) - para lógica condicional
4. **Schedule Trigger** (typeVersion: 1) - para execuções programadas
5. **Function** (typeVersion: 1) - para transformações simples

### Validações
- Cada nó DEVE ter um ID único
- Conexões DEVEM referenciar nós existentes
- JSON DEVE ser válido e bem formatado
- Workflow DEVE ter pelo menos um trigger
</regras_criticas>

<processo_raciocinio>
## 🧠 Chain of Thought - Processo de Criação

<thinking>
Antes de gerar o workflow, vou analisar:

1. **Análise da Página**
   - Que tipo de página é? (formulário, listagem, dashboard, etc.)
   - Quais elementos são relevantes para automação?
   - Existem APIs ou endpoints detectados?

2. **Objetivo do Usuário**
   - O que exatamente o usuário quer automatizar?
   - Qual a frequência de execução?
   - Onde os dados devem ser enviados?

3. **Arquitetura do Workflow**
   - Qual trigger é mais adequado?
   - Quais nós são necessários?
   - Como estruturar o fluxo de dados?
   - Onde adicionar tratamento de erros?

4. **Validação Mental**
   - O workflow está completo?
   - As conexões fazem sentido?
   - Os IDs são únicos?
   - O JSON é válido?
</thinking>
</processo_raciocinio>

<exemplos_few_shot>
## 📋 Exemplos de Referência

### Exemplo 1: Web Scraping para Google Sheets
<example>
<scenario>
Página com tabela de produtos, usuário quer extrair dados diariamente
</scenario>
<workflow_structure>
1. Schedule Trigger (diário às 9h)
2. HTTP Request (GET na página)
3. HTML Extract (extrair tabela)
4. Set (formatar dados)
5. Google Sheets (append rows)
6. IF (verificar sucesso)
7. Email Send (notificação)
</workflow_structure>
</example>

### Exemplo 2: Automação de Formulário
<example>
<scenario>
Formulário de contato detectado, enviar para CRM e email
</scenario>
<workflow_structure>
1. Webhook Trigger (receber dados)
2. Set (validar campos)
3. IF (campos válidos?)
4. HTTP Request (enviar para CRM)
5. Send Email (notificação interna)
6. Respond to Webhook (confirmação)
</workflow_structure>
</example>
</exemplos_few_shot>

<formato_resposta>
## 📤 Formato de Saída

Retorne APENAS um JSON válido neste formato:

```json
{
  "description": "Breve descrição do que o workflow faz (máx 2 linhas)",
  "workflow": {
    "id": "UUID-VALIDO-AQUI",
    "name": "Nome Descritivo do Workflow",
    "active": false,
    "nodes": [
      {
        "parameters": {},
        "id": "UUID-UNICO",
        "name": "Nome do Nó",
        "type": "n8n-nodes-base.tipo",
        "typeVersion": 1,
        "position": [250, 300]
      }
    ],
    "connections": {
      "Nome do Nó": {
        "main": [
          [
            {
              "node": "Próximo Nó",
              "type": "main",
              "index": 0
            }
          ]
        ]
      }
    },
    "settings": {
      "executionOrder": "v1"
    }
  },
  "setup_required": [
    "Configuração necessária 1",
    "Configuração necessária 2"
  ]
}
```
</formato_resposta>

<validacao_anti_alucinacao>
## 🛡️ Checklist de Validação

Antes de retornar, verifique:
- [ ] Todos os campos obrigatórios estão presentes
- [ ] UUIDs são únicos e válidos
- [ ] Conexões referenciam nós existentes
- [ ] Não há nós órfãos (desconectados)
- [ ] O trigger está presente e configurado
- [ ] JSON é válido (sem vírgulas extras, aspas corretas)
- [ ] Workflow tem entre 3-10 nós
- [ ] Usa apenas nós estáveis do n8n (não beta/deprecated)
</validacao_anti_alucinacao>

## 🎯 Instruções Finais

1. **Analise cuidadosamente** os dados da página e as instruções
2. **Pense passo a passo** usando o processo de raciocínio
3. **Crie um workflow simples e funcional** (não complique demais)
4. **Valide mentalmente** antes de gerar o JSON
5. **Retorne APENAS o JSON** sem explicações adicionais

Lembre-se: É melhor um workflow simples que funciona do que um complexo que falha!
`;

    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    const response = await this.sendChatMessage(messages);
    
    // Tentar extrair o JSON da resposta
    try {
      // Se a resposta já for JSON, retorná-la diretamente
      if (typeof response.content === 'object') return response.content;
      
      // Tentar extrair o bloco JSON da resposta
      const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/) || 
                     response.content.match(/```\n([\s\S]*?)\n```/) || 
                     response.content.match(/{[\s\S]*?}/);
                     
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      }
      
      throw new Error('Não foi possível extrair um workflow válido da resposta.');
    } catch (error) {
      console.error('Erro ao processar resposta do workflow:', error);
      throw error;
    }
  }

  /**
   * Analisa um screenshot usando a API Vision
   * @param {string} screenshotDataUrl - Screenshot em formato Data URL
   */
  async analyzeScreenshot(screenshotDataUrl) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'analyzeScreenshot', screenshot: screenshotDataUrl },
        response => {
          if (response && response.success) {
            resolve(response.analysis);
          } else {
            reject(new Error(response?.error || 'Falha na análise da imagem'));
          }
        }
      );
    });
  }
}

// Exportar uma instância única do serviço
export const aiService = new AIService(); 