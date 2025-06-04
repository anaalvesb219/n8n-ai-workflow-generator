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
    const systemPrompt = `
      Você é um especialista em criar workflows n8n. Com base nos dados da página e nas instruções do usuário,
      sugira um workflow n8n completo e válido em formato JSON. O workflow deve:
      
      1. Seguir a estrutura correta do n8n (com nodes, connections, etc.)
      2. Incluir configurações realistas para cada nó
      3. Ser aplicável ao contexto da página analisada
      4. Atender às necessidades específicas mencionadas pelo usuário
      
      Retorne apenas o JSON do workflow, sem explicações adicionais.
    `;
    
    const pageDescription = JSON.stringify(pageData, null, 2);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `
        Dados da página:
        ${pageDescription}
        
        Instruções do usuário:
        ${userInstructions}
        
        Gere um workflow n8n válido para esta situação.
      `}
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