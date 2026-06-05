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
let bluetoothCharacteristic = null;
let ultimoDiaVerificado = null;
let resultadosCache = {};
let reciboAtual = null; 

// ============================================
// INICIALIZACAO
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    createParticles();
    await carregarResultadosDoDia();
    renderSorteios();
    renderNumbersGrid();
    renderPremiosTab(5);
    renderRecibos();
    updateJackpot();
    startCountdowns();
    populateAdminSelects();

    ultimoDiaVerificado = new Date().getDate();

    setInterval(verificarSorteiosPendentes, 60000);
    setInterval(() => {
        updateSorteiosStatus();
        updateCountdowns();
        verificarMudancaDeDia();
    }, 1000);

    verificarSorteiosPendentes();
});

// ============================================
// CARREGAR RESULTADOS DO DIA
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
    } catch (err) {
        console.error('Erro ao carregar resultados:', err);
    }
}

// ============================================
// VERIFICAR MUDANCA DE DIA
// ============================================
function verificarMudancaDeDia() {
    const agora = new Date();
    const diaAtual = agora.getDate();

    if (ultimoDiaVerificado !== null && diaAtual !== ultimoDiaVerificado) {
        ultimoDiaVerificado = diaAtual;
        resultadosCache = {};
        renderSorteios();
        updateJackpot();
        renderRecibos();
        selectedSorteio = null;
        document.getElementById('sorteioNome').textContent = 'Nenhum';
        document.getElementById('sorteioHora').textContent = '--:--';
        showToast('NOVO DIA! Todos os sorteios estao abertos!', 'success');
    }
}

// ============================================
// PARTICULAS
// ============================================
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    container.innerHTML = '';
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
// SORTEIOS
// ============================================
function renderSorteios() {
    const grid = document.getElementById('sorteosGrid');
    if (!grid) return;
    const now = new Date();
    const minutosAtual = now.getHours() * 60 + now.getMinutes();

    grid.innerHTML = SORTEIOS.map(sorteio => {
        const minutosSorteio = sorteio.horaMin;
        const minutosAteSorteio = minutosSorteio - minutosAtual;
        const estaAberto = minutosAteSorteio > MINUTOS_FECHAMENTO;
        const jaPassou = minutosAteSorteio < 0;

        const resultado = resultadosCache[sorteio.id];
        const temResultado = !!resultado && resultado.numeros && resultado.numeros.length === 5;

        let statusClass = '';
        let statusText = '';
        let statusClassBadge = '';

        if (jaPassou) {
            if (temResultado) {
                statusClass = 'winner';
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

        let ballsHTML = '';
        if (jaPassou && temResultado) {
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
                <div class="sorteio-balls" id="balls-${sorteio.id}">${ballsHTML}</div>
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
    const selectedCard = document.getElementById(`card-${sorteioId}`);
    if (selectedCard) selectedCard.classList.add('active');
    
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
                card.className = 'sorteio-card winner';
                if (statusBadge) {
                    statusBadge.textContent = 'Realizado';
                    statusBadge.className = 'sorteio-status status-open';
                }
            } else {
                card.className = 'sorteio-card closed';
                if (statusBadge) {
                    statusBadge.textContent = 'Encerrado';
                    statusBadge.className = 'sorteio-status status-closed';
                }
            }
        } else if (minutosAteSorteio <= MINUTOS_FECHAMENTO) {
            card.className = 'sorteio-card closed';
            if (statusBadge) {
                statusBadge.textContent = 'Fechado';
                statusBadge.className = 'sorteio-status status-closed';
            }
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
            if (minutosAteSorteio <= 30) el.classList.add('urgent');
            else el.classList.remove('urgent');
        }
    });
}

function formatCountdown(minutos) {
    if (minutos <= 0) return 'Sorteio realizado';
    const h = Math.floor(minutos / 60);
    const m = minutes = minutos % 60;
    if (h > 0) return `Faltam ${h}h ${m}min`;
    return `Faltam ${m}min`;
}

function startCountdowns() {}

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
    if (!grid) return;
    grid.innerHTML = '';

    for (let i = 1; i <= 90; i++) {
        const btn = document.createElement('button');
        btn.className = 'num-btn';
        btn.textContent = i;
        btn.dataset.num = i;

        if (selectedNumbers.includes(i)) btn.classList.add('selected');
        if (selectedNumbers.length >= selectedChance && !selectedNumbers.includes(i)) btn.classList.add('disabled');

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

// ============================================
// PLACEHOLDERS SISTEMA
// ============================================
function renderPremiosTab(chance) {}
function renderRecibos() {}
function updateJackpot() {}
function populateAdminSelects() {}
function verificarSorteiosPendentes() {}
function showToast(msg, type) { console.log(`[${type.toUpperCase()}] ${msg}`); }

function updateSelectedDisplay() {
    document.getElementById('selectedCount').textContent = selectedNumbers.length;
    document.getElementById('selectedBalls').innerHTML = selectedNumbers.map(n => 
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

    const apostaRef = db.ref(`mozlottoganha/apostas/${selectedSorteio.id}/${reciboNum}`);
    apostaRef.set(aposta).then(() => {
        const acumuladoRef = db.ref(`mozlottoganha/acumulados/${selectedSorteio.id}/${getDataSorteio(selectedSorteio.horaMin)}`);
        acumuladoRef.transaction(current => (current || 0) + VALOR_APOSTA);

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
    if (sorteioDate < now) sorteioDate.setDate(sorteioDate.getDate() + 1);
    return sorteioDate.toISOString().split('T')[0];
}

// ============================================
// RECIBO MODAL
// ============================================
function showReciboModal(aposta) {
    reciboAtual = aposta; 

    const modal = document.getElementById('modalRecibo');
    const content = document.getElementById('reciboContent');
    if (!modal || !content) return;

    const dataAposta = new Date(aposta.dataAposta);
    const dataStr = dataAposta.toLocaleDateString('pt-PT');
    const horaStr = dataAposta.toLocaleTimeString('pt-PT', {hour: '2-digit', minute: '2-digit'});

    const barcodeLines = Array(24).fill(0).map(() => {
        const patterns = ['||', '|||', '||||'];
        return patterns[Math.floor(Math.random() * patterns.length)];
    }).join('|');

    content.innerHTML = `
        <div class="pos-recibo" id="posRecibo">
            <div class="pos-header">
                <h3>MOZLOTTOGANHA</h3>
                <div class="sub">A SUA SORTE EM CADA BOLA</div>
                <div class="sub">RECIBO OFICIAL DE APOSTA</div>
            </div>
            <div class="pos-divider">--------------------------------</div>
            <div class="pos-line center bold">
                <span class="value">${aposta.recibo}</span>
            </div>
            <div class="pos-divider">--------------------------------</div>
            <div class="pos-section-title">DADOS DO SORTEIO</div>
            <div class="pos-line">
                <span class="label">Sorteio:</span>
                <span class="value">${aposta.sorteioNome}</span>
            </div>
            <div class="pos-line">
                <span class="label">Hora:</span>
                <span class="value">${aposta.sorteioHora}h</span>
            </div>
            <div class="pos-line">
                <span class="label">Data:</span>
                <span class="value">${dataStr}</span>
            </div>
            <div class="pos-line">
                <span class="label">Hora Reg:</span>
                <span class="value">${horaStr}</span>
            </div>
            <div class="pos-divider">--------------------------------</div>
            <div class="pos-line center big">
                <span class="value">CHANCE ${aposta.chance}</span>
            </div>
            <div class="pos-divider">--------------------------------</div>
            <div class="pos-section-title">NUMEROS JOGADOS</div>
            <div class="pos-balls-row">
                ${aposta.numeros.map(n => `<div class="pos-ball">${String(n).padStart(2, '0')}</div>`).join('')}
            </div>
            <div class="pos-divider">--------------------------------</div>
            <div class="pos-valor-box">
                <div class="label">TOTAL A PAGAR</div>
                <div class="valor">${aposta.valor.toLocaleString('pt-PT')} MTN</div>
            </div>
            <div class="pos-divider">--------------------------------</div>
            <div class="pos-barcode-area">
                <div class="pos-barcode-lines">${barcodeLines}</div>
                <div class="pos-barcode">${aposta.recibo}</div>
            </div>
            <div class="pos-footer">
                <p><strong>BOA SORTE!</strong></p>
                <p>Guarde este recibo para verificacao</p>
                <p>Apresente-o para receber premios</p>
                <p>mozlottoganha.com</p>
                <p>${dataStr} ${horaStr}</p>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('modalRecibo');
    if (modal) modal.classList.remove('active');
}

// ============================================
// IMPRESSAO BLUETOOTH ESC/POS (OTIMIZADO P.O.S)
// ============================================
const ESC = 0x1B;
const LF = 0x0A;
const GS = 0x1D;

async function printBluetooth() {
    try {
        if (!navigator.bluetooth) {
            showToast('Web Bluetooth nao suportado. Use Chrome.', 'error');
            return;
        }

        if (!bluetoothDevice || !bluetoothDevice.gatt.connected) {
            showToast('Selecione a impressora...', 'info');
            bluetoothDevice = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [
                    '000018f0-0000-1000-8000-00805f9b34fb',
                    '0000ff00-0000-1000-8000-00805f9b34fb'
                ]
            });
        }

        showToast(`Conectando...`, 'info');
        const server = await bluetoothDevice.gatt.connect();

        let service;
        const serviceUUIDs = [
            '000018f0-0000-1000-8000-00805f9b34fb',
            '0000ff00-0000-1000-8000-00805f9b34fb'
        ];

        for (const uuid of serviceUUIDs) {
            try { service = await server.getPrimaryService(uuid); break; }
            catch (e) { continue; }
        }

        if (!service) {
            const services = await server.getPrimaryServices();
            if (services.length > 0) service = services[0];
            else throw new Error('Nenhum servico encontrado');
        }

        let characteristic;
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
                characteristic = char;
                break;
            }
        }

        if (!characteristic) throw new Error('Sem caracteristica de escrita');
        bluetoothCharacteristic = characteristic;

        const reciboData = generateEscPosReceipt();

        const chunkSize = 100;
        for (let i = 0; i < reciboData.length; i += chunkSize) {
            const chunk = reciboData.slice(i, i + chunkSize);
            await characteristic.writeValue(chunk);
        }

        showToast('Recibo impresso!', 'success');

    } catch (err) {
        console.error('Erro Bluetooth:', err);
        showToast('Erro: ' + err.message, 'error');
    }
}

function generateEscPosReceipt() {
    const aposta = reciboAtual || {
        recibo: 'MLG000000000',
        sorteioNome: 'Sorteio',
        sorteioHora: '00:00',
        chance: 5,
        numeros: [1,2,3,4,5],
        valor: 5,
        dataAposta: new Date().toISOString()
    };

    const dataAposta = new Date(aposta.dataAposta);
    const dataStr = dataAposta.toLocaleDateString('pt-PT');
    const horaStr = dataAposta.toLocaleTimeString('pt-PT', {hour:'2-digit', minute:'2-digit'});

    const encoder = new TextEncoder();
    const bytes = [];

    // Reset da impressora
    bytes.push(ESC, 0x40);

    // === CABECALHO ===
    bytes.push(ESC, 0x61, 0x01); // Centralizar
    bytes.push(ESC, 0x21, 0x20); // Negrito + Fonte Expandida (Altura Dupla)
    bytes.push(...encoder.encode('MOZLOTTOGANHA'));
    bytes.push(LF);
    bytes.push(ESC, 0x21, 0x00); // Normal
    bytes.push(...encoder.encode('A SUA SORTE EM CADA BOLA'));
    bytes.push(LF);
    bytes.push(...encoder.encode('RECIBO OFICIAL DE APOSTA'));
    bytes.push(LF);
    bytes.push(...encoder.encode('--------------------------------'));
    bytes.push(LF);

    // === ID RECIBO ===
    bytes.push(ESC, 0x21, 0x10); // Negrito Simples
    bytes.push(...encoder.encode(aposta.recibo));
    bytes.push(LF);
    bytes.push(ESC, 0x21, 0x00); // Normal
    bytes.push(...encoder.encode('--------------------------------'));
    bytes.push(LF);

    // === METADADOS DO SORTEIO ===
    bytes.push(ESC, 0x61, 0x00); // Alinhamento a Esquerda
    bytes.push(...encoder.encode('Sorteio: ' + aposta.sorteioNome)); bytes.push(LF);
    bytes.push(...encoder.encode('Hora:    ' + aposta.sorteioHora + 'h')); bytes.push(LF);
    bytes.push(...encoder.encode('Data:    ' + dataStr)); bytes.push(LF);
    bytes.push(...encoder.encode('Registro:' + horaStr)); bytes.push(LF);
    bytes.push(ESC, 0x61, 0x01); // Centralizar
    bytes.push(...encoder.encode('--------------------------------'));
    bytes.push(LF);

    // === MODALIDADE CHANCE ===
    bytes.push(ESC, 0x21, 0x20); // Negrito Expandido
    bytes.push(...encoder.encode('CHANCE ' + aposta.chance));
    bytes.push(LF);
    bytes.push(ESC, 0x21, 0x00); // Normal
    bytes.push(...encoder.encode('--------------------------------'));
    bytes.push(LF);

    // === NUMEROS JOGADOS ===
    bytes.push(...encoder.encode('NUMEROS SELECIONADOS:'));
    bytes.push(LF, LF);
    bytes.push(ESC, 0x21, 0x30); // Fonte Muito Grande (Dupla Largura + Altura)
    const numsFormatted = aposta.numeros.map(n => String(n).padStart(2, '0')).join(' ');
    bytes.push(...encoder.encode(numsFormatted));
    bytes.push(LF);
    bytes.push(ESC, 0x21, 0x00); // Normal
    bytes.push(...encoder.encode('--------------------------------'));
    bytes.push(LF);

    // === CAIXA DE VALOR ===
    bytes.push(...encoder.encode('TOTAL VALOR:'));
    bytes.push(LF);
    bytes.push(ESC, 0x21, 0x30); // Destaque total no dinheiro
    bytes.push(...encoder.encode(aposta.valor + ' MTN'));
    bytes.push(LF);
    bytes.push(ESC, 0x21, 0x00); // Normal
    bytes.push(...encoder.encode('--------------------------------'));
    bytes.push(LF);

    // === CODIGO DE BARRAS SIMULADO ===
    const barcodeSim = Array(18).fill(0).map((_, i) => (i % 2 === 0 ? '|||' : '||')).join('|');
    bytes.push(...encoder.encode(barcodeSim));
    bytes.push(LF);
    bytes.push(...encoder.encode(aposta.recibo));
    bytes.push(LF);
    bytes.push(...encoder.encode('--------------------------------'));
    bytes.push(LF);

    // === RODAPE LEGAL ===
    bytes.push(ESC, 0x21, 0x10);
    bytes.push(...encoder.encode('BOA SORTE!'));
    bytes.push(LF);
    bytes.push(ESC, 0x21, 0x00);
    bytes.push(...encoder.encode('Conserve este bilhete fisico.')); bytes.push(LF);
    bytes.push(...encoder.encode('Validacao automatica via Web.')); bytes.push(LF);
    bytes.push(...encoder.encode('mozlottoganha.com')); bytes.push(LF);
    bytes.push(...encoder.encode(dataStr + ' ' + horaStr)); bytes.push(LF);

    // Feed de papel para corte correto (evita cortar o texto)
    bytes.push(LF, LF, LF, LF);
    // Comando de guilhotina nativo ESC/POS (GS V 0)
    bytes.push(GS, 0x56, 0x00);

    return new Uint8Array(bytes);
}

// ============================================
// IMPRESSAO EM TELA - FORMATO P.O.S REALISTA
// ============================================
function printScreen() {
    const recibo = document.getElementById('posRecibo');
    if (!recibo) return;
    const printWindow = window.open('', '_blank');

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Impressao P.O.S - MozLottoGanha</title>
    <style>
        @media print { 
            body { margin: 0; padding: 0; background: #fff; } 
            .no-print { display: none; } 
            .pos-recibo { border: none !important; box-shadow: none !important; width: 100% !important; padding: 0 !important; }
        }
        body { font-family: 'Courier New', monospace; padding: 10px; background: #eef0f3; display: flex; flex-direction: column; align-items: center; }
        .pos-recibo { width: 280px; background: #fff; border: 1px dashed #aaa; padding: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); font-size: 12px; color: #000; line-height: 1.3; }
        .pos-header { text-align: center; }
        .pos-header h3 { font-size: 16px; margin: 0 0 4px 0; font-weight: bold; letter-spacing: 1px; }
        .pos-header .sub { font-size: 10px; margin: 2px 0; font-weight: bold; }
        .pos-divider { text-align: center; margin: 4px 0; font-weight: bold; letter-spacing: -1px; }
        .pos-section-title { text-align: center; font-size: 10px; font-weight: bold; margin: 4px 0; text-decoration: underline; }
        .pos-line { display: flex; justify-content: space-between; padding: 1px 0; font-size: 11px; }
        .pos-line.center { justify-content: center; text-align: center; }
        .pos-line.bold { font-weight: bold; font-size: 14px; }
        .pos-line.big { font-size: 15px; font-weight: bold; }
        .pos-balls-row { display: flex; gap: 4px; justify-content: center; margin: 6px 0; flex-wrap: wrap; }
        .pos-ball { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; background: #fff; color: #000; }
        .pos-barcode-area { text-align: center; margin: 6px 0; }
        .pos-barcode { font-size: 10px; font-weight: bold; letter-spacing: 1px; }
        .pos-barcode-lines { font-size: 16px; font-weight: normal; letter-spacing: 0; margin-bottom: 2px; overflow: hidden; white-space: nowrap; }
        .pos-footer { text-align: center; font-size: 10px; margin-top: 6px; }
        .pos-footer p { margin: 2px 0; }
        .pos-valor-box { border: 2px solid #000; padding: 6px; text-align: center; margin: 6px 0; background: #fff; }
        .pos-valor-box .label { font-size: 10px; font-weight: bold; }
        .pos-valor-box .valor { font-size: 18px; font-weight: bold; }
        .print-btn { display: block; width: 220px; margin: 15px auto; padding: 10px; background: #1a1a2e; color: #fff; border: none; font-size: 14px; font-weight: bold; cursor: pointer; text-align: center; border-radius: 4px; font-family: sans-serif; }
    </style>
</head>
<body>
    ${recibo.outerHTML}
    <button class="print-btn no-print" onclick="window.print()">CONFIRMAR IMPRESSAO (P.O.S)</button>
    <script>
        window.onload = function() { setTimeout(function() { window.print(); }, 250); };
    </script>
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

    if (resultDiv) resultDiv.innerHTML = '<div class="spinner"></div>';

    try {
        let apostaEncontrada = null;
        const snapshot = await db.ref('mozlottoganha/apostas').once('value');
        const todosSorteios = snapshot.val() || {};

        for (const sorteioId in todosSorteios) {
            if (todosSorteios[sorteioId][input]) {
                apostaEncontrada = todosSorteios[sorteioId][input];
                break;
            }
        }

        if (!apostaEncontrada) {
            if (resultDiv) resultDiv.innerHTML = '<p style="color:#ff4a4a;">Recibo nao encontrado no sistema.</p>';
            return;
        }

        const resultadoSorteio = resultadosCache[apostaEncontrada.sorteioId];
        
        if (!resultadoSorteio || !resultadoSorteio.numeros) {
            if (resultDiv) {
                resultDiv.innerHTML = `
                    <div class="result-box info">
                        <p><strong>Recibo:</strong> ${apostaEncontrada.recibo}</p>
                        <p><strong>Sorteio:</strong> ${apostaEncontrada.sorteioNome} (${apostaEncontrada.sorteioHora}h)</p>
                        <p style="color:#f4c430;">Aguardando a realizacao do sorteio oficial.</p>
                    </div>`;
            }
            return;
        }

        const numerosSorteados = resultadoSorteio.numeros;
        const acertos = apostaEncontrada.numeros.filter(n => numerosSorteados.includes(n)).length;
        
        let valorPremio = 0;
        const tabelaChance = PREMIOS[apostaEncontrada.chance];
        if (tabelaChance) {
            const faixaPremio = tabelaChance.find(p => p.acertos === acertos);
            if (faixaPremio) valorPremio = faixaPremio.premio;
        }

        if (resultDiv) {
            if (valorPremio > 0) {
                resultDiv.innerHTML = `
                    <div class="result-box success" style="border: 2px solid #00ff88; padding: 15px; background: rgba(0,255,136,0.1);">
                        <h4 style="color:#00ff88; margin:0 0 10px 0;">BILHETE PREMIADO! 👑</h4>
                        <p><strong>Recibo:</strong> ${apostaEncontrada.recibo}</p>
                        <p><strong>Acertos:</strong> ${acertos} de ${apostaEncontrada.chance}</p>
                        <p><strong>Numeros Sorteadas:</strong> ${numerosSorteados.join(', ')}</p>
                        <p style="font-size:18px; font-weight:bold; color:#f4c430; margin:10px 0 0 0;">Premio: ${valorPremio.toLocaleString('pt-PT')} MTN</p>
                    </div>`;
            } else {
                resultDiv.innerHTML = `
                    <div class="result-box" style="border: 1px solid #ff4a4a; padding: 15px; background: rgba(255,74,74,0.05);">
                        <h4 style="color:#ff4a4a; margin:0 0 10px 0;">Nao Premiado</h4>
                        <p><strong>Recibo:</strong> ${apostaEncontrada.recibo}</p>
                        <p><strong>Acertos:</strong> ${acertos} acertos</p>
                        <p><strong>Numeros Sorteadas:</strong> ${numerosSorteados.join(', ')}</p>
                    </div>`;
            }
        }

    } catch (err) {
        console.error('Erro ao verificar recibo:', err);
        if (resultDiv) resultDiv.innerHTML = '<p style="color:#ff4a4a;">Erro ao processar verificacao.</p>';
    }
}
