// ============================================
// CONFIGURAÇÃO FIREBASE - COM SEGURANÇA
// ============================================

// Função para obter configuração de forma segura
function getFirebaseConfig() {
    // Tentar carregar de variáveis de ambiente (GitHub Actions/Secrets)
    // Se não existir, usar valores padrão (para desenvolvimento local)
    
    return {
        apiKey: window._FIREBASE_API_KEY || "USAR_GITHUB_SECRET",
        authDomain: window._FIREBASE_AUTH_DOMAIN || "vidal-deposito-pacotes.firebaseapp.com",
        projectId: window._FIREBASE_PROJECT_ID || "vidal-deposito-pacotes",
        storageBucket: window._FIREBASE_STORAGE_BUCKET || "vidal-deposito-pacotes.firebasestorage.app",
        messagingSenderId: window._FIREBASE_MESSAGING_SENDER_ID || "566006404842",
        appId: window._FIREBASE_APP_ID || "1:566006404842:web:e7be4d65ed78c5f26b2993"
    };
}

const firebaseConfig = getFirebaseConfig();

// Verificar se está configurado corretamente
if (firebaseConfig.apiKey === "USAR_GITHUB_SECRET") {
    console.warn("⚠️ Configure as variáveis de ambiente do Firebase!");
}

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
