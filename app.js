// ============================================
// MOZLOTTOGANHA - APP.JS COMPLETO (v5 FINAL)
// Regras EXATAS do utilizador
// ============================================

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

// --- SORTEIOS EXATOS DO UTILIZADOR ---
const SORTEOS_CONFIG = [
    { id: 's1', nome: 'Sorteio Manha Quente', hora: '08:00' },
    { id: 's2', nome: 'Sorteio da Sorte', hora: '10:00' },
    { id: 's3', nome: 'Sorteio Meio Dia', hora: '12:00' },
    { id: 's4', nome: 'Sorteio do Lanche', hora: '14:00' },
    { id: 's5', nome: 'Sorteio Por do Sol', hora: '16:00' },
    { id: 's6', nome: 'Sorteio o Ultimo Comboio', hora: '18:00' },
    { id: 's7', nome: 'Sorteio Boa Noite', hora: '20:00' },
    { id: 's8', nome: 'Sorteio da Despedida', hora: '22:00' }
];

// --- TABELA DE PREMIOS EXATA ---
const TABELA_PREMIOS = {
    5: { 5: 500000, 4: 15000, 3: 500, 2: 50, 1: 5 },
    4: { 4: 10000, 3: 500, 2: 100, 1: 10 },
    3: { 3: 5000, 2: 50, 1: 5 },
    2: { 2: 250, 1: 25 }
};

// Multiplicadores para calculo do premio potencial no recibo
const MULTIPLICADORES = { 5: '500000x', 4: '10000x', 3: '5000x', 2: '250x' };

let estado = {
    sorteioSelecionado: null,
    chanceSelecionada: 5,
    numerosSelecionados: [],
    sorteios: {},
    timerInterval: null,
    ultimaAposta: null,
    btDevice: null,
    btCharacteristic: null
};

document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initSorteios();
    initNumbersGrid();
    startTimer();

    db.ref('mozlotto/sorteios').on('value', (snapshot) => {
        estado.sorteios = snapshot.val() || {};
        atualizarInterfaceSorteios();
    });
});

// ============================================
// PARTICULAS
// ============================================
function initParticles() {
    const canvas = document.createElement('canvas');
    canvas.id = 'particleCanvas';
    document.getElementById('particles').appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let particles = [];

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 50; i++) {
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
            p.x += p.vx; p.y += p.vy;
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
// SORTEIOS
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
        alert('Este sorteio ja foi realizado!');
        return;
    }
    if (card.classList.contains('locked')) {
        alert('Apostas encerradas! Faltam menos de 15 minutos.');
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

        const horaFecho = new Date(horaSorteio.getTime() - 15 * 60000);

        const card = document.getElementById(`card-${config.id}`);
        const statusEl = document.getElementById(`status-${config.id}`);
        const ballsEl = document.getElementById(`balls-${config.id}`);
        const countdownEl = document.getElementById(`countdown-${config.id}`);

        const sorteioData = estado.sorteios[config.id];

        // Sorteio ja realizado
        if (sorteioData && sorteioData.resultado && sorteioData.resultado.length === 5) {
            card.classList.add('closed');
            card.classList.remove('active', 'locked');
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
            return;
        }

        // Apostas encerradas (menos de 15 minutos) mas sorteio nao realizado
        if (agora >= horaFecho && agora < horaSorteio) {
            card.classList.remove('active');
            card.classList.add('locked');
            statusEl.className = 'sorteio-status status-closed';
            statusEl.textContent = 'FECHADO';

            const diff = horaSorteio - agora;
            const minutos = Math.floor(diff / 60000);
            const segundos = Math.floor((diff % 60000) / 1000);
            countdownEl.textContent = `Sorteio em: ${String(minutos).padStart(2,'0')}:${String(segundos).padStart(2,'0')}`;
            countdownEl.classList.add('urgent');

            ballsEl.innerHTML = Array(5).fill('<div class="ball-placeholder"></div>').join('');

            if (estado.sorteioSelecionado === config.id) {
                estado.sorteioSelecionado = null;
                document.getElementById('sorteioNome').textContent = 'Nenhum';
                document.getElementById('sorteioHora').textContent = '--:--';
            }
            return;
        }

        // Sorteio futuro - aberto para apostas
        if (horaSorteio > agora) {
            card.classList.remove('closed', 'locked');
            statusEl.className = 'sorteio-status status-open';
            statusEl.textContent = 'ABERTO';

            const diff = horaFecho - agora;
            const horas = Math.floor(diff / 3600000);
            const minutos = Math.floor((diff % 3600000) / 60000);
            const segundos = Math.floor((diff % 60000) / 1000);

            countdownEl.textContent = `Fecha em: ${String(horas).padStart(2,'0')}:${String(minutos).padStart(2,'0')}:${String(segundos).padStart(2,'0')}`;
            countdownEl.classList.remove('urgent');

            ballsEl.innerHTML = Array(5).fill('<div class="ball-placeholder"></div>').join('');
        } else {
            // Hora passou mas nao tem resultado - realizar sorteio
            card.classList.remove('closed', 'locked');
            statusEl.className = 'sorteio-status status-open';
            statusEl.textContent = 'SORTEANDO...';
            countdownEl.textContent = 'SORTEIO EM ANDAMENTO';
            countdownEl.classList.add('urgent');

            realizarSorteioInteligente(config.id);
        }
    });
}

function startTimer() {
    if (estado.timerInterval) clearInterval(estado.timerInterval);
    estado.timerInterval = setInterval(atualizarInterfaceSorteios, 1000);
}

// ============================================
// SORTEIO INTELIGENTE (~40% PAYOUT)
// ============================================
async function realizarSorteioInteligente(sorteioId) {
    // Verificar se ja existe resultado
    const snap = await db.ref(`mozlotto/sorteios/${sorteioId}/resultado`).once('value');
    if (snap.exists()) return;

    // Buscar todas as apostas deste sorteio
    const apostasSnap = await db.ref('mozlotto/apostas').orderByChild('sorteioId').equalTo(sorteioId).once('value');
    const apostas = apostasSnap.val() || {};
    const listaApostas = Object.values(apostas);

    const totalArrecadado = listaApostas.reduce((sum, a) => sum + (a.valor || 5), 0);
    const maxPremios = Math.floor(totalArrecadado * 0.40);

    // Gerar resultado inteligente
    let melhorResultado = null;
    let melhorCusto = Infinity;

    // Tentar varias combinacoes e escolher uma que fique dentro do orcamento
    for (let tentativa = 0; tentativa < 500; tentativa++) {
        const numeros = new Set();
        while (numeros.size < 5) {
            numeros.add(Math.floor(Math.random() * 90) + 1);
        }
        const resultado = Array.from(numeros).sort((a, b) => a - b);

        // Calcular custo total de premios com este resultado
        let custoPremios = 0;
        listaApostas.forEach(aposta => {
            const acertos = aposta.numeros.filter(n => resultado.includes(n)).length;
            const premio = TABELA_PREMIOS[aposta.chance]?.[acertos] || 0;
            custoPremios += premio;
        });

        // Se custo <= 40% do arrecadado, e o melhor ate agora
        if (custoPremios <= maxPremios && custoPremios < melhorCusto) {
            melhorResultado = resultado;
            melhorCusto = custoPremios;
        }

        // Se encontrou um resultado viavel, para
        if (melhorResultado && tentativa > 50) break;
    }

    // Se nao encontrou nenhum resultado viavel, gera aleatorio (raro)
    if (!melhorResultado) {
        const numeros = new Set();
        while (numeros.size < 5) {
            numeros.add(Math.floor(Math.random() * 90) + 1);
        }
        melhorResultado = Array.from(numeros).sort((a, b) => a - b);
        melhorCusto = 0;
        listaApostas.forEach(aposta => {
            const acertos = aposta.numeros.filter(n => melhorResultado.includes(n)).length;
            melhorCusto += TABELA_PREMIOS[aposta.chance]?.[acertos] || 0;
        });
    }

    await db.ref(`mozlotto/sorteios/${sorteioId}`).set({
        resultado: melhorResultado,
        dataRealizacao: new Date().toISOString(),
        totalArrecadado: totalArrecadado,
        maxPremios: maxPremios,
        totalPremios: melhorCusto,
        totalApostas: listaApostas.length
    });

    console.log(`Sorteio ${sorteioId}:`, melhorResultado, `Custo: ${melhorCusto}/${maxPremios} MTN`);
}

function forcarSorteio(sorteioId) {
    realizarSorteioInteligente(sorteioId);
}

// ============================================
// GRELLHA NUMERICA
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
        btn.classList.toggle('selected', parseInt(btn.dataset.chance) === chance);
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
            alert(`Maximo ${estado.chanceSelecionada} numeros!`);
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
    document.getElementById('selectedBalls').innerHTML = estado.numerosSelecionados.map(num => 
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
    const pode = estado.sorteioSelecionado && 
                 estado.numerosSelecionados.length === estado.chanceSelecionada;
    btn.disabled = !pode;
}

// ============================================
// FAZER APOSTA
// ============================================
function fazerAposta() {
    if (!estado.sorteioSelecionado) {
        alert('Selecione um sorteio!');
        return;
    }
    if (estado.numerosSelecionados.length !== estado.chanceSelecionada) {
        alert(`Selecione ${estado.chanceSelecionada} numeros!`);
        return;
    }

    const config = SORTEOS_CONFIG.find(s => s.id === estado.sorteioSelecionado);
    const idRecibo = gerarIdRecibo();
    const valorAposta = 5;

    // Premio maximo potencial (todos acertos)
    const premioMaximo = TABELA_PREMIOS[estado.chanceSelecionada][estado.chanceSelecionada];

    const aposta = {
        id: idRecibo,
        sorteioId: estado.sorteioSelecionado,
        sorteioNome: config.nome,
        sorteioHora: config.hora,
        numeros: [...estado.numerosSelecionados],
        chance: estado.chanceSelecionada,
        valor: valorAposta,
        premioMaximo: premioMaximo,
        dataAposta: new Date().toISOString(),
        pago: false
    };

    db.ref(`mozlotto/apostas/${idRecibo}`).set(aposta)
        .then(() => {
            estado.ultimaAposta = aposta;
            mostrarRecibo(aposta);
            clearSelection();
        })
        .catch(err => {
            alert('Erro ao registrar: ' + err.message);
        });
}

function gerarIdRecibo() {
    return 'MLG-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2,5).toUpperCase();
}

// ============================================
// RECIBO
// ============================================
function mostrarRecibo(aposta) {
    const data = new Date(aposta.dataAposta);
    const dataStr = data.toLocaleDateString('pt-MZ');
    const horaStr = data.toLocaleTimeString('pt-MZ');

    const reciboHTML = `
        <div class="pos-recibo" id="posReciboPrint">
            <div class="pos-header">
                <h3>MOZLOTTOGANHA</h3>
                <div class="sub">Sistema de Lotaria & P.O.S</div>
                <div class="sub">Mocambique</div>
            </div>
            <div class="pos-divider">========================</div>
            <div class="pos-section-title">RECIBO DE APOSTA</div>
            <div class="pos-line"><span>ID:</span><span>${aposta.id}</span></div>
            <div class="pos-line"><span>Data:</span><span>${dataStr} ${horaStr}</span></div>
            <div class="pos-divider">------------------------</div>
            <div class="pos-line bold"><span>SORTEIO:</span><span>${aposta.sorteioNome}</span></div>
            <div class="pos-line"><span>Hora:</span><span>${aposta.sorteioHora}</span></div>
            <div class="pos-divider">------------------------</div>
            <div class="pos-section-title">NUMEROS APOSTADOS</div>
            <div class="pos-balls-row">
                ${aposta.numeros.map(n => `<div class="pos-ball">${String(n).padStart(2,'0')}</div>`).join('')}
            </div>
            <div class="pos-line"><span>Chance:</span><span>${aposta.chance}</span></div>
            <div class="pos-divider">------------------------</div>
            <div class="pos-valor-box">
                <div class="label">VALOR DA APOSTA</div>
                <div class="valor">${aposta.valor.toFixed(2)} MTN</div>
            </div>
            <div class="pos-valor-box" style="border-color: #00aa00;">
                <div class="label">PREMIO MAXIMO</div>
                <div class="valor" style="color: #00aa00;">${aposta.premioMaximo.toLocaleString('pt-MZ')} MTN</div>
            </div>
            <div class="pos-divider">------------------------</div>
            <div class="pos-barcode-area">
                <div class="pos-barcode-lines">||||||||||||||||||||||||</div>
                <div class="pos-barcode">${aposta.id}</div>
            </div>
            <div class="pos-divider">========================</div>
            <div class="pos-footer">
                <p>Guarde este recibo</p>
                <p>Apresente em caso de premio</p>
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
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Recibo</title><style>
        body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f0f0f0}
        .pos-recibo{width:280px;background:#fff;color:#000;padding:15px;font-family:'Courier New',monospace;font-size:12px;line-height:1.3;border:1px dashed #777}
        .pos-header{text-align:center}.pos-header h3{font-size:16px;margin:0 0 4px;font-weight:bold}
        .pos-header .sub{font-size:10px;margin:2px 0;font-weight:bold}
        .pos-divider{text-align:center;margin:5px 0;font-weight:bold}
        .pos-section-title{text-align:center;font-size:10px;font-weight:bold;margin:6px 0;text-decoration:underline}
        .pos-line{display:flex;justify-content:space-between;padding:2px 0}
        .pos-line.bold{font-weight:bold;font-size:14px}
        .pos-balls-row{display:flex;gap:5px;justify-content:center;margin:8px 0}
        .pos-ball{width:28px;height:28px;border-radius:50%;border:2px solid #000;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;background:#fff}
        .pos-valor-box{border:2px solid #000;padding:6px;text-align:center;margin:8px 0}
        .pos-valor-box .label{font-size:10px;font-weight:bold}
        .pos-valor-box .valor{font-size:18px;font-weight:bold}
        .pos-barcode-area{text-align:center;margin:8px 0}
        .pos-barcode-lines{font-size:14px;letter-spacing:1px;white-space:nowrap;overflow:hidden}
        .pos-barcode{font-size:9px;font-weight:bold}
        .pos-footer{text-align:center;font-size:9px;margin-top:8px}
        .pos-footer p{margin:2px 0}
    </style></head><body>${recibo.outerHTML}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)};</script></body></html>`);
    w.document.close();
}

// ============================================
// IMPRESSAO BLUETOOTH
// ============================================
async function printBluetooth() {
    if (estado.btDevice && estado.btCharacteristic) {
        try {
            if (estado.btDevice.gatt.connected) {
                await enviarParaImpressora(estado.btCharacteristic);
                return;
            }
        } catch (e) {
            estado.btDevice = null;
            estado.btCharacteristic = null;
        }
    }

    if (!navigator.bluetooth) {
        alert('Use Chrome no Android.');
        return;
    }

    try {
        const BT_CONFIGS = [
            { service: '000018f0-0000-1000-8000-00805f9b34fb', characteristic: '00002af1-0000-1000-8000-00805f9b34fb' },
            { service: '000018f0-0000-1000-8000-00805f9b34fb', characteristic: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
            { service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', characteristic: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
            { service: '0000ff00-0000-1000-8000-00805f9b34fb', characteristic: '0000ff02-0000-1000-8000-00805f9b34fb' },
            { service: '0000ff00-0000-1000-8000-00805f9b34fb', characteristic: '0000ff01-0000-1000-8000-00805f9b34fb' },
            { service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', characteristic: '6e400002-b5a3-f393-e0a9-e50e24dcca9e' },
            { service: '0000ffe0-0000-1000-8000-00805f9b34fb', characteristic: '0000ffe1-0000-1000-8000-00805f9b34fb' }
        ];

        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: BT_CONFIGS.map(c => c.service)
        });

        estado.btDevice = device;
        const server = await device.gatt.connect();

        let characteristic = null;
        for (const config of BT_CONFIGS) {
            try {
                const service = await server.getPrimaryService(config.service);
                try {
                    characteristic = await service.getCharacteristic(config.characteristic);
                    break;
                } catch (e) {}
            } catch (e) {}
        }

        if (!characteristic) {
            const services = await server.getPrimaryServices();
            for (const service of services) {
                const chars = await service.getCharacteristics();
                for (const char of chars) {
                    if (char.properties.write || char.properties.writeWithoutResponse) {
                        characteristic = char;
                        break;
                    }
                }
                if (characteristic) break;
            }
        }

        if (!characteristic) throw new Error('Caracteristica nao encontrada.');

        estado.btCharacteristic = characteristic;
        await enviarParaImpressora(characteristic);

    } catch (err) {
        alert('Erro: ' + err.message + '\nUse "Imprimir via Navegador".');
    }
}

async function enviarParaImpressora(characteristic) {
    const aposta = estado.ultimaAposta;
    if (!aposta) { alert('Sem aposta.'); return; }

    const ESC = 0x1B, GS = 0x1D;
    const INIT = new Uint8Array([ESC, 0x40]);
    const CENTER = new Uint8Array([ESC, 0x61, 0x01]);
    const LEFT = new Uint8Array([ESC, 0x61, 0x00]);
    const BOLD_ON = new Uint8Array([ESC, 0x45, 0x01]);
    const BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00]);
    const DOUBLE_ON = new Uint8Array([ESC, 0x21, 0x30]);
    const DOUBLE_OFF = new Uint8Array([ESC, 0x21, 0x00]);
    const HEIGHT_ON = new Uint8Array([ESC, 0x21, 0x10]);
    const HEIGHT_OFF = new Uint8Array([ESC, 0x21, 0x00]);
    const CUT = new Uint8Array([GS, 0x56, 0x00]);
    const FEED_3 = new Uint8Array([ESC, 0x64, 0x03]);
    const FEED_5 = new Uint8Array([ESC, 0x64, 0x05]);
    const LINE = new Uint8Array([0x0A]);

    const data = new Date(aposta.dataAposta);
    const dataStr = data.toLocaleDateString('pt-MZ');
    const horaStr = data.toLocaleTimeString('pt-MZ');

    const partes = [];
    function addBytes(arr) { partes.push(arr); }
    function addText(txt) { partes.push(new TextEncoder().encode(txt)); }

    addBytes(INIT); addBytes(FEED_3);
    addBytes(CENTER); addBytes(BOLD_ON); addBytes(DOUBLE_ON);
    addText('MOZLOTTOGANHA');
    addBytes(DOUBLE_OFF); addBytes(BOLD_OFF); addBytes(LINE);
    addText('Sistema de Lotaria'); addBytes(LINE);
    addText('Mocambique'); addBytes(LINE);
    addText('========================'); addBytes(LINE);
    addBytes(BOLD_ON); addText('RECIBO DE APOSTA'); addBytes(BOLD_OFF); addBytes(LINE);
    addText('------------------------'); addBytes(LINE);
    addBytes(LEFT);
    addText(`ID: ${aposta.id}`); addBytes(LINE);
    addText(`Data: ${dataStr} ${horaStr}`); addBytes(LINE);
    addText('------------------------'); addBytes(LINE);
    addBytes(BOLD_ON); addText(`SORTEIO: ${aposta.sorteioNome}`); addBytes(BOLD_OFF); addBytes(LINE);
    addText(`Hora: ${aposta.sorteioHora}`); addBytes(LINE);
    addText('------------------------'); addBytes(LINE);
    addBytes(CENTER); addText('NUMEROS APOSTADOS'); addBytes(LINE);
    addBytes(DOUBLE_ON);
    addText(aposta.numeros.map(n => String(n).padStart(2,'0')).join(' '));
    addBytes(DOUBLE_OFF); addBytes(LINE);
    addText(`Chance ${aposta.chance}`); addBytes(LINE);
    addText('------------------------'); addBytes(LINE);
    addText('VALOR DA APOSTA'); addBytes(LINE);
    addBytes(HEIGHT_ON); addText(`${aposta.valor.toFixed(2)} MTN`); addBytes(HEIGHT_OFF); addBytes(LINE); addBytes(LINE);
    addText('PREMIO MAXIMO'); addBytes(LINE);
    addBytes(HEIGHT_ON); addText(`${aposta.premioMaximo.toLocaleString('pt-MZ')} MTN`); addBytes(HEIGHT_OFF); addBytes(LINE);
    addText('------------------------'); addBytes(LINE);
    addText(`Cod: ${aposta.id}`); addBytes(LINE);
    addText('========================'); addBytes(LINE);
    addText('Guarde este recibo'); addBytes(LINE);
    addText('Apresente em caso de premio'); addBytes(LINE); addBytes(LINE);
    addBytes(BOLD_ON); addBytes(DOUBLE_ON); addText('BOA SORTE!'); addBytes(DOUBLE_OFF); addBytes(BOLD_OFF);
    addBytes(LINE); addBytes(LINE); addBytes(LINE);
    addBytes(FEED_5); addBytes(CUT);

    let totalLength = 0;
    partes.forEach(p => totalLength += p.length);
    const allBytes = new Uint8Array(totalLength);
    let offset = 0;
    partes.forEach(p => { allBytes.set(p, offset); offset += p.length; });

    const CHUNK_SIZE = 100;
    for (let i = 0; i < allBytes.length; i += CHUNK_SIZE) {
        const chunk = allBytes.slice(i, i + CHUNK_SIZE);
        try {
            if (characteristic.properties.writeWithoutResponse) {
                await characteristic.writeValueWithoutResponse(chunk);
            } else {
                await characteristic.writeValue(chunk);
            }
        } catch (e) {
            if (chunk.length > 50) {
                await characteristic.writeValueWithoutResponse(chunk.slice(0, 50));
                await new Promise(r => setTimeout(r, 200));
                await characteristic.writeValueWithoutResponse(chunk.slice(50));
            } else throw e;
        }
        await new Promise(r => setTimeout(r, 200));
    }
    alert('Recibo enviado!');
}

// ============================================
// VERIFICADOR DE RECIBOS - CORRIGIDO
// Mostra PREMIO REAL baseado na tabela
// ============================================
function verificarRecibo() {
    const input = document.getElementById('verificarInput');
    const idRecibo = input.value.trim().toUpperCase();
    const resultDiv = document.getElementById('verificarResult');

    if (!idRecibo) {
        resultDiv.innerHTML = '<p style="color: #ff4a4a;">Insira um ID!</p>';
        return;
    }

    resultDiv.innerHTML = '<p style="color: var(--text-muted);">Verificando...</p>';

    db.ref(`mozlotto/apostas/${idRecibo}`).once('value', (snapshot) => {
        const aposta = snapshot.val();

        if (!aposta) {
            resultDiv.innerHTML = '<p style="color: #ff4a4a;">❌ Recibo nao encontrado!</p>';
            return;
        }

        estado.ultimaAposta = aposta;

        db.ref(`mozlotto/sorteios/${aposta.sorteioId}/resultado`).once('value', (resSnapshot) => {
            const resultado = resSnapshot.val();

            // Sorteio ainda nao realizado
            if (!resultado) {
                resultDiv.innerHTML = `
                    <div style="background: var(--bg-card); padding: 15px; border-radius: 8px; border: 1px solid #252545;">
                        <h4 style="color: var(--accent); margin-top: 0;">📋 RECIBO VALIDO</h4>
                        <p><strong>ID:</strong> ${aposta.id}</p>
                        <p><strong>Sorteio:</strong> ${aposta.sorteioNome} (${aposta.sorteioHora})</p>
                        <p><strong>Numeros:</strong> ${aposta.numeros.map(n => String(n).padStart(2,'0')).join(', ')}</p>
                        <p><strong>Chance:</strong> ${aposta.chance}</p>
                        <p><strong>Valor:</strong> ${aposta.valor.toFixed(2)} MTN</p>
                        <p><strong>Premio Maximo:</strong> ${aposta.premioMaximo.toLocaleString('pt-MZ')} MTN</p>
                        <p style="color: #f4c430;">⏳ Sorteio nao realizado. Volte apos ${aposta.sorteioHora}.</p>
                    </div>
                `;
                return;
            }

            // Calcular acertos
            const acertos = aposta.numeros.filter(n => resultado.includes(n));
            const numAcertos = acertos.length;

            // Calcular PREMIO REAL pela tabela
            const premio = TABELA_PREMIOS[aposta.chance]?.[numAcertos] || 0;
            const ganhou = premio > 0;

            const statusColor = ganhou ? '#00ff88' : '#ff4a4a';
            const statusText = ganhou 
                ? `🎉 GANHOU ${premio.toLocaleString('pt-MZ')} MTN!` 
                : `❌ Acertou ${numAcertos} - Sem premio`;

            let html = `
                <div style="background: var(--bg-card); padding: 15px; border-radius: 8px; border: 2px solid ${statusColor};">
                    <h3 style="color: ${statusColor}; margin-top: 0; font-size: 1.3rem; text-align: center;">${statusText}</h3>
                    <hr style="border-color: #252545; margin: 10px 0;">
                    <p><strong>ID:</strong> ${aposta.id}</p>
                    <p><strong>Sorteio:</strong> ${aposta.sorteioNome}</p>

                    <div style="margin: 12px 0;">
                        <p style="margin: 5px 0; color: var(--text-muted);"><strong>Numeros Sorteados:</strong></p>
                        <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
                            ${resultado.map(n => {
                                const acertou = aposta.numeros.includes(n);
                                return `<div style="width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1rem; background: ${acertou ? '#00ff88' : '#f4c430'}; color: #000; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">${String(n).padStart(2,'0')}</div>`;
                            }).join('')}
                        </div>
                    </div>

                    <div style="margin: 12px 0;">
                        <p style="margin: 5px 0; color: var(--text-muted);"><strong>Seus Numeros:</strong></p>
                        <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
                            ${aposta.numeros.map(n => {
                                const acertou = resultado.includes(n);
                                return `<div style="width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1rem; background: ${acertou ? '#00ff88' : '#1f1f3a'}; color: ${acertou ? '#000' : '#fff'}; border: 2px solid ${acertou ? '#00ff88' : '#2f2f54'};">${String(n).padStart(2,'0')}</div>`;
                            }).join('')}
                        </div>
                    </div>

                    <p><strong>Acertos:</strong> ${numAcertos} de ${aposta.chance} jogados</p>
                    <p><strong>Chance:</strong> ${aposta.chance}</p>
            `;

            if (ganhou) {
                html += `
                    <div style="background: rgba(0, 255, 136, 0.15); border: 2px solid #00ff88; padding: 15px; border-radius: 8px; text-align: center; margin: 15px 0;">
                        <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted);">PREMIO A RECEBER</p>
                        <p style="margin: 8px 0; font-size: 2rem; font-weight: bold; color: #00ff88;">${premio.toLocaleString('pt-MZ')} MTN</p>
                    </div>
                `;

                if (!aposta.pago) {
                    html += `
                        <button onclick="pagarPremio('${aposta.id}', ${premio})" style="width: 100%; padding: 14px; background: #00ff88; color: #000; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1.1rem; margin-top: 10px;">
                            💰 CONFIRMAR PAGAMENTO DE ${premio.toLocaleString('pt-MZ')} MTN
                        </button>
                    `;
                } else {
                    html += `<p style="color: #00ff88; text-align: center; font-weight: bold; font-size: 1.1rem; margin-top: 10px;">✅ PREMIO DE ${premio.toLocaleString('pt-MZ')} MTN JA FOI PAGO</p>`;
                }
            } else {
                html += `
                    <div style="background: rgba(255, 74, 74, 0.1); border: 2px solid #ff4a4a; padding: 15px; border-radius: 8px; text-align: center; margin: 15px 0;">
                        <p style="margin: 0; font-size: 1rem; color: #ff4a4a;">Nao houve premio nesta aposta.</p>
                        <p style="margin: 5px 0; font-size: 0.85rem; color: var(--text-muted);">Acertou ${numAcertos} numero(s). Para chance ${aposta.chance}, e necessario pelo menos ${Object.keys(TABELA_PREMIOS[aposta.chance])[0]} acerto(s).</p>
                    </div>
                `;
            }

            html += `</div>`;
            resultDiv.innerHTML = html;
        });
    });
}

function pagarPremio(idRecibo, valor) {
    if (!confirm(`Confirmar pagamento de ${valor.toLocaleString('pt-MZ')} MTN?`)) return;

    db.ref(`mozlotto/apostas/${idRecibo}`).update({
        pago: true,
        dataPagamento: new Date().toISOString(),
        valorPago: valor
    }).then(() => {
        db.ref(`mozlotto/apostas/${idRecibo}`).once('value', (snap) => {
            const aposta = snap.val();
            if (aposta) {
                db.ref(`mozlotto/sorteios/${aposta.sorteioId}/totalPremiosPagos`).transaction(c => (c || 0) + valor);
            }
        });
        alert(`✅ ${valor.toLocaleString('pt-MZ')} MTN pagos!`);
        verificarRecibo();
    }).catch(err => alert('Erro: ' + err.message));
}

// ============================================
// UTILIDADES
// ============================================
document.getElementById('modalRecibo').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalRecibo')) closeModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});
