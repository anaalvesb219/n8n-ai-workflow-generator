// sidepanel/components/chat.js
// Componente para gerenciar o chat com a IA

import { aiService } from '../services/ai-service.js';
import { MESSAGE_TYPES } from '../../utils/constants.js';

/**
 * Classe para gerenciar o chat com a IA
 */
export class ChatComponent {
  constructor(chatContainerId, chatFormId) {
    this.chatContainer = document.getElementById(chatContainerId);
    this.chatForm = document.getElementById(chatFormId);
    this.messages = [];
    this.isProcessing = false;
    
    if (this.chatForm) {
      this.setupEventListeners();
    }
  }
  
  /**
   * Configura os event listeners para o formulário de chat
   */
  setupEventListeners() {
    this.chatForm.addEventListener('submit', (event) => {
      event.preventDefault();
      
      const messageInput = this.chatForm.querySelector('input[name="message"]');
      if (messageInput && messageInput.value.trim()) {
        this.sendMessage(messageInput.value);
        messageInput.value = '';
      }
    });
  }
  
  /**
   * Adiciona uma mensagem ao chat
   */
  addMessage(message, type = MESSAGE_TYPES.USER) {
    const messageObj = {
      id: Date.now().toString(),
      content: message,
      type,
      timestamp: new Date().toISOString()
    };
    
    this.messages.push(messageObj);
    this.renderMessage(messageObj);
    
    // Rolar para a última mensagem
    this.scrollToBottom();
    
    return messageObj;
  }
  
  /**
   * Renderiza uma mensagem no contêiner de chat
   */
  renderMessage(message) {
    if (!this.chatContainer) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message message-${message.type}`;
    messageElement.dataset.messageId = message.id;
    
    // Criar conteúdo da mensagem
    let contentHtml = '';
    
    switch (message.type) {
      case MESSAGE_TYPES.USER:
        contentHtml = `
          <div class="message-avatar user-avatar"></div>
          <div class="message-content">
            <div class="message-text">${this.formatMessageContent(message.content)}</div>
            <div class="message-time">${this.formatTimestamp(message.timestamp)}</div>
          </div>
        `;
        break;
        
      case MESSAGE_TYPES.AI:
        contentHtml = `
          <div class="message-avatar ai-avatar"></div>
          <div class="message-content">
            <div class="message-text">${this.formatMessageContent(message.content)}</div>
            <div class="message-time">${this.formatTimestamp(message.timestamp)}</div>
          </div>
        `;
        break;
        
      case MESSAGE_TYPES.SYSTEM:
        contentHtml = `
          <div class="message-content system-message">
            <div class="message-text">${message.content}</div>
          </div>
        `;
        break;
        
      case MESSAGE_TYPES.CODE:
        contentHtml = `
          <div class="message-content code-block">
            <pre><code>${message.content}</code></pre>
            <button class="copy-code-btn" data-code="${encodeURIComponent(message.content)}">Copiar</button>
          </div>
        `;
        break;
        
      case MESSAGE_TYPES.ERROR:
        contentHtml = `
          <div class="message-content error-message">
            <div class="message-text">${message.content}</div>
          </div>
        `;
        break;
        
      case MESSAGE_TYPES.WARNING:
        contentHtml = `
          <div class="message-content warning-message">
            <div class="message-text">${message.content}</div>
          </div>
        `;
        break;
        
      case MESSAGE_TYPES.SUCCESS:
        contentHtml = `
          <div class="message-content success-message">
            <div class="message-text">${message.content}</div>
          </div>
        `;
        break;
        
      case MESSAGE_TYPES.ACTION:
        contentHtml = `
          <div class="message-content action-message">
            <div class="message-text">${message.content}</div>
            <div class="action-buttons">
              ${this.renderActionButtons(message.actions)}
            </div>
          </div>
        `;
        break;
    }
    
    messageElement.innerHTML = contentHtml;
    
    // Adicionar event listeners para botões de copiar código
    if (message.type === MESSAGE_TYPES.CODE) {
      const copyBtn = messageElement.querySelector('.copy-code-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const code = decodeURIComponent(copyBtn.dataset.code);
          navigator.clipboard.writeText(code)
            .then(() => {
              copyBtn.textContent = 'Copiado!';
              setTimeout(() => {
                copyBtn.textContent = 'Copiar';
              }, 2000);
            })
            .catch(err => {
              console.error('Erro ao copiar código:', err);
            });
        });
      }
    }
    
    this.chatContainer.appendChild(messageElement);
  }
  
  /**
   * Renderiza botões de ação para mensagens do tipo ACTION
   */
  renderActionButtons(actions = []) {
    if (!actions || actions.length === 0) return '';
    
    return actions.map(action => `
      <button 
        class="action-btn" 
        data-action="${action.id || ''}"
        data-action-type="${action.type || ''}"
        data-action-data="${encodeURIComponent(JSON.stringify(action.data || {}))}"
      >
        ${action.label || 'Ação'}
      </button>
    `).join('');
  }
  
  /**
   * Formata o conteúdo da mensagem, convertendo URLs, código, etc.
   */
  formatMessageContent(content) {
    if (!content) return '';
    
    // Converter quebras de linha
    let formatted = content.replace(/\n/g, '<br>');
    
    // Converter URLs em links clicáveis
    formatted = formatted.replace(
      /(https?:\/\/[^\s]+)/g, 
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    // Destacar blocos de código inline
    formatted = formatted.replace(
      /`([^`]+)`/g,
      '<code>$1</code>'
    );
    
    return formatted;
  }
  
  /**
   * Formata o timestamp para exibição
   */
  formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  /**
   * Envia uma mensagem do usuário para o chat
   */
  async sendMessage(message) {
    if (this.isProcessing) {
      this.addMessage('Aguarde a resposta anterior ser processada...', MESSAGE_TYPES.WARNING);
      return;
    }
    
    this.isProcessing = true;
    
    // Adicionar mensagem do usuário
    this.addMessage(message, MESSAGE_TYPES.USER);
    
    try {
      // Preparar mensagens para enviar à API
      const chatMessages = this.messages
        .filter(msg => msg.type === MESSAGE_TYPES.USER || msg.type === MESSAGE_TYPES.AI)
        .map(msg => ({
          role: msg.type === MESSAGE_TYPES.USER ? 'user' : 'assistant',
          content: msg.content
        }));
      
      // Adicionar indicador de "digitando..."
      const loadingMsgId = this.addMessage('Gerando resposta...', MESSAGE_TYPES.SYSTEM).id;
      
      // Enviar para a API
      const response = await aiService.sendChatMessage(chatMessages);
      
      // Remover o indicador de "digitando..."
      this.removeMessage(loadingMsgId);
      
      // Adicionar resposta da IA
      this.addMessage(response.content, MESSAGE_TYPES.AI);
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      this.addMessage(`Erro: ${error.message}`, MESSAGE_TYPES.ERROR);
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Remove uma mensagem pelo ID
   */
  removeMessage(messageId) {
    const index = this.messages.findIndex(msg => msg.id === messageId);
    if (index !== -1) {
      this.messages.splice(index, 1);
    }
    
    // Remover do DOM
    const messageElement = this.chatContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      messageElement.remove();
    }
  }
  
  /**
   * Limpa o histórico de chat
   */
  clearChat() {
    this.messages = [];
    
    if (this.chatContainer) {
      this.chatContainer.innerHTML = '';
    }
  }
  
  /**
   * Rola o contêiner de chat para a última mensagem
   */
  scrollToBottom() {
    if (this.chatContainer) {
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }
  }
}

// Exportar o componente
export default ChatComponent; 