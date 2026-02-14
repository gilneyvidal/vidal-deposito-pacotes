// ============================================
// DASHBOARD MASTER - ADMINISTRAÇÃO
// ============================================

// Navegação entre seções
function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    const target = document.getElementById(section);
    if (target) target.style.display = 'block';
    
    document.querySelectorAll('.nav-menu a').forEach(a => a.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    
    // Carregar dados específicos
    switch(section) {
        case 'dashboard': carregarDashboard(); break;
        case 'origens': carregarOrigens(); break;
        case 'usuarios': carregarUsuarios(); break;
        case 'corredores': carregarCorredores(); break;
        case 'financeiro': carregarFinanceiro(); break;
    }
}

// ============================================
// DASHBOARD
// ============================================

async function carregarDashboard() {
    const dataElement = document.getElementById('dataAtual');
    if (dataElement) {
        dataElement.textContent = new Date().toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
    
    try {
        // Total pacotes no depósito
        const pacotesSnapshot = await db.collection('pacotes')
            .where('status', '==', 'no_deposito')
            .get();
        
        const totalPacotes = pacotesSnapshot.size;
        const elTotal = document.getElementById('totalPacotes');
        if (elTotal) elTotal.textContent = totalPacotes;
        
        // Ocupação
        const configDoc = await db.collection('config').doc('corredores').get();
        const numCorredores = configDoc.data()?.lista?.length || 1;
        const totalPosicoes = numCorredores * 160; // 160 por corredor
        const ocupacao = Math.min(Math.round((totalPacotes / totalPosicoes) * 100), 100);
        
        const elOcupacao = document.getElementById('ocupacao');
        if (elOcupacao) elOcupacao.textContent = ocupacao + '%';
        
        // Entradas hoje
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        const entradasHoje = await db.collection('pacotes')
            .where('dataEntrada', '>=', hoje)
            .get();
        
        const elEntradas = document.getElementById('entradasHoje');
        if (elEntradas) elEntradas.textContent = entradasHoje.size;
        
        // Saídas hoje
        const saidasHoje = await db.collection('pacotes')
            .where('dataSaida', '>=', hoje)
            .get();
        
        const elSaidas = document.getElementById('saidasHoje');
        if (elSaidas) elSaidas.textContent = saidasHoje.size;
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

// ============================================
// ORIGENS
// ============================================

async function carregarOrigens() {
    const div = document.getElementById('listaOrigens');
    if (!div) return;
    
    try {
        const snapshot = await db.collection('origens').orderBy('nome').get();
        
        let html = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: #f3f4f6;">
                    <tr>
                        <th style="padding: 16px; text-align: left;">Origem</th>
                        <th style="padding: 16px; text-align: left;">Tipo</th>
                        <th style="padding: 16px; text-align: left;">Valor/Pacote</th>
                        <th style="padding: 16px; text-align: left;">Ações</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        if (snapshot.empty) {
            html += '<tr><td colspan="4" style="padding: 20px; text-align: center;">Nenhuma origem cadastrada</td></tr>';
        } else {
            snapshot.forEach(doc => {
                const o = doc.data();
                const tipoLabel = {
                    'marketplace': 'Marketplace',
                    'transportadora': 'Transportadora',
                    'loja': 'Loja Física'
                }[o.tipo] || o.tipo;
                
                html += `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 16px; font-weight: 600;">${o.nome}</td>
                        <td style="padding: 16px;"><span class="badge" style="background: #e5e7eb; padding: 4px 12px; border-radius: 20px; font-size: 12px;">${tipoLabel}</span></td>
                        <td style="padding: 16px; font-weight: 600; color: #059669;">R$ ${(o.valor || 0).toFixed(2)}</td>
                        <td style="padding: 16px;">
                            <button onclick="editarOrigem('${doc.id}')" class="btn-secondary" style="padding: 6px 16px; margin-right: 8px;">Editar</button>
                            <button onclick="excluirOrigem('${doc.id}')" style="padding: 6px 16px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">Excluir</button>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += '</tbody></table>';
        div.innerHTML = html;
        
    } catch (error) {
        console.error('Erro ao carregar origens:', error);
    }
}

async function adicionarOrigem() {
    const nomeInput = document.getElementById('nomeOrigem');
    const valorInput = document.getElementById('valorOrigem');
    const tipoInput = document.getElementById('tipoOrigem');
    
    const nome = nomeInput?.value.trim();
    const valor = parseFloat(valorInput?.value);
    const tipo = tipoInput?.value;
    
    if (!nome) {
        alert('Digite o nome da origem!');
        return;
    }
    if (isNaN(valor) || valor < 0) {
        alert('Digite um valor válido!');
        return;
    }
    
    try {
        await db.collection('origens').add({
            nome,
            valor,
            tipo,
            ativo: true,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Limpar campos
        nomeInput.value = '';
        valorInput.value = '';
        tipoInput.value = 'marketplace';
        
        alert('✅ Origem adicionada com sucesso!');
        carregarOrigens();
        
    } catch (error) {
        console.error('Erro ao adicionar origem:', error);
        alert('Erro ao adicionar origem. Tente novamente.');
    }
}

async function excluirOrigem(id) {
    if (!confirm('Tem certeza que deseja excluir esta origem?')) return;
    
    try {
        await db.collection('origens').doc(id).update({ ativo: false });
        alert('Origem removida!');
        carregarOrigens();
    } catch (error) {
        alert('Erro ao remover origem.');
    }
}

// ============================================
// USUÁRIOS
// ============================================

async function carregarUsuarios() {
    const div = document.getElementById('listaUsuarios');
    if (!div) return;
    
    try {
        const snapshot = await db.collection('usuarios').get();
        
        let html = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: #f3f4f6;">
                    <tr>
                        <th style="padding: 16px; text-align: left;">E-mail</th>
                        <th style="padding: 16px; text-align: left;">Tipo</th>
                        <th style="padding: 16px; text-align: left;">Criado em</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        snapshot.forEach(doc => {
            const u = doc.data();
            const data = u.criadoEm?.toDate().toLocaleDateString('pt-BR') || '-';
            const tipoClass = u.tipo === 'master' ? 'background: #fef3c7; color: #92400e;' : 'background: #d1fae5; color: #065f46;';
            
            html += `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 16px;">${u.email}</td>
                    <td style="padding: 16px;"><span style="${tipoClass} padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase;">${u.tipo}</span></td>
                    <td style="padding: 16px; color: #6b7280;">${data}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        div.innerHTML = html;
        
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
    }
}

async function criarUsuario() {
    const emailInput = document.getElementById('emailUsuario');
    const senhaInput = document.getElementById('senhaUsuario');
    const tipoInput = document.getElementById('tipoUsuario');
    
    const email = emailInput?.value.trim();
    const senha = senhaInput?.value;
    const tipo = tipoInput?.value;
    
    if (!email || !senha) {
        alert('Preencha e-mail e senha!');
        return;
    }
    
    if (senha.length < 6) {
        alert('A senha deve ter no mínimo 6 caracteres!');
        return;
    }
    
    try {
        // Criar no Authentication
        const userCred = await auth.createUserWithEmailAndPassword(email, senha);
        
        // Salvar no Firestore
        await db.collection('usuarios').doc(userCred.user.uid).set({
            email,
            tipo,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('✅ Usuário criado com sucesso!');
        
        // Limpar
        emailInput.value = '';
        senhaInput.value = '';
        tipoInput.value = 'operacional';
        
        carregarUsuarios();
        
        // Fazer logout do novo usuário e voltar para conta master
        const emailMaster = auth.currentUser.email;
        await auth.signOut();
        
        // Re-login com master (simplificado - na prática o usuário faz manual)
        alert(`Usuário criado! Faça login novamente com sua conta master (${emailMaster}) se necessário.`);
        window.location.reload();
        
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        alert('Erro: ' + (error.message || 'Não foi possível criar usuário'));
    }
}

// ============================================
// CORREDORES
// ============================================

async function carregarCorredores() {
    const div = document.getElementById('listaCorredores');
    if (!div) return;
    
    try {
        const doc = await db.collection('config').doc('corredores').get();
        const corredores = doc.data()?.lista || ['A'];
        
        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">';
        
        corredores.forEach(c => {
            html += `
                <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid #2563eb;">
                    <h3 style="font-size: 24px; margin-bottom: 8px; color: #111827;">Corredor ${c}</h3>
                    <p style="color: #6b7280; margin-bottom: 4px;">2 prateleiras × 4 andares × 5 espaços</p>
                    <p style="color: #6b7280; font-size: 14px;">160 posições totais (640 subespaços)</p>
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                        <span style="background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">Ativo</span>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        div.innerHTML = html;
        
    } catch (error) {
        console.error('Erro ao carregar corredores:', error);
    }
}

async function adicionarCorredor() {
    const input = document.getElementById('letraCorredor');
    const letra = input?.value.toUpperCase().trim();
    
    if (!letra || letra.length !== 1 || !/[A-Z]/.test(letra)) {
        alert('Digite uma letra válida (A-Z)!');
        return;
    }
    
    try {
        const docRef = db.collection('config').doc('corredores');
        const doc = await docRef.get();
        const lista = doc.data()?.lista || ['A'];
        
        if (lista.includes(letra)) {
            alert('Este corredor já existe!');
            return;
        }
        
        lista.push(letra);
        lista.sort();
        
        await docRef.set({ lista });
        
        input.value = '';
        alert(`✅ Corredor ${letra} criado com sucesso!`);
        carregarCorredores();
        
    } catch (error) {
        console.error('Erro ao criar corredor:', error);
        alert('Erro ao criar corredor.');
    }
}

// ============================================
// FINANCEIRO
// ============================================

async function carregarFinanceiro() {
    try {
        // Saldo do mês atual
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);
        
        const movimentosMes = await db.collection('movimentos')
            .where('data', '>=', inicioMes)
            .get();
        
        let saldoMes = 0;
        movimentosMes.forEach(doc => {
            saldoMes += doc.data().valor || 0;
        });
        
        const elSaldo = document.getElementById('saldoMes');
        if (elSaldo) elSaldo.textContent = 'R$ ' + saldoMes.toFixed(2);
        
        // Projeção semanal (últimos 7 dias)
        const seteDiasAtras = new Date();
        seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
        
        const semanal = await db.collection('movimentos')
            .where('data', '>=', seteDiasAtras)
            .get();
        
        let totalSemana = 0;
        semanal.forEach(doc => {
            totalSemana += doc.data().valor || 0;
        });
        
        const elProjecao = document.getElementById('projecaoSemana');
        if (elProjecao) elProjecao.textContent = 'R$ ' + totalSemana.toFixed(2);
        
        // Lista de movimentos recentes
        const recentes = await db.collection('movimentos')
            .orderBy('data', 'desc')
            .limit(20)
            .get();
        
        const divMovimentos = document.getElementById('movimentosFinanceiros');
        if (!divMovimentos) return;
        
        let html = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: #f3f4f6;">
                    <tr>
                        <th style="padding: 16px; text-align: left;">Data</th>
                        <th style="padding: 16px; text-align: left;">Origem</th>
                        <th style="padding: 16px; text-align: left;">Valor</th>
                        <th style="padding: 16px; text-align: left;">Tipo</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        if (recentes.empty) {
            html += '<tr><td colspan="4" style="padding: 20px; text-align: center;">Nenhum movimento registrado</td></tr>';
        } else {
            recentes.forEach(doc => {
                const m = doc.data();
                const data = m.data?.toDate().toLocaleString('pt-BR') || '-';
                html += `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 16px; color: #6b7280; font-size: 14px;">${data}</td>
                        <td style="padding: 16px; font-weight: 500;">${m.origemNome}</td>
                        <td style="padding: 16px; color: #059669; font-weight: 600;">+ R$ ${(m.valor || 0).toFixed(2)}</td>
                        <td style="padding: 16px;"><span style="background: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">Entrada</span></td>
                    </tr>
                `;
            });
        }
        
        html += '</tbody></table>';
        divMovimentos.innerHTML = html;
        
    } catch (error) {
        console.error('Erro ao carregar financeiro:', error);
    }
}

// ============================================
// RELATÓRIOS SEMANAIS
// ============================================

async function gerarRelatorioSemanal() {
    const semanaInput = document.getElementById('semanaRelatorio');
    if (!semanaInput?.value) {
        alert('Selecione uma semana!');
        return;
    }
    
    const [ano, semana] = semanaInput.value.split('-W');
    const inicioSemana = getDataDaSemana(parseInt(ano), parseInt(semana));
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(fimSemana.getDate() + 6);
    fimSemana.setHours(23, 59, 59, 999);
    
    try {
        // Buscar movimentos da semana
        const movimentos = await db.collection('movimentos')
            .where('data', '>=', inicioSemana)
            .where('data', '<=', fimSemana)
            .get();
        
        // Agrupar por origem
        const porOrigem = {};
        let totalGeral = 0;
        
        movimentos.forEach(doc => {
            const m = doc.data();
            if (!porOrigem[m.origemNome]) {
                porOrigem[m.origemNome] = { quantidade: 0, valor: 0, origemId: m.origem };
            }
            porOrigem[m.origemNome].quantidade++;
            porOrigem[m.origemNome].valor += m.valor || 0;
            totalGeral += m.valor || 0;
        });
        
        // Gerar HTML do relatório
        const divPreview = document.getElementById('previewRelatorio');
        if (!divPreview) return;
        
        let html = `
            <div style="background: white; padding: 32px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-top: 24px;">
                <div style="border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
                    <h2 style="font-size: 24px; color: #111827; margin-bottom: 8px;">📊 Relatório Semanal</h2>
                    <p style="color: #6b7280; font-size: 16px;">
                        Período: <strong>${inicioSemana.toLocaleDateString('pt-BR')}</strong> a <strong>${fimSemana.toLocaleDateString('pt-BR')}</strong>
                    </p>
                    <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Semana ${semana} de ${ano}</p>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                    <thead style="background: #f3f4f6;">
                        <tr>
                            <th style="padding: 16px; text-align: left; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Origem</th>
                            <th style="padding: 16px; text-align: center; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Qtd. Pacotes</th>
                            <th style="padding: 16px; text-align: right; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Valor Unit.</th>
                            <th style="padding: 16px; text-align: right; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Ordenar por valor (maior primeiro)
        const sortedOrigens = Object.entries(porOrigem).sort((a, b) => b[1].valor - a[1].valor);
        
        for (const [origem, dados] of sortedOrigens) {
            const unitario = dados.quantidade > 0 ? dados.valor / dados.quantidade : 0;
            html += `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 16px; font-weight: 600; color: #111827;">${origem}</td>
                    <td style="padding: 16px; text-align: center;">${dados.quantidade}</td>
                    <td style="padding: 16px; text-align: right; color: #6b7280;">R$ ${unitario.toFixed(2)}</td>
                    <td style="padding: 16px; text-align: right; font-weight: 600; color: #059669;">R$ ${dados.valor.toFixed(2)}</td>
                </tr>
            `;
        }
        
        html += `
                    </tbody>
                    <tfoot style="background: #f9fafb; font-size: 18px;">
                        <tr style="border-top: 3px solid #111827;">
                            <td colspan="3" style="padding: 20px 16px; font-weight: 700; color: #111827;">TOTAL A RECEBER</td>
                            <td style="padding: 20px 16px; text-align: right; font-weight: 700; color: #059669; font-size: 24px;">R$ ${totalGeral.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                
                <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                    <h4 style="color: #1e40af; margin-bottom: 12px; font-size: 16px;">📋 Checklist para Recebimento:</h4>
                    <ul style="margin-left: 20px; color: #1e40af; line-height: 1.8;">
                        <li>Conferir quantidade de pacotes por empresa</li>
                        <li>Validar valores unitários conforme contrato</li>
                        <li>Emitir nota fiscal de serviço</li>
                        <li>Aguardar depósito em conta</li>
                    </ul>
                </div>
                
                <div style="display: flex; gap: 12px;">
                    <button onclick="window.print()" style="flex: 1; padding: 16px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                        🖨️ Imprimir Relatório
                    </button>
                    <button onclick="exportarCSV('${semanaInput.value}')" style="padding: 16px 24px; background: #059669; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                        📥 CSV
                    </button>
                </div>
            </div>
        `;
        
        divPreview.innerHTML = html;
        
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        alert('Erro ao gerar relatório. Tente novamente.');
    }
}

function getDataDaSemana(ano, semana) {
    const data = new Date(ano, 0, 1);
    const diaSemana = data.getDay();
    const dias = (semana - 1) * 7 - diaSemana + 1;
    data.setDate(data.getDate() + dias);
    return data;
}

function exportarCSV(semanaId) {
    alert('Função de exportação CSV será implementada na próxima versão!\n\nPor enquanto, use a impressão para PDF.');
}

// Inicializar dashboard ao carregar
document.addEventListener('DOMContentLoaded', () => {
    carregarDashboard();
});
