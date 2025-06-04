// sidepanel/sidepanel.js
// Arquivo principal do sidepanel

import { ChatComponent } from './components/chat.js';
import { AnalysisComponent } from './components/analysis.js';
import { ConfigComponent } from './components/config.js';
import { storageService } from './services/storage-service.js';
import { MESSAGE_TYPES } from '../utils/constants.js';

// Componentes principais
let chatComponent;
let analysisComponent;
let configComponent;

// Inicializar a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
  initializeComponents();
  setupTabNavigation();
  setupEventListeners();
  checkForApiKeys();
  loadAnalysis();
});

/**
 * Inicializa os componentes principais
 */
function initializeComponents() {
  // Inicializar componente de chat
  chatComponent = new ChatComponent('chat-container', 'chat-form');
  
  // Inicializar componente de análise
  analysisComponent = new AnalysisComponent('analysis-container');
  
  // Inicializar componente de configuração
  configComponent = new ConfigComponent('config-container');
  configComponent.loadConfig();
}

/**
 * Configura a navegação por abas
 */
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remover classe ativa de todos os botões e conteúdos
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Adicionar classe ativa ao botão clicado
      button.classList.add('active');
      
      // Mostrar o conteúdo correspondente
      const tabId = button.dataset.tab;
      const tabContent = document.getElementById(`${tabId}-container`);
      if (tabContent) {
        tabContent.classList.add('active');
        
        // Executar ações específicas quando uma aba é ativada
        if (tabId === 'config') {
          configComponent.loadConfig();
        }
      }
    });
  });
}

/**
 * Configura os event listeners para as ações da aplicação
 */
function setupEventListeners() {
  // Botão de analisar página
  const analyzeBtn = document.getElementById('analyze-page-btn');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', () => {
      analysisComponent.requestPageAnalysis();
    });
  }
  
  // Botão de limpar chat
  const clearChatBtn = document.getElementById('clear-chat-btn');
  if (clearChatBtn) {
    clearChatBtn.addEventListener('click', () => {
      if (confirm('Deseja realmente limpar todo o histórico de chat?')) {
        chatComponent.clearChat();
      }
    });
  }
  
  // Configurar seções colapsáveis
  setupCollapsibleSections();
  
  // Botão de enviar para n8n
  const sendToN8nBtn = document.getElementById('send-to-n8n-btn');
  if (sendToN8nBtn) {
    sendToN8nBtn.addEventListener('click', () => {
      sendWorkflowToN8n();
    });
  }
  
  // Botão de copiar workflow
  const copyWorkflowBtn = document.getElementById('copy-workflow-btn');
  if (copyWorkflowBtn) {
    copyWorkflowBtn.addEventListener('click', () => {
      copyWorkflowToClipboard();
    });
  }
}

/**
 * Configura as seções colapsáveis
 */
function setupCollapsibleSections() {
  const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
  
  collapsibleHeaders.forEach(header => {
    header.addEventListener('click', () => {
      toggleCollapse(header);
    });
  });
}

/**
 * Alterna o estado de colapso de uma seção
 */
function toggleCollapse(headerElement) {
  const section = headerElement.closest('.collapsible-section');
  const content = section.querySelector('.collapsible-content');
  const icon = headerElement.querySelector('.collapse-icon');
  
  if (section.classList.contains('collapsed')) {
    // Expandir
    section.classList.remove('collapsed');
    content.style.maxHeight = content.scrollHeight + 'px';
    icon.textContent = '−';
  } else {
    // Colapsar
    section.classList.add('collapsed');
    content.style.maxHeight = '0';
    icon.textContent = '+';
  }
  
  // Salvar estado de colapso
  saveCollapseStates();
}

/**
 * Salva o estado de colapso das seções
 */
function saveCollapseStates() {
  const collapsedSections = {};
  const sections = document.querySelectorAll('.collapsible-section');
  
  sections.forEach(section => {
    const id = section.id;
    if (id) {
      collapsedSections[id] = section.classList.contains('collapsed');
    }
  });
  
  storageService.saveConfig({ collapsedSections });
}

/**
 * Restaura o estado de colapso das seções
 */
async function restoreCollapseStates() {
  try {
    const { collapsedSections = {} } = await storageService.getConfig(['collapsedSections']);
    
    Object.entries(collapsedSections).forEach(([id, isCollapsed]) => {
      const section = document.getElementById(id);
      if (section) {
        const header = section.querySelector('.collapsible-header');
        const content = section.querySelector('.collapsible-content');
        const icon = header?.querySelector('.collapse-icon');
        
        if (isCollapsed) {
          section.classList.add('collapsed');
          if (content) content.style.maxHeight = '0';
          if (icon) icon.textContent = '+';
        } else {
          section.classList.remove('collapsed');
          if (content) content.style.maxHeight = content.scrollHeight + 'px';
          if (icon) icon.textContent = '−';
        }
      }
    });
  } catch (error) {
    console.error('Erro ao restaurar estados de colapso:', error);
  }
}

/**
 * Verifica se as chaves de API estão configuradas
 */
async function checkForApiKeys() {
  try {
    const { visionApiKey, chatGptApiKey } = await storageService.getConfig([
      'visionApiKey',
      'chatGptApiKey'
    ]);
    
    if (!visionApiKey || !chatGptApiKey) {
      // Mostrar aviso sobre chaves faltantes
      showApiKeyWarning(!visionApiKey, !chatGptApiKey);
    }
  } catch (error) {
    console.error('Erro ao verificar chaves de API:', error);
  }
}

/**
 * Mostra aviso sobre chaves de API faltantes
 */
function showApiKeyWarning(missingVision, missingChat) {
  const warningElement = document.createElement('div');
  warningElement.className = 'api-key-warning';
  
  let message = 'Atenção: ';
  
  if (missingVision && missingChat) {
    message += 'As chaves de API Vision e ChatGPT não estão configuradas.';
  } else if (missingVision) {
    message += 'A chave da API Vision não está configurada.';
  } else if (missingChat) {
    message += 'A chave da API ChatGPT não está configurada.';
  }
  
  message += ' Algumas funcionalidades podem não funcionar corretamente.';
  
  warningElement.innerHTML = `
    <div class="warning-content">
      <div class="warning-icon">⚠️</div>
      <div class="warning-text">${message}</div>
      <button class="config-now-btn">Configurar agora</button>
      <button class="close-warning-btn">×</button>
    </div>
  `;
  
  // Adicionar ao DOM
  const mainContainer = document.querySelector('.main-container');
  if (mainContainer) {
    mainContainer.insertAdjacentElement('afterbegin', warningElement);
  } else {
    document.body.insertAdjacentElement('afterbegin', warningElement);
  }
  
  // Adicionar event listeners
  const configBtn = warningElement.querySelector('.config-now-btn');
  if (configBtn) {
    configBtn.addEventListener('click', () => {
      // Ir para a aba de configurações
      const configTab = document.querySelector('.tab-btn[data-tab="config"]');
      if (configTab) {
        configTab.click();
      }
      
      // Remover o aviso
      warningElement.remove();
    });
  }
  
  const closeBtn = warningElement.querySelector('.close-warning-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      warningElement.remove();
    });
  }
}

/**
 * Carrega a análise inicial da página
 */
function loadAnalysis() {
  // Iniciar com a aba de análise ativa
  const analysisTab = document.querySelector('.tab-btn[data-tab="analysis"]');
  if (analysisTab) {
    analysisTab.click();
  }
  
  // Verificar configuração para detectar APIs automaticamente
  storageService.getConfig(['autoDetectApis']).then(({ autoDetectApis }) => {
    if (autoDetectApis) {
      // Iniciar análise automaticamente
      analysisComponent.requestPageAnalysis();
    }
  });
}

/**
 * Copia o workflow para a área de transferência
 */
function copyWorkflowToClipboard() {
  const workflowJson = document.querySelector('.workflow-preview pre');
  if (workflowJson) {
    navigator.clipboard.writeText(workflowJson.textContent)
      .then(() => {
        // Mostrar confirmação
        const copyBtn = document.getElementById('copy-workflow-btn');
        if (copyBtn) {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = 'Copiado!';
          setTimeout(() => {
            copyBtn.textContent = originalText;
          }, 2000);
        }
      })
      .catch(err => {
        console.error('Erro ao copiar para o clipboard:', err);
        alert('Não foi possível copiar para o clipboard');
      });
  }
}

/**
 * Envia o workflow para o n8n
 */
async function sendWorkflowToN8n() {
  try {
    // Obter workflow
    const workflowJson = document.querySelector('.workflow-preview pre');
    if (!workflowJson) {
      throw new Error('Workflow não encontrado');
    }
    
    const workflow = JSON.parse(workflowJson.textContent);
    
    // Obter configurações do n8n
    const { n8nUrl, n8nApiKey } = await storageService.getConfig(['n8nUrl', 'n8nApiKey']);
    
    if (!n8nUrl) {
      throw new Error('URL do n8n não configurada. Configure nas opções da extensão.');
    }
    
    // Preparar a URL completa
    const apiUrl = `${n8nUrl}/rest/workflows`;
    
    // Enviar o workflow para o n8n
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(n8nApiKey ? { 'X-N8N-API-KEY': n8nApiKey } : {})
      },
      body: JSON.stringify(workflow)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Erro ao enviar para n8n: ${errorData.message || 'Erro desconhecido'}`);
    }
    
    const result = await response.json();
    
    // Mostrar mensagem de sucesso
    const sendBtn = document.getElementById('send-to-n8n-btn');
    if (sendBtn) {
      sendBtn.textContent = 'Enviado!';
      sendBtn.disabled = true;
      
      // Adicionar link para abrir o workflow no n8n
      const workflowUrl = `${n8nUrl}/workflow/${result.id}`;
      
      const linkContainer = document.createElement('div');
      linkContainer.className = 'workflow-link';
      linkContainer.innerHTML = `
        <a href="${workflowUrl}" target="_blank" class="n8n-link">
          Abrir no n8n
          <span class="external-link-icon">↗</span>
        </a>
      `;
      
      const actionsContainer = document.querySelector('.workflow-actions');
      if (actionsContainer) {
        actionsContainer.appendChild(linkContainer);
      }
    }
  } catch (error) {
    console.error('Erro ao enviar workflow para n8n:', error);
    alert(`Erro: ${error.message}`);
  }
} 