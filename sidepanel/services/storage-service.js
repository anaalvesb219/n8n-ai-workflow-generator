// sidepanel/services/storage-service.js
// Serviço para gerenciar o acesso ao storage da extensão

/**
 * Classe para gerenciar o armazenamento local da extensão
 */
export class StorageService {
  constructor() {
    this.defaultConfig = {
      visionApiKey: '',
      visionApiEndpoint: 'https://api.openai.com/v1/chat/completions',
      chatGptApiKey: '',
      chatGptModel: 'gpt-4-1106-preview',
      n8nUrl: 'http://localhost:5678',
      n8nApiKey: '',
      autoDetectApis: true,
      autoSaveHistory: true,
      maxHistoryItems: 20,
      theme: 'light'
    };
  }

  /**
   * Salva uma configuração no armazenamento
   * @param {Object} config - Objeto com as configurações a salvar
   */
  async saveConfig(config) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(config, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(true);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Obtém uma configuração do armazenamento
   * @param {string|Array} keys - Chave ou array de chaves para buscar
   */
  async getConfig(keys) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Inicializa as configurações padrão, se não existirem
   */
  async initializeDefaultConfig() {
    const currentConfig = await this.getConfig(Object.keys(this.defaultConfig));
    
    // Verificar e adicionar configurações ausentes
    const newConfig = {};
    let needsUpdate = false;
    
    Object.keys(this.defaultConfig).forEach(key => {
      if (currentConfig[key] === undefined) {
        newConfig[key] = this.defaultConfig[key];
        needsUpdate = true;
      }
    });
    
    if (needsUpdate) {
      await this.saveConfig(newConfig);
    }
    
    return {...currentConfig, ...newConfig};
  }

  /**
   * Salva um item no histórico de navegação
   * @param {Object} historyItem - Item a ser salvo no histórico
   */
  async addToHistory(historyItem) {
    try {
      const { navigationHistory = [], maxHistoryItems = 20 } = await this.getConfig(['navigationHistory', 'maxHistoryItems']);
      
      // Verificar se o item já existe no histórico
      const existingIndex = navigationHistory.findIndex(item => 
        item.url === historyItem.url && 
        item.title === historyItem.title
      );
      
      // Se existir, remover para adicionar na primeira posição
      if (existingIndex >= 0) {
        navigationHistory.splice(existingIndex, 1);
      }
      
      // Adicionar o novo item no início
      navigationHistory.unshift({
        ...historyItem,
        timestamp: new Date().toISOString()
      });
      
      // Limitar o tamanho do histórico
      const trimmedHistory = navigationHistory.slice(0, maxHistoryItems);
      
      // Salvar o histórico atualizado
      await this.saveConfig({ navigationHistory: trimmedHistory });
      
      return trimmedHistory;
    } catch (error) {
      console.error('Erro ao adicionar ao histórico:', error);
      throw error;
    }
  }

  /**
   * Remove um item do histórico de navegação
   * @param {number} index - Índice do item a ser removido
   */
  async removeFromHistory(index) {
    try {
      const { navigationHistory = [] } = await this.getConfig(['navigationHistory']);
      
      // Verificar se o índice é válido
      if (index < 0 || index >= navigationHistory.length) {
        throw new Error('Índice inválido');
      }
      
      // Remover o item
      navigationHistory.splice(index, 1);
      
      // Salvar o histórico atualizado
      await this.saveConfig({ navigationHistory });
      
      return navigationHistory;
    } catch (error) {
      console.error('Erro ao remover do histórico:', error);
      throw error;
    }
  }
  
  /**
   * Limpa todo o histórico de navegação
   */
  async clearHistory() {
    try {
      await this.saveConfig({ navigationHistory: [] });
      return [];
    } catch (error) {
      console.error('Erro ao limpar histórico:', error);
      throw error;
    }
  }

  /**
   * Salva um workflow na biblioteca
   * @param {Object} workflow - Workflow a ser salvo
   */
  async saveWorkflow(workflow) {
    try {
      const { savedWorkflows = [] } = await this.getConfig(['savedWorkflows']);
      
      // Verificar se o workflow já existe
      const existingIndex = savedWorkflows.findIndex(item => item.id === workflow.id);
      
      // Se existir, atualizar
      if (existingIndex >= 0) {
        savedWorkflows[existingIndex] = {
          ...workflow,
          lastUpdated: new Date().toISOString()
        };
      } else {
        // Adicionar novo
        savedWorkflows.push({
          ...workflow,
          created: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
      }
      
      // Salvar
      await this.saveConfig({ savedWorkflows });
      
      return savedWorkflows;
    } catch (error) {
      console.error('Erro ao salvar workflow:', error);
      throw error;
    }
  }

  /**
   * Remove um workflow da biblioteca
   * @param {string} workflowId - ID do workflow a ser removido
   */
  async removeWorkflow(workflowId) {
    try {
      const { savedWorkflows = [] } = await this.getConfig(['savedWorkflows']);
      
      // Filtrar o workflow a ser removido
      const updatedWorkflows = savedWorkflows.filter(workflow => workflow.id !== workflowId);
      
      // Salvar
      await this.saveConfig({ savedWorkflows: updatedWorkflows });
      
      return updatedWorkflows;
    } catch (error) {
      console.error('Erro ao remover workflow:', error);
      throw error;
    }
  }
}

// Exportar uma instância única do serviço
export const storageService = new StorageService(); 