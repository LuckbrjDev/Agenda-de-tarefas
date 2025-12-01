/* ============================
   IMPORTS FIREBASE (MODULAR)
   ============================ */
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    getFirestore
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

import { db, app } from "./firebase/config.js";

/* INSTÂNCIA DO AUTH */
const auth = getAuth(app);

/* ============================
   VARIÁVEIS DO DOM
   ============================ */

const calendarDays = document.getElementById("calendar-days");
const monthYear = document.getElementById("month-year");
const prevMonthBtn = document.getElementById("prev-month");
const nextMonthBtn = document.getElementById("next-month");

const tituloDia = document.getElementById("titulo-dia");
const lista = document.getElementById("lista");
const inputTarefa = document.getElementById("tarefa");
const addBtn = document.getElementById("add-btn");

const loginModal = document.getElementById("login-modal");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const toggleAuth = document.getElementById("toggle-auth");
const authTitle = document.getElementById("auth-title");
const authError = document.getElementById("auth-error");

/* ============================
   VARIÁVEIS GLOBAIS
   ============================ */

let dataAtual = new Date();
let diaSelecionado = formatarData(new Date());
let usuarioAtivo = null;
let isLoginMode = true;
let diasComTarefas = {};

/* ============================
   FUNÇÕES DE AUTENTICAÇÃO
   ============================ */

function displayAuthError(msg) {
    authError.textContent = msg;
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;

    authTitle.textContent = isLoginMode ? "Acessar Agenda" : "Criar Nova Conta";
    loginBtn.style.display = isLoginMode ? "block" : "none";
    registerBtn.style.display = isLoginMode ? "none" : "block";
    toggleAuth.textContent = isLoginMode ? "Mudar para Registro" : "Mudar para Login";
    displayAuthError("");
}

toggleAuth.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthMode();
});

function handleAuth() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        displayAuthError("Preencha email e senha.");
        return;
    }

    if (isLoginMode) {
        signInWithEmailAndPassword(auth, email, password)
            .catch(() => displayAuthError("Email ou senha incorretos."));
    } else {
        createUserWithEmailAndPassword(auth, email, password)
            .catch(err => {
                if (err.code === "auth/email-already-in-use")
                    displayAuthError("Email já está em uso.");
                else if (err.code === "auth/weak-password")
                    displayAuthError("A senha deve ter pelo menos 6 caracteres.");
                else
                    displayAuthError("Erro ao criar conta.");
            });
    }
}

loginBtn.addEventListener("click", handleAuth);
registerBtn.addEventListener("click", handleAuth);

/* ============================
   MONITORAMENTO DE LOGIN
   ============================ */

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioAtivo = user.uid;
        loginModal.style.display = "none";

        gerarCalendario();
        await carregarTarefas();
    } else {
        usuarioAtivo = null;
        loginModal.style.display = "flex";
        lista.innerHTML = "";
        tituloDia.textContent = "Faça login para ver as tarefas";
    }
});

/* ============================
   FIRESTORE – SALVAR TAREFAS
   ============================ */

async function salvarTarefas(data, tarefas) {
    if (!usuarioAtivo) return;

    try {
        await setDoc(
            doc(db, "users", usuarioAtivo, "tasks", data),
            { tarefas }
        );

        carregarIndicadoresTarefas();
    } catch (e) {
        console.error("Erro ao salvar:", e);
    }
}

/* ============================
   FIRESTORE – CARREGAR TAREFAS
   ============================ */

async function carregarTarefas() {
    if (!usuarioAtivo) return;

    lista.innerHTML = "";
    tituloDia.textContent = `Tarefas de ${diaSelecionado}`;

    try {
        const ref = doc(db, "users", usuarioAtivo, "tasks", diaSelecionado);
        const snap = await getDoc(ref);

        const tarefas = snap.exists() ? snap.data().tarefas : [];

        if (tarefas.length === 0) {
            lista.innerHTML = `<p style="text-align:center;color:#888;margin-top:20px;">Nenhuma tarefa.</p>`;
            return;
        }

        tarefas.forEach((tarefa, i) =>
            criarCardTarefa(tarefa.texto, tarefa.feita, i)
        );
    } catch (e) {
        console.error("Erro ao carregar:", e);
    }
}

/* ============================
   FIRESTORE – CARREGAR DIAS COM TAREFA
   ============================ */

async function carregarIndicadoresTarefas() {
    if (!usuarioAtivo) return;

    diasComTarefas = {};

    const ref = collection(db, "users", usuarioAtivo, "tasks");
    const snap = await getDocs(ref);

    const ano = dataAtual.getFullYear();
    const mes = dataAtual.getMonth() + 1;

    snap.forEach(docSnap => {
        const dataID = docSnap.id;
        const [y, m] = dataID.split("-");

        if (parseInt(y) === ano && parseInt(m) === mes) {
            const tarefas = docSnap.data().tarefas;
            if (tarefas && tarefas.length > 0) {
                diasComTarefas[dataID] = true;
            }
        }
    });

    gerarCalendario(false);
}

/* ============================
   FUNÇÕES DO CALENDÁRIO
   ============================ */

function formatarData(data) {
    let d = data.getDate().toString().padStart(2, "0");
    let m = (data.getMonth() + 1).toString().padStart(2, "0");
    let a = data.getFullYear();
    return `${a}-${m}-${d}`;
}

function gerarCalendario(loadIndicators = true) {
    if (!usuarioAtivo) return;

    calendarDays.innerHTML = "";

    const ano = dataAtual.getFullYear();
    const mes = dataAtual.getMonth();

    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const ultimoDia = new Date(ano, mes + 1, 0).getDate();

    const meses = [
        "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
        "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
    ];

    monthYear.textContent = `${meses[mes]} ${ano}`;

    for (let i = 0; i < primeiroDiaSemana; i++) {
        const v = document.createElement("div");
        v.classList.add("empty");
        calendarDays.appendChild(v);
    }

    for (let dia = 1; dia <= ultimoDia; dia++) {
        const el = document.createElement("div");
        el.textContent = dia;

        const dataStr =
            `${ano}-${(mes+1).toString().padStart(2,"0")}-${dia.toString().padStart(2,"0")}`;

        if (diasComTarefas[dataStr]) el.classList.add("has-task");
        if (dataStr === diaSelecionado) el.classList.add("dia-selecionado");
        if (dataStr === formatarData(new Date())) el.classList.add("dia-atual");

        el.addEventListener("click", () => {
            diaSelecionado = dataStr;
            gerarCalendario(false);
            carregarTarefas();
        });

        calendarDays.appendChild(el);
    }

    if (loadIndicators) carregarIndicadoresTarefas();
}

/* ============================
   ADICIONAR TAREFA
   ============================ */

addBtn.addEventListener("click", async () => {
    if (!usuarioAtivo) return;

    const texto = inputTarefa.value.trim();
    if (!texto) return;

    let tarefas = [];

    const ref = doc(db, "users", usuarioAtivo, "tasks", diaSelecionado);
    const snap = await getDoc(ref);

    if (snap.exists()) tarefas = snap.data().tarefas;

    tarefas.push({ texto, feita: false });

    await salvarTarefas(diaSelecionado, tarefas);

    inputTarefa.value = "";
    carregarTarefas();
});

/* ============================
   MARCAR COMO FEITA
   ============================ */

async function marcarComoConcluida(index) {
    const ref = doc(db, "users", usuarioAtivo, "tasks", diaSelecionado);
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    let tarefas = snap.data().tarefas;
    tarefas[index].feita = !tarefas[index].feita;

    await salvarTarefas(diaSelecionado, tarefas);
    carregarTarefas();
}

/* ============================
   REMOVER TAREFA
   ============================ */

async function removerTarefa(index) {
    const ref = doc(db, "users", usuarioAtivo, "tasks", diaSelecionado);
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    let tarefas = snap.data().tarefas;
    tarefas.splice(index, 1);

    await salvarTarefas(diaSelecionado, tarefas);
    carregarTarefas();
}

/* ============================
   CRIAR CARD DE TAREFA
   ============================ */

function criarCardTarefa(texto, feita, index) {
    const card = document.createElement("div");
    card.classList.add("task-card");
    if (feita) card.classList.add("task-done");

    const left = document.createElement("div");
    left.classList.add("task-left");

    const check = document.createElement("i");
    check.classList.add("fa-solid", "fa-circle-check", "task-check");
    check.addEventListener("click", () => marcarComoConcluida(index));

    const span = document.createElement("span");
    span.textContent = texto;

    left.appendChild(check);
    left.appendChild(span);

    const trash = document.createElement("i");
    trash.classList.add("fa-solid", "fa-trash", "task-delete");
    trash.addEventListener("click", () => removerTarefa(index));

    card.appendChild(left);
    card.appendChild(trash);

    lista.appendChild(card);
}

/* ============================
   BOTÕES DO CALENDÁRIO
   ============================ */

prevMonthBtn.addEventListener("click", () => {
    dataAtual.setMonth(dataAtual.getMonth() - 1);
    gerarCalendario();
});

nextMonthBtn.addEventListener("click", () => {
    dataAtual.setMonth(dataAtual.getMonth() + 1);
    gerarCalendario();
});
