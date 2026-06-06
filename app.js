// ============================================
// MOZLOTTOGANHA - APP.JS COMPLETO (v2)
// Sistema de Lotaria & P.O.S
// CORREÇÃO: Impressão Bluetooth dividida em chunks
// ============================================

// --- CONFIGURAÇÃO FIREBASE ---
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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- CONFIGURAÇÃO DOS SORTEIOS ---
const SORTEOS_CONFIG = [
    { id: 'sorteio1', nome: 'Sorteio da Manhã', hora: '09:00' },
    { id: 'sorteio2', nome: 'Sorteio da Manhã 2', hora: '11:00' },
    { id: 'sorteio3', nome: 'Sorteio do Meio-Dia', hora: '13:00' },
    { id: 'sorteio4', nome: 'Sorteio da Tarde', hora: '15:00' },
    { id: 'sorteio5', nome: 'Sorteio da Tarde 2', hora: '17:00' },
    { id: 'sorteio6', nome: 'Sorteio da Noite', hora: '19:00' },
    { id: 'sorteio7', nome: 'Sorteio da Noite 2', hora: '21:00' },
    { id: 'sorteio8', nome: 'Sorteio da Meia-Noite', hora: '23:00' }
];

// --- ESTADO DA APLICAÇÃO ---
let estado = {
    sorteioSelecionado: null,
    chanceSelecionada: 5,
    numerosSelecionados: [],
    sorteios: {},
    timerInterval: null
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initSorteios();
    initNumbersGrid();
    startTimer();

    // Listener em tempo real para resultados dos sorteios
    db.ref('mozlotto/sorteios').on('value', (snapshot) => {
        const data = snapshot.val() || {};
        estado.sorteios = data;
        atualizarInterfaceSorteios();
    });
});

// ============================================
// SISTEMA DE PARTÍCULAS (FUNDO ANIMADO)
// ============================================
function initParticles() {
    const canvas = document.createElement('canvas');
    canvas.id = 'particleCanvas';
    document.getElementById('particles').appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let particles = [];
    const particleCount = 50;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            size: Math.random() * 2 + 1,
            opacity: Math.random() * 0.5 + 0.1
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 255, 136, ${p.opacity})`;
            ctx.fill();
        });

        requestAnimationFrame(animate);
    }
    animate();
}

// ============================================
// SISTEMA DE SORTEIOS
// ============================================
function initSorteios() {
    const grid = document.getElementById('sorteosGrid');
    grid.innerHTML = '';

    SORTEOS_CONFIG.forEach(config => {
        const card = document.createElement('div');
        card.className = 'sorteio-card';
        card.id = `card-${config.id}`;
        card.onclick = () => selecionarSorteio(config.id);

        card.innerHTML = `
            <div class="sorteio-header">
                <div>
                    <div class="sorteio-name">${config.nome}</div>
                    <div class="sorteio-time">${config.hora}</div>
                </div>
                <span class="sorteio-status status-next" id="status-${config.id}">AGUARDANDO</span>
            </div>
            <div class="sorteio-balls" id="balls-${config.id}">
                <div class="ball-placeholder"></div>
                <div class="ball-placeholder"></div>
                <div class="ball-placeholder"></div>
                <div class="ball-placeholder"></div>
                <div class="ball-placeholder"></div>
            </div>
            <div class="countdown" id="countdown-${config.id}">--:--:--</div>
        `;

        grid.appendChild(card);
    });
}

function selecionarSorteio(sorteioId) {
    document.querySelectorAll('.sorteio-card').forEach(c => c.classList.remove('active'));

    const card = document.getElementById(`card-${sorteioId}`);
    if (card.classList.contains('closed')) {
        alert('Este sorteio já foi realizado! Selecione um sorteio aberto.');
        return;
    }

    card.classList.add('active');
    estado.sorteioSelecionado = sorteioId;

    const config = SORTEOS_CONFIG.find(s => s.id === sorteioId);
    document.getElementById('sorteioNome').textContent = config.nome;
    document.getElementById('sorteioHora').textContent = config.hora;

    atualizarBotaoApostar();
}

function atualizarInterfaceSorteios() {
    const agora = new Date();

    SORTEOS_CONFIG.forEach(config => {
        const [hora, minuto] = config.hora.split(':').map(Number);
        const horaSorteio = new Date();
        horaSorteio.setHours(hora, minuto, 0, 0);

        const card = document.getElementById(`card-${config.id}`);
        const statusEl = document.getElementById(`status-${config.id}`);
        const ballsEl = document.getElementById(`balls-${config.id}`);
        const countdownEl = document.getElementById(`countdown-${config.id}`);

        const sorteioData = estado.sorteios[config.id];

        if (sorteioData && sorteioData.resultado && sorteioData.resultado.length === 5) {
            card.classList.add('closed');
            card.classList.remove('active');
            statusEl.className = 'sorteio-status status-closed';
            statusEl.textContent = 'REALIZADO';

            ballsEl.innerHTML = sorteioData.resultado.map(num => 
                `<div class="ball">${String(num).padStart(2, '0')}</div>`
            ).join('');

            countdownEl.textContent = 'SORTEIO COMPLETO';
            countdownEl.classList.remove('urgent');

            if (estado.sorteioSelecionado === config.id) {
                estado.sorteioSelecionado = null;
                document.getElementById('sorteioNome').textContent = 'Nenhum';
                document.getElementById('sorteioHora').textContent = '--:--';
            }
        } else if (horaSorteio > agora) {
            card.classList.remove('closed');
            statusEl.className = 'sorteio-status status-open';
            statusEl.textContent = 'ABERTO';

            const diff = horaSorteio - agora;
            const horas = Math.floor(diff / 3600000);
            const minutos = Math.floor((diff % 3600000) / 60000);
            const segundos = Math.floor((diff % 60000) / 1000);

            countdownEl.textContent = `Fecha em: ${String(horas).padStart(2,'0')}:${String(minutos).padStart(2,'0')}:${String(segundos).padStart(2,'0')}`;

            if (diff < 1800000) {
                countdownEl.classList.add('urgent');
            } else {
                countdownEl.classList.remove('urgent');
            }

            ballsEl.innerHTML = Array(5).fill('<div class="ball-placeholder"></div>').join('');
        } else {
            card.classList.remove('closed');
            statusEl.className = 'sorteio-status status-open';
            statusEl.textContent = 'SORTEANDO...';
            countdownEl.textContent = 'SORTEIO EM ANDAMENTO';
            countdownEl.classList.add('urgent');

            realizarSorteio(config.id);
        }
    });
}

function startTimer() {
    if (estado.timerInterval) clearInterval(estado.timerInterval);
    estado.timerInterval = setInterval(() => {
        atualizarInterfaceSorteios();
    }, 1000);
}

// ============================================
// REALIZAR SORTEIO
// ============================================
function realizarSorteio(sorteioId) {
    db.ref(`mozlotto/sorteios/${sorteioId}/resultado`).once('value', (snapshot) => {
        if (snapshot.exists()) return;

        const numeros = new Set();
        while (numeros.size < 5) {
            numeros.add(Math.floor(Math.random() * 90) + 1);
        }
        const resultado = Array.from(numeros).sort((a, b) => a - b);

        const agora = new Date();
        db.ref(`mozlotto/sorteios/${sorteioId}`).set({
            resultado: resultado,
            dataRealizacao: agora.toISOString(),
            totalApostas: 0,
            totalPremios: 0
        });

        console.log(`Sorteio ${sorteioId} realizado:`, resultado);
    });
}

function forcarSorteio(sorteioId) {
    const numeros = new Set();
    while (numeros.size < 5) {
        numeros.add(Math.floor(Math.random() * 90) + 1);
    }
    const resultado = Array.from(numeros).sort((a, b) => a - b);

    db.ref(`mozlotto/sorteios/${sorteioId}`).set({
        resultado: resultado,
        dataRealizacao: new Date().toISOString(),
        totalApostas: 0,
        totalPremios: 0
    });
}

// ============================================
// GRELLHA NUMÉRICA (1-90)
// ============================================
function initNumbersGrid() {
    const grid = document.getElementById('numbersGrid');
    grid.innerHTML = '';

    for (let i = 1; i <= 90; i++) {
        const btn = document.createElement('button');
        btn.className = 'num-btn';
        btn.textContent = String(i).padStart(2, '0');
        btn.dataset.numero = i;
        btn.onclick = () => toggleNumero(i);
        grid.appendChild(btn);
    }
}

function selectChance(chance) {
    estado.chanceSelecionada = chance;

    document.querySelectorAll('.chance-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.chance) === chance) {
            btn.classList.add('selected');
        }
    });

    document.getElementById('maxSelect').textContent = chance;

    if (estado.numerosSelecionados.length > chance) {
        estado.numerosSelecionados = estado.numerosSelecionados.slice(0, chance);
        atualizarNumerosSelecionados();
    }

    atualizarBotaoApostar();
}

function toggleNumero(numero) {
    const index = estado.numerosSelecionados.indexOf(numero);

    if (index > -1) {
        estado.numerosSelecionados.splice(index, 1);
    } else {
        if (estado.numerosSelecionados.length < estado.chanceSelecionada) {
            estado.numerosSelecionados.push(numero);
            estado.numerosSelecionados.sort((a, b) => a - b);
        } else {
            alert(`Você só pode selecionar ${estado.chanceSelecionada} números para Chance ${estado.chanceSelecionada}!`);
            return;
        }
    }

    atualizarNumerosSelecionados();
}

function atualizarNumerosSelecionados() {
    document.querySelectorAll('.num-btn').forEach(btn => {
        const num = parseInt(btn.dataset.numero);
        btn.classList.toggle('selected', estado.numerosSelecionados.includes(num));
    });

    document.getElementById('selectedCount').textContent = estado.numerosSelecionados.length;

    const display = document.getElementById('selectedBalls');
    display.innerHTML = estado.numerosSelecionados.map(num => 
        `<div class="selected-ball">${String(num).padStart(2, '0')}</div>`
    ).join('');

    atualizarBotaoApostar();
}

function clearSelection() {
    estado.numerosSelecionados = [];
    atualizarNumerosSelecionados();
}

function atualizarBotaoApostar() {
    const btn = document.getElementById('btnApostar');
    const podeApostar = estado.sorteioSelecionado && 
                        estado.numerosSelecionados.length === estado.chanceSelecionada;
    btn.disabled = !podeApostar;
}

// ============================================
// FAZER APOSTA
// ============================================
function fazerAposta() {
    if (!estado.sorteioSelecionado) {
        alert('Selecione um sorteio primeiro!');
        return;
    }

    if (estado.numerosSelecionados.length !== estado.chanceSelecionada) {
        alert(`Selecione exatamente ${estado.chanceSelecionada} números!`);
        return;
    }

    const config = SORTEOS_CONFIG.find(s => s.id === estado.sorteioSelecionado);
    const idRecibo = gerarIdRecibo();
    const valorAposta = 5;

    const multiplicadores = { 2: 40, 3: 100, 4: 300, 5: 1000 };
    const premioPotencial = valorAposta * multiplicadores[estado.chanceSelecionada];

    const aposta = {
        id: idRecibo,
        sorteioId: estado.sorteioSelecionado,
        sorteioNome: config.nome,
        sorteioHora: config.hora,
        numeros: [...estado.numerosSelecionados],
        chance: estado.chanceSelecionada,
        valor: valorAposta,
        premioPotencial: premioPotencial,
        dataAposta: new Date().toISOString(),
        status: 'PENDENTE',
        pago: false
    };

    db.ref(`mozlotto/apostas/${idRecibo}`).set(aposta)
        .then(() => {
            db.ref(`mozlotto/sorteios/${estado.sorteioSelecionado}/totalApostas`).transaction(c => (c || 0) + 1);
            mostrarRecibo(aposta);
            clearSelection();
        })
        .catch(err => {
            console.error('Erro ao salvar aposta:', err);
            alert('Erro ao registrar aposta. Tente novamente.');
        });
}

function gerarIdRecibo() {
    const prefixo = 'MLG';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefixo}-${timestamp}-${random}`;
}

// ============================================
// RECIBO POS E MODAL
// ============================================
function mostrarRecibo(aposta) {
    const config = SORTEOS_CONFIG.find(s => s.id === aposta.sorteioId);
    const data = new Date(aposta.dataAposta);
    const dataStr = data.toLocaleDateString('pt-MZ');
    const horaStr = data.toLocaleTimeString('pt-MZ');

    const multiplicadores = { 2: '40x', 3: '100x', 4: '300x', 5: '1000x' };

    const reciboHTML = `
        <div class="pos-recibo" id="posReciboPrint">
            <div class="pos-header">
                <h3>MOZLOTTOGANHA</h3>
                <div class="sub">Sistema de Lotaria & P.O.S</div>
                <div class="sub">Moçambique</div>
            </div>
            <div class="pos-divider">========================</div>
            <div class="pos-section-title">RECIBO DE APOSTA</div>
            <div class="pos-line">
                <span>ID:</span>
                <span>${aposta.id}</span>
            </div>
            <div class="pos-line">
                <span>Data:</span>
                <span>${dataStr} ${horaStr}</span>
            </div>
            <div class="pos-divider">------------------------</div>
            <div class="pos-line bold">
                <span>SORTEIO:</span>
                <span>${aposta.sorteioNome}</span>
            </div>
            <div class="pos-line">
                <span>Hora:</span>
                <span>${aposta.sorteioHora}</span>
            </div>
            <div class="pos-divider">------------------------</div>
            <div class="pos-section-title">NUMEROS APOSTADOS</div>
            <div class="pos-balls-row">
                ${aposta.numeros.map(n => `<div class="pos-ball">${String(n).padStart(2,'0')}</div>`).join('')}
            </div>
            <div class="pos-line">
                <span>Chance:</span>
                <span>${aposta.chance} (${multiplicadores[aposta.chance]})</span>
            </div>
            <div class="pos-divider">------------------------</div>
            <div class="pos-valor-box">
                <div class="label">VALOR DA APOSTA</div>
                <div class="valor">${aposta.valor.toFixed(2)} MTN</div>
            </div>
            <div class="pos-valor-box" style="border-color: #00aa00;">
                <div class="label">PREMIO POTENCIAL</div>
                <div class="valor" style="color: #00aa00;">${aposta.premioPotencial.toFixed(2)} MTN</div>
            </div>
            <div class="pos-divider">------------------------</div>
            <div class="pos-barcode-area">
                <div class="pos-barcode-lines">||||||||||||||||||||||||</div>
                <div class="pos-barcode">${aposta.id}</div>
            </div>
            <div class="pos-divider">========================</div>
            <div class="pos-footer">
                <p>Guarde este recibo para verificacao</p>
                <p>Apresente em caso de premio</p>
                <p>Suporte: 860407269</p>
                <p>Islammocambique@gmail.com</p>
                <p>BOA SORTE!</p>
            </div>
        </div>
    `;

    document.getElementById('reciboContent').innerHTML = reciboHTML;
    document.getElementById('modalRecibo').classList.add('active');
}

function closeModal() {
    document.getElementById('modalRecibo').classList.remove('active');
}

function printScreen() {
    const recibo = document.getElementById('posReciboPrint');
    if (!recibo) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Recibo MOZLOTTOGANHA</title>
            <style>
                body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; }
                .pos-recibo { width: 280px; background: #fff; color: #000; padding: 15px; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.3; border: 1px dashed #777; }
                .pos-header { text-align: center; }
                .pos-header h3 { font-size: 16px; margin: 0 0 4px 0; font-weight: bold; }
                .pos-header .sub { font-size: 10px; margin: 2px 0; font-weight: bold; }
                .pos-divider { text-align: center; margin: 5px 0; font-weight: bold; }
                .pos-section-title { text-align: center; font-size: 10px; font-weight: bold; margin: 6px 0; text-decoration: underline; }
                .pos-line { display: flex; justify-content: space-between; padding: 2px 0; }
                .pos-line.center { justify-content: center; }
                .pos-line.bold { font-weight: bold; font-size: 14px; }
                .pos-line.big { font-size: 15px; font-weight: bold; }
                .pos-balls-row { display: flex; gap: 5px; justify-content: center; margin: 8px 0; }
                .pos-ball { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; background: #fff; }
                .pos-valor-box { border: 2px solid #000; padding: 6px; text-align: center; margin: 8px 0; }
                .pos-valor-box .label { font-size: 10px; font-weight: bold; }
                .pos-valor-box .valor { font-size: 18px; font-weight: bold; }
                .pos-barcode-area { text-align: center; margin: 8px 0; }
                .pos-barcode-lines { font-size: 14px; letter-spacing: 1px; white-space: nowrap; overflow: hidden; }
                .pos-barcode { font-size: 9px; font-weight: bold; }
                .pos-footer { text-align: center; font-size: 9px; margin-top: 8px; }
                .pos-footer p { margin: 2px 0; }
            </style>
        </head>
        <body>
            ${recibo.outerHTML}
            <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ============================================
// IMPRESSAO BLUETOOTH CORRIGIDA
// Divide em chunks de 512 bytes e usa ESC/POS
// ============================================
async function printBluetooth() {
    if (!navigator.bluetooth) {
        alert('Web Bluetooth API nao disponivel. Use Chrome/Edge no Android ou imprima via navegador.');
        return;
    }

    try {
        // Comandos ESC/POS basicos
        const ESC = 0x1B;
        const GS = 0x1D;
        const INIT = new Uint8Array([ESC, 0x40]); // Initialize printer
        const CENTER = new Uint8Array([ESC, 0x61, 0x01]); // Center align
        const LEFT = new Uint8Array([ESC, 0x61, 0x00]); // Left align
        const BOLD_ON = new Uint8Array([ESC, 0x45, 0x01]); // Bold on
        const BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00]); // Bold off
        const DOUBLE_ON = new Uint8Array([ESC, 0x21, 0x30]); // Double width/height
        const DOUBLE_OFF = new Uint8Array([ESC, 0x21, 0x00]); // Normal
        const CUT = new Uint8Array([GS, 0x56, 0x00]); // Cut paper
        const FEED = new Uint8Array([ESC, 0x64, 0x03]); // Feed 3 lines
        const LINE = new Uint8Array([0x0A]); // Line feed

        const aposta = estado.ultimaAposta;
        if (!aposta) {
            alert('Nenhuma aposta recente para imprimir.');
            return;
        }

        const multiplicadores = { 2: '40x', 3: '100x', 4: '300x', 5: '1000x' };
        const data = new Date(aposta.dataAposta);
        const dataStr = data.toLocaleDateString('pt-MZ');
        const horaStr = data.toLocaleTimeString('pt-MZ');

        // Construir conteudo do recibo em texto simples (sem acentos para compatibilidade)
        const linhas = [
            '    MOZLOTTOGANHA',
            'Sistema de Lotaria & P.O.S',
            '    Mocambique',
            '========================',
            '     RECIBO DE APOSTA',
            '------------------------',
            `ID: ${aposta.id}`,
            `Data: ${dataStr} ${horaStr}`,
            '------------------------',
            `SORTEIO: ${aposta.sorteioNome}`,
            `Hora: ${aposta.sorteioHora}`,
            '------------------------',
            '    NUMEROS APOSTADOS',
            `    ${aposta.numeros.map(n => String(n).padStart(2,'0')).join(' ')}`,
            `Chance: ${aposta.chance} (${multiplicadores[aposta.chance]})`,
            '------------------------',
            '   VALOR DA APOSTA',
            `   ${aposta.valor.toFixed(2)} MTN`,
            '',
            '   PREMIO POTENCIAL',
            `   ${aposta.premioPotencial.toFixed(2)} MTN`,
            '------------------------',
            `Cod: ${aposta.id}`,
            '========================',
            'Guarde este recibo',
            'Apresente em caso de premio',
            'Suporte: 860407269',
            'Islammocambique@gmail.com',
            '      BOA SORTE!',
            ''
        ];

        // Converter para bytes
        const encoder = new TextEncoder();
        let allBytes = new Uint8Array(0);

        // Adicionar init
        allBytes = concatBytes(allBytes, INIT);
        allBytes = concatBytes(allBytes, CENTER);
        allBytes = concatBytes(allBytes, BOLD_ON);
        allBytes = concatBytes(allBytes, DOUBLE_ON);
        allBytes = concatBytes(allBytes, encoder.encode('MOZLOTTOGANHA'));
        allBytes = concatBytes(allBytes, DOUBLE_OFF);
        allBytes = concatBytes(allBytes, BOLD_OFF);
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, encoder.encode('Sistema de Lotaria & P.O.S'));
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, encoder.encode('Mocambique'));
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, encoder.encode('========================'));
        allBytes = concatBytes(allBytes, LINE);

        allBytes = concatBytes(allBytes, BOLD_ON);
        allBytes = concatBytes(allBytes, encoder.encode('RECIBO DE APOSTA'));
        allBytes = concatBytes(allBytes, BOLD_OFF);
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, encoder.encode('------------------------'));
        allBytes = concatBytes(allBytes, LINE);

        allBytes = concatBytes(allBytes, LEFT);
        allBytes = concatBytes(allBytes, encoder.encode(`ID: ${aposta.id}`));
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, encoder.encode(`Data: ${dataStr} ${horaStr}`));
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, encoder.encode('------------------------'));
        allBytes = concatBytes(allBytes, LINE);

        allBytes = concatBytes(allBytes, BOLD_ON);
        allBytes = concatBytes(allBytes, encoder.encode(`SORTEIO: ${aposta.sorteioNome}`));
        allBytes = concatBytes(allBytes, BOLD_OFF);
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, encoder.encode(`Hora: ${aposta.sorteioHora}`));
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, encoder.encode('------------------------'));
        allBytes = concatBytes(allBytes, LINE);

        allBytes = concatBytes(allBytes, CENTER);
        allBytes = concatBytes(allBytes, encoder.encode('NUMEROS APOSTADOS'));
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, DOUBLE_ON);
        allBytes = concatBytes(allBytes, encoder.encode(aposta.numeros.map(n => String(n).padStart(2,'0')).join(' ')));
        allBytes = concatBytes(allBytes, DOUBLE_OFF);
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, encoder.encode(`Chance ${aposta.chance} (${multiplicadores[aposta.chance]})`));
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, encoder.encode('------------------------'));
        allBytes = concatBytes(allBytes, LINE);

        allBytes = concatBytes(allBytes, encoder.encode('VALOR DA APOSTA'));
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, DOUBLE_ON);
        allBytes = concatBytes(allBytes, encoder.encode(`${aposta.valor.toFixed(2)} MTN`));
        allBytes = concatBytes(allBytes, DOUBLE_OFF);
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, LINE);

        allBytes = concatBytes(allBytes, encoder.encode('PREMIO POTENCIAL'));
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, DOUBLE_ON);
        allBytes = concatBytes(allBytes, encoder.encode(`${aposta.premioPotencial.toFixed(2)} MTN`));
        allBytes = concatBytes(allBytes, DOUBLE_OFF);
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, encoder.encode('------------------------'));
        allBytes = concatBytes(allBytes, LINE);

        allBytes = concatBytes(allBytes, encoder.encode(`Cod: ${aposta.id}`));
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, encoder.encode('========================'));
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, encoder.encode('Guarde este recibo'));
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, encoder.encode('Apresente em caso de premio'));
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, encoder.encode('Suporte: 860407269'));
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, encoder.encode('Islammocambique@gmail.com'));
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, BOLD_ON);
        allBytes = concatBytes(allBytes, DOUBLE_ON);
        allBytes = concatBytes(allBytes, encoder.encode('BOA SORTE!'));
        allBytes = concatBytes(allBytes, DOUBLE_OFF);
        allBytes = concatBytes(allBytes, BOLD_OFF);
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, LINE);
        allBytes = concatBytes(allBytes, FEED);
        allBytes = concatBytes(allBytes, CUT);

        // Conectar a impressora
        const device = await navigator.bluetooth.requestDevice({
            filters: [
                { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
                { namePrefix: 'Printer' },
                { namePrefix: 'POS' },
                { namePrefix: 'Bluetooth' }
            ],
            optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '0000ff00-0000-1000-8000-00805f9b34fb']
        });

        const server = await device.gatt.connect();

        // Tentar diferentes servicos e caracteristicas comuns em impressoras termicas
        const servicesToTry = [
            '000018f0-0000-1000-8000-00805f9b34fb',
            'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
            '0000ff00-0000-1000-8000-00805f9b34fb'
        ];

        const characteristicsToTry = [
            '00002af1-0000-1000-8000-00805f9b34fb',
            'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
            '0000ff02-0000-1000-8000-00805f9b34fb'
        ];

        let characteristic = null;

        for (const serviceUUID of servicesToTry) {
            try {
                const service = await server.getPrimaryService(serviceUUID);
                for (const charUUID of characteristicsToTry) {
                    try {
                        characteristic = await service.getCharacteristic(charUUID);
                        break;
                    } catch (e) {}
                }
                if (characteristic) break;
            } catch (e) {}
        }

        if (!characteristic) {
            throw new Error('Nao foi possivel encontrar a caracteristica de impressao. Tente outra impressora.');
        }

        // Enviar em chunks de 500 bytes (deixando margem de seguranca)
        const CHUNK_SIZE = 500;
        for (let i = 0; i < allBytes.length; i += CHUNK_SIZE) {
            const chunk = allBytes.slice(i, i + CHUNK_SIZE);
            await characteristic.writeValue(chunk);
            // Pequena pausa entre chunks para a impressora processar
            await new Promise(r => setTimeout(r, 100));
        }

        alert('Recibo enviado para impressora Bluetooth com sucesso!');

    } catch (err) {
        console.error('Erro Bluetooth:', err);
        alert('Erro ao imprimir: ' + err.message + '\n\nTente usar "Imprimir via Navegador (P.O.S)" como alternativa.');
    }
}

// Funcao auxiliar para concatenar Uint8Arrays
function concatBytes(a, b) {
    const result = new Uint8Array(a.length + b.length);
    result.set(a, 0);
    result.set(b, a.length);
    return result;
}

// ============================================
// VERIFICADOR DE RECIBOS
// ============================================
function verificarRecibo() {
    const input = document.getElementById('verificarInput');
    const idRecibo = input.value.trim().toUpperCase();
    const resultDiv = document.getElementById('verificarResult');

    if (!idRecibo) {
        resultDiv.innerHTML = '<p style="color: #ff4a4a;">Insira um ID de recibo!</p>';
        return;
    }

    resultDiv.innerHTML = '<p style="color: var(--text-muted);">Verificando...</p>';

    db.ref(`mozlotto/apostas/${idRecibo}`).once('value', (snapshot) => {
        const aposta = snapshot.val();

        if (!aposta) {
            resultDiv.innerHTML = '<p style="color: #ff4a4a;">❌ Recibo nao encontrado! Verifique o ID.</p>';
            return;
        }

        // Guardar aposta para impressao
        estado.ultimaAposta = aposta;

        db.ref(`mozlotto/sorteios/${aposta.sorteioId}/resultado`).once('value', (resSnapshot) => {
            const resultado = resSnapshot.val();

            if (!resultado) {
                resultDiv.innerHTML = `
                    <div style="background: var(--bg-card); padding: 15px; border-radius: 8px; border: 1px solid #252545;">
                        <h4 style="color: var(--accent); margin-top: 0;">📋 RECIBO VALIDO</h4>
                        <p><strong>ID:</strong> ${aposta.id}</p>
                        <p><strong>Sorteio:</strong> ${aposta.sorteioNome} (${aposta.sorteioHora})</p>
                        <p><strong>Numeros:</strong> ${aposta.numeros.map(n => String(n).padStart(2,'0')).join(', ')}</p>
                        <p><strong>Chance:</strong> ${aposta.chance}</p>
                        <p><strong>Valor:</strong> ${aposta.valor.toFixed(2)} MTN</p>
                        <p><strong>Status:</strong> <span style="color: #f4c430;">⏳ Aguardando sorteio</span></p>
                        <p style="color: var(--text-muted); font-size: 0.85rem;">O sorteio ainda nao foi realizado. Volte apos ${aposta.sorteioHora}.</p>
                    </div>
                `;
                return;
            }

            const acertos = aposta.numeros.filter(n => resultado.includes(n));
            const numAcertos = acertos.length;
            const ganhou = numAcertos >= aposta.chance;

            let premio = 0;
            if (ganhou) {
                const multiplicadores = { 2: 40, 3: 100, 4: 300, 5: 1000 };
                premio = aposta.valor * multiplicadores[aposta.chance];
            }

            const statusColor = ganhou ? '#00ff88' : (numAcertos > 0 ? '#f4c430' : '#ff4a4a');
            const statusText = ganhou ? '🎉 GANHADOR!' : (numAcertos > 0 ? `⚠️ Acertou ${numAcertos} numero(s)` : '❌ Nao foi desta vez');

            let html = `
                <div style="background: var(--bg-card); padding: 15px; border-radius: 8px; border: 1px solid ${statusColor};">
                    <h4 style="color: ${statusColor}; margin-top: 0;">${statusText}</h4>
                    <p><strong>ID:</strong> ${aposta.id}</p>
                    <p><strong>Sorteio:</strong> ${aposta.sorteioNome}</p>
                    <div style="margin: 10px 0;">
                        <p style="margin: 5px 0;"><strong>Numeros Sorteados:</strong></p>
                        <div style="display: flex; gap: 5px; justify-content: center;">
                            ${resultado.map(n => {
                                const acertou = aposta.numeros.includes(n);
                                return `<div style="width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; background: ${acertou ? '#00ff88' : '#f4c430'}; color: #000;">${String(n).padStart(2,'0')}</div>`;
                            }).join('')}
                        </div>
                    </div>
                    <div style="margin: 10px 0;">
                        <p style="margin: 5px 0;"><strong>Seus Numeros:</strong></p>
                        <div style="display: flex; gap: 5px; justify-content: center;">
                            ${aposta.numeros.map(n => {
                                const acertou = resultado.includes(n);
                                return `<div style="width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; background: ${acertou ? '#00ff88' : '#1f1f3a'}; color: ${acertou ? '#000' : '#fff'}; border: 1px solid ${acertou ? '#00ff88' : '#2f2f54'};">${String(n).padStart(2,'0')}</div>`;
                            }).join('')}
                        </div>
                    </div>
                    <p><strong>Acertos:</strong> ${numAcertos} de ${aposta.chance} necessarios</p>
            `;

            if (ganhou) {
                html += `
                    <div style="background: rgba(0, 255, 136, 0.1); border: 2px solid #00ff88; padding: 10px; border-radius: 6px; text-align: center; margin: 10px 0;">
                        <p style="margin: 0; font-size: 0.9rem;">PREMIO A RECEBER</p>
                        <p style="margin: 5px 0; font-size: 1.5rem; font-weight: bold; color: #00ff88;">${premio.toFixed(2)} MTN</p>
                    </div>
                `;

                if (!aposta.pago) {
                    html += `
                        <button onclick="pagarPremio('${aposta.id}', ${premio})" style="width: 100%; padding: 12px; background: #00ff88; color: #000; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 1rem;">
                            💰 CONFIRMAR PAGAMENTO DO PREMIO
                        </button>
                    `;
                } else {
                    html += `<p style="color: #00ff88; text-align: center; font-weight: bold;">✅ PREMIO JA PAGO</p>`;
                }
            }

            html += `</div>`;
            resultDiv.innerHTML = html;
        });
    });
}

function pagarPremio(idRecibo, valor) {
    if (!confirm(`Confirmar pagamento de ${valor.toFixed(2)} MTN para o recibo ${idRecibo}?`)) {
        return;
    }

    db.ref(`mozlotto/apostas/${idRecibo}`).update({
        pago: true,
        dataPagamento: new Date().toISOString(),
        valorPago: valor
    }).then(() => {
        db.ref(`mozlotto/apostas/${idRecibo}`).once('value', (snap) => {
            const aposta = snap.val();
            if (aposta) {
                db.ref(`mozlotto/sorteios/${aposta.sorteioId}/totalPremios`).transaction(c => (c || 0) + valor);
            }
        });

        alert(`✅ Premio de ${valor.toFixed(2)} MTN pago com sucesso!`);
        verificarRecibo();
    }).catch(err => {
        alert('Erro ao processar pagamento: ' + err.message);
    });
}

// ============================================
// FUNCOES DE UTILIDADE
// ============================================
document.getElementById('modalRecibo').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalRecibo')) {
        closeModal();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});
