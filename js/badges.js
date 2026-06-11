//anhnii alham-anhnii guilgee burtgehed
//orlogotoi-anhnii orlogo burtgehed
//tolovlogootei-anhnii tosvoo togtoohod
//togtmol burtgegc-niit 10 guilgee burtgehed
//hadgalamjtai-uldegdel 1,000,000₮ davahad
//sahilgat sar-ongorson sard tosvoo hetruuleegui bol

import { supabase } from './supabase.js';

const SAVER_THRESHOLD = 1_000_000; // "Хадгаламжтай" badge-ийн босго (₮). Хүсвэл өөрчилнө.

export const BADGE_DEFINITIONS = [
  {
    key: 'first_transaction',
    label: 'Анхны алхам',
    icon: 'fa-shoe-prints',
    color: 'success',
    desc: 'Анхны гүйлгээгээ амжилттай бүртгэлээ.',
    check: (s) => s.transactionCount >= 1,
  },
  {
    key: 'first_income',
    label: 'Орлоготой',
    icon: 'fa-sack-dollar',
    color: 'success',
    desc: 'Анхны орлогоо бүртгэлээ.',
    check: (s) => s.incomeCount >= 1,
  },
  {
    key: 'first_budget',
    label: 'Төлөвлөгөөтэй',
    icon: 'fa-bullseye',
    color: 'primary',
    desc: 'Анхны төсвөө тогтоолоо.',
    check: (s) => s.budgetCount >= 1,
  },
  {
    key: 'ten_transactions',
    label: 'Тогтмол бүртгэгч',
    icon: 'fa-list-check',
    color: 'info',
    desc: 'Нийт 10 гүйлгээ бүртгэлээ.',
    check: (s) => s.transactionCount >= 10,
  },
  {
    key: 'saver',
    label: 'Хадгаламжтай',
    icon: 'fa-piggy-bank',
    color: 'warning',
    desc: `Үлдэгдэл ${SAVER_THRESHOLD.toLocaleString()} ₮-с давлаа.`,
    check: (s) => s.balance >= SAVER_THRESHOLD,
  },
  {
    key: 'budget_keeper',
    label: 'Сахилгат сар',
    icon: 'fa-trophy',
    color: 'warning',
    desc: 'Өнгөрсөн (дууссан) сард төсвөө хэтрүүлэлгүй багтаалаа.',
    check: (s) => s.keptPastMonthBudget,
  },
];

async function buildStats(userId) {
  // Бүх гүйлгээ
  const { data: txs, error: txErr } = await supabase
    .from('transactions')
    .select('type, amount, category, date')
    .eq('user_id', userId);

  if (txErr) {
    console.error('Badge: гүйлгээ уншихад алдаа:', txErr.message);
    return null;
  }

  // Бүх төсөв
  const { data: budgets, error: bErr } = await supabase
    .from('budgets')
    .select('category, limit_amount, month_year')
    .eq('user_id', userId);

  if (bErr) {
    console.error('Badge: төсөв уншихад алдаа:', bErr.message);
    return null;
  }

  const transactions = txs || [];
  const allBudgets = budgets || [];

  let totalIncome = 0;
  let totalExpense = 0;
  let incomeCount = 0;

  // "category|YYYY-MM" -> тухайн ангилал/сарын нийт зарлага
  const spendByCatMonth = {};

  transactions.forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') {
      totalIncome += amt;
      incomeCount += 1;
    } else if (t.type === 'expense') {
      totalExpense += amt;
      const ym = (t.date || '').substring(0, 7);
      const key = `${t.category}|${ym}`;
      spendByCatMonth[key] = (spendByCatMonth[key] || 0) + amt;
    }
  });

  // Өнгөрсөн (дууссан) сард төсвөө хэтрүүлээгүй эсэх
  const nowYM = new Date().toISOString().substring(0, 7); // "YYYY-MM"
  let keptPastMonthBudget = false;
  for (const b of allBudgets) {
    if (b.month_year < nowYM) {
      const key = `${b.category}|${b.month_year}`;
      const spent = spendByCatMonth[key] || 0;
      // Тухайн ангилалд зарлага гарсан БА лимитээс хэтрээгүй бол
      if (spent > 0 && spent <= Number(b.limit_amount)) {
        keptPastMonthBudget = true;
        break;
      }
    }
  }

  return {
    transactionCount: transactions.length,
    incomeCount,
    budgetCount: allBudgets.length,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    keptPastMonthBudget,
  };
}

async function evaluateAndAwardBadges(userId, stats) {
  // Аль хэдийн олгогдсон badge-уудыг авах
  const { data: earnedRows, error } = await supabase
    .from('badges')
    .select('badge_name')
    .eq('user_id', userId);

  if (error) {
    console.error('Badge: одоо байгаа badge уншихад алдаа:', error.message);
    return [];
  }

  const earnedKeys = new Set((earnedRows || []).map((r) => r.badge_name));

  // Хүртэх ёстой ч хараахан олгогдоогүй badge-уудыг шүүх
  const toAward = BADGE_DEFINITIONS.filter(
    (def) => def.check(stats) && !earnedKeys.has(def.key)
  );

  if (toAward.length === 0) return [];

  const rows = toAward.map((def) => ({
    user_id: userId,
    badge_name: def.key,
    awarded_at: new Date().toISOString(),
  }));

  const { error: insErr } = await supabase.from('badges').insert(rows);

  if (insErr) {
    // Давхардлын (unique index) алдаа гарвал алгасна
    console.error('Badge: нэмэхэд алдаа:', insErr.message);
    return [];
  }

  return toAward; // шинээр олгогдсон badge-ууд
}

async function renderBadges(userId) {
  const container = document.getElementById('badges-list');
  if (!container) return;

  const { data: earnedRows, error } = await supabase
    .from('badges')
    .select('badge_name, awarded_at')
    .eq('user_id', userId);

  if (error) {
    console.error('Badge: харуулахад алдаа:', error.message);
    container.innerHTML =
      '<div class="text-danger small">Тэмдгүүдийг ачаалж чадсангүй.</div>';
    return;
  }

  const earnedMap = {};
  (earnedRows || []).forEach((r) => {
    earnedMap[r.badge_name] = r.awarded_at;
  });

  const earnedCount = Object.keys(earnedMap).length;
  const totalCount = BADGE_DEFINITIONS.length;

  let html = '';
  BADGE_DEFINITIONS.forEach((def) => {
    const isEarned = !!earnedMap[def.key];

    if (isEarned) {
      const awardedDate = new Date(earnedMap[def.key]).toLocaleDateString();
      html += `
        <div class="text-center" style="width: 92px;"
             title="${def.desc} (${awardedDate})">
          <div class="rounded-circle bg-${def.color}-subtle text-${def.color} d-flex align-items-center justify-content-center mx-auto mb-1"
               style="width:56px;height:56px;">
            <i class="fa-solid ${def.icon} fs-4"></i>
          </div>
          <div class="small fw-medium text-dark">${def.label}</div>
        </div>
      `;
    } else {
      html += `
        <div class="text-center opacity-50" style="width: 92px;"
             title="Нөхцөл: ${def.desc}">
          <div class="rounded-circle bg-light text-muted d-flex align-items-center justify-content-center mx-auto mb-1 border"
               style="width:56px;height:56px;">
            <i class="fa-solid fa-lock"></i>
          </div>
          <div class="small text-muted">${def.label}</div>
        </div>
      `;
    }
  });

  container.innerHTML =
    `<div class="w-100 text-secondary small mb-2">Цуглуулсан тэмдэг: ${earnedCount} / ${totalCount}</div>` +
    html;
}

export async function refreshBadges() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const stats = await buildStats(user.id);
  if (!stats) {
    // статистик авч чадаагүй ч хуучин badge-уудаа л зураад орхино
    await renderBadges(user.id);
    return;
  }

  const newlyAwarded = await evaluateAndAwardBadges(user.id, stats);
  await renderBadges(user.id);

  if (newlyAwarded.length > 0) {
    const names = newlyAwarded.map((b) => `🏅 ${b.label}`).join('\n');
    alert(`Баяр хүргэе! Та шинэ тэмдэг хүртлээ:\n\n${names}`);
  }
}