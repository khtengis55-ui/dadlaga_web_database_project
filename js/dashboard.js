import { supabase } from './supabase.js'
import { refreshBadges } from './badges.js'

// Дэлгэц дээрх HTML элементүүдийг JS хувьсагчид оноож авах
const transactionForm = document.getElementById('transaction-form');
const txTypeInput = document.getElementById('tx-type');
const txCategoryInput = document.getElementById('tx-category');
const txAmountInput = document.getElementById('tx-amount');
const txDateInput = document.getElementById('tx-date');
const txDescInput = document.getElementById('tx-desc');


// "YYYY-MM" -> { start: "YYYY-MM-01", nextMonthStart: дараа сарын эхэн }
function getMonthRange(monthYear) {
    const [y, m] = monthYear.split('-').map(Number);
    const start = `${monthYear}-01`;
    const nextMonthStart =
        m === 12
            ? `${y + 1}-01-01`
            : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    return { start, nextMonthStart };
}

// Тухайн САР + АНГИЛЛЫН бүх зарлагын нийлбэр.
// Огнооны дарааллаас үл хамааран (өмнөх БА дараах зарлагуудыг бүгдийг) нэмж тооцно.
async function getMonthlyCategorySpend(userId, category, monthYear) {
    const { start, nextMonthStart } = getMonthRange(monthYear);
    const { data, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .eq('category', category)
        .gte('date', start)
        .lt('date', nextMonthStart);

    if (error) {
        console.error('Зарлагын нийлбэр бодоход алдаа:', error.message);
        return 0;
    }
    return (data || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

// Тухайн ангилал/сард тогтоосон төсвийг авах (байхгүй бол null)
async function getBudget(userId, category, monthYear) {
    const { data, error } = await supabase
        .from('budgets')
        .select('limit_amount')
        .eq('user_id', userId)
        .eq('category', category)
        .eq('month_year', monthYear)
        .maybeSingle();

    if (error) {
        console.error('Төсөв уншихад алдаа:', error.message);
        return null;
    }
    return data; // null эсвэл { limit_amount }
}

// Хуудас бэлэн болж, ачаалагдаж дуусах үед ажиллах хэсэг
document.addEventListener('DOMContentLoaded', async () => {

    // Хамгийн түрүүнд хэрэглэгч нэвтэрсэн эсэхийг шалгана
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        // Хэрэв нэвтрээгүй байвал шууд нэвтрэх хуудас руу буцаана
        window.location.href = 'index.html';
        return;
    }

    // Хэрэглэгч нэвтэрсэн нь үнэн бол имэйлийг нь navbar дээр харуулна
    document.getElementById('user-email').textContent = user.email;

    await fetchTransactions();
    // Төсвийн жагсаалтыг шинэчлэх функцийг дуудна
    if (typeof fetchBudgets === 'function') fetchBudgets();
    refreshBadges();
});

transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Хуудас Refresh хийгдэхийг зогсооно

    // Талбаруудаас хэрэглэгчийн оруулсан утгуудыг уншиж авах
    const type = txTypeInput.value;
    const category = txCategoryInput.value;
    const amount = parseFloat(txAmountInput.value); // Текстийг тоо болгож хөрвүүлнэ
    const date = txDateInput.value;
    const description = txDescInput.value;

    // Гүйлгээ нэмэх гэж буй нэвтэрсэн хэрэглэгчийн мэдээллийг Supabase-ээс авах
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        alert("Сешн дууссан байна. Дахин нэвтэрнэ үү!");
        window.location.href = 'index.html';
        return;
    }

    // --- (Формын утгуудыг авсны дараа, Insert хийхийн өмнөх хэсэг) ---
    if (type === 'expense') {
        // Гүйлгээний огнооноос Жил-Сарыг салгаж авна ("2026-06-08" -> "2026-06")
        const monthYear = date.substring(0, 7);

        // Энэ сар + ангилалд төсөв тогтоосон эсэхийг шалгах
        const budget = await getBudget(user.id, category, monthYear);

        if (budget) {
            const limitAmount = Number(budget.limit_amount);

            // Энэ сард ЭНЭ ангилалд хийгдсэн БҮХ зарлагын нийлбэр
            // (огнооны дарааллаас үл хамаарч, өмнөх ба дараах гүйлгээг бүгдийг тооцно)
            const alreadySpent = await getMonthlyCategorySpend(user.id, category, monthYear);
            const projectedTotal = alreadySpent + amount; // одоогийн шинэ дүнг нэмсэн нийт

            if (projectedTotal > limitAmount) {
                const overBy = projectedTotal - limitAmount;
                const proceed = confirm(
                    `⚠️ ТӨСӨВ ХЭТЭРЛЭЭ!\n\n` +
                    `Ангилал: ${category}\n` +
                    `Сар: ${monthYear}\n` +
                    `————————————————\n` +
                    `Төсвийн хязгаар: ${limitAmount.toLocaleString()} ₮\n` +
                    `Энэ сард аль хэдийн зарцуулсан: ${alreadySpent.toLocaleString()} ₮\n` +
                    `Энэ гүйлгээ: ${amount.toLocaleString()} ₮\n` +
                    `————————————————\n` +
                    `НИЙТ болох дүн: ${projectedTotal.toLocaleString()} ₮\n` +
                    `Хэтрэх дүн: ${overBy.toLocaleString()} ₮\n\n` +
                    `Гүйлгээг үргэлжлүүлэх үү?`
                );

                if (!proceed) {
                    return; // "Цуцлах" дарвал гүйлгээг хадгалахгүй зогсооно
                }
            }
        }
    }

    // Supabase руу шинэ мөр өгөгдөл нэмэх (Insert) үйлдэл
    const { data, error } = await supabase
        .from('transactions') // Хэрэглэх хүснэгтийн нэр
        .insert([
            {
                user_id: user.id,        // UUID
                type: type,              // 'income' эсвэл 'expense'
                category: category,      // 'Хүнс', 'Цалин' гэх мэт
                amount: amount,          // Мөнгөн дүн (Тоо)
                description: description,// Дэлгэрэнгүй тайлбар
                date: date               // Сонгосон огноо (YYYY-MM-DD)
            }
        ])
        .select(); // Хадгалагдсан өгөгдлийг хариу болгож буцааж авах

    if (error) {
        alert("Гүйлгээг хадгалахад алдаа гарлаа: " + error.message);
        console.error("Алдааны дэлгэрэнгүй:", error);
    } else {
        alert("Гүйлгээ амжилттай бүртгэгдлээ!");
        transactionForm.reset(); // Формын бүх талбарыг цэвэрлэж хоосон болгоно
        refreshBadges(); // 🆕 шинэ амжилт (badge) хүртсэн эсэхийг шалгана
    }
    // Хуудсан дээрх өгөгдлийг шинэчилж харуулна
    fetchTransactions();
});

// Өгөгдлийн сангаас гүйлгээ уншиж, хүснэгтэд харуулах функц
async function fetchTransactions() {
    // Нэвтэрсэн хэрэглэгчийг авах
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Supabase-с зөвхөн энэ хэрэглэгчийн гүйлгээнүүдийг огноогоор нь жагсааж авах
    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*') // Бүх баганыг уншиж авна
        .eq('user_id', user.id) // Зөвхөн энэ хэрэглэгчийнх гэсэн шүүлтүүр
        .order('date', { ascending: false }); // Хамгийн шинэ гүйлгээг дээр нь гаргана

    if (error) {
        console.error("Гүйлгээ уншихад алдаа гарлаа:", error.message);
        return;
    }

    // Мөнгөн дүнг тооцоолох хэсэг
    let totalIncome = 0;
    let totalExpense = 0;

    // Ирсэн бүх гүйлгээнүүдийг нэг нэгээр нь шалгаж, орлого зарлагыг нэмнэ
    transactions.forEach(tx => {
        if (tx.type === 'income') {
            totalIncome += Number(tx.amount) || 0;  // Орлого бол Нийт Орлого дээр нэмнэ
        } else if (tx.type === 'expense') {
            totalExpense += Number(tx.amount) || 0; // Зарлага бол Нийт зарлага дээр нэмнэ
        }
    });

    // Үлдэгдэл баланс = Нийт Орлого - Нийт Зарлага
    const totalBalance = totalIncome - totalExpense;

    // Бодсон дүнг HTML карт руу бичих
    document.getElementById('total-balance').textContent = `${totalBalance.toLocaleString()} ₮`;
    document.getElementById('total-income').textContent = `${totalIncome.toLocaleString()} ₮`;
    document.getElementById('total-expense').textContent = `${totalExpense.toLocaleString()} ₮`;

    // HTML хүснэгтэд гүйлгээнүүдийг үзүүлэх функцыг дуудаж, өгөгдлийг дамжуулна
    renderTransactions(transactions);
}

function renderTransactions(transactions) {
    const listContainer = document.getElementById('transaction-list');

    // Хэрэв ямар ч гүйлгээ байхгүй бол хоосон байна гэсэн бичиг харуулна
    if (transactions.length === 0) {
        listContainer.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    <i class="fa-solid fa-folder-open fs-3 d-block mb-2"></i>
                    Одоогоор ямар нэгэн гүйлгээ бүртгэгдээгүй байна.
                </td>
            </tr>
        `;
        return;
    }

    // Хүснэгтийг цэвэрлээд, датаг мөр мөрөөр нь залгах
    let htmlContent = '';

    transactions.forEach(tx => {
        // Орлого бол ногоон +, Зарлага бол улаан - тэмдэг тавих логик
        const isIncome = tx.type === 'income';
        const badgeColor = isIncome ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger';
        const typeText = isIncome ? 'Орлого' : 'Зарлага';
        const amountSign = isIncome ? '+' : '-';
        const amountColor = isIncome ? 'text-success' : 'text-danger';

        htmlContent += `
            <tr>
                <td>${tx.date}</td>
                <td><span class="badge bg-light text-dark shadow-sm border">${tx.category}</span></td>
                <td class="text-secondary fw-medium">${tx.description}</td>
                <td><span class="badge ${badgeColor}">${typeText}</span></td>
                <td class="text-end fw-bold ${amountColor}">${amountSign}${Number(tx.amount).toLocaleString()} ₮</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-link text-danger p-0" onclick="deleteTransaction('${tx.id}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    // Бэлдсэн HTML мөрүүдээ хүснэгтийн tbody руу шууд шахаж оруулна
    listContainer.innerHTML = htmlContent;
}

// Гүйлгээ устгах функц (Дэлгэц дээрх устгах товч дарагдахад ажиллана)
window.deleteTransaction = async function(id) {
    // Хэрэглэгчээс үнэхээр устгах эсэхийг нь лавлаж асууна
    const confirmDelete = confirm("Та энэ гүйлгээг устгахдаа итгэлтэй байна уу?");

    if (!confirmDelete) {
        return; // Хэрэв "Үгүй" гэвэл устгах үйлдлийг цуцалж, функцээс гарна
    }

    try {
        // Supabase өгөгдлийн сангаас тухайн ID-тай гүйлгээг устгах
        const { error } = await supabase
            .from('transactions')
            .delete() // SQL-ийн DELETE команд
            .eq('id', id); // Зөвхөн энэ ID-тай мөрийг устга гэдэг шүүлтүүр

        if (error) {
            throw error; // Хэрэв алдаа гарвал catch хэсэг рүү шиднэ
        }

        alert("Гүйлгээ амжилттай устгагдлаа.");

        // Устгасны дараа дэлгэц дээрх хүснэгтийг шууд шинэчилж харуулна
        fetchTransactions();
        // 🆕 Badge тооллого/харагдацыг шинэчилнэ
        refreshBadges();

    } catch (error) {
        alert("Гүйлгээ устгахад алдаа гарлаа: " + error.message);
        console.error("Устгах үеийн алдаа:", error);
    }
}

// HTML дээрх "Гарах" товч ID-аар нь барьж авах
const btnLogout = document.getElementById('btn-logout');

// Товч дээр дарах үед ажиллах Event Listener залгах
btnLogout.addEventListener('click', async () => {
    // Хэрэглэгчээс үнэхээр гарах эсэхийг нь лавлаж асууна
    const confirmLogout = confirm("Та системээс гарахдаа итгэлтэй байна уу?");

    if (!confirmLogout) {
        return; // Хэрэв цуцалбал гарах үйлдлийг зогсооно
    }

    try {
        // Supabase-ийн системээс бүрмөсөн гаргах, сешн устгах тушаал
        const { error } = await supabase.auth.signOut();

        if (error) {
            throw error; // Хэрэв алдаа гарвал catch хэсэг рүү шиднэ
        }

        // Амжилттай гарсан тул нэвтрэх хуудас руу шууд шилжүүлнэ
        window.location.href = 'index.html';

    } catch (error) {
        alert("Системээс гарахад алдаа гарлаа: " + error.message);
        console.error("Logout алдаа:", error);
    }
});



// --- ТӨСӨВ ТОГТООХ ФОРМЫН ЛОГИК ---
const budgetForm = document.getElementById('budget-form');
const budgetCategoryInput = document.getElementById('budget-category');
const budgetAmountInput = document.getElementById('budget-amount');
const budgetMonthInput = document.getElementById('budget-month');

budgetForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Формоос өгөгдөл уншиж авах
    const category = budgetCategoryInput.value;
    const limitAmount = parseFloat(budgetAmountInput.value);
    const monthYear = budgetMonthInput.value;
    // Нэвтэрсэн хэрэглэгчийг шалгах
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert("Сешн дууссан байна!");
        return;
    }

    // Supabase-ийн 'budgets' хүснэгт рүү хадгалах
    const { error } = await supabase
        .from('budgets')
        .insert([
            {
                user_id: user.id,
                category: category,
                limit_amount: limitAmount,
                month_year: monthYear
            }
        ]);

    if (error) {
        alert("Төсөв тогтооход алдаа гарлаа: " + error.message);
    } else {
        // хэтэрсэн эсэхийг шалгаж, хэтэрсэн бол шууд анхааруулна.
        const spent = await getMonthlyCategorySpend(user.id, category, monthYear);
        let msg = `${monthYear} сарын "${category}" ангилалд төсөв амжилттай тогтоогдлоо!`;
        if (spent > limitAmount) {
            const overBy = spent - limitAmount;
            msg += `\n\n⚠️ Гэхдээ энэ сард аль хэдийн ${spent.toLocaleString()} ₮ зарцуулсан нь ` +
                   `тогтоосон ${limitAmount.toLocaleString()} ₮ хязгаараас ` +
                   `${overBy.toLocaleString()} ₮-р хэтэрсэн байна.`;
        }
        alert(msg);

        budgetForm.reset();

        // Bootstrap Offcanvas цэсийг автоматаар хаах код
        const instance = bootstrap.Offcanvas.getInstance(document.getElementById('offcanvasBudget'));
        if (instance) instance.hide();

        // Төсвийн жагсаалтыг шинэчлэх
        if (typeof fetchBudgets === 'function') fetchBudgets();
        //  "Төлөвлөгөөтэй" badge зэргийг шалгана
        refreshBadges();
    }
});


// Хэрэглэгчийн тогтоосон төсвүүдийг уншиж, Offcanvas доор жагсаах функц
async function fetchBudgets() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: budgets, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .order('month_year', { ascending: false });

    if (error) {
        console.error("Төсөв уншихад алдаа гарлаа:", error.message);
        return;
    }

    const budgetsContainer = document.getElementById('current-budgets-list');

    if (!budgets || budgets.length === 0) {
        budgetsContainer.innerHTML = `
            <h6 class="fw-bold text-dark mb-3">Одоогийн тогтоосон төсвүүд:</h6>
            <div class="text-center py-3 text-muted small bg-light rounded">Одоогоор төсөв тогтоогоогүй байна.</div>
        `;
        return;
    }

    //  Бүх зарлагыг НЭГ удаа татаж, "ангилал|сар"-аар нийлбэрлэнэ
    const { data: expenses } = await supabase
        .from('transactions')
        .select('amount, category, date')
        .eq('user_id', user.id)
        .eq('type', 'expense');

    const spendMap = {}; // "category|YYYY-MM" -> нийт зарлага
    (expenses || []).forEach(tx => {
        const ym = (tx.date || '').substring(0, 7);
        const key = `${tx.category}|${ym}`;
        spendMap[key] = (spendMap[key] || 0) + (Number(tx.amount) || 0);
    });

    let htmlContent = `<h6 class="fw-bold text-dark mb-3">Одоогийн тогтоосон төсвүүд:</h6>`;

    budgets.forEach(b => {
        const limit = Number(b.limit_amount) || 0;
        const spent = spendMap[`${b.category}|${b.month_year}`] || 0;
        const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
        const isOver = spent > limit;

        let barColor = 'bg-success';
        if (isOver) barColor = 'bg-danger';
        else if (percent >= 80) barColor = 'bg-warning';

        const remaining = limit - spent;
        const statusText = isOver
            ? `<span class="text-danger fw-bold">${Math.abs(remaining).toLocaleString()} ₮-р хэтэрсэн</span>`
            : `<span class="text-muted">${remaining.toLocaleString()} ₮ үлдсэн</span>`;

        htmlContent += `
            <div class="card p-2 mb-2 bg-light border-0 shadow-sm">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <div>
                        <span class="fw-bold small text-dark">${b.category}</span>
                        <span class="text-muted mx-1">•</span>
                        <span class="small text-secondary">${b.month_year}</span>
                    </div>
                    <span class="fw-bold small ${isOver ? 'text-danger' : 'text-primary'}">
                        ${spent.toLocaleString()} / ${limit.toLocaleString()} ₮
                    </span>
                </div>
                <div class="progress" style="height: 6px;">
                    <div class="progress-bar ${barColor}" role="progressbar"
                         style="width: ${percent}%;"
                         aria-valuenow="${Math.round(percent)}" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
                <div class="text-end mt-1" style="font-size: 0.75rem;">
                    ${statusText}
                </div>
            </div>
        `;
    });

    budgetsContainer.innerHTML = htmlContent;
}