// sidepanel/components/analysis.js
// Componente para gerenciar a análise de páginas

import { aiService } from "../services/ai-service.js";
import { storageService } from "../services/storage-service.js";
import { MESSAGE_TYPES } from "../../utils/constants.js";

/**
 * Classe para gerenciar a análise de páginas
 */
export class AnalysisComponent {
  constructor(analysisContainerId) {
    this.analysisContainer = document.getElementById(analysisContainerId);
    this.currentPageData = null;
    this.isAnalyzing = false;
  }

  /**
   * Solicita análise da página atual
   */
  async requestPageAnalysis() {
    if (this.isAnalyzing) {
      this.showAnalysisError("Uma análise já está em andamento");
      return;
    }

    this.isAnalyzing = true;
    this.showAnalysisLoading();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error("Nenhuma aba ativa encontrada");
      
      // CORREÇÃO CRÍTICA: Injetar content script ANTES de enviar mensagem
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content-bundle.js']
        });
        console.log('Content script injetado com sucesso');
        
        // IMPORTANTE: Aguardar o script carregar
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (injectError) {
        console.log('Script já estava injetado ou erro:', injectError);
      }
      
      // Agora sim enviar a mensagem
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "analyzePage",
      });

      if (!response) {
        throw new Error("Nenhuma resposta do content script");
      }
      if (response.error) {
        throw new Error(response.error);
      }
      if (!response.analysis) {
        throw new Error("Não foi possível analisar a página");
      }
      
      this.currentPageData = response.analysis;
      
      await storageService.addToHistory({
        url: response.analysis.url,
        title: response.analysis.title,
        type: response.analysis.details?.pageType || "page",
        elements: {
          forms: response.analysis.forms,
          apis: response.analysis.apis?.endpoints?.length || 0,
          visualElements: Object.values(response.analysis.visualElements || {})
            .reduce((acc, curr) => acc + curr.length, 0)
        }
      });
      
      this.displayAnalysisResults(response.analysis);
    } catch (error) {
      console.error("Erro ao analisar página:", error);
      this.showAnalysisError(error.message);
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Mostra o indicador de carregamento da análise
   */
  showAnalysisLoading() {
    if (!this.analysisContainer) return;

    this.analysisContainer.innerHTML = `
      <div class="analysis-loading">
        <div class="spinner"></div>
        <p>Analisando página...</p>
      </div>
    `;
  }

  /**
   * Mostra mensagem de erro da análise
   */
  showAnalysisError(message) {
    if (!this.analysisContainer) return;

    this.analysisContainer.innerHTML = `
      <div class="analysis-error">
        <div class="error-icon">⚠️</div>
        <p>${message}</p>
        <button id="retry-analysis-btn" class="btn">Tentar novamente</button>
      </div>
    `;

    // Adicionar listener para o botão de tentar novamente
    const retryBtn = document.getElementById("retry-analysis-btn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => this.requestPageAnalysis());
    }
  }

  /**
   * Exibe os resultados da análise
   */
  displayAnalysisResults(analysis) {
    if (!this.analysisContainer) return;

    // Construir o HTML dos resultados
    let resultsHtml = `
      <div class="analysis-results">
        <div class="analysis-header">
          <h2>Análise de Página</h2>
          <button id="refresh-analysis-btn" class="btn">↻</button>
        </div>
        <div class="page-info">
          <h3>${analysis.title || "Página sem título"}</h3>
          <p class="page-url">${analysis.url}</p>
        </div>
    `;

    // Adicionar informações de tipo de página
    if (analysis.details?.pageType) {
      resultsHtml += `
        <div class="page-type">
          <span class="label">Tipo de página:</span>
          <span class="value">${this.getPageTypeName(analysis.details.pageType)}</span>
        </div>
      `;
    }

    // Resumo dos elementos
    resultsHtml += `
      <div class="elements-summary">
        <div class="element-count">
          <span class="count">${analysis.forms || 0}</span>
          <span class="label">Formulários</span>
        </div>
        <div class="element-count">
          <span class="count">${analysis.apis?.endpoints?.length || 0}</span>
          <span class="label">APIs</span>
        </div>
        <div class="element-count">
          <span class="count">${analysis.tables || 0}</span>
          <span class="label">Tabelas</span>
        </div>
        <div class="element-count">
          <span class="count">${Object.values(
            analysis.visualElements || {},
          ).reduce((acc, curr) => acc + curr.length, 0)}</span>
          <span class="label">Viz. Dados</span>
        </div>
      </div>
    `;

    // Seção colapsável para detalhes de formulários
    if (analysis.details?.forms && analysis.details.forms.length > 0) {
      resultsHtml += this.createCollapsibleSection(
        "forms",
        "Formulários",
        this.renderFormsDetails(analysis.details.forms),
      );
    }

    // Seção colapsável para APIs detectadas
    if (analysis.apis?.endpoints && analysis.apis.endpoints.length > 0) {
      resultsHtml += this.createCollapsibleSection(
        "apis",
        "APIs Detectadas",
        this.renderApisDetails(analysis.apis.endpoints),
      );
    }

    // Seção colapsável para webhooks detectados
    if (analysis.apis?.webhooks && analysis.apis.webhooks.length > 0) {
      resultsHtml += this.createCollapsibleSection(
        "webhooks",
        "Webhooks Detectados",
        this.renderWebhooksDetails(analysis.apis.webhooks),
      );
    }

    // Seção colapsável para elementos visuais
    if (analysis.visualElements) {
      const hasVisualElements = Object.values(analysis.visualElements).some(
        (arr) => arr.length > 0,
      );

      if (hasVisualElements) {
        resultsHtml += this.createCollapsibleSection(
          "visual-elements",
          "Elementos Visuais",
          this.renderVisualElementsDetails(analysis.visualElements),
        );
      }
    }

    // Botões de ação para sugerir workflows
    resultsHtml += `
      <div class="analysis-actions">
        <button id="generate-workflow-btn" class="btn primary-btn">Gerar Workflow</button>
        <button id="capture-screenshot-btn" class="btn">Analisar Screenshot</button>
      </div>
    `;

    // Fechar o container principal
    resultsHtml += `</div>`;

    // Atualizar o conteúdo
    this.analysisContainer.innerHTML = resultsHtml;

    // Configurar event listeners
    this.setupResultEventListeners();
  }

  /**
   * Configura event listeners para os elementos de resultado
   */
  setupResultEventListeners() {
    // Botão de atualizar análise
    const refreshBtn = document.getElementById("refresh-analysis-btn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => this.requestPageAnalysis());
    }

    // Botão de gerar workflow
    const generateBtn = document.getElementById("generate-workflow-btn");
    if (generateBtn) {
      generateBtn.addEventListener("click", () => this.showWorkflowOptions());
    }

    // Botão de analisar screenshot
    const screenshotBtn = document.getElementById("capture-screenshot-btn");
    if (screenshotBtn) {
      screenshotBtn.addEventListener("click", () =>
        this.captureAndAnalyzeScreenshot(),
      );
    }

    // Headers de seções colapsáveis
    const collapsibleHeaders = document.querySelectorAll(".collapsible-header");
    collapsibleHeaders.forEach((header) => {
      header.addEventListener("click", () => this.toggleCollapse(header));
    });
  }

  /**
   * Alterna o estado de colapso de uma seção
   */
  toggleCollapse(headerElement) {
    const section = headerElement.closest(".collapsible-section");
    const content = section.querySelector(".collapsible-content");
    const icon = headerElement.querySelector(".collapse-icon");

    if (section.classList.contains("collapsed")) {
      // Expandir
      section.classList.remove("collapsed");
      content.style.maxHeight = content.scrollHeight + "px";
      icon.textContent = "−";
    } else {
      // Colapsar
      section.classList.add("collapsed");
      content.style.maxHeight = "0";
      icon.textContent = "+";
    }
  }

  /**
   * Cria uma seção colapsável para os detalhes
   */
  createCollapsibleSection(id, title, content) {
    return `
      <div id="${id}-section" class="collapsible-section">
        <div class="collapsible-header">
          <span class="section-title">${title}</span>
          <span class="collapse-icon">−</span>
        </div>
        <div class="collapsible-content">
          ${content}
        </div>
      </div>
    `;
  }

  /**
   * Renderiza os detalhes dos formulários
   */
  renderFormsDetails(forms) {
    if (!forms || forms.length === 0)
      return "<p>Nenhum formulário detectado</p>";

    return forms
      .map(
        (form, index) => `
      <div class="form-details">
        <h4>Formulário ${index + 1}</h4>
        <div class="form-info">
          <p><strong>Action:</strong> ${form.action}</p>
          <p><strong>Método:</strong> ${form.method}</p>
          <p><strong>Campos:</strong></p>
          <ul class="form-fields">
            ${form.fields
              .map(
                (field) => `
              <li>
                <span class="field-type">${field.type}</span>
                <span class="field-name">${field.name}</span>
                ${field.required ? '<span class="required-badge">Obrigatório</span>' : ""}
              </li>
            `,
              )
              .join("")}
          </ul>
        </div>
      </div>
    `,
      )
      .join("");
  }

  /**
   * Renderiza os detalhes das APIs
   */
  renderApisDetails(apis) {
    if (!apis || apis.length === 0) return "<p>Nenhuma API detectada</p>";

    return `
      <ul class="api-list">
        ${apis
          .map(
            (api) => `
          <li class="api-item">
            <span class="api-method ${api.method.toLowerCase()}">${api.method}</span>
            <span class="api-url">${api.url}</span>
            ${api.type ? `<span class="api-type">${api.type}</span>` : ""}
          </li>
        `,
          )
          .join("")}
      </ul>
    `;
  }

  /**
   * Renderiza os detalhes dos webhooks
   */
  renderWebhooksDetails(webhooks) {
    if (!webhooks || webhooks.length === 0)
      return "<p>Nenhum webhook detectado</p>";

    return `
      <ul class="webhook-list">
        ${webhooks
          .map(
            (webhook) => `
          <li class="webhook-item">
            <span class="webhook-method ${webhook.method.toLowerCase()}">${webhook.method}</span>
            <span class="webhook-url">${webhook.url}</span>
          </li>
        `,
          )
          .join("")}
      </ul>
    `;
  }

  /**
   * Renderiza os detalhes dos elementos visuais
   */
  renderVisualElementsDetails(visualElements) {
    const {
      charts = [],
      dashboards = [],
      dataVisualizations = [],
    } = visualElements;

    if (
      charts.length === 0 &&
      dashboards.length === 0 &&
      dataVisualizations.length === 0
    ) {
      return "<p>Nenhum elemento visual detectado</p>";
    }

    let html = "";

    // Renderizar gráficos
    if (charts.length > 0) {
      html += `
        <div class="visual-section">
          <h4>Gráficos (${charts.length})</h4>
          <ul class="visual-list">
            ${charts
              .map(
                (chart) => `
              <li class="visual-item">
                <span class="visual-id">${chart.id}</span>
                <span class="visual-size">${chart.width}×${chart.height}</span>
              </li>
            `,
              )
              .join("")}
          </ul>
        </div>
      `;
    }

    // Renderizar dashboards
    if (dashboards.length > 0) {
      html += `
        <div class="visual-section">
          <h4>Dashboards (${dashboards.length})</h4>
          <ul class="visual-list">
            ${dashboards
              .map(
                (dashboard) => `
              <li class="visual-item">
                <span class="visual-id">${dashboard.id}</span>
                <span class="visual-elements">${dashboard.children} elementos</span>
              </li>
            `,
              )
              .join("")}
          </ul>
        </div>
      `;
    }

    // Renderizar visualizações de dados
    if (dataVisualizations.length > 0) {
      html += `
        <div class="visual-section">
          <h4>Visualizações de Dados (${dataVisualizations.length})</h4>
          <ul class="visual-list">
            ${dataVisualizations
              .map(
                (viz) => `
              <li class="visual-item">
                <span class="visual-id">${viz.id}</span>
                <span class="visual-type">${viz.type}</span>
                <span class="visual-elements">${viz.children} elementos</span>
              </li>
            `,
              )
              .join("")}
          </ul>
        </div>
      `;
    }

    return html;
  }

  /**
   * Captura e analisa screenshot da página
   */
  async captureAndAnalyzeScreenshot() {
    if (this.isAnalyzing) {
      this.showAnalysisError("Uma análise já está em andamento");
      return;
    }

    this.isAnalyzing = true;
    this.showAnalysisLoading();

    try {
      // Verificar se a API Vision está configurada
      const { visionApiKey } = await storageService.getConfig(["visionApiKey"]);
      if (!visionApiKey) {
        throw new Error(
          "Chave da API Vision não configurada. Configure nas opções da extensão.",
        );
      }

      // Enviar mensagem para o content script capturar screenshot
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "captureScreenshot",
      });

      if (!response || !response.screenshot) {
        throw new Error("Não foi possível capturar o screenshot");
      }

      // Mostrar o screenshot capturado
      this.showScreenshotLoading(response.screenshot);

      // Analisar o screenshot com a API Vision
      const analysis = await aiService.analyzeScreenshot(response.screenshot);

      // Exibir os resultados da análise
      this.displayScreenshotAnalysis(response.screenshot, analysis);
    } catch (error) {
      console.error("Erro ao analisar screenshot:", error);
      this.showAnalysisError(error.message);
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Mostra o screenshot capturado com carregamento
   */
  showScreenshotLoading(screenshotUrl) {
    if (!this.analysisContainer) return;

    this.analysisContainer.innerHTML = `
      <div class="screenshot-analysis">
        <div class="screenshot-container">
          <img src="${screenshotUrl}" alt="Screenshot da página" class="screenshot-image" />
          <div class="screenshot-overlay">
            <div class="spinner"></div>
            <p>Analisando imagem com IA...</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Exibe os resultados da análise de screenshot
   */
  displayScreenshotAnalysis(screenshotUrl, analysis) {
    if (!this.analysisContainer) return;

    let resultsHtml = `
      <div class="screenshot-analysis">
        <div class="analysis-header">
          <h2>Análise Visual</h2>
          <button id="back-to-analysis-btn" class="btn">↩</button>
        </div>
        <div class="screenshot-container">
          <img src="${screenshotUrl}" alt="Screenshot da página" class="screenshot-image" />
        </div>
    `;

    // Processar a análise
    if (analysis) {
      // Determinar se temos uma estrutura JSON ou texto bruto
      if (analysis.rawAnalysis) {
        // Temos apenas texto bruto
        resultsHtml += `
          <div class="ai-analysis-text">
            <h3>Análise da IA</h3>
            <div class="analysis-content">${analysis.rawAnalysis.replace(/\n/g, "<br>")}</div>
          </div>
        `;
      } else {
        // Temos uma estrutura JSON
        resultsHtml += `
          <div class="ai-analysis-structured">
            <h3>Análise da IA</h3>
            
            ${
              analysis.pageType
                ? `
              <div class="analysis-section">
                <h4>Tipo de Página</h4>
                <p>${analysis.pageType}</p>
              </div>
            `
                : ""
            }
            
            ${
              analysis.elements
                ? `
              <div class="analysis-section">
                <h4>Elementos Principais</h4>
                <ul>
                  ${
                    Array.isArray(analysis.elements)
                      ? analysis.elements
                          .map((elem) => `<li>${elem}</li>`)
                          .join("")
                      : Object.entries(analysis.elements)
                          .map(
                            ([key, value]) =>
                              `<li><strong>${key}:</strong> ${value}</li>`,
                          )
                          .join("")
                  }
                </ul>
              </div>
            `
                : ""
            }
            
            ${
              analysis.visualizations
                ? `
              <div class="analysis-section">
                <h4>Visualizações</h4>
                <ul>
                  ${
                    Array.isArray(analysis.visualizations)
                      ? analysis.visualizations
                          .map((viz) => `<li>${viz}</li>`)
                          .join("")
                      : Object.entries(analysis.visualizations)
                          .map(
                            ([key, value]) =>
                              `<li><strong>${key}:</strong> ${value}</li>`,
                          )
                          .join("")
                  }
                </ul>
              </div>
            `
                : ""
            }
            
            ${
              analysis.forms
                ? `
              <div class="analysis-section">
                <h4>Formulários</h4>
                <ul>
                  ${
                    Array.isArray(analysis.forms)
                      ? analysis.forms
                          .map((form) => `<li>${form}</li>`)
                          .join("")
                      : Object.entries(analysis.forms)
                          .map(
                            ([key, value]) =>
                              `<li><strong>${key}:</strong> ${value}</li>`,
                          )
                          .join("")
                  }
                </ul>
              </div>
            `
                : ""
            }
            
            ${
              analysis.automationPoints
                ? `
              <div class="analysis-section">
                <h4>Pontos de Automação</h4>
                <ul>
                  ${
                    Array.isArray(analysis.automationPoints)
                      ? analysis.automationPoints
                          .map((point) => `<li>${point}</li>`)
                          .join("")
                      : Object.entries(analysis.automationPoints)
                          .map(
                            ([key, value]) =>
                              `<li><strong>${key}:</strong> ${value}</li>`,
                          )
                          .join("")
                  }
                </ul>
              </div>
            `
                : ""
            }
          </div>
        `;
      }
    } else {
      resultsHtml += `
        <div class="ai-analysis-error">
          <p>Não foi possível obter uma análise detalhada.</p>
        </div>
      `;
    }

    // Adicionar botões de ação
    resultsHtml += `
      <div class="analysis-actions">
        <button id="generate-workflow-btn" class="btn primary-btn">Gerar Workflow</button>
        <button id="retry-screenshot-btn" class="btn">Capturar Novamente</button>
      </div>
    `;

    // Fechar o container principal
    resultsHtml += `</div>`;

    // Atualizar o conteúdo
    this.analysisContainer.innerHTML = resultsHtml;

    // Configurar event listeners
    const backBtn = document.getElementById("back-to-analysis-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        if (this.currentPageData) {
          this.displayAnalysisResults(this.currentPageData);
        } else {
          this.requestPageAnalysis();
        }
      });
    }

    const generateBtn = document.getElementById("generate-workflow-btn");
    if (generateBtn) {
      generateBtn.addEventListener("click", () => this.showWorkflowOptions());
    }

    const retryBtn = document.getElementById("retry-screenshot-btn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () =>
        this.captureAndAnalyzeScreenshot(),
      );
    }
  }

  /**
   * Mostra opções para geração de workflow
   */
  showWorkflowOptions() {
    // Verificar se temos dados de página
    if (
      !this.currentPageData &&
      !this.analysisContainer.querySelector(".screenshot-image")
    ) {
      this.showAnalysisError("É necessário analisar a página primeiro");
      return;
    }

    // Criar modal com opções
    const modal = document.createElement("div");
    modal.className = "workflow-options-modal";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Gerar Workflow</h3>
          <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <p>Escolha um tipo de workflow para gerar:</p>
          
          <div class="workflow-options">
            <div class="workflow-option" data-type="login">
              <div class="option-icon">🔑</div>
              <div class="option-name">Login</div>
              <div class="option-desc">Automatizar processo de login</div>
            </div>
            
            <div class="workflow-option" data-type="api">
              <div class="option-icon">📊</div>
              <div class="option-name">API Scraping</div>
              <div class="option-desc">Extrair dados de APIs</div>
            </div>
            
            <div class="workflow-option" data-type="form">
              <div class="option-icon">📝</div>
              <div class="option-name">Formulário</div>
              <div class="option-desc">Processar formulário de contato</div>
            </div>
            
            <div class="workflow-option" data-type="custom">
              <div class="option-icon">⚙️</div>
              <div class="option-name">Personalizado</div>
              <div class="option-desc">Especificar necessidades</div>
            </div>
          </div>
          
          <div class="custom-workflow-container" style="display: none;">
            <label for="custom-workflow-desc">Descreva o workflow desejado:</label>
            <textarea id="custom-workflow-desc" rows="4" placeholder="Ex: Quero um workflow que monitore novas postagens no blog e as envie para o Slack"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn cancel-btn">Cancelar</button>
          <button class="btn primary-btn generate-btn">Gerar</button>
        </div>
      </div>
    `;

    // Adicionar ao DOM
    document.body.appendChild(modal);

    // Configurar event listeners
    const closeBtn = modal.querySelector(".close-btn");
    const cancelBtn = modal.querySelector(".cancel-btn");
    const generateBtn = modal.querySelector(".generate-btn");
    const workflowOptions = modal.querySelectorAll(".workflow-option");
    const customContainer = modal.querySelector(".custom-workflow-container");

    // Fechar modal
    const closeModal = () => {
      modal.remove();
    };

    closeBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);

    // Selecionar opção
    let selectedType = null;

    workflowOptions.forEach((option) => {
      option.addEventListener("click", () => {
        // Remover seleção anterior
        workflowOptions.forEach((opt) => opt.classList.remove("selected"));

        // Adicionar nova seleção
        option.classList.add("selected");
        selectedType = option.dataset.type;

        // Mostrar textarea para opção personalizada
        if (selectedType === "custom") {
          customContainer.style.display = "block";
        } else {
          customContainer.style.display = "none";
        }
      });
    });

    // Gerar workflow
    generateBtn.addEventListener("click", () => {
      if (!selectedType) {
        alert("Selecione um tipo de workflow");
        return;
      }

      let customDescription = "";
      if (selectedType === "custom") {
        customDescription = modal
          .querySelector("#custom-workflow-desc")
          .value.trim();
        if (!customDescription) {
          alert("Por favor, descreva o workflow desejado");
          return;
        }
      }

      // Fechar o modal
      closeModal();

      // Gerar o workflow
      this.generateWorkflow(selectedType, customDescription);
    });
  }

  /**
   * Gera um workflow com base no tipo selecionado
   */
  async generateWorkflow(workflowType, customDescription = "") {
    if (!this.analysisContainer) return;

    // Mostrar indicador de carregamento
    this.analysisContainer.innerHTML = `
      <div class="workflow-generation">
        <div class="generation-loading">
          <div class="spinner"></div>
          <p>Gerando workflow de ${this.getWorkflowTypeName(workflowType)}...</p>
        </div>
      </div>
    `;

    try {
      // Preparar os dados para gerar o workflow
      const pageData = this.currentPageData || {};

      // Se estamos com uma análise de screenshot, incluir esses dados
      const screenshotImg = document.querySelector(".screenshot-image");
      if (screenshotImg) {
        pageData.visualAnalysis = {
          screenshot: true,
          // Incluir quaisquer dados de análise visual que tenhamos
        };
      }

      // Preparar instruções com base no tipo
      let instructions = "";

      switch (workflowType) {
        case "login":
          instructions =
            "Crie um workflow para automatizar o processo de login nesta página";
          break;
        case "api":
          instructions =
            "Crie um workflow para extrair dados das APIs detectadas nesta página";
          break;
        case "form":
          instructions =
            "Crie um workflow para processar submissões do formulário de contato nesta página";
          break;
        case "custom":
          instructions = customDescription;
          break;
      }

      // Gerar o workflow usando a IA
      const workflow = await aiService.generateWorkflow(pageData, instructions);

      // Exibir o workflow gerado
      this.displayGeneratedWorkflow(workflow, workflowType);
    } catch (error) {
      console.error("Erro ao gerar workflow:", error);
      this.showGenerationError(error.message);
    }
  }

  /**
   * Mostra erro de geração de workflow
   */
  showGenerationError(message) {
    if (!this.analysisContainer) return;

    this.analysisContainer.innerHTML = `
      <div class="workflow-generation">
        <div class="generation-error">
          <div class="error-icon">⚠️</div>
          <p>${message}</p>
          <button id="back-to-analysis-btn" class="btn">Voltar à Análise</button>
        </div>
      </div>
    `;

    // Adicionar listener para o botão de voltar
    const backBtn = document.getElementById("back-to-analysis-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        if (this.currentPageData) {
          this.displayAnalysisResults(this.currentPageData);
        } else {
          this.requestPageAnalysis();
        }
      });
    }
  }

  /**
   * Exibe o workflow gerado
   */
  displayGeneratedWorkflow(workflow, workflowType) {
    if (!this.analysisContainer) return;

    // Verificar se o workflow é válido
    if (!workflow || !workflow.nodes || !workflow.connections) {
      this.showGenerationError("O workflow gerado não é válido");
      return;
    }

    // Formatar o JSON do workflow para exibição
    const formattedJson = JSON.stringify(workflow, null, 2);

    // Criar o HTML para exibir o workflow
    this.analysisContainer.innerHTML = `
      <div class="workflow-result">
        <div class="workflow-header">
          <h2>Workflow: ${workflow.name || this.getWorkflowTypeName(workflowType)}</h2>
          <button id="back-to-analysis-btn" class="btn">↩</button>
        </div>
        
        <div class="workflow-info">
          <p class="workflow-description">${workflow.description || "Workflow gerado por IA"}</p>
          <div class="workflow-meta">
            <span class="workflow-nodes">${workflow.nodes.length} nós</span>
            <span class="workflow-id">ID: ${workflow.id.substring(0, 8)}...</span>
          </div>
        </div>
        
        <div class="workflow-preview">
          <pre><code>${formattedJson}</code></pre>
        </div>
        
        <div class="workflow-actions">
          <button id="copy-workflow-btn" class="btn">Copiar JSON</button>
          <button id="send-to-n8n-btn" class="btn primary-btn">Enviar para n8n</button>
          <button id="save-workflow-btn" class="btn">Salvar</button>
        </div>
      </div>
    `;

    // Configurar event listeners
    const backBtn = document.getElementById("back-to-analysis-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        if (this.currentPageData) {
          this.displayAnalysisResults(this.currentPageData);
        } else {
          this.requestPageAnalysis();
        }
      });
    }

    const copyBtn = document.getElementById("copy-workflow-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        navigator.clipboard
          .writeText(formattedJson)
          .then(() => {
            copyBtn.textContent = "Copiado!";
            setTimeout(() => {
              copyBtn.textContent = "Copiar JSON";
            }, 2000);
          })
          .catch((err) => {
            console.error("Erro ao copiar para o clipboard:", err);
            alert("Não foi possível copiar para o clipboard");
          });
      });
    }

    const sendBtn = document.getElementById("send-to-n8n-btn");
    if (sendBtn) {
      sendBtn.addEventListener("click", () => this.sendWorkflowToN8n(workflow));
    }

    const saveBtn = document.getElementById("save-workflow-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => this.saveWorkflow(workflow));
    }
  }

  /**
   * Envia o workflow para o n8n
   */
  async sendWorkflowToN8n(workflow) {
    try {
      // Obter configurações do n8n
      const { n8nUrl, n8nApiKey } = await storageService.getConfig([
        "n8nUrl",
        "n8nApiKey",
      ]);

      if (!n8nUrl) {
        throw new Error(
          "URL do n8n não configurada. Configure nas opções da extensão.",
        );
      }

      // Preparar a URL completa
      const apiUrl = `${n8nUrl}/rest/workflows`;

      // Enviar o workflow para o n8n
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(n8nApiKey ? { "X-N8N-API-KEY": n8nApiKey } : {}),
        },
        body: JSON.stringify(workflow),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Erro ao enviar para n8n: ${errorData.message || "Erro desconhecido"}`,
        );
      }

      const result = await response.json();

      // Mostrar mensagem de sucesso
      const sendBtn = document.getElementById("send-to-n8n-btn");
      if (sendBtn) {
        sendBtn.textContent = "Enviado!";
        sendBtn.classList.add("success-btn");

        // Adicionar link para abrir o workflow no n8n
        const workflowUrl = `${n8nUrl}/workflow/${result.id}`;

        const linkContainer = document.createElement("div");
        linkContainer.className = "workflow-link";
        linkContainer.innerHTML = `
          <a href="${workflowUrl}" target="_blank" class="n8n-link">
            Abrir no n8n
            <span class="external-link-icon">↗</span>
          </a>
        `;

        const actionsContainer = document.querySelector(".workflow-actions");
        actionsContainer.appendChild(linkContainer);
      }
    } catch (error) {
      console.error("Erro ao enviar workflow para n8n:", error);
      alert(`Erro: ${error.message}`);
    }
  }

  /**
   * Salva o workflow na biblioteca local
   */
  async saveWorkflow(workflow) {
    try {
      await storageService.saveWorkflow(workflow);

      // Mostrar mensagem de sucesso
      const saveBtn = document.getElementById("save-workflow-btn");
      if (saveBtn) {
        saveBtn.textContent = "Salvo!";
        saveBtn.classList.add("success-btn");
      }
    } catch (error) {
      console.error("Erro ao salvar workflow:", error);
      alert(`Erro: ${error.message}`);
    }
  }

  /**
   * Obtém o nome amigável do tipo de página
   */
  getPageTypeName(pageType) {
    const typeNames = {
      login: "Login",
      signup: "Cadastro",
      checkout: "Checkout",
      contact: "Contato",
      search: "Busca",
      product: "Produto",
      listing: "Listagem",
      cart: "Carrinho",
      payment: "Pagamento",
      account: "Conta",
      dashboard: "Dashboard",
      ecommerce: "E-commerce",
    };

    return typeNames[pageType] || pageType;
  }

  /**
   * Obtém o nome amigável do tipo de workflow
   */
  getWorkflowTypeName(workflowType) {
    const typeNames = {
      login: "Login",
      api: "API Scraping",
      form: "Formulário de Contato",
      custom: "Personalizado",
    };

    return typeNames[workflowType] || workflowType;
  }
}

// Exportar o componente
export default AnalysisComponent;
