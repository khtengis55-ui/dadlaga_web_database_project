import { supabase } from "./supabase.js";

const transactionForm = document.getElementById('transaction-form');
const txTypeInput     = document.getElementById('tx-type');
const txCategoryInput = document.getElementById('tx-category');
const txAmountInput   = document.getElementById('tx-amount');
const txDateInput     = document.getElementById('tx-date');
const txDescInput     = document.getElementById('tx-desc');

// ─── Гүйлгээ нэмэх ────────────────────────────────────────────────────────
transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const type     = txTypeInput.value;
    const category = txCategoryInput.value;
    const amount   = Number(txAmountInput.value);
    const date     = txDateInput.value;
    const desc     = txDescInput.value;

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        alert("Сешн дууссан байна. Дахин нэвтэрнэ үү!");
        window.location.href = 'index.html';
        return;
    }

    const { data, error } = await supabase
        .from('transactions')
        .insert([{
            user_id:     user.id,
            type:        type,
            category:    category,
            amount:      amount,
            description: desc,
            date:        date
        }])
        .select();

    if (error) {
        // 🔴 ЗАСВАР: "..." → `...` backtick + хаалт зөвшөөрсөн
        alert(`Гүйлгээг хадгалахад алдаа гарлаа: ${error.message}`);
        console.error("Алдааны дэлгэрэнгүй:", error);
    } else {
        alert("Гүйлгээ амжилттай бүртгэгдлээ!");
        transactionForm.reset();
    }

    fetchTransactions();
});

// ─── Гүйлгээ татах ────────────────────────────────────────────────────────
async function fetchTransactions() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 🟡 ЗАСВАР: user email харуулах
    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = user.email;

    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

    if (error) {
        console.error("Гүйлгээ уншихад алдаа гарлаа:", error.message);
        return;
    }

    renderTransactions(transactions);
    // 🟡 ЗАСВАР: статистик картуудыг шинэчлэх
    updateSummary(transactions);
}

// ─── Хүснэгт рендер ───────────────────────────────────────────────────────
function renderTransactions(transactions) {
    const listContainer = document.getElementById('transaction-list');

    if (transactions.length === 0) {
        listContainer.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    <i class="fa-solid fa-folder-open fs-3 d-block mb-2"></i>
                    Одоогоор ямар нэгэн гүйлгээ бүртгэгдээгүй байна.
                </td>
            </tr>`;
        return;
    }

    let htmlContent = '';

    transactions.forEach(tx => {
        const isIncome   = tx.type === 'income';
        const badgeColor = isIncome ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger';
        const typeText   = isIncome ? 'Орлого' : 'Зарлага';
        const amountSign = isIncome ? '+' : '-';
        const amountColor = isIncome ? 'text-success' : 'text-danger';

        htmlContent += `
            <tr>
                <td>${tx.date}</td>
                <td><span class="badge bg-light text-dark shadow-sm border">${tx.category}</span></td>
                <td class="text-secondary fw-medium">${tx.description}</td>
                <td><span class="badge ${badgeColor}">${typeText}</span></td>
                <td class="text-end fw-bold ${amountColor}">
                    ${amountSign}${tx.amount.toLocaleString()} ₮
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-link text-danger p-0"
                            onclick="deleteTransaction('${tx.id}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>`;
    });

    listContainer.innerHTML = htmlContent;
}

// ─── Статистик шинэчлэх ───────────────────────────────────────────────────
// 🟡 ЗАСВАР: шинэ функц — картуудыг шинэчилнэ
function updateSummary(transactions) {
    let totalIncome  = 0;
    let totalExpense = 0;

    transactions.forEach(tx => {
        if (tx.type === 'income') {
            totalIncome += tx.amount;
        } else {
            totalExpense += tx.amount;
        }
    });

    const balance = totalIncome - totalExpense;

    document.getElementById('total-balance').textContent  = `${balance.toLocaleString()} ₮`;
    document.getElementById('total-income').textContent   = `${totalIncome.toLocaleString()} ₮`;
    document.getElementById('total-expense').textContent  = `${totalExpense.toLocaleString()} ₮`;
}

// ─── Гүйлгээ устгах ───────────────────────────────────────────────────────
// 🔴 ЗАСВАР: window-д тавих ёстой — module дотор onclick ажиллахгүй
window.deleteTransaction = async (id) => {
    if (!confirm("Энэ гүйлгээг устгахдаа итгэлтэй байна уу?")) return;

    const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

    if (error) {
        alert(`Устгахад алдаа гарлаа: ${error.message}`);
        console.error("Устгах алдаа:", error);
    } else {
        fetchTransactions();
    }
};

// ─── Гарах товч ───────────────────────────────────────────────────────────
document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
});

// 🔴 ЗАСВАР: хуудас ачаалахад гүйлгээнүүдийг татах
fetchTransactions();