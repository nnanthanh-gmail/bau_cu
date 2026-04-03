let contract;
let signer;
let timerInterval;
const contractAddress = "0x701B0c8d4803b52dFF2d4300eff84e2d0855eA18"; 
const THEME_KEY = "bauCuTheme";

// --- QUẢN LÝ THEME ---
function applyTheme(theme) {
    const root = document.documentElement;
    const themeToggle = document.getElementById("themeToggle");
    const themeName = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", themeName);
    localStorage.setItem(THEME_KEY, themeName);

    if (themeToggle) {
        themeToggle.innerHTML = themeName === "dark"
            ? '<i class="fas fa-sun"></i><span>Chế độ sáng</span>'
            : '<i class="fas fa-moon"></i><span>Chế độ tối</span>';
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const systemPrefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(savedTheme || (systemPrefersDark ? "dark" : "light"));

    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
            applyTheme(current === "dark" ? "light" : "dark");
        });
    }
}

// --- KHỞI TẠO HỆ THỐNG ---
async function init() {
    initTheme();

    if (window.ethereum) {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            window.ethereum.on("accountsChanged", () => location.reload());
            window.ethereum.on("chainChanged", () => location.reload());

            const accounts = await provider.listAccounts();
            if (accounts.length > 0) {
                await setupContract();
                const userAddress = await signer.getAddress();
                await updateAuthUI(userAddress);
            }
        } catch (error) {
            console.error("Lỗi khởi tạo:", error);
        }
    } else {
        alert("Vui lòng cài đặt MetaMask!");
    }
}

async function setupContract() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    contract = new ethers.Contract(contractAddress, contractABI, signer);
}

async function updateAuthUI(address) {
    const registeredName = await contract.voterNames(address);
    if (registeredName) showDashboard(address, registeredName);
}

async function handleAuth() {
    await setupContract();
    const inputName = document.getElementById("voterNameInput").value.trim();
    if (!inputName) return alert("Vui lòng nhập tên!");
    try {
        const tx = await contract.registerVoter(inputName);
        await tx.wait();
        location.reload();
    } catch (e) { alert("Lỗi đăng ký: " + (e.reason || e.message)); }
}

// --- GIAO DIỆN CHÍNH ---
async function showDashboard(address, name) {
    document.getElementById("authSection").style.display = "none";
    document.getElementById("mainDashboard").style.display = "block";

    const adminAddr = await contract.admin();
    const isAdmin = address.toLowerCase() === adminAddr.toLowerCase();
    
    const adminBtn = document.getElementById("adminQuickBtn");
    const roleLabel = document.getElementById("userRole");

    if (roleLabel) {
        roleLabel.innerText = isAdmin ? "Quản trị viên" : "Người bầu chọn";
        roleLabel.style.background = isAdmin ? "linear-gradient(135deg, #cf5e64, #b85059)" : "linear-gradient(135deg, #2d8a72, #4da88f)";
        roleLabel.style.color = "white";
    }

    if (isAdmin) {
        if (adminBtn) adminBtn.style.display = "inline-flex";
        
        const isPrivateMode = await contract.isPrivate();
        const modeSelect = document.getElementById("electionModeSelect");
        const whitelistMgmt = document.getElementById("whitelistManager");
        
        if (modeSelect) modeSelect.value = isPrivateMode.toString();
        if (whitelistMgmt) {
            whitelistMgmt.style.display = isPrivateMode ? "block" : "none";
            if (isPrivateMode) loadWhitelist();
        }
    }

    document.getElementById("displayName").innerText = `Xin chào: ${name}`;
    
    // Cập nhật hiển thị số phiếu đã dùng
    await updateVoterStatus(address);
    
    loadCandidates(isAdmin);
    loadVoteHistory();
    runCountdown();
}

// Hàm hiển thị số phiếu hiện tại của người dùng
async function updateVoterStatus(address) {
    try {
        const round = await contract.electionRound();
        const used = await contract.votesUsedInRound(address, round);
        const max = await contract.maxVotesPerVoter();
        const statusLabel = document.getElementById("voterStatusLabel");
        if (statusLabel) {
            statusLabel.innerHTML = `<i class="fas fa-ticket-alt"></i> Phiếu đã dùng: <strong>${used}/${max}</strong>`;
        }
    } catch (e) { console.error("Lỗi cập nhật trạng thái phiếu:", e); }
}

// --- QUẢN LÝ WHITELIST ---
async function loadWhitelist() {
    const itemsDiv = document.getElementById("whitelistItems");
    const countLabel = document.getElementById("whitelistCount");
    if (!itemsDiv) return;

    try {
        const addresses = await contract.getWhitelist();
        if (countLabel) countLabel.innerText = addresses.length;
        itemsDiv.innerHTML = "";

        if (addresses.length === 0) {
            itemsDiv.innerHTML = '<p class="section-note">Chưa có ví nào trong danh sách.</p>';
            return;
        }

        addresses.forEach(addr => {
            const row = document.createElement("div");
            row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--border-color); font-family: monospace; font-size: 0.8rem;";
            row.innerHTML = `
                <span>${addr.substring(0, 12)}...${addr.substring(addr.length - 6)}</span>
                <button onclick="removeFromWhitelist('${addr}')" style="background: none; border: none; color: #ff4d4d; cursor: pointer; padding: 5px;">
                    <i class="fas fa-user-minus"></i>
                </button>
            `;
            itemsDiv.appendChild(row);
        });
    } catch (err) {
        console.error("Lỗi tải Whitelist:", err);
    }
}

async function addVoterToWhitelist() {
    const addr = document.getElementById("whitelistAddressInput").value.trim();
    if (!ethers.isAddress(addr)) return alert("Địa chỉ ví không hợp lệ!");
    try {
        const tx = await contract.addToWhitelist(addr);
        await tx.wait();
        document.getElementById("whitelistAddressInput").value = "";
        loadWhitelist();
    } catch (e) { alert(e.reason || "Lỗi khi thêm ví!"); }
}

async function removeFromWhitelist(addr) {
    if (!confirm(`Xác nhận xóa ví ${addr}?`)) return;
    try {
        const tx = await contract.removeFromWhitelist(addr);
        await tx.wait();
        loadWhitelist();
    } catch (e) { alert(e.reason || "Lỗi khi xóa ví!"); }
}

async function changeElectionMode() {
    const isPrivate = document.getElementById("electionModeSelect").value === "true";
    try {
        const tx = await contract.setElectionMode(isPrivate);
        await tx.wait();
        location.reload();
    } catch (e) { alert(e.reason || "Lỗi chuyển chế độ!"); }
}

// --- QUẢN LÝ BẦU CỬ ---
async function runCountdown() {
    if (timerInterval) clearInterval(timerInterval);

    const updateUI = async () => {
        const timerLabel = document.getElementById("timerDisplay");
        const startBtn = document.getElementById("startElectionBtn");
        const stopBtn = document.getElementById("stopElectionBtn");
        if (!timerLabel) return;

        try {
            const isStarted = await contract.electionStarted();
            const endTime = await contract.endTime();
            const now = Math.floor(Date.now() / 1000);
            const timeLeft = Number(endTime) - now;

            if (!isStarted || timeLeft <= 0) {
                timerLabel.innerHTML = isStarted 
                    ? '<i class="fas fa-calendar-check"></i> Đã kết thúc.' 
                    : '<i class="fas fa-pause-circle"></i> Chờ Admin bắt đầu...';
                if (startBtn) startBtn.style.display = "inline-flex";
                if (stopBtn) stopBtn.style.display = "none";
            } else {
                const min = Math.floor(timeLeft / 60);
                const sec = timeLeft % 60;
                timerLabel.innerHTML = `<i class="fas fa-hourglass-half fa-spin"></i> Còn lại: ${min}ph : ${sec}s`;
                if (startBtn) startBtn.style.display = "none";
                if (stopBtn) stopBtn.style.display = "inline-flex";
            }
        } catch (err) { console.error(err); }
    };

    await updateUI();
    timerInterval = setInterval(updateUI, 1000);
}

// CẬP NHẬT: Thêm yêu cầu nhập số phiếu bầu tối đa
async function handleStartElection() {
    const min = prompt("Nhập số phút bầu cử:", "10");
    if (!min) return;

    const maxVotes = prompt("Mỗi cử tri được bầu tối đa bao nhiêu phiếu?", "1");
    if (!maxVotes || isNaN(maxVotes) || parseInt(maxVotes) <= 0) {
        return alert("Số phiếu không hợp lệ!");
    }

    try {
        const tx = await contract.startElection(min, maxVotes);
        await tx.wait();
        location.reload();
    } catch (e) { alert(e.reason || "Lỗi khởi tạo!"); }
}

async function handleEndElection() {
    if (!confirm("Dừng cuộc bầu cử ngay?")) return;
    try {
        const tx = await contract.endElection();
        await tx.wait();
        location.reload();
    } catch (e) { alert(e.reason || "Lỗi!"); }
}

async function vote(id) {
    try {
        const tx = await contract.vote(id);
        await tx.wait();
        alert("Bầu chọn thành công!");
        location.reload();
    } catch (e) { alert(e.reason || "Lỗi: Bạn đã hết lượt bầu hoặc không có quyền!"); }
}

// --- QUẢN LÝ ỨNG VIÊN ---
async function loadCandidates(isAdmin) {
    const listDiv = document.getElementById("candidateList");
    const resultsDiv = document.getElementById("resultsChart");
    if (!listDiv || !resultsDiv) return;

    try {
        const count = await contract.candidatesCount();
        let totalVotes = 0;
        const candidatesData = [];

        for (let i = 1; i <= Number(count); i++) {
            const c = await contract.getCandidate(i);
            if (c[4]) {
                totalVotes += Number(c[2]);
                candidatesData.push(c);
            }
        }

        listDiv.innerHTML = ""; resultsDiv.innerHTML = "";

        candidatesData.forEach(candidate => {
            const [id, name, votes] = candidate;
            const percentage = totalVotes > 0 ? (Number(votes) / totalVotes) * 100 : 0;
            const safeName = String(name).replace(/'/g, "\\'");

            const item = document.createElement("div");
            item.className = "candidate-item";
            item.innerHTML = `
                <div class="candidate-main">
                    <div class="candidate-avatar">${String(name).charAt(0).toUpperCase()}</div>
                    <div class="candidate-text"><strong>${name}</strong><small>ID: #${id}</small></div>
                </div>
                <div class="candidate-actions">
                    <button onclick="vote(${id})" class="vote-btn">Bầu</button>
                    ${isAdmin ? `
                        <button onclick="openEditModal(${id}, '${safeName}')" class="icon-btn edit-btn"><i class="fas fa-pen"></i></button>
                        <button onclick="deleteCandidate(${id})" class="icon-btn delete-btn"><i class="fas fa-trash"></i></button>
                    ` : ""}
                </div>`;
            listDiv.appendChild(item);

            const resultRow = document.createElement("div");
            resultRow.className = "result-row";
            resultRow.innerHTML = `
                <div class="result-head"><span>${name}</span><span>${votes} phiếu (${percentage.toFixed(1)}%)</span></div>
                <div class="bar-track"><div class="bar-fill" style="width: ${percentage}%;"></div></div>`;
            resultsDiv.appendChild(resultRow);
        });
    } catch (err) { console.error(err); }
}

async function addNewCandidate() {
    const nameInput = document.getElementById("candidateNameInput");
    if (!nameInput.value.trim()) return alert("Nhập tên!");
    try {
        const tx = await contract.addCandidate(nameInput.value.trim(), "");
        await tx.wait();
        location.reload();
    } catch (e) { alert(e.reason || e.message); }
}

async function deleteCandidate(id) {
    if (!confirm("Xóa ứng viên này?")) return;
    try {
        const tx = await contract.deleteCandidate(id);
        await tx.wait();
        location.reload();
    } catch (e) { alert(e.reason || e.message); }
}

// --- UTILS & MODAL ---
function openEditModal(id, currentName) {
    document.getElementById("editCandidateId").value = id;
    document.getElementById("editCandidateName").value = currentName;
    document.getElementById("modalBackdrop").style.display = "block";
    document.getElementById("editCandidateSection").style.display = "block";
}

function closeEditModal() {
    document.getElementById("modalBackdrop").style.display = "none";
    document.getElementById("editCandidateSection").style.display = "none";
}

async function saveCandidateEdit() {
    const id = document.getElementById("editCandidateId").value;
    const newName = document.getElementById("editCandidateName").value.trim();
    try {
        const tx = await contract.updateCandidate(id, newName, "");
        await tx.wait();
        location.reload();
    } catch (e) { alert(e.reason || "Lỗi!"); }
}

async function loadVoteHistory() {
    const historyDiv = document.getElementById("voteHistoryList");
    if (!historyDiv) return;

    try {
        const count = await contract.getVoteHistoryCount();
        const total = Number(count);
        historyDiv.innerHTML = "";

        if (total === 0) {
            historyDiv.innerHTML = '<p class="section-note">Chưa có bản ghi phiếu bầu nào.</p>';
            return;
        }

        for (let i = total - 1; i >= Math.max(0, total - 10); i--) {
            const record = await contract.voteHistory(i);
            const timeString = new Date(Number(record[2]) * 1000).toLocaleString("vi-VN");

            const row = document.createElement("div");
            row.className = "history-entry";
            row.innerHTML = `
                <div class="history-item-header">
                    <span class="round-tag">Đợt #${record[3]}</span>
                    <span class="time-tag"><i class="far fa-clock"></i> ${timeString}</span>
                </div>
                <div class="history-item-body">
                    <p><strong>Ví:</strong> ${record[0].substring(0, 12)}...${record[0].substring(38)}</p>
                    <p><strong>Bầu cho ID:</strong> <span class="candidate-id-tag">#${record[1]}</span></p>
                </div>
            `;
            historyDiv.appendChild(row);
        }
    } catch (err) {
        console.error("Lỗi load lịch sử:", err);
    }
}

window.handleAuth = handleAuth;
window.handleStartElection = handleStartElection;
window.handleEndElection = handleEndElection;
window.vote = vote;
window.addNewCandidate = addNewCandidate;
window.deleteCandidate = deleteCandidate;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.saveCandidateEdit = saveCandidateEdit;
window.changeElectionMode = changeElectionMode;
window.addVoterToWhitelist = addVoterToWhitelist;
window.removeFromWhitelist = removeFromWhitelist;
window.toggleAdminPanel = () => {
    const panel = document.getElementById("adminSection");
    panel.style.display = panel.style.display === "none" ? "block" : "none";
};

init();