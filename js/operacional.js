// ============================================
// SISTEMA OPERACIONAL - ENTRADA E SAÍDA
// ============================================

// Variáveis globais
let html5QrCode = null;
let pacoteAtual = null;
let nichoSugerido = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    carregarOrigens();
    if (document.getElementById('reader')) {
        iniciarScannerEntrada();
    }
});

// Navegação entre seções
function showSection(section) {
    // Esconder todas as seções
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    
    // Mostrar seção selecionada
    const targetSection = document.getElementById(section);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // Atualizar menu ativo
    document.querySelectorAll('.nav-menu a').forEach(a => a.classList.remove('active'));
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // Parar scanner anterior se existir
    if (html5QrCode) {
        html5QrCode.stop().catch(() => {});
    }
    
    // Iniciar scanner apropriado
    if (section === 'entrada') {
        setTimeout(iniciarScannerEntrada, 300);
    } else if (section === 'saida') {
        setTimeout(iniciarScannerSaida, 300);
    }
}

// Carregar origens do Firebase
async function carregarOrigens() {
    try {
        const snapshot = await db.collection('origens').where('ativo', '!=', false).orderBy('nome').get();
        const select = document.getElementById('origem');
        
        if (!select) return;
        
        // Limpar exceto primeira opção
        select.innerHTML = '<option value="">Selecione...</option>';
        
        snapshot.forEach(doc => {
            const origem = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = origem.nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar origens:', error);
    }
}

// ============================================
// SCANNER ENTRADA
// ============================================

function iniciarScannerEntrada() {
    const readerElement = document.getElementById('reader');
    if (!readerElement) return;
    
    // Limpar elemento anterior
    readerElement.innerHTML = '<div class="scanner-overlay"></div>';
    
    html5QrCode = new Html5Qrcode("reader");
    
    html5QrCode.start(
        { facingMode: "environment" },
        { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        },
        (decodedText) => {
            // Sucesso na leitura
            html5QrCode.stop();
            processarCodigoEntrada(decodedText);
        },
        (errorMessage) => {
            // Erros silenciosos durante scanning
        }
    ).catch(err => {
        console.error("Erro ao iniciar scanner:", err);
        readerElement.innerHTML = '<p style="color: white; text-align: center;">Erro na câmera. Use a entrada manual.</p>';
    });
}

async function processarCodigoEntrada(codigo) {
    // Limpar código (remover espaços)
    codigo = codigo.trim();
    
    // Verificar se pacote já existe no depósito
    try {
        const existente = await db.collection('pacotes')
            .where('codigoRastreio', '==', codigo)
            .where('status', '==', 'no_deposito')
            .get();
        
        if (!existente.empty) {
            const pacoteExistente = existente.docs[0].data();
            alert(`⚠️ Este pacote já está no depósito!\n\nLocal: ${pacoteExistente.corredor}${pacoteExistente.prateleira}-${pacoteExistente.andar}-${pacoteExistente.espaco}-${pacoteExistente.subespaco}\nEntrada: ${pacoteExistente.dataEntrada?.toDate().toLocaleString() || 'N/A'}`);
            iniciarScannerEntrada();
            return;
        }
        
        // Preencher formulário
        document.getElementById('codigoRastreio').value = codigo;
        document.getElementById('formEntrada').style.display = 'block';
        
        // Sugerir nicho automaticamente
        await sugerirNicho();
        
    } catch (error) {
        console.error('Erro ao verificar pacote:', error);
        alert('Erro ao verificar pacote. Tente novamente.');
    }
}

function buscarCodigoManual() {
    const codigo = document.getElementById('codigoManual').value.trim();
    if (codigo) {
        processarCodigoEntrada(codigo);
    }
}

// ============================================
// ALGORITMO DE ALOCAÇÃO INTELIGENTE
// ============================================

async function sugerirNicho() {
    const tamanho = document.getElementById('tamanhoPacote').value;
    const origemSelect = document.getElementById('origem');
    const origemId = origemSelect.value;
    const cliente = document.getElementById('nomeCliente').value.trim();
    
    // Se for médio ou grande, precisa de espaço inteiro
    if (tamanho !== 'pequeno') {
        const nichoVazio = await encontrarNichoVazio();
        if (nichoVazio) {
            nichoSugerido = { ...nichoVazio, subespaco: 1, totalSubespacos: 1 };
            exibirSugestao(nichoSugerido, 'Espaço inteiro necessário (pacote médio/grande)');
        } else {
            alert('🚨 Nenhum espaço vazio disponível para pacote grande!');
            document.getElementById('formEntrada').style.display = 'none';
        }
        return;
    }
    
    // Para pacotes pequenos: tentar agrupar por cliente/origem
    if (origemId && cliente) {
        try {
            // Buscar nicho com mesmo cliente E origem
            const nichoCompativel = await db.collection('pacotes')
                .where('origem', '==', origemId)
                .where('nomeCliente', '==', cliente)
                .where('status', '==', 'no_deposito')
                .where('tamanho', '==', 'pequeno')
                .where('subespacoOcupado', '<', 4)
                .limit(1)
                .get();
            
            if (!nichoCompativel.empty) {
                const pacoteRef = nichoCompativel.docs[0];
                const pacote = pacoteRef.data();
                
                nichoSugerido = {
                    corredor: pacote.corredor,
                    prateleira: pacote.prateleira,
                    andar: pacote.andar,
                    espaco: pacote.espaco,
                    subespaco: pacote.subespacoOcupado + 1,
                    totalSubespacos: pacote.subespacoOcupado + 1,
                    agrupado: true
                };
                
                exibirSugestao(nichoSugerido, `Agrupado com ${pacote.subespacoOcupado} pacote(s) do mesmo cliente`);
                return;
            }
        } catch (error) {
            console.error('Erro ao buscar nicho compatível:', error);
        }
    }
    
    // Tentar encontrar nicho parcialmente ocupado (menos de 4)
    const nichoParcial = await encontrarNichoParcial();
    if (nichoParcial) {
        nichoSugerido = nichoParcial;
        exibirSugestao(nichoParcial, 'Nicho com espaço disponível');
        return;
    }
    
    // Último caso: nicho vazio
    const nichoVazio = await encontrarNichoVazio();
    if (nichoVazio) {
        nichoSugerido = { ...nichoVazio, subespaco: 1, totalSubespacos: 1 };
        exibirSugestao(nichoSugerido, 'Novo espaço');
    } else {
        alert('🚨 DEPÓSITO CHEIO! Nenhum espaço disponível.');
        document.getElementById('formEntrada').style.display = 'none';
    }
}

async function encontrarNichoVazio() {
    // Buscar configuração de corredores
    const configDoc = await db.collection('config').doc('corredores').get();
    const corredores = configDoc.data()?.lista || ['A'];
    
    // Buscar todos os nichos ocupados
    const ocupadosSnapshot = await db.collection('pacotes')
        .where('status', '==', 'no_deposito')
        .get();
    
    const ocupadosSet = new Set();
    ocupadosSnapshot.forEach(doc => {
        const p = doc.data();
        // Para nichos com pacotes grandes ou cheios (4 pequenos)
        if (p.tamanho !== 'pequeno' || p.subespacoOcupado >= 4) {
            ocupadosSet.add(`${p.corredor}-${p.prateleira}-${p.andar}-${p.espaco}`);
        }
    });
    
    // Procurar primeiro nicho disponível
    for (let corredor of corredores) {
        for (let prat = 1; prat <= 2; prat++) {
            for (let andar = 1; andar <= 4; andar++) {
                for (let espaco = 1; espaco <= 5; espaco++) {
                    const key = `${corredor}-${prat}-${andar}-${espaco}`;
                    if (!ocupadosSet.has(key)) {
                        return {
                            corredor,
                            prateleira: prat,
                            andar,
                            espaco
                        };
                    }
                }
            }
        }
    }
    return null;
}

async function encontrarNichoParcial() {
    // Buscar nichos com pacotes pequenos e espaço disponível (menos de 4)
    try {
        const snapshot = await db.collection('pacotes')
            .where('status', '==', 'no_deposito')
            .where('tamanho', '==', 'pequeno')
            .where('subespacoOcupado', '<', 4)
            .orderBy('subespacoOcupado', 'desc')
            .limit(5)
            .get();
        
        if (!snapshot.empty) {
            // Pegar o primeiro (mais preenchido = melhor para organização)
            const p = snapshot.docs[0].data();
            return {
                corredor: p.corredor,
                prateleira: p.prateleira,
                andar: p.andar,
                espaco: p.espaco,
                subespaco: p.subespacoOcupado + 1,
                totalSubespacos: p.subespacoOcupado + 1,
                agrupado: false
            };
        }
    } catch (error) {
        console.error('Erro ao buscar nicho parcial:', error);
    }
    return null;
}

function exibirSugestao(nicho, info) {
    const label = `${nicho.corredor}${nicho.prateleira}-${nicho.andar}-${nicho.espaco}-${nicho.subespaco}`;
    const elementoNicho = document.getElementById('nichoSugerido');
    const elementoInfo = document.getElementById('infoNicho');
    
    if (elementoNicho) elementoNicho.textContent = label;
    if (elementoInfo) elementoInfo.textContent = info;
}

// ============================================
// CONFIRMAR ENTRADA
// ============================================

async function confirmarEntrada() {
    const origemSelect = document.getElementById('origem');
    const origemId = origemSelect.value;
    const origemNome = origemSelect.options[origemSelect.selectedIndex]?.text || '';
    
    const nomeCliente = document.getElementById('nomeCliente').value.trim();
    
    // Validações
    if (!origemId) {
        alert('Selecione a origem do pacote!');
        return;
    }
    if (!nomeCliente) {
        alert('Digite o nome do cliente!');
        return;
    }
    if (!nichoSugerido) {
        alert('Erro: Nenhum nicho sugerido. Tente novamente.');
        return;
    }
    
    // Gerar código interno único
    const codigoInterno = await gerarCodigoInterno();
    
    const pacote = {
        codigoRastreio: document.getElementById('codigoRastreio').value,
        codigoInterno: codigoInterno,
        origem: origemId,
        origemNome: origemNome,
        nomeCliente: nomeCliente,
        telefoneCliente: document.getElementById('telefoneCliente').value.trim(),
        tamanho: document.getElementById('tamanhoPacote').value,
        corredor: nichoSugerido.corredor,
        prateleira: nichoSugerido.prateleira,
        andar: nichoSugerido.andar,
        espaco: nichoSugerido.espaco,
        subespaco: nichoSugerido.subespaco,
        subespacoOcupado: nichoSugerido.subespaco,
        status: 'no_deposito',
        dataEntrada: firebase.firestore.FieldValue.serverTimestamp(),
        operadorEntrada: auth.currentUser.email
    };
    
    try {
        // Salvar pacote
        await db.collection('pacotes').doc(codigoInterno).set(pacote);
        
        // Atualizar contador de subespaço se for agrupamento
        if (pacote.tamanho === 'pequeno' && nichoSugerido.agrupado) {
            await atualizarSubespacoExistente(pacote);
        }
        
        // Mostrar etiqueta
        mostrarEtiqueta(pacote);
        
        // Limpar formulário
        document.getElementById('formEntrada').style.display = 'none';
        document.getElementById('codigoManual').value = '';
        document.getElementById('nomeCliente').value = '';
        document.getElementById('telefoneCliente').value = '';
        document.getElementById('origem').value = '';
        
    } catch (error) {
        console.error('Erro ao salvar pacote:', error);
        alert('Erro ao salvar pacote. Tente novamente.');
    }
}

async function gerarCodigoInterno() {
    const data = new Date();
    const ano = data.getFullYear().toString().substr(2);
    const prefixo = 'VD' + ano;
    
    // Buscar último código
    const snapshot = await db.collection('pacotes')
        .where('codigoInterno', '>=', prefixo + '0001')
        .where('codigoInterno', '<=', prefixo + '9999')
        .orderBy('codigoInterno', 'desc')
        .limit(1)
        .get();
    
    let sequencial = 1;
    if (!snapshot.empty) {
        const ultimo = snapshot.docs[0].data().codigoInterno;
        sequencial = parseInt(ultimo.substr(-4)) + 1;
    }
    
    return prefixo + sequencial.toString().padStart(4, '0');
}

async function atualizarSubespacoExistente(novoPacote) {
    // Atualizar TODOS os pacotes no mesmo nicho para refletir ocupação total
    const snapshot = await db.collection('pacotes')
        .where('corredor', '==', novoPacote.corredor)
        .where('prateleira', '==', novoPacote.prateleira)
        .where('andar', '==', novoPacote.andar)
        .where('espaco', '==', novoPacote.espaco)
        .where('status', '==', 'no_deposito')
        .get();
    
    const batch = db.batch();
    snapshot.forEach(doc => {
        batch.update(doc.ref, { subespacoOcupado: novoPacote.subespaco });
    });
    await batch.commit();
}

// ============================================
// ETIQUETA
// ============================================

function mostrarEtiqueta(pacote) {
    const modal = document.getElementById('modalEtiqueta');
    const preview = document.getElementById('etiquetaPreview');
    
    if (!modal || !preview) return;
    
    const nichoLabel = `${pacote.corredor}${pacote.prateleira}-${pacote.andar}-${pacote.espaco}-${pacote.subespaco}`;
    
    preview.innerHTML = `
        <div class="etiqueta" id="etiquetaImpressao" style="width: 80mm; height: 100mm; padding: 8mm; border: 2px solid #000; text-align: center; font-family: Arial, sans-serif;">
            <div id="qrcode" style="margin: 0 auto 4mm; width: 60mm; height: 60mm;"></div>
            <div class="etiqueta-info">
                <div style="font-size: 16px; font-weight: bold; color: #2563eb; margin-bottom: 3mm; text-transform: uppercase;">${pacote.origemNome}</div>
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 2mm; word-wrap: break-word;">${pacote.nomeCliente}</div>
                <div style="font-size: 20px; font-weight: bold; margin: 4mm 0; color: #000;">${nichoLabel}</div>
                <div style="font-size: 11px; color: #666; font-family: monospace;">${pacote.codigoInterno}</div>
                <div style="font-size: 9px; color: #999; margin-top: 2mm;">${new Date().toLocaleDateString('pt-BR')}</div>
            </div>
        </div>
    `;
    
    // Gerar QR Code
    setTimeout(() => {
        new QRCode(document.getElementById("qrcode"), {
            text: pacote.codigoInterno,
            width: 180,
            height: 180,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }, 100);
    
    pacoteAtual = pacote;
    modal.style.display = 'block';
}

function imprimirEtiqueta() {
    const conteudo = document.getElementById('etiquetaImpressao').innerHTML;
    const janelaImpressao = window.open('', '_blank', 'width=400,height=500');
    
    janelaImpressao.document.write(`
        <html>
        <head>
            <title>Etiqueta ${pacoteAtual?.codigoInterno || ''}</title>
            <style>
                @page { size: 80mm 100mm; margin: 0; }
                body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
                .etiqueta { width: 80mm; height: 100mm; padding: 8mm; box-sizing: border-box; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <div class="etiqueta">${conteudo}</div>
        </body>
        </html>
    `);
    janelaImpressao.document.close();
    
    fecharModal();
}

function fecharModal() {
    const modal = document.getElementById('modalEtiqueta');
    if (modal) modal.style.display = 'none';
    iniciarScannerEntrada();
}

// ============================================
// SAÍDA DE PACOTES
// ============================================

function iniciarScannerSaida() {
    const readerElement = document.getElementById('readerSaida');
    if (!readerElement) return;
    
    readerElement.innerHTML = '<div class="scanner-overlay"></div>';
    
    html5QrCode = new Html5Qrcode("readerSaida");
    
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            html5QrCode.stop();
            processarSaida(decodedText);
        },
        (error) => {}
    ).catch(err => {
        console.error("Erro scanner saída:", err);
        readerElement.innerHTML = '<p style="color: white; text-align: center;">Use entrada manual</p>';
    });
}

function buscarSaidaManual() {
    const codigo = document.getElementById('codigoSaidaManual').value.trim();
    if (codigo) processarSaida(codigo);
}

async function processarSaida(codigo) {
    try {
        // Buscar por código interno
        const snapshot = await db.collection('pacotes')
            .where('codigoInterno', '==', codigo.toUpperCase())
            .where('status', '==', 'no_deposito')
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            alert('❌ Pacote não encontrado ou já retirado!\n\nVerifique o código e tente novamente.');
            return;
        }
        
        const doc = snapshot.docs[0];
        pacoteAtual = { id: doc.id, ...doc.data() };
        
        // Mostrar informações
        const div = document.getElementById('dadosPacoteSaida');
        if (div) {
            div.innerHTML = `
                <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <p><strong>📦 Origem:</strong> <span style="color: #2563eb; font-size: 18px;">${pacoteAtual.origemNome}</span></p>
                    <p><strong>👤 Cliente:</strong> ${pacoteAtual.nomeCliente}</p>
                    <p><strong>📅 Entrada:</strong> ${pacoteAtual.dataEntrada?.toDate().toLocaleString('pt-BR') || 'N/A'}</p>
                    <p><strong>📍 Local:</strong> <span style="font-size: 20px; font-weight: bold; color: #000;">${pacoteAtual.corredor}${pacoteAtual.prateleira}-${pacoteAtual.andar}-${pacoteAtual.espaco}-${pacoteAtual.subespaco}</span></p>
                </div>
            `;
        }
        
        document.getElementById('infoSaida').style.display = 'block';
        
    } catch (error) {
        console.error('Erro ao buscar pacote:', error);
        alert('Erro ao buscar pacote. Tente novamente.');
    }
}

async function confirmarSaida() {
    const tipoRetirada = document.getElementById('tipoRetirada')?.value;
    
    if (!tipoRetirada) {
        alert('Selecione o tipo de retirada!');
        return;
    }
    
    if (!pacoteAtual) {
        alert('Erro: Nenhum pacote selecionado.');
        return;
    }
    
    try {
        // Buscar valor da origem
        const origemDoc = await db.collection('origens').doc(pacoteAtual.origem).get();
        const valor = origemDoc.data()?.valor || 0;
        
        // Atualizar pacote
        await db.collection('pacotes').doc(pacoteAtual.id).update({
            status: 'retirado',
            dataSaida: firebase.firestore.FieldValue.serverTimestamp(),
            tipoRetirada: tipoRetirada,
            operadorSaida: auth.currentUser.email,
            valorRecebido: valor
        });
        
        // Registrar movimento financeiro
        await db.collection('movimentos').add({
            tipo: 'entrada',
            valor: valor,
            origem: pacoteAtual.origem,
            origemNome: pacoteAtual.origemNome,
            pacoteId: pacoteAtual.id,
            data: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert(`✅ Saída confirmada!\n\nValor creditado: R$ ${valor.toFixed(2)}\nRetirada por: ${tipoRetirada === 'transportadora' ? 'Transportadora' : 'Cliente Final'}`);
        
        // Limpar
        document.getElementById('infoSaida').style.display = 'none';
        document.getElementById('codigoSaidaManual').value = '';
        document.getElementById('tipoRetirada').value = '';
        pacoteAtual = null;
        
        iniciarScannerSaida();
        
    } catch (error) {
        console.error('Erro na saída:', error);
        alert('Erro ao processar saída. Tente novamente.');
    }
}

// ============================================
// BUSCA
// ============================================

async function buscarPacotes() {
    const termo = document.getElementById('buscaInput')?.value.toLowerCase().trim();
    const resultados = document.getElementById('resultadosBusca');
    
    if (!resultados) return;
    
    if (!termo) {
        resultados.innerHTML = '<p style="padding: 20px;">Digite um termo para buscar</p>';
        return;
    }
    
    try {
        // Buscar pacotes no depósito (limitado a 100 para performance)
        const snapshot = await db.collection('pacotes')
            .where('status', '==', 'no_deposito')
            .orderBy('dataEntrada', 'desc')
            .limit(100)
            .get();
        
        let encontrados = [];
        
        snapshot.forEach(doc => {
            const p = doc.data();
            if (p.nomeCliente.toLowerCase().includes(termo) || 
                p.codigoRastreio.toLowerCase().includes(termo) ||
                p.codigoInterno.toLowerCase().includes(termo) ||
                (p.telefoneCliente && p.telefoneCliente.includes(termo))) {
                encontrados.push({ id: doc.id, ...p });
            }
        });
        
        if (encontrados.length === 0) {
            resultados.innerHTML = '<p style="padding: 20px;">Nenhum pacote encontrado</p>';
            return;
        }
        
        let html = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: #f3f4f6;">
                    <tr>
                        <th style="padding: 12px; text-align: left;">Código</th>
                        <th style="padding: 12px; text-align: left;">Cliente</th>
                        <th style="padding: 12px; text-align: left;">Origem</th>
                        <th style="padding: 12px; text-align: left;">Local</th>
                        <th style="padding: 12px; text-align: left;">Entrada</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        encontrados.forEach(p => {
            const data = p.dataEntrada?.toDate().toLocaleDateString('pt-BR') || '-';
            const local = `${p.corredor}${p.prateleira}-${p.andar}-${p.espaco}-${p.subespaco}`;
            
            html += `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 12px; font-family: monospace; font-size: 12px;">${p.codigoInterno}</td>
                    <td style="padding: 12px; font-weight: 500;">${p.nomeCliente}</td>
                    <td style="padding: 12px;"><span style="background: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${p.origemNome}</span></td>
                    <td style="padding: 12px; font-weight: bold; font-size: 16px;">${local}</td>
                    <td style="padding: 12px; color: #6b7280; font-size: 13px;">${data}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        resultados.innerHTML = html;
        
    } catch (error) {
        console.error('Erro na busca:', error);
        resultados.innerHTML = '<p style="padding: 20px; color: red;">Erro ao buscar. Tente novamente.</p>';
    }
}
