// Kunci penyimpanan LocalStorage
const STORAGE_KEY_TX = 'perelek_transaksi_v1';
const STORAGE_KEY_SALDO_AWAL = 'perelek_saldo_awal_v1';

// State Aplikasi
let transactions = [];
let saldoAwal = 0;

// Inisialisasi saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initNavigation();
  initForm();
  initFilters();
  initSettingsAndBackup();
  setDefaultDate();
  updateOnlineStatus();
  registerServiceWorker();
  renderAll();
});

// ================= 1. PENYIMPANAN LOCALSTORAGE =================
function loadData() {
  const savedTx = localStorage.getItem(STORAGE_KEY_TX);
  const savedSaldo = localStorage.getItem(STORAGE_KEY_SALDO_AWAL);

  transactions = savedTx ? JSON.parse(savedTx) : [];
  saldoAwal = savedSaldo ? parseFloat(savedSaldo) : 0;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY_TX, JSON.stringify(transactions));
  localStorage.setItem(STORAGE_KEY_SALDO_AWAL, saldoAwal.toString());
}

// ================= 2. FORMAT RUPIAH & TANGGAL INDONESIA =================
function formatRupiah(angka) {
  const num = Number(angka) || 0;
  const prefix = num < 0 ? '-Rp ' : 'Rp ';
  return prefix + Math.abs(num).toLocaleString('id-ID');
}

function formatTanggalIndo(dateString) {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-');
  const bulanIndo = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  return `${parseInt(day, 10)} ${bulanIndo[parseInt(month, 10) - 1]} ${year}`;
}

function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('tx-tanggal').value = today;
}

// ================= 3. PERHITUNGAN SALDO BERJALAN =================
function getComputedTransactions() {
  // Urutkan berdasarkan tanggal terlama ke terbaru, lalu waktu input (id)
  const sorted = [...transactions].sort((a, b) => {
    if (a.tanggal !== b.tanggal) {
      return a.tanggal.localeCompare(b.tanggal);
    }
    return a.createdAt - b.createdAt;
  });

  let runningBalance = saldoAwal;

  return sorted.map(tx => {
    const masuk = Number(tx.pemasukan) || 0;
    const keluar = Number(tx.pengeluaran) || 0;
    const jumlahBersih = masuk - keluar;
    runningBalance += jumlahBersih;

    return {
      ...tx,
      pemasukan: masuk,
      pengeluaran: keluar,
      jumlahBersih,
      saldoBerjalan: runningBalance
    };
  });
}

// ================= 4. NAVIGASI TAB =================
function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.target);
    });
  });
}

function switchTab(targetId) {
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.target === targetId);
  });
  document.querySelectorAll('.tab-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === targetId);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================= 5. FORM TAMBAH & EDIT TRANSAKSI =================
function initForm() {
  const form = document.getElementById('transaksi-form');
  const inputMasuk = document.getElementById('tx-masuk');
  const inputKeluar = document.getElementById('tx-keluar');
  const previewBersih = document.getElementById('preview-bersih');
  const btnCancel = document.getElementById('btn-cancel-edit');

  // Hitung jumlah bersih otomatis saat mengetik
  const updatePreview = () => {
    const m = parseFloat(inputMasuk.value) || 0;
    const k = parseFloat(inputKeluar.value) || 0;
    const bersih = m - k;
    previewBersih.textContent = formatRupiah(bersih);
    previewBersih.style.color = bersih < 0 ? 'var(--red)' : 'var(--green-dark)';
  };

  inputMasuk.addEventListener('input', updatePreview);
  inputKeluar.addEventListener('input', updatePreview);

  btnCancel.addEventListener('click', resetFormMode);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('form-error');
    errorBox.classList.add('hidden');

    const id = document.getElementById('tx-id').value;
    const tanggal = document.getElementById('tx-tanggal').value;
    const nama = document.getElementById('tx-nama').value.trim();
    const keterangan = document.getElementById('tx-keterangan').value.trim() || 'Perelek Malam Minggu';
    const pemasukan = parseFloat(inputMasuk.value) || 0;
    const pengeluaran = parseFloat(inputKeluar.value) || 0;

    // Validasi Ketentuan
    if (!tanggal) {
      return showFormError('Tanggal transaksi wajib diisi.');
    }
    if (!nama) {
      return showFormError('Nama warga / pihak terkait wajib diisi.');
    }
    if (pemasukan < 0 || pengeluaran < 0) {
      return showFormError('Nominal pemasukan atau pengeluaran tidak boleh negatif.');
    }

    if (id) {
      // Mode Edit
      const idx = transactions.findIndex(t => t.id === id);
      if (idx !== -1) {
        transactions[idx] = {
          ...transactions[idx],
          tanggal,
          nama,
          keterangan,
          pemasukan,
          pengeluaran
        };
        showToast('Catatan transaksi berhasil diperbarui!');
      }
    } else {
      // Mode Tambah Baru
      transactions.push({
        id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        tanggal,
        nama,
        keterangan,
        pemasukan,
        pengeluaran,
        createdAt: Date.now()
      });
      showToast('Catatan perelek berhasil disimpan!');
    }

    saveData();
    resetFormMode();
    renderAll();
    switchTab('riwayat');
  });
}

function showFormError(msg) {
  const errorBox = document.getElementById('form-error');
  errorBox.textContent = '⚠️ ' + msg;
  errorBox.classList.remove('hidden');
}

function resetFormMode() {
  document.getElementById('transaksi-form').reset();
  document.getElementById('tx-id').value = '';
  document.getElementById('form-title').textContent = 'Tambah Catatan Perelek';
  document.getElementById('btn-submit').textContent = '💾 Simpan Catatan';
  document.getElementById('btn-cancel-edit').classList.add('hidden');
  document.getElementById('form-error').classList.add('hidden');
  document.getElementById('preview-bersih').textContent = 'Rp 0';
  document.getElementById('preview-bersih').style.color = 'var(--green-dark)';
  setDefaultDate();
}

function editTransaction(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;

  document.getElementById('tx-id').value = tx.id;
  document.getElementById('tx-tanggal').value = tx.tanggal;
  document.getElementById('tx-nama').value = tx.nama;
  document.getElementById('tx-keterangan').value = tx.keterangan;
  document.getElementById('tx-masuk').value = tx.pemasukan || '';
  document.getElementById('tx-keluar').value = tx.pengeluaran || '';

  const bersih = (tx.pemasukan || 0) - (tx.pengeluaran || 0);
  document.getElementById('preview-bersih').textContent = formatRupiah(bersih);

  document.getElementById('form-title').textContent = 'Edit Catatan Perelek';
  document.getElementById('btn-submit').textContent = '✅ Simpan Perubahan';
  document.getElementById('btn-cancel-edit').classList.remove('hidden');

  switchTab('tambah');
}

function deleteTransaction(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;

  const yakin = confirm(`Hapus catatan transaksi "${tx.nama}" pada tanggal ${formatTanggalIndo(tx.tanggal)}?\n\nSaldo akhir akan dihitung ulang otomatis.`);
  if (!yakin) return;

  transactions = transactions.filter(t => t.id !== id);
  saveData();
  renderAll();
  showToast('Transaksi berhasil dihapus.');
}

// ================= 6. RENDER DASHBOARD & RIWAYAT =================
function renderAll() {
  const computed = getComputedTransactions();
  renderDashboard(computed);
  renderRiwayat(computed);
  renderRekapExcel(computed);
  document.getElementById('input-saldo-awal').value = saldoAwal;
}

function renderDashboard(computed) {
  const totalMasuk = computed.reduce((sum, t) => sum + t.pemasukan, 0);
  const totalKeluar = computed.reduce((sum, t) => sum + t.pengeluaran, 0);
  const saldoAkhir = computed.length > 0 ? computed[computed.length - 1].saldoBerjalan : saldoAwal;

  document.getElementById('dash-saldo').textContent = formatRupiah(saldoAkhir);
  document.getElementById('dash-saldo-awal-info').textContent = `Termasuk Saldo Awal: ${formatRupiah(saldoAwal)}`;
  document.getElementById('dash-masuk').textContent = formatRupiah(totalMasuk);
  document.getElementById('dash-keluar').textContent = formatRupiah(totalKeluar);
  document.getElementById('dash-jumlah').textContent = `${computed.length} Catatan`;

  const recentContainer = document.getElementById('recent-list');
  if (computed.length === 0) {
    recentContainer.innerHTML = `
      <div class="empty-state">
        <span>📒</span>
        <h3>Belum Ada Transaksi</h3>
        <p>Mulai catat pemasukan perelek malam Minggu atau pengeluaran kas ronda.</p>
        <button class="btn btn-primary btn-sm" onclick="switchTab('tambah')">+ Buat Catatan Pertama</button>
      </div>
    `;
    return;
  }

  // Ambil 5 transaksi terbaru
  const terbaru = [...computed].reverse().slice(0, 5);
  recentContainer.innerHTML = terbaru.map(tx => {
    const isPlus = tx.jumlahBersih >= 0;
    return `
      <div class="recent-item">
        <div class="recent-info">
          <strong>${escapeHTML(tx.nama)}</strong>
          <span>${formatTanggalIndo(tx.tanggal)} • ${escapeHTML(tx.keterangan)}</span>
        </div>
        <div class="recent-amount ${isPlus ? 'text-green' : 'text-red'}">
          ${isPlus ? '+' : ''}${formatRupiah(tx.jumlahBersih)}
        </div>
      </div>
    `;
  }).join('');
}

function initFilters() {
  document.getElementById('filter-nama').addEventListener('input', () => renderRiwayat(getComputedTransactions()));
  document.getElementById('filter-bulan').addEventListener('change', () => {
    document.getElementById('filter-tanggal').value = '';
    renderRiwayat(getComputedTransactions());
  });
  document.getElementById('filter-tanggal').addEventListener('change', () => {
    document.getElementById('filter-bulan').value = '';
    renderRiwayat(getComputedTransactions());
  });
  document.getElementById('btn-reset-filter').addEventListener('click', () => {
    document.getElementById('filter-nama').value = '';
    document.getElementById('filter-bulan').value = '';
    document.getElementById('filter-tanggal').value = '';
    renderRiwayat(getComputedTransactions());
  });
  document.getElementById('excel-filter-bulan').addEventListener('change', () => {
    renderRekapExcel(getComputedTransactions());
  });
  document.getElementById('btn-excel-reset').addEventListener('click', () => {
    document.getElementById('excel-filter-bulan').value = '';
    renderRekapExcel(getComputedTransactions());
  });
}

function renderRiwayat(computed) {
  const container = document.getElementById('riwayat-container');
  const qNama = document.getElementById('filter-nama').value.trim().toLowerCase();
  const qBulan = document.getElementById('filter-bulan').value;
  const qTanggal = document.getElementById('filter-tanggal').value;

  const filtered = computed.filter(tx => {
    const matchNama = !qNama || tx.nama.toLowerCase().includes(qNama);
    const matchBulan = !qBulan || tx.tanggal.startsWith(qBulan);
    const matchTanggal = !qTanggal || tx.tanggal === qTanggal;
    return matchNama && matchBulan && matchTanggal;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span>🔍</span>
        <h3>Data Transaksi Tidak Ditemukan</h3>
        <p>${computed.length === 0 ? 'Buku kas masih kosong. Silakan tambahkan catatan baru.' : 'Tidak ada transaksi yang cocok dengan filter pencarian Anda.'}</p>
      </div>
    `;
    return;
  }

  // Hitung total pemasukan, pengeluaran, dan selisih dari data yang ditampilkan
  const totalMasuk = filtered.reduce((sum, tx) => sum + tx.pemasukan, 0);
  const totalKeluar = filtered.reduce((sum, tx) => sum + tx.pengeluaran, 0);
  const totalBersih = totalMasuk - totalKeluar;
  const saldoTerakhir = filtered[filtered.length - 1].saldoBerjalan;

  const tableRows = filtered.map(tx => `
    <tr>
      <td style="white-space: nowrap;">${formatTanggalIndo(tx.tanggal)}</td>
      <td><strong>${escapeHTML(tx.nama)}</strong></td>
      <td>${escapeHTML(tx.keterangan)}</td>
      <td class="num text-green">${tx.pemasukan > 0 ? formatRupiah(tx.pemasukan) : '-'}</td>
      <td class="num text-red">${tx.pengeluaran > 0 ? formatRupiah(tx.pengeluaran) : '-'}</td>
      <td class="num"><strong>${formatRupiah(tx.jumlahBersih)}</strong></td>
      <td class="num"><strong>${formatRupiah(tx.saldoBerjalan)}</strong></td>
      <td class="num">
        <button class="btn btn-secondary btn-sm" onclick="editTransaction('${tx.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTransaction('${tx.id}')">Hapus</button>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <span class="swipe-hint">👉 Geser tabel ke samping untuk melihat seluruh kolom</span>
    <div class="table-responsive-wrap">
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Nama</th>
            <th>Keterangan</th>
            <th class="num">Pemasukan</th>
            <th class="num">Pengeluaran</th>
            <th class="num">Jumlah</th>
            <th class="num">Saldo Akhir</th>
            <th class="num">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="3">TOTAL (${filtered.length} Transaksi)</td>
            <td class="num text-green">${formatRupiah(totalMasuk)}</td>
            <td class="num text-red">${formatRupiah(totalKeluar)}</td>
            <td class="num">${formatRupiah(totalBersih)}</td>
            <td class="num">${formatRupiah(saldoTerakhir)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function renderRekapExcel(computed) {
  const container = document.getElementById('excel-sheet-area');
  if (!container) return;

  const filterBulan = document.getElementById('excel-filter-bulan').value;
  const dataTampil = filterBulan
    ? computed.filter(tx => tx.tanggal.startsWith(filterBulan))
    : computed;

  const labelPeriode = filterBulan ? `Periode Bulan: ${filterBulan}` : 'Periode: Semua Catatan Kas';
  const totalMasuk = dataTampil.reduce((sum, tx) => sum + tx.pemasukan, 0);
  const totalKeluar = dataTampil.reduce((sum, tx) => sum + tx.pengeluaran, 0);
  const saldoAkhir = dataTampil.length > 0
    ? dataTampil[dataTampil.length - 1].saldoBerjalan
    : saldoAwal;

  const rowsHTML = dataTampil.map((tx, idx) => `
    <tr>
      <td class="center">${idx + 1}</td>
      <td class="center" style="white-space: nowrap;">${formatTanggalIndo(tx.tanggal)}</td>
      <td>${escapeHTML(tx.nama)}</td>
      <td>${escapeHTML(tx.keterangan)}</td>
      <td class="num text-green">${tx.pemasukan > 0 ? formatRupiah(tx.pemasukan) : '-'}</td>
      <td class="num text-red">${tx.pengeluaran > 0 ? formatRupiah(tx.pengeluaran) : '-'}</td>
      <td class="num"><strong>${formatRupiah(tx.saldoBerjalan)}</strong></td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="excel-sheet-header">
      <h3>BUKU KAS PERELEK RONDA MALAM MINGGU</h3>
      <p>${labelPeriode} • Dicetak: ${formatTanggalIndo(new Date().toISOString().split('T')[0])}</p>
    </div>
    <table class="excel-grid-table">
      <thead>
        <tr>
          <th style="width: 45px;">No</th>
          <th>Tanggal</th>
          <th>Nama Warga</th>
          <th>Keterangan</th>
          <th>Pemasukan</th>
          <th>Pengeluaran</th>
          <th>Saldo</th>
        </tr>
      </thead>
      <tbody>
        ${!filterBulan ? `
        <tr class="row-saldo-awal">
          <td class="center">-</td>
          <td class="center">-</td>
          <td colspan="2">SALDO AWAL KAS</td>
          <td class="num">-</td>
          <td class="num">-</td>
          <td class="num">${formatRupiah(saldoAwal)}</td>
        </tr>` : ''}
        ${dataTampil.length > 0 ? rowsHTML : `
        <tr>
          <td colspan="7" class="center" style="padding: 20px; color: #64748b;">Belum ada catatan transaksi pada periode ini.</td>
        </tr>`}
      </tbody>
      <tfoot>
        <tr class="row-total-excel">
          <td colspan="4" class="center">TOTAL KESELURUHAN</td>
          <td class="num text-green">${formatRupiah(totalMasuk)}</td>
          <td class="num text-red">${formatRupiah(totalKeluar)}</td>
          <td class="num">${formatRupiah(saldoAkhir)}</td>
        </tr>
      </tfoot>
    </table>
  `;
}

// ================= 7. SALDO AWAL, EXPORT & IMPORT EXCEL (.XLSX) =================
function initSettingsAndBackup() {
  // Simpan Saldo Awal
  document.getElementById('saldo-awal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = parseFloat(document.getElementById('input-saldo-awal').value);
    if (isNaN(val) || val < 0) {
      alert('Saldo awal tidak boleh kurang dari 0.');
      return;
    }
    saldoAwal = val;
    saveData();
    renderAll();
    showToast('Saldo awal berhasil diperbarui!');
  });

  // Export ke Excel Asli (.xlsx)
  document.getElementById('btn-export-excel').addEventListener('click', () => {
    if (typeof XLSX === 'undefined') {
      alert('Pustaka Excel (xlsx.full.min.js) belum dimuat. Pastikan file sudah ada di folder proyek.');
      return;
    }

    const computed = getComputedTransactions();
    if (computed.length === 0 && saldoAwal === 0) {
      alert('Belum ada data untuk diekspor ke Excel.');
      return;
    }

    // Susun baris data Excel
    const rows = [
      ['APLIKASI PERELEK – BUKU KAS RONDA MALAM MINGGU'],
      [`Dicetak pada: ${formatTanggalIndo(new Date().toISOString().split('T')[0])}`],
      [], // Baris kosong pemisah
      ['No', 'Tanggal', 'Nama Warga', 'Keterangan', 'Pemasukan (Rp)', 'Pengeluaran (Rp)', 'Jumlah Bersih (Rp)', 'Saldo Akhir (Rp)'],
      [0, '-', 'SALDO AWAL KAS', 'Modal awal buku kas', 0, 0, 0, saldoAwal]
    ];

    computed.forEach((tx, idx) => {
      rows.push([
        idx + 1,
        tx.tanggal, // Format YYYY-MM-DD agar akurat saat di-import ulang
        tx.nama,
        tx.keterangan,
        tx.pemasukan,
        tx.pengeluaran,
        tx.jumlahBersih,
        tx.saldoBerjalan
      ]);
    });

    // Tambahkan baris ringkasan total di bagian bawah
    const totalMasuk = computed.reduce((s, t) => s + t.pemasukan, 0);
    const totalKeluar = computed.reduce((s, t) => s + t.pengeluaran, 0);
    const saldoAkhir = computed.length > 0 ? computed[computed.length - 1].saldoBerjalan : saldoAwal;

    rows.push([]);
    rows.push(['', '', 'TOTAL KESELURUHAN', '', totalMasuk, totalKeluar, totalMasuk - totalKeluar, saldoAkhir]);

    // Buat Workbook & Worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Atur lebar kolom otomatis agar rapi saat dibuka di Microsoft Excel
    ws['!cols'] = [
      { wch: 6 },  // No
      { wch: 14 }, // Tanggal
      { wch: 24 }, // Nama Warga
      { wch: 30 }, // Keterangan
      { wch: 18 }, // Pemasukan
      { wch: 18 }, // Pengeluaran
      { wch: 18 }, // Jumlah Bersih
      { wch: 18 }  // Saldo Akhir
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Buku Kas Perelek');

    const tglFile = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Buku-Kas-Perelek-${tglFile}.xlsx`);
    showToast('File Excel (.xlsx) berhasil diunduh!');
  });

  // Import / Pulihkan Data langsung dari File Excel (.xlsx)
  document.getElementById('input-import-excel').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        let importedSaldoAwal = 0;
        const importedTransactions = [];

        rows.forEach((row, index) => {
          if (!Array.isArray(row) || row.length < 6) return;

          const noCol = row[0];
          const tanggalCol = String(row[1] || '').trim();
          const namaCol = String(row[2] || '').trim();
          const ketCol = String(row[3] || '').trim();
          const masukCol = parseFloat(row[4]) || 0;
          const keluarCol = parseFloat(row[5]) || 0;

          // Deteksi baris Saldo Awal
          if (noCol === 0 && namaCol.toUpperCase() === 'SALDO AWAL KAS') {
            importedSaldoAwal = parseFloat(row[7]) || 0;
            return;
          }

          // Deteksi baris transaksi valid (punya nomor urut > 0 dan tanggal YYYY-MM-DD)
          if (typeof noCol === 'number' && noCol > 0 && /^\d{4}-\d{2}-\d{2}$/.test(tanggalCol) && namaCol) {
            importedTransactions.push({
              id: 'tx_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substring(2, 5),
              tanggal: tanggalCol,
              nama: namaCol,
              keterangan: ketCol || 'Perelek Malam Minggu',
              pemasukan: masukCol,
              pengeluaran: keluarCol,
              createdAt: Date.now() + index
            });
          }
        });

        if (importedTransactions.length === 0 && importedSaldoAwal === 0) {
          throw new Error('Tidak ditemukan data transaksi yang valid di dalam file Excel.');
        }

        const yakin = confirm(
          `Ditemukan ${importedTransactions.length} catatan transaksi dan Saldo Awal ${formatRupiah(importedSaldoAwal)} dari file Excel.\n\nData saat ini di aplikasi akan digantikan. Lanjutkan?`
        );
        if (!yakin) {
          e.target.value = '';
          return;
        }

        saldoAwal = importedSaldoAwal;
        transactions = importedTransactions;
        saveData();
        renderAll();
        showToast('Seluruh data berhasil dipulihkan dari Excel!');
        switchTab('dashboard');
      } catch (err) {
        alert('Gagal membaca file Excel: ' + err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ================= 8. UTILITAS, STATUS OFFLINE & PWA =================
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function updateOnlineStatus() {
  const badge = document.getElementById('offline-badge');
  const syncStatus = () => {
    if (navigator.onLine) {
      badge.textContent = 'Online';
      badge.className = 'badge-status online';
    } else {
      badge.textContent = 'Mode Offline';
      badge.className = 'badge-status offline';
    }
  };
  window.addEventListener('online', syncStatus);
  window.addEventListener('offline', syncStatus);
  syncStatus();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Service worker memerlukan protokol http/https (localhost atau hosting)
    });
  }
}