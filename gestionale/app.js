const STORAGE_KEY = "gestflow_pro_final_v1";

const defaultState = {
  clients: [],
  expenses: [],
  incomeManual: 0
};

let state = loadState();
let overviewChart = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      incomeManual: Number(parsed.incomeManual || 0)
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function money(value) {
  const num = Number(value || 0);
  return `€${num.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2200);
}

function setSection(section) {
  const meta = {
    dashboard: ["Dashboard", "Panoramica completa del business"],
    clients: ["Clienti", "Anagrafica clienti completa"],
    "business-expenses": ["Spese aziendali", "Controllo costi dell’attività"],
    "private-expenses": ["Spese private", "Monitoraggio uscite personali"],
    reports: ["Report", "Dati e riepiloghi"],
    settings: ["Impostazioni", "Backup e reset"]
  };

  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.section === section);
  });

  document.querySelectorAll(".section").forEach(sectionEl => {
    sectionEl.classList.toggle("active", sectionEl.id === `section-${section}`);
  });

  document.getElementById("pageTitle").textContent = meta[section][0];
  document.getElementById("pageSubtitle").textContent = meta[section][1];
}

function openModal(title, html) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = html;
  document.getElementById("modalBackdrop").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modalBackdrop").classList.add("hidden");
  document.getElementById("modalBody").innerHTML = "";
}

function deleteClient(id) {
  if (!confirm("Eliminare questo cliente?")) return;
  state.clients = state.clients.filter(client => client.id !== id);
  saveState();
  renderAll();
  showToast("Cliente eliminato");
}

function deleteExpense(id) {
  if (!confirm("Eliminare questa spesa?")) return;
  state.expenses = state.expenses.filter(expense => expense.id !== id);
  saveState();
  renderAll();
  showToast("Spesa eliminata");
}

window.deleteClient = deleteClient;
window.deleteExpense = deleteExpense;

function openClientModal(clientId = null) {
  const client = state.clients.find(item => item.id === clientId);

  openModal(
    client ? "Modifica cliente" : "Nuovo cliente",
    `
      <form id="clientForm" class="form-grid">
        <div class="field">
          <label>Codice</label>
          <input type="text" name="code" value="${escapeHtml(client?.code || "")}" required />
        </div>
        <div class="field">
          <label>Nome</label>
          <input type="text" name="name" value="${escapeHtml(client?.name || "")}" required />
        </div>
        <div class="field">
          <label>Città</label>
          <input type="text" name="city" value="${escapeHtml(client?.city || "")}" />
        </div>
        <div class="field">
          <label>Provincia</label>
          <input type="text" name="province" value="${escapeHtml(client?.province || "")}" maxlength="2" />
        </div>
        <div class="field">
          <label>Recapito telefonico</label>
          <input type="text" name="phone" value="${escapeHtml(client?.phone || "")}" />
        </div>
        <div class="field">
          <label>Email</label>
          <input type="email" name="email" value="${escapeHtml(client?.email || "")}" />
        </div>

        <div class="form-actions">
          <button type="submit" class="action-btn primary">${client ? "Salva modifiche" : "Salva cliente"}</button>
        </div>
      </form>
    `
  );

  document.getElementById("clientForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.target);

    const payload = {
      id: client?.id || uid("client"),
      code: form.get("code")?.toString().trim(),
      name: form.get("name")?.toString().trim(),
      city: form.get("city")?.toString().trim(),
      province: form.get("province")?.toString().trim().toUpperCase(),
      phone: form.get("phone")?.toString().trim(),
      email: form.get("email")?.toString().trim(),
      createdAt: client?.createdAt || new Date().toISOString()
    };

    if (!payload.code || !payload.name) {
      showToast("Codice e nome sono obbligatori");
      return;
    }

    if (client) {
      state.clients = state.clients.map(item => item.id === client.id ? payload : item);
    } else {
      state.clients.unshift(payload);
    }

    saveState();
    renderAll();
    closeModal();
    showToast(client ? "Cliente aggiornato" : "Cliente salvato");
  });
}

function openExpenseModal(type, expenseId = null) {
  const expense = state.expenses.find(item => item.id === expenseId);
  const labels = {
    business: "Spesa aziendale",
    private: "Spesa privata"
  };

  openModal(
    expense ? `Modifica ${labels[type]}` : `Nuova ${labels[type]}`,
    `
      <form id="expenseForm" class="form-grid">
        <div class="field">
          <label>Data</label>
          <input type="date" name="date" value="${escapeHtml(expense?.date || new Date().toISOString().slice(0, 10))}" required />
        </div>
        <div class="field">
          <label>Categoria</label>
          <input type="text" name="category" value="${escapeHtml(expense?.category || "")}" placeholder="Es. Affitto, Bollette, Spesa..." />
        </div>
        <div class="field">
          <label>Importo</label>
          <input type="number" step="0.01" name="amount" value="${escapeHtml(expense?.amount || "")}" required />
        </div>
        <div class="field full">
          <label>Descrizione</label>
          <input type="text" name="description" value="${escapeHtml(expense?.description || "")}" required />
        </div>

        <div class="form-actions">
          <button type="submit" class="action-btn primary">${expense ? "Salva modifiche" : "Salva spesa"}</button>
        </div>
      </form>
    `
  );

  document.getElementById("expenseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.target);

    const payload = {
      id: expense?.id || uid("expense"),
      type,
      date: form.get("date")?.toString(),
      category: form.get("category")?.toString().trim(),
      amount: Number(form.get("amount") || 0),
      description: form.get("description")?.toString().trim(),
      createdAt: expense?.createdAt || new Date().toISOString()
    };

    if (!payload.description || !payload.amount) {
      showToast("Descrizione e importo sono obbligatori");
      return;
    }

    if (expense) {
      state.expenses = state.expenses.map(item => item.id === expense.id ? payload : item);
    } else {
      state.expenses.unshift(payload);
    }

    saveState();
    renderAll();
    closeModal();
    showToast(expense ? "Spesa aggiornata" : "Spesa salvata");
  });
}

window.openClientModal = openClientModal;
window.openExpenseModal = openExpenseModal;

function renderClients() {
  const container = document.getElementById("clientsGrid");

  if (!state.clients.length) {
    container.innerHTML = `<div class="empty-state">Nessun cliente inserito.</div>`;
    return;
  }

  container.innerHTML = state.clients.map(client => `
    <div class="entity-card">
      <h4>${escapeHtml(client.code)} · ${escapeHtml(client.name)}</h4>
      <p><strong>Città:</strong> ${escapeHtml(client.city || "-")}</p>
      <p><strong>Provincia:</strong> ${escapeHtml(client.province || "-")}</p>
      <p><strong>Telefono:</strong> ${escapeHtml(client.phone || "-")}</p>
      <p><strong>Email:</strong> ${escapeHtml(client.email || "-")}</p>

      <div class="entity-actions">
        <button class="action-btn secondary" onclick="openClientModal('${client.id}')">Modifica</button>
        <button class="action-btn danger" onclick="deleteClient('${client.id}')">Elimina</button>
      </div>
    </div>
  `).join("");
}

function renderExpenseList(type, targetId) {
  const container = document.getElementById(targetId);
  const filtered = state.expenses
    .filter(expense => expense.type === type)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state">Nessuna spesa presente.</div>`;
    return;
  }

  container.innerHTML = filtered.map(expense => `
    <div class="list-item">
      <div class="list-item-title">${escapeHtml(expense.description)}</div>
      <div class="list-item-meta">
        ${escapeHtml(expense.category || "Categoria libera")} · ${expense.date || "-"} · ${money(expense.amount)}
      </div>

      <div class="entity-actions">
        <button class="action-btn secondary" onclick="openExpenseModal('${type}', '${expense.id}')">Modifica</button>
        <button class="action-btn danger" onclick="deleteExpense('${expense.id}')">Elimina</button>
      </div>
    </div>
  `).join("");
}

function renderDashboard() {
  const businessExpenses = state.expenses
    .filter(expense => expense.type === "business")
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  const privateExpenses = state.expenses
    .filter(expense => expense.type === "private")
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  const income = Number(state.incomeManual || 0);
  const profit = income - businessExpenses;

  document.getElementById("statIncome").textContent = money(income);
  document.getElementById("statBusinessExpenses").textContent = money(businessExpenses);
  document.getElementById("statPrivateExpenses").textContent = money(privateExpenses);
  document.getElementById("statProfit").textContent = money(profit);

  const latestClients = [...state.clients]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  document.getElementById("latestClientsList").innerHTML = latestClients.length
    ? latestClients.map(client => `
      <div class="list-item">
        <div class="list-item-title">${escapeHtml(client.code)} · ${escapeHtml(client.name)}</div>
        <div class="list-item-meta">
          ${escapeHtml(client.city || "-")} (${escapeHtml(client.province || "-")}) · ${escapeHtml(client.phone || "-")}
        </div>
      </div>
    `).join("")
    : `<div class="empty-state">Nessun cliente recente.</div>`;

  renderOverviewChart(businessExpenses, privateExpenses);
}

function renderOverviewChart(businessExpenses, privateExpenses) {
  const ctx = document.getElementById("overviewChart");

  if (overviewChart) {
    overviewChart.destroy();
  }

  overviewChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Spese aziendali", "Spese private"],
      datasets: [{
        label: "Totale",
        data: [businessExpenses, privateExpenses]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: "#cbd5e1" }
        }
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(255,255,255,0.05)" }
        },
        y: {
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(255,255,255,0.05)" }
        }
      }
    }
  });
}

function renderReports() {
  const businessExpenses = state.expenses
    .filter(expense => expense.type === "business")
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  const privateExpenses = state.expenses
    .filter(expense => expense.type === "private")
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  document.getElementById("reportSummary").innerHTML = `
    <p><strong>Clienti totali:</strong> ${state.clients.length}</p>
    <p><strong>Spese aziendali totali:</strong> ${money(businessExpenses)}</p>
    <p><strong>Spese private totali:</strong> ${money(privateExpenses)}</p>
  `;

  const provinceMap = {};
  state.clients.forEach(client => {
    const key = client.province || "ND";
    provinceMap[key] = (provinceMap[key] || 0) + 1;
  });

  const provinceEntries = Object.entries(provinceMap).sort((a, b) => b[1] - a[1]);

  document.getElementById("clientsByProvince").innerHTML = provinceEntries.length
    ? provinceEntries.map(([province, count]) => `
      <div class="list-item">
        <div class="list-item-title">${escapeHtml(province)}</div>
        <div class="list-item-meta">${count} clienti</div>
      </div>
    `).join("")
    : `<div class="empty-state">Nessun dato disponibile.</div>`;
}

function exportBackup() {
  const content = JSON.stringify(state, null, 2);
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gestflow-backup.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      state = {
        clients: Array.isArray(parsed.clients) ? parsed.clients : [],
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
        incomeManual: Number(parsed.incomeManual || 0)
      };
      saveState();
      renderAll();
      showToast("Backup importato");
    } catch {
      showToast("Backup non valido");
    }
  };
  reader.readAsText(file);
}

function resetAll() {
  if (!confirm("Vuoi cancellare tutti i dati?")) return;
  state = structuredClone(defaultState);
  saveState();
  renderAll();
  showToast("Dati resettati");
}

function quickAdd() {
  const active = document.querySelector(".nav-link.active")?.dataset.section;
  if (active === "clients") return openClientModal();
  if (active === "business-expenses") return openExpenseModal("business");
  if (active === "private-expenses") return openExpenseModal("private");
  showToast("Vai in una sezione modificabile per aggiungere un elemento");
}

function bindEvents() {
  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.addEventListener("click", () => setSection(btn.dataset.section));
  });

  document.getElementById("closeModalBtn").addEventListener("click", closeModal);
  document.getElementById("modalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "modalBackdrop") closeModal();
  });

  document.getElementById("quickAddBtn").addEventListener("click", quickAdd);
  document.getElementById("addClientBtn").addEventListener("click", () => openClientModal());
  document.getElementById("addBusinessExpenseBtn").addEventListener("click", () => openExpenseModal("business"));
  document.getElementById("addPrivateExpenseBtn").addEventListener("click", () => openExpenseModal("private"));
  document.getElementById("exportBackupBtn").addEventListener("click", exportBackup);
  document.getElementById("importBackupInput").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) importBackup(file);
    e.target.value = "";
  });
  document.getElementById("resetAllBtn").addEventListener("click", resetAll);
}

function renderAll() {
  renderClients();
  renderExpenseList("business", "businessExpensesList");
  renderExpenseList("private", "privateExpensesList");
  renderDashboard();
  renderReports();
}

bindEvents();
renderAll();
setSection("dashboard");