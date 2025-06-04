// utils/helpers.js
// Funções auxiliares usadas em vários lugares da aplicação

/**
 * Compara duas versões semânticas e retorna:
 * 1 se v1 > v2
 * 0 se v1 = v2
 * -1 se v1 < v2
 */
export function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
}

/**
 * Verifica se uma sequência está contida em outra
 */
export function isSubsequence(pattern, sequence) {
  let pIndex = 0;
  
  for (let i = 0; i < sequence.length; i++) {
    if (JSON.stringify(pattern[pIndex]) === JSON.stringify(sequence[i])) {
      pIndex++;
      if (pIndex === pattern.length) return true;
    }
  }
  
  return false;
}

/**
 * Retorna o nome mais adequado para o tipo de padrão
 */
export function getPatternName(patternType) {
  const patternNames = {
    'login': 'Página de Login',
    'signup': 'Página de Cadastro',
    'checkout': 'Checkout',
    'contact': 'Formulário de Contato',
    'search': 'Página de Busca',
    'product': 'Página de Produto',
    'listing': 'Listagem de Produtos',
    'cart': 'Carrinho de Compras',
    'payment': 'Página de Pagamento',
    'account': 'Área do Usuário',
    'dashboard': 'Dashboard'
  };
  
  return patternNames[patternType] || patternType;
} 