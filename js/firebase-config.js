// ============================================
// CONFIGURAÇÃO FIREBASE - VIDAL DEPÓSITO
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyBoOL-Ddy9N4mHXjtoI2LVB2zuGRQBaPVI",
    authDomain: "vidal-deposito-pacotes.firebaseapp.com",
    projectId: "vidal-deposito-pacotes",
    storageBucket: "vidal-deposito-pacotes.firebasestorage.app",
    messagingSenderId: "566006404842",
    appId: "1:566006404842:web:e7be4d65ed78c5f26b2993"
};

// Inicializar Firebase (modo compatível - mais simples)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
