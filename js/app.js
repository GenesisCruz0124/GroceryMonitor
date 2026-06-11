/* GroceryMonitor — zero-dependency grocery expense tracker.
   All data lives in localStorage; nothing leaves the browser. */
(() => {
  "use strict";

  const STORAGE_KEY = "groceryMonitor.expenses";
  const BUDGET_KEY = "groceryMonitor.budget";
  const THEME_KEY = "groceryMonitor.theme";

  const CATEGORIES = [
    "Produce", "Dairy & Eggs", "Meat & Seafood", "Bakery", "Pantry",
    "Frozen", "Beverages", "Snacks", "Household", "Other",
  ];

  const CATEGORY_COLORS = [
    "#2e9e5b", "#4f8fd9", "#d97757", "#c9a23f", "#8a6fd1",
    "#3bb3c4", "#d95f9c", "#7a9e3b", "#9a8b7a", "#8b97a1",
  ];

  // ---------- State ----------

  let expenses = loadExpenses();
  let budget = loadBudget();
  let filters = { search: "", category: "", month: "" };

  function loadExpenses() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!Array.isArray(raw)) return [];
      return raw.filter(
        (e) => e && typeof e.id === "string" && typeof e.item === "string" &&
          typeof e.amount === "number" && /^\d{4}-\d{2}-\d{2}$/.test(e.date || "")
      );
    } catch {
      return [];
    }
  }

  function loadBudget() {
    const v = parseFloat(localStorage.getItem(BUDGET_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    if (budget) localStorage.setItem(BUDGET_KEY, String(budget));
    else localStorage.removeItem(BUDGET_KEY);
  }

  // ---------- Helpers ----------

  const $ = (sel) => document.querySelector(sel);

  const fmtMoney = (n) =>
    n.toLocaleString("en-PH", { style: "currency", currency: "PHP" });

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // "YYYY-MM" key for grouping by month
  const monthKey = (isoDate) => isoDate.slice(0, 7);
  const currentMonthKey = () => todayISO().slice(0, 7);

  function monthLabel(key, opts = { month: "short" }) {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", opts);
  }

  function shiftMonth(key, delta) {
    const [y, m] = key.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  const sum = (arr) => arr.reduce((acc, e) => acc + e.amount, 0);

  const inMonth = (key) => expenses.filter((e) => monthKey(e.date) === key);

  function showToast(msg) {
    const toast = $("#toast");
    toast.textContent = msg;
    toast.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.add("hidden"), 2400);
  }

  // ---------- Rendering ----------

  function render() {
    renderStats();
    renderDonut();
    renderBars();
    renderTable();
  }

  function renderStats() {
    const thisKey = currentMonthKey();
    const thisMonth = inMonth(thisKey);
    const lastMonth = inMonth(shiftMonth(thisKey, -1));
    const totalNow = sum(thisMonth);
    const totalPrev = sum(lastMonth);

    $("#stat-month-total").textContent = fmtMoney(totalNow);

    const compare = $("#stat-month-compare");
    if (totalPrev > 0) {
      const diff = totalNow - totalPrev;
      const pct = Math.abs((diff / totalPrev) * 100).toFixed(0);
      compare.textContent = diff >= 0
        ? `▲ ${pct}% vs last month (${fmtMoney(totalPrev)})`
        : `▼ ${pct}% vs last month (${fmtMoney(totalPrev)})`;
      compare.className = "card-foot " + (diff > 0 ? "bad" : "good");
    } else {
      compare.textContent = "No data for last month";
      compare.className = "card-foot";
    }

    // Budget card
    const bar = $("#budget-bar");
    if (budget) {
      const left = budget - totalNow;
      const ratio = totalNow / budget;
      $("#stat-budget-left").textContent = fmtMoney(Math.abs(left));
      $("#stat-budget-detail").textContent = left >= 0
        ? `left of ${fmtMoney(budget)} (${(ratio * 100).toFixed(0)}% used)`
        : `over your ${fmtMoney(budget)} budget`;
      bar.style.width = `${Math.min(ratio * 100, 100)}%`;
      bar.className = "progress-bar" + (ratio >= 1 ? " over" : ratio >= 0.8 ? " warn" : "");
    } else {
      $("#stat-budget-left").textContent = "—";
      $("#stat-budget-detail").textContent = "No budget set";
      bar.style.width = "0";
      bar.className = "progress-bar";
    }

    // Trips: distinct (date, store) pairs this month
    const trips = new Set(thisMonth.map((e) => `${e.date}|${(e.store || "").toLowerCase()}`)).size;
    $("#stat-trips").textContent = trips;
    $("#stat-avg-trip").textContent = trips > 0 ? `${fmtMoney(totalNow / trips)} avg per trip` : "—";

    // Top category
    const byCat = groupByCategory(thisMonth);
    if (byCat.length > 0) {
      $("#stat-top-category").textContent = byCat[0][0];
      $("#stat-top-category-amount").textContent = `${fmtMoney(byCat[0][1])} this month`;
    } else {
      $("#stat-top-category").textContent = "—";
      $("#stat-top-category-amount").textContent = "—";
    }
  }

  function groupByCategory(list) {
    const map = new Map();
    for (const e of list) {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }

  function renderDonut() {
    const svg = $("#donut");
    const legend = $("#donut-legend");
    const thisMonth = inMonth(currentMonthKey());
    const groups = groupByCategory(thisMonth);
    const total = sum(thisMonth);
    $("#chart-month-label").textContent = `· ${monthLabel(currentMonthKey(), { month: "long", year: "numeric" })}`;

    svg.innerHTML = "";
    legend.innerHTML = "";

    if (total === 0) {
      svg.innerHTML =
        `<circle cx="100" cy="100" r="70" fill="none" stroke="var(--border)" stroke-width="28"/>` +
        `<text x="100" y="105" text-anchor="middle" fill="var(--text-muted)" font-size="13">No data</text>`;
      return;
    }

    const R = 70, C = 2 * Math.PI * R;
    let offset = 0;
    const parts = groups.map(([cat, amt]) => {
      const color = CATEGORY_COLORS[CATEGORIES.indexOf(cat)] ?? CATEGORY_COLORS.at(-1);
      const frac = amt / total;
      const seg =
        `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${color}" stroke-width="28" ` +
        `stroke-dasharray="${frac * C} ${C}" stroke-dashoffset="${-offset * C}" ` +
        `transform="rotate(-90 100 100)"><title>${cat}: ${fmtMoney(amt)}</title></circle>`;
      offset += frac;
      return seg;
    });
    svg.innerHTML =
      parts.join("") +
      `<text x="100" y="96" text-anchor="middle" fill="var(--text)" font-size="20" font-weight="700">${fmtMoney(total)}</text>` +
      `<text x="100" y="116" text-anchor="middle" fill="var(--text-muted)" font-size="11">this month</text>`;

    for (const [cat, amt] of groups) {
      const color = CATEGORY_COLORS[CATEGORIES.indexOf(cat)] ?? CATEGORY_COLORS.at(-1);
      const li = document.createElement("li");
      li.innerHTML =
        `<span class="swatch" style="background:${color}"></span>` +
        `<span></span><span class="pct"></span>`;
      li.children[1].textContent = cat;
      li.children[2].textContent = `${fmtMoney(amt)} · ${((amt / total) * 100).toFixed(0)}%`;
      legend.appendChild(li);
    }
  }

  function renderBars() {
    const wrap = $("#bars");
    wrap.innerHTML = "";
    const thisKey = currentMonthKey();
    const months = Array.from({ length: 6 }, (_, i) => shiftMonth(thisKey, i - 5));
    const totals = months.map((k) => sum(inMonth(k)));
    const max = Math.max(...totals, 1);

    months.forEach((key, i) => {
      const col = document.createElement("div");
      col.className = "bar-col";
      const pct = (totals[i] / max) * 100;
      col.innerHTML =
        `<span class="bar-amount">${totals[i] > 0 ? fmtMoney(totals[i]) : ""}</span>` +
        `<div class="bar${key === thisKey ? " current" : ""}" style="height:${Math.max(pct, 1.5)}%" title="${monthLabel(key, { month: "long", year: "numeric" })}: ${fmtMoney(totals[i])}"></div>` +
        `<span class="bar-label">${monthLabel(key)}</span>`;
      wrap.appendChild(col);
    });
  }

  function filteredExpenses() {
    const q = filters.search.trim().toLowerCase();
    return expenses
      .filter((e) => {
        if (filters.category && e.category !== filters.category) return false;
        if (filters.month && monthKey(e.date) !== filters.month) return false;
        if (q && !e.item.toLowerCase().includes(q) && !(e.store || "").toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  function renderTable() {
    const tbody = $("#expense-rows");
    const rows = filteredExpenses();
    tbody.innerHTML = "";

    const hasAny = expenses.length > 0;
    const hasFilter = filters.search || filters.category || filters.month;
    $("#empty-state").classList.toggle("hidden", hasAny);
    $("#expense-table").classList.toggle("hidden", !hasAny);

    if (hasAny && rows.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6" style="text-align:center;color:var(--text-muted)">No expenses match your filters.</td>`;
      tbody.appendChild(tr);
      return;
    }

    for (const e of rows) {
      const tr = document.createElement("tr");
      const dateLabel = new Date(e.date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      });
      tr.innerHTML =
        `<td>${dateLabel}</td><td></td><td><span class="cat-pill"></span></td>` +
        `<td class="store-cell"></td><td class="num">${fmtMoney(e.amount)}</td>` +
        `<td class="row-actions">` +
        `<button class="btn-icon" data-edit="${e.id}" title="Edit">✏️</button>` +
        `<button class="btn-icon" data-delete="${e.id}" title="Delete">🗑️</button></td>`;
      tr.children[1].textContent = e.item;
      tr.children[2].firstChild.textContent = e.category;
      tr.children[3].textContent = e.store || "—";
      tbody.appendChild(tr);
    }

    if (hasFilter && rows.length > 0) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td colspan="4" style="color:var(--text-muted)">Filtered total (${rows.length} item${rows.length === 1 ? "" : "s"})</td>` +
        `<td class="num">${fmtMoney(sum(rows))}</td><td></td>`;
      tbody.appendChild(tr);
    }
  }

  // ---------- Expense modal ----------

  const expenseModal = $("#expense-modal");

  function openExpenseModal(expense) {
    $("#modal-title").textContent = expense ? "Edit expense" : "Add expense";
    $("#f-id").value = expense?.id || "";
    $("#f-item").value = expense?.item || "";
    $("#f-amount").value = expense?.amount ?? "";
    $("#f-date").value = expense?.date || todayISO();
    $("#f-category").value = expense?.category || CATEGORIES[0];
    $("#f-store").value = expense?.store || "";
    refreshStoreSuggestions();
    expenseModal.showModal();
    $("#f-item").focus();
  }

  function refreshStoreSuggestions() {
    const stores = [...new Set(expenses.map((e) => e.store).filter(Boolean))].sort();
    $("#store-suggestions").innerHTML = stores
      .map((s) => `<option value="${s.replace(/"/g, "&quot;")}"></option>`)
      .join("");
  }

  $("#expense-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const amount = Math.round(parseFloat($("#f-amount").value) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) return;

    const data = {
      item: $("#f-item").value.trim(),
      amount,
      date: $("#f-date").value,
      category: $("#f-category").value,
      store: $("#f-store").value.trim(),
    };
    const id = $("#f-id").value;
    if (id) {
      const idx = expenses.findIndex((e) => e.id === id);
      if (idx !== -1) expenses[idx] = { ...expenses[idx], ...data };
      showToast("Expense updated");
    } else {
      expenses.push({ id: crypto.randomUUID(), ...data });
      showToast("Expense added");
    }
    persist();
    expenseModal.close();
    render();
  });

  // ---------- Events ----------

  $("#btn-add").addEventListener("click", () => openExpenseModal(null));
  $("#btn-cancel").addEventListener("click", () => expenseModal.close());

  $("#expense-rows").addEventListener("click", (ev) => {
    const editId = ev.target.closest("[data-edit]")?.dataset.edit;
    const delId = ev.target.closest("[data-delete]")?.dataset.delete;
    if (editId) {
      openExpenseModal(expenses.find((e) => e.id === editId));
    } else if (delId) {
      const exp = expenses.find((e) => e.id === delId);
      if (exp && confirm(`Delete "${exp.item}" (${fmtMoney(exp.amount)})?`)) {
        expenses = expenses.filter((e) => e.id !== delId);
        persist();
        render();
        showToast("Expense deleted");
      }
    }
  });

  // Budget modal
  const budgetModal = $("#budget-modal");
  $("#btn-budget").addEventListener("click", () => {
    $("#f-budget").value = budget ?? "";
    budgetModal.showModal();
  });
  $("#btn-budget-cancel").addEventListener("click", () => budgetModal.close());
  $("#budget-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const v = parseFloat($("#f-budget").value);
    budget = Number.isFinite(v) && v > 0 ? v : null;
    persist();
    budgetModal.close();
    render();
    showToast(budget ? `Budget set to ${fmtMoney(budget)}` : "Budget removed");
  });

  // Filters
  $("#filter-search").addEventListener("input", (ev) => {
    filters.search = ev.target.value;
    renderTable();
  });
  $("#filter-category").addEventListener("change", (ev) => {
    filters.category = ev.target.value;
    renderTable();
  });
  $("#filter-month").addEventListener("change", (ev) => {
    filters.month = ev.target.value;
    renderTable();
  });
  $("#btn-clear-filters").addEventListener("click", () => {
    filters = { search: "", category: "", month: "" };
    $("#filter-search").value = "";
    $("#filter-category").value = "";
    $("#filter-month").value = "";
    renderTable();
  });

  // CSV export
  $("#btn-export").addEventListener("click", () => {
    if (expenses.length === 0) {
      showToast("Nothing to export yet");
      return;
    }
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [
      "Date,Item,Category,Store,Amount",
      ...[...expenses]
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((e) => [e.date, esc(e.item), esc(e.category), esc(e.store || ""), e.amount.toFixed(2)].join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `grocery-expenses-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("CSV downloaded");
  });

  // Theme toggle
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $("#btn-theme").textContent = theme === "dark" ? "☀️" : "🌙";
  }
  $("#btn-theme").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  // Sample data (only offered when the list is empty)
  $("#btn-sample").addEventListener("click", () => {
    expenses = makeSampleData();
    if (!budget) budget = 15000;
    persist();
    render();
    showToast("Sample data loaded — edit or delete anything");
  });

  function makeSampleData() {
    const items = [
      ["Bananas", "Produce", 2.49], ["Apples", "Produce", 5.99], ["Spinach", "Produce", 3.49],
      ["Whole milk", "Dairy & Eggs", 4.29], ["Eggs (dozen)", "Dairy & Eggs", 5.49], ["Cheddar cheese", "Dairy & Eggs", 6.99],
      ["Chicken breast", "Meat & Seafood", 12.99], ["Ground beef", "Meat & Seafood", 9.49], ["Salmon fillet", "Meat & Seafood", 14.99],
      ["Sourdough bread", "Bakery", 4.99], ["Bagels", "Bakery", 3.99],
      ["Pasta", "Pantry", 2.29], ["Rice 5lb", "Pantry", 7.99], ["Olive oil", "Pantry", 11.99], ["Canned tomatoes", "Pantry", 1.89],
      ["Frozen pizza", "Frozen", 6.99], ["Ice cream", "Frozen", 5.49],
      ["Orange juice", "Beverages", 4.99], ["Coffee beans", "Beverages", 13.99],
      ["Tortilla chips", "Snacks", 4.49], ["Granola bars", "Snacks", 5.99],
      ["Paper towels", "Household", 8.99], ["Dish soap", "Household", 3.79],
    ];
    const stores = ["SM Supermarket", "Puregold", "Robinsons Supermarket", "Landers"];
    const out = [];
    const now = new Date();
    // ~10 shopping trips spread over the last 3 months
    for (let m = 0; m < 3; m++) {
      for (let t = 0; t < 3 + (m === 0 ? 1 : 0); t++) {
        const d = new Date(now.getFullYear(), now.getMonth() - m, 2 + t * 8);
        if (d > now) continue;
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const store = stores[(m * 3 + t) % stores.length];
        const count = 3 + ((m + t) % 4);
        for (let i = 0; i < count; i++) {
          const [item, category, usd] = items[(m * 7 + t * 5 + i * 3) % items.length];
          // Sample prices are listed in USD-ish figures; scale to realistic pesos
          out.push({ id: crypto.randomUUID(), item, category, store, amount: Math.round(usd * 30), date });
        }
      }
    }
    return out;
  }

  // ---------- Init ----------

  function init() {
    // Populate category selects
    const catOptions = CATEGORIES.map((c) => `<option>${c}</option>`).join("");
    $("#f-category").innerHTML = catOptions;
    $("#filter-category").innerHTML = `<option value="">All categories</option>` + catOptions;

    applyTheme(
      localStorage.getItem(THEME_KEY) ||
        (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    );

    render();
  }

  init();
})();
