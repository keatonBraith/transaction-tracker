import { createClient } from "https://esm.sh/@supabase/supabase-js";

const SUPABASE_URL = "https://keeumcpbteamhbnypuqa.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlZXVtY3BidGVhbWhibnlwdXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MDU0NDYsImV4cCI6MjA2ODI4MTQ0Nn0.Ix1bgVR5D_2qgtDljJsP8N2-kpXmpZ-l-JRSJC3JG8s";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let categoryChart = null;

const categoryColors = {
  Groceries: "#FF6384",
  Entertainment: "#36A2EB",
  "Home Improvement": "#FFCE56",
  Utilities: "#4BC0C0",
  Subscriptions: "#9966FF",
  "Home Supplies": "#FF9F40",
  Gas: "#E7E9ED",
  Gift: "#66BB6A",
  "Kids Stuff": "#FF6F61",
  "Eat Out": "#A569BD",
  Mortgage: "#2E86C1",
  Uncategorized: "#D3D3D3",
};

// Hamburger menu toggle
const menuBtn = document.getElementById("menuBtn");
const dropdownMenu = document.getElementById("dropdownMenu");

menuBtn.addEventListener("click", () => {
  dropdownMenu.style.display =
    dropdownMenu.style.display === "block" ? "none" : "block";
});

window.addEventListener("click", (e) => {
  if (!menuBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
    dropdownMenu.style.display = "none";
  }
});

// Logout
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/transaction-tracker/";
});

// Check auth session, redirect if no session
async function checkAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "/transaction-tracker/";
  }
}

checkAuth();

const form = document.getElementById("transactionForm");
const monthSelect = document.getElementById("monthSelect");
const transactionList = document.getElementById("transactionList");

let transactions = [];

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const location = document.getElementById("location").value.trim();
  const category = document.getElementById("categorySelect").value.trim();
  const amount = parseFloat(document.getElementById("amount").value);
  const date = document.getElementById("date").value;

  if (!location || !category || isNaN(amount) || !date) {
    alert("Please fill out all fields correctly.");
    return;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("Failed to get user:", userError.message);
    return;
  }

  // Insert transaction to Supabase table "transactions"
  const { error } = await supabase.from("transactions").insert([
    {
      user_id: user.id,
      category: category,
      amount: amount,
      date: date,
      location: location,
    },
  ]);

  if (error) {
    alert("Error adding transaction: " + error.message);
  } else {
    form.reset();
    await loadTransactions();
  }
});

monthSelect.addEventListener("change", () => {
  renderTransactions();
});

// Format YYYY-MM for month key
function formatMonthKey(dateStr) {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

// Format month nicely, e.g. "January 2025"
function formatMonthYear(dateStr) {
  const options = { year: "numeric", month: "long" };
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(undefined, options);
}

async function loadTransactions() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Fetch transactions for this user
  const { data, error } = await supabase
    .from("transactions")
    .select()
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (error) {
    alert("Error loading transactions: " + error.message);
    return;
  }

  transactions = data || [];

  populateMonthDropdown();
  renderTransactions();
}

function populateMonthDropdown() {
  const monthsSet = new Set(transactions.map((tx) => formatMonthKey(tx.date)));
  const monthsSorted = Array.from(monthsSet).sort().reverse();

  monthSelect.innerHTML = '<option value="">-- Select a month --</option>';

  monthsSorted.forEach((month) => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = formatMonthYear(month + "-01"); // Add noon time safety
    monthSelect.appendChild(option);
  });

  if (monthsSorted.length > 0) {
    monthSelect.value = monthsSorted[0];
  }
}

function renderTransactions() {
  const selectedMonth = monthSelect.value;
  transactionList.innerHTML = "";

  if (!selectedMonth) {
    transactionList.innerHTML =
      '<p class="center-text">Please select a month to see transactions.</p>';
    return;
  }

  const filtered = transactions.filter((tx) =>
    tx.date.startsWith(monthSelect.value)
  );

  renderCategoryChart(filtered);

  if (filtered.length === 0) {
    transactionList.innerHTML =
      '<p class="center-text">No transactions for this month.</p>';
    return;
  }

  // ✅ Add this block to calculate and display the month total
  const monthTotal = filtered.reduce((sum, tx) => sum + tx.amount, 0);
  document.getElementById(
    "monthTotal"
  ).textContent = `Month Total: $${monthTotal.toFixed(2)}`;

  // Group by category
  const grouped = filtered.reduce((acc, tx) => {
    if (!acc[tx.category]) acc[tx.category] = [];
    acc[tx.category].push(tx);
    return acc;
  }, {});

  for (const category in grouped) {
    const total = grouped[category]
      .reduce((sum, tx) => sum + tx.amount, 0)
      .toFixed(2);

    const catDiv = document.createElement("div");
    catDiv.className = "category-group";
    catDiv.innerHTML = `<h3>${category} - Total: $${total}</h3>`;

    grouped[category].forEach((tx) => {
      const txDiv = document.createElement("div");
      txDiv.className = "transaction";
      txDiv.dataset.txId = tx.id; // Save id for edit/delete

      const detailsDiv = document.createElement("div");
      detailsDiv.className = "transaction-details";
      detailsDiv.textContent = `${tx.date}: ${
        tx.location
      } - $${tx.amount.toFixed(2)}`;

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "transaction-actions";

      const editBtn = document.createElement("button");
      editBtn.className = "edit";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => startEditTransaction(txDiv, tx));

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => deleteTransaction(tx.id));

      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(deleteBtn);

      txDiv.appendChild(detailsDiv);
      txDiv.appendChild(actionsDiv);

      catDiv.appendChild(txDiv);
    });

    transactionList.appendChild(catDiv);
  }
}

function renderCategoryChart(transactionsForMonth) {
  const categoryTotals = {};

  transactionsForMonth.forEach((tx) => {
    const category = tx.category?.trim() || "Uncategorized";
    categoryTotals[category] = (categoryTotals[category] || 0) + tx.amount;
  });

  const labels = Object.keys(categoryTotals);
  const dataValues = Object.values(categoryTotals);
  const backgroundColors = labels.map(
    (label) => categoryColors[label] || "#cccccc"
  );

  const data = {
    labels: labels,
    datasets: [
      {
        data: dataValues,
        backgroundColor: backgroundColors,
      },
    ],
  };

  const config = {
    type: "pie",
    data: data,
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
        },
        title: {
          display: true,
          text: "Spending by Category",
        },
      },
    },
  };

  if (categoryChart) {
    categoryChart.destroy();
  }

  const ctx = document.getElementById("categoryChart").getContext("2d");
  categoryChart = new Chart(ctx, config);
}

async function deleteTransaction(id) {
  if (!confirm("Are you sure you want to delete this transaction?")) return;

  const { error } = await supabase.from("transactions").delete().eq("id", id);

  if (error) {
    alert("Failed to delete: " + error.message);
    return;
  }

  transactions = transactions.filter((t) => t.id !== id);

  populateMonthDropdown();

  const monthsAvailable = [
    ...new Set(transactions.map((tx) => formatMonthKey(tx.date))),
  ];
  if (!monthsAvailable.includes(monthSelect.value)) {
    monthSelect.value = monthsAvailable[0] || "";
  }

  renderTransactions();
}

function startEditTransaction(txDiv, tx) {
  txDiv.innerHTML = ""; // Clear existing content

  const detailsDiv = document.createElement("div");
  detailsDiv.className = "transaction-details";

  // Create inputs for editable fields
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.className = "inline-edit";
  dateInput.value = tx.date;

  const locationInput = document.createElement("input");
  locationInput.type = "text";
  locationInput.className = "inline-edit";
  locationInput.value = tx.location;

  const amountInput = document.createElement("input");
  amountInput.type = "number";
  amountInput.step = "0.01";
  amountInput.min = "0";
  amountInput.className = "inline-edit";
  amountInput.value = tx.amount;

  const categorySelect = document.createElement("select");
  [
    "Groceries",
    "Entertainment",
    "Home Improvement",
    "Utilities",
    "Subscriptions",
    "Home Supplies",
    "Gas",
    "Gift",
    "Kids Stuff",
    "Eat Out",
    "Mortgage",
  ].forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    if (tx.category === cat) option.selected = true;
    categorySelect.appendChild(option);
  });

  detailsDiv.appendChild(dateInput);
  detailsDiv.appendChild(locationInput);
  detailsDiv.appendChild(amountInput);
  detailsDiv.appendChild(categorySelect);

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "transaction-actions";

  const saveBtn = document.createElement("button");
  saveBtn.className = "save";
  saveBtn.textContent = "Save";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "cancel";
  cancelBtn.textContent = "Cancel";

  actionsDiv.appendChild(saveBtn);
  actionsDiv.appendChild(cancelBtn);

  txDiv.appendChild(detailsDiv);
  txDiv.appendChild(actionsDiv);

  cancelBtn.addEventListener("click", () => {
    renderTransactions();
  });

  saveBtn.addEventListener("click", async () => {
    if (
      !dateInput.value ||
      !locationInput.value.trim() ||
      isNaN(parseFloat(amountInput.value)) ||
      parseFloat(amountInput.value) < 0
    ) {
      alert("Please fill out all fields correctly.");
      return;
    }

    const { error } = await supabase
      .from("transactions")
      .update({
        date: dateInput.value,
        location: locationInput.value.trim(),
        amount: parseFloat(amountInput.value),
        category: categorySelect.value,
      })
      .eq("id", tx.id);

    if (error) {
      alert("Failed to update: " + error.message);
    } else {
      const idx = transactions.findIndex((t) => t.id === tx.id);
      if (idx !== -1) {
        transactions[idx].date = dateInput.value;
        transactions[idx].location = locationInput.value.trim();
        transactions[idx].amount = parseFloat(amountInput.value);
        transactions[idx].category = categorySelect.value;
      }
      renderTransactions();
    }
  });
}

function exportCSV() {
  const selectedMonth = monthSelect.value;

  const filtered = transactions.filter(
    (tx) => formatMonthKey(tx.date) === selectedMonth
  );

  if (filtered.length === 0) {
    alert("No transactions for the selected month.");
    return;
  }

  const header = ["Date", "Location", "Amount", "Category"];
  const rows = [header];

  filtered.forEach((tx) => {
    rows.push([tx.date, tx.location, tx.amount.toFixed(2), tx.category || ""]);
  });

  const csvContent = rows
    .map((row) => row.map((val) => `"${val}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${selectedMonth}.csv`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const resetPasswordBtn = document.getElementById("resetPasswordBtn");
resetPasswordBtn.addEventListener("click", async () => {
  const email = prompt("Enter your email address to reset your password:");
  if (!email) return;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo:
      window.location.origin + "/transaction-tracker/reset-password.html",
  });

  if (error) {
    alert("Error sending password reset email: " + error.message);
  } else {
    alert("Password reset email sent! Please check your inbox.");
  }
});

// Initial load
loadTransactions();

// Export button listener
document.getElementById("exportBtn").addEventListener("click", exportCSV);
