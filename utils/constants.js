// utils/constants.js
// Arquivo com todas as constantes da aplicação

// Tipos de mensagens de chat
export const MESSAGE_TYPES = {
  USER: 'user',
  AI: 'ai',
  SYSTEM: 'system',
  WARNING: 'warning',
  ERROR: 'error',
  SUCCESS: 'success',
  CODE: 'code',
  ACTION: 'action'
};

// Informações de versão
export const VERSION = {
  current: '1.3.0',
  lastUpdated: '2024-06-25',
  history: [
    {
      version: '1.3.0',
      date: '2024-06-25',
      changes: [
        'Refatoração completa do código',
        'Migração para ES6 modules',
        'Estrutura de arquivos melhorada',
        'Correção de bugs no service worker',
        'Melhor separação de responsabilidades'
      ]
    },
    {
      version: '1.2.0',
      date: '2024-06-24',
      changes: [
        'Identificação de webhooks e endpoints de API através da análise do código JavaScript',
        'Captura de screenshots da página para análise visual com AI Vision',
        'Detecção de elementos visuais importantes como gráficos e dashboards',
        'Reconhecimento de componentes que o DOM sozinho não consegue identificar',
        'Análise aprimorada para identificar elementos de visualização de dados'
      ]
    },
    {
      version: '1.1.0',
      date: '2024-06-23',
      changes: [
        'Detecção automática de fluxos de trabalho multi-página (ex: carrinho → checkout → pagamento)',
        'Sugestões de automação para fluxos completos',
        'Prompt de IA aprimorado para gerar workflows mais avançados',
        'Melhorias na análise de contexto de páginas relacionadas'
      ]
    },
    {
      version: '1.0.0',
      date: '2024-06-23',
      changes: [
        'Versão inicial da extensão',
        'Análise inteligente de páginas web',
        'Detecção automática de padrões de páginas (login, checkout, etc.)',
        'Sugestões personalizadas de automação',
        'Chat com IA para geração de workflows',
        'Integração com APIs Claude e OpenAI',
        'Sistema de seções colapsáveis para melhor uso do espaço'
      ]
    }
  ]
}; 