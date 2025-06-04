// sidepanel/components/config.js
// Componente para gerenciar as configurações da extensão

import { storageService } from '../services/storage-service.js';
import { MESSAGE_TYPES } from '../../utils/constants.js';

/**
 * Classe para gerenciar as configurações da extensão
 */
export class ConfigComponent {
  constructor(configContainerId) {
    this.configContainer = document.getElementById(configContainerId);
    this.configFields = {};
    this.isSaving = false;
  }
  
  /**
   * Carrega as configurações e exibe o formulário
   */
  async loadConfig() {
    try {
      // Inicializar configurações padrão, se não existirem
      const config = await storageService.initializeDefaultConfig();
      
      // Exibir o formulário
      this.renderConfigForm(config);
      
      // Configurar event listeners
      this.setupConfigEventListeners();
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      this.showConfigError(error.message);
    }
  }
  
  /**
   * Renderiza o formulário de configurações
   */
  renderConfigForm(config) {
    if (!this.configContainer) return;
    
    this.configContainer.innerHTML = `
      <div class="config-form">
        <div class="config-header">
          <h2>Configurações</h2>
        </div>
        
        <form id="extension-config-form">
          <div class="config-section">
            <h3>APIs de IA</h3>
            
            <div class="form-group">
              <label for="visionApiKey">Chave da API Vision:</label>
              <div class="api-key-input">
                <input 
                  type="password" 
                  id="visionApiKey" 
                  name="visionApiKey" 
                  value="${config.visionApiKey || ''}" 
                  placeholder="Chave de API para análise de screenshots"
                />
                <button type="button" class="toggle-password-btn" data-for="visionApiKey">👁️</button>
              </div>
            </div>
            
            <div class="form-group">
              <label for="visionApiEndpoint">Endpoint da API Vision:</label>
              <input 
                type="text" 
                id="visionApiEndpoint" 
                name="visionApiEndpoint" 
                value="${config.visionApiEndpoint || 'https://api.openai.com/v1/chat/completions'}" 
                placeholder="URL do endpoint da API"
              />
            </div>
            
            <div class="form-group">
              <label for="chatGptApiKey">Chave da API ChatGPT:</label>
              <div class="api-key-input">
                <input 
                  type="password" 
                  id="chatGptApiKey" 
                  name="chatGptApiKey" 
                  value="${config.chatGptApiKey || ''}" 
                  placeholder="Chave de API para geração de workflow"
                />
                <button type="button" class="toggle-password-btn" data-for="chatGptApiKey">👁️</button>
              </div>
            </div>
            
            <div class="form-group">
              <label for="chatGptModel">Modelo do ChatGPT:</label>
              <select id="chatGptModel" name="chatGptModel">
                <option value="gpt-4-1106-preview" ${config.chatGptModel === 'gpt-4-1106-preview' ? 'selected' : ''}>GPT-4 Turbo</option>
                <option value="gpt-4" ${config.chatGptModel === 'gpt-4' ? 'selected' : ''}>GPT-4</option>
                <option value="gpt-3.5-turbo" ${config.chatGptModel === 'gpt-3.5-turbo' ? 'selected' : ''}>GPT-3.5 Turbo</option>
              </select>
            </div>
          </div>
          
          <div class="config-section">
            <h3>n8n</h3>
            
            <div class="form-group">
              <label for="n8nUrl">URL do n8n:</label>
              <input 
                type="text" 
                id="n8nUrl" 
                name="n8nUrl" 
                value="${config.n8nUrl || 'http://localhost:5678'}" 
                placeholder="URL da instância n8n"
              />
            </div>
            
            <div class="form-group">
              <label for="n8nApiKey">API Key do n8n (opcional):</label>
              <div class="api-key-input">
                <input 
                  type="password" 
                  id="n8nApiKey" 
                  name="n8nApiKey" 
                  value="${config.n8nApiKey || ''}" 
                  placeholder="Chave de API para acesso ao n8n"
                />
                <button type="button" class="toggle-password-btn" data-for="n8nApiKey">👁️</button>
              </div>
            </div>
          </div>
          
          <div class="config-section">
            <h3>Preferências</h3>
            
            <div class="form-group checkbox-group">
              <input 
                type="checkbox" 
                id="autoDetectApis" 
                name="autoDetectApis" 
                ${config.autoDetectApis ? 'checked' : ''}
              />
              <label for="autoDetectApis">Detectar APIs automaticamente</label>
            </div>
            
            <div class="form-group checkbox-group">
              <input 
                type="checkbox" 
                id="autoSaveHistory" 
                name="autoSaveHistory" 
                ${config.autoSaveHistory ? 'checked' : ''}
              />
              <label for="autoSaveHistory">Salvar histórico automaticamente</label>
            </div>
            
            <div class="form-group">
              <label for="maxHistoryItems">Número máximo de itens no histórico:</label>
              <input 
                type="number" 
                id="maxHistoryItems" 
                name="maxHistoryItems" 
                value="${config.maxHistoryItems || 20}" 
                min="5" 
                max="100"
              />
            </div>
            
            <div class="form-group">
              <label for="theme">Tema:</label>
              <select id="theme" name="theme">
                <option value="light" ${config.theme === 'light' ? 'selected' : ''}>Claro</option>
                <option value="dark" ${config.theme === 'dark' ? 'selected' : ''}>Escuro</option>
                <option value="system" ${config.theme === 'system' ? 'selected' : ''}>Sistema</option>
              </select>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="button" id="reset-config-btn" class="btn secondary-btn">Redefinir</button>
            <button type="submit" id="save-config-btn" class="btn primary-btn">Salvar</button>
          </div>
        </form>
        
        <div class="about-section">
          <h3>Sobre</h3>
          <p>n8n AI Workflow Generator v${config.version?.current || '1.3.0'}</p>
          <p>Última atualização: ${config.version?.lastUpdated || '2024-06-25'}</p>
          <div class="clear-data-actions">
            <button type="button" id="clear-history-btn" class="btn warning-btn">Limpar histórico</button>
            <button type="button" id="clear-saved-workflows-btn" class="btn warning-btn">Limpar workflows salvos</button>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Configura os event listeners para o formulário de configurações
   */
  setupConfigEventListeners() {
    const form = document.getElementById('extension-config-form');
    if (!form) return;
    
    // Botões para mostrar/ocultar senhas
    const toggleBtns = document.querySelectorAll('.toggle-password-btn');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const inputId = btn.dataset.for;
        const input = document.getElementById(inputId);
        
        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = '🔒';
        } else {
          input.type = 'password';
          btn.textContent = '👁️';
        }
      });
    });
    
    // Botão de reset
    const resetBtn = document.getElementById('reset-config-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetConfig());
    }
    
    // Botão de limpar histórico
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => this.clearHistory());
    }
    
    // Botão de limpar workflows salvos
    const clearWorkflowsBtn = document.getElementById('clear-saved-workflows-btn');
    if (clearWorkflowsBtn) {
      clearWorkflowsBtn.addEventListener('click', () => this.clearSavedWorkflows());
    }
    
    // Formulário de configurações
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.saveConfig();
    });
  }
  
  /**
   * Salva as configurações
   */
  async saveConfig() {
    if (this.isSaving) return;
    
    this.isSaving = true;
    const saveBtn = document.getElementById('save-config-btn');
    if (saveBtn) {
      saveBtn.textContent = 'Salvando...';
      saveBtn.disabled = true;
    }
    
    try {
      const form = document.getElementById('extension-config-form');
      if (!form) throw new Error('Formulário não encontrado');
      
      // Coletar valores do formulário
      const formData = new FormData(form);
      const config = {};
      
      // Processar cada campo
      for (const [key, value] of formData.entries()) {
        if (key === 'autoDetectApis' || key === 'autoSaveHistory') {
          config[key] = true; // Checkbox marcado
        } else if (key === 'maxHistoryItems') {
          config[key] = parseInt(value, 10);
        } else {
          config[key] = value;
        }
      }
      
      // Verificar checkboxes desmarcados (não incluídos no FormData)
      if (!formData.has('autoDetectApis')) config.autoDetectApis = false;
      if (!formData.has('autoSaveHistory')) config.autoSaveHistory = false;
      
      // Salvar configurações
      await storageService.saveConfig(config);
      
      // Mostrar mensagem de sucesso
      this.showConfigSuccess('Configurações salvas com sucesso');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      this.showConfigError(error.message);
    } finally {
      this.isSaving = false;
      const saveBtn = document.getElementById('save-config-btn');
      if (saveBtn) {
        saveBtn.textContent = 'Salvar';
        saveBtn.disabled = false;
      }
    }
  }
  
  /**
   * Reseta as configurações para os valores padrão
   */
  async resetConfig() {
    if (this.isSaving) return;
    
    if (!confirm('Deseja realmente redefinir todas as configurações para os valores padrão?')) {
      return;
    }
    
    this.isSaving = true;
    
    try {
      // Salvar configurações padrão
      await storageService.saveConfig(storageService.defaultConfig);
      
      // Recarregar o formulário
      this.loadConfig();
      
      // Mostrar mensagem de sucesso
      this.showConfigSuccess('Configurações redefinidas com sucesso');
    } catch (error) {
      console.error('Erro ao redefinir configurações:', error);
      this.showConfigError(error.message);
    } finally {
      this.isSaving = false;
    }
  }
  
  /**
   * Limpa o histórico de navegação
   */
  async clearHistory() {
    if (!confirm('Deseja realmente limpar todo o histórico de navegação?')) {
      return;
    }
    
    try {
      await storageService.clearHistory();
      this.showConfigSuccess('Histórico limpo com sucesso');
    } catch (error) {
      console.error('Erro ao limpar histórico:', error);
      this.showConfigError(error.message);
    }
  }
  
  /**
   * Limpa os workflows salvos
   */
  async clearSavedWorkflows() {
    if (!confirm('Deseja realmente limpar todos os workflows salvos?')) {
      return;
    }
    
    try {
      await storageService.saveConfig({ savedWorkflows: [] });
      this.showConfigSuccess('Workflows salvos limpos com sucesso');
    } catch (error) {
      console.error('Erro ao limpar workflows salvos:', error);
      this.showConfigError(error.message);
    }
  }
  
  /**
   * Mostra mensagem de erro
   */
  showConfigError(message) {
    // Remover mensagem anterior, se houver
    const existingMessage = document.querySelector('.config-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // Criar nova mensagem
    const messageElement = document.createElement('div');
    messageElement.className = 'config-message error-message';
    messageElement.innerHTML = `
      <div class="message-content">
        <div class="message-icon">⚠️</div>
        <div class="message-text">${message}</div>
        <button class="close-message-btn">×</button>
      </div>
    `;
    
    // Adicionar ao DOM
    const form = document.getElementById('extension-config-form');
    if (form) {
      form.insertAdjacentElement('beforebegin', messageElement);
    } else if (this.configContainer) {
      this.configContainer.insertAdjacentElement('afterbegin', messageElement);
    }
    
    // Adicionar event listener para fechar
    const closeBtn = messageElement.querySelector('.close-message-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => messageElement.remove());
    }
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.remove();
      }
    }, 5000);
  }
  
  /**
   * Mostra mensagem de sucesso
   */
  showConfigSuccess(message) {
    // Remover mensagem anterior, se houver
    const existingMessage = document.querySelector('.config-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // Criar nova mensagem
    const messageElement = document.createElement('div');
    messageElement.className = 'config-message success-message';
    messageElement.innerHTML = `
      <div class="message-content">
        <div class="message-icon">✓</div>
        <div class="message-text">${message}</div>
        <button class="close-message-btn">×</button>
      </div>
    `;
    
    // Adicionar ao DOM
    const form = document.getElementById('extension-config-form');
    if (form) {
      form.insertAdjacentElement('beforebegin', messageElement);
    } else if (this.configContainer) {
      this.configContainer.insertAdjacentElement('afterbegin', messageElement);
    }
    
    // Adicionar event listener para fechar
    const closeBtn = messageElement.querySelector('.close-message-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => messageElement.remove());
    }
    
    // Auto-remover após 3 segundos
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.remove();
      }
    }, 3000);
  }
}

// Exportar o componente
export default ConfigComponent; 