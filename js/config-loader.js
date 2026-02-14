// ============================================
// CARREGADOR SEGURO DE CONFIGURAÇÕES
// ============================================

// Este arquivo carrega configurações sensíveis de forma segura
// NUNCA commite este arquivo com valores reais!

(function() {
    'use strict';
    
    // Método 1: Carregar de meta tags (injetadas pelo servidor)
    const metaApiKey = document.querySelector('meta[name="firebase-api-key"]');
    if (metaApiKey) {
        window._FIREBASE_API_KEY = metaApiKey.content;
    }
    
    // Método 2: Carregar de localStorage (setado manualmente uma vez)
    // Use o console do navegador para definir: localStorage.setItem('fb_api_key', 'sua-chave')
    const storedApiKey = localStorage.getItem('fb_api_key');
    if (storedApiKey) {
        window._FIREBASE_API_KEY = storedApiKey;
    }
    
    // Método 3: Carregar de arquivo externo não versionado (config.local.js)
    // Crie este arquivo localmente e NÃO suba no GitHub
})();
