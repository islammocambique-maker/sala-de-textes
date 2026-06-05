// ============================================
// MOZLOTTOGANHA - Sistema de Lotaria Online
// ============================================

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyCW9ZZadm4WJ_FKtOjvkP1czsfImwzl98c",
    authDomain: "mozcoin.firebaseapp.com",
    databaseURL: "https://mozcoin-default-rtdb.firebaseio.com",
    projectId: "mozcoin",
    storageBucket: "mozcoin.firebasestorage.app",
    messagingSenderId: "1097811611947",
    appId: "1:1097811611947:web:476c4b2e12fc4c6529756e",
    measurementId: "G-9KCS6TG1CZ"
};

// Inicializar Firebase (sem auth)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ============================================
// CONFIGURACOES
// ============================================
const SORTEIOS = [
    { id: 'sorteio1', nome: 'Sorteio Manha Quente', hora: '08:00', horaMin: 480 },
    { id: 'sorteio2', nome: 'Sorteio da Sorte', hora: '10:00', horaMin: 600 },
    { id: 'sorteio3', nome: 'Sorteio Meio Dia', hora: '12:00', horaMin: 720 },
    { id: 'sorteio4', nome: 'Sorteio do Lanche', hora: '14:00', horaMin: 840 },
    { id: 'sorteio5', nome: 'Sorteio Por do Sol', hora: '16:00', horaMin: 960 },
    { id: 'sorteio6', nome: 'Sorteio Ultimo Comboio', hora: '18:00', horaMin: 1080 },
    { id: 'sorteio7', nome: 'Sorteio Boa Noite', hora: '20:00', horaMin: 1200 },
    { id: 'sorteio8', nome: 'Sorteio da Despedida', hora: '22:00', horaMin: 1320 }
];

const PREMIOS = {
    5: [
        { acertos: 5, premio: 500000 },
        { acertos: 4, premio: 15000 },
        { acertos: 3, premio: 500 },
        { acertos: 2, premio: 50 },
        { acertos: 1, premio: 5 }
    ],
    4: [
        { acertos: 4, premio: 10000 },
        { acertos: 3, premio: 500 },
        { acertos: 2, premio: 100 },
        { acertos: 1, premio: 10 }
    ],
    3: [
        { acertos: 3, premio: 5000 },
        { acertos: 2, premio: 50 },
        { acertos: 1, premio: 5 }
    ],
    2: [
        { acertos: 2, premio: 250 },
        { acertos: 1, premio: 25 }
    ]
};

const VALOR_APOSTA = 5;
const PERCENTUAL_PAGAMENTO = 0.40;
const MINUTOS_FECHAMENTO = 15;

// ============================================
// ESTADO GLOBAL
// ============================================
let selectedChance = 5;
let selectedNumbers = [];
let selectedSorteio = null;
let recibosLocal = JSON.parse(localStorage.getItem('mozlottoganha_recibos') || '[]');
let bluetoothDevice = null;
let bluetoothServer = null;
let bluetoothCharacteristic = null;
let ultimoDiaVerificado = null;
let resultadosCache = {}; // Cache dos resultados do dia

// ============================================
// INICIALIZACAO
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    createParticles();
    await carregarResultadosDoDia(); // NOVO: Carregar resultados primeiro
    renderSorteios();
    renderNumbersGrid();
    renderPremiosTab(5);
    renderRecibos();
    updateJackpot();
    startCountdowns();
    populateAdminSelects();

    // Guardar o dia atual
    ultimoDiaVerificado = new Date().getDate();

    // Verificar sorteios pendentes a cada minuto
    setInterval(verificarSorteiosPendentes, 60000);

    // Atualizar UI a cada segundo
    setInterval(() => {
        updateSorteiosStatus();
        updateCountdowns();
        verificarMudancaDeDia();
    }, 1000);

    // Verificar sorteios imediatamente
    verificarSorteiosPendentes();
});

// ============================================
// CARREGAR RESULTADOS DO DIA (NOVO)
// ============================================
async function carregarResultadosDoDia() {
    try {
        const dataHoje = new Date().toISOString().split('T')[0];
        const snapshot = await db.ref('mozlottoganha/resultados').once('value');
        const resultados = snapshot.val() || {};

        resultadosCache = {};

        for (const sorteioId in resultados) {
            if (resultados[sorteioId][dataHoje]) {
                resultadosCache[sorteioId] = resultados[sorteioId][dataHoje];
            }
        }

        console.log('Resultados carregados:', resultadosCache);
    } catch (err) {
        console.error('Erro ao carregar resultados:', err);
    }
}

// ============================================
// VERIFICAR MUDANCA DE DIA (00:00h)
// ============================================
function verificarMudancaDeDia() {
    const agora = new Date();
    const diaAtual = agora.getDate();

    if (ultimoDiaVerificado !== null && diaAtual !== ultimoDiaVerificado) {
        console.log('NOVO DIA DETETADO! Resetando sistema...');
        ultimoDiaVerificado = diaAtual;
        resultadosCache = {}; // Limpar cache de resultados

        renderSorteios();
        updateJackpot();
        renderRecibos();

        selectedSorteio = null;
        document.getElementById('sorteioNome').textContent = 'Nenhum';
        document.getElementById('sorteioHora').textContent = '--:--';

        showToast('NOVO DIA! Todos os sorteios estao abertos para apostas!', 'success');
    }
}

// ============================================
// PARTICULAS ANIMADAS
// ============================================
function createParticles() {
    const container = document.getElementById('particles');
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDelay = Math.random() * 15 + 's';
        p.style.animationDuration = (10 + Math.random() * 10) + 's';
        container.appendChild(p);
    }
}

// ============================================
// SORTEIOS - ATUALIZADO COM RESULTADOS
// ============================================
function renderSorteios() {
    const grid = document.getElementById('sorteiosGrid');
    const now = new Date();
    const minutosAtual = now.getHours() * 60 + now.getMinutes();

    grid.innerHTML = SORTEIOS.map(sorteio => {
        const minutosSorteio = sorteio.horaMin;
        const minutosAteSorteio = minutosSorteio - minutosAtual;
        const estaAberto = minutosAteSorteio > MINUTOS_FECHAMENTO;
        const jaPassou = minutosAteSorteio < 0;

        let statusClass = '';
        let statusText = '';
        let statusClassBadge = '';

        // VERIFICAR SE TEM RESULTADO NO CACHE
        const resultado = resultadosCache[sorteio.id];
        const temResultado = !!resultado && resultado.numeros && resultado.numeros.length === 5;

        if (jaPassou) {
            if (temResultado) {
                statusClass = 'winner'; // Verde pulsante se tem resultado
                statusText = 'Realizado';
                statusClassBadge = 'status-open';
            } else {
                statusClass = 'closed';
                statusText = 'Encerrado';
                statusClassBadge = 'status-closed';
            }
        } else if (!estaAberto) {
            statusClass = 'closed';
            statusText = 'Fechado';
            statusClassBadge = 'status-closed';
        } else if (minutosAteSorteio <= 30) {
            statusClass = 'active';
            statusText = 'Aberto - Urgente';
            statusClassBadge = 'status-next';
        } else {
            statusClass = '';
            statusText = 'Aberto';
            statusClassBadge = 'status-open';
        }

        const isSelected = selectedSorteio && selectedSorteio.id === sorteio.id;
        if (isSelected) statusClass += ' active';

        // RENDERIZAR BOLAS - COM RESULTADO SE EXISTIR
        let ballsHTML = '';
        if (jaPassou && temResultado) {
            // Mostrar bolas sorteadas
            ballsHTML = resultado.numeros.map((n, i) => 
                `<div class="ball" style="animation-delay:${i * 0.2}s">${n}</div>`
            ).join('');
        } else if (jaPassou) {
            ballsHTML = '<span style="color:#aaa;font-size:12px;">Aguardando resultado...</span>';
        } else {
            ballsHTML = Array(5).fill(0).map(() => '<div class="ball-placeholder"></div>').join('');
        }

        return `
            <div class="sorteio-card ${statusClass}" id="card-${sorteio.id}" onclick="selectSorteio('${sorteio.id}')">
                <div class="sorteio-header">
                    <div>
                        <div class="sorteio-name">${sorteio.nome}</div>
                        <div class="sorteio-time">${sorteio.hora}h</div>
                    </div>
                    <span class="sorteio-status ${statusClassBadge}">${statusText}</span>
                </div>
                <div class="sorteio-balls" id="balls-${sorteio.id}">
                    ${ballsHTML}
                </div>
                <div class="countdown ${minutosAteSorteio <= 30 && minutosAteSorteio > 0 ? 'urgent' : ''}" id="countdown-${sorteio.id}">
                    ${jaPassou && temResultado ? `Numeros: ${resultado.numeros.join(', ')}` : 
                      (jaPassou ? 'Sorteio realizado' : formatCountdown(minutosAteSorteio))}
                </div>
            </div>
        `;
    }).join('');
}

function selectSorteio(sorteioId) {
    const sorteio = SORTEIOS.find(s => s.id === sorteioId);
    const now = new Date();
    const minutosAtual = now.getHours() * 60 + now.getMinutes();
    const minutosAteSorteio = sorteio.horaMin - minutosAtual;

    if (minutosAteSorteio <= MINUTOS_FECHAMENTO && minutosAteSorteio > 0) {
        showToast('As apostas para este sorteio ja estao fechadas!', 'error');
        return;
    }
    if (minutosAteSorteio <= 0) {
        showToast('Este sorteio ja foi realizado!', 'error');
        return;
    }

    selectedSorteio = sorteio;
    document.querySelectorAll('.sorteio-card').forEach(c => c.classList.remove('active'));
    document.getElementById(`card-${sorteioId}`).classList.add('active');
    document.getElementById('sorteioNome').textContent = sorteio.nome;
    document.getElementById('sorteioHora').textContent = sorteio.hora;
    showToast(`Sorteio selecionado: ${sorteio.nome}`, 'info');
}

function updateSorteiosStatus() {
    const now = new Date();
    const minutosAtual = now.getHours() * 60 + now.getMinutes();

    SORTEIOS.forEach(sorteio => {
        const minutosAteSorteio = sorteio.horaMin - minutosAtual;
        const card = document.getElementById(`card-${sorteio.id}`);
        if (!card) return;

        const statusBadge = card.querySelector('.sorteio-status');
        const resultado = resultadosCache[sorteio.id];
        const temResultado = !!resultado && resultado.numeros && resultado.numeros.length === 5;

        if (minutosAteSorteio <= 0) {
            if (temResultado) {
                card.classList.add('winner');
                statusBadge.textContent = 'Realizado';
                statusBadge.className = 'sorteio-status status-open';
            } else {
                card.classList.add('closed');
                statusBadge.textContent = 'Encerrado';
                statusBadge.className = 'sorteio-status status-closed';
            }
        } else if (minutosAteSorteio <= MINUTOS_FECHAMENTO) {
            card.classList.add('closed');
            statusBadge.textContent = 'Fechado';
            statusBadge.className = 'sorteio-status status-closed';
        }
    });
}

function updateCountdowns() {
    const now = new Date();
    const minutosAtual = now.getHours() * 60 + now.getMinutes();

    SORTEIOS.forEach(sorteio => {
        const el = document.getElementById(`countdown-${sorteio.id}`);
        if (!el) return;

        const minutosAteSorteio = sorteio.horaMin - minutosAtual;
        const resultado = resultadosCache[sorteio.id];
        const temResultado = !!resultado && resultado.numeros && resultado.numeros.length === 5;

        if (minutosAteSorteio <= 0) {
            if (temResultado) {
                el.textContent = `Numeros: ${resultado.numeros.join(', ')}`;
                el.classList.remove('urgent');
                el.style.color = '#00ff88';
            } else {
                el.textContent = 'Sorteio realizado';
                el.classList.remove('urgent');
                el.style.color = '';
            }
        } else {
            el.textContent = formatCountdown(minutosAteSorteio);
            el.style.color = '';
            if (minutosAteSorteio <= 30) {
                el.classList.add('urgent');
            } else {
                el.classList.remove('urgent');
            }
        }
    });
}

function formatCountdown(minutos) {
    if (minutos <= 0) return 'Sorteio realizado';
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    if (h > 0) return `Faltam ${h}h ${m}min`;
    return `Faltam ${m}min`;
}

function startCountdowns() {
    // Atualizacoes feitas no intervalo principal
}

// ============================================
// CHANCE SELECTOR
// ============================================
function selectChance(chance) {
    selectedChance = chance;
    selectedNumbers = [];

    document.querySelectorAll('.chance-btn').forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.dataset.chance) === chance);
    });

    document.getElementById('maxSelect').textContent = chance;
    document.getElementById('selectedCount').textContent = '0';
    document.getElementById('selectedBalls').innerHTML = '';
    document.getElementById('btnApostar').disabled = true;

    renderNumbersGrid();
    renderPremiosTab(chance);
    showToast(`Chance ${chance} selecionada - Escolha ${chance} numeros`, 'info');
}

// ============================================
// NUMBER GRID
// ============================================
function renderNumbersGrid() {
    const grid = document.getElementById('numbersGrid');
    grid.innerHTML = '';

    for (let i = 1; i <= 90; i++) {
        const btn = document.createElement('button');
        btn.className = 'num-btn';
        btn.textContent = i;
        btn.dataset.num = i;

        if (selectedNumbers.includes(i)) {
            btn.classList.add('selected');
        }

        if (selectedNumbers.length >= selectedChance && !selectedNumbers.includes(i)) {
            btn.classList.add('disabled');
        }

        btn.onclick = () => toggleNumber(i);
        grid.appendChild(btn);
    }
}

function toggleNumber(num) {
    if (selectedNumbers.includes(num)) {
        selectedNumbers = selectedNumbers.filter(n => n !== num);
    } else {
        if (selectedNumbers.length >= selectedChance) {
            showToast(`Ja selecionou ${selectedChance} numeros!`, 'error');
            return;
        }
        selectedNumbers.push(num);
        selectedNumbers.sort((a, b) => a - b);
    }

    updateSelectedDisplay();
    renderNumbersGrid();
}

function updateSelectedDisplay() {
    document.getElementById('selectedCount').textContent = selectedNumbers.length;
    const container = document.getElementById('selectedBalls');
    container.innerHTML = selectedNumbers.map(n => 
        `<div class="selected-ball">${n}</div>`
    ).join('');

    document.getElementById('btnApostar').disabled = selectedNumbers.length !== selectedChance;
}

function clearSelection() {
    selectedNumbers = [];
    updateSelectedDisplay();
    renderNumbersGrid();
}

// ============================================
// FAZER APOSTA
// ============================================
function fazerAposta() {
    if (!selectedSorteio) {
        showToast('Selecione um sorteio primeiro!', 'error');
        return;
    }
    if (selectedNumbers.length !== selectedChance) {
        showToast(`Selecione exatamente ${selectedChance} numeros!`, 'error');
        return;
    }

    const now = new Date();
    const minutosAtual = now.getHours() * 60 + now.getMinutes();
    const minutosAteSorteio = selectedSorteio.horaMin - minutosAtual;

    if (minutosAteSorteio <= MINUTOS_FECHAMENTO) {
        showToast('As apostas para este sorteio ja estao fechadas!', 'error');
        return;
    }

    const reciboNum = gerarNumeroRecibo();
    const dataAposta = now.toISOString();

    const aposta = {
        recibo: reciboNum,
        sorteioId: selectedSorteio.id,
        sorteioNome: selectedSorteio.nome,
        sorteioHora: selectedSorteio.hora,
        chance: selectedChance,
        numeros: [...selectedNumbers],
        valor: VALOR_APOSTA,
        dataAposta: dataAposta,
        dataSorteio: getDataSorteio(selectedSorteio.horaMin),
        status: 'pendente',
        premio: 0,
        pago: false,
        verificado: false
    };

    // Salvar no Firebase
    const apostaRef = db.ref(`mozlottoganha/apostas/${selectedSorteio.id}/${reciboNum}`);
    apostaRef.set(aposta).then(() => {
        // Atualizar acumulado do sorteio
        const acumuladoRef = db.ref(`mozlottoganha/acumulados/${selectedSorteio.id}/${getDataSorteio(selectedSorteio.horaMin)}`);
        acumuladoRef.transaction(current => {
            return (current || 0) + VALOR_APOSTA;
        });

        // Salvar localmente
        recibosLocal.unshift(aposta);
        localStorage.setItem('mozlottoganha_recibos', JSON.stringify(recibosLocal));

        showToast('Aposta realizada com sucesso!', 'success');
        showReciboModal(aposta);
        renderRecibos();
        updateJackpot();
        clearSelection();
    }).catch(err => {
        showToast('Erro ao salvar aposta: ' + err.message, 'error');
    });
}

function gerarNumeroRecibo() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `MLG${timestamp}${random}`;
}

function getDataSorteio(horaMin) {
    const now = new Date();
    const sorteioHora = Math.floor(horaMin / 60);
    const sorteioMin = horaMin % 60;

    const sorteioDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sorteioHora, sorteioMin);
    if (sorteioDate < now) {
        sorteioDate.setDate(sorteioDate.getDate() + 1);
    }

    return sorteioDate.toISOString().split('T')[0];
}

// ============================================
// RECIBO MODAL
// ============================================
function showReciboModal(aposta) {
    const modal = document.getElementById('modalRecibo');
    const content = document.getElementById('reciboContent');

    const dataAposta = new Date(aposta.dataAposta);
    const dataStr = dataAposta.toLocaleDateString('pt-PT');
    const horaStr = dataAposta.toLocaleTimeString('pt-PT', {hour: '2-digit', minute: '2-digit'});

    // Gerar linhas de código de barras simulado
    const barcodeLines = aposta.recibo.split('').map(() => {
        const widths = ['█', '▓', '▒', '░', '▄', '▀'];
        return widths[Math.floor(Math.random() * widths.length)];
    }).join('');

    content.innerHTML = `
        <div class="pos-recibo" id="posRecibo">
            <!-- CABECALHO -->
            <div class="pos-header">
                <div class="pos-stars">★ ★ ★ ★ ★</div>
                <h3>🎱 MOZLOTTOGANHA</h3>
                <div class="sub">A SUA SORTE EM CADA BOLA</div>
                <div class="sub">RECIBO OFICIAL DE APOSTA</div>
            </div>

            <hr class="pos-divider-double">

            <!-- NUMERO DO RECIBO -->
            <div class="pos-section-title">📋 NÚMERO DO RECIBO</div>
            <div class="pos-line center big">
                <span class="value">${aposta.recibo}</span>
            </div>

            <hr class="pos-divider">

            <!-- DADOS DO SORTEIO -->
            <div class="pos-section-title">🎯 DADOS DO SORTEIO</div>
            <div class="pos-line">
                <span class="label">Sorteio:</span>
                <span class="value">${aposta.sorteioNome}</span>
            </div>
            <div class="pos-line">
                <span class="label">Hora do Sorteio:</span>
                <span class="value">${aposta.sorteioHora}h</span>
            </div>
            <div class="pos-line">
                <span class="label">Data da Aposta:</span>
                <span class="value">${dataStr}</span>
            </div>
            <div class="pos-line">
                <span class="label">Hora da Aposta:</span>
                <span class="value">${horaStr}</span>
            </div>

            <hr class="pos-divider">

            <!-- TIPO DE CHANCE -->
            <div class="pos-section-title">🎲 TIPO DE APOSTA</div>
            <div class="pos-line center big">
                <span class="value">CHANCE ${aposta.chance}</span>
            </div>

            <hr class="pos-divider-double">

            <!-- NUMEROS JOGADOS -->
            <div class="pos-section-title">🔢 NÚMEROS JOGADOS</div>
            <div class="pos-balls-row">
                ${aposta.numeros.map(n => `<div class="pos-ball">${n}</div>`).join('')}
            </div>

            <hr class="pos-divider-double">

            <!-- VALOR -->
            <div class="pos-section-title">💰 VALOR DA APOSTA</div>
            <div class="pos-valor-box">
                <div class="label">Total a Pagar</div>
                <div class="valor">${aposta.valor.toLocaleString('pt-PT')} MTN</div>
            </div>

            <hr class="pos-divider">

            <!-- CODIGO DE BARRAS -->
            <div class="pos-barcode-area">
                <div class="pos-barcode-lines">${barcodeLines}</div>
                <div class="pos-barcode">${aposta.recibo}</div>
            </div>

            <hr class="pos-divider">

            <!-- RODAPE -->
            <div class="pos-footer">
                <div class="pos-stars">★ ★ ★ ★ ★</div>
                <p><strong>BOA SORTE! 🍀</strong></p>
                <p>Guarde este recibo para verificação</p>
                <p>Apresente-o para receber prémios</p>
                <hr class="pos-divider">
                <p>mozlottoganha.com</p>
                <p>${dataStr} ${horaStr}</p>
                <div class="pos-stars">★ ★ ★ ★ ★</div>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('modalRecibo').classList.remove('active');
}

// ============================================
// IMPRESSAO ESC/POS BLUETOOTH
// ============================================

// Comandos ESC/POS basicos
const ESC = 0x1B;
const LF = 0x0A;
const GS = 0x1D;

function createEscPosCommands(text) {
    const commands = [];

    // Inicializar impressora
    commands.push(ESC, 0x40);

    // Centralizar
    commands.push(ESC, 0x61, 0x01);

    // Titulo em negrito e duplo tamanho
    commands.push(ESC, 0x21, 0x30);
    commands.push(...textToBytes('MOZLOTTOGANHA'));
    commands.push(LF);

    // Normal
    commands.push(ESC, 0x21, 0x00);
    commands.push(...textToBytes('A sua sorte em cada bola'));
    commands.push(LF);
    commands.push(...textToBytes('--------------------------------'));
    commands.push(LF);

    // Esquerda
    commands.push(ESC, 0x61, 0x00);

    return new Uint8Array(commands);
}

function textToBytes(text) {
    const encoder = new TextEncoder();
    return Array.from(encoder.encode(text));
}

async function printBluetooth() {
    try {
        if (!navigator.bluetooth) {
            showToast('Web Bluetooth nao suportado neste navegador. Use Chrome no Android/PC.', 'error');
            return;
        }

        // Se nao tem dispositivo conectado, pedir para selecionar
        if (!bluetoothDevice || !bluetoothDevice.gatt.connected) {
            showToast('Procurando impressoras Bluetooth...', 'info');

            bluetoothDevice = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [
                    '000018f0-0000-1000-8000-00805f9b34fb',
                    '0000ff00-0000-1000-8000-00805f9b34fb',
                    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
                    '49535343-fe7d-4ae5-8fa9-9fafd205e455'
                ]
            });
        }

        showToast(`Conectando a ${bluetoothDevice.name || 'impressora'}...`, 'info');

        const server = await bluetoothDevice.gatt.connect();

        // Tentar encontrar o servico de impressao
        let service;
        const serviceUUIDs = [
            '000018f0-0000-1000-8000-00805f9b34fb',
            '0000ff00-0000-1000-8000-00805f9b34fb',
            'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
        ];

        for (const uuid of serviceUUIDs) {
            try {
                service = await server.getPrimaryService(uuid);
                break;
            } catch (e) {
                continue;
            }
        }

        if (!service) {
            // Listar todos os servicos disponiveis
            const services = await server.getPrimaryServices();
            if (services.length > 0) {
                service = services[0];
            } else {
                throw new Error('Nenhum servico encontrado na impressora');
            }
        }

        // Tentar encontrar caracteristica de escrita
        let characteristic;
        const characteristics = await service.getCharacteristics();

        for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
                characteristic = char;
                break;
            }
        }

        if (!characteristic) {
            throw new Error('Nenhuma caracteristica de escrita encontrada');
        }

        bluetoothCharacteristic = characteristic;

        // Gerar dados ESC/POS do recibo
        const reciboData = generateEscPosReceipt();

        // Enviar em chunks de 100 bytes
        const chunkSize = 100;
        for (let i = 0; i < reciboData.length; i += chunkSize) {
            const chunk = reciboData.slice(i, i + chunkSize);
            await characteristic.writeValue(chunk);
        }

        showToast('Recibo enviado para impressora Bluetooth!', 'success');

    } catch (err) {
        console.error('Erro Bluetooth:', err);
        showToast('Erro Bluetooth: ' + err.message, 'error');
    }
}

function generateEscPosReceipt() {
    const reciboEl = document.getElementById('posRecibo');
    const text = reciboEl.innerText;

    const encoder = new TextEncoder();
    const bytes = [];

    // ESC @ - Inicializar
    bytes.push(ESC, 0x40);

    // ESC a 1 - Centralizar
    bytes.push(ESC, 0x61, 0x01);

    // ESC ! 0x30 - Negrito + duplo tamanho
    bytes.push(ESC, 0x21, 0x30);
    bytes.push(...encoder.encode('MOZLOTTOGANHA'));
    bytes.push(LF);

    // ESC ! 0x00 - Normal
    bytes.push(ESC, 0x21, 0x00);
    bytes.push(...encoder.encode('A sua sorte em cada bola'));
    bytes.push(LF);
    bytes.push(...encoder.encode('------------------------'));
    bytes.push(LF);

    // ESC a 0 - Esquerda
    bytes.push(ESC, 0x61, 0x00);

    // Conteudo do recibo
    const lines = text.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && trimmed !== 'MOZLOTTOGANHA' && trimmed !== 'A sua sorte em cada bola' && !trimmed.includes('----')) {
            bytes.push(...encoder.encode(trimmed));
            bytes.push(LF);
        }
    }

    // Feed e corte
    bytes.push(LF, LF, LF);
    bytes.push(GS, 0x56, 0x00); // Corte parcial

    return new Uint8Array(bytes);
}

function printScreen() {
    const recibo = document.getElementById('posRecibo');
    const printWindow = window.open('', '_blank');

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Recibo MozLottoGanha</title>
    <style>
        @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none; }
        }
        body { 
            font-family: 'Courier New', monospace; 
            padding: 20px; background: #f5f5f5; 
            display: flex; justify-content: center;
        }
        .pos-recibo { 
            width: 300px; background: #fff; 
            border: 1px solid #bbb; padding: 18px; 
            box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        }
        .pos-header { text-align: center; padding-bottom: 6px; margin-bottom: 6px; }
        .pos-header h3 { font-size: 18px; margin: 0; letter-spacing: 2px; color: #1a1a2e; }
        .pos-header .sub { font-size: 10px; color: #666; margin: 1px 0; }
        .pos-divider { border: none; border-top: 1px dashed #999; margin: 5px 0; }
        .pos-divider-double { border: none; border-top: 2px solid #333; margin: 5px 0; }
        .pos-section-title { text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 3px 0; color: #333; }
        .pos-line { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
        .pos-line .label { color: #555; }
        .pos-line .value { font-weight: 700; color: #1a1a2e; }
        .pos-line.center { justify-content: center; text-align: center; }
        .pos-line.bold { font-weight: 700; font-size: 12px; }
        .pos-line.big { font-size: 14px; }
        .pos-line.big .value { font-size: 16px; color: #b8860b; }
        .pos-balls-row { display: flex; gap: 6px; justify-content: center; margin: 8px 0; flex-wrap: wrap; padding: 6px 0; }
        .pos-ball {
            width: 32px; height: 32px; border-radius: 50%;
            background: linear-gradient(145deg, #f4c430, #d4a017);
            border: 2px solid #8B6914;
            display: flex; align-items: center; justify-content: center;
            font-size: 13px; font-weight: 900; color: #1a1a2e;
        }
        .pos-barcode-area { text-align: center; margin: 8px 0; padding: 6px; background: #f0f0f0; border-radius: 2px; }
        .pos-barcode { font-size: 12px; letter-spacing: 1px; font-family: monospace; font-weight: 700; color: #333; }
        .pos-barcode-lines { font-size: 20px; line-height: 1; letter-spacing: 0; color: #333; margin: 3px 0; }
        .pos-footer { text-align: center; margin-top: 6px; font-size: 9px; color: #666; padding-top: 6px; }
        .pos-footer p { margin: 1px 0; }
        .pos-stars { font-size: 12px; letter-spacing: 2px; margin: 3px 0; text-align: center; }
        .pos-valor-box { background: #1a1a2e; color: #f4c430; padding: 6px 12px; border-radius: 4px; text-align: center; margin: 6px 0; }
        .pos-valor-box .label { font-size: 9px; text-transform: uppercase; }
        .pos-valor-box .valor { font-size: 18px; font-weight: 900; }
        .print-btn { 
            display: block; width: 200px; margin: 20px auto; 
            padding: 12px; background: #f4c430; color: #1a1a2e; 
            border: none; border-radius: 8px; font-size: 16px; 
            font-weight: 700; cursor: pointer;
        }
    </style>
</head>
<body>
    ${recibo.outerHTML}
    <button class="print-btn no-print" onclick="window.print()">IMPRIMIR RECIBO</button>
    <script>
        window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
        };
    </scr` + `ipt>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    showToast('Janela de impressao aberta!', 'info');
}

// ============================================
// VERIFICAR RECIBO
// ============================================
async function verificarRecibo() {
    const input = document.getElementById('verificarInput').value.trim().toUpperCase();
    const resultDiv = document.getElementById('verificarResult');

    if (!input) {
        showToast('Digite o numero do recibo!', 'error');
        return;
    }

    resultDiv.innerHTML = '<div class="spinner"></div>';

    try {
        // Procurar em todos os sorteios
        let apostaEncontrada = null;
        const snapshot = await db.ref('mozlottoganha/apostas').once('value');
        const apostas = snapshot.val() || {};

        for (const sorteioId in apostas) {
            const sorteioApostas = apostas[sorteioId];
            if (sorteioApostas[input]) {
                apostaEncontrada = sorteioApostas[input];
                break;
            }
        }

        if (!apostaEncontrada) {
            resultDiv.innerHTML = `
                <div style="text-align:center; padding:20px; background:rgba(255,68,68,0.1); border-radius:12px; margin-top:15px;">
                    <i class="fas fa-times-circle" style="font-size:40px; color:#ff4444;"></i>
                    <h3 style="color:#ff4444; margin-top:10px;">Recibo Nao Encontrado</h3>
                    <p style="color:#aaa; font-size:13px;">O codigo <strong>${input}</strong> nao foi gerado pela maquina ou nao existe.</p>
                </div>
            `;
            return;
        }

        // Verificar se ja foi verificado
        if (apostaEncontrada.verificado) {
            resultDiv.innerHTML = `
                <div style="text-align:center; padding:20px; background:rgba(244,196,48,0.1); border-radius:12px; margin-top:15px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:40px; color:#f4c430;"></i>
                    <h3 style="color:#f4c430; margin-top:10px;">Recibo Ja Verificado</h3>
                    <p style="color:#aaa; font-size:13px;">Este recibo ja foi verificado anteriormente.</p>
                </div>
            `;
            return;
        }

        // Verificar resultado do sorteio
        const resultadoSnapshot = await db.ref(`mozlottoganha/resultados/${apostaEncontrada.sorteioId}/${apostaEncontrada.dataSorteio}`).once('value');
        const resultado = resultadoSnapshot.val();

        if (!resultado) {
            resultDiv.innerHTML = `
                <div style="text-align:center; padding:20px; background:rgba(74,144,217,0.1); border-radius:12px; margin-top:15px;">
                    <i class="fas fa-clock" style="font-size:40px; color:#4a90d9;"></i>
                    <h3 style="color:#4a90d9; margin-top:10px;">Sorteio Pendente</h3>
                    <p style="color:#aaa; font-size:13px;">O sorteio ainda nao foi realizado. Aguarde!</p>
                    <div style="margin-top:15px; text-align:left; background:rgba(0,0,0,0.3); padding:15px; border-radius:8px;">
                        <p><strong>Recibo:</strong> ${apostaEncontrada.recibo}</p>
                        <p><strong>Sorteio:</strong> ${apostaEncontrada.sorteioNome}</p>
                        <p><strong>Hora:</strong> ${apostaEncontrada.sorteioHora}h</p>
                        <p><strong>Numeros:</strong> ${apostaEncontrada.numeros.join(', ')}</p>
                        <p><strong>Chance:</strong> ${apostaEncontrada.chance}</p>
                    </div>
                </div>
            `;
            return;
        }

        // Calcular acertos
        const acertos = apostaEncontrada.numeros.filter(n => resultado.numeros.includes(n)).length;
        const premioInfo = PREMIOS[apostaEncontrada.chance].find(p => p.acertos === acertos);
        const premio = premioInfo ? premioInfo.premio : 0;
        const ganhou = premio > 0;

        // Atualizar status no Firebase
        const updates = {
            status: ganhou ? 'ganhou' : 'perdeu',
            premio: premio,
            acertos: acertos,
            numerosSorteados: resultado.numeros,
            verificado: true
        };

        await db.ref(`mozlottoganha/apostas/${apostaEncontrada.sorteioId}/${input}`).update(updates);

        // Atualizar local
        const localIndex = recibosLocal.findIndex(r => r.recibo === input);
        if (localIndex >= 0) {
            recibosLocal[localIndex] = { ...recibosLocal[localIndex], ...updates };
            localStorage.setItem('mozlottoganha_recibos', JSON.stringify(recibosLocal));
        }

        renderRecibos();

        const icon = ganhou ? 'fa-trophy' : 'fa-times-circle';
        const color = ganhou ? '#00ff88' : '#ff4444';
        const title = ganhou ? `PARABENS! Ganhou ${premio} MTN` : 'Nao foi desta vez';

        resultDiv.innerHTML = `
            <div style="text-align:center; padding:20px; background:rgba(${ganhou ? '0,255,136' : '255,68,68'},0.1); border-radius:12px; margin-top:15px;">
                <i class="fas ${icon}" style="font-size:40px; color:${color};"></i>
                <h3 style="color:${color}; margin-top:10px;">${title}</h3>
                <div style="margin-top:15px; text-align:left; background:rgba(0,0,0,0.3); padding:15px; border-radius:8px;">
                    <p><strong>Recibo:</strong> ${apostaEncontrada.recibo}</p>
                    <p><strong>Sorteio:</strong> ${apostaEncontrada.sorteioNome}</p>
                    <p><strong>Numeros Jogados:</strong> ${apostaEncontrada.numeros.join(', ')}</p>
                    <p><strong>Numeros Sorteados:</strong> ${resultado.numeros.join(', ')}</p>
                    <p><strong>Acertos:</strong> ${acertos}</p>
                    <p><strong>Premio:</strong> <span style="color:${color}; font-weight:700;">${premio} MTN</span></p>
                    <p><strong>Status:</strong> ${ganhou ? (apostaEncontrada.pago ? 'Pago' : 'Pendente de Pagamento') : 'Nao premiado'}</p>
                </div>
                ${ganhou && !apostaEncontrada.pago ? `
                    <p style="margin-top:15px; font-size:12px; color:#f4c430;">
                        Apresente este recibo para receber o premio!
                    </p>
                ` : ''}
            </div>
        `;

        if (ganhou) {
            createConfetti();
        }

    } catch (err) {
        resultDiv.innerHTML = '';
        showToast('Erro ao verificar: ' + err.message, 'error');
    }
}

// ============================================
// SORTEIO AUTOMATICO - ATUALIZADO
// ============================================
async function verificarSorteiosPendentes() {
    const now = new Date();
    const minutosAtual = now.getHours() * 60 + now.getMinutes();
    const dataHoje = now.toISOString().split('T')[0];

    for (const sorteio of SORTEIOS) {
        const minutosAteSorteio = sorteio.horaMin - minutosAtual;

        // Se passou 1 minuto do sorteio e ainda nao tem resultado
        if (minutosAteSorteio <= -1) {
            const resultadoRef = db.ref(`mozlottoganha/resultados/${sorteio.id}/${dataHoje}`);
            const snapshot = await resultadoRef.once('value');

            if (!snapshot.exists()) {
                await realizarSorteio(sorteio, dataHoje);
            }
        }
    }
}

async function realizarSorteio(sorteio, dataSorteio) {
    console.log(`Realizando sorteio: ${sorteio.nome}`);

    // Mostrar animacao
    showSorteioAnimation(sorteio);

    // Aguardar animacao
    await new Promise(r => setTimeout(r, 3000));

    try {
        // Buscar todas as apostas do sorteio
        const apostasSnapshot = await db.ref(`mozlottoganha/apostas/${sorteio.id}`).once('value');
        const apostas = apostasSnapshot.val() || {};
        const apostasList = Object.values(apostas).filter(a => a.dataSorteio === dataSorteio);

        // Calcular acumulado
        const acumulado = apostasList.reduce((sum, a) => sum + a.valor, 0);
        const fundoPremios = Math.floor(acumulado * PERCENTUAL_PAGAMENTO);

        // Gerar numeros vencedores com logica inteligente
        const numerosVencedores = gerarNumerosVencedores(apostasList, fundoPremios);

        // Salvar resultado
        await db.ref(`mozlottoganha/resultados/${sorteio.id}/${dataSorteio}`).set({
            numeros: numerosVencedores,
            data: new Date().toISOString(),
            acumulado: acumulado,
            fundoPremios: fundoPremios,
            totalApostas: apostasList.length
        });

        // ATUALIZAR CACHE LOCAL
        resultadosCache[sorteio.id] = {
            numeros: numerosVencedores,
            data: new Date().toISOString(),
            acumulado: acumulado,
            fundoPremios: fundoPremios,
            totalApostas: apostasList.length
        };

        // Atualizar UI com bolas sorteadas
        const ballsContainer = document.getElementById(`balls-${sorteio.id}`);
        if (ballsContainer) {
            ballsContainer.innerHTML = numerosVencedores.map((n, i) => 
                `<div class="ball" style="animation-delay:${i * 0.2}s">${n}</div>`
            ).join('');
        }

        // Atualizar countdown com numeros
        const countdownEl = document.getElementById(`countdown-${sorteio.id}`);
        if (countdownEl) {
            countdownEl.textContent = `Numeros: ${numerosVencedores.join(', ')}`;
            countdownEl.style.color = '#00ff88';
            countdownEl.classList.remove('urgent');
        }

        // Marcar card como vencedor
        const card = document.getElementById(`card-${sorteio.id}`);
        if (card) {
            card.classList.remove('closed');
            card.classList.add('winner');
            const statusBadge = card.querySelector('.sorteio-status');
            if (statusBadge) {
                statusBadge.textContent = 'Realizado';
                statusBadge.className = 'sorteio-status status-open';
            }
        }

        // Atualizar apostas com resultados
        for (const [recibo, aposta] of Object.entries(apostas)) {
            if (aposta.dataSorteio !== dataSorteio) continue;

            const acertos = aposta.numeros.filter(n => numerosVencedores.includes(n)).length;
            const premioInfo = PREMIOS[aposta.chance].find(p => p.acertos === acertos);
            const premio = premioInfo ? premioInfo.premio : 0;

            await db.ref(`mozlottoganha/apostas/${sorteio.id}/${recibo}`).update({
                status: premio > 0 ? 'ganhou' : 'perdeu',
                premio: premio,
                acertos: acertos,
                numerosSorteados: numerosVencedores
            });
        }

        hideSorteioAnimation();
        showToast(`Sorteio ${sorteio.nome} realizado! Numeros: ${numerosVencedores.join(', ')}`, 'success');
        renderRecibos();
        updateJackpot();

    } catch (err) {
        hideSorteioAnimation();
        console.error('Erro no sorteio:', err);
    }
}

function gerarNumerosVencedores(apostasList, fundoPremios) {
    // Se nao ha apostas, gera numeros aleatorios
    if (apostasList.length === 0) {
        return gerarNumerosAleatorios(5, 1, 90);
    }

    // Analisar padroes de apostas
    const numeroFrequencia = {};
    for (let i = 1; i <= 90; i++) numeroFrequencia[i] = 0;

    apostasList.forEach(aposta => {
        aposta.numeros.forEach(n => {
            numeroFrequencia[n] = (numeroFrequencia[n] || 0) + 1;
        });
    });

    // Calcular premios potenciais para diferentes combinacoes
    // A logica: gerar numeros que nao facam o total de premios exceder ~40% do acumulado

    let melhorCombinacao = null;
    let menorDiferenca = Infinity;

    // Tentar varias combinacoes
    for (let tentativa = 0; tentativa < 1000; tentativa++) {
        const candidatos = gerarNumerosAleatorios(5, 1, 90);

        let totalPremios = 0;
        apostasList.forEach(aposta => {
            const acertos = aposta.numeros.filter(n => candidatos.includes(n)).length;
            const premioInfo = PREMIOS[aposta.chance].find(p => p.acertos === acertos);
            if (premioInfo) totalPremios += premioInfo.premio;
        });

        // Queremos que o total de premios seja proximo de 40% do acumulado
        // mas nao exceda muito
        const diferenca = Math.abs(totalPremios - fundoPremios);

        if (totalPremios <= fundoPremios * 1.1 && diferenca < menorDiferenca) {
            menorDiferenca = diferenca;
            melhorCombinacao = candidatos;
        }
    }

    return melhorCombinacao || gerarNumerosAleatorios(5, 1, 90);
}

function gerarNumerosAleatorios(qtd, min, max) {
    const numeros = new Set();
    while (numeros.size < qtd) {
        numeros.add(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return Array.from(numeros).sort((a, b) => a - b);
}

function showSorteioAnimation(sorteio) {
    const overlay = document.getElementById('sorteioOverlay');
    document.getElementById('sorteioOverlayTitle').textContent = `🎱 ${sorteio.nome}`;
    overlay.classList.add('active');
}

function hideSorteioAnimation() {
    document.getElementById('sorteioOverlay').classList.remove('active');
}

// ============================================
// RECIBOS LOCAL
// ============================================
function renderRecibos() {
    const list = document.getElementById('recibosList');

    if (recibosLocal.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#aaa; padding:20px;">Nenhuma aposta realizada ainda</p>';
        return;
    }

    list.innerHTML = recibosLocal.map(recibo => {
        let statusClass = 'status-pendente';
        let statusText = 'Pendente';

        if (recibo.status === 'ganhou') {
            if (recibo.pago) {
                statusClass = 'status-pago';
                statusText = 'Pago';
            } else {
                statusClass = 'status-ganhou';
                statusText = `Ganhou ${recibo.premio} MTN`;
            }
        } else if (recibo.status === 'perdeu') {
            statusClass = 'status-perdeu';
            statusText = 'Nao premiado';
        }

        const data = new Date(recibo.dataAposta);
        const dataStr = data.toLocaleString('pt-PT', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });

        return `
            <div class="recibo-item">
                <div class="recibo-info">
                    <div class="recibo-num">${recibo.recibo}</div>
                    <div class="recibo-detail">
                        ${recibo.sorteioNome} | ${recibo.sorteioHora}h | 
                        Chance ${recibo.chance} | [${recibo.numeros.join(', ')}] | ${dataStr}
                    </div>
                </div>
                <span class="recibo-status ${statusClass}">${statusText}</span>
            </div>
        `;
    }).join('');
}

// ============================================
// PREMIOS
// ============================================
function showPremiosTab(chance) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    renderPremiosTab(chance);
}

function renderPremiosTab(chance) {
    const grid = document.getElementById('premiosGrid');
    const premios = PREMIOS[chance];

    grid.innerHTML = `
        <div class="premio-card">
            <h4>🎱 Chance ${chance} - 5 MTN</h4>
            ${premios.map(p => `
                <div class="premio-item">
                    <span class="acertos">${p.acertos} acerto${p.acertos > 1 ? 's' : ''}</span>
                    <span class="valor">${p.premio.toLocaleString('pt-PT')} MTN</span>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================
// JACKPOT
// ============================================
async function updateJackpot() {
    try {
        const snapshot = await db.ref('mozlottoganha/acumulados').once('value');
        const acumulados = snapshot.val() || {};

        let total = 0;
        const hoje = new Date().toISOString().split('T')[0];

        for (const sorteioId in acumulados) {
            const sorteioAcumulado = acumulados[sorteioId];
            for (const data in sorteioAcumulado) {
                if (data === hoje) {
                    total += sorteioAcumulado[data];
                }
            }
        }

        document.getElementById('jackpotAmount').textContent = total.toLocaleString('pt-PT') + ' MTN';
    } catch (err) {
        console.error('Erro ao atualizar jackpot:', err);
    }
}

// ============================================
// ADMIN PANEL
// ============================================
function toggleAdmin() {
    document.getElementById('adminPanel').classList.toggle('open');
    if (document.getElementById('adminPanel').classList.contains('open')) {
        updateAdminStats();
    }
}

function populateAdminSelects() {
    const selectSorteio = document.getElementById('adminSorteioSelect');
    const selectVer = document.getElementById('adminVerApostasSelect');

    const options = SORTEIOS.map(s => `<option value="${s.id}">${s.nome} (${s.hora}h)</option>`).join('');

    selectSorteio.innerHTML = '<option value="">Selecione o sorteio...</option>' + options;
    selectVer.innerHTML = '<option value="">Selecione o sorteio...</option>' + options;
}

async function updateAdminStats() {
    try {
        const snapshot = await db.ref('mozlottoganha/apostas').once('value');
        const apostas = snapshot.val() || {};
        const hoje = new Date().toISOString().split('T')[0];

        let totalApostas = 0;
        let valorTotal = 0;
        let premiosPagos = 0;
        let bilhetesPerdidos = 0;

        for (const sorteioId in apostas) {
            const sorteioApostas = apostas[sorteioId];
            for (const recibo in sorteioApostas) {
                const aposta = sorteioApostas[recibo];
                if (aposta.dataSorteio === hoje) {
                    totalApostas++;
                    valorTotal += aposta.valor;
                    if (aposta.pago) premiosPagos += aposta.premio;
                    if (aposta.status === 'perdeu') bilhetesPerdidos++;
                }
            }
        }

        document.getElementById('adminTotalApostas').textContent = totalApostas;
        document.getElementById('adminValorTotal').textContent = valorTotal.toLocaleString('pt-PT') + ' MTN';
        document.getElementById('adminPremiosPagos').textContent = premiosPagos.toLocaleString('pt-PT') + ' MTN';
        document.getElementById('adminBilhetesPerdidos').textContent = bilhetesPerdidos;

    } catch (err) {
        console.error('Erro stats admin:', err);
    }
}

async function realizarSorteioManual() {
    const sorteioId = document.getElementById('adminSorteioSelect').value;
    if (!sorteioId) {
        showToast('Selecione um sorteio!', 'error');
        return;
    }

    const sorteio = SORTEIOS.find(s => s.id === sorteioId);
    const dataHoje = new Date().toISOString().split('T')[0];

    await realizarSorteio(sorteio, dataHoje);
}

async function pagarPremio() {
    const recibo = document.getElementById('adminReciboInput').value.trim().toUpperCase();
    if (!recibo) {
        showToast('Digite o numero do recibo!', 'error');
        return;
    }

    try {
        const snapshot = await db.ref('mozlottoganha/apostas').once('value');
        const apostas = snapshot.val() || {};

        for (const sorteioId in apostas) {
            if (apostas[sorteioId][recibo]) {
                await db.ref(`mozlottoganha/apostas/${sorteioId}/${recibo}`).update({
                    pago: true,
                    dataPagamento: new Date().toISOString()
                });

                // Atualizar local
                const localIndex = recibosLocal.findIndex(r => r.recibo === recibo);
                if (localIndex >= 0) {
                    recibosLocal[localIndex].pago = true;
                    localStorage.setItem('mozlottoganha_recibos', JSON.stringify(recibosLocal));
                }

                showToast(`Premio do recibo ${recibo} marcado como pago!`, 'success');
                renderRecibos();
                updateAdminStats();
                return;
            }
        }

        showToast('Recibo nao encontrado!', 'error');
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    }
}

async function verApostasSorteio() {
    const sorteioId = document.getElementById('adminVerApostasSelect').value;
    const listDiv = document.getElementById('adminApostasList');

    if (!sorteioId) {
        showToast('Selecione um sorteio!', 'error');
        return;
    }

    listDiv.innerHTML = '<div class="spinner"></div>';

    try {
        const snapshot = await db.ref(`mozlottoganha/apostas/${sorteioId}`).once('value');
        const apostas = snapshot.val() || {};
        const hoje = new Date().toISOString().split('T')[0];

        const apostasHoje = Object.values(apostas).filter(a => a.dataSorteio === hoje);

        if (apostasHoje.length === 0) {
            listDiv.innerHTML = '<p style="color:#aaa; text-align:center;">Nenhuma aposta hoje</p>';
            return;
        }

        listDiv.innerHTML = apostasHoje.map(a => {
            let status = a.status || 'pendente';
            let statusColor = '#aaa';
            if (status === 'ganhou') statusColor = '#00ff88';
            if (status === 'perdeu') statusColor = '#ff4444';

            return `
                <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; margin-bottom:8px; font-size:12px;">
                    <div style="display:flex; justify-content:space-between;">
                        <strong style="color:#f4c430;">${a.recibo}</strong>
                        <span style="color:${statusColor}">${status.toUpperCase()}</span>
                    </div>
                    <div>Chance ${a.chance} | [${a.numeros.join(', ')}]</div>
                    <div>Premio: ${a.premio || 0} MTN | Pago: ${a.pago ? 'Sim' : 'Nao'}</div>
                </div>
            `;
        }).join('');

    } catch (err) {
        listDiv.innerHTML = '';
        showToast('Erro: ' + err.message, 'error');
    }
}

// ============================================
// UTILIDADES
// ============================================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

function createConfetti() {
    const container = document.getElementById('confettiContainer');
    const colors = ['#f4c430', '#d4a017', '#00ff88', '#ff6b6b', '#4a90d9', '#ff44ff'];

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        confetti.style.width = (5 + Math.random() * 10) + 'px';
        confetti.style.height = (5 + Math.random() * 10) + 'px';
        container.appendChild(confetti);

        setTimeout(() => confetti.remove(), 4000);
    }
}

// Fechar modal ao clicar fora
document.getElementById('modalRecibo').addEventListener('click', (e) => {
    if (e.target.id === 'modalRecibo') closeModal();
});

// Verificar recibo ao pressionar Enter
document.getElementById('verificarInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verificarRecibo();
});
