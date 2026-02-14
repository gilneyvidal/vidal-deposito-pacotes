// ============================================
// SISTEMA DE AUTENTICAÇÃO
// ============================================

// Verificar estado de autenticação
auth.onAuthStateChanged((user) => {
    if (user) {
        // Usuário logado - verificar tipo e redirecionar
        checkUserType(user.uid);
    } else {
        // Não logado - ficar na página de login (exceto se já estiver nela)
        const currentPage = window.location.pathname;
        if (!currentPage.includes('index.html') && !currentPage.endsWith('/')) {
            window.location.href = 'index.html';
        }
    }
});

// Login
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('errorMessage');
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        // O redirecionamento automático acontece no onAuthStateChanged
    } catch (error) {
        errorDiv.textContent = getErrorMessage(error.code);
        console.error('Erro login:', error);
    }
});

// Verificar tipo de usuário e redirecionar
async function checkUserType(uid) {
    try {
        const userDoc = await db.collection('usuarios').doc(uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            const currentPage = window.location.pathname;
            
            // Redirecionar baseado no tipo
            if (userData.tipo === 'master' && !currentPage.includes('master.html')) {
                window.location.href = 'master.html';
            } else if (userData.tipo === 'operacional' && !currentPage.includes('app.html')) {
                window.location.href = 'app.html';
            }
            // Se já estiver na página correta, não faz nada
        } else {
            console.error('Documento do usuário não encontrado no Firestore');
            alert('Erro: Usuário não configurado corretamente. Contate o administrador.');
            auth.signOut();
        }
    } catch (error) {
        console.error('Erro ao verificar tipo:', error);
    }
}

// Logout
function logout() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
}

// Mensagens de erro amigáveis
function getErrorMessage(code) {
    const messages = {
        'auth/user-not-found': 'Usuário não encontrado',
        'auth/wrong-password': 'Senha incorreta',
        'auth/invalid-email': 'E-mail inválido',
        'auth/user-disabled': 'Usuário desativado',
        'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.',
        'auth/invalid-credential': 'E-mail ou senha incorretos'
    };
    return messages[code] || 'Erro ao fazer login. Tente novamente.';
}
