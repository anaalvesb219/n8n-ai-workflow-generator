// generators/workflow-generator.js
// Funções principais para geração de workflows n8n

/**
 * Gera um UUID v4 válido
 */
export function generateValidUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Cria uma estrutura base de workflow n8n válida
 */
export function createValidWorkflowStructure(name = "Workflow Gerado por IA", description = "") {
  const workflowId = generateValidUUID();
  
  return {
    id: workflowId,
    name: name,
    description: description,
    active: false,
    settings: {
      executionOrder: "v1",
      saveManualExecutions: true,
      callerPolicy: "workflowsFromSameOwner",
      errorWorkflow: "",
      saveDataErrorExecution: "all",
      saveExecutionProgress: true,
      saveDataSuccessExecution: "all"
    },
    nodes: [],
    connections: {},
    pinData: {},
    staticData: null,
    tags: ["generated", "ai"],
    triggerCount: 0,
    versionId: generateValidUUID()
  };
}

/**
 * Valida se um workflow n8n está no formato correto
 */
export function validateWorkflow(workflow) {
  // Validação básica
  if (!workflow) return { valid: false, errors: ["Workflow indefinido"] };
  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    return { valid: false, errors: ["Nós do workflow inválidos"] };
  }
  if (!workflow.connections || typeof workflow.connections !== 'object') {
    return { valid: false, errors: ["Conexões do workflow inválidas"] };
  }
  
  // Verificar IDs
  if (!workflow.id || typeof workflow.id !== 'string') {
    return { valid: false, errors: ["ID do workflow inválido"] };
  }
  
  // Verificar nós e conexões
  const nodeIds = new Set();
  for (const node of workflow.nodes) {
    if (!node.id || typeof node.id !== 'string') {
      return { valid: false, errors: [`Nó sem ID válido: ${JSON.stringify(node)}`] };
    }
    if (!node.type || typeof node.type !== 'string') {
      return { valid: false, errors: [`Nó sem tipo válido: ${JSON.stringify(node)}`] };
    }
    if (!node.parameters || typeof node.parameters !== 'object') {
      return { valid: false, errors: [`Nó sem parâmetros válidos: ${JSON.stringify(node)}`] };
    }
    if (!node.position || typeof node.position !== 'object' || 
        typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
      return { valid: false, errors: [`Nó sem posição válida: ${JSON.stringify(node)}`] };
    }
    
    nodeIds.add(node.id);
  }
  
  // Verificar conexões
  for (const sourceNodeId in workflow.connections) {
    if (!nodeIds.has(sourceNodeId)) {
      return { valid: false, errors: [`Conexão referencia nó inexistente: ${sourceNodeId}`] };
    }
    
    const sourceConnections = workflow.connections[sourceNodeId];
    if (!Array.isArray(sourceConnections)) {
      return { valid: false, errors: [`Conexão inválida para o nó: ${sourceNodeId}`] };
    }
    
    for (const connection of sourceConnections) {
      if (!connection.node || !nodeIds.has(connection.node)) {
        return { valid: false, errors: [`Conexão referencia nó de destino inexistente: ${connection.node}`] };
      }
    }
  }
  
  // Se chegou até aqui, o workflow é válido
  return { valid: true, errors: [] };
}

// Importar templates a partir de arquivos separados
import { createLoginWorkflowTemplate } from './template-login.js';
import { createApiScrapingWorkflowTemplate } from './template-api.js';
import { createContactFormWorkflowTemplate } from './template-form.js';

// Exportar os templates para uso externo
export {
  createLoginWorkflowTemplate,
  createApiScrapingWorkflowTemplate, 
  createContactFormWorkflowTemplate
}; 